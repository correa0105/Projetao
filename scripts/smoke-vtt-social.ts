import 'dotenv/config';
import { chromium, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import sharp from 'sharp';
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
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  }),
  ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } }),
  page = await ctx.newPage(),
  peerPage = await ctx2.newPage(),
  errors: string[] = [];
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
  await page.getByRole('button', { name: 'Selecionar Mira no perfil' }).click();
  await expect(page.locator('.public-camp-pet')).toContainText('Pingo');
  await expect(page.locator('.public-camp-mount')).toContainText('Faísca');
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
  await page.getByRole('button', { name: 'Ficha', exact: true }).click();
  await panel.getByRole('button').filter({ hasText: 'Arden' }).click();
  await expect(page.getByRole('dialog', { name: 'Ficha · Arden', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/vtt-full-sheet.png' });
  await page.getByRole('button', { name: 'Fechar ficha', exact: true }).click();
  await expect(panel).toContainText('Arden');
  await page.getByRole('button', { name: 'Token', exact: true }).first().click();
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
  await page.getByRole('button', { name: 'Cena', exact: true }).click();
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
  await page.getByRole('button', { name: 'Bibliotecas', exact: true }).click();
  await panel.getByRole('button', { name: 'Monstros', exact: true }).click();
  await panel.getByLabel('Buscar na biblioteca', { exact: true }).fill('Goblin');
  await expect(panel.locator('.vtt-compendium button').first()).toBeVisible();
  await panel.locator('.vtt-compendium button').first().click();
  await panel.getByRole('button', { name: 'Adicionar ao tabuleiro', exact: true }).click();
  await page.getByRole('button', { name: 'Token', exact: true }).click();
  await panel.getByLabel('Estilo da barra de boss').selectOption('royal');
  await panel.getByLabel('Efeito de morte automático ao zerar PV').check();
  await panel.getByLabel('PV atual', { exact: true }).fill('0');
  await expect(page.locator('.vtt-boss-track')).toHaveAttribute('aria-valuenow', '0');
  await page.screenshot({ path: 'test-results/vtt-boss-death.png' });
  await panel.getByLabel('PV atual', { exact: true }).fill('8');
  await expect(page.locator('.vtt-boss-heal')).toBeVisible();
  await panel.getByRole('button', { name: 'Aplicar efeito de morte', exact: true }).click();
  await expect(
    panel.getByRole('button', { name: 'Limpar efeito de morte', exact: true }),
  ).toBeEnabled();
  await panel.getByRole('button', { name: 'Limpar efeito de morte', exact: true }).click();
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
  await page.getByRole('button', { name: 'Dados e chat', exact: true }).click();
  await panel.getByLabel('Rolagem', { exact: true }).fill('2d20kh1+3');
  await panel.getByRole('button', { name: 'Rolar dados', exact: true }).click();
  await expect(page.locator('.vtt-dice-overlay')).toHaveAttribute('data-dice-count', '2');
  await expect(page.locator('canvas[aria-label="Dados 3D"]')).toBeVisible();
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
  await expect(page.getByLabel('Camada ativa')).toHaveValue('lighting');
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
  await peerPage.goto(origin + '/#vtt');
  await peerPage.getByLabel('Código de convite', { exact: true }).fill(mesa.invite);
  await peerPage.getByRole('button', { name: 'Entrar na mesa', exact: true }).click();
  await peerPage.getByRole('button', { name: 'Ficha', exact: true }).click();
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
      const st = await (await ctx2.request.get(origin + '/api/vtt/rooms/' + rid)).json();
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
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(origin + '/#profiles?user=' + owner.id);
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
