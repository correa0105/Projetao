import * as THREE from 'three';

/** Filtered natural surfaces: detail fades below pixel size instead of shimmering. */
export function detailAtlasMaterial(
  material: THREE.MeshStandardMaterial,
  kind: 'wood' | 'deck' | 'cloth' | 'skin' | 'scales' | 'membrane',
) {
  const pattern =
    kind === 'wood' || kind === 'deck'
      ? `float grain = atlasNoise(vec3(p.x*65.0,p.y*3.0,p.z*13.0));
       float weather = atlasNoise(p*12.0);
       float board = floor(p.x*${kind === 'deck' ? '17.0' : '13.0'});
       float seam = 1.0-smoothstep(0.015,0.06,abs(fract(p.x*${kind === 'deck' ? '17.0' : '13.0'})-0.5));
       return grain*0.5 + weather*0.3 + atlasHash(vec3(board))*0.2 - seam*0.08;`
      : kind === 'cloth'
        ? `return atlasNoise(p*20.0)*0.55 + atlasNoise(p*65.0)*0.12;`
        : kind === 'scales'
          ? `return atlasNoise(p*18.0)*0.6 + atlasNoise(p*110.0)*0.2;`
          : kind === 'membrane'
            ? `return atlasNoise(p*9.0)*0.7 + atlasNoise(p*32.0)*0.16;`
            : `return atlasNoise(p*9.0)*0.65 + atlasNoise(p*29.0)*0.25 + atlasNoise(p*75.0)*0.10;`;
  const asset =
    kind === 'wood' || kind === 'deck'
      ? 'oak-v1.webp'
      : kind === 'skin'
        ? 'kraken-skin-v1.webp'
        : kind === 'scales'
          ? 'dragon-hide-v2.webp'
          : kind === 'membrane'
            ? 'dragon-wing-v2.webp'
            : undefined;
  if ((kind === 'scales' || kind === 'membrane') && typeof document !== 'undefined') {
    const loader = new THREE.TextureLoader();
    const albedo = loader.load('/atlas-model-materials/' + asset);
    albedo.colorSpace = THREE.SRGBColorSpace;
    const maps = [albedo];
    material.map = albedo;
    if (kind === 'scales') {
      const normal = loader.load('/atlas-model-materials/dragon-hide-normal-v2.png');
      const rough = loader.load('/atlas-model-materials/dragon-hide-roughness-v2.webp');
      material.normalMap = normal;
      material.normalScale.set(0.7, 0.7);
      material.roughnessMap = rough;
      maps.push(normal, rough);
    }
    for (const map of maps) {
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.anisotropy = 8;
      if (kind === 'scales') map.repeat.set(1, 2);
    }
    material.addEventListener('dispose', () => maps.forEach((map) => map.dispose()));
    return;
  }
  const ready = { value: 0 };
  const texture =
    asset && typeof document !== 'undefined'
      ? new THREE.TextureLoader().load('/atlas-model-materials/' + asset, () => {
          ready.value = 1;
        })
      : undefined;
  if (texture) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    material.addEventListener('dispose', () => texture.dispose());
  }
  material.onBeforeCompile = (shader) => {
    if (texture) {
      shader.uniforms.atlasAlbedo = { value: texture };
      shader.uniforms.atlasTextureReady = ready;
    }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vAtlasSurface; varying vec3 vAtlasNormal; varying vec2 vAtlasUV;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvAtlasSurface = position; vAtlasNormal=normal; vAtlasUV=uv;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vAtlasSurface; varying vec3 vAtlasNormal; varying vec2 vAtlasUV;
        ${texture ? 'uniform sampler2D atlasAlbedo; uniform float atlasTextureReady;' : ''}
        float atlasHash(vec3 p) { p=fract(p*0.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z); }
        float atlasNoise(vec3 p) {
          vec3 cell=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          float n=mix(mix(mix(atlasHash(cell),atlasHash(cell+vec3(1,0,0)),f.x),
                          mix(atlasHash(cell+vec3(0,1,0)),atlasHash(cell+vec3(1,1,0)),f.x),f.y),
                      mix(mix(atlasHash(cell+vec3(0,0,1)),atlasHash(cell+vec3(1,0,1)),f.x),
                          mix(atlasHash(cell+vec3(0,1,1)),atlasHash(cell+vec3(1,1,1)),f.x),f.y),f.z);
          return mix(n,0.5,clamp(length(fwidth(p))*0.7,0.0,1.0));
        }
        float atlasSurface(vec3 p) { ${pattern} }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float surface=atlasSurface(vAtlasSurface);
        diffuseColor.rgb *= 0.78+surface*0.36;
        ${
          texture
            ? `vec3 weights=pow(abs(normalize(vAtlasNormal)),vec3(4.0)); weights/=max(dot(weights,vec3(1.0)),0.0001);
        vec3 coords=vAtlasSurface*${kind === 'skin' ? '2.2' : kind === 'scales' ? '2.0' : '2.5'};
        vec3 scanned=texture2D(atlasAlbedo,coords.yz).rgb*weights.x
          +texture2D(atlasAlbedo,coords.xz).rgb*weights.y
          +texture2D(atlasAlbedo,coords.xy).rgb*weights.z;
        ${kind === 'skin' ? 'scanned=texture2D(atlasAlbedo,vAtlasUV*vec2(1.0,2.2)).rgb;' : kind === 'scales' ? 'scanned=texture2D(atlasAlbedo,vAtlasUV*vec2(1.0,2.0)).rgb;' : kind === 'membrane' ? 'scanned=texture2D(atlasAlbedo,vAtlasUV).rgb;' : ''}
        diffuseColor.rgb=mix(diffuseColor.rgb,scanned,atlasTextureReady*0.88);`
            : ''
        }`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor=clamp(roughnessFactor+(atlasSurface(vAtlasSurface)-0.5)*0.13,0.25,1.0);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        vec3 q0=dFdx(-vViewPosition), q1=dFdy(-vViewPosition);
        vec3 s=cross(q1,normal), t=cross(normal,q0);
        float determinant=dot(q0,s);
        float height=(atlasSurface(vAtlasSurface)${texture ? '+dot(scanned,vec3(0.2126,0.7152,0.0722))*atlasTextureReady*0.6' : ''})*${kind === 'skin' ? '0.00065' : kind === 'scales' ? '0.0025' : '0.00018'};
        vec3 gradient=sign(determinant)*(dFdx(height)*s+dFdy(height)*t);
        if(abs(determinant)>1e-10) normal=normalize(abs(determinant)*normal-gradient);`,
      );
  };
  material.customProgramCacheKey = () => 'atlas-textured-v5-' + kind;
}
