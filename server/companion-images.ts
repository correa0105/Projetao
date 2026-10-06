import type { PoolClient } from 'pg';
export async function withCompanionImages<T extends { id: string }>(
  db: Pick<PoolClient, 'query'>,
  characterId: string,
  companions: T[],
) {
  if (!companions.length) return companions;
  const { rows } = await db.query(
    'SELECT w.id,w.kind,w.revision,w.image_revision,a.equipment_revision FROM companion_wardrobes w LEFT JOIN companion_artworks a ON a.wardrobe_id=w.id WHERE w.character_id=$1 AND w.id=ANY($2::uuid[])',
    [characterId, companions.map((animal) => animal.id)],
  );
  return companions.map((animal) => {
    const row = rows.find((entry) => entry.id === animal.id);
    const hasImage = row?.equipment_revision !== null && row?.equipment_revision !== undefined;
    return {
      ...animal,
      image_revision: hasImage ? row.image_revision : 0,
      image_url: hasImage
        ? `/api/companions/${characterId}/${row.kind}/${row.id}/image?v=${row.image_revision}`
        : null,
      equipment_revision: row?.revision ?? 0,
      art_equipment_revision: row?.equipment_revision ?? null,
    };
  });
}
