# Mesa virtual, perfis, amigos e Hall da Fama — 05/10/2026

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
  com paleta e cor própria, retângulo, círculo, cone, linha, texto, sinalizador local,
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

Migrations **058_vtt.sql**, **059_social_hall.sql** e **060_vtt_resources.sql**.
A última adiciona vínculos de importação, recursos, auditoria de uso e mensagens
de magia; não remove registros de personagens/conquistas/compras. Convites usam crypto.randomBytes no
servidor, sem depender de extensão PostgreSQL adicional. Imagens só aceitas como
arquivos locais da mesa/perfil, com ownership e validação de conteúdo.

`node scripts/test-vtt-social-isolated.mjs` cria um banco `alvorada_test_UUID`,
executa migrations/seed e testes de API/geometria, e remove apenas esse banco.
`--browser` testa duas contas, amizade/chat, perfil/companheiros, quatro quadros,
cartas/ficha de consulta, Hall, VTT e responsividade. Não rodar esses testes no
banco de jogadores. Capturas e PNG exportado ficam em test-results (ignorado).
