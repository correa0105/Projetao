import { Router } from 'express';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import type { PoolClient } from 'pg';
import { pool } from './db.js';
import { AppError } from './services.js';

type Session = {
  userId: string;
  sessionId: string;
  name: string;
  muted: boolean;
  listening: boolean;
  at: number;
};
type Signal = {
  sequence: number;
  from: string;
  to: string;
  at: number;
  description?: { type: 'offer' | 'answer'; sdp: string };
  candidate?: {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  };
};
type Room = { peers: Map<string, Session>; signals: Signal[]; sequence: number };
type Access = (
  db: Pick<PoolClient, 'query'>,
  id: string,
  user: string,
) => Promise<{ owner_id: string; role: 'player' | 'spectator' | null }>;
const uuid = z.string().uuid();
const presence = z.object({ sessionId: uuid, muted: z.boolean(), listening: z.boolean() }).strict();
const signal = z
  .object({
    sessionId: uuid,
    to: uuid,
    description: z
      .object({ type: z.enum(['offer', 'answer']), sdp: z.string().min(1).max(32000) })
      .strict()
      .optional(),
    candidate: z
      .object({
        candidate: z.string().max(2048),
        sdpMid: z.string().max(100).nullable().optional(),
        sdpMLineIndex: z.number().int().min(0).max(20).nullable().optional(),
        usernameFragment: z.string().max(256).nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine((s) => !!s.description !== !!s.candidate, 'Escolha uma mensagem de conexão.');

// Transport state is deliberately ephemeral: no recordings or game documents.
export function vttVoiceRouter(access: Access) {
  const router = Router(),
    rooms = new Map<string, Room>();
  let queuedBytes = 0;
  const path = '/vtt/rooms/:id/voice';
  router.use(
    path,
    rateLimit({
      windowMs: 60000,
      limit: 180,
      keyGenerator: (_req, res) => res.locals.user.id,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Muitas atualizações de voz. Aguarde um instante.' },
    }),
  );
  function cleanup() {
    const now = Date.now();
    queuedBytes = 0;
    for (const [id, r] of rooms) {
      for (const [sid, p] of r.peers) if (now - p.at > 15000) r.peers.delete(sid);
      r.signals = r.signals.filter(
        (s) => now - s.at < 20000 && r.peers.has(s.from) && r.peers.has(s.to),
      );
      for (const s of r.signals) queuedBytes += JSON.stringify(s).length * 2;
      if (!r.peers.size) rooms.delete(id);
    }
  }
  function requirePeer(r: Room | undefined, sid: string, user: string) {
    const p = r?.peers.get(sid);
    if (!p || p.userId !== user)
      throw new AppError(409, 'A sessão de voz terminou. Entre novamente.');
    return p;
  }
  function iceServers() {
    if (!process.env.VTT_ICE_SERVERS) return [{ urls: 'stun:stun.l.google.com:19302' }];
    return z
      .array(
        z
          .object({
            urls: z.union([z.string(), z.array(z.string())]),
            username: z.string().optional(),
            credential: z.string().optional(),
          })
          .strict(),
      )
      .max(8)
      .parse(JSON.parse(process.env.VTT_ICE_SERVERS));
  }
  router.post(path, async (req, res) => {
    const rid = uuid.parse(req.params.id),
      who = res.locals.user,
      input = presence.parse(req.body);
    await access(pool, rid, who.id);
    cleanup();
    let r = rooms.get(rid);
    if (!r) {
      if (rooms.size >= 1000) throw new AppError(503, 'O serviço de voz está ocupado.');
      r = { peers: new Map(), signals: [], sequence: 0 };
      rooms.set(rid, r);
    }
    const prior = r.peers.get(input.sessionId);
    if (prior && prior.userId !== who.id)
      throw new AppError(403, 'Sessão de voz de outro participante.');
    if (!prior && r.peers.size >= 12)
      throw new AppError(400, 'A conversa de voz aceita até 12 conexões por mesa.');
    r.peers.set(input.sessionId, {
      ...input,
      userId: who.id,
      name: String(who.name || 'Viajante').slice(0, 80),
      at: Date.now(),
    });
    res.set('Cache-Control', 'no-store').json({ cursor: r.sequence, iceServers: iceServers() });
  });
  router.get(path, async (req, res) => {
    const rid = uuid.parse(req.params.id),
      sid = uuid.parse(req.query.sessionId),
      cursor = z.coerce
        .number()
        .int()
        .min(0)
        .max(Number.MAX_SAFE_INTEGER)
        .parse(req.query.cursor || 0);
    await access(pool, rid, res.locals.user.id);
    cleanup();
    const r = rooms.get(rid),
      p = requirePeer(r, sid, res.locals.user.id);
    p.at = Date.now();
    res
      .set('Cache-Control', 'no-store')
      .json({
        peers: [...r!.peers.values()].map(({ sessionId, name, muted, listening }) => ({
          sessionId,
          name,
          muted,
          listening,
        })),
        signals: r!.signals
          .filter((s) => s.to === sid && s.sequence > cursor)
          .map(({ sequence, from, description, candidate }) => ({
            sequence,
            from,
            description,
            candidate,
          })),
        cursor: r!.sequence,
        iceServers: iceServers(),
      });
  });
  router.patch(path, async (req, res) => {
    const rid = uuid.parse(req.params.id),
      input = presence.parse(req.body);
    await access(pool, rid, res.locals.user.id);
    cleanup();
    const p = requirePeer(rooms.get(rid), input.sessionId, res.locals.user.id);
    Object.assign(p, input, { at: Date.now() });
    res.json({ ok: true });
  });
  router.post(path + '/signal', async (req, res) => {
    const rid = uuid.parse(req.params.id),
      input = signal.parse(req.body);
    await access(pool, rid, res.locals.user.id);
    cleanup();
    const r = rooms.get(rid);
    requirePeer(r, input.sessionId, res.locals.user.id);
    if (input.to === input.sessionId || !r!.peers.has(input.to))
      throw new AppError(404, 'Participante de voz indisponível.');
    if (r!.signals.filter((s) => s.to === input.to).length >= 128)
      throw new AppError(429, 'Aguarde a conexão do participante.');
    if (queuedBytes + JSON.stringify(input).length * 2 > 8 * 1024 * 1024)
      throw new AppError(503, 'A sinalização de voz está ocupada. Tente novamente em instantes.');
    r!.signals.push({
      sequence: ++r!.sequence,
      from: input.sessionId,
      to: input.to,
      description: input.description,
      candidate: input.candidate,
      at: Date.now(),
    });
    res.json({ ok: true });
  });
  router.delete(path, async (req, res) => {
    const rid = uuid.parse(req.params.id),
      sid = uuid.parse(req.query.sessionId);
    await access(pool, rid, res.locals.user.id);
    cleanup();
    const r = rooms.get(rid);
    if (r?.peers.has(sid)) {
      requirePeer(r, sid, res.locals.user.id);
      r.peers.delete(sid);
      r.signals = r.signals.filter((s) => s.from !== sid && s.to !== sid);
    }
    res.json({ ok: true });
  });
  return router;
}
