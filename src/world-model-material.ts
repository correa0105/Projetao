import * as THREE from 'three';

/** Fine surface relief in model space, lit by the same lights as the atlas. */
export function detailAtlasMaterial(
  material: THREE.MeshStandardMaterial,
  kind: 'wood' | 'deck' | 'cloth' | 'skin' | 'scales' | 'membrane',
) {
  const pattern =
    kind === 'wood' || kind === 'deck'
      ? `float grain = sin(p.y*240.0 + sin(p.x*95.0)*2.0);
       float seam = smoothstep(0.94,0.99,fract(p.x*${kind === 'deck' ? '26.0' : '20.0'}));
       return grain*0.3 - seam;`
      : kind === 'cloth'
        ? `return sin(p.x*900.0)*sin(p.z*900.0)*0.16 + sin(p.x*33.0+p.z*17.0)*sin(p.z*49.0)*0.4;`
        : kind === 'scales'
          ? `vec2 cell = p.xy*95.0; cell.x += mod(floor(cell.y),2.0)*0.5;
           vec2 local = fract(cell)-0.5;
           return smoothstep(0.48,0.24,length(local*vec2(1.0,1.35)));`
          : kind === 'membrane'
            ? `return sin(p.x*53.0 + sin(p.y*19.0))*0.15 + sin(p.y*90.0)*0.08;`
            : `return sin(p.x*47.0+sin(p.z*29.0))*sin(p.y*39.0)*0.65 + sin(p.x*185.0)*sin(p.y*171.0)*0.12;`;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAtlasSurface;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAtlasSurface = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vAtlasSurface;
        float atlasSurface(vec3 p) { ${pattern} }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float surface = atlasSurface(vAtlasSurface);
        diffuseColor.rgb *= 0.94 + surface*0.10;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        // Screen derivatives keep relief continuous across curved, UV-free tentacles.
        vec3 q0 = dFdx(-vViewPosition), q1 = dFdy(-vViewPosition);
        vec3 s = cross(q1,normal), t = cross(normal,q0);
        float determinant = dot(q0,s);
        float height = atlasSurface(vAtlasSurface)*${kind === 'skin' ? '0.0012' : '0.00035'};
        vec3 gradient = sign(determinant)*(dFdx(height)*s+dFdy(height)*t);
        if (abs(determinant) > 1e-10) normal = normalize(abs(determinant)*normal-gradient);`,
      );
  };
  material.customProgramCacheKey = () => 'atlas-surface-v2-' + kind;
}
