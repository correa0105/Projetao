# Sons dos tentáculos — 04/10/2026

A saída do lago recebe água deslocada, respingos, rugido grave e reverberação
curta. O envolvimento próximo usa atrito molhado e pressão orgânica, entrando
quando o tentáculo desce junto do visitante. As gravações CC0 são recortadas,
desaceleradas e mixadas; um grave discreto complementa os sons reais.

- `public/audio/ginna-tentacle-emergence.wav`: emergência no início da animação.
- `public/audio/ginna-tentacle-wrapping.wav`: envolvimento aos 2700 ms.
- `public/audio/ginna-tentacle-preview.wav`: prévia da sequência de 5600 ms.
- `public/audio/ginna-tentacles-manifest.json`: fontes, licenças e hashes.
- `scripts/generate-ginna-tentacle-audio.mjs`: geração reproduzível dos WAVs.

PCM estéreo de 48 kHz, 16 bits, pico em 82%. A trilha da visão cai para 15%
do volume escolhido durante o retorno para dar presença aos efeitos e manter
espaço no mix. A atenuação acontece somente na sequência dos tentáculos.

`src/ginna-tentacle-audio.ts` acompanha o tempo real de
`animateGinnaTentacles` em `src/GinnaTentacles.tsx`; não há um segundo relógio
independente. `src/GinnaReturn.tsx` prepara os arquivos antes do primeiro frame,
com espera máxima de 1200 ms para que uma falha de áudio não impeça o retorno.
O contexto exige interação do visitante. Se ela chegar tarde, o som começa na
posição atual da animação, sem repetir a emergência.

Os tentáculos, batimentos e respiração seguem Efeitos sonoros; a trilha da
visão segue Músicas. Os dois canais têm volume e silêncio próprios no painel
Configurações de som (docs/SOUND-SETTINGS.md).
Volume zero/mute dos efeitos e movimento reduzido ficam silenciosos. Ocultar a aba pausa
o áudio e a progressão dos tentáculos. Retomar usa o mesmo instante. Cancelar
ou concluir libera fontes, listeners e contexto; os efeitos terminam antes
de fechar as pálpebras e da respiração de volta ao dia. O batimento sincronizado
com as letras vermelhas continua independente destes dois efeitos.

Validação: `node scripts/smoke-ginna-tentacle-audio.mjs` testa reprodução com
gesto, sincronia das duas fases, desbloqueio tardio, mute, volume zero, pausa,
cancelamento, movimento reduzido e encerramento do contexto no Edge.

## Fissura, vidro e névoa na entrada

`src/ginna-entry-audio.ts` recebe o relógio visual de `GinnaEntry`. A trinca
começa em 40 ms, a queda de lascas em 1180 ms e o avanço da névoa em 1530 ms.
Os efeitos terminam antes da cobertura integral aos 3600 ms. Espera inicial
por decodificação limitada a 450 ms; falta de arquivo não impede a transição.

- `ginna-reality-crack.wav`: três estalos secos, 1,15 s, pico 58%.
- `ginna-reality-glass.wav`: vidro real quebrando, 2,05 s, pico 70%.
- `ginna-reality-mist.wav`: sopro grave e reverberante, 2,05 s, pico 56%.

Os arquivos ficam em `public/audio/`, PCM estéreo de 48 kHz, 16 bits.
Gravações CC0 do Freesound: Crackle #1 de abstraktgeneriert (348942),
Glass Break de avrahamy (141563) e Dark Whoosh de The-Sacha-Rush (657795).
URLs, licenças e hashes estão em `ginna-reality-manifest.json`.
`node scripts/generate-ginna-entry-audio.mjs` reproduz a mixagem, com verificação
dos hashes das fontes, desaceleração, filtro, envelopes e reverberação.

Segue Efeitos sonoros, independentemente de Músicas. Mute/volume zero,
movimento reduzido e ausência de interação inicial ficam silenciosos. Aba
oculta suspende contexto e relógio; retomar usa o ponto atual. Carregamento
tardio não repete a trinca já expirada. Desmontagem cancela downloads,
fontes, listeners e contexto; conclusão libera áudio antes de revelar Ginna.

`node scripts/smoke-ginna-entry-audio.mjs` verifica os WAVs, as três entradas
sincronizadas em Web Audio real, controles ao vivo, música independente,
pausa/retomada, rede lenta, arquivos ausentes, movimento reduzido e limpeza.
