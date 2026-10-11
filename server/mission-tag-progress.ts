import type { PoolClient } from 'pg';
import type { AchievementProgress } from '../shared/achievements.js';
import type { TagReward } from '../shared/mission-tags.js';
import { purchaseContents } from '../shared/armor-bundles.js';
import { AppError } from './services.js';

// Callers hold the character row lock. Configuration locks freeze each reward set during delivery.
export async function refreshTagAchievements(client: PoolClient, characterId: string) {
  const { rows } = await client.query(
    `SELECT a.*,coalesce(t.total,0)::text AS total,
    EXISTS(SELECT 1 FROM tag_achievement_grants g WHERE g.character_id=$1 AND g.code=a.code) AS earned
    FROM tag_achievements a LEFT JOIN character_tag_totals t ON t.character_id=$1 AND t.tag_id=a.tag_id
    WHERE a.active OR EXISTS(SELECT 1 FROM achievements u WHERE u.character_id=$1 AND u.code=a.code)
    ORDER BY a.code FOR SHARE OF a`,
    [characterId],
  );
  const progress: Record<string, AchievementProgress> = {};
  for (const rule of rows) {
    const total = BigInt(rule.total),
      target = BigInt(rule.target);
    progress[rule.code] = {
      current: Number(total < target ? total : target),
      target: Number(target),
      unit: 'tags',
      available: true,
      exact_current: rule.total,
      exact_target: rule.target,
    };
    if (!rule.active || total < target || rule.earned) continue;
    const inserted = await client.query(
      'INSERT INTO tag_achievement_grants(character_id,code,rule_revision,rewards) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING code',
      [characterId, rule.code, rule.revision, JSON.stringify(rule.rewards)],
    );
    if (!inserted.rowCount) continue;
    const receipts = [];
    for (const reward of rule.rewards as TagReward[]) {
      if (reward.kind === 'title') {
        const result = await client.query(
          "INSERT INTO character_titles(character_id,title_id,source) VALUES($1,$2,'automatic') ON CONFLICT DO NOTHING RETURNING title_id",
          [characterId, reward.ref],
        );
        if (result.rowCount)
          await client.query(
            "INSERT INTO character_title_log(character_id,title_id,action) VALUES($1,$2,'automatic')",
            [characterId, reward.ref],
          );
        receipts.push(reward);
      } else if (reward.kind === 'house') {
        const ids: string[] = [];
        for (let i = 0; i < reward.quantity; i++) {
          const result = await client.query(
            "INSERT INTO house_items(character_id,catalog_id,source) VALUES($1,$2,'reward') RETURNING id",
            [characterId, reward.ref],
          );
          ids.push(result.rows[0].id);
        }
        receipts.push({ ...reward, house_item_ids: ids });
      } else {
        const pieces = purchaseContents(reward.ref);
        for (const item of [...pieces].sort()) {
          const result = await client.query(
            `INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,$3)
            ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=inventory.quantity+excluded.quantity
            WHERE inventory.quantity::bigint+excluded.quantity<=2147483647 RETURNING item_id`,
            [characterId, item, reward.quantity],
          );
          if (!result.rowCount)
            throw new AppError(
              409,
              'Uma recompensa excede a capacidade do inventário. Libere espaço e tente novamente.',
            );
        }
        receipts.push({ ...reward, item_ids: pieces });
      }
    }
    await client.query(
      'UPDATE tag_achievement_grants SET rewards=$3 WHERE character_id=$1 AND code=$2',
      [characterId, rule.code, JSON.stringify(receipts)],
    );
    await client.query(
      'INSERT INTO achievements(character_id,code) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [characterId, rule.code],
    );
  }
  return progress;
}

export async function creditMissionTags(client: PoolClient, postId: string, characterId: string) {
  const { rows } = await client.query(
    'SELECT tag_id FROM mission_post_tags WHERE post_id=$1 ORDER BY tag_id',
    [postId],
  );
  for (const row of rows) {
    const added = await client.query(
      'INSERT INTO character_tag_credits(post_id,character_id,tag_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING tag_id',
      [postId, characterId, row.tag_id],
    );
    if (added.rowCount)
      await client.query(
        'INSERT INTO character_tag_totals(character_id,tag_id,total) VALUES($1,$2,1) ON CONFLICT(character_id,tag_id) DO UPDATE SET total=character_tag_totals.total+1',
        [characterId, row.tag_id],
      );
  }
  await refreshTagAchievements(client, characterId);
}
