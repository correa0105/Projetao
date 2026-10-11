import { weatherPreset, type MapAtmosphere } from '../shared/vtt-atmosphere';
import type { VttScene } from '../shared/vtt';
import { seededRandom, fract } from './vtt-effects-primitives';

type View = { left: number; top: number; right: number; bottom: number };
type WeatherLayer = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
};
let layer: WeatherLayer | null = null,
  unavailable = false;

// Continuous density fields, lit edges and independently drifting depths.
const fragment = `
precision highp float;
varying vec2 uv;
uniform vec4 view;
uniform vec2 wind;
uniform float time,density,mode,vortexSize;
uniform vec3 pigment;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.5;for(int i=0;i<5;i++){n+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+vec2(3.7,8.9);a*=.5;}return n;}
void main(){
 vec2 world=mix(view.xy,view.zw,vec2(uv.x,1.-uv.y));
 vec2 p=world/460.;
 vec2 drift=wind*time*.055;
 if(mode>1.5&&mode<2.5){vec2 d=(uv-vec2(.52,.5))*vec2(1.35,1.);float r=length(d),a=atan(d.y,d.x)+time*.38-r*10.;p=vec2(cos(a),sin(a))*r*4.+vec2(time*.02);}
 vec2 warp=vec2(fbm(p+drift+time*.024),fbm(p-drift*.3+vec2(5.,9.)-time*.018));
 float far=fbm(p*.85+drift*.45+warp*2.4),near=fbm(p*2.4+drift+warp*1.8);
 float field=smoothstep(.18,.74,far*.6+near*.4);
 float opacity=(.13+field*.8)*density;
 vec3 color=pigment*(.77+near*.44);
 float rim=clamp((fbm(p*.85+vec2(.12,-.07)+drift*.45+warp*2.4)-far)*4.,0.,.18);
 color+=vec3(rim*.75,rim*.85,rim);
 if(mode>.5&&mode<1.5){opacity=smoothstep(.32,.70,far*.8+near*.2)*density;color=pigment*(.5+near*.3);}
 if(mode>1.5&&mode<2.5){vec2 d=(uv-vec2(.52,.5))*vec2(1.35,1.);float r=length(d),a=atan(d.y,d.x);float spiral=sin(a*3.+r*22.-time*.7+near*5.)*.5+.5;opacity*=smoothstep(.02,.10,r)*(1.-smoothstep(vortexSize*.55,vortexSize,r))*(.55+spiral*.7);}
 if(mode>2.5){float wave=uv.y-.42-sin(uv.x*4.+time*.11)*.12-fbm(vec2(uv.x*3.,time*.035))*.13;float curtain=exp(-abs(wave)*11.)*(.3+.7*pow(sin(uv.x*65.+time*.5+near*8.)*.5+.5,2.));opacity=curtain*density;color=mix(vec3(.16,.94,.65),vec3(.65,.28,.95),sin(uv.x*7.+time*.13)*.5+.5);}
 opacity=clamp(opacity,0.,.82);
 gl_FragColor=vec4(color*opacity,opacity);
}`;

function weatherLayer() {
  if (layer || unavailable) return layer;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl', {
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
    );
    const pixel = compile(gl.FRAGMENT_SHADER, fragment);
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
    layer = { canvas, gl, program, uniforms: new Map() };
    return layer;
  } catch {
    unavailable = true;
    return null;
  }
}

type Grade = number[];
const daylight: Record<MapAtmosphere['day'], Grade> = {
  original: [255, 255, 255, 0, 255, 255, 255, 0, 0, 0, 0, 0],
  dawn: [230, 180, 166, 0.25, 255, 188, 103, 0.3, 72, 66, 127, 0.15],
  afternoon: [255, 237, 197, 0.16, 255, 225, 160, 0.24, 75, 56, 43, 0.08],
  dusk: [183, 117, 122, 0.4, 255, 119, 50, 0.33, 51, 36, 98, 0.32],
  night: [62, 84, 143, 0.73, 126, 170, 225, 0.1, 9, 20, 56, 0.32],
};
const mix = (a: Grade, b: Grade, p: number) => a.map((v, i) => v + (b[i] - v) * p);
export function createDayTransition(initial: Grade) {
  let from = initial,
    target = initial,
    started = 0;
  const value = (now: number) => {
    const p = Math.max(0, Math.min(1, (now - started) / 1800));
    return p === 1 ? target : p === 0 ? from : mix(from, target, p * p * (3 - 2 * p));
  };
  return {
    sample(next: Grade, now: number, reduced: boolean) {
      if (next.some((v, i) => v !== target[i])) {
        from = value(now);
        target = next;
        started = now;
      }
      if (reduced) {
        from = target;
        started = now - 1800;
      }
      return value(now);
    },
    active: (now: number) => now - started < 1800 && from.some((v, i) => v !== target[i]),
  };
}
const transitions = new WeakMap<
  HTMLCanvasElement,
  Map<string, ReturnType<typeof createDayTransition>>
>();
export function atmosphereTransitioning(
  canvas: HTMLCanvasElement,
  sceneId: string,
  now = Date.now(),
) {
  return transitions.get(canvas)?.get(sceneId)?.active(now) || false;
}
function grade(
  c: CanvasRenderingContext2D,
  a: MapAtmosphere,
  s: VttScene,
  now: number,
  reduced: boolean,
  w: number,
  h: number,
) {
  let scenes = transitions.get(c.canvas);
  if (!scenes) {
    scenes = new Map();
    transitions.set(c.canvas, scenes);
  }
  const next = daylight[a.enabled ? a.day : 'original'];
  let transition = scenes.get(s.id);
  if (!transition) {
    transition = createDayTransition(next);
    scenes.set(s.id, transition);
    if (scenes.size > 12) scenes.delete(scenes.keys().next().value!);
  }
  const g = transition.sample(next, now, reduced);
  const color = (offset: number) =>
    'rgb(' +
    g
      .slice(offset, offset + 3)
      .map(Math.round)
      .join(',') +
    ')';
  c.globalCompositeOperation = 'multiply';
  c.globalAlpha = g[3];
  c.fillStyle = color(0);
  c.fillRect(0, 0, w, h);
  c.globalCompositeOperation = 'source-over';
  c.globalAlpha = 1;
  if (g[7] > 0.001) {
    const light = c.createLinearGradient(0, 0, w * 0.83, h * 0.85);
    light.addColorStop(0, color(4));
    light.addColorStop(0.75, 'transparent');
    c.globalAlpha = g[7];
    c.fillStyle = light;
    c.fillRect(0, 0, w, h);
  }
  if (g[11] > 0.001) {
    const shade = c.createLinearGradient(0, 0, w, h);
    shade.addColorStop(0, 'transparent');
    shade.addColorStop(1, color(8));
    c.globalAlpha = g[11];
    c.fillStyle = shade;
    c.fillRect(0, 0, w, h);
  }
  c.globalAlpha = 1;
  if (a.enabled && a.weather === 'eclipse') {
    c.globalCompositeOperation = 'multiply';
    c.globalAlpha = a.intensity * 0.6;
    c.fillStyle = '#494157';
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }
}

function haze(
  c: CanvasRenderingContext2D,
  a: MapAtmosphere,
  v: View,
  t: number,
  w: number,
  h: number,
) {
  const family = weatherPreset(a.weather)[3];
  const density =
    family === 'fog'
      ? a.weather === 'mist'
        ? 0.53
        : 0.96
      : family === 'cloud'
        ? a.weather === 'partly-cloudy'
          ? 0.5
          : a.weather === 'overcast'
            ? 0.87
            : 0.68
        : family === 'vortex'
          ? 0.95
          : family === 'sand'
            ? 0.91
            : family === 'storm'
              ? 0.48
              : family === 'snow' && a.weather !== 'snow'
                ? 0.46
                : family === 'ash'
                  ? 0.37
                  : family === 'aurora'
                    ? 0.92
                    : family === 'eclipse'
                      ? 0.18
                      : family === 'wind'
                        ? 0.19
                        : 0;
  if (!density || a.intensity <= 0) return;
  const pigment =
    family === 'sand'
      ? [0.68, 0.46, 0.23]
      : family === 'ash'
        ? [0.37, 0.35, 0.32]
        : a.weather === 'arcane-fog'
          ? [0.62, 0.43, 0.84]
          : a.weather === 'void-storm'
            ? [0.21, 0.12, 0.36]
            : a.weather === 'spectral-storm'
              ? [0.25, 0.65, 0.57]
              : a.weather === 'mana-storm'
                ? [0.52, 0.34, 0.73]
                : family === 'cloud' || family === 'eclipse'
                  ? [0.14, 0.18, 0.23]
                  : a.day === 'night'
                    ? [0.47, 0.55, 0.7]
                    : [0.82, 0.86, 0.88];
  const surface = weatherLayer();
  if (surface) {
    const { canvas, gl, program, uniforms } = surface;
    // Atmosphere is a soft volume; bounded resolution leaves time for tokens and VFX.
    const scale = Math.min(1, 1280 / w, 900 / h),
      pw = Math.max(1, Math.ceil(w * scale)),
      ph = Math.max(1, Math.ceil(h * scale));
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    gl.viewport(0, 0, pw, ph);
    gl.useProgram(program);
    const u = (name: string) => {
      if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name));
      return uniforms.get(name)!;
    };
    const angle = (a.wind * Math.PI) / 180;
    gl.uniform4f(u('view'), v.left, v.top, v.right, v.bottom);
    gl.uniform2f(u('wind'), Math.cos(angle), Math.sin(angle));
    gl.uniform1f(u('time'), t * a.speed);
    gl.uniform1f(u('density'), density * a.intensity);
    gl.uniform1f(
      u('mode'),
      family === 'aurora'
        ? 3
        : family === 'vortex'
          ? 2
          : family === 'cloud' || family === 'eclipse'
            ? 1
            : 0,
    );
    gl.uniform1f(u('vortexSize'), a.weather === 'hurricane' ? 0.8 : 0.53);
    gl.uniform3f(u('pigment'), pigment[0], pigment[1], pigment[2]);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    c.drawImage(canvas, 0, 0, w, h);
  } else {
    for (let i = 0; i < 11; i++) {
      const x = w * fract(i * 0.371 + t * 0.008 * a.speed),
        y = h * fract(i * 0.619 + t * 0.003 * a.speed),
        radius = w * (0.22 + fract(i * 0.37) * 0.16);
      const g = c.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(
        0,
        'rgba(' +
          pigment.map((v) => Math.round(v * 255)).join(',') +
          ',' +
          density * a.intensity * 0.44 +
          ')',
      );
      g.addColorStop(1, 'transparent');
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    }
  }
}

function precipitation(
  c: CanvasRenderingContext2D,
  s: VttScene,
  a: MapAtmosphere,
  t: number,
  w: number,
  h: number,
) {
  const family = weatherPreset(a.weather)[3],
    rain = ['rain', 'storm', 'vortex'].includes(family),
    snow = family === 'snow',
    dust = ['wind', 'ash', 'sand'].includes(family),
    hail = family === 'hail',
    meteor = family === 'meteor';
  if ((!rain && !snow && !dust && !hail && !meteor) || a.intensity <= 0) return;
  const random = seededRandom(s.id + ' screen weather ' + a.weather),
    wind = Math.sin(((a.wind - 90) * Math.PI) / 180);
  const cellX = meteor
      ? 175
      : rain
        ? a.weather === 'drizzle'
          ? 26
          : 24
        : snow
          ? a.weather === 'snow'
            ? 47
            : 35
          : dust
            ? 42
            : 36,
    cellY = meteor
      ? 230
      : rain
        ? a.weather === 'drizzle'
          ? 85
          : 120
        : snow
          ? 140
          : hail
            ? 105
            : 130;
  const nx = Math.ceil(w / cellX) + 2,
    ny = Math.ceil(h / cellY) + 2;
  let count = 0;
  for (let row = -1; row < ny; row++)
    for (let col = -1; col < nx; col++) {
      if (count++ > 1200) return;
      const key = ((row + 2) * nx + col + 2) * 31;
      if (random(key) > a.intensity) continue;
      const depth = 0.4 + random(key + 1) * 0.9,
        age = fract(
          t * a.speed * (rain ? 1.6 : snow ? 0.19 : meteor ? 0.36 : 0.35) * (depth + 0.5) +
            random(key + 2),
        );
      const x =
          (col + random(key + 3)) * cellX +
          wind * (age - 0.5) * (rain ? 72 : dust ? 130 : 60) +
          Math.sin(age * 6.28 + key) * (snow ? 21 : 0),
        y = (row + age) * cellY;
      c.save();
      c.globalAlpha = Math.pow(Math.sin(age * Math.PI), 0.45) * (0.48 + depth * 0.35) * a.intensity;
      if (rain || meteor) {
        const length =
            (meteor
              ? 90 + random(key + 4) * 110
              : a.weather === 'drizzle'
                ? 14 + random(key + 4) * 16
                : 20 + random(key + 4) * 31) * depth,
          dx = (meteor ? 0.85 : wind * 0.5) * length;
        const color =
          a.weather === 'blood-rain'
            ? '#e27673'
            : a.weather === 'ethereal-drizzle'
              ? '#d2baff'
              : a.weather === 'sunshower'
                ? '#ffe29f'
                : a.weather === 'mana-storm'
                  ? '#d7b6ff'
                  : a.weather === 'spectral-storm'
                    ? '#a6ffe1'
                    : a.weather === 'void-storm'
                      ? '#b786ed'
                      : meteor
                        ? '#ffdf9c'
                        : '#d9ecf4';
        const g = c.createLinearGradient(x - dx, y - length, x, y);
        g.addColorStop(0, 'transparent');
        g.addColorStop(0.8, color);
        g.addColorStop(1, meteor ? '#fff6de' : color);
        c.strokeStyle = g;
        c.lineWidth =
          (meteor ? 2.5 : a.weather === 'drizzle' ? 0.9 : 0.8 + random(key + 5) * 0.7) * depth;
        c.beginPath();
        c.moveTo(x - dx, y - length);
        c.lineTo(x, y);
        c.stroke();
        if (meteor) {
          const glow = c.createRadialGradient(x, y, 0, x, y, 9 * depth);
          glow.addColorStop(0, '#fff9d5');
          glow.addColorStop(0.2, '#ffbd5977');
          glow.addColorStop(1, 'transparent');
          c.fillStyle = glow;
          c.fillRect(x - 12, y - 12, 24, 24);
        }
        if (rain && age > 0.8 && random(key + 6) > 0.55) {
          c.globalAlpha *= 0.45;
          c.strokeStyle = color;
          c.lineWidth = 0.7;
          c.beginPath();
          c.ellipse(x, y, 2 + (age - 0.8) * 32, 1 + (age - 0.8) * 11, 0, 0, Math.PI * 2);
          c.stroke();
        }
      } else {
        const r = (hail ? 3 : snow ? 3.4 : dust ? 1.8 : 1) * depth;
        c.translate(x, y);
        c.rotate(t * 0.23 + key);
        if (hail) {
          c.fillStyle = '#e4f1fc';
          c.beginPath();
          c.moveTo(-r, 0);
          c.lineTo(0, -r * 1.25);
          c.lineTo(r, 0);
          c.lineTo(0, r);
          c.closePath();
          c.fill();
        } else {
          const g = c.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
          g.addColorStop(
            0,
            snow
              ? '#f9faf5'
              : family === 'sand'
                ? '#e2bd83'
                : a.weather === 'wild-winds'
                  ? '#d9baff'
                  : '#c3b5a5',
          );
          g.addColorStop(0.35, snow ? '#ffffffaa' : '#c3a37577');
          g.addColorStop(1, 'transparent');
          c.fillStyle = g;
          c.fillRect(-r * 2, -r * 2, r * 4, r * 4);
        }
      }
      c.restore();
    }
}

function lightning(
  c: CanvasRenderingContext2D,
  s: VttScene,
  a: MapAtmosphere,
  t: number,
  w: number,
  h: number,
  reduced: boolean,
) {
  if (weatherPreset(a.weather)[3] !== 'storm' || reduced) return;
  const random = seededRandom(s.id + ' sky lightning'),
    cycle = Math.floor(t / 7),
    age = t - cycle * 7 - random(cycle + 4) * 4.5;
  if (age < 0 || age > 0.34) return;
  const pulse = Math.exp(-age * 10) * (0.75 + 0.25 * Math.cos(age * 92)) * a.intensity;
  c.save();
  c.globalAlpha = pulse * 0.16;
  c.fillStyle = '#cfddff';
  c.fillRect(0, 0, w, h);
  const color =
    a.weather === 'mana-storm'
      ? '#d9b4ff'
      : a.weather === 'spectral-storm'
        ? '#b6ffdc'
        : a.weather === 'void-storm'
          ? '#ba8fff'
          : '#deedff';
  const x = w * (0.16 + random(cycle + 10) * 0.68),
    length = h * (0.3 + random(cycle + 11) * 0.35);
  c.beginPath();
  c.moveTo(x, -20);
  for (let i = 1; i <= 14; i++) {
    const dx = (random(cycle * 100 + i) - 0.5) * w * 0.08;
    c.lineTo(x + dx, -20 + (length * i) / 14);
  }
  c.globalAlpha = pulse;
  c.lineWidth = 2;
  c.strokeStyle = color;
  c.shadowColor = color;
  c.shadowBlur = 14;
  c.stroke();
  c.lineWidth = 0.8;
  c.strokeStyle = '#fff7ed';
  c.shadowBlur = 4;
  c.stroke();
  c.beginPath();
  c.moveTo(x, length * 0.4);
  c.lineTo(x + w * 0.07, length * 0.52);
  c.lineTo(x + w * 0.1, length * 0.71);
  c.globalAlpha = pulse * 0.6;
  c.lineWidth = 1;
  c.strokeStyle = color;
  c.stroke();
  c.restore();
}

export function atmosphereAnimated(a: MapAtmosphere | undefined) {
  return !!a?.enabled && a.intensity > 0 && a.weather !== 'clear';
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
  if (!a) return;
  c.save();
  c.beginPath();
  c.rect(0, 0, s.width, s.height);
  c.clip();
  // Work in CSS screen pixels so drops remain visible at every map scale.
  c.translate(view.left, view.top);
  c.scale(1 / zoom, 1 / zoom);
  grade(c, a, s, now, reduced, width, height);
  if (a.enabled && a.intensity > 0) {
    const t = reduced ? 12.5 : (now % 86400000) / 1000;
    haze(c, a, view, t, width, height);
    precipitation(c, s, a, t, width, height);
    lightning(c, s, a, t, width, height, reduced);
  }
  c.restore();
}
