import 'dotenv/config';
import { chromium, expect, type Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import type {
  CompanionEquipmentState,
  CompanionOutfit,
  CompanionSlot,
} from '../shared/companion-equipment.js';

if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3020';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter, lockTestIllustrator } =
  await import('../tests/character-fixtures.js');
const { completeCompanionArt } = await import('../server/companion-equipment.js');
await migrate();
await seed();
const releaseIllustrator = await lockTestIllustrator();
await pool.query(
  'INSERT INTO character_art_worker(id,heartbeat_at,available) VALUES(true,now(),true) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now(),available=true',
);
const heartbeat = setInterval(
  () =>
    void pool
      .query('UPDATE character_art_worker SET heartbeat_at=now(),available=true')
      .catch(() => {}),
  15000,
);
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3020, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
const errors: string[] = [],
  artRequests: Record<string, unknown>[] = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('request', (request) => {
  if (request.method() === 'POST' && /\/api\/companions\/[^/]+\/art$/.test(request.url()))
    artRequests.push(request.postDataJSON());
});
await mkdir('test-results', { recursive: true });
try {
  await context.addInitScript(() => {
    localStorage.setItem('alvorada-music-muted', 'true');
    localStorage.setItem('alvorada-effects-muted', 'true');
  });
  const signup = await context.request.post(origin + '/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Viajante dos equipamentos',
      email: `companion-browser-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  const userId = (await signup.json()).user.id as string;
  const hero = await createLegacyTestCharacter(userId, 'Aurora');
  await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [hero.id]);
  const post = async (path: string, data: Record<string, unknown>) =>
    context.request.post(origin + '/api' + path, { headers: { Origin: origin }, data });
  const purchaseMount = async (name: string, mount_id: string, equipment: string[]) => {
    const response = await post('/stable/purchase', {
      character_id: hero.id,
      mount_id,
      name,
      equipment,
      coat: 'alternate',
      idempotency_key: randomUUID(),
    });
    expect(response.status()).toBe(201);
    return (await response.json()).mount;
  };
  const purchasePet = async (name: string, pet_id: string) => {
    const response = await post('/pets/purchase', {
      character_id: hero.id,
      pet_id,
      name,
      idempotency_key: randomUUID(),
    });
    expect(response.status()).toBe(201);
    return (await response.json()).pet;
  };
  const horse = await purchaseMount('Passo Firme', 'warhorse', [
    'barding-leather',
    'saddle-riding',
  ]);
  const mule = await purchaseMount('Nuvem', 'mule', []);
  const dog = await purchasePet('Brasa', 'dog');
  const cat = await purchasePet('Lua', 'cat');
  const fixtureItems = [
    'barding-padded-armor',
    'saddle-military',
    'leather-armor',
    'plate-helmet',
    'plate-bracers',
    'pet-armor-leather',
  ];
  const petArmorPurchase = await post('/shop/checkout', {
    character_id: hero.id,
    idempotency_key: randomUUID(),
    items: [{ item_id: 'pet-armor-leather', quantity: 1 }],
  });
  expect(petArmorPurchase.status()).toBe(201);
  for (const id of fixtureItems) {
    const stock = await pool.query('SELECT id FROM catalog_items WHERE id=$1', [id]);
    expect(stock.rowCount, `Catálogo: ${id}`).toBe(1);
    if (id !== 'pet-armor-leather')
      await pool.query('INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,1)', [
        hero.id,
        id,
      ]);
  }
  const names = new Map(
    (
      await pool.query(
        "SELECT id,COALESCE(raw_data->>'armor_piece_name',name) AS name FROM catalog_items WHERE id=ANY($1::text[])",
        [fixtureItems],
      )
    ).rows.map((row) => [row.id, row.name as string]),
  );
  const equipmentPath = `/companions/${hero.id}/equipment`;
  async function state(): Promise<CompanionEquipmentState> {
    const response = await context.request.get(origin + '/api' + equipmentPath);
    expect(response.status()).toBe(200);
    return response.json();
  }
  async function outfit(id: string): Promise<CompanionOutfit> {
    const current = (await state()).companions.find((animal) => animal.id === id);
    expect(current).toBeTruthy();
    return current!;
  }
  const bag = page.getByRole('region', { name: 'Itens da mochila', exact: true });
  const subjects = page.getByRole('navigation', { name: 'Configurar equipamentos de' });
  const panel = page.locator('.companion-equipment-panel');
  async function selectSubject(kind: 'Personagem' | 'Montaria' | 'Mascote', id?: string) {
    await subjects.getByRole('button', { name: kind, exact: true }).click();
    await expect(subjects.getByRole('button', { name: kind, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    if (kind === 'Personagem') {
      await expect(
        page.getByRole('region', { name: 'Itens equipados', exact: true }),
      ).toBeVisible();
      await expect(panel).toHaveCount(0);
    } else {
      await expect(panel).toBeVisible();
      const selection = panel.locator('.companion-equipment-choice select');
      await expect(selection.locator('option')).toHaveCount(2);
      if (id) await selection.selectOption(id);
      await expect(selection).toHaveValue(id || (await selection.inputValue()));
    }
  }
  async function picker(slot: CompanionSlot) {
    const target = panel.locator(`[data-companion-slot="${slot}"]`);
    await target.locator('.equipment-slot-trigger').click();
    const popup = target.locator('.equipment-picker:popover-open');
    await expect(popup).toBeVisible();
    return popup;
  }
  async function equip(slot: CompanionSlot, value: string) {
    const popup = await picker(slot);
    const [response] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith('/api' + equipmentPath) && response.request().method() === 'PUT',
      ),
      popup.locator('select').selectOption(value),
    ]);
    expect(response.status()).toBe(200);
    await expect(panel).toHaveAttribute('aria-busy', 'false');
  }
  async function reserved(id: string, count: number) {
    const current = await state();
    const item = current.inventory.find((entry) => entry.id === id)!;
    expect(item.quantity).toBe(1);
    expect(item.allocated).toBe(count);
    expect(item.available).toBe(1 - count);
    const storage = await context.request.get(`${origin}/api/characters/${hero.id}/storage`);
    expect((await storage.json()).companion_allocated[id] || 0).toBe(count);
    const button = bag.getByRole('button', { name: `${names.get(id)}, quantidade 1`, exact: true });
    await expect(button).toHaveCount(count ? 0 : 1);
  }
  async function validateImage(image: Locator, expectedUrl: string) {
    await expect(image).toHaveAttribute('src', expectedUrl);
    await expect
      .poll(async () =>
        image.evaluate(
          (node) =>
            (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0,
        ),
      )
      .toBe(true);
    const geometry = await image.evaluate((node) => {
      const img = node as HTMLImageElement,
        box = img.getBoundingClientRect();
      return {
        width: box.width,
        height: box.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        fit: getComputedStyle(img).objectFit,
      };
    });
    expect(geometry.width).toBeGreaterThan(30);
    expect(geometry.height).toBeGreaterThan(30);
    expect(geometry.fit).toBe('contain');
    return geometry;
  }
  async function dress(id: string, kind: 'mount' | 'pet') {
    const before = await outfit(id);
    const oldSrc = await panel.locator('.companion-outfit-image img').getAttribute('src');
    await expect(panel.locator('input[type="file"]')).toHaveCount(0);
    const [response] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith(`/api/companions/${hero.id}/art`) &&
          response.request().method() === 'POST',
      ),
      panel.getByRole('button', { name: 'Vestir', exact: true }).click(),
    ]);
    expect(response.status()).toBe(202);
    const job = await response.json();
    const body = artRequests.at(-1)!;
    expect(Object.keys(body).sort()).toEqual(
      kind === 'mount' || kind === 'pet'
        ? ['barding_parts', 'companion_id', 'idempotency_key', 'kind']
        : ['companion_id', 'idempotency_key', 'kind'],
    );
    expect(body.kind).toBe(kind);
    expect(body.companion_id).toBe(id);
    await expect(panel.getByRole('button', { name: 'Vestindo…', exact: true })).toBeDisabled();
    await expect(panel.locator('.companion-outfit-image img')).toHaveAttribute('src', oldSrc!);
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `test-results/companion-equipment-${kind}-pending.png` });
    const record = (
      await pool.query(
        'SELECT reference,equipment_revision,barding_parts FROM companion_art_jobs WHERE id=$1',
        [job.id],
      )
    ).rows[0];
    expect(record.reference.length).toBeGreaterThan(1000);
    expect(record.equipment_revision).toBe(before.equipment_revision);
    expect(record.barding_parts).toEqual(body.barding_parts);
    const references = (
      await pool.query('SELECT item_id,name,image FROM companion_art_equipment WHERE job_id=$1', [
        job.id,
      ])
    ).rows;
    expect(references.map((entry) => entry.item_id).sort()).toEqual(
      before.equipped.map((entry) => entry.id).sort(),
    );
    for (const reference of references) expect(reference.image.length).toBeGreaterThan(1000);
    // A fixture renderer completes the real queue internally; no provider or public completion API.
    await pool.query(
      "UPDATE companion_art_jobs SET status='running',started_at=now() WHERE id=$1 AND status='queued'",
      [job.id],
    );
    expect((await completeCompanionArt(job.id, { portrait: record.reference, token: await sharp(record.reference).resize(1024,1024,{fit: "contain",background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer() })).status).toBe('completed');
    const updated = await outfit(id);
    expect(updated.art_equipment_revision).toBe(before.equipment_revision);
    expect(updated.image_revision).toBeGreaterThan(0);
    expect(updated.image_url).toContain(`/api/companions/${hero.id}/${kind}/${id}/image?v=`);
    await validateImage(panel.locator('.companion-outfit-image img'), updated.image_url!);
    const privateImage = await context.request.get(origin + updated.image_url);
    expect(privateImage.status()).toBe(200);
    expect(privateImage.headers()['cache-control']).toBe('private, no-store');
    const outputMeta = await sharp(await privateImage.body()).metadata();
    const sourceMeta = await sharp(record.reference).metadata();
    expect(outputMeta.width! / outputMeta.height!).toBeCloseTo(
      sourceMeta.width! / sourceMeta.height!,
      5,
    );
    const outsider = await browser.newContext();
    try {
      const foreignSignup = await outsider.request.post(origin + '/api/auth/sign-up/email', {
        headers: { Origin: origin },
        data: {
          name: 'Outro viajante',
          email: `companion-outsider-${randomUUID()}@example.test`,
          password: `Test-${randomUUID()}`,
        },
      });
      expect(foreignSignup.ok()).toBe(true);
      expect((await outsider.request.get(origin + updated.image_url)).status()).toBe(404);
      expect((await outsider.request.get(origin + updated.base_image)).status()).toBe(404);
    } finally {
      await outsider.close();
    }
    return updated;
  }

  await page.goto(origin + '/#inventory');
  await expect(bag).toBeVisible();
  await selectSubject('Montaria', horse.id);
  await expect(panel.locator('.companion-outfit-image figcaption')).toHaveText('Passo Firme');
  let current = await outfit(horse.id);
  expect(current.equipped.map((entry) => entry.id).sort()).toEqual([
    'legacy:barding-leather',
    'legacy:saddle-riding',
  ]);
  await panel.locator('.companion-equipment-choice select').selectOption(mule.id);
  await expect(panel.locator('.companion-outfit-image figcaption')).toHaveText('Nuvem');
  expect((await outfit(mule.id)).equipped).toHaveLength(0);
  await panel.locator('.companion-equipment-choice select').selectOption(horse.id);

  await equip('armor', 'barding-padded-armor');
  await reserved('barding-padded-armor', 1);
  expect((await outfit(horse.id)).equipped.find((entry) => entry.slot === 'armor')?.source).toBe(
    'inventory',
  );
  await equip('armor', '');
  await reserved('barding-padded-armor', 0);
  await equip('armor', 'legacy:barding-leather');
  expect((await outfit(horse.id)).equipped.find((entry) => entry.slot === 'armor')?.source).toBe(
    'legacy',
  );
  await equip('saddle', 'saddle-military');
  await reserved('saddle-military', 1);
  await equip('saddle', '');
  await reserved('saddle-military', 0);
  await equip('saddle', 'legacy:saddle-riding');
  const bardaSource = bag.getByRole('button', {
    name: `${names.get('barding-padded-armor')}, quantidade 1`,
    exact: true,
  });
  const [dragResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().endsWith('/api' + equipmentPath) && response.request().method() === 'PUT',
    ),
    bardaSource.dragTo(panel.locator('[data-companion-slot="armor"]')),
  ]);
  expect(dragResponse.status()).toBe(200);
  await reserved('barding-padded-armor', 1);
  const animalBeforeForged = await outfit(horse.id);
  for (const [slot, item_id] of [
    ['armor', 'leather-armor'],
    ['head', 'plate-helmet'],
    ['bracers', 'plate-bracers'],
  ]) {
    const response = await context.request.put(origin + '/api' + equipmentPath, {
      headers: { Origin: origin },
      data: { kind: 'mount', companion_id: horse.id, slot, item_id },
    });
    expect(response.status()).toBe(400);
  }
  expect(await outfit(horse.id)).toEqual(animalBeforeForged);
  expect(
    (
      await context.request.put(origin + '/api' + equipmentPath, {
        headers: { Origin: origin },
        data: {
          kind: 'mount',
          companion_id: mule.id,
          slot: 'armor',
          item_id: 'barding-padded-armor',
        },
      })
    ).status(),
  ).toBe(409);
  await selectSubject('Personagem');
  const humanArmor = page.locator('[data-equipment-slot="armor"]');
  await humanArmor.locator('.equipment-slot-trigger').click();
  expect(
    await humanArmor
      .locator('select option')
      .evaluateAll((options) => options.map((node) => (node as HTMLOptionElement).value)),
  ).toContain('leather-armor');
  expect(
    await humanArmor
      .locator('select option')
      .evaluateAll((options) => options.map((node) => (node as HTMLOptionElement).value)),
  ).not.toContain('barding-padded-armor');
  await page.keyboard.press('Escape');
  expect(
    (
      await post('/inventory/equipment', {
        character_id: hero.id,
        slot: 'armor',
        item_id: 'barding-padded-armor',
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await post('/inventory/transfers', {
        character_id: hero.id,
        direction: 'to_vault',
        item_id: 'barding-padded-armor',
        quantity: 1,
        idempotency_key: randomUUID(),
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await pool.query('SELECT count(*)::int AS count FROM account_vault WHERE user_id=$1', [
        userId,
      ])
    ).rows[0].count,
  ).toBe(0);
  await selectSubject('Montaria', horse.id);
  const armorParts = panel.getByRole('group', { name: 'Partes da barda na imagem' });
  await expect(armorParts.getByRole('checkbox')).toHaveCount(6);
  for (const checkbox of await armorParts.getByRole('checkbox').all())
    await expect(checkbox).toBeChecked();
  await armorParts.getByLabel('Capacete / testeira', { exact: true }).uncheck();
  await armorParts.getByLabel('Proteção das patas dianteiras', { exact: true }).uncheck();
  await armorParts.getByLabel('Proteção das patas traseiras', { exact: true }).uncheck();
  const dressedHorse = await dress(horse.id, 'mount');
  expect(artRequests.at(-1)?.barding_parts).toEqual(['neck', 'chest', 'body']);
  await page.reload();
  await selectSubject('Montaria', horse.id);
  await expect(armorParts.getByLabel('Capacete / testeira', { exact: true })).not.toBeChecked();
  await expect(armorParts.getByLabel('Tronco e flancos', { exact: true })).toBeChecked();
  expect(
    (
      await pool.query('SELECT equipment FROM character_mounts WHERE id=$1', [horse.id])
    ).rows[0].equipment.sort(),
  ).toEqual(['barding-leather', 'saddle-riding']);

  await selectSubject('Mascote', dog.id);
  await panel.locator('.companion-equipment-choice select').selectOption(cat.id);
  await expect(panel.locator('.companion-outfit-image figcaption')).toHaveText('Lua');
  await panel.locator('.companion-equipment-choice select').selectOption(dog.id);
  await expect(panel.locator('[data-companion-slot="saddle"]')).toHaveCount(0);
  for (const [slot, forbidden] of [
    ['head', 'plate-helmet'],
    ['armor', 'leather-armor'],
    ['bracers', 'plate-bracers'],
  ] as const) {
    const popup = await picker(slot);
    expect(
      await popup
        .locator('select option')
        .evaluateAll((options) => options.map((node) => (node as HTMLOptionElement).value)),
    ).not.toContain(forbidden);
    await page.keyboard.press('Escape');
    expect(
      (
        await context.request.put(origin + '/api' + equipmentPath, {
          headers: { Origin: origin },
          data: { kind: 'pet', companion_id: dog.id, slot, item_id: forbidden },
        })
      ).status(),
    ).toBe(400);
  }
  expect((await outfit(dog.id)).equipped).toHaveLength(0);
  await reserved('plate-helmet', 0);
  await reserved('plate-bracers', 0);
  await equip('armor', 'pet-armor-leather');
  await reserved('pet-armor-leather', 1);
  const dogParts = panel.getByRole('group', { name: 'Partes da armadura na imagem' });
  await expect(dogParts.getByRole('checkbox')).toHaveCount(6);
  for (const checkbox of await dogParts.getByRole('checkbox').all())
    await expect(checkbox).toBeChecked();
  await dogParts.getByLabel('Proteção da cabeça', { exact: true }).uncheck();
  await dogParts.getByLabel('Proteção das patas dianteiras', { exact: true }).uncheck();
  await dogParts.getByLabel('Proteção das patas traseiras', { exact: true }).uncheck();
  const dressedDog = await dress(dog.id, 'pet');
  expect(artRequests.at(-1)?.barding_parts).toEqual(['neck', 'chest', 'body']);
  await reserved('pet-armor-leather', 1);
  await page.reload();
  await selectSubject('Mascote', dog.id);
  await expect(dogParts.getByLabel('Proteção da cabeça', { exact: true })).not.toBeChecked();
  await expect(dogParts.getByLabel('Tronco e flancos', { exact: true })).toBeChecked();

  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
    for (const [label, id, saved] of [
      ['Montaria', horse.id, dressedHorse],
      ['Mascote', dog.id, dressedDog],
    ] as const) {
      await selectSubject(label, id);
      await validateImage(panel.locator('.companion-outfit-image img'), saved.image_url!);
      if (label === 'Mascote') {
        const parts = panel.getByRole('group', { name: 'Partes da armadura na imagem' });
        const head = parts.getByLabel('Proteção da cabeça', { exact: true });
        await head.check();
        await expect(head).toBeChecked();
        await head.uncheck();
        await expect(head).not.toBeChecked();
      }
      expect(
        await panel.locator('[data-companion-slot] .equipment-slot-trigger').evaluateAll((slots) =>
          slots.every((slot) => {
            const icon = slot.querySelector('svg[data-companion-icon]');
            return Boolean(
              slot.querySelector('img') || (icon && icon.querySelector('path')?.getAttribute('d')),
            );
          }),
        ),
      ).toBe(true);
      await expect(panel.locator('svg.lucide-package')).toHaveCount(0);
      await panel.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const panelBox = (await panel.boundingBox())!;
      expect(panelBox.x).toBeGreaterThanOrEqual(0);
      expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(width + 1);
      await page.screenshot({
        path: `test-results/companion-equipment-${saved.kind}-${width}.png`,
      });
      if (width === 320) {
        const popup = await picker(label === 'Montaria' ? 'armor' : 'head');
        const bounds = (await popup.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        await page.screenshot({
          path: `test-results/companion-equipment-${saved.kind}-picker-320.png`,
        });
        await page.keyboard.press('Escape');
      }
    }
  }
  await page.reload();
  await selectSubject('Montaria', horse.id);
  await validateImage(panel.locator('.companion-outfit-image img'), dressedHorse.image_url!);
  await reserved('barding-padded-armor', 1);
  await selectSubject('Mascote', dog.id);
  await validateImage(panel.locator('.companion-outfit-image img'), dressedDog.image_url!);
  await reserved('plate-helmet', 0);
  await reserved('plate-bracers', 0);
  await reserved('pet-armor-leather', 1);
  expect(artRequests).toHaveLength(2);
  expect(errors).toEqual([]);
  console.log(
    'Equipamento companion no navegador: trocar sujeito/animal, legado/estoque/reservas, drag de barda, peças humanas recusadas por animais, cofre/reserva bloqueados, Vestir automático/private/revisão/proporção e 1440/768/390/320 OK. Sem provider: fixture interna concluiu 2 jobs com bases reais.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/companion-equipment-failure.png', fullPage: true });
  throw error;
} finally {
  clearInterval(heartbeat);
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await releaseIllustrator();
  await pool.end();
}
