import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newScene, newToken, orderedTokens, tokenSchema } from '../shared/vtt';
import { reorderVttItems } from '../shared/vtt-stacking';
import { tokenAt } from '../src/vtt-canvas';
import { randomUUID } from 'node:crypto';
const ids = Object.fromEntries(
  ['a', 'b', 'c', 'd', 'base', 'rider', 'other'].map((name) => [name, randomUUID()]),
);
const chosen = (names: string[]) => names.map((name) => ids[name]);
const scene = () => {
  const s = newScene(randomUUID());
  s.tokens = ['a', 'b', 'c', 'd'].map((id, i) => ({
    ...newToken(ids[id], s),
    name: id,
    layer: 'map' as const,
    level: i,
    x: 100,
    y: 100,
    width: 80,
    height: 80,
  }));
  return s;
};
const order = (s: ReturnType<typeof scene>) => orderedTokens(s.tokens).map((t) => t.name);
test('layer actions reorder overlaps, preserve group order and agree with pointer selection', () => {
  const s = scene();
  reorderVttItems(s.tokens, chosen(['a']), 'front');
  assert.deepEqual(order(s), ['b', 'c', 'd', 'a']);
  assert.equal(tokenAt({ x: 100, y: 100 }, s, 'map', true)?.name, 'a');
  reorderVttItems(s.tokens, chosen(['a']), 'down');
  assert.deepEqual(order(s), ['b', 'c', 'a', 'd']);
  reorderVttItems(s.tokens, chosen(['a', 'c']), 'back');
  assert.deepEqual(order(s), ['c', 'a', 'b', 'd']);
  reorderVttItems(s.tokens, chosen(['a', 'c']), 'up');
  assert.deepEqual(order(s), ['b', 'c', 'a', 'd']);
});
test('reordering preserves linked branches, hidden flags, controllers and other layers', () => {
  const s = scene();
  const base = { ...newToken(ids.base, s), name: 'base', level: 0 },
    rider = {
      ...newToken(ids.rider, s),
      name: 'rider',
      controller: 'player',
      hidden: true,
      attachment: { tokenId: ids.base, offsetX: 0, offsetY: 0 },
      level: 0,
    };
  const other = { ...newToken(ids.other, s), name: 'other', level: 1 };
  s.tokens.push(base, rider, other);
  const map = JSON.stringify(s.tokens.slice(0, 4));
  reorderVttItems(s.tokens, chosen(['rider']), 'front');
  assert.deepEqual(
    orderedTokens(s.tokens)
      .slice(-3)
      .map((t) => t.name),
    ['other', 'base', 'rider'],
  );
  assert.equal(JSON.stringify(s.tokens.slice(0, 4)), map);
  assert.equal(rider.controller, 'player');
  assert.equal(rider.hidden, true);
  assert.equal(rider.attachment.tokenId, ids.base);
});
test('extreme and tied depths remain valid and repeated front operations preserve values', () => {
  const s = scene();
  s.tokens.forEach((t) => (t.level = 10000));
  reorderVttItems(s.tokens, chosen(['a']), 'front');
  assert.deepEqual(order(s), ['b', 'c', 'd', 'a']);
  s.tokens.forEach((t) => tokenSchema.parse(t));
  const before = JSON.stringify(s.tokens);
  reorderVttItems(s.tokens, chosen(['a']), 'front');
  assert.equal(JSON.stringify(s.tokens), before);
});
