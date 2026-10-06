# Calendário, eventos mundanos e mascotes — 05/10/2026

Refino 06/10: a imagem dinâmica do compromisso é posicionada na calendar-header
inteira, incluindo título, ações, mês, filtro e contador, conforme o anexo.
Gradiente sobre a faixa mantém controles/textos legíveis; calendário/dias abaixo
mantêm a estrutura existente. Não muda fontes de dados, edição ou fuso.
Smoke verifica troca de duas imagens, bordas cobrindo toda a faixa e filtros,
CRUD e responsividade em 1440/768/390/320 px.

## Calendário em Início

O calendário aparece sempre no final de **Início → Diário**, abaixo das entradas,
sem uma aba própria. Edições do Diário atualizam os compromissos preservando o mês
e o dia selecionados. Mostra um mês com seis semanas, navegação anterior/próximo,
atalho Hoje e escolha direta do mês. O dia atual e o selecionado têm destaque.
Filtros: Todos, Eventos, Missões e Diário. A grade mostra até três chamadas por
dia e a contagem das restantes; o painel do dia lista todos os compromissos,
sem limite de quantidade. No celular, os indicadores viram pontos para preservar
o tamanho dos dias, e os detalhes aparecem abaixo. Datas seguem America/Sao_Paulo.

Administradores podem **Editar calendário**: título, apresentação, fundo da
galeria/upload próprio, cor dos detalhes e primeiro dia da semana. Há prévia.
**Novo compromisso** cria um evento na data escolhida, com o mesmo editor da aba
Eventos: título, texto, data/hora, local, status, imagem, animação e link. O lápis
de cada evento permite editar/excluir. Encontros do Diário abrem seu editor original;
missões levam ao fluxo existente, preservando ownership e regras de conclusão.

GET `/api/calendar?month=YYYY-MM` consulta `board_posts` (eventos/missões) e
`home_updates` (publicações datadas); não existe cópia dos compromissos. Mudança
ou exclusão nesses registros aparece na próxima consulta do calendário. PUT
`/api/calendar/settings` exige `administrador=1`, revisão corrente e imagens
válidas. `guild_calendar` guarda só apresentação/revisão. Uploads continuam em
`event_images`; jogadores só acessam imagens referenciadas em conteúdo publicado,
incluindo o fundo atual do calendário.

Migration 057 cria `guild_calendar` e substitui somente o antigo background
`/events/hall-v1.webp` pela arte existente `/notice-village-empty-v4.png`,
preservando textos, ajustes e camadas editados. Instalações novas usam a vila
como padrão, sem partículas. **Editar cenário** de Eventos mantém todos os
controles de background e animações; a opção do salão continua na galeria.
Nenhuma nova arte foi gerada nessa mudança.

## Escolha e nomes dos mascotes

O comprador define o nome do animal em **Como vai se chamar?** antes da compra.
No Inventário → Mascotes, **Mostrar no acampamento** escolhe um pet daquele
personagem; **Ocultar mascote do acampamento** limpa a escolha. O pet aparece
inteiro à direita, com tamanho relativo à espécie e luz do cenário. Selecionar
outro personagem atualiza o animal exibido e descarta respostas atrasadas.

Migration 056 adiciona `character_pets.displayed` e índice único parcial por
personagem. Para compras antigas, escolhe o primeiro mascote; somente a primeira
compra nova é exibida automaticamente. Compras posteriores e replays preservam
a escolha. PUT `/api/pets/:characterId/display` aceita ID próprio ou null,
valida ownership e bloqueia o personagem em transação. Não altera economia.

Administradores têm **Editar raça** no catálogo de aparências. GET
`/api/pets/catalog` combina 17 nomes padrão com `pet_breed_names`; PUT
`/api/pets/catalog/:petId/:appearance` valida IDs, nome e revisão (0 para padrão
sem edição). Conflitos retornam 409. Alterações aparecem no catálogo/inventário;
nome pessoal, espécie, aparência e preços comprados permanecem. Referências ao
editor usam ON DELETE SET NULL, preservando rótulos ao excluir conta administrativa.

## Garalho e áudio

Clicar em Garalho abre uma caixa com seu nome e três perguntas; fechar ou Escape
encerra. Não há miado automático de saudação. A resposta em miado só aparece
após uma pergunta; a escrita continua por 2,5 s nas poses da placa antes da
virada. Frases curtas, bem-humoradas e individuais cabem na madeira no celular.
Escolher uma espécie escreve seu comentário sem reproduzir a voz de Garalho.

Oito vozes naturais ativas: cão, gato, coruja, corvo, raposa, sapo, rato e
porquinho-da-índia. A seleção toca somente a voz do animal, uma vez quando a arte
carrega, inclusive ao clicar novamente. Cobra/coelho usam chiado/farejo discretos
de ruído filtrado, sem osciladores ou impacto. A fala de Garalho usa a gravação
de gato só ao responder pergunta. Todos seguem Efeitos sonoros, volume, silêncio
e encerramento ao trocar animal, sair ou ocultar a página; não há som do pet
no acampamento.

Correções de 05/10: o corvo mantém o grasnado nas duas aparências, sem voz humana
nem vento de fundo. O áudio ativo é `raven-caw-v3.wav`, tratado a partir da gravação
de Bidone/Freesound (CC0). `raven.wav` (voz humana) e `raven-caw-v2.wav` (vento)
ficam arquivados com créditos, sem reprodução. O nome novo evita o cache antigo.
`scripts/clean-raven-audio.mjs` usa perfil de ruído dos trechos sem grasnado,
redução espectral com suavização e corte de graves em 450 Hz. Preserva os dois
chamados e sua altura natural, recorta o início/final e silencia o intervalo com
fades suaves. Duração 1,51 s, PCM mono 48 kHz, pico 0,7 sem saturação; os graves
abaixo de 250 Hz caíram mais de 52 dB durante os chamados, mantendo a energia
da voz entre 800–5000 Hz. Regerar só esse animal, sem alterar os demais áudios:
`node scripts/import-pet-audio.mjs --raven-only`.

`scripts/import-pet-audio.mjs` importa fontes licenciadas, recorta uma voz sem
alterar pitch e grava PCM mono com normalização/fades. O cache original fica em
`.local/pet-audio`, ignorado pelo Git. Arquivos e créditos públicos em
[audio/pets/CREDITS.md](../public/audio/pets/CREDITS.md) e manifest.json.
Licenças: CC BY-SA 3.0/4.0, CC0 e domínio público. A página oferece link de créditos.

## Verificação

`node scripts/test-calendar-pets-isolated.mjs` valida edição/revisões, imagens
publicadas, revogação administrativa, ownership, replay/concorrência, mascote
único, preservação por seed, fuso e registros compartilhados/exclusão.
`--browser` valida compra nomeada, seleção por personagem, edição de raça,
conversa/miado sob pergunta, som único, calendário CRUD, aparência e telas móveis.
Testes usam bancos descartáveis. `test-community-isolated.mjs` cobre economia,
cartas, conquistas/títulos/estante, eventos e áudio/mute no navegador.
