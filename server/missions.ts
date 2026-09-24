import { z } from 'zod';
import { transaction } from './db.js';
import { AppError } from './services.js';

export const completionSchema = z.object({
  summary: z.string().trim().min(10).max(5000),
  rewards: z
    .array(
      z.object({
        character_id: z.string().uuid(),
        experience: z.number().int().min(0).max(1000000),
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
    const rewards = new Map(data.rewards.map((reward) => [reward.character_id, reward.experience]));
    if (
      rewards.size !== data.rewards.length ||
      rewards.size !== participants.length ||
      participants.some((p) => !rewards.has(p.character_id))
    )
      throw new AppError(
        400,
        'Informe a experiência de cada personagem inscrito, sem adicionar outros personagens.',
      );
    // Stable character order prevents deadlocks between two missions with shared participants.
    for (const participant of participants) {
      const xp = rewards.get(participant.character_id)!;
      const result = await client.query(
        'UPDATE characters SET experience=experience+$1 WHERE id=$2 AND experience::bigint+$1 <= 2147483647 RETURNING id',
        [xp, participant.character_id],
      );
      if (!result.rowCount)
        throw new AppError(409, 'O limite de experiência do personagem foi atingido.');
      await client.query(
        'INSERT INTO mission_rewards(post_id,character_id,experience,awarded_by) VALUES($1,$2,$3,$4)',
        [id, participant.character_id, xp, userId],
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
