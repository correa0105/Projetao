# Áudio, efeitos de tela e vozes — 26/10/2026

Pedido: ampliar música e efeitos, facilitar encontrar o som pelo cenário e pelo que representa, com Tabletop Audio/SoundPad como referência de qualidade. Inclui efeitos na tela inteira (especialmente tremor com terra caindo) com som silenciável pelo mestre e dez transformações de microfone voltadas a monstros.

## Biblioteca

241 arquivos: 25 músicas, 29 ambientes e 187 efeitos. São 46 adições: 12 composições musicais completas, três gravações de campo, 24 efeitos individuais e sete composições para tela. As mídias dos 195 sons anteriores continuam com os mesmos bytes, IDs e caminhos, inclusive as revisões r2/r3 aprovadas. Preferências, uploads, favoritos, ocultos e hotbars existentes permanecem válidos.

Som permite filtrar por tipo, Cenário e O que representa. Categorias são agrupadas e contadas; busca ignora acentos e encontra palavras distribuídas nos nomes, descrições e etiquetas. Descrições genéricas foram substituídas por ações concretas. Ampliar biblioteca abre um painel maior com cartões em duas colunas no desktop. Filtros têm estado transitório; dados da mesa continuam no PostgreSQL.

Fontes CC0 verificadas nas páginas de seus autores; Tabletop Audio não foi incorporado. As trilhas desse site são NC/ND e SoundPad restringe uso ao site original. Créditos completos continuam recolhidos em Configurações e ajuda → Mesa, no CREDITS e no manifest.

Manutenção: `prepare-vtt-audio-20261026.mjs` verifica CC0 e fixa download/hash; `build-vtt-audio-20261026.py` acrescenta as mídias sem sobrescrever as antigas; `organize-vtt-sounds-20261026.mjs` atualiza somente metadados. Nunca executar em startup/seed/deploy. Arquivos novos em estéreo 48 kHz, volume integrado medido e teto de pico verdadeiro com margem antes e depois do Vorbis. Não confundir medições e reprodução técnica com aprovação auditiva do usuário.

## Efeitos de tela

Em Som → Efeitos de tela: Tremor de terra, Desabamento, Tormenta, Nevasca, Cinzas e brasas, Presença espectral e Ruptura arcana. Terra e fragmentos entram pelo alto, com profundidades, aceleração, rotação, facetas e poeira. A sobreposição não captura cliques; controles continuam disponíveis. Tremor desloca a apresentação, sem alterar câmera, tokens, mapas, paredes ou dados de jogo.

O dono da mesa dispara/encerra, escolhe intensidade, duração de 5–60 s e volume. Silenciar som do efeito para todos funciona antes e durante a execução, sem parar a imagem ou a música. Volumes locais do site e a preferência de som dos efeitos do VTT são respeitados. Quem desativou efeitos do mestre conserva a escolha. Movimento reduzido elimina tremor/clarões e reduz animação; aba oculta não renderiza partículas.

Evento opcional em `soundboard.screenEffect`, sem migration ou reescrita de salas antigas. Som e visual seguem `startedAt` do servidor, com pequena antecedência para distribuição. Um novo evento substitui o anterior; som em loop é encerrado localmente no prazo mesmo sem novo poll. Parar todos encerra também o efeito de tela. Protocolo VTT 25 pede recarregar clientes antigos antes de retornar o novo formato.

## Microfone

Som → Microfone oferece Ogro, Demônio, Dragão, Troll, Goblin, Morto-vivo, Espectro, Lich, Aberração e Golem de pedra; Voz natural é um bypass adicional. Não usa áudio nem modelos do Voicemod. Implementação própria por AudioWorklet: transposição granular, segunda camada, filtros, saturação suave, modulação, eco, reverberação, controle de ganho e compressor. A mistura pode ser ajustada sem recriar a captura ou a conexão.

Entrar na conversa começa somente a escuta; Ativar microfone solicita permissão do navegador. Prévia Ouvir minha voz começa desligada; usar fones evita retorno. Há medidor, seleção de entrada após liberar permissão, mute, volumes do microfone/conversa e indicador persistente com mute/encerramento enquanto se usa outras abas do VTT. Sair da mesa libera captura, conexões e buffers. Ativar voz não inicia gravação.

Conversa WebRTC entre até 12 conexões autenticadas da mesma mesa. Somente a faixa processada é enviada. Sinalização validada no servidor, sessão vinculada ao usuário, origem verificada, limite próprio, cache sem persistência, expiração de presença e de mensagens e orçamento global de memória. A cada consulta o servidor revalida participação; perda de acesso encerra as conexões. SDP/ICE não entram no documento, histórico ou banco. Somente o ofertante cria o transceiver; o outro lado reutiliza a seção oferecida, permitindo áudio bidirecional independentemente da ordem de entrada.

STUN padrão; `VTT_ICE_SERVERS` aceita um array JSON de servidores STUN/TURN para redes que exigem retransmissão. Sem TURN, conectividade depende das redes dos participantes. O modificador funciona dentro do VTT; não instala um dispositivo de microfone virtual no Windows/Discord.

Gravar fala é uma ação separada e explícita, limitada a 30 s. O arquivo fica no navegador para escutar/baixar. Tocar fala na mesa (somente mestre) envia pelo fluxo privado de assets existente e toca para os membros. Essa opção também permite usar falas preparadas sem depender da conversa ao vivo.

Arquivos de áudio enviados passam a ficar disponíveis aos participantes enquanto o mestre os reproduz no soundboard. O servidor exige áudio da própria mesa, uma voz ativa e fonte não oculta; ao parar, o arquivo deixa de ser compartilhado por esse vínculo. Uploads inativos, imagens, arquivos de outras mesas e acesso anônimo continuam protegidos.

## Verificação

Testes de engine/schema, integridade/proveniência, DSP de dez vozes (sinal real, saída finita e transposição), permissões de tela e sinalização de voz em PostgreSQL UUID descartável. Smoke real de navegador cobre sete efeitos, mute, conversa bidirecional, gravação, filtros, painel ampliado e 320/390/768/1440 px. Testes não usam contas ou salas reais.

Comandos: `node --import tsx --test tests/vtt-sounds.test.ts tests/vtt-dungeon-sounds.test.ts tests/vtt-immersive-audio.test.ts`; `node scripts/test-vtt-sounds-isolated.mjs`; `--browser` para regressão completa, ou `--immersive` para a nova experiência. Evidências em test-results (ignoradas pelo Git).

Resultado local: TypeScript, builds de cliente/servidor, 16 testes de engine/DSP/integridade, 11 testes de API e os dois smokes de navegador aprovados. A regressão completa confirma 40 decodes antigos, reprodução real em outro participante, filtros, favoritos, upload/compartilhamento de fala gravada, ganho/repetição, atalhos por clique/teclado/arraste, persistência, limpeza, sete efeitos e dez vozes. Quatro larguras sem overflow ou erros de página; conversa verificada nos dois sentidos.

## Publicação

Publicado em alvoradacinzenta.com como `vtt-immersive-audio-20261026`, fonte `ae49fd3bb3f17432836c19e11ce1e7dbfed2a9ac`. Conferidos 93 arquivos novos/atualizados, 727 arquivos anteriores preservados, 70 respostas HTTPS e os hashes dos 241 áudios. Os 195 arquivos anteriores continuam intactos. Cliente e servidor carregam o catálogo e os comandos novos; módulo AudioWorklet servido corretamente e conversa privada exige autenticação.

Comparação antes/depois da troca: cinco documentos de mesas, quatro hotbars e os 35 arquivos privados de VTT com hashes idênticos. Ilustrador online; sem migration e sem reescrita de dados de jogo. Backup em `/opt/alvorada/backups/vtt-immersive-audio-before-20261026.dump`. Atualizar a página para carregar o protocolo 25; em Som → Microfone, cada participante entra explicitamente na conversa para ouvir/falar.
