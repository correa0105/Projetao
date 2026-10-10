import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import {
  boundSpellOptions,
  spellBindingSpec,
  selectedBoundSpell,
} from '../shared/shop-spell-bindings.js';
import { compatibleSlots, twoHanded } from '../shared/equipment.js';

if (!/^\/alvorada_test_[a-f0-9]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const server = createServer();
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as { port: number }).port,
  base = 'http://localhost:' + port;
process.env.APP_ORIGIN = base;
process.env.BETTER_AUTH_URL = base;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js');
server.on('request', createApp());
let cookie = '',
  browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const requestTimes: number[] = [];
async function request(
  path: string,
  body?: unknown,
  method = body ? 'POST' : 'GET',
  credentials = cookie,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    requestTimes.push(Date.now());
    const response = await fetch(base + '/api' + path, {
      method,
      headers: { Cookie: credentials, Origin: base, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (response.status === 429) {
      await response.arrayBuffer();
      console.log('Bound-spell QA is waiting for its API window.');
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          Math.min(70, Number(response.headers.get('retry-after')) || 60) * 1000 + 200,
        ),
      );
      continue;
    }
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  throw Error('API window did not reopen');
}
try {
  const signup = await request('/auth/sign-up/email', {
    name: 'Magias vinculadas',
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  });
  assert.equal(signup.status, 200);
  cookie = signup.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const user = signup.data.user,
    hero = await createLegacyTestCharacter(user.id, 'Artesão de truques');
  await pool.query('UPDATE characters SET gold_cp=100000000 WHERE id=$1', [hero.id]);
  const all = JSON.parse(
      await readFile('data/shop-magic-completion-20261009/catalog.json', 'utf8'),
    ).items,
    templates = all.filter((x: any) => x.raw_data.magic_family === 'Enspelled Weapon (Cantrip)');
  assert.equal(templates.length, 52);
  const sample = templates[0],
    spec = spellBindingSpec(sample)!;
  assert.deepEqual(spec, { level: 0, schools: ['C', 'D', 'V', 'N', 'T'] });
  const options = boundSpellOptions(spec);
  assert.equal(options.length, 41);
  assert(
    !options.some((x) =>
      ['Dancing Lights', 'Friends', 'Minor Illusion', 'Resistance'].includes(x.name),
    ),
  );
  const fire = options.find((x) => x.name === 'Fire Bolt')!,
    ice = options.find((x) => x.name === 'Ray of Frost')!;
  assert.equal(fire.source, 'XPHB');
  const choices = await request('/catalog/' + sample.id + '/spell-options');
  assert.equal(choices.status, 200);
  assert.deepEqual(choices.data.options, options);
  const cart = (
    item = sample.id,
    spell: string | undefined = fire.id,
    key = randomUUID(),
    quantity = 1,
  ) => ({
    character_id: hero.id,
    idempotency_key: key,
    items: [{ item_id: item, quantity, ...(spell ? { spell_id: spell } : {}) }],
  });
  assert.equal(
    (await request('/shop/checkout', { ...cart(), items: [{ item_id: sample.id, quantity: 1 }] }))
      .status,
    409,
  );
  for (const spell of [
    'friends-xphb',
    'dancing-lights-phb',
    'burning-hands-xphb',
    'invented-spell',
  ])
    assert.equal((await request('/shop/checkout', cart(sample.id, spell))).status, 400);
  assert.equal((await request('/shop/checkout', cart('dagger', fire.id))).status, 400);
  assert.equal((await request('/shop/checkout', cart(), 'POST', '')).status, 401);
  assert.equal(
    (await request('/shop/checkout', { ...cart(), character_id: randomUUID() })).status,
    404,
  );
  assert.equal(
    (await pool.query('SELECT count(*)::int AS n FROM purchases WHERE character_id=$1', [hero.id]))
      .rows[0].n,
    0,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM catalog_items WHERE raw_data ? 'configuration_origin'",
      )
    ).rows[0].n,
    0,
  );
  await pool.query('UPDATE characters SET gold_cp=0 WHERE id=$1', [hero.id]);
  assert.equal((await request('/shop/checkout', cart())).status, 409);
  assert.equal(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM catalog_items WHERE raw_data ? 'configuration_origin'",
      )
    ).rows[0].n,
    0,
  );
  await pool.query('UPDATE characters SET gold_cp=100000000 WHERE id=$1', [hero.id]);
  const order = {
    character_id: hero.id,
    idempotency_key: randomUUID(),
    items: templates.map((item: any, i: number) => ({
      item_id: item.id,
      quantity: 1,
      spell_id: options[i % options.length].id,
    })),
  };
  assert.equal((await request('/shop/checkout', order)).status, 201);
  assert.equal((await request('/shop/checkout', order)).status, 200);
  assert.equal(
    (
      await request('/shop/checkout', {
        ...order,
        items: order.items.map((line: any, i: number) =>
          i
            ? line
            : {
                ...line,
                spell_id:
                  options[(options.findIndex((x) => x.id === line.spell_id) + 1) % options.length]
                    .id,
              },
        ),
      })
    ).status,
    409,
  );
  const exemplars = (
    await pool.query(
      "SELECT c.*,i.quantity FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 AND c.raw_data ? 'configuration_origin' ORDER BY c.id",
      [hero.id],
    )
  ).rows;
  assert.equal(exemplars.length, 52);
  for (const exemplar of exemplars) {
    const parent = templates.find(
        (item: any) => item.id === exemplar.raw_data.configuration_origin,
      ),
      line = order.items.find((item: any) => item.item_id === parent.id),
      spell = selectedBoundSpell(parent, line.spell_id)!;
    assert(parent && spell);
    assert.equal(exemplar.active, false);
    assert.equal(exemplar.quantity, 1);
    assert.equal(exemplar.image_path, parent.image_path);
    assert.equal(exemplar.audio_path, parent.audio_path);
    assert.deepEqual(exemplar.raw_data.bound_spell, spell);
    assert.equal(exemplar.raw_data.spell_binding, undefined);
    assert.deepEqual(compatibleSlots(exemplar), parent.raw_data.equipment_slots);
    assert.equal(twoHanded(exemplar), parent.raw_data.two_handed);
    assert.match(exemplar.raw_data.rules_summary, /CD 13.*\+5/);
    assert.equal(
      (
        await request('/inventory/equipment', {
          character_id: hero.id,
          item_id: exemplar.id,
          slot: 'main_hand',
        })
      ).status,
      200,
      exemplar.id,
    );
  }
  const expectedTotal = templates.reduce((sum: number, item: any) => sum + item.price_cp, 0);
  assert.equal(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
    100000000 - expectedTotal,
  );
  const second = cart(sample.id, ice.id);
  assert.equal((await request('/shop/checkout', second)).status, 201);
  const fixed = (
    await pool.query(
      "SELECT c.*,i.quantity FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 AND c.raw_data->>'configuration_origin'=$2 ORDER BY c.id",
      [hero.id, sample.id],
    )
  ).rows;
  assert.equal(fixed.length, 2);
  assert.notEqual(fixed[0].id, fixed[1].id);
  const iceItem = fixed.find((x) => x.raw_data.bound_spell.id === ice.id);
  assert(iceItem);
  const direct = {
    character_id: hero.id,
    item_id: sample.id,
    quantity: 2,
    spell_id: ice.id,
    idempotency_key: randomUUID(),
  };
  assert.equal((await request('/purchases', direct)).status, 201);
  assert.equal((await request('/purchases', direct)).status, 200);
  assert.equal((await request('/purchases', { ...direct, spell_id: fire.id })).status, 409);
  assert.equal(
    (
      await request('/inventory/equipment', {
        character_id: hero.id,
        item_id: null,
        slot: 'main_hand',
      })
    ).status,
    200,
  );
  const transfer = {
    character_id: hero.id,
    item_id: iceItem.id,
    direction: 'to_vault',
    quantity: 1,
    idempotency_key: randomUUID(),
  };
  assert.equal((await request('/inventory/transfers', transfer)).status, 201);
  assert.equal((await request('/inventory/transfers', transfer)).status, 200);
  assert.equal(
    (
      await request('/inventory/transfers', {
        ...transfer,
        direction: 'to_backpack',
        idempotency_key: randomUUID(),
      })
    ).status,
    201,
  );
  const information = await request('/catalog/' + iceItem.id + '/rules');
  assert.equal(information.status, 200);
  assert(information.data.description.includes(ice.label));
  const snapshot = (
    await pool.query(
      "SELECT id,md5(to_jsonb(c)::text) AS hash FROM catalog_items c WHERE raw_data ? 'configuration_origin' ORDER BY id",
    )
  ).rows;
  await seed();
  assert.deepEqual(
    (
      await pool.query(
        "SELECT id,md5(to_jsonb(c)::text) AS hash FROM catalog_items c WHERE raw_data ? 'configuration_origin' ORDER BY id",
      )
    ).rows,
    snapshot,
  );
  const published = await request('/catalog');
  assert.equal(published.status, 200);
  assert(!published.data.some((item: any) => item.id.startsWith('configured-')));
  assert.equal(
    published.data.filter((item: any) => item.raw_data?.spell_binding).length,
    all.filter((item: any) => item.raw_data.spell_binding).length,
  );
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [user.id]);
  assert.equal(
    (await request('/catalog/' + sample.id + '/price', { price_cp: 12345 }, 'PATCH')).status,
    200,
  );
  // Administrators intentionally have unlimited gold; charge verification uses the player role.
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [user.id]);
  const beforeGold = (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id]))
    .rows[0].gold_cp;
  const priced = {
    ...cart(sample.id, ice.id),
    items: [
      {
        item_id: sample.id,
        quantity: 1,
        spell_id: ice.id,
        price_cp: 1,
        spell_name: 'Invented override',
      },
    ],
  };
  assert.equal((await request('/shop/checkout', priced)).status, 201);
  assert.equal(
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
    beforeGold - 12345,
  );
  assert.equal(
    (
      await pool.query(
        "SELECT raw_data->'bound_spell'->>'label' AS label FROM catalog_items WHERE id=$1",
        [iceItem.id],
      )
    ).rows[0].label,
    ice.label,
  );
  await pool.query('UPDATE "user" SET administrador=0 WHERE id=$1', [user.id]);
  console.log(
    'PASS all 52 configured models: permitted schools/edition, ownership, rollback, canonical price, hidden distinct inventory IDs, purchases/replay, every main-hand slot, vault transfer, source details and seed preservation.',
  );
  const higher = all.filter((item: any) => item.raw_data.spell_binding?.level > 0);
  if (higher.length) {
    assert.equal(higher.length, 416);
    for (let level = 1; level <= 8; level++) {
      const tier = higher.filter((item: any) => item.raw_data.spell_binding.level === level);
      assert.equal(tier.length, 52);
      const tierOptions = boundSpellOptions(spellBindingSpec(tier[0])!);
      assert(tierOptions.length >= 10);
      assert(
        tierOptions.every((x) => x.level === level && ['C', 'D', 'V', 'N', 'T'].includes(x.school)),
      );
      const listed = await request('/catalog/' + tier[0].id + '/spell-options');
      assert.equal(listed.status, 200);
      assert.deepEqual(listed.data.options, tierOptions);
      const total = tier.reduce((sum: number, item: any) => sum + item.price_cp, 0);
      assert(total + 100000 < 2147483647);
      await pool.query('UPDATE characters SET gold_cp=$2 WHERE id=$1', [hero.id, total + 100000]);
      assert.equal((await request('/shop/checkout', cart(tier[0].id, fire.id))).status, 400);
      assert.equal(
        (
          await request('/shop/checkout', {
            ...cart(),
            items: [{ item_id: tier[0].id, quantity: 1 }],
          })
        ).status,
        409,
      );
      const payload = {
        character_id: hero.id,
        idempotency_key: randomUUID(),
        items: tier.map((item: any, i: number) => ({
          item_id: item.id,
          quantity: 1,
          spell_id: tierOptions[i % tierOptions.length].id,
        })),
      };
      assert.equal((await request('/shop/checkout', payload)).status, 201);
      assert.equal((await request('/shop/checkout', payload)).status, 200);
      assert.equal(
        (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0].gold_cp,
        100000,
      );
      const owned = (
        await pool.query(
          "SELECT c.*,i.quantity FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 AND c.raw_data->'bound_spell'->>'level'=$2 ORDER BY c.id",
          [hero.id, String(level)],
        )
      ).rows;
      assert.equal(owned.length, 52);
      const [dc, attack] = [
        [13, 5],
        [13, 5],
        [15, 7],
        [15, 7],
        [17, 9],
        [17, 9],
        [18, 10],
        [18, 10],
      ][level - 1];
      for (const item of owned) {
        const parent = tier.find((x: any) => x.id === item.raw_data.configuration_origin),
          line = payload.items.find((x: any) => x.item_id === parent.id);
        assert(parent && line);
        assert.equal(item.active, false);
        assert.equal(item.quantity, 1);
        assert.equal(item.image_path, parent.image_path);
        assert.equal(item.audio_path, parent.audio_path);
        assert.deepEqual(item.raw_data.bound_spell, selectedBoundSpell(parent, line.spell_id));
        assert.deepEqual(compatibleSlots(item), parent.raw_data.equipment_slots);
        assert.equal(twoHanded(item), parent.raw_data.two_handed);
        assert.equal(Number(item.weight_lb), Number(parent.weight_lb));
        assert(
          item.raw_data.rules_summary.includes(`CD ${dc}`) &&
            item.raw_data.rules_summary.includes(`+${attack}`),
        );
        assert.equal(item.raw_data.enhancement, undefined);
      }
      assert.equal(
        (
          await request('/inventory/equipment', {
            character_id: hero.id,
            item_id: owned[0].id,
            slot: 'main_hand',
          })
        ).status,
        200,
      );
      assert.equal((await request('/catalog/' + owned[0].id + '/rules')).status, 200);
    }
    const saved = (
      await pool.query(
        "SELECT id,md5(to_jsonb(c)::text) AS hash FROM catalog_items c WHERE raw_data ? 'configuration_origin' ORDER BY id",
      )
    ).rows;
    await seed();
    assert.deepEqual(
      (
        await pool.query(
          "SELECT id,md5(to_jsonb(c)::text) AS hash FROM catalog_items c WHERE raw_data ? 'configuration_origin' ORDER BY id",
        )
      ).rows,
      saved,
    );
    assert(!(await request('/catalog')).data.some((x: any) => x.id.startsWith('configured-')));
    await pool.query('UPDATE characters SET gold_cp=100000000 WHERE id=$1', [hero.id]);
    console.log(
      'PASS all 416 level 1–8 purchases: correct eligible spells, source DC/attack, tier prices/gold, replay, distinct hidden IDs, anatomy/slots and seed preservation.',
    );
  }
  if (!process.argv.includes('--no-browser')) {
    const recent = requestTimes.filter((t) => Date.now() - t < 60000);
    if (recent.length > 100) {
      console.log(
        'Browser QA is allowing the API rate-limit window to reset after the bulk purchase audit.',
      );
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(60000, Math.max(1, 60050 - (Date.now() - recent[0])))),
      );
    }
    const fallback = await fetch(base + '/qa-index-fallback');
    assert.equal(fallback.status, 200);
    assert.equal(fallback.headers.get('cache-control'), 'no-store');
    assert((await fallback.text()).includes('<html'));
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
    await context.addCookies(
      cookie.split('; ').map((value) => {
        const at = value.indexOf('=');
        return {
          name: value.slice(0, at),
          value: value.slice(at + 1),
          url: base,
          httpOnly: true,
          sameSite: 'Lax' as const,
        };
      }),
    );
    const page = await context.newPage(),
      errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400 && response.url().startsWith(base + '/api/'))
        console.log('Shop QA HTTP', new URL(response.url()).pathname, response.status());
    });
    await mkdir('test-results', { recursive: true });
    const dagger = templates.find((item: any) => item.raw_data.base_item === 'dagger');
    assert(dagger);
    await page.goto(base + '/#shop', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('textbox', { name: 'Procurar item' })).toBeVisible({
      timeout: 60000,
    });
    for (const width of [1500, 760, 390]) {
      await page.setViewportSize({ width, height: 1100 });
      await page.getByRole('textbox', { name: 'Procurar item' }).fill(dagger.name);
      const card = page.locator('.shop-product[data-family="Enspelled Weapon"]');
      await card.locator('select').first().selectOption('dagger');
      if ((await card.locator('.shop-variant-selectors select').count()) > 1)
        await card.locator('.shop-variant-selectors select').nth(1).selectOption(dagger.id);
      const select = card.getByRole('combobox', { name: 'Magia vinculada de ' + dagger.name });
      await expect(select).toBeEnabled();
      await expect
        .poll(() =>
          card
            .locator('.shop-family-box')
            .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
        )
        .toBe(true);
      await expect
        .poll(() =>
          card
            .locator('.shop-family-object')
            .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
        )
        .toBe(true);
      await select.selectOption('');
      await expect(card.getByRole('button', { name: /^Comprar/ })).toBeDisabled();
      await select.selectOption(fire.id);
      await expect(card.getByRole('button', { name: /^Comprar/ })).toBeEnabled();
      await page.screenshot({
        path: 'test-results/shop-spell-binding-' + width + '.png',
        fullPage: true,
      });
      assert((await page.evaluate(() => document.documentElement.scrollWidth)) <= width + 1);
      const {
        rows: [before],
      } = await pool.query(
        "SELECT COALESCE(sum(i.quantity),0)::int AS n FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 AND c.raw_data->>'configuration_origin'=$2 AND c.raw_data->'bound_spell'->>'id'=$3",
        [hero.id, dagger.id, fire.id],
      );
      await card.getByRole('button', { name: /^Comprar/ }).click();
      await page.locator('.shop-cart-toggle').click();
      await expect(page.locator('.shop-checkout')).toContainText('Magia vinculada: ' + fire.label);
      const response = page.waitForResponse(
        (response) =>
          response.url() === base + '/api/shop/checkout' && response.request().method() === 'POST',
      );
      await page
        .locator('.shop-checkout')
        .getByRole('button', { name: /Finalizar|Confirmar|Pagar/ })
        .click();
      assert.equal((await response).status(), 201);
      await expect(page.locator('.shop-checkout')).toBeHidden();
      assert.equal(
        (
          await pool.query(
            "SELECT COALESCE(sum(i.quantity),0)::int AS n FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 AND c.raw_data->>'configuration_origin'=$2 AND c.raw_data->'bound_spell'->>'id'=$3",
            [hero.id, dagger.id, fire.id],
          )
        ).rows[0].n,
        before.n + 1,
      );
      if (higher.length) {
        await page.getByRole('textbox', { name: 'Procurar item' }).fill('Arma com magia vinculada');
        const tierCard = page.locator('.shop-product[data-family="Enspelled Weapon"]');
        await tierCard.locator('.shop-variant-selectors select').first().selectOption('dagger');
        const levelSelect = tierCard.getByRole('combobox', {
          name: 'Nível da magia de ARMAS COM MAGIA VINCULADA',
        });
        await expect(levelSelect.locator('option')).toHaveCount(10);
        for (let level = 1; level <= 8; level++) {
          const item = higher.find(
            (x: any) =>
              x.raw_data.base_item === 'dagger' && x.raw_data.spell_binding.level === level,
          );
          let temporaryUnavailable = level === 1 && width === 1500;
          if (temporaryUnavailable) {
            await page.route('**/api/catalog/' + item.id + '/spell-options', async (route) => {
              if (temporaryUnavailable)
                await route.fulfill({
                  status: 503,
                  contentType: 'application/json',
                  body: JSON.stringify({ error: 'Falha temporária de validação' }),
                });
              else await route.continue();
            });
          }
          await levelSelect.selectOption(item.id);
          await expect(tierCard).toHaveAttribute('data-item-id', item.id);
          const choices = tierCard.getByRole('combobox', {
            name: 'Magia vinculada de ' + item.name,
          });
          if (level === 1 && width === 1500) {
            await expect(tierCard.getByRole('alert')).toContainText(
              'Falha temporária de validação',
            );
            temporaryUnavailable = false;
            await tierCard.getByRole('button', { name: 'Tentar novamente' }).click();
          }
          await expect(choices).toBeEnabled();
          const expected = boundSpellOptions(spellBindingSpec(item)!);
          await expect(choices.locator('option')).toHaveCount(expected.length + 1);
          await choices.selectOption('');
          await expect(tierCard.getByRole('button', { name: /^Comprar/ })).toBeDisabled();
          const image = tierCard.locator('.shop-family-object');
          await expect(image).toHaveAttribute('src', item.image_path);
          await image.evaluate((i: HTMLImageElement) => i.decode());
          await choices.selectOption(expected[0].id);
          await expect(tierCard.getByRole('button', { name: /^Comprar/ })).toBeEnabled();
          if ([1, 4, 8].includes(level)) {
            await page.screenshot({
              path: `test-results/shop-spell-level-${level}-${width}.png`,
              fullPage: true,
            });
            await tierCard.getByRole('button', { name: /^Comprar/ }).click();
            await page.locator('.shop-cart-toggle').click();
            await expect(page.locator('.shop-checkout')).toContainText(
              'Magia vinculada: ' + expected[0].label,
            );
            const reply = page.waitForResponse(
              (r) => r.url() === base + '/api/shop/checkout' && r.request().method() === 'POST',
            );
            await page
              .locator('.shop-checkout')
              .getByRole('button', { name: /Finalizar|Confirmar|Pagar/ })
              .click();
            assert.equal((await reply).status(), 201);
            await expect(page.locator('.shop-checkout')).toBeHidden();
          }
          assert((await page.evaluate(() => document.documentElement.scrollWidth)) <= width + 1);
        }
      }
    }
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Procurar item' })).toBeVisible();
    assert.deepEqual(errors, []);
    console.log(
      'PASS real authenticated Shop in three widths: required selector, current 41 cantrips, exact cart choice, actual checkout and persistent distinct exemplar.',
    );
  }
} finally {
  await browser?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
