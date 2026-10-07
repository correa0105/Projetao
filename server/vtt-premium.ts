import { Router, type Response } from 'express';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { pool } from './db.js';
import { requireAdministrator } from './administrators.js';
import { AppError } from './services.js';
import type { PoolClient } from 'pg';
import { premiumPreviewGroups } from '../shared/vtt-premium-preview.js';
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
export async function premiumSettings(user: string, db: DB = pool) {
  const {
    rows: [u],
  } = await db.query('SELECT id FROM "user" WHERE id=$1', [user]);
  // Legacy response keys remain compatible; artwork is now included for every account.
  const access = !!u;
  return { premiumAccess: access, premiumTokens: access };
}
export async function premiumAccess(user: string, db: DB = pool) {
  return (await premiumSettings(user, db)).premiumAccess;
}
export async function requirePremium(user: string, db: DB = pool) {
  if (!(await premiumAccess(user, db))) throw new AppError(403, 'Conta não encontrada.');
}
export async function validatePremiumImages(
  db: DB,
  user: string,
  images: string[],
  previous: string[] = [],
) {
  const newImages = images.filter(
    (p) =>
      (p.startsWith('/api/vtt/premium-art/') || p.startsWith('/api/vtt/premium-preview-art/')) &&
      images.filter((v) => v === p).length > previous.filter((v) => v === p).length,
  );
  if (!newImages.length) return;
  await requirePremium(user, db);
  const available = new Set((await premiumAssets()).map((a) => '/api/vtt/premium-art/' + a.id));
  for (const group of premiumPreviewGroups)
    for (const id of group.ids)
      if (available.has('/api/vtt/premium-art/' + id))
        available.add('/api/vtt/premium-preview-art/' + id);
  if (newImages.some((p) => !available.has(p)))
    throw new AppError(400, 'Esta arte de monstro ainda não está disponível.');
}
export function vttPremiumRouter() {
  const router = Router();
  const previewIds = new Set<string>(premiumPreviewGroups.flatMap((g) => [...g.ids]));
  async function sendArt(id: string, res: Response) {
    const asset = (await premiumAssets()).find((a) => a.id === id);
    if (!asset || !/^monster-[a-z0-9-]+-v1\.webp$/.test(asset.filename))
      throw new AppError(404, 'Arte de monstro não encontrada.');
    const bytes = await readFile('data/vtt/premium-art/' + asset.filename);
    res
      .set({
        'Cache-Control': 'private, no-store',
        'Content-Type': 'image/webp',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(bytes);
  }
  router.get('/vtt/premium-preview', async (_req, res) => {
    const catalog = JSON.parse(await readFile('data/vtt/srd-2024.json', 'utf8'));
    const assets = await premiumAssets();
    res.json({
      total: catalog.monsters.length,
      available: assets.length,
      groups: premiumPreviewGroups.map((group) => ({
        id: group.id,
        title: group.title,
        monsters: group.ids.flatMap((id) => {
          const asset = assets.find((a) => a.id === id);
          const monster = catalog.monsters.find((m: { id: string }) => m.id === id);
          return asset && monster
            ? [
                {
                  ...monster,
                  image: '/api/vtt/premium-preview-art/' + id,
                  width: asset.width,
                  height: asset.height,
                },
              ]
            : [];
        }),
      })),
    });
  });
  router.get('/vtt/premium-preview-art/:monster', async (req, res) => {
    const id = z.string().max(150).parse(req.params.monster);
    if (!previewIds.has(id)) throw new AppError(403, 'Esta criatura não faz parte da prévia.');
    await sendArt(id, res);
  });
  router.put('/vtt/premium-tokens', async (req, res) => {
    await requirePremium(res.locals.user.id);
    // Old clients may submit their former preference; it cannot disable the default art.
    z.object({ enabled: z.boolean() }).strict().parse(req.body);
    res.json(await premiumSettings(res.locals.user.id));
  });
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
    throw new AppError(410, 'As artes de monstros fazem parte do VTT para todas as contas.');
  });
  router.put('/vtt/premium-access/:user', async (req, res) => {
    await requireAdministrator(res.locals.user.id);
    throw new AppError(410, 'As artes de monstros fazem parte do VTT para todas as contas.');
  });
  router.get('/vtt/premium-art/:monster', async (req, res) => {
    const id = z
      .string()
      .regex(/^monster-[a-z0-9-]+$/)
      .max(150)
      .parse(req.params.monster);
    await sendArt(id, res);
  });
  return router;
}
