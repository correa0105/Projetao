// The portrait stays fixed while its outer alpha feeds rising wisps.
const vertex = `attribute vec2 position;
varying vec2 uv;
void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision highp float;
varying vec2 uv;
uniform sampler2D portrait;
uniform sampler2D vapor;
uniform vec4 imageRect;
uniform float time;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float flow(vec2 p){return noise(p)*.57+noise(p*2.03+7.)*.28+noise(p*4.07+19.)*.15;}
float boundary(vec2 p,float width){return smoothstep(0.,width,p.x)*smoothstep(0.,width,p.y)*smoothstep(0.,width,1.-p.x)*smoothstep(0.,width,1.-p.y);}
vec4 wisp(vec2 p,float seed){
  vec2 drift=vec2(flow(p*4.+vec2(time*.24+seed,-time*.40)),flow(p*4.+vec2(seed+13.,-time*.35)))-.5;
  vec2 sampleUV=p+drift*.075;
  return texture2D(vapor,clamp(sampleUV,0.,1.))*boundary(sampleUV,.06);
}
void main(){
  vec2 imageUV=(uv-imageRect.xy)/imageRect.zw;
  vec4 source=texture2D(portrait,clamp(imageUV,0.,1.));
  float inside=step(0.,imageUV.x)*step(0.,imageUV.y)*step(imageUV.x,1.)*step(imageUV.y,1.);
  float disturbance=(flow(uv*9.+vec2(time*.16,-time*.29))-.5)*.16;
  float body=length((uv-vec2(.5,.57))/vec2(.365,.345));
  float head=length((uv-vec2(.5,.32))/vec2(.245,.285));
  float headMask=1.-smoothstep(.86,1.14,head);
  float bodyMask=1.-smoothstep(.69,1.10,body+disturbance);
  float lowerFade=1.-smoothstep(.78,.95,uv.y+disturbance*.36);
  float mask=max(headMask,bodyMask)*lowerFade*boundary(imageUV,.025)*inside;
  float portraitAlpha=source.a*mask;
  vec3 result=source.rgb*portraitAlpha;
  float alpha=portraitAlpha;
  float clearFace=smoothstep(.94,1.29,length((uv-vec2(.5,.33))/vec2(.25,.285)));
  float smokeAlpha=0.;vec3 smokeColor=vec3(0.);
  for(int i=0;i<12;i++){
    float n=float(i),phase=fract(time/3.4+n*.618034);
    float side=mod(n,2.)*2.-1.;
    float band=floor(n/2.);
    vec2 origin=vec2(.5+side*(.18+band*.020),.78-band*.040);
    origin.x+=side*phase*(.06+band*.005)+sin(phase*5.+n)*.016;
    origin.y-=phase*(.25+band*.012);
    vec2 q=uv-origin;
    float angle=side*(.19+phase*.45)+sin(n*1.3)*.08;
    q=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*q;
    vec2 p=q/(vec2(.23,.36)*(.66+phase*.44))+.5;
    vec4 mist=wisp(p,n*2.7);
    float life=smoothstep(0.,.15,phase)*(1.-smoothstep(.65,1.,phase));
    float a=mist.a*life*.23*clearFace;
    vec3 color=mix(vec3(.40,.43,.45),vec3(.88,.90,.88),clamp(dot(mist.rgb,vec3(.299,.587,.114)),0.,1.));
    smokeColor+=color*a*(1.-smokeAlpha);smokeAlpha+=a*(1.-smokeAlpha);
  }
  float edge=(1.-smoothstep(.65,.91,mask))*smoothstep(.04,.38,mask);
  float thread=flow(uv*16.+vec2(time*.35,-time*.65));
  float dissolve=edge*smoothstep(.48,.73,thread)*.14*clearFace*source.a;
  smokeColor+=vec3(.70,.73,.73)*dissolve*(1.-smokeAlpha);smokeAlpha+=dissolve*(1.-smokeAlpha);
  result=smokeColor+result*(1.-smokeAlpha);alpha=smokeAlpha+alpha*(1.-smokeAlpha);
  float outer=boundary(uv,.035);
  gl_FragColor=vec4(result*outer,alpha*outer);
}`;

export function startPortraitSmoke(
  canvas: HTMLCanvasElement,
  portrait: HTMLImageElement,
  vapor: HTMLImageElement,
) {
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
    canvas.removeEventListener('webglcontextlost', contextLost);
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
    gl.uniform1f(clock, (now - started) / 1000 + 1.7);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    frame = requestAnimationFrame(draw);
  };
  function visibility() {
    cancelAnimationFrame(frame);
    if (!document.hidden && !disposed) frame = requestAnimationFrame(draw);
  }
  function contextLost(event: Event) {
    event.preventDefault();
    cleanup();
    canvas.dispatchEvent(new Event('portraitflowlost'));
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
    for (const [index, source] of [portrait, vapor].entries()) {
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
      gl.uniform1i(gl.getUniformLocation(program, index === 0 ? 'portrait' : 'vapor'), index);
    }
    // Matches SVG xMidYMin meet exactly, regardless of source dimensions.
    const fit = Math.min(176 / portrait.naturalWidth, 200 / portrait.naturalHeight),
      width = portrait.naturalWidth * fit,
      height = portrait.naturalHeight * fit;
    gl.uniform4f(
      gl.getUniformLocation(program, 'imageRect'),
      (224 - width) / 448,
      14 / 224,
      width / 224,
      height / 224,
    );
    clock = gl.getUniformLocation(program, 'time');
    resize();
    observer.observe(canvas);
    document.addEventListener('visibilitychange', visibility);
    canvas.addEventListener('webglcontextlost', contextLost);
    draw(started);
    canvas.dataset.renderer = 'webgl';
    return cleanup;
  } catch {
    cleanup();
    return null;
  }
}
