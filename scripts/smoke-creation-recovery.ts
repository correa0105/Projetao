import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { defaultChoices } from '../shared/character-sheet.js';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3054';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js');
await migrate();
await seed();
const { auth } = await import('../server/auth.js'),
  { createApp } = await import('../server/app.js'),
  { testArtImage } = await import('../tests/character-fixtures.js');
process.env.NODE_ENV = 'production';
const server = createApp().listen(3054, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
      reducedMotion: 'reduce',
    }),
    page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await context.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
  const account = await auth.api.signUpEmail({
    body: {
      name: 'Criação recuperada',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    },
    returnHeaders: true,
  });
  for (const header of account.headers.getSetCookie()) {
    const first = header.split(';')[0],
      at = first.indexOf('=');
    await context.addCookies([
      {
        name: first.slice(0, at),
        value: first.slice(at + 1),
        url: origin,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  }
  const id = randomUUID(),
    creation = {
      name: 'Artorias salvo',
      race: 'Warforged',
      class: 'Bárbaro',
      biography: 'Toda a minha história permanece salva.\nCom acentos e uma segunda linha.',
      background: 'Soldado',
      choices: defaultChoices('Warforged', 'Bárbaro', 'Soldado'),
    };
  await pool.query(
    "INSERT INTO character_art_jobs(id,user_id,creation,reference,approved_portrait,status,idempotency_key,error) VALUES($1,$2,$3,$4,$4,'failed',$5,'A miniatura do VTT não foi aprovada.')",
    [id, account.response.user.id, JSON.stringify(creation), await testArtImage(), randomUUID()],
  );
  await pool.query(
    'INSERT INTO character_art_worker(id,available,heartbeat_at)VALUES(true,true,now()) ON CONFLICT(id)DO UPDATE SET available=true,heartbeat_at=now()',
  );
  await page.goto(origin + '/#characters');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Artorias salvo: criação salva' })).toBeVisible();
  await page.getByRole('button', { name: 'Retomar preenchimento' }).click();
  await expect(page.getByLabel('Nome do personagem')).toHaveValue(creation.name);
  await expect(page.getByLabel('Sua história')).toHaveValue(creation.biography);
  await expect(page.getByLabel('Espécie', { exact: true })).toHaveValue('Warforged');
  await expect(page.getByLabel('Classe', { exact: true })).toHaveValue('Bárbaro');
  await expect(page.getByLabel('Antecedente', { exact: true })).toHaveValue('Soldado');
  await mkdir('test-results/creation-recovery', { recursive: true });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({
      path: 'test-results/creation-recovery/restored-' + width + '.png',
      fullPage: true,
    });
  }
  await page.getByRole('dialog').getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Tentar novamente sem preencher tudo' }).click();
  await expect
    .poll(
      async () =>
        (await pool.query('SELECT status FROM character_art_jobs WHERE id=$1', [id])).rows[0]
          .status,
    )
    .toBe('queued');
  const saved = (
    await pool.query(
      'SELECT creation,reference,approved_portrait FROM character_art_jobs WHERE id=$1',
      [id],
    )
  ).rows[0];
  expect(saved.creation).toEqual(creation);
  expect(saved.reference).not.toBeNull();
  expect(saved.approved_portrait).not.toBeNull();
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/creation-recovery/result.json',
    JSON.stringify(
      {
        passed: true,
        historyRestored: true,
        choicesRestored: true,
        imagePreserved: true,
        retrySameJob: true,
        widths: [1440, 390],
        errors,
      },
      null,
      2,
    ),
  );
  console.log(
    'PASS reload, saved history/choices/image, restored form and retry without duplicate.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
