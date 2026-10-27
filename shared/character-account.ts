export const DEFAULT_CHARACTER_CAPACITY = 2;
export const MAX_CHARACTER_CAPACITY = 4;
export type CharacterCampState = {
  limit: number;
  positions: [string | null, string | null];
  revision: number;
};
