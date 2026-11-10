import type { CompanionAid } from './companion-aid.js';

export const companionMime = 'application/x-alvorada-companion';
export type VttCompanionAid = {
  id: string;
  kind: 'mount' | 'pet';
  name: string;
  characterName: string;
  aid: CompanionAid;
  readyAt: string | null;
};
export type VttCompanion = {
  id: string;
  kind: 'mount' | 'pet';
  species: string;
  appearance: string;
  name: string;
  speciesName: string;
  characterId: string;
  characterName: string;
  ownerId: string;
  ownerName: string;
  tokenUrl: string;
  portraitUrl: string | null;
};
