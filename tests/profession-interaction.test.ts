import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { professions } from '../shared/professions';
import { professionTechnique, professionTechniques } from '../shared/profession-techniques';
import {
  professionToolArtwork,
  forgeMinimumStrikeIntervalMs,
} from '../shared/profession-production';
import {
  insideSurface,
  professionSurface,
  professionView,
  projectOnSurface,
} from '../src/profession-work-surfaces';
import { techniquePose } from '../src/profession-motion';

test('as 25 profissões possuem técnicas distintas, artes disponíveis e cadência compatível', async () => {
  assert.deepEqual(Object.keys(professionTechniques).sort(), professions.map((p) => p.id).sort());
  assert.equal(new Set(professions.map((p) => professionTechnique(p.id).id)).size, 25);
  for (const p of professions) {
    const t = professionTechnique(p.id);
    assert(t.duration >= forgeMinimumStrikeIntervalMs, p.id);
    await access('public' + professionToolArtwork(t.tool));
  }
  const art = JSON.parse(await readFile('data/professions/techniques-20261115.json', 'utf8'));
  assert.equal(art.assets.filter((a: any) => a.kind === 'bench').length, 5);
  assert.equal(art.assets.filter((a: any) => a.kind === 'tool').length, 6);
});
test('trajetórias distintas mantêm o contato na superfície inclusive junto às bordas', () => {
  const signatures = new Set<string>();
  for (const p of professions) {
    const s = professionSurface(p.id),
      t = professionTechnique(p.id),
      view = professionView(p.id);
    assert(s.x >= view[0] && s.x <= view[0] + view[2]);
    assert(s.y >= view[1] && s.y <= view[1] + view[3]);
    const poses = [];
    for (const anchor of [
      { x: s.x, y: s.y },
      projectOnSurface({ x: s.x + s.rx * 3, y: s.y + s.ry * 3 }, s),
    ])
      for (let i = 0; i <= 50; i++) {
        const pose = techniquePose(t.id, i / 50, anchor, s, 1);
        assert(Object.values(pose).every(Number.isFinite), p.id);
        assert(insideSurface(pose, s), p.id + ' ' + i);
        poses.push([
          pose.x.toFixed(1),
          pose.y.toFixed(1),
          pose.lift.toFixed(1),
          pose.tilt.toFixed(1),
          pose.rotation.toFixed(1),
        ]);
      }
    signatures.add(JSON.stringify(poses));
  }
  assert.equal(signatures.size, 25);
});
test('a sola inclinada usa a mesma geometria no contato e na projeção', () => {
  const s = professionSurface('cobbling'),
    a = (s.angle * Math.PI) / 180;
  assert(
    insideSurface({ x: s.x + Math.cos(a) * s.rx * 0.8, y: s.y + Math.sin(a) * s.rx * 0.8 }, s),
  );
  assert(!insideSurface({ x: s.x, y: s.y + s.ry * 3 }, s));
  for (const p of [
    { x: 0, y: 0 },
    { x: 960, y: 640 },
    { x: 440, y: 380 },
  ])
    assert(insideSurface(projectOnSurface(p, s), s));
});
test('a máscara aceita as duas faces e mantém a ferramenta fora das aberturas', () => {
  const s = professionSurface('disguise');
  assert(insideSurface({ x: 365, y: 335 }, s));
  assert(insideSurface({ x: 585, y: 340 }, s));
  for (const h of s.holes) {
    assert(!insideSurface(h, s));
    assert(insideSurface(projectOnSurface(h, s), s));
  }
});
