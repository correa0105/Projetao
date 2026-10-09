import fs from 'node:fs/promises';
import { effectLibrary } from '../shared/vtt-effects.ts';
import { spellProfiles } from '../shared/vtt-spells.ts';
import { spellChoreography } from '../shared/vtt-spell-choreography.ts';
import { cinematicPhenomena } from '../shared/vtt-effects-cinematic.ts';
await fs.writeFile(
  'data/vtt/cinematic-sound-jobs.json',
  JSON.stringify(
    {
      effects: effectLibrary.map((e) => ({ ...e, recipe: cinematicPhenomena[e.kind] || null })),
      spells: spellProfiles.map((p) => ({
        id: p.id,
        name: p.name,
        family: p.visual.family,
        shape: p.shape,
        recipe: spellChoreography(p.id, p.visual.family),
      })),
    },
    null,
    2,
  ) + '\n',
);
console.log('106 token-effect and339 spell sound recipes generated from the live catalogs.');
