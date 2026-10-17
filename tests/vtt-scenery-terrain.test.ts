import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { newDocument, newToken, documentSchema, terrainStrokeSchema } from '../shared/vtt';
import { convertSceneryToToken } from '../shared/vtt-scenery-token';
import {
  syncAttachmentPositions,
  translateAttachmentGroup,
  attachmentError,
} from '../shared/vtt-attachments';
import { canopyActor } from '../shared/vtt-canopies';
import { terrainTextures } from '../shared/vtt-terrain';

test('only the placed scenery instance becomes a token, retains its artwork and has no creature behavior', () => {
  const doc = newDocument(randomUUID()),
    s = doc.scenes[0];
  const wagon = {
    ...newToken(randomUUID(), s),
    layer: 'map' as const,
    image: '/vtt/wagon.webp',
    width: 190,
    height: 85,
    x: 300,
    y: 200,
  };
  const other = { ...structuredClone(wagon), id: randomUUID() };
  s.tokens = [wagon, other];
  assert(convertSceneryToToken(wagon));
  const saved = documentSchema.parse(doc).scenes[0];
  assert.equal(saved.tokens[0].layer, 'tokens');
  assert.equal(saved.tokens[0].sceneryToken, true);
  assert.equal(saved.tokens[0].width, 190);
  assert.equal(saved.tokens[0].image, other.image);
  assert.equal(saved.tokens[0].vision, 0);
  assert.equal(saved.tokens[0].bleeds, false);
  assert.equal(saved.tokens[0].hp, 0);
  assert.equal(saved.tokens[0].deathAt, null);
  assert.equal(canopyActor(saved.tokens[0]), false);
  assert.equal(saved.tokens[1].layer, 'map');
  assert.equal(saved.tokens[1].sceneryToken, undefined);
});

test('wagon preserves its offset and follows translation and rotation, then detaches without jumping', () => {
  const doc = newDocument(randomUUID()),
    s = doc.scenes[0],
    horse = newToken(randomUUID(), s),
    wagon = newToken(randomUUID(), s);
  Object.assign(horse, { x: 300, y: 300, rotation: 0 });
  Object.assign(wagon, { layer: 'map', x: 500, y: 330, rotation: 0 });
  convertSceneryToToken(wagon);
  wagon.attachment = { tokenId: horse.id, offsetX: 200, offsetY: 30, baseRotation: 0 };
  s.tokens = [horse, wagon];
  syncAttachmentPositions(s);
  assert.deepEqual([wagon.x, wagon.y], [500, 330]);
  translateAttachmentGroup(s, horse, { x: 400, y: 400 });
  assert.deepEqual([wagon.x, wagon.y], [600, 430]);
  const previous = structuredClone(s);
  horse.rotation = 90;
  syncAttachmentPositions(s, previous);
  assert(Math.abs(wagon.x - 370) < 0.001);
  assert(Math.abs(wagon.y - 600) < 0.001);
  assert.equal(wagon.rotation, 90);
  assert.equal(attachmentError(s.tokens), null);
  horse.attachment = { tokenId: wagon.id, offsetX: 0, offsetY: 0 };
  assert(attachmentError(s.tokens));
  horse.attachment = null;
  wagon.attachment = null;
  translateAttachmentGroup(s, horse, { x: 500, y: 500 });
  assert.equal(wagon.x, 370);
  assert.equal(wagon.layer, 'tokens');
});

test('all 42 terrain materials persist, including four reference grasses and the previous 38', () => {
  assert.equal(terrainTextures.length, 42);
  assert.equal(new Set(terrainTextures.map((t) => t.image)).size, 42);
  for (const material of terrainTextures) {
    const stroke = terrainStrokeSchema.parse({
      id: randomUUID(),
      texture: material.id,
      points: [{ x: 100, y: 100 }],
      radius: 50,
      softness: 0.3,
      opacity: 1,
      textureScale: 140,
    });
    const doc = newDocument(randomUUID());
    doc.scenes[0].terrain = [stroke];
    assert.equal(documentSchema.parse(doc).scenes[0].terrain[0].texture, material.id);
  }
  assert.equal(terrainTextures[0].image, '/vtt/terrain-v4-20261013/grass.webp');
  assert.equal(terrainTextures[7].image, '/vtt/terrain-v3-20261013/snow.webp');
  assert.equal(
    terrainStrokeSchema.safeParse({
      id: randomUUID(),
      texture: 'unknown',
      points: [{ x: 1, y: 1 }],
      radius: 10,
      softness: 0,
      opacity: 1,
      textureScale: 100,
    }).success,
    false,
  );
});
