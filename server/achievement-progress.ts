import type { PoolClient } from 'pg';
import type { AchievementProgress } from '../shared/achievements.js';

// Called inside the owned character transaction. Historical audited activity counts too.
export async function refreshAchievementProgress(client: PoolClient, characterId: string, userId: string) {
  const { rows: [totals] } = await client.query(`
    SELECT
      (SELECT count(*) FROM mission_rewards r JOIN board_posts b ON b.id=r.post_id
       WHERE r.character_id=c.id AND b.kind='mission' AND b.status='completed'
       AND b.region_id='reino-do-norte') AS missions,
      (SELECT count(*) FROM board_posts b WHERE b.author_id=c.user_id
       AND b.kind='mission' AND b.status='completed') AS stories,
      (SELECT coalesce(sum(p.total_cp),0) FROM purchases p WHERE p.character_id=c.id) AS spent
    FROM characters c WHERE c.id=$1 AND c.user_id=$2 AND c.deleted_at IS NULL`, [characterId,userId]);
  if (!totals) return {};
  const progress: Record<string, AchievementProgress> = {
    north_veteran: {current: Math.min(10,Number(totals.missions)),target:10,unit:'missões',available:true},
    first_story: {current: Math.min(1,Number(totals.stories)),target:1,unit:'mesa',available:true},
    shop_patron: {current: Math.min(1000,Math.floor(Number(totals.spent)/100)),target:1000,unit:'PO',available:true},
    north_renown: {current:0,target:300,unit:'reputação',available:false},
  };
  for (const [code,value] of Object.entries(progress)) {
    if (value.available && value.current >= value.target)
      await client.query('INSERT INTO achievements(character_id,code) VALUES($1,$2) ON CONFLICT DO NOTHING',[characterId,code]);
  }
  return progress;
}
