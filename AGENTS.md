# Alvorada Cinzenta — instruções para continuidade

Antes de editar, leia `docs/CONTEXTO.md` e `README.md`. Estes arquivos são a memória
portável do projeto. Atualize o contexto quando houver mudanças relevantes no escopo,
nas regras, na arquitetura ou no estado de implementação.

## Acordos de desenvolvimento

- Comunicação e interface em português brasileiro.
- Nome definitivo: Alvorada Cinzenta. Banco/usuário `alvorada_cinzenta`, Compose e package `alvorada-cinzenta`.
- Identidade apenas tipográfica (sem brasão/logo), azul de noite, pergaminho e cobre envelhecido.
  Tema exclusivamente escuro; não reintroduzir modo claro ou seletor de tema. Ícones principais do menu ilustrados em atlas PNG, próximos da prancha de referência do usuário: contorno forte, pergaminho/cobre e volume discreto. Vela em Início, capacete viking em Personagem, espada larga diagonal, bolsa, mapa e livro. Atlas ativo guild-icons-candle-helmet.png, renderizado via SVG com filtro alfa que remove o fundo azul; não exibir como background CSS nem usar máscara circular que corte as pontas. O botão Menu se transforma no painel por expansão, sem traços laterais; arte ocupa 72% do círculo e o hover transforma botão e imagem juntos. Até 600 px, usar grade 3 × 2 para os seis botões.
  O usuário rejeitou verde vivo na interface; aprovou verde-musgo escuro e dessaturado na arte das ilhas. Consultar `docs/IDENTIDADE.md` antes de mudar o tema.
- Projeto web local com Node.js/TypeScript, React, PostgreSQL e Docker Compose.
- Não converter para site estático, localStorage, SQLite ou hospedagem gerenciada sem
  uma decisão explícita sobre a arquitetura. Os dados de jogo vivem no PostgreSQL.
- Não inventar funcionalidades prontas: distinguir conteúdo narrativo de regras implementadas.
- Toda consulta privada deve filtrar pelo usuário autenticado no servidor.
- Nunca confiar em user_id, saldo, preço, nível, recompensa efetivamente paga ou
  atributos fora das regras enviados pelo navegador.
- Compras: manter transação, `SELECT ... FOR UPDATE`, idempotência e registro de auditoria.
  Valores monetários são inteiros em peças de cobre; nunca floats no banco.
- Missões, eventos e ganchos compartilham `board_posts`. Não criar uma tabela de missões paralela.
- Mundo e visão do reino usam o mesmo formulário, endpoint e registros do mural. Geografia em `world_regions`/`world_locations`; o servidor resolve `location_id`, deriva a região e valida disponibilidade. Reino do Norte é o único território explorável nesta etapa. Preservar os locais livres do mural e os seis locais regionais, incluindo Floresta Negra (migration 010). `npm run test:atlas` valida o fluxo geográfico.
- Mundo possui 22 territórios desde a migration 009, com fronteiras terrestres e destaque/clique na superfície. Não retornar aos três destinos apenas. Preservar o oceano único, as margens marítimas ampliadas, ilhotas, Fulkushima e Olho da Tormenta. Novos destinos ficam indisponíveis para exploração interna até implementação explícita. Consultar `docs/ATLAS-TERRITORIES.md`.
- **Mundo deve ser um mapa de relevo real e navegável, ocupando o fundo sem moldura**. O usuário aprovou a modelagem atual: preservar a silhueta fornecida em `docs/references/world-silhouette.png`, a geografia trabalhada em `public/atlas-world-v2.png` e as cordilheiras; não voltar a continentes ovais ou ao PNG plano. A visão inicial e Centralizar usam 100%: câmera recalibrada para preservar o antigo enquadramento de 142%, mantendo composição 8% mais baixa. Zoom máximo equivalente em cerca de 246%. `src/WorldMap.tsx`/`src/world-map.css` usam Three.js/WebGL, pan/zoom e marcadores acompanhando a geometria. Arraste com resistência progressiva nas bordas e retorno suave para dentro. Acabamento com pedra cinza neutra, musgo escuro, detalhe de duas texturas CC0, planícies levemente onduladas e nuvens mais densas/rápidas. A visão próxima do reino, suas regras e painéis permanecem independentes. Usar Mundo, visão do reino e Voltar ao mundo na interface. Para validar animações com GPU real, usar `ATLAS_BROWSER_GPU=1` em `npm run test:atlas -- --world-map-only`; SwiftShader forçado pode não atingir a taxa de frames necessária.
- A **visão do reino** está na **etapa de aprovação do terreno e da atmosfera**. `public/kingdom/terrain-hires.png` mede 5760 × 5760 px, mosaico 6 × 6 baseado no master V4 aprovado e em 36 pinturas regionais, via `scripts/stitch-kingdom-master-6x6.ts`. Preservar a geografia, os caminhos, as duas pontes, a costa arenosa, as clareiras de construção e a ausência de árvores pintadas no chão; usar os sprites de árvores desta etapa e não voltar às pinturas únicas ou ao antigo 4 × 4. Nuvens procedurais branco/cinza adaptadas de `src/world-clouds.ts` são visíveis e rápidas; elas e a névoa móvel usam a transformação do próprio mapa, acompanhando arraste, giro e zoom. A névoa exterior é branco/cinza opaco; um único campo procedural de distância às bordas cobre a linha da imagem e logo se torna translúcido sobre o terreno, variando com ruído contínuo e móvel, sem círculos nem faixa PNG repetida e com avanço projetado máximo de 96 px CSS. A antiga máscara opaca e o asset `cloud-bank.png` continuam fora da cena. O reino mede 15000 × 15000 unidades; o enquadramento próximo em 100% usa 85% da escala visual da revisão anterior, preserva a navegação e alcança as quatro bordas reais; 130% é o zoom máximo. A câmera começa no centro e se move nas quatro direções. **A cena comum renderiza os grupos de pinheiros e carvalhos; construções, rochas separadas, totens, barcos, marcadores e alvos de locais canônicos continuam ocultos nesta etapa. Os itens do rascunho particular do editor aparecem somente ao próprio autor.**; `src/KingdomMap.tsx` marca `data-stage=terrain`. O editor permite que cada usuário salve um rascunho privado de objetos na migration 011; não publicar automaticamente. Depois que o usuário concluir o arranjo, incorporá-lo à cena comum. As estruturas e seus atlas permanecem preservados em `public/kingdom/structures/` para a próxima etapa. Os seis locais SQL e todas as missões persistem; a opção Missões do reino e o mural continuam funcionais, mas selecionar um local diretamente no mapa volta somente quando seus objetos forem reintroduzidos. O Mundo 3D não foi alterado. Validar com `ATLAS_BROWSER_GPU=1` em `npm run test:atlas -- --terrain-only` e `--world-map-only`, além de `npm test` quando regras ou dados mudarem; o smoke completo do atlas com cliques em cidades fica suspenso deliberadamente nesta etapa. Especificação em `docs/KINGDOM-2D.md`. Não apagar `public/atlas-materials`: Mundo ainda usa essas texturas.
- Missões novas exigem data/hora; próximas 24 horas aparecem no Início. Somente o autor conclui via `/complete`, com resumo e XP por inscrito. `mission_rewards` registra créditos; concluir, creditar XP e criar gancho opcional devem ser uma única transação, sem repetição de créditos. Não permitir criar ganchos pelo endpoint genérico. Eventos exigem `guild_staff` (staff/admin), conferido no servidor. Nenhuma promoção automática de usuário.
- Autenticação via Better Auth. Não implementar hashes ou sessões próprios.
- Migrations SQL numeradas em `db/migrations/`: não alterar migrations aplicadas;
  crie novas. Seeds idempotentes não devem apagar dados de jogadores.
- Catálogo inicial: apenas whitelist de equipamentos SRD 5.1/2014, obtidos do 5etools.
  Manter snapshot, commit de origem e atribuição. Não importar suplementos indiscriminadamente.
- Não registrar senhas, tokens, cookies ou `.env` em logs/commits.
- Não apagar volumes Docker. Não executar testes em um banco de produção.
- Arquivos e comandos devem funcionar também fora desta máquina. Evitar caminhos absolutos no código.
- `npm run build` valida TypeScript e gera cliente + servidor. `npm test` usa PostgreSQL real.
  Para autenticação, economia, ownership ou ciclo de missão, execute esses testes.
- `npm run test:browser` valida o fluxo real pela interface em `http://localhost:3000`.
  O padrão é Microsoft Edge instalado; `BROWSER_CHANNEL` pode selecionar outro canal Playwright.
- Desenvolvimento com `npm run dev` requer parar o serviço Docker `app`, mantendo `db`.
- A aplicação tem uma única guilda compartilhada. O criador mestra sua missão; staff/admin pode publicar eventos. Campanhas e painel administrativo ainda são próximas etapas.

Não são necessários subagentes para alterações rotineiras; nenhum fluxo de delegação é obrigatório.






