# Mesa virtual, perfis, amigos e Hall da Fama — 05/10/2026

## Participação, combate, efeitos e física (05/10/2026)

Entrada oferece Jogador ou Espectador. Jogador importa automaticamente seus
personagens no mapa ativo, com vínculo/retrato e cópia de sessão; reencontros
não duplicam tokens nem restauram PV/recursos. Participação persiste por mesa
na migration 063. Espectador não importa ficha, não move tokens, não envia chat,
não rola dados e não usa ficha/barra de ações. A API bloqueia essas operações,
inclusive sob o lock transacional. Na névoa, escolhe um jogador com token visível
no mapa e recebe a mesma projeção de visão desse jogador, sem fichas, notas ou
arquivos ocultos. Sem névoa e sem visão escolhida, acompanha os tokens públicos.
Pode trocar participação no topo, inclusive em telas pequenas.

Ataques da ficha e dos atalhos de jogador/monstro ficam na barra compacta. O token
selecionado é amarelo; clicar no segundo marca o alvo vermelho. Shift seleciona
vários; Ctrl/Meta muda o atacante. Vantagem/desvantagem é escolhida na barra. Resultado
real do servidor é comparado à CA: igualdade acerta, 1 natural falha, 20 natural
acerta. Acerto oferece Rolar dano ou Descartar dano; crítico dobra dados sem dobrar modificador.
Componentes de dano são publicados no chat, e aplicação dos PV continua manual.
A opção Dano separado preserva rolagens avulsas e ações de salvaguarda.

Efeitos ocupa o lugar do antigo indicador de ferramenta no rodapé esquerdo.
Prévia aparece no token só para o mestre, sem escrever no documento; fecha ao
sair do menu. Duração Infinito mantém a animação até limpar. Chamas/brasas,
gelo com fraturas/neve, fumaça/bolhas de veneno, fitas/runas de cura e arcos elétricos
usam desenhos e movimentos distintos, em passes atrás e sobre o retrato. Token morto continua inteiro e vermelho
com sangue. O menu abre acima da barra de atalhos para permitir arraste.

Dados usam cannon-es com cascos convexos das próprias malhas, gravidade,
atrito, restituição, chão e bordas; resolvem colisões entre dados em passos
fixos de 1/120 s. Trajetória física é preparada em pequenos blocos e reproduzida
com interpolação, sem guiar cada dado a uma posição fixa. Faces são numeradas
antes da reprodução para manter o resultado aleatório recebido do servidor.
Impactos reais acionam o som. Movimento reduzido mostra o repouso. Seleção sem
arraste não salva tokens; prévia do jogador mantém o observador ao selecionar
outro token. Protocolo 2 bloqueia substituições do documento por clientes antigos.

Validação: PostgreSQL descartável, geometria/colisão/combate e fórmulas unitários,
navegador com jogadores e espectador, prévia sem persistência, arraste de efeitos,
dados WebGL e layouts 1440/768/390/320. Backup antes de deploy e preservação dos
dados originais obrigatórios.

## Ferramentas, atalhos, boss e morte

Navegação direita: Chat, Biblioteca de arte, Fichas, Biblioteca (monstros/magias),
Som, Diário e Configurações e ajuda. Ajuda/Mapa/Mesa compartilham a última aba;
token selecionado fica em Fichas e iniciativa em Chat → Combate. Camadas fica
na barra esquerda, com fundo/tokens/mestre/iluminação no mesmo botão.

Efeitos do mestre fica no canto inferior esquerdo. Nome/modelo são salvos em
vtt_rooms.document.effects (até 100), com chamas/gelo/veneno/cura/faíscas de cor,
tamanho e duração ajustáveis (0 permanente, até 60 s) e sangue/token vermelho
permanente. Arraste o efeito salvo ou Fixar para a barra; clique no atalho →
Aplicar no token selecionado. Efeito usa cópia visual sincronizada no token,
sem alterar PV/condições/recursos, e pode ser limpo pelo mestre. Biblioteca de
presets é privada; jogadores veem somente a aparência dos tokens visíveis.
Aplicação é transacional e exige dono da mesa + administrador no servidor.
Sem migração: campos legados recebem arrays vazios ao ler o documento.

Ataques de monstros aparecem na ficha do token, com Fixar/arraste. Referência
do atalho usa token/ação desta mesa; uso consulta os dados atuais no servidor.
Acerto e cada componente de dano explícito são rolados separadamente, incluindo
ataques SRD e JSON 5etools. Ações com salvaguarda não inventam bônus de ataque.
Descrição pode ir ao chat. Não aplica dano/PV automaticamente. Jogadores não
podem salvar/consultar esses atalhos exclusivos do mestre; trancas continuam
valendo para efeitos e monstros. Remover a origem deixa atalho antigo removível.

Formas reúne retângulo, círculo, cone e linha diagonal. Névoa reúne revelação e
ocultação por retângulo, polígono ou pincel, reinício e volta à visão automática.
Polígonos terminam com Enter/duplo clique; Esc cancela. A ordem das áreas decide
o resultado em sobreposições e desfazer funciona. Ferramentas manuais desligam
a iluminação automática até selecionar Visão automática dos tokens. Revelar
todos e ocultar todos limpam também os polígonos antigos. Alcances de visão e
luz são em pés e convertem na grade em metros. Migration 061 preserva tokens,
barreiras e círculos legados ao ativar visão em mapas antigos afetados.

Lançador tem sete linhas D4/D6/D8/D10/D12/D20/D100 e quantidades rápidas 1–6;
entrada manual até 100 com modificador e opção privada. D100 mantém dois D10.
Dados percorrem a tela com física de colisão, atrito e repouso, mantendo o
resultado recebido do servidor. Som respeita o controle global de efeitos.

Barra de ações: dez espaços numerados, até vinte abas por jogador/mesa.
Arrastar Fixar da ficha para um espaço, ou clicar para usar o primeiro vazio.
Arraste entre espaços troca sua ordem. Aba trancada permite usar atalhos e
trocar abas, mas impede mover, renomear, remover ou adicionar. Destrancar é uma
operação separada também validada no servidor. Remover atalho preserva a ação
na ficha. Migration 062 guarda revisão e documento em vtt_hotbars por room/user,
sem localStorage. Servidor valida acesso à mesa, ownership, importação e origem.
Cada uso consulta a ficha atual: ataques rolam acerto/dano; magias publicam
descrição ou gastam espaço do nível antes de publicar; truques não gastam;
consumíveis debitam uma unidade com auditoria e idempotência. Não aplica efeitos
narrativos ou dano automático ao alvo. Se publicação falhar após gasto, o
recurso continua gasto e somente mestre pode corrigir pelo histórico da ficha.

Mestre seleciona token → Fichas → Token selecionado → Barra de boss. Escolher um dos cinco
estilos publica a barra para todos, inclusive quando o token está oculto;
apenas tokenId/nome/PV/máximo/estilo são públicos, sem posição/arte/notas/ficha.
Não mostrar barra remove-a. Red usa sangue, Ice usa gelo fraturado, Grass usa musgo,
Oak usa carvalho e Evil usa obsidiana incandescente. PV recuam sobre preto;
verde sinaliza cura por 1,4 s e volta ao material escolhido. Estilos antigos
continuam legíveis no banco, exibidos como Red, mas saíram do seletor. Texturas e
prompts em VTT-BOSS-ART.md. PV vêm do próprio token, incluindo gasto pela ficha.
Duplicação não duplica a designação de boss. Em Efeitos estão Aplicar morte,
Limpar morte e Automático ao zerar PV. Efeito de morte manual é visual;
automático dispara uma vez ao cruzar PV positivo → zero/negativo, não ao reabrir
a página. Token permanece inteiro, vermelho, com sangue ao redor. Removidos os
fragmentos do personagem por pedido posterior. Sangue se espalha brevemente,
respeita névoa/visão/movimento reduzido e permanece até limpar/restaurar PV.
Tokens e personagens nunca são excluídos pelo efeito. Restauração de
PV via ficha também limpa a marca. Não acrescenta regras de morte definitiva
ou testes contra a morte; o mestre decide o uso do efeito.

Mestre pode registrar quantidade de cura na ficha importada. Pelo botão direito,
a caixa vermelha de PV aceita valor absoluto ou `+N`/`-N`, limitado a zero/máximo.
São alterações de sessão e não recuperam consumíveis nem recursos originais.

Chat → Combate oferece selecionar todos, adicionar selecionados (Shift + clique)
ou todos à ordem. O carrossel aparece no topo central. Jogador rola somente por
seus personagens no painel ou carrossel; servidor usa d20 e bônus da ficha real.
Iniciativas ordenam do maior ao menor. Mestre pode editar valores, escolher
qualquer turno e avançar/recuar, inclusive antes de iniciar. Iniciar exige valores
de todos. Em combate, círculo mágico rotativo destaca o atual e amarelo discreto
o próximo. Estado em `vtt_rooms.combat` (065) não disputa revisão com os movimentos.
Espectadores apenas veem; névoa também filtra os participantes do carrossel.

Sinalizar ponto desenha uma seta dourada saltando três vezes. Sinal do mestre
centra todas as câmeras com transição curta, preservando zoom e visão (064).
Jogador sinaliza apenas localmente; arrastar o fundo ainda move a câmera, sem
botão de mão. Texto abre editor pequeno junto ao clique, Enter salva, Shift+Enter
quebra linha e Esc cancela. Desenhos nunca usam a camada de iluminação.
Barreiras ativam luz dinâmica; paredes e portas fechadas recortam luz real,
portas abertas/janelas deixam passar. Visão no escuro dos monstros não ilumina
a área do mestre atrás das paredes.

Biblioteca de arte inclui 330 tokens transparentes dos monstros locais, obtidos
do release 5etools-img v2.36.1; adicionar monstro já usa sua arte correspondente.
Token existente pode receber Usar arte do monstro. Manifest de origem/hash em
`data/vtt/monster-token-art.json`; importador idempotente em
`scripts/import-vtt-monster-art.mjs`. Não importa novas regras de suplementos.

Configurações e ajuda → Ajuda e o lançador explicam Rolagens personalizadas.
Parser no servidor suporta conservação/descarte, lançamentos adicionais,
relançamento, contagem, grupos, funções e dados de equilíbrio. Resultado e todos
os lançamentos reais são registrados; detalhes e limites em VTT-ROLAGENS.md.
Consultas rápidas de sinal/combate usam limite separado de 180/min por usuário
autenticado, para não consumir o limite por conexão das ações normais.

## Navegação e visitas

**Personagem → Hall da Fama / Perfis**. Perfis lista contas com avatares redondos,
busca por nome ou ID e paginação. **Visitar perfil**, ou clicar em um personagem
no Hall, abre `#profiles?user=ID&character=UUID`. O ID pertence à conta Better Auth;
não é o e-mail. Todos os visitantes precisam estar autenticados.

O perfil tem apresentação, avatar, cor, cenário e personagem inicial editáveis
pelo próprio dono. São preferências pessoais, não edição de conteúdo compartilhado.
Uploads válidos PNG/JPEG/WebP viram WebP e ficam no PostgreSQL; imagens não publicadas
são acessíveis somente ao autor. O primeiro retrato é o avatar padrão.

Ao escolher um personagem, a visita carrega seus dados públicos, a montaria e o
mascote sinalizados no inventário. Explorar/ocultar uma montaria durante a visita
não modifica a seleção persistida do dono. O menu à direita desliza entre
**Personagens, Conquistas, Hall da Fama, Ficha e Cartas**. Movimento reduzido respeitado.
Cada painel ocupa a largura completa da tela, mantendo a escala dos cenários. No
celular, a navegação vem antes do cenário, sem cobrir personagens ou molduras.
Ficha é consulta; não oferece gasto de ouro, edição de atributos, compra, upgrades,
alteração de inventário ou recursos da conta visitada. Não são retornados e-mail,
saldo, experiência privada, inventário ou históricos de compras.

Conquistas continua sendo a página original. Quatro molduras antigas distintas,
duas de cada lado da estante, selecionam o personagem e ganham borda dourada ao
passar o mouse/focar. Contas continuam limitadas a dois personagens: os demais
quadros ficam reservados. Não inventar personagens para preencher quadros. A mesma
composição aparece nas visitas. Catálogo, personalização e administração de títulos
da página original são preservados; visita usa somente a estante para leitura.
Os destaques priorizam conquistas colocadas na estante. Molduras menores estão na
parede, afastadas das vigas/teto. A rota de retrato recorta a região superior da arte
e procura centralizar o rosto, preservando o arquivo original.

## Amizades e chat

Pedidos de amizade têm remetente e destinatário; só quem recebe aceita. Remover
amizade impede novos envios. Chat individual fica em **Amigos e chat**, com histórico,
mensagens anteriores, contagem de não lidas e confirmação de leitura. Novos envios
exigem amizade aceita. Bloqueio remove amizade e impede pedidos/mensagens/avaliações
entre as duas contas; desbloqueio não restaura a amizade automaticamente. Histórico
permanece privado entre seus participantes. Administrador não recebe acesso a DMs.

Checagens e alterações de amizade/bloqueio/envio usam uma transação e trava consultiva
por par de contas, evitando um envio atravessar um bloqueio concorrente. Atualização
por polling: chat a cada três segundos, lista de amigos a cada quinze, só com aba visível.
Sem chamadas, notificações push, presença online ou transporte WebSocket nesta versão.

## Hall da Fama

Ranking geral e filtros por conquistas, prestígio, missões, avaliações e títulos.
Os três primeiros aparecem no pódio. Busca por personagem/jogador/classe, paginação,
visita ao perfil por clique e personagem destacado quando consultado pela visita.

Pontuação inicial: **100 por nível acima do primeiro + 30 por conquista + 5 por
missão creditada + 20 por título ativo + até 100 por avaliação**. Pesos, título e
apresentação são editáveis somente por administrador. São computados no servidor
a partir dos registros reais. Não acrescenta saldo, XP ou benefícios de jogo.

Avaliações: nota 1–5 e comentário, uma por conta/conta avaliada, editável/removível
pelo avaliador e sem autoavaliação. Hall usa média ponderada com cinco votos de
referência de nota 3,5: `(soma + 17,5)/(quantidade + 5)`, contribuindo
`round((média - 1)/4 × peso)`; sem votos, zero pontos. Perfil exibe a média simples
e total real, não só os últimos cem comentários. Títulos revogados/excluídos não
contam. Empates: nível, conquistas, nome e ID. Cada filtro mantém a coluna geral.

## Mesa virtual

**Mural → Mesa virtual**. Administrador cria e mestra sua própria mesa; jogador
entra pelo código privado, pode importar seu personagem e controlar os tokens
atribuídos a ele. Outro administrador também precisa ser dono para editar a mesa.
Revogar administrador remove os poderes de mestre imediatamente. Convites podem
ser renovados e participantes removidos pelo mestre. Código não é exposto aos jogadores.

Recursos implementados:

- Mapas novos vazios de 1750 × 1750 px com grade escura; biblioteca com miniaturas,
  busca, pastas e subpastas, arquivamento, duplicação e exclusão. Configuração em
  janela com dimensões em células/pixels, fundo/tabuleiro, cores, escala, grade,
  névoa, opacidade do mestre e música ao carregar; zoom, pan e tela cheia.
- Camadas de fundo, tokens, mestre e iluminação. Objetos do mestre aparecem com
  transparência ajustável. Menu de contexto do token permite trocar camada, ordem
  decimal (inclusive negativa), espelhar nos dois eixos e girar.
- Grade quadrada, hexagonal nas duas orientações ou sem grade; tamanho, escala,
  unidade, deslocamentos, cor, transparência, encaixe e quatro medidas de diagonais.
- Régua temporária com seta, removida ao soltar/cancelar o arraste; desenho livre
  com paleta e cor própria, retângulo, círculo, cone, linha, texto, sinalizador com câmera do mestre,
  seleção múltipla, giro/tamanho, bloqueio, ocultação, duplicação e desfazer/refazer.
  Seleção permite apagar desenhos/barreiras/fontes de luz da camada ativa.
- Tokens com retrato/arte editáveis, nome, PV/CA, condições, controle por jogador,
  ficha de sessão; visão, luz forte/fraca, cor e ângulo de luz.
- Fontes de luz independentes dos tokens, na camada de iluminação. Luz dinâmica
  por raios e interseção com paredes, portas abertas/fechadas e janelas transparentes
  à luz. Janela/porta sobre parede alinhada corta o trecho e cria conectores.
  Névoa automática completa acompanha visão e deslocamento do token; visão no
  escuro é acinzentada fora da luz real. Prévia de jogador e névoa manual também disponíveis.
  Movimento de jogador validado pelo servidor contra barreiras e limites do mapa.
- Biblioteca de imagens enviada à mesa, monstros, magias, handouts públicos/privados
  no diário, música enviada e compartilhada com silêncio/volume local.
- Chat da mesa, dados `NdM±K`, vantagem/desvantagem `2d20kh1/kl1`, rolagens privadas
  ao autor/mestre, histórico paginado, descrições completas de magias, macros,
  ordem de iniciativa, turnos e contador de rodadas. Seletor lateral de quantidade
  e modificador; dados 3D d4/d6/d8/d10/d12/d20 e d100 (dois d10), som de impacto e
  opção de desligar 3D. Resultado vem do servidor; WebGL indisponível usa resultado textual.
- Ficha importada abre janela escura **Essencial / Biografia / Magias**, com
  atributos, perícias, ataques, características, idiomas, PV, equipamento, inventário
  e recursos. PV, condições e texto de sessão não escrevem na ficha original.
- Usar consumíveis remove unidades do inventário real do personagem, com transação,
  idempotência e auditoria. Slots e dados de vida usados persistem por personagem.
  Jogador só gasta recursos; restaurar PV, slots, dados de vida ou consumo auditado
  exige mestre dono/administrador. Reimportar não restaura nem duplica o personagem.
- Exportar mapa em PNG (até 4096 px no maior lado); exportar/importar documento JSON
  da mesa. JSON referencia arquivos da própria biblioteca, não inclui seus binários.

Salvamento automático com revisão e conflito explícito. Atualização das outras
sessões a cada três segundos com aba visível. Dados, arquivos e chat no PostgreSQL,
sem substituir persistência por localStorage. Player recebe apenas cena ativa,
tokens visíveis, ficha própria e handouts públicos; notas do mestre e arquivos não
referenciados na visão pública são filtrados no servidor.

Esta entrega é uma mesa funcional integrada. Não é a implementação completa do Roll20:
sem voz/vídeo, WebSocket, efeitos de partículas, automação completa de combate/magias,
grades isométricas, pacotes binários de campanha ou iluminação 3D. Névoa manual usa
círculos de revelação; ocultar remove círculos que intersectam o pincel. Música tem
estado compartilhado, sem alinhamento preciso do instante de reprodução. O sinalizador
é local. Atributos/rolagens podem ser usados manualmente para todos os conteúdos.
Totais de slots têm nove círculos configuráveis pelo mestre; progressão automática
de todos os níveis/classes ainda depende das regras futuras do site. O modo de
visão é uma aproximação visual 2D; não automatiza todos os efeitos de combate.

## Compêndio e fontes

330 monstros e 339 magias do **SRD 5.2.1 (regras 2024 / D&D 5.5)**, em inglês,
normalizados pelo script `scripts/import-vtt-srd.mjs` a partir de registros
`srd52` do formato 5etools. Não inclui ilustrações nem conteúdo fechado de livros.
Importação de JSON do 5etools fornecido pelo mestre amplia seu compêndio da mesa;
referências `_copy` não resolvidas são ignoradas. Fontes/atribuição em
[data/vtt/CREDITS.md](../data/vtt/CREDITS.md),
[SRD oficial](https://www.dndbeyond.com/srd) e
[fonte do formato](https://github.com/5etools-mirror-3/5etools-src).
Cripta histórica é SVG original feito no código, não imagem extraída de livro;
mapas novos agora começam sem esse fundo.

## Arte das molduras

Quatro artes geradas com imagegen: oval de ouro envelhecido; retangular com cantos
recortados, nogueira e ouro; arco gótico de carvalho/brass; octogonal de jacarandá e
ouro. Prompt comum: moldura individual vista frontal, fantasia medieval realista
pintada, entalhes trabalhados e desgaste discreto, grande abertura central realmente
transparente, sem retrato, fundo, inscrição ou cenário. Variações mantêm os materiais
e formato acima; paleta combina com estante existente. Originais preservados na
biblioteca gerada da sessão (IDs exec-c8ea3635, exec-c4727fc0, exec-16bc5e7d,
exec-1b008a01). Derivados: `public/profiles/frame-0-v1.webp`…`frame-3-v1.webp`.

Altura 700 px, proporções originais 447/455/397/410 px de largura, sem esticar.
Máscaras PNG da abertura extraídas por preenchimento da área transparente central,
sem apagar arte. Retratos carregados pela rota pública com thumb e recortados na
abertura; sem renderizar a arte como CSS background da foto. Hover usa sombra dourada.

## Banco e verificação

Migrations **058–065**: mesa/comunidade/recursos, apresentações, atalhos,
participação, sinal de câmera e combate.
A última adiciona vínculos de importação, recursos, auditoria de uso e mensagens
de magia; não remove registros de personagens/conquistas/compras. Convites usam crypto.randomBytes no
servidor, sem depender de extensão PostgreSQL adicional. Imagens só aceitas como
arquivos locais da mesa/perfil, com ownership e validação de conteúdo.

`node scripts/test-vtt-social-isolated.mjs` cria um banco `alvorada_test_UUID`,
executa migrations/seed e testes de API/geometria, e remove apenas esse banco.
`--browser` testa duas contas, amizade/chat, perfil/companheiros, quatro quadros,
cartas/ficha de consulta, Hall, VTT e responsividade. Não rodar esses testes no
banco de jogadores. Capturas e PNG exportado ficam em test-results (ignorado).

Refino final: 23 testes de API/geometria e 13 de dados/física/fórmulas aprovados,
TypeScript/Vite/tsup e build Docker. Smoke com mestre, jogador e espectador em
1440/768/390/320 px: seleção vermelha/amarela, vantagem, dano/descarte, texto,
PV +/- e cura quantitativa, morte em Efeitos, materiais de boss, iniciativa nos
dois controles, início/avanço sincronizado, câmera para todos e ajuda em
Configurações. Também mantém amizade, perfis, Hall, trancas, recursos e privacidade.
Canvas real confirma retrato inteiro e sangue externo; os cinco efeitos alteram
pixels dentro do retrato e diferem entre si usando a mesma cor. Parede escurece
o ponto atrás dela; porta aberta/janela restaura a luz, inclusive no mestre com
monstro de visão no escuro. Manifest verifica 330 arquivos/hashes/dimensões,
todos com alfa, e cinco texturas de boss.
Capturas vtt-attack-inline.png, vtt-turn-carousel.png, vtt-settings-roll-help.png,
vtt-effects-refined.png e vtt-death-intact-portrait.png em test-results (ignorado).
