// Initial creation jobs retain their creation JSON after delivery. Excluding them
// also frees the initial artwork for existing characters without rewriting jobs.
const monthStart = "date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'";

export const characterArtUsedSql = (characterId: string) =>
  `(SELECT count(*)::int FROM character_art_jobs j WHERE j.character_id=${characterId}
    AND j.creation IS NULL AND j.status <> 'failed' AND j.created_at >= ${monthStart})`;

export const companionArtUsedSql = (wardrobeId: string) =>
  `(SELECT count(*)::int FROM companion_art_jobs j WHERE j.wardrobe_id=${wardrobeId}
    AND j.status NOT IN('failed','stale') AND j.created_at >= ${monthStart})`;
