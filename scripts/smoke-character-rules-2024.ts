import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { legalAdvance, originFixture, advanceFixture } from '../tests/advancement-fixtures';
import { deriveSheet, spells, type SheetResponse } from '../shared/character-sheet';
import { levelPlan, type AdvanceChoice } from '../shared/character-advancement';
declare global {
  interface Window {
    __screenRecorderTest: { picks: number; cancel: boolean; stream?: MediaStream };
  }
}
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco UUID descartável requerido.');
const origin = 'http://localhost:3054';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db');
const { migrate } = await import('../server/migrate');
const { seed } = await import('../server/seed');
await migrate();
await seed();
const { createApp } = await import('../server/app');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures');
const qaEnvironment = process.env.NODE_ENV;
process.env.NODE_ENV = 'production';
const server = createApp().listen(3054, '127.0.0.1');
process.env.NODE_ENV = qaEnvironment;
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  page = await context.newPage();
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));
await context.addInitScript(() => {
  localStorage.setItem('alvorada-music-muted', 'true');
  localStorage.setItem('alvorada-effects-muted', 'true');
});
async function req(path: string, data?: unknown) {
  const r = await context.request.fetch(origin + '/api' + path, {
    method: data ? 'POST' : 'GET',
    headers: { Origin: origin },
    data,
  });
  expect(r.ok(), await r.text()).toBe(true);
  return r.json();
}
async function bounds() {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
  ).toBe(true);
}
try {
  const pageHeaders = await page.request.get(origin);
  expect(pageHeaders.headers()['content-security-policy']).toContain("media-src 'self' blob:");
  const u = (
    await req('/auth/sign-up/email', {
      name: 'Evolução visual',
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    })
  ).user;
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [u.id]);
  const hero = await createLegacyTestCharacter(u.id, 'Liora'),
    f = originFixture('Mago');
  Object.assign(hero, f.character);
  const d = deriveSheet(hero, f.choices);
  await pool.query(
    'UPDATE characters SET race=$2,class=$3,stats=$4,hp=$5,armor_class=$6,gold_cp=100000 WHERE id=$1',
    [hero.id, hero.race, hero.class, JSON.stringify(hero.stats), d.hp, d.armorClass],
  );
  await pool.query(
    'INSERT INTO character_sheets(character_id,choices,rolls,assignment,finalized_at,current_hp) VALUES($1,$2,$3,$4,now(),$5)',
    [
      hero.id,
      JSON.stringify(f.choices),
      JSON.stringify(Array(6).fill([4, 4, 4, 4])),
      JSON.stringify([0, 1, 2, 3, 4, 5]),
      d.hp,
    ],
  );
  await mkdir('test-results/advancement', { recursive: true });
  await page.goto(origin + '/#profile');
  await expect(
    page.getByRole('button', { name: 'Conceder nível (ADM)', exact: true }),
  ).toBeVisible();
  async function evolve(cls: string, boostCon = false, subclass?: string) {
    const sheet: SheetResponse = await req(`/characters/${hero.id}/sheet`);
    const current = (await pool.query('SELECT * FROM characters WHERE id=$1', [hero.id]))
      .rows[0];
    const next = legalAdvance(current, sheet.sheet!.choices!, cls, subclass);
    if (boostCon) next.boosts = [0, 0, 2, 0, 0, 0];
    await page.getByRole('button', { name: 'Conceder nível (ADM)', exact: true }).click();
    const modal = page.getByRole('dialog');
    await modal.getByLabel('Classe deste nível').selectOption(cls);
    if (cls === 'Guerreiro' && next.subclass)
      expect(
        await modal.getByLabel('Subclasse', { exact: true }).locator('option').count(),
      ).toBe(6);
    if (next.subclass)
      await modal.getByLabel('Subclasse', { exact: true }).selectOption(next.subclass);
    const plan = levelPlan(current, sheet.sheet!.choices!, next);
    async function checks(label: string, values: string[]) {
      const group = modal
        .locator('.sheet-choice')
        .filter({ has: page.locator('legend').filter({ hasText: label }) });
      for (const v of values)
        await group
          .getByRole('checkbox', {
            name: spells.find((s) => s.id === v)?.label || v,
            exact: true,
          })
          .check();
    }
    for (const field of plan.fields) await checks(field.label, next.choices[field.key] || []);
    if (plan.asi)
      for (let i = 0; i < 6; i++)
        await modal
          .getByLabel(
            `Melhoria de ${['Força', 'Destreza', 'Constituição', 'Inteligência', 'Sabedoria', 'Carisma'][i]}`,
            { exact: true },
          )
          .selectOption(String(next.boosts[i]));
    if (plan.newCantrips) await checks('Novos truques', next.newCantrips);
    if (plan.newSpells) await checks('Novas magias', next.newSpells);
    if (plan.bonusCount) await checks('Magias adicionais da subclasse', next.bonusSpells);
    await bounds();
    await page.screenshot({
      path: `test-results/advancement/level-${current.level + 1}-${cls}.png`,
    });
    await modal.getByRole('button', { name: 'Confirmar evolução', exact: true }).click();
    await expect(modal).toHaveCount(0);
    await expect(page.locator('.sheet-rank-level')).toContainText(String(current.level + 1));
    return (await req(`/characters/${hero.id}/sheet`)) as SheetResponse;
  }
  await evolve('Mago');
  const third = await evolve('Mago');
  expect(third.derived!.classLevels[0].subclass).toBe('evoker');
  await evolve('Guerreiro');
  const fifth = await evolve('Mago', true);
  expect(fifth.derived!.classLevels.map((s) => [s.class, s.level])).toEqual([
    ['Mago', 4],
    ['Guerreiro', 1],
  ]);
  expect(fifth.derived!.proficiency).toBe(3);
  expect(fifth.derived!.hp).toBe(39);
  await page.getByRole('tab', { name: 'Magias', exact: true }).click();
  const prepared = page
    .locator('.sheet-choice')
    .filter({ has: page.locator('legend').filter({ hasText: 'Preparadas de Mago' }) });
  const tier2 = fifth.derived!.magicClasses[0].known.find(
    (id) => spells.find((s) => s.id === id)?.level === 2,
  )!;
  await prepared
    .getByRole('checkbox', { name: spells.find((s) => s.id === tier2)!.label, exact: true })
    .check();
  await page.getByLabel('Espaços gastos de círculo 2', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Salvar magias e espaços', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Magias e espaços salvos.' }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole('tab', { name: 'Magias', exact: true }).click();
  await expect(page.getByLabel('Espaços gastos de círculo 2', { exact: true })).toHaveValue(
    '1',
  );
  for (const width of [1898, 1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('button', { name: 'Conceder nível (ADM)', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await bounds();
    await page.screenshot({ path: `test-results/advancement/dialog-${width}.png` });
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.screenshot({
      path: `test-results/advancement/magic-${width}.png`,
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  async function resetClass(cls: string, secondLevel = false) {
    const fixture = originFixture(cls);
    if (secondLevel)
      advanceFixture(
        fixture.character,
        fixture.choices,
        legalAdvance(fixture.character, fixture.choices),
      );
    const d = deriveSheet(fixture.character, fixture.choices);
    await pool.query(
      'UPDATE characters SET class=$2,level=$3,stats=$4,hp=$5,armor_class=$6 WHERE id=$1',
      [
        hero.id,
        cls,
        fixture.character.level,
        JSON.stringify(fixture.character.stats),
        d.hp,
        d.armorClass,
      ],
    );
    await pool.query(
      'UPDATE character_sheets SET choices=$2,prepared=$4,current_hp=$3 WHERE character_id=$1',
      [hero.id, JSON.stringify(fixture.choices), d.hp, JSON.stringify([])],
    );
    await page.goto(origin + '/#profile');
    await page.reload();
    await expect(page.locator('.sheet-advancement')).toBeVisible();
  }
  await resetClass('Guerreiro', true);
  const bm = await evolve('Guerreiro', false, 'battle-master');
  expect(bm.derived!.classLevels[0].choices.maneuvers).toHaveLength(3);
  await page.reload();
  expect((await req('/characters/' + hero.id + '/sheet')).derived.classLevels[0].subclass).toBe(
    'battle-master',
  );
  const reference = page.locator('.advancement-reference');
  await reference.locator(':scope > summary').click();
  await reference.getByText('Nível 20', { exact: true }).click();
  await expect(reference).toContainText('Quatro ataques');
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await bounds();
    await reference.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/advancement/reference-' + width + '.png' });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await resetClass('Artífice');
  await evolve('Artífice');
  const armorer = await evolve('Artífice', false, 'armorer');
  expect(armorer.derived!.classLevels[0].choices.plans).toHaveLength(4);
  expect(armorer.derived!.magicClasses[0].ability).toBe(3);
  await page.getByRole('tab', { name: 'Magias', exact: true }).click();
  await expect(
    page.getByText('Respingo Ácido · Luzes Dançantes · Consertar', { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  await writeFile(
    'test-results/advancement/class-expansion-result.json',
    JSON.stringify({
      passed: true,
      evolutions: 7,
      subclasses: ['evoker', 'battle-master', 'armorer'],
      books: true,
      reference: true,
      viewports: 5,
      errors,
    }),
  );
  console.log(
    'Class expansion browser QA passed: real advancement, five fighter subclasses, maneuvers, artificer plans, spell persistence, reference and five widths.',
  );
} finally {
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
