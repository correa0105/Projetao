import * as THREE from 'three';

type LakeOrigin = { x: number; y: number };

/** Reflection, wet contact, churn and spray live on the original painted water
 * plane. Their parent inherits the existing scene's exact shake and cover. */
export function createGinnaLakeEffects(
  tentacleGeometry: THREE.BufferGeometry,
  skin: THREE.Texture,
  origin: LakeOrigin,
) {
  const age = { value: 0 };
  const waterHeight = 941 - origin.y;
  const group = new THREE.Group();
  const reflectionMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    uniforms: { age, skin: { value: skin }, waterHeight: { value: waterHeight } },
    vertexShader: `varying vec2 vReflectionUV; varying float vHeight; varying float vAcross;
      uniform float age; uniform float waterHeight;
      void main() {
        vReflectionUV=uv; vHeight=position.y-waterHeight; vAcross=position.x;
        vec3 p=position;
        p.x+=sin(vHeight*0.35-age*3.2)*2.2+sin(vHeight*0.91+age*2.0)*1.0;
        p.y=waterHeight-vHeight*0.24;
        p.z=11.0;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
      }`,
    fragmentShader: `varying vec2 vReflectionUV; varying float vHeight; varying float vAcross;
      uniform float age; uniform sampler2D skin;
      void main() {
        if(vHeight<0.0 || vHeight>132.0) discard;
        float grain=dot(texture2D(skin,vReflectionUV).rgb,vec3(0.2126,0.7152,0.0722));
        float broken=0.56+0.44*smoothstep(-0.5,0.55,sin(vHeight*0.73+age*2.8+sin(vAcross*0.28)));
        float fade=smoothstep(0.0,8.0,vHeight)*(1.0-smoothstep(24.0,132.0,vHeight));
        float onset=smoothstep(0.0,0.2,age);
        gl_FragColor=vec4(vec3(0.0015,0.0023,0.003)+grain*0.006,fade*broken*onset*0.46);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const reflection = new THREE.Mesh(tentacleGeometry, reflectionMaterial);
  reflection.renderOrder = 1;
  reflection.frustumCulled = false;
  group.add(reflection);

  const surfaceGeometry = new THREE.PlaneGeometry(260, 104);
  const surfaceMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      age,
      crestColor: { value: new THREE.Color('#626c71') },
      mistColor: { value: new THREE.Color('#586268') },
    },
    vertexShader: `varying vec2 vLakeUV;
      void main() { vLakeUV=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vLakeUV;
      uniform float age; uniform vec3 crestColor; uniform vec3 mistColor;
      float lakeHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float lakeNoise(vec2 p) {
        vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(lakeHash(i),lakeHash(i+vec2(1.0,0.0)),f.x),
          mix(lakeHash(i+vec2(0.0,1.0)),lakeHash(i+vec2(1.0)),f.x),f.y);
      }
      void coat(inout vec4 result,vec3 color,float alpha) {
        float a=clamp(alpha,0.0,1.0)*(1.0-result.a);
        result.rgb+=color*a; result.a+=a;
      }
      void main() {
        vec2 p=(vLakeUV-0.5)*vec2(260.0,104.0);
        float angle=atan(p.y/0.18,p.x);
        float radial=length(vec2(p.x,p.y/0.18));
        float antialias=max(fwidth(radial)*0.65,0.8);
        float onset=smoothstep(0.0,0.18,age);
        vec4 result=vec4(0.0);
        float well=exp(-dot(p/vec2(26.0,5.5),p/vec2(26.0,5.5)));
        coat(result,crestColor*0.13,well*onset*0.17);
        float crest=0.0;
        for(int i=0;i<4;i++) {
          float time=(age-float(i)*0.24)/1.85;
          if(time<0.0 || time>=1.0) continue;
          float radius=11.0+time*79.0;
          float irregular=sin(angle*7.0+float(i)*1.4+age*0.4)*1.6+sin(angle*13.0-age*0.5)*0.8
            +sin(angle*3.0+float(i))*radius*0.024;
          float edge=1.0-smoothstep(0.5,1.2+antialias,abs(radial-radius-irregular));
          float wetPatch=lakeNoise(vec2(sin(angle)*5.0+float(i)*3.4,cos(angle)*5.0+age*0.23));
          float broken=smoothstep(0.19,0.76,wetPatch)*(0.23+0.77*pow(0.5+0.5*sin(angle*19.0+float(i)*2.8),2.0));
          crest=max(crest,edge*broken*(1.0-smoothstep(0.65,1.0,time)));
        }
        coat(result,crestColor,crest*onset*0.34);
        float contact=length(vec2(p.x/20.0,p.y/3.8));
        float choppy=lakeNoise(p*vec2(0.37,1.4)+vec2(age*0.8,-age*0.32));
        float lip=exp(-pow((contact-1.0-choppy*0.1)/0.2,2.0));
        float front=1.0-smoothstep(-1.0,1.5,p.y);
        float foam=lip*smoothstep(0.23,0.77,choppy)*(0.23+0.23*front)*onset;
        coat(result,crestColor*1.1,foam);
        float meniscus=exp(-pow((contact-0.86-choppy*0.07)/0.13,2.0));
        coat(result,crestColor*0.75,meniscus*(0.07+front*0.13)*onset);
        float spray=0.0;
        for(int i=0;i<8;i++) {
          float index=float(i);
          float flight=fract(age*0.87-index*0.113);
          float side=mod(index,2.0)<1.0?-1.0:1.0;
          vec2 drop=vec2(side*(14.0+flight*(12.0+index*1.1)),
            1.0+sin(flight*3.14159)*(4.0+mod(index,3.0)*2.1));
          float dotMask=1.0-smoothstep(0.25,1.0,length((p-drop)/vec2(0.8,1.15)));
          spray=max(spray,dotMask*sin(flight*3.14159));
        }
        coat(result,crestColor*1.08,spray*onset*(1.0-smoothstep(1.2,2.8,age))*0.33);
        vec2 haze=p-vec2(sin(age*0.6)*3.0,6.0);
        float mist=exp(-dot(haze/vec2(46.0,12.0),haze/vec2(46.0,12.0)));
        float billow=lakeNoise(haze*0.08+vec2(age*0.15,-age*0.04));
        coat(result,mistColor,mist*(0.055+billow*0.075)*onset);
        vec2 collar=p-vec2(0.0,2.0);
        float lapping=exp(-dot(collar/vec2(25.0,4.2),collar/vec2(25.0,4.2)));
        coat(result,mistColor,lapping*(0.1+choppy*0.09)*onset);
        gl_FragColor=vec4(result.rgb/max(result.a,0.001),result.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  surface.position.set(origin.x, waterHeight, 17);
  surface.renderOrder = 2;
  surface.frustumCulled = false;
  group.add(surface);
  return {
    group,
    age,
    update: (milliseconds: number) => {
      age.value = milliseconds / 1000;
    },
    dispose: () => {
      // The shared tentacle geometry and skin remain owned by their renderer.
      reflectionMaterial.dispose();
      surfaceMaterial.dispose();
      surfaceGeometry.dispose();
    },
  };
}

/** Contact cues for the same painted water plane when WebGL is unavailable. */
export function drawGinnaLakeContact2D(
  context: CanvasRenderingContext2D,
  origin: LakeOrigin,
  milliseconds: number,
  sampleTentacle: (t: number) => { x: number; y: number },
  progress: number,
) {
  const age = milliseconds / 1000;
  const onset = Math.min(1, age / 0.18);
  context.save();
  context.translate(origin.x, origin.y);
  context.save();
  context.beginPath();
  context.rect(-100, 0, 200, 33);
  context.clip();
  for (let i = 0; i < 45; i++) {
    const a = sampleTentacle((i / 45) * progress);
    const b = sampleTentacle(((i + 1) / 45) * progress);
    const above = origin.y - a.y;
    if (above < 0 || above > 132) continue;
    context.beginPath();
    context.moveTo(a.x - origin.x + Math.sin(above * 0.35 - age * 3.2) * 1.6, above * 0.24);
    context.lineTo(
      b.x - origin.x + Math.sin((origin.y - b.y) * 0.35 - age * 3.2) * 1.6,
      (origin.y - b.y) * 0.24,
    );
    context.strokeStyle = `rgba(16,23,28,${onset * (1 - above / 132) * 0.23})`;
    context.lineWidth = (1 - i / 45) * 30;
    context.stroke();
  }
  context.restore();
  const haze = context.createRadialGradient(0, -6, 1, 0, -6, 46);
  haze.addColorStop(0, `rgba(88,98,104,${onset * 0.11})`);
  haze.addColorStop(1, 'rgba(88,98,104,0)');
  context.save();
  context.scale(1, 0.28);
  context.fillStyle = haze;
  context.fillRect(-55, -60, 110, 120);
  context.restore();
  context.beginPath();
  context.ellipse(0, 0, 20, 3.8, 0, 0, Math.PI);
  context.strokeStyle = `rgba(100,112,118,${onset * 0.28})`;
  context.lineWidth = 1.1;
  context.setLineDash([2.8, 1.7, 1.2, 2.2]);
  context.stroke();
  context.setLineDash([]);
  for (let i = 0; i < 8; i++) {
    const flight = (((age * 0.87 - i * 0.113) % 1) + 1) % 1;
    const side = i % 2 ? -1 : 1;
    const x = side * (14 + flight * (12 + i * 1.1));
    const y = -(1 + Math.sin(flight * Math.PI) * (4 + (i % 3) * 2.1));
    const alpha = onset * Math.sin(flight * Math.PI) * Math.max(0, 1 - (age - 1.2) / 1.6) * 0.3;
    context.fillStyle = `rgba(100,112,118,${alpha})`;
    context.beginPath();
    context.ellipse(x, y, 0.7, 1, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}
