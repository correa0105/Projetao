import { arcanaEffects } from '../shared/vtt-effects-arcana';
import { livingEffects } from '../shared/vtt-effects-living';
import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';
import { alpha, fract, glow, seededRandom, tau, tint } from './vtt-effects-primitives';
const models = [...arcanaEffects, ...livingEffects],
  indexes = new Map<string, number>(models.map((m, i) => [m.kind, i]));
const sprites = new Map<string, HTMLImageElement>();
let loading: Promise<void> | undefined;
function materials() {
  if (typeof document === 'undefined') return Promise.resolve();
  return (loading ??= Promise.all(
    [
      'solar-moth',
      'coral-branch',
      'thorn-vine',
      'opal-droplet',
      'moon-crystal',
      'phoenix-feather',
      'jade-cocoon',
      'obsidian-shard',
    ].map(async (name) => {
      const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'low';
      image.src = `/vtt/radiant-20261011/${name}.webp`;
      try {
        await image.decode();
        sprites.set(name, image);
      } catch {
        /* Continuous fields remain available. */
      }
    }),
  ).then(() => {
    // Static thumbnails repaint at the same timestamp when their material arrives.
    for (const entry of surfaces.values()) entry.time = NaN;
  }));
}
export function radiantReady(kind: string) {
  return indexes.has(kind) ? materials() : Promise.resolve();
}
export async function warmRadiantEffects() {
  await materials();
  return sprites.size;
}
export function radiantCacheSize() {
  return surfaces.size;
}
// Bounded caches shared across all tokens and previews. No per-color contexts/atlases.
const forms = [
  [0, 7, 0.78],
  [1, 3, 0.8],
  [7, 5, 0.85],
  [2, 3, 0.8],
  [3, 5, 0.68],
  [4, 6, 0.77],
  [5, 9, 0.82],
  [0, 4, 0.85],
  [8, 5, 0.8],
  [3, 6, 0.82],
  [2, 4, 0.76],
  [3, 3, 0.72],
  [4, 9, 0.79],
  [0, 5, 0.77],
  [3, 6, 0.75],
  [2, 3, 0.8],
  [8, 7, 0.82],
  [6, 7, 0.79],
  [1, 4, 0.75],
  [3, 8, 0.75],
  [5, 7, 0.7],
  [2, 4, 0.83],
  [4, 7, 0.71],
  [2, 2, 0.85],
  [4, 3, 0.74],
  [3, 5, 0.8],
  [4, 5, 0.81],
  [8, 4, 0.8],
  [3, 7, 0.78],
  [4, 5, 0.76],
  [8, 4, 0.77],
  [3, 8, 0.78],
  [6, 4, 0.79],
  [5, 7, 0.78],
  [8, 6, 0.8],
  [4, 5, 0.8],
  [2, 7, 0.78],
  [0, 5, 0.8],
  [1, 6, 0.78],
  [9, 4, 0.8],
];
const secondary = [
  '#054cf5',
  '#514fff',
  '#fff2b0',
  '#8477ff',
  '#ffca48',
  '#20dce4',
  '#ef3978',
  '#096aff',
  '#b653ff',
  '#19e9e6',
  '#7051fa',
  '#ff9138',
  '#9644ff',
  '#267fff',
  '#ff7c44',
  '#fc5bec',
  '#7651ff',
  '#1978ff',
  '#2936b2',
  '#36e7ff',
  '#f42f63',
  '#3784ff',
  '#ae3858',
  '#f5f7ff',
  '#302375',
  '#1665e9',
  '#075b46',
  '#feaa69',
  '#9d8dff',
  '#e5893c',
  '#78173d',
  '#4475fd',
  '#fc5fee',
  '#ef4b24',
  '#4648ff',
  '#034d61',
  '#fa7357',
  '#e97bf4',
  '#256dff',
  '#ff5662',
];
const shader = `precision highp float;varying vec2 uv;uniform float phase,form,petals,radius,variant;uniform vec3 primary,secondary;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fb(vec2 p){return n(p)*.53+n(p*2.1+4.)*.27+n(p*4.3+9.)*.13+n(p*8.7)*.07;}
float shape(vec2 q){float r=length(q),a=atan(q.y,q.x),s=phase,w=fb(q*5.+vec2(cos(s),sin(s))*1.7+variant),d=0.;
if(form<.5){d=abs(r-radius-sin(a*7.+s*2.)*.018-sin(a*19.-s*3.)*.009)+(w-.5)*.028;}
else if(form<1.5){d=abs(r-radius-sin(a*3.-s)*.095-sin(a*8.+s*2.)*.026)+(w-.5)*.08;}
else if(form<2.5){d=abs(abs(q.x-sin(q.y*5.+s)*.25)-(.48+cos(q.y*4.-s)*.19))+smoothstep(.73,.91,abs(q.y))*.8+(w-.5)*.026;}
else if(form<3.5){d=abs(r-radius+.11-cos(a*petals+s)*.11-sin(a*petals*2.-s)*.012)+(w-.5)*.027;}
else if(form<4.5){d=abs(r-radius-sin(a*petals+s)*.095)+(w-.5)*.22;}
else if(form<5.5){d=abs(r-radius)+(w-.5)*.055;}
else if(form<6.5){d=abs(abs(q.x)-sin((q.y+.8)*2.2)*.5-.32)+(w-.5)*.035+smoothstep(.72,.9,abs(q.y))*.5;}
else if(form<7.5){d=min(abs(length(vec2(q.x,q.y+.12))-radius)+.03,abs(sin(q.x*petals*3.14159))*.22)+smoothstep(.75,.88,abs(q.x))*.8+smoothstep(.72,.88,abs(q.y))*.8;}
else if(form<8.5){d=min(abs(r-radius),abs(sin(a*petals+s))*.11+abs(r-.67)*.08)+smoothstep(.83,.92,r)*.8+(1.-smoothstep(.28,.42,r))*.8;}
else{d=abs(r-radius-sin(s)*.085-sin(a*4.-s)*.024)+(w-.5)*.06;}return d;}
void main(){vec2 q=(uv-.5)*2.22;q.y=-q.y;float r=length(q),a=atan(q.y,q.x),d=shape(q),noise=fb(q*9.+vec2(sin(phase*2.),cos(phase*2.))*2.);
float core=exp(-abs(d)*125.),body=exp(-abs(d)*18.),halo=exp(-abs(d)*9.),broken=.55+.45*sin(a*17.+phase*3.+noise*10.);
if(form>3.5&&form<4.5){body*=smoothstep(.22,.68,noise);core*=smoothstep(.44,.76,noise);}
vec2 grad=vec2(shape(q+vec2(.006,0))-d,shape(q+vec2(0,.006))-d)/.006;vec3 normal=normalize(vec3(-grad,.72));float light=max(0.,dot(normal,normalize(vec3(-.5,-.6,1.)))),spec=pow(max(0.,dot(normal,normalize(vec3(-.3,-.4,1.)))),18.);
vec3 col=mix(secondary*.38,primary,clamp(light*.7+noise*.6,0.,1.));col+=primary*core*.65+vec3(.94,.98,1.)*(core*.48+spec*body*.45);
float op=(body*.61+core*.32+halo*.14)*broken;op*=1.-smoothstep(.94,1.04,r);if(form>5.5&&form<6.5)op*=.45+.55*pow(abs(sin(q.y*80.+phase*3.+q.x*20.)),3.);gl_FragColor=vec4(col*op,op);}`;
type GPU = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  u: Map<string, WebGLUniformLocation | null>;
};
let gpu: GPU | null = null,
  unavailable = false;
function fieldGPU() {
  if (gpu || unavailable || typeof document === 'undefined') return gpu;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 384;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });
    if (!gl) throw Error('No WebGL');
    const compile = (type: number, source: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, source);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw Error('Radiant shader');
      return s;
    };
    const v = compile(
        gl.VERTEX_SHADER,
        'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}',
      ),
      f = compile(gl.FRAGMENT_SHADER, shader),
      program = gl.createProgram()!;
    gl.attachShader(program, v);
    gl.attachShader(program, f);
    gl.linkProgram(program);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Radiant program');
    gl.useProgram(program);
    gl.disable(gl.DITHER);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const p = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(p);
    gl.vertexAttribPointer(p, 2, gl.FLOAT, false, 0, 0);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      gpu = null;
      unavailable = true;
      surfaces.clear();
    });
    return (gpu = { canvas, gl, program, u: new Map() });
  } catch {
    unavailable = true;
    return null;
  }
}
type Surface = { back: HTMLCanvasElement; front: HTMLCanvasElement; time: number };
const surfaces = new Map<number, Surface>();
function surface(index: number) {
  let s = surfaces.get(index);
  if (s) return s;
  const back = document.createElement('canvas'),
    front = document.createElement('canvas');
  back.width = back.height = front.width = front.height = 384;
  s = { back, front, time: NaN };
  surfaces.set(index, s);
  return s;
}
const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
function volume(c: CanvasRenderingContext2D, index: number, p: number) {
  if (
    [
      2, 3, 9, 10, 11, 13, 15, 17, 20, 21, 22, 23, 26, 27, 28, 29, 31, 32, 33, 34, 35, 37, 38,
    ].includes(index)
  )
    return;
  const g = fieldGPU(),
    model = models[index],
    form = forms[index];
  if (!g) {
    glow(c, 0, 0, 96, model.color, 0.15);
    return;
  }
  const { gl, program, u } = g;
  gl.useProgram(program);
  gl.viewport(0, 0, 384, 384);
  const loc = (name: string) => {
    if (!u.has(name)) u.set(name, gl.getUniformLocation(program, name));
    return u.get(name)!;
  };
  for (const [name, value] of [
    ['phase', p],
    ['form', form[0]],
    ['petals', form[1]],
    ['radius', form[2]],
    ['variant', index * 1.79],
  ] as const)
    gl.uniform1f(loc(name), value);
  for (const [name, color] of [
    ['primary', model.color],
    ['secondary', secondary[index]],
  ] as const) {
    const v = rgb(color);
    gl.uniform3f(loc(name), v[0], v[1], v[2]);
  }
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  c.drawImage(g.canvas, -118, -118, 236, 236);
}
function sprite(
  c: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number,
  p: number,
  i: number,
) {
  const image = sprites.get(name);
  if (!image) return;
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.globalAlpha *= 0.92;
  if (name === 'solar-moth') {
    const fold = 0.24 + 0.76 * Math.abs(Math.sin(p * 8 + i * 2.1)),
      half = image.naturalWidth / 2;
    c.drawImage(
      image,
      0,
      0,
      half,
      image.naturalHeight,
      (-width * fold) / 2,
      -height / 2,
      (width * fold) / 2,
      height,
    );
    c.drawImage(
      image,
      half,
      0,
      half,
      image.naturalHeight,
      0,
      -height / 2,
      (width * fold) / 2,
      height,
    );
    c.fillStyle = '#fce5a8';
    c.fillRect(-0.5, -height * 0.22, 1, height * 0.45);
  } else if (name === 'phoenix-feather' || name === 'thorn-vine') {
    for (let strip = 0; strip < 12; strip++) {
      const v = strip / 12,
        dy = height / 12,
        offset = Math.sin(p * 3 + v * 4 + i) * width * 0.07 * v;
      c.drawImage(
        image,
        0,
        image.naturalHeight * v,
        image.naturalWidth,
        image.naturalHeight / 12,
        -width / 2 + offset,
        -height / 2 + height * v,
        width,
        dy + 0.25,
      );
    }
  } else {
    c.scale(0.8 + 0.2 * Math.cos(p * 2 + i), 1);
    c.drawImage(image, -width / 2, -height / 2, width, height);
  }
  c.restore();
}
function sparks(c: CanvasRenderingContext2D, index: number, p: number, count = 24) {
  const random = seededRandom('radiant sparks ' + index),
    color = models[index].color;
  for (let i = 0; i < count; i++) {
    const angle = random(i) * tau + p * (i % 3 === 0 ? -1 : 1),
      r = 57 + random(i + 100) * 35,
      x = Math.cos(angle) * r,
      y = Math.sin(angle) * r;
    c.save();
    c.globalAlpha *= 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(p * 3 + i)) ** 2;
    glow(c, x, y, 2.8 + random(i + 50) * 2, color, 0.38);
    c.fillStyle = tint(color, 0.85);
    c.fillRect(x - 0.5, y - 0.5, 1, 1);
    c.restore();
  }
}
function discharge(c: CanvasRenderingContext2D, index: number, p: number) {
  const rnd = seededRandom('radiant roots ' + index),
    color = models[index].color;
  for (let i = 0; i < (index === 34 ? 8 : 5); i++) {
    const age = fract((p / tau) * 5 + i * 0.173),
      power = Math.min(1, age / 0.14) * Math.exp(-age * 7) * (0.8 + 0.2 * Math.sin(p * 9));
    if (power < 0.06) continue;
    c.save();
    c.rotate((i * tau) / (index === 34 ? 8 : 5) + Math.sin(p) * 0.12);
    c.globalAlpha *= power;
    const path = (branch: boolean) => {
      c.beginPath();
      for (let j = 0; j < 10; j++) {
        const x = 31 + j * 6.3,
          y = (rnd(i * 100 + j) * 2 - 1) * 8 + (branch ? j * 2 : 0);
        if (!j) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    };
    c.strokeStyle = alpha(color, 0.42);
    c.lineWidth = 6;
    path(false);
    c.strokeStyle = color;
    c.lineWidth = 1.8;
    path(false);
    c.strokeStyle = '#f4fcff';
    c.lineWidth = 0.6;
    path(false);
    c.globalAlpha *= 0.65;
    c.lineWidth = 0.7;
    c.strokeStyle = color;
    path(true);
    c.restore();
  }
}
function components(c: CanvasRenderingContext2D, index: number, p: number) {
  let name = '',
    count = 7,
    size = 31;
  if (index === 20) {
    name = 'phoenix-feather';
    count = 9;
    size = 51;
  } else if (index === 22) {
    name = 'coral-branch';
    count = 6;
    size = 43;
  } else if (index === 26) {
    name = 'thorn-vine';
    count = 6;
    size = 48;
  } else if (index === 29) {
    name = 'solar-moth';
    count = 7;
    size = 35;
  } else if (index === 35) {
    name = 'jade-cocoon';
    count = 5;
    size = 45;
  } else if (index === 33) {
    name = 'obsidian-shard';
    count = 8;
    size = 40;
  } else if ([9, 11, 28, 31].includes(index)) {
    name = 'moon-crystal';
    size = index === 11 ? 52 : 39;
    count = index === 11 ? 3 : 8;
  } else if ([13, 37].includes(index)) {
    name = 'opal-droplet';
    count = 10;
    size = 33;
  }
  const rnd = seededRandom('radiant components ' + index);
  for (let i = 0; i < count && name; i++) {
    let angle = (i * tau) / count + p * (index === 29 ? 0.22 : 0.12),
      r = 72 + Math.sin(p * 2 + i) * 6,
      x = Math.cos(angle) * r,
      y = Math.sin(angle) * r;
    c.save();
    if (index === 37 || index === 13) {
      const age = fract((p / tau) * (index === 37 ? 2 : 1) + i / count);
      x = Math.sin(i * 9) * 70 + Math.sin(p * 2 + i) * 8;
      y = -83 + age * 166;
      c.globalAlpha *= Math.sin(age * Math.PI);
    }
    if (index === 29) {
      x += Math.sin(p * 3 + i) * 13;
      y += Math.cos(p * 2 + i) * 12;
      angle = Math.sin(p + i) * 0.4;
    }
    const height = size * (0.8 + rnd(i + 20) * 0.4),
      width = name === 'solar-moth' ? height * 1.3 : height * (name === 'coral-branch' ? 1 : 0.6);
    if (index === 9) c.filter = 'hue-rotate(60deg) saturate(1.25)';
    if (index === 11) c.filter = 'hue-rotate(140deg) saturate(1.7)';
    if (index === 31) c.filter = 'saturate(.75) brightness(1.35)';
    sprite(
      c,
      name,
      x,
      y,
      width,
      height,
      name === 'opal-droplet' ? Math.sin(p + i) * 0.1 : angle + Math.PI / 2,
      p,
      i,
    );
    c.filter = 'none';
    glow(c, x, y, height * 0.6, models[index].color, 0.06 + (0.06 * (1 + Math.sin(p * 3 + i))) / 2);
    c.restore();
  }
  if ([8, 16, 34].includes(index)) discharge(c, index, p);
  if (index === 27)
    for (let i = 0; i < 9; i++) {
      const age = fract(p / tau + i / 9),
        x = Math.sin(i * 14) * 75 + age * 35,
        y = -85 + age * 170,
        fade = Math.sin(age * Math.PI);
      c.save();
      c.globalAlpha *= fade;
      const g = c.createLinearGradient(x, y, x - 18, y - 45);
      g.addColorStop(0, '#effaff');
      g.addColorStop(0.25, '#458dff');
      g.addColorStop(1, '#2389ff00');
      c.strokeStyle = g;
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - 18, y - 45);
      c.stroke();
      glow(c, x, y, 5, '#78cfff', 0.7);
      c.restore();
    }
  if (index === 38)
    for (let i = 0; i < 18; i++) {
      c.save();
      c.globalAlpha *= 0.6;
      c.strokeStyle = i % 3 === 0 ? '#f0baff' : i % 2 === 0 ? '#495eff' : '#bb5aff';
      c.lineWidth = i % 3 === 0 ? 0.65 : 1.15;
      const angle = (i * tau) / 18,
        x = Math.cos(angle) * 74,
        y = Math.sin(angle) * 76,
        shift = Math.sin(p * 2 + i) * 14;
      c.beginPath();
      c.moveTo(x, y);
      c.bezierCurveTo(x + shift, y - 35, x * 0.3 - shift, y * 0.4 - 20, x * 0.32, y * 0.32);
      c.stroke();
      glow(c, x, y, 4, '#ae64ff', 0.4);
      c.restore();
    }
  if ([3, 10, 15, 21, 23].includes(index))
    for (let ribbon = 0; ribbon < (index === 21 ? 2 : index === 10 ? 4 : 3); ribbon++) {
      c.save();
      c.globalAlpha *= 0.65;
      c.beginPath();
      for (let j = 0; j <= 55; j++) {
        const a = (j / 55) * tau + p * (ribbon % 2 ? -1 : 1) + ribbon * 2,
          r = 75 + Math.sin(a * 3 + p + ribbon) * 8;
        let x = Math.cos(a) * r,
          y = Math.sin(a) * r * 0.74;
        if (index === 3) {
          x = Math.sin(a) * 67;
          y = Math.sin(a * 2 + ribbon * 0.6) * 83;
        }
        if (index === 10) {
          x = Math.sin(a * 2) * 82;
          y = Math.cos(a * 3 + ribbon) * 62;
        }
        if (index === 15) {
          x *= 0.35 + ribbon * 0.24;
          y = Math.sin(a) * 88;
        }
        if (index === 21) {
          x = -87 + (j / 55) * 174;
          y = (ribbon ? -1 : 1) * x * 0.72 + Math.sin((j / 55) * 5 + p * 2) * 17;
        }
        if (index === 23) {
          x = Math.sin(a) * 58;
          y = Math.cos(a) * 81 + Math.sin(a * 3 + p) * 11;
        }
        if (!j) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      const gradient = c.createLinearGradient(-90, -70, 80, 70);
      gradient.addColorStop(0, '#253356');
      gradient.addColorStop(0.28, models[index].color);
      gradient.addColorStop(0.36, '#f6fcff');
      gradient.addColorStop(0.5, secondary[index]);
      gradient.addColorStop(0.72, '#a6efff');
      gradient.addColorStop(1, '#2c355d');
      c.strokeStyle = gradient;
      c.lineWidth = index === 23 ? 5 : 2.5;
      c.stroke();
      c.restore();
    }
  if ([17, 32].includes(index))
    for (const side of [-1, 1])
      for (let feather = 0; feather < 30; feather++) {
        const a = feather / 29,
          rootX = side * (index === 32 ? 59 : 20),
          rootY = index === 32 ? 68 : 16,
          tipX =
            side * (index === 32 ? 72 + Math.sin(a * 3 + p) * 12 : 42 + Math.sin(a * 2.6) * 51),
          tipY = -78 + a * (index === 32 ? 85 : 132),
          flutter = Math.sin(p * 2 + feather * 0.19) * 5;
        c.save();
        c.globalAlpha *= 0.38 + 0.4 * Math.sin(a * Math.PI);
        const g = c.createLinearGradient(rootX, rootY, tipX, tipY);
        g.addColorStop(0, '#0560be00');
        g.addColorStop(0.5, index === 32 ? '#dc9bff' : '#22a6ff');
        g.addColorStop(0.82, '#9afaff');
        g.addColorStop(1, '#e8ffff00');
        c.strokeStyle = g;
        c.lineWidth = 1.8;
        c.beginPath();
        c.moveTo(rootX, rootY);
        c.bezierCurveTo(
          rootX + side * 25,
          rootY - 25,
          tipX + side * 12,
          tipY + flutter + 8,
          tipX,
          tipY + flutter,
        );
        c.stroke();
        c.restore();
      }
  if (index === 2)
    for (let arch = 0; arch < 5; arch++) {
      const x = (arch - 2) * 33,
        top = -78 + Math.abs(arch - 2) * 10,
        sway = Math.sin(p + arch) * 3;
      c.save();
      c.globalAlpha *= 0.75;
      c.strokeStyle = arch % 2 ? '#fff2b0' : '#ffc02f';
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(x - 14, 70);
      c.lineTo(x - 14, top + 27);
      c.quadraticCurveTo(x - 14, top + 8, x + sway, top);
      c.quadraticCurveTo(x + 14, top + 8, x + 14, top + 27);
      c.lineTo(x + 14, 70);
      c.stroke();
      c.restore();
    }
  sparks(c, index, p, index === 36 ? 48 : 20);
}
function paint(s: Surface, index: number, t: number) {
  if (s.time === t) return;
  s.time = t;
  const p = (t / 5) * tau,
    c = s.back.getContext('2d')!;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, 384, 384);
  c.save();
  c.translate(192, 192);
  c.scale(384 / 236, 384 / 236);
  volume(c, index, p);
  components(c, index, p);
  c.restore();
  const front = s.front.getContext('2d')!;
  front.clearRect(0, 0, 384, 384);
  front.globalCompositeOperation = 'source-over';
  front.drawImage(s.back, 0, 0);
  front.globalCompositeOperation = 'destination-in';
  const mask = front.createLinearGradient(0, 165, 0, 330);
  mask.addColorStop(0, '#ffffff00');
  mask.addColorStop(0.55, '#ffffff66');
  mask.addColorStop(1, '#ffffff');
  front.fillStyle = mask;
  front.fillRect(0, 0, 384, 384);
  front.globalCompositeOperation = 'source-over';
}
function hue(hex: string) {
  const [r, g, b] = rgb(hex),
    max = Math.max(r, g, b),
    d = max - Math.min(r, g, b);
  return d ? 60 * (max === r ? (g - b) / d : max === g ? (b - r) / d + 2 : (r - g) / d + 4) : 0;
}
function filter(target: string, base: string) {
  const v = rgb(target),
    hi = Math.max(...v),
    sat = hi ? (hi - Math.min(...v)) / hi : 0;
  return `hue-rotate(${hue(target) - hue(base)}deg) saturate(${sat}) brightness(${hi})`;
}
export function drawRadiant(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  front: boolean,
) {
  const index = indexes.get(e.kind);
  if (index === undefined) return false;
  if ((e.intensity ?? 1) <= 0) return true;
  if (typeof document === 'undefined') {
    if (!front) glow(c, 0, 0, 95, e.color, 0.1 * (e.intensity ?? 1));
    return true;
  }
  void materials();
  const s = surface(index);
  paint(s, index, t);
  c.save();
  c.scale(f.plane.rx / 80, f.plane.ry / 80);
  c.globalAlpha *= (e.intensity ?? 1) * (front ? 0.42 : 1);
  if (e.color !== models[index].color) c.filter = filter(e.color, models[index].color);
  c.drawImage(front ? s.front : s.back, -118, -118, 236, 236);
  c.restore();
  return true;
}
