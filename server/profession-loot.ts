import type { PoolClient } from 'pg';
import { AppError } from './services.js';
import { lockStorage } from './inventory.js';
import type { MaterialRosterPlayer } from '../shared/profession-loot.js';
export async function settleProfessionReward(
  db: PoolClient,
  id: string,
  actor: string,
  summary: string,
) {
  const run = (await db.query('SELECT * FROM vtt_profession_rewards WHERE id=$1 FOR UPDATE', [id]))
    .rows[0];
  if (!run) throw new AppError(404, 'Recompensas da mesa não encontradas.');
  if (run.completed_at) return run;
  const roster = run.roster as MaterialRosterPlayer[];
  const rolls = (
    await db.query(
      'SELECT r.*,c.user_id,c.deleted_at FROM vtt_profession_reward_rolls r LEFT JOIN characters c ON c.id=r.character_id WHERE reward_id=$1 ORDER BY c.user_id,r.character_id',
      [id],
    )
  ).rows;
  if (
    rolls.length !== roster.length ||
    roster.some((p) => !rolls.some((r) => r.player_id === p.id))
  )
    throw new AppError(
      409,
      'Cada jogador inscrito precisa usar seu d100. O mestre pode rolar pelos ausentes.',
    );
  for (const roll of rolls) {
    if (roll.granted_at) continue;
    if (roll.item_id) {
      if (!roll.character_id || roll.deleted_at || roll.user_id !== roll.player_id)
        throw new AppError(
          409,
          'Um personagem sorteado não está mais disponível. Confira os participantes antes de concluir.',
        );
      await lockStorage(db, roll.player_id, roll.character_id);
      await db.query(
        'INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,$2,$3)ON CONFLICT(character_id,item_id)DO UPDATE SET quantity=inventory.quantity+excluded.quantity',
        [roll.character_id, roll.item_id, roll.quantity],
      );
    }
    await db.query(
      'UPDATE vtt_profession_reward_rolls SET granted_at=clock_timestamp() WHERE id=$1',
      [roll.id],
    );
  }
  await db.query(
    'INSERT INTO vtt_table_conclusions(room_id,reward_id,mission_id,summary,recorded_by)VALUES($1,$2,$3,$4,$5)',
    [run.room_id, id, run.mission_id, summary, actor],
  );
  return (
    await db.query(
      'UPDATE vtt_profession_rewards SET completed_at=clock_timestamp() WHERE id=$1 RETURNING *',
      [id],
    )
  ).rows[0];
}
export async function settleMissionProfessionRewards(
  db: PoolClient,
  mission: string,
  actor: string,
  summary: string,
) {
  const rows = (
    await db.query(
      'SELECT id FROM vtt_profession_rewards WHERE mission_id=$1 ORDER BY id FOR UPDATE',
      [mission],
    )
  ).rows;
  for (const row of rows) await settleProfessionReward(db, row.id, actor, summary);
}
