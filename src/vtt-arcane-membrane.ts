import type { TokenEffect } from '../shared/vtt-effects';
import type { EffectFootprint } from './vtt-effect-footprint';

// The silhouette breathes while apertures peel open and heal. Both passes share
// one continuous surface, without baked frames or crossfades.
export const arcaneBarrierReady = Promise.resolve();
export const ARCANE_BARRIER_PERIOD = 5.6;
const size = 384,
  tau = Math.PI * 2;
const phaseAt = (t: number) => (t / ARCANE_BARRIER_PERIOD) * tau;
export function arcaneBarrierShape(t: number) {
  const phase = phaseAt(t);
  return {
    phase,
    radius: 0.78 + 0.065 * Math.sin(phase) + 0.015 * Math.sin(phase * 2 + 0.7),
    apertures: Array.from({ length: 3 }, (_, i) => {
      const opening = Math.max(
        0,
        Math.min(1, (0.5 + 0.5 * Math.sin(phase + i * 2.1) - 0.18) / 0.7),
      );
      return {
        angle: (i * tau) / 3 + 0.28 * Math.sin(phase + i),
        opening: opening * opening * (3 - 2 * opening),
      };
    }),
  };
}

const fragment = `
precision highp float;
varying vec2 uv;
uniform float phase,frontPass,pixel;
uniform vec3 pigment;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.03+vec2(3.7,8.9);a*=.5;}return v;}
void main(){
 vec2 q=(uv*2.-1.)*vec2(1.,-1.);
 float angle=atan(q.y,q.x),r=length(q);
 float radius=.78+.065*sin(phase)+.015*sin(phase*2.+.7);
 float deformation=.025*sin(angle*3.+phase*2.)+.017*sin(angle*5.-phase);
 float boundary=radius+deformation;
 float inside=1.-smoothstep(boundary-pixel,boundary+pixel,r);
 float sphere=min(.999,r/boundary),z=sqrt(max(0.,1.-sphere*sphere));
 vec2 drift=vec2(sin(phase),cos(phase))*.4;
 float flow=fbm(q*3.4+drift+vec2(z*1.7,-z*.8));
 float folded=fbm(q*7.8-drift*.7+flow*1.8);
 float cut=0.,lip=0.,roll=0.,lipLight=0.;
 for(int i=0;i<3;i++){
  float id=float(i),a=id*6.2831853/3.+.28*sin(phase+id);
  float opening=smoothstep(.18,.88,.5+.5*sin(phase+id*2.1));
  vec2 center=vec2(cos(a),sin(a))*radius*.88;
  vec2 hole=q-center;
  hole=mat2(cos(a),-sin(a),sin(a),cos(a))*hole;
  hole*=vec2(1.,1.1+.2*sin(phase*2.+id));
  float bend=1.+.13*sin(atan(hole.y,hole.x)*3.+phase*2.+id);
  float distance=length(hole)*bend;
  float aperture=.19*opening;
  float gate=smoothstep(.005,.028,aperture);
  cut=max(cut,(1.-smoothstep(aperture-pixel,aperture+pixel,distance))*gate);
  float crease=exp(-pow((distance-aperture)/.013,2.))*gate;
  lip=max(lip,crease);
  roll=max(roll,exp(-pow((distance-aperture-.019)/.027,2.))*gate);
  lipLight=max(lipLight,crease*(.35+.65*max(0.,dot(normalize(hole+vec2(.0001)),vec2(-.6,-.8)))));
 }
 float fresnel=pow(1.-z,1.65);
 float rim=exp(-pow((r-boundary)/.007,2.));
 float rimHalo=exp(-pow((r-boundary)/.027,2.));
 float folds=pow(clamp(1.-abs(folded-.52)*5.,0.,1.),6.);
 vec3 normal=normalize(vec3(q/boundary,z));
 vec3 light=normalize(vec3(-.45,-.65,.72));
 float diffuse=clamp(dot(normal,light),0.,1.);
 float specular=pow(max(0.,dot(reflect(-light,normal),vec3(0.,0.,1.))),28.);
 float saturation=max(pigment.r,max(pigment.g,pigment.b))-min(pigment.r,min(pigment.g,pigment.b));
 vec3 accent=mix(pigment,vec3(.28,.83,1.),clamp(saturation*1.4,0.,.8));
 vec3 dark=pigment*.28;
 vec3 color=mix(dark,pigment,clamp(diffuse*.72+flow*.24,0.,1.));
 color=mix(color,accent,clamp(fresnel*.6+rim*.74+lip*.8,0.,1.));
 color=mix(color,pigment*.42,roll*.2);
 color+=mix(vec3(1.),vec3(.45,.58,.7),clamp(saturation,0.,1.))*specular*.9+mix(pigment,vec3(1.),.7)*(rim*.24+lipLight*.55);
 float opacity=(.042+fresnel*.24+folds*.08+specular*.13)*inside;
 opacity+=rim*.53+rimHalo*.065+(lip*.48+roll*.15)*inside;
 opacity*=1.-cut;
 if(frontPass>.5)opacity*=.1+.9*smoothstep(.28,.86,sphere);
 opacity=clamp(opacity,0.,.82);
 gl_FragColor=vec4(color*opacity,opacity);
}`;

type Surface = {
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
};
let surface: Surface | null = null,
  unavailable = false;
let back: HTMLCanvasElement | undefined, front: HTMLCanvasElement | undefined;
let previousPhase = NaN,
  previousColor = '';
function shaderSurface() {
  if (surface || unavailable || typeof document === 'undefined') return surface;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
    });
    if (!gl || typeof gl.FRAGMENT_SHADER !== 'number') {
      unavailable = true;
      return null;
    }
    const compile = (type: number, code: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, code);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error('Barrier shader');
      return shader;
    };
    const program = gl.createProgram()!,
      vertex = compile(
        gl.VERTEX_SHADER,
        'attribute vec2 position;varying vec2 uv;void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}',
      ),
      pixelShader = compile(gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vertex);
    gl.attachShader(program, pixelShader);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(pixelShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Barrier program');
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
    gl.viewport(0, 0, size, size);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      surface = null;
      unavailable = true;
      previousPhase = NaN;
    });
    surface = { canvas, gl, program, uniforms: new Map() };
    return surface;
  } catch {
    unavailable = true;
    return null;
  }
}
function colorChannels(color: string) {
  const hex = color.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
}
function fallback(c: CanvasRenderingContext2D, t: number, color: string, isFront: boolean) {
  const shape = arcaneBarrierShape(t),
    half = size / 2;
  c.save();
  c.translate(half, half);
  c.beginPath();
  for (let i = 0; i <= 160; i++) {
    const a = (i * tau) / 160,
      r =
        (shape.radius +
          0.025 * Math.sin(a * 3 + shape.phase * 2) +
          0.017 * Math.sin(a * 5 - shape.phase)) *
        half;
    const x = Math.cos(a) * r,
      y = Math.sin(a) * r;
    if (i) c.lineTo(x, y);
    else c.moveTo(x, y);
  }
  c.closePath();
  const g = c.createRadialGradient(0, 0, half * 0.15, 0, 0, half * shape.radius);
  g.addColorStop(0, color + '08');
  g.addColorStop(0.7, color + '20');
  g.addColorStop(1, color + '8c');
  c.fillStyle = g;
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.stroke();
  for (const hole of shape.apertures) {
    const x = Math.cos(hole.angle) * shape.radius * 0.88 * half,
      y = Math.sin(hole.angle) * shape.radius * 0.88 * half,
      r = 0.19 * hole.opening * half;
    if (r < 1) continue;
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.ellipse(x, y, r, r / 1.15, hole.angle, 0, tau);
    c.fill();
    c.globalCompositeOperation = 'source-over';
    c.strokeStyle = color;
    c.lineWidth = 1.3;
    c.stroke();
  }
  if (isFront) {
    c.globalCompositeOperation = 'destination-in';
    const mask = c.createRadialGradient(0, 0, 0, 0, 0, half * shape.radius);
    mask.addColorStop(0, '#ffffff10');
    mask.addColorStop(0.75, '#ffffff66');
    mask.addColorStop(1, '#ffffffff');
    c.fillStyle = mask;
    c.fillRect(-half, -half, size, size);
  }
  c.restore();
}
function paint(t: number, color: string) {
  const phase = phaseAt(t);
  if (phase === previousPhase && color === previousColor) return;
  const gpu = shaderSurface();
  for (const [canvas, isFront] of [
    [back!, false],
    [front!, true],
  ] as const) {
    const c = canvas.getContext('2d')!;
    c.clearRect(0, 0, size, size);
    if (gpu) {
      const { gl, program, uniforms } = gpu;
      gl.useProgram(program);
      const u = (name: string) => {
        if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(program, name));
        return uniforms.get(name)!;
      };
      gl.uniform1f(u('phase'), phase % tau);
      gl.uniform1f(u('pixel'), 2 / size);
      gl.uniform1f(u('frontPass'), isFront ? 1 : 0);
      const [r, g, b] = colorChannels(color);
      gl.uniform3f(u('pigment'), r, g, b);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      c.drawImage(gpu.canvas, 0, 0);
    } else fallback(c, t, color, isFront);
  }
  previousPhase = phase;
  previousColor = color;
}
export function drawArcaneBarrier(
  c: CanvasRenderingContext2D,
  e: TokenEffect,
  f: EffectFootprint,
  t: number,
  pass: 'behind' | 'front',
) {
  if (e.kind !== 'arcane-barrier') return false;
  if ((e.intensity ?? 1) <= 0 || typeof document === 'undefined') return true;
  if (!back) {
    back = document.createElement('canvas');
    front = document.createElement('canvas');
    back.width = back.height = front.width = front.height = size;
  }
  paint(t, e.color);
  c.save();
  c.globalCompositeOperation = 'screen';
  c.globalAlpha *= (e.intensity ?? 1) * (pass === 'front' ? 0.9 : 0.82);
  const rx = f.plane.rx * 2.1,
    ry = f.plane.ry * 2.1;
  c.drawImage(pass === 'front' ? front! : back, -rx, -ry, rx * 2, ry * 2);
  c.restore();
  return true;
}
