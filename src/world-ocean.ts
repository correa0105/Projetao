import * as THREE from 'three';
import { WORLD_ISLETS } from './world-offshore';

/** Continuous per-fragment bathymetry: no vertex-color grid or crossed wave lattice. */
export function createWorldOcean(
  shore: Float32Array,
  nx: number,
  ny: number,
  time: { value: number },
) {
  const data = Uint16Array.from(shore, (distance) => THREE.DataUtils.toHalfFloat(-distance));
  const coast = new THREE.DataTexture(data, nx + 1, ny + 1, THREE.RedFormat, THREE.HalfFloatType);
  coast.minFilter = coast.magFilter = THREE.LinearFilter;
  coast.generateMipmaps = false;
  coast.needsUpdate = true;
  const islands = [
    ...WORLD_ISLETS.map(
      ([x, y, r, h]) => new THREE.Vector3(x, y, r * (1 - (0.06 / h) ** (1 / 1.7))),
    ),
  ];
  const material = new THREE.MeshStandardMaterial({
    roughness: 0.38,
    metalness: 0,
    dithering: true,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.oceanTime = time;
    shader.uniforms.oceanCoast = { value: coast };
    shader.uniforms.oceanIslands = { value: islands };
    shader.uniforms.oceanDeep = { value: new THREE.Color('#082b45') };
    shader.uniforms.oceanShelf = { value: new THREE.Color('#195e79') };
    shader.uniforms.oceanShallow = { value: new THREE.Color('#398f96') };
    shader.vertexShader = 'varying vec2 oceanPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\noceanPosition = position.xy;',
    );
    shader.fragmentShader =
      /* glsl */ `
      varying vec2 oceanPosition;
      uniform float oceanTime;
      uniform sampler2D oceanCoast;
      uniform vec3 oceanIslands[${islands.length}];
      uniform vec3 oceanDeep, oceanShelf, oceanShallow;
      float seaHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float seaNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f*f*f*(f*(f*6.0-15.0)+10.0);
        return mix(mix(seaHash(i), seaHash(i+vec2(1,0)), f.x),
          mix(seaHash(i+vec2(0,1)), seaHash(i+vec2(1,1)), f.x), f.y);
      }
      float seaFbm(vec2 p) {
        float n=0.0, amp=0.57;
        for(int i=0;i<3;i++) {
          n += seaNoise(p)*amp;
          p = mat2(1.62, 1.19, -1.19, 1.62)*p+vec2(13.7, 5.3);
          amp *= 0.47;
        }
        return n;
      }
      float shoreDistance(vec2 p) {
        vec2 uv=vec2(p.x/36.0+0.5, 0.5-p.y/20.25);
        vec2 bounded=clamp(uv,0.0,1.0);
        vec2 texelUv=(bounded*vec2(${nx.toFixed(1)},${ny.toFixed(1)})+0.5)/vec2(${(nx + 1).toFixed(1)},${(ny + 1).toFixed(1)});
        float d=texture2D(oceanCoast,texelUv).r;
        d=max(d,0.0)+length((uv-bounded)*vec2(36.0,20.25));
        for(int i=0;i<${islands.length};i++) {
          vec2 delta=(p-oceanIslands[i].xy)/vec2(1.0,0.8);
          float a=atan(delta.y,delta.x);
          float coastShape=1.0+0.13*sin(a*3.0+oceanIslands[i].x)+0.06*sin(a*7.0+oceanIslands[i].y);
          d=min(d,(length(delta)-oceanIslands[i].z*coastShape)*0.85);
        }
        return max(d,0.0);
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      /* glsl */ `
      #include <color_fragment>
      float offshore=shoreDistance(oceanPosition);
      float seabed=seaFbm(oceanPosition*0.72+seaFbm(oceanPosition*0.19)*2.6);
      float shelfWidth=mix(0.3,1.25,smoothstep(0.2,0.78,seabed));
      float shelf=exp(-pow(offshore/shelfWidth,1.18));
      float shallows=exp(-offshore/(0.13+seabed*0.3));
      diffuseColor.rgb=mix(oceanDeep,oceanShelf,shelf*0.85);
      diffuseColor.rgb=mix(diffuseColor.rgb,oceanShallow,shallows*(0.48+seabed*0.24));
      diffuseColor.rgb *= 0.97+seaFbm(oceanPosition*0.23)*0.06;
      float seconds=oceanTime*0.001;
      vec2 drift=vec2(seconds*0.065,seconds*0.032);
      vec2 swellWarp=vec2(seaFbm(oceanPosition*0.51-drift),seaFbm(oceanPosition*0.43+7.1-drift));
      float swell=seaFbm(oceanPosition*1.45+swellWarp*2.8-drift);
      float ripples=seaFbm(oceanPosition*5.2+swellWarp*3.4-drift*1.6);
      float capillary=seaFbm(oceanPosition*12.0+swellWarp*4.0-drift*2.2);
      float waterHeight=swell*0.034+ ripples*0.005+capillary*0.0015;
      float breakers=seaFbm(oceanPosition*14.0+swellWarp*4.0-drift*2.0);
      float foam=smoothstep(0.49,0.73,breakers)*exp(-offshore/0.075)
        *smoothstep(0.24,0.68,ripples);
      // Wind-driven swells alter the lit water normal, without drawing coastline
      // contours in white. Only small broken patches remain at the waterline.
      float windSwell=sin(dot(oceanPosition,vec2(2.8,1.1))-seconds*0.65+swellWarp.x*1.8);
      float crossingSwell=sin(dot(oceanPosition,vec2(-1.3,3.4))-seconds*0.43+swellWarp.y*1.4);
      waterHeight+=(windSwell*0.011+crossingSwell*0.003)
        *(0.35+0.65*smoothstep(0.02,0.32,offshore));
      // Soft moving turquoise light on shallow water; it follows surface flow,
      // never the continent outline. Fine normals carry the small reflections.
      float movingLight=smoothstep(0.45,0.67,ripples)*smoothstep(0.36,0.64,capillary);
      diffuseColor.rgb*=0.96+swell*0.07;
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.03,1.16,1.18),
        movingLight*(0.18+shelf*0.36));
      foam*=0.16*smoothstep(0.0,0.016,offshore);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.38,0.62,0.64),foam);
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+(ripples-0.45)*0.14,0.29,0.49);',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      /* glsl */ `
      #include <normal_fragment_maps>
      vec3 seaDx=dFdx(-vViewPosition), seaDy=dFdy(-vViewPosition);
      vec3 seaBx=cross(seaDy,normal), seaBy=cross(normal,seaDx);
      float seaDet=dot(seaDx,seaBx);
      normal=normalize(abs(seaDet)*normal-sign(seaDet)*
        (dFdx(waterHeight)*seaBx+dFdy(waterHeight)*seaBy));
    `,
    );
  };
  material.customProgramCacheKey = () => 'world-ocean-bathymetry-v6-flowing-light';
  // All detail is shaded continuously; a single plane cannot expose colored mesh cells.
  const geometry = new THREE.PlaneGeometry(240, 200);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'world-continuous-ocean';
  return {
    mesh,
    dispose() {
      coast.dispose();
      material.dispose();
      geometry.dispose();
    },
  };
}
