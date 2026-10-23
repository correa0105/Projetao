import type { PoolClient } from 'pg';
import { CHARACTER_STARTING_GOLD_CP } from '../shared/character-starting-gold.js';

/** Atomic, once per character. Call inside creation/finalization's transaction. */
export async function grantCharacterStartingGold(
  db: PoolClient,
  userId: string,
  characterId: string,
) {
  const result = await db.query(
    `UPDATE characters SET gold_cp=gold_cp+$3,starting_wealth_granted=true
     WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL AND starting_wealth_granted=false
     RETURNING id`,
    [characterId, userId, CHARACTER_STARTING_GOLD_CP],
  );
  if (result.rowCount !== 1) return false;
  // Close a still-unused legacy beta allowance without adding another payment.
  // Already recorded grants retain their original amount and character.
  await db.query(
    `UPDATE beta_accounts SET granted_at=now(),granted_character_id=$2,initial_gold_cp=$3
     WHERE user_id=$1 AND granted_at IS NULL`,
    [userId, characterId, CHARACTER_STARTING_GOLD_CP],
  );
  return true;
}
