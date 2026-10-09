// The portrait stays in its SVG frame. This transparent surface only draws vapor.
const vertex = `attribute vec2 position;
varying vec2 uv;
void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision mediump float;
varying vec2 uv;
uniform sampler2D vapor;
uniform float time;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float flow(vec2 p){return noise(p)*.57+noise(p*2.03+7.)*.28+noise(p*4.07+19.)*.15;}
vec4 smoke(vec2 p){
  vec2 drift=vec2(flow(p*6.+vec2(time*.21,-time*.51)),flow(p*6.+vec2(13.+time*.18,-time*.43)))-.5;
  return texture2D(vapor,clamp(p+drift*.085,0.,1.));
}
void main(){
  float clearFace=smoothstep(.76,1.28,length((uv-vec2(.5,.35))/vec2(.25,.30)));
  float border=smoothstep(0.,.045,uv.x)*smoothstep(0.,.045,uv.y)*smoothstep(0.,.045,1.-uv.x)*smoothstep(0.,.045,1.-uv.y);
  vec4 mist=smoke(uv);
  float density=mist.a*.30;
  vec3 color=mist.rgb*density;
  for(int i=0;i<2;i++){
    float phase=fract(time/2.8+float(i)*.5);
    vec2 p=(uv-vec2(.5,.50-phase*.065))/(.94+phase*.18)+.5;
    vec4 plume=smoke(p+vec2(float(i)*.013,0.));
    float a=plume.a*sin(phase*3.14159)*.23;
    color+=plume.rgb*a;density+=a;
  }
  color/=max(density,.001);density=min(density,.50)*clearFace*border;
  // Premultiplied alpha preserves fine wisps over the map and shoulder edges.
  gl_FragColor=vec4(color*density,density);
}`;

export function startPortraitSmoke(canvas: HTMLCanvasElement, vapor: HTMLImageElement) {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
  });
  if (!gl) return null;
  const shaders: WebGLShader[] = [],
    textures: WebGLTexture[] = [];
  let program: WebGLProgram | null = null,
    buffer: WebGLBuffer | null = null,
    frame = 0,
    disposed = false;
  const cleanup = () => {
    disposed = true;
    cancelAnimationFrame(frame);
    document.removeEventListener('visibilitychange', visibility);
    observer.disconnect();
    textures.forEach((t) => gl.deleteTexture(t));
    shaders.forEach((s) => gl.deleteShader(s));
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
  };
  const observer = new ResizeObserver(() => resize());
  const resize = () => {
    const pixels = Math.max(
      1,
      Math.round(canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 1.5)),
    );
    if (canvas.width !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }
    gl.viewport(0, 0, pixels, pixels);
  };
  const started = performance.now();
  let clock: WebGLUniformLocation | null = null;
  const draw = (now: number) => {
    if (disposed || document.hidden) return;
    gl.uniform1f(clock, (now - started) / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    frame = requestAnimationFrame(draw);
  };
  function visibility() {
    cancelAnimationFrame(frame);
    if (!document.hidden && !disposed) frame = requestAnimationFrame(draw);
  }
  try {
    program = gl.createProgram();
    if (!program) throw Error('Smoke program unavailable');
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vertex],
      [gl.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw Error('Smoke shader unavailable');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw Error('Smoke shader compilation failed');
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Smoke shader link failed');
    gl.useProgram(program);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    for (const [index, source] of [vapor].entries()) {
      const texture = gl.createTexture();
      if (!texture) throw Error('Smoke texture unavailable');
      textures.push(texture);
      gl.activeTexture(gl.TEXTURE0 + index);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.uniform1i(gl.getUniformLocation(program, 'vapor'), index);
    }
    clock = gl.getUniformLocation(program, 'time');
    resize();
    observer.observe(canvas);
    document.addEventListener('visibilitychange', visibility);
    draw(started);
    canvas.dataset.renderer = 'webgl';
    return cleanup;
  } catch {
    cleanup();
    return null;
  }
}
