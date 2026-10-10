// One original surface, one reusable GPU tile. Flow changes the hot liquid;
// cool crust remains anchored. No per-token contexts or per-frame pixel reads.
const PERIOD = 6.4;
let surface: HTMLImageElement | undefined;
let canvas: HTMLCanvasElement | undefined;
let disabled = false;
let frame = -1;
let submissions = 0;
type Gpu = {
  gl: WebGLRenderingContext;
  phase: WebGLUniformLocation;
};
let gpu: Gpu | undefined;
export const lavaSurfaceReady = (async () => {
  if (typeof Image === 'undefined') return;
  const image = new Image();
  image.src = '/vtt/lava-flow-20261010/magma-surface.webp';
  try { await image.decode(); surface = image; } catch { /* Optional cosmetic art. */ }
})();
const vertex = `attribute vec2 point; varying vec2 uv;
void main(){uv=(point+1.0)*0.5;gl_Position=vec4(point,0.0,1.0);}`;
const fragment = `precision highp float;
uniform sampler2D surface;uniform float phase;varying vec2 uv;
float heat(vec3 c){return smoothstep(0.20,0.52,c.r-c.b);}
void main(){
 vec4 base=texture2D(surface,uv);
 float liquid=heat(base.rgb)*base.a;
 vec2 curl=vec2(sin(uv.y*18.0+phase)*cos(uv.x*13.0-phase),cos(uv.x*17.0+phase)*sin(uv.y*11.0+phase));
 vec2 fine=vec2(sin(uv.y*35.0-phase*2.0+uv.x*9.0),cos(uv.x*29.0+phase*2.0-uv.y*7.0));
 vec2 flow=uv+(curl*0.016+fine*0.0035)*liquid;
 vec4 sample=texture2D(surface,clamp(flow,vec2(0.001),vec2(0.999)));
 float warm=heat(sample.rgb);
 float pulse=sin(uv.x*17.0+uv.y*8.0-phase*2.0)*0.075+sin(uv.y*31.0-uv.x*13.0+phase*3.0)*0.035;
 vec3 color=clamp(sample.rgb*(1.0+pulse*warm),0.0,1.0);
 gl_FragColor=vec4(color*sample.a,sample.a);
}`;
function prepareGpu(): Gpu | undefined {
  if (gpu || disabled || !surface) return gpu;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = 384;
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault(); gpu = undefined; disabled = true; frame = -1;
    });
    canvas.addEventListener('webglcontextrestored', () => { disabled = false; frame = -1; });
  }
  const gl = canvas.getContext('webgl', {
    alpha: true, premultipliedAlpha: true, depth: false, stencil: false,
    antialias: false, preserveDrawingBuffer: true,
  });
  if (!gl) { disabled = true; return; }
  const shaders: WebGLShader[] = [];
  try {
    function compile(type: number, code: string) {
      const shader = gl!.createShader(type)!; shaders.push(shader);
      gl!.shaderSource(shader, code); gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) throw Error('Lava shader unavailable');
      return shader;
    }
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Lava program unavailable');
    for (const shader of shaders) gl.deleteShader(shader);
    gl.useProgram(program);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const point = gl.getAttribLocation(program, 'point');
    gl.enableVertexAttribArray(point); gl.vertexAttribPointer(point, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, surface);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(program, 'surface'), 0);
    gl.viewport(0, 0, 384, 384); gl.disable(gl.BLEND);
    const phase = gl.getUniformLocation(program, 'phase');
    if (!phase) throw Error('Lava phase unavailable');
    gpu = {gl, phase}; return gpu;
  } catch {
    disabled = true;
    for (const shader of shaders) gl.deleteShader(shader);
    return;
  }
}
export function lavaMaterialStatus() {
  return { ready: !!surface, gpu: !!gpu, tiles: canvas ? 1 : 0, submissions, period: PERIOD };
}
export function lavaMaterial(c: CanvasRenderingContext2D, t: number, size: number) {
  if (!surface) return;
  const renderer = prepareGpu();
  const next = ((Math.floor(t * 30) % 192) + 192) % 192;
  if (renderer && next !== frame) {
    renderer.gl.uniform1f(renderer.phase, next / 192 * Math.PI * 2);
    renderer.gl.drawArrays(renderer.gl.TRIANGLE_STRIP, 0, 4);
    frame = next; submissions++;
  }
  c.drawImage(renderer ? canvas! : surface, -size / 2, -size / 2, size, size);
}
