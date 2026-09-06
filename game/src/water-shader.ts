import { WATER_FLOW_GLSL } from './water-flow.ts';
import type { WaterSimulation } from './water-simulation.ts';
import type { PointLight } from './lighting.ts';

const vertex = `attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
/** World-space optics. Fluid displacement bends the same normals used by refraction, reflections and specular light. */
export const WATER_FRAGMENT = `
precision highp float;
varying vec2 uv;
uniform sampler2D scene, state, waves, reflections;
uniform vec4 view, grid;
uniform vec2 gridSize;
uniform float time;
uniform vec4 lightPosition[8];
uniform vec3 lightColor[8];
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float heightAt(vec2 q){vec2 v=texture2D(waves,q).rg;return (dot(v,vec2(65280.,255.))/65535.-.5)*12.;}
${WATER_FLOW_GLSL}
vec3 waveLayer(vec2 p){
  float a=dot(p,vec2(.031,.047))-time*1.3;
  float b=dot(p,vec2(-.063,.027))-time*1.7;
  float c=dot(p,vec2(.11,.085))+sin(a)*.7-time*2.1;
  return vec3(sin(a)*.55+sin(b)*.28+sin(c)*.10,
    cos(a)*.017+cos(b)*(-.018)+cos(c)*.011,
    cos(a)*.026+cos(b)*.008+cos(c)*.0085);
}
vec3 microWaves(vec2 p,vec2 flow){
  vec3 phase=flowPhases(time);
  return mix(waveLayer(p-flow*phase.y),waveLayer(p-flow*phase.x),phase.z);
}

void main(){
  vec2 topUV=vec2(uv.x,1.-uv.y);
  vec2 world=view.xy+topUV*view.zw;
  vec2 q=(world-grid.xy)/grid.zw;
  vec4 water=texture2D(state,q);
  float coverage=smoothstep(.06,.98,water.r);
  if(coverage<.002){gl_FragColor=vec4(0.);return;}
  float depth=water.g*2.; vec2 flow=(water.ba*2.-1.);
  vec2 texel=1./gridSize;
  float h=heightAt(q);
  vec2 slope=vec2(heightAt(q+vec2(texel.x,0.))-heightAt(q-vec2(texel.x,0.)),
                  heightAt(q+vec2(0.,texel.y))-heightAt(q-vec2(0.,texel.y)));
  vec3 ripple=microWaves(world,flow);
  vec2 gradient=slope*.72+ripple.yz*4.2;
  vec3 normal=normalize(vec3(-gradient.x,-gradient.y,1.));
  vec3 eye=normalize(vec3(0.,-.65,1.));
  float fresnel=.18+.65*pow(1.-max(0.,dot(normal,eye)),3.);
  vec2 bend=gradient*vec2(13.,9.);
  vec2 refractUV=uv+vec2(bend.x,-bend.y)/view.zw;
  // The baked shallow bed remains visible below the deformed surface.
  vec3 bed=texture2D(scene,refractUV).rgb;
  float clouds=noise(world*.003+gradient*.2)*.65+noise(world*.009-vec2(time*.018,0.))*.35;
  vec3 sky=mix(vec3(.12,.24,.31),vec3(.57,.76,.78),clouds);
  vec3 waterColor=mix(vec3(.075,.27,.29),vec3(.025,.115,.17),clamp(depth*.55,0.,1.));
  vec3 color=mix(bed,waterColor,.30+clamp(depth*.24,0.,.44));
  color=mix(color,sky,fresnel+.1);
  vec2 refUV=q+(gradient*vec2(18.,12.)+vec2(sin(world.y*.06-time)*.9,0.))/grid.zw;
  // Reflection canvas is uploaded top-to-bottom, matching the hydrology grid.
  vec4 reflected=texture2D(reflections,refUV);
  color=mix(color,reflected.rgb,reflected.a*.85);
  float sun=pow(max(0.,dot(normal,normalize(vec3(-.24,-.18,1.)))),110.);
  color+=vec3(.64,.84,.79)*sun*1.08*(.55+clouds*.45);
  // Broad refracted light pockets under the shallows, deliberately softer than surface glints.
  vec2 causticP=world*.034+vec2(sin(world.y*.02+time*.5),cos(world.x*.017-time*.4))*.45;
  float caustic=pow(max(0.,1.-abs(sin(causticP.x)+sin(causticP.y)+sin(causticP.x+causticP.y))*.7),9.);
  color+=vec3(.19,.35,.25)*caustic*.32*(1.-smoothstep(.25,1.15,depth));
  for(int i=0;i<8;i++){
    vec4 light=lightPosition[i];
    vec2 delta=world-light.xy+bend*2.;
    float falloff=max(0.,1.-length(delta/vec2(max(1.,light.z*.5),max(1.,light.z*.85))));
    float glint=.2+pow(max(0.,dot(normal,normalize(vec3(-delta/max(1.,light.z)*.4,1.)))),32.)*.8;
    color+=lightColor[i]*pow(falloff,2.5)*glint*light.w*.7;
  }
  float crest=smoothstep(.16,.8,length(slope))*smoothstep(-.12,.6,h);
  float shore=(1.-smoothstep(.09,.36,depth))*.28;
  vec3 foamPhase=flowPhases(time);
  float foamNoise=mix(noise(world*.18-flow*foamPhase.y*.069+gradient),noise(world*.18-flow*foamPhase.x*.069+gradient),foamPhase.z);
  float foam=(crest*.8+shore)*smoothstep(.45,.8,foamNoise);
  color=mix(color,vec3(.69,.86,.78),clamp(foam,0.,.7));
  gl_FragColor=vec4(color,coverage*.96);
}`;

/** One bounded viewport pass; byte textures work without float-texture extensions. */
export class WaterShader {
  readonly canvas = document.createElement('canvas');
  private gl: WebGLRenderingContext | null | undefined;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private textures: WebGLTexture[] = [];
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private state = new Uint8Array(0);
  private waves = new Uint8Array(0);
  private lost = false;
  private failed = false;
  constructor() {
    // Native CPU review canvases intentionally have no browser event surface or WebGL.
    this.canvas.addEventListener?.('webglcontextlost', event => { event.preventDefault(); this.lost = true; this.program = null; this.textures = []; this.buffer = null; });
    this.canvas.addEventListener?.('webglcontextrestored', () => { this.lost = false; this.failed = false; });
  }
  reset() {
    const gl = this.gl;
    if (gl && this.program) gl.deleteProgram(this.program);
    if (gl && this.buffer) gl.deleteBuffer(this.buffer);
    if (gl) for (const texture of this.textures) gl.deleteTexture(texture);
    this.program = null; this.buffer = null; this.textures = []; this.uniforms = {}; this.failed = false;
  }
  private setup() {
    if (this.lost || this.failed) return false;
    if (this.program) return true;
    if (this.gl === undefined) {
      try { this.gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, preserveDrawingBuffer: false }); }
      catch { this.gl = null; }
    }
    const gl = this.gl; if (!gl || typeof gl.createShader !== 'function') return false;
    const shaders: WebGLShader[] = [];
    try {
      for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, WATER_FRAGMENT]] as const) {
        const shader = gl.createShader(type)!; shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Water shader compilation failed');
      }
      this.program = gl.createProgram()!; for (const shader of shaders) gl.attachShader(this.program, shader);
      gl.bindAttribLocation(this.program, 0, 'position'); gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program) ?? 'Water shader link failed');
      gl.useProgram(this.program);
      this.buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      for (const name of ['scene','state','waves','reflections','view','grid','gridSize','time','lightPosition[0]','lightColor[0]']) this.uniforms[name] = gl.getUniformLocation(this.program, name);
      for (let i = 0; i < 4; i++) {
        const texture = gl.createTexture()!; this.textures.push(texture); gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.uniform1i(this.uniforms[['scene','state','waves','reflections'][i]], i);
      }
      return true;
    } catch (error) { console.warn('Water optics unavailable; using Canvas water.', error); this.reset(); this.failed = true; return false; }
    finally { for (const shader of shaders) gl.deleteShader(shader); }
  }
  draw(target: CanvasRenderingContext2D, f: WaterSimulation, reflection: HTMLCanvasElement,
    view: { left: number; top: number; width: number; height: number }, lights: readonly PointLight[], reduced: boolean, age = 0): boolean {
    if (!this.setup()) return false;
    const gl = this.gl!, u = this.uniforms;
    const width = Math.min(1280, target.canvas.width), height = Math.round(target.canvas.height * width / target.canvas.width);
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    const size = f.height.length * 4;
    if (this.state.length !== size) { this.state = new Uint8Array(size); this.waves = new Uint8Array(size); }
    for (let i = 0; i < f.height.length; i++) {
      const p = i * 4, encoded = Math.round(Math.max(0, Math.min(1, f.height[i] / 12 + .5)) * 65535);
      this.state[p] = f.wet[i] * 255; this.state[p + 1] = Math.min(1, f.depth[i] / 2) * 255;
      this.state[p + 2] = (f.flowX[i] * .5 + .5) * 255; this.state[p + 3] = (f.flowY[i] * .5 + .5) * 255;
      this.waves[p] = encoded >> 8; this.waves[p + 1] = encoded & 255; this.waves[p + 2] = 0; this.waves[p + 3] = 255;
    }
    gl.useProgram(this.program); gl.viewport(0, 0, width, height);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const sources = [target.canvas, this.state, this.waves, reflection];
    for (let i = 0; i < 4; i++) {
      gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, i === 0);
      const source = sources[i];
      if (source instanceof Uint8Array) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, f.columns, f.rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    }
    gl.uniform4f(u.view, view.left, view.top, view.width, view.height);
    gl.uniform4f(u.grid, f.left, f.top, f.columns * f.cell, f.rows * f.cell); gl.uniform2f(u.gridSize, f.columns, f.rows);
    gl.uniform1f(u.time, reduced ? 0 : f.time + age);
    const positions = new Float32Array(32), colors = new Float32Array(24);
    for (let i = 0; i < Math.min(8, lights.length); i++) {
      const light = lights[i]; positions.set([light.x, light.y, light.radius, light.power], i * 4);
      colors.set([1, 3, 5].map(j => parseInt(light.color.slice(j, j + 2), 16) / 255), i * 3);
    }
    gl.uniform4fv(u['lightPosition[0]'], positions); gl.uniform3fv(u['lightColor[0]'], colors);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    target.drawImage(this.canvas, view.left, view.top, view.width, view.height); return true;
  }
}
