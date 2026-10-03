# Ginna — estábulo e visão breve

Implementado em 03/10/2026. Substitui Brida na interface do estábulo.

## Interação

Ginna tem aparência jovem, pintura realista e nenhum chapéu. Clique nela ou use
Enter para conversar. As três perguntas cobrem identidade, origem dos animais
e consequências de maltratá-los. A seleção de cada espécie alterna entre três
comentários carinhosos; comentários de nomes e equipamentos continuam disponíveis.

A quinta pergunta sobre maus-tratos, na mesma visita ao estábulo, abre uma visão
de 4,8 segundos. Fechar e reabrir o diálogo não zera a insistência. A visão ocupa
a tela com o mesmo cenário destruído, névoa escura, Ginna em fumaça sem chapéu e
cinco olhos baixos na perspectiva do chão, piscando em ritmos diferentes.
Não utiliza a criatura com bocas da primeira proposta. O animal selecionado
fica oculto; sua seleção e os equipamentos são mantidos.

“Pague para ver o que acontece…” aparece durante a visão. Retorno automático,
Escape e Voltar ao estábulo encerram a cena e devolvem o foco a Ginna. Ocultar
a aba também encerra a visão. O contador reinicia depois da cena. Movimento
reduzido mantém olhos e névoa estáticos, sem mudar a duração ou o diálogo.

A música principal é pausada, preservando sua posição. A trilha temporária
usa o MP3 fornecido pelo usuário, respeita volume/mute e para ao encerrar a
visão; a música principal retoma do ponto anterior. Nenhum iframe externo.

## Arquivos finais

| Arquivo | Uso |
| --- | --- |
| `public/stable/ginna.webp` | Ginna jovem, sem chapéu, 768 × 1152, alfa |
| `public/stable/ginna-shadow.webp` | Forma escura sem chapéu, 768 × 1152, alfa |
| `public/stable/paddock-ruined.webp` | Cenário arruinado, 1672 × 941 |
| `public/stable/ginna-ground-eyes.webp` | Atlas vertical aberto/fechado, 768 × 1024, alfa |
| `public/audio/ginna-lullaby-of-woe.mp3` | Trilha temporária fornecida pelo usuário |
| `docs/references/ginna-reference.jpg` | Referência da aparência enviada pelo usuário |
| `docs/references/ginna-shadow-reference.png` | Referência da forma escura enviada pelo usuário |

Todas as artes foram criadas/editadas no **modo integrado (built-in image_gen)**.
Conversão dos resultados selecionados para WebP com Sharp, qualidade 92 e alfa
100, sem retirar transparência. Originais gerados permanecem na biblioteca local
de imagegen; os arquivos consumidos pelo site estão integralmente no projeto.
As referências têm autoria/licença original não informadas.

Áudio: cópia integral e sem conversão de “Lullaby of Woe - Ashley Serena
(LYRICS).mp3”, presente na pasta Downloads do usuário. Link indicado:
https://www.youtube.com/watch?v=ohNpf4VnlP8 . Não é atribuído a CC0.

## Prompts finais

### Ginna jovem — edição com duas referências

> Use case: identity-preserve. Edit target: Image 1, the realistic blonde stable keeper; Image 2 is the original youthful character reference. Make the character visibly YOUNGER, a teenage girl around 16, with youthful rounded cheeks, a smaller delicate chin, soft natural facial features, a cheerful innocent warm expression, no makeup and adolescent proportions rather than mature adult shoulders/body. Keep the REALISTIC medieval fantasy painted rendering, not anime. Preserve long golden-blonde hair, bangs and single side braid, amber eyes, exactly the same modest high-neck dark-purple dress, cream puff sleeves and full apron, red neck ribbon, brown practical shoes and handful of hay. Keep full body with both feet completely visible in a 2:3 portrait composition and same relaxed stance. NO hat, NO head accessory. Truly transparent alpha background: remove the diffuse colored halo currently surrounding her, no painted background, no white matte, glow, sticker edge or outline. Natural soft dusk illumination on the figure only. Main requested change is clearly youthful teenage appearance, keeping outfit/style recognizable.

### Forma escura — edição da referência sem chapéu

> Use case: precise-object-edit. Edit target: the black smoky girl supplied by the user. Remove the witch hat COMPLETELY, including all brim, cone, bow and star. Replace its former area with naturally shaped dark flowing hair and a small amount of dark translucent smoke, leaving a clear normal head silhouette. Preserve her exact pose, long hair and single braid, modest layered medieval dress, arms, legs, shoes and two bright small white glowing eyes in the completely shadowed face. The character must have youthful TEENAGE proportions and REALISTIC painted anatomy/fabric/smoke detail consistent with a realistic medieval fantasy site, not a mature woman and not a cartoon. Keep charcoal-black monochrome, eerie thin smoky edges around hair and dress. Remove all white background and all white matte/sticker outlines; true transparent alpha outside her and dark smoke, no white haze or colored halo. Full body fully visible in a 2:3 portrait with a little margin. No new hat/head ornament, no animals, scenery, text or gore.

### Cenário — edição da paisagem existente

> Use case: lighting-weather. Asset type: wide realistic painted horror version of this exact medieval stable landscape. Edit target: the supplied stable paddock. Preserve the camera angle, the left stable building, fence placement, lake, mountain silhouette and distant town on the right so the nightmare is recognizable as the SAME PLACE. Transform it into a nearly black ruined vision at night: collapsed stable roof and splintered fence, shattered distant towers, cracked muddy dark ground, dead trees, low ominous charcoal fog across foreground, dim desaturated gray-brown details readable against deep black. No sunset glow, no orange fire. Cinematic realistic medieval fantasy painting matching the reference's rendering quality. Empty foreground for a separately composited NPC and emerging creatures. No horses or any animals, no people, no monster faces yet, no text, no UI. Wide 16:9, terrifying atmosphere, no gore.

### Olhos no chão — geração do atlas

> Use case: stylized-concept. Asset type: TWO-FRAME transparent sprite sheet for blinking eyes embedded FLUSH in the ground of a realistic medieval horror scene. Exactly two equal rectangular frames stacked vertically, top OPEN eye, bottom the IDENTICAL eye CLOSED. Whole canvas 3:4; each frame 3:2. Each frame contains the SAME single large eye set into a very low shallow cracked dark-earth opening. Camera looks DOWN at the ground from a shallow 35-degree above-ground angle, so the eye opening is a broad HORIZONTAL flattened almond/ellipse foreshortened by ground perspective. No upright eyeball looking from a standing creature, NO mound or monster head, NO mouths, teeth, faces, extra eyes or creature. The upper frame eye has a pale gray iris with an inky pupil and dim wet reflection; fleshy charcoal eyelids meet rough dark muddy soil at the edges. The lower frame shows the upper eyelid covering the iris completely with a single closed-eye crease; precisely same soil rim, lighting, viewpoint, footprint and location within the frame. Eye sits at the middle of each frame with generous transparent margin; widths match. Realistic detailed dark fantasy PAINTING matching the stable website, nuanced muddy earth, translucent sparse dirt crumbs. Absolutely transparent alpha outside each eye/soil rim, no background, halo, white outline or text. This is a production sprite sheet: same scale and framing for perfect blinking alignment.

## Validação

`node scripts/test-stable-isolated.mjs` usa PostgreSQL descartável e Microsoft
Edge. Cobre as três perguntas, cinco insistências com fechamento/reabertura,
ocultação/retorno da montaria, piscar aberto/fechado, pausa/retomada da trilha,
encerramento do áudio temporário, retorno de foco, celular com movimento
reduzido e os fluxos anteriores de compra, ownership, idempotência, saldo,
persistência e seis viewports.

Capturas locais em `test-results/ginna-conversation.png`,
`ginna-vision-desktop.png`, `ginna-vision-mobile.png` e `stable-*.png`.

