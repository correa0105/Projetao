import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { professions } from '../shared/professions';
import { professionTechnique } from '../shared/profession-techniques';
import { professionSurface } from '../src/profession-work-surfaces';
import {
  professionApproachPose,
  professionCyclePose,
  professionRecoveryMs,
} from '../src/profession-cycle';
import { ProfessionClockwork } from '../src/ProfessionClockwork';
const near = (a: number, b: number) => assert(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
test('as 25 ferramentas chegam à peça e terminam cada retorno sem saltar para a passada seguinte', () => {
  for (const p of professions) {
    const t = professionTechnique(p.id),
      s = professionSurface(p.id),
      anchor = { x: s.x, y: s.y },
      approach = professionApproachPose(t.id, 1, anchor, s),
      start = professionCyclePose(t.id, 0, t.duration, anchor, s, 0);
    for (const key of ['x', 'y', 'lift', 'tilt'] as const) near(approach[key], start[key]);
    for (let step = 0; step < 4; step++) {
      const end = professionCyclePose(
          t.id,
          t.duration + professionRecoveryMs,
          t.duration,
          anchor,
          s,
          step,
        ),
        next = professionCyclePose(t.id, 0, t.duration, anchor, s, step + 1);
      for (const key of ['x', 'y', 'lift', 'tilt'] as const) near(end[key], next[key]);
      for (let i = 0; i <= 80; i++)
        assert(
          Object.values(
            professionCyclePose(
              t.id,
              (i / 80) * (t.duration + professionRecoveryMs),
              t.duration,
              anchor,
              s,
              step,
            ),
          ).every(Number.isFinite),
          p.id,
        );
    }
  }
});
test('as duas engrenagens giram em sentidos opostos e a chave permanece apoiada no mesmo eixo', () => {
  const render = (rotation: number) =>
    renderToStaticMarkup(
      createElement(ProfessionClockwork, { rotation, phase: 0.5, working: true, reduced: false }),
    );
  const angles = (s: string) => [...s.matchAll(/data-gear-angle="([^"]+)"/g)].map((m) => +m[1]);
  const before = render(0),
    after = render(60),
    a = angles(before),
    b = angles(after);
  assert.equal(a.length, 2);
  near(b[0] - a[0], 60);
  near(b[1] - a[1], -60);
  for (const attr of ['x', 'y'])
    assert.equal(
      before.match(new RegExp('data-driver-' + attr + '="[^"]+"'))![0],
      after.match(new RegExp('data-driver-' + attr + '="[^"]+"'))![0],
    );
  const reduced = renderToStaticMarkup(
    createElement(ProfessionClockwork, { rotation: 60, phase: 0.5, working: true, reduced: true }),
  );
  assert.deepEqual(angles(reduced), a);
});
