import { refreshAchievementProgress } from './achievement-progress.js';
import { Router } from 'express';
import { z } from 'zod';
import { transaction } from './db.js';
import { AppError } from './services.js';
import { achievementCatalog, emptyShelf } from '../shared/achievements.js';
const schema = z.object({
  material: z.enum(['walnut','oak','ebony']), medal_frame: z.enum(['bronze','silver','dragon']),
  slots: z.array(z.string().refine(v => achievementCatalog.some(a => a.code === v)).nullable()).length(18),
}).strict().refine(v => new Set(v.slots.filter(Boolean)).size === v.slots.filter(Boolean).length, 'Não repita conquistas.');
export function achievementsRouter() {
  const router = Router();
  for (const method of ['get', 'post'] as const) router[method]('/characters/:id/achievements', async (req,res) => {
    const id = z.string().uuid().parse(req.params.id), config = method === 'post' ? schema.parse(req.body) : null;
    res.json(await transaction(async client => {
      const owned = await client.query('SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',[id,res.locals.user.id]);
      if (!owned.rowCount) throw new AppError(404,'Personagem não encontrado.');
      const progress = await refreshAchievementProgress(client, id, res.locals.user.id);
      const { rows: unlocked } = await client.query('SELECT a.code,a.unlocked_at FROM achievements a JOIN characters c ON c.id=a.character_id WHERE c.id=$1 AND c.user_id=$2 AND c.deleted_at IS NULL',[id,res.locals.user.id]);
      if (config) {
        if (config.slots.some(code => code && !unlocked.some(a => a.code === code))) throw new AppError(400,'Escolha apenas conquistas desbloqueadas por este personagem.');
        await client.query('INSERT INTO achievement_shelves(character_id,material,medal_frame,slots) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(character_id) DO UPDATE SET material=EXCLUDED.material,medal_frame=EXCLUDED.medal_frame,slots=EXCLUDED.slots,updated_at=now()',[id,config.material,config.medal_frame,JSON.stringify(config.slots)]);
      }
      const { rows } = await client.query('SELECT s.material,s.medal_frame,s.slots FROM achievement_shelves s JOIN characters c ON c.id=s.character_id WHERE c.id=$1 AND c.user_id=$2 AND c.deleted_at IS NULL',[id,res.locals.user.id]);
      return { unlocked, progress, shelf: rows[0] ?? emptyShelf() };
    }));
  });
  return router;
}
