import catalog from './vtt-spell-choreography.json';
export type SpellChoreography = (typeof catalog)[number];
const byId = new Map(catalog.map((recipe) => [recipe.id, recipe]));
export function spellChoreography(id: string, family = 'force'): SpellChoreography {
  return (
    byId.get(id) || {
      id,
      kind: family,
      delivery: 'outward',
      persistent: false,
      flight: 0.6,
      impact: 1.8,
      particles: 28,
      material: family === 'fire' ? 'flame' : 'energy',
      descriptionSha256: '',
      descriptionCue: '',
    }
  );
}
