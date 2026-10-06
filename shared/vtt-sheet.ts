import type { SheetRecord, deriveSheet } from './character-sheet';
import type { VttToken } from './vtt';
import expandedConsumables from './emporium-consumables.json';
export const consumableItems = new Set([
  ...expandedConsumables,
  'antitoxin',
  'acid',
  'alchemists-fire',
  'oil',
  'rations',
  'torch',
  'candle',
  'spell-scroll-cantrip',
  'potion-of-growth',
  'potion-of-healing',
  'potion-of-climbing',
  'potion-of-heroism',
  'potion-of-flying',
  'cigar',
]);
export type VttSheetData = {
  character: {
    id: string;
    name: string;
    race: string;
    class: string;
    level: number;
    background: string;
    biography: string;
    stats: number[];
    gold_cp: number;
  };
  token: VttToken;
  sheet: SheetRecord | null;
  derived: ReturnType<typeof deriveSheet> | null;
  inventory: {
    id: string;
    name: string;
    description: string;
    quantity: number;
    weight_lb: string;
    consumable: boolean;
    equipped: string[];
  }[];
  resources: { slots_total: number[]; slots_used: number[]; hit_dice_used: number };
  uses: {
    id: string;
    kind: 'slot' | 'hit-die' | 'consumable';
    item_id: string | null;
    item_name: string | null;
    slot: number | null;
    created_at: string;
    restored_at: string | null;
  }[];
  is_gm: boolean;
  can_use: boolean;
};
