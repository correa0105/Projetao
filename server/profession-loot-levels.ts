import type { PoolClient } from 'pg';
import { deriveSheet } from '../shared/character-sheet.js';
import { professions, professionUnlocked } from '../shared/professions.js';
import { professionProgress } from '../shared/profession-progression.js';
import type { MaterialRosterPlayer } from '../shared/profession-loot.js';
import { isBasicPreview } from './account-preview.js';
type DB = Pick<PoolClient, 'query'>;
export async function professionLootProfiles(db: DB, ids: string[]) {
  const rows = (
    await db.query(
      `SELECT c.*,s.choices,s.finalized_at,u.administrador,a.enabled AS profession_administrator FROM characters c LEFT JOIN character_sheets s ON s.character_id=c.id JOIN "user" u ON u.id=c.user_id LEFT JOIN profession_administrator_access a ON a.user_id=c.user_id WHERE c.id=ANY($1::uuid[]) AND c.deleted_at IS NULL`,
      [ids],
    )
  ).rows;
  const progress = (
    await db.query(
      'SELECT character_id,profession_id,experience FROM character_profession_progress WHERE character_id=ANY($1::uuid[])',
      [ids],
    )
  ).rows;
  return new Map<string, { user_id: string; professions: { id: string; level: number }[] }>(
    rows.map((c) => {
      const proficiencies =
        c.finalized_at && c.choices ? deriveSheet(c, c.choices).proficiencies : [];
      const administrator =
        !isBasicPreview() && c.administrador === 1 && c.profession_administrator === true;
      return [
        c.id,
        {
          user_id: c.user_id,
          professions: professions
            .filter((p) => administrator || professionUnlocked(p, proficiencies))
            .map((p) => ({
              id: p.id,
              level: professionProgress(
                Number(
                  progress.find((r) => r.character_id === c.id && r.profession_id === p.id)
                    ?.experience ?? 0,
                ),
              ).level,
            })),
        },
      ];
    }),
  );
}
export async function enrichMaterialRoster(db: DB, roster: MaterialRosterPlayer[]) {
  const profiles = await professionLootProfiles(db, [
    ...new Set(roster.flatMap((p) => p.characters.map((c) => c.id))),
  ]);
  return roster.map((p) => ({
    ...p,
    characters: p.characters.map((c) => ({
      ...c,
      professions: profiles.get(c.id)?.user_id === p.id ? profiles.get(c.id)!.professions : [],
    })),
  }));
}
