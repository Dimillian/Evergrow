import type { DungeonFloor } from './dungeon.ts';
import { cryptOutline } from './dungeon-contours.ts';
import { dungeonTheme } from './dungeon-content.ts';
import type { CameraView } from './camera.ts';
import type { PointLight } from './lighting.ts';

const vertex = 'attribute vec2 p; varying vec2 uv; void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const fragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D floorMask, visibility;
uniform vec4 view, lamps[8];
uniform vec3 colors[8];
uniform float time, damp, mode;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
void main(){
  vec2 st=vec2(uv.x,1.-uv.y), world=view.xy+st*view.zw;
  float coverage=texture2D(floorMask,st).r;
  if(coverage<.01){gl_FragColor=vec4(0.);return;}
  // Broad moisture pockets, with dry mortar interrupting individual stone facets.
  float row=floor(world.y/16.);
  vec2 slab=vec2(world.x-mod(row,2.)*12.,world.y);
  vec2 cell=floor(slab/vec2(24.,16.)), local=mod(slab,vec2(24.,16.));
  float seam=smoothstep(.7,2.8,min(min(local.x,24.-local.x),min(local.y,16.-local.y)));
  float wet=smoothstep(.34,.76,noise(world*.013)+damp*.22)*seam*damp;
  vec3 normal=normalize(vec3((hash(cell)-.5)*.32,(hash(cell+7.)-.5)*.22,1.));
  vec3 eye=normalize(vec3(0.,.65,1.));
  vec2 drift=vec2(time*2.7,-time*1.4);
  float cloud=noise((world+drift)*vec2(.008,.022));
  float wisps=noise((world-drift*.6)*vec2(.021,.045)+cloud*2.);
  float density=smoothstep(.24,.83,cloud*.7+wisps*.3);
  vec3 light=vec3(0.);
  for(int i=0;i<8;i++){
    vec4 source=lamps[i];
    if(source.w<=0.)continue;
    vec2 delta=world-source.xy;
    vec2 q=delta/(source.z*2.)+.5;
    if(q.x<=0.||q.y<=0.||q.x>=1.||q.y>=1.)continue;
    vec2 tile=vec2(mod(float(i),4.),floor(float(i)/4.));
    float visible=texture2D(visibility,(tile+clamp(q,vec2(.006),vec2(.994)))/vec2(4.,2.)).r;
    float falloff=pow(max(0.,1.-length(delta)/source.z),1.7)*visible*source.w;
    if(mode<.5){
      // Surface normal and fixed viewing angle create elongated broken reflections.
      vec3 incoming=normalize(vec3(-delta.x,-delta.y,80.));
      vec3 halfway=normalize(incoming+eye);
      float spec=pow(max(0.,dot(normal,halfway)),mix(14.,48.,wet));
      light+=colors[i]*falloff*wet*(spec*.95+.08*damp);
    }else{
      // Forward scattering is strongest just below a lamp, carried by slow air banks.
      float shaft=exp(-pow(delta.x/(24.+abs(delta.y)*.3),2.))*.28*smoothstep(-30.,80.,delta.y);
      light+=colors[i]*falloff*density*(.25+shaft)*(.55+damp*.45);
    }
  }
  if(mode<.5){gl_FragColor=vec4(light*coverage,1.);}
  else{
    vec3 air=mix(vec3(.12,.17,.15),vec3(.11,.20,.24),damp);
    float alpha=density*(.035+damp*.035)*coverage;
    gl_FragColor=vec4((light+air*alpha)*coverage,1.);
  }
}`;

/** Two small presentation passes. No scene readback, simulation or full-resolution textures. */
export class DungeonLightEffects {
  private canvas = document.createElement('canvas');
  private coverage = document.createElement('canvas');
  private atlas = document.createElement('canvas');
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private textures: WebGLTexture[] = [];
  private buffer: WebGLBuffer | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private floor: DungeonFloor | undefined;
  private outline: Path2D | undefined;
  private coverageAllocated = false;
  private atlasAllocated = false;
  private coverageKey = '';
  private maskKeys: unknown[] = [];
  private positions = new Float32Array(32);
  private colors = new Float32Array(24);
  private attempted = false;
  private lost = false;
  constructor() {
    this.atlas.width=512;this.atlas.height=256;
    this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;});
    this.canvas.addEventListener('webglcontextrestored',()=>{this.clearHandles();this.attempted=false;this.lost=false;});
  }
  private setup() {
    if(this.attempted)return !!this.program;
    this.attempted=true;
    const gl=this.gl=this.canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false});
    if(!gl)return false;
    const shaders:WebGLShader[]=[];
    try{
      const program=this.program=gl.createProgram();if(!program)throw Error('Dungeon effect allocation');
      for(const [kind,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]] as const){
        const shader=gl.createShader(kind);if(!shader)throw Error('Dungeon shader allocation');shaders.push(shader);
        gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)??'Dungeon shader compilation');
        gl.attachShader(program,shader);
      }
      gl.bindAttribLocation(program,0,'p');gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)??'Dungeon shader linking');
      gl.useProgram(program);
      this.uniforms=Object.fromEntries(['floorMask','visibility','view','lamps[0]','colors[0]','time','damp','mode'].map(n=>[n,gl.getUniformLocation(program,n)]));
      gl.uniform1i(this.uniforms.floorMask,0);gl.uniform1i(this.uniforms.visibility,1);
      this.buffer=gl.createBuffer();if(!this.buffer)throw Error('Dungeon geometry allocation');gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      for(let i=0;i<2;i++){
        const texture=gl.createTexture();if(!texture)throw Error('Dungeon mask allocation');this.textures.push(texture);
        gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      }
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
      return true;
    }catch(error){console.warn('Dungeon lighting detail unavailable; using existing lighting.',error);this.release();return false;}
    finally{for(const shader of shaders)gl.deleteShader(shader);}
  }
  prepare(floor:DungeonFloor,view:CameraView,lights:readonly PointLight[],time:number,reduced:boolean,width:number,height:number):boolean {
    if(this.lost||!this.setup())return false;
    const gl=this.gl!;
    const scale=Math.min(.5,640/width,640/height),w=Math.max(1,Math.ceil(width*scale)),h=Math.max(1,Math.ceil(height*scale));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.coverage.width=w;this.coverage.height=h;this.coverageKey='';this.coverageAllocated=false;}
    if(this.floor!==floor){
      this.floor=floor;this.outline=new Path2D();this.coverageKey='';this.maskKeys=[];
      for(const room of [...floor.rooms,...floor.corridors]){
        cryptOutline(room).forEach((p,i)=>i?this.outline!.lineTo(p.x,p.y):this.outline!.moveTo(p.x,p.y));this.outline.closePath();
      }
    }
    const key=`${view.left}:${view.top}:${view.width}:${view.height}`;
    if(key!==this.coverageKey){
      const c=this.coverage.getContext('2d')!;c.setTransform(1,0,0,1,0,0);c.fillStyle='#000';c.fillRect(0,0,w,h);
      c.setTransform(w/view.width,0,0,h/view.height,-view.left*w/view.width,-view.top*h/view.height);c.fillStyle='#fff';c.fill(this.outline!);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.textures[0]);if(this.coverageAllocated)gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,this.coverage);
      else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.coverage);
      this.coverageAllocated=true;this.coverageKey=key;
    }
    // The existing scene list already prioritizes player, combat and visible fixtures.
    const chosen=lights.slice(0,8),c=this.atlas.getContext('2d')!;let dirty=false;
    this.positions.fill(0);this.colors.fill(0);
    for(let i=0;i<8;i++){
      const light=chosen[i],maskKey=light?.clip;
      // Moving sources can share a quantized fan but still need a translated atlas.
      const key=light?`${light.x}:${light.y}:${light.radius}`:'';
      if(this.maskKeys[i*2]!==maskKey||this.maskKeys[i*2+1]!==key){
        this.maskKeys[i*2]=maskKey;this.maskKeys[i*2+1]=key;dirty=true;
        const x=i%4*128,y=Math.floor(i/4)*128;c.setTransform(1,0,0,1,0,0);c.fillStyle='#000';c.fillRect(x,y,128,128);
        if(light){
          c.save();c.beginPath();c.rect(x,y,128,128);c.clip();
          const scale=64/light.radius;c.setTransform(scale,0,0,scale,x+64-light.x*scale,y+64-light.y*scale);
          c.fillStyle='#fff';c.beginPath();
          if(light.clip?.length){light.clip.forEach((p,n)=>n?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();}
          else c.fillRect(light.x-light.radius,light.y-light.radius,light.radius*2,light.radius*2);
          c.restore();
        }
      }
      if(!light)continue;
      this.positions.set([light.x,light.y,light.radius,Math.max(0,Math.min(1.5,light.power))],i*4);
      const color=Number.parseInt(light.color.slice(1),16);this.colors.set([(color>>16&255)/255,(color>>8&255)/255,(color&255)/255],i*3);
    }
    if(dirty){gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.textures[1]);if(this.atlasAllocated)gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,this.atlas);
      else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.atlas);this.atlasAllocated=true;}
    gl.useProgram(this.program);gl.uniform4fv(this.uniforms['lamps[0]'],this.positions);gl.uniform3fv(this.uniforms['colors[0]'],this.colors);
    gl.uniform4f(this.uniforms.view,view.left,view.top,view.width,view.height);gl.uniform1f(this.uniforms.time,reduced?0:time);
    gl.uniform1f(this.uniforms.damp,dungeonTheme(floor.seed).id==='drowned'?1:dungeonTheme(floor.seed).id==='rootbound'?.55:.12);
    return true;
  }
  draw(c:CanvasRenderingContext2D,view:CameraView,air:boolean){
    if(!this.program||this.lost)return;
    const gl=this.gl!;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    for(let i=0;i<2;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,this.textures[i]);}
    gl.uniform1f(this.uniforms.mode,air?1:0);gl.drawArrays(gl.TRIANGLES,0,6);
    c.save();c.globalCompositeOperation='screen';c.imageSmoothingEnabled=true;
    c.drawImage(this.canvas,view.left,view.top,view.width,view.height);c.restore();
  }
  private release(){
    if(this.gl&&!this.gl.isContextLost()){for(const t of this.textures)this.gl.deleteTexture(t);this.gl.deleteProgram(this.program);this.gl.deleteBuffer(this.buffer);}
    this.clearHandles();
  }
  private clearHandles(){
    this.program=null;this.textures=[];this.buffer=null;this.coverageKey='';this.maskKeys=[];this.coverageAllocated=this.atlasAllocated=false;
  }
  reset(){this.release();this.attempted=false;this.floor=undefined;this.outline=undefined;}
}
