import type { World, Prop } from './world.ts';
import type { CameraView } from './camera.ts';
import type { Sprite } from './art-types.ts';
import type { PointLight } from './lighting.ts';
import { propDefinition } from './biome-props.ts';
import { biomeWind } from './biome-wind.ts';
import { skyAtHour, type SkyState } from './world-time.ts';
import { shadowProjection } from './scene-light-style.ts';
import { OUTDOOR_LIGHT_RULES as RULES, outdoorLightCell } from './outdoor-light-content.ts';

const vertex = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const fragment = `
precision highp float;
varying vec2 uv;
uniform sampler2D field, crowns, climates, openlands;
uniform vec4 view, bounds, lamps[4];
uniform vec3 colors[4], skyTint, skyDirection;
uniform float daylight, skyPower;
uniform vec2 focus;
uniform float time, mode, enclosure;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float cover(vec2 p){return texture2D(crowns,(p-bounds.xy)/bounds.zw).r;}
float overhead(vec2 p){return texture2D(crowns,(p-bounds.xy)/bounds.zw).g;}
void main(){
  vec2 world=view.xy+vec2(uv.x,1.-uv.y)*view.zw;
  vec4 climate=texture2D(field,(world-bounds.xy)/bounds.zw);
  vec2 fieldUV=(world-bounds.xy)/bounds.zw;
  vec4 biomes=texture2D(climates,fieldUV), lands=texture2D(openlands,fieldUV);
  float dead=biomes.r, frost=biomes.g, ember=biomes.b, autumn=biomes.a;
  float hills=lands.r, steppe=lands.g, desert=lands.b;
  float strength=climate.a*(1.-enclosure);
  if(strength<.002){gl_FragColor=vec4(0.);return;}
  float mire=climate.g;
  vec3 sky=(vec3(1.,.87,.47)*(climate.r+autumn)+vec3(.48,.78,.79)*mire
    +vec3(.66,.77,.94)*(dead+frost+hills)+vec3(1.,.64,.36)*(ember+desert)+vec3(.98,.92,.67)*steppe)*skyTint;
  vec2 sun=normalize(-skyDirection.xy);
  float cloudMass=smoothstep(.32,.74,noise(world*.0018+vec2(time*.007,time*.002))*.7+noise(world*.004+vec2(time*.011,time*.003))*.3);
  if(mode>1.5){
    float shade=cloudMass*(.16+.14*hills+.08*steppe-.09*desert)*(.25+.75*daylight)*strength;
    gl_FragColor=vec4(vec3(1.-shade,1.-shade*.94,1.-shade*.80),1.);return;
  }
  float canopy=cover(world),light=1.-canopy*.85;
  float cloud=1.-cloudMass*.50;
  vec3 result=vec3(0.);
  if(mode<.5){
    // Broken broad highlights: damp ground has relief, not mirror-like puddles everywhere.
    float relief=noise(world*.065),grain=noise(world*vec2(.17,.42));
    float texturedGloss=pow(max(0.,relief*.8+grain*.2),4.);
    // Mire ground reads as damp soil, not a field of high-contrast cyan flecks.
    float softGloss=pow(noise(world*vec2(.013,.021)),2.)*.16;
    float gloss=mix(texturedGloss,softGloss,mire)*climate.b;
    float pools=smoothstep(.38,.76,noise(world*.014));
    result=sky*gloss*light*cloud*(.45+mire*.10)*skyPower;
    // Gentle golden pools under gaps, interrupted by real projected foliage.
    result+=sky*light*cloud*pools*.085*(climate.r+autumn)*skyPower;
    // Snow catches tiny moving glints; exposed grass carries broad wind bands.
    vec2 flake=world*.18;
    float fleck=pow(hash(floor(flake)),35.)*pow(max(0.,sin(time*.8+hash(floor(flake))*90.)),12.);
    float wind=smoothstep(.65,.95,noise(world*vec2(.012,.06)+vec2(time*.14,time*.04)));
    result+=vec3(.65,.83,1.)*fleck*frost*skyPower*.65;
    result+=sky*wind*(steppe*.13+hills*.035)*light*skyPower;
    for(int i=0;i<4;i++){
      vec4 l=lamps[i];if(l.w<=0.)continue;
      vec2 d=(world-l.xy)/vec2(1.,1.55);
      float fall=pow(max(0.,1.-length(d)/max(1.,l.z*.6)),2.);
      result+=colors[i]*fall*l.w*gloss*.9;
    }
  }else{
    vec2 flow=world+vec2(time*3.2,-time*1.1);
    float body=noise(flow*vec2(.006,.018));
    float curl=noise(flow*vec2(.018,.035)+body*2.);
    float mist=smoothstep(.27,.83,body*.65+curl*.35);
    // Broad, slowly sliding banks replace turbulent fine noise in the Mire.
    vec2 mireFlow=world+vec2(time*1.25,-time*.35);
    float broad=noise(mireFlow*vec2(.0028,.006));
    float detail=noise(mireFlow*vec2(.006,.009)+vec2(17.,3.));
    float softMist=smoothstep(.12,.94,broad*.82+detail*.18);
    mist=mix(mist,softMist,mire);
    float clearance=mix(1.,.36+.64*smoothstep(65.,270.,length((world-focus)/vec2(1.15,1.))),mire);
    // Sample the real canopy's light gaps along the shared sky direction.
    float shaft=0.;
    for(int i=0;i<8;i++){
      float travel=float(i)*32.;
      shaft+=1.-overhead(world-sun*travel);
    }
    shaft/=8.;
    float ribbon=noise(vec2(dot(world,vec2(-sun.y,sun.x))*.047,time*.018));
    float rays=pow(shaft,4.)*pow(ribbon,3.5)*(1.-overhead(world)*.97);
    // Banked air around damp ground; keep clear paths legible instead of a uniform screen veil.
    vec3 haze=vec3(.26,.36,.27)*climate.r+vec3(.20,.40,.43)*mire+vec3(.34,.40,.48)*dead
      +vec3(.51,.67,.85)*frost+vec3(.35,.20,.19)*ember+vec3(.53,.37,.16)*autumn
      +vec3(.40,.42,.58)*hills+vec3(.52,.47,.28)*steppe+vec3(.66,.43,.22)*desert;
    float density=.06*climate.r+.13*mire+.20*dead+.08*frost+.10*ember+.06*autumn+.20*hills*lands.a+.018*steppe+.06*desert;
    result=haze*skyTint*mist*(density+climate.b*.09)*(.42+.58*daylight);
    float beam=climate.r*.95+mire*.055+autumn*.85+frost*.38+dead*.15+hills*.05;
    result+=sky*rays*mist*cloud*beam*skyPower;
    // Windblown powder and sand stay low in narrow, broken ribbons.
    float drift=pow(noise((world+vec2(time*14.,time*2.))*vec2(.009,.075)),4.);
    result+=haze*drift*(frost*.25+desert*.28+steppe*.07)*(.35+.65*daylight);
    // Sparse embers rise only near actual warm emissive fixtures/props.
    vec2 sparkGrid=(world+vec2(sin(time*.4)*5.,time*17.))*.075;
    float spark=pow(hash(floor(sparkGrid)),55.)*(1.-smoothstep(.04,.14,length(fract(sparkGrid)-.5)));
    float heat=0.;
    for(int i=0;i<4;i++)heat+=max(0.,colors[i].r-colors[i].b)*lamps[i].w*max(0.,1.-length(world-lamps[i].xy)/max(1.,lamps[i].z));
    result+=vec3(1.,.32,.045)*spark*ember*min(1.,heat)*2.;
    for(int i=0;i<4;i++){
      vec4 l=lamps[i];if(l.w<=0.)continue;
      float fall=pow(max(0.,1.-length(world-l.xy)/max(1.,l.z)),1.8);
      result+=colors[i]*fall*l.w*mist*mix(.30,.14,mire);
    }
    result*=clearance;
  }
  gl_FragColor=vec4(result*strength,1.);
}`;

/** Outdoor half-resolution surface, cloud and air passes. Cached metadata and real foliage silhouettes; no scene readback. */
export class OutdoorLightEffects {
  private canvas = document.createElement('canvas');
  private canopy = document.createElement('canvas');
  private silhouettes = new WeakMap<HTMLCanvasElement, readonly HTMLCanvasElement[]>();
  private cells = new Map<string, readonly number[]>();
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private textures: WebGLTexture[] = [];
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private attempted = false;
  private lost = false;
  private world?: World;
  private fieldKey = '';
  private canopyKey = '';
  private props?: readonly Prop[];
  private fieldSize = '';
  private canopyAllocated = false;
  private data = [new Uint8Array(0),new Uint8Array(0),new Uint8Array(0)];
  private positions = new Float32Array(16);
  private colors = new Float32Array(12);
  constructor() {
    this.canopy.width=this.canopy.height=RULES.maskSize;
    this.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;});
    this.canvas.addEventListener('webglcontextrestored',()=>{this.clearHandles();this.attempted=false;this.lost=false;});
  }
  private setup() {
    if(this.attempted)return !!this.program;
    this.attempted=true;
    const gl=this.gl=this.canvas.getContext('webgl',{alpha:true,antialias:false,depth:false});if(!gl)return false;
    const shaders:WebGLShader[]=[];
    try{
      const program=this.program=gl.createProgram();if(!program)throw Error('Outdoor shader allocation');
      for(const [kind,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]] as const){
        const shader=gl.createShader(kind);if(!shader)throw Error('Outdoor shader allocation');shaders.push(shader);
        gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader)??'Outdoor shader compile');gl.attachShader(program,shader);
      }
      gl.bindAttribLocation(program,0,'p');gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)??'Outdoor shader link');
      gl.useProgram(program);this.uniforms=Object.fromEntries(['field','crowns','view','bounds','time','mode','enclosure','lamps[0]','colors[0]','climates','openlands','skyTint','skyDirection','daylight','skyPower','focus'].map(n=>[n,gl.getUniformLocation(program,n)]));
      gl.uniform1i(this.uniforms.field,0);gl.uniform1i(this.uniforms.crowns,1);gl.uniform1i(this.uniforms.climates,2);gl.uniform1i(this.uniforms.openlands,3);
      this.buffer=gl.createBuffer();if(!this.buffer)throw Error('Outdoor geometry allocation');gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      for(let i=0;i<4;i++){
        const t=gl.createTexture();if(!t)throw Error('Outdoor texture allocation');this.textures.push(t);gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,t);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      }
      gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);return true;
    }catch(error){console.warn('Outdoor light detail unavailable; retaining established atmosphere.',error);this.release();return false;}
    finally{for(const s of shaders)gl.deleteShader(s);}
  }
  private masks(source:HTMLCanvasElement){
    const found=this.silhouettes.get(source);if(found)return found;
    const masks=['#ff0000','#00ff00'].map(color=>{
      const mask=document.createElement('canvas'),scale=Math.min(1,160/Math.max(source.width,source.height));mask.width=Math.max(1,Math.ceil(source.width*scale));mask.height=Math.max(1,Math.ceil(source.height*scale));
      const c=mask.getContext('2d')!;c.drawImage(source,0,0,mask.width,mask.height);c.globalCompositeOperation='source-in';c.fillStyle=color;c.fillRect(0,0,mask.width,mask.height);return mask;
    });
    this.silhouettes.set(source,masks);return masks;
  }
  prepare(world:World,view:CameraView,props:readonly Prop[],spriteFor:(p:Prop)=>Sprite,lights:readonly PointLight[],time:number,reduced:boolean,enclosure:number,width:number,height:number,sky:SkyState=skyAtHour(9),focus:{x:number;y:number}={x:view.left+view.width/2,y:view.top+view.height/2}){
    if(enclosure>.99||this.lost)return false;
    if(!this.setup())return false;
    const gl=this.gl!,scale=Math.min(.5,RULES.maxAxis/width,RULES.maxAxis/height);
    const w=Math.max(1,Math.ceil(width*scale)),h=Math.max(1,Math.ceil(height*scale));
    if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
    if(this.world!==world){this.world=world;this.cells.clear();this.fieldKey='';this.canopyKey='';}
    const cell=RULES.cell,left=Math.floor((view.left-RULES.margin)/cell)*cell,top=Math.floor((view.top-RULES.margin)/cell)*cell;
    const cols=Math.ceil((view.left+view.width+RULES.margin-left)/cell),rows=Math.ceil((view.top+view.height+RULES.margin-top)/cell);
    const bw=cols*cell,bh=rows*cell,key=`${left}:${top}:${cols}:${rows}`;
    if(this.fieldKey!==key){
      if(this.data[0].length!==cols*rows*4)this.data=this.data.map(()=>new Uint8Array(cols*rows*4));
      for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
        const wx=left+(x+.5)*cell,wy=top+(y+.5)*cell,k=`${wx}:${wy}`;let value=this.cells.get(k);
        if(!value){value=outdoorLightCell(world,wx,wy);if(this.cells.size>=RULES.cacheLimit)this.cells.delete(this.cells.keys().next().value!);this.cells.set(k,value);}
        for(let channel=0;channel<3;channel++)this.data[channel].set(value.slice(channel*4,channel*4+4),(y*cols+x)*4);
      }
      const size=`${cols}:${rows}`;
      for(const [channel,unit] of [0,2,3].entries()){
        gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,this.textures[unit]);
        if(size===this.fieldSize)gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,cols,rows,gl.RGBA,gl.UNSIGNED_BYTE,this.data[channel]);
        else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,cols,rows,0,gl.RGBA,gl.UNSIGNED_BYTE,this.data[channel]);
      }
      this.fieldSize=size;this.fieldKey=key;
    }
    const t=reduced?0:time,canopyKey=`${key}:${Math.floor(t*RULES.canopyHz)}:${Math.floor(sky.hour*120)}`;
    if(canopyKey!==this.canopyKey||props!==this.props){
      const c=this.canopy.getContext('2d')!,size=RULES.maskSize,projection=shadowProjection(sky.direction);
      c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.globalAlpha=1;c.fillStyle='#000';c.fillRect(0,0,size,size);c.globalCompositeOperation='lighter';
      c.setTransform(size/bw,0,0,size/bh,-left*size/bw,-top*size/bh);let count=0;
      for(const prop of props){
        const definition=propDefinition(prop.kind);if(!definition.canopy||count>=RULES.maxCanopies)continue;
        if(prop.x<left-160||prop.x>left+bw+160||prop.y<top-160||prop.y>top+bh+160)continue;
        const sprite=spriteFor(prop);if(!sprite.foliage?.length)continue;count++;
        c.save();c.translate(prop.x,prop.y+1);c.scale(prop.scale,prop.scale);
        for(const [layer,foliage] of sprite.foliage.entries()){
          const wind=biomeWind(prop.x,prop.y,t-layer*.18,prop.biome??'deadwood',reduced);
          const gust=wind.x*definition.sway*2.2;
          const [ground,air]=this.masks(foliage);
          c.save();c.transform(1,0,-projection.x+gust*(layer?-.009:-.005),-projection.y,wind.x*1.4,wind.y);
          c.globalAlpha=.83;c.drawImage(ground,-sprite.anchorX,-sprite.anchorY,sprite.width,sprite.height);c.restore();
          c.save();c.transform(1,0,gust*(layer?-.009:-.005),1,0,0);c.globalAlpha=.9;
          c.drawImage(air,-sprite.anchorX,-sprite.anchorY,sprite.width,sprite.height);c.restore();
        }
        c.restore();
      }
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.textures[1]);
      if(this.canopyAllocated)gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,this.canopy);
      else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,this.canopy);
      this.canopyAllocated=true;this.canopyKey=canopyKey;this.props=props;
    }
    this.positions.fill(0);this.colors.fill(0);
    for(const [i,light] of lights.slice(0,4).entries()){
      this.positions.set([light.x,light.y,light.radius,Math.min(1.5,Math.max(0,light.power))],i*4);
      const color=parseInt(light.color.slice(1),16);this.colors.set([(color>>16&255)/255,(color>>8&255)/255,(color&255)/255],i*3);
    }
    gl.useProgram(this.program);gl.uniform4f(this.uniforms.view,view.left,view.top,view.width,view.height);gl.uniform4f(this.uniforms.bounds,left,top,bw,bh);
    gl.uniform3fv(this.uniforms.skyTint,sky.tint);gl.uniform3fv(this.uniforms.skyDirection,sky.direction);
    gl.uniform2f(this.uniforms.focus,focus.x,focus.y);
    gl.uniform1f(this.uniforms.daylight,sky.daylight);gl.uniform1f(this.uniforms.skyPower,sky.power);
    gl.uniform1f(this.uniforms.time,t);gl.uniform1f(this.uniforms.enclosure,enclosure);gl.uniform4fv(this.uniforms['lamps[0]'],this.positions);gl.uniform3fv(this.uniforms['colors[0]'],this.colors);
    return true;
  }
  draw(c:CanvasRenderingContext2D,view:CameraView,air:boolean,clouds=false){
    if(!this.program||this.lost)return;
    const gl=this.gl!;gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    for(let i=0;i<4;i++){gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,this.textures[i]);}gl.uniform1f(this.uniforms.mode,clouds?2:air?1:0);gl.drawArrays(gl.TRIANGLES,0,6);
    c.save();c.globalCompositeOperation=clouds?'multiply':'screen';c.imageSmoothingEnabled=true;c.drawImage(this.canvas,view.left,view.top,view.width,view.height);c.restore();
  }
  private clearHandles(){this.program=null;this.buffer=null;this.textures=[];this.fieldKey=this.fieldSize=this.canopyKey='';this.canopyAllocated=false;this.props=undefined;}
  private release(){if(this.gl&&!this.gl.isContextLost()){for(const t of this.textures)this.gl.deleteTexture(t);this.gl.deleteBuffer(this.buffer);this.gl.deleteProgram(this.program);}this.clearHandles();}
  reset(){this.release();this.attempted=false;this.world=undefined;this.cells.clear();this.silhouettes=new WeakMap();}
}
