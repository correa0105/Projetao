import type { PoolClient } from 'pg';
import {
  INITIAL_RULEBOOK,
  rulebookDocumentSchema,
  type RulebookDocument,
} from '../shared/rulebook.js';

const version = 'site-rules-20261112';

export async function applyCurrentRulebook(db: PoolClient) {
  const book = (await db.query('SELECT * FROM rulebook_documents WHERE id=1 FOR UPDATE')).rows[0];
  if (
    !book ||
    (
      await db.query(
        "SELECT 1 FROM economy_settings_history WHERE version=$1 AND area='rulebook' AND reference='1'",
        [version],
      )
    ).rowCount
  )
    return;
  const document = structuredClone(book.document) as RulebookDocument;
  for (const source of INITIAL_RULEBOOK.chapters) {
    const chapter = document.chapters.find((current) => current.id === source.id);
    if (!chapter) {
      document.chapters.push(structuredClone(source));
      continue;
    }
    chapter.title = source.title;
    chapter.description = source.description;
    for (const current of source.articles) {
      const article = chapter.articles.find((candidate) => candidate.id === current.id);
      if (!article) {
        chapter.articles.push(structuredClone(current));
        continue;
      }
      article.title = current.title;
      article.summary = current.summary;
      for (const block of current.blocks) {
        const index = article.blocks.findIndex((candidate) => candidate.id === block.id);
        if (index >= 0) article.blocks[index] = structuredClone(block);
        else article.blocks.push(structuredClone(block));
      }
    }
  }
  rulebookDocumentSchema.parse(document);
  await db.query(
    "INSERT INTO economy_settings_history(version,area,reference,document) VALUES($1,'rulebook','1',$2)",
    [version, JSON.stringify(book.document)],
  );
  if (JSON.stringify(document) === JSON.stringify(book.document)) return;
  await db.query(
    'INSERT INTO rulebook_versions(document_id,revision,snapshot,editor_id,document_updated_at) VALUES(1,$1,$2,$3,$4)',
    [book.revision, JSON.stringify(book.document), book.updated_by, book.updated_at],
  );
  await db.query(
    'UPDATE rulebook_documents SET document=$1,revision=revision+1,updated_by=NULL,updated_at=now() WHERE id=1',
    [JSON.stringify(document)],
  );
}
