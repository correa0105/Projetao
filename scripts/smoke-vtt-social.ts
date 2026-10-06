import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { createRequire } from 'node:module';
import { snapPoint } from '../shared/vtt.js';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsup'))('esbuild');
if (!new URL(process.env.DATABASE_URL!).pathname.startsWith('/alvorada_test_'))
  throw Error('Banco descartável obrigatório.');
const origin = 'http://localhost:3004';
process.env.APP_ORIGIN = process.env.BETTER_AUTH_URL = origin;
const { pool } = await import('../server/db.js'),
  { migrate } = await import('../server/migrate.js'),
  { seed } = await import('../server/seed.js'),
  { createLegacyTestCharacter } = await import('../tests/character-fixtures.js');
await migrate();
await seed();
const { createApp } = await import('../server/app.js'),
  server = createApp().listen(3004, '127.0.0.1');
await new Promise<void>((resolve) => server.once('listening', resolve));
const browser = await chromium.launch({ channel: 'msedge', headless: true }),
  ctx = await browser.newContext({
    extraHTTPHeaders: { 'X-Vtt-Schema-Version': '2' },
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  }),
  ctx2 = await browser.newContext({
    extraHTTPHeaders: { 'X-Vtt-Schema-Version': '2' },
    viewport: { width: 1280, height: 900 },
  }),
  page = await ctx.newPage(),
  peerPage = await ctx2.newPage(),
  errors: string[] = [];
const requestWindowStart = Date.now();
for (const p of [page, peerPage]) p.on('pageerror', (e) => errors.push(e.message));
await mkdir('test-results', { recursive: true });
try {
  async function signup(context: typeof ctx, name: string) {
    const r = await context.request.post(origin + '/api/auth/sign-up/email', {
      headers: { Origin: origin },
      data: {
        name,
        email: `social-ui-${randomUUID()}@example.test`,
        password: `Test-${randomUUID()}`,
      },
    });
    expect(r.ok()).toBe(true);
    return (await r.json()).user;
  }
  const owner = await signup(ctx, 'Administrador'),
    peer = await signup(ctx2, 'Viajante');
  await pool.query('UPDATE "user" SET administrador=1 WHERE id=$1', [owner.id]);
  const a = await createLegacyTestCharacter(owner.id, 'Arden'),
    b = await createLegacyTestCharacter(owner.id, 'Mira'),
    c = await createLegacyTestCharacter(peer.id, 'Lyra');
  await pool.query(
    "INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,'potion-of-healing',2)",
    [c.id],
  );
  const png = await sharp(await readFile('public/shop/merchant-v2.png'))
    .resize({ height: 900 })
    .png()
    .toBuffer();
  for (const ch of [a, b, c]) {
    await pool.query('INSERT INTO character_portraits(character_id,image)VALUES($1,$2)', [
      ch.id,
      png,
    ]);
    await pool.query(
      'UPDATE characters SET portrait_revision=1,biography=$2,gold_cp=100000 WHERE id=$1',
      [ch.id, 'Uma jornada pelo Norte, entre estradas e histórias.'],
    );
    await pool.query(
      'INSERT INTO achievements(character_id,code)VALUES($1,$2)ON CONFLICT DO NOTHING',
      [ch.id, 'first_purchase'],
    );
    await pool.query(
      "INSERT INTO achievement_shelves(character_id,material,medal_frame,slots,positions,rows)VALUES($1,'walnut','bronze',$2,$3,$4)ON CONFLICT(character_id)DO UPDATE SET slots=$2,positions=$3,rows=$4",
      [
        ch.id,
        JSON.stringify(['first_character', 'first_purchase']),
        JSON.stringify([25, 60]),
        JSON.stringify([0, 1]),
      ],
    );
    await pool.query(
      'INSERT INTO character_mounts(character_id,mount_id,name,price_cp,idempotency_key,displayed)VALUES($1,$2,$3,1000,$4,true)',
      [
        ch.id,
        ch.id === b.id ? 'pony' : 'riding-horse',
        ch.id === b.id ? 'Faísca' : 'Bruma',
        randomUUID(),
      ],
    );
  }
  for (const [ch, pet, name] of [
    [a, 'dog', 'Brasa'],
    [b, 'frog', 'Pingo'],
    [c, 'cat', 'Nuvem'],
  ] as const) {
    const context = ch.id === c.id ? ctx2 : ctx;
    expect(
      (
        await context.request.post(origin + '/api/pets/purchase', {
          headers: { Origin: origin },
          data: {
            character_id: ch.id,
            pet_id: pet,
            name,
            appearance: 'original',
            idempotency_key: randomUUID(),
          },
        })
      ).status(),
    ).toBe(201);
  }
  await pool.query(
    "INSERT INTO character_cards(character_id,card_id,slot,price_cp,idempotency_key)VALUES($1,'vigil',1,5000,$2)",
    [a.id, randomUUID()],
  );
  await page.goto(origin + '/#hall');
  await expect(page.locator('.hall-champion')).toHaveCount(3);
  await page.getByRole('button', { name: 'Editar pontuação e apresentação' }).click();
  await page.getByLabel('Título', { exact: true }).fill('Hall da Fama');
  await page.getByRole('button', { name: 'Salvar critérios' }).click();
  await expect(page.locator('.social-modal')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/hall-desktop.png', fullPage: true });
  await page
    .locator('.hall-champion')
    .filter({ has: page.getByText('Arden', { exact: true }) })
    .click();
  await expect(page).toHaveURL(new RegExp('profiles\\?user=' + owner.id));
  await expect(page.locator('.public-camp-heading')).toContainText('Arden');
  await expect(page.locator('.public-camp-pet')).toContainText('Brasa');
  await expect(page.locator('.public-camp-mount')).toContainText('Bruma');
  async function checkCompanionFraming() {
    const framing = await page.locator('.public-camp-stage').evaluate((stage) => {
      const panel = stage.closest('.public-camp')!.getBoundingClientRect();
      const pet = stage.querySelector('.public-camp-pet')!.getBoundingClientRect();
      const art = stage.querySelector('.pet-art')!;
      const svg = art.querySelector('svg')!;
      const animal = svg.getBoundingClientRect();
      const frame = svg.viewBox.baseVal;
      const mount = stage.querySelector('.public-camp-mount > img') as HTMLImageElement;
      const horse = mount.getBoundingClientRect();
      const labels = Array.from(
        stage.querySelectorAll('.public-camp-pet > span:not(.pet-art), .public-camp-mount > span'),
      );
      return {
        artPosition: getComputedStyle(art).position,
        petInside: animal.top >= pet.top - 1 && animal.bottom <= pet.bottom + 1,
        allInside: [animal, horse, ...labels.map((label) => label.getBoundingClientRect())].every(
          (r) => r.left >= panel.left && r.right <= panel.right && r.bottom <= panel.bottom,
        ),
        petRatio: animal.width / animal.height,
        frameRatio: frame.width / frame.height,
        mountRatio: horse.width / horse.height,
        sourceRatio: mount.naturalWidth / mount.naturalHeight,
      };
    });
    expect(framing.artPosition).toBe('static');
    expect(framing.petInside).toBe(true);
    expect(framing.allInside).toBe(true);
    expect(framing.petRatio).toBeCloseTo(framing.frameRatio, 2);
    expect(framing.mountRatio).toBeCloseTo(framing.sourceRatio, 2);
  }
  await page.setViewportSize({ width: 1880, height: 812 });
  await checkCompanionFraming();
  await page.screenshot({ path: 'test-results/profile-animals-1880.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await checkCompanionFraming();
  await page.screenshot({ path: 'test-results/profile-animals-1440.png', fullPage: true });
  await page.getByRole('button', { name: 'Selecionar Mira no perfil' }).click();
  await expect(page.locator('.public-camp-pet')).toContainText('Pingo');
  await expect(page.locator('.public-camp-mount')).toContainText('Faísca');
  await checkCompanionFraming();
  await page.screenshot({ path: 'test-results/profile-camp-desktop.png', fullPage: true });
  await page
    .locator('.profile-visit-nav')
    .getByRole('button', { name: 'Conquistas', exact: true })
    .click();
  await expect(page.locator('.public-achievements')).toHaveAttribute('aria-hidden', 'false');
  await page.getByRole('button', { name: 'Ver conquistas de Arden' }).click();
  await expect(page.locator('.public-achievements h2')).toHaveText('Conquistas de Arden');
  await expect(page.locator('.antique-portrait')).toHaveCount(4);
  await expect(page.locator('.public-achievements .cabinet-slot')).toHaveCount(2);
  await page.getByRole('button', { name: 'Ver conquistas de Arden' }).hover();
  await expect
    .poll(() =>
      page
        .locator('.profile-panels-strip')
        .evaluate((el) => el.getAnimations().every((a) => a.playState !== 'running')),
    )
    .toBe(true);
  await page.screenshot({ path: 'test-results/profile-achievements-desktop.png', fullPage: true });
  await page
    .locator('.profile-visit-nav')
    .getByRole('button', { name: 'Ficha', exact: true })
    .click();
  await expect(page.locator('.public-sheet')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('.public-sheet')).toContainText('História');
  await page
    .locator('.profile-visit-nav')
    .getByRole('button', { name: 'Cartas', exact: true })
    .click();
  await expect(page.locator('.public-cards .character-card-slot')).toHaveCount(3);
  await expect(page.locator('.public-cards .character-card-slot .arcana-card-face')).toHaveCount(1);
  await expect(page.locator('.public-cards .character-card-choice')).toHaveCount(1);
  await expect(
    page.locator('.public-cards').getByRole('button', { name: /Equipar no espaço/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Personalizar perfil' }).click();
  await expect(page.getByText('Enviar cenário próprio', { exact: true })).toHaveCount(0);
  await expect(page.locator('.social-modal input[type=file]')).toHaveCount(1);
  await page.getByLabel('Frase de apresentação').fill('Pelas estradas da Alvorada.');
  await page.getByLabel('Sobre você', { exact: true }).fill('Um lugar para novas histórias.');
  await page.getByRole('button', { name: 'Salvar meu perfil' }).click();
  await expect(page.locator('.visited-profile-heading')).toContainText(
    'Pelas estradas da Alvorada.',
  );
  await expect(page.locator('.public-camp-summary')).toHaveCount(0);
  await page.goto(origin + '/#character-cards');
  await expect(page.locator('.character-card-slot')).toHaveCount(3);
  await expect(page.locator('.character-card-choice')).toHaveCount(1);
  await page.getByRole('button', { name: 'Equipar no espaço 2', exact: true }).click();
  await expect(page.locator('.character-card-slot[data-slot="2"] .arcana-card-face')).toHaveCount(
    1,
  );
  await page.reload();
  await expect(page.locator('.character-card-slot[data-slot="2"] .arcana-card-face')).toHaveCount(
    1,
  );
  await page.getByRole('button', { name: /Retirar.*2/ }).click();
  await expect(page.locator('.character-card-slot[data-empty="true"]')).toHaveCount(3);
  await expect(page.locator('.character-card-choice')).toHaveCount(1);
  await page.goto(origin + '/#profiles');
  await expect(page.locator('.profile-directory article')).toHaveCount(2);
  await page.getByLabel('Localizador de perfil').fill(peer.id);
  await expect(page.locator('.profile-directory article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Visitar perfil', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar amigo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancelar pedido', exact: true })).toBeVisible();
  await peerPage.goto(origin + '/#profiles?user=' + owner.id);
  await expect(peerPage.getByRole('button', { name: 'Personalizar perfil' })).toHaveCount(0);
  await peerPage.getByRole('button', { name: 'Aceitar amizade', exact: true }).click();
  await peerPage.getByRole('button', { name: 'Conversar', exact: true }).click();
  await expect(peerPage.getByLabel('Mensagem privada', { exact: true })).toBeVisible();
  await peerPage
    .getByLabel('Mensagem privada', { exact: true })
    .fill('Nos vemos na próxima aventura!');
  await peerPage.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(peerPage.locator('.direct-chat-history')).toContainText('Nos vemos');
  await page.reload();
  await page.getByRole('button', { name: 'Conversar', exact: true }).click();
  await expect(page.locator('.direct-chat-history')).toContainText('Nos vemos');
  await page.getByLabel('Mensagem privada', { exact: true }).fill('Combinado.');
  await page.getByRole('button', { name: 'Enviar', exact: true }).click();
  await expect(peerPage.locator('.direct-chat-history')).toContainText('Combinado.', {
    timeout: 8000,
  });
  await page.screenshot({ path: 'test-results/profile-chat-desktop.png', fullPage: true });
  await page.goto(origin + '/#achievements');
  await expect(page.locator('.antique-portrait')).toHaveCount(4);
  await page.getByRole('button', { name: 'Ver conquistas de Mira' }).click();
  await expect(page.locator('.antique-portrait.selected')).toHaveAttribute(
    'aria-label',
    'Ver conquistas de Mira',
  );
  await page.screenshot({ path: 'test-results/own-achievements-frames.png', fullPage: true });
  await page.goto(origin + '/#vtt');
  await page.getByLabel('Nome da mesa', { exact: true }).fill('A cripta da Alvorada');
  await page.getByRole('button', { name: 'Criar mesa', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Mesa virtual', exact: true })).toBeVisible();
  const panel = page.locator('.vtt-panel-content');
  await page.getByRole('button', { name: 'Biblioteca de mapas', exact: true }).first().click();
  const maps = page.getByRole('dialog', { name: 'Biblioteca de mapas', exact: true });
  const searchBox = await maps.getByLabel('Buscar mapas').boundingBox();
  const searchIcon = await maps.locator('.vtt-map-search label svg').boundingBox();
  expect(searchBox!.height).toBeLessThanOrEqual(42);
  expect(
    Math.abs(searchIcon!.y + searchIcon!.height / 2 - searchBox!.y - searchBox!.height / 2),
  ).toBeLessThan(2);
  await maps.getByRole('button', { name: 'Nova pasta', exact: true }).click();
  await maps.getByLabel('Nome da pasta', { exact: true }).fill('Campanha do Norte');
  await maps.getByRole('button', { name: 'Salvar pasta', exact: true }).click();
  await maps.getByRole('button', { name: 'Nova pasta', exact: true }).click();
  await maps.getByLabel('Nome da pasta', { exact: true }).fill('Porões');
  await maps.getByRole('button', { name: 'Salvar pasta', exact: true }).click();
  await page.screenshot({ path: 'test-results/vtt-map-folders.png' });
  await maps.getByRole('button', { name: 'Novo mapa', exact: true }).click();
  const mapSettings = page.getByRole('dialog', { name: /Configurações/ });
  await mapSettings.getByLabel('Nome do mapa', { exact: true }).fill('Porão escuro');
  await mapSettings.getByRole('button', { name: 'Salvar configurações', exact: true }).click();
  await expect(mapSettings).not.toBeVisible();
  await page.getByRole('button', { name: 'Biblioteca de mapas', exact: true }).first().click();
  await maps.getByRole('button', { name: 'Abrir mapa Primeiro mapa', exact: true }).click();
  await page.getByRole('button', { name: 'Fichas', exact: true }).click();
  await panel.getByRole('button').filter({ hasText: 'Arden' }).click();
  await expect(page.getByRole('dialog', { name: 'Ficha · Arden', exact: true })).toBeVisible();
  const sheetHealth = page.getByRole('dialog', { name: 'Ficha · Arden', exact: true });
  const initialHp = Number(
    (await sheetHealth.locator('.vtt-sheet-health strong').innerText()).split('/')[0].trim(),
  );
  await sheetHealth.getByLabel('Registrar dano', { exact: true }).fill('3');
  await sheetHealth.getByRole('button', { name: 'Aplicar dano', exact: true }).click();
  await expect(sheetHealth.locator('.vtt-sheet-health strong')).toHaveText(
    new RegExp('^' + (initialHp - 3) + '\\s*/'),
  );
  await sheetHealth.getByLabel('Registrar cura', { exact: true }).fill('2');
  await sheetHealth.getByRole('button', { name: 'Aplicar cura', exact: true }).click();
  await expect(sheetHealth.locator('.vtt-sheet-health strong')).toHaveText(
    new RegExp('^' + (initialHp - 1) + '\\s*/'),
  );
  await sheetHealth.getByRole('button', { name: 'Restaurar PV', exact: true }).click();
  await expect(sheetHealth.locator('.vtt-sheet-health strong')).toHaveText(
    new RegExp('^' + initialHp + '\\s*/'),
  );
  await page.screenshot({ path: 'test-results/vtt-full-sheet.png' });
  await page.getByRole('button', { name: 'Fechar ficha', exact: true }).click();
  await expect(panel).toContainText('Arden');
  await page.getByRole('button', { name: 'Token selecionado', exact: true }).click();
  await expect(panel.getByLabel('Nome', { exact: true })).toHaveValue('Arden');
  await panel.getByLabel('Nome', { exact: true }).fill('Arden · aventureiro');
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect(page.locator('.vtt-saved')).toContainText('Salvo');
  const boardBefore = (await page.locator('canvas[aria-label="Tabuleiro da mesa"]').boundingBox())!;
  await page.mouse.click(
    boardBefore.x + boardBefore.width / 2,
    boardBefore.y + boardBefore.height / 2,
    { button: 'right' },
  );
  const actions = page.locator('.vtt-context-menu');
  await expect(actions).toBeVisible();
  await actions.getByLabel('Nível de profundidade', { exact: true }).fill('-0.1');
  await actions.getByLabel('Nível de profundidade', { exact: true }).blur();
  await actions.getByRole('button', { name: 'Horizontal', exact: true }).click();
  await actions.getByLabel('Camada no menu', { exact: true }).selectOption('gm');
  await page.getByRole('button', { name: 'Fechar ações', exact: true }).click();
  await page.mouse.click(
    boardBefore.x + boardBefore.width / 2,
    boardBefore.y + boardBefore.height / 2,
    { button: 'right' },
  );
  await expect(actions.getByLabel('Nível de profundidade', { exact: true })).toHaveValue('-0.1');
  await actions.getByLabel('Camada no menu', { exact: true }).selectOption('tokens');
  await page.getByRole('button', { name: 'Fechar ações', exact: true }).click();
  await page.getByRole('button', { name: 'Régua (R)', exact: true }).click();
  const rulerBoard = page.locator('canvas[aria-label="Tabuleiro da mesa"]');
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  const beforeRuler = await rulerBoard.evaluate((el) => (el as HTMLCanvasElement).toDataURL());
  await page.mouse.move(boardBefore.x + 80, boardBefore.y + 180);
  await page.mouse.down();
  await page.mouse.move(boardBefore.x + 170, boardBefore.y + 230);
  await expect
    .poll(() => rulerBoard.evaluate((el) => (el as HTMLCanvasElement).toDataURL()))
    .not.toBe(beforeRuler);
  await page.mouse.up();
  await expect
    .poll(() => rulerBoard.evaluate((el) => (el as HTMLCanvasElement).toDataURL()))
    .toBe(beforeRuler);
  await page.getByRole('button', { name: 'Configurações e ajuda', exact: true }).click();
  await panel.getByRole('button', { name: 'Mapa', exact: true }).click();
  await panel.getByRole('button', { name: 'Configurar mapa', exact: true }).click();
  const settings = page.getByRole('dialog', { name: /Configurações/ });
  await settings.getByLabel('Tipo de grade').selectOption('hex-point');
  await settings.getByLabel('Tamanho da célula', { exact: true }).fill('80');
  await settings.getByRole('button', { name: 'Salvar configurações', exact: true }).click();
  await expect(settings).not.toBeVisible();
  await page.getByRole('button', { name: 'Barreira de luz', exact: true }).click();
  const bounds = await page.locator('canvas[aria-label="Tabuleiro da mesa"]').boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.4, bounds!.y + bounds!.height * 0.35);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.6, bounds!.y + bounds!.height * 0.55);
  await page.mouse.up();
  await expect(panel).toContainText('Parede 1');
  await page.getByRole('button', { name: 'Biblioteca', exact: true }).click();
  await panel.getByRole('button', { name: 'Monstros', exact: true }).click();
  await panel.getByLabel('Buscar na biblioteca', { exact: true }).fill('Aboleth');
  await panel.locator('.vtt-compendium button').first().click();
  await expect(panel.locator('.vtt-monster-section h3')).toHaveText([
    'Características',
    'Ações',
    'Ações lendárias',
  ]);
  await expect(panel.locator('.vtt-monster-sheet')).not.toContainText('XPHB');
  await page.screenshot({ path: 'test-results/vtt-monster-aboleth-library.png' });
  await panel.getByRole('button', { name: 'Voltar à lista', exact: true }).click();
  await panel.getByLabel('Buscar na biblioteca', { exact: true }).fill('Goblin');
  await expect(panel.locator('.vtt-compendium button').first()).toBeVisible();
  const dropped = page.locator('canvas[aria-label="Tabuleiro da mesa"]');
  const dropBounds = (await dropped.boundingBox())!;
  await dropped.hover({ position: { x: dropBounds.width / 2, y: dropBounds.height / 2 } });
  const previousZoom = Number(await dropped.getAttribute('data-camera-zoom'));
  await page.mouse.wheel(0, -150);
  await expect
    .poll(async () => Number(await dropped.getAttribute('data-camera-zoom')))
    .toBeGreaterThan(previousZoom);
  const beforeDrop = {
    x: Number(await dropped.getAttribute('data-camera-x')),
    y: Number(await dropped.getAttribute('data-camera-y')),
    zoom: Number(await dropped.getAttribute('data-camera-zoom')),
  };
  await panel
    .locator('.vtt-compendium button')
    .first()
    .dragTo(dropped, { targetPosition: { x: dropBounds.width * 0.3, y: dropBounds.height * 0.3 } });
  await expect(panel.locator('.vtt-compendium')).toBeVisible();
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  await expect
    .poll(async () => {
      const id = (await (await ctx.request.get(origin + '/api/vtt')).json()).rooms[0].id;
      const r = await (await ctx.request.get(origin + '/api/vtt/rooms/' + id)).json();
      return r.document.scenes
        .flatMap((s: any) => s.tokens)
        .find((t: any) => t.name === 'Goblin Boss')?.image;
    })
    .toBe('/vtt/monsters/monster-goblin-boss.webp');
  {
    const id = (await (await ctx.request.get(origin + '/api/vtt')).json()).rooms[0].id;
    const state = await (await ctx.request.get(origin + '/api/vtt/rooms/' + id)).json();
    const scene = state.document.scenes.find((s: any) => s.id === state.document.activeScene);
    const goblins = scene.tokens.filter((t: any) => t.name === 'Goblin Boss');
    expect(goblins).toHaveLength(1);
    const expected = snapPoint(
      {
        x: beforeDrop.x - (dropBounds.width * 0.2) / beforeDrop.zoom,
        y: beforeDrop.y - (dropBounds.height * 0.2) / beforeDrop.zoom,
      },
      scene.grid,
    );
    expect(goblins[0].x).toBeCloseTo(expected.x, 0);
    expect(goblins[0].y).toBeCloseTo(expected.y, 0);
  }
  await page.getByRole('button', { name: 'Fichas', exact: true }).click();
  await panel.getByRole('button', { name: 'Abrir folha completa', exact: true }).click();
  const monsterSheet = page.getByRole('dialog', { name: 'Ficha · Goblin Boss', exact: true });
  await expect(monsterSheet).toBeVisible();
  await expect(monsterSheet.locator('.vtt-monster-abilities button')).toHaveCount(6);
  await expect(monsterSheet.locator('.vtt-monster-section h3')).toContainText(['Ações']);
  const monsterPin = monsterSheet.getByRole('button', { name: /^Fixar / }).first();
  await monsterPin.dragTo(page.locator('.vtt-hotbar-slot').first());
  await expect(page.locator('.vtt-hotbar-slot').first()).not.toHaveAccessibleName(/vazio/);
  await page.screenshot({ path: 'test-results/vtt-monster-sheet-desktop.png' });
  await monsterSheet
    .getByRole('button', { name: /^Usar / })
    .first()
    .click();
  await expect(monsterSheet).not.toBeVisible();
  await expect(page.locator('.vtt-attack-inline')).toBeVisible();
  await page.getByRole('button', { name: 'Fechar atalho', exact: true }).click();
  expect((await ctx.request.get(origin + '/vtt/monsters/monster-goblin-boss.webp')).status()).toBe(
    200,
  );
  await page.getByRole('button', { name: 'Biblioteca de arte', exact: true }).click();
  await panel
    .locator('.vtt-asset')
    .filter({ hasText: 'Arden' })
    .getByRole('button', { name: 'Token', exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Fichas', exact: true }).click();
  expect(
    await page
      .locator('.vtt-panel-tabs button')
      .evaluateAll((buttons) => buttons.map((b) => b.getAttribute('aria-label'))),
  ).toEqual([
    'Chat',
    'Biblioteca de arte',
    'Fichas',
    'Biblioteca',
    'Som',
    'Diário',
    'Configurações e ajuda',
  ]);
  expect(
    (await page.getByRole('button', { name: 'Camadas', exact: true }).boundingBox())!.x,
  ).toBeLessThan(80);
  const monsterShortcut = panel
    .locator('.vtt-monster-action')
    .first()
    .getByRole('button', { name: /^Fixar / });
  await expect(monsterShortcut).toBeVisible();
  await monsterShortcut.dragTo(page.locator('.vtt-hotbar-slot').first());
  await expect(page.locator('.vtt-hotbar-slot').first()).not.toHaveAccessibleName(/vazio/);
  {
    await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
    const roomId = (await (await ctx.request.get(origin + '/api/vtt')).json()).rooms[0].id;
    const roomState = await (await ctx.request.get(origin + '/api/vtt/rooms/' + roomId)).json();
    const s = roomState.document.scenes.find((s: any) => s.id === roomState.document.activeScene),
      attacker = s.tokens.find((t: any) => t.name.includes('Goblin')),
      target = s.tokens.find((t: any) => t.characterId === a.id);
    Object.assign(attacker, { x: 875 + 200, y: 875 });
    Object.assign(target, { x: 875 - 200, y: 875, ac: 0 });
    Object.assign(s, { fog: false, lighting: false });
    expect(
      (
        await ctx.request.put(origin + '/api/vtt/rooms/' + roomId, {
          headers: { Origin: origin },
          data: { revision: roomState.revision, document: roomState.document },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    const board = page.locator('canvas[aria-label="Tabuleiro da mesa"]');
    await expect(board).toBeVisible();
    await page.locator('.vtt-hotbar-slot').first().click();
    const strip = page.locator('.vtt-attack-inline');
    await expect(strip).toBeVisible();
    await expect(page.locator('.vtt-attack-layer')).toHaveCount(0);
    const box = (await board.boundingBox())!,
      z = Number(await board.getAttribute('data-camera-zoom')),
      cx = Number(await board.getAttribute('data-camera-x')),
      cy = Number(await board.getAttribute('data-camera-y'));
    await page.mouse.click(
      box.x + box.width / 2 + (target.x - cx) * z,
      box.y + box.height / 2 + (target.y - cy) * z,
    );
    await expect(board).toHaveAttribute('data-attacker-id', attacker.id);
    await expect(board).toHaveAttribute('data-target-id', target.id);
    await strip.getByLabel('Vantagem do ataque').selectOption('advantage');
    for (let retry = 0; retry < 8; retry++) {
      await strip.getByRole('button', { name: /^Rolar (novo )?ataque$/ }).click();
      await expect(strip.locator('.vtt-attack-result')).toBeVisible();
      if (await strip.locator('.hit').count()) break;
    }
    await expect(strip.locator('.hit')).toBeVisible();
    const attackRoll = (
      await (await ctx.request.get(origin + '/api/vtt/rooms/' + roomId)).json()
    ).messages
      .filter((m: any) => m.roll && m.text.includes('ataque'))
      .at(-1);
    expect(attackRoll.roll.formula).toMatch(/^2d20kh1/);
    await strip.getByRole('button', { name: 'Descartar dano', exact: true }).click();
    await expect(strip).toContainText('Dano descartado');
    await expect(strip.getByRole('button', { name: 'Rolar dano', exact: true })).toHaveCount(0);
    for (let retry = 0; retry < 8; retry++) {
      await strip.getByRole('button', { name: 'Rolar novo ataque', exact: true }).click();
      await expect(strip.locator('.vtt-attack-result')).toBeVisible();
      if (await strip.locator('.hit').count()) break;
    }
    await strip.getByRole('button', { name: 'Rolar dano', exact: true }).click();
    await expect(strip).toContainText('Dano rolado:');
    await page.screenshot({ path: 'test-results/vtt-attack-inline.png' });
    await page.getByRole('button', { name: 'Fechar atalho', exact: true }).click();
    await page.getByRole('button', { name: 'Fichas', exact: true }).click();
    await page.getByRole('button', { name: 'Token selecionado', exact: true }).click();
    await page.mouse.click(
      box.x + box.width / 2 + (attacker.x - cx) * z,
      box.y + box.height / 2 + (attacker.y - cy) * z,
      { button: 'right' },
    );
    const health = page.locator('.vtt-context-menu');
    await health.getByLabel('Editar PV do token').fill('-3');
    await health.getByRole('button', { name: 'Aplicar PV', exact: true }).click();
    await expect(health.locator('.vtt-hp-orb strong')).toHaveText(String(attacker.hp - 3));
    await health.getByLabel('Editar PV do token').fill('+2');
    await health.getByRole('button', { name: 'Aplicar PV', exact: true }).click();
    await expect(health.locator('.vtt-hp-orb strong')).toHaveText(String(attacker.hp - 1));
    await page.getByRole('button', { name: 'Fechar ações', exact: true }).click();
    await page.getByRole('button', { name: 'Texto', exact: true }).click();
    await page.mouse.click(box.x + box.width * 0.6, box.y + box.height * 0.3);
    await page.getByLabel('Texto no mapa', { exact: true }).fill('Entrada secreta');
    await page.getByLabel('Texto no mapa', { exact: true }).press('Enter');
    await expect(page.getByLabel('Texto no mapa', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
    await expect
      .poll(async () => {
        const withText = await (await ctx.request.get(origin + '/api/vtt/rooms/' + roomId)).json();
        return withText.document.scenes
          .find((s: any) => s.id === withText.document.activeScene)
          .drawings.some((d: any) => d.text === 'Entrada secreta');
      })
      .toBe(true);
    await page.getByRole('button', { name: 'Selecionar (V)', exact: true }).click();
    await page.locator('.vtt-hotbar-slot').first().click();
    await page.getByRole('button', { name: 'Rolar dano separado', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Fechar atalho', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Fechar atalho', exact: true }).click();
  }
  const effectsButton = page.getByRole('button', { name: 'Efeitos do mestre', exact: true });
  const effectsBounds = await effectsButton.boundingBox(),
    stageBounds = await page.locator('.vtt-stage').boundingBox();
  expect(
    stageBounds!.y + stageBounds!.height - effectsBounds!.y - effectsBounds!.height,
  ).toBeLessThan(25);
  await effectsButton.click();
  const effects = page.getByRole('region', { name: 'Efeitos salvos do mestre', exact: true });
  await effects.getByRole('button', { name: 'Novo efeito', exact: true }).click();
  await expect(effects.getByRole('form', { name: 'Editor de efeito' })).toBeVisible();
  await expect(effects.getByLabel('Nome do efeito', { exact: true })).toBeFocused();
  await effects.getByLabel('Modelo do efeito', { exact: true }).selectOption('death');
  await effects.getByLabel('Nome do efeito', { exact: true }).fill('Sangue do mestre');
  await effects.getByRole('button', { name: 'Salvar efeito', exact: true }).click();
  await expect(effects.locator('.vtt-effects-row')).toHaveCount(1);
  await expect(effects.locator('.vtt-effects-row').first()).toHaveAttribute('draggable', 'true');
  await effects.locator('.vtt-effects-row').first().dragTo(page.locator('.vtt-hotbar-slot').nth(1));
  await expect(page.locator('.vtt-hotbar-slot').nth(1)).toContainText('Sangue do mestre');
  await effects.getByRole('button', { name: 'Novo efeito', exact: true }).click();
  await effects.getByLabel('Modelo do efeito', { exact: true }).selectOption('fire');
  await effects.getByLabel('Nome do efeito', { exact: true }).fill('Brasa do mestre');
  await effects.getByLabel('Efeito infinito', { exact: true }).check();
  const beforePreview = (await (await ctx.request.get(origin + '/api/vtt')).json()).rooms[0].id;
  const beforeDoc = (
    await (await ctx.request.get(origin + '/api/vtt/rooms/' + beforePreview)).json()
  ).document;
  await effects.getByRole('button', { name: 'Visualizar no token', exact: true }).click();
  await expect(page.locator('.vtt-map-footer')).toContainText('Prévia do efeito');
  expect(
    (await (await ctx.request.get(origin + '/api/vtt/rooms/' + beforePreview)).json()).document,
  ).toEqual(beforeDoc);
  await page.screenshot({ path: 'test-results/vtt-effect-preview.png' });
  await effects.getByRole('button', { name: 'Salvar efeito', exact: true }).click();
  await expect(effects.locator('.vtt-effects-row')).toHaveCount(2);
  await effects.locator('.vtt-effects-apply').filter({ hasText: 'Brasa do mestre' }).click();
  await expect(effects.locator('.vtt-effects-target')).toContainText('Goblin');
  await page.screenshot({ path: 'test-results/vtt-effects-menu.png' });
  await effects.getByRole('button', { name: 'Limpar efeitos do token', exact: true }).click();
  await page.locator('.vtt-hotbar-slot').nth(1).click();
  await expect(effects).toHaveCount(0);
  await page.getByRole('button', { name: 'Aplicar no token selecionado', exact: true }).click();
  await expect(page.locator('.vtt-hotbar-action')).toHaveCount(0);
  await page.getByRole('button', { name: 'Token selecionado', exact: true }).click();
  await panel.getByLabel('Estilo da barra de boss').selectOption('classic-ice');
  expect(
    await panel.getByLabel('Estilo da barra de boss').locator('option').allTextContents(),
  ).toEqual([
    'Não mostrar barra',
    'Classic · Red',
    'Classic · Ice',
    'Classic · Grass',
    'Classic · Oak',
    'Evil',
  ]);
  await effectsButton.click();
  await effects.getByLabel('Automático ao zerar PV').check();
  await effects.getByRole('button', { name: 'Fechar efeitos', exact: true }).click();
  await panel.getByLabel('PV atual', { exact: true }).fill('0');
  await expect(page.locator('.vtt-boss-track')).toHaveAttribute('aria-valuenow', '0');
  await page.waitForTimeout(1400);
  await page.screenshot({ path: 'test-results/vtt-boss-death.png' });
  await panel.getByLabel('PV atual', { exact: true }).fill('8');
  await expect(page.locator('.vtt-boss-heal')).toBeVisible();
  await effectsButton.click();
  await effects.getByRole('button', { name: 'Aplicar efeito de morte', exact: true }).click();
  await expect(
    effects.getByRole('button', { name: 'Limpar efeito de morte', exact: true }),
  ).toBeEnabled();
  await effects.getByRole('button', { name: 'Limpar efeito de morte', exact: true }).click();
  await effects.getByRole('button', { name: 'Fechar efeitos', exact: true }).click();
  await page.getByRole('button', { name: 'Formas', exact: true }).click();
  await page
    .getByRole('group', { name: 'Opções de Formas' })
    .getByRole('button', { name: 'Linha', exact: true })
    .click();
  await page.getByRole('button', { name: 'Névoa', exact: true }).click();
  await page
    .getByRole('group', { name: 'Opções de Névoa' })
    .getByRole('button', { name: 'Revelar polígono', exact: true })
    .click();
  const fogBoard = (await page.locator('canvas[aria-label="Tabuleiro da mesa"]').boundingBox())!;
  for (const [x, y] of [
    [0.3, 0.3],
    [0.5, 0.3],
    [0.5, 0.5],
    [0.3, 0.5],
  ])
    await page.mouse.click(fogBoard.x + fogBoard.width * x, fogBoard.y + fogBoard.height * y);
  await page.locator('canvas[aria-label="Tabuleiro da mesa"]').press('Enter');
  await page.getByRole('button', { name: 'Névoa', exact: true }).click();
  await page
    .getByRole('group', { name: 'Opções de Névoa' })
    .getByRole('button', { name: 'Visão automática dos tokens', exact: true })
    .click();
  await page.getByRole('button', { name: 'Escolher dados', exact: true }).click();
  await expect(page.locator('.vtt-dice-row')).toHaveCount(7);
  await expect(page.locator('.vtt-dice-row button')).toHaveCount(42);
  await page.getByRole('button', { name: 'Rolar 3d20', exact: true }).click();
  await expect(page.locator('.vtt-dice-overlay')).toHaveAttribute('data-dice-count', '3');
  await page.getByRole('button', { name: 'Fechar lançador', exact: true }).click();
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  await panel.getByLabel('Rolagem', { exact: true }).fill('2d20kh1+3');
  await panel.getByRole('button', { name: 'Rolar dados', exact: true }).click();
  await expect(page.locator('.vtt-dice-overlay')).toHaveAttribute('data-dice-count', '2');
  await expect(page.locator('canvas[aria-label="Dados 3D"]')).toBeVisible();
  await expect(page.locator('canvas[aria-label="Dados 3D"]')).toHaveAttribute(
    'data-physics',
    'rigid-body',
  );
  await page.screenshot({ path: 'test-results/vtt-dice-3d.png' });
  await expect(page.locator('.vtt-roll').last()).toContainText('2d20kh1+3');
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar imagem PNG', exact: true }).click(),
  ]);
  expect(file.suggestedFilename()).toMatch(/\.png$/);
  await file.saveAs('test-results/vtt-map-export.png');
  await page.screenshot({ path: 'test-results/vtt-desktop.png' });
  await page.getByRole('button', { name: 'Fonte de luz', exact: true }).click();
  const lightBoard = (await page.locator('canvas[aria-label="Tabuleiro da mesa"]').boundingBox())!;
  await page.mouse.click(
    lightBoard.x + lightBoard.width * 0.25,
    lightBoard.y + lightBoard.height * 0.35,
  );
  await page.getByRole('button', { name: 'Camadas', exact: true }).click();
  await expect(
    page
      .getByRole('group', { name: 'Opções de Camadas' })
      .getByRole('button', { name: 'Iluminação e barreiras', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('group', { name: 'Opções de Camadas' }).press('Escape');
  await expect(page.locator('.vtt-panel-content')).toContainText('Fonte de luz');
  await page.getByRole('button', { name: 'Selecionar (V)', exact: true }).click();
  await page.mouse.click(
    lightBoard.x + lightBoard.width * 0.25,
    lightBoard.y + lightBoard.height * 0.35,
  );
  await page.getByRole('button', { name: 'Excluir luz selecionada', exact: true }).click();
  await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
  const rooms = await (await ctx.request.get(origin + '/api/vtt')).json(),
    rid = rooms.rooms[0].id;
  let mesa = await (await ctx.request.get(origin + '/api/vtt/rooms/' + rid)).json();
  mesa.document.scenes.find((s: any) => s.id === mesa.document.activeScene).walls = [
    {
      id: randomUUID(),
      a: { x: 900, y: 400 },
      b: { x: 900, y: 1200 },
      kind: 'wall',
      open: false,
    },
  ];
  expect(
    (
      await ctx.request.put(origin + '/api/vtt/rooms/' + rid, {
        headers: { Origin: origin },
        data: { revision: mesa.revision, document: mesa.document },
      })
    ).ok(),
  ).toBe(true);
  // Keep the real connection limiter enabled while pacing this dense smoke.
  await page.waitForTimeout(
    Math.min(59000, Math.max(0, 61000 - (Date.now() - requestWindowStart))),
  );
  await peerPage.goto(origin + '/#vtt');
  await peerPage.getByLabel('Código de convite', { exact: true }).fill(mesa.invite);
  await peerPage.getByRole('button', { name: 'Entrar na mesa', exact: true }).click();
  await expect(peerPage.getByLabel('Participação na mesa')).toHaveValue('player');
  const joined = await (await ctx.request.get(origin + '/api/vtt/rooms/' + rid)).json();
  const spawn = joined.document.scenes
    .find((s: any) => s.id === joined.document.activeScene)
    .tokens.find((t: any) => t.characterId === c.id);
  spawn.x = 875;
  spawn.y = 875;
  expect(
    (
      await ctx.request.put(origin + '/api/vtt/rooms/' + rid, {
        headers: { Origin: origin },
        data: { revision: joined.revision, document: joined.document },
      })
    ).ok(),
  ).toBe(true);
  await peerPage.getByRole('button', { name: 'Fichas', exact: true }).click();
  await expect(
    peerPage.getByRole('button', { name: 'Efeitos do mestre', exact: true }),
  ).toHaveCount(0);
  await peerPage
    .locator('.vtt-panel-content')
    .getByRole('button')
    .filter({ hasText: 'Lyra' })
    .click();
  await expect(peerPage.getByRole('dialog', { name: 'Ficha · Lyra', exact: true })).toBeVisible();
  const pinItem = peerPage.getByRole('button', { name: 'Fixar Poção de cura', exact: true });
  await expect(pinItem).toBeVisible();
  await pinItem.dragTo(peerPage.locator('.vtt-hotbar-slot').first());
  await expect(peerPage.locator('.vtt-hotbar-slot').first()).toContainText('Poção');
  await peerPage.getByRole('button', { name: 'Trancar aba', exact: true }).click();
  await expect(peerPage.locator('.vtt-hotbar-slot').first()).toHaveAttribute('draggable', 'false');
  await peerPage.locator('.vtt-hotbar-slot').first().click();
  await expect(peerPage.getByRole('button', { name: 'Remover atalho', exact: true })).toHaveCount(
    0,
  );
  await peerPage.getByRole('button', { name: 'Usar uma unidade', exact: true }).click();
  await expect
    .poll(async () =>
      Number(
        (
          await pool.query(
            "SELECT quantity FROM inventory WHERE character_id=$1 AND item_id='potion-of-healing'",
            [c.id],
          )
        ).rows[0].quantity,
      ),
    )
    .toBe(1);
  await peerPage.getByRole('button', { name: 'Destrancar aba', exact: true }).click();
  await peerPage.getByRole('button', { name: 'Nova aba de ações', exact: true }).click();
  await expect(peerPage.getByLabel('Aba da barra de ações').locator('option')).toHaveCount(2);
  await peerPage.getByLabel('Aba da barra de ações').selectOption({ label: 'Ações' });
  await peerPage.locator('.vtt-hotbar-slot').first().click();
  await peerPage.getByRole('button', { name: 'Remover atalho', exact: true }).click();
  await expect(peerPage.locator('.vtt-hotbar-slot').first()).not.toContainText('Poção');
  await expect(peerPage.getByRole('button', { name: 'Restaurar PV', exact: true })).toHaveCount(0);
  await peerPage.getByRole('button', { name: 'Fechar ficha', exact: true }).click();
  await expect(peerPage.locator('.vtt-panel-content h3').filter({ hasText: 'Lyra' })).toBeVisible();
  await peerPage.getByRole('button', { name: 'Selecionar (V)', exact: true }).click();
  const playerBoard = await peerPage
    .locator('canvas[aria-label="Tabuleiro da mesa"]')
    .boundingBox();
  expect(playerBoard).not.toBeNull();
  const px = playerBoard!.x + playerBoard!.width / 2,
    py = playerBoard!.y + playerBoard!.height / 2;
  await peerPage.mouse.move(px, py);
  await peerPage.mouse.down();
  await peerPage.mouse.move(px + 90, py);
  await peerPage.mouse.up();
  await expect(peerPage.locator('.vtt-notice')).toContainText('Uma barreira bloqueia o movimento.');
  await peerPage.getByRole('button', { name: 'Fechar aviso', exact: true }).click();
  await peerPage.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
  await peerPage.mouse.move(px, py);
  await peerPage.mouse.down();
  await peerPage.mouse.move(px - 70, py);
  await peerPage.mouse.up();
  await expect
    .poll(async () => {
      const response = await ctx2.request.get(origin + '/api/vtt/rooms/' + rid);
      if (!response.ok())
        throw Error('Consulta da mesa: HTTP ' + response.status() + ' ' + (await response.text()));
      const st = await response.json();
      return st.document.scenes[0].tokens.find((t: any) => t.characterId === c.id)?.x;
    })
    .toBeLessThan(875);
  await peerPage.screenshot({ path: 'test-results/vtt-player.png' });
  // Pixel evidence: darkvision is grey; real lights restore color; full fog hides elsewhere.
  mesa = await (await ctx.request.get(origin + '/api/vtt/rooms/' + rid)).json();
  const visibleScene = mesa.document.scenes.find((s: any) => s.id === mesa.document.activeScene),
    controlled = visibleScene.tokens.find((t: any) => t.characterId === c.id);
  Object.assign(controlled, { x: 875, y: 875, vision: 10, light: 0, dimLight: 0 });
  Object.assign(visibleScene, {
    background: '',
    backgroundColor: '#884020',
    walls: [],
    fog: true,
    fogMode: 'vision',
    lighting: true,
    ambient: 0,
  });
  visibleScene.grid.type = 'none';
  visibleScene.lights = [
    {
      id: randomUUID(),
      name: 'Luz de teste',
      x: 1175,
      y: 875,
      bright: 10,
      dim: 0,
      color: '#ffffff',
      rotation: 0,
      angle: 360,
      enabled: true,
    },
  ];
  expect(
    (
      await ctx.request.put(origin + '/api/vtt/rooms/' + rid, {
        headers: { Origin: origin },
        data: { revision: mesa.revision, document: mesa.document },
      })
    ).ok(),
  ).toBe(true);
  async function pixel(dx: number, dy: number) {
    return peerPage.locator('canvas[aria-label="Tabuleiro da mesa"]').evaluate(
      (el, args) => {
        const canvas = el as HTMLCanvasElement,
          rect = canvas.getBoundingClientRect(),
          z = parseInt(document.querySelector('.vtt-map-footer span')?.textContent || '0') / 100;
        const zoom =
          Number(
            document.querySelector('.vtt-map-footer')?.textContent?.match(/(\d+)%/)?.[1] || '38',
          ) / 100;
        const ratio = canvas.width / rect.width;
        return [
          ...canvas
            .getContext('2d')!
            .getImageData(
              Math.round((rect.width / 2 + args.dx * zoom) * ratio),
              Math.round((rect.height / 2 + args.dy * zoom) * ratio),
              1,
              1,
            ).data,
        ];
      },
      { dx, dy },
    );
  }
  await expect
    .poll(async () => {
      const rgb = await pixel(0, 120);
      return Math.max(...rgb.slice(0, 3)) - Math.min(...rgb.slice(0, 3));
    })
    .toBeLessThan(3);
  await expect
    .poll(async () => {
      const illuminated = await pixel(300, 0);
      return illuminated[0] - illuminated[2];
    })
    .toBeGreaterThan(30);
  const hidden = await pixel(600, 0);
  expect(Math.max(...hidden.slice(0, 3))).toBeLessThan(15);
  await peerPage.screenshot({ path: 'test-results/vtt-darkvision-color-fog.png' });
  const observerContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    extraHTTPHeaders: { 'X-Vtt-Schema-Version': '2' },
  });
  const observer = await signup(observerContext, 'Espectador'),
    observerPage = await observerContext.newPage();
  observerPage.on('pageerror', (e) => errors.push(e.message));
  await observerPage.goto(origin + '/#vtt');
  await observerPage.getByLabel('Código de convite', { exact: true }).fill(mesa.invite);
  await observerPage.getByLabel('Entrar como', { exact: true }).selectOption('spectator');
  await observerPage.getByRole('button', { name: 'Entrar na mesa', exact: true }).click();
  await expect(observerPage.getByLabel('Participação na mesa')).toHaveValue('spectator');
  await expect(observerPage.locator('.vtt-hotbar')).toHaveCount(0);
  await expect(
    observerPage.getByRole('button', { name: 'Escolher dados', exact: true }),
  ).toHaveCount(0);
  await observerPage.getByLabel('Ver pela visão de', { exact: true }).selectOption(peer.id);
  await expect(observerPage.getByLabel('Ver pela visão de')).toHaveValue(peer.id);
  const observed = await (
    await observerContext.request.get(origin + '/api/vtt/rooms/' + rid)
  ).json();
  expect(observed.role).toBe('spectator');
  expect(observed.viewingUser).toBe(peer.id);
  expect(observed.document.scenes[0].tokens.every((t: any) => !t.sheet && !t.notes)).toBe(true);
  await observerPage.getByRole('button', { name: 'Fichas', exact: true }).click();
  await expect(observerPage.locator('.vtt-panel')).toContainText('sem trazer fichas');
  await observerPage.screenshot({ path: 'test-results/vtt-spectator.png' });
  await observerPage.getByRole('button', { name: 'Chat', exact: true }).click();
  await expect(
    observerPage.getByRole('button', { name: 'Enviar à mesa', exact: true }),
  ).toHaveCount(0);
  await expect(observerPage.getByRole('button', { name: 'Rolar dados', exact: true })).toHaveCount(
    0,
  );
  await observerPage.getByLabel('Participação na mesa').selectOption('player');
  await expect(observerPage.locator('.vtt-hotbar')).toBeVisible();
  await observerPage.getByLabel('Participação na mesa').selectOption('spectator');
  await expect(observerPage.locator('.vtt-hotbar')).toHaveCount(0);
  for (const width of [390, 320]) {
    await observerPage.setViewportSize({ width, height: 900 });
    expect(
      await observerPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    await observerPage.screenshot({ path: 'test-results/vtt-spectator-' + width + '.png' });
  }
  await observerPage.setViewportSize({ width: 1280, height: 900 });
  {
    await page.getByRole('button', { name: 'Salvar mesa', exact: true }).click();
    const latest = await (await ctx.request.get(origin + '/api/vtt/rooms/' + rid)).json();
    const s = latest.document.scenes.find((s: any) => s.id === latest.document.activeScene);
    Object.assign(s, { fog: false, lighting: false, ambient: 1 });
    s.tokens
      .filter((t: any) => !t.hidden && t.layer === 'tokens')
      .forEach((t: any, i: number) => {
        t.x = 750 + i * 150;
        t.y = 875;
      });
    expect(
      (
        await ctx.request.put(origin + '/api/vtt/rooms/' + rid, {
          headers: { Origin: origin },
          data: { revision: latest.revision, document: latest.document },
        })
      ).ok(),
    ).toBe(true);
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    await page.getByRole('button', { name: 'Combate', exact: true }).click();
    const combatPanel = page.getByRole('region', { name: 'Ordem dos turnos' });
    await combatPanel
      .getByRole('button', { name: 'Selecionar todos os tokens', exact: true })
      .click();
    await combatPanel.getByRole('button', { name: 'Adicionar todos à ordem', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Carrossel de turnos' })).toBeVisible();
    const order = await (
      await ctx.request.get(origin + '/api/vtt/rooms/' + rid + '/combat')
    ).json();
    expect(order.entries.length).toBeGreaterThan(1);
    for (const [i, e] of order.entries.entries())
      await ctx.request.post(origin + '/api/vtt/rooms/' + rid + '/combat', {
        headers: { Origin: origin },
        data: { kind: 'set', tokenId: e.tokenId, value: 100 - i },
      });
    const owned = order.entries.find((e: any) =>
      s.tokens.some((t: any) => t.id === e.tokenId && t.controller === peer.id),
    );
    await peerPage.getByRole('button', { name: 'Chat', exact: true }).click();
    await peerPage.getByRole('button', { name: 'Combate', exact: true }).click();
    const peerCombat = peerPage.getByRole('region', { name: 'Ordem dos turnos' });
    await peerCombat
      .getByRole('button', { name: 'Rolar iniciativa de ' + owned.name, exact: true })
      .click();
    await peerPage
      .getByRole('region', { name: 'Carrossel de turnos' })
      .getByRole('button', { name: 'Rolar iniciativa de ' + owned.name, exact: true })
      .click();
    await expect(
      combatPanel.getByRole('button', { name: 'Iniciar combate', exact: true }),
    ).toBeEnabled();
    await combatPanel.getByRole('button', { name: 'Iniciar combate', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Carrossel de turnos' })).toContainText(
      'Rodada 1',
    );
    await expect(observerPage.getByRole('region', { name: 'Carrossel de turnos' })).toContainText(
      'Rodada 1',
    );
    await expect(
      observerPage
        .getByRole('region', { name: 'Carrossel de turnos' })
        .getByRole('button', { name: /Rolar iniciativa/ }),
    ).toHaveCount(0);
    await page.screenshot({ path: 'test-results/vtt-turn-carousel.png' });
    const priorCombat = await (
      await ctx.request.get(origin + '/api/vtt/rooms/' + rid + '/combat')
    ).json();
    await page
      .getByRole('region', { name: 'Carrossel de turnos' })
      .getByRole('button', { name: 'Avançar turno', exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await (await ctx.request.get(origin + '/api/vtt/rooms/' + rid + '/combat')).json())
            .revision,
      )
      .toBeGreaterThan(priorCombat.revision);
    const combatState = await (
      await ctx.request.get(origin + '/api/vtt/rooms/' + rid + '/combat')
    ).json();
    await expect
      .poll(
        async () =>
          (await (await ctx2.request.get(origin + '/api/vtt/rooms/' + rid + '/combat')).json())
            .currentId,
      )
      .toBe(combatState.currentId);
    // GM arrow broadcasts camera center even to spectators, without changing vision.
    const board = page.locator('canvas[aria-label="Tabuleiro da mesa"]'),
      box = (await board.boundingBox())!;
    await page.getByRole('button', { name: 'Sinalizar ponto', exact: true }).click();
    await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.42);
    await expect
      .poll(
        async () =>
          (await (await ctx.request.get(origin + '/api/vtt/rooms/' + rid + '/signal')).json())?.id,
      )
      .toBeTruthy();
    const focus = await (
      await ctx.request.get(origin + '/api/vtt/rooms/' + rid + '/signal')
    ).json();
    for (const p of [page, peerPage, observerPage]) {
      await expect
        .poll(
          async () =>
            Number(
              await p
                .locator('canvas[aria-label="Tabuleiro da mesa"]')
                .getAttribute('data-camera-x'),
            ),
          { timeout: 8000 },
        )
        .toBeCloseTo(focus.x, 1);
      await expect
        .poll(async () =>
          Number(
            await p.locator('canvas[aria-label="Tabuleiro da mesa"]').getAttribute('data-camera-y'),
          ),
        )
        .toBeCloseTo(focus.y, 1);
    }
    await expect(page.getByRole('button', { name: 'Mover (H)', exact: true })).toHaveCount(0);
    await combatPanel.getByRole('button', { name: 'Encerrar combate', exact: true }).click();
    await page.getByRole('button', { name: 'Selecionar (V)', exact: true }).click();
    await page.getByRole('button', { name: 'Escolher dados', exact: true }).click();
    await page.getByLabel('Fórmula personalizada', { exact: true }).fill('4d6kh3');
    await page.getByRole('button', { name: 'Rolar fórmula', exact: true }).click();
    await page.locator('.vtt-roll-help summary').first().click();
    await expect(page.locator('.vtt-roll-help').first()).toContainText(
      'Como a fórmula é resolvida',
    );
    await page.screenshot({ path: 'test-results/vtt-custom-roll-help.png' });
    await page.getByRole('button', { name: 'Fechar lançador', exact: true }).click();
    await page.getByRole('button', { name: 'Configurações e ajuda', exact: true }).click();
    await panel.getByRole('button', { name: 'Ajuda', exact: true }).click();
    await panel.locator('.vtt-roll-help summary').click();
    await expect(panel.locator('.vtt-roll-help')).toContainText('1d20cs>18cf<2');
    await page.screenshot({ path: 'test-results/vtt-settings-roll-help.png' });
  }
  await observerContext.close();
  // Inspect the real canvas renderer with an isolated, clearly lit portrait.
  const visual = await ctx.newPage();
  await visual.route('**/death-render-check', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html><body style="margin:0"><canvas width="700" height="560"></canvas></body></html>',
    }),
  );
  await visual.goto(origin + '/death-render-check');
  // tsx preserves local arrow names with this helper when serializing evaluate.
  await visual.addScriptTag({ content: 'window.__name = function (fn) { return fn; };' });
  const renderer = await build({
    entryPoints: ['src/vtt-canvas.ts'],
    bundle: true,
    write: false,
    format: 'iife',
    globalName: 'vttRenderer',
    platform: 'browser',
  });
  await visual.addScriptTag({ content: renderer.outputFiles[0].text });
  const portraitToken = mesa.document.scenes
    .flatMap((s: any) => s.tokens)
    .find((t: any) => t.characterId === a.id);
  expect(portraitToken?.image).toBeTruthy();
  const visualScene = structuredClone(mesa.document.scenes[0]);
  Object.assign(visualScene, {
    width: 700,
    height: 560,
    background: '',
    backgroundColor: '#a28d69',
    lighting: false,
    fog: false,
    walls: [],
    lights: [],
    drawings: [],
    tokens: [
      {
        ...portraitToken,
        name: 'Retrato íntegro',
        x: 350,
        y: 280,
        width: 160,
        height: 160,
        deathAt: Date.now() - 2000,
        effects: [],
      },
    ],
  });
  const pixelCheck = await visual.evaluate(async (scene) => {
    const c = document.querySelector('canvas')!.getContext('2d')!;
    const img = new Image();
    img.src = scene.tokens[0].image;
    await img.decode();
    const original = c.drawImage.bind(c);
    let calls = 0;
    c.drawImage = ((...args: any[]) => {
      calls++;
      return (original as any)(...args);
    }) as typeof c.drawImage;
    (window as any).vttRenderer.renderVtt(c, scene, {
      camera: { x: 350, y: 280, zoom: 1 },
      width: 700,
      height: 560,
      dpr: 1,
      images: new Map([[img.src.replace(location.origin, ''), img]]),
      selected: [],
      gm: true,
      preview: false,
      viewer: null,
      layer: 'tokens',
      ruler: [],
      draft: null,
      showWalls: false,
      ping: null,
    });
    const p = c.getImageData(0, 0, 700, 560).data;
    let blood = 0;
    for (let y = 150; y < 410; y++)
      for (let x = 220; x < 480; x++) {
        if (Math.hypot(x - 350, y - 280) <= 84) continue;
        const i = (y * 700 + x) * 4;
        if (p[i] > p[i + 1] * 2 && p[i] > p[i + 2] * 2) blood++;
      }
    return { calls, blood };
  }, visualScene);
  expect(pixelCheck.calls).toBe(1); // Only the intact portrait, never image fragments.
  expect(pixelCheck.blood).toBeGreaterThan(300);
  await visual.screenshot({ path: 'test-results/vtt-death-intact-portrait.png' });
  const effectChecks = await visual.evaluate(async (scene) => {
    const c = document.querySelector('canvas')!.getContext('2d')!,
      img = new Image();
    img.src = scene.tokens[0].image;
    await img.decode();
    const options = {
      camera: { x: 350, y: 280, zoom: 1 },
      width: 700,
      height: 560,
      dpr: 1,
      images: new Map([[img.src.replace(location.origin, ''), img]]),
      selected: [],
      gm: true,
      preview: false,
      viewer: null,
      layer: 'tokens',
      ruler: [],
      draft: null,
      showWalls: false,
      ping: null,
    };
    scene.tokens[0].deathAt = null;
    const render = () => {
      (window as any).vttRenderer.renderVtt(c, scene, options);
      return c.getImageData(0, 0, 700, 560).data;
    };
    const plain = render(),
      pictures: Uint8ClampedArray[] = [],
      checks: number[] = [];
    for (const [i, kind] of ['fire', 'frost', 'poison', 'heal', 'sparks'].entries()) {
      scene.tokens[0].effects = [
        { id: 'check-' + i, kind, color: '#b9d5ed', scale: 1, duration: 0, at: Date.now() - 2400 },
      ];
      const p = render();
      pictures.push(p);
      let changed = 0;
      for (let y = 225; y < 335; y++)
        for (let x = 295; x < 405; x++) {
          if (Math.hypot(x - 350, y - 280) > 55) continue;
          const j = (y * 700 + x) * 4;
          if (
            Math.abs(p[j] - plain[j]) +
              Math.abs(p[j + 1] - plain[j + 1]) +
              Math.abs(p[j + 2] - plain[j + 2]) >
            20
          )
            changed++;
        }
      checks.push(changed);
    }
    const differences = pictures.map((p, i) =>
      i
        ? p.reduce(
            (n, v, j) => n + (j % 4 !== 3 && Math.abs(v - pictures[i - 1][j]) > 15 ? 1 : 0),
            0,
          )
        : 0,
    );
    // A monster with darkvision must not erase the master's wall shadow.
    scene.tokens[0].effects = [];
    Object.assign(scene.tokens[0], {
      x: 500,
      y: 200,
      width: 40,
      height: 40,
      vision: 60,
      light: 0,
      dimLight: 0,
    });
    Object.assign(scene, { lighting: true, ambient: 0, gmDarkness: 1 });
    scene.lights = [
      {
        id: 'light',
        name: 'Luz',
        x: 250,
        y: 280,
        bright: 80,
        dim: 0,
        color: '#fff4cc',
        rotation: 0,
        angle: 360,
        enabled: true,
      },
    ];
    const wall = {
      id: 'wall',
      a: { x: 350, y: 0 },
      b: { x: 350, y: 560 },
      kind: 'wall',
      open: false,
    };
    scene.walls = [wall];
    const brightness = () => {
      render();
      const p = c.getImageData(450, 280, 1, 1).data;
      return p[0] + p[1] + p[2];
    };
    const closed = brightness();
    wall.kind = 'door';
    wall.open = true;
    const opened = brightness();
    wall.kind = 'window';
    wall.open = false;
    const throughGlass = brightness();
    return { checks, differences, closed, opened, window: throughGlass };
  }, visualScene);
  for (const changed of effectChecks.checks) expect(changed).toBeGreaterThan(100);
  for (const changed of effectChecks.differences.slice(1)) expect(changed).toBeGreaterThan(500);
  expect(effectChecks.opened - effectChecks.closed).toBeGreaterThan(80);
  expect(effectChecks.window - effectChecks.closed).toBeGreaterThan(80);
  await visual.close();
  // Keep the real 240/min limiter enabled; let its first window finish before layout navigation.
  await page.waitForTimeout(Math.max(0, 61000 - (Date.now() - requestWindowStart)));
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + '/#profiles?user=' + owner.id);
    await expect(page.locator('.public-camp-pet')).toContainText('Brasa');
    await checkCompanionFraming();
    await page.screenshot({ path: `test-results/profile-animals-${width}.png`, fullPage: true });
    await page
      .locator('.profile-visit-nav')
      .getByRole('button', { name: 'Conquistas', exact: true })
      .click();
    await expect(page.locator('.public-achievements')).toHaveAttribute('aria-hidden', 'false');
    const buttons = await page.locator('.profiles-top > div > button').evaluateAll((buttons) =>
      buttons.map((b) => {
        const r = b.getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      }),
    );
    expect(
      Math.max(...buttons.map((b) => b.y)) - Math.min(...buttons.map((b) => b.y)),
    ).toBeLessThan(2);
    const avatar = await page.locator('.profile-avatar').boundingBox();
    expect(
      buttons.every(
        (b) => b.bottom <= avatar!.y || b.y >= avatar!.y + avatar!.height || b.right <= avatar!.x,
      ),
    ).toBe(true);
    await expect
      .poll(() =>
        page
          .locator('.profile-panels-strip')
          .evaluate((el) => el.getAnimations().every((a) => a.playState !== 'running')),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/profile-frames-${width}.png`, fullPage: true });
    await page.goto(origin + '/#hall');
    await expect(page.locator('.hall-champion')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/hall-${width}.png`, fullPage: true });
    await page.goto(origin + '/#vtt');
    await expect(page.locator('canvas[aria-label="Tabuleiro da mesa"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/vtt-${width}.png` });
  }
  expect(errors).toEqual([]);
  console.log(
    'Hall, perfis por ID, seleção de companheiros, molduras, ficha/cartas somente leitura, amizade e chat em duas contas, VTT com ficha/grid/barreira/monstro/dados/exportação e layouts 1440/768/390/320 verificados.',
  );
} catch (error) {
  await page.screenshot({ path: 'test-results/vtt-social-failure.png', fullPage: true });
  throw error;
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
}
