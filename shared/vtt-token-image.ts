export function vttAssetId(path: string) {
  return /^\/api\/vtt\/assets\/([0-9a-f-]{36})(?:\/top-down)?$/.exec(path)?.[1];
}
export function isTopDownTokenImage(path: string) {
  return !!vttAssetId(path) && path.endsWith('/top-down');
}
export function vttAssetPath(id: string, topDown = false) {
  return '/api/vtt/assets/' + id + (topDown ? '/top-down' : '');
}
