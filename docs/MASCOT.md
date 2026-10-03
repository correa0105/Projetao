# Raposa de cristal

Mascote definido pelo usuário em 03/10/2026. A aparência segue as três imagens
fornecidas: pelo branco, orelhas grandes, detalhes dourados, cristais em azul,
rosa e violeta. A cauda tem raiz estreita, meio cheio e ponta afunilada, como
uma pluma alongada. Os olhos têm superfície inteiramente em tons de roxo,
sem esclera ou borda branca; pequenos reflexos pontuais permanecem.

## Arquivos

| Arquivo em `public/mascot/`      | Origem e uso                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------- |
| `crystal-fox-reference.png`      | Imagem original Raposa Mágica de Cristal fornecida pelo usuário.             |
| `crystal-fox-tail-reference.png` | Referência autoritativa de cauda: Criatura Celestial de Cauda Estrelada.     |
| `crystal-fox-eyes-reference.png` | Referência autoritativa de olhos: Criatura Mágica com Cauda de Vitral.       |
| `crystal-fox-run-source.png`     | Arte final gerada com imagegen integrado, PNG transparente com quatro poses. |
| `crystal-fox-run.webp`           | Atlas utilizado na interface, 1024 × 1024, quatro células de 512 × 512.      |

O modo usado foi o **imagegen integrado**, sem CLI ou chave de API. O primeiro
atlas de corrida foi revisado visualmente e editado com as referências de
cauda/olhos. Apenas a versão corrigida é usada no projeto.

## Prompt da arte final

Imagem 1: atlas intermediário de corrida usado como alvo da edição.
Imagem 2: referência da cauda. Imagem 3: referência dos olhos.

```text
Use case: precise-object-edit. Asset type: 2x2 transparent four-frame running sprite atlas. Image1 is the edit target. Images2 and3 are the authoritative identity corrections from the user. Correct ALL FOUR foxes in Image1: (A) their tail is NOT a round ball, ring, donut, circle or curled puff. Replace it with the elongated tapering fox plume from Image2, a long supple leaf-shaped tail with a distinct pointed tip, white fur outer edge and blue/pink/violet stained glass sections framed by gold filigree, trailing behind in a relaxed curved S-shape while running. It has a narrow root, full middle and clearly tapered pointed end. See Image3 for the continuous taper even when curved. (B) The whole visible eye surface is purple: deep violet upper part, purple/lavender lower part, dark purple outline, dark purple pupil blending into it, small white catchlight allowed. NO white sclera, no white ring, no white eye border, no white crescent around the iris. Copy the eye look exactly from Image3. Preserve the huge ears, white furry body, chibi proportions, gold filigree, gemstone details, same illustration style, right-facing run-cycle and four different leg poses of Image1. Maintain one consistent character identity across all frames. Layout remains a strict two-by-two grid of four equal square cells, reading-order run phases. All four entire characters fully contained in their own cell, including pointed tail, paws and ear tips: shrink to fit at least 7 percent transparent margins on ALL SIDES of each cell to avoid clipping or crossing cell boundaries. Same scale, baseline and right-facing angle throughout. Real transparent background, no environment, no floor, no text/grid, no speed lines, no additional objects. Only adjust tail shape and eyes plus spacing for complete unclipped sprites.
```

## Montagem e animação

`node scripts/build-crystal-fox-sprites.mjs` recompõe o WebP a partir do PNG
final. Recorta as quatro células, aplica uma escala comum, alinha as patas na
mesma linha do chão e preserva transparência. Usa somente arquivos do projeto.

Na lore, `LoreScrollHolderIcon` desenha a tigela e os papéis em SVG. O mascote
usa o atlas em `foreignObject`; quatro poses alternam cinco ciclos de 0,42 s.
Sua passagem dura 2,1 s. Aos 32%, o contato inicia a inclinação da tigela e o
rolo pivota na borda. O personagem continua correndo e sai; o rolo fica no chão
com os fios luminosos e estrelas até clique ou saída do ponteiro.

A sequência acontece uma vez por hover/foco. Toque abre a pasta diretamente;
movimento reduzido mantém só o rolo no chão e a magia estática. Nenhum estado
ou dado da lore é alterado por essa animação.

O smoke em banco descartável confere sincronização, limite de subida, folga
do metal durante a descida, desaparecimento do mascote, permanência/reset,
movimento reduzido e uso das pastas/crônicas em desktop/celular. Capturas em
`test-results/lore-mascot-*.png` e `lore-scroll-holder-fallen.png`.
