import type { Point, VttScene, VttToken } from './vtt.js';

/** A rider stays a complete token. Only translation belongs to its base. */
export function attachmentRoot(tokens: VttToken[], token: VttToken): VttToken {
  const byId = new Map(tokens.map((t) => [t.id, t]));
  const seen = new Set<string>();
  let current = token;
  while (current.attachment && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.attachment.tokenId);
    if (!parent) break;
    current = parent;
  }
  return current;
}
export function attachmentError(tokens: VttToken[]): string | null {
  const byId = new Map(tokens.map((t) => [t.id, t]));
  if (byId.size !== tokens.length) return 'Tokens repetidos no mapa.';
  for (const token of tokens) {
    const seen = new Set([token.id]);
    let current = token;
    while (current.attachment) {
      const parent = byId.get(current.attachment.tokenId);
      if (!parent) return 'O token de apoio precisa existir no mesmo mapa.';
      if (current.layer !== 'tokens' || parent.layer !== 'tokens')
        return 'O vínculo só pode unir tokens de criaturas.';
      if (seen.has(parent.id) || seen.size >= 8)
        return 'O vínculo entre tokens é circular ou profundo demais.';
      seen.add(parent.id);
      current = parent;
    }
  }
  return null;
}
/** Stable branch order keeps riders clickable above their base, at any level. */
export function orderedAttachmentTokens(tokens: VttToken[]): VttToken[] {
  const layers = { map: 0, tokens: 1, gm: 2 };
  const sorted = [...tokens].sort((a, b) => layers[a.layer] - layers[b.layer] || a.level - b.level);
  const ids = new Set(sorted.map((t) => t.id)),
    children = new Map<string, VttToken[]>(),
    result: VttToken[] = [],
    seen = new Set<string>();
  for (const token of sorted)
    if (token.attachment && ids.has(token.attachment.tokenId)) {
      const key = token.attachment.tokenId;
      children.set(key, [...(children.get(key) || []), token]);
    }
  const visit = (token: VttToken) => {
    if (seen.has(token.id)) return;
    seen.add(token.id);
    result.push(token);
    for (const child of children.get(token.id) || []) visit(child);
  };
  for (const token of sorted)
    if (!token.attachment || !ids.has(token.attachment.tokenId)) visit(token);
  for (const token of sorted) visit(token);
  return result;
}
export function syncAttachmentPositions(scene: VttScene, previous?: VttScene) {
  for (const token of orderedAttachmentTokens(scene.tokens)) {
    if (!token.attachment) continue;
    const parent = scene.tokens.find((t) => t.id === token.attachment!.tokenId);
    if (parent) {
      const oldRotation =
        token.attachment.baseRotation ??
        previous?.tokens.find((t) => t.id === parent.id)?.rotation ??
        parent.rotation;
      const degrees = parent.rotation - oldRotation;
      if (degrees) {
        const radians = (degrees * Math.PI) / 180,
          x = token.attachment.offsetX,
          y = token.attachment.offsetY;
        token.attachment.offsetX = x * Math.cos(radians) - y * Math.sin(radians);
        token.attachment.offsetY = x * Math.sin(radians) + y * Math.cos(radians);
        token.rotation = (((token.rotation + degrees) % 360) + 360) % 360;
      }
      token.attachment.baseRotation = parent.rotation;
      token.x = parent.x + token.attachment.offsetX;
      token.y = parent.y + token.attachment.offsetY;
    }
  }
}
/** Companion art faces north; character art faces south. Use the last traveled leg. */
export function movementFacing(token: VttToken, start: Point, path: Point[]) {
  let from = start,
    result = token.rotation;
  for (const to of path) {
    if (Math.hypot(to.x - from.x, to.y - from.y) > 0.5)
      result =
        ((((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI +
          (token.companionId || /\/vtt\/companions\/companion-mount-(?:warhorse|riding-horse)-/.test(token.image) ? 90 : -90) +
          (token.flipY ? 180 : 0)) %
          360) +
          360) %
        360;
    from = to;
  }
  return result;
}
export function attachedGroup(tokens: VttToken[], base: VttToken) {
  const root = attachmentRoot(tokens, base);
  return tokens.filter((t) => attachmentRoot(tokens, t).id === root.id);
}
export function translateAttachmentGroup(scene: VttScene, base: VttToken, to: Point) {
  const root = attachmentRoot(scene.tokens, base),
    dx = to.x - root.x,
    dy = to.y - root.y;
  for (const member of attachedGroup(scene.tokens, root)) {
    member.x += dx;
    member.y += dy;
  }
}
export function attachmentUnavailable(tokens: VttToken[], token: VttToken) {
  const byId = new Map(tokens.map((t) => [t.id, t])),
    seen = new Set<string>();
  let current: VttToken | undefined = token;
  while (current && !seen.has(current.id)) {
    if (current.hidden || current.layer === 'gm') return true;
    seen.add(current.id);
    current = current.attachment ? byId.get(current.attachment.tokenId) : undefined;
  }
  return false;
}
