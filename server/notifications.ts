import { Router } from 'express';
import { z } from 'zod';
import { pool } from './db.js';
import { AppError } from './services.js';
import { rankName, testEligible } from '../shared/progression.js';
import type { PlayerNotification } from '../shared/notifications.js';

export function notificationsRouter() {
  const router = Router();
  router.get('/notifications', async (_req, res) => {
    const { rows } = await pool.query(
      `
      SELECT c.id,c.name,c.level,c.progression_missions,c.notification_level_read,
        s.choices,s.rolls,s.assignment,s.finalized_at,s.rules_version
      FROM characters c LEFT JOIN character_sheets s ON s.character_id=c.id
      WHERE c.user_id=$1 AND c.deleted_at IS NULL ORDER BY c.created_at,c.id`,
      [res.locals.user.id],
    );
    const items: PlayerNotification[] = [];
    for (const c of rows) {
      const add = (
        kind: PlayerNotification['kind'],
        title: string,
        description: string,
        target: PlayerNotification['target'] = 'profile',
        action = 'Abrir ficha',
        level?: number,
      ) =>
        items.push({
          id: `${c.id}:${kind}${level ? ':' + level : ''}`,
          characterId: c.id,
          characterName: c.name,
          kind,
          title,
          description,
          target,
          action,
          ...(level ? { level } : {}),
        });
      if (!c.choices || c.choices.version !== 2 || c.rules_version !== '5.2.1') {
        add(
          'origin',
          'Complete as escolhas da ficha',
          'Revise sua origem e treinamento antes de continuar.',
        );
      } else if (!c.rolls) {
        add(
          'roll',
          'Seus atributos aguardam os dados',
          'Lance os seis resultados para definir os atributos do personagem.',
          'profile',
          'Rolar atributos',
        );
      } else if (!c.finalized_at || !c.assignment) {
        add(
          'assignment',
          'Distribua seus atributos',
          'Os dados já estão salvos. Distribua os resultados e confirme a ficha.',
          'profile',
          'Concluir ficha',
        );
      }
      if (testEligible(c.level, c.progression_missions)) {
        add(
          'rank',
          `Teste para ${rankName(c.level + 1)} liberado`,
          `Você atingiu ${c.progression_missions} missões válidas. Conclua um teste de patente para avançar; missões normais agora concedem somente ouro.`,
          'board',
          'Procurar teste no mural',
        );
      }
      if (c.level > c.notification_level_read) {
        add(
          'level',
          `Nível ${c.level} alcançado`,
          'Seu novo nível foi registrado. A atualização de PV, habilidades e magias ao subir de nível ainda será implementada.',
          'profile',
          'Conferir ficha',
          c.level,
        );
      }
    }
    res.json(items);
  });
  router.post('/characters/:id/notifications/level-read', async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { level } = z.object({ level: z.number().int().min(1).max(20) }).parse(req.body);
    const result = await pool.query(
      `UPDATE characters
      SET notification_level_read=GREATEST(notification_level_read,$3)
      WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL AND level >= $3 RETURNING id`,
      [id, res.locals.user.id, level],
    );
    if (!result.rowCount) throw new AppError(404, 'Aviso não encontrado.');
    res.json({ ok: true });
  });
  return router;
}
