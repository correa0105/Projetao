# Administradores, eras e montarias — 04/10/2026

`045_user_administrator.sql` adiciona administrador smallint NOT NULL DEFAULT 0,
com CHECK 0/1. `server/administrators.ts` consulta essa coluna em cada operação.
Não há campo de autorização confiado ao cliente nem concessão automática por
e-mail, seed, cadastro ou tabelas antigas. `scripts/admin.ts email 0|1` atualiza
somente uma conta existente. O CLI legado staff mantém a coluna sincronizada:
admin=1, staff/remove=0. A concessão solicitada para limawelsn@gmail.com é uma
operação explícita no banco local, não uma promoção embutida no código.

Concessão local concluída após migrations/build: CLI confirmou administrador=1
para limawelsn@gmail.com. Aplicação saudável no localhost:3000 e backup SQL
pré-migração preservado em .local/backups. Mascotes, eventos, títulos, cartas e
ficha escura estão documentados em COMPANHEIROS-EVENTOS-TITULOS-CARTAS.md.

As rotas e controles de edição de Lore, Regras e Início exigem administrador=1.
Crônicas em rascunho e imagens privadas continuam indisponíveis ao jogador.
Administrador pode editar conteúdo de outros autores. Editor do reino e eventos
também usam a coluna. Ownership de personagem/inventário/montaria/missão continua
obrigatório, incluindo para administradores. Mudar a coluna revoga acesso na mesma sessão.

`046_lore_timeline.sql` armazena um documento compartilhado com revisão e autor da
alteração. PUT /api/lore-timeline exige administrador; rejeita conflito de revisão,
pastas inexistentes/excluídas, duplicação de IDs e uma pasta vinculada a duas eras.
O documento inicial tem seis eras; só Alvorada Cinzenta está revelada. Períodos são
rótulos editáveis e a ordem da lista define a cronologia. GET omite título/descrição
das eras não reveladas aos leitores. Excluir toda a lista não é permitido: resta
ao menos uma era, cujo título pode ficar vazio. Título geral também é opcional.

`LoreTimeline.tsx` percorre os marcadores da era atual até a escolhida, rola a linha
horizontal no celular e finaliza com um breve efeito. A animação atual usa uma
barra contínua de luz que se estende até cada era, sem bolinha indo e voltando.
Chegada toca `audio/lore-era-lock.wav`, som original de engrenagens desacelerando
até um tranco mecânico, gerado por scripts/generate-lore-era-sound.mjs. Volume e
silêncio seguem Efeitos sonoros. Nomes das pastas ganharam tipografia Cinzel,
contraste e contagem em detalhe de cobre. Na mesma era, não percorre
marcadores. Movimento reduzido usa só chegada discreta. Vínculo da pasta mais
próxima prevalece sobre o de um ancestral. Abrir um marcador vinculado navega à
primeira pasta correspondente; o registro abaixo lista todos os vínculos ativos.
Pastas excluídas somem das opções/links, preservando as crônicas e restauração atuais.

`047_display_mount.sql` marca uma montaria exibida por personagem com índice único
parcial. Backfill escolhe a compra mais recente; a primeira compra nova é marcada
automaticamente. Compras seguintes/replays preservam a escolha. PUT
/api/stable/:characterId/display aceita UUID de uma montaria própria ou null para
ocultar; bloqueia o personagem com FOR UPDATE para serializar com compra/escolha.
Nunca transfere ouro, itens ou propriedade. O inventário oferece escolha/ocultação.
`CampMount` acompanha o personagem selecionado, mantém pelagem/equipamento comprado,
posiciona o animal à esquerda com os pés acima dos personagens e aplica a iluminação
escura do acampamento. Respostas atrasadas de personagem anterior são descartadas.

Acabamento visual: Lore sem espaçador de 20px e título repetido no PageHeader;
banner mantém o título da seção. Pergaminho fechado vetorial mais longo/estreito,
camadas de papel, textura, fita, lacre gravado e rolos detalhados. Tentáculo mantém
3D e animação existentes, com textura em carvão de contraste contido, luz neutra
mais suave, reflexos discretos, ventosas orgânicas também no braço distante e
contato com o lago/névoa. Sem trocar retrato aprovado, áudio ou coreografia.

Validação: scripts/test-admin-isolated.mjs testa PostgreSQL/Better Auth reais,
revogação, ausência de auto promoção, edição, revisão, imagens e ownership.
scripts/test-experience-isolated.mjs verifica eras/pastas, finalização na mesma era,
montaria por personagem/inventário e interface de jogador em desktop/celular.
Smoke tests existentes de Lore, Regras, Início e Gina verificam seus fluxos.
Todos os testes usam bancos descartáveis, sem tocar nos dados locais do usuário.
