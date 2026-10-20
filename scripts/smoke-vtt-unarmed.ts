import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { defaultChoices } from '../shared/character-sheet.js';
import { UNARMED_ATTACK_ID } from '../shared/unarmed-attack.js';
import { vttProtocolVersion } from '../shared/vtt-protocol.js';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3031';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter, testArtImage, testTokenImage } =
  await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3031, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
  extraHTTPHeaders: { 'X-Vtt-Schema-Version': String(vttProtocolVersion) },
});
const page = await context.newPage(),
  errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
const request = async (path: string, data?: unknown, method = data ? 'POST' : 'GET') => {
  const res = await context.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  expect(res.ok(), await res.text()).toBe(true);
  return res.json();
};
try {
  await context.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
  const account = await request('/auth/sign-up/email', {
    name: 'Mestre desarmado',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  const c = await createLegacyTestCharacter(account.user.id, 'Lutador desarmado');
  await pool.query('UPDATE characters SET stats=$2 WHERE id=$1', [
    c.id,
    JSON.stringify([14, 12, 14, 10, 10, 10]),
  ]);
  await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)', [
    c.id,
    await testArtImage(),
  ]);
  await pool.query('INSERT INTO character_tokens(character_id,image)VALUES($1,$2)', [
    c.id,
    await testTokenImage(),
  ]);
  const listing = await request('/vtt'),
    rid = listing.personal.room_id,
    root = '/vtt/rooms/' + rid;
  const imported = await request(root + '/characters/' + c.id, {});
  const token = imported.document.scenes[0].tokens.find((t: any) => t.characterId === c.id),
    url = root + '/sheets/' + token.id;
  const punchOnly = (sheet: any) => {
    expect(sheet.attacks.map((a: any) => a.itemId)).toEqual([UNARMED_ATTACK_ID]);
    expect(sheet.attacks[0]).toMatchObject({ name: 'Soco', attack: 4, dice: '1', ability: 2 });
  };
  punchOnly(await request(url)); // Legacy character without finalized origin.
  const outsider = await browser.newContext();
  const denied = await outsider.request.get(origin + '/api' + url);
  expect(denied.status()).toBe(401);
  await outsider.close();
  await pool.query(
    'INSERT INTO character_sheets(character_id,choices,rolls,assignment,finalized_at)VALUES($1,$2,$3,$4,now())',
    [
      c.id,
      JSON.stringify(defaultChoices(c.race, c.class)),
      JSON.stringify(Array(6).fill([3, 3, 4, 4])),
      JSON.stringify([0, 1, 2, 3, 4, 5]),
    ],
  );
  punchOnly(await request(url));
  await pool.query(
    "INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,'flail',1),($1,'shield',1),($1,'dagger',1),($1,'greatsword',1)",
    [c.id],
  );
  punchOnly(await request(url)); // Owning an unequipped weapon does not hide Soco.
  await pool.query(
    "INSERT INTO character_equipment(character_id,item_id,slot)VALUES($1,'shield','off_hand')",
    [c.id],
  );
  punchOnly(await request(url)); // Shields are not weapons.
  await page.goto(origin + '/#vtt');
  await expect(page.getByLabel('Tabuleiro da mesa', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fichas', exact: true }).click();
  await page.getByRole('button', { name: 'Personagens', exact: true }).click();
  await page.locator(`[data-room-character="${c.id}"]`).click();
  const board = page.getByLabel('Tabuleiro da mesa', { exact: true }),
    box = (await board.boundingBox())!;
  const cam = await board.evaluate((el) => ({
    x: Number(el.getAttribute('data-camera-x')),
    y: Number(el.getAttribute('data-camera-y')),
    z: Number(el.getAttribute('data-camera-zoom')),
  }));
  await board.click({
    position: {
      x: box.width / 2 + (token.x - cam.x) * cam.z,
      y: box.height / 2 + (token.y - cam.y) * cam.z,
    },
  });
  await page.getByRole('button', { name: 'Abrir folha completa', exact: true }).click();
  const card = page.locator('.vtt-sheet-attacks article').filter({ hasText: 'Soco' });
  await expect(card).toBeVisible();
  await expect(card.locator('img')).toHaveAttribute('src', /unarmed.webp/);
  await card.getByRole('button', { name: '1+2', exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await pool.query(
            "SELECT roll->>'total' total FROM vtt_messages WHERE room_id=$1 AND roll IS NOT NULL ORDER BY id DESC LIMIT 1",
            [rid],
          )
        ).rows[0]?.total,
    )
    .toBe('3');
  await card.getByRole('button', { name: 'Fixar Soco', exact: true }).click();
  const shortcut = page.getByRole('button', { name: 'Atalho 1 · Soco', exact: true });
  await expect(shortcut.locator('img')).toHaveAttribute('src', /unarmed.webp/);
  const weapons = page.getByLabel('Arma na mesa', { exact: true });
  await weapons.selectOption('flail');
  await expect(card).toBeVisible();
  expect((await request(url)).attacks.map((a: any) => a.itemId)).toEqual([
    'flail',
    UNARMED_ATTACK_ID,
  ]);
  const offHand = page.getByLabel('Arma secundária na mesa', { exact: true });
  await offHand.selectOption('dagger');
  await expect(card).toHaveCount(0);
  await weapons.selectOption('greatsword');
  await expect(card).toHaveCount(0);
  await expect(offHand).toBeDisabled();
  await weapons.selectOption('');
  await expect(card).toBeVisible();
  await weapons.selectOption('greatsword');
  await page.getByRole('button', { name: 'Fechar Ficha · ' + c.name, exact: true }).click();
  await shortcut.click(); // Pinned Soco switches only the room to empty hands.
  await expect(page.locator('.vtt-attack-inline')).toBeVisible();
  punchOnly(await request(url));
  await expect(page.getByLabel('Animação do ataque', { exact: true })).toHaveValue('auto');
  await page.getByRole('button', { name: 'Rolar dano separado', exact: true }).click();
  await expect
    .poll(
      async () =>
        (
          await pool.query(
            "SELECT roll->>'formula' formula FROM vtt_messages WHERE room_id=$1 AND roll IS NOT NULL ORDER BY id DESC LIMIT 1",
            [rid],
          )
        ).rows[0]?.formula,
    )
    .toBe('1+2');
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/vtt-unarmed-desktop.png' });
  await page.getByRole('button', { name: 'Fechar atalho', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir folha completa', exact: true }).click();
  await expect(card).toBeVisible();
  await weapons.selectOption('flail');
  await offHand.selectOption('dagger');
  await expect(card).toHaveCount(0);
  await pool.query("DELETE FROM inventory WHERE character_id=$1 AND item_id='flail'", [c.id]);
  await expect(card).toBeVisible({ timeout: 12000 });
  for (const width of [768, 390]) {
    await page.setViewportSize({ width, height: 950 });
    await expect(card).toBeVisible();
  }
  await page.screenshot({ path: 'test-results/vtt-unarmed-mobile.png' });
  expect(
    (await pool.query('SELECT item_id FROM character_equipment WHERE character_id=$1', [c.id]))
      .rows,
  ).toEqual([{ item_id: 'shield' }]);
  expect(
    (
      await pool.query(
        'SELECT count(*)::int n FROM inventory WHERE character_id=$1 AND item_id=$2',
        [c.id, UNARMED_ATTACK_ID],
      )
    ).rows[0].n,
  ).toBe(0);
  expect(errors).toEqual([]);
  console.log(
    'PASS Soco sem armas/sem equipamento/com escudo, legado, troca/remoção, acerto/dano, atalho com ícone, estoque preservado e desktop/celular.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => {
    server.closeAllConnections();
    server.close(() => r());
  });
  await pool.end();
}
