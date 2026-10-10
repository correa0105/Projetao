import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { houseCatalog } from '../shared/house.js';
import { pool } from './db.js';
import { AppError } from './services.js';

type RuleRecord = {
  name: string;
  portuguese: string;
  stats: string;
  reference_url: string;
};
type RulesDataset = {
  edition: string;
  records: Record<string, RuleRecord>;
  items: Record<
    string,
    {
      keys: string[];
      reference_key: string;
      variant: string;
      reference_url?: string;
      stats_overrides?: Record<string, string>;
    }
  >;
};
let dataset: Promise<RulesDataset> | undefined;
function readDataset() {
  dataset ||= readFile(resolve('data/shop-item-rules.json'), 'utf8')
    .then((text) => JSON.parse(text) as RulesDataset)
    .catch(() => {
      dataset = undefined;
      throw new AppError(503, 'As explicações dos itens estão temporariamente indisponíveis.');
    });
  return dataset;
}

function response(
  title: string,
  description: string,
  source_name: string,
  source_url: string,
  reference_url: string,
  project_content: boolean,
  edition?: string,
) {
  return {
    title,
    description,
    descriptionPortuguese: description,
    source_name,
    source_url,
    reference_url,
    project_content,
    ...(edition ? { edition } : {}),
  };
}

export async function getShopItemRules(id: string) {
  if (id.startsWith('house-')) {
    const item = houseCatalog.find((item) => `house-${item.id}` === id);
    if (!item) throw new AppError(404, 'Item não encontrado.');
    const use =
      item.id === 'letter'
        ? 'Permite escrever uma mensagem e oferecer a carta como lembrança na House.'
        : item.id === 'frame'
          ? 'Permite exibir uma imagem pessoal com dedicatória na House. A moldura pode ser posicionada e ajustada na sala.'
          : 'Objeto de decoração da House: pode ser colocado na sala e ajustado em posição, tamanho, camada e orientação.';
    return response(
      item.name,
      `${item.description}\n\n${use}\nNão concede bônus de combate ou efeito mágico automático.`,
      'Conteúdo do projeto',
      '',
      '',
      true,
    );
  }
  const {
    rows: [item],
  } = await pool.query(
    "SELECT id,name,description,source,source_url,category,raw_data FROM catalog_items WHERE id=$1 AND (active=true OR raw_data->>'configuration_origin' IS NOT NULL)",
    [id],
  );
  if (!item) throw new AppError(404, 'Item não encontrado.');
  if (item.raw_data?.shop_magic_completion === true) {
    const summary = item.raw_data.rules_summary;
    if (typeof summary !== 'string' || !summary.trim())
      throw new AppError(503, 'A explicação deste item está temporariamente indisponível.');
    return response(
      item.name,
      summary,
      `${item.raw_data.source_book} · resumo original do projeto`,
      item.source_url,
      item.source_url,
      false,
      item.raw_data.source_edition,
    );
  }
  if (item.source !== 'SRD 5.2.1') {
    const animal =
      item.raw_data?.equipment_target === 'mount' || item.raw_data?.equipment_target === 'pet';
    const cosmetic = item.category === 'Cosméticos' || item.raw_data?.cosmetic;
    const use = animal
      ? 'Equipamento próprio para o companheiro indicado; pode ser equipado nos slots compatíveis com sua anatomia. Vestir permite solicitar a arte do animal com o equipamento selecionado.'
      : cosmetic
        ? 'Personaliza a aparência do personagem no aplicativo.'
        : '';
    return response(
      item.name,
      [
        item.description,
        use,
        'Este item é conteúdo do projeto. Não concede bônus de combate ou efeito mágico automático.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      'Conteúdo do projeto',
      '',
      '',
      true,
    );
  }
  const data = await readDataset();
  const mapping = data.items[id];
  if (!mapping || mapping.keys.some((key) => !data.records[key]))
    throw new AppError(503, 'A explicação desta variante está temporariamente indisponível.');
  const description = mapping.keys
    .map((key) => {
      const record = data.records[key];
      return [
        record.name.startsWith('Maestria:') ? record.name : '',
        record.portuguese,
        mapping.stats_overrides?.[key] ?? record.stats,
      ]
        .filter(Boolean)
        .join('\n\n');
    })
    .concat(mapping.variant)
    .filter(Boolean)
    .join('\n\n');
  if (!description)
    throw new AppError(503, 'A explicação deste item está temporariamente indisponível.');
  return response(
    item.name,
    description,
    'SRD 5.2.1 · Wizards of the Coast · CC BY 4.0 (tradução do projeto)',
    'https://www.dndbeyond.com/srd',
    mapping.reference_url || data.records[mapping.reference_key].reference_url,
    false,
    data.edition,
  );
}

export function shopItemRulesRouter() {
  const router = Router();
  router.get('/catalog/:id/rules', async (req, res) => {
    const id = z
      .string()
      .min(1)
      .max(150)
      .regex(/^[a-z0-9][a-z0-9-]*$/)
      .parse(req.params.id);
    res.json(await getShopItemRules(id));
  });
  return router;
}
