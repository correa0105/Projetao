# Torre do Véu — experimento de 05/10/2026

Versão anterior salva no GitHub **antes das edições**: commit `35d5f36`, branch
Welson. Tag `codex/checkpoint-antes-torre-2026-10-05` mantém esse ponto acessível.
Direção: sistema original de ascensão por ambientes/perigos, inspirado no conceito
de exploração de masmorras do pedido, com nomes e arte próprios da Alvorada.

## Uso

Mural → Torre. A ascensão apresenta seis regiões de cinco andares: Limiar
Esquecido, Cavernas Prismáticas, Jardins da Fome, Forjas do Crepúsculo, Inverno
Imóvel e Coroa Sem Aurora. Cada região tem criaturas, ambiente, desafio e níveis
sugeridos; guardiões nos andares 5/10/15/20/25/30. Criaturas usam os retratos locais
do catálogo já disponível. Sessões/encontros são conduzidos pelo mestre.

Em Expedições, administrador abre uma subida. Jogadores entram com personagens
próprios, até oito por grupo e apenas uma subida aberta/ativa por personagem.
Antes do início podem sair. Só mestre dono e administrador inicia, confirma
andares consecutivos, vitória do guardião e retorno. Pode encerrar sem recompensa.
Confirmação usa diálogo nativo com teclado/Escape/foco. Revogação administrativa
é consultada no servidor a cada operação.

Retorno a partir de um andar concluído entrega a recompensa base a cada membro.
Ouro em PO: `8 × andares concluídos + 35 × guardiões vencidos`.
Cristais: `2 × andares concluídos + 8 × guardiões vencidos`.
Exemplo: andar 5 com um guardião = **75 PO e 18 cristais** por personagem.

Em Tesouros, cada participante revela uma relíquia com seu próprio d100; o grau
é a quantidade de guardiões vencidos. Estes bônus somam à recompensa anterior:

| d100 | Raridade | PO adicionais | Cristais adicionais |
|---|---|---|---|
| 1–50 | Comum | 5 × (grau + 1) | 2 × (grau + 1) |
| 51–75 | Incomum | 15 × (grau + 1) | 5 × (grau + 1) |
| 76–90 | Raro | 35 × (grau + 1) | 12 × (grau + 1) |
| 91–98 | Épico | 70 × (grau + 1) | 24 × (grau + 1) |
| 99–100 | Lendário | 140 × (grau + 1) | 50 × (grau + 1) |

Ouro credita `characters.gold_cp`, sempre inteiro em cobre. Cristais são a moeda
da Torre; saldo e coleção persistem nesta página. Relíquias são colecionáveis sem
bônus de regras. A Torre não concede XP, crédito de missão/patente, equipamentos,
cartas ou upgrades. Loja/troca de cristais ainda não faz parte desta versão.
Tabelas são parâmetros iniciais do experimento em `shared/tower.ts`.

## Persistência e proteção

Migration **066**: tower_expeditions, tower_members, tower_wallets, tower_claims.
Sem exclusões/reescritas de registros anteriores. Não apagar tabelas/migrations
para voltar o código ao checkpoint: preservar inclusive recompensas já recebidas.

Servidor autentica, verifica origem, ownership, administrador e dono. Inscrição
tranca expedição/personagem; andamento tranca expedição e verifica revisão. Retorno
faz crédito/registro de todos os participantes em uma transação. Conclusão repetida
retorna sucesso sem novo crédito. Claims têm PK expedição/personagem. Tesouro
tranca personagem/claim, usa `crypto.randomInt(1,101)` e guarda o resultado antes
do commit. Tentativas repetidas retornam o mesmo dado/prêmio. Cliente não envia
quantias, progresso arbitrário, raridade nem resultado. GET mostra grupos da guilda,
mas apenas saldos/recompensas dos personagens do usuário autenticado.

## Interface e arte

Arte original produzida com a skill imagegen e ferramenta **integrada**, sem CLI.
Arquivo usado pelo site: `public/tower/tower-veil-v1.webp`, 1672 × 941, qualidade 87.
Original preservado na biblioteca gerada da sessão:
`exec-83c8951d-7fcd-4564-85fe-cfc438b8c1a6.png`.
Conversão WebP não modifica a composição. Não foram usados assets do anime citado.

Prompt final:

> Use case: stylized-concept. Asset type: original environmental hero illustration for a dark fantasy RPG website, landscape 16:9. Primary request: monumental dungeon tower for Alvorada Cinzenta, where adventurers climb progressively dangerous floors. Scene: an immense ancient charcoal-stone tower rises above ruined Vigilia in evening fog, its upper floors vanishing into a fractured pale sky. Subject: tower has stacked distinct environments hinted at through broken arches: lower moss-dark catacombs, dim blue crystal caverns, old overgrown galleries, smoldering copper furnaces, frost-covered upper terraces, and a shadow crown. Rich believable architecture, enormous scale, very small expedition silhouettes near its base. Style: premium painterly dark-fantasy environment concept art, meticulous stone, atmospheric depth, cinematic rather than cartoon/anime. Composition: tower occupies right two thirds, left third dark open mist and distant ruins for overlay title, bottom foreground subtle crystals and weathered stone. Muted charcoal, warm gray, aged copper, ivory highlights, restrained icy blue and amber light. No bright green. No UI, text, logos, frame, collage, panels, anime characters or recognizable copyrighted architecture. High quality coherent single scene.

Hero amplo, carvão/cobre, navegação vertical de regiões, andares e chefes separados,
tabela visível de tesouros, painel de grupo e coleção com revelação do dado.
Grid adapta a 768/390/320 px; tabela tem rolagem horizontal própria. Movimento
reduzido desliga animação de revelação e scroll suave. Cabeçalho mantém seleção de
personagem/conta sem repetir o título da Torre.

## Verificação

`node scripts/test-tower-isolated.mjs`: oito testes de catalogação, limites,
autorização, sequência/chefes, concorrência/idempotência, pagamentos, d100 e
privacidade. Banco UUID descartável, nunca o banco de jogadores.
`--browser`: mestre e jogador pela interface, cinco andares, primeiro guardião,
retorno, recompensa e d100 persistente, atlas/chefes, 1440/768/390/320 sem overflow.
Capturas `tower-atlas-*`, `tower-boss-desktop`, `tower-expedition-desktop` e
`tower-treasure-desktop` em test-results (ignorado).

Novo efeito do VTT abre editor exclusivo, topo e foco imediato. Teste do VTT
completo também passou. `node scripts/smoke-vtt-effects-editor.mjs` confere lista
de 80 presets, criação sem token, infinito, gravação e 1440/390/320 sem banco.

Suíte geral executada em banco isolado: **113/115**. Duas falhas anteriores do
kraken de Mundo (`world-fleet.test.ts`: amplitude orbital e expectativa de ausência
de cabeça). `world-fleet.ts`, dependências e testes iguais ao checkpoint 35d5f36;
nenhuma alteração nesses arquivos neste experimento. Não apresentar a suíte como
totalmente aprovada. TypeScript e build são conferidos antes da entrega.
Backup anterior: `.local/backups/before-tower-20261005.dump` (ignorado).
