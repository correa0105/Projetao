import { atmosphereSchema, weatherPreset, type MapAtmosphere } from '../shared/vtt-atmosphere';
import type { VttScene } from '../shared/vtt';
import { seededRandom, fract } from './vtt-effects-primitives';
type View = { left: number; top: number; right: number; bottom: number };
type WeatherLayer = { canvas: HTMLCanvasElement; gl: WebGLRenderingContext; program: WebGLProgram };
let layer: WeatherLayer | null = null,
  unavailable = false;
const fragment = `
precision highp float;
varying vec2 uv;
uniform vec4 view;
uniform vec2 wind;
uniform float time,density,swirl,shadow,shafts;
uniform vec3 pigment;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+vec2(3.7,8.9);a*=.5;}return n;}
void main(){
 vec2 world=mix(view.xy,view.zw,vec2(uv.x,1.-uv.y));
 vec2 p=world/650.+wind*time*.035;
 if(swirl>.0){vec2 center=(view.xy+view.zw)*.5/650.;vec2 d=p-center;float a=atan(d.y,d.x)+time*.15+length(d)*1.8; p=center+vec2(cos(a),sin(a))*length(d);}
 vec2 warp=vec2(fbm(p*1.1+time*.019),fbm(p*1.15+vec2(6.1,2.9)-time*.025));
 float volume=fbm(p*1.3+warp*2.7),near=fbm(p*2.1-wind*time*.018+warp*1.9);
 float cloud=smoothstep(.30,.77,volume*.7+near*.3);
 float light=pow(max(.0,sin((world.x+world.y*.48)/280.+fbm(p*.4)*2.)),5.)*shafts;
 float opacity=clamp(cloud*density+light*.055,0.,.75);
 vec3 color=mix(pigment,pigment+vec3(.11,.09,.04),near*.6+light*.4);
 if(shadow>.0)color*=.4;
 gl_FragColor=vec4(color*opacity,opacity);
}`;
function weatherLayer() {
  if (layer || unavailable) return layer;
  try {
    const canvas = document.createElement('canvas'),
      gl = canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
      });
    if (!gl) {
      unavailable = true;
      return null;
    }
    const compile = (type: number, code: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, code);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error('Atmosphere shader');
      return shader;
    };
    const program = gl.createProgram()!;
    const vertex = compile(
        gl.VERTEX_SHADER,
        'attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}',
      ),
      pixel = compile(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vertex);
    gl.attachShader(program, pixel);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(pixel);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Atmosphere program');
    gl.useProgram(program);
    gl.disable(gl.DITHER);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const attribute = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(attribute);
    gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      layer = null;
      unavailable = true;
    });
    layer = { canvas, gl, program };
    return layer;
  } catch {
    unavailable = true;
    return null;
  }
}
function haze(
  c: CanvasRenderingContext2D,
  a: MapAtmosphere,
  view: View,
  time: number,
  w: number,
  h: number,
) {
  const preset = weatherPreset(a.weather),
    family = preset[3],
    magic = preset[2] === 'magic';
  let density =
    family === 'fog'
      ? a.weather === 'mist'
        ? 0.18
        : 0.48
      : family === 'cloud'
        ? a.weather === 'partly-cloudy'
          ? 0.14
          : a.weather === 'overcast'
            ? 0.4
            : 0.26
        : family === 'vortex'
          ? a.weather === 'tornado'
            ? 0.46
            : 0.3
          : family === 'sand'
            ? 0.38
            : family === 'storm'
              ? 0.3
              : family === 'snow' && a.weather !== 'snow'
                ? 0.16
                : family === 'ash'
                  ? 0.12
                  : family === 'eclipse'
                    ? 0.2
                    : family === 'aurora'
                      ? 0.18
                      : 0;
  const shafts =
    a.day === 'afternoon' ? 0.9 : a.day === 'dawn' ? 0.6 : a.weather === 'sunshower' ? 0.8 : 0;
  if (!density && !shafts) return;
  const pigment =
    family === 'sand'
      ? [0.68, 0.48, 0.24]
      : family === 'ash'
        ? [0.28, 0.27, 0.26]
        : a.weather === 'arcane-fog'
          ? [0.4, 0.35, 0.68]
          : a.weather === 'void-storm'
            ? [0.16, 0.12, 0.26]
            : a.weather === 'spectral-storm'
              ? [0.27, 0.61, 0.56]
              : a.weather === 'luminous-sky'
                ? [0.28, 0.6, 0.48]
                : family === 'cloud'
                  ? [0.12, 0.16, 0.19]
                  : a.day === 'night'
                    ? [0.36, 0.43, 0.52]
                    : [0.71, 0.74, 0.75];
  const surface = weatherLayer();
  if (surface) {
    const { canvas, gl, program } = surface;
    const pixelWidth = Math.min(1920, Math.max(1, Math.ceil(w))),
      pixelHeight = Math.min(1080, Math.max(1, Math.ceil(h)));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);
    const u = (name: string) => gl.getUniformLocation(program, name);
    const angle = (a.wind * Math.PI) / 180;
    gl.uniform4f(u('view'), view.left, view.top, view.right, view.bottom);
    gl.uniform2f(u('wind'), Math.cos(angle), Math.sin(angle));
    gl.uniform1f(u('time'), time * a.speed);
    gl.uniform1f(u('density'), density * a.intensity);
    gl.uniform1f(u('swirl'), family === 'vortex' ? 1 : 0);
    gl.uniform1f(u('shadow'), family === 'cloud' || family === 'eclipse' ? 1 : 0);
    gl.uniform1f(u('shafts'), shafts * a.intensity);
    gl.uniform3f(u('pigment'), pigment[0], pigment[1], pigment[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    c.drawImage(canvas, view.left, view.top, view.right - view.left, view.bottom - view.top);
  } else {
    // Soft local volumes retain a useful view on devices without WebGL.
    for (let i = 0; i < 7; i++) {
      const x = view.left + (view.right - view.left) * fract(i * 0.371 + time * 0.009),
        y = view.top + (view.bottom - view.top) * fract(i * 0.619),
        radius = (view.right - view.left) * 0.45;
      const g = c.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(
        0,
        'rgba(' +
          pigment.map((v) => Math.round(v * 255)).join(',') +
          ',' +
          density * a.intensity * 0.26 +
          ')',
      );
      g.addColorStop(1, 'transparent');
      c.fillStyle = g;
      c.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
    }
  }
}
function precipitation(
  c: CanvasRenderingContext2D,
  s: VttScene,
  a: MapAtmosphere,
  v: View,
  t: number,
  zoom: number,
) {
  const family = weatherPreset(a.weather)[3],
    rain = ['rain', 'storm', 'vortex'].includes(family),
    snow = family === 'snow',
    dust = ['wind', 'ash', 'sand'].includes(family),
    hail = family === 'hail',
    meteor = family === 'meteor';
  if (!rain && !snow && !dust && !hail && !meteor) return;
  const random = seededRandom(s.id + ' weather'),
    angle = ((a.wind - 90) * Math.PI) / 180,
    wind = Math.sin(angle),
    intensity = a.intensity;
  const cells = meteor ? 180 : rain ? 45 : snow ? 65 : 85;
  const nx = Math.ceil(s.width / cells),
    ny = Math.ceil(s.height / cells);
  const minX = Math.max(0, Math.floor(v.left / cells) - 1),
    maxX = Math.min(nx, Math.ceil(v.right / cells) + 1),
    minY = Math.max(0, Math.floor(v.top / cells) - 1),
    maxY = Math.min(ny, Math.ceil(v.bottom / cells) + 1);
  let count = 0;
  for (let row = minY; row < maxY; row++)
    for (let col = minX; col < maxX; col++) {
      if (count++ > 700) return;
      const id = row * nx + col,
        key = id * 31;
      if (random(key) > intensity * (a.weather === 'drizzle' ? 0.65 : 1)) continue;
      const depth = 0.45 + random(key + 1) * 0.8,
        age = fract(
          t *
            a.speed *
            (rain
              ? a.weather === 'drizzle'
                ? 1.1
                : 1.8
              : snow
                ? a.weather === 'blizzard' || a.weather === 'frozen-hell'
                  ? 0.7
                  : 0.23
                : 0.45) +
            random(key + 2),
        );
      const x =
        (col + random(key + 3)) * cells +
        Math.sin(age * 6.28 + key) * (snow ? 18 : 3) +
        wind * age * cells * 0.45;
      const y = (row + age) * cells;
      c.save();
      c.globalAlpha *= Math.sin(age * Math.PI) * (0.25 + depth * 0.4) * intensity;
      if (rain || meteor) {
        const length = ((meteor ? 85 : 8 + random(key + 4) * 14) * depth) / Math.max(0.7, zoom),
          dx = (meteor ? 1.2 : wind * 0.3) * length,
          color =
            a.weather === 'blood-rain'
              ? '#b55855'
              : a.weather === 'ethereal-drizzle'
                ? '#b59ce9'
                : a.weather === 'sunshower'
                  ? '#f4dab0'
                  : a.weather === 'mana-storm'
                    ? '#cdb3f5'
                    : a.weather === 'spectral-storm'
                      ? '#9bddc7'
                      : a.weather === 'void-storm'
                        ? '#9877b8'
                        : meteor
                          ? '#ffd5a0'
                          : '#cedfe7';
        const g = c.createLinearGradient(x - dx, y - length, x, y);
        g.addColorStop(0, 'transparent');
        g.addColorStop(1, color);
        c.strokeStyle = g;
        c.lineWidth = ((meteor ? 1.7 : 0.6 + random(key + 5) * 0.5) * depth) / Math.max(0.8, zoom);
        c.beginPath();
        c.moveTo(x - dx, y - length);
        c.lineTo(x, y);
        c.stroke();
        if (rain && age > 0.85 && random(key + 6) > 0.7) {
          c.strokeStyle = '#c4dfec55';
          c.lineWidth = 0.6 / zoom;
          c.beginPath();
          c.ellipse(x, y, 2 + (age - 0.85) * 24, 1 + (age - 0.85) * 9, 0, 0, Math.PI * 2);
          c.stroke();
        }
      } else {
        const r = ((hail ? 1.5 : snow ? 1.6 : dust ? 1.1 : 1) * depth) / Math.max(0.8, zoom);
        c.translate(x, y);
        c.rotate(t * 0.2 + key);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 2.1);
        g.addColorStop(
          0,
          snow || hail
            ? '#f2f5ef'
            : family === 'sand'
              ? '#d2ac77'
              : a.weather === 'wild-winds'
                ? '#c4addb'
                : '#b5ac94',
        );
        g.addColorStop(1, 'transparent');
        c.fillStyle = g;
        c.fillRect(-r * 2, -r * 2, r * 4, r * 4);
      }
      c.restore();
    }
}
export function atmosphereAnimated(a: MapAtmosphere | undefined) {
  return (
    !!a?.enabled &&
    a.intensity > 0 &&
    (a.weather !== 'clear' || a.day === 'afternoon' || a.day === 'dawn')
  );
}
export function drawMapAtmosphere(
  c: CanvasRenderingContext2D,
  s: VttScene,
  view: View,
  zoom: number,
  width: number,
  height: number,
  now = Date.now(),
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches,
) {
  const a = s.atmosphere;
  if (!a?.enabled || a.intensity === 0) return;
  const t = reduced ? 12.5 : (now % 86400000) / 1000,
    day = a.day;
  c.save();
  c.beginPath();
  c.rect(0, 0, s.width, s.height);
  c.clip();
  // Color grading is separate from obscuration: it never changes vision or walls.
  if (day !== 'original' || a.weather === 'eclipse') {
    const grade =
      day === 'night'
        ? '#4c659b'
        : day === 'dusk'
          ? '#ba8b88'
          : day === 'dawn'
            ? '#e6b9a6'
            : a.weather === 'eclipse'
              ? '#56506e'
              : '#fff0c9';
    c.globalCompositeOperation = 'multiply';
    c.globalAlpha = a.intensity * (day === 'night' ? 0.8 : 0.55);
    c.fillStyle = grade;
    c.fillRect(0, 0, s.width, s.height);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
  if (day === 'dawn' || day === 'dusk' || day === 'afternoon') {
    const light = c.createLinearGradient(view.left, view.top, view.right, view.bottom);
    light.addColorStop(0, day === 'dusk' ? '#ff8c4324' : '#ffda9428');
    light.addColorStop(0.55, 'transparent');
    light.addColorStop(1, day === 'dusk' ? '#352c6723' : 'transparent');
    c.fillStyle = light;
    c.globalAlpha = a.intensity;
    c.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
    c.globalAlpha = 1;
  }
  haze(c, a, view, t, width, height);
  precipitation(c, s, a, view, t, zoom);
  if (weatherPreset(a.weather)[3] === 'storm' && !reduced) {
    const rand = seededRandom(s.id + ' storm'),
      cycle = Math.floor(t / 9),
      age = t - cycle * 9 - rand(cycle + 4) * 6,
      pulse = Math.exp(-Math.pow(age / 0.08, 2)) * 0.1 * a.intensity;
    if (pulse > 0.002) {
      c.fillStyle =
        a.weather === 'mana-storm'
          ? '#d1b0ff'
          : a.weather === 'spectral-storm'
            ? '#a3fce0'
            : '#e1e9ff';
      c.globalAlpha = pulse;
      c.fillRect(0, 0, s.width, s.height);
    }
  }
  c.restore();
}
