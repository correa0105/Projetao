/** Scenery and maps keep their original files and resolution. */
export function protectedPublicBackground(path: string) {
  return /(?:^|[-_/])(?:normal|roughness|metalness|heightmap|depth|mask)(?:[-_.]|$)/i.test(path) ||
    /^\/(?:optimized-images-|assets\/)/.test(path) ||
    /^\/(?:alvorada-|atlas-world|character-(?:camp|library|parchment)|achievement-(?:house|wood|cabinet)|home-|inventory-loot|notice-village|dock-|lore-(?:archive|timeline|world|watercolor)|parchment-grain)/.test(path) ||
    /^\/(?:atlas-materials|atlas-model-materials|guild|events)\//.test(path) ||
    /^\/kingdom\/(?!structures\/)/.test(path) ||
    /^\/cards\/(?:host-|moonlit-room|private-archive|raven-manor)/.test(path) ||
    /^\/stable\/paddock/.test(path) ||
    /^\/pets\/garalho-cottage/.test(path) ||
    /^\/community\/hall/.test(path) ||
    /^\/shop\/reference\/shop-counter/.test(path) ||
    /^\/house2\/.*(?:landscape|grass-|floor-|interior-|roof-)/.test(path) ||
    /^\/rp-lobby\/.*(?:room|scene|background|floor|landscape)/.test(path) ||
    /^\/vtt\/(?:terrain-|biomes-|reference-grass)/.test(path);
}

export function imageDeliverySide(path:string) {
  // Atlases are addressed in native pixels. Resize neither their grids nor masks.
  if(/atlas|frames|sprite|sheet|icons|badges|insignias|milestones|animals-v|classics-|variants-[ab]/i.test(path) || path.startsWith('/character-creation/') || path.startsWith('/vtt/siege-materials-'))return null;
  if(path.startsWith('/cards/'))return 1536;
  return path.startsWith('/shop/')?768:960;
}
