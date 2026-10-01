import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { transaction } from './db.js';
import { PLATE_PIECES } from '../shared/armor-bundles.js';

export async function seed() {
  const catalog = JSON.parse(await readFile(resolve('data/shop-export/loja.json'), 'utf8'));
  const equipmentCatalog = JSON.parse(
    await readFile(resolve('data/equipment-catalog.json'), 'utf8'),
  );
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(74261924)');
    await client.query('UPDATE catalog_items SET active=false WHERE NOT(id=ANY($1::text[]))', [
      [...catalog.items, ...equipmentCatalog].map((item: { id: string }) => item.id),
    ]);
    for (const item of catalog.items) {
      await client.query(
        `INSERT INTO catalog_items(id,name,original_name,category,description,price_cp,weight_lb,source,source_url,raw_data,image_path,merchant_comment,weight_estimated)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,original_name=excluded.original_name,description=excluded.description,price_cp=excluded.price_cp,weight_lb=excluded.weight_lb,
        source=excluded.source,source_url=excluded.source_url,raw_data=excluded.raw_data,
        category=excluded.category,active=true,image_path=excluded.image_path,
        merchant_comment=excluded.merchant_comment,weight_estimated=excluded.weight_estimated`,
        [
          item.id,
          item.name,
          item.original_name,
          item.category,
          item.id === 'plate-armor'
            ? item.description +
              ' Conjunto completo: entrega peitoral, capacete, braçadeiras com luvas, calça, botas e ombreiras.'
            : item.description,
          item.price_cp,
          item.id === 'plate-armor' ? 27 : item.weight_lb,
          item.source,
          item.source_url,
          {
            ...(item.raw_data || {}),
            weight_estimated: item.weight_estimated,
            display: item.display,
          },
          `/shop/items/${item.id}.png`,
          item.merchant_comment,
          item.weight_estimated,
        ],
      );
    }
    for (const item of equipmentCatalog) {
      await client.query(
        `INSERT INTO catalog_items(id,name,original_name,category,description,price_cp,weight_lb,source,source_url,raw_data,active,image_path,merchant_comment,weight_estimated)
        VALUES($1,$2,$2,$3,$4,$5,$6,'Conteúdo do projeto','', $7,$8,$9,$10,true)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name,category=excluded.category,description=excluded.description,price_cp=excluded.price_cp,weight_lb=excluded.weight_lb,active=excluded.active,image_path=excluded.image_path,merchant_comment=excluded.merchant_comment,weight_estimated=true`,
        [
          item.id,
          item.name,
          item.category,
          item.description,
          item.price_cp,
          item.weight_lb,
          { equipment_extension: true },
          item.active,
          item.image_path,
          item.active
            ? 'Um detalhe bem escolhido também conta uma história. Não possui efeitos mágicos.'
            : 'Peça incluída no conjunto completo de placas.',
        ],
      );
    }
    // Migration 038 captured only pre-update suits. Applying each snapshot once avoids
    // duplicating pieces on subsequent seeds or on purchases through the new checkout.
    const { rows: backfills } = await client.query(
      'SELECT * FROM armor_piece_backfills WHERE applied_at IS NULL ORDER BY id FOR UPDATE',
    );
    for (const row of backfills) {
      for (const itemId of PLATE_PIECES) {
        if (row.character_id)
          await client.query(
            'INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,$3) ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=inventory.quantity+excluded.quantity',
            [row.character_id, itemId, row.quantity],
          );
        else
          await client.query(
            'INSERT INTO account_vault(user_id,item_id,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=account_vault.quantity+excluded.quantity',
            [row.user_id, itemId, row.quantity],
          );
      }
      await client.query('UPDATE armor_piece_backfills SET applied_at=now() WHERE id=$1', [row.id]);
    }
    const entries = [
      [
        'dominios-da-alvorada',
        'world',
        'Os Domínios da Alvorada',
        'Além dos últimos mapas, começa a nossa história.',
        'Cumes de gelo, fortalezas de pedra e caminhos riscados pelo vento. Entre a Cordilheira de Ferro e o Mar Pálido, a Alvorada Cinzenta protege os viajantes que ousam cruzar esta fronteira. Aqui, uma promessa vale mais que uma coroa.',
        'Fronteira',
      ],
      [
        'vigilia',
        'world',
        'Vigília',
        'Uma cidade de pedra. Mil histórias por contar.',
        'Erguida sob as muralhas do Bastião da Alvorada, Vigília é o último porto seguro antes dos passos gelados. Ferreiros, cartógrafos e viajantes dividem suas ruas. É aqui que a guilda Alvorada Cinzenta reúne seus aventureiros.',
        'Cidade',
      ],
      [
        'bosque',
        'world',
        'Pinhal dos Ecos',
        'Há nomes que as árvores ainda se lembram.',
        'Ruínas cobertas por raízes, trilhas que mudam de lugar e um observatório abandonado. Guias recomendam marcar o caminho e evitar atravessar o bosque depois do crepúsculo.',
        'Exploração',
      ],
      [
        'fundacao',
        'lore',
        'A primeira alvorada',
        'Crônicas da Alvorada · Capítulo I',
        'Quando a nevasca apagou todas as trilhas, sete viajantes gravaram uma rosa dos ventos na pedra. Ao redor dela fizeram um juramento: nenhum companheiro ficaria para trás. Dessa promessa nasceu a Alvorada Cinzenta. O brasão ainda aponta para o mesmo destino: seguir juntos.',
        'Lore original',
      ],
      [
        'pacto',
        'lore',
        'O juramento da alvorada',
        'Crônicas da Alvorada · Capítulo II',
        'Honre a palavra. Partilhe o abrigo. Deixe uma marca para quem vier depois. Estes votos estão talhados nos portões do Bastião. Não importa de onde um aventureiro vem; ao cruzar esses portões, ele passa a fazer parte da Alvorada Cinzenta.',
        'Lore original',
      ],
      [
        'base',
        'rules',
        'A base da nossa mesa',
        'D&D 5.5e · SRD 5.2.1 (2024)',
        'Base SRD 5.2.1 (regras revisadas de 2024). A criação de nível 1 inclui espécies, linhagens, antecedentes, talentos de origem, maestrias, magias e equipamento inicial. Atributos por 4d6, descartando o menor, com rolagem única no servidor. Os bônus vêm do antecedente. Subclasses começam no nível 3; níveis e patentes evoluem por missões, mas recursos completos de classe nos níveis superiores e combate automático ainda não estão implementados.',
        'Regras',
      ],
      [
        'economia',
        'rules',
        'Ouro, mochila e boas escolhas',
        'Regras de teste da guilda',
        'Novos personagens recebem o ouro da combinação de equipamento de classe e antecedente ao concluir a ficha, uma única vez. 1 PO = 10 PP = 100 PC. Conversões de fichas preservam o saldo existente. Itens iniciais são registros da ficha; compras ficam no inventário. Equipar, vender, consumir e resolver efeitos permanecem na mesa.',
        'Economia',
      ],
      [
        'aventuras',
        'rules',
        'Do mural à aventura',
        'Um registro, toda a história',
        'Missões são agendadas com data e hora e aceitam inscrições enquanto abertas. Nas próximas 24 horas aparecem no Início, com aviso para o criador mestrar. Só o criador inicia ou conclui a missão; na conclusão registra o resumo, credita o ouro por inscrito, calcula a progressão e pode criar um gancho. Ganchos são apenas consultados. Só a staff publica eventos. Patentes: Ferro, Bronze, Adamantium, Ametista e Obsidiana. Testes liberados com nível 4/22 missões, 8/53, 12/80 e 16/102. Nesses limites missões normais dão apenas ouro; o teste promove sem aumentar a contagem. Missões concluídas permanecem no histórico.',
        'Aventuras',
      ],
      [
        'bastiao',
        'house',
        'Bastião da Alvorada',
        'Pedra contra o inverno. Abrigo para os nossos.',
        'Acima de Vigília, o Bastião da Alvorada guarda a sede da guilda Alvorada Cinzenta. Estandartes de azul profundo e cobre marcam suas torres. Entre a sala dos mapas e a grande lareira, aventureiros planejam a próxima expedição. Casas particulares, baús compartilhados e melhorias serão implementados em uma próxima etapa.',
        'Sede da guilda',
      ],
    ];
    for (const entry of entries)
      await client.query(
        'INSERT INTO world_entries(id,section,title,subtitle,body,tag) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',
        entry,
      );
    const posts = [
      [
        '11111111-1111-4111-8111-111111111111',
        'mission',
        'Ecos no Passo da Geada',
        'O sino da torre de vigia silenciou. A cartógrafa Elara procura aventureiros para subir o passo, investigar o observatório e encontrar a expedição desaparecida. Uma primeira jornada para um grupo de nível 1.',
        'Passo da Geada',
        'Moderada',
        15000,
        'passo-da-geada',
      ],
      [
        '22222222-2222-4222-8222-222222222222',
        'mission',
        'A caravana do desfiladeiro',
        'Suprimentos para o inverno não chegaram a Vigília. Siga os marcos de pedra pela Estrada do Ferro, encontre a caravana e descubra o que assustou os cavalos. O mercador Tomas aguarda no portão sul.',
        'Estrada do Ferro',
        'Tranquila',
        15000,
        'estrada-do-ferro',
      ],
      [
        '33333333-3333-4333-8333-333333333333',
        'event',
        'Vigília do primeiro inverno',
        'O Bastião abre seus portões para celebrar os viajantes que retornaram. Traga uma história para a grande lareira e grave sua marca na mesa da guilda. Evento narrativo de demonstração, sem data agendada.',
        'Bastião da Alvorada',
        'Tranquila',
        0,
        'vigilia',
      ],
    ];
    for (const post of posts)
      await client.query(
        `INSERT INTO board_posts(id,kind,title,description,location,difficulty,reward_cp,region_id,location_id)
         SELECT $1,$2,$3,$4,$5,$6,$7,region_id,id FROM world_locations WHERE id=$8
         ON CONFLICT(id) DO NOTHING`,
        post,
      );
  });
  console.log('Catálogo e cenário inicial disponíveis.');
}
