import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { transaction } from './db.js';

export async function seed() {
  const catalog = JSON.parse(await readFile(resolve('data/catalog.json'), 'utf8'));
  await transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(74261924)');
    for (const item of catalog.items) {
      await client.query(
        `INSERT INTO catalog_items(id,name,original_name,category,description,price_cp,weight_lb,source,source_url,raw_data)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,description=excluded.description,price_cp=excluded.price_cp,weight_lb=excluded.weight_lb,
        source=excluded.source,source_url=excluded.source_url,raw_data=excluded.raw_data`,
        [
          item.id,
          item.name,
          item.original_name,
          item.category,
          item.description,
          item.price_cp,
          item.weight_lb,
          item.source,
          item.source_url,
          item.raw_data,
        ],
      );
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
        'D&D 5e · SRD 5.1 (2014)',
        'A referência inicial é a quinta edição de 2014. A ficha do protótipo começa no nível 1 e usa a matriz 15, 14, 13, 12, 10, 8. Distribua esses valores ao criar o personagem. Bônus raciais, proficiências, magias, antecedentes mecânicos e progressão ainda serão implementados. A ficha é uma base simplificada, não um validador completo de D&D.',
        'Regras',
      ],
      [
        'economia',
        'rules',
        'Ouro, mochila e boas escolhas',
        'Regras de teste da guilda',
        'Cada personagem começa com 150 peças de ouro, uma regra de teste desta guilda. 1 PO = 10 PP = 100 PC. O catálogo usa preços do 5etools/SRD. Comprar desconta o saldo e entrega o item imediatamente. Equipar, vender, consumir itens e aplicar seus efeitos ainda não estão disponíveis.',
        'Economia',
      ],
      [
        'aventuras',
        'rules',
        'Do mural à aventura',
        'Um registro, toda a história',
        'Missões são agendadas com data e hora e aceitam inscrições enquanto abertas. Nas próximas 24 horas aparecem no Início, com aviso para o criador mestrar. Só o criador inicia ou conclui a missão; na conclusão registra o resumo, concede XP por participante e pode criar um gancho. Ganchos são apenas consultados. Só a staff publica eventos. Ouro anunciado não é pago automaticamente; o XP não altera o nível automaticamente. Missões concluídas permanecem no histórico.',
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
      [
        'mira',
        'mercenaries',
        'Mira Passo-de-Cedro',
        'Elfa · Patrulheira · Nível 3',
        'Uma batedora experiente nas trilhas dos Domínios da Alvorada. Conhece as rotas de caravanas e os sinais deixados pelos animais da névoa. Personagem de demonstração; contratação e regras de companheiros serão implementadas depois.',
        'Batedora',
      ],
      [
        'borin',
        'mercenaries',
        'Borin Escudo-de-Bronze',
        'Anão · Guerreiro · Nível 4',
        'Veterano da guarda de Vigília. Valoriza contratos claros e companheiros que não fogem ao primeiro rugido. Personagem de demonstração; contratação e regras de companheiros serão implementadas depois.',
        'Defensor',
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
        7500,
        'passo-da-geada',
      ],
      [
        '22222222-2222-4222-8222-222222222222',
        'mission',
        'A caravana do desfiladeiro',
        'Suprimentos para o inverno não chegaram a Vigília. Siga os marcos de pedra pela Estrada do Ferro, encontre a caravana e descubra o que assustou os cavalos. O mercador Tomas aguarda no portão sul.',
        'Estrada do Ferro',
        'Tranquila',
        5000,
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
