import type { PoolClient } from 'pg';
import { professionBuff, type ProfessionBuff } from '../shared/profession-buffs.js';
type DB = Pick<PoolClient, 'query'>;
export type ActiveProfessionBuff = ProfessionBuff & { expires_at: string };
export async function activeProfessionBuffs(
  db: DB,
  character: string,
): Promise<ActiveProfessionBuff[]> {
  const rows = (
    await db.query(
      'SELECT item_id,expires_at FROM character_profession_buffs WHERE character_id=$1 AND expires_at>clock_timestamp()',
      [character],
    )
  ).rows;
  return rows.flatMap((row) => {
    const buff = professionBuff(row.item_id);
    return buff ? [{ ...buff, expires_at: new Date(row.expires_at).toISOString() }] : [];
  });
}
export async function activateProfessionBuff(db: DB, character: string, item: string, key: string) {
  const buff = professionBuff(item);
  if (!buff) return;
  await db.query(
    `INSERT INTO character_profession_buffs(character_id,item_id,source_key,expires_at)VALUES($1,$2,$3,clock_timestamp()+($4*interval '1 minute'))ON CONFLICT(character_id)DO UPDATE SET item_id=excluded.item_id,source_key=excluded.source_key,started_at=clock_timestamp(),expires_at=excluded.expires_at`,
    [character, item, key, buff.minutes],
  );
}
export function withProfessionBuffs<T extends { skills: { name: string; value: number }[] }>(
  derived: T | null,
  buffs: ActiveProfessionBuff[],
): T | null {
  if (!derived || !buffs.length) return derived;
  return {
    ...derived,
    skills: derived.skills.map((skill) => ({
      ...skill,
      value:
        skill.value +
        Math.max(0, ...buffs.filter((b) => b.skills.includes(skill.name)).map((b) => b.bonus)),
    })),
  };
}
