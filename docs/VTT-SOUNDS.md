# Som da mesa — 07/10/2026

## Atualização de 08/10

155 arquivos: 13 músicas, 22 ambientes, 120 efeitos. Novas fontes CC0 em CREDITS
e manifest, com hash do download. Gerador append-only expand-vtt-sound-library.py
conserva os 75 arquivos anteriores. Acrescenta portas, animais/criaturas, foleys
de aço/lamparina/tocha, ecos e composições de tensão/ruínas/subterrâneos.

Estrela marca o som para Favoritos. Remover oculta da biblioteca DESTA MESA,
para reprodução e conserva arquivo, configuração e atalho. Removidos permite
restaurar. Favoritos continuam salvos ao remover; som reaparece ao restaurar.
Todas as ações compartilhadas exigem mestre dono administrador vigente.

Repetir permite Contínua ou A cada intervalo; 1–3600 segundos entre os inícios
do arquivo. Se intervalo for menor que duração, próximo início corta o anterior.
Linha temporal do servidor sincroniza ciclos; entrar durante o silêncio aguarda
o próximo início, sem duplicar players em polls. Ajuste segue o mesmo som ao fixar.
Favoritos, ocultos e intervalo são campos JSONB com defaults retrocompatíveis;
sem migration ou reescrita das salas existentes.

Pedido: biblioteca para RPG medieval na aba **Som** à direita, com mistura e
controle por arquivo, e sons clicáveis/arrastáveis para os dez espaços existentes
do acesso rápido. Tabletop Audio, SoundPad e Sanctum são referências de qualidade
e organização. O usuário esclareceu que o acesso ao site é pago: usar conteúdo
compatível e produzir composições semelhantes quando a integração for restrita.

## Acervo e interface

75 arquivos OGG locais (23,9 MB): sete músicas de RandomMind, dez ambientes,
50 efeitos RPG Audio de Kenney e sete efeitos mágicos de JaggedStone. Ambientes
incluem floresta, lareira, chuva, rio e vento; cinco composições próprias combinam
essas bases ou sequenciam passos. Bases de TinyWorlds, PagDev, Ylmir, remaxim e
RandomMind, todas CC0. Fontes, licenças, autores e hashes em
`public/audio/vtt/CREDITS.md`, `KENNEY-LICENSE.txt` e `manifest.json`.

Tabletop Audio não foi incorporado: a página About licencia as trilhas como
CC BY-NC-ND 4.0 e restringe os arquivos do SoundPad ao site original. Não usar
esses arquivos no site com acesso pago sem autorização adequada. Não há relação
comercial ou dependência de rede com Tabletop Audio.

Busca, categorias e filtros **Músicas / Ambientes / Efeitos / Enviados**. Cada
som tem volume, repetir, tocar/parar, prévia privada de até 12 s e **Fixar**.
Upload MP3/WAV/OGG/WebM existente conservado; arquivos podem ser usados como
música, ambiente ou efeito. Música nova substitui a anterior, enquanto ambientes
e efeitos podem coexistir. **Parar todos** conserva configurações e atalhos.
Volumes locais separados de música e efeitos continuam nas preferências do site.
Ativar áudio libera o navegador por gesto explícito. Celular deixa a barra de
atalhos abaixo do painel, sem sobrepor os controles.

Fixar por clique usa o primeiro espaço livre; arraste escolhe o espaço. Atalhos
de som são exclusivos do mestre e seguem os ajustes salvos do arquivo. Clique
ou teclas 1–0 dispara efeitos curtos; sons em repetição ligam/desligam. Tranca,
revisão, páginas, ações de personagem, monstros e efeitos visuais conservados.

## Persistência e reprodução

`shared/vtt-sounds.ts` valida catálogo, sourceId, ajustes e vozes. Fonte pública
é ID do catálogo fixo; arquivo privado é `asset:UUID`, conferido por mesa e tipo
audio no servidor. Não há URL livre, proxy de mídia ou importação externa.
Até 300 ajustes e 16 vozes, uma música por vez. Loops únicos por arquivo;
disparos curtos têm IDs individuais e podem coexistir para não perder cliques
rápidos entre polls. Histórico expirado é retirado ao próximo comando.

`soundboard` tem default vazio no JSONB das mesas antigas, sem migration ou
reescrita dos documentos existentes. Legado `music` e áudio automático de mapa
continuam funcionais; ao mudar de mapa com trilha automática, a música da
biblioteca é substituída. Arquivos já enviados são preservados.

GET `/vtt/rooms/:id/sounds` retorna snapshot leve com horário do servidor.
POST é comando atômico sob lock da sala e exige dono administrador vigente;
participantes/espectadores só ouvem. PUT geral também valida os arquivos de som.
Cliente enfileira comandos após salvar mudanças do mapa e mescla áudio se novas
edições chegam durante a solicitação. Consultas de áudio usam o orçamento
autenticado de sincronização, agora 300/min com signal/combat; não consomem o
orçamento de mutações nem alteram permissões.

Engine HTMLAudio em `vtt-sound-engine.ts`: polling independente a cada segundo,
emissão individual, seek de loops pela linha temporal, sem repetir efeitos ao
entrar/recarregar ou atualizar volume. Preferências locais aplicadas por canal,
ganho gradual e saída suave dos loops. Prévia local isolada; limpeza de buffers,
fontes e timers ao sair. Até 16 vozes ativas e 16 em saída; memória de eventos
limitada a 512 IDs. Efeitos não recebidos enquanto a aba está oculta não são
reproduzidos como histórico ao voltar.

## Produção e validação

Tratamento: remover DC, ajustar RMS com limite de pico, OGG estéreo 44,1 kHz,
sobreposição nos ciclos de ambientes. Decode final conferido para todos os 75
arquivos: amostras finitas, áudio não vazio e sem clipping. Músicas mantêm a
composição de seus autores. Gerador em `scripts/build-vtt-sound-library.py`,
usa numpy/soundfile e as fontes preparadas em `.local/vtt-sound-sources`;
`node scripts/download-vtt-sound-sources.mjs` recupera essas fontes pelas URLs e
hashes do manifest; o gerador extrai os dois ZIPs em diretórios locais verificados.
O gerador escreve em blocos pequenos para evitar stack overflow do encoder no Windows.
Não faz parte do startup/seed da aplicação.

Testes: `node --import tsx --test tests/vtt-sounds.test.ts` (engine/schema),
`node scripts/test-vtt-sounds-isolated.mjs` (API) e acrescentar `--browser`
(interface). Todos os testes com banco usam PostgreSQL UUID descartável, sem
mutação das contas reais. Evidências em `test-results/vtt-sounds-browser.json`
e `vtt-sound-library-*.png`. Navegador verifica mídia real carregada/tocando no
jogador, prévia sem alteração da revisão compartilhada, ganho/repetição, clique,
tecla, arraste, persistência, cleanup e 320/390/768/1440 px.

Entrega local verificada: build TSC/Vite/tsup e Docker; aplicação saudável em
localhost:3000, index/JS/CSS e todos os 75 áudios servidos conferidos por hash.
Regressão VTT/perfis/comunidade 23/23. As 43 tabelas monitoradas conservaram
exatamente contagens e hashes antes/depois do deploy, inclusive bens, ouro,
House, personagens, mensagens e salas VTT. Sete artes de monstros conferidas
no container e rota privada ainda 401 para anônimo.
