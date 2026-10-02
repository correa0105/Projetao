import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorldFleet } from '../src/world-fleet';

test('três tentáculos recolhem tábuas e levam a madeira sob a água sem encolher', () => {
  const fleet = createWorldFleet(() => 0);
  let time = 0;
  const advance = (until: number) => {
    while (time < until - 0.0001) {
      time += 0.05;
      fleet.update(time);
    }
  };
  try {
    fleet.update(0);
    advance(38.65);
    const kraken = fleet.group.getObjectByName('sea-kraken')!;
    const boards = [0, 2, 4].map((i) => {
      const board = kraken.getObjectByName(`wreck-plank-${i}`)!;
      const arm = kraken.getObjectByName(`kraken-tentacle-${i}`) as THREE.Mesh;
      const positions = arm.geometry.getAttribute('position');
      const tip = new THREE.Vector3();
      for (let side = 0; side < 16; side++)
        tip.add(new THREE.Vector3().fromBufferAttribute(positions, 40 * 17 + side));
      tip.divideScalar(16);
      assert.ok(board.position.distanceTo(tip) < 0.025, 'madeira presa à ponta do braço');
      assert.equal(board.visible, true);
      assert.equal(board.scale.x, 1);
      return board;
    });
    const before = boards.map((b) => b.position.clone());
    advance(39.8);
    boards.forEach((board, i) => {
      assert.equal(board.visible, true, 'madeira não desaparece antes do mergulho');
      assert.equal(board.scale.x, 1, 'não reduzir a madeira para simular afundamento');
      assert.ok(board.position.z + kraken.position.z < -0.25, 'madeira levada sob a água');
      assert.ok(board.position.distanceTo(before[i]) > 0.2, 'acompanha a retirada');
    });
    advance(40.1);
    assert.equal(kraken.visible, false);
  } finally {
    fleet.dispose();
  }
});

test('kraken continua batendo braços independentes enquanto submerge após o barco sumir', () => {
  const fleet = createWorldFleet(() => 0);
  let time = 0;
  let destroyedAt: number | undefined, endedAt: number | undefined;
  const advance = (seconds: number) => {
    const end = time + seconds;
    while (time < end - 0.0001) {
      time += 0.05;
      const wasAttacking = fleet.state.attacking;
      fleet.update(time);
      if (
        fleet.state.attacking &&
        !fleet.group.getObjectByName('pirate-ship-0')!.visible &&
        destroyedAt === undefined
      )
        destroyedAt = fleet.state.seconds;
      if (wasAttacking && !fleet.state.attacking) endedAt = fleet.state.seconds;
    }
  };
  try {
    fleet.update(0);
    advance(30.1);
    assert.equal(fleet.state.attacking, true);
    advance(7.5);
    assert.equal(fleet.state.attackPhase, 'submerging');
    const kraken = fleet.group.getObjectByName('sea-kraken')!;
    const ship = fleet.group.getObjectByName('pirate-ship-0')!;
    assert.equal(ship.visible, false);
    const depth = fleet.state.krakenDepth;
    const tips = () =>
      Array.from({ length: 6 }, (_, i) => {
        const arm = kraken.getObjectByName(`kraken-tentacle-${i}`) as THREE.Mesh;
        const vertices = arm.geometry.getAttribute('position');
        return vertices.getZ(vertices.count - 1);
      });
    const armCenters = () =>
      Array.from({ length: 6 }, (_, i) => {
        const arm = kraken.getObjectByName(`kraken-tentacle-${i}`) as THREE.Mesh;
        const vertices = arm.geometry.getAttribute('position');
        return [10, 20, 30, 40].map((row) => {
          const center = new THREE.Vector3();
          for (let side = 0; side < 16; side++)
            center.add(new THREE.Vector3().fromBufferAttribute(vertices, row * 17 + side));
          return center.divideScalar(16);
        });
      });
    const centers = armCenters();
    for (const points of centers) {
      for (let i = 1; i < points.length; i++)
        assert.ok(
          Math.hypot(points[i].x, points[i].y) < Math.hypot(points[i - 1].x, points[i - 1].y),
          'o braço avança para o centro do barco',
        );
      assert.ok(
        Math.hypot(points[3].x, points[3].y) < 0.12,
        'pontas batem na área central do naufrágio',
      );
    }
    assert.ok(
      centers.some(
        (points) => points[1].distanceTo(points[0].clone().lerp(points[3], 1 / 3)) > 0.12,
      ),
      'os braços erguidos formam arcos flexíveis',
    );
    const before = tips();
    advance(0.3);
    const midDeltas = armCenters().map((points, i) => points[1].z - centers[i][1].z);
    assert.ok(
      midDeltas.filter((d) => Math.abs(d) > 0.04).length >= 3,
      'movimento amplo também no meio dos braços',
    );
    const deltas = tips().map((tip, i) => tip - before[i]);
    assert.ok(
      deltas.some((d) => d > 0.01),
      'um braço se ergue',
    );
    assert.ok(
      deltas.some((d) => d < -0.01),
      'outro bate na água simultaneamente',
    );
    assert.ok(fleet.state.krakenDepth < depth, 'corpo afunda progressivamente');
    const armTops = () =>
      Array.from({ length: 6 }, (_, i) => {
        const arm = kraken.getObjectByName(`kraken-tentacle-${i}`) as THREE.Mesh;
        const vertices = arm.geometry.getAttribute('position');
        let top = -Infinity;
        for (let j = 0; j < vertices.count; j++)
          top = Math.max(top, vertices.getZ(j) + kraken.position.z);
        return top;
      });
    advance(1.3);
    const retiring = armTops();
    assert.ok(
      retiring.some((z) => z < 0) && retiring.some((z) => z > 0),
      'braços afundam em momentos diferentes',
    );
    assert.equal(fleet.group.getObjectByName('kraken-retreat-wash')!.visible, true);
    advance(0.6);
    assert.ok(
      armTops().every((z) => z < 0),
      'todos ficam sob a água antes de esconder o modelo',
    );
    assert.equal(kraken.visible, true);
    advance(0.3);
    assert.equal(fleet.state.attacking, false);
    assert.equal(kraken.visible, false);
    assert.ok(
      destroyedAt !== undefined && endedAt !== undefined && endedAt - destroyedAt <= 3.05,
      'sequência termina em até 3s após a destruição, com tolerância de um frame do teste',
    );
  } finally {
    fleet.dispose();
  }
});

test('todos os braços continuam se desdobrando durante as batidas caóticas', () => {
  const fleet = createWorldFleet(() => 0);
  const sample = () =>
    Array.from({ length: 6 }, (_, i) => {
      const mesh = fleet.group.getObjectByName(`kraken-tentacle-${i}`) as THREE.Mesh;
      const p = mesh.geometry.getAttribute('position');
      return [16, 28].map((row) => {
        const point = new THREE.Vector3();
        for (let side = 0; side < 16; side++)
          point.add(new THREE.Vector3().fromBufferAttribute(p, row * 17 + side));
        point.divideScalar(16);
        point.z += mesh.parent!.position.z;
        return point;
      });
    });
  try {
    fleet.update(0);
    for (let t = 0.05; t <= 37.01; t += 0.05) fleet.update(t);
    let before = sample();
    for (let frame = 0; frame < 18; frame++) {
      const start = 37 + frame * 0.1;
      fleet.update(start + 0.05);
      fleet.update(start + 0.1);
      const after = sample();
      for (let arm = 0; arm < 6; arm++)
        assert.ok(
          Math.max(...after[arm].map((p, j) => p.distanceTo(before[arm][j]))) > 0.003,
          `braço ${arm + 1} permanece em movimento no intervalo ${frame}`,
        );
      before = after;
    }
  } finally {
    fleet.dispose();
  }
});
