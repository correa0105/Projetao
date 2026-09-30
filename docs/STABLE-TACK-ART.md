# Selaria e chão do estábulo

Criados com a ferramenta integrada imagegen (sem chave de API). Originais anteriores preservados.

## Assets
- `public/stable/paddock-earth.png`: cenário com chão de terra.
- `public/stable/gear/saddle-riding.png`: sela de montaria.
- `public/stable/gear/saddle-military.png`: sela militar.
- `public/stable/gear/barding-leather.png`: barda de couro.
- `public/stable/gear/barding-chain.png`: barda de cota de malha.
- `public/stable/gear/barding-plate.png`: barda de placas.
- `public/stable/gear/feed.png`: ração.

## Prompts finais

### Cenário
Edit this exact realistic medieval stable background. Preserve buildings mountains sky fences sunset and framing exactly. Change foreground lawn ONLY: broad natural worn compacted brown earth paddock across lower half, from 42% height through bottom, irregular grass fringes around sides, faint hoofprints small stones dusty soil. Most center and right foreground bare earth for standing animals and keeper. No animals people objects or text added. Match warm sunset photorealistic fantasy painting. Wide landscape.
Referência: `public/stable/paddock.png`.

### Sela de montaria
Single realistic medieval riding saddle isolated on transparent background, dark warm brown leather, modest worn brass buckles, wool pad, leather girth hanging below and iron stirrup. Three-quarter LEFT side view, pommel on LEFT, cantle RIGHT, as worn on horse facing LEFT. No horse, no stand, no ground, no text. Full object uncropped with small margin. Fine hand-painted realistic RPG inventory art, warm sunset light upper left. Designed as wearable overlay on horse back.

### Sela militar
Single realistic medieval military saddle isolated on transparent background. Dark russet leather high reinforced pommel LEFT and high cantle RIGHT, olive saddle blanket, girth and stirrup hanging below. Three-quarter left side view as worn on horse facing LEFT. No horse stand ground text, full item uncropped. Fine realistic fantasy RPG art, warm sunset light upper left. Distinctive substantial cavalry saddle designed as wearable overlay.

### Bardas
Use case: product-mockup. Reference is solely for horse orientation. Create ONLY [MATERIAL], as an EMPTY wearable shell fitted to the torso of this left-facing horse. Body covering from withers to rump, chest guard descending at LEFT, draped flank panels. Horizontal three-quarter side view matching reference. NO horse visible, NO legs/head armor, NO saddle, NO mannequin, NO background. Transparent through all openings. Full item uncropped isolated with small margin. High realism medieval fantasy inventory painting, warm sunset highlights upper left. This is a layering sprite over the horse's torso.

Referência: `public/stable/riding-horse.png`. Material em cada chamada:
- brown leather segmented equine armor, natural leather panels and brass rivets
- dark steel fine interlinked chainmail equine armor blanket
- steel articulated plate equine armor, sculpted plates and modest brass edging

### Ração
One open burlap sack of horse feed, oats visible with small bundle of hay leaning against it. Single compact item isolated on transparent background. Realistic medieval fantasy RPG inventory painting, warm sunset light upper left, worn sack detailed fibers, no text no floor no other items. Full object uncropped.

## Implementação e regras
As artes de equipamentos são camadas sobre a imagem 3:2 de cada animal. `shared/stable-gear.ts` mantém os encaixes por espécie. A pelagem não altera a configuração dos equipamentos. Uma sela, uma barda e uma porção de ração por conjunto; clicar novamente remove. Ração fica no chão, não no dorso.

Catálogo inicial: seis itens equipáveis/suprimentos. Não inclui veículos, serviços de hospedagem nem sela exótica (destinada a animais aquáticos ou voadores). Dados de preço/peso: [SRD 5.2.1](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf), páginas 91 e 100. Bardas custam quatro vezes e pesam duas vezes a armadura correspondente. CA, testes e consumo são informações para a sessão, sem automação de combate.

Compra conjunta salva IDs e valor dos equipamentos em `character_mounts` (migration 035). `price_cp` permanece sendo o preço do animal; `equipment_price_cp` registra os acessórios. Débito total atômico com preço do servidor e idempotência incluindo equipamentos.

## Correção de encaixe e perspectiva
Encaixes agora são por equipamento e espécie (posição, limites e rotação), com `object-fit: contain` para preservar a proporção. Uma camada do pescoço/crina fica à frente da borda distante das bardas. Sombra projetada da própria silhueta e ajuste do plano dos cascos integram o animal ao solo. Smoke inclui sela + barda nas quatro pelagens alternativas além das 24 prévias individuais e seis viewports.

Novo asset: `public/stable/paddock-eye-level.png`, criado com imagegen integrado a partir de `paddock-earth.png`. Prompt final:

Edit this medieval stable environment for perspective compatibility with life-size horses seen at eye level in 3/4 side view. Camera at standing human eye height 1.5m with level optical axis, 50mm lens. LOWER the apparent viewpoint: distant flat ground horizon around 45 percent height, NOT overhead looking down on ground. Keep exact same visual world: left rustic timber stable, mountain valley, distant right castle, amber sunset light from upper left. Large empty flat packed dirt foreground for animals, softer finer dirt texture in midground, grass fringe only outside sides. No steep foreground slope. No horses people equipment text. Wide 16:9 realistic fantasy painting. Preserve architecture character, palette, weather. Natural ambient warm light, no harsh studio glow.
