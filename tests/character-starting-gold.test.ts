import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, transaction } from '../server/db.js';
import { migrate } from '../server/migrate.js';
import { grantCharacterStartingGold } from '../server/character-starting-gold.js';
import { completeArt } from '../server/character-art.js';
import { CHARACTER_STARTING_GOLD_CP } from '../shared/character-starting-gold.js';
import {
  defaultChoices,
  startingGold,
  equipmentFields,
  backgroundRules,
} from '../shared/character-sheet.js';
import { classes } from '../shared/rules.js';
import { testArtImage, testTokenImage } from './character-fixtures.js';

assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);

test('ouro inicial fixo de 6.000 PO, sem variação por classe, antecedente ou conjunto', () => {
  assert.equal(CHARACTER_STARTING_GOLD_CP, 600000);
  for (const cls of classes)
    for (const background of Object.keys(backgroundRules)) {
      const choices = defaultChoices('Humano', cls, background);
      for (const item of equipmentFields(cls)[0].options)
        for (const origin of equipmentFields(cls)[1].options) {
          assert.equal(
            startingGold(cls, { ...choices, equipment: { package: [item], background: [origin] } }),
            600000,
          );
        }
    }
});

test('cada criação recebe 6.000 PO: contas antigas, segundo personagem, beta, repetição, retomada e propriedade', async () => {
  await migrate();
  const createUser = async () => {
    const id = randomUUID();
    await pool.query(
      'INSERT INTO "user"(id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,\'Ouro inicial\',$2,false,now(),now())',
      [id, id + '@example.test'],
    );
    return id;
  };
  const balance = async (id: string) =>
    (await pool.query('SELECT gold_cp FROM characters WHERE id=$1', [id])).rows[0].gold_cp;
  const portrait = await testArtImage(),
    token = await testTokenImage();
  async function queue(userId: string) {
    const choices = {
      ...defaultChoices('Humano', 'Guerreiro'),
      physicalTraits: { gender: 'male', height: 'average', build: 'average', age: 'adult' },
    };
    const {
      rows: [job],
    } = await pool.query(
      "INSERT INTO character_art_jobs(user_id,creation,reference,idempotency_key,status) VALUES($1,$2,$3,$4,'running') RETURNING id",
      [
        userId,
        JSON.stringify({ name: 'Nova ficha', race: 'Humano', class: 'Guerreiro', choices }),
        portrait,
        randomUUID(),
      ],
    );
    return job.id as string;
  }
  const regular = await createUser(),
    other = await createUser();
  const firstJob = await queue(regular);
  assert.equal(await completeArt(firstJob, { portrait }),null);
  assert.equal((await pool.query('SELECT count(*)::int n FROM characters WHERE user_id=$1',[regular])).rows[0].n,0,'Checkpoint privado não cria ficha nem credita ouro');
  const first = await completeArt(firstJob, { portrait,token });
  assert.equal(await balance(first), 600000, 'Já vem com o valor na criação');
  await pool.query('UPDATE characters SET gold_cp=gold_cp-20000 WHERE id=$1', [first]);
  assert.equal(await completeArt(firstJob, { portrait, token }), first);
  assert.equal(await completeArt(firstJob, { portrait, token }), first);
  assert.equal(await balance(first), 580000, 'Retomar/completar/repetir não repõe gastos');
  const secondJob = await queue(regular);
  const ids = await Promise.all(
    Array.from({ length: 4 }, () => completeArt(secondJob, { portrait, token })),
  );
  assert(ids.every((id) => id === ids[0]));
  assert.equal(await balance(ids[0]), 600000, 'Segundo personagem da mesma conta também recebe');
  await pool.query('UPDATE characters SET deleted_at=now() WHERE id=$1', [ids[0]]);
  const replacement = await completeArt(await queue(regular), { portrait, token });
  assert.equal(await balance(replacement), 600000, 'Nova ficha após exclusão também recebe');
  await pool.query('UPDATE beta_registration_settings SET enabled=true');
  const beta = await createUser();
  await pool.query('UPDATE beta_accounts SET initial_gold_cp=2000000 WHERE user_id=$1', [beta]);
  for (let i = 0; i < 2; i++)
    assert.equal(
      await balance(await completeArt(await queue(beta), { portrait, token })),
      600000,
      'Beta não soma outra quantia ou restringe ao primeiro personagem',
    );
  const betaGrant = (
    await pool.query('SELECT initial_gold_cp,granted_at FROM beta_accounts WHERE user_id=$1', [
      beta,
    ])
  ).rows[0];
  assert.equal(betaGrant.initial_gold_cp, 600000);
  assert(betaGrant.granted_at, 'Reserva beta pendente é encerrada sem um segundo pagamento');
  const legacy = (
    await pool.query(
      "INSERT INTO characters(user_id,name,race,class,hp,gold_cp,starting_wealth_granted) VALUES($1,'Legado','Humano','Guerreiro',10,98765,true) RETURNING id",
      [other],
    )
  ).rows[0].id;
  assert.equal(await transaction((db) => grantCharacterStartingGold(db, other, legacy)), false);
  assert.equal(await balance(legacy), 98765);
  const pending = (
    await pool.query(
      "INSERT INTO characters(user_id,name,race,class,hp,gold_cp,starting_wealth_granted) VALUES($1,'Pendente','Humano','Guerreiro',10,0,false) RETURNING id",
      [other],
    )
  ).rows[0].id;
  assert.equal(await transaction((db) => grantCharacterStartingGold(db, regular, pending)), false);
  const grants = await Promise.all(
    Array.from({ length: 5 }, () =>
      transaction((db) => grantCharacterStartingGold(db, other, pending)),
    ),
  );
  assert.equal(grants.filter(Boolean).length, 1);
  assert.equal(await balance(pending), 600000);
  assert.equal(await balance(first), 580000);
});

test.after(async () => {
  await pool.query('UPDATE beta_registration_settings SET enabled=false');
  await pool.end();
});
