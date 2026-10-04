import { z } from 'zod';
import { classes, races, statNames } from './rules.js';
import { MISSION_THRESHOLDS, RANKS, RANK_REWARD_CP, rankName } from './progression.js';

export const RULEBOOK_MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
export const RULEBOOK_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const RULEBOOK_MAX_IMAGE_EDGE = 8192;
export const RULEBOOK_MAX_IMAGE_PIXELS = 32_000_000;
export const RULEBOOK_MAX_IMAGES_PER_EDITOR = 500;

const id = z
  .string()
  .regex(
    /^[A-Za-z0-9_-]{1,100}$/,
    'Use um identificador de até 100 letras, números, traços ou sublinhados.',
  );
export const rulebookImageSourceSchema = z
  .string()
  .trim()
  .max(2048)
  .refine((src) => {
    if (
      /^\/api\/rulebook\/images\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        src,
      )
    )
      return true;
    if (/^\/rules\/[A-Za-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(src)) return true;
    try {
      const url = new URL(src);
      return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password;
    } catch {
      return false;
    }
  }, 'Use uma imagem HTTPS, uma arte local de /rules/ ou um upload deste livro.')
  .transform((src) => (/^\/api\/rulebook\/images\//i.test(src) ? src.toLowerCase() : src));

export const ruleBlockSchema = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('text'), text: z.string().max(20_000) }).strict(),
  z
    .object({
      id,
      type: z.literal('callout'),
      title: z.string().trim().max(160),
      text: z.string().max(20_000),
      tone: z.enum(['note', 'warning']),
    })
    .strict(),
  z
    .object({
      id,
      type: z.literal('list'),
      items: z.array(z.string().max(3000)).max(100),
      ordered: z.boolean(),
    })
    .strict(),
  z
    .object({
      id,
      type: z.literal('table'),
      columns: z.array(z.string().trim().max(160)).min(1).max(20),
      rows: z.array(z.array(z.string().max(2000)).min(1).max(20)).max(120),
    })
    .strict()
    .refine(
      (table) => table.rows.every((row) => row.length === table.columns.length),
      'Todas as linhas devem ter o mesmo número de células dos títulos.',
    ),
  z
    .object({
      id,
      type: z.literal('image'),
      src: rulebookImageSourceSchema,
      caption: z.string().max(1200),
    })
    .strict(),
]);
export const ruleArticleSchema = z
  .object({
    id,
    title: z.string().trim().min(1).max(160),
    summary: z.string().max(1600),
    tag: z.string().trim().max(80),
    blocks: z.array(ruleBlockSchema).max(80),
  })
  .strict();
export const RULEBOOK_SYMBOLS = [
  'codex',
  'dice',
  'crest',
  'coins',
  'compass',
  'oath',
  'swords',
  'quill',
  'arcana',
] as const;
export type RulebookSymbol = (typeof RULEBOOK_SYMBOLS)[number];
export const ruleChapterSchema = z
  .object({
    id,
    title: z.string().trim().min(1).max(160),
    description: z.string().max(1200),
    symbol: z.enum(RULEBOOK_SYMBOLS).optional(),
    articles: z.array(ruleArticleSchema).max(80),
  })
  .strict();
export const rulebookDocumentSchema = z
  .object({
    version: z.literal(1),
    title: z.string().trim().min(1).max(160),
    subtitle: z.string().max(1200),
    introduction: z.string().max(20_000),
    cover_image: rulebookImageSourceSchema.nullable(),
    chapters: z.array(ruleChapterSchema).max(80),
  })
  .strict()
  .superRefine((document, context) => {
    const seen = new Set<string>();
    for (const chapter of document.chapters) {
      for (const item of [
        chapter,
        ...chapter.articles,
        ...chapter.articles.flatMap((article) => article.blocks),
      ]) {
        if (seen.has(item.id))
          context.addIssue({
            code: 'custom',
            message: `Identificador repetido no livro: ${item.id}.`,
          });
        seen.add(item.id);
      }
    }
    if (new TextEncoder().encode(JSON.stringify(document)).byteLength > RULEBOOK_MAX_DOCUMENT_BYTES)
      context.addIssue({ code: 'custom', message: 'O livro deve ocupar no máximo 2 MB.' });
  });
export type RuleBlock = z.infer<typeof ruleBlockSchema>;
export type RuleArticle = z.infer<typeof ruleArticleSchema>;
export type RuleChapter = z.infer<typeof ruleChapterSchema>;
export type RulebookDocument = z.infer<typeof rulebookDocumentSchema>;
export type RulebookResponse = { document: RulebookDocument; revision: number; can_edit: boolean };
export type RulebookImage = {
  id: string;
  src: string;
  name: string;
  width: number;
  height: number;
};
export const rulebookImageUrl = (imageId: string) => `/api/rulebook/images/${imageId}`;
export function rulebookImageSources(document: RulebookDocument): string[] {
  return [
    document.cover_image,
    ...document.chapters.flatMap((chapter) =>
      chapter.articles.flatMap((article) =>
        article.blocks.flatMap((block) => (block.type === 'image' ? [block.src] : [])),
      ),
    ),
  ].filter((src): src is string => src !== null);
}

// These entries describe the implemented rules, not new mechanics. Existing
// world_entries are preserved separately, and this seed is inserted only once.
export const INITIAL_RULEBOOK: RulebookDocument = {
  version: 1,
  title: 'Livro de regras da Alvorada',
  subtitle: 'A base da mesa, os acordos da guilda e o caminho de cada aventureiro.',
  introduction:
    'Este livro reúne as regras em uso na Alvorada Cinzenta. A base da ficha segue o SRD 5.2.1, das regras revisadas de 2024; patentes e progresso por missões são regras próprias da guilda. Cada capítulo distingue o que o portal já registra do que continua sendo resolvido durante a sessão.',
  cover_image: '/rules/rulebook-desk.webp',
  chapters: [
    {
      id: 'base',
      title: 'A base da nossa mesa',
      description: 'Sistema, criação do personagem e opções disponíveis na ficha.',
      articles: [
        {
          id: 'base-sistema',
          title: 'O sistema da mesa',
          summary: 'D&D revisado de 2024, com a seleção aberta do SRD 5.2.1.',
          tag: 'Fundamentos',
          blocks: [
            {
              id: 'base-sistema-texto',
              type: 'text',
              text: 'A ficha usa a base SRD 5.2.1. O SRD é uma seleção de regras abertas e não reúne todos os livros e suplementos de D&D. O portal oferece a criação inicial de nível 1; os efeitos das escolhas são resolvidos durante a sessão quando não aparecem diretamente na ficha.',
            },
            {
              id: 'base-sistema-limite',
              type: 'callout',
              title: 'Cobertura atual',
              tone: 'warning',
              text: 'Recursos completos das classes em níveis superiores, seleção de subclasses, magias superiores e multiclasse continuam pendentes. Combate, efeitos, condições e descansos são resolvidos na sessão.',
            },
          ],
        },
        {
          id: 'base-personagem',
          title: 'Criar um aventureiro',
          summary: 'Até dois personagens por conta, com escolhas de origem e ficha inicial.',
          tag: 'Personagem',
          blocks: [
            {
              id: 'base-personagem-texto',
              type: 'text',
              text: 'Cada conta pode manter até dois personagens. A criação reúne espécie, classe, antecedente, atributos e as escolhas da ficha inicial. A ficha registra recursos, perícias, salvaguardas, equipamento inicial, talentos de origem, maestrias e conjuração de nível 1 conforme as opções disponíveis.',
            },
            {
              id: 'base-personagem-especies',
              type: 'list',
              ordered: false,
              items: races.map((name) => `Espécie disponível: ${name}.`),
            },
            {
              id: 'base-personagem-classes',
              type: 'list',
              ordered: false,
              items: classes.map((name) => `Classe disponível: ${name}.`),
            },
          ],
        },
      ],
    },
    {
      id: 'atributos',
      title: 'Atributos e ficha',
      description: 'Rolagem, distribuição e leitura dos valores do personagem.',
      articles: [
        {
          id: 'atributos-rolagem',
          title: 'Uma rolagem para a ficha',
          summary: 'Seis valores obtidos por 4d6, descartando o menor dado.',
          tag: 'Criação',
          blocks: [
            {
              id: 'atributos-rolagem-passos',
              type: 'list',
              ordered: true,
              items: [
                'A ficha rola 4d6 e descarta o menor dado para obter cada valor.',
                'Os valores são rolados uma única vez e distribuídos entre os seis atributos.',
                'Os bônus de atributo vêm do antecedente escolhido.',
                'A ficha finalizada conserva suas escolhas ao ser reaberta.',
              ],
            },
            { id: 'atributos-rolagem-nomes', type: 'list', ordered: false, items: statNames },
          ],
        },
        {
          id: 'atributos-modificadores',
          title: 'Modificadores de atributo',
          summary: 'O modificador é calculado a partir do valor final.',
          tag: 'Consulta',
          blocks: [
            {
              id: 'atributos-modificadores-texto',
              type: 'text',
              text: 'O modificador é a metade da diferença entre o atributo e 10, arredondada para baixo: (atributo − 10) ÷ 2. A ficha usa os valores finais para seus cálculos; a resolução de testes e ações acontece na mesa.',
            },
            {
              id: 'atributos-modificadores-tabela',
              type: 'table',
              columns: ['Valor do atributo', 'Modificador'],
              rows: [
                ['8–9', '−1'],
                ['10–11', '0'],
                ['12–13', '+1'],
                ['14–15', '+2'],
                ['16–17', '+3'],
                ['18–19', '+4'],
                ['20', '+5'],
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'evolucao',
      title: 'Patentes e evolução',
      description: 'Missões válidas, limites de progresso e testes de promoção.',
      articles: [
        {
          id: 'evolucao-caminho',
          title: 'O caminho das cinco patentes',
          summary: 'O nível registrado segue o total de missões válidas da guilda.',
          tag: 'Regra da guilda',
          blocks: [
            {
              id: 'evolucao-caminho-texto',
              type: 'text',
              text: 'A progressão é própria da Alvorada Cinzenta e não utiliza a tabela de XP do SRD. As patentes são Ferro, Bronze, Adamantium, Ametista e Obsidiana. Novas conclusões não concedem XP; o XP legado permanece no histórico.',
            },
            {
              id: 'evolucao-caminho-tabela',
              type: 'table',
              columns: ['Nível', 'Patente', 'Total de missões válidas'],
              rows: MISSION_THRESHOLDS.map((missions, index) => [
                String(index + 1),
                rankName(index + 1),
                String(missions),
              ]),
            },
          ],
        },
        {
          id: 'evolucao-testes',
          title: 'Quando o teste é liberado',
          summary: 'Atingir o nível de limite ainda não basta para a promoção.',
          tag: 'Testes',
          blocks: [
            {
              id: 'evolucao-testes-tabela',
              type: 'table',
              columns: ['Teste', 'Nível necessário', 'Missões necessárias'],
              rows: [
                ['Ferro → Bronze', '4', '22'],
                ['Bronze → Adamantium', '8', '53'],
                ['Adamantium → Ametista', '12', '80'],
                ['Ametista → Obsidiana', '16', '102'],
              ],
            },
            {
              id: 'evolucao-testes-exemplo',
              type: 'callout',
              title: 'Exemplo: nível 4',
              tone: 'note',
              text: '14 missões deixam o personagem no nível 4. Ele continua contando missões normais até 22; só então libera o teste para Bronze. O teste promove ao nível 5 com as mesmas 22 missões, sem aumentar o contador.',
            },
            {
              id: 'evolucao-testes-limite',
              type: 'text',
              text: 'Ao atingir os requisitos do teste, missões normais dão apenas o ouro previsto, sem acumular progresso para depois. Testes pertencem à patente de origem. No nível 20, o contador de progresso fica limitado a 114; não existe teste posterior. O histórico real de participações concluídas é preservado separadamente.',
            },
            {
              id: 'evolucao-testes-ficha',
              type: 'callout',
              title: 'Nível registrado e recursos da classe',
              tone: 'warning',
              text: 'A ficha já acompanha nível, patente e bônus de proficiência. A evolução completa de PV, habilidades, talentos, subclasses e magias dos níveis superiores ainda não está disponível no portal; esses recursos precisam ser conferidos durante a sessão.',
            },
          ],
        },
      ],
    },
    {
      id: 'economia',
      title: 'Ouro, mochila e equipamento',
      description: 'Riqueza inicial, compras e organização dos bens do personagem.',
      articles: [
        {
          id: 'economia-moedas',
          title: 'Moedas e riqueza inicial',
          summary: 'O ouro inicial é entregue uma vez ao concluir a ficha.',
          tag: 'Economia',
          blocks: [
            {
              id: 'economia-moedas-texto',
              type: 'text',
              text: '1 PO equivale a 10 PP ou 100 PC. Novos personagens recebem a riqueza das escolhas de equipamento da classe e do antecedente ao concluir a ficha, uma única vez. Conversões de fichas preservam o saldo e as compras existentes. Valores monetários são registrados em peças de cobre inteiras.',
            },
            {
              id: 'economia-moedas-tabela',
              type: 'table',
              columns: ['Moeda', 'Equivalência em cobre'],
              rows: [
                ['1 PC', '1 PC'],
                ['1 PP', '10 PC'],
                ['1 PO', '100 PC'],
              ],
            },
          ],
        },
        {
          id: 'economia-bens',
          title: 'Compras e uso dos bens',
          summary: 'O catálogo e o inventário guardam os bens reais de cada personagem.',
          tag: 'Equipamento',
          blocks: [
            {
              id: 'economia-bens-lista',
              type: 'list',
              ordered: false,
              items: [
                'A compra confere o preço e o saldo; pagamento e entrega ficam registrados juntos.',
                'Itens de equipamento inicial são registros da ficha. Compras da loja ficam no inventário.',
                'A mochila permite equipar itens nas posições disponíveis e transferir bens entre mochila e cofre.',
                'A armadura de placas entrega seis componentes pelo preço do conjunto; as demais armaduras entregam o peitoral.',
                'Montaria, pelagem e acessórios comprados no estábulo ficam vinculados ao personagem.',
              ],
            },
            {
              id: 'economia-bens-limite',
              type: 'callout',
              title: 'Descrição não é efeito automático',
              tone: 'warning',
              text: 'Efeitos mágicos descritos no catálogo não são automação de combate. Vender, consumir e resolver efeitos dos itens continuam fora da cobertura atual do portal.',
            },
          ],
        },
      ],
    },
    {
      id: 'missoes',
      title: 'Do mural à aventura',
      description: 'Inscrição, agendamento, conclusão e recompensas.',
      articles: [
        {
          id: 'missoes-inscricao',
          title: 'Agenda e inscrição',
          summary: 'Missões têm data, hora e uma patente exata.',
          tag: 'Mural',
          blocks: [
            {
              id: 'missoes-inscricao-lista',
              type: 'list',
              ordered: true,
              items: [
                'A missão é publicada no mural com data, hora e patente.',
                'Personagens da mesma patente podem se inscrever enquanto ela está aberta. Patentes inferiores e superiores não podem participar dessa missão.',
                'Missões nas próximas 24 horas aparecem no Início; o criador recebe o aviso para mestrar.',
                'Só o autor inicia e conclui sua missão. Os requisitos dos participantes são conferidos novamente na conclusão.',
              ],
            },
          ],
        },
        {
          id: 'missoes-recompensas',
          title: 'Ouro por participante',
          summary: 'O pagamento é fixado pela patente da missão.',
          tag: 'Recompensas',
          blocks: [
            {
              id: 'missoes-recompensas-tabela',
              type: 'table',
              columns: ['Patente da missão', 'PO por participante'],
              rows: RANKS.map((rank) => [rank, String(RANK_REWARD_CP[rank] / 100)]),
            },
            {
              id: 'missoes-recompensas-texto',
              type: 'text',
              text: 'Na conclusão, o autor registra o resumo. Ouro e progresso são concedidos uma única vez a cada participante inscrito. Um teste paga o valor da patente de origem. Missões concluídas permanecem no histórico, junto aos valores e pagamentos daquela aventura.',
            },
          ],
        },
        {
          id: 'missoes-eventos',
          title: 'Eventos e ganchos',
          summary: 'O mesmo mural reúne os registros da vida da guilda.',
          tag: 'Histórico',
          blocks: [
            {
              id: 'missoes-eventos-texto',
              type: 'text',
              text: 'Só a staff publica eventos. Ganchos podem nascer da conclusão de uma missão e são consultados como continuidade da história; não possuem um fluxo de missão paralelo. Mundo e visão do reino usam os mesmos registros do mural.',
            },
          ],
        },
      ],
    },
    {
      id: 'convivencia',
      title: 'A vida na guilda',
      description: 'Uma guilda compartilhada, com histórias e registros de cada aventureiro.',
      articles: [
        {
          id: 'convivencia-guilda',
          title: 'Uma guilda, muitas jornadas',
          summary: 'A Alvorada Cinzenta reúne os aventureiros no mesmo espaço.',
          tag: 'Guilda',
          blocks: [
            {
              id: 'convivencia-guilda-texto',
              type: 'text',
              text: 'A Alvorada Cinzenta reúne uma única guilda compartilhada. Quem publica uma missão é responsável por mestrá-la e encerrar seu registro. Personagens, saldos, equipamentos e escolhas particulares pertencem à conta que os criou.',
            },
            {
              id: 'convivencia-guilda-juramento',
              type: 'callout',
              title: 'O juramento da Alvorada',
              tone: 'note',
              text: '“Honre a palavra. Partilhe o abrigo. Deixe uma marca para quem vier depois.” Estes votos pertencem à lore da guilda e acompanham as histórias registradas pelos aventureiros.',
            },
          ],
        },
        {
          id: 'convivencia-registros',
          title: 'Preservar a história',
          summary: 'O mural e a biblioteca guardam o que a guilda viveu.',
          tag: 'Registros',
          blocks: [
            {
              id: 'convivencia-registros-texto',
              type: 'text',
              text: 'Crônicas publicadas ficam na biblioteca de lore. Autores podem editar suas histórias, e a staff e a gestão autorizada ajudam a organizar os registros de cada área. Mural, biblioteca e livro de regras servem de referência para acompanhar as aventuras e os acordos da guilda.',
            },
          ],
        },
      ],
    },
  ],
};
