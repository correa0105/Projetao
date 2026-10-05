import * as THREE from 'three';
type Face = { center: THREE.Vector3; normal: THREE.Vector3 };
// A pentagonal trapezohedron: ten planar kite faces, rather than a generic sphere.
export function d10Geometry() {
  const ring = Array.from(
    { length: 10 },
    (_, i) =>
      new THREE.Vector3(
        Math.cos((i * Math.PI) / 5),
        Math.sin((i * Math.PI) / 5),
        i % 2 ? -0.12 : 0.12,
      ),
  );
  const h = (0.12 * (1 + Math.cos(Math.PI / 5))) / (1 - Math.cos(Math.PI / 5));
  const points = [...ring, new THREE.Vector3(0, 0, h), new THREE.Vector3(0, 0, -h)];
  const faces: Face[] = [],
    positions: number[] = [];
  for (let i = 0; i < 5; i++)
    for (const ids of [
      [10, i * 2, (i * 2 + 1) % 10, (i * 2 + 2) % 10],
      [11, (i * 2 + 1) % 10, (i * 2 + 2) % 10, (i * 2 + 3) % 10],
    ]) {
      const vs = ids.map((id) => points[id]);
      const center = vs.reduce((v, p) => v.add(p), new THREE.Vector3()).multiplyScalar(0.25);
      const normal = new THREE.Vector3()
        .subVectors(vs[1], vs[0])
        .cross(new THREE.Vector3().subVectors(vs[2], vs[0]))
        .normalize();
      if (normal.dot(center) < 0) {
        vs.reverse();
        normal.negate();
      }
      for (const tri of [
        [0, 1, 2],
        [0, 2, 3],
      ])
        for (const id of tri) positions.push(...vs[id].toArray());
      faces.push({ center, normal });
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return { geometry, faces };
}
export function shape(sides: number) {
  if (sides === 10) return d10Geometry();
  const geo =
    sides === 4
      ? new THREE.TetrahedronGeometry(1)
      : sides === 6
        ? new THREE.BoxGeometry(1.45, 1.45, 1.45)
        : sides === 8
          ? new THREE.OctahedronGeometry(1)
          : sides === 12
            ? new THREE.DodecahedronGeometry(1)
            : new THREE.IcosahedronGeometry(1);
  const geometry = geo.index ? geo.toNonIndexed() : geo;
  if (geometry !== geo) geo.dispose();
  const p = geometry.getAttribute('position'),
    faces: Face[] = [];
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i),
      b = new THREE.Vector3().fromBufferAttribute(p, i + 1),
      c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const center = a
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);
    const existing = faces.find((f) => f.normal.dot(normal) > 0.9999);
    if (existing) existing.center.add(center);
    else faces.push({ normal, center });
  }
  // Box and dodecahedron faces consist of multiple coplanar triangles.
  const tris = p.count / 3 / faces.length;
  faces.forEach((f) => f.center.multiplyScalar(1 / tris));
  return { geometry, faces };
}
