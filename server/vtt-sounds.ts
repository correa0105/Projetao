import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { pool, transaction } from './db.js';
import { AppError } from './services.js';
import { documentSchema, type VttDocument } from '../shared/vtt.js';
import {
  soundCommandSchema,
  soundAlive,
  soundSettings,
  type SoundSnapshot,
} from '../shared/vtt-sounds.js';
type DB = Pick<PoolClient, 'query'>;
type Access = (
  db: DB,
  id: string,
  user: string,
  lock?: boolean,
) => Promise<{ document: VttDocument; revision: number }>;
export async function validateSoundAssets(db: DB, roomId: string, doc: VttDocument) {
  const ids = [
    ...new Set(
      [...doc.soundboard.settings, ...doc.soundboard.voices]
        .filter((v) => v.sourceId.startsWith('asset:'))
        .map((v) => v.sourceId.slice(6)),
    ),
  ];
  if (!ids.length) return;
  const assets = await db.query(
    "SELECT id FROM vtt_assets WHERE room_id=$1 AND kind='audio' AND id=ANY($2::uuid[])",
    [roomId, ids],
  );
  if (assets.rowCount !== ids.length)
    throw new AppError(400, 'Escolha um áudio que pertença a esta mesa.');
}
export function vttSoundsRouter(
  access: Access,
  gm: Access,
  state: (
    id: string,
    user: string,
  ) => Promise<{ id: string; revision: number; document: VttDocument }>,
) {
  const router = Router(),
    path = '/vtt/rooms/:id/sounds';
  router.get(path, async (req, res) => {
    const r = await access(pool, z.string().uuid().parse(req.params.id), res.locals.user.id);
    const snapshot: SoundSnapshot = {
      revision: r.revision,
      serverTime: Date.now(),
      soundboard: r.document.soundboard,
      music: r.document.music,
    };
    res.set('Cache-Control', 'no-store').json(snapshot);
  });
  router.post(path, async (req, res) => {
    const rid = z.string().uuid().parse(req.params.id),
      user = res.locals.user.id,
      command = soundCommandSchema.parse(req.body);
    await transaction(async (db) => {
      const r = await gm(db, rid, user, true),
        d = r.document,
        b = d.soundboard,
        now = Date.now();
      b.voices = b.voices.filter((v) => soundAlive(v, now));
      const config =
        command.kind === 'settings'
          ? command.settings
          : command.kind === 'play'
            ? command.settings
            : undefined;
      if (config) {
        if (config.sourceId === 'asset:' + d.music.assetId) {
          d.music.volume = config.volume;
          d.music.loop = config.loop;
          if (config.channel !== 'music') d.music.playing = false;
        }
        if (command.kind === 'play' && config.sourceId !== command.sourceId)
          throw new AppError(400, 'O ajuste precisa pertencer ao som escolhido.');
        const i = b.settings.findIndex((s) => s.sourceId === config.sourceId);
        if (i < 0) b.settings.push(config);
        else b.settings[i] = config;
        b.voices = b.voices.map((v) => (v.sourceId === config.sourceId ? { ...v, ...config } : v));
        if (config.loop) {
          const last = b.voices.findLast((v) => v.sourceId === config.sourceId);
          if (last)
            b.voices = b.voices.filter((v) => v.sourceId !== config.sourceId || v.id === last.id);
        }
        if (config.channel === 'music' && b.voices.some((v) => v.sourceId === config.sourceId)) {
          b.voices = b.voices.filter(
            (v) => v.channel !== 'music' || v.sourceId === config.sourceId,
          );
          d.music.playing = false;
        }
      }
      if (command.kind === 'play') {
        const settings = soundSettings(command.sourceId, b);
        b.voices = b.voices.filter(
          (v) =>
            (v.sourceId !== command.sourceId || (!settings.loop && !v.loop)) &&
            (settings.channel !== 'music' || v.channel !== 'music'),
        );
        if (b.voices.length >= 16)
          throw new AppError(400, 'Há 16 sons ativos. Pare um deles antes de tocar outro.');
        if (settings.channel === 'music') d.music.playing = false;
        b.voices.push({ ...settings, id: randomUUID(), startedAt: now });
      } else if (command.kind === 'stop') {
        b.voices = b.voices.filter((v) => v.sourceId !== command.sourceId);
        if (command.sourceId === 'asset:' + d.music.assetId) d.music.playing = false;
      } else if (command.kind === 'volume') b.volume = command.volume;
      else if (command.kind === 'stopAll') {
        b.voices = [];
        d.music.playing = false;
      }
      // Parse the whole result, including channel uniqueness and bounded settings.
      documentSchema.parse(d);
      await validateSoundAssets(db, rid, d);
      await db.query(
        'UPDATE vtt_rooms SET document=$2,revision=revision+1,updated_at=now() WHERE id=$1',
        [rid, JSON.stringify(d)],
      );
    });
    res.json({ ...(await state(rid, user)), soundTime: Date.now() });
  });
  return router;
}
