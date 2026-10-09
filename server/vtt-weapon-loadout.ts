import type { PoolClient } from 'pg';
import type { SheetChoices } from '../shared/character-sheet.js';
import { equippedAttacks, type CombatItem } from '../shared/equipped-attacks.js';
import { readCharacterLoadout } from './character-attacks.js';

export async function readVttLoadout(
  db: Pick<PoolClient, 'query'>,
  roomId: string,
  character: { id: string; race: string; class: string; stats: number[] },
  choices?: SheetChoices | null,
) {
  const loadout = await readCharacterLoadout(db, character, choices);
  const available_weapons = equippedAttacks(
    character,
    choices,
    loadout.inventory.map((i) => ({ ...i, equipped: ['main_hand'] })) as CombatItem[],
  );
  const {
    rows: [saved],
  } = await db.query(
    'SELECT main_hand,off_hand,main_hand_two_handed FROM vtt_weapon_loadouts WHERE room_id=$1 AND character_id=$2',
    [roomId, character.id],
  );
  const owned = new Set(available_weapons.map((w) => w.itemId));
  const defaults = {
    main_hand:
      loadout.inventory.find((i) => owned.has(i.id) && i.equipped.includes('main_hand'))?.id ||
      null,
    off_hand:
      loadout.inventory.find((i) => owned.has(i.id) && i.equipped.includes('off_hand'))?.id || null,
  };
  const selected = saved || defaults;
  const main = available_weapons.find((w) => w.itemId === selected.main_hand),
    twoHands =
      !!main && (main.twoHanded || (!!saved?.main_hand_two_handed && !!main.versatileDice));
  const weapon_slots = {
    main_hand: owned.has(selected.main_hand) ? selected.main_hand : null,
    off_hand: !twoHands && owned.has(selected.off_hand) ? selected.off_hand : null,
    main_hand_two_handed: twoHands,
  };
  const attacks = available_weapons
    .filter((w) => w.itemId === weapon_slots.main_hand || w.itemId === weapon_slots.off_hand)
    .map((w) => ({
      ...w,
      dice: w.itemId === weapon_slots.main_hand && twoHands ? w.versatileDice || w.dice : w.dice,
    }));
  return { ...loadout, attacks, available_weapons, weapon_slots };
}
