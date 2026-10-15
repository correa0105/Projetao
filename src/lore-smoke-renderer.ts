const vertex=`attribute vec2 position;varying vec2 uv;void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position,0.,1.);}`;
const fragment=`precision highp float;
varying vec2 uv;uniform vec2 viewport;uniform vec4 protectedRect;uniform float time;
float hash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float n=0.,a=.52;for(int i=0;i<6;i++){n+=a*noise(p);p=mat2(.8,-.6,.6,.8)*p*2.04+vec2(7.3,13.1);a*=.48;}return n;}
void main(){
 vec2 pixel=uv*viewport;
 if(pixel.x>=protectedRect.x&&pixel.x<=protectedRect.z&&pixel.y>=protectedRect.y&&pixel.y<=protectedRect.w){gl_FragColor=vec4(0.);return;}
 vec2 p=pixel/310.;float t=time*.045;
 // Independent depths curl into each other; the field itself evolves, rather than sliding a texture.
 vec2 drift=vec2(t*.38,-t*.68);
 vec2 warp=vec2(fbm(p*.78+drift),fbm(p*.78+vec2(19.,7.)-drift*.53));
 vec2 curl=vec2(fbm(p*1.36+warp*2.5+vec2(-t*.34,t*.22)),fbm(p*1.36-warp*2.1+vec2(11.,5.)+t*.3));
 vec2 flow=p+warp*2.6+curl*1.6+drift;
 float body=fbm(flow*.93),fine=fbm(flow*3.7+vec2(-t*.19,t*.26));
 float folds=pow(1.-abs(fine*2.-1.),5.);
 float density=smoothstep(.24,.78,body*.76+fine*.24);
 float light=smoothstep(.35,.69,body)*(.62+folds*.38);
 float rim=clamp((fbm(flow*.93+vec2(.085,-.07))-body)*3.8,0.,.22);
 vec3 smoke=mix(vec3(.006,.007,.008),vec3(.135,.128,.119),light);
 smoke+=vec3(.10,.095,.086)*rim;
 float alpha=.60+density*.34;
 gl_FragColor=vec4(smoke*alpha,alpha);
}`;
/** A single low-resolution, throttled surface; the protected reading rectangle remains transparent. */
export function startLoreSmoke(canvas:HTMLCanvasElement,container:HTMLElement) {
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false});
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),shaders:WebGLShader[]=[];
  let program:WebGLProgram|null=null,buffer:WebGLBuffer|null=null,frame=0,disposed=false,last=0,elapsed=0,lastPaint=-Infinity,dirty=true;
  let clock:WebGLUniformLocation|null=null,viewport:WebGLUniformLocation|null=null,rectUniform:WebGLUniformLocation|null=null;
  const bounds=()=>{
    const r=container.getBoundingClientRect(),w=innerWidth,h=innerHeight;
    // The same native rectangle masks both WebGL and the fallback; scrolling moves only this hole.
    canvas.style.clipPath=`path(evenodd, 'M0 0H${w}V${h}H0Z M${r.left} ${r.top}H${r.right}V${r.bottom}H${r.left}Z')`;
    if(gl&&program){const scale=Math.min(1,1056/w,800/h),pw=Math.max(1,Math.round(w*scale)),ph=Math.max(1,Math.round(h*scale));
      if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph;gl.viewport(0,0,pw,ph);}
      gl.uniform2f(viewport,w,h);gl.uniform4f(rectUniform,r.left,r.top,r.right,r.bottom);
    }dirty=false;
  };
  const paint=()=>{if(dirty)bounds();if(gl&&program&&!gl.isContextLost()){gl.uniform1f(clock,elapsed);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}};
  const draw=(now:number)=>{frame=0;if(disposed||document.hidden)return;
    if(last&&!reduced.matches)elapsed+=Math.min(.15,(now-last)/1000);last=now;
    if(dirty||now-lastPaint>=1000/15){paint();lastPaint=now;}
    if(program&&!reduced.matches)frame=requestAnimationFrame(draw);
  };
  const invalidate=()=>{dirty=true;if(!document.hidden&&!frame&&!disposed)frame=requestAnimationFrame(draw);};
  const visibility=()=>{canvas.dataset.paused=String(document.hidden||reduced.matches);cancelAnimationFrame(frame);frame=0;last=0;if(!document.hidden)invalidate();};
  const preference=()=>{canvas.dataset.paused=String(document.hidden||reduced.matches);cancelAnimationFrame(frame);frame=0;last=0;invalidate();};
  const lost=(event:Event)=>{event.preventDefault();cancelAnimationFrame(frame);frame=0;program=null;canvas.dataset.renderer='fallback';};
  const observer=new ResizeObserver(invalidate);
  const dispose=()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener('resize',invalidate);window.removeEventListener('scroll',invalidate);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);canvas.removeEventListener('webglcontextlost',lost);shaders.forEach(s=>gl?.deleteShader(s));gl?.deleteBuffer(buffer);gl?.deleteProgram(program);};
  try {
    if(!gl)throw Error('WebGL unavailable');program=gl.createProgram();if(!program)throw Error('Smoke program unavailable');
    for(const [type,source]of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]] as const){const shader=gl.createShader(type);if(!shader)throw Error('Shader unavailable');shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('Smoke shader compilation failed');gl.attachShader(program,shader);}
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Smoke shader link failed');gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
    clock=gl.getUniformLocation(program,'time');viewport=gl.getUniformLocation(program,'viewport');rectUniform=gl.getUniformLocation(program,'protectedRect');canvas.dataset.renderer='webgl';
  }catch{if(gl){shaders.forEach(s=>gl.deleteShader(s));gl.deleteBuffer(buffer);gl.deleteProgram(program);}program=null;canvas.dataset.renderer='fallback';}
  canvas.dataset.paused=String(document.hidden||reduced.matches);
  observer.observe(container);window.addEventListener('resize',invalidate);window.addEventListener('scroll',invalidate,{passive:true});document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',preference);canvas.addEventListener('webglcontextlost',lost);invalidate();
  return dispose;
}
