import { type Point, type VttScene, type VttToken } from './vtt.js';
import { type SpellEffect } from './vtt-spells.js';
/** Arrival placement is separate from walking: no path through intervening walls. */
export function teleportArrivals(
  scene: VttScene,
  travellers: VttToken[],
  destination: Point,
): NonNullable<SpellEffect['movement']> {
  const excluded = new Set(travellers.map((t) => t.id)),
    occupied = scene.tokens.filter((t) => t.layer === 'tokens' && !excluded.has(t.id));
  const placed: { token: VttToken; point: Point }[] = [],
    result: NonNullable<SpellEffect['movement']> = [];
  for (const [index, token] of travellers.entries()) {
    const step = Math.max(scene.grid.size, token.width, token.height),
      candidates: Point[] = [{ x: destination.x, y: destination.y }];
    if (index)
      for (let ring = 1; ring <= 3; ring++)
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          candidates.push({
            x: destination.x + Math.cos(a) * step * ring,
            y: destination.y + Math.sin(a) * step * ring,
          });
        }
    const point = candidates.find(
      (point) =>
        point.x >= token.width / 2 &&
        point.x <= scene.width - token.width / 2 &&
        point.y >= token.height / 2 &&
        point.y <= scene.height - token.height / 2 &&
        occupied.every(
          (other) =>
            Math.abs(other.x - point.x) >= (other.width + token.width) * 0.5 ||
            Math.abs(other.y - point.y) >= (other.height + token.height) * 0.5,
        ) &&
        placed.every(
          (other) =>
            Math.abs(other.point.x - point.x) >= (other.token.width + token.width) * 0.5 ||
            Math.abs(other.point.y - point.y) >= (other.token.height + token.height) * 0.5,
        ),
    );
    if (!point) throw Error('Escolha uma chegada com espaço livre para todos os viajantes.');
    placed.push({ token, point });
    result.push({ tokenId: token.id, from: { x: token.x, y: token.y }, to: point });
  }
  return result;
}
export function applyTeleportArrivals(
  scene: VttScene,
  movement: NonNullable<SpellEffect['movement']>,
) {
  const ids = new Set(movement.map((m) => m.tokenId));
  // A spell transports only its selected travellers; mounts/riders aren't silently added.
  for (const token of scene.tokens)
    if (token.attachment && (ids.has(token.id) || ids.has(token.attachment.tokenId)))
      token.attachment = null;
  for (const item of movement) {
    const token = scene.tokens.find((t) => t.id === item.tokenId);
    if (token) {
      token.x = item.to.x;
      token.y = item.to.y;
    }
  }
}
