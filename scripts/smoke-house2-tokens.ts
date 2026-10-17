import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { house2Houses } from '../shared/house-v2';
import { house2Floor, house2HouseWorld } from '../shared/house2-tokens';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3076',
  output = 'test-results/house2-tokens';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3076, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const owner = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
  }),
  visitor = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
  });
for (const c of [owner, visitor])
  await c.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
const page = await owner.newPage(),
  peer = await visitor.newPage(),
  errors: string[] = [];
for (const p of [page, peer]) p.on('pageerror', (e) => errors.push(e.message));
await mkdir(output, { recursive: true });
await writeFile(output + '/result.json', JSON.stringify({ passed: false }));
async function request(c: BrowserContext, path: string, data?: unknown, method = 'POST') {
  const response = await c.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
async function signup(c: BrowserContext, name: string) {
  const a = await request(c, '/auth/sign-up/email', {
    name,
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  return createLegacyTestCharacter(a.user.id, name);
}
async function tool(name: string) {
  await page.getByRole('button', { name: 'House 2.0', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Controles da vizinhança' })
    .getByRole('button', { name, exact: true })
    .click();
}
async function screen(at: { x: number; y: number }) {
  return page.locator('.h2-map').evaluate((node, at) => {
    const svg = node as unknown as SVGSVGElement,
      point = svg.createSVGPoint();
    point.x = at.x;
    point.y = at.y;
    const p = point.matrixTransform(svg.getScreenCTM()!);
    return { x: p.x, y: p.y };
  }, at);
}
async function drag(from: { x: number; y: number }, to: { x: number; y: number }) {
  const a = await screen(from),
    b = await screen(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 18 });
  await page.mouse.up();
}
try {
  const hero = await signup(owner, 'Aurora'),
    other = await signup(visitor, 'Bruma');
  await pool.query(
    'UPDATE "user" SET administrador=1 WHERE id=(SELECT user_id FROM characters WHERE id=$1)',
    [hero.id],
  );
  await pool.query('INSERT INTO character_tokens(character_id,image)VALUES($1,$2)', [
    hero.id,
    await readFile('public/character-silhouette-v2.png'),
  ]);
  const pet = (
    await pool.query(
      "INSERT INTO character_pets(character_id,pet_id,name,price_cp,idempotency_key)VALUES($1,'cat','Luar',0,$2)RETURNING id",
      [hero.id, randomUUID()],
    )
  ).rows[0];
  const n = (await request(owner, '/house-v2', undefined, 'GET')).neighborhoods[0].id;
  const base = '/house-v2/neighborhoods/' + n;
  const lot = (await request(owner, base, undefined, 'GET')).plots[0];
  await request(owner, `/house-v2/plots/${lot.id}/purchase`, {
    character_id: hero.id,
    idempotency_key: randomUUID(),
  });
  await request(owner, `/house-v2/plots/${lot.id}/house`, {
    character_id: hero.id,
    idempotency_key: randomUUID(),
    catalog_id: house2Houses[0].id,
  });
  await pool.query('UPDATE house2_plots SET house_rotation=270 WHERE id=$1', [lot.id]);
  const house = (await request(owner, base, undefined, 'GET')).plots.find(
      (p: any) => p.id === lot.id,
    ),
    floor = house2Floor(house)!;
  await page.goto(origin + '/#house2');
  await page.locator('.h2-neighborhood-card').first().click();
  await tool('Meus tokens');
  await expect(
    page.getByRole('button', { name: 'Trazer Aurora para o mapa', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Pet de Aurora', { exact: true })).toBeVisible();
  await page.locator(`[data-house2-token-source="${hero.id}"]`).dragTo(page.locator('.h2-map'), {
    sourcePosition: { x: 24, y: 24 },
    targetPosition: { x: 600, y: 500 },
  });
  await expect(
    page.getByRole('button', { name: 'Localizar Aurora no mapa', exact: true }),
  ).toBeEnabled();
  await page.locator(`[data-house2-token-source="${pet.id}"]`).dragTo(page.locator('.h2-map'), {
    sourcePosition: { x: 24, y: 24 },
    targetPosition: { x: 650, y: 450 },
  });
  await expect(page.locator('[data-house2-token]')).toHaveCount(2);
  await page.locator('[data-house2-token] image').evaluateAll(async (nodes) => {
    await Promise.all(
      nodes.map((node) => {
        const image = new Image();
        image.src = node.getAttribute('href')!;
        return image.decode();
      }),
    );
  });
  await page.screenshot({ path: output + '/token-library.png' });
  let state = await request(owner, base + '/tokens', undefined, 'GET');
  let actor = state.tokens.find((t: any) => t.kind === 'character'),
    animal = state.tokens.find((t: any) => t.kind === 'pet');
  expect(actor.x).not.toBe(animal.x);
  const actorNode = page.locator(`[data-house2-token="${actor.id}"]`);
  await actorNode.locator('image').click();
  await expect(actorNode).toHaveAttribute('data-token-selected', 'true');
  await expect(page.locator('[data-house2-token-controls] circle')).toHaveCount(0);
  await actorNode.locator('image').click();
  await expect(actorNode).toHaveAttribute('data-token-selected', 'false');
  await expect(page.getByRole('button', { name: 'Girar Aurora', exact: true })).toHaveCount(0);
  await actorNode.locator('image').click();
  await expect(actorNode).toHaveAttribute('data-token-selected', 'true');
  await page.keyboard.down('Control');
  await drag(
    { x: actor.x + actor.size * 0.35, y: actor.y },
    {
      x: actor.x + 2 * Math.cos((127.25 * Math.PI) / 180),
      y: actor.y + 2 * Math.sin((127.25 * Math.PI) / 180),
    },
  );
  await page.keyboard.up('Control');
  await expect
    .poll(
      async () =>
        (await request(owner, base + '/tokens', undefined, 'GET')).tokens.find(
          (t: any) => t.id === actor.id,
        ).rotation,
    )
    .toBeGreaterThan(120);
  const turned = (await request(owner, base + '/tokens', undefined, 'GET')).tokens.find(
    (t: any) => t.id === actor.id,
  );
  expect(Math.abs(turned.rotation - 127.25)).toBeLessThan(2);
  expect(turned.x).toBe(actor.x);
  expect(turned.y).toBe(actor.y);
  expect(turned.rotation % 15).not.toBe(0);
  actor = turned;
  const turnHandle = page.getByRole('button', { name: 'Girar Aurora', exact: true });
  await expect(turnHandle).toBeVisible();
  const handleBox = (await turnHandle.boundingBox())!,
    handleCenter = { x: handleBox.x + handleBox.width / 2, y: handleBox.y + handleBox.height / 2 };
  const heroCenter = await screen(actor);
  await page.mouse.move(handleCenter.x, handleCenter.y);
  await page.mouse.down();
  await page.mouse.move(heroCenter.x + 90, heroCenter.y, { steps: 12 });
  await page.mouse.up();
  await expect
    .poll(
      async () =>
        (await request(owner, base + '/tokens', undefined, 'GET')).tokens.find(
          (t: any) => t.id === actor.id,
        ).revision,
    )
    .toBeGreaterThan(actor.revision);
  actor = (await request(owner, base + '/tokens', undefined, 'GET')).tokens.find(
    (t: any) => t.id === actor.id,
  );
  await page.screenshot({ path: output + '/free-rotation-no-circle.png' });
  const to = house2HouseWorld(house, {
      x: (floor.doorStart + floor.doorEnd) / 2,
      y: floor.bottom + 1,
    }),
    inside = house2HouseWorld(house, {
      x: (floor.doorStart + floor.doorEnd) / 2,
      y: floor.bottom - 1,
    });
  actor = await request(
    owner,
    base + '/tokens/' + actor.id,
    { revision: actor.revision, ...to, rotation: actor.rotation, size: actor.size },
    'PATCH',
  );
  expect(house.width).toBe(18);
  expect(house.height).toBe(18);
  await page.getByRole('button', { name: 'Atualizar tokens no mapa', exact: true }).click();
  await expect(page.locator(`[data-house2-token="${actor.id}"]`)).toHaveAttribute(
    'transform',
    `translate(${actor.x} ${actor.y})`,
  );
  await page.getByRole('button', { name: 'Localizar Aurora no mapa', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar Meus tokens', exact: true }).click();
  const ownRoof = page.locator('[data-house2-fixed="true"] [data-house2-roof]'),
    leaf = page.locator(`[data-house2-door-leaf="${lot.id}"]`);
  await expect(ownRoof).toHaveCount(1);
  await expect(leaf).toHaveCount(0);
  await expect(page.locator('.h2-map image[href*="door-vertical"]')).toHaveCount(0);
  await expect(
    page
      .getByRole('button', { name: 'Abrir porta da casa de Aurora', exact: true })
      .locator('circle'),
  ).toHaveAttribute('r', '.25');
  await expect(page.locator('[data-house2-indoor-vision]')).toHaveCount(0);
  await expect(ownRoof).toHaveAttribute('data-house2-roof-eaves', 'transparent');
  const fadedEaves = await page.screenshot({ path: output + '/eaves-transparent.png' });
  const edgePixel = await screen(house2HouseWorld(house, { x: -1, y: floor.bottom + 0.45 })),
    centerPixel = await screen(house2HouseWorld(house, { x: 0, y: 0 })),
    away = house2HouseWorld(house, {
      x: (floor.doorStart + floor.doorEnd) / 2,
      y: floor.bottom + 2.4,
    });
  await drag(actor, away);
  await expect(ownRoof).toHaveAttribute('data-house2-roof-eaves', 'solid');
  await expect
    .poll(
      async () =>
        (await request(owner, base + '/tokens', undefined, 'GET')).tokens.find(
          (t: any) => t.id === actor.id,
        ).x,
    )
    .toBeCloseTo(away.x, 2);
  await page.getByRole('button', { name: 'Fechar Meus tokens', exact: true }).click();
  const solidEaves = await page.screenshot({ path: output + '/eaves-restored.png' });
  async function pixel(data: Buffer, at: { x: number; y: number }) {
    return [
      ...(await sharp(data)
        .extract({ left: Math.round(at.x), top: Math.round(at.y), width: 1, height: 1 })
        .removeAlpha()
        .raw()
        .toBuffer()),
    ];
  }
  const edgeBefore = await pixel(fadedEaves, edgePixel),
    edgeAfter = await pixel(solidEaves, edgePixel),
    centerBefore = await pixel(fadedEaves, centerPixel),
    centerAfter = await pixel(solidEaves, centerPixel);
  expect(edgeBefore.reduce((sum, n, i) => sum + Math.abs(n - edgeAfter[i]), 0)).toBeGreaterThan(30);
  expect(
    centerBefore.reduce((sum, n, i) => sum + Math.abs(n - centerAfter[i]), 0),
  ).toBeLessThanOrEqual(3);
  actor = (await request(owner, base + '/tokens', undefined, 'GET')).tokens.find(
    (t: any) => t.id === actor.id,
  );
  await drag(actor, to);
  await expect(ownRoof).toHaveAttribute('data-house2-roof-eaves', 'transparent');
  await expect
    .poll(
      async () =>
        (await request(owner, base + '/tokens', undefined, 'GET')).tokens.find(
          (t: any) => t.id === actor.id,
        ).x,
    )
    .toBeCloseTo(to.x, 2);
  await page.getByRole('button', { name: 'Fechar Meus tokens', exact: true }).click();
  const eavesDownload = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Print da House 2.0 em alta qualidade', exact: true })
    .click();
  await (await eavesDownload).saveAs(output + '/eaves-hd.png');
  const eavesHd = await sharp(output + '/eaves-hd.png').metadata();
  expect(eavesHd.width).toBe(5760);
  expect(eavesHd.height).toBe(3600);
  const hdEdge = await pixel(await readFile(output + '/eaves-hd.png'), {
    x: edgePixel.x * 4,
    y: edgePixel.y * 4,
  });
  expect(hdEdge.reduce((sum, n, i) => sum + Math.abs(n - edgeAfter[i]), 0)).toBeGreaterThan(20);
  await page.reload();
  await page.locator('.h2-neighborhood-card').first().click();
  await expect(ownRoof).toHaveAttribute('data-house2-roof-eaves', 'transparent');
  await tool('Meus tokens');
  await page.getByRole('button', { name: 'Localizar Aurora no mapa', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar Meus tokens', exact: true }).click();
  actor = (await request(owner, base + '/tokens', undefined, 'GET')).tokens.find(
    (t: any) => t.id === actor.id,
  );
  await page.screenshot({ path: output + '/outside-roof.png' });
  await drag(actor, inside);
  await expect(ownRoof).toHaveCount(1);
  await page.getByRole('button', { name: 'Fechar Meus tokens', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir porta da casa de Aurora', exact: true }).click();
  await expect(leaf).toHaveCount(0);
  state = await request(owner, base + '/tokens', undefined, 'GET');
  actor = state.tokens.find((t: any) => t.id === actor.id);
  await drag(actor, inside);
  await expect(ownRoof).toHaveCount(0);
  await expect(page.locator('[data-house2-indoor-vision]')).toHaveCount(1);
  await expect
    .poll(
      async () =>
        (await request(owner, base + '/tokens', undefined, 'GET')).tokens.find(
          (t: any) => t.id === actor.id,
        ).x,
    )
    .toBeCloseTo(inside.x, 2);
  await page.getByRole('button', { name: 'Fechar Meus tokens', exact: true }).click();
  await expect(leaf).toHaveCount(1);
  await expect(leaf).toHaveAttribute('data-door-open', 'true');
  await expect(leaf.locator('image')).toHaveAttribute('href', house2Houses[0].interior);
  await page.getByRole('button', { name: 'Fechar porta da casa de Aurora', exact: true }).click();
  await expect.poll(async () => Number(await leaf.getAttribute('data-door-angle'))).toBe(0);
  const hinge = () =>
    leaf.evaluate((g) => {
      const m = (g as SVGGElement).getScreenCTM()!;
      return { x: m.e, y: m.f };
    });
  const before = await hinge();
  await page.getByRole('button', { name: 'Abrir porta da casa de Aurora', exact: true }).click();
  await expect
    .poll(async () => Number(await leaf.getAttribute('data-door-angle')), { intervals: [25, 40] })
    .toBeGreaterThan(5);
  expect(Number(await leaf.getAttribute('data-door-angle'))).toBeLessThan(90);
  await page.screenshot({ path: output + '/door-opening.png' });
  await expect.poll(async () => Number(await leaf.getAttribute('data-door-angle'))).toBe(90);
  const after = await hinge();
  expect(Math.abs(after.x - before.x)).toBeLessThan(0.1);
  expect(Math.abs(after.y - before.y)).toBeLessThan(0.1);
  const outside = await screen(house2HouseWorld(house, { x: floor.left - 2, y: 0 }));
  const screenshot = await page.screenshot({ path: output + '/inside-hidden-exterior.png' });
  const pixels = await sharp(screenshot).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const offset = (Math.round(outside.y) * pixels.info.width + Math.round(outside.x)) * 3;
  expect([...pixels.data.subarray(offset, offset + 3)]).toEqual([9, 13, 17]);
  const download = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Print da House 2.0 em alta qualidade', exact: true })
    .click();
  await (await download).saveAs(output + '/inside-hd.png');
  const hd = await sharp(output + '/inside-hd.png').metadata();
  expect(hd.width).toBe(5760);
  expect(hd.height).toBe(3600);
  // A second click must end character vision, even while another own pet exists.
  await actorNode.locator('image').click();
  await expect(page.locator('[data-house2-indoor-vision]')).toHaveCount(0);
  await expect(page.locator('[data-house2-token][data-token-selected="true"]')).toHaveCount(0);
  await expect(ownRoof).toHaveCount(1);
  const overview = await page.screenshot({ path: output + '/deselected-map-visible.png' });
  expect([
    ...(await sharp(overview)
      .extract({ left: Math.round(outside.x), top: Math.round(outside.y), width: 1, height: 1 })
      .removeAlpha()
      .raw()
      .toBuffer()),
  ]).not.toEqual([9, 13, 17]);
  await page.getByRole('button', { name: 'Atualizar tokens no mapa', exact: true }).click();
  await expect(page.locator('[data-house2-indoor-vision]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Entrar na casa de Aurora', exact: true }).click();
  await expect(ownRoof).toHaveCount(0);
  await expect(page.locator('[data-house2-indoor-vision]')).toHaveCount(0);
  await page.screenshot({ path: output + '/inspect-without-darkness.png' });
  await page.getByRole('button', { name: 'Sair da casa de Aurora', exact: true }).click();
  await page.getByRole('button', { name: 'Localizar Aurora no mapa', exact: true }).click();
  await expect(page.locator('[data-house2-indoor-vision]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Fechar Meus tokens', exact: true }).click();
  await page.reload();
  await page.locator('.h2-neighborhood-card').first().click();
  await expect(page.locator('[data-house2-indoor-vision]')).toHaveCount(0);
  await expect(ownRoof).toHaveCount(1);
  await tool('Meus tokens');
  await page.getByRole('button', { name: 'Localizar Aurora no mapa', exact: true }).click();
  await expect(page.locator('[data-house2-indoor-vision]')).toHaveCount(1);
  await expect(ownRoof).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar Meus tokens', exact: true }).click();
  state = await request(owner, base + '/tokens', undefined, 'GET');
  actor = state.tokens.find((t: any) => t.id === actor.id);
  await drag(actor, to);
  await expect(ownRoof).toHaveCount(1);
  await expect(page.locator('[data-house2-indoor-vision]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Fechar Meus tokens', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar porta da casa de Aurora', exact: true }).click();
  await expect(leaf).toHaveCount(0);
  await page.locator(`g[data-house2-plot="${lot.id}"] > .h2-plot`).focus();
  await page.keyboard.press('Enter');
  await tool('Minha coleção');
  await expect(ownRoof).toHaveCount(0);
  await expect(page.locator('[data-house2-indoor-vision]')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Ocultar telhado ao editar', exact: true }).uncheck();
  await expect(ownRoof).toHaveCount(1);
  await page.getByRole('checkbox', { name: 'Ocultar telhado ao editar', exact: true }).check();
  await expect(ownRoof).toHaveCount(0);
  await page.screenshot({ path: output + '/owner-edit-roof.png' });
  await page.getByRole('button', { name: 'Fechar Minha coleção', exact: true }).click();
  await peer.goto(origin + '/#house2');
  await peer.locator('.h2-neighborhood-card').first().click();
  await expect(peer.locator(`[data-house2-token="${actor.id}"]`)).toHaveAttribute(
    'data-token-control',
    'visitor',
  );
  await expect(peer.locator('[data-house2-fixed="true"] [data-house2-roof]')).toHaveCount(1);
  const forbidden = await visitor.request.patch(origin + '/api' + base + '/tokens/' + actor.id, {
    headers: { Origin: origin },
    data: { revision: actor.revision, x: actor.x, y: actor.y, rotation: 0, size: 1 },
  });
  expect(forbidden.status()).toBe(403);
  await tool('Meus tokens');
  const widths = [1440, 768, 390, 320];
  for (const width of widths) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    await expect(
      page.getByRole('button', { name: 'Localizar Aurora no mapa', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `${output}/library-${width}.png` });
  }
  await page.getByRole('searchbox', { name: 'Buscar meus tokens', exact: true }).fill('Luar');
  await expect(page.locator('.h2-token-source')).toHaveCount(1);
  await page.getByRole('button', { name: 'Localizar Luar no mapa', exact: true }).click();
  await page.getByRole('button', { name: 'Retirar Luar do mapa', exact: true }).click();
  await expect(page.locator('[data-house2-token]')).toHaveCount(1);
  expect((await pool.query('SELECT id FROM character_pets WHERE id=$1', [pet.id])).rowCount).toBe(
    1,
  );
  expect(errors).toEqual([]);
  await writeFile(
    output + '/result.json',
    JSON.stringify(
      {
        passed: true,
        tokensAndPets: true,
        libraryDragImport: true,
        freeRotation: true,
        selectionCircleRemoved: true,
        clickAgainDeselects: true,
        originalDoorOnly: true,
        smallDoorControl: true,
        rotatedHouse: 270,
        eavesRevealAndRestore: true,
        eavesPixelDifference: edgeBefore.reduce((sum, n, i) => sum + Math.abs(n - edgeAfter[i]), 0),
        roofCenterPreserved: true,
        eavesAfterReload: true,
        eavesInHdCapture: true,
        deselectRestoresMap: true,
        manualInspectWithoutDarkness: true,
        reloadWithoutSelectionShowsMap: true,
        persistence: true,
        visitorReadOnly: true,
        ownerRoofEditing: true,
        largerYards: true,
        automaticRoof: true,
        doorAnimation: true,
        wallsAndClosedDoor: true,
        indoorExteriorHidden: true,
        originalPetsPreserved: true,
        hd: { width: hd.width, height: hd.height },
        viewports: widths,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS House 2.0: personagens/pets, arraste, permissões, persistência, telhado automático, animação de porta, visão interna e captura HD.',
  );
} finally {
  await owner.close();
  await visitor.close();
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
