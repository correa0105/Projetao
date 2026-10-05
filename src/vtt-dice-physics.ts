import * as C from 'cannon-es';
import * as THREE from 'three';
/** Use the actual planar faces, including d10 kites, for contact and inertia. */
export function diceHull(geometry: THREE.BufferGeometry, scale: number) {
  const p = geometry.getAttribute('position'),
    vertices: C.Vec3[] = [],
    planes: { normal: THREE.Vector3; indices: Set<number> }[] = [];
  const indices: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const v = new C.Vec3(p.getX(i) * scale, p.getY(i) * scale, p.getZ(i) * scale);
    let id = vertices.findIndex((p) => p.distanceTo(v) < 1e-6);
    if (id < 0) {
      id = vertices.length;
      vertices.push(v);
    }
    indices.push(id);
  }
  for (let i = 0; i < indices.length; i += 3) {
    const ids = indices.slice(i, i + 3),
      a = vertices[ids[0]],
      b = vertices[ids[1]],
      d = vertices[ids[2]],
      normal = new THREE.Vector3(b.x - a.x, b.y - a.y, b.z - a.z)
        .cross(new THREE.Vector3(d.x - a.x, d.y - a.y, d.z - a.z))
        .normalize();
    let plane = planes.find((f) => f.normal.dot(normal) > 0.9999);
    if (!plane) {
      plane = { normal, indices: new Set() };
      planes.push(plane);
    }
    ids.forEach((id) => plane!.indices.add(id));
  }
  const faces = planes.map(({ normal, indices }) => {
    const ids = [...indices],
      center = ids
        .reduce(
          (n, id) => n.add(new THREE.Vector3(vertices[id].x, vertices[id].y, vertices[id].z)),
          new THREE.Vector3(),
        )
        .multiplyScalar(1 / ids.length);
    const u = new THREE.Vector3(vertices[ids[0]].x, vertices[ids[0]].y, vertices[ids[0]].z)
        .sub(center)
        .normalize(),
      v = normal.clone().cross(u);
    return ids.sort((a, b) => {
      const pa = new THREE.Vector3(vertices[a].x, vertices[a].y, vertices[a].z).sub(center),
        pb = new THREE.Vector3(vertices[b].x, vertices[b].y, vertices[b].z).sub(center);
      return Math.atan2(pa.dot(v), pa.dot(u)) - Math.atan2(pb.dot(v), pb.dot(u));
    });
  });
  return new C.ConvexPolyhedron({ vertices, faces });
}
export class DicePhysics {
  readonly world = new C.World({ gravity: new C.Vec3(0, 0, -26), allowSleep: true });
  readonly bodies: C.Body[] = [];
  readonly impacts: { time: number; strength: number }[] = [];
  readonly samples: number[][] = [];
  private lastImpact = -1;
  constructor(
    geometries: THREE.BufferGeometry[],
    readonly width: number,
    readonly height: number,
    readonly scale: number,
    random: () => number = Math.random,
  ) {
    this.world.broadphase = new C.SAPBroadphase(this.world);
    (this.world.solver as C.GSSolver).iterations = 18;
    this.world.defaultContactMaterial.friction = 0.32;
    this.world.defaultContactMaterial.restitution = 0.36;
    this.world.defaultContactMaterial.contactEquationStiffness = 1e8;
    this.world.defaultContactMaterial.contactEquationRelaxation = 3;
    const plane = (position: C.Vec3, axis: C.Vec3, angle: number) => {
      const body = new C.Body({ mass: 0, shape: new C.Plane(), position });
      body.quaternion.setFromAxisAngle(axis, angle);
      this.world.addBody(body);
    };
    plane(new C.Vec3(0, 0, 0), new C.Vec3(1, 0, 0), 0);
    plane(new C.Vec3(-width / 2, 0, 0), new C.Vec3(0, 1, 0), Math.PI / 2);
    plane(new C.Vec3(width / 2, 0, 0), new C.Vec3(0, 1, 0), -Math.PI / 2);
    plane(new C.Vec3(0, -height / 2, 0), new C.Vec3(1, 0, 0), -Math.PI / 2);
    plane(new C.Vec3(0, height / 2, 0), new C.Vec3(1, 0, 0), Math.PI / 2);
    const rows = Math.max(1, Math.floor((height - scale * 3) / (scale * 2.8))),
      cols = Math.min(3, Math.max(1, Math.floor((width - scale * 3) / (scale * 2.8))));
    geometries.forEach((g, i) => {
      const layer = Math.floor(i / (rows * cols)),
        row = Math.floor(i / cols) % rows;
      const x = -width / 2 + scale * 1.6 + (i % cols) * scale * 2.8,
        y = (row - (rows - 1) / 2) * scale * 2.8;
      const body = new C.Body({
        mass: 1,
        shape: diceHull(g, scale),
        position: new C.Vec3(x, y, 3.1 + layer * scale * 3),
        linearDamping: 0.12,
        angularDamping: 0.45,
        sleepSpeedLimit: 0.24,
        sleepTimeLimit: 0.55,
      });
      const axis = new C.Vec3(random() - 0.5, random() - 0.5, random() - 0.5);
      axis.normalize();
      body.quaternion.setFromAxisAngle(axis, random() * Math.PI * 2);
      body.velocity.set(9 + random() * 5, -y * 0.65 + (random() - 0.5) * 4, 1 + random() * 3);
      body.angularVelocity.set((random() - 0.5) * 18, (random() - 0.5) * 18, (random() - 0.5) * 13);
      body.addEventListener('collide', (event: { contact: C.ContactEquation }) => {
        const speed = Math.abs(event.contact.getImpactVelocityAlongNormal());
        if (speed > 1.1 && this.world.time - this.lastImpact > 0.065) {
          this.impacts.push({ time: this.world.time, strength: Math.min(1, speed / 12) });
          this.lastImpact = this.world.time;
        }
      });
      this.world.addBody(body);
      this.bodies.push(body);
    });
    this.record();
  }
  private record() {
    this.samples.push(
      this.bodies.flatMap((b) => [
        b.position.x,
        b.position.y,
        b.position.z,
        b.quaternion.x,
        b.quaternion.y,
        b.quaternion.z,
        b.quaternion.w,
      ]),
    );
  }
  step() {
    this.world.step(1 / 120);
    this.world.step(1 / 120);
    this.record();
  }
  get settled() {
    return this.bodies.every((b) => b.sleepState === C.Body.SLEEPING);
  }
}
