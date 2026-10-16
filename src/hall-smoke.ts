const vertex = `attribute vec2 p;varying vec2 uv;void main(){uv=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}`;
const fragment = `precision mediump float;
varying vec2 uv;uniform vec2 size;uniform float time;uniform float reveal;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.52,n=0.;for(int i=0;i<5;i++){n+=noise(p)*a;p=mat2(.8,-.6,.6,.8)*p*2.03+vec2(7.3,13.1);a*=.49;}return n;}
void main(){
 vec2 p=uv*vec2(size.x/160.,2.5);float t=time*.045;
 vec2 warp=vec2(fbm(p*.7+vec2(t,-t*.6)),fbm(p*.7+vec2(13.,7.)-t*.4));
 vec2 flow=p+warp*2.4+vec2(t*.3,-t*.7-reveal*.28);
 float body=fbm(flow),fine=fbm(flow*2.7+warp);
 float edge=smoothstep(.04,.82,uv.y+(body-.5)*.43);
 float folds=pow(1.-abs(fine*2.-1.),4.);
 float light=smoothstep(.3,.72,body)*(.65+folds*.35);
 vec3 color=mix(vec3(.035,.03,.024),vec3(.17,.151,.12),light);
 color=mix(color,vec3(.063,.055,.043),smoothstep(.65,1.,uv.y));
 float alpha=edge*(.68+fine*.3);alpha=mix(alpha,1.,smoothstep(.8,1.,uv.y));
 gl_FragColor=vec4(color*alpha,alpha);
}`;

export function startHallSmoke(canvas: HTMLCanvasElement) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  const shaders: WebGLShader[] = [];
  let program: WebGLProgram | null = null, buffer: WebGLBuffer | null = null;
  let frame = 0, visible = false, disposed = false, last = 0, painted = -Infinity, elapsed = 0, dirty = true;
  let clock: WebGLUniformLocation | null = null, size: WebGLUniformLocation | null = null, reveal: WebGLUniformLocation | null = null;
  function paint() {
    const rect = canvas.getBoundingClientRect();
    if (!gl || !program || gl.isContextLost()) return;
    const scale = Math.min(1, 1000 / Math.max(1, rect.width));
    const width = Math.max(1, Math.round(rect.width * scale)), height = Math.max(1, Math.round(rect.height * scale));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; gl.viewport(0, 0, width, height); }
    gl.uniform2f(size, rect.width, rect.height);
    gl.uniform1f(clock, elapsed);
    gl.uniform1f(reveal, Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight + rect.height))));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    dirty = false;
  }
  function draw(now: number) {
    frame = 0;
    canvas.dataset.paused = String(document.hidden || !visible || reduced.matches);
    if (disposed || document.hidden || !visible) return;
    if (last && !reduced.matches) elapsed += Math.min(.15, (now - last) / 1000);
    last = now;
    if (dirty || now - painted >= 1000 / 12) { paint(); painted = now; }
    if (program && !reduced.matches) frame = requestAnimationFrame(draw);
  }
  function invalidate() { dirty = true; if (!frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(draw); }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    canvas.dataset.paused = String(document.hidden || !visible || reduced.matches);
    invalidate();
  }
  function lost(event: Event) { event.preventDefault(); program = null; canvas.dataset.renderer = 'fallback'; sync(); }
  try {
    if (!gl) throw Error('WebGL unavailable');
    program = gl.createProgram(); if (!program) throw Error('Program unavailable');
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(type); if (!shader) throw Error('Shader unavailable');
      shaders.push(shader); gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error('Shader compilation failed');
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Program link failed');
    gl.useProgram(program); buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    clock = gl.getUniformLocation(program, 'time'); size = gl.getUniformLocation(program, 'size'); reveal = gl.getUniformLocation(program, 'reveal');
    canvas.dataset.renderer = 'webgl';
  } catch {
    if (gl) { shaders.forEach(s => gl.deleteShader(s)); gl.deleteBuffer(buffer); gl.deleteProgram(program); }
    program = null; canvas.dataset.renderer = 'fallback';
  }
  const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); });
  const resize = new ResizeObserver(invalidate);
  intersection.observe(canvas); resize.observe(canvas);
  window.addEventListener('scroll', invalidate, { passive: true });
  document.addEventListener('visibilitychange', sync); reduced.addEventListener('change', sync);
  canvas.addEventListener('webglcontextlost', lost); sync();
  return () => {
    disposed = true; cancelAnimationFrame(frame); intersection.disconnect(); resize.disconnect();
    window.removeEventListener('scroll', invalidate); document.removeEventListener('visibilitychange', sync);
    reduced.removeEventListener('change', sync); canvas.removeEventListener('webglcontextlost', lost);
    if (gl) { shaders.forEach(s => gl.deleteShader(s)); gl.deleteBuffer(buffer); gl.deleteProgram(program); }
  };
}
