# Refino das falas e dos animais — 05/10/2026

## Direção atual

Remover os riscos/linhas animados sobre a madeira durante a escrita; placa permanece limpa até a resposta. O gesto da pata e as duas poses continuam. Falas de Garalho reescritas como comentários de quem convive com cada bicho, sem instruções genéricas ou linguagem de inventário no diálogo. Saudação, três respostas, dez comentários e despedida renovados.

O usuário pediu substituir todas as aparências clássicas, com acabamento comparável ao pastor e às aparências alternativas. Novas pranchas 2×2 dão mais resolução por animal: dez figuras adultas com anatomia natural, pelo/penas/escamas detalhados e margens transparentes. As duas corujas ficam no chão, com patas visíveis, sem tronco ou poleiro. Aparências, IDs, nomes, compras e preços permanecem compatíveis com os mascotes já adquiridos.

## Validação

TypeScript e build passaram. O fluxo real no Edge, em banco descartável,
conferiu as 17 aparências sem cortes ou vazamento de vizinhos nas pranchas,
a pintura dos animais no jardim, a placa sem SVG de escrita, as novas falas,
sons e compras. Placa e página verificadas em 320, 390 e 768 px, sem overflow.
As duas corujas têm patas visíveis e não usam tronco ou poleiro.
Docker local recompilado e atualizado, com healthcheck saudável. Bundle
index-1YPdHXfR.js / index-BdzxehXv.css confirmado em localhost:3000;
as quatro artes v3 respondem HTTP 200. Nenhuma alteração SQL nesta atualização.

## Artes e prompts

Modo: ferramenta integrada image_gen, com referências; não utilizado CLI/API. Saídas finais em public/pets, PNG com transparência preservada. Originais v2 preservados. Renderização usa enquadramento próprio por silhueta e meet/clipPath, com tamanhos de cena coerentes por espécie.

### pet_classics_a_v3

Arquivo final: [public/pets/classics-a-v3.png](../public/pets/classics-a-v3.png).

Fundo transparente: sim. Referências: 2.

Prompt final:

```text
Reimagine the requested classic pets for the existing Alvorada Cinzenta fantasy RPG website. Reference 1 (animals-v2) shows species/coat identity only; its puppy-like proportions and simplified appearance must be improved. Reference 2 (variants-a-v2) is the PRIMARY QUALITY/STYLE TARGET, especially the mature standing German shepherd: sophisticated detailed semi-realistic painted animal art, realistic adult anatomy and fur/feather microtexture, expressive but naturally sized eyes, believable muscles, paws and joints, warm restrained lantern lighting and soft cool fill, deep material shadows, painterly edge variation. Match that shepherd's rendering quality; not a cartoon, toy, baby animal, flat sticker, plush figure or photograph. Produce an EXACT TWO COLUMNS BY TWO ROWS sprite sheet, square canvas, genuinely TRANSPARENT background. Each assigned pet occupies its own quadrant, full body completely visible including every ear, paw, wing tip and entire tail, with a generous transparent margin of at least 8% of its own cell on ALL sides. No overlap or shared shadows between cells. Center and fit each silhouette in its cell without stretching anatomy. Species have natural body proportions; scene physical sizes will be controlled in code. Premium game production asset, cohesive fur/feather/skin detail and color grading, no neon edges or colored fringe, no halos, no floor, no landscape, no cast shadows, text, logo, interface or props . Exact assignment: TOP LEFT: a mature golden retriever with richly layered golden-brown medium-long fur, strong natural adult build, floppy ears, intelligent brown eyes and a complete feathery tail; STANDING comfortably in three-quarter side view facing right with head toward viewer, all four distinct paws grounded, no sitting puppy. TOP RIGHT: a mature gray-brown striped tabby domestic cat, lithe normal feline anatomy, dense short detailed fur, natural green eyes and full curved tail, standing three-quarter side view facing left with relaxed attentive expression. BOTTOM LEFT: an adult ivory/cream domestic rabbit in a natural crouched three-quarter side pose, believable elongated hindquarters, detailed fine fur, naturally long ears, small warm dark eyes, visible paws and small tail, not a rounded baby plush rabbit. BOTTOM RIGHT: a mature tawny woodland owl standing naturally directly on the ground, WITHOUT any branch, stump, rock, platform or perch, complete body and folded wings, individual layered patterned feathers with fine barbs, naturally sized amber-dark eyes, two visible scaled feet and distinct talons supporting its body, feet at the bottom of the silhouette; sophisticated realistic owl anatomy, not a cute round icon. The owl has no base or prop underneath, only its feet; transparent background with no painted ground.
```

### pet_classics_b_v3

Arquivo final: [public/pets/classics-b-v3.png](../public/pets/classics-b-v3.png).

Fundo transparente: sim. Referências: 2.

Prompt final:

```text
Reimagine the requested classic pets for the existing Alvorada Cinzenta fantasy RPG website. Reference 1 (animals-v2) shows species/coat identity only; its puppy-like proportions and simplified appearance must be improved. Reference 2 (variants-a-v2) is the PRIMARY QUALITY/STYLE TARGET, especially the mature standing German shepherd: sophisticated detailed semi-realistic painted animal art, realistic adult anatomy and fur/feather microtexture, expressive but naturally sized eyes, believable muscles, paws and joints, warm restrained lantern lighting and soft cool fill, deep material shadows, painterly edge variation. Match that shepherd's rendering quality; not a cartoon, toy, baby animal, flat sticker, plush figure or photograph. Produce an EXACT TWO COLUMNS BY TWO ROWS sprite sheet, square canvas, genuinely TRANSPARENT background. Each assigned pet occupies its own quadrant, full body completely visible including every ear, paw, wing tip and entire tail, with a generous transparent margin of at least 8% of its own cell on ALL sides. No overlap or shared shadows between cells. Center and fit each silhouette in its cell without stretching anatomy. Species have natural body proportions; scene physical sizes will be controlled in code. Premium game production asset, cohesive fur/feather/skin detail and color grading, no neon edges or colored fringe, no halos, no floor, no landscape, no cast shadows, text, logo, interface or props unless a tiny natural perch is specified. Exact assignment: TOP LEFT: a mature red fox STANDING in three-quarter side view with slender canine anatomy, rusty red and dark shaded fine fur, black lower legs, off-white chest and full long bushy tail with cream tip, pointed attentive muzzle, natural amber eyes; not a sitting round cub. TOP RIGHT: a mature raven with natural intelligent black eye, robust gray-black beak, extremely detailed layered deep charcoal feathers and restrained iridescent blue-violet highlights, complete folded wings and full tail, balanced naturally with distinct scaled feet on a small dark weathered branch, proud alert side pose. BOTTOM LEFT: a mature common pond frog in a natural low three-quarter crouch, olive green and earth-brown mottled subtly damp granular skin, plausible leg muscles and joints, all four feet with fine individual toes visible, naturally sized golden eyes, no cartoon smile or bulbous giant eyes. BOTTOM RIGHT: a nonvenomous earth-brown and tan patterned snake, intricately textured individual matte scales and pale belly plates, body loosely coiled with visible separation between loops, modestly raised elegant head, natural small dark eyes, mouth closed, complete tapering tail, not a cobra hood or monstrous fantasy fangs.
```

### pet_classics_c_v3

Arquivo final: [public/pets/classics-c-v3.png](../public/pets/classics-c-v3.png).

Fundo transparente: sim. Referências: 2.

Prompt final:

```text
Reimagine the requested classic pets for the existing Alvorada Cinzenta fantasy RPG website. Reference 1 (animals-v2) shows species/coat identity only; its puppy-like proportions and simplified appearance must be improved. Reference 2 (variants-a-v2) is the PRIMARY QUALITY/STYLE TARGET, especially the mature standing German shepherd: sophisticated detailed semi-realistic painted animal art, realistic adult anatomy and fur/feather microtexture, expressive but naturally sized eyes, believable muscles, paws and joints, warm restrained lantern lighting and soft cool fill, deep material shadows, painterly edge variation. Match that shepherd's rendering quality; not a cartoon, toy, baby animal, flat sticker, plush figure or photograph. Produce an EXACT TWO COLUMNS BY TWO ROWS sprite sheet, square canvas, genuinely TRANSPARENT background. Each assigned pet occupies its own quadrant, full body completely visible including every ear, paw, wing tip and entire tail, with a generous transparent margin of at least 8% of its own cell on ALL sides. No overlap or shared shadows between cells. Center and fit each silhouette in its cell without stretching anatomy. Species have natural body proportions; scene physical sizes will be controlled in code. Premium game production asset, cohesive fur/feather/skin detail and color grading, no neon edges or colored fringe, no halos, no floor, no landscape, no cast shadows, text, logo, interface or props unless a tiny natural perch is specified. Exact assignment: TOP LEFT: a mature small gray-brown domestic rat with natural lean rodent anatomy, subtle pale belly, carefully painted short dense directional fur, realistic small pink ears and distinct feet, attentive naturally sized dark eye, fine whiskers, body in three-quarter side view; the entire long narrow softly curved bare pink tail is visible inside its cell, not a round cartoon mouse or fluffy ball. TOP RIGHT: a mature brown-and-cream guinea pig in a natural three-quarter standing side pose, realistic sturdy low body proportions and short distinct paws, textured medium-short dense fur with fine strands and natural directional highlights, modest sized dark eye, small folded ears, fine whiskers and a believable muzzle, not a circular plush toy. BOTH BOTTOM CELLS MUST BE COMPLETELY EMPTY TRANSPARENT SPACE. Exactly two animals total. Their full silhouettes and whiskers must stay inside their assigned top cells with generous margins.
```

### pet_owl_horned_ground_v3

Arquivo final: [public/pets/owl-horned-ground-v3.png](../public/pets/owl-horned-ground-v3.png).

Fundo transparente: sim. Referências: 2.

Prompt final:

```text
Create one transparent full-body production game cutout of the exact adult horned owl from the BOTTOM RIGHT of reference 1 and reference 2. Preserve identity: prominent expressive bright orange/amber eyes, two dark ear tufts with warm orange inner feathers, finely patterned gray-white, warm buff and deep brown plumage, dark beak, realistic ornate layers of wing feathers. Same premium high-detail semi-realistic painted animal style and lighting as reference 1's German shepherd: refined naturally sized eyes, believable adult owl anatomy, crisp individual feather barbs, soft warm lantern highlights and subtle cool fill, beautiful tactile material detail. CHANGE POSE AND SUPPORT: this owl stands naturally directly on the ground, both scaly feet and distinct talons clearly visible, body balanced with slightly bent legs. Remove the whole stump/branch/perch, NO wood, rock, pedestal, stool, platform or base. Legs are not attached to anything; the feet are at the bottom of its own silhouette. Full head, both ear tufts, folded wings, tail, legs and all talons completely inside a square canvas with at least 8% clear margin on all sides. Mature calm proud three-quarter pose with head turned toward viewer. Genuinely transparent background, no painted ground or floor, no cast shadow. No other animals, lettering, logo, UI, cartoon outlines, bright fringe, halo, glowing eyes or round toy proportions.
```
