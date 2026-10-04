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
