import type { PoolClient } from 'pg';
import { balancedMagicPrice, economyVersion } from '../shared/economy.js';
import { houseCatalog } from '../shared/house.js';
import { INITIAL_RULEBOOK, rulebookDocumentSchema, type RulebookDocument } from '../shared/rulebook.js';

const missionCreditsRulebookVersion = 'mission-credits-by-difficulty';

// Publish only the requested economy articles, keeping all other edits and images.
export async function applyEconomyRulebook(db: PoolClient) {
  const book = (await db.query('SELECT * FROM rulebook_documents WHERE id=1 FOR UPDATE')).rows[0];
  if (!book) return;
  const { rows: applied } = await db.query<{ version: string }>(
    "SELECT version FROM economy_settings_history WHERE version=ANY($1::text[]) AND area='rulebook' AND reference='1'",
    [[economyVersion, missionCreditsRulebookVersion]],
  );
  if (applied.some(({ version }) => version === missionCreditsRulebookVersion)) return;
  const initial = !applied.some(({ version }) => version === economyVersion);
  const articles = initial ? ['missoes-recompensas', 'economia-moedas'] : ['missoes-recompensas'];
  const document = structuredClone(book.document) as RulebookDocument;
  for (const chapter of document.chapters) {
    for (const article of chapter.articles) {
      if (!articles.includes(article.id)) continue;
      const current = INITIAL_RULEBOOK.chapters
        .flatMap((c) => c.articles)
        .find((a) => a.id === article.id)!;
      if (initial) article.title = current.title;
      article.summary = current.summary;
      for (const block of current.blocks) {
        const index = article.blocks.findIndex((b) => b.id === block.id);
        if (index >= 0) article.blocks[index] = structuredClone(block);
        else article.blocks.push(structuredClone(block));
      }
    }
  }
  rulebookDocumentSchema.parse(document);
  await db.query(
    "INSERT INTO economy_settings_history(version,area,reference,document) SELECT version,'rulebook','1',$2 FROM unnest($1::text[]) AS versions(version)",
    [
      initial ? [economyVersion, missionCreditsRulebookVersion] : [missionCreditsRulebookVersion],
      JSON.stringify(book.document),
    ],
  );
  if (JSON.stringify(document) === JSON.stringify(book.document)) return;
  await db.query(
    'INSERT INTO rulebook_versions(document_id,revision,snapshot,editor_id,document_updated_at)VALUES(1,$1,$2,$3,$4)',
    [book.revision, JSON.stringify(book.document), book.updated_by, book.updated_at],
  );
  await db.query(
    'UPDATE rulebook_documents SET document=$1,revision=revision+1,updated_by=NULL,updated_at=now() WHERE id=1',
    [JSON.stringify(document)],
  );
}

// Called under the catalog's existing transaction/advisory lock, after overrides.
// One application per product: later administrator edits survive every seed.
export async function applyEconomyPrices(db: PoolClient) {
  const items = (
    await db.query(
      'SELECT id,name,category,price_cp,raw_data FROM catalog_items WHERE active ORDER BY id FOR UPDATE',
    )
  ).rows;
  const candidates = [
    ...items.map((item) => ({ id: item.id, price: balancedMagicPrice(item) })),
    ...houseCatalog.map((item) => ({ id: 'house-' + item.id, price: item.price_cp })),
  ].filter((item) => item.price !== null);
  for (const item of candidates) {
    const prior = await db.query(
      'SELECT 1 FROM economy_price_history WHERE version=$1 AND item_id=$2',
      [economyVersion, item.id],
    );
    if (prior.rowCount) continue;
    await db.query(
      `INSERT INTO economy_price_history(version,item_id,before_price_cp,after_price_cp,before_override)
      SELECT $1,$2,(SELECT price_cp FROM catalog_items WHERE id=$2),$3,(SELECT to_jsonb(o)FROM shop_price_overrides o WHERE item_id=$2)`,
      [economyVersion, item.id, item.price],
    );
    await db.query(
      'INSERT INTO shop_price_overrides(item_id,price_cp)VALUES($1,$2)ON CONFLICT(item_id)DO UPDATE SET price_cp=excluded.price_cp,updated_at=now()',
      [item.id, item.price],
    );
    await db.query('UPDATE catalog_items SET price_cp=$2 WHERE id=$1', [item.id, item.price]);
  }
  // Spell-configured inventory identities keep their origin's current shop price.
  await db.query(`UPDATE catalog_items configured SET price_cp=origin.price_cp FROM catalog_items origin
    WHERE configured.raw_data->>'configuration_origin'=origin.id`);
}
