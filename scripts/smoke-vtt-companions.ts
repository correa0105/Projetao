import 'dotenv/config';
import { chromium, expect, type BrowserContext } from '@playwright/test';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import sharp from 'sharp';
import { wallSchema } from '../shared/vtt';
import { vttAssetPath, vttAssetId } from '../shared/vtt-token-image';
import { companionMime } from '../shared/vtt-companions';
import { basicCompanionToken } from '../shared/companion-token-art';
import { mounts } from '../shared/mounts';
import { pets, petVariants } from '../shared/pets';
if (!/^\/alvorada_test_[0-9a-f]{32}$/.test(new URL(process.env.DATABASE_URL!).pathname))
  throw Error('Disposable database required');
const origin = 'http://localhost:3048';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db'),
  { migrate } = await import('../server/migrate'),
  { seed } = await import('../server/seed'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures'),
  { completeCompanionArt, trustedCompanionBase } = await import('../server/companion-equipment');
await migrate();
await seed();
const { createApp } = await import('../server/app'),
  server = createApp().listen(3048, '127.0.0.1');
await new Promise<void>((r) => server.once('listening', r));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  contexts = await Promise.all(
    [0, 1, 2, 3].map(() =>
      browser.newContext({
        viewport: { width: 1440, height: 1000 },
        extraHTTPHeaders: { 'X-Vtt-Schema-Version': '7' },
        reducedMotion: 'reduce',
      }),
    ),
  ),
  [gm, player, spectator, stranger] = contexts;
const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
async function api(c: BrowserContext, path: string, method = 'GET', data?: unknown) {
  const r = await c.request.fetch(origin + '/api' + path, {
    method,
    headers: { Origin: origin },
    data,
  });
  return {
    status: r.status(),
    headers: r.headers(),
    data: r.headers()['content-type']?.includes('json') ? await r.json() : await r.body(),
  };
}
async function signup(c: BrowserContext, name: string) {
  const body = {
    name,
    email: randomUUID() + '@example.test',
    password: 'Test-' + randomUUID(),
  };
  let r = await api(c, '/auth/sign-up/email', 'POST', body);
  if (r.status === 429) {
    const delay = Number(r.headers['retry-after'] || r.headers['x-retry-after']);
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(60);
    await new Promise((resolve) => setTimeout(resolve, (delay + 0.2) * 1000));
    r = await api(c, '/auth/sign-up/email', 'POST', body);
  }
  expect(r.status).toBe(200);
  return r.data.user;
}
try {
  const stock = new Set<string>();
  for (const m of mounts)
    for (const a of ['original', 'alternate']) stock.add(basicCompanionToken('mount', m.id, a)!);
  for (const p of pets) {
    stock.add(basicCompanionToken('pet', p.id)!);
    for (const a of petVariants.filter((a) => a.pet_id === p.id))
      stock.add(basicCompanionToken('pet', p.id, a.id)!);
  }
  expect(stock.size).toBe(25);
  const hashes = new Set<string>();
  for (const file of stock) {
    const b = await readFile('public' + file),
      meta = await sharp(b).metadata();
    expect(meta.hasAlpha).toBe(true);
    expect(meta.width).toBe(meta.height);
    expect((await sharp(b).stats()).isOpaque).toBe(false);
    hashes.add(hash(b));
  }
  expect(hashes.size).toBe(25);
  expect(basicCompanionToken('pet', 'dog', 'longhair')).toBeNull();
  const master = await signup(gm, 'Mestre'),
    owner = await signup(player, 'Alice da mesa'),
    viewer = await signup(spectator, 'Visitante'),
    outside = await signup(stranger, 'Outro jogador');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [master.id]);
  const hero = await createLegacyTestCharacter(owner.id, 'Guardião teste'),
    foreign = await createLegacyTestCharacter(viewer.id, 'Personagem visitante');
  await pool.query('UPDATE characters SET gold_cp=1000000 WHERE id=ANY($1::uuid[])', [
    [hero.id, foreign.id],
  ]);
  const mount = (
    await api(player, '/stable/purchase', 'POST', {
      character_id: hero.id,
      mount_id: 'riding-horse',
      coat: 'alternate',
      name: 'Brisa',
      idempotency_key: randomUUID(),
    })
  ).data.mount;
  const dog = (
    await api(player, '/pets/purchase', 'POST', {
      character_id: hero.id,
      pet_id: 'dog',
      appearance: 'shepherd',
      name: 'Fenrir',
      idempotency_key: randomUUID(),
    })
  ).data.pet;
  const rabbit = (
    await api(spectator, '/pets/purchase', 'POST', {
      character_id: foreign.id,
      pet_id: 'rabbit',
      name: 'Nuvem',
      idempotency_key: randomUUID(),
    })
  ).data.pet;
  expect(mount.id).toBeTruthy();
  expect(dog.id).toBeTruthy();
  expect(rabbit.id).toBeTruthy();
  let room = (await api(gm, '/vtt', 'POST', { name: 'Animais dos jogadores' })).data,
    root = '/vtt/rooms/' + room.id;
  await api(player, '/vtt/join', 'POST', { invite: room.invite, role: 'player' });
  await api(spectator, '/vtt/join', 'POST', { invite: room.invite, role: 'spectator' });
  room = (await api(gm, root)).data;
  room.document.scenes[0].fog = room.document.scenes[0].lighting = false;
  room.document.journal.push({
    id: randomUUID(),
    title: 'Diário extenso',
    text: 'Anotação privada. '.repeat(750),
    image: '',
    public: false,
  });
  room = (await api(gm, root, 'PUT', { revision: room.revision, document: room.document })).data;
  expect(room.document.journal[0].text.length).toBeGreaterThan(8000);
  const list = (await api(player, root + '/companions')).data.companions;
  expect(list.map((a: any) => a.id).sort()).toEqual([dog.id, mount.id].sort());
  for (const a of list) {
    expect(a.ownerName).toBe('Alice da mesa');
    expect(a.characterName).toBe('Guardião teste');
    expect(a.portraitUrl).toContain('/base-image');
  }
  expect((await api(spectator, root + '/companions')).data.companions).toEqual([]);
  expect((await api(stranger, root + '/companions')).status).toBe(404);
  expect((await api(gm, root + '/companions/' + dog.id, 'POST', {})).status).toBe(404);
  expect((await api(spectator, root + '/companions/' + rabbit.id, 'POST', {})).status).toBe(403);
  const stale = await player.request.get(origin + '/api' + root, {
    headers: { 'X-Vtt-Schema-Version': '5' },
  });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error).toContain('Recarregue');
  const mountImport = await api(player, root + '/companions/' + mount.id, 'POST', {
    position: { x: 400, y: 400 },
  });
  expect(mountImport.status).toBe(201);
  const petImport = await api(player, root + '/companions/' + dog.id, 'POST', {
    position: { x: 600, y: 400 },
  });
  expect(petImport.status).toBe(201);
  const animalToken = petImport.data.document.scenes[0].tokens.find(
      (t: any) => t.companionId === dog.id,
    ),
    mountToken = mountImport.data.document.scenes[0].tokens.find(
      (t: any) => t.companionId === mount.id,
    );
  expect(animalToken.controller).toBe(owner.id);
  expect(animalToken.characterId).toBeNull();
  expect(mountToken.width).toBe(mountImport.data.document.scenes[0].grid.size * 2);
  const repeated = await api(player, root + '/companions/' + dog.id, 'POST', {});
  expect(repeated.status).toBe(201);
  expect(
    repeated.data.document.scenes[0].tokens.filter((t: any) => t.companionId === dog.id),
  ).toHaveLength(1);
  const ownTokenPath = '/companions/' + hero.id + '/pet/' + dog.id + '/token',
    ownArt = await api(player, ownTokenPath);
  expect(ownArt.status).toBe(200);
  expect(ownArt.headers['cache-control']).toMatch(/private.*no-store/);
  expect(hash(ownArt.data)).toBe(
    hash(await readFile('public' + basicCompanionToken('pet', 'dog', 'shepherd'))),
  );
  expect((await api(stranger, ownTokenPath)).status).toBe(404);
  expect((await api(gm, ownTokenPath)).status).toBe(404);
  expect((await api(player, animalToken.image.replace('/api', ''))).status).toBe(200);
  room = (await api(gm, root)).data;
  const scene = room.document.scenes[0];
  scene.walls = [
    wallSchema.parse({
      id: randomUUID(),
      a: { x: 500, y: 0 },
      b: { x: 500, y: scene.height },
      kind: 'wall',
    }),
  ];
  expect(
    (await api(gm, root, 'PUT', { revision: room.revision, document: room.document })).status,
  ).toBe(200);
  expect(
    (await api(player, root + '/companions/' + dog.id, 'POST', { position: { x: 400, y: 400 } }))
      .status,
  ).toBe(400);
  room = (await api(gm, root)).data;
  const t = room.document.scenes[0].tokens.find((t: any) => t.id === animalToken.id);
  t.locked = true;
  await api(gm, root, 'PUT', { revision: room.revision, document: room.document });
  expect((await api(player, root + '/companions/' + dog.id, 'POST', {})).status).toBe(403);
  room = (await api(gm, root)).data;
  const hidden = room.document.scenes[0].tokens.find((t: any) => t.id === animalToken.id);
  hidden.locked = false;
  hidden.hidden = true;
  await api(gm, root, 'PUT', { revision: room.revision, document: room.document });
  expect((await api(player, animalToken.image.replace('/api', ''))).status).toBe(404);
  expect((await api(gm, animalToken.image.replace('/api', ''))).status).toBe(200);
  expect((await api(player, root + '/companions/' + dog.id, 'POST', {})).status).toBe(403);
  room = (await api(gm, root)).data;
  room.document.scenes[0].walls = [];
  room.document.scenes[0].tokens.find((t: any) => t.id === animalToken.id).hidden = false;
  const customBytes = await readFile('public' + basicCompanionToken('pet', 'dog', 'shepherd')),
    customAsset = (
      await pool.query(
        "INSERT INTO vtt_assets(room_id,name,kind,mime,bytes,width,height)VALUES($1,'Escolha do mestre','image','image/webp',$2,1024,1024)RETURNING id",
        [room.id, customBytes],
      )
    ).rows[0].id,
    custom = {
      ...animalToken,
      id: randomUUID(),
      hidden: true,
      x: 750,
      image: vttAssetPath(customAsset),
    };
  room.document.scenes[0].tokens.push(custom);
  await api(gm, root, 'PUT', { revision: room.revision, document: room.document });
  const reference = await trustedCompanionBase({
      kind: 'pet',
      species_id: 'dog',
      appearance: 'shepherd',
    }),
    token = await sharp(customBytes).png().toBuffer(),
    job = randomUUID();
  await pool.query(
    "INSERT INTO companion_art_jobs(id,user_id,character_id,wardrobe_id,kind,species_id,appearance,name,equipment_revision,status,idempotency_key)VALUES($1,$2,$3,$4,'pet','dog','shepherd','Fenrir',0,'running',$5)",
    [job, owner.id, hero.id, dog.id, randomUUID()],
  );
  await expect(
    completeCompanionArt(job, { portrait: reference, token: Buffer.from('not an image') }),
  ).rejects.toThrow();
  expect(
    (
      await pool.query('SELECT count(*)::int n FROM companion_artworks WHERE wardrobe_id=$1', [
        dog.id,
      ])
    ).rows[0].n,
  ).toBe(0);
  expect(
    (await pool.query('SELECT image_revision FROM companion_wardrobes WHERE id=$1', [dog.id]))
      .rows[0].image_revision,
  ).toBe(0);
  // Simultaneous import and publication must serialize without deadlocking.
  const both = await Promise.all([
    completeCompanionArt(job, { portrait: reference, token }),
    api(player, root + '/companions/' + dog.id, 'POST', {}),
  ]);
  expect(both[0].status).toBe('completed');
  expect(both[1].status).toBe(201);
  await completeCompanionArt(job, { portrait: reference, token });
  expect(
    (await pool.query('SELECT image_revision FROM companion_wardrobes WHERE id=$1', [dog.id]))
      .rows[0].image_revision,
  ).toBe(1);
  const published = (await api(gm, root)).data.document.scenes[0].tokens,
    updated = published.find((t: any) => t.id === animalToken.id);
  expect(updated.image).not.toBe(animalToken.image);
  expect(updated.x).toBe(animalToken.x);
  expect(updated.hp).toBe(animalToken.hp);
  expect(published.find((t: any) => t.id === custom.id).image).toBe(custom.image);
  expect(
    (
      await pool.query('SELECT companion_art_source FROM vtt_assets WHERE id=$1', [
        vttAssetId(updated.image),
      ])
    ).rows[0].companion_art_source,
  ).toBe(dog.id);
  expect(hash((await api(player, ownTokenPath)).data)).toBe(hash(token));
  const principalPath = '/companions/' + hero.id + '/pet/' + dog.id + '/image';
  expect((await api(player, principalPath)).status).toBe(200);
  const second = randomUUID();
  await pool.query('UPDATE companion_wardrobes SET revision=1 WHERE id=$1', [dog.id]);
  await pool.query(
    "INSERT INTO companion_art_jobs(id,user_id,character_id,wardrobe_id,kind,species_id,appearance,name,equipment_revision,status,idempotency_key)VALUES($1,$2,$3,$4,'pet','dog','shepherd','Fenrir',0,'running',$5)",
    [second, owner.id, hero.id, dog.id, randomUUID()],
  );
  expect((await completeCompanionArt(second, { portrait: reference, token })).status).toBe('stale');
  expect(
    (await pool.query('SELECT image_revision FROM companion_wardrobes WHERE id=$1', [dog.id]))
      .rows[0].image_revision,
  ).toBe(1);
  const page = await player.newPage(),
    errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await mkdir('test-results', { recursive: true });
  await page.goto(origin + '/#vtt');
  await expect(page.getByLabel('Tabuleiro da mesa', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fichas', exact: true }).click();
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole('button', { name: 'Montarias', exact: true }).click();
    const card = page.getByRole('button', { name: 'Colocar Brisa · Guardião teste', exact: true });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Pertence a Guardião teste · Alice da mesa');
    await expect(card.locator('img')).toHaveCount(2);
    await expect(card).toBeEnabled();
    const clicked = page.waitForResponse(
      (r) => r.url().endsWith('/companions/' + mount.id) && r.request().method() === 'POST',
    );
    await card.click();
    expect((await clicked).status()).toBe(201);
    await expect(page.getByRole('button', { name: 'Montarias', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.screenshot({ path: `test-results/vtt-companions-mount-${width}.png` });
    await page.getByRole('button', { name: 'Mascotes', exact: true }).click();
    const petCard = page.getByRole('button', {
      name: 'Colocar Fenrir · Guardião teste',
      exact: true,
    });
    await expect(petCard.locator('.vtt-companion-thumbnail img')).toHaveAttribute(
      'src',
      /\/image\?v=1/,
    );
    await expect(petCard.locator('.vtt-companion-token-mini img')).toHaveAttribute(
      'src',
      /\/token\?v=1/,
    );
    const transfer = await page.evaluateHandle((mime) => {
      const d = new DataTransfer();
      d.setData(mime, '');
      return d;
    }, companionMime);
    await expect(petCard).toBeEnabled();
    await petCard.dispatchEvent('dragstart', { dataTransfer: transfer });
    const board = page.getByLabel('Tabuleiro da mesa', { exact: true }),
      box = (await board.boundingBox())!;
    const dropped = page.waitForResponse(
      (r) => r.url().endsWith('/companions/' + dog.id) && r.request().method() === 'POST',
    );
    await board.dispatchEvent('drop', {
      dataTransfer: transfer,
      clientX: box.x + box.width * 0.6,
      clientY: box.y + box.height * 0.55,
    });
    const dropResponse = await dropped;
    expect(dropResponse.status()).toBe(201);
    expect(dropResponse.request().postDataJSON().position).toEqual({
      x: expect.any(Number),
      y: expect.any(Number),
    });
    await expect(page.getByRole('button', { name: 'Mascotes', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect
      .poll(
        async () =>
          (await api(player, root)).data.document.scenes[0].tokens.filter(
            (t: any) => t.companionId === dog.id,
          ).length,
      )
      .toBe(1);
    await page.screenshot({ path: `test-results/vtt-companions-pet-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    );
  }
  expect(errors).toEqual([]);
  console.log(
    'PASS 25 species/coat tokens; owned cards, room import, click/drag, wall/lock/hidden/privacy; atomic paired artwork, idempotency, stale guard and concurrent sync preserve custom GM art; three browser widths.',
  );
} finally {
  await Promise.all(contexts.map((c) => c.close()));
  await browser.close();
  await new Promise<void>((r) => server.close(() => r()));
  await pool.end();
}
