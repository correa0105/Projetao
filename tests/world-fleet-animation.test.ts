import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWorldFleet } from '../src/world-fleet';

test('tentáculos recolhem tábuas e levam a madeira sob a água sem encolher', () => {
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
    const boards = [0, 1, 2, 3, 4, 5].map((i) => {
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

test('retirada não bate na água e termina em até três segundos', () => {
  const fleet = createWorldFleet(() => 0);
  try {
    fleet.update(0);
    for (let t = 0.05; t <= 39.85; t += 0.05) {
      fleet.update(t);
      if (t > 37.1) {
        const splash = fleet.group.getObjectByName('kraken-impact-splash') as THREE.InstancedMesh;
        const matrix = new THREE.Matrix4();
        if (splash.visible)
          for (let i = 0; i < splash.count; i++) {
            splash.getMatrixAt(i, matrix);
            const scale = new THREE.Vector3().setFromMatrixScale(matrix);
            assert.ok(scale.length() < 0.001, 'sem respingos de novas batidas após o naufrágio');
          }
      }
    }
    const kraken = fleet.group.getObjectByName('sea-kraken')!;
    assert.equal(kraken.visible, true);
    for (let i = 0; i < 6; i++) {
      const arm = kraken.getObjectByName(`kraken-tentacle-${i}`) as THREE.Mesh;
      const vertices = arm.geometry.getAttribute('position');
      for (let j = 0; j < vertices.count; j++)
        assert.ok(
          vertices.getZ(j) + kraken.position.z < 0,
          'braço inteiro submerso antes de ocultar',
        );
    }
    fleet.update(39.9);
    fleet.update(39.95);
    fleet.update(40);
    fleet.update(40.05);
    assert.equal(fleet.state.attacking, false);
    assert.equal(kraken.visible, false);
  } finally {
    fleet.dispose();
  }
});
test('todos os braços continuam se dobrando durante a retirada', () => {
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
