import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { newScene, newToken, terrainStrokeSchema, type VttState } from '../shared/vtt';
import { siegeWaterAt } from '../shared/vtt-siege-surface';
import { siegeImpactPosition, type SiegeSnapshot, type SiegeImpact } from '../shared/vtt-siege';
import { vehicleImage } from '../shared/vtt-vehicles';
import { vttProtocolVersion } from '../shared/vtt-protocol';
import { pool } from '../server/db';
import { migrate } from '../server/migrate';

test('água: oceano, terra pintada, água sobre terra, borracha, opacidade e camadas ocultas', () => {
  const s = newScene(randomUUID(), 'Costa');
  s.ocean = { enabled: true, animated: true, speed: 1, seaVolume: 0, windVolume: 0 };
  const p = { x: 500, y: 500 },
    land = terrainStrokeSchema.parse({
      id: randomUUID(),
      texture: 'sand',
      points: [p],
      radius: 180,
      softness: 0,
      opacity: 1,
      textureScale: 100,
    });
  assert(siegeWaterAt(s, p));
  s.terrain.push(land);
  assert(!siegeWaterAt(s, p));
  assert(siegeWaterAt(s, { x: 800, y: 500 }));
  s.terrain.push({ ...land, id: randomUUID(), texture: 'water', radius: 100 });
  assert(siegeWaterAt(s, p));
  s.terrain.pop();
  s.terrain.push({ ...land, id: randomUUID(), erase: true, radius: 100 });
  assert(siegeWaterAt(s, p));
  s.terrain.pop();
  s.terrainLayers[0].visible = false;
  assert(siegeWaterAt(s, p));
  s.terrainLayers[0].visible = true;
  s.terrainLayers[0].opacity = 0.2;
  assert(siegeWaterAt(s, p));
  s.terrainLayers[0].opacity = 1;
  assert(!siegeWaterAt(s, p));
  s.ocean.enabled = false;
  s.terrain = [];
  assert(!siegeWaterAt(s, p));
  s.terrain.push({
    ...land,
    texture: 'water',
    points: [
      { x: 400, y: 500 },
      { x: 600, y: 500 },
    ],
    shape: 'square',
    radius: 100,
  });
  assert(siegeWaterAt(s, { x: 500, y: 590 }));
  assert(!siegeWaterAt(s, { x: 500, y: 650 }));
});
test('projétil preso acompanha posição, giro e espelho do alvo; alvo removido mantém ponto original', () => {
  const s = newScene(randomUUID(), 'Alvo'),
    target = newToken(randomUUID(), s);
  Object.assign(target, { x: 100, y: 100, width: 100, height: 200, rotation: 90 });
  s.tokens.push(target);
  const impact: SiegeImpact = {
    id: randomUUID(),
    shotId: randomUUID(),
    sceneId: s.id,
    weaponId: randomUUID(),
    kind: 'harpoon',
    point: { x: 80, y: 125 },
    rotation: 90,
    at: 1,
    private: false,
    surface: 'solid',
    targetId: target.id,
    local: { x: 0.25, y: 0.1, rotation: 0 },
  };
  assert.deepEqual(siegeImpactPosition(impact, s), { point: { x: 80, y: 125 }, rotation: 90 });
  target.x += 100;
  target.flipX = true;
  assert.deepEqual(siegeImpactPosition(impact, s), { point: { x: 180, y: 75 }, rotation: 270 });
  s.tokens = [];
  assert.deepEqual(siegeImpactPosition(impact, s), { point: impact.point, rotation: 90 });
});
test('recarga: dois WAVs estéreo 48 kHz íntegros, sem clipping; disparo anterior intacto', async () => {
  const manifest = JSON.parse(await readFile('data/vtt/siege-audio-20261026.json', 'utf8'));
  assert.equal(
    manifest.assets.find((a: any) => a.id === 'cannon-shot').sha256,
    '2e68eb6580d73cacaf370b1d343ab2c675dfd633268d73fc4b3e32487c8d4979',
  );
  for (const id of ['cannon-load', 'harpoon-load']) {
    const a = manifest.assets.find((a: any) => a.id === id),
      bytes = await readFile('public' + a.path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), a.sha256);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.readUInt16LE(22), 2);
    assert.equal(bytes.readUInt32LE(24), 48000);
    assert.equal(bytes.readUInt16LE(34), 16);
    assert(a.duration > 2 && a.duration < 3);
    let peak = 0,
      squares = 0;
    for (let i = 44; i < bytes.length; i += 2) {
      const n = bytes.readInt16LE(i) / 32768;
      peak = Math.max(peak, Math.abs(n));
      squares += n * n;
    }
    assert(peak < 0.8 && peak > 0.5);
    assert(10 * Math.log10(squares / ((bytes.length - 44) / 2)) > -35);
  }
});
test('cerco: sons de carga e impactos persistem com água/terra, vínculo, sigilo, remoção do mestre e repetição segura', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[a-f0-9]{32}$/);
  await migrate();
  const { createApp } = await import('../server/app');
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`,
    origin = (process.env.APP_ORIGIN || 'http://localhost:3000').split(',')[0];
  type User = { id: string; cookie: string };
  async function req(path: string, user?: User, method = 'GET', data?: unknown) {
    const r = await fetch(base + path, {
      method,
      headers: {
        Origin: origin,
        Cookie: user?.cookie || '',
        'Content-Type': 'application/json',
        'X-Vtt-Schema-Version': String(vttProtocolVersion),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: r.status, data: await r.json(), headers: r.headers };
  }
  async function signup(name: string) {
    const r = await req('/auth/sign-up/email', undefined, 'POST', {
      name,
      email: randomUUID() + '@example.test',
      password: 'Test-' + randomUUID(),
    });
    assert.equal(r.status, 200);
    return {
      id: r.data.user.id,
      cookie: r.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; '),
    };
  }
  try {
    const gm = await signup('Mestre das marcas'),
      player = await signup('Operador'),
      spectator = await signup('Espectador');
    let room: VttState = (await req('/vtt', gm, 'POST', { name: 'Marcas permanentes' })).data;
    const path = '/vtt/rooms/' + room.id,
      sid = room.document.activeScene;
    for (const [u, role] of [
      [player, 'player'],
      [spectator, 'spectator'],
    ] as const)
      assert.equal((await req('/vtt/join', u, 'POST', { invite: room.invite, role })).status, 200);
    room = (await req(path, gm)).data;
    const s = room.document.scenes[0];
    s.width = 4000;
    s.height = 2000;
    s.fog = s.lighting = false;
    s.ocean = { enabled: true, animated: false, speed: 1, seaVolume: 0, windVolume: 0 };
    const hero = newToken(randomUUID(), s),
      crew = newToken(randomUUID(), s),
      boat = newToken(randomUUID(), s);
    Object.assign(hero, { x: 600, y: 700, controller: player.id, hp: 100, maxHp: 100 });
    Object.assign(crew, { x: 600, y: 800, controller: gm.id, hp: 100, maxHp: 100 });
    Object.assign(boat, {
      x: 1800,
      y: 700,
      width: 200,
      height: 300,
      layer: 'map',
      sceneryToken: true,
      image: vehicleImage('rowboat'),
    });
    s.tokens.push(hero, crew, boat);
    assert.equal(
      (await req(path, gm, 'PUT', { revision: room.revision, document: room.document })).status,
      200,
    );
    const snapshot = async (user = gm) => (await req(path + '/siege', user)).data as SiegeSnapshot;
    async function command(data: object, user = gm, operationId = randomUUID()) {
      return req(path + '/siege', user, 'POST', { ...data, sceneId: sid, operationId });
    }
    const made = await command({
      kind: 'create',
      weaponKind: 'cannon',
      position: { x: 700, y: 700 },
    });
    assert.equal(made.status, 200);
    const cannon = made.data.weapons[0].id;
    const weapon = async (id: string) => (await snapshot()).weapons.find((w) => w.id === id)!;
    async function operate(
      id: string,
      kind: 'load' | 'aim' | 'fire',
      extra: object = {},
      user = player,
      actorId = hero.id,
    ) {
      const w = await weapon(id);
      return command({ kind, weaponId: id, revision: w.revision, actorId, ...extra }, user);
    }
    const w = await weapon(cannon),
      op = randomUUID(),
      load = { kind: 'load', weaponId: cannon, revision: w.revision, actorId: hero.id };
    const loaded = await command(load, player, op);
    assert.equal(loaded.status, 200);
    const event = loaded.data.weapons[0].lastLoad;
    assert(event?.id);
    assert.equal(event.private, false);
    assert.equal(event.muted, false);
    assert.equal((await command(load, player, op)).data.weapons[0].lastLoad.id, event.id);
    assert.equal((await weapon(cannon)).ammo, w.ammo - 1);
    assert.equal((await snapshot(spectator)).weapons[0].lastLoad?.id, event.id);
    assert.equal(
      (await operate(cannon, 'aim', { point: { x: 1500, y: 500 }, mode: 'normal' })).status,
      200,
    );
    assert.equal((await operate(cannon, 'fire')).status, 200);
    assert.equal((await snapshot()).impacts!.length, 0, 'Bala na água afunda e não deixa marca');
    room = (await req(path, gm)).data;
    room.document.scenes[0].terrain.push(
      terrainStrokeSchema.parse({
        id: randomUUID(),
        texture: 'sand',
        points: [{ x: 1500, y: 500 }],
        radius: 150,
        softness: 0,
        opacity: 1,
        textureScale: 100,
      }),
    );
    assert.equal(
      (await req(path, gm, 'PUT', { revision: room.revision, document: room.document })).status,
      200,
    );
    await operate(cannon, 'load');
    await operate(cannon, 'aim', { point: { x: 1500, y: 500 }, mode: 'normal' });
    assert.equal((await operate(cannon, 'fire')).status, 200);
    const ball = (await snapshot()).impacts![0];
    assert.equal(ball.kind, 'cannon');
    assert.equal(ball.surface, 'ground');
    assert.equal((await snapshot(player)).impacts![0].id, ball.id);
    assert.equal((await snapshot(spectator)).impacts![0].id, ball.id);
    const remove = { kind: 'removeImpact', impactId: ball.id };
    assert.equal((await command(remove, player)).status, 403);
    const beforeRemoval = await weapon(cannon),
      removeId = randomUUID();
    assert.equal((await command(remove, gm, removeId)).status, 200);
    assert.equal((await command(remove, gm, removeId)).status, 200);
    assert.equal((await command({ ...remove, impactId: randomUUID() }, gm, removeId)).status, 409);
    assert.equal((await snapshot()).impacts!.length, 0);
    assert.equal((await weapon(cannon)).ammo, beforeRemoval.ammo);
    const harpoonMade = await command({
      kind: 'create',
      weaponKind: 'harpoon',
      position: { x: 700, y: 700 },
    });
    assert.equal(harpoonMade.status, 200);
    const harpoon = harpoonMade.data.weapons.find((w: any) => w.kind === 'harpoon').id;
    await operate(harpoon, 'load');
    await operate(harpoon, 'aim', { point: { x: 1500, y: 200 }, mode: 'normal' });
    await operate(harpoon, 'fire');
    assert.equal((await snapshot()).impacts!.length, 0, 'Arpão na água não fica flutuando');
    await operate(harpoon, 'load');
    await operate(harpoon, 'aim', { point: { x: 1810, y: 720 }, mode: 'normal' });
    assert.equal((await operate(harpoon, 'fire')).status, 200);
    const pinned = (await snapshot()).impacts![0];
    assert.equal(pinned.kind, 'harpoon');
    assert.equal(pinned.surface, 'solid');
    assert.equal(pinned.targetId, boat.id);
    assert(pinned.local);
    assert(pinned.ropeOrigin);
    assert((await snapshot(player)).impacts![0].ropeOrigin);
    assert.equal((await snapshot()).impacts![0].id, pinned.id, 'Nova leitura mantém a marca');
    room = (await req(path, gm)).data;
    const source = room.document.scenes[0].tokens.find(t=>t.id===harpoon)!;
    source.x += 80;
    assert.equal((await req(path,gm,'PUT',{revision:room.revision,document:room.document})).status,200);
    const movedSource=(await snapshot()).impacts![0].ropeOrigin!;
    assert(Math.abs(movedSource.x-pinned.ropeOrigin.x-80)<.001,'Corda acompanha o lançador');
    room = (await req(path, gm)).data;
    room.document.scenes[0].tokens.find(t=>t.id===harpoon)!.hidden=true;
    assert.equal((await req(path,gm,'PUT',{revision:room.revision,document:room.document})).status,200);
    assert.equal((await snapshot(player)).impacts![0].ropeOrigin,null,'Não expor origem da arma oculta');
    assert((await snapshot()).impacts![0].ropeOrigin,'Mestre conserva origem');
    room=(await req(path,gm)).data;
    room.document.scenes[0].tokens.find(t=>t.id===harpoon)!.hidden=false;
    const target = room.document.scenes[0].tokens.find((t) => t.id === boat.id)!;
    target.x += 100;
    target.rotation = 90;
    assert.equal(
      (await req(path, gm, 'PUT', { revision: room.revision, document: room.document })).status,
      200,
    );
    const moved = siegeImpactPosition(
      (await snapshot()).impacts![0],
      (await req(path, gm)).data.document.scenes[0],
    );
    assert(Math.abs(moved.point.x - 1880) < 0.001);
    assert(Math.abs(moved.point.y - 710) < 0.001);
    room = (await req(path, gm)).data;
    room.document.scenes[0].tokens.find((t) => t.id === boat.id)!.hidden = true;
    assert.equal(
      (await req(path, gm, 'PUT', { revision: room.revision, document: room.document })).status,
      200,
    );
    assert.equal(
      (await snapshot(player)).impacts!.length,
      0,
      'Alvo oculto não revela a marca ou sua posição',
    );
    assert.equal((await snapshot()).impacts!.length, 1);
    const last = await weapon(cannon);
    await command({
      kind: 'settings',
      weaponId: cannon,
      revision: last.revision,
      ammunition: last.ammo,
      muted: true,
    });
    await operate(cannon, 'load');
    assert.equal((await weapon(cannon)).lastLoad!.muted, true);
    assert.equal(
      (
        await operate(cannon, 'aim', {
          point: { x: 1500, y: 500 },
          mode: 'normal',
          surface: 'water',
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await operate(
          cannon,
          'aim',
          { point: { x: 1500, y: 500 }, mode: 'normal', surface: 'water' },
          gm,
          crew.id,
        )
      ).status,
      200,
    );
    await operate(cannon, 'fire', {}, gm, crew.id);
    assert.equal(
      (await snapshot()).impacts!.length,
      1,
      'Mestre pode corrigir superfície de mapa importado',
    );
    room = (await req(path, gm)).data;
    room.document.scenes[0].tokens.find((t) => t.id === crew.id)!.hidden = true;
    assert.equal(
      (await req(path, gm, 'PUT', { revision: room.revision, document: room.document })).status,
      200,
    );
    await operate(cannon, 'load', {}, gm, crew.id);
    assert.equal((await weapon(cannon)).lastLoad!.private, true);
    assert.equal((await snapshot(player)).weapons.find((w) => w.id === cannon)!.lastLoad, null);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await pool.end();
  }
});
