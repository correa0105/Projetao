import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { pool } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { seed } from '../server/seed.js';
import { createLegacyTestCharacter } from './character-fixtures.js';

test('Explicações do Empório: fonte aberta, tradução e variantes reais', async (t) => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  await migrate();
  await seed();
  const dataset = JSON.parse(await readFile('data/shop-item-rules.json', 'utf8'));
  const { createApp } = await import('../server/app.js');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  async function req(path: string, cookie = '', body?: unknown) {
    const response = await fetch(base + path, {
      method: body ? 'POST' : 'GET',
      headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json(), headers: response.headers };
  }
  try {
    const account = await req('/auth/sign-up/email', '', {
      name: 'Leitor das regras',
      email: `item-rules-${randomUUID()}@example.test`,
      password: `Test-${randomUUID()}`,
    });
    assert.equal(account.status, 200);
    const cookie = account.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    const hero = await createLegacyTestCharacter(account.data.user.id, 'Aurora das regras');
    const snapshot = async () => ({
      gold: (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [hero.id])).rows[0]
        .gold_cp,
      purchases: (await pool.query('SELECT count(*)::int AS n FROM purchases')).rows[0].n,
      prices: (await pool.query('SELECT id,price_cp FROM catalog_items ORDER BY id')).rows,
    });
    const before = await snapshot();
    const rules = async (id: string) => {
      const response = await req(`/catalog/${id}/rules`, cookie);
      assert.equal(response.status, 200, id + ': ' + JSON.stringify(response.data));
      assert.equal(response.data.descriptionPortuguese, response.data.description);
      assert.ok(response.data.description.length > 20);
      return response.data;
    };

    await t.test('todos os itens SRD têm correspondência licenciada em fonte fixada', async () => {
      assert.equal(dataset.license, 'CC BY 4.0');
      assert.match(dataset.upstream_commit, /^[0-9a-f]{40}$/);
      assert.equal(Object.keys(dataset.upstream_sha256).length, 3);
      const srd = (
        await pool.query("SELECT id FROM catalog_items WHERE active=true AND source='SRD 5.2.1'")
      ).rows;
      assert.equal(srd.length, 1298);
      assert.equal(Object.keys(dataset.items).length, srd.length);
      for (const { id } of srd) {
        assert.ok(dataset.items[id], id);
        for (const key of dataset.items[id].keys)
          assert.equal(dataset.records[key].srd52, true, key);
      }
    });
    await t.test(
      'nenhum marcador ou referência interna sobra; dados e números são preservados',
      () => {
        const tokens = (text: string) =>
          (
            text
              .replace(/(?<!\d)\d{1,3}(?:[,.]\d{3})+(?!\d)/g, (value) => value.replace(/[,.]/g, ''))
              .match(/\b\d*d\d+(?:\s*[+-]\s*\d+)?\b|[+-]?\d+(?:\.\d+)?/gi) || []
          )
            .map((value) => value.replace(/\s/g, '').toLowerCase())
            .sort();
        for (const [key, record] of Object.entries(dataset.records) as [string, any][]) {
          assert.doesNotMatch(
            record.english + record.portuguese + record.stats,
            /\{[#@=]|\{\{|ZZ\s*NUMBER/,
            key,
          );
          assert.doesNotMatch(record.portuguese, /\bSpell\s+[A-Z]/, key);
          assert.doesNotMatch(record.portuguese, /\\n/, key);
          if (record.english) {
            assert.ok(record.portuguese.trim(), key);
            assert.deepEqual(tokens(record.portuguese), tokens(record.english), key);
          }
          assert.doesNotMatch(
            record.portuguese,
            /economizando lances|poupar lances|Acertar ponto|\bArmor\b|\bManacles\b|\bBonus Action\b|\bsaving throws?\b|\bHP\b|\bDM\b|\bSpellcasting\b/i,
            key,
          );
          assert.doesNotMatch(record.stats, /\bby a\b/, key);
          if (/\bpints?\b/i.test(record.english))
            assert.match(record.portuguese, /\bpintas?\b/i, key);
          if (/\bcubic (?:foot|feet)\b/i.test(record.english))
            assert.match(record.portuguese, /\bp[ée]s? c[uú]bicos?\b/i, key);
        }
      },
    );
    await t.test(
      'consulta exige sessão, rejeita ID desconhecido e usa nome real do catálogo',
      async () => {
        assert.equal((await req('/catalog/club/rules')).status, 401);
        assert.equal((await req('/catalog/no-such-item/rules', cookie)).status, 404);
        assert.equal((await req('/catalog/house-no-such-item/rules', cookie)).status, 404);
        assert.equal((await req('/catalog/%27%20OR%201%3D1/rules', cookie)).status, 400);
        const club = await rules('club');
        assert.equal(
          club.title,
          (await pool.query("SELECT name FROM catalog_items WHERE id='club'")).rows[0].name,
        );
        assert.equal(club.project_content, false);
        assert.match(club.reference_url, /^https:\/\/5e\.tools\/items\.html#/);
      },
    );
    await t.test('poções maior, superior e suprema mostram suas próprias curas', async () => {
      for (const [id, dice] of [
        ['potion-of-healing-greater', '4d4 + 4'],
        ['potion-of-healing-superior', '8d4 + 8'],
        ['potion-of-healing-supreme', '10d4 + 20'],
      ]) {
        const item = await rules(id);
        assert.ok(item.description.replace(/\s/g, '').includes(dice.replace(/\s/g, '')), id);
        assert.doesNotMatch(item.description, /2d4\s*\+\s*2/);
        assert.match(item.description, /pontos de vida/i);
      }
    });
    await t.test(
      'cintos mostram Força 21, 23, 25, 27 e 29 sem herdar a variante menor',
      async () => {
        for (const [id, strength] of [
          ['belt-of-giant-strength', 21],
          ['belt-of-giant-strength-frost-stone', 23],
          ['belt-of-giant-strength-fire', 25],
          ['belt-of-giant-strength-cloud', 27],
          ['belt-of-giant-strength-storm', 29],
        ] as const) {
          const item = await rules(id);
          assert.match(item.description, new RegExp(`Força[^.\n]*${strength}`));
          assert.match(item.description, /não tem efeito|não produz efeito/i);
        }
      },
    );
    await t.test('resistência traz o dano exato e estatísticas do modelo escolhido', async () => {
      const force = await rules('armor-of-resistance-chain-mail-force');
      assert.match(force.description, /resistência[^.\n]*força/i);
      assert.match(force.description, /CA: 16/);
      assert.match(force.description, /Força mínima: 13/);
      assert.doesNotMatch(force.description, /resistência[^.\n]*ácido/i);
      assert.match(decodeURIComponent(force.reference_url), /chain mail of force resistance_xdmg/);
      const fire = await rules('armor-of-resistance-leather-armor-fire');
      assert.match(fire.description, /resistência[^.\n]*fogo/i);
      assert.match(fire.description, /CA: 11.*Destreza/);
    });
    await t.test(
      'armas preservam bônus, poderes e modelo; regras 2024 não usam efeito 2014',
      async () => {
        const bow = await rules('energy-bow-shortbow');
        assert.match(bow.description, /\+1/);
        assert.match(bow.description, /dano de força|dano[^.\n]*força/i);
        assert.match(bow.description, /CD 15/);
        assert.match(bow.description, /CD 20/);
        assert.match(bow.description, /60 pés/);
        assert.match(bow.description, /20 pés/);
        assert.match(bow.description, /1d6 de força/);
        assert.doesNotMatch(bow.description, /Dano: 1d6 perfurante/);
        assert.match(decodeURIComponent(bow.reference_url), /energy shortbow_xdmg/);
        const sharp = await rules('sword-of-sharpness-greatsword');
        assert.match(sharp.description, /14/);
        assert.match(sharp.description, /Exaustão/i);
        assert.doesNotMatch(sharp.description, /decepa|arranca.*membro|sever/i);
        const dancing = await rules('dancing-sword-rapier');
        assert.match(dancing.description, /ação bônus/i);
        assert.match(dancing.description, /quarta|quarto/i);
        assert.match(dancing.description, /30 pés/);
        assert.match(dancing.description, /mão/);
        for (const bonus of [1, 2, 3]) {
          const weapon = await rules(
            bonus === 1 ? 'magic-weapon' : `magic-weapon-longsword-plus-${bonus}`,
          );
          assert.match(weapon.description, new RegExp(`\\+${bonus}[^.\n]*(ataque|dano)`));
          if (bonus !== 1) assert.doesNotMatch(weapon.description, /bônus[^.\n]*\+1/);
        }
      },
    );
    await t.test(
      'House e itens próprios explicam o aplicativo sem atribuir regra oficial; consultas não gastam',
      async () => {
        for (const id of [
          'house-frame',
          'house-chest',
          'pet-armor-leather',
          'pet-collar-medallion',
        ]) {
          const item = await rules(id);
          assert.equal(item.project_content, true);
          assert.equal(item.source_name, 'Conteúdo do projeto');
          assert.equal(item.reference_url, '');
          assert.equal(item.source_url, '');
          assert.match(item.description, /Não concede bônus de combate/i);
        }
        const cosmeticId = (
          await pool.query(
            "SELECT id FROM catalog_items WHERE active=true AND category='Cosméticos' LIMIT 1",
          )
        ).rows[0].id;
        assert.equal((await rules(cosmeticId)).project_content, true);
        assert.deepEqual(await snapshot(), before);
      },
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
    await pool.end();
  }
});
