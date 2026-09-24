import * as THREE from 'three';

const UNITS_PER_THREE_UNIT = 1000;

/** The regional ground uses the same lit, real geometry approach as the world.
 * The sprites remain a separate eight-direction Canvas layer above it. */
export function createKingdomRelief(
  ground: HTMLImageElement,
  mapWidth: number,
  mapHeight: number,
  coastMask?: HTMLImageElement,
) {
  const width = mapWidth / UNITS_PER_THREE_UNIT;
  const height = mapHeight / UNITS_PER_THREE_UNIT;
  const texture = new THREE.Texture(ground);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  const columns = coastMask ? 256 : 1;
  const rows = coastMask ? 128 : 1;
  const geometry = new THREE.PlaneGeometry(width, height, columns, rows);
  const maskCanvas = coastMask ? document.createElement('canvas') : null;
  let maskPixels: Uint8ClampedArray | null = null;
  let coastDistance: Float32Array | null = null;
  if (coastMask && maskCanvas) {
    maskCanvas.width = coastMask.naturalWidth;
    maskCanvas.height = coastMask.naturalHeight;
    const context = maskCanvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Não foi possível preparar a máscara da costa.');
    context.drawImage(coastMask, 0, 0);
    maskPixels = context.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
    const maskWidth = maskCanvas.width;
    const maskHeight = maskCanvas.height;
    coastDistance = new Float32Array(maskWidth * maskHeight);
    for (let y = 0; y < maskHeight; y++) {
      for (let x = 0; x < maskWidth; x++) {
        const index = y * maskWidth + x;
        coastDistance[index] = maskPixels[index * 4] < 128 ? 0 : 10000;
      }
    }
    for (let y = 0; y < maskHeight; y++) {
      for (let x = 0; x < maskWidth; x++) {
        const index = y * maskWidth + x;
        if (x) coastDistance[index] = Math.min(coastDistance[index], coastDistance[index - 1] + 1);
        if (y)
          coastDistance[index] = Math.min(
            coastDistance[index],
            coastDistance[index - maskWidth] + 1,
          );
        if (x && y)
          coastDistance[index] = Math.min(
            coastDistance[index],
            coastDistance[index - maskWidth - 1] + 1.414,
          );
        if (x + 1 < maskWidth && y)
          coastDistance[index] = Math.min(
            coastDistance[index],
            coastDistance[index - maskWidth + 1] + 1.414,
          );
      }
    }
    for (let y = maskHeight - 1; y >= 0; y--) {
      for (let x = maskWidth - 1; x >= 0; x--) {
        const index = y * maskWidth + x;
        if (x + 1 < maskWidth)
          coastDistance[index] = Math.min(coastDistance[index], coastDistance[index + 1] + 1);
        if (y + 1 < maskHeight)
          coastDistance[index] = Math.min(
            coastDistance[index],
            coastDistance[index + maskWidth] + 1,
          );
        if (x + 1 < maskWidth && y + 1 < maskHeight)
          coastDistance[index] = Math.min(
            coastDistance[index],
            coastDistance[index + maskWidth + 1] + 1.414,
          );
        if (x && y + 1 < maskHeight)
          coastDistance[index] = Math.min(
            coastDistance[index],
            coastDistance[index + maskWidth - 1] + 1.414,
          );
      }
    }
  }
  const landAt = (u: number, v: number) => {
    if (!maskPixels || !maskCanvas) return 1;
    const x = Math.max(0, Math.min(maskCanvas.width - 1, Math.round(u * (maskCanvas.width - 1))));
    const y = Math.max(0, Math.min(maskCanvas.height - 1, Math.round(v * (maskCanvas.height - 1))));
    return maskPixels[(y * maskCanvas.width + x) * 4] / 255;
  };
  const shoreDistanceAt = (u: number, v: number) => {
    if (!coastDistance || !maskCanvas) return 0;
    const x = Math.max(0, Math.min(maskCanvas.width - 1, Math.round(u * (maskCanvas.width - 1))));
    const y = Math.max(0, Math.min(maskCanvas.height - 1, Math.round(v * (maskCanvas.height - 1))));
    return coastDistance[y * maskCanvas.width + x];
  };
  if (coastMask) {
    const position = geometry.attributes.position;
    const uv = geometry.attributes.uv;
    for (let index = 0; index < position.count; index++) {
      const u = uv.getX(index);
      const v = 1 - uv.getY(index);
      const land = THREE.MathUtils.smoothstep(landAt(u, v), 0.18, 0.86);
      const inland = THREE.MathUtils.smoothstep(shoreDistanceAt(u, v), 0, 68);
      const x = position.getX(index);
      const y = position.getY(index);
      const broad = Math.sin(x * 0.92 + Math.sin(y * 0.71) * 0.7) * 0.5 + 0.5;
      const fine = Math.sin(x * 2.8 + y * 1.4) * Math.sin(y * 2.5 - x * 0.8) * 0.5 + 0.5;
      position.setZ(index, -0.015 + land * inland * (0.035 + broad * 0.055 + fine * 0.019));
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  }
  const heights = geometry.attributes.position;
  const heightAt = (mapX: number, mapY: number) => {
    if (!coastMask) return 0;
    const gx = THREE.MathUtils.clamp((mapX / mapWidth + 0.5) * columns, 0, columns);
    const gy = THREE.MathUtils.clamp((mapY / mapHeight + 0.5) * rows, 0, rows);
    const ix = Math.min(columns - 1, Math.floor(gx));
    const iy = Math.min(rows - 1, Math.floor(gy));
    const fx = gx - ix;
    const fy = gy - iy;
    const a = heights.getZ(iy * (columns + 1) + ix);
    const b = heights.getZ(iy * (columns + 1) + ix + 1);
    const c = heights.getZ((iy + 1) * (columns + 1) + ix);
    const d = heights.getZ((iy + 1) * (columns + 1) + ix + 1);
    return (
      THREE.MathUtils.lerp(THREE.MathUtils.lerp(a, b, fx), THREE.MathUtils.lerp(c, d, fx), fy) *
      UNITS_PER_THREE_UNIT
    );
  };
  const material = coastMask
    ? new THREE.MeshStandardMaterial({ map: texture, roughness: 0.97, metalness: 0 })
    : new THREE.MeshBasicMaterial({ map: texture });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = coastMask ? 'kingdom-coastal-relief' : 'kingdom-private-flat-ground';
  const group = new THREE.Group();
  group.add(mesh);

  let waterGeometry: THREE.PlaneGeometry | null = null;
  let waterTexture: THREE.CanvasTexture | null = null;
  let waterMaterial: THREE.MeshStandardMaterial | null = null;
  if (maskCanvas) {
    const context = maskCanvas.getContext('2d', { willReadFrequently: true })!;
    const inverted = context.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    for (let pixel = 0; pixel < inverted.data.length; pixel += 4) {
      const water = 255 - inverted.data[pixel];
      inverted.data[pixel] = water;
      inverted.data[pixel + 1] = water;
      inverted.data[pixel + 2] = water;
      inverted.data[pixel + 3] = 255;
    }
    context.putImageData(inverted, 0, 0);
    waterTexture = new THREE.CanvasTexture(maskCanvas);
    waterTexture.needsUpdate = true;
    waterGeometry = new THREE.PlaneGeometry(width, height);
    waterMaterial = new THREE.MeshStandardMaterial({
      color: '#718c91',
      alphaMap: waterTexture,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      roughness: 0.61,
      metalness: 0.04,
    });
    const water = new THREE.Mesh(waterGeometry, waterMaterial);
    water.position.z = -0.012;
    water.name = 'kingdom-coastal-water';
    group.add(water);
  }
  return {
    group,
    vertexCount: geometry.attributes.position.count,
    heightAt,
    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
      waterGeometry?.dispose();
      waterMaterial?.dispose();
      waterTexture?.dispose();
    },
  };
}
