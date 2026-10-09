import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  documentSchema,
  newDocument,
  newToken,
  orderedTokens,
  pathDistance,
  rulerLabel,
  type VttToken,
} from '../shared/vtt';
import {
  attachmentError,
  attachmentRoot,
  attachmentUnavailable,
  syncAttachmentPositions,
  translateAttachmentGroup,
  movementFacing,
} from '../shared/vtt-attachments';
import { attachmentMovementError, attachmentRotationError } from '../shared/vtt-movement';
function fixture() {
  const document = newDocument(randomUUID()),
    scene = document.scenes[0];
  scene.width = scene.height = 1200;
  const base = {
    ...newToken(randomUUID(), scene),
    x: 300,
    y: 300,
    name: 'Cavalo',
    width: 140,
    height: 140,
    level: 4,
  };
  const rider: VttToken = {
    ...newToken(randomUUID(), scene),
    x: 300,
    y: 300,
    name: 'Cavaleiro',
    level: -10,
    attachment: { tokenId: base.id, offsetX: 0, offsetY: 0 },
  };
  scene.tokens = [rider, base];
  return { document, scene, base, rider };
}
test('base movement carries a rider while preserving its identity, attacks and orientation', () => {
  const { scene, base, rider } = fixture(),
    before = structuredClone(rider);
  translateAttachmentGroup(scene, base, { x: 510, y: 440 });
  assert.equal(rider.x, 510);
  assert.equal(rider.y, 440);
  assert.equal(base.x, 510);
  assert.deepEqual({ ...rider, x: before.x, y: before.y }, before);
  assert.equal(attachmentRoot(scene.tokens, rider), base);
  assert.deepEqual(
    orderedTokens(scene.tokens).map((t) => t.id),
    [base.id, rider.id],
  );
  rider.attachment = null;
  translateAttachmentGroup(scene, base, { x: 700, y: 700 });
  assert.equal(rider.x, 510);
  assert.equal(rider.y, 440);
});
test('nested tokens translate once, preserve offsets and always draw above their own parent', () => {
  const { scene, base, rider } = fixture();
  rider.attachment!.offsetX = 30;
  const third = {
    ...newToken(randomUUID(), scene),
    attachment: { tokenId: rider.id, offsetX: 5, offsetY: 8 },
  };
  scene.tokens.push(third);
  syncAttachmentPositions(scene);
  translateAttachmentGroup(scene, base, { x: 400, y: 500 });
  syncAttachmentPositions(scene);
  assert.deepEqual([rider.x, rider.y, third.x, third.y], [430, 500, 435, 508]);
  assert.deepEqual(
    orderedTokens(scene.tokens).map((t) => t.id),
    [base.id, rider.id, third.id],
  );
});
test('invalid, missing, self and circular attachments are rejected without damaging old documents', () => {
  const { document, scene, base, rider } = fixture();
  assert.equal(attachmentError(scene.tokens), null);
  assert.equal(documentSchema.safeParse(document).success, true);
  base.attachment = { tokenId: rider.id, offsetX: 0, offsetY: 0 };
  assert.equal(documentSchema.safeParse(document).success, false);
  base.attachment = null;
  rider.attachment!.tokenId = rider.id;
  assert.ok(attachmentError(scene.tokens));
  rider.attachment!.tokenId = randomUUID();
  assert.ok(attachmentError(scene.tokens));
  for (const token of scene.tokens) delete (token as any).attachment;
  const old = documentSchema.parse(document);
  assert.ok(old.scenes[0].tokens.every((t) => t.attachment === null));
});
test('walls and map limits apply to every carried footprint center, and hiding a base hides its riders', () => {
  const { scene, base, rider } = fixture();
  scene.walls = [
    { id: randomUUID(), a: { x: 400, y: 0 }, b: { x: 400, y: 1200 }, kind: 'wall', open: false },
  ];
  assert.ok(attachmentMovementError(scene, base, [{ x: 450, y: 300 }]));
  assert.equal(attachmentMovementError(scene, base, [{ x: 350, y: 350 }]), null);
  assert.ok(attachmentMovementError(scene, base, [{ x: 1300, y: 300 }]));
  base.hidden = true;
  assert.equal(attachmentUnavailable(scene.tokens, rider), true);
  assert.equal(rider.hidden, false);
  base.hidden = false;
  rider.attachment!.offsetX = 60;
  syncAttachmentPositions(scene);
  assert.ok(
    attachmentMovementError(scene, base, [{ x: 350, y: 300 }]),
    'the carried offset crosses the wall even when the base does not',
  );
});
test('ruler uses configured cell scale, metric conversion and continuous 5/10 diagonal parity', () => {
  const { scene } = fixture();
  scene.grid = { ...scene.grid, type: 'square', size: 100, scale: 5, diagonal: 'five', unit: 'ft' };
  assert.equal(
    rulerLabel(
      [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      scene.grid,
    ),
    '15 ft',
  );
  scene.grid.scale = 10;
  assert.equal(
    rulerLabel(
      [
        { x: 0, y: 0 },
        { x: 300, y: 0 },
      ],
      scene.grid,
    ),
    '30 ft',
  );
  scene.grid.diagonal = 'alternating';
  scene.grid.scale = 5;
  assert.equal(
    pathDistance(
      [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ],
      scene.grid,
    ),
    15,
  );
  assert.equal(
    pathDistance(
      [
        { x: 0, y: 0 },
        { x: 100, y: 100 },
        { x: 100, y: 200 },
        { x: 200, y: 300 },
      ],
      scene.grid,
    ),
    20,
  );
  scene.grid.unit = 'm';
  scene.grid.scale = 1.524;
  scene.grid.diagonal = 'euclidean';
  assert.equal(
    rulerLabel(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      scene.grid,
    ),
    '5 ft',
  );
  scene.grid.unit = 'ft';
  scene.grid.scale = 5;
  scene.grid.size = 70;
  assert.equal(
    rulerLabel(
      [
        { x: 0, y: 0 },
        { x: 210, y: 0 },
      ],
      scene.grid,
    ),
    '15 ft',
  );
  for (const type of ['hex-flat', 'hex-point'] as const) {
    scene.grid.type = type;
    assert.ok(
      pathDistance(
        [
          { x: 0, y: 0 },
          { x: 70, y: 0 },
        ],
        scene.grid,
      ) > 0,
    );
  }
});

test('mounted rotations preserve a rider heading offset and rotate nested local offsets once', () => {
  const { scene, base, rider } = fixture();
  base.rotation = 350;
  rider.rotation = 30;
  rider.attachment = { tokenId: base.id, offsetX: 30, offsetY: 0, baseRotation: 350 };
  const third = {
    ...newToken(randomUUID(), scene),
    rotation: 70,
    attachment: { tokenId: rider.id, offsetX: 10, offsetY: 0, baseRotation: 30 },
  };
  scene.tokens.push(third);
  syncAttachmentPositions(scene);
  const previous = structuredClone(scene);
  base.rotation = 10;
  syncAttachmentPositions(scene, previous);
  assert.ok(Math.abs(rider.x - (base.x + 30 * Math.cos((20 * Math.PI) / 180))) < 1e-6);
  assert.ok(Math.abs(rider.y - (base.y + 30 * Math.sin((20 * Math.PI) / 180))) < 1e-6);
  assert.equal(rider.rotation, 50);
  assert.equal(third.rotation, 90);
  assert.ok(Math.abs(third.x - rider.x - 10 * Math.cos((20 * Math.PI) / 180)) < 1e-6);
  const once = structuredClone(scene);
  syncAttachmentPositions(scene, previous);
  assert.deepEqual(scene, once);
});
test('drop facing follows the last real leg, including flips, without rotating stationary updates', () => {
  const { base } = fixture();
  base.rotation = 37;
  assert.equal(movementFacing(base, base, [base]), 37);
  assert.equal(movementFacing(base, base, [{ x: 500, y: 300 }]), 270);
  assert.equal(movementFacing(base, base, [{ x: 300, y: 500 }]), 0);
  assert.equal(movementFacing(base, base, [{ x: 300, y: 100 }]), 180);
  assert.equal(movementFacing(base, base, [{ x: 100, y: 300 }]), 90);
  base.flipX = true;
  assert.equal(movementFacing(base, base, [{ x: 300, y: 500 }]), 0);
  assert.equal(
    movementFacing(base, base, [
      { x: 500, y: 300 },
      { x: 500, y: 100 },
    ]),
    180,
  );
  base.flipY = true;
  assert.equal(movementFacing(base, base, [{ x: 500, y: 300 }]), 90);
  assert.equal(movementFacing(base, base, [{ x: 300, y: 500 }]), 180);
  assert.equal(movementFacing(base, base, [{ x: 300, y: 100 }]), 0);
});
test('carried rotational arcs cannot bypass walls or map limits', () => {
  const { scene, base, rider } = fixture();
  rider.attachment = { tokenId: base.id, offsetX: 60, offsetY: 0, baseRotation: 0 };
  syncAttachmentPositions(scene);
  const previous = structuredClone(scene);
  scene.walls = [
    { id: randomUUID(), a: { x: 340, y: 330 }, b: { x: 400, y: 330 }, kind: 'wall', open: false },
  ];
  base.rotation = 90;
  syncAttachmentPositions(scene, previous);
  assert.ok(attachmentRotationError(scene, previous, base));
  scene.walls = [];
  assert.equal(attachmentRotationError(scene, previous, base), null);
});
