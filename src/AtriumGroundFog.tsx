import { useEffect, useId, useRef, useState } from 'react';

const vertex = `attribute vec2 aPosition;
void main(){gl_Position=vec4(aPosition,0.,1.);}`;
const fragment = `precision highp float;
uniform vec2 uResolution;
uniform float uTime;
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
float noise(vec3 p){
  vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
    mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){return noise(p)*.5+noise(p*2.07+5.3)*.27+noise(p*4.19+11.7)*.15+noise(p*8.31+17.1)*.08;}
void main(){
  vec2 uv=gl_FragCoord.xy/uResolution;
  vec3 ray=normalize(vec3((uv.x-.68)*uResolution.x/uResolution.y,(uv.y-.32)*.9,1.3));
  if(ray.y>=-.018){gl_FragColor=vec4(0.);return;}
  float entry=(.5-1.2)/ray.y,exit=-1.2/ray.y;
  float stepSize=min((exit-entry)/8.,.65),opacity=0.;
  for(int i=0;i<8;i++){
    vec3 p=vec3(0.,1.2,0.)+ray*(entry+(float(i)+.5)*stepSize);
    vec3 flow=vec3(p.x*1.1-uTime*.065,p.y*3.5,p.z*.8+uTime*.032);
    float curl=noise(flow*.55+vec3(0.,0.,uTime*.012));
    float wisps=smoothstep(.39,.72,fbm(flow+vec3(curl*2.1,0.,curl)));
    float ceiling=.22+.2*noise(vec3(p.x*.6,0.,p.z*.5));
    float height=pow(1.-smoothstep(0.,ceiling,p.y),1.2);
    float density=wisps*height*3.*(1.-smoothstep(12.,32.,p.z));
    opacity+=(1.-opacity)*(1.-exp(-density*stepSize*max(.1,-ray.y*4.)));
  }
  opacity*=.8*(1.-smoothstep(.28,.34,uv.y));
  vec3 tint=mix(vec3(.43,.46,.51),vec3(.50,.32,.31),.3+.25*(1.-uv.x));
  gl_FragColor=vec4(tint,opacity);
}`;

function renderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: false,
  });
  if (!gl) return null;
  const shaders: WebGLShader[] = [];
  const program = gl.createProgram()!;
  const buffer = gl.createBuffer()!;
  const dispose = () => {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    shaders.forEach((shader) => gl.deleteShader(shader));
  };
  for (const [type, code] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(type)!;
    shaders.push(shader);
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      dispose();
      return null;
    }
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    dispose();
    return null;
  }
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, 'aPosition');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const resolution = gl.getUniformLocation(program, 'uResolution');
  const time = gl.getUniformLocation(program, 'uTime');
  return {
    draw(elapsed: number) {
      const scale = Math.min(1, 640 / innerWidth, 400 / innerHeight);
      const width = Math.round(innerWidth * scale),
        height = Math.round(innerHeight * scale);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform2f(resolution, width, height);
      gl.uniform1f(time, elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    dispose,
  };
}

export function AtriumGroundFog() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  const id = useId();
  useEffect(() => {
    const surface = canvas.current!;
    let scene = renderer(surface);
    if (!scene) {
      setFallback(true);
      return;
    }
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      elapsed = 0,
      previous = performance.now(),
      lastDraw = 0,
      lost = false;
    const draw = () => scene?.draw(elapsed);
    const tick = (now: number) => {
      elapsed += Math.min((now - previous) / 1000, 0.1);
      previous = now;
      if (now - lastDraw >= 1000 / 24) {
        draw();
        lastDraw = now;
      }
      frame = requestAnimationFrame(tick);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      const moving = !document.hidden && !media.matches && !lost;
      surface.dataset.motion = moving ? 'on' : 'off';
      previous = performance.now();
      if (!lost) draw();
      if (moving) frame = requestAnimationFrame(tick);
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      update();
    };
    const contextRestored = () => {
      scene?.dispose();
      scene = renderer(surface);
      lost = !scene;
      if (lost) setFallback(true);
      update();
    };
    update();
    window.addEventListener('resize', update);
    document.addEventListener('visibilitychange', update);
    media.addEventListener('change', update);
    surface.addEventListener('webglcontextlost', contextLost);
    surface.addEventListener('webglcontextrestored', contextRestored);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      document.removeEventListener('visibilitychange', update);
      media.removeEventListener('change', update);
      surface.removeEventListener('webglcontextlost', contextLost);
      surface.removeEventListener('webglcontextrestored', contextRestored);
      scene?.dispose();
    };
  }, []);
  return (
    <div className="events-ground-fog" aria-hidden="true">
      <canvas ref={canvas} hidden={fallback} data-fog-renderer="webgl" />
      {fallback && (
        <svg className="events-fog-fallback" viewBox="0 0 1000 200" preserveAspectRatio="none">
          <defs>
            <filter id={id + '-noise'}>
              <feTurbulence baseFrequency=".008 .035" numOctaves="3" seed="31" />
              <feColorMatrix values="0 0 0 0 .45 0 0 0 0 .44 0 0 0 0 .46 0 0 0 1 -0.45" />
            </filter>
            <linearGradient id={id + '-fade'} x2="0" y2="1">
              <stop stopColor="white" stopOpacity="0" />
              <stop offset="1" stopColor="white" />
            </linearGradient>
            <mask id={id + '-mask'}>
              <rect width="1000" height="200" fill={`url(#${id}-fade)`} />
            </mask>
          </defs>
          <rect
            width="1000"
            height="200"
            filter={`url(#${id}-noise)`}
            mask={`url(#${id}-mask)`}
            opacity=".3"
          />
        </svg>
      )}
    </div>
  );
}
