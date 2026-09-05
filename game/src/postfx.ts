export type VisualMode = 'crt' | 'phosphor' | 'clean';
export interface HUDBounds { x: number; y: number; width: number; height: number; }

const vertex = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * .5 + .5;
  gl_Position = vec4(a_position, 0., 1.);
}`;
const precision = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
`;
// Bounds have the scene canvas's top-left origin. No pass warps UV coordinates.
const hudUniforms = `
uniform vec2 u_size;
uniform vec4 u_hud;
uniform float u_hud_enabled;
float hudCoverage(vec2 uv) {
  vec2 p = vec2(uv.x, 1. - uv.y) * u_size;
  vec2 outside = max(u_hud.xy - p, p - (u_hud.xy + u_hud.zw));
  return u_hud_enabled * (1. - smoothstep(0., 6., max(outside.x, outside.y)));
}
`;
const damage = `
uniform float u_hurt;
vec3 damageTint(vec3 color, float hud) {
  float edge = smoothstep(.23, .72, length(v_uv - .5));
  return color + vec3(.22, .008, .018) * edge * u_hurt * (1. - hud);
}
`;
const copyFragment = precision + hudUniforms + damage + `
uniform sampler2D u_scene;
void main() {
  gl_FragColor = vec4(damageTint(texture2D(u_scene, v_uv).rgb, hudCoverage(v_uv)), 1.);
}`;
const brightFragment = precision + hudUniforms + `
uniform sampler2D u_scene;
uniform float u_threshold;
void main() {
  // Preserve thin trails and sparks in the quarter-resolution extraction.
  vec2 d = 1. / u_size;
  vec3 a = texture2D(u_scene, v_uv + vec2(-d.x, -d.y)).rgb;
  vec3 b = texture2D(u_scene, v_uv + vec2( d.x, -d.y)).rgb;
  vec3 c = texture2D(u_scene, v_uv + vec2(-d.x,  d.y)).rgb;
  vec3 e = texture2D(u_scene, v_uv + vec2( d.x,  d.y)).rgb;
  vec3 average = (a + b + c + e) * .25;
  vec3 peak = max(max(a, b), max(c, e));
  vec3 color = mix(average, peak, .3);
  float brightness = max(max(color.r, color.g), color.b);
  // Soft knee responds to saturated colored highlights as well as white.
  float knee = .16;
  float soft = clamp(brightness - u_threshold + knee, 0., 2. * knee);
  soft = soft * soft / (4. * knee + .0001);
  float contribution = max(soft, brightness - u_threshold) / max(brightness, .0001);
  gl_FragColor = vec4(color * contribution * (1. - hudCoverage(v_uv)), 1.);
}`;
const blurFragment = precision + `
uniform sampler2D u_scene;
uniform vec2 u_direction;
void main() {
  // Separable Gaussian: bilinear sampling combines nine effective taps into five.
  vec3 color = texture2D(u_scene, v_uv).rgb * .2270270270;
  color += texture2D(u_scene, v_uv + u_direction * 1.3846153846).rgb * .3162162162;
  color += texture2D(u_scene, v_uv - u_direction * 1.3846153846).rgb * .3162162162;
  color += texture2D(u_scene, v_uv + u_direction * 3.2307692308).rgb * .0702702703;
  color += texture2D(u_scene, v_uv - u_direction * 3.2307692308).rgb * .0702702703;
  gl_FragColor = vec4(color, 1.);
}`;
const compositeFragment = precision + hudUniforms + damage + `
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_phosphor;
void main() {
  vec3 original = texture2D(u_scene, v_uv).rgb;
  float hud = hudCoverage(v_uv);
  float edge = smoothstep(.17, .7, length(v_uv - .5));
  // Subpixel edge separation leaves the scene geometry and cursor aim unchanged.
  vec2 separation = vec2((.32 + u_phosphor * .24) * edge / u_size.x, 0.);
  vec3 color = vec3(texture2D(u_scene, v_uv + separation).r, original.g,
                    texture2D(u_scene, v_uv - separation).b);
  float luma = dot(color, vec3(.2126, .7152, .0722));
  color = mix(vec3(luma), color, 1.08 + u_phosphor * .09);
  color = max(color - .012, 0.) * (1.06 + u_phosphor * .025);
  vec3 bloom = texture2D(u_bloom, v_uv).rgb;
  color += bloom * (.72 + u_phosphor * .54) * (1. - min(color, vec3(1.)) * .3);
  color = pow(max(color, 0.), vec3(.96));
  // Logical scanlines survive DPI changes; the RGB grille uses physical pixels.
  float scan = .91 + .09 * cos(v_uv.y * u_size.y * 3.14159265);
  float phosphorScan = .89 + .11 * cos(v_uv.y * u_size.y * 3.14159265);
  color *= mix(scan, phosphorScan, u_phosphor);
  float column = mod(floor(gl_FragCoord.x), 3.);
  vec3 mask = column < 1. ? vec3(1.09, .93, .93)
             : column < 2. ? vec3(.93, 1.09, .93) : vec3(.93, .93, 1.09);
  vec3 phosphorMask = column < 1. ? vec3(1.15, .87, .87)
                     : column < 2. ? vec3(.87, 1.15, .87) : vec3(.87, .87, 1.15);
  color *= mix(mask, phosphorMask, u_phosphor);
  color *= mix(vec3(1.045, 1.02, .99), vec3(.98, 1.09, 1.1), u_phosphor);
  // Tiny pixel-font labels and the animated orbs retain their original clarity.
  color = mix(color, original, hud);
  gl_FragColor = vec4(damageTint(color, hud), 1.);
}`;

interface Pass {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}
interface BloomTarget { texture: WebGLTexture; framebuffer: WebGLFramebuffer; }

/** Two quarter-resolution targets provide bounded bloom storage at every viewport size. */
export class PostFX {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext | null;
  private copy: Pass | null = null;
  private bright: Pass | null = null;
  private blur: Pass | null = null;
  private composite: Pass | null = null;
  private scene: WebGLTexture | null = null;
  private buffer: WebGLBuffer | null = null;
  private targets: BloomTarget[] = [];
  private fallback: CanvasRenderingContext2D | null = null;
  private sourceWidth = 0;
  private sourceHeight = 0;
  private bloomWidth = 0;
  private bloomHeight = 0;
  private lost = false;
  private disposed = false;
  private readonly onLost = (event: Event) => {
    event.preventDefault(); this.lost = true;
    // A restored context invalidates every GPU object, so discard all old handles.
    this.clearHandles();
  };
  private readonly onRestored = () => {
    if (this.disposed) return;
    this.setup(); this.lost = false;
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, preserveDrawingBuffer: false });
    if (this.gl) this.setup();
    else this.fallback = canvas.getContext('2d', { alpha: false });
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
  }

  private makePass(fragment: string, uniforms: readonly string[]): Pass {
    const gl = this.gl!;
    const compile = (kind: number, source: string) => {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error('Could not allocate the display shader');
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) ?? 'Display shader compilation failed';
        gl.deleteShader(shader); throw new Error(message);
      }
      return shader;
    };
    const vs = compile(gl.VERTEX_SHADER, vertex);
    let fs: WebGLShader | null = null, program: WebGLProgram | null = null;
    try {
      fs = compile(gl.FRAGMENT_SHADER, fragment); program = gl.createProgram();
      if (!program) throw new Error('Could not allocate the display program');
      gl.attachShader(program, vs); gl.attachShader(program, fs);
      gl.bindAttribLocation(program, 0, 'a_position'); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Could not initialize the display');
      const pass = { program, uniforms: Object.fromEntries(uniforms.map(name => [name, gl.getUniformLocation(program!, name)])) };
      gl.useProgram(program); gl.uniform1i(pass.uniforms.u_scene, 0);
      if ('u_bloom' in pass.uniforms) gl.uniform1i(pass.uniforms.u_bloom, 1);
      return pass;
    } catch (error) {
      if (program) gl.deleteProgram(program);
      throw error;
    } finally {
      gl.deleteShader(vs); if (fs) gl.deleteShader(fs);
    }
  }

  private makeTexture(linear: boolean): WebGLTexture {
    const gl = this.gl!, texture = gl.createTexture();
    if (!texture) throw new Error('Could not allocate the display texture');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  }

  private setup() {
    const gl = this.gl!;
    this.clearHandles();
    try {
      const hud = ['u_size', 'u_hud', 'u_hud_enabled'];
      this.copy = this.makePass(copyFragment, ['u_scene', ...hud, 'u_hurt']);
      this.bright = this.makePass(brightFragment, ['u_scene', ...hud, 'u_threshold']);
      this.blur = this.makePass(blurFragment, ['u_scene', 'u_direction']);
      this.composite = this.makePass(compositeFragment, ['u_scene', 'u_bloom', ...hud, 'u_hurt', 'u_phosphor']);
      this.buffer = gl.createBuffer();
      if (!this.buffer) throw new Error('Could not allocate the display geometry');
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); this.scene = this.makeTexture(false);
      for (let i = 0; i < 2; i++) {
        const texture = this.makeTexture(true), framebuffer = gl.createFramebuffer();
        if (!framebuffer) { gl.deleteTexture(texture); throw new Error('Could not allocate the bloom framebuffer'); }
        this.targets.push({ texture, framebuffer });
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.SCISSOR_TEST);
    } catch (error) {
      this.release(); throw error;
    }
  }

  private resizeStorage(width: number, height: number) {
    if (width === this.sourceWidth && height === this.sourceHeight) return;
    const gl = this.gl!;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.scene);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    // Quarter resolution normally, capped for unusually wide/high-DPI displays.
    const scale = Math.min(.25, 1024 / width, 1024 / height);
    this.bloomWidth = Math.max(1, Math.ceil(width * scale));
    this.bloomHeight = Math.max(1, Math.ceil(height * scale));
    for (const target of this.targets) {
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.bloomWidth, this.bloomHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Could not initialize the bloom target');
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.sourceWidth = width; this.sourceHeight = height;
  }

  private use(pass: Pass, texture: WebGLTexture, target: BloomTarget | null) {
    const gl = this.gl!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
    gl.viewport(0, 0, target ? this.bloomWidth : this.canvas.width, target ? this.bloomHeight : this.canvas.height);
    gl.useProgram(pass.program); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture);
  }

  private setHUD(pass: Pass, bounds?: HUDBounds) {
    const gl = this.gl!;
    gl.uniform2f(pass.uniforms.u_size, this.sourceWidth, this.sourceHeight);
    gl.uniform1f(pass.uniforms.u_hud_enabled, bounds && bounds.width > 0 && bounds.height > 0 ? 1 : 0);
    gl.uniform4f(pass.uniforms.u_hud, bounds?.x ?? 0, bounds?.y ?? 0, bounds?.width ?? 0, bounds?.height ?? 0);
  }

  render(source: HTMLCanvasElement, mode: VisualMode, hurt: number, hudBounds?: HUDBounds) {
    if (this.lost || this.disposed || !source.width || !source.height) return;
    const gl = this.gl;
    if (gl && this.scene && this.copy && this.bright && this.blur && this.composite) {
      this.resizeStorage(source.width, source.height);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.scene);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
      const hurtAmount = Math.max(0, Math.min(1, hurt));
      if (mode === 'clean') {
        this.use(this.copy, this.scene, null); this.setHUD(this.copy, hudBounds);
        gl.uniform1f(this.copy.uniforms.u_hurt, hurtAmount); gl.drawArrays(gl.TRIANGLES, 0, 6);
        return;
      }
      const phosphor = mode === 'phosphor' ? 1 : 0;
      const [a, b] = this.targets;
      this.use(this.bright, this.scene, a); this.setHUD(this.bright, hudBounds);
      gl.uniform1f(this.bright.uniforms.u_threshold, phosphor ? .41 : .53); gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.use(this.blur, a.texture, b);
      gl.uniform2f(this.blur.uniforms.u_direction, 1 / this.bloomWidth, 0); gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.use(this.blur, b.texture, a);
      gl.uniform2f(this.blur.uniforms.u_direction, 0, 1 / this.bloomHeight); gl.drawArrays(gl.TRIANGLES, 0, 6);
      this.use(this.composite, this.scene, null); this.setHUD(this.composite, hudBounds);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, a.texture);
      gl.uniform1f(this.composite.uniforms.u_phosphor, phosphor);
      gl.uniform1f(this.composite.uniforms.u_hurt, hurtAmount); gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else if (this.fallback) {
      this.fallback.imageSmoothingEnabled = false;
      this.fallback.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private clearHandles() {
    this.copy = null; this.bright = null; this.blur = null; this.composite = null;
    this.scene = null; this.buffer = null; this.targets = [];
    this.sourceWidth = 0; this.sourceHeight = 0; this.bloomWidth = 0; this.bloomHeight = 0;
  }

  private release() {
    const gl = this.gl;
    if (gl && !gl.isContextLost()) {
      for (const target of this.targets) { gl.deleteFramebuffer(target.framebuffer); gl.deleteTexture(target.texture); }
      for (const pass of [this.copy, this.bright, this.blur, this.composite]) if (pass) gl.deleteProgram(pass.program);
      gl.deleteTexture(this.scene); gl.deleteBuffer(this.buffer);
    }
    this.clearHandles();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.release();
  }
}
