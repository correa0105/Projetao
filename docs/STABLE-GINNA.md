# Ginna — estábulo, balões e visão persistente

Implementado em 03/10/2026. Substitui Brida na interface do estábulo.

## Interação

Ginna tem aparência jovem, pintura realista, nenhum chapéu e escala reduzida para
aparentar 1,50 m junto às montarias e à cerca. Ao entrar, a fala alegre é
“Olha só, visita! Seja muito bem-vindo! Entre, entre! Se ganhar uma lambida,
considere um abraço de boas-vindas. Vem conhecer meus queridinhos — só cuidado
com o seu lanche, hihi!” A identificação é Cuidadora e o nome só aparece
depois de escolher Quem é você?
O balão inicial de boas-vindas desaparece após 7 segundos a cada entrada no
estábulo. Clicar na personagem continua abrindo a conversa; o prazo da saudação
não interrompe perguntas, respostas ou a sequência de advertências.
Clique nela ou use Enter para abrir um balão ancorado à personagem, com três
perguntas sobre identidade, origem dos animais e consequências de maltratá-los.
Fluxo como na loja: O que deseja saber? abre as opções; selecionar uma fecha
as perguntas e mostra apenas a resposta. Clicar novamente ou Escape fecha.
Sem rótulo/botão Conversar visível nas duas formas; o próprio corpo é clicável
e brilha no hover/foco (dourado como o mercador, suave e frio na visão).
Balão SVG com um único preenchimento no corpo/ponta e tipografia compartilhada.
Sua posição é medida no retrato contido, descontando as margens vazias da
caixa clicável. A ponta fica junto à lateral do rosto, na altura da boca;
recalcula com texto, opções, carregamento da arte e tamanho da cena, nas duas
formas. Usa coordenadas locais para acompanhar o tremor sem saltar.
Não abre janela central nem escurece a página para a conversa normal. Balão
adaptado ao espaço do celular; textos longos rolam dentro dele. A seleção de
cada espécie alterna três comentários carinhosos; comentários de nomes e
equipamentos continuam disponíveis.

A quinta pergunta sobre maus-tratos, na mesma visita ao estábulo, abre uma visão
persistente. A pergunta inicial é “E se eu fizer mal a ele?”. O balão permanece
aberto, exibindo cada advertência e a próxima desculpa: discipliná-lo, falta de
obediência, ensinar uma lição e ninguém ficar sabendo. Não exige clicar de novo
na personagem entre as cinco etapas. A quarta advertência é enfática, com
“ÚLTIMA VEZ”, “NÃO MALTRATE NENHUM DELES, EM HIPÓTESE ALGUMA!” e
“VOCÊ ENTENDEU?”, sem mencionar a terra.
Fechar e reabrir a conversa não zera a
insistência; a pergunta retoma a próxima desculpa. A visão ocupa
a tela com o mesmo cenário destruído, névoa escura, Ginna menor em fumaça sem
chapéu e tremor irregular contínuo. Vinte e três olhos compõem a visão:
22 no chão e um grande substituindo o pico central. Os seis pequenos do fundo
foram removidos, assim como cinco próximos à esquerda da cuidadora.
O fundo foi editado para retirar o pico, preservando o restante da composição.
Arte nova tem globo saltado, pálpebras grossas, terra rachada e sombras de contato;
os olhos emergem em tempos diferentes e piscam com transição entre aberto e
fechado. A perspectiva do chão varia com a profundidade: mais rasante no fundo,
mais aberta perto da câmera; a base permanece apoiada na terra. O olho da
montanha é menor e mais alto, com a parte inferior esmaecida acima da floresta,
mantendo a íris dentro da face rochosa. Uma máscara SVG acompanha a silhueta
real da crista e recorta a terra acima dela, sem invadir o céu. Os olhos no
chão alternam tamanhos também na mesma faixa de profundidade: alguns discretos,
outros maiores, com largura entre 1,8% e 8,2% do plano do cenário.
Os do primeiro plano evitam arbustos,
galhos e a faixa imediatamente à esquerda da cuidadora.
Mantida a arte com relevo, sem o achatamento duplicado do atlas antigo. Olhos e fundo
usam o mesmo plano cover, mantendo a posição sobre a terra ao recortar a cena
no celular. Dessaturação, escurecimento e névoa integram as cores ao chão;
sem dominar o primeiro plano. Não utiliza a criatura com bocas da
primeira proposta. O animal fica oculto com sua seleção/equipamentos mantidos.

“Pague para ver o que acontece…” aparece em balão junto à forma escura. A cena
não tem tempo de retorno automático: clicar nela abre a opção Não vou
machucá-los!, que inicia o retorno ao dia. Duas pálpebras curvas fecham a visão
do visitante em 420 ms; com a tela completamente preta, o cenário escuro é
retirado. Após uma pausa de 380 ms, os olhos reabrem em 720 ms sobre o estábulo
normal, com a montaria/equipamentos preservados, e o foco volta à cuidadora.
Uma gravação real e curta de respiração ofegante acompanha o gesto e continua
por cerca de 4,27 segundos no total, sem loop. Respeita mute/volume geral
(125%, limitado a 100%) e para ao ocultar a aba ou sair do estábulo.
Escape revela
a resposta e não encerra a cena. Ocultar a aba pausa a música, mantendo a
visão, e voltar retoma a faixa. O contador reinicia após a promessa e Ginna
responde “Assim é melhor…”. Movimento reduzido mantém olhos, névoa e cenário
estáticos, preservando a interação e a permanência até a escolha; o retorno
usa um fade curto de 120/220 ms com a mesma pausa preta, em vez de pálpebras
em movimento. Escape não interrompe a transição; animações/timer são cancelados
ao desmontar a página.

A música principal é pausada, preservando sua posição. A trilha temporária
usa o MP3 fornecido pelo usuário em loop, respeita volume/mute e para ao
encerrar a visão; a música principal retoma do ponto anterior. Controle de som
disponível dentro da cena. Nenhum iframe externo.

## Arquivos finais

| Arquivo | Uso |
| --- | --- |
| `public/stable/ginna.webp` | Ginna jovem, sem chapéu, 768 × 1152, alfa |
| `public/stable/ginna-shadow.webp` | Forma escura sem chapéu, 768 × 1152, alfa |
| `public/stable/paddock-ruined-eye-mountain.webp` | Cenário arruinado com o pico removido, 1672 × 941 |
| `public/stable/ginna-raised-eyes.webp` | Olho saltado, atlas vertical aberto/fechado, 768 × 1536, alfa |
| `public/stable/ginna-mountain-mask.svg` | Recorte da terra do olho pela crista da montanha |
| `public/audio/ginna-lullaby-of-woe.mp3` | Trilha temporária fornecida pelo usuário |
| `public/audio/ginna-panting.mp3` | Heavy Breathing, Under7dude / Freesound #163383, CC0, prévia MP3 pública |
| `docs/references/ginna-reference.jpg` | Referência da aparência enviada pelo usuário |
| `docs/references/ginna-shadow-reference.png` | Referência da forma escura enviada pelo usuário |

Todas as artes raster foram criadas/editadas no **modo integrado (built-in image_gen)**.
Conversão dos resultados selecionados para WebP com Sharp, qualidade 92 e alfa
100, sem retirar transparência. Originais gerados permanecem na biblioteca local
de imagegen; os arquivos consumidos pelo site estão integralmente no projeto.
As referências têm autoria/licença original não informadas.
Fonte/licença da respiração: [Heavy Breathing, Under7dude](https://freesound.org/people/Under7dude/sounds/163383/),
[CC0](https://creativecommons.org/publicdomain/zero/1.0/). Proveniência e reprodução
registradas em `public/audio/manifest.json`. O arquivo é servido pelo próprio
site, sem player/iframe externo.
Prompts completos das duas novas artes e modo integrado registrados em
`docs/STABLE-GINNA-EYES.json`. `paddock-ruined.webp` e `ginna-ground-eyes.webp`
permanecem como versões anteriores; o site usa os novos arquivos.

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
Edge. Cobre saudação alegre sem nome e revelação pela pergunta, retirada do
rótulo Conversar, brilho em hover/foco, fluxo de perguntas/respostas como a
loja, distância da ponta até o rosto nas duas formas e seis viewports,
balão sem modal central, quatro desculpas sucessivas com balão mantido,
cinco insistências com fechamento/reabertura, ocultação/retorno da
montaria, distribuição/proporções dos 23 olhos, ausência dos olhos de encosta,
olho no pico, piscar
aberto/fechado, relevo não achatado, tremor,
permanência além do antigo timeout, clique real na cena em movimento,
promessa obrigatória, fechar/abrir das pálpebras, pixels totalmente pretos na
troca do cenário, retorno ao dia com seleção mantida, reprodução/duração/volume
da respiração e mute no celular, loop/mute/pausa/retomada da trilha, encerramento do áudio
temporário, foco, celular/movimento reduzido e os fluxos anteriores de compra,
ownership, idempotência, saldo, persistência e seis viewports.

Capturas locais em `test-results/ginna-conversation.png`,
`ginna-welcome.png`, `ginna-welcome-mobile.png`,
`ginna-vision-desktop.png`, `ginna-balloon-mobile.png`,
`ginna-vision-mobile.png`, `ginna-return-closed.png`, `ginna-return-day.png`
e `stable-*.png`.
