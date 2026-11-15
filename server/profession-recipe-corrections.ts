import type { PoolClient } from 'pg';
export async function correctBreweryPotionProjects(db: Pick<PoolClient, 'query'>) {
  // Preserve materials, deadlines, help progress and both pre-existing jobs.
  // Old brewing proficiency remains sufficient to finish these recorded jobs.
  await db.query(`WITH corrected AS (
    UPDATE profession_projects SET profession_id='alchemy',legacy_profession_id='brewing',
      recipe=jsonb_set(recipe,'{profession_id}','"alchemy"'::jsonb),revision=revision+1
    WHERE profession_id='brewing' AND recipe->'output'->>'item_id' LIKE 'potion-%'
      AND claimed_at IS NULL AND canceled_at IS NULL
    RETURNING id
  ) INSERT INTO profession_recipe_corrections(project_id,from_profession,to_profession,reason)
    SELECT id,'brewing','alchemy','Correção de poção mágica classificada como cervejaria' FROM corrected
    ON CONFLICT(project_id) DO NOTHING`);
}
