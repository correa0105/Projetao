import manifest from '../data/vtt/monster-token-art.json';
const byId = new Map(manifest.images.map((a) => [a.id, a.path]));
const byName = new Map(manifest.images.map((a) => [a.name.toLowerCase(), a.path]));
export function monsterArt(id: string, name: string) {
  return byId.get(id) || byName.get(name.trim().toLowerCase()) || '';
}
