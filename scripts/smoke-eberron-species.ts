import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { defaultChoices } from '../shared/character-sheet.js';
import { eberronSpecies } from '../shared/eberron-species.js';
import { classes } from '../shared/rules.js';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco UUID descartável requerido.');
const origin = 'http://localhost:3054';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
await migrate();
const { seed } = await import('../server/seed.js');
await seed();
const { createApp } = await import('../server/app.js');
const { auth } = await import('../server/auth.js');
const { finishTestArt, testArtImage } = await import('../tests/character-fixtures.js');
const env = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';
const server = createApp().listen(3054, '127.0.0.1');
process.env.NODE_ENV = env;
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results: unknown[] = [];
await mkdir('test-results/eberron', { recursive: true });
try {
  for (const race of Object.keys(eberronSpecies)) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
      extraHTTPHeaders: { 'Accept-Encoding': 'identity' },
    });
    const page = await context.newPage(),
      errors: string[] = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', (e) => errors.push(e.message));
    await context.addInitScript(() => {
      localStorage.setItem('alvorada-music-muted', 'true');
      localStorage.setItem('alvorada-effects-muted', 'true');
    });
    const signup = await auth.api.signUpEmail({
      body: {
        name: 'Teste Eberron',
        email: randomUUID() + '@example.test',
        password: 'Test-' + randomUUID(),
      },
      returnHeaders: true,
    });
    for (const header of signup.headers.getSetCookie()) {
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
    await page.goto(origin + '/#profile');
    await page.getByRole('button', { name: 'Criar personagem', exact: true }).click();
    await page.getByLabel('Espécie', { exact: true }).selectOption(race);
    await expect(page.getByLabel('Espécie', { exact: true })).toHaveValue(race);
    await expect(page.locator('.character-creation-form')).toContainText(
      'Eberron: Forge of the Artificer (2025)',
    );
    if (race === 'Warforged') {
      await page.getByLabel('Antecedente', { exact: true }).selectOption('Soldado');
      for (const cls of classes) {
        await page.getByLabel('Classe', { exact: true }).selectOption(cls);
        const options = await page
          .getByLabel('Perícia do projeto especializado', { exact: true })
          .locator('option')
          .allTextContents();
        expect(options).not.toContain('Atletismo');
        expect(options).not.toContain('Intimidação');
      }
      await page.getByLabel('Classe', { exact: true }).selectOption('Guerreiro');
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      await page.screenshot({ path: `test-results/eberron/${race}-${width}.png`, fullPage: true });
    }
    // Exercise the same art-backed creation route as the form, then reload persisted data.
    await pool.query(
      'INSERT INTO character_art_worker(id,available,heartbeat_at) VALUES(true,true,now()) ON CONFLICT(id) DO UPDATE SET available=true,heartbeat_at=now()',
    );
    if (race === 'Warforged') {
      const choices = defaultChoices(race, 'Guerreiro', 'Soldado');
      const invalid = await context.request.post(origin + '/api/character-art', {
        headers: { Origin: origin },
        data: {
          creation: {
            name: 'Perícia repetida',
            race,
            class: 'Guerreiro',
            background: 'Soldado',
            choices: { ...choices, options: { ...choices.options, racialSkills: ['Atletismo'] } },
          },
          reference: (await testArtImage()).toString('base64'),
          idempotency_key: randomUUID(),
        },
      });
      expect(invalid.status()).toBe(400);
    }
    const response = await context.request.post(origin + '/api/character-art', {
      headers: { Origin: origin },
      data: {
        creation: {
          name: race + ' Teste',
          race,
          class: 'Guerreiro',
          background: 'Soldado',
          biography: '',
          choices: defaultChoices(race, 'Guerreiro', 'Soldado'),
        },
        reference: (await testArtImage()).toString('base64'),
        idempotency_key: randomUUID(),
      },
    });
    expect(response.ok(), await response.text()).toBe(true);
    const job = await response.json();
    const id = await finishTestArt(job.id);
    const persisted = await context.request.get(origin + `/api/characters/${id}/sheet`);
    expect(persisted.ok()).toBe(true);
    expect((await persisted.json()).sheet.choices.species).toBe(race);
    expect(errors).toEqual([]);
    results.push({
      race,
      persisted: true,
      desktop: true,
      mobile: true,
      duplicateSkillsHidden: race === 'Warforged',
    });
    await context.close();
  }
  await writeFile(
    'test-results/eberron/result.json',
    JSON.stringify({ passed: true, results }, null, 2),
  );
  console.log(JSON.stringify({ passed: true, results }));
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
