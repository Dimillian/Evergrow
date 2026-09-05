export type VisualMode = 'crt' | 'phosphor' | 'clean';

const vertex = `attribute vec2 a_position; varying vec2 v_uv;
void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}`;
const fragment = `precision mediump float;
varying vec2 v_uv; uniform sampler2D u_scene; uniform vec2 u_size;
uniform float u_mode; uniform float u_hurt;
void main(){
  vec3 c=texture2D(u_scene,v_uv).rgb;
  if(u_mode>.5){
    vec2 d=1./u_size; vec3 glow=vec3(0.);
    glow+=max(texture2D(u_scene,v_uv+vec2(d.x*2.,0.)).rgb-.45,0.);
    glow+=max(texture2D(u_scene,v_uv-vec2(d.x*2.,0.)).rgb-.45,0.);
    glow+=max(texture2D(u_scene,v_uv+vec2(0.,d.y*2.)).rgb-.45,0.);
    glow+=max(texture2D(u_scene,v_uv-vec2(0.,d.y*2.)).rgb-.45,0.);
    c+=glow*(u_mode>1.5?.15:.07);
    c*=.955+.045*sin(gl_FragCoord.y*3.14159265);
    if(u_mode>1.5) c*=vec3(.97,1.045,1.015);
    float mask=mod(gl_FragCoord.x,3.); c*=mask<1.?vec3(1.,.976,.976):mask<2.?vec3(.976,1.,.976):vec3(.976,.976,1.);
  }
  float edge=smoothstep(.2,.76,length(v_uv-.5));
  c=mix(c,c+vec3(.19,0.,0.)*edge,u_hurt);
  gl_FragColor=vec4(c,1.);
}`;

export class PostFX {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private buffer: WebGLBuffer | null = null;
  private fallback: CanvasRenderingContext2D | null = null;
  private lost = false;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas=canvas;
    this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,preserveDrawingBuffer:false});
    if(this.gl) this.setup();
    else this.fallback=canvas.getContext('2d',{alpha:false});
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.lost=true;});
    canvas.addEventListener('webglcontextrestored',()=>{this.lost=false;this.setup();});
  }
  private setup() {
    const gl=this.gl!;
    const compile=(kind:number,source:string)=>{const shader=gl.createShader(kind)!;gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader)??'Shader compilation failed');return shader;};
    const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
    const program=gl.createProgram()!;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('Could not initialize the display');
    gl.deleteShader(vs);gl.deleteShader(fs);this.program=program;gl.useProgram(program);
    this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'a_position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  }
  render(source:HTMLCanvasElement,mode:VisualMode,hurt:number) {
    if(this.lost)return;
    const gl=this.gl;
    if(gl&&this.program){
      gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.useProgram(this.program);gl.bindTexture(gl.TEXTURE_2D,this.texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
      gl.uniform2f(gl.getUniformLocation(this.program,'u_size'),source.width,source.height);
      gl.uniform1f(gl.getUniformLocation(this.program,'u_mode'),mode==='clean'?0:mode==='crt'?1:2);
      gl.uniform1f(gl.getUniformLocation(this.program,'u_hurt'),hurt);
      gl.drawArrays(gl.TRIANGLES,0,6);
    } else if(this.fallback){this.fallback.imageSmoothingEnabled=false;this.fallback.drawImage(source,0,0,this.canvas.width,this.canvas.height);}
  }
  dispose(){const gl=this.gl;if(gl){gl.deleteTexture(this.texture);gl.deleteBuffer(this.buffer);gl.deleteProgram(this.program);}}
}
