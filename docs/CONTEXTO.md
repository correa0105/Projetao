# Memória do projeto — Alvorada Cinzenta

## Acervo privado/premium, tradução e dano (06/10/2026)

Mestre edita integralmente a cópia do monstro pela folha completa → Editar e salva
em Presets de monstros, privado por conta, sem alterar SRD. Importação em outra mesa
copia imagens privadas. Ações mantêm IDs e fórmulas próprios; tradução revisável
usa LibreTranslate/Argos local en/pt e conserva números/regras/atalhos. Tradutor
interno, digest fixo, modelos persistidos. Chat segue final e conserva leitura/histórico;
dano aplicado da rolagem real é auditado/idempotente por mensagem/token e pode ser
descartado antes da aplicação. Só PV da sessão. Migration 069; 23 regressões e cinco
testes novos aprovados, navegador em quatro larguras aprovado; tradução real verificada.
Premium concluído: 330 artes individuais (Aboleth a Zombie), cobrindo todos os
monstros do catálogo atual, uma criatura por imagem, vista ortográfica superior e
transparência real, Pinterest como referência. Manifest registra arquivos e hashes
exclusivos, pesquisas e prompts completos. Revisão visual das silhuetas/bordas e cinco
testes isolados aprovados para as 330 artes. Acesso atual exige administrador E
vtt_premium; pergunta sobre OU/E
enviada ao usuário, pendente. Administrador concede tag na configuração do VTT.
Participantes veem apenas arte já colocada em token visível, sem acesso ao catálogo.
Novos campos de ficha também são removidos da projeção pública. Guia em
VTT-ACERVO-PREMIUM.md. Pasta privada data/vtt/premium-art; não publicar em public.

## Torre experimental e editor de efeitos (05/10/2026)

Refino de 06/10: por pedido do usuário, o topo da Torre mantém arte/título e saldo,
sem slogan, botão “Preparar a ascensão” ou indicadores decorativos 30/06/d100.
As abas Expedições/Tesouros permanecem acessíveis. Direção posterior: **100 andares**,
arte v2 com torre fechada/laterais limpas, navegação compacta sem sidebar extensa.
Editar andar prepara nome/descrição pública, desafios, ambiente, armadilhas, criaturas
e guardião; encontros são vazios por padrão. Servidor esconde criaturas/armadilhas e
detalhes até conclusão pessoal ou pela guilda compartilhada. Administradores veem tudo.
Editar prêmios configura faixas/raridade/nome/ouro/cristais/item/quantidade por grau.
Itens abrem detalhes/imagem e creditam inventário uma vez, com peças de placas e
auditoria própria. Ouro/cristais base também podem ser substituídos por andar.
Migrations 067–068: limite 100, conteúdo editável, tabelas e snapshot de prêmios no
retorno, preservando conquistas anteriores após edições. Testes 11/11 e navegador
mestre/jogador em quatro larguras aprovados; prompt final em TORRE-EXPERIMENTAL.md.

Pedido explícito: salvar versão anterior no GitHub antes da Torre. Confirmado
origin/Welson=35d5f36 antes das edições; tag codex/checkpoint-antes-torre-2026-10-05
também enviada. Torre do Véu fica no submenu Mural, com arte original, 30 andares,
seis biomas, desafios e guardião a cada cinco. Exploração de andares, expedições
e tesouros em abas. Mestre administrador/dono inicia e confirma cada andar;
participantes entram com seus personagens, até oito, uma subida ativa por personagem.

Migration 066 cria quatro tabelas próprias, sem alterar registros anteriores.
Retorno confirmado paga ouro real/cristais uma vez por participante; d100 posterior
é sorteado no servidor e paga bônus/relíquia uma vez. Guardiões elevam tabela.
Locks/revisão/PK garantem idempotência sob concorrência; payloads estritos recusam
andar/saldo/dado arbitrários. Saldo de cristais e relíquias privados por ownership.
Não concede missões, XP, itens de equipamento ou cartas; relíquias são de coleção.
Encontros são conduzidos pelo mestre, sem simulação automática de combate.

Novo efeito agora substitui a lista pelo editor, volta ao topo e foca o nome;
antes o formulário era acrescentado abaixo da lista, fora da área visível.
Erro de gravação permanece visível no editor. Modelo inicial é Fogo; morte ainda
fica disponível no seletor e controles próprios. Presets existentes preservados.

8 testes de Torre/API e smoke mestre/jogador 1440/768/390/320 passaram; VTT completo
também passou. Suíte geral: 113/115, duas falhas anteriores em world-fleet.test.ts
(órbita/cabeça do kraken). world-fleet.ts e dependências/testes iguais ao checkpoint;
não mascarar nem alterar esta animação por causa da Torre. Detalhes e prompt em
TORRE-EXPERIMENTAL.md; backup local before-tower-20261005.dump.

## Fichas de monstros, arraste e contato do tentáculo (05/10/2026)

Monstros podem ser arrastados da lista da Biblioteca e da galeria de arte direto
para o mapa. Coordenadas consideram pan/zoom, grade quadrada/hexagonal e limites;
cria um token completo e mantém a lista aberta. Apenas mestre fora da prévia.
O payload carrega ID resolvido no catálogo/documento atual, sem objetos externos.

`VttMonsterSheet` organiza a lateral e oferece folha completa com atributos,
CA/PV, deslocamentos, sentidos, defesas e características à esquerda, ações à
direita. No celular as colunas empilham. Títulos/subtítulos e parágrafos separados;
Fixar arrasta ações para a barra existente e Usar ataque abre o controle compacto.
Parser compartilhado corrige tags que exibiam XPHB no lugar de condições/PV.
Catálogo conserva 330 monstros/339 magias, regras numéricas e créditos originais.
Texto legado permanece no catálogo para reconhecer fichas intactas e melhorar
somente sua exibição; PV/atributos/edições e IDs de atalhos vêm do token salvo.
Sem migration, reimportação automática ou reescrita de mesas.

Tentáculo distante prolonga a mesma curva abaixo da água. Corpo e ventosas usam
o mesmo recorte/umidade na linha do lago; a diagonal aberta da base não aparece
mais acima da superfície. Coreografia, posição, duração e áudio preservados.
Smoke visual registra 637 poses no PC/567 no celular, folga mínima 0,022,
zero colisões de ventosas e ausência de erros WebGL. Capturas antes/depois em
test-results (ignorado). Guia detalhado em STABLE-GINNA.md e VTT-PERFIS-HALL.md.
TypeScript, build Docker completo, 23 testes isolados de API e 16 de fórmulas/
física/compêndio passaram. Smoke completo do VTT valida arraste, ficha e atalhos;
smoke do estábulo confirma retorno, áudio, compras e seis viewports. Comparação
dos 330 registros confirma zero mudança numérica e nenhum ataque/dano divergente
do catálogo anterior. Backup local: before-monster-sheets-lake-20261005.dump.

## Animais nas visitas aos perfis (05/10/2026)

O seletor genérico de etiquetas `.public-camp-pet > span` também atingia o
container `.pet-art`, posicionando todo o SVG abaixo da caixa e cortando o animal.
Etiquetas agora excluem a arte. SVG preserva o aspecto do viewport aprovado;
largura vem da espécie/aparência, e montarias usam a escala do catálogo e altura
natural. Posicionamento, sombra e adaptação ao celular mantêm os animais no chão
e dentro do cenário. Sem mudança nos registros, seleção persistida ou permissões.
Smoke verifica contenção/proporções com cão/cavalo e sapo/pônei, além de imagens
1880/1440/768/390/320; TypeScript e build validados.

## Refino final da mesa e fórmulas (05/10/2026)

Ataques passam para barra compacta com atacante amarelo/alvo vermelho por clique,
vantagem/desvantagem, CA real e dano/descarte; sem modal. Sinalizador é seta que
salta três vezes e, pelo mestre, centra todas as câmeras preservando visão (064).
Botão de mão retirado; pan pelo fundo mantido. Texto salva na camada válida com
editor junto ao clique. Paredes/portas fechadas bloqueiam luz real sem visão no
escuro de todos os tokens iluminar o mestre. Efeitos têm passes sobre retratos.
Morte manual/automática fica em Efeitos. Boss oferece cinco materiais distintos,
com verde temporário na cura; estilos removidos mantidos legíveis no banco.
Mestre registra cura quantitativa e edita PV com botão direito (`20`, `+5`, `-5`).
330 artes locais de monstros com origem/hash e importador idempotente.

Chat → Combate adiciona todos/selecionados, carrossel central, rolagem própria
pela ficha real, ordenação decrescente e início depois de todos os valores.
Mestre controla giro/escolha/início/fim; círculo mágico no atual e amarelo fraco
no próximo. Combate em coluna própria (065), sem conflito com revisão do documento.
Espectador/névoa filtrados também no carrossel. Sinal/combate têm orçamento de
polling separado por usuário autenticado; ações preservam limite por conexão.

Rolagens personalizadas usa parser próprio sem eval, com conservação/descarte,
explosões simples/acumuladas/com desconto, relançamentos, sucesso/falha, repetição,
grupos, funções, dados calculados/equilíbrio e operações matemáticas. Até 100
dados iniciais/500 lançamentos/100 caracteres/10 níveis, crypto.randomInt no
servidor. Chat/lançador/macros usam mesmo engine; Ajuda explica termos próprios
e ordem. Sintaxe matemática interoperável conservada. Expansão de atributos,
templates e consultas específicas de plataforma externa não implementados.
Detalhes em VTT-PERFIS-HALL.md, VTT-ROLAGENS.md e VTT-BOSS-ART.md.

Validação final: 23 testes isolados de servidor, 13 de dados/física/fórmulas,
TypeScript/Vite/tsup, build Docker e smoke com três contas/layouts 1440/768/390/320.
Canvas comprova efeitos sobre o retrato, diferenças mesmo na mesma cor e bloqueio
de luz por parede, com passagem em porta aberta/janela. 330 hashes/alfas/dimensões
e cinco materiais verificados. Backup antes da atualização local em
`.local/backups/before-vtt-refino-20261005-final.dump`; não versionar banco/dados privados.

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

Ataques da ficha e dos atalhos de jogador/monstro ficam na barra compacta com alvo vermelho. Resultado
real do servidor é comparado à CA: igualdade acerta, 1 natural falha, 20 natural
acerta. Acerto oferece Rolar dano; crítico dobra dados sem dobrar modificador.
Componentes de dano são publicados no chat, e aplicação dos PV continua manual.
A opção Dano separado preserva rolagens avulsas e ações de salvaguarda.

Efeitos ocupa o lugar do antigo indicador de ferramenta no rodapé esquerdo.
Prévia aparece no token só para o mestre, sem escrever no documento; fecha ao
sair do menu. Duração Infinito mantém a animação até limpar. Chamas/brasas,
gelo fraturado/neve, fumaça/bolhas de veneno, fitas/runas de cura e arcos elétricos
usam desenhos e movimentos distintos. Token morto continua inteiro e vermelho
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

## Efeitos e navegação da mesa (05/10/2026)

Pedido posterior remove fragmentos da morte: token inteiro vermelho e sangue
ao redor, sem apagar token/ficha. Efeitos do mestre no canto inferior esquerdo,
presets persistidos no documento da mesa (sem nova migration). Chamas/gelo/veneno/
cura/faíscas ajustáveis e sangue permanente; arraste para barra rápida, aplique
ao token selecionado e limpe. Visuais sincronizados não alteram PV/recursos.
Presets privados; servidor exige dono administrador para aplicar e fixar. Ataques
de monstros também têm Fixar/arraste, rolagem de acerto e dos danos explícitos,
com consulta da ficha atual no servidor. Trancas continuam impedindo edições.
Camadas foi para a barra esquerda. Direita: Chat, Biblioteca de arte, Fichas,
Biblioteca, Som, Diário, Configurações e ajuda. Token em Fichas; iniciativa em
Chat; Mapa/Mesa/Ajuda são subabas da última. docs/VTT-PERFIS-HALL.md documenta.

## Refino posterior de 05/10/2026

Calendário ao final do Diário: título padrão Calendário, sem selo/subtítulo,
cores carvão/azul/cobre. Capa acompanha o compromisso selecionado; três artes
genéricas novas para ausência de imagem. Prompts e comportamento em
CALENDARIO-PERFIS-REFINO.md. Personagem → Cartas tem inventário e três espaços
equipados, inclusive na consulta de perfis. Loja mantém compra separada. Perfil
sem novos uploads de cenários; avatares e fundos antigos preservados. Ações em
uma linha, molduras diagonais e painel inferior do acampamento removido.

VTT: busca de mapas alinhada; Formas e Névoa agrupados. Fog manual permite
polígono/retângulo/pincel de revelar e ocultar, reinício/desfazer. Selecionar
essas ferramentas usa controle manual; visão automática dos tokens volta pelo
menu. Novos mapas usam visão automática e escuridão sem luz ambiente; migration
061 corrige mapas antigos que retiveram névoa manual com iluminação desligada.
Editar alcance de visão/luz também ativa modo automático; ft converte para m.
Dados percorrem a tela e têm seletor D4–D100 com atalhos de quantidade 1–6 e
entrada manual até 100. Atalhos da ficha têm dez espaços, até vinte abas,
tranca/remoção e persistência privada por usuário/mesa (migration 062).
Boss: mestre marca token e estilo; todos veem só nome/PV/estilo, vermelho sobre
preto e cura verde temporária. Efeito de morte manual ou ao cruzar PV positivo
para zero, sem excluir token/ficha; cura/limpeza pelo mestre remove o efeito.
Gastos ainda são reais, auditados e restaurados somente pelo mestre.

## Refino da mesa virtual, visitas, eras e calendário (05/10/2026)

Direção vigente substitui os limites de sessão descritos na entrega anterior:
consumíveis usados na mesa são debitados do inventário real, em transação com
idempotência e auditoria. PV/condições continuam de sessão. Jogador só gasta;
apenas mestre dono e administrador restaura PV, slots, dados de vida ou consumo
auditado. Reimportação não repõe recursos. Migration 060 adiciona vínculo explícito
de importação, recursos persistentes, histórico e mensagens de magias.

VTT: mapas novos vazios quadrados/escuros, biblioteca de mapas com pastas e
subpastas, editor de configuração, camadas fundo/tokens/mestre/iluminação, ordem
decimal negativa/positiva, menu de contexto para camada/espelho/giro. Fontes de
luz são entidades independentes. Névoa automática segue visão do jogador e
barreiras; visão no escuro fica acinzentada fora da luz real. Janela/porta corta
parede alinhada e cria conectores. Régua com seta desaparece ao soltar; caneta
tem paleta. Objetos da camada ativa podem ser selecionados e apagados.

Ficha completa escura em Essencial/Biografia/Magias, inventário real, gasto de
consumíveis/slots/dados de vida e restauração administrativa. Nove totais de slots
editáveis pelo mestre; progressão automática completa depende das regras futuras.
Chat com histórico paginado e descrições completas de magias. Seletor lateral de
dados/quantidade/modificador; formas Three.js d4/d6/d8/d10/d12/d20 e d100 com dois
d10, som de impacto e toggle 3D. Resultado sempre vem do servidor; fallback textual
quando WebGL não está disponível. Não é automação completa do Roll20 ou de D&D.

Visitas por perfil usam largura total e escala original dos cenários em todos os
painéis; navegação móvel precede o cenário. Molduras menores ficam na parede,
afastadas das vigas/teto, com máscaras alinhadas e recorte superior centralizado no
rosto. Arquivos originais preservados. Lore tem trem de engrenagens, rotação ativada
pela chegada da luz mais lenta, áudio mecânico durante viagem e encaixe firme ao
terminar. Respeita movimento reduzido e volume/silêncio de efeitos.

Pedido posterior: calendário sem aba própria, sempre ao final de Início → Diário,
abaixo de publicações/agenda. CRUD, aparência, datas e filtros preservados; editar
entrada do Diário atualiza calendário sem trocar mês/dia selecionado.

Verificação: TypeScript e build completo Docker passaram; 14 testes VTT/social,
sete de comunidade/economia, browser VTT/perfis com duas contas e layouts
1440/768/390/320, browser calendário/mascotes e smoke de eras/engrenagens passaram
em bancos descartáveis. Cenários, recortes, calendário e visão/luz inspecionados
visualmente; pixels confirmam cinza em visão no escuro, cor na luz e fog preto.
Scripts reproduzíveis e limites em docs/VTT-PERFIS-HALL.md e
docs/CALENDARIO-MASCOTES.md. Docker local atualizado e saudável, migration 060
aplicada e index-Spt9H4NQ.js / index-DDFJ7HB6.css confirmados. Contagens e totais
de contas/personagens, inventário/compras, conquistas/estantes, companheiros,
cartas/títulos, ouro e progressão preservados. Backup imediatamente anterior
privado: `.local/backups/before-vtt-refinement-20261005.dump` (431.971.503 bytes).
Alterações validadas seguem o fluxo autorizado para origin/Welson; nunca main.

## Mesa virtual, Hall da Fama e perfis sociais (05/10/2026)

Entregas reunidas deste turno: **Mural → Mesa virtual**, **Personagem → Hall da
Fama / Perfis**. Migrations 058–059 aplicadas no Docker local; saúde OK. VTT tem
mapa/tokens, grade quadrada/hexagonal, régua, desenho/áreas, luz por raios, paredes/
portas/janelas, névoa manual, fichas de sessão, biblioteca de imagens, dados/chat,
iniciativa, diário, música e exportação PNG/JSON. Administrador cria/mestra apenas
suas mesas; jogador entra por convite, importa cópia do próprio personagem e move
tokens atribuídos. Nenhuma alteração de sessão escreve no personagem original.
330 monstros/339 magias SRD 5.2.1, em inglês, obtidos dos registros abertos `srd52`
do formato 5etools; sem ilustrações ou conteúdo fechado de livros. JSON próprio
do mestre amplia a biblioteca. Não apresentar como cópia completa do Roll20 nem
automação integral de D&D. Limites e fontes em docs/VTT-PERFIS-HALL.md.

Perfis por ID da conta Better Auth, avatares circulares, busca, apresentação/
cenário pessoais, amizades com aceite e chat privado entre amigos. Bloqueio,
histórico, leitura e não lidas. DMs não são retornadas a administradores externos.
Visita autenticada tem personagens/companheiros e navegação lateral por conquistas,
Hall, ficha e cartas de consulta, sem expor e-mail, ouro ou inventário privado.
Escolha do personagem muda a montaria/mascote exibidos. O Hall usa registros reais
do servidor, categorias e pesos editáveis pelo administrador; uma avaliação por
conta, sem autoavaliação e média ponderada no ranking.

Conquistas original preservada, agora com quatro molduras trabalhadas, duas à
esquerda e duas à direita da estante, brilho dourado e seleção por retrato também
na visita. Duas posições reservadas quando a conta tem só dois personagens;
não aumentou limite nem criou personagens fictícios. Artes transparentes e máscaras
em public/profiles; prompts/proporções em docs/VTT-PERFIS-HALL.md.

Validação: build completo Docker (TypeScript/cliente/servidor), 11 verificações de
API/geometria VTT/social, sete de economia/ownership/comunidade anteriores e browser
de Conquistas original. Browser novo testa duas contas, amizade/chat, visitas,
companheiros, ficha/cartas, molduras, Hall, importação, grade/barreira, compêndio,
dados, exportação, movimento do jogador bloqueado/restaurado e movimento livre;
layouts 1440/768/390/320. Todos em bancos descartáveis. Comparação no banco local
confirmou contas/personagens, inventário/compras, conquistas/estantes, companheiros,
cartas/títulos, ouro/progressão preservados. Backup anterior privado em
`.local/backups/before-vtt-social-20261005-104146.dump` (431.444.668 bytes).
Comandos reproduzíveis: `node scripts/test-vtt-social-isolated.mjs` e `--browser`.
Estado atualizado enviado para origin/Welson após validação; nunca main.

## Vento do corvo removido (05/10/2026)

Usuário pediu apenas o som do animal. Áudio ativo passa a `raven-caw-v3.wav`,
com os dois grasnados de Bidone/Freesound 66763 preservados. Redução espectral
aprende o ruído nos trechos sem chamado; suavização evita artefatos metálicos,
corte de graves remove vento e fades isolam os chamados, com silêncio exato
entre eles. Novo nome impede replay da v2 em cache. `clean-raven-audio.mjs`
é reproduzível sem dependências novas; `import-pet-audio.mjs --raven-only`
regenera só o corvo. Fontes, cache original, gravações anteriores e demais sons
preservados. Créditos e manifest atualizados.
Análise PCM: 1,51 s, 48 kHz, pico 0,7 sem saturação; graves abaixo de 250 Hz
reduzidos em 60,6/52,8 dB nos dois chamados, energia da voz preservada
(+0,4/+0,3 dB entre 800–5000 Hz), similaridade espectral acima de 99,5%.
TypeScript/build cliente e servidor passaram, assim como smoke Edge em banco
descartável: somente v3 toca, uma vez, nas duas aparências. Docker local atualizado
e saudável, index-DcuLLrc8.js / index-BV9BEDFq.css confirmado; áudio servido com
bytes idênticos ao PCM validado (145004 bytes). Sem alteração SQL.

## Corvo com grasnado, sem voz humana (05/10/2026)

Usuário corrigiu a interpretação: retirar somente a voz humana, preservando
o animal. Corvo reativado com `raven-caw-v2.wav`, gravação curta própria de
grasnado, fonte Bidone/Freesound 66763 (CC0). A gravação antiga raven.wav não é
reproduzida. Nome novo evita cache antigo; importador tem fonte/cache/recorte
explícitos e créditos atualizados. As duas aparências usam o mesmo grasnado e
seguem volume/silêncio; selecionar corvo não reproduz miado de Garalho.
TypeScript/build e smoke Edge em banco descartável passaram: apenas o novo
arquivo toca nas duas aparências. PCM tem duração 2,065 s, volume presente e
sem saturação. Docker local atualizado e saudável, index-lsy7k-l4.js /
index-BV9BEDFq.css confirmado; áudio novo servido com bytes idênticos ao arquivo
validado. Sem alteração SQL.

## Voz inesperada do corvo removida (05/10/2026)

Decisão intermediária corrigida acima: reprodução de raven.wav foi
desativada nas duas aparências da Casa dos mascotes, sem cair no efeito genérico
de farejar. Seleção/placa/compra e sons dos demais animais continuam. Gravação
e créditos antigos arquivados; não reativar sem pedido do usuário.
TypeScript/build e smoke de calendário/mascotes passaram em banco descartável,
incluindo ausência de reprodução nas duas aparências. Docker local atualizado,
saúde OK e bundle index-DeHh_Hhy.js / index-BV9BEDFq.css confirmado. Sem migration.

## Conquistas restauradas, Lore, mascotes e calendário (05/10/2026)

Correção explícita do usuário: voltou a página original **Conquistas**, com
estante, prateleiras livres sem limite, posições/personalização salvas e catálogo.
A aba separada **Títulos** foi removida; `#titles` antigo abre Conquistas.
Administradores editam nome/descrição/vínculo no catálogo e criam título a partir
da conquista. Escolha/administração de títulos fica na mesma página. Histórico,
metas e concessões preservados; código duplicado AchievementHonors removido.

Lore: barra contínua de luz cresce entre eras, chegando a cada marcador antes
de mudar a seleção. Mesma era usa só finalização; movimento reduzido preservado.
Áudio original de engrenagens desacelerando e tranco em lore-era-lock.wav, com
volume/silêncio de Efeitos sonoros. Pastas com nomes Cinzel maiores e destaque.

Garalho: clicar abre caixa com nome e perguntas, fechar/Escape encerra; miado
textual/sonoro aparece somente após pergunta. Placas com humor curto, cabendo
no celular, sem riscos por trás da madeira. Selecionar animal escreve comentário
sem miado de Garalho. Oito vozes naturais licenciadas substituem sons eletrônicos;
cobra/coelho usam ruído discreto, sem impacto extra. Credits.md e manifest.json
acompanham os áudios em public/audio/pets, com link público na página.

Administrador edita nomes das 17 raças/aparências. Comprador dá nome pessoal ao
pet; inventário escolhe qual aparece à direita no acampamento. Troca de personagem
mostra sua própria escolha, descartando resposta atrasada. Primeira compra exibida
automaticamente; próximas compras/replays preservam seleção. Migration 056 guarda
rótulos/revisões e pet exibido único por personagem. Chaves distintas de React
para CampMount/CampPet evitam companheiro anterior persistindo após troca.

Eventos ganhou fundo mundano de rua da vila; editor completo e galeria continuam.
Início → Calendário reúne eventos, missões e publicações datadas do Diário,
sem duplicar conteúdo. Grade mensal, Hoje, escolha de mês, filtros e todos os
compromissos do dia; no celular há indicadores e detalhes abaixo. Administrador
edita título, apresentação, fundo próprio/galeria, cor e início da semana, com
prévia, e cria/edita/exclui eventos. Diário abre editor com registro atual,
inclusive fora das 100 publicações mais recentes. Missões mantêm ownership.
Migration 057 guarda só apresentação/revisão e troca somente o antigo fundo
do salão, preservando textos/camadas. Upload publicado de calendário é visível
ao jogador; imagem sem referência continua privada. Datas em America/Sao_Paulo.
Contratos e fontes em CALENDARIO-MASCOTES.md.

Validação: TypeScript/build cliente e servidor, sete testes de comunidade,
cinco de calendário/mascotes e smokes Edge de comunidade, conquistas, Lore/montarias
e calendário/mascotes passaram em bancos descartáveis. Edição/revisão/permissões,
economia, concorrência, fuso, upload, Diário, seleção por personagem e telas
320/390/768 px conferidos; capturas em test-results (ignorado pelo Git).
Backup pré-migrations 056–057: .local/backups/alvorada-before-calendar-pets-20261005.dump
(431440716 bytes). Docker local atualizado e saudável, migrations 056–057
confirmadas. localhost:3000 serve index-DBm9eR_5.js / index-BV9BEDFq.css, oito
vozes e som de engrenagens com HTTP 200. Fundo da vila confirmado no SQL.
Dados existentes e volumes preservados; nenhum teste executado no banco do usuário.

## Salão em sombra, conquistas editáveis e corvo no chão (05/10/2026)

Nova composição do salão conforme desenho do usuário: janela no terço esquerdo,
luz fria lateral, anfitrião menor ao fundo à direita e em sombra, cartas em leque
no primeiro plano. Conversa oculta ao entrar; clicar no anfitrião abre falas e
três perguntas. Cartas provocam comentários individuais temporários, sem menu
de perguntas permanente; fechar/Escape encerram. Três espaços, coleção e compras
preservados. Arte atual moonlit-room-v2.png; prompts em SALAO-CONQUISTAS.md.

Decisão anterior corrigida pelo usuário na entrega acima: página/estante de
Conquistas foram removidas indevidamente; rota antiga abria Títulos. Sete conquistas
integradas com progresso e editor administrativo de nome/descrição/título.
Criar título parte da própria conquista com meta preenchida. Editor resolve
vínculo e revisão em transação; substituir/remover associação preserva títulos
já recebidos. Migration 055 guarda definições; códigos/metas de jogo e histórico
SQL/estantes permanecem. Título escolhido exibido separadamente no acampamento
e ficha, com atalho Escolher título; inventário não exibe título por enquanto.

Corvo clássico usa raven-ground-v4.png, sem madeira e com patas completas;
alternativa já estava sem suporte. Tamanhos e aparências persistidas preservados.
Validação: build completo, sete testes de comunidade em banco descartável,
smoke completo no Edge e smoke específico de conquistas passaram. Corvo e
demais artes sem cortes; conversa, compra/equipagem, edição/vínculo e título
persistidos; composição desktop/mobile e movimento reduzido conferidos.
Aplicado no Docker local, migration 055 e bundle index-Df-zRMUI.js /
index-UriLdI7V.css confirmados. Backup pré-migration em .local/backups,
ignorado no Git. Nenhum volume ou histórico removido.

## Placa limpa, falas naturais e animais clássicos v3 (05/10/2026)

Retirado SVG de riscos de escrita e keyframes correspondentes: a madeira fica
limpa durante o gesto; resposta só aparece ao apresentar a placa. Saudação,
despedida, perguntas e dez comentários reescritos como falas cotidianas de Garalho,
com observações de cada animal, sem instruções genéricas ou texto de inventário.
Pedido ampliado: substituir as dez primeiras aparências com arte mais trabalhada
como as alternativas. Três pranchas 2×2 em classics-a/b/c-v3.png têm cães/gatos/raposa
adultos em pé e anatomia/texturas mais naturais. Coruja clássica e alternativa
apoiadas nas próprias patas, sem tronco/poleiro; alternativa em PNG separado.
src/pet-art.ts usa fontes por animal e viewports próprios com meet/clipPath;
tamanhos de jardim continuam relativos à espécie. IDs, preços, persistência
e aparências compradas preservados. Artes e prompts em PET-SHOP-REFINEMENT.md.
Validação: TypeScript/build e fluxo real no Edge em banco descartável passaram;
17 aparências sem cortes/vizinhos, placa limpa e responsividade em 320/390/768 px.
Docker local atualizado e saudável; localhost:3000 serve index-1YPdHXfR.js /
index-BdzxehXv.css e as quatro novas artes com HTTP 200. Sem alteração SQL.

## Reforma completa da Casa dos mascotes (04/10/2026)

Pedido atual substitui a composição inicial: Baguncinha/cadeira/café removidos
da arte do jardim; Garalho menor, olhos separados preservados, duas novas poses
com placa fisicamente nas patas, escrita por 2,5 s, movimento apenas da pata e
apresentação suave. Texto na madeira; botão Ler placa amplia a mesma resposta.
Casa fica no fundo apenas do jardim, com enquadramento independente da altura
do catálogo. Catálogo amplo fora do painel de compra, sem rolagens internas.
Animais reimaginados, inteiros e proporcionais nas dez espécies/sete aparências.
src/pet-art.ts define limites reais de cada silhueta; PetArt usa viewBox, meet e
clipPath explícito para excluir vizinhos das pranchas inclusive nas margens.
Inventário reutiliza a mesma renderização; larguras de cenário variam por animal.
Escolher mascote retorna ao jardim. Sons e compras transacionais preservados.
Artes finais/prompts da ferramenta image_gen em PET-SHOP-REDESIGN.md; v1 preservadas.
Validação: TypeScript/build, seis testes de comunidade em banco descartável e
fluxo real de Edge passaram. Checagens de pixels no SVG confirmam ausência de
vizinhos/cortes nas 17 aparências; comparação de captura com/sem animal confirma
pintura real no jardim após trocas. Placa e overflow conferidos em 320/390/768 px.
Aplicado no Docker local, healthcheck saudável e bundle index-DEi6_Y88.js /
index-XzJ_BmXL.css confirmado em localhost:3000. Arte v2 servida com HTTP 200.
Não há alteração SQL nesta reforma; dados e volume preservados.

## Mascotes, eventos, títulos, cartas e ficha escura (04/10/2026)

Menu com Casa dos mascotes, Eventos, Títulos e Cartas. Garalho preserva olhos
separados e referência do usuário; só mia e escreve por 2,5 s na placa de madeira
antes de virá-la. A composição original com Baguncinha foi substituída pela
reforma descrita acima. Dez espécies com preços definidos, sete aparências adicionais,
sons ao aparecer e compras reais no inventário. Imagens e prompts em COMPANIONS-ART.md.

Eventos usam board_posts; administrador cria/edita/exclui e compõe cenário inteiro
com upload de background, enquadramento, luz, névoa/brasas, camadas de arte e seis
animações. Conquistas não têm limite por prateleira nem posições fixas; arraste
entre três níveis, setas e sobreposição. Candelabro alinhado. Títulos administráveis,
metas por conquista/nível/missões/gasto no empório ou concessão/revogação manual,
com auditoria e escolha de título exibido no acampamento/ficha.

Cartas: três equipadas por personagem, oito artes e Anfitrião em salão noturno
com janela iluminada pela lua. Quatro compráveis por 50/75/100/150 PO. Resposta
expressa do usuário: upgrades serão definidos depois; drops serão implementados
mais adiante no servidor. Não inventar custos, obtenção ou bônus automáticos.
Compras/ownership/idempotência e equipagem estão implementados no SQL.

Ficha em papel escuro/tinta clara, História separada de Equipamento. Banner da
Lore substituído por panorama geral do mundo. Migrations 048–054; contratos,
preços, persistência e validação em COMPANHEIROS-EVENTOS-TITULOS-CARTAS.md.
Suíte geral: 60 de 62 testes passaram; duas falhas preexistentes do WorldFleet
(órbita e olho/onda) continuam documentadas, sem alteração nesta entrega.
Testes novos de comunidade e administração e fluxos reais de navegador passaram.

Aplicado no ambiente local: migrations 045–054, Docker app reconstruído e
healthcheck saudável em localhost:3000. Bundle index-ByLrSlyT.js confirmado.
Concessão solicitada feita explicitamente pelo CLI: limawelsn@gmail.com com
administrador=1. Nenhuma concessão por seed/e-mail fixo no código. Backup SQL
pré-migração preservado em .local/backups (ignorado no Git); volume mantido.

## Administração, cronologia e montaria do personagem (04/10/2026)

Permissões compartilhadas unificadas em `"user".administrador` 0/1, padrão 0,
com autorização renovada no PostgreSQL a cada operação. Só 1 altera Lore/pastas,
linha do tempo, Regras, Início, editor do reino e eventos. Substitui autoria,
staff/gestão antigos e e-mail fixo; não promover via cadastro/seed. Concessão
explícita solicitada para limawelsn@gmail.com usa scripts/admin.ts (conta existente).
Jogadores mantêm seus fluxos privados com ownership, inclusive montarias.

Lore ganhou linha do tempo editável pelo administrador: seis eras iniciais, só
Alvorada Cinzenta revelada, anos/títulos/descrições/ordem/revelação e vínculos de
pastas configuráveis. Abrir pasta vinculada ou subpasta faz percurso cronológico
e chegada; na mesma era toca apenas chegada. Documento SQL compartilhado com revisão.
Cabeçalho da Lore sem margem superior e título repetido; pergaminho fechado mais
longo/estreito e elaborado diretamente no SVG. Tentáculo da Gina com tons de carvão,
reflexos mais suaves e ventosas no braço distante, integrado à luz fria/neutra da cena.

Inventário ganhou Companheiros de estrada: escolha persistida por personagem de
qual montaria aparece, ou ocultação. Acampamento mostra a escolha à esquerda e
mais ao fundo, mudando imediatamente com o personagem selecionado; arte conserva
pelagem/equipamento comprado. Migrations 045–047. Detalhes, endpoints e validação em
docs/ADMINISTRADORES-ERAS-MONTARIAS.md.

## Códice com ambientação e entrada da Ginna por ruptura (04/10/2026)

Regras ganhou emblemas ilustrados de metal envelhecido nos capítulos,
encadernação e marcador nas páginas, poeira suave na capa, animação de troca
de artigo e livro interativo para entrar na leitura. O editor oferece nove
símbolos por capítulo e opção Automático. Campo `symbol` opcional, validado
no shared/rulebook.ts e preservado pelo JSONB/histórico/importação atuais;
documentos existentes continuam válidos sem alteração dos textos ou migration.
Couro ao entrar e papel ao navegar seguem Efeitos sonoros; mute/volume zero,
aba oculta, página inativa e desmontagem interrompem áudio. Movimento reduzido
remove efeitos decorativos. Leitura e autonomia de edição/exclusão preservadas.
Detalhes em docs/RULEBOOK.md.

O usuário refinou a entrada da Ginna: fissura vertical central, ramificações
finas que se espalham e pequenas lascas de vidro que se desprendem. Canvas
abre a fissura e deixa névoa escura vazar por ela, cobrindo a tela em 3,6 s.
A frente irregular da névoa avança até todas as bordas, com textura opaca
integral. Essa cobertura fica visível por 180 ms antes de trocar a cena abaixo.
Sons distintos de trinca (40 ms), vidro quebrando (1180 ms) e névoa (1530 ms)
seguem o mesmo relógio visual e as preferências de Efeitos sonoros.
Troca para visão sombria apenas sob cobertura integral da névoa,
aguarda artes prontas e dissipa a névoa em 1,55 s. Movimento reduzido usa fade.
Ordem modal, foco, bloqueio de entrada e cleanup mantidos. Retorno com tentáculos
e pálpebras permanece. Detalhes e testes em docs/STABLE-GINNA.md.
O emblema na capa do pequeno livro de entrada do códice foi centralizado
na área interna da encadernação, acompanhando sua inclinação.
Os emblemas do índice receberam elevação/inclinação suaves, movimento da
gravação e reflexo sobre o metal no hover/foco. Capítulo atual tem brilho
periódico discreto; número fica estável. Movimento reduzido e pausa preservados.

Validação desta entrega: TypeScript/build cliente e servidor; regras em banco
descartável (símbolo persistido e enum inválido rejeitado), editor responsivo
com sons/volume/mute e smoke com API real; ruptura em desktop/celular,
movimento reduzido, StrictMode, arte atrasada, cobertura integral por alfa,
pausa da cena antiga sob névoa, foco e
cancelamento; trinca/vidro/névoa em Web Audio real, pausa, volume ao vivo,
rede lenta e arquivos ausentes; smoke completo do estábulo em PostgreSQL descartável. Docker
reconstruído, healthcheck saudável e novos bundles confirmados no localhost:3000.

## Músicas e efeitos sonoros separados (04/10/2026)

Configurações de som oferece dois controles independentes, Músicas e Efeitos
sonoros, cada um com volume de 0–100% e silenciar/ativar. Painel horizontal
compacto no login, perfil e visão da Ginna. Preferências antigas migram para
os efeitos na primeira visita, preservando o volume/silêncio anterior; depois
cada canal persiste separadamente no navegador.

`useMusicInterlude` controla trilhas; `useSoundEffects` controla sino da loja,
pergaminho, balcão, batimentos, tentáculos e respiração. A música da visão e
a atenuação durante o retorno continuam no canal de músicas. Volume zero/mute
de efeitos interrompe os sons sem silenciar a trilha. Detalhes e verificações
em docs/SOUND-SETTINGS.md. Sem alterações SQL ou de compras.

Ilustrador local reativado no host a pedido do usuário: sessão ChatGPT validada
e heartbeat disponível confirmado. Continua separado do Docker, conforme
docs/CHARACTER-ART.md; reiniciar a aplicação não inicia esse processo.

## Editar e excluir todo o conteúdo da biblioteca (04/10/2026)

Corrigida a permissão de Regras para reconhecer `lore_folder_managers`. A conta
existente Pai do Cris (`limawelsn@gmail.com`) já gerenciava toda a lore, mas não
recebia `can_edit` no manual porque não é staff e usa outro e-mail. Agora pode
editar/excluir capítulos, artigos e todos os blocos, publicar, enviar imagens
e recuperar histórico. O e-mail autorizado anterior e staff/admin continuam
com acesso. Nenhuma promoção de staff, grant ao vivo ou migration nova.

Lore mostra Editar e Excluir escritos junto a cada pasta/subpasta e cada
crônica na lista, inclusive as iniciais e de outros autores para a gestão.
Editar na lista abre diretamente o editor sem tocar o som de leitura.
Regras oferece as mesmas ações claras nos capítulos/artigos durante a leitura
autorizada; Editar seleciona o item e abre o rascunho, Excluir confirma o alvo
e altera o rascunho antes de Salvar. Blocos têm Excluir bloco por escrito.
O índice abre durante edição também no celular. Leitores comuns conservam
consulta; permissões continuam verificadas no servidor.

## Som dos itens no balcão (04/10/2026)

A loja usa dez sons de materiais: madeira, metal, corrente, esferas metálicas,
vidro seco, papel, couro, tecido, frasco com líquido e cantil de couro com água.
Os 71 IDs ativos têm perfil físico explícito. A poção perdeu a batida de
madeira e ganhou contato suave do frasco; água preservada no mesmo nível e
com cauda idêntica. Peso/tamanho aumentam intensidade e gravidade; materiais
macios são mais discretos. Cada item tem sua própria fala, incluindo cinco
cosméticos e charuto antes genéricos; onze comentários mágicos refinados.

Inclusões aceitas, unidades repetidas e reposicionamento real tocam. Inspeção,
exclusão, limites ou mesa cheia ficam silenciosos. Arquivos carregam e
decodificam separadamente para uma falha não silenciar outros materiais.
Gravações CC0, variação discreta, volume/mute compartilhados e descarte ao
ocultar/sair. Sem mudanças no catálogo, compras ou SQL. Detalhes, manifesto
e validação em docs/SHOP-AUDIO.md.

## Regras editáveis, Ginna aprovada e áudio (04/10/2026)

A aba Regras agora usa um códice próprio com capa ilustrada, sumário, busca
sem acentos e navegação entre artigos. O proprietário autorizado
`correa.l@icloud.com` e staff/admin podem editar apresentação, capa, capítulos,
artigos e blocos de texto, nota/citação, lista, tabela e imagem. Há reordenação,
exclusão, prévia, importação/exportação JSON e histórico recuperável como
rascunho. Salvar publica para os leitores autenticados. As permissões são
verificadas no servidor, sem promover contas.

Migration 044 mantém documento, revisões e uploads no PostgreSQL. A publicação
é atômica e exige revisão atual; conflito preserva o rascunho. Imagens enviadas
ficam privadas para editores até serem usadas na publicação vigente. Seeds
preservam o livro editado e os registros anteriores de `world_entries`.
Editar o manual não altera cálculos ou automações de jogo: o texto inicial
distingue recursos disponíveis de descrições ainda não automatizadas.
Detalhes em docs/RULEBOOK.md; arte e prompt em docs/RULEBOOK-ART.md.

A quarta advertência mantém exatamente a imagem escolhida pelo usuário em
`public/stable/ginna-angry-approved.png`, sem clarear ou regenerar. Ela substitui
a versão WebP anterior, preservada como histórico. A terceira advertência
continua séria; o retorno restaura a imagem normal.

Tentáculos recebem dois efeitos com gravações reais CC0: emergência aquática
sinistra e atrito molhado ao envolver o visitante. Eles acompanham o relógio
da animação em 0 e 2700 ms, encerrando em 5600 ms antes da respiração.
A trilha da visão cai para 15% durante os efeitos; mute/volume, aba oculta e
movimento reduzido são respeitados. Fontes, manifesto e testes em
docs/STABLE-GINNA-AUDIO.md.

## Ginna brava e palavras totalmente maiúsculas (04/10/2026)

A quarta advertência usa `public/stable/ginna-angry.webp`, expressão muito
brava criada com o gerador integrado e alfa real preservado. A terceira mantém
a arte séria e o retorno restaura a imagem normal. Prompts e arquivo em
docs/STABLE-GINNA-ANGRY.md. Tremor somente nas palavras com todas as letras
maiúsculas, incluindo acentos: “Esta” e o “Não” em início de frase ficam
inteiramente parados. Esta regra substitui a seleção anterior por letra isolada.

Saída do lago integrada por raiz úmida com recorte suave no nível ondulado,
reflexo deformado da própria malha, espuma irregular, menisco, salpicos e
névoa local; o grupo mantém o mesmo tremor e enquadramento do cenário.
Ventosas distribuídas pela distância real na curva, em duas fileiras, com
limites entre todos os vizinhos/voltas que preservam ao menos 0,022 unidades
de separação. Somente aro/interior recebem rugas radiais, poros e acabamento
úmido; corpo próximo mantém a textura anterior. Detalhes em
docs/STABLE-GINNA.md. Sem mudanças SQL.

## Advertência, olho da montanha e saída do lago (04/10/2026)

Na quarta advertência só palavras inteiramente maiúsculas tremem (incluindo acentos);
palavras com minúsculas, espaços e pontuação ficam estáticos. Cada pulso vermelho da fala
escura toca um batimento grave abafado, sincronizado ao relógio da própria
animação (picos em 10% e 27% de 1,6 s), respeitando volume/mute, pausa da aba
e movimento reduzido. Sem loop independente que possa perder a sincronia.
Após Não vou machucá-los!,
Ginna responde imediatamente “Melhor assim. Estarei de olho em você.” no
balão da forma escura enquanto o tentáculo vem; a resposta permanece ao
voltar ao dia. Botão da promessa desaparece assim que é aceito.

O olho da montanha também passa a ter relevo 3D, preservando posição, máscara
da crista, íris e esmaecimento da base. Compartilha o canvas com os 22 olhos
do chão. Origem do tentáculo distante muda da crista para a água abaixo da
ponte, com ondas elípticas se expandindo ao emergir. Tentáculo distante um
pouco mais escuro e sincronizado com a transformação real do cenário em
tremor; ondas e recorte acompanham o mesmo enquadramento cover. A aproximação
e as voltas junto do visitante continuam em perspectiva. Movimento reduzido
mantém uma pose estática, sem tremor ou ondas animadas. Sem mudanças SQL.

## Olhos e tentáculos em 3D (04/10/2026)

Os 22 olhos do chão usam a arte original sobre malhas 3D curvas, com relevo
do globo, pálpebras e terra. Emergência recortada pelo nível do solo, sombra
de contato e piscada com deformação da superfície. Terra/bordas escurecidas
separadamente da íris, que mantém o cinza anterior. O fundo v2 permanece.
Um canvas compartilhado, limite
de 30 fps, pausa em aba oculta e alternativa raster se WebGL falhar.

Retorno substitui o tentáculo SVG por tubo 3D afilado, textura de pele do
kraken e ventosas em relevo. Em 5,6 s sobe da água, desce perto do
visitante e envolve a câmera com voltas em um eixo vertical que se apertam,
antes das pálpebras e do retorno ao dia. Materiais e luz usam a paleta escura
do cenário. A fala vermelha perde o risco e recebe fonte maior, preservando
os dois pulsos por ciclo. Movimento reduzido mantém composições estáticas.
Detalhes e validação em docs/STABLE-GINNA.md. Sem mudanças SQL.

## Excluir crônicas e fala da Ginna (04/10/2026)

Refinos adicionais da Ginna: arte séria na terceira advertência, tremor por
letra na quarta e fala escura com pulsação vermelha. Pequeno pico
restaurado no fundo v2 para acomodar o olho da montanha. Pedido de desculpas
inicia a sequência de tentáculos: subida atrás da crista, descida próxima e voltas
ao redor da câmera, antes das pálpebras e do retorno ao dia. Respiração
sincronizada com a troca de cenário. Movimento reduzido preserva os estados
visuais com retorno breve estático. Detalhes, prompts e assets em
docs/STABLE-GINNA.md. Nenhuma mudança nas regras, montarias ou compras.

Crônicas e rascunhos têm lixeira na lista e opção Excluir crônica na leitura,
com confirmação pelo título. Autor, staff e gestão da lore usam as permissões
de edição existentes, verificadas no servidor. Migration 043 registra exclusão
com data/autor e preserva histórico/imagens no SQL; página e imagens ficam
indisponíveis nas rotas públicas e privadas, inclusive após recarga/seed.
DELETE exige a revisão atual para impedir exclusão sobre uma edição recente.
Crônicas excluídas não impedem excluir uma pasta vazia; restaurar pastas não
reabre crônicas excluídas. Não há interface de restauração de crônicas.

Resposta da Ginna sobre a origem dos animais passa a explicar diretamente
que eles vêm até ela, atraídos por comida e sossego, e recebem água, abrigo e
paciência até ganhar confiança. Removidas as alusões a caminhos misteriosos.

## Ginna e visão do estábulo (03/10/2026)

Brida foi substituída por Ginna, moça jovem em arte realista sem chapéu.
Refino vigente: escala reduzida para aparentar 1,50 m nas duas formas.
Ao entrar, recebe a visita com fala alegre/sapeca sobre lambidas e lanches,
com identificação Cuidadora. Nome revelado
somente ao escolher Quem é você? Clique abre balão junto à personagem, com
três perguntas; não abrir menu/modal central. Clicar nela novamente ou Escape
fecha as perguntas e devolve foco, mantendo contador da visita. Retirado o rótulo
Conversar nas duas formas: corpo recebe brilho no hover/foco como na loja;
na visão o brilho é suave para preservar o preto. Conversa segue o mercador:
clicar no corpo abre O que deseja saber? com três opções, selecionar fecha
as opções e mostra só a resposta. Balão em SVG com corpo/ponta unidos e
tipografia compartilhada com a loja. Clicar no corpo novamente ou Escape fecha.

Quinta insistência dispara cenário destruído, névoa negra, Ginna em fumaça
sem chapéu e tremor irregular contínuo da cena. Onze olhos pequenos em
diferentes profundidades do terreno, dessaturados/escurecidos para se integrar
ao chão, piscam em ritmos independentes. Não usar criatura com bocas nem olhos
gigantes junto à câmera. Animal fica oculto com seleção/equipamentos intactos.
Não há mais tempo de retorno automático. Só clicar na forma escura e escolher
Não vou machucá-los! encerra, restaura foco/animal/música e reinicia contador.
Escape abre a resposta e não encerra a visão. Ocultar a aba pausa seu áudio,
preservando a cena, e voltar retoma. Música local em loop, volume/mute gerais
e controle de som acessível na visão. Movimento reduzido mantém a cena
persistente estática. Sem mudanças SQL. Artes, prompts e validação em
docs/STABLE-GINNA.md. Rebuild/restart do serviço Docker app é necessário para
atualizar o site local; enviar ao GitHub sozinho não atualiza o container.

## Citação / lenda como caixa lateral (03/10/2026)

Usuário apontou que o alinhamento apenas mudava o texto, deixando a citação
de ponta a ponta. Esquerda/direita agora posicionam a própria caixa junto à
margem escolhida, com cerca de meia largura e proporção quadrada para textos
curtos; conteúdo longo amplia a altura. Centro mantém toda a largura do
conteúdo. Largura mínima legível se adapta ao espaço disponível no celular.
CSS compartilhado corrige prévia, leitura e páginas existentes sem alterar
os valores de alinhamento ou textos salvos.

## Acabamento em aquarela somente na lore (03/10/2026)

Por referência e confirmação do usuário, todas as imagens dos blocos da lore
recebem bordas irregulares de pigmento dissolvido, pinceladas secas e granulação
de papel. Centro preservado. Máscara SVG com ruído/deslocamento e textura SVG
compartilhadas por leitura e prévia, em retratos, paisagens e meias paisagens,
incluindo páginas anteriores. Só os blocos da lore; banner e outras abas não
recebem esse efeito. Arquivos originais no SQL preservados. Imagem inteira usa
dimensões naturais para evitar aplicar máscara às faixas vazias; sem zoom.
Opções passam a “Aquarela sem movimento” / “Aquarela, névoa e movimento suave”,
mantendo os valores persistidos still/cinematic. Movimento reduzido mantém o
acabamento estático. Detalhes e validação visual em docs/LORE.md.

## Perseguição sem parar no esbarrão (03/10/2026)

Mascote agora corre atrás de um rato de campo ilustrado em SVG, com volume,
orelhas, bigodes, patas alternando e cauda flexível. Rato passa à frente da
tigela; raposa esbarra de passagem e segue atrás dele. Removidas desaceleração
e marcha à ré no contato: trajeto horizontal contínuo e uniforme, com os dois
animais saindo após 2,1 s. Contato e queda do rolo permanecem sincronizados em
32% da sequência, com brilho/permanência/reset já aprovados. Movimento reduzido
esconde os dois animais. Arte/identidade da raposa permanece a versão corrigida.
Smoke mede avanço sem pausa/inversão no esbarrão, rato à frente, saída de ambos
e todos os fluxos/alternativa estática anteriores. Substitui a corrida anterior.

## Tigela e mascote de cristal (03/10/2026)

Usuário rejeitou o porta-pergaminhos alto e sua extração vertical. Pastas agora
usam tigela rasa de bronze ornamentado, com seis rolos e frente ocultando as
pontas. Ao hover, a raposa de cristal fornecida pelo usuário corre, esbarra na
tigela e segue adiante. Contato em 32% da sequência de 2,1 s dispara inclinação,
balanço dos papéis e tombamento de um rolo sobre a borda. Pequeno deslocamento
vertical de 3 unidades, sem lançamento alto; descida ocorre fora da parede.
Só o rolo brilhando permanece após a raposa sair. Clique/saída reseta tudo;
movimento reduzido exibe rolo/efeito estáticos e esconde a corrida.

Arte do mascote criada com imagegen integrado a partir de três referências do
usuário. Correções obrigatórias: cauda alongada, afunilada e pontuda; olhos
inteiramente em roxo sem esclera ou borda branca (reflexo pontual permitido).
Atlas de quatro poses com transparência e linha do chão alinhada em
`public/mascot/crystal-fox-run.webp`; origem, referências e prompt em
`docs/MASCOT.md`. Script portátil recompõe o atlas a partir do PNG salvo.
Smoke Edge desktop/celular verifica contato, altura baixa, folga do metal,
saída da raposa, permanência/reset do rolo, movimento reduzido e fluxos da lore.
Substitui a direção do recipiente/queda descrita abaixo.

## Porta-pergaminhos e queda pela abertura (03/10/2026)

Usuário rejeitou o formato de panela e o rolo atravessando sua parede. Pastas
agora usam `LoreScrollHolderIcon`: recipiente alto de couro costurado, aros de
madeira, tira/fivela e seis rolos. Sem alças de panela. Frente continua ocultando
as pontas dentro do recipiente. Queda de 1,65 s em três etapas: levantar inteiro
acima da borda, deslocar para fora pela direita, girar/descer só na lateral.
Trajeto mantém folga da parede durante todo o tombamento. Posição final com
brilho/estrelas permanece até clique/saída; movimento reduzido mantém pose final.
Smoke confere folga acima da abertura e ao lado em fases sucessivas da queda.
Substitui o vaso de cobre e o trajeto anteriores descritos abaixo.

## Magia mais fosca com estrelas (03/10/2026)

Refino pedido pelo usuário: fios agora nascem em quatro pontos distribuídos
na superfície do papel, com brilho menos intenso e cores azuladas mais foscas.
Retornam as três estrelas de quatro pontas da primeira versão (centro superior
e laterais). Permanecem as curvas afiladas, o vaso interativo e o pergaminho
caído sem repetir a queda. Substitui a origem única no centro descrita abaixo.

## Magia em fios e vaso interativo (03/10/2026)

Magia do pergaminho aberto refeita: quatro trajetos cúbicos partem do centro,
com fitas preenchidas que se afinam até a ponta e dão voltas diferentes.
Máscaras revelam cada fio do centro para fora; deriva, duração e fase variam,
sem moldura fixa nem giro do conjunto. Arte continua em SVG/CSS no projeto.

Cada botão de pasta tem estado de hover local em `LoreFolderButton`. Entrada do
mouse chacoalha o vaso, balança os rolos e faz um pergaminho cair com pequeno
rebote. Animação finita de 1,45 s mantém a posição final; só a magia continua.
Não repetir a queda enquanto o ponteiro permanecer na pasta. Clique ou saída
reseta imediatamente, inclusive antes de terminar. Foco por teclado tem a mesma
interação; toque não mantém hover. Movimento reduzido exibe posição final e
brilho estáticos. Teste Edge verifica queda/posição, ausência de reinício,
reset por clique/saída, magia com quatro fios e desktop/celular.

## Ícones ilustrados, som e edição de toda a lore (03/10/2026)

Usuário ampliou explicitamente a permissão de Pai do Cris para editar textos e
imagens de qualquer crônica, em qualquer região, inclusive páginas iniciais sem
autor e conteúdo de outras contas. `lore_folder_managers` autoriza também leitura
e edição de rascunhos na lore; autoria e versões permanecem preservadas. Não muda
staff nem permissões fora da lore. Substitui a limitação anterior da gestão apenas
a nomes/organização de pastas. Testes confirmam edição nas 22 regiões, upload e
edição de páginas alheias, mantendo privacidade para contas comuns.

Os três SVGs de `LoreSymbols.tsx` foram refeitos com volumes, papel envelhecido,
lacre e vaso de cobre ornamentado. Pergaminhos realmente atravessam a abertura,
com a parede/borda frontal por cima das pontas. Ícones maiores. O pergaminho
aberto emite luz azul clara e partículas; movimento reduzido mantém os traços
luminosos estáticos. Removida também a legenda I · O MUNDO.

Cada clique/teclado para abrir uma crônica toca o som original de papel
desenrolando `public/audio/lore-scroll-open.wav` (1,24 s), reiniciado sem
sobreposição, com volume/mute gerais. Geração reproduzível em
`scripts/generate-lore-scroll-sound.mjs`. `SiteMusicProvider` mantém a instância
de áudio e pausa em outra rota/aba oculta. Testes no Edge conferem reprodução,
reabertura, edição das crônicas iniciais, outra região e desktop/celular.

## Gestão de pastas e acabamento da lore (03/10/2026)

A conta Pai do Cris (`limawelsn@gmail.com`) pode renomear, reorganizar e excluir
pastas já existentes. Migration 042 concede essa permissão separada em
`lore_folder_managers`, sem alterar staff ou permitir edição de textos alheios.
Botões de lápis/lixeira ao lado das pastas; servidor valida revisão, região,
nomes, ciclos e máximo de quatro níveis. Exclusão inclui subpastas e exige uma
pasta de destino se houver crônicas, preservando autoria, publicação e imagens.
Lixeira recupera a estrutura e a localização das páginas não editadas desde a
exclusão. Trava transacional comum às escritas impede corridas nas movimentações.

Ícones em `src/LoreSymbols.tsx`: vaso com pergaminhos para pastas, pergaminho
fechado nas crônicas e aberto durante leitura, brilho quente/brasas como a
fogueira dos personagens, com movimento reduzido respeitado. Removidos a frase
do cabeçalho e o botão Abrir os arquivos. Lore ocupa toda a largura, sem limite
de 1600 px no contêiner nem faixas laterais. Testes dedicados API/interface em
banco descartável cobrem gestão, persistência, desktop de 1890 px e celular.
Detalhes em `docs/LORE.md`.

## Biblioteca regional de lore e editor medieval (03/10/2026)

Página de lore refeita com apresentação editorial inspirada em Overworld Audio:
arte ampla do projeto, granulação discreta, névoa e movimento suave nas imagens,
com respeito a movimento reduzido. `src/LoreLibrary.tsx` / `src/lore.css`.
As 22 regiões SQL organizam pastas Cidades, Capital, Religião, Lendas, Criaturas
e História; criação de pastas/subpastas até quatro níveis. Editor por blocos
com upload, retrato esquerda/centro/direita, paisagem inteira, meia paisagem
esquerda/direita, legenda, enquadramento completo e efeito opcional. Textos
livres, pergaminho escuro, inscrição e citação, com título/alinhamento; setas
reordenam, Desfazer recupera edição local e Prévia usa o renderizador publicado.

Migration 041 cria páginas, pastas, imagens e versões. Seed copia as duas
crônicas atuais uma única vez para História do Reino do Norte, sem apagar ou
sobrescrever texto. Rascunhos privados, leitura publicada para contas autenticadas,
edição pelo autor/staff; uploads seguem a visibilidade da página e são persistidos
no PostgreSQL, sem imagens de outras páginas. Transação/revisão protege contra
sobrescrita concorrente. Testes API e interface desktop/celular em banco descartável
com `npm run test:lore` / `-- --browser`. Detalhes e limites em `docs/LORE.md`.
Suíte geral: 41/43 aprovados; duas falhas preexistentes em world-fleet, não alterado.

## Capa solta e revisão visual antes de salvar (01/10/2026)

Direção obrigatória para capa: manto DESDOBRADO sobre a face externa/superior
das duas ombreiras e caindo solto sobre os braços superiores. Nunca tecido
enrolado em braço/cotovelo/antebraço/pulso, faixa, manga ou laço. Referência de
inventário dobrada fornece material/bordado/fecho, não caimento; referência de
aparência fornece identidade, não roupa ou ordem de camadas.

Todas as novas gerações passam por revisão visual separada via Codex antes de
`completeArt`. Verifica sobreposição, objetos cortados/duplicados, mãos extras
e, se há capa selecionada, cobertura das ombreiras e ausência de tecido enrolado.
Resultado reprovado é a única referência de uma edição localizada junto às falhas;
máximo de duas correções (três imagens no total). Sem aprovação, o job falha,
preserva cota e retrato anterior. Avaliação continua probabilística. Até três itens
podem seguir individuais; mais itens usam prancha sem ultrapassar cinco referências.
A correção preserva a figura e altera somente as regiões incorretas, sem reenviar
referências de vestimenta que induziram o defeito. Arquivos temporários
e resultado da revisão são descartados. Worker precisa reiniciar após atualização.

## Camada superior prevalece — direção vigente (01/10/2026)

Usuário revisou explicitamente a ordem da capa: passa POR CIMA da ombreira e
do braço, ocultando as partes cobertas pelo tecido. Todo item que sobrepõe outro
prevalece, mesmo quando a peça encoberta está marcada na seleção da geração.
Não trazer peças de baixo à frente para exibi-las, atravessar camadas, recortar
ou duplicar objetos. Regra sincronizada no prompt fixo, worker e descrição da
capa. Substitui a orientação anterior de capa sob as ombreiras.

## Roupa básica na geração inicial (01/10/2026)

Prompt fixo substitui vestimenta coerente com a classe por túnica/camisa simples,
calça e calçados simples. Classe não fornece armas, armaduras, capacetes ou
acessórios visuais; referências de estilo/aparência também não acrescentam
equipamentos. Somente itens explicitamente selecionados do inventário entram
nas gerações posteriores. Worker lê o prompt do disco a cada novo pedido.

## Imagem da capa e ordem física das camadas (01/10/2026)

Cosmético Capa de viajante apontava para `cloak-of-invisibility.png`, inexistente.
Catálogo corrigido para a arte existente `cloak-of-protection.png`; preservados
ID, preço, peso e caráter cosmético sem efeitos mágicos. Seed atualiza loja e
inventário sem alterar compras. Smoke verifica carregamento das cinco artes de
Cosméticos. A ordem da capa foi revista na seção "Camada superior prevalece";
objetos encobertos permanecem por baixo sem atravessar camadas, trazer acessórios
à frente, recortar o objeto superior ou interpenetrar volumes. Instruções no
prompt fixo, no worker e na descrição da capa; vale para novas gerações.

## Acabamento da frota e kraken sem cabeça (01/10/2026)

Removidas cabeça, olhos e onda circular do ataque; kraken aparece somente por
seis tentáculos. Superfícies contínuas, afiladas e animadas substituem os cilindros
visíveis; ventosas em duas fileiras e pele com manchas discretas e brilho úmido.
Barcos recebem madeira com veios/juntas, velas com trama e forma mais trabalhada,
metal envelhecido, linha d'água escura, janelas de popa e canhões laterais. Detalhes
calculados no material e modelados no 3D; nenhum sprite ou imagem sobreposta.
Mantidos tamanho dos barcos, rotas, golpes sem giro, mastros quebrando, destroços,
afundamento e respingos locais dos golpes. Recursos reutilizados e descartados
ao sair do mapa. Testes verificam remoção da cabeça/onda e ciclo da animação.

## Oclusão natural e integridade dos objetos (01/10/2026)

Anéis e acessórios selecionados podem ficar totalmente invisíveis quando
encobertos por escudo, luva, arma, roupa ou corpo. Seleção não obriga mostrar
cada detalhe; não forçar pose, deslocar anel, ampliar acessórios ou criar dedos.
Escudos e objetos segurados devem ser únicos e íntegros, sem recortes, buracos,
fragmentos separados ou duplicações para revelar o acessório atrás deles.
Enquadramento reserva margem para não cortar objetos. Regra presente no prompt
fixo, nas instruções do worker e nas descrições de mãos/anéis; vale para novas
gerações. Teste de integração verifica envio com escudo e anel selecionados.

## Ataque desordenado sem giro (01/10/2026)

Removida a curva angular comum que dava aos seis braços aparência de hélice.
Cada tentáculo agora dobra em uma faixa radial fixa, com balanço lateral curto,
ângulo inicial irregular e golpe em instante próprio, sem sequência circular.
Frequências e fases da agitação final também são independentes. Casco continua
inclinando com os impactos, mastros cedem, madeira salta e barco afunda como antes.
Teste acompanha as dobras durante toda a sequência e impede órbita dos braços.

## Correção da geração com muitos equipamentos (01/10/2026)

Reprodução real identificou recusa de dez referências pela ferramenta nativa,
que informou limite de cinco caminhos. Estilo e aparência usam duas posições.
Até dois equipamentos seguem em imagens individuais; acima disso, o worker
monta uma única prancha de todos os itens, numerada e sem cortar os modelos.
Descrições usam `reference_image: 3` e `reference_panel` para associar cada
posição ao painel. A prancha serve apenas de referência; saída continua uma
figura vestida, sem grade, etiquetas ou peças soltas. Mantidas escolhas de
capacete, imagem do inventário, cota preservada em falhas e descarte de arquivos
de referência após execução. Testes impõem máximo de cinco anexos e verificam
as quinze posições na prancha. Reiniciar o worker no host após atualizar código.
Validação: 36 testes isolados aprovados e geração nativa real concluída com os
oito equipamentos do pedido que falhou; PNG vertical 1024 × 1536 validado pelo
mesmo processamento do servidor. Worker local reiniciado com a correção.

## Descida agitada do kraken (01/10/2026)

Final do ataque mantém os tentáculos ativos: soltam o casco, abrem lateralmente
e recebem dobras que percorrem cada braço com frequências e fases diferentes.
Pontas levantam e batem na superfície durante a submersão, com respingos locais.
Corpo desce gradualmente e braços recolhem nos últimos instantes; ondas e
madeira flutuante permanecem na altura da água. Mantidos golpes iniciais,
tamanho dos barcos, duração de nove segundos e pausa por movimento reduzido.

## Golpes do kraken e barcos menores (01/10/2026)

Barcos reduzidos de escala 0,85 para 0,75 (aproximadamente 12%). O kraken levanta
os braços e desfere três golpes alternados, sincronizados com inclinação e recuo
do casco, respingos e doze fragmentos de madeira. Os mastros têm pivôs próprios
e cedem após os golpes; o barco mantém o tamanho enquanto afunda fisicamente.
Madeira flutua brevemente antes de desaparecer. Mantidos oito barcos, rotas
costeiras lentas, intervalo de 30 segundos e sequência de nove segundos.
Mastros e esteiras são restaurados quando o barco retorna. Geometrias reutilizadas,
partes agrupadas por material e respingos instanciados, sem criação de malhas
durante a animação. Testes cobrem impacto, destroços, mastros e recuperação.

## Viseira e navegação marítima (01/10/2026)

Personagem → geração oferece capacete fechado (viseira abaixada) ou aberto
(viseira levantada, casco mantido na cabeça) quando um capacete está selecionado.
Tiaras não mostram esse controle. `helmet_mode` é validado e persistido no pedido
pela migration 039 e segue até o prompt do worker. Padrão fechado para pedidos
antigos; modo aberto exige capacete selecionado. Não muda o item do inventário.

Mundo possui oito pequenos barcos piratas modelados em Three.js, com casco,
mastros, velas, cordame, bandeira e esteira discreta. `world-sea-routes.ts` usa
o relevo real e as ilhotas para calcular água navegável com folga do casco e
percursos até a costa, simplificados sem cortar terra. `world-fleet.ts` move os
barcos a 0,035 unidade/s, com balanço lento e aproximação suave das rotas.
A cada 30 segundos visíveis, um kraken emerge, envolve um barco com seis
tentáculos articulados e o afunda em uma sequência de nove segundos; o barco
retorna depois em outra rota com entrada gradual. Tempo pausa fora da visão e
com movimento reduzido. Modelos não interferem nos cliques dos territórios.
Partes estáticas dos barcos são agrupadas por material; geometrias/materiais
são descartados ao sair do Mundo. Não há sprites ou imagem sobreposta ao mapa.
Testes isolados: `npm run test:equipment -- --all`, `--armor` e `--fleet`
(para GPU real, `ATLAS_BROWSER_GPU=1`).

Correção de montagem da arte (01/10/2026): botas ficam imediatamente ao lado da
calça na grade de equipamento. A seleção de capacete prevalece sobre manter
rosto/cabelo visíveis; full plate respeita a escolha de viseira aberta/fechada.
`server/equipment-art.ts` descreve encaixe corporal por posição: um par de
ombreiras ajustado aos ombros, sem repetir as ombreiras presentes na referência
do peitoral nem desenhar peças soltas atrás da figura. O prompt geral foi corrigido
para não contradizer a cobertura do capacete. As instruções devem ser passadas
ao prompt da ferramenta de geração; CLI simulado verifica todas as referências
do conjunto. O worker fornece os caminhos locais de estilo, aparência e equipamentos
(em prancha numerada quando há mais de duas peças) e exige `referenced_image_paths`
na ferramenta. A geração continua probabilística e não há verificação automática
semântica do resultado. Artes concluídas anteriormente não são regeneradas.

Correção visual de 01/10/2026: somente as peças de full plate seguem a arte da
armadura. Luvas cosméticas de couro, colar de prata, tiara de prata e charuto de
tabaco têm designs independentes, gerados sem referência à armadura, sem bordas
douradas, rebites ou flores-de-lis. Novos arquivos `*-v2.png` em
`public/shop/equipment`, com referências atualizadas no catálogo; versões antigas
preservadas. Prompts em [EQUIPMENT-ART.md](EQUIPMENT-ART.md).

## Conjunto de placas, cosméticos e objetos nas mãos (01/10/2026)

Mochila possui 15 posições: acrescentadas ombreiras, braçadeiras e calça/pernas.
Full plate comprada entrega seis itens independentes: peitoral, capacete,
braçadeiras com luvas, calça, botas e ombreiras. Demais armaduras não entregam
peças extras. Preço do conjunto permanece 1.500 PO; peso de 65 lb é distribuído
nas peças. Migration 038 captura armaduras antigas de mochila/cofre e seed entrega
suas peças uma única vez. `purchase_item_grants` audita novas entregas nas mesmas
transações de checkout e compra individual, preservando idempotência e saldo.

Catálogo soma aos 65 originais cinco cosméticos sem magia (capa, colar, tiara,
luvas, botas) e charuto, totalizando 71 registros ativos. Cinco peças de placas
ficam inativas para compra avulsa, mas podem ser equipadas/transferidas. Extensão
portátil em `data/equipment-catalog.json`, artes transparentes em
`public/shop/equipment` e prompts em [EQUIPMENT-ART.md](EQUIPMENT-ART.md).
Tocha, lanterna, corda, gancho, charuto e outros objetos portáteis podem ocupar
as mãos. Braçadeiras de placas já cobrem as luvas e impedem outro par. Equipar
continua sem aplicar CA/bônus. As novas posições entram na seleção de referências
da arte. Build, 33 testes isolados e smoke de placas/cosméticos desktop/mobile
aprovados. Comandos e contratos em [EQUIPMENT.md](EQUIPMENT.md).

Placas do mural: fixações superiores ficam estáticas; a arte é renderizada em
camadas recortadas de pinos, correntes e placa. O balanço inclina as correntes
a partir da fixação e desloca placa/texto juntos, sem mover os pinos nem deformar
a madeira. Preservado reduced-motion (01/10/2026).

Espaços de equipamento agora usam o mesmo tom escuro e sombra interna dos
quadrados vazios da mochila. Ícones SVG específicos por posição (capacete,
armadura, espada, escudo, anéis, colar, capa, luvas, botas, mochila e bolsa)
substituem caixas e símbolos genéricos (01/10/2026).

Equipamentos usam o mesmo fundo da mochila/cofre e aceitam arrastar itens livres
da mochila para posições compatíveis. Categoria errada mostra aviso por 5 segundos
e não altera o inventário; itens do cofre exigem transferência prévia. As listas
continuam disponíveis no celular e teclado (01/10/2026).

Avisos de erro fora do formulário na aba Personagem, incluindo cota mensal,
desaparecem automaticamente após 5 segundos (01/10/2026). Erros dentro do
formulário continuam disponíveis para corrigir o envio.

## Liberação de imagens por conta (01/10/2026)

Por solicitação explícita, a conta Pai do Cris possui gerações sem limite mensal
do jogo. Migration 037 cria `character_art_allowances`, configurada diretamente
no banco para contas autorizadas; nenhuma rota pública concede a permissão.
Servidor e Personagem respeitam `art_unlimited` para todos os personagens da conta.
Demais contas mantêm duas imagens por personagem/mês. Limites do provedor, posse,
idempotência e uma geração em andamento por personagem continuam valendo.

## Equipamentos e referências da arte (01/10/2026)

Mochila possui 15 posições persistidas em `character_equipment` (migrations 036/038).
Equipar reserva unidades do inventário; a grade mostra unidades livres, o peso total
continua incluindo as equipadas e o cofre exige desequipar essas unidades antes de
transferir. Personagem permite marcar equipamentos antes de gerar arte; o servidor
salva as imagens reais do catálogo em `character_art_equipment`, e o worker anexa
essas referências com a posição de cada item, preservando o padrão visual fixo.
Não aplicar bônus mágicos/CA automaticamente nem conceder equipamento inicial de
ficha como compra. Capacetes de placas são entregues com a full plate; tiaras estão em Cosméticos. Detalhes e testes em
[EQUIPMENT.md](EQUIPMENT.md).

## Loja ilustrada — exportação de 29/09/2026

Por pedido explícito do usuário, o catálogo ativo foi substituído pelos **65 itens** da pasta fornecida Loja-Alvorada-Exportacao-20260929-094455. Fonte portátil em `data/shop-export/loja.json`, pesos em `PESOS.md`, imagens originais em `public/shop/items` (hashes conferidos). Dez categorias preservadas. Esta decisão substitui a antiga whitelist de oito itens; não representa implementação de suplementos ou dos efeitos mágicos descritos.

- `src/Shop.tsx` e `src/shop.css`: interior ilustrado, poções à direita, mercador à esquerda, catálogo central em pedra como a mochila e balcão em camada independente. Falas específicas por item e conversas vêm da exportação.
- Comprar/arrastar adiciona ao carrinho e à mesa; não debita ouro. Arraste limitado ao tampo, sem sobreposição; seleção mostra X para remover. Uma imagem por tipo e quantidade 1–99. Carrinho de cada personagem separado enquanto a loja está aberta; rascunho descartado ao sair/recarregar.
- Checkout `POST /api/shop/checkout` autentica titularidade, bloqueia personagem FOR UPDATE, lê preços ativos no servidor e debita todas as linhas em uma transação. Chave idempotente protege repetição. Migration 032 registra pedido e vincula cada compra ao pedido. Inventário e conquista de primeira compra atualizados na mesma transação.
- Itens antigos fora da exportação ficam inativos na venda; bens e histórico dos jogadores são preservados. Snapshot anterior `data/catalog.json` preservado; o seed agora usa a exportação.
- Orbe do dragão veio com preço nulo: pode ser examinado, mas bloqueia checkout até ser removido. Não inventar preço. Pesos estimados são identificados na loja; consulte PESOS.md.
- Testes: `npm run test:shop` usa banco descartável e Edge, cobre concorrência/idempotência, preço no servidor, saldo, validação, compra com múltiplos itens, mesa, remoção, quantidade e mobile. Suíte npm test (29 testes) passou em banco isolado.

Navegação: o botão principal antes chamado Aventura agora é **Mural**, com acesso
direto a `board`, sem submenu intermediário. Ícone simplificado de folha e pena,
`public/guild-icon-notice-board-v3.png`, substitui a espada. Quadros detalhados V1/V2 rejeitados. Transparência nativa,
mesma classe SVG/escala/hover dos outros ícones; atlas dos demais preservado.

## Patentes por missões (28/09/2026)

Missões agora exigem patente exata, sem acesso acima ou abaixo. Formulário seleciona
patente e mostra ouro fixo: Ferro 150, Bronze 230, Adamantium 300, Ametista 390,
Obsidiana 500 PO por inscrito. Servidor deriva o pagamento pela tabela e valida inscrição
e conclusão. Testes pertencem à patente de origem. Migration 030 converte missões antigas
normais para Ferro, preservando histórico de pagamentos. Ver `docs/PATENTES.md`.

Implementada progressão própria da guilda de nível 1 a 20: consultar `docs/PATENTES.md`.
Ferro, Bronze, Adamantium, Ametista e Obsidiana. **Correção expressa do usuário:**
nível 4 com 14 missões ainda conta missões normalmente; somente ao alcançar 22 libera
o teste para Bronze e congela a contagem até concluir o teste. Demais portões:
nível 8/53, 12/80, 16/102. Teste promove sem incrementar o contador.
No bloqueio e no nível 20, missões normais concedem somente ouro.
Migration 029 preserva o histórico; conclusão credita ouro persistido por participante
uma vez, sem XP novo. Testes de patente usam `board_posts`.
Mecânicas completas de classes nos níveis altos permanecem pendentes.
Apresentação da patente na ficha: painel independente de madeira escura acima do
pergaminho, com espaçamento, nível destacado e barra de progresso. Não usar outro
bloco de papel para esse resumo. Explicações no ícone de ajuda; composição empilhada no celular.

## Retomada futura: níveis altos e suplementos (28/09/2026)

O usuário pediu para guardar o estado real das regras e o que falta para ampliar o sistema.
Consultar `docs/ROADMAP-REGRAS.md` ao responder "o que temos que fazer?" ou "como está o sistema?".
A base atual cobre criação/ficha de nível 1 do SRD 5.2.1; não equivale a D&D completo.
O nível e a patente agora evoluem por missões; recursos de classe de níveis altos e suplementos
continuam como etapas futuras. Nenhum suplemento específico foi aprovado nesta conversa.

## Migração atual: SRD 5.2.1 / D&D 5.5e (2024)

Revisão da magia inicial: Acólito (padrão inicial do formulário) concede Iniciado em
Magia: Clérigo a qualquer classe, inclusive Bárbaro. Formulário agora explica origem,
2 truques + 1 magia de nível 1 e atributo escolhido. Bárbaro não pode conjurar/manter
concentração em Fúria; aviso incluído. Mago nível 1: 3 truques, 6 magias no grimório,
4 preparadas e 2 espaços de nível 1; explicação distingue esses números. Conferido nas
regras oficiais de 2024, páginas Character Origins, Feats e Character Classes do D&D Beyond.
Isso revisa magia de criação, não certifica todas as mecânicas ou níveis altos.

Por solicitação explícita do usuário, a referência vigente é SRD 5.2.1, substituindo 5.1/2014 em todas as regras implementadas. As seções antigas abaixo descrevem histórico. Ver `docs/SRD-2024.md` e `docs/ATTRIBUTION.md`. Criação de nível 1, nove espécies, doze classes, quatro antecedentes e talentos de origem do SRD; maestrias e conjuração revisadas, 83 magias de níveis 0/1. Subclasses não aparecem no nível 1. Evolução completa dos recursos de classe e combate automático continuam fora do escopo implementado.

Migration 025 arquiva personagem/ficha antigos, mantém dados rolados/atribuição/notas/arte/bens e pede revisão de escolhas; não converte uma espécie legada sem escolha do jogador. Novas fichas usam choices.version=2 e rules_version=5.2.1. Riqueza oficial de classe/antecedente é creditada uma vez na finalização de novos personagens (gold_cp=0 até então); migrados conservam o saldo, sem crédito novo. Endpoint rest-choices permite somente trocas legais de maestria, truque de alto elfo, um truque de mago e magias do tomo, sem alterar atributos, origem ou ouro. Descansos e efeitos são adjudicados na mesa.

Checkpoint anterior local: commit local identificado pela mensagem "Preserva ficha e conquistas antes da migracao SRD 5.2.1". Testes: matriz de espécies/classes/antecedentes/linhagens, migração SQL, ownership, concessão concorrente única de ouro e navegador desktop/mobile.

## Fundo publicado do Reino do Norte

A visão pública agora usa a imagem fornecida pelo usuário em `public/kingdom/north-sonnenberg.png` (1154 × 866), com proporção original, zoom e arraste. Sonnenberg é o único ponto para abrir o registro de missões do reino, incluindo publicação e histórico; o botão acompanha a projeção do mapa. Nenhum local SQL foi renomeado ou removido. O editor continua privado: ao abri-lo, carrega seu próprio fundo, rascunho e câmera; ao fechá-lo, volta ao mapa publicado. As descrições de área vazia abaixo se aplicam somente ao rascunho privado sem upload.

## Conquistas: troféus e arraste horizontal (28/09/2026)

Substitui a apresentação de medalhas descrita no histórico abaixo. Sete objetos ilustrados em `public/trophies/` (livro, bolsa, pergaminho, elmo, tomo com pena, baú e coroa), gerados com imagegen integrada; painéis usam `achievement-wood-v1.png`, madeira escura neutra. Acabamento selecionado tem apenas contorno, sem losango. Cada posição mantém sua prateleira e ganha coordenada horizontal contínua de 0–90%; pointer capture suporta mouse/toque e setas ajustam 1% (Shift: 5%). Sobreposições são permitidas, nomes aparecem no hover/foco e as bases acompanham os tampos da arte (34,2%, 55,6%, 76,2% da altura). Migration 026 acrescenta positions sem apagar slots antigos. Salvar persiste posições com validação de limites, titularidade e desbloqueio no servidor. Teste de navegador isolado cobre arraste, eixo vertical fixo, persistência, posições coincidentes, limites, isolamento e mobile. Prompts em `TROFEUS-PROMPTS.md`.

## Estado atual

Pergaminho da ficha (28/09/2026): emendas corrigidas por repetição espelhada nos dois eixos, solicitada pelo usuário. `character-parchment-mirrored.svg` compõe quatro cópias da textura original, sem alterar pixels; o bloco mede 1520px e cada cópia mantém a escala anterior de 760px. Gerador: `node scripts/build-parchment-tile.mjs`. Origem fixa no canto superior, sem mudar com a altura do formulário. Preservar nitidez: não usar `100% 100%`, `cover` ou esticar o papel para preencher o painel; tentativas anteriores foram rejeitadas.

Conquistas V2 segue referência ilustrada do usuário: estante medieval entalhada, 18 posições em três prateleiras (seis por linha, espaçamento compacto), catálogo abaixo. Cenário de casa medieval antiga em `achievement-house-v2.png` (enquadramento amplo, mais teto e piso); estante recortada com transparência em `achievement-cabinet-v3.png`, integrada à parede com sombra de contato e escala/posição vinculadas à projeção do chão, mantendo as posições interativas e o degradê escuro aprovado. Usuário escolheu modelo E para a primeira conquista: selo de cera bordô com pena em cobre e fitas, em `achievement-first-chapter-seal-v1.png`, aplicado no catálogo e na estante. Cada conquista deve ter identidade própria; esse modelo não é um padrão para todas. As outras conquistas usam `achievement-insignias-v2.png`: primeira compra em placa octogonal de bronze com bolsa/moeda; chamado em escudo de aço com pergaminho/espada. Todas compartilham acabamento em relevo minimalista, mas têm silhuetas e contornos de medalha distintos, sem ícone de linha sobreposto e sem seletor de moldura. Acabamento ornamentado dos controles foi rejeitado e removido. Configuração e catálogo seguem o inventário: textura de pergaminho aprovada com multiply em marrom neutro bem escuro (#29261f), sem matiz avermelhado, bordas discretas, controles simples e materiais selecionados pela amostra com borda/losango (rádio acessível oculto visualmente), busca compacta de 36 px com lupa alinhada; catálogo permite pesquisar por nome sem distinção de acentos/maiúsculas, combinado aos filtros de desbloqueio. Personalização recolhível via details/summary, inicialmente fechada, com chevron à direita. Nenhuma posição selecionada inicialmente; clicar novamente desmarca e salvar limpa a seleção. Indicador + centralizado geometricamente no slot; nomes das insígnias na estante aparecem somente no hover/foco. Migration 023 amplia a grade preservando prateleira e ordem dos itens anteriores. Tipo de estante mostra a atual e alternativas desabilitadas como Em breve. Campo legado medal_frame preservado no banco por compatibilidade. Arte V2 anterior preservada. Acabamentos visuais de nogueira, carvalho e ébano usam filtros sobre a arte; cada conquista possui sua moldura integrada à arte. Migration 022 estende a tabela 021 sem apagar configurações anteriores. GET/POST `/api/characters/:id/achievements` salva por personagem, valida titularidade, desbloqueio, códigos e posições únicas. `AchievementShelf` reutilizável para futura aba. `npm run test:achievements` cobre persistência, posições, isolamento, bloqueios e mobile em banco descartável.

Ficha em apresentação visual experimental: salvaguardas e perícias em cartões compactos com bônus destacados, confirmação para proficiência e setas duplas para especialização (legendas no ícone de ajuda). Sentidos em indicadores, idiomas em etiquetas e equipamentos em cartões com ícones. Combate acompanha o padrão: cartões de ataque com acerto, dano e tipo; traços em blocos com título e descrição, escolhas de terreno/inimigo identificadas. Regras e dados preservados. Checkpoint local antes desta apresentação: `codex/checkpoint-antes-ficha-visual` (`c2d85f0`).

Inventário compactado: mochila menor, 24 slots iniciais na mochila (quatro fileiras no desktop), largura máxima de 1160 px igual à ficha e base do painel alinhada à coluna da mochila, slots menores também no cofre. Mais itens expandem a grade sem limite artificial. Descrições e transferência por botão ficam em balões ao passar o mouse, focar ou tocar no item; arraste preservado. Inventários vazios mostram apenas os slots, sem mensagens explicativas.

Inventário redesenhado com cenário de espólios `public/inventory-loot-v1.png`, mochila
ilustrada `public/inventory-backpack-v1.png` e slots selecionáveis em `src/Inventory.tsx`.
Resumo de PO, peso em lb e quantidade fica acima da mochila, na coluna esquerda,
alinhado ao topo dos slots, com textura de pergaminho escurecido e ícones ilustrados
em `public/inventory-stat-icons-v1.png` (moedas, peso de pedra e suprimentos).
Mochila reduzida para até 280 px e afastada 54 px abaixo do resumo no desktop.
Painel de slots e histórico usam a mesma textura de pergaminho escurecido dos indicadores.
Seleção mostra descrição,
quantidade, peso total e valor unitário. Espaços vazios são decorativos, sem limite
novo de capacidade. Histórico de compras preservado e recolhido. Equipamento inicial
permanece na ficha, separado das compras.
Cofre compartilhado entre personagens da mesma conta, abaixo da mochila individual,
com a mesma textura. Migration 020 cria `account_vault` e auditoria `inventory_transfers`.
GET `/api/characters/:id/storage` retorna mochila e cofre; POST `/api/inventory/transfers`
move quantidades em transação, conferindo sessão, titularidade e personagem não excluído.
Locks na conta e no personagem serializam cofre, compras e exclusão. Chave idempotente
por conta impede repetir transferências. Movimentações não alteram PO nem histórico de compras.
Arraste ou botão abre seleção de quantidade; alternativa funciona com teclado e celular.
O resumo mostra somente peso/itens da mochila. O cofre guarda os itens que ficam em casa;
não há snapshot automático de equipamento de missão nesta etapa.
Validação: 18 testes de API em PostgreSQL isolado; `npm run test:inventory` verifica arraste,
transferência parcial, persistência, troca de personagem e celular em banco descartável.
Cabeçalho segue acampamento/ficha, sem subtítulo. Checkpoint anterior local:
`codex/checkpoint-antes-inventario`, commit `d2e1ef0`. Prompts em `docs/INVENTARIO-PROMPTS.md`.

Experimento de paleta global solicitado em 27/09/2026: primeira versão rejeitada
por excesso de marrom. Revisão com fundos carvão, painéis cinza quente,
ocre/amarelo queimado restrito a destaques e botões principais, aplicado a todas as abas,
menus e formulários. A ficha mantém o pergaminho aprovado; artes e dados preservados.
Ponto de retorno local `codex/checkpoint-antes-paleta-terrosa`, commit `fb075db`.
Aguarda avaliação do usuário; não reintroduz modo claro.

**Ficha** substitui Perfil. Fundo de biblioteca medieval em
`public/character-library-v1.png`; telas Atributos, Combate, Magias e História/equipamento.
Experimento visual de pergaminho na ficha: a primeira versão escura foi rejeitada.
A V2 usa papel claro envelhecido em `public/character-parchment-v2.png`, tinta marrom,
controles translúcidos e cores locais que corrigem a interferência azul do tema.
Prompt em `docs/PERGAMINHO-PROMPT.md`; biblioteca e tema geral permanecem escuros.
Estilos isolados
em `src/character-parchment.css`. Ponto anterior: branch local
`codex/checkpoint-ficha-antes-pergaminho`, commit `bc96894`; remover o import desse
CSS restaura o visual anterior sem alterar dados. Textura V2 aprovada pelo usuário;
removido o relevo de folhas empilhadas, textos escurecidos para melhorar o contraste
e título “Ficha” sem ponto final.
Cabeçalho da Ficha usa a mesma largura do acampamento: máximo de 1524 px, margens
laterais de 24 px (14 px até 760 px). Conteúdo centralizado, mais estreito, com máximo
de 1160 px; título e seletor mantêm o enquadramento largo.
Cabeçalho separado do conteúdo por 80 px na ficha, ampliado a pedido do usuário.
Legendas e notas auxiliares da ficha ficam no ícone de informação ao lado do título
correspondente (hover, foco pelo teclado ou toque). `SheetHelp` usa popover nativo,
fecha com Escape/clique fora e mantém o balão dentro da tela. Valores e avisos de
confirmação definitiva permanecem visíveis.
Cabeçalho da Ficha alinhado verticalmente ao seletor de personagem no desktop,
com título no tamanho do acampamento e sem subtítulo. No celular, empilha como no acampamento.
O modal de criação usa até 960 px, com três colunas de opções no desktop e largura adaptável no celular.
Não repetir o cabeçalho de identidade dentro da ficha: o personagem ativo aparece
no seletor superior; os dados detalhados permanecem nas seções da ficha.
A criação coleta escolhas de nível 1 do SRD 5.1: origem, treinamento, equipamento,
perícias, idiomas/ferramentas e magias. Novos jobs exigem escolhas válidas; o worker
as salva após concluir a arte e recebe sub-raça/ancestralidade validadas.
Migration 019 cria `character_sheets`. Na Ficha, rolar uma única vez seis grupos de
4d6, descartar o menor, distribuir e confirmar. Dados gerados no servidor com
`crypto.randomInt`, persistência e bloqueio por personagem; refresh/clique duplo
nunca rerrolam. Bônus raciais, PV, CA, salvaguardas e perícias são derivados.
Personagens antigos completam escolhas sem perder arte, XP, saldo ou inventário;
atributos/PV/CA só mudam ao confirmar. Recursos de sessão, preparação e notas
são salvos com titularidade no servidor. Escopo é ficha inicial nível 1;
progressão e efeitos automáticos de combate continuam fora. Ver `CHARACTER-SHEET.md`.
Validação: build, 17 testes de API em banco isolado e `npm run test:sheet` (Edge,
criação real com arte de teste, persistência, magias/notas e quatro seções mobile).

A barra superior extensa foi substituída por um painel compacto de personagem
e conta no canto superior direito: seletor, nível/raça/classe e saída. No
acampamento em desktop ele flutua sobre o cenário; em telas estreitas ocupa
uma linha própria para não cobrir o título. O menu inferior mantém a navegação.
O acampamento exibe somente o título e capacidade; o status do ilustrador aparece
apenas dentro do modal de gerar imagem. Foram
removidos o subtítulo da fogueira, a orientação de escolher aventureiro e a frase
da cota mensal. O seletor do painel não acende ao abrir ou passar o mouse.

A aba Personagens agora é um acampamento ilustrado com figuras de corpo inteiro.
O cenário `public/character-camp-v2.png` tem fogueira central, personagens em
dois lados e brasas animadas discretas (desativadas com movimento reduzido).
O enquadramento alinha a base do fogo ao chão das figuras por tamanho de tela;
as colunas compartilham a linha de chão mesmo quando os textos quebram linhas.
As figuras e suas sombras usam redução global de 20% para combinar com o cenário,
preservando a escala relativa por raça e a ancoragem dos pés no chão.
Os painéis abaixo das figuras usam escala de 85%, incluindo textos, ações e ícones.
Limite de dois personagens por conta; dois pedidos de imagem por personagem por
mês civil UTC (imagem inicial incluída, falhas liberam cota). Novos personagens
são criados somente após a arte ficar pronta; antigos sem imagem mostram silhueta.
Migration 015 guarda referências privadas, fila e imagens no PostgreSQL. Um agente
local em `npm run art:worker` chama a geração nativa de `codex exec` com login
ChatGPT, sem API key. Depende do host ligado e da assinatura do operador; não roda
dentro do Docker. Prompt fixo `docs/CHARACTER-ART-PROMPT-v1.md`, referência visual
`docs/references/character-style-v1.png`. Consulte `docs/CHARACTER-ART.md`.

O acampamento alinha títulos e rodapé à largura/margens do cabeçalho superior
(máximo 1524 px). Placeholder ilustrado em `public/character-silhouette-v2.png`.
Não exibir contadores de imagens nem datas de renovação; exibir erro ao exceder.
Status do ilustrador apenas no modal de gerar imagem, com ponto
verde online/vermelho offline (exceção de cor solicitada para esse indicador).
O fundo cobre toda a viewport, inclusive atrás do cabeçalho. O acampamento
distribui a altura disponível sem rolagem da página; figuras se reduzem conforme
a tela. Silhuetas pretas com contorno cobre iluminado apenas em hover/foco.
As figuras compartilham a mesma linha de chão e escala por estatura racial em
`shared/character-stature.ts`: halfling 92 cm, gnomo 107, anão 137, humano/elfo/
meio-elfo/tiefling 175, meio-orc 190 e draconato 200. São referências visuais
compatíveis com as descrições de 2014, não alturas individuais oficiais fixas.
O prompt exige anatomia racial adulta e enquadramento uniforme. Artes existentes
recebem a escala imediatamente; proporções anatômicas novas dependem de nova arte.
Cada cartão oferece Excluir personagem, confirmado pelo nome. Migration 016
marca `deleted_at`: remove o personagem da seleção e libera a vaga, bloqueia
compras, novas inscrições e geração de arte, mas preserva auditoria e missões
anteriores. A imagem é removida. Pedidos de arte em andamento impedem a exclusão.
Avisos de falha existem apenas no estado do frontend por cinco segundos (ou até
fechar no X), quando um pedido observado em andamento falha. Falhas antigas nunca
são notificadas ao carregar a página. Não há dispensa persistida nem localStorage.
A fila mantém o registro técnico da tentativa, sem consumir cota em falhas.
Migration 018 remove a antiga coluna de dispensa criada pela 017.
O worker distingue falha de sessão, limite, conexão, resultado, caminho do arquivo
e validação da imagem. Logs guardam apenas ID e código do motivo; nunca a conversa
do agente, referências ou credenciais. Falhas antigas com mensagem genérica não
permitem recuperar o motivo exato. A referência continua sendo descartada após falha.
O ilustrador usa eventos JSON do CLI para identificar a sessão exata e obter o
PNG nativo de `generated_images/<threadId>`, mesmo se a resposta textual final
do agente for incorreta. Só aceita um único artefato daquela sessão e mantém
a validação de transparência/formato antes de salvar. Nunca busca a imagem mais
recente globalmente. O UUID da sessão fica no diretório local privado do pedido.

O portal usa React/TypeScript, Node.js, PostgreSQL e Docker Compose. O único território com visão regional é o Reino do Norte. O Mundo continua em Three.js/WebGL, com 22 territórios, relevo, oceano e nuvens. Preserve a silhueta em `docs/references/world-silhouette.png`, a geografia em `public/atlas-world-v2.png` e os materiais em `public/atlas-materials/`. A visão inicial do Mundo é 100%, com zoom máximo próximo de 246% e navegação elástica. Consulte `docs/ATLAS-WORLD-RELIEF.md` e `docs/ATLAS-TERRITORIES.md`.

## Reino do Norte e editor

A composição regional ainda não foi definida. O mapa abre como uma área vazia de 4096 × 3072 px virtuais, sem imagem, pintura, objetos automáticos ou névoa. O usuário autorizado pode enviar PNG/JPEG/WebP como fundo e posicionar sprites com oito vistas dos atlas `public/kingdom/nature.png` e `public/kingdom/structures/atlases/`. Fundos enviados mantêm a proporção original (`tilt=1`); a área vazia usa projeção inclinada (`tilt=0.58`). O zoom de trabalho vai de 0,03 a 32, e **Definir visão atual como 100%** salva zoom, centro e giro. **Remover fundo (área vazia)** apaga somente o upload de fundo do autor; os itens do rascunho permanecem. Consulte `docs/KINGDOM-2D.md`.

**Apenas `correa.l@icloud.com` pode usar o editor neste momento.** A interface esconde o botão para outras contas, e o servidor responde 403 em todas as rotas de rascunho, fundo e visão do editor. A comparação de e-mail é insensível a maiúsculas/minúsculas. O projeto ainda usa rascunhos e fundos privados por usuário: salvar no editor não publica automaticamente a composição para os demais jogadores. O acesso a imagens privadas também é restrito no servidor. Os dados existentes no PostgreSQL não foram apagados pela limpeza de arquivos.

O editor oferece colocação, arraste direto, seleção múltipla com Ctrl + mouse, movimento por setas, duplicação, escala, direção, exclusão, desfazer, upload de fundo e zoom. As migrations 011, 013 e 014 guardam rascunho, fundo e câmera privados. A área virtual usa `15000/3072` unidades por pixel de imagem para aceitar fundos grandes. O mapa e o Mundo têm renderizadores independentes; o reino usa Canvas 2D. Não há fallback de terreno costeiro nem asset padrão.

## Regras e dados a preservar

Better Auth gerencia sessões. Consultas privadas filtram pelo usuário autenticado. Compras usam transação, bloqueio de linha, idempotência e auditoria, com valores inteiros em peças de cobre. Missões, eventos e ganchos compartilham `board_posts`; a geografia vive em `world_regions` e `world_locations`. O servidor resolve o local e deriva a região. Novas missões têm data/hora; o autor conclui, recebe resumo e credita XP uma vez. Eventos exigem `guild_staff`. Os seis locais regionais e missões existentes permanecem no SQL, acessíveis por **Missões do reino**, ainda sem marcadores no mapa.

## Validação

`npm run build` verifica TypeScript e gera cliente/servidor. `npm test` exercita autenticação, isolamento, editor e regras com PostgreSQL real. `npm run test:browser` cobre o fluxo geral. `npm run test:editor` verifica pela interface o editor autorizado, zoom, upload proporcional e restauração vazia em uma instância de teste. `ATLAS_BROWSER_GPU=1 npm run test:atlas -- --world-map-only` verifica o Mundo com GPU real; `--terrain-only` verifica navegação da área regional vazia e `--editor-only` verifica que uma conta comum não recebe acesso ao editor. A API autorizada do editor é testada em `tests/integration.test.ts` com um e-mail de editor temporário injetado apenas na instância de teste; o app real mantém o e-mail fixo acima.

Dados de jogadores e volumes Docker não devem ser apagados. Migrations aplicadas não devem ser modificadas; adicione uma nova quando necessário. O histórico de mapas descartados pode ser consultado nos commits Git anteriores, sem carregar seus grandes arquivos no checkout atual.

### Novas metas de conquistas

- Catálogo com 7 conquistas e insígnias próprias; atlas `achievement-milestones-v1.png` para as quatro novas.
- Veterano do Norte: 10 participações em missões concluídas no Reino do Norte, verificadas por `mission_rewards` e região do mural.
- Conte uma história: uma missão concluída como autor/mestre da conta; disponível para seus personagens.
- Fortuna em circulação: compras acumuladas do personagem somando 100.000 PC (1.000 PO), sem contar saldo, transferências ou pedidos repetidos.
- Honra do Norte: meta de 300 de reputação cadastrada, explicitamente Em breve. Ainda não há sistema nem regra de ganho de reputação; aguarda definição do usuário.
- Migration 024 amplia códigos. A rota autenticada reconcilia conquistas históricas ao abrir/salvar estante, com progresso calculado no servidor, titularidade e concessão idempotente.

Catálogo de conquistas paginado em cinco itens por página, com Anterior/Próxima e contador. Busca, filtro e troca de personagem retornam à primeira página; paginação é aplicada após os filtros.

Controles de expandir/recolher padronizados globalmente em src/disclosures.css: sem triângulo nativo à esquerda; chevron à direita herdando a cor do painel e girando quando aberto. Aplicado à ficha, escolhas, histórico do inventário e personalização da estante; preserva details/summary e teclado nativos.

Mercenários removido completamente a pedido do usuário: sem aba, navegação, tipo de página ou seed demonstrativo. Migration 027 remove somente registros de world_entries dessa seção e a exclui das seções permitidas; personagens de jogadores não são afetados.

Mural visual (28/09/2026): NoticeBoard atende board/missions/hooks com três folhas PNG (Ganchos, Missões, Eventos), títulos manuscritos, hover quente/foco e painel por categoria com filtros e ações existentes. Cenário ativo notice-village-corner-v2.png: mural velho preso à parede da taverna num canto da vila, rua lateral e avisos decorativos. Usuário rejeitou o mural isolado no centro da praça; preservar integração à parede. Publicação reutiliza PostForm e board_posts; Eventos só oferece publicação a staff/admin, Ganchos continuam da conclusão. Nenhuma alteração no Mundo/atlas ou banco. test:notice-board usa banco descartável e cobre folhas, filtros básicos, formulário, permissão visual, foco e mobile. Prompts em NOTICE-BOARD-PROMPTS.md.

Revisão do mural V3: usuário rejeitou cenário V2 preso à parede e fonte manuscrita. Ativo notice-village-tavern-v3.png, com mural independente de dois pés apoiados no calçamento, junto à entrada da taverna. Letras das categorias em Cinzel com sombra de entalhe, sem inclinação. Folhas reposicionadas para a área central da madeira. Preservar pés e posicionamento lateral contextualizado.

Mural V3 ajustado: cenário e folhas agora compartilham um plano fixo, ampliado e centralizado no mural; página sem scroll em 100dvh. Papéis com inclinações/alturas diferentes e filtro de envelhecimento para aproximar os avisos laterais. Categorias abrem dialog nativo acima de tudo (showModal), X/Escape/clique fora fecham, foco retorna à folha; só o conteúdo do pop-up rola. Teste verifica ausência de scroll na página e publicação em dialog sobreposto.

Mural aproximado novamente (escala desktop max(145vw,180dvh)); pop-up, cabeçalho e cartões usam a textura achievement-wood-v1.png com madeira escura das conquistas e especificidade que sobrepõe o tema global dos dialogs.

Folhas do mural V2: novas artes hooks-v2.png, missions-v2.png e events-v2.png em public/notices, geradas tomando o cenário como referência. Papel plano, marrom sujo, manchas e bordas discretas, sem grandes dobras; sombra reduzida e tom integrado aos avisos laterais. Posições/enquadramento aprovados preservados.

Menu Aventura agora contém somente Mural. Cabeçalho: Mural Alvorada (inclusive nos links antigos missions/hooks). Títulos das folhas usam IM Fell English SC local em public/fonts, fonte antiga sob OFL, com desgaste e entalhe aprofundado.

Folhas V3 ativas em public/notices/*-v3.png: desenhos em tinta marrom forte, estilo xilogravura (chave/trilha, espada e lanterna), substituindo aparência de lápis rejeitada. Títulos clareados em ocre com entalhe discreto para melhorar leitura; removido preenchimento listrado/transparente e sombra profunda que se confundiam com a madeira.

Folhas V4 ativas: public/notices/*-v4.png. Predomínio de escrita envelhecida, símbolos pequenos (chave, espada e lanterna) integrados ao papel, tinta mais discreta. Hover suavizado para evitar brilho excessivo. Substitui os grandes desenhos em xilogravura rejeitados.

Revisão funcional do Mural: renderização dos cartões não repassa mais o índice do map como opção compacta (seta indevida nos cartões seguintes). Todos exibem inscrição, autoria, ações e histórico completos. Feedback de ações aparece dentro do dialog; abertura foca o título, fechamento restaura a folha. Textos longos e metadados ajustados para telas estreitas. test:notice-board cobre publicação real, inscrição persistida, iniciar/encerrar, filtros, ausência de cartões compactos, permissões visuais, dialogs sobrepostos, Escape, foco e mobile; testes em PostgreSQL descartável. Build e 22 testes de integração aprovados.

Títulos das categorias do mural agora ficam sobre as próprias folhas, abaixo do prego, em tinta marrom-escura (notice-paper-title), substituindo o texto sobre a madeira. Papel e título compartilham hover e inclinação. Artes V4 e cenário preservados. Build e teste de navegador do mural aprovados.

Ajuste dos avisos: folhas dimensionadas pela largura e proporção fixa, sem altura percentual que as alongava; títulos ampliados de 8,8 para 14cqw. Conferência visual e teste do mural aprovados.

## Mural com avisos reais — 28/09/2026

- As três folhas fixas foram removidas. Cada board_post aberto/em andamento aparece como papel clicável; concluidos/encerrados ficam no histórico das listas. Não foram criadas tabelas paralelas nem alteradas regras de publicação de eventos/ganchos.
- Cenário ativo: public/notice-village-empty-v4.png, sem nenhum papel decorativo pintado. Enquadramento afastado para max(130vw,145dvh); superfície útil acompanha a imagem (left 28,3%, top 29,5%, width 31,7%, height 27,2%). No celular há placas inferiores para acessar listas.
- Migration 028_board_papers acrescenta paper_style (seis modelos), paper_summary opcional (180 caracteres), paper_x e paper_y em board_posts. Coordenadas 0–1 representam o espaço de deslocamento disponível: o papel inteiro permanece na madeira. Posições iniciais são persistidas; sobreposição é permitida.
- PATCH /api/board/:id/paper valida coordenadas/modelo e atualiza somente WHERE author_id = usuário da sessão. Não aceita troca de autor. O navegador restringe arraste e setas ao autor, mas a segurança é aplicada também no servidor.
- Publicação reutiliza PostForm, com seis prévias de papéis e resumo curto. O autor também pode trocar o papel em Aparência do papel, dentro do aviso aberto. Ganchos continuam sendo criados exclusivamente ao concluir uma missão.
- Placas de madeira: Missões, Ganchos e Eventos; listas com pesquisa por nome sem diferença de acentos, filtros Atuais/Todos/Histórico, seis registros por página e Localizar no mural (traz o aviso ao foco, sem mudar a posição salva).
- Testes: build aprovado; 23 testes PostgreSQL aprovados em banco descartável, incluindo autoria, limites e persistência dos papéis; test:notice-board cobre arraste até as bordas, recarga, clique no papel, escolha de modelo, publicação, ciclo básico, pesquisa/paginação com mais de 30 avisos, localização, foco e mobile.

Placas do mural presas à travessa inferior: menu passou a ser filho do plano do cenário, em left 27% / top 57,2% / width 34%, com arte transparente public/notices/wood-plaque-v1.png (madeira gasta e dois pregos). Enquadramento afastado mais 8%: max(120vw,135dvh); mobile max(100vw,102dvh). Build e teste do mural aprovados.

Placas reposicionadas na lateral direita da moldura, com inclinações -5°, +4° e -3°, projetando-se para fora. Enquadramento reduzido para max(114vw,125dvh), mobile max(100vw,85dvh). Removida a publicação no cenário: Registrar missão aparece no topo das três listas (Missões, Eventos, Ganchos) e abre sempre formulário de missão. Staff conserva Registrar evento na lista de eventos; ganchos continuam exclusivos da conclusão. Teste de navegador confirma os três acessos.

Placas do mural agora menores e suspensas por dois conjuntos de elos na travessa inferior (left 30,5%, top 63%, width 27%). Hover/foco aplica balanço amortecido de 1,4 s; prefers-reduced-motion desativa o movimento. Cabeçalhos dos pop-ups sem faixa própria: fundo transparente, sem borda e sem sticky, preservando a madeira contínua do painel. Build e teste do mural aprovados.

Placas V2: substituídos elos SVG e tábua repetida por três ilustrações com correntes, parafusos e desgaste próprios (public/notices/hanging-{mission,hook,event}-v2.png). Âncoras alinhadas no centro da travessa em top 58,15%; primeira em altura intermediária, segunda mais baixa/larga, terceira mais alta/estreita. Balanço preservado com pivô nas ferragens superiores. Cenário desktop afastado para max(100vw,150dvh), centralizado sem bordas vazias; mobile 78dvh. Build e fluxo de navegador aprovados.

Textos das placas centralizados em caixas correspondentes à madeira de cada sprite (sem contar correntes). Terceira placa escurecida via filtro somente na imagem, preservando legibilidade do texto. Build e teste do mural aprovados.

Centralização horizontal do mural: cenário desktop deslocado para translateX(-44,15%), alinhando o centro da superfície de madeira ao centro da tela, sem mudar escala nem posições relativas de papéis/placas.

Correção do deslocamento excessivo: translateX desktop ajustado para -46%. Faixa descoberta à esquerda preenchida com continuidade espelhada da borda do próprio cenário, sem ampliar o mural. Conferência visual em navegador, build e teste do mural aprovados.

Correção definitiva do cenário do mural: ativo public/notice-village-complete-v5.png, arte completa com continuação original da taverna à esquerda. Removido o preenchimento espelhado rejeitado. Superfície recalibrada para left 35,9%, width 31,7%; placas left 38,1% (mobile 36,6%). Centro do painel em 51,75% da arte, alinhado ao centro da viewport; desktop max(104vw,150dvh) garante cobertura total. Conferência visual e teste de navegador aprovados.

Ajustes finos: enquadramento deslocado ligeiramente à esquerda (-52%, cobertura mínima 104,25vw). Ferragens de Ganchos e Eventos subidas respectivamente 0,12cqw e 0,3cqw para alinhar os pontos de fixação aos da primeira placa sobre a travessa.

Ficha: espaçamentos entre campos e parágrafos compactados, rótulos de 14 px e títulos de 15–17 px acima das opções de 13 px. Bônus do antecedente agora usa um seletor único com sete distribuições válidas (+2/+1 em atributos diferentes ou +1 nos três), impedindo combinações inválidas durante a edição. Validação do servidor preservada; fluxo de navegador verifica as sete opções e a troca entre distribuições.

Criação de personagem padronizada com a ficha: dialog usa character-sheet/sheet-panel, mesma textura espelhada de pergaminho, largura máxima de 1160 px, tipografia, seletores compactos e grade de escolhas em duas colunas. Formulário reutiliza sheet-form-reset; não manter um tema genérico separado para a criação.

Rolagem de atributos: AttributeDice mostra seis resultados em sequência por clique; cada lançamento exibe quatro dados com seis faces CSS 3D, queda/giro/quique em dialog sobre toda a interface e descarte do menor. Distribuição aparece após seis revelações. Servidor continua gerando e persistindo os 24 dados uma única vez; animação não sorteia valores. Recarga recupera os resultados e Rever rolagens em 3D apenas repete a apresentação. Movimento reduzido respeitado. test:sheet verifica as seis revelações contra os valores SQL, recarga, conclusão e telas desktop/mobile. Em 28/09, a pedido do usuário, reset pontual de rolls/assignment somente onde finalized_at IS NULL para testar a animação; fichas confirmadas preservadas.

Escolhas após descanso longo movidas para dentro do papel da ficha, recolhidas ao final da seção correspondente: maestrias em Combate e opções de conjuração em Magias. Removido o painel solto acima dos indicadores de PV/CA.

Cabeçalhos padronizados em src/page-header.css: título até 32 px e HUD de personagem/conta reduzido cerca de 20%, margens laterais independentes do conteúdo (até 95 px, aproximadamente 2,5 cm CSS). Desktop alinha os dois lados da viewport; telas até 900 px mantêm HUD e título em linhas separadas. Ícone Mural V3: folha de pergaminho e pena simples, PNG alfa, mesma renderização SVG do menu.

## Pendências e notificações — 29/09/2026

Sino junto ao seletor de personagem, contador e painel de madeira com avisos de todos os personagens ativos da conta. GET /api/notifications consulta somente personagens do usuário autenticado e deriva etapas exclusivas: origem/revisão, rolagem, distribuição/finalização. Teste de patente aparece somente ao atingir o requisito (22/53/80/102); some após promoção. Aviso de nível alcançado usa notification_level_read (migration 031) e leitura persistente pelo endpoint de titularidade /characters/:id/notifications/level-read. Não confundir marcar nível como lido com executar evolução de classe: recursos de nível alto seguem pendentes de desenvolvimento, não são uma tarefa delegada ao mestre. O usuário decidiu implementar essa evolução depois. Pendências não podem ser dispensadas sem resolução. Atalhos selecionam o personagem correto antes de navegar; atualização ao abrir, trocar página, recuperar foco e refresh de 60 s. Painel fecha ao clicar fora/Escape, com retorno do foco. Build, 29 testes em PostgreSQL descartável e navegador desktop/mobile aprovados.

### Ajuste do mercador (29/09/2026)

NPC sério em `public/shop/merchant-v2.png`, apoiado com os antebraços sobre o balcão e renderizado acima do tampo. Clique no próprio NPC abre as perguntas; contorno no hover/foco indica interação. Falas em balão próximo à boca, sem botão Conversar permanente. Loja central ampliada proporcionalmente. Arte/prompt em `docs/SHOP-ART.md`.

### Escala e falas da loja

NPC ampliado em aproximadamente 19% no desktop, mantendo apoio no balcão. Falas em texto menor, contidas à esquerda do catálogo, com ponta contornada; duração total de quatro segundos e saída por opacidade, reiniciando em cada interação. Perguntas permanecem abertas até escolha/novo clique, separadas do temporizador da fala. Itens com base visual 15% maior; escala adicional moderada por tipo (poções/anéis base, armas +12%, armaduras +18%, espadas/arcos/cajados/baús +22%). Limites e colisões da mesa consideram o tamanho de cada item. Carrinho único no topo; acesso inferior removido.

### Enquadramento revisado do mercador

Altura do NPC no desktop acompanha a distância entre header e bancada, com cabeça próxima ao header e mãos no tampo. Catálogo reduzido em 10% em largura e altura. Balão na diagonal acima/à direita, fundo com 88% de opacidade. Conversa exibe somente as três perguntas, espaçamento compacto, sem divisória superior; hover/foco e estado pressionado destacam a opção.

Balão revisado: corpo e ponta usam um único path SVG com preenchimento semitransparente e contorno contínuo, evitando emenda entre elementos. Texto de fala/opções em 11px, pergaminho claro para maior contraste. NPC deslocado 20px para baixo para que os antebraços avancem sobre o tampo, mantendo escala.

Último ajuste da loja: NPC ampliado mais 35px mantendo a posição dos braços sobre o tampo, cabeça mais próxima ao header; catálogo estendido verticalmente até 10px antes da bancada. Instrução “Arraste para a mesa ou clique em Comprar...” removida do rodapé do catálogo.

Duração vigente dos balões da loja: 15 segundos por fala, reiniciada em cada interação, com fade no final (substitui os quatro segundos anteriores).

Composição vigente: catálogo reduzido proporcionalmente em 15%, ancorado no topo/centro, afastando-o do tampo. Balão ampliado horizontalmente; topo fixado na lateral superior direita do NPC, abaixo do header, para crescer somente para baixo. Cor das falas igual às opções de diálogo (#f6e8ce), mantendo 12px e duração de 15s; substitui o branco puro anterior.

Layout responsivo da loja revisto: retirada a escala .85 e a âncora inferior ligada à bancada. Catálogo usa largura natural responsiva (até 840px) e altura limitada a 480px/área disponível; ao reduzir zoom, não se estica até a mesa. Regras próprias para tablet/celular. Falas justificadas, última linha à esquerda, peso normal, entrelinha 1.5 e hifenização.

Falas da loja: alinhamento à esquerda, sem justificação nem hifenização automática, conforme correção do usuário.

Itens na mesa ampliados mais 20%: base 110,4px desktop / 82,8px celular, preservadas escalas por item e colisões correspondentes. Catálogo não alterado neste ajuste.

## Composição da loja pela referência (29/09/2026)

Revisadas proporções do cenário: bancada com 37% da altura em desktop, apenas tampo até a borda inferior da tela; NPC inteiro à esquerda (sem deslocamento negativo/corte), escala limitada por 35vw/64dvh e mãos sobre o tampo. Poções mantidas à direita por preferência anterior. Loja na região central (55% horizontal), largura até 38vw/740px e altura até 40dvh/430px, separada da mesa por área visível do cenário. Título sobre o catálogo evita cobrir a cabeça. Cards horizontais e categorias compactas. Tablet/mobile têm composição própria; a mesa mantém arraste, limites e tamanhos dos itens. Verificado também em 1740×852, proporção da referência, com teste de NPC sem corte lateral, tampo 37% e distância do catálogo à bancada.

## Integração original da loja — pacote 20260929-115851

Pedido mais recente substitui as tentativas anteriores de composição: usar os arquivos reais de Loja-Codigo-Integracao-20260929-115851. Imagens copiadas byte a byte (SHA-256 conferido) para `public/shop/reference/`: `shop-counter-v2.png` contém cenário E tampo; não existe mais uma mesa/imagem separada. NPC original `shop-merchant-v1.png` à DIREITA, como no pacote, substituindo a orientação antiga. CSS `src/shop-reference.css` preserva as regras originais de cenário (`center 35%/cover`, 65% em telas >=2:1), vendor (`right:1%;bottom:31%;width:min(44vw,68dvh)`), media queries, balão, Georgia, ponta e perguntas. Falas e footprints em `src/shop-presentation.ts` copiados da fonte; duração original max(8500ms, caracteres*65) substitui ajuste anterior de 15 segundos por pedido de copiar o comportamento original. Fontes locais e licenças arquivadas em `public/shop/reference/fonts`; famílias web prefixadas para não mudar outras páginas.

Exceções expressas: catálogo central existente e header padrão do site preservados. Camadas separadas para que áreas transparentes do NPC não impeçam clicar no catálogo. No celular o catálogo cabe acima do personagem. Área interativa do tampo: 36% desktop/35% mobile; medidas dos objetos seguem `shopFootprints` e unidade 1.3 do pacote. Checkout atual autenticado/transacional preservado; não aplicar migrations de referência sobre as migrations existentes. Original possui controles administrativos de preço/endpoints próprios, que não foram importados para o servidor atual.

Validado com build e teste de loja em PostgreSQL isolado, desktop 1440×900, referência 1740×852 e mobile 390×844.

### Itens na mesa restaurados

Restaurada a apresentação anterior: quantidade no canto, destaque discreto de seleção e X circular sobre o item selecionado. Removida a legenda inferior. Tamanhos anteriores e colisões correspondentes restaurados, mantendo o cenário, NPC e balões do pacote.

### Enquadramento abaixo do header

Cenário e NPC descem juntos até o topo visível da cabeça tocar o limite inferior do HUD no desktop. ResizeObserver recalcula em mudanças de viewport; se a imagem expuser o topo, sua escala proporcional aumenta preservando o deslocamento da borda do balcão. NPC deslocado à direita com parte do braço fora da tela; balão acompanha por estar dentro do mesmo elemento. Área dos itens acompanha o tampo e fica acima da transparência do NPC para permitir clicar no X.

Texto do balcão restaurado: apenas com a mesa vazia, frase discreta e centralizada Escolha seus itens e coloque-os sobre o balcão. Removidos título Seu balcão e legenda no canto.

Ajuste mais recente: painel desktop restaurado para min(840px,50vw), altura até 480px conforme espaço disponível, centralizado. Texto do balcão removido por completo. Cabeça do NPC com folga de 0,75cm CSS (28,35px) abaixo do header; cenário/tampo acompanham. Todas as falas e opções reduzidas em 2px, inclusive o título das perguntas.

Refinamento: distância do NPC ao header reduzida para 0,50cm CSS. Painel desktop ampliado 1,5cm para baixo, preservando topo/largura. Balão, título e opções usam Inter local, entrelinha 1,3, padding compacto e gap de 4px entre opções.

Balão: Inter regular 400 real via fonte variável local (o pacote só continha 600/700). Falas com padding 12px 14px; título O que deseja saber? com margem inferior extra de 4px.

Ajuste fino: padding das falas 10px 12px. NPC mais à direita (right -6%, mobile -20px); balão desktop aproximado do NPC (right 58%) para liberar o painel central.

Posição horizontal desktop do NPC/balão agora calculada pela borda real do catálogo e largura do balão: mantém 0,5cm CSS livres. NPC e balão movem juntos, recalculando ao abrir diálogo, trocar fala e redimensionar; mobile preserva composição própria.

HUD global simplificado: removidos escudo, Seu aventureiro e linha de nível/patente/espécie/classe. Mantidos nome/seletor, notificações e sair. Seletor reduzido a 132px e altura mínima do HUD a 46px. Detalhes continuam na lista aberta de personagens.

Header compacto: título reduzido a 21–26px sem margens verticais; faixa desktop de 50px, mesma altura do HUD, alinhamento central e sem sobra inferior.

Balão unificado em um único path SVG responsivo: corpo e ponta usam o mesmo preenchimento translúcido e contorno contínuo, eliminando diferença de opacidade e sobreposição na junção.

Título da loja sem ponto decorativo. Painel completo do catálogo reduzido proporcionalmente em 10% (escala 0,9 com origem no topo/centro), incluindo textos e controles. Alinhamento do balão usa a borda visual escalada do painel.

Fontes de todo o catálogo aumentadas 10%, sem alterar escala/dimensões externas. Prateleiras desktop passam de 126px a 138,6px; área de itens recebe o restante da grade. Tablet lateral 100→110px; mobile mantém prateleiras horizontais.

Prateleiras: mais 1px em título, categorias e contadores; largura lateral ampliada outros 10% (desktop 152,46px, tablet 121px), descontando da área de itens sem mudar o painel externo.

Repetido a pedido: prateleiras recebem mais 1px nas fontes e mais 10% de largura (desktop 167,706px, tablet 133,1px); área dos itens absorve a redução.

Tipografia das falas e opções do NPC suavizada: Inter variável de peso 400 para 350, mantendo tamanho e espaçamentos.

Títulos atualizados: Ficha de Personagem no header da ficha; Mapa Alvorada no mapa-múndi, sobreposto sem bloquear navegação e alinhado ao padrão do header. Visão do reino conserva o título regional.

Ações do header padronizadas: sino e sair em botões 30x30px, mesmo fundo/borda/raio/hover; ícones 14px com traço 1,75.

Último ajuste do header: gap de 5px entre seletor e ações, botões de 26x26px e ícones de 12px.

HUD: padding reduzido em todos os lados para 4px 6px; restaurada abaixo do nome somente a linha Nível X · Classe. Sem patente, espécie, escudo ou rótulo Seu aventureiro.

HUD refinado: nome 11px com linha de 16px; nível/classe 8px, gap zero, linhas alinhadas à esquerda e conjunto centralizado verticalmente. Padding atual 4px 6px 4px 11px.

Seta do seletor centralizada nas duas linhas; lista aberta de personagens reduzida integralmente em 40% com origem no canto superior direito.

Lista de personagens: escala corrigida de 0,6 para 0,84 (+40% sobre o tamanho anterior). Compactação feita nos espaços: padding externo 3px, opções 6px 8px sem altura mínima de 60px, gap de 6px e distância do seletor 5px.

Fonte dos balões e opções restaurada para Georgia regular, original do pacote de importação; preservados tamanhos, padding, contorno e posições ajustados. Lista de personagens abre alinhada à esquerda do seletor com origem superior esquerda.

Corrigido header de Personagens: removida a disposição antiga em coluna que centralizava título/contador. Título segue a faixa e margens compartilhadas do header, topo 20px, contador ao lado em vez de abaixo.

Contador de personagens movido para uma linha própria abaixo de Seu acampamento, fora do header e alinhado à esquerda do título.

Vaga de criação no acampamento agora usa CharacterSilhouette com + central e contorno/brilho ao hover/foco. Removido cartão Uma nova história; botão mantém nome acessível Criar personagem e fluxo de criação existente.

Silhueta de criação refinada: removido o +; escala reduzida de 0,8 para 0,7 e deslocamento 18px para baixo, mantendo clique e brilho de hover/foco.

Silhueta de criação deslocada mais 12px para a esquerda, preservando escala e altura aprovadas.

## Enquadramento responsivo da loja (30/09/2026)

shop-responsive.css concentra o layout atual: catálogo sem escala, margens do cabeçalho, vendedor ao lado e balcão ancorado à mesma coordenada do fundo (63,2% da imagem original). Removidos deslocamentos em centímetros e ajuste recursivo baseado no balão. Até 1100px, catálogo fica acima do vendedor; no celular categorias rolam horizontalmente e os itens usam uma coluna. Telas baixas permitem rolagem vertical. Smoke isolado verifica sete viewports de 390 a 2560px e mantém a cobertura de compras e arraste.

Ajuste posterior: profundidade do tampo varia de 145 a 300px com a largura da janela. Sua textura usa camada independente do interior para não ampliar com a altura da página. Vendedor avança 14% da própria largura sobre o tampo para apoiar os braços; itens acompanham a escala disponível.

Vendedor ampliado em desktops (até 32vw/51% da altura da cena), categorias com mais largura em 1440px. Ponta do balão calculada pela posição real do vendedor: inferior quando acima, lateral quando ao lado. Teste inclui 1440x900 e 1920x1080 e verifica direção da ponta e enquadramento.

Balões medem o espaço livre entre catálogo e rosto: priorizam posição lateral quando há largura útil; caso contrário ficam acima. Texto completo sem max-height ou rolagem interna, incluindo respostas longas.

Cartões do catálogo agora usam grade com altura pelo conteúdo, detalhes em fluxo normal e quebra de textos/botões. Catálogo com menos de 620px úteis muda para uma coluna. Smoke verifica os limites de texto, preço e botão dos 65 itens em onze resoluções, inclusive 320px e 1110px.

## Estábulo (30/09/2026)

Menu Loja abre Empório e Estábulo (#stable). Stable.tsx/stable.css exibem campo gramado, quatro artes individuais (cavalo de montaria, guerra, pônei e mula), retratos de cabeça, Brida com falas próprias e comentários determinísticos sobre nomes. Ficha consulta preço, porte, CA, PV, deslocamento e capacidade SRD 5.2.1. Compra separada em /api/stable/purchase: preço no servidor, bloqueio do personagem, transação e idempotência; migration 033 salva animal, nome, valor e chave em character_mounts. GET /api/stable/:characterId exige titularidade. Montarias permanecem salvas no personagem; não automatiza combate/movimentação nem inclui arreios. test:stable usa banco descartável, cobre economia/ownership/nomes/persistência/menu e seis viewports. --unit no runner roda a suíte Node no banco isolado. Assets e prompts: public/stable e docs/STABLE-ART.md.

Refinamento do estábulo: removido o painel Seu estábulo e a ficha lateral permanente. Botão ? sobre o animal abre ficha/compra em modal; nome da espécie centralizado no alto. Animal e tratadora ampliados, com composição vertical em celulares. Duas pelagens ilustradas por espécie, selecionáveis no campo e persistidas pela migration 034; idempotência também verifica a pelagem. Smoke isolado cobre seleção, persistência da cor, modal e seis viewports (320 a 1920px). Prompts em docs/STABLE-COATS-ART.md.

Estábulo: pelagens e botão ? reunidos no menu de montarias, sem link de retorno ao Empório. Layout refeito para 100dvh, removendo o padding inferior global de 155px nesta página. Em celulares o menu fica compacto acima do campo; a cena não exige rolagem vertical. Balão ancorado ao centro da tratadora, cores das figuras harmonizadas com o entardecer e sombras de contato. Smoke valida ausência de rolagem, acesso aos controles e compra em seis resoluções.

Selaria (30/09/2026): fundo public/stable/paddock-earth.png cria chão natural de terra. Nome e compra saíram da ficha e ficam sob o título; removido COMPANHEIRO DE ESTRADA. Loja de seis equipamentos abaixo das montarias, com preview por espécie e pelagem; troca por slot e retirada com segundo clique. Equipamentos e custo salvos pela migration 035, preço autoritativo, débito total atômico e idempotência incluindo seleção. SRD, limites do catálogo e prompts em docs/STABLE-TACK-ART.md. Teste isolado cobre seis itens em quatro animais, compra/persistência e seis viewports.

Correção visual da selaria: encaixe por peça/espécie, rotação individual, proporções preservadas e camada do pescoço/crina acima da barda. Fundo ativo paddock-eye-level.png com câmera mais baixa; figuras reposicionadas no solo e sombra da silhueta. Testadas 24 prévias individuais, quatro conjuntos em pelagens alternativas e seis viewports. Prompts em STABLE-TACK-ART.md.

Selas integradas (30/09/2026): 16 novas artes completas, quatro espécies × duas pelagens × duas selas, substituem a sobreposição da sela. Seleção troca a imagem inteira; bardas continuam como camadas. Campo de nome acima das montarias na coluna esquerda e compra abaixo da selaria. Smoke cobre as 16 imagens, posicionamento dos controles e seis viewports. Prompts e arquivos em docs/STABLE-SADDLED-ART.json.

Bardas integradas (30/09/2026): couro, cota de malha e placas agora usam artes completas por espécie e pelagem, 24 combinações em public/stable/barded. Não há mais barda avulsa sobreposta à silhueta. Sela selecionada junto da barda continua em primeiro plano. Manifesto e prompts do imagegen integrado: docs/STABLE-BARDED-ART.json. Smoke valida as 24 imagens e os conjuntos com sela.

Seleção da selaria: sela e barda são alternativas na interface. O último clique substitui a seleção anterior e troca a arte inteira; removida a camada de sela sobre a barda. Preço/compra acompanham somente a seleção atual, ração independente. Teste cobre as duas direções de troca nas quatro espécies.

## Acabamento inspirado no Inkarnate (30/09/2026)

Direção vigente: acabamento construído diretamente no 3D. A imagem Inkarnate foi retirada do material e permanece somente como referência histórica (docs/ATLAS-INKARNATE.md). src/world-relief.ts usa cores por bioma, fotografias CC0 de solo/rocha projetadas em três eixos, fissuras e estratos calculados no shader, erosão nos vértices e copas de árvores em duas malhas instanciadas com sombras reais. src/world-ocean.ts calcula espuma costeira irregular animada. Preservar geografia, territórios e navegação; não reaplicar a imagem completa sobre o terreno. Detalhes e validação em docs/ATLAS-3D-MATERIALS.md.

## Refino de costa, árvores e deserto (30/09/2026)

Ondas costeiras agora têm cristas móveis acompanhando a costa, variação orgânica e espuma com antialias. Árvores menos densas (espaçamento 0,085 e probabilidade menor), copas menores e textura procedural de folhagem. Fronteiras do território em hover ficam mais largas e recebem passe transparente acima das copas, sem interceptar cliques. Deserto tem dunas assimétricas na geometria, grãos e ondulações no material. Por pedido explícito, o vulcão Fulkushima, lava, rochedos associados, águas rasas e marcador foram retirados do Mundo; as duas ilhotas cônicas no extremo sul também foram removidas. Os registros SQL e a tag mapa-3d-2026-09-30 são preservados. São 21 marcadores visíveis; a lista histórica continua com 22 IDs. Esta decisão substitui a antiga exigência de preservar o vulcão na cena.

## Correção de ondas e copas (30/09/2026)

Usuário rejeitou as faixas brancas das ondas e o acabamento das árvores. Oceano deixa de usar frentes baseadas em distância costeira; ondas de vento em duas direções e ruído animado modificam a normal da água. Espuma restrita a manchas discretas no encontro com a costa. Copas refeitas com sete grupos de folhagem nas árvores largas e nove nas coníferas, tronco, proporções variáveis e detalhes de normal no material. Mantida densidade reduzida e fronteiras em hover acima das copas. Não restaurar os contornos brancos nem os modelos simples de esfera/cone.

## Água e bosques mais cheios (30/09/2026)

Copas 28% mais largas, altura ligeiramente menor e árvores aproximadas em pequenos bosques determinísticos. Mantida exatamente a quantidade de instâncias: redistribuição aproxima cada árvore do centro local e rejeita movimentos para costa, neve ou encosta íngreme. Oceano ganha ondulações finas, movimento de luz turquesa nas águas rasas e rugosidade variável para reflexos; sem reintroduzir contornos brancos. Fronteiras no hover permanecem acima da vegetação.

## Vegetação contínua — direção vigente (30/09/2026)

Usuário rejeitou miniaglomerados e pediu remover as árvores para refazer o visual naturalmente. Removidas todas as malhas de árvores individuais, galhos, instâncias e agrupamento em bosques. Vegetação agora integra a malha do terreno: cobertura por bioma, clareiras amplas, exclusão de desertos/neve/encostas íngremes, corredores junto aos rios, relevo sutil e textura procedural contínua de copa. Não voltar aos grupos de árvores isoladas. Água, fronteiras, navegação, SQL e ponto de restauração permanecem preservados.

## Árvores visíveis — correção da intenção (30/09/2026)

Usuário esclareceu: remover os modelos e miniaglomerados anteriores significava refazer árvores visíveis, não eliminá-las. Direção vigente mantém cobertura vegetal no chão e árvores 3D distribuídas em áreas amplas de floresta pela mesma cobertura contínua, com clareiras e exclusão de costa/neve/encostas íngremes. Quatro variações de copa larga/conífera, copas mais cheias, tamanhos e orientação variáveis; sem atração para centros locais nem miniaglomerados repetidos. Mantidos água, fronteiras acima das copas, navegação e ponto de restauração.

Loja possui shop-layout como área comum de catálogo, NPC e balão. Correção explícita do usuário: somente headers são padronizados; conteúdo da loja alinha às extremidades do header, sem o limite de 1524px da Ficha/Inventário. Recuo desktop usa page-header-edge; até 900px acompanha os 18px do header. Fundo e tampo continuam cobrindo a tela. Mantidas as quebras de linha e regras responsivas existentes. Catálogo 8% mais estreito no desktop, mantendo a borda esquerda; folga permite deslocar o balão 24px mais para a esquerda do rosto, com a ponta acompanhando a boca. Posição acima fica restrita à falta de espaço lateral nas telas estreitas. npc-speech.css compartilha acabamento do estábulo e Inter local nos dois balões, incluindo perguntas. Nomes: Desconhecido na loja e apenas Brida no estábulo.

Header único em src/PageHeader.tsx, renderizado uma vez por App.tsx como elemento semântico header com título e controles de personagem/conta. Escala e margens seguem a Ficha: 42px de altura, título 21–26px, topo 20px e recuo page-header-edge; até 900px controles acima do título, topo 14px e recuo 18px. page-header.css concentra a geometria, independente do padding e da largura dos conteúdos. Acampamento e Mundo deixaram de renderizar títulos separados; contador do acampamento permanece abaixo, fora do header. Espaçadores mantêm a posição dos conteúdos convencionais. Smoke verifica header único e alinhamento de 13 abas em quatro viewports, além da loja em onze resoluções; test:stable valida a composição do estábulo em seis viewports.

Refino do balão da loja: largura lateral reduzida em 20% (mínimo 160px), mantendo a borda esquerda e recuando a borda próxima do rosto. Ponta curta de 10px, semelhante à do estábulo, sem prolongamento até a boca. Inter e acabamento compartilhado preservados.

NPC da loja ampliado visualmente em 15%, com origem no canto inferior direito para manter o apoio na mesa. Correção do usuário: balão acompanha o rosto da imagem ampliada, preservando a posição relativa ao NPC; coordenadas medidas na arte e convertidas para a âncora do contêiner.

Menu de conta convertido em ProfileMenu: retrato circular de 48px do personagem selecionado, usando o endpoint privado da arte e recorte do rosto no navegador. Sem arte, ícone provisório. Hover/foco abre nome, nível/classe, notificações e sair para a esquerda, mantendo a posição do retrato. Canto esquerdo com raio de 9px; seta de seleção removida. Clique no retrato abre a lista de personagens abaixo dele, em balão com ponta e acabamento do painel do menu principal. Seleção e notificações mantêm o painel aberto durante uso. Controles e fontes ampliados em cerca de 15%; dropdown limitado ao viewport. Smoke da loja cobre hover, abertura pelo retrato, troca de personagem/retrato, fallback, notificações e limites no celular.

Refino do perfil (01/10/2026): expansão mostra somente notificações e sair, centralizados verticalmente; nome, nível e classe retirados desse painel. Revelação de 480ms parte da borda do retrato para a esquerda, como se os controles saíssem da bolinha. Após a animação, não recorta o painel de notificações. Clique no retrato mantém a lista em balão; navegação por teclado acontece na lista e retorna o foco ao retrato.

Estábulo (01/10/2026): conteúdo usa o mesmo recuo lateral do header (page-header-edge no desktop e 18px até 900px), preservando cenário em tela inteira e quebras responsivas existentes. Balão da Brida ancorado à direita do campo para não ultrapassar o limite. Painéis de nome, catálogo, selaria e checkout usam achievement-wood-v1.png com a mesma sobreposição escura do menu do mural.

Refino do estábulo (01/10/2026): balão lateral à esquerda de Brida, com ponta alinhada à boca usando as dimensões reais da arte contida; acompanha os tamanhos responsivos. Removida a interrogação junto à pelagem. Botão Ver detalhes junto a Comprar conjunto abre a descrição e ficha da montaria e inclui nome, descrição, preço e peso da sela selecionada, quando houver.

Correção explícita do balão da Brida (01/10/2026): manter a posição anterior acima da cabeça, ancorado à direita do campo; não colocar ao lado nem grudar na boca. Ponta curta inclinada para a boca, deslocada de acordo com o rosto da arte, preservando a distância visual entre balão e NPC.

Perfil (01/10/2026): barra expansível reduzida para 38px de altura, retrato mantém 48px. Exibe Nível e classe em uma linha, sem o nome, junto às notificações e saída; todos centralizados verticalmente.

Conquistas (01/10/2026): altura do palco da estante recalibrada para o espaçador do header compartilhado (42px + 27px), corrigindo o deslocamento vertical criado pela substituição do header antigo. Base desce 35px no desktop e 29px no celular, com sombra de contato menor e mais concentrada junto aos pés.

Detalhes e falas do estábulo (01/10/2026): Ver detalhes inclui todos os equipamentos selecionados (sela, barda e ração), com descrição técnica, peso e preço. Brida usa comentários narrativos bem-humorados próprios por item em stableGearComments, em vez de recitar a descrição técnica; ao retirar um item, comenta sua remoção. Smoke cobre a descrição de placas, a troca por sela e a distinção entre fala narrativa e regras.

Perfil (01/10/2026): patente substitui o nível na barra expansível, calculada por rankName; classe aparece abaixo em 9px. Botões de notificações e saída reduzidos de 30px para 24px, com ícones de 12px. Mantidos alinhamento vertical, barra de 38px e retrato de 48px.

Perfil (01/10/2026): patente refinada para 10px e classe para 8px, diferença exata de 2px. O painel expansível usa flex com align-items:center para centralizar o conjunto de texto e botões na altura disponível de 38px.

Mochila (01/10/2026): dez espaços visuais adicionais, mínimo de 34 em vez de 24, sem alterar capacidade real de itens ou dimensões externas do painel. Grade desktop passa de seis para sete colunas e até 1000px passa de quatro para cinco; mantém altura disponível anterior e reduz os slots para acomodar as novas linhas. Cofre preservado.

Cofre (01/10/2026): mínimo visual ampliado de 24 para 36 espaços, adicionando uma linha de doze no desktop; mantém adaptação existente para tablet/celular e expansão para acomodar mais itens.

Equipamentos (01/10/2026): painel compacto com a arte privada do personagem no centro (silhueta existente quando não há arte) e quinze slots em colunas laterais. Ícones e miniaturas substituem categorias e selects permanentemente visíveis. Clique abre popover nativo com categoria, itens compatíveis e desequipar; Escape/clique externo fecham, e o arraste da mochila mantém validações do servidor. Layout adaptado ao celular. Teste de equipamento cobre equipar por popover, arraste, persistência e geração com referências.

Refino do inventário (01/10/2026): painel de equipamentos substitui a ilustração da mochila na coluna esquerda, abaixo do resumo. Largura máxima reduzida para 460px, slots de equipamento quadrados. Mochila completa agora 35 espaços (7 × 5 no desktop); células da mochila e cofre usam aspect-ratio:1, sem esticar a altura para preencher o painel. Removida a nota inferior de equipamentos. CharacterArtButton permite gerar/nova imagem pelo inventário com o mesmo endpoint, limites, referência obrigatória, escolha de equipamentos e viseira do acampamento, e acompanha o andamento para atualizar a arte. Smoke verifica geração com referências a partir do inventário, localização do painel e geometria quadrada da mochila.

Mochila (01/10/2026): linha adicional preenche a folga inferior do painel; mínimo visual agora 42 espaços, grade desktop de 7 × 6, mantendo células quadradas e cofre com 36 espaços.

Ilustrador no inventário (01/10/2026): botão de geração informa quando o worker está offline, evitando bloqueio sem explicação. Worker local reiniciado; iniciar/reconstruir Docker não inicia esse processo no host.

Prompt de arte simplificado (01/10/2026): ficha/raça/linhagem/tamanho prevalecem sobre características incompatíveis da referência. Aparência fornece apenas características físicas; classe orienta postura sem inventar equipamento. Sem armadura selecionada, roupa básica de pano. Estilo, transparência, corpo inteiro, referências dos itens, viseira e oclusão natural preservados. Removidas repetições no prompt fixo, instruções dinâmicas, posições de equipamentos e revisão/correção. Tamanho SRD explícito e estatura visual ajustada à opção Pequeno. Testes do ilustrador simulados e equipamentos passaram; resultado artístico real ainda depende da próxima geração. Backup anterior: backup-prompt-imagem-2026-10-01.

Roupa básica da arte (01/10/2026): usuário especificou trapos velhos, camisa branca e calça cinza, folgados e gastos como pijama rudimentar, sem adornos ou acabamento elegante; substitui a descrição genérica de roupa medieval simples.

Correção da geração com capa (01/10/2026): dois pedidos produziram múltiplos arquivos na mesma sessão Codex e terminaram com JSON de erro, ignorando arte nativa; saída também tinha fundo opaco. Recuperação passa a selecionar o último artefato apenas da sessão exata do pedido. Transparência real é verificada antes de aceitar e falha entra nas até três tentativas existentes de correção. Inventário exibe erro do pedido mais recente mesmo após recarregar; tentativas falhas preservam cota. Regressão simula múltiplos arquivos, JSON de erro e correção de alfa, sem geração paga.

Inventário (01/10/2026): resumo de ouro/peso/itens e painel de equipamentos usam fundo cinza neutro com a textura existente, dessaturada pelo blend luminosity e sobreposição escura; conteúdo e miniaturas mantêm suas cores.

Mensagens globais (01/10/2026): FlashMessage/FlashMessages substituem erros e feedback de ações inline das páginas e modais. Notificações no topo direito entram pela direita e somem após 5 segundos, com botão de dispensar, empilhamento e deduplicação. Host usa popover manual no top layer, sem roubar foco, para aparecer sobre dialogs; respeita movimento reduzido e viewport mobile. Estados de carregamento e texto narrativo permanecem nos componentes. Teste de equipamentos verifica posição e desaparecimento do erro global.

Correção do cinza do inventário (01/10/2026): removido viés azul dos fundos de resumo/equipamentos; sobreposição e base usam canais RGB iguais (#262626 e #383838), mantendo a textura dessaturada.

Transferência mochila/cofre (02/10/2026): arraste ou botão transferem imediatamente toda a pilha disponível; Shift transfere uma unidade em ambas as direções. Equipados continuam excluídos da quantidade disponível. Modal de quantidade aparece apenas para corrigir/repetir uma falha. Teste isolado cobre pilha inteira, Shift no arraste e clique, persistência e mobile.

Geração sem piscar (02/10/2026): App mantém Details durante atualizações do mesmo personagem; inventário só desmonta ao trocar de personagem. Poll do ilustrador atualiza estado antes do refresh e recarrega dados apenas ao terminar, evitando ciclo de remount/avisos repetidos. Regressão verifica identidade do painel durante queued/running/completed/failed e aviso sem reaparecer. Prompt exige margem de 8% para capa/armas e correção pode afastar câmera. Última falha real foi composition_rejected; cota preservada.

Oclusão de equipamentos (02/10/2026): regra explícita em prompt, descrição por slot, revisão visual e correção. Capa cobre ombreiras/armadura; luvas, inclusive integradas às braçadeiras, cobrem anéis. Qualquer acessório naturalmente encoberto pode permanecer invisível, sem abrir/deslocar/transparecer outra peça para exibi-lo.

Inventário e dragão (02/10/2026): resumo/equipamentos com textura roxa escura por pedido do usuário. Mundo recebe createWorldDragon: modelo 3D articulado, circuito suave XY, altitude acima do relevo, asas batem por 3s e planam por 6s, cauda acompanha voo e sombra projetada dinâmica independente do shadow map estático. Pausa com movimento reduzido/aba oculta e descarte de geometrias/materiais ao sair. test-world-dragon-isolated.mjs valida voo/asas/planar/zoom/mobile em banco descartável.

Refino de inventário e criaturas do Mundo (02/10/2026): substituído o roxo por carvão com transparência de 72–78% nos painéis de resumo/equipamentos. Dragão reduzido de escala 1,12 para 0,38, sombra proporcional, malhas mais suaves e relevo procedural de escamas/membranas. Barcos recebem madeira/tecido com relevo iluminado, guarda-corpos e cordames adicionais; kraken recebe pele rugosa, manto e olhos discretos. Ataque agora dura 13s: após o barco sumir em 7s, tentáculos continuam com ritmos independentes e amplitudes variáveis enquanto o corpo afunda, com respingos e pequenas ondas superficiais. Preservados rotas, geografia, movimento reduzido e descarte de recursos. Teste unitário de braços/afundamento e smoke isolado da frota verificam a sequência.

Texturas e saída do kraken (02/10/2026): substituídas as linhas senoidais repetidas por ruído filtrado e três texturas raster próprias geradas por imagegen (carvalho envelhecido, pele de cefalópode e escamas). Assets em public/atlas-model-materials, projeção triplanar em barco/dragão e UV fixo nos tentáculos para evitar que a textura deslize durante deformação. Mipmaps e filtragem anisotrópica; descarte das texturas junto aos materiais. As membranas das asas têm malha subdividida curva. Na saída, tentáculos abrem radialmente até extensão de 1,2–1,5 unidades, sem torção lateral por fase; o meio e a ponta levantam juntos e batem na superfície com ritmos independentes. Teste mede extensão monotônica, deslocamento amplo do meio dos braços e ritmos opostos. smoke-world-models.mjs renderiza os modelos de perto sem banco de dados para QA de textura e shaders.

Correção da saída do kraken (02/10/2026): direção vigente é bater no centro onde estava o barco, substituindo a extensão radial para fora. Braços se desdobram em arcos flexíveis com deformação no comprimento inteiro, em planos radiais fixos e ritmos independentes. Pontas convergem para raio menor que 0,12 no centro do naufrágio, com ondas/respingo ali. Navio desaparece em 7s e todo o movimento/afundamento termina em 10s: máximo 3s após a destruição. Teste verifica direção para dentro, curvatura, movimentos do meio e prazo de encerramento.

Nova finalização do kraken (02/10/2026): sequência coreografada de um último golpe por braço, em seis tempos diferentes no centro do naufrágio, seguida de dobra e mergulho individuais. Retirada começa entre 1,25 e 1,85s após a destruição e termina antes de 2,9s. Geometria desce totalmente sob a água antes de ocultar o grupo, sem retomar a pose de ataque. Onda de espuma irregular se expande no plano da água, independente da altura do kraken, e desaparece suavemente até o limite de 3s. QA inclui capturas próximas da retirada e testes de submersão em tempos distintos.

Refação vigente do kraken e do dragão (02/10/2026): finalização anterior substituída por controles Bézier quarticos em src/world-kraken-ending.ts. A dobra acompanha a ponta com atraso, um golpe para cada braço em seis tempos irregulares, pontas no centro do naufrágio e mergulhos individuais completos antes de 2,85s. Encerramento permanece em no máximo 3s após a destruição. Espuma superficial calculada no shader, fragmentada por ruído, com pequenas manchas centrais. Dragão mantém escala cartográfica 0,38, mas usa perfis anatômicos curvos densos, cabeça com mandíbula, narinas, olhos/fendas, dentes, patas e garras; asas subdivididas com membrana até o corpo. Albedo do couro reptiliano e da membrana em 2048px; normal e rugosidade derivadas da textura em 1024px, aplicadas aos materiais físicos com UV, mipmaps e anisotropia. Não afirmar que são mapas escaneados nem um modelo de cinema. Assets e origem em public/atlas-model-materials/manifest.json.

Música geral (02/10/2026): faixa completa enviada pelo usuário convertida para public/audio/medieval-travelers-journey.ogg (Ogg/Opus). SiteMusicProvider mantém uma única instância de áudio acima das páginas, volume inicial 40%, loop e continuidade entre rotas. Botão de mutar junto ao perfil superior direito; preferência de mute local (não dados do jogo), preservada ao recarregar. Navegador inicia após interação se bloquear autoplay; pausa ao ocultar a página. siteSoundtracks aceita substituições futuras por rota, atualmente todas usam a mesma faixa. Não adicionar áudio ambiente paralelo às áreas sem coordenar com esse provider. Origem da faixa registrada em public/audio/manifest.json.

Início reformulado e sombra da estante (02/10/2026): HomeJournal substitui o antigo dashboard por um jornal de atualizações com destaque lateral, cartões em paisagem/retrato/notas, artigos, imagens com links e encontros com data, local e exportação de calendário. Editor permite upload PNG/JPEG/WebP/AVIF, galeria local, imagem inteira ou preenchimento, lado da imagem, prioridade/ordem, alinhamento, tamanho do texto, negrito/itálico/título/lista/citação/link e prévia. Texto renderizado com elementos React seguros, nunca HTML arbitrário. Publicações compartilhadas entre jogadores autenticados; autor edita/remove as próprias e staff existente pode moderar, sem promover usuários. Migration 040 cria home_updates e home_images; uploads convertidos em WebP no servidor (8 MB/20 MP máximos), arquivos não publicados ficam privados. Revisão otimista protege edições simultâneas. Agenda preserva as missões das próximas 24h, sem criar missões paralelas. Três exemplos de navegação aparecem apenas enquanto não há publicações, sem inventar eventos reais. Sombra de contato da estante ancorada ao piso da base (4,6% do quadro), sem elipse afastada na frente. smoke-home.ts em banco descartável verifica interface, autoria, links inseguros, upload privado/publicado, revisão, calendário, persistência e celular; captura da estante revisada em desktop/mobile.

Música e saída agitada do kraken (02/10/2026): controles de volume de 0–100% no login/apresentação e junto ao retrato, com volume e mute persistidos no navegador, padrão 40%. A loja (#shop) usa exclusivamente medieval-market.ogg, faixa completa fornecida pelo usuário; entrada toca uma vez shop-door-bell.wav (síntese original de sino metálico de 1,65s), a 80% do volume escolhido e respeitando mute. Sem repetição a cada clique. Uma única instância de música troca a fonte por rota; demais áreas mantêm a faixa anterior. Origem em public/audio/manifest.json. Teste isolado valida extremos, persistência, login, celular, troca de faixa e sino único.

Direção vigente da finalização do kraken: substituída a sequência de um único golpe por ciclos contínuos e caóticos de braços inteiros, com tempos, amplitudes e dobras diferentes. Sem pausas aguardando a próxima batida; curvas Bézier movem todo o comprimento. Mantidos golpes no centro do naufrágio, retirada escalonada e submersão completa antes de 2,85s após destruir o barco, encerrando em até 3s. Testes medem movimento de todos os braços em intervalos sucessivos, curvatura, direção e prazo; verificação visual dos modelos e smoke da frota em banco descartável.

Kraken recolhe destroços (02/10/2026): três dos seis tentáculos alcançam tábuas flutuantes depois da destruição, em tempos diferentes (1,30/1,44/1,58s), curvam as pontas em gancho e levam os pedaços inteiros para baixo da água. Madeira acompanha a ponta e sua orientação, sem encolher para simular afundamento; os outros três braços mantêm os golpes. Preservado limite de 3s e submersão completa. Teste verifica contato, tamanho constante, deslocamento e profundidade real dos pedaços antes de ocultar o kraken. QA dos modelos também encontrou e corrigiu cleanup do sino no StrictMode: efeito captura o elemento de áudio para pausar com segurança após desmontagem.

Retirada do kraken substituída (02/10/2026): pedido vigente remove completamente as batidas na água depois do barco desaparecer. Os seis braços agora alcançam tábuas em tempos escalonados (0,55–1,05s), curvam as pontas e puxam os pedaços para dentro e para baixo enquanto mergulham. world-kraken-ending.ts usa dobras suaves com descida contínua, sem ciclos de golpe nem novos impactos/respingo; os golpes contra o barco antes da destruição permanecem. Madeira mantém tamanho, acompanha contato/orientação e submerge inteira; encerramento em até 3s. Testes atualizados verificam ausência de respingos de batidas, contato de seis tábuas, movimento contínuo e submersão completa antes de ocultar. QA próximo dos modelos aprovado.

Início sem exemplos fixos e com pergaminho (02/10/2026): removido o fallback introductions de HomeJournal. Quando não há publicações reais, não aparecem posts artificiais sem Editar. Mantidos criação, edição/exclusão do autor e moderação já autorizada no servidor; nenhuma publicação real apagada. Fundo próprio home-open-parchment.webp gerado com imagegen integrado, pergaminho aberto realista em tons envelhecidos sobre madeira escura, sem texto. Camada fixa exclusiva do Início, overlay escuro para contraste e espaçamento de conteúdo preservado no celular; não muda o tema escuro das demais abas. Prompt/proveniência em docs/HOME-ART.md. Smoke isolado confirma ausência dos exemplos, fundo, edição e demais fluxos de publicação.

Salão da guilda e volume no ícone (02/10/2026): usuário rejeitou pergaminho do Início. Fundo vigente é home-guild-hall.webp, salão medieval realista com madeira escura, pedra, velas nas bordas e centro discreto para leitura; cover preserva proporções. Arte gerada com imagegen integrado e prompt em HOME-ART.md, pergaminho anterior inativo. Controle de som unificado: próprio ícone abre barra vertical abaixo, 100% em cima/0% embaixo, percentual atual e mute dentro do popover; removido botão separado de ajustes. Mesma interação no perfil e login. Fecha com clique externo/Escape; volume salvo e áudio da loja/sino preservados. Teste isolado valida orientação/dimensões verticais, extremos, persistência, mute e celular.

Login com Mundo animado (02/10/2026): apresentação e formulário usam lazy WorldMap com os mesmos modelos, texturas, água, nuvens, frota e dragão do Mundo. Modo decorative sem territórios nem botões de navegação/foco no canvas; nenhuma consulta privada necessária. Botão Pausar animação/Retomar animação permanece no login e formulário. paused mantém relógio próprio da cena, interrompe RAF contínuo e retoma sem salto nem recriar renderer. Movimento reduzido/visibilidade/descarte preservados; CSS remove névoa duplicada e blur, preservando vinheta e contraste. Teste isolado valida canvas real, pausa do relógio, retomada, formulário, música e celular; captura login-music-desktop.png revisada.

Kraken sem queda rígida inicial (02/10/2026): retirada mantém corpo à altura do naufrágio durante a coleta. Blend da pose começa depois da destruição e dura 0,65s; alcance de tábuas dura 0,7s, contato entre 0,85–1,25s. Descida é uma dobra propagada: ponta, meio e base têm tempos diferentes e puxam destroços para dentro. Translação do corpo só acompanha o final dos braços entre 2,3–2,9s. Sem batidas na água após naufrágio. Teste confirma corpo sem descida no início, peças presas/deslocadas no espaço mundial, braços ativos e submersão em até 3s; QA visual próximo sem erros de shader.

Coleta orgânica do kraken (02/10/2026): removido o fator que reduzia a altura de todos os braços juntos após naufrágio e removida a translação vertical final do grupo. Agora só as curvas de cada braço mergulham. Pontas formam espiral gradual em torno de um ponto de preensão na madeira, com flexão ondulada no comprimento inteiro e fases diferentes por braço, amortecida durante a submersão. Destroço acompanha o centro da preensão, com rotação interpolada suavemente; não é colado à última ponta nem gira instantaneamente pelo vetor tangente. Sem novas batidas, prazo de 3s mantido. Testes verificam madeira dentro da ponta enrolada, mudança de direção da extremidade, atividade dos braços e submersão completa. Smoke da frota mede profundidade real média das pontas (krakenArmDepth), pois o grupo deixa de descer rigidamente. QA próximo inclui captura world-models-grasp.png.

Estábulo no mesmo vale do acampamento (02/10/2026): novo fundo paddock-camp-v2.webp gerado com imagegen a partir de character-camp-v2.png e da composição anterior. Mantém o grupo de montanhas recortadas, ponte de pedra cruzando a água e cidade fortificada no promontório direito, com caminho plausível e terra pisada no primeiro plano. Prompt/proveniência em docs/STABLE-ART.md. MountArt detecta a base opaca dos cascos por sprite e coloca sombras de contato locais; cache por imagem cobre pelagens, selas e bardas. Sombra projetada e tonalidade acompanham a iluminação, sem deformar os animais nem alterar suas regras. Teste isolado passou compras, persistência, variantes e seis viewports; capturas desktop/mobile revisadas.

Sino da loja (03/10/2026): som refeito como trililin de três batidas rápidas, seguido de um segundo balanço mais suave, com intervalos crescentes e ressonância que se apaga. WAV original de 3,2s, reproduzível com node scripts/generate-shop-bell.mjs. Mantidos toque único por entrada, volume e mute existentes.

Sino refeito do zero (03/10/2026): usuário rejeitou timbre distante. Nova sineta de porta seca e próxima usa modos inarmônicos, contato curto do badalo, ressonância curta e segundo balanço mais fraco. Sem chorus/eco/reverb; duração 2,25s. Fonte versionada para evitar o WAV anterior no cache. Substitui o som de 3,2s.

Sino animado (03/10/2026): substituído por sineta dupla de timbres agudos alternados, seis batidas rápidas no primeiro trililin e cinco progressivamente suaves no retorno. Menos ruído de impacto e brilho mais musical; 2,1s. Fonte lively-3 evita cache anterior. Atende ao pedido de um sino mais animado.

Sino gravado (03/10/2026): após rejeição das três sínteses, som ativo substituído integralmente pela gravação Shop doorbell chime #3588, Joseph SARDIN / BigSoundBank, CC0: https://bigsoundbank.com/carillon-commercant-s3588.html. Gerador sintetizado removido para não sobrescrever a gravação. Fonte recorded-shop-4 evita cache antigo; volume, mute e toque único por entrada preservados.

Sino antigo de porta (03/10/2026): gravação ativa agora Shop door bell.wav de 775noise, Freesound #494565, CC0, https://freesound.org/people/775noise/sounds/494565/. Recorte dos dois primeiros acionamentos com segundo mais suave, 2,65s, pico 96%. Volume relativo aumentado de 80% para 125% da música, limitado a 100%; mute e volume zero preservados. Fonte old-shop-door-5 evita cache. Substitui a gravação BigSoundBank rejeitada por soar baixa.

Áudio imediato na navegação (03/10/2026): go() dispara alvorada:navigate durante o gesto que muda a página. SiteMusic troca src e inicia música/sino sincronamente, antes do efeito React; hashchange continua como fallback, deduplicado para não repetir sino. Preload da música alterado para auto. Volume/mute preservados. Teste isolado test-world-dragon-isolated.mjs aprovado: início sem clique dentro da loja, sino único e continuidade da música. Abertura direta sem qualquer interação ainda depende da política de autoplay do navegador.

Ginna: balão próximo, olhos com relevo e desculpas sucessivas (03/10/2026). Balão mede a arte realmente contida na caixa, com ponta junto à lateral do rosto e altura da boca; acompanha texto/tamanho nas duas formas usando coordenadas locais ao tremor. A pergunta passa a “E se eu fizer mal a ele?”; quatro desculpas distintas avançam no mesmo balão aberto, com respostas sobre disciplina, obediência e crueldade, até a quinta escolha abrir a visão. Fechar/reabrir preserva a etapa. Visão agora tem 34 olhos: 27 no chão, seis em encostas e um enorme no lugar do pico, removido do fundo novo. Atlas novo de olho saltado tem terra levantada/rachada, sombra de contato, entrada em relevo e piscar com transição; não aplica a perspectiva que achatava os olhos anteriores. Olhos e fundo compartilham plano cover para acompanhar o recorte no celular. Cenário escuro, névoa, tremor, trilha e promessa obrigatória preservados. Artes geradas no imagegen integrado, arquivos/prompts em docs/STABLE-GINNA-EYES.json; interação e validação em docs/STABLE-GINNA.md. Smoke isolado verifica proximidade da ponta, sequência contínua, 34 olhos/relevo/pico, piscar, permanência/música/promessa, compras e seis viewports.

Saudação da Ginna (03/10/2026): balão inicial some após 7 segundos a cada entrada no estábulo. O timer é exclusivo das boas-vindas; perguntas, respostas e advertências continuam visíveis e o clique na personagem permanece disponível. Smoke isolado cobre desaparecimento e conversa posterior.

Última advertência da Ginna (03/10/2026): fala substituída por proibição enfática de maus-tratos em qualquer hipótese, com trechos em maiúsculas, sem menção à terra. Mantida a sequência até a quinta insistência.

Perspectiva dos olhos da Ginna (03/10/2026): atlas com relevo preservado, agora projetado em perspectiva rasante que varia com a profundidade do chão, com base apoiada na terra. Olhos distantes reposicionados em rochas expostas acima da floresta e no penhasco, os próximos longe dos arbustos/galhos. Olho maior segue no pico. Piscar, sombras e plano cover continuam. Smoke verifica projeção/proporções e interação nas duas resoluções.

Composição dos olhos da Ginna (03/10/2026): removidos os seis pequenos nas montanhas/penhasco e cinco na faixa de terra próxima à esquerda da cuidadora. Restam 22 no chão e um no pico. Olho grande reduzido de 16% para 12,5%, ligeiramente elevado, com máscara que esmaece a base antes da linha de floresta para preservar as árvores diante da montanha. Recorte SVG adicional acompanha a crista real, impedindo que a terra do olho passe acima da montanha. Tamanhos no chão variam mais, inclusive na mesma faixa de profundidade, entre 1,8% e 8,2% do plano cover. Arte, perspectiva, piscar, névoa, tremor, conversa e música mantidos. Smoke atualizado para 23 olhos e nenhuma instância de encosta; revisão visual desktop/mobile.

Retorno da visão da Ginna (03/10/2026): escolher Não vou machucá-los! fecha as pálpebras do visitante em 420 ms, troca para o cenário normal enquanto tudo está preto, pausa 380 ms e reabre no dia em 720 ms. GinnaReturn usa dialog no top layer e Web Animations, com cancelamento de animações/timer ao sair. Forma escura/trilha param sob a cobertura; seleção da montaria/equipamentos e posição da música principal preservadas. Respiração ofegante real dispara no gesto da promessa e dura aproximadamente 4,27 s, sem loop, respeitando mute/125% do volume geral (até 100%); pausa ao ocultar aba ou sair. MP3 público Heavy Breathing, Under7dude / Freesound #163383, CC0, origem em public/audio/manifest.json. Movimento reduzido usa fade 120/220 ms em vez de pálpebras, mantendo a pausa preta e o som. Smoke verifica tela totalmente preta na troca, retorno ao dia, foco, reprodução/duração/volume/mute da respiração e ambas as preferências de movimento.

## Texto e retrato lado a lado na lore (04/10/2026)

Blocos vizinhos de texto e imagem em lados opostos agora formam uma composição de duas colunas, independentemente da ordem. Funciona com Texto livre, Pergaminho, Inscrição e Citação / lenda, em retrato ou meia paisagem. Centro e paisagem inteira mantêm o fluxo individual. Até 600 px, os blocos são empilhados na ordem salva. Prévia e leitura usam a mesma composição; dados existentes preservados. Smoke isolado aprovado nos quatro estilos, ambos os lados, desktop/celular e persistência.

Balcão da loja livre (04/10/2026): removidos bloqueios de colisão/mesa cheia; todos os 71 itens podem ocupar o tampo e ser sobrepostos por arraste ou teclado. Seleção/foco/arraste trazem o objeto à frente com camada estável. Carrinho tem Localizar no balcão para recuperar objetos cobertos. Escalas moderadas por tamanho projetado da ilustração, entre 0,55 e 1,70; joias e frascos menores, armas longas/volumes maiores. Arte separada do alvo mínimo de 48 px preserva diferença visual no celular; sentinela CSS/ResizeObserver alinham render e arraste. Superfície mobile ampliada 32 px no tampo. Quantidades agrupadas, transação de 99 unidades/item e preços preservados. Detalhes em docs/SHOP-LAYOUT.md.

Entrada na visão da Ginna (04/10/2026): a piscada foi substituída, por pedido posterior do usuário, por rachaduras, fragmentos da cena caindo e névoa escura. A implementação vigente está descrita no início deste contexto e em docs/STABLE-GINNA.md. Pálpebras continuam apenas no retorno.
