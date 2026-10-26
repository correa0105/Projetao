import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { vehicleIds, vehicleDefinitions } from '../shared/vtt-vehicles';
import { vttProtocolVersion } from '../shared/vtt-protocol';
import { newToken } from '../shared/vtt';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3004';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
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
await mkdir('test-results/vehicles-slots', { recursive: true });
try {
  const signup = await ctx.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Capitão de teste',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
  });
  expect(signup.status()).toBe(200);
  const user = (await signup.json()).user;
  await page.goto(origin + '/#characters');
  await page.getByRole('button', { name: 'Criar personagem', exact: true }).click();
  const creation = page.locator('.character-creation-form'),
    dice = creation.getByRole('region', { name: 'Atributos do slot' });
  await expect(creation.getByRole('textbox', { name: 'Nome do personagem' })).toBeDisabled();
  await dice.getByRole('button', { name: 'Começar rolagens deste slot' }).click();
  async function reveal() {
    await dice.getByRole('button', { name: /Lançar dados/ }).click();
    await page.getByRole('button', { name: 'Guardar resultado', exact: true }).click();
    await expect(page.locator('.attribute-dice-overlay')).toHaveCount(0);
  }
  await reveal();
  await reveal();
  const saved = (await (await ctx.request.get(origin + '/api/character-slots')).json())[0];
  expect(saved.revealed).toBe(2);
  await page.reload();
  await page.getByRole('button', { name: 'Criar personagem', exact: true }).click();
  await expect(dice.getByRole('button', { name: /resultado 3/ })).toBeVisible();
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await dice.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/vehicles-slots/dice-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const box = await dice.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  }
  for (let n = 3; n <= 6; n++) {
    await reveal();
    await expect
      .poll(
        async () =>
          (await (await ctx.request.get(origin + '/api/character-slots')).json())[0].revealed,
      )
      .toBe(n);
  }
  await expect(creation.getByRole('textbox', { name: 'Nome do personagem' })).toBeEnabled();
  const final = (await (await ctx.request.get(origin + '/api/character-slots')).json())[0];
  expect(final.rolls).toEqual(saved.rolls);
  await creation.getByLabel('Slot do personagem').selectOption('2');
  await expect(creation.getByRole('textbox', { name: 'Nome do personagem' })).toBeDisabled();
  await creation.getByLabel('Slot do personagem').selectOption('1');
  await expect(creation.getByRole('textbox', { name: 'Nome do personagem' })).toBeEnabled();
  await page
    .getByRole('dialog', { name: 'Uma nova história' })
    .getByRole('button', { name: 'Fechar', exact: true })
    .click();
  const hero = await createLegacyTestCharacter(user.id, 'Dono dos veículos');
  for (const id of vehicleIds)
    await pool.query('INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,$2,1)', [
      hero.id,
      id,
    ]);
  const made = await ctx.request.post(origin + '/api/vtt', {
    headers: { Origin: origin },
    data: { name: 'Veículos da guilda' },
  });
  expect(made.ok()).toBe(true);
  const room = await made.json(),
    rid = room.id;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(origin + '/#vtt?room=' + rid);
  const entry = page.getByRole('region', { name: 'Preferências de entrada da mesa' });
  await expect(entry).toBeVisible({ timeout: 60000 });
  await entry.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(page.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Fichas', exact: true }).click();
  await page.getByRole('button', { name: 'Veículos', exact: true }).click();
  const vehicles = page.getByRole('region', { name: 'Veículos dos personagens' });
  await expect(vehicles.locator('.vtt-vehicle-row')).toHaveCount(12);
  await expect(vehicles.locator('canvas[data-ready="true"]')).toHaveCount(12);
  for (const width of [1440, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({ path: `test-results/vehicles-slots/vehicles-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  const airship = vehicles
    .locator('.vtt-vehicle-row')
    .filter({ hasText: 'Dirigível' })
    .getByRole('button');
  await airship.click();
  const state = async () => await (await ctx.request.get(origin + `/api/vtt/rooms/${rid}`)).json();
  await expect
    .poll(async () => {
      const r = await state();
      return r.document.scenes
        .find((s: any) => s.id === r.document.activeScene)
        .tokens.filter((t: any) => t.vehicle).length;
    })
    .toBe(1);
  await page.screenshot({ path: 'test-results/vehicles-slots/airship-roof.png' });
  let r = await state(),
    scene = r.document.scenes.find((s: any) => s.id === r.document.activeScene),
    ship = scene.tokens.find((t: any) => t.vehicle);
  scene.lighting = false;
  scene.fog = false;
  scene.ambient = 1;
  const actor = newToken(randomUUID(), scene);
  Object.assign(actor, {
    name: 'Sob o balão',
    x: ship.x,
    y: ship.y,
    width: 70,
    height: 70,
    color: '#33ff88',
    layer: 'tokens',
    controller: user.id,
  });
  scene.tokens.push(actor);
  const put = await ctx.request.put(origin + `/api/vtt/rooms/${rid}`, {
    headers: { Origin: origin },
    data: { revision: r.revision, document: r.document },
  });
  expect(put.ok(), await put.text()).toBe(true);
  await page.reload();
  await expect(entry).toBeVisible({ timeout: 30000 });
  await entry.getByRole('button', { name: 'Entrar no VTT', exact: true }).click();
  await expect(page.locator('.vtt-workspace')).toBeVisible({ timeout: 60000 });
  await page.getByRole('button', { name: 'Fichas', exact: true }).click();
  await page.getByRole('button', { name: 'Veículos', exact: true }).click();
  await vehicles
    .locator('.vtt-vehicle-row')
    .filter({ hasText: 'Dirigível' })
    .getByRole('button')
    .click();
  await page.screenshot({ path: 'test-results/vehicles-slots/airship-occupied.png' });
  // Exercise the real drawing helpers with original PNGs, including rotated/hidden actors.
  const esbuild = await import('esbuild');
  await esbuild.build({
    entryPoints: ['src/vtt-vehicles-canvas.ts'],
    bundle: true,
    format: 'iife',
    globalName: 'VehicleRender',
    write: true,
    outfile: 'test-results/vehicles-slots/render.js',
  });
  await page.addScriptTag({ path: 'test-results/vehicles-slots/render.js' });
  const qa = await page.evaluate(async (ship) => {
    const lib = (window as any).VehicleRender,
      canvas = document.createElement('canvas');
    canvas.width = canvas.height = 640;
    const c = canvas.getContext('2d')!,
      img = new Image();
    img.src = ship.image;
    await img.decode();
    const t = { ...ship, x: 320, y: 320, width: 220, height: 580 },
      actor = {
        ...t,
        id: crypto.randomUUID(),
        x: 320,
        y: 320,
        width: 44,
        height: 44,
        layer: 'tokens',
        sceneryToken: false,
        hidden: false,
      };
    const covered = lib.vehicleCoverOccupied(t, img, [actor]),
      hidden = lib.vehicleCoverOccupied(t, img, [{ ...actor, hidden: true }]),
      rotated = lib.vehicleCoverOccupied({ ...t, rotation: 90 }, img, [actor]);
    c.fillStyle = '#25323a';
    c.fillRect(0, 0, 640, 640);
    c.save();
    c.translate(t.x, t.y);
    lib.drawVehiclePart(c, t, img, 'base');
    c.restore();
    c.fillStyle = '#33ff88';
    c.fillRect(300, 300, 40, 40);
    const before = [...c.getImageData(320, 320, 1, 1).data];
    lib.drawVehicleCovers(c, [t], [actor], new Map([[t.image, img]]), () => true, 0.45);
    return {
      covered,
      hidden,
      rotated,
      before,
      after: [...c.getImageData(320, 320, 1, 1).data],
      png: canvas.toDataURL(),
    };
  }, ship);
  expect(qa.covered).toBe(true);
  expect(qa.hidden).toBe(false);
  expect(qa.rotated).toBe(true);
  expect(qa.after[1]).toBeGreaterThan(200);
  await writeFile(
    'test-results/vehicles-slots/cover-render.png',
    Buffer.from(qa.png.split(',')[1], 'base64'),
  );
  expect(errors).toEqual([]);
  const overview = await page.evaluate(async ({definitions,ship}) => {
    const lib = (window as any).VehicleRender,
      canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1400;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#1c282f';
    c.fillRect(0, 0, 1200, 1400);
    let i = 0;
    for (const [id, d] of Object.entries(definitions)) {
      const img = new Image();
      img.src = `/vtt/vehicles-20261026/${id}-v1.png`;
      await img.decode();
      const scale = Math.min(160 / d.widthFt, 275 / d.lengthFt),
        t = {
          ...ship,
          id: crypto.randomUUID(),
          image: img.src.replace(location.origin, ''),
          vehicle: { ...ship.vehicle, itemId: id },
          width: d.widthFt * scale,
          height: d.lengthFt * scale,
          x: (i % 3) * 400 + 120,
          y: Math.floor(i / 3) * 350 + 170,
          rotation: 0,
          flipX: false,
          flipY: false,
        };
      c.save();
      c.translate(t.x, t.y);
      lib.drawVehiclePart(c, t, img, 'base');
      lib.drawVehiclePart(c, t, img, 'cover');
      c.restore();
      t.x += 170;
      const actor = {
        ...t,
        id: crypto.randomUUID(),
        x: t.x,
        y: t.y,
        width: 25,
        height: 25,
        layer: 'tokens',
        sceneryToken: false,
        hidden: false,
      };
      c.save();
      c.translate(t.x, t.y);
      lib.drawVehiclePart(c, t, img, 'base');
      c.restore();
      c.fillStyle = '#57dbad';
      c.fillRect(actor.x - 12, actor.y - 12, 24, 24);
      lib.drawVehicleCovers(c, [t], [actor], new Map([[t.image, img]]), () => true, 0.45);
      c.fillStyle = '#e4d2b0';
      c.font = '16px sans-serif';
      c.fillText(d.name, (i % 3) * 400 + 20, Math.floor(i / 3) * 350 + 330);
      i++;
    }
    return canvas.toDataURL();
  }, {definitions:vehicleDefinitions,ship});
  await writeFile(
    'test-results/vehicles-slots/all-vehicles.png',
    Buffer.from(overview.split(',')[1], 'base64'),
  );
  await writeFile(
    'test-results/vehicles-slots/results.json',
    JSON.stringify(
      {
        widths: [1440, 1024, 768, 390],
        savedDice: final.rolls,
        progressResumed: 2,
        vehicles: 12,
        cover: { ...qa, png: undefined },
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'Browser: dados retomados, seis resultados antes da aparência, 12 veículos, cobertura/alfa/rotação, quatro larguras aprovados.',
  );
} catch (e) {
  await page.screenshot({ path: 'test-results/vehicles-slots/failure.png' }).catch(() => {});
  console.log((await page.locator('body').innerText()).slice(-6000));
  throw e;
} finally {
  await browser.close();
  server.closeAllConnections();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
