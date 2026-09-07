import type { GearShape } from './weapon-shapes.ts';
import { gearShapeColor } from './weapon-shapes.ts';
import { GEAR_MATERIALS, GEAR_MATERIAL_IDS } from './gear-material.ts';

const vertex = `attribute vec2 p; varying vec2 uv; void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
const fragment = `precision mediump float;
varying vec2 uv; uniform sampler2D pigment; uniform sampler2D surface; uniform vec2 light; uniform vec3 lamp; uniform float power;
void main(){
  vec4 base=texture2D(pigment,uv); if(base.a<.01){gl_FragColor=vec4(0.);return;}
  vec4 data=texture2D(surface,uv);vec2 xy=data.rg*2.-1.;vec3 normal=normalize(vec3(xy,sqrt(max(.01,1.-dot(xy,xy)))));
  vec3 direction=normalize(vec3((light-uv)*1.8,.65));
  float diffuse=max(0.,dot(normal,direction));
  float material=floor(data.b*255.+.5),roughness=.8,metalness=0.;
  ${GEAR_MATERIAL_IDS.map((id,i)=>`if(abs(material-${i}.0)<.5){roughness=${GEAR_MATERIALS[id].roughness.toFixed(3)};metalness=${GEAR_MATERIALS[id].metalness.toFixed(3)};}`).join('')}

  vec3 halfway=normalize(direction+vec3(0.,0.,1.));
  float specular=pow(max(0.,dot(normal,halfway)),(6.+(1.-roughness)*90.));
  vec3 albedo=pow(base.rgb,vec3(2.2));
  vec3 specTint=mix(vec3(1.),albedo,metalness);
  vec3 color=albedo*(vec3(.35)+diffuse*.72*power*lamp)+lamp*specTint*specular*(1.-roughness)*(metalness*.56+.12)*power;
  color=pow(max(color,vec3(0.)),vec3(1./2.2));
  gl_FragColor=vec4(color,base.a);
}`;

/** Optional isolated study. Two cached textures, one draw call, no scene-renderer changes. */
export class GearLightStudy {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private textures: WebGLTexture[] = [];
  private buffer: WebGLBuffer;
  constructor(canvas: HTMLCanvasElement, shapes: readonly GearShape[]) {
    const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:false,antialias:false});
    if(!gl) throw new Error('Lighting study unavailable');
    this.gl=gl;
    const shaders:WebGLShader[]=[];
    try {
      for(const [kind,source] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]] as const) {
        const shader=gl.createShader(kind);if(!shader) throw new Error('Shader allocation failed');
        shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);
        if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error('Shader compilation failed');
      }
      const program=gl.createProgram();if(!program) throw new Error('Program allocation failed');this.program=program;
      for(const shader of shaders)gl.attachShader(program,shader);gl.linkProgram(program);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Shader linking failed');
      gl.useProgram(program);
      const buffer=gl.createBuffer();if(!buffer)throw new Error('Buffer allocation failed');this.buffer=buffer;
      gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
      this.setShapes(shapes);
    } catch(error) {this.dispose();throw error;} finally {for(const shader of shaders)gl.deleteShader(shader);}
  }
  setShapes(shapes:readonly GearShape[]):void {
    const gl=this.gl,program=this.program;
    gl.useProgram(program);
    for(const texture of this.textures)gl.deleteTexture(texture);this.textures=[];
      const points=shapes.flatMap(s=>s.points),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
      const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
      const scale=Math.min(410/Math.max(1,maxX-minX),410/Math.max(1,maxY-minY));
      for(let layer=0;layer<2;layer++) {
        const textureCanvas=document.createElement('canvas');textureCanvas.width=textureCanvas.height=512;
        const ctx=textureCanvas.getContext('2d')!;
        ctx.translate(256,256);ctx.scale(scale,scale);ctx.translate(-(minX+maxX)/2,-(minY+maxY)/2);
        for(const shape of shapes) {
          if(!shape.points.length)continue;
          ctx.beginPath();ctx.moveTo(...shape.points[0]);for(const p of shape.points.slice(1))ctx.lineTo(...p);
          const n=shape.surface?.normal??[0,0,1],material=shape.surface?GEAR_MATERIAL_IDS.indexOf(shape.surface.material):4;
          const normal=`rgba(${Math.round((n[0]*.5+.5)*255)},${Math.round((-.5*n[1]+.5)*255)},${material},1)`;
          if(shape.fill){ctx.closePath();ctx.fillStyle=layer?normal:gearShapeColor(shape.surface?.albedo??shape.fill);ctx.fill();}
          if(shape.stroke){ctx.strokeStyle=layer?normal:gearShapeColor(shape.stroke);ctx.lineWidth=shape.width??.7;ctx.stroke();}
        }
        const texture=gl.createTexture();if(!texture)throw new Error('Texture allocation failed');this.textures.push(texture);
        gl.activeTexture(gl.TEXTURE0+layer);gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,1);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,0);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,textureCanvas);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.uniform1i(gl.getUniformLocation(program,layer?'surface':'pigment'),layer);
      }
  }
  draw(x:number,y:number,color:readonly [number,number,number]=[.9,.95,1],power=1):void {
    const gl=this.gl;gl.viewport(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight);gl.useProgram(this.program);
    gl.uniform2f(gl.getUniformLocation(this.program,'light'),x,y);
    gl.uniform3f(gl.getUniformLocation(this.program,'lamp'),...color);gl.uniform1f(gl.getUniformLocation(this.program,'power'),power);gl.drawArrays(gl.TRIANGLES,0,6);
  }
  dispose():void {
    for(const texture of this.textures)this.gl.deleteTexture(texture);this.textures=[];
    if(this.buffer)this.gl.deleteBuffer(this.buffer);if(this.program)this.gl.deleteProgram(this.program);
  }
}
