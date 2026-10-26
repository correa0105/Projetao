import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { newToken } from '../shared/vtt';
import {
  vehicleDefinitions,
  vehicleCoverImage,
  vehicleImage,
  type VehicleId,
} from '../shared/vtt-vehicles';
import { vttProtocolVersion } from '../shared/vtt-protocol';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3004';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3004, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ctx = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
    extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
  }),
  page = await ctx.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results/rigging-controls', { recursive: true });
try {
  const signed = await ctx.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Mestre de correções',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signed.ok()).toBe(true);
  const user = (await signed.json()).user;
  const made = await ctx.request.post(origin + '/api/vtt', {
    headers: { Origin: origin },
    data: { name: 'Mastros e vínculos' },
  });
  expect(made.ok()).toBe(true);
  const room = await made.json(),
    path = origin + `/api/vtt/rooms/${room.id}`,
    s = room.document.scenes[0];
  const cx = s.width / 2,
    cy = s.height / 2,
    carriage = newToken(randomUUID(), s),
    hero = newToken(randomUUID(), s),
    ship = newToken(randomUUID(), s);
  Object.assign(carriage, {
    name: 'Carruagem · teste',
    layer: 'tokens',
    sceneryToken: true,
    bleeds: false,
    image: vehicleImage('carriage'),
    vehicle: { characterId: randomUUID(), itemId: 'carriage', copy: 0 },
    x: cx - 220,
    y: cy,
    width: 180,
    height: 340,
  });
  Object.assign(hero, {
    name: 'Passageiro',
    hp: 224,
    maxHp: 224,
    x: cx + 220,
    y: cy,
    rotation: 13,
    width: 80,
    height: 80,
    controller: user.id,
  });
  Object.assign(ship, {
    name: 'Galé de apoio',
    layer: 'map',
    sceneryToken: true,
    bleeds: false,
    image: vehicleImage('galley'),
    vehicle: { characterId: randomUUID(), itemId: 'galley', copy: 0 },
    x: cx,
    y: cy - 330,
    width: 210,
    height: 500,
  });
  s.tokens = [carriage, hero, ship];
  s.lighting = false;
  s.fog = false;
  s.ambient = 1;
  s.walls = [];
  const saved = await ctx.request.put(path, {
    headers: { Origin: origin },
    data: { revision: room.revision, document: room.document },
  });
  expect(saved.ok(), await saved.text()).toBe(true);
  await page.goto(origin + '/#vtt?room=' + room.id);
  const entry = page.getByRole('region', { name: 'Preferências de entrada da mesa' });
  await expect(entry).toBeVisible({ timeout: 60000 });
  await entry.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(page.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true });
  async function point(t: { x: number; y: number }) {
    const rect = await board.boundingBox();
    const text = await page
        .getByText(/^\d+%$/)
        .last()
        .innerText(),
      zoom = Number(text.replace('%', '')) / 100;
    return {
      x: rect!.x + rect!.width / 2 + (t.x - cx) * zoom,
      y: rect!.y + rect!.height / 2 + (t.y - cy) * zoom,
    };
  }
  async function menu(t: typeof hero) {
    const p = await point(t);
    await page.mouse.click(p.x, p.y, { button: 'right' });
    await page
      .locator(`[data-token-id="${t.id}"]`)
      .getByRole('button', { name: 'Configurações do token', exact: true })
      .click();
    return page.getByRole('dialog', { name: 'Configurações do token', exact: true });
  }
  for (const t of [carriage, hero]) {
    const panel = await menu(t);
    await expect(panel.getByRole('slider', { name: 'Tamanho do token', exact: true })).toHaveCount(
      1,
    );
    for (let i = 0; i < 6; i++) {
      const response = page.waitForResponse(
        (r) => r.url() === path && r.request().method() === 'PUT',
      );
      await panel
        .getByRole('slider', { name: 'Tamanho do token', exact: true })
        .press('ArrowRight');
      expect((await response).ok()).toBe(true);
      await expect(
        panel.getByRole('slider', { name: 'Tamanho do token', exact: true }),
      ).toHaveCount(1);
      await panel.getByText('Mais opções', { exact: true }).click();
      await panel.getByText('Mais opções', { exact: true }).click();
    }
    for (const width of [1440, 1024, 768, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(
        panel.getByRole('slider', { name: 'Tamanho do token', exact: true }),
      ).toHaveCount(1);
      await page.screenshot({
        path: `test-results/rigging-controls/menu-${t.sceneryToken ? 'carriage' : 'hero'}-${width}.png`,
      });
      const box = await panel.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
    await panel.getByRole('button', { name: 'Fechar painel do token' }).click();
    await page.getByRole('button', { name: 'Fechar menu do token' }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  const current = async () => await (await ctx.request.get(path)).json();
  const before = await current(),
    oldHero = before.document.scenes[0].tokens.find((t: any) => t.id === hero.id);
  // Select the follower, activate the guide, and pick a vehicle still on the map layer.
  const p = await point(hero);
  await board.click({
    position: { x: p.x - (await board.boundingBox())!.x, y: p.y - (await board.boundingBox())!.y },
  });
  await page.getByRole('button', { name: 'Vincular sobre outro token', exact: true }).click();
  const guide = page.getByRole('region', { name: 'Vincular mantendo a posição' });
  await expect(guide).toContainText('Passageiro');
  await page.screenshot({ path: 'test-results/rigging-controls/link-guide.png' });
  const linkedResponse = page.waitForResponse(
    (r) => r.url().endsWith(`/tokens/${hero.id}/attachment`) && r.request().method() === 'POST',
  );
  await guide.getByRole('combobox', { name: 'Escolher apoio para vincular' }).selectOption(ship.id);
  expect((await linkedResponse).ok()).toBe(true);
  const after = await current(),
    passenger = after.document.scenes[0].tokens.find((t: any) => t.id === hero.id);
  expect([passenger.x, passenger.y, passenger.rotation]).toEqual([
    oldHero.x,
    oldHero.y,
    oldHero.rotation,
  ]);
  expect(passenger.attachment.tokenId).toBe(ship.id);
  expect(after.document.scenes[0].tokens.find((t: any) => t.id === ship.id).layer).toBe('map');
  const panel = await menu(hero);
  await expect(panel.getByRole('slider', { name: 'Tamanho do token', exact: true })).toHaveCount(1);
  await expect(panel.getByRole('combobox', { name: 'Veículo ou token de apoio' })).toHaveValue(
    ship.id,
  );
  const detached = page.waitForResponse(
    (r) => r.url().endsWith(`/tokens/${hero.id}/attachment`) && r.request().method() === 'POST',
  );
  await panel.getByRole('button', { name: 'Soltar vínculo', exact: true }).click();
  expect((await detached).ok()).toBe(true);
  const free = (await current()).document.scenes[0].tokens.find((t: any) => t.id === hero.id);
  expect([free.x, free.y, free.rotation]).toEqual([oldHero.x, oldHero.y, oldHero.rotation]);
  expect(free.attachment).toBe(null);
  const esbuild = await import('esbuild');
  await esbuild.build({
    entryPoints: ['src/vtt-vehicles-canvas.ts'],
    bundle: true,
    format: 'iife',
    globalName: 'VehicleRender',
    outfile: 'test-results/rigging-controls/render.js',
  });
  await page.addScriptTag({ path: 'test-results/rigging-controls/render.js' });
  const ids: VehicleId[] = ['galley', 'keelboat', 'longship', 'sailing-ship', 'warship'];
  const render = await page.evaluate(
    async ({ configs, template }) => {
      const lib = (window as any).VehicleRender,
        canvas = document.createElement('canvas');
      canvas.width = 1500;
      canvas.height = 850;
      const c = canvas.getContext('2d')!;
      c.fillStyle = '#24323b';
      c.fillRect(0, 0, 1500, 850);
      const results = [];
      for (let i = 0; i < configs.length; i++) {
        const d = configs[i],
          base = new Image(),
          roof = new Image();
        base.src = d.base;
        roof.src = d.cover;
        await Promise.all([base.decode(), roof.decode()]);
        const h = 590,
          w = (h * d.widthFt) / d.lengthFt,
          t = {
            ...template,
            id: crypto.randomUUID(),
            vehicle: { ...template.vehicle, itemId: d.id },
            image: d.base,
            x: i * 300 + 150,
            y: 325,
            width: w,
            height: h,
            rotation: 0,
            flipX: false,
            flipY: false,
          };
        c.save();
        c.translate(t.x, t.y);
        lib.drawVehiclePart(c, t, base, 'base');
        lib.drawVehiclePart(c, t, roof, 'cover');
        c.restore();
        const actor = {
          ...t,
          id: crypto.randomUUID(),
          x: t.x,
          y: t.y + (d.anchor - 0.5) * h,
          width: 30,
          height: 30,
          layer: 'tokens',
          sceneryToken: false,
          hidden: false,
        };
        const occupied = lib.vehicleCoverOccupied(t, roof, [actor]),
          hidden = lib.vehicleCoverOccupied(t, roof, [{ ...actor, hidden: true }]),
          outside = lib.vehicleCoverOccupied(t, roof, [{ ...actor, x: -1000 }]);
        results.push({ id: d.id, occupied, hidden, outside });
        // A separate lower inset checks the whole upper layer fades over the same deck.
        const scale = 0.27;
        c.save();
        c.translate(i * 300 + 150, 735);
        c.scale(scale, scale);
        lib.drawVehiclePart(c, t, base, 'base');
        c.fillStyle = '#52e7ae';
        c.fillRect(-15, (d.anchor - 0.5) * h - 15, 30, 30);
        c.restore();
        const inset = { ...t, x: i * 300 + 150, y: 735, width: w * scale, height: h * scale },
          rider = {
            ...actor,
            x: inset.x,
            y: inset.y + (d.anchor - 0.5) * inset.height,
            width: 14,
            height: 14,
          };
        lib.drawVehicleCovers(
          c,
          [inset],
          [rider],
          new Map([
            [d.base, base],
            [d.cover, roof],
          ]),
          () => true,
          0.45,
        );
        c.fillStyle = '#ebd9b6';
        c.font = '16px sans-serif';
        c.fillText(d.name, i * 300 + 20, 635);
      }
      return { results, png: canvas.toDataURL() };
    },
    {
      configs: ids.map((id) => ({
        id,
        name: vehicleDefinitions[id].name,
        widthFt: vehicleDefinitions[id].widthFt,
        lengthFt: vehicleDefinitions[id].lengthFt,
        base: vehicleImage(id),
        cover: vehicleCoverImage(id),
        anchor: id === 'galley' ? 0.44 : id === 'warship' ? 0.36 : 0.5,
      })),
      template: ship,
    },
  );
  for (const r of render.results) {
    expect(r.occupied, r.id).toBe(true);
    expect(r.hidden, r.id).toBe(false);
    expect(r.outside, r.id).toBe(false);
  }
  await writeFile(
    'test-results/rigging-controls/five-ships.png',
    Buffer.from(render.png.split(',')[1], 'base64'),
  );
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/rigging-controls/results.json',
    JSON.stringify(
      {
        menus: 2,
        updatesPerMenu: 6,
        widths: [1440, 1024, 768, 390],
        noTeleport: true,
        mapVehicleParent: true,
        rigging: render.results,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'Menus sem duplicação, vínculo sem salto, veículo no mapa e cinco coberturas superiores aprovados.',
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/rigging-controls/failure.png' }).catch(() => {});
  console.log((await page.locator('body').innerText()).slice(-6500));
  throw e;
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
