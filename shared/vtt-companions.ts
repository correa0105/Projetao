export const companionMime = 'application/x-alvorada-companion';
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
