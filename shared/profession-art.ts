const craftedIcons = new Set([
  'craft-field-map',
  'craft-route-map',
  'craft-ale',
  'craft-malt-extract',
  'craft-manuscript',
  'craft-sealed-letter',
  'craft-leather-boots',
  'craft-lined-boots',
  'craft-trail-meal',
  'craft-ring',
  'craft-gem-amulet',
  'craft-stone-relief',
  'craft-whetstone',
  'craft-painted-banner',
  'craft-landscape',
  'craft-glazed-pot',
  'craft-wood-talisman',
  'craft-lock-picks',
  'craft-practice-lock',
  'craft-sea-chart',
  'craft-star-chart',
  'craft-stage-mask',
  'craft-disguise-pigments',
  'craft-replica-seal',
  'craft-document-copy',
  'craft-repellent',
  'craft-carved-game',
]);
const aliases: Record<string, string> = {
  'craft-detailed-map': 'craft-field-map',
  'craft-survey-atlas': 'craft-route-map',
  'craft-master-atlas': 'craft-route-map',
  'craft-chronicle': 'craft-manuscript',
  'craft-illuminated-codex': 'craft-manuscript',
  'craft-master-manuscript': 'craft-manuscript',
  'craft-feast-provisions': 'craft-trail-meal',
  'craft-refined-relief': 'craft-stone-relief',
  'craft-landscape-study': 'craft-landscape',
  'craft-ceremonial-pot': 'craft-glazed-pot',
  'craft-ocean-atlas': 'craft-sea-chart',
  'craft-ceremonial-document': 'craft-document-copy',
  'craft-archival-copy': 'craft-document-copy',
  'craft-master-seal': 'craft-replica-seal',
  'craft-carved-game-deluxe': 'craft-carved-game',
};
export function professionItemArtwork(id: string, existing?: string | null, badge = 'smithing') {
  const key = aliases[id] ?? id;
  return key.startsWith('craft-material-') || craftedIcons.has(key)
    ? `/professions/icons-20261113/${key}.webp`
    : existing || `/sheet/training-badges-20261019/${badge}.webp`;
}
