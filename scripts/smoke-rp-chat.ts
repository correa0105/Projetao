import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { rpFloorScale } from '../shared/rp-perspective';
if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório');
const origin = 'http://localhost:3067';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures');
await migrate();
await seed();
const { createApp } = await import('../server/app');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3067, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  out = 'test-results/rp-chat';
await mkdir(out, { recursive: true });
const errors: string[] = [];
try {
  const contexts = await Promise.all(
    [0, 1].map(() =>
      browser.newContext({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: 'reduce',
        extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
      }),
    ),
  );
  const pages = await Promise.all(contexts.map((c) => c.newPage())),
    accounts: any[] = [],
    characters: any[] = [];
  for (const [i, page] of pages.entries()) {
    page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('response', async (response) => {
      if (response.url().includes('/api/rp-lobby/') && response.status() >= 400)
        console.log(
          'RP response',
          response.status(),
          response.url(),
          await response.text().catch(() => ''),
        );
    });
    await page.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin || url.pathname.startsWith('/api/')) return route.continue();
      const file = resolve('public', '.' + decodeURIComponent(url.pathname));
      if (file.startsWith(resolve('public')) && (await stat(file).catch(() => null))?.isFile())
        return route.fulfill({ path: file });
      return route.continue();
    });
    await page.goto(origin);
    const signup = await page.request.post(origin + '/api/auth/sign-up/email', {
      headers: { Origin: origin },
      data: {
        name: i ? 'Mira' : 'Arden',
        email: 'rp-chat-' + randomUUID() + '@example.test',
        password: 'Test-' + randomUUID(),
      },
    });
    expect(signup.status()).toBe(200);
    accounts.push((await signup.json()).user);
    characters.push(await createLegacyTestCharacter(accounts[i].id, i ? 'Mira' : 'Arden'));
    await pool.query('INSERT INTO character_portraits(character_id,image) VALUES($1,$2)', [
      characters[i].id,
      await readFile('public/character-silhouette-v2.png'),
    ]);
  }
  const [page, guest] = pages;
  const rooms = await page.request.get(origin + '/api/rp-lobby').then((r) => r.json()),
    room = rooms.rooms.find((r: any) => r.document.scene === 'market'),
    rid = room.id;
  for (let i = 0; i < 30; i++)
    await pool.query(
      "INSERT INTO rp_room_messages(room_id,user_id,character_id,body,request_id,created_at) VALUES($1,$2,$3,$4,$5,now()-interval '10 minutes')",
      [rid, accounts[1].id, characters[1].id, 'Histórico antigo ' + i, randomUUID()],
    );
  for (const p of pages) {
    await p.goto(origin + '/#house?room=' + rid);
    await p.reload();
    await expect(p.locator('.rp-actor.is-self')).toHaveCount(1);
  }
  await expect(page.locator('.rp-speech-bubble')).toHaveCount(0);
  await expect(page.locator('.rp-actor')).toHaveCount(2);
  for (const actorImage of await page.locator('.rp-actor img').all())
    await expect.poll(()=>actorImage.evaluate(n=>(n as HTMLImageElement).complete && (n as HTMLImageElement).naturalHeight>0)).toBe(true);
  await expect(page.locator('.rp-messages')).toContainText('Histórico antigo 29');
  const input = guest.getByLabel('Sua mensagem de RP');
  await input.fill('Mira cumprimenta Arden no mercado.');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  await expect(input).toBeFocused();
  const bubble = page.locator('.rp-speech-bubble[data-speaker="' + accounts[1].id + '"]');
  await expect(bubble).toContainText('Mira cumprimenta');
  await expect(bubble).toBeVisible();
  const rect = await bubble.boundingBox(),
    actor = await page.locator('[data-rp-actor="' + accounts[1].id + '"] img').boundingBox();
  expect(rect!.y + rect!.height).toBeLessThan(actor!.y + 1);
  await page.screenshot({ path: out + '/chat-desktop.png', fullPage: true });
  await page.reload();
  await expect(page.locator('.rp-actor')).toHaveCount(2);
  await expect(page.locator('.rp-speech-bubble')).toHaveCount(0);
  // Browsing history must not jump to the bottom when a new line arrives.
  const log = page.getByRole('log', { name: 'Histórico de RP' });
  await log.hover();
  await log.evaluate((el) => (el.scrollTop = 0));
  await expect.poll(() => log.evaluate((el) => el.scrollTop)).toBe(0);
  await input.fill('Uma segunda fala preserva o histórico.');
  await input.press('Enter');
  await expect(page.locator('.rp-speech-bubble')).toContainText('Uma segunda fala');
  await expect.poll(() => log.evaluate((el) => el.scrollTop)).toBe(0);
  await page.waitForTimeout(12500);
  await expect(page.locator('.rp-speech-bubble')).toHaveCount(0);
  const self = page.locator('[data-rp-actor="' + accounts[0].id + '"]'),
    img = self.locator('img');
  const ratios: number[] = [];
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(async () => {
        const r = await img.boundingBox();
        return !!r && r.x + r.width / 2 > 0 && r.x + r.width / 2 < width;
      })
      .toBe(true);
    const original = (await img.boundingBox())!,
      stage = (await page.locator('.rp-stage').boundingBox())!;
    const ax = 0.45,
      ay = 0.3,
      point = { x: original.x + ax * original.width, y: original.y + ay * original.height };
    const saved = (
        await pool.query('SELECT x,y FROM rp_room_presence WHERE room_id=$1 AND user_id=$2', [
          rid,
          accounts[0].id,
        ])
      ).rows[0],
      factor = rpFloorScale(Number(saved.y), 'market');
    const grab = {
      x: (point.x - stage.x - Number(saved.x) * stage.width) / factor,
      y: (point.y - stage.y - Number(saved.y) * stage.height) / factor,
    };
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.waitForTimeout(180);
    const down = (await img.boundingBox())!;
    expect(Math.abs(down.x - original.x)).toBeLessThan(1);
    expect(Math.abs(down.y - original.y)).toBeLessThan(1);
    let far = 0,
      near = 0;
    for (const y of [0.55, 0.9]) {
      const scale = rpFloorScale(y, 'market'),
        desired = {
          x: stage.x + Number(saved.x) * stage.width + grab.x * scale,
          y: stage.y + y * stage.height + grab.y * scale,
        };
      await page.mouse.move(desired.x, desired.y, { steps: 8 });
      const actual = (await img.boundingBox())!;
      expect(Math.abs(actual.x + ax * actual.width - desired.x)).toBeLessThan(2);
      expect(Math.abs(actual.y + ay * actual.height - desired.y)).toBeLessThan(2);
      if (y === 0.55) far = actual.width;
      else near = actual.width;
    }
    await page.mouse.up();
    ratios.push(far / near);
    expect(far / near).toBeLessThan(0.4);
    await expect
      .poll(async () =>
        Number(
          (
            await pool.query('SELECT y FROM rp_room_presence WHERE room_id=$1 AND user_id=$2', [
              rid,
              accounts[0].id,
            ])
          ).rows[0].y,
        ),
      )
      .toBeCloseTo(0.9, 4);
    if (
      width === 390 &&
      (await page.getByRole('button', { name: /^RP ·/ }).getAttribute('aria-pressed')) !== 'true'
    ) {
      await page.getByRole('button', { name: /^RP ·/ }).click();
    }
    await page.screenshot({ path: out + '/perspective-' + width + '.png', fullPage: true });
  }
  const ownInput = page.getByLabel('Sua mensagem de RP');
  await ownInput.fill('Fala protegida durante falha de conexão.');
  const pattern = '**/api/rp-lobby/' + rid + '/messages';
  await page.route(
    pattern,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Falha simulada' }),
      }),
    { times: 1 },
  );
  await ownInput.press('Enter');
  await expect(page.getByRole('alert')).toContainText('Falha simulada');
  await expect(ownInput).toHaveValue('Fala protegida durante falha de conexão.');
  await page.reload();
  await page.getByRole('button', { name: /^RP ·/ }).click();
  await expect(ownInput).toHaveValue('Fala protegida durante falha de conexão.');
  await ownInput.press('Enter');
  await expect(ownInput).toHaveValue('');
  await expect(
    page.locator('.rp-speech-bubble[data-speaker="' + accounts[0].id + '"]'),
  ).toContainText('Fala protegida');
  await page.screenshot({ path: out + '/chat-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
  await writeFile(
    out + '/result.json',
    JSON.stringify(
      {
        passed: true,
        twoPlayers: true,
        houseStyleChat: true,
        bubbles: true,
        noHistoryReplay: true,
        bubbleExpires: true,
        scrollPreserved: true,
        noClickJump: true,
        grabPointPreserved: true,
        perspective: true,
        perspectiveRatios: ratios,
        draftRecovery: true,
        widths: [1440, 768, 390],
        errors,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
