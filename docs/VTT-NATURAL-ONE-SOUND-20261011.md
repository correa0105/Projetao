# Áudio do d20 com resultado natural 1

Pedido de 11/10/2026: tocar o MP3 fornecido pelo usuário sempre que um d20 mostrar 1 no VTT.

`src/VttRollSounds.tsx` acompanha as novas mensagens da mesa e reproduz uma vez por rolagem. Todos os participantes que recebem a mensagem podem ouvir; mensagens privadas continuam dependendo do filtro existente do servidor. O componente é independente da animação 3D dos dados e dos efeitos visuais. Respeita o som/volume local da mesa, o canal global de efeitos, a prévia e a visibilidade da aba; para o áudio ao desligar o som, trocar de sala ou desmontar.

`src/vtt-roll-sound.ts` consulta os lançamentos brutos (`throws`) para identificar a face e o valor natural. Bônus, penalidades e o total final não alteram o gatilho. Dados de outras faces mostrando 1 não acionam o som; pools mistos são reconhecidos corretamente. Qualquer d20 mostrando 1 qualifica, inclusive um dado descartado por vantagem/desvantagem ou relançamento. Dois dados mostrando 1 na mesma mensagem reproduzem somente um áudio. Mensagens antigas sem metadata têm alternativa restrita às fórmulas inequívocas de d20.

O histórico inicial de cada sala fica marcado como já visto. IDs impedem repetição por polling/atualização; mensagens antigas carregadas depois são ignoradas pelo limite de 15 segundos. Eventos recebidos enquanto o áudio está desligado não são reproduzidos ao religá-lo. A memória do histórico fica limitada a mil IDs. Nenhum novo endpoint, mudança de rolagem, banco ou inventário.

Arquivo original copiado sem edição/transcodificação:

- Origem fornecida: `“Fahh” - meme sound effect.mp3`.
- Destino público: `/audio/vtt-rolls-20261011/fahh-natural-one.mp3`.
- 127.962 bytes; duração decodificada no Edge: 4,527891 segundos.
- SHA-256: `f12ebd2a9e186d67a00dbdd866ff35f3aa397ad3195ef69c2194d4aa715d02a6`.

Nove testes de parser/detector, TypeScript/build no estágio limpo e `scripts/review-vtt-natural-one-sound.mjs` no Edge nativo. O navegador confirma reprodução/decodificação do MP3 exato em dois participantes (desktop/celular), bônus, outros dados, pools mistos, vantagem/desvantagem, ocorrência única, histórico, polling, troca de sala, mudo/volume local e global, aba oculta e cleanup. Não são criadas rolagens nem dados no banco de produção.

Publicação incremental somente cliente e novo MP3 sobre `argent-crossroads-v1-20261011`. Servidor, arquivos de efeitos anteriores, sons, dados, volumes, ilustrador e 61 alterações independentes preservados. Snapshot das tabelas antes/depois; hashes dos bundles, HTML e mídia ao vivo. Commit limitado à integração, componente, detector, testes, QA, MP3 e documentação, em `origin/Welson`.
