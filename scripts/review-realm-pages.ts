import { expect, type Page } from '@playwright/test';
import type pg from 'pg';

/** Read-only browser review after isolated fixtures have been created. */
export async function reviewRealmPages(page: Page, pool: pg.Pool, origin: string, ownerId: string) {
  for (const [i, status] of ['open', 'active', 'completed'].entries()) {
    await pool.query(
      "INSERT INTO board_posts(author_id,kind,title,description,starts_at,location,difficulty,reward_cp,status,event_presentation) VALUES($1,'event',$2,$3,$4,'Salão da guilda','Tranquila',0,$5,$6)",
      [
        ownerId,
        ['Vigília das lanternas', 'Encontro dos viajantes', 'Memórias do equinócio'][i],
        'Uma noite para reunir os viajantes e compartilhar as histórias da Alvorada.',
        new Date(Date.now() + (i === 2 ? -86400000 : 86400000) * (i + 1)).toISOString(),
        status,
        JSON.stringify({
          eyebrow: 'Encontro da Alvorada',
          image: '/shop/merchant-v2.png',
          animation: 'none',
          featured: i === 0,
          link: '',
        }),
      ],
    );
  }
  const roomRows = async () =>
    (
      await pool.query(
        "SELECT md5(COALESCE(string_agg(to_jsonb(b)::text,'' ORDER BY id),'')) AS hash FROM board_posts b WHERE kind='event'",
      )
    ).rows[0].hash;
  const before = await roomRows();
  const eventCounts = (
    await pool.query(
      "SELECT count(*)::int AS all,count(*) FILTER(WHERE status IN ('open','active'))::int AS upcoming FROM board_posts WHERE kind='event'",
    )
  ).rows[0];
  for (const room of ['profiles', 'events', 'hall', 'cards', 'tower'] as const) {
    await page.goto(origin + '/#' + room);
    await expect(page.locator('.app-shell')).toHaveAttribute('data-page', room);
    const root = page.locator(
      {
        profiles: '.profiles-page',
        events: '.events-page',
        hall: '.hall-of-fame',
        cards: '.cards-room',
        tower: '.tower-page',
      }[room]!,
    );
    await expect(root).toBeVisible();
    if (room === 'profiles') {
      await expect(page.locator('.profile-directory article')).toHaveCount(2);
      await page.getByRole('textbox', { name: 'Localizador de perfil' }).fill('Viajante');
      await expect(page.locator('.profile-directory article')).toHaveCount(1);
      await page.getByRole('textbox', { name: 'Localizador de perfil' }).fill('');
      await expect(page.locator('.profile-directory article')).toHaveCount(2);
    }
    if (room === 'events') {
      await expect(page.locator('.events-agenda > button')).toHaveCount(eventCounts.all);
      await expect(page.getByRole('button', { name: 'Criar evento', exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Memórias', exact: true }).click();
      await expect(page.locator('.event-feature h2')).toHaveText('Memórias do equinócio');
      await page.getByRole('button', { name: 'Próximos', exact: true }).click();
      await expect(page.locator('.events-agenda > button')).toHaveCount(eventCounts.upcoming);
      await page.getByRole('button', { name: 'Todos', exact: true }).click();
      await expect(page.locator('.events-agenda > button')).toHaveCount(eventCounts.all);
      await page
        .locator('.events-agenda > button')
        .filter({ hasText: 'Encontro dos viajantes' })
        .click();
      await expect(page.locator('.event-feature h2')).toHaveText('Encontro dos viajantes');
    }
    if (room === 'hall') {
      await expect(page.locator('.hall-champion')).toHaveCount(2);
      for (const name of [
        'Conquistas',
        'Prestígio',
        'Aventureiros',
        'Perfis avaliados',
        'Honrarias',
        'Geral',
      ]) {
        const button = page
          .getByRole('navigation', { name: 'Tipos de ranking' })
          .getByRole('button', { name, exact: true });
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
      }
      await page.getByRole('textbox', { name: 'Buscar personagem no Hall da Fama' }).fill('Nana');
      await expect(page.locator('.hall-table-row')).toHaveCount(1);
      await page.getByRole('textbox', { name: 'Buscar personagem no Hall da Fama' }).fill('');
    }
    if (room === 'cards') {
      await expect(page.locator('.cards-equipped > button')).toHaveCount(3);
      await expect(page.locator('.cards-detail-preview .arcana-card-face')).toHaveCount(1);
      await page
        .getByRole('button', { name: 'Ver detalhes da carta selecionada', exact: true })
        .click();
      await expect(page.locator('#selected-card-details')).toBeInViewport();
      expect(new URL(page.url()).hash).toBe('#cards');
      await page.evaluate(() => window.scrollTo(0, 0));
    }
    if (room === 'tower') {
      await expect(
        page.getByLabel('Escolher região', { exact: true }).locator('option'),
      ).toHaveCount(20);
      await expect(
        page.getByLabel('Escolher andar', { exact: true }).locator('option'),
      ).toHaveCount(100);
      await page.getByLabel('Escolher região', { exact: true }).selectOption('19');
      await expect(page.getByLabel('Escolher andar', { exact: true })).toHaveValue('96');
      await page.getByLabel('Escolher andar', { exact: true }).selectOption('100');
      await expect(page.getByLabel('Escolher região', { exact: true })).toHaveValue('19');
      await page.getByLabel('Escolher região', { exact: true }).selectOption('0');
      for (const name of ['Expedições', 'Tesouros', 'A ascensão']) {
        const button = page
          .getByRole('navigation', { name: 'Seções da torre' })
          .getByRole('button', { name, exact: true });
        await button.click();
        await expect(button).toHaveAttribute('aria-pressed', 'true');
      }
    }
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
        .toBe(true);
      if (room === 'tower')
        for (const label of ['Escolher região', 'Escolher andar'])
          expect(
            (await page.getByLabel(label, { exact: true }).boundingBox())!.width,
          ).toBeGreaterThan(120);
      if (room === 'cards' && width <= 650) {
        const heading = (await page.locator('.cards-room header h2').boundingBox())!,
          caption = (await page.locator('.cards-room header p').boundingBox())!,
          slots = (await page.locator('.cards-equipped').boundingBox())!;
        expect(heading.y + heading.height).toBeLessThan(slots.y);
        expect(caption.x + caption.width <= slots.x || caption.y + caption.height <= slots.y).toBe(
          true,
        );
      }
      await page.screenshot({ path: `test-results/realm-${room}-${width}.png`, fullPage: true });
    }
  }
  expect(await roomRows()).toBe(before);
  console.log(
    'PASS cinco páginas reais em quatro larguras; busca de perfis, seis rankings, agenda/filtros sem edição, cartas com navegação interna e vinte regiões/cem andares.',
  );
}
