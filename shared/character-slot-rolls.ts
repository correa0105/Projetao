export type CharacterSlotRolls = {
  slot: number;
  generation: number;
  rolls: number[][] | null;
  minimum: number;
  revealed: number;
  occupied: boolean;
  name: string | null;
  pending: boolean;
};
