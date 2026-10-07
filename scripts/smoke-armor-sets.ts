import 'dotenv/config';
import { chromium, expect, type Locator } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { armorBundle, ARMOR_PIECE_SLOTS } from '../shared/armor-bundles.js';
import type { StorageState } from '../src/types.js';
import type { CompanionEquipmentState, CompanionOutfit } from '../shared/companion-equipment.js';

if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Banco isolado obrigatório.');
const origin = 'http://localhost:3021';
const apiOnly = process.argv.includes('--api-only');
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js');
const { migrate } = await import('../server/migrate.js');
const { seed } = await import('../server/seed.js');
const { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
const server = createApp().listen(3021, '127.0.0.1');
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
const errors: string[] = [];
page.on('pageerror', (error) => errors.push(error.message));
const setRequests: { method: string; body: Record<string, unknown> }[] = [];
page.on('request', (request) => {
  if (request.url().endsWith('/equipment-set'))
    setRequests.push({ method: request.method(), body: request.postDataJSON() });
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
      name: 'Teste dos conjuntos',
      email: `armor-sets-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    },
  });
  expect(signup.ok()).toBe(true);
  const userId = (await signup.json()).user.id as string;
  const hero = await createLegacyTestCharacter(userId, 'Aurora');
  await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=$1', [hero.id]);
  const post = (path: string, data: Record<string, unknown>) =>
    context.request.post(origin + '/api' + path, { headers: { Origin: origin }, data });
  const put = (path: string, data: Record<string, unknown>) =>
    context.request.put(origin + '/api' + path, { headers: { Origin: origin }, data });
  const companionPath = `/companions/${hero.id}/equipment`;
  const storage = async (): Promise<StorageState> => {
    const response = await context.request.get(`${origin}/api/characters/${hero.id}/storage`);
    expect(response.status()).toBe(200);
    return response.json();
  };
  const companionState = async (): Promise<CompanionEquipmentState> => {
    const response = await context.request.get(origin + '/api' + companionPath);
    expect(response.status()).toBe(200);
    return response.json();
  };
  const outfit = async (id: string): Promise<CompanionOutfit> =>
    (await companionState()).companions.find((animal) => animal.id === id)!;
  async function mount(name: string, mount_id: string) {
    const response = await post('/stable/purchase', {
      character_id: hero.id,
      name,
      mount_id,
      coat: 'original',
      equipment: [],
      idempotency_key: randomUUID(),
    });
    expect(response.status()).toBe(201);
    return (await response.json()).mount;
  }
  const horse = await mount('Passo Firme', 'warhorse'),
    mule = await mount('Nuvem', 'mule');
  const petPurchase = await post('/pets/purchase', {
    character_id: hero.id,
    pet_id: 'dog',
    name: 'Brasa',
    idempotency_key: randomUUID(),
  });
  expect(petPurchase.status()).toBe(201);
  const dog = (await petPurchase.json()).pet;
  const parents = [
    'leather-armor',
    'ring-mail',
    'barding-leather-armor',
    'barding-ring-mail',
    'pet-armor-leather',
  ];
  const allPieces = parents.flatMap((parent) =>
    armorBundle(parent)!.pieces.map((piece) => piece.id),
  );
  expect(new Set(allPieces).size).toBe(30);
  const beforeGold = (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id]))
    .rows[0].gold_cp;
  const purchaseBody = {
    character_id: hero.id,
    idempotency_key: randomUUID(),
    items: parents.map((item_id) => ({ item_id, quantity: 1 })),
  };
  const purchased = await post('/shop/checkout', purchaseBody);
  expect(purchased.status()).toBe(201);
  const purchaseData = await purchased.json();
  const realPrice = (
    await pool.query(
      'SELECT sum(price_cp)::int AS total FROM catalog_items WHERE id=ANY($1::text[])',
      [parents],
    )
  ).rows[0].total;
  expect(purchaseData.total_cp).toBe(realPrice);
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
  ).toBe(beforeGold - realPrice);
  const replay = await post('/shop/checkout', purchaseBody);
  expect(replay.status()).toBe(200);
  for (const parent of parents) {
    const bundle = armorBundle(parent)!;
    const rows = (
      await pool.query(
        'SELECT i.item_id,i.quantity,c.weight_lb,c.active,c.raw_data FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 AND i.item_id=ANY($2::text[])',
        [hero.id, bundle.pieces.map((piece) => piece.id)],
      )
    ).rows;
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => row.quantity === 1)).toBe(true);
    expect(rows.reduce((sum, row) => sum + Number(row.weight_lb), 0)).toBeCloseTo(
      bundle.weight_lb,
      2,
    );
    for (const row of rows) {
      expect(row.raw_data.armor_bundle_parent).toBe(parent);
      if (row.item_id !== parent) expect(row.active).toBe(false);
    }
  }
  expect(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM purchase_item_grants g JOIN purchases p ON p.id=g.purchase_id WHERE p.character_id=$1',
        [hero.id],
      )
    ).rows[0].n,
  ).toBe(30);
  const catalogue = await context.request.get(origin + '/api/catalog');
  expect(catalogue.status()).toBe(200);
  const catalogItems = await catalogue.json();
  expect(catalogItems.some((item: { id: string }) => item.id === 'leather-armor--head')).toBe(
    false,
  );
  const subjects = page.getByRole('navigation', { name: 'Configurar equipamentos de' });
  const humanPanel = page.getByRole('region', { name: 'Itens equipados', exact: true });
  const animalPanel = page.locator('.companion-equipment-panel');
  let selectedAnimal: { kind: 'mount' | 'pet'; id: string } | undefined;
  async function subject(label: 'Personagem' | 'Montaria' | 'Mascote', id?: string) {
    selectedAnimal = id ? { kind: label === 'Montaria' ? 'mount' : 'pet', id } : undefined;
    const selectedPanel = label === 'Personagem' ? humanPanel : animalPanel;
    if (apiOnly) return selectedPanel;
    await subjects.getByRole('button', { name: label, exact: true }).click();
    await expect(selectedPanel).toBeVisible();
    if (id) await animalPanel.locator('.companion-equipment-choice select').selectOption(id);
    return selectedPanel;
  }
  async function equipSet(panel: Locator, itemId: string, method: 'POST' | 'PUT') {
    if (apiOnly) {
      const response =
        method === 'POST'
          ? await post('/inventory/equipment-set', { character_id: hero.id, item_id: itemId })
          : await put(companionPath + '-set', {
              kind: selectedAnimal!.kind,
              companion_id: selectedAnimal!.id,
              item_id: itemId,
            });
      expect(response.status()).toBe(200);
      return;
    }
    const before = setRequests.length;
    await panel
      .getByRole('combobox', { name: 'Armadura completa', exact: true })
      .selectOption(itemId);
    const [response] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().endsWith('/equipment-set') && response.request().method() === method,
      ),
      panel.getByRole('button', { name: 'Equipar armadura', exact: true }).click(),
    ]);
    expect(response.status()).toBe(200);
    expect(setRequests).toHaveLength(before + 1);
    expect(setRequests.at(-1)!.body.item_id).toBe(itemId);
  }
  function expectSet(equipped: { id: string; slot: string }[], parent: string) {
    expect(
      equipped
        .filter((piece) =>
          ARMOR_PIECE_SLOTS.includes(piece.slot as (typeof ARMOR_PIECE_SLOTS)[number]),
        )
        .map((piece) => `${piece.slot}:${piece.id}`)
        .sort(),
    ).toEqual(
      armorBundle(parent)!
        .pieces.map((piece) => `${piece.slot}:${piece.id}`)
        .sort(),
    );
  }
  if (!apiOnly) {
    await page.goto(origin + '/#inventory');
    await expect(humanPanel).toBeVisible();
  }
  await equipSet(humanPanel, 'leather-armor', 'POST');
  expectSet((await storage()).equipped, 'leather-armor');
  await subject('Montaria', horse.id);
  await equipSet(animalPanel, 'barding-leather-armor', 'PUT');
  expectSet((await outfit(horse.id)).equipped, 'barding-leather-armor');
  const revision = (await outfit(horse.id)).equipment_revision;
  const mountReplay = await put(companionPath + '-set', {
    kind: 'mount',
    companion_id: horse.id,
    item_id: 'barding-leather-armor',
  });
  expect(mountReplay.status()).toBe(200);
  expect((await outfit(horse.id)).equipment_revision).toBe(revision);
  await subject('Mascote', dog.id);
  if (!apiOnly) {
    const choices = await animalPanel
      .getByRole('combobox', { name: 'Armadura completa', exact: true })
      .locator('option')
      .evaluateAll((options) => options.map((node) => (node as HTMLOptionElement).value));
    expect(choices).toContain('pet-armor-leather');
    expect(choices).not.toContain('leather-armor');
    expect(choices).not.toContain('barding-ring-mail');
  }
  await equipSet(animalPanel, 'pet-armor-leather', 'PUT');
  expectSet((await outfit(dog.id)).equipped, 'pet-armor-leather');
  const humanBefore = (await storage()).equipped;
  const missingPiece = 'ring-mail--feet';
  await pool.query('DELETE FROM inventory WHERE character_id=$1 AND item_id=$2', [
    hero.id,
    missingPiece,
  ]);
  expect(
    (
      await post('/inventory/equipment-set', { character_id: hero.id, item_id: 'ring-mail' })
    ).status(),
  ).toBe(409);
  expect((await storage()).equipped).toEqual(humanBefore);
  await pool.query('INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,1)', [
    hero.id,
    missingPiece,
  ]);
  const transferBody = {
    character_id: hero.id,
    item_id: 'ring-mail--shoulders',
    quantity: 1,
    idempotency_key: randomUUID(),
  };
  expect(
    (await post('/inventory/transfers', { ...transferBody, direction: 'to_vault' })).status(),
  ).toBe(201);
  expect(
    (
      await post('/inventory/equipment-set', { character_id: hero.id, item_id: 'ring-mail' })
    ).status(),
  ).toBe(409);
  expect((await storage()).equipped).toEqual(humanBefore);
  expect(
    (
      await post('/inventory/transfers', {
        ...transferBody,
        direction: 'to_backpack',
        idempotency_key: randomUUID(),
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await put(companionPath, {
        kind: 'mount',
        companion_id: mule.id,
        slot: 'head',
        item_id: 'barding-ring-mail--head',
      })
    ).status(),
  ).toBe(200);
  const mountBefore = await outfit(horse.id);
  expect(
    (
      await put(companionPath + '-set', {
        kind: 'mount',
        companion_id: horse.id,
        item_id: 'barding-ring-mail',
      })
    ).status(),
  ).toBe(409);
  expect(await outfit(horse.id)).toEqual(mountBefore);
  expect(
    (
      await put(companionPath, {
        kind: 'mount',
        companion_id: mule.id,
        slot: 'head',
        item_id: null,
      })
    ).status(),
  ).toBe(200);
  await subject('Montaria', horse.id);
  // Refresh after direct API fixtures so the selector reflects current allocations.
  if (!apiOnly) await page.reload();
  await subject('Montaria', horse.id);
  await equipSet(animalPanel, 'barding-ring-mail', 'PUT');
  expectSet((await outfit(horse.id)).equipped, 'barding-ring-mail');
  const animalBefore = (await companionState()).companions;
  for (const kind of ['mount', 'pet'] as const) {
    const companion_id = kind === 'mount' ? horse.id : dog.id;
    expect(
      (
        await put(companionPath + '-set', { kind, companion_id, item_id: 'leather-armor' })
      ).status(),
    ).toBe(400);
    expect(
      (
        await put(companionPath, {
          kind,
          companion_id,
          slot: 'head',
          item_id: 'leather-armor--head',
        })
      ).status(),
    ).toBe(400);
  }
  expect((await companionState()).companions).toEqual(animalBefore);
  expect(
    (
      await post('/inventory/equipment-set', {
        character_id: hero.id,
        item_id: 'barding-ring-mail',
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await post('/inventory/equipment-set', {
        character_id: hero.id,
        item_id: 'leather-armor',
        pieces: ['ring-mail--head'],
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await put(companionPath + '-set', {
        kind: 'pet',
        companion_id: dog.id,
        item_id: 'pet-armor-leather',
        target: 'human',
      })
    ).status(),
  ).toBe(400);
  const outsider = await browser.newContext();
  try {
    expect(
      (
        await outsider.request.post(origin + '/api/auth/sign-up/email', {
          headers: { Origin: origin },
          data: {
            name: 'Outro titular',
            email: `armor-foreign-${randomUUID()}@example.test`,
            password: `Test-${randomUUID()}`,
          },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await outsider.request.post(origin + '/api/inventory/equipment-set', {
          headers: { Origin: origin },
          data: { character_id: hero.id, item_id: 'leather-armor' },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await outsider.request.put(origin + '/api' + companionPath + '-set', {
          headers: { Origin: origin },
          data: { kind: 'mount', companion_id: horse.id, item_id: 'barding-ring-mail' },
        })
      ).status(),
    ).toBe(404);
  } finally {
    await outsider.close();
  }
  for (const width of apiOnly ? [] : [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: width <= 390 ? 844 : 1100 });
    for (const [label, id, kind] of [
      ['Personagem', undefined, 'human'],
      ['Montaria', horse.id, 'mount'],
      ['Mascote', dog.id, 'pet'],
    ] as const) {
      const panel = await subject(label, id);
      await panel.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const bounds = (await panel.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      await expect(
        panel.getByRole('button', { name: 'Equipar armadura', exact: true }),
      ).toBeVisible();
      await page.screenshot({ path: `test-results/armor-sets-${kind}-${width}.png` });
    }
  }
  if (!apiOnly) await page.reload();
  expectSet((await storage()).equipped, 'leather-armor');
  expectSet((await outfit(horse.id)).equipped, 'barding-ring-mail');
  expectSet((await outfit(dog.id)).equipped, 'pet-armor-leather');
  expect(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
  ).toBe(beforeGold - realPrice);
  expect(errors).toEqual([]);
  console.log(
    apiOnly
      ? 'API dos conjuntos: compra/replay entrega 30 peças com peso/preço único; conjunto atômico/replay, faltante/cofre/reserva com rollback, strict humano/animal/ownership/payload forjado aprovados. Browser aguardando build.'
      : 'Conjuntos completos: compra/replay entrega 30 peças com peso/preço único; UI equipa seis peças em uma operação; faltante/cofre/reserva fazem rollback; humano/animal/ownership/payload forjado protegidos; persistência e 1440/768/390/320 aprovados.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/armor-sets-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
