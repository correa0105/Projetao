import type { EffectKind } from '../shared/vtt-effects';

// A material pass: no clock, geometry or particle-count changes.
export const colorDepthKinds = new Set<EffectKind>([
  'inferno',
  'blue-fire',
  'runes',
  'curse',
  'sleep',
  'fear',
  'bless',
  'chain-lightning',
  'blizzard',
  'embers',
  'fire',
  'rage',
  'ember-comet',
  'fire-surge',
  'fire-geyser',
  'fire-spiral',
  'electric-cage',
  'ball-lightning',
  'static-corona',
  'acid-splash',
  'corrosive-puddle',
  'toxic-spiral',
  'poison-breath',
  'rain-curtain',
  'water-tornado',
  'water-geyser',
  'tidal-wave',
  'prism-pulse',
]);

const fragment = `precision highp float;
varying vec2 uv;uniform sampler2D source;uniform vec3 pigment;
void main(){
 vec4 sample=texture2D(source,uv);
 if(sample.a<.00001){gl_FragColor=vec4(0.);return;}
 vec3 original=sample.rgb/sample.a;
 float light=dot(original,vec3(.2126,.7152,.0722));
 float peak=max(original.r,max(original.g,original.b));
 float chroma=max(pigment.r,max(pigment.g,pigment.b))-min(pigment.r,min(pigment.g,pigment.b));
 vec3 color=max(vec3(0.),mix(vec3(light),original,1.65));
 // Cool/deep shadows remain separate from saturated midtones and hot cores.
 color*=mix(.72,1.32,smoothstep(.03,.62,peak));
 color=mix(color,pigment*light*1.15,(1.-peak)*chroma*.22);
 // Compress bright RGB together; per-channel clipping would turn fire yellow
 // and flatten the water's pale reflected crests.
 color/=max(1.,max(color.r,max(color.g,color.b)));
 vec3 core=mix(pigment,vec3(1.),.94);
 color=mix(color,core,smoothstep(.78,1.,peak)*.45);
 color=clamp(color,0.,1.);
 // Existing bright cores emit more light; dark folds retain their depth.
 // This changes material strength, never the transparent silhouette or motion.
 float opacity=clamp(sample.a*mix(.94,1.7,smoothstep(.15,.78,peak)),0.,1.);
 gl_FragColor=vec4(color*opacity,opacity);
}`;

let source: HTMLCanvasElement | undefined;
let output: HTMLCanvasElement | undefined;
let gl: WebGLRenderingContext | null = null;
let program: WebGLProgram | undefined;
let pigment: WebGLUniformLocation | null = null;
let unavailable = false;
function gpu() {
  if (gl || unavailable) return gl;
  try {
    output = document.createElement('canvas');
    gl = output.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });
    if (!gl || typeof gl.FRAGMENT_SHADER !== 'number') throw Error('No WebGL');
    const compile = (type: number, code: string) => {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, code);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) throw Error('Color shader');
      return s;
    };
    const v = compile(
        gl.VERTEX_SHADER,
        'attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}',
      ),
      f = compile(gl.FRAGMENT_SHADER, fragment);
    program = gl.createProgram()!;
    gl.attachShader(program, v);
    gl.attachShader(program, f);
    gl.linkProgram(program);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Color program');
    gl.useProgram(program);
    gl.disable(gl.DITHER);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.uniform1i(gl.getUniformLocation(program, 'source'), 0);
    pigment = gl.getUniformLocation(program, 'pigment');
    output.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      gl = null;
      unavailable = true;
    });
    return gl;
  } catch {
    gl = null;
    unavailable = true;
    return null;
  }
}

export function drawWithColorDepth(
  c: CanvasRenderingContext2D,
  kind: EffectKind,
  color: string,
  extent: number,
  draw: (layer: CanvasRenderingContext2D) => void,
) {
  if (
    !colorDepthKinds.has(kind) ||
    typeof document === 'undefined' ||
    typeof c.getTransform !== 'function'
  ) {
    draw(c);
    return;
  }
  const matrix = c.getTransform();
  if (
    !matrix ||
    ![matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f].every(Number.isFinite)
  ) {
    draw(c);
    return;
  }
  source ??= document.createElement('canvas');
  const span =
    Math.max(Math.abs(matrix.a) + Math.abs(matrix.c), Math.abs(matrix.b) + Math.abs(matrix.d)) *
    extent *
    2;
  const wanted = Math.max(128, Math.ceil((span + 4) / 2) * 2),
    pixels = Math.min(1024, wanted),
    factor = pixels / wanted;
  if (source.width !== pixels) source.width = source.height = pixels;
  const layer = source.getContext('2d')!;
  layer.setTransform(1, 0, 0, 1, 0, 0);
  layer.clearRect(0, 0, pixels, pixels);
  // Preserve the caller's pixel grid and transform so a color pass cannot
  // introduce jitter or bend streaks. Large zoom levels use a bounded surface.
  const x = Math.floor(matrix.e) - wanted / 2,
    y = Math.floor(matrix.f) - wanted / 2;
  layer.save();
  layer.setTransform(
    matrix.a * factor,
    matrix.b * factor,
    matrix.c * factor,
    matrix.d * factor,
    (matrix.e - x) * factor,
    (matrix.f - y) * factor,
  );
  layer.globalAlpha = c.globalAlpha;
  layer.globalCompositeOperation = c.globalCompositeOperation;
  layer.lineCap = c.lineCap;
  layer.lineJoin = c.lineJoin;
  layer.imageSmoothingEnabled = c.imageSmoothingEnabled;
  layer.imageSmoothingQuality = c.imageSmoothingQuality;
  layer.lineWidth = c.lineWidth;
  layer.miterLimit = c.miterLimit;
  layer.font = c.font;
  layer.textAlign = c.textAlign;
  layer.textBaseline = c.textBaseline;
  try {
    draw(layer);
  } finally {
    layer.restore();
  }
  const device = gpu();
  if (device) {
    if (output!.width !== pixels) output!.width = output!.height = pixels;
    device.viewport(0, 0, pixels, pixels);
    device.useProgram(program!);
    const hex = color.replace('#', '');
    device.uniform3f(
      pigment,
      ...([0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
        number,
        number,
        number,
      ]),
    );
    device.texImage2D(device.TEXTURE_2D, 0, device.RGBA, device.RGBA, device.UNSIGNED_BYTE, source);
    device.drawArrays(device.TRIANGLES, 0, 6);
  }
  c.save();
  c.setTransform(1, 0, 0, 1, x, y);
  c.globalAlpha = 1;
  if (!device) c.filter = 'saturate(1.65) contrast(1.12) brightness(1.12)';
  c.drawImage(device ? output! : source, 0, 0, wanted, wanted);
  if (!device) {
    c.globalAlpha = 0.35;
    c.globalCompositeOperation = 'screen';
    c.drawImage(source, 0, 0, wanted, wanted);
  }
  c.restore();
}
