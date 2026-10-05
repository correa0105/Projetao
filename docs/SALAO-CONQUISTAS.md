# Salão das cartas, conquistas e corvo — 05/10/2026

Direção atual: janela no terço esquerdo, anfitrião menor ao fundo à direita em sombra, luz fria lateral, cartas em leque no primeiro plano. Conversa sob demanda, com encerramento e Escape; não há painel de diálogo permanente. Três cartas equipadas, preços e obtenção preservados. Aprimoramento e drops seguem pendentes conforme o usuário.

Correção do usuário: a página original **Conquistas** foi restaurada, incluindo
estante, prateleiras sem limite, posições livres, personalização e catálogo.
O menu/página separado **Títulos** foi removido; títulos ficam abaixo do catálogo
de conquistas. `#titles` antigo redireciona para Conquistas. Administração altera
nome/descrição e título vinculado pelo botão **Editar conquista**, com revisão e
transação. **Criar título** parte da conquista e preenche sua meta. O título em
exibição é escolhido nessa mesma página; **Administrar títulos** continua permitindo
metas e concessão/revogação manual. Trocar/remover vínculo preserva títulos já
recebidos. Direitos de administrador conferidos no servidor. Migration 055 guarda
definições editáveis; nenhum dado existente foi apagado. O título aparece separado
do nome na tela do personagem e ficha, com atalho **Escolher título**.

Corvo clássico sem madeira, apoiado nas próprias patas. Aparência alternativa já não tinha poleiro. PNG novo substitui apenas o corvo clássico, com enquadramento completo e proporção preservada.

## Validação

TypeScript e build cliente/servidor; sete testes de comunidade em PostgreSQL
descartável; fluxo completo no Edge (artes/sons/compras/cartas, conversa sob
demanda, edição/vínculo/concessão de títulos e responsividade); smoke específico
de conquistas (dois personagens, permissão e persistência) passaram. PNG/SVG
dos animais verificados sem cortes ou vizinhos. Movimento reduzido preservado;
celular mostra janela e anfitrião, com rolagem dentro do leque.

Entrega anterior do salão aplicada no Docker local com migration 055. A correção
de Conquistas é registrada em CONTEXTO.md junto do calendário/mascotes.
Backup anterior à migration em
.local/backups/alvorada-before-salon-20261005.dump, ignorado no Git.
Volumes e dados históricos preservados.
Healthcheck saudável; corvo e salão novos servidos com HTTP 200/image/png.

## Artes e prompts

Modo: image_gen integrado com referências. Imagens originais preservadas; alfa do corvo mantido. Arquivos finais:

### raven_ground_v4

[public/pets/raven-ground-v4.png](../public/pets/raven-ground-v4.png)

Transparência: sim.

Prompt final:

```text
Create a single transparent full-body production game cutout of the adult raven in TOP RIGHT of reference 1. Preserve the beautiful highly detailed semi-realistic painted feather quality, natural intelligent dark eye, robust charcoal beak, deep black/blue/violet layered plumage and warm restrained fantasy-game lighting. CHANGE ONLY SUPPORT AND POSE: remove the complete wooden branch. Raven stands naturally directly on its TWO scaled feet, talons resting flat and spread on the ground, not gripping a perch. Full body, wings, beak, feet and entire tail visible with generous 8 percent transparent margin on ALL canvas sides. Believable adult anatomy, alert three-quarter side pose facing right, subtle feather highlights. No branch, stump, wood, rocks, props, base, pedestal, floor, landscape or cast shadow. Truly transparent background with clean alpha, no glow/fringe/halo. One raven only, no text, logo, UI or other animals.
```

### midnight_room_v2

[public/cards/moonlit-room-v2.png](../public/cards/moonlit-room-v2.png)

Transparência: não.

Prompt final:

```text
Recompose the same sophisticated premium dark fantasy painterly RPG salon in reference 1 with its mysterious black-haired top-hatted feather-cloaked golden-eyed host, preserving the character identity and the refined mature material detail. Create a WIDE LANDSCAPE 16:9 full scene artwork, no text or UI. Camera stands far back inside a large dim luxurious gothic library at midnight, dramatically deeper and darker than reference. EXACT COMPOSITION: tall narrow gothic arched glass window stands in the LEFT THIRD (around x=30%, top=12% to bottom=65%), set back in the rear wall, pale cloudy moonlight outside but no giant white moon or overexposed window. Luxurious antique dark walnut upholstered armchair with the HOST seated in the RIGHT THIRD (center x=71%, y=50%), farther back and SMALLER, complete chair/boots in frame, host occupies only about 32% image height. His face and hat largely concealed in shadow; only tiny dim amber eyes, a narrow pale cold rim on one cheek, glove, feathers and shoulder make silhouette readable, no brightly lit anime face. He calmly reclines with crossed legs, head slightly tilted toward viewer. Cool MOONLIGHT travels DIAGONALLY from left window across the dark room toward host on right, with a thin restrained hazy visible shaft and dust motes, subtle blue highlights only along the side facing the window; deep charcoal-indigo shadows preserve intrigue. Right wall dark bookcases, heavy curtains, antique trim, brass details barely readable, modest few faint candles never bright enough to override moonlight. Dramatic realistic chiaroscuro, matte tactile wood/velvet, deep perspective, elegant ominous suspense, richly painted scene coherent with site. BOTTOM THIRD is a shadowy spacious empty foreground tabletop with almost black velvet and a soft moonlit edge, unobstructed for interactive fan of cards rendered later in website code. TOP LEFT corner mostly darkness for a small website heading, full composition should remain readable but very dark, no UI panels, no floating cards, no painted deck, no writing, no symbols/annotations, no red/yellow/blue markup. Window and seated man both behind the foreground, balanced space between them.
```
