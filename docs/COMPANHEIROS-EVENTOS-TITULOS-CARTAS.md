# Companheiros, eventos, títulos e cartas — 04/10/2026

## Decisões do usuário

A administração de conteúdo compartilhado usa exclusivamente `"user".administrador=1`.
Jogadores continuam comprando e gerenciando bens de seus próprios personagens.
Não ampliar privilégios privados por ser administrador. As compras continuam
transacionais, idempotentes, com preços inteiros em cobre resolvidos no servidor.

Cartas: três equipadas por personagem; algumas compráveis com ouro. O usuário
definirá as regras de aprimoramento depois. Drops e outras formas de obtenção
serão implementados posteriormente no servidor. Não inventar custos de upgrade,
recompensas, bônus automáticos ou uma economia paralela.

## Casa dos mascotes

`#pets` abre o Empório de Garalho. Cenário pintado de uma casa de pedra coberta
de vegetação; Baguncinha é o esqueleto humanoide sentado do lado de fora, tomando
café. Garalho conserva os olhos dourados separados/assimétricos da referência,
capa vermelha e equipamento mecânico. Suas falas sonoras/textuais são miados.
Ele responde às três perguntas pela placa de madeira: escreve por 2,5 segundos,
vira a placa e mostra a resposta, sem balão de fala. Cada espécie tem descrição
e comentário próprios. O animal selecionado aparece no cenário.

| Mascote | Preço (PO) |
| --- | ---: |
| Cão | 10 |
| Gato | 15 |
| Coelho | 5 |
| Coruja | 30 |
| Raposa | 40 |
| Corvo | 20 |
| Sapo | 2 |
| Cobra | 12 |
| Rato | 3 |
| Porquinho-da-índia | 6 |

As sete imagens adicionais do usuário originaram opções de aparência: pastor,
gato ruivo de pelo longo, coelho branco com marcas, coruja com olhos laranja,
corvo negro, cobra oliva e rato branco/cinza peludo. A opção não muda o preço.
A compra registra espécie, aparência e nome no PostgreSQL; o inventário mostra
o mascote adquirido. Sem limite artificial de mascotes por personagem.

Migrations 048–049 e rotas `GET /api/pets/:characterId`, `POST /api/pets/purchase`.
O servidor valida a combinação espécie/aparência, bloqueia o personagem com
`FOR UPDATE`, verifica saldo e reaproveita a compra na mesma chave idempotente.
`character_pets` conserva preço e chave para auditoria.

`PetSounds.ts` toca uma voz curta distinta quando a arte aparece, após estar
carregada e haver áudio disponível no navegador. Latidos, miado, pios, coaxar,
chiado e pequenos ruídos são sintetizados localmente; coelho usa passos/folhagem.
Seguem Efeitos sonoros, volume e silêncio. Trocar de animal, ocultar a aba e
sair da página encerram o áudio. Animações respeitam movimento reduzido.

## Salão dos eventos

`#events` possui fundo integral pintado, luz noturna, partículas/névoa discretas,
evento em destaque, próximos encontros, filtros e contagem para a data marcada.
Administradores criam, editam e excluem eventos e alteram o cenário inteiro.

**Editar cenário** permite trocar/enviar o background, ajustar enquadramento e
escurecimento, título/subtítulo, ambientação e camadas de artes transparentes.
Cada camada tem posição, largura, opacidade, ordem e animação: parada, flutuar,
balançar, respirar, brilhar ou deslizar. A prévia acompanha o rascunho. A arte
de cada evento também tem animação configurável. Textos aceitam formatação
simples segura; links aceitam páginas internas ou HTTP/HTTPS.

Migration 050 mantém eventos em **`board_posts`**, sem segunda tabela de eventos.
Apresentação JSONB e revisão ficam no mesmo registro. `event_scene` guarda
documento/revisão do cenário; `event_images` guarda uploads no SQL. PNG, JPEG,
WebP e AVIF são normalizados em WebP com alpha preservado, máximo 12 MB/40 MP
na entrada e 3200 px na saída. Imagem não publicada só é visível ao administrador;
leitores acessam apenas imagens referenciadas no cenário/eventos atuais.

Rotas `/api/events`, `/api/events/:id`, `/api/events-scene` e `/api/event-images`.
Escritas verificam administrador no servidor; revisões impedem sobrescrever
edição concorrente. A rota antiga do mural também exige administrador para
alterar eventos. Evento não concede ouro ou progresso de missão automaticamente.

## Prateleiras e títulos

Migration 051 remove posições fixas e o limite de seis objetos por prateleira.
`slots`, `positions` e `rows` são listas alinhadas de tamanho variável. Configurações
antigas são preservadas e recebem a prateleira correspondente. São três níveis
da estante, com posição horizontal independente, sobreposição permitida e
arraste entre níveis; quatro setas também ajustam a peça selecionada.
Escolher a prateleira e **Exibir na estante** adiciona uma conquista desbloqueada;
**Mover para esta prateleira** muda a já exposta. Salvamento continua por personagem.
O candelabro do fundo foi alinhado ao centro visual da estante.

`#titles` e a seção integrada às conquistas mostram títulos, metas e escolha
do título em exibição. A identificação aparece no acampamento e na ficha.
Administradores têm **Administrar títulos** para criar, editar, excluir e
conceder/revogar a outros personagens por busca de personagem/jogador.

Migration 052: `title_catalog` com documento/revisão/exclusão lógica,
`character_titles` com origem automática/manual, concessor e revogação,
`character_title_log` para auditoria e `characters.displayed_title_id`.
Metas disponíveis: conquista específica, nível, missões concluídas, ouro gasto
no empório ou concessão manual. Progresso vem do SQL, nunca do cliente.
Títulos já conquistados persistem quando a meta muda; revogação explícita
impede reconcessão automática até o administrador conceder de novo.
Exclusão do catálogo oculta o título e conserva seu histórico.

## Salão da meia-noite

`#cards` tem salão noturno com janela grande iluminada pela lua e o Anfitrião
sentado em cadeira luxuosa, com parte do rosto na sombra. Há três perguntas,
comentários próprios para cada carta, oito artes, filtros e três espaços de
equipagem. Cartas compráveis: A Vigília 50 PO, O Corvo 75 PO, O Espelho Partido
100 PO e A Lua Errante 150 PO. As quatro restantes aguardam formas futuras de obtenção.

Migration 053: `character_cards` registra carta, nível inicial 1, preço, chave
de compra e espaço opcional. Cada personagem tem uma cópia por carta, no máximo
três equipadas e uma carta por espaço. Rotas `GET /api/cards/:characterId`,
`POST /api/cards/purchase` e `PUT /api/cards/:characterId/equipment`.
Compra bloqueia o personagem e desconta ouro uma única vez. Equipagem só aceita
cartas próprias e exatamente três posições, com `null` nos espaços livres.
Nenhum endpoint de aprimoramento ou drop é exposto nesta etapa.

Migration 054 define o ciclo de exclusão das novas referências: exclusão física
de um personagem remove seus registros privados; exclusão lógica normal
preserva histórico. Remover uma conta administrativa zera referências de ator,
sem apagar títulos/cenário compartilhados. Testes usam bancos descartáveis.

## Ficha e panorama da Lore

A ficha mantém layout, escolhas e salvamento, com papel escuro e tinta clara.
História e Equipamento são abas independentes; notas ficam na História.
O banner da Lore agora mostra um panorama amplo do mundo, com mar, reinos,
florestas, caminhos e montanhas. Não modifica a geografia do mapa navegável.
Artes, referências, grids e prompts estão em `docs/COMPANIONS-ART.md`.

## Verificação

`scripts/test-community-isolated.mjs` valida economia, idempotência concorrente,
ownership, aparência, três cartas, títulos/metas/distribuição/revogação,
permissões, upload e revisão dos eventos e sete troféus na mesma prateleira.
`--browser` verifica compra real, inventário, escrita/virada da placa, cartas,
editor de cenário, título exibido, prateleiras e celular/movimento reduzido.
Testes isolados de administradores, eras/montarias, ficha, estante, Lore,
Regras, Início e estábulo/Gina verificam os fluxos relacionados.

A suíte geral tem duas falhas preexistentes em `tests/world-fleet.test.ts`
(órbita lateral e olho/onda circular), externas a esta entrega. Não apresentar
esta suíte como integralmente aprovada. Os testes novos de comunidade e
administração passam; o build valida TypeScript e gera cliente/servidor.

Verificação final dos sons: os dez mascotes criaram vozes/fontes em Web Audio
real no Edge; silenciar encerrou o áudio e impediu sons na próxima aparição.
Ficha validada com tema escuro e abas independentes, e estante com arraste,
persistência, restrições de ownership e celular. Build Docker concluído,
migrations 045–054 aplicadas ao banco local após backup, healthcheck saudável
e bundles novos confirmados. limawelsn@gmail.com recebeu administrador=1
explicitamente pelo CLI, sem criar conta nem incluir promoção automática.
