import { z } from 'zod';
import { transaction } from './db.js';
import { AppError } from './services.js';
import {
  progressMission,
  testEligible,
  rankName,
  RANK_REWARD_CP,
  type Rank,
} from '../shared/progression.js';

export const completionSchema = z.object({
  summary: z.string().trim().min(10).max(5000),
  rewards: z
    .array(
      z.object({
        character_id: z.string().uuid(),
        experience: z.number().int().min(0).max(1000000).optional(), // Compatibilidade: XP recebido não concede progressão.
      }),
    )
    .max(200),
  hook: z
    .object({
      title: z.string().trim().min(5).max(100),
      description: z.string().trim().min(15).max(3000),
    })
    .optional(),
});

export async function completeMission(
  id: string,
  userId: string,
  data: z.infer<typeof completionSchema>,
) {
  return transaction(async (client) => {
    // Same lock as inscriptions/status changes: the roster cannot change during settlement.
    const {
      rows: [mission],
    } = await client.query('SELECT * FROM board_posts WHERE id=$1 FOR UPDATE', [id]);
    if (!mission || mission.author_id !== userId)
      throw new AppError(403, 'Somente o criador pode concluir esta missão.');
    if (mission.kind !== 'mission' || mission.status !== 'active')
      throw new AppError(409, 'Esta missão não está em andamento ou já foi concluída.');
    const { rows: participants } = await client.query(
      'SELECT character_id FROM mission_participants WHERE post_id=$1 ORDER BY character_id',
      [id],
    );
    const rewards = new Set(data.rewards.map((reward) => reward.character_id));
    if (
      rewards.size !== data.rewards.length ||
      rewards.size !== participants.length ||
      participants.some((p) => !rewards.has(p.character_id))
    )
      throw new AppError(
        400,
        'Confirme todos os personagens inscritos, sem adicionar ou repetir personagens.',
      );
    // Stable character order prevents deadlocks between two missions with shared participants.
    const gold = RANK_REWARD_CP[mission.mission_rank as Rank];
    for (const participant of participants) {
      const {
        rows: [character],
      } = await client.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE', [
        participant.character_id,
      ]);
      if (rankName(character.level) !== mission.mission_rank)
        throw new AppError(
          409,
          `${character.name} não pertence mais à patente ${mission.mission_rank} desta missão.`,
        );
      if (
        mission.rank_test_level !== null &&
        !testEligible(character.level, character.progression_missions, mission.rank_test_level)
      )
        throw new AppError(409, `${character.name} não está mais apto a este teste de patente.`);
      const progress = progressMission(
        character.level,
        character.progression_missions,
        mission.rank_test_level,
      );
      const result = await client.query(
        'UPDATE characters SET level=$1,progression_missions=$2,gold_cp=gold_cp+$3 WHERE id=$4 AND gold_cp::bigint+$3 <= 2147483647 RETURNING id',
        [progress.level, progress.missions, gold, participant.character_id],
      );
      if (!result.rowCount) throw new AppError(409, 'O limite de ouro do personagem foi atingido.');
      await client.query(
        `INSERT INTO mission_rewards(post_id,character_id,experience,awarded_by,gold_cp,progression_credit,level_before,level_after,rank_promoted)
         VALUES($1,$2,0,$3,$4,$5,$6,$7,$8)`,
        [
          id,
          participant.character_id,
          userId,
          gold,
          progress.credited,
          character.level,
          progress.level,
          progress.promoted,
        ],
      );
    }
    const {
      rows: [completed],
    } = await client.query(
      "UPDATE board_posts SET status='completed',completion_summary=$2,closed_at=now() WHERE id=$1 RETURNING *",
      [id, data.summary],
    );
    if (data.hook)
      await client.query(
        `INSERT INTO board_posts(author_id,kind,title,description,location,difficulty,source_mission_id,region_id,location_id)
       VALUES($1,'hook',$2,$3,$4,$5,$6,$7,$8)`,
        [
          userId,
          data.hook.title,
          data.hook.description,
          mission.location,
          mission.difficulty,
          id,
          mission.region_id,
          mission.location_id,
        ],
      );
    return completed;
  });
}
