import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { pool } from './db.js';
import { requireAdministrator } from './administrators.js';
import { AppError } from './services.js';
import type { PoolClient } from 'pg';
type DB = Pick<PoolClient, 'query'>;
type Asset = {
  id: string;
  name: string;
  filename: string;
  width: number;
  height: number;
  sha256: string;
};
export async function premiumAssets(): Promise<Asset[]> {
  try {
    return JSON.parse(await readFile('data/vtt/premium-art/manifest.json', 'utf8')).assets;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
}
export async function premiumAccess(user: string, db: DB = pool) {
  const {
    rows: [u],
  } = await db.query('SELECT administrador,vtt_premium FROM "user" WHERE id=$1', [user]);
  return u?.administrador === 1 && u?.vtt_premium === true;
}
export async function requirePremium(user: string, db: DB = pool) {
  if (!(await premiumAccess(user, db)))
    throw new AppError(403, 'Este recurso exige administrador e a tag Tokens premium.');
}
export async function validatePremiumImages(
  db: DB,
  user: string,
  images: string[],
  previous: string[] = [],
) {
  const newImages = images.filter(
    (p) =>
      p.startsWith('/api/vtt/premium-art/') &&
      images.filter((v) => v === p).length > previous.filter((v) => v === p).length,
  );
  if (!newImages.length) return;
  await requirePremium(user, db);
  const available = new Set((await premiumAssets()).map((a) => '/api/vtt/premium-art/' + a.id));
  if (newImages.some((p) => !available.has(p)))
    throw new AppError(400, 'Este token premium ainda não está disponível.');
}
export function vttPremiumRouter(canView: (user: string, path: string) => Promise<boolean>) {
  const router = Router();
  router.get('/vtt/premium', async (_req, res) => {
    await requirePremium(res.locals.user.id);
    const catalog = JSON.parse(await readFile('data/vtt/srd-2024.json', 'utf8'));
    const assets = await premiumAssets();
    res.json({
      total: catalog.monsters.length,
      available: assets.length,
      monsters: assets.map((a) => ({
        ...catalog.monsters.find((m: { id: string }) => m.id === a.id),
        image: '/api/vtt/premium-art/' + a.id,
        width: a.width,
        height: a.height,
      })),
    });
  });
  router.get('/vtt/premium-access', async (_req, res) => {
    await requireAdministrator(res.locals.user.id);
    const { rows } = await pool.query(
      'SELECT id,name,email,administrador,vtt_premium FROM "user" ORDER BY name',
    );
    res.json(rows);
  });
  router.put('/vtt/premium-access/:user', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    const input = z.object({ enabled: z.boolean() }).strict().parse(req.body);
    const { rowCount } = await pool.query('UPDATE "user" SET vtt_premium=$2 WHERE id=$1', [
      z.string().max(100).parse(req.params.user),
      input.enabled,
    ]);
    if (!rowCount) throw new AppError(404, 'Conta não encontrada.');
    res.json({ ok: true });
  });
  router.get('/vtt/premium-art/:monster', async (req, res) => {
    const id = z
      .string()
      .regex(/^monster-[a-z0-9-]+$/)
      .max(150)
      .parse(req.params.monster);
    if (
      !(await premiumAccess(res.locals.user.id)) &&
      !(await canView(res.locals.user.id, '/api/vtt/premium-art/' + id))
    )
      throw new AppError(403, 'Arte premium indisponível para esta conta.');
    const asset = (await premiumAssets()).find((a) => a.id === id);
    if (!asset || !/^monster-[a-z0-9-]+-v1\.webp$/.test(asset.filename))
      throw new AppError(404, 'Arte premium não encontrada.');
    const bytes = await readFile('data/vtt/premium-art/' + asset.filename);
    res
      .set({
        'Cache-Control': 'private, no-store',
        'Content-Type': 'image/webp',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(bytes);
  });
  return router;
}
