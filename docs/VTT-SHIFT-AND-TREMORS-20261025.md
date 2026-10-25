# Sons de tremor e controles com Shift — 25/10/2026

Três pedidos do proprietário: substituir os quatro sons rejeitados (Tremor distante, Terremoto na masmorra, Passos de gigante se aproximando, Rachadura se abrindo no chão); Shift + Enter para parágrafos no chat; mestre pode atravessar paredes ao arrastar token segurando Shift.

## Substituições de áudio r3

Quatro fontes dedicadas CC0, verificadas em páginas primárias: gmason — underwater or space engine rumble (trecho contínuo de deep_rumble.ogg); mieki256 — Earthquake and Open sesame (shake.flac); aroth4 — Giant footsteps running (HQ preview público do áudio CC0); rubberduck — 75 CC0 breaking/falling/hit SFX (rocha partindo/caindo). URLs, autores, hashes e detalhes de edição em data/vtt/tremor-replacement-20261025.json e CREDITS.md. Somente as quatro fontes usadas foram incorporadas ao manifest.

Os quatro IDs/nomes/ajustes foram conservados. Novas URLs -r3-20261025.ogg contornam cache; arquivos anteriores permanecem. 191 outros assets de catálogo idênticos. A revisão anterior tinha perdido o corpo dos tremores ao aplicar corte universal em 110 Hz, além de usar atrito repetido. A nova revisão preserva graves audíveis, remove apenas a faixa subsônica, mantém a progressão do efeito de terremoto original e usa pisadas pesadas distintas com crescendo. Fratura é um evento curto de pedra partindo com poucos fragmentos, sem longa raspagem. Durações naturais: 9 s / 5,2593 s / 7,9 s / 3 s. Os limites espectrais da r2 são históricos, não metas universais para todo som. Headroom verdadeiro mínimo de 5 dB após decodificar, ganho linear e fades discretos; sem renormalizar a mesma gravação rejeitada. A aprovação de integridade/reprodução não equivale à aprovação perceptual do proprietário; prévia dos quatro enviada no chat.

Manutenção explícita em scripts/replace-vtt-tremors-20261025.py (numpy/scipy/soundfile); não roda em startup/deploy. Downloader passa a aceitar FLAC e apenas HQ previews com caminho público estrito em cdn.freesound.org. Catálogos de cliente e servidor são publicados juntos.

## Chat

VttChatComposer usa Enter para submit e Shift + Enter para quebra nativa do textarea, inclusive linhas em branco consecutivas. Mensagem/campos internos preservam os caracteres de nova linha; CSS pre-wrap existente faz a exibição. Botão continua enviando. Enter vazio/busy/repetição do teclado não envia; IME em composição (inclusive código 229) não deve enviar. Dica curta abaixo do campo. Não alterar comandos, limites, mensagens anteriores ou outros chats.

## Mestre com Shift

No arraste de tokens, apenas gm e fora da prévia podem ignorar barreiras enquanto o evento aponta Shift pressionado. Vale para botão esquerdo e movimento medido no direito. O mestre já tem permissão de reposicionar tokens no PUT completo; nenhuma flag nova é aceita do jogador. As rotas de jogadores continuam verificando colisão no servidor. Limites do mapa e de vínculos, ownership, tokens travados, visão/iluminação e paredes persistidas permanecem.

attachmentMovementError recebe bypass opcional padrão false; somente o ramo de arraste do mestre o ativa. Shift + clique continua seleção múltipla: para um token já selecionado, a remoção da seleção é adiada até soltar sem movimento somente se ele estiver destravado e fora da prévia, permitindo Shift + arraste do selecionado. Resize/rotação e navegação mantêm seus modificadores.

## Validação

TypeScript, builds de cliente/servidor e 16 testes de engine/integridade/movimento e 108 regressões de vínculos/casas aprovados. Navegador de som aprovado: 40 decodes, quatro substituições tocando em outro participante, favoritos/atalhos preservados e 320/390/768/1440 sem erros. Smoke dedicado Shift em banco UUID descartável verifica dono não administrador, colisão normal, dois botões com Shift, bloqueio do jogador/flag forjada, token travado, paredes/iluminação intactas, parágrafos, envio por Enter/botão, IME e quatro larguras. Smoke dedicado aprovado, com duas contas comuns, em 1440/768/390/320, sem erros de página. Release principal publicado como vtt-shift-tremors-20261025, código 71932ed94eae863d0d334a13e54b2cd9334d7477: 51 arquivos e 27 respostas HTTPS conferidos; três salas e três hotbars preservados integralmente, ilustrador online. Backup /opt/alvorada/backups/vtt-shift-tremors-before-20261025T175003Z.dump. Conferência final da seleção com Shift conserva o clique normal nos tokens travados e na prévia.


Conferência final publicada: cliente vtt-shift-selection-20261025, código 206855278f213d8f75f2e65220e7f1d9899ae0e4, conserva Shift + clique normal em tokens travados/na prévia. Smoke completo repetido e aprovado após esse ajuste. 39 arquivos e 20 respostas HTTPS adicionais conferidos; backend e quatro sons r3 conservados, três salas e três hotbars idênticos, PNG privado da Caverna por hash e ilustrador online. Backup /opt/alvorada/backups/vtt-shift-selection-before-20261025T175323Z.dump. Atualizar a página para receber o cliente.
