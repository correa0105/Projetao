// Initial creation jobs retain their creation JSON after delivery. Excluding them
// also frees the initial artwork for existing characters without rewriting jobs.
const monthStart = "date_trunc('month',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'";

// Include deleted characters: removing a sheet must not reset its account's usage.
export const characterAccountArtUsedSql = (userId: string) =>
  `(SELECT count(*)::int FROM character_art_jobs j WHERE j.user_id=${userId}
    AND j.creation IS NULL AND j.status <> 'failed' AND j.created_at >= ${monthStart})`;

export const companionArtUsedSql = (wardrobeId: string) =>
  `(SELECT count(*)::int FROM companion_art_jobs j WHERE j.wardrobe_id=${wardrobeId}
    AND j.status NOT IN('failed','stale') AND j.created_at >= ${monthStart})`;
