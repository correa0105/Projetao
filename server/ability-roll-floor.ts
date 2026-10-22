import type { PoolClient } from 'pg';
import { z } from 'zod';
import { ABILITY_ROLL_MIN_SCORE, abilityRollResult } from '../shared/ability-rolls.js';
import { deriveSheet } from '../shared/character-sheet.js';

// Internal, explicit repair only. Caller supplies a transaction and the exact owner/character.
// Existing sheets are never upgraded on read or as a side effect of the migration.
export async function raiseCharacterAbilityFloor(db: PoolClient, id: string, userId: string) {
  const {
    rows: [row],
  } = await db.query(
    `SELECT to_jsonb(c) AS character,to_jsonb(s) AS sheet FROM characters c
     JOIN character_sheets s ON s.character_id=c.id
     WHERE c.id=$1 AND c.user_id=$2 AND c.deleted_at IS NULL FOR UPDATE OF c,s`,
    [id, userId],
  );
  if (!row) throw Error('Ficha não encontrada para esta correção.');
  const c = row.character,
    s = row.sheet;
  const rolls = z
    .array(z.array(z.number().int().min(1).max(6)).length(4))
    .length(6)
    .parse(s.rolls);
  const previous = z.union([z.literal(0), z.literal(8)]).parse(s.ability_roll_floor);
  const before = rolls.map((dice) => abilityRollResult(dice, previous));
  const after = rolls.map((dice) => abilityRollResult(dice, ABILITY_ROLL_MIN_SCORE));
  if (previous === ABILITY_ROLL_MIN_SCORE) return { changed: false, before, after };
  if (s.finalized_at) {
    const assignment = z
      .array(z.number().int().min(0).max(5))
      .length(6)
      .refine((a) => new Set(a).size === 6)
      .parse(s.assignment);
    const oldStats = z.array(z.number().int()).length(6).parse(c.stats);
    // Add only the base-score delta; preserve background and later advancement bonuses.
    const stats = oldStats.map((value, i) => value + after[assignment[i]] - before[assignment[i]]);
    const derived = deriveSheet({ ...c, stats }, s.choices);
    const current =
      s.current_hp === null
        ? null
        : s.current_hp === 0
          ? 0
          : Math.min(derived.hp, Math.max(0, s.current_hp + derived.hp - c.hp));
    await db.query(
      'UPDATE characters SET stats=$3,hp=$4,armor_class=$5 WHERE id=$1 AND user_id=$2',
      [id, userId, JSON.stringify(stats), derived.hp, derived.armorClass],
    );
    await db.query('UPDATE character_sheets SET current_hp=$2 WHERE character_id=$1', [
      id,
      current,
    ]);
  }
  await db.query(
    'UPDATE character_sheets SET ability_roll_floor=$2,updated_at=now() WHERE character_id=$1',
    [id, ABILITY_ROLL_MIN_SCORE],
  );
  return { changed: true, before, after };
}
