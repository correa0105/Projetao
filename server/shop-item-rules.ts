import { Router } from 'express';
import { z } from 'zod';
import { houseCatalog } from '../shared/house.js';
import { pool } from './db.js';
import { AppError } from './services.js';
import { catalogItemMechanics } from './catalog-item-mechanics.js';

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
  const mechanics = await catalogItemMechanics(item);
  if (mechanics)
    return { ...mechanics, title: item.name, descriptionPortuguese: mechanics.description };
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
        item.category === 'Armas' ||
        (Array.isArray(item.raw_data?.equipment_slots) &&
          item.raw_data.equipment_slots.includes('main_hand'))
          ? 'Conteúdo do projeto. Os efeitos seguem os valores e condições descritos acima.'
          : 'Este item é conteúdo do projeto. Não concede bônus de combate ou efeito mágico automático.',
      ]
        .filter(Boolean)
        .join('\n\n'),
      'Conteúdo do projeto',
      '',
      '',
      true,
    );
  }
  throw new AppError(503, 'A explicação desta variante está temporariamente indisponível.');
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
