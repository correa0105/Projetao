# Ginna — estábulo, balões e visão persistente

Implementado em 03/10/2026. Substitui Brida na interface do estábulo.

Atualização de 04/10/2026: quarta advertência usa a imagem aprovada do usuário,
`ginna-angry-approved.png`. Emergência e envolvimento recebem efeitos sonoros
sincronizados com a animação, documentados em [STABLE-GINNA-AUDIO.md](STABLE-GINNA-AUDIO.md).

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
A resposta sobre a origem dos animais foi revista em 04/10/2026: eles vêm até
Ginna, atraídos pela comida e pelo sossego, e recebem água fresca, abrigo e
paciência até se sentirem seguros. Fala direta e acolhedora, sem referências a
caminhos secretos, preservando a iniciativa dos animais de procurá-la.
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
O fundo v2 restaura um pequeno pico para acomodar o olho, preservando o restante da composição.
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
por cerca de 4,27 segundos no total, sem loop. Respeita mute/volume de Efeitos sonoros
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
usa o MP3 fornecido pelo usuário em loop, respeita volume/mute de Músicas e para ao
encerrar a visão; a música principal retoma do ponto anterior. Controle de som
disponível dentro da cena. Nenhum iframe externo.

## Arquivos finais

| Arquivo | Uso |
| --- | --- |
| `public/stable/ginna.webp` | Ginna jovem, sem chapéu, 768 × 1152, alfa |
| `public/stable/ginna-shadow.webp` | Forma escura sem chapéu, 768 × 1152, alfa |
| `public/stable/paddock-ruined-eye-mountain-v2.webp` | Cenário arruinado com pequena crista restaurada, 1672 × 941 |
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

## Expressão, tipografia e retorno com tentáculos (04/10/2026)

A terceira advertência (Minha paciência está acabando) troca a arte por
`public/stable/ginna-serious.webp`, mantendo roupa, feno, personagem e alfa.
A quarta advertência troca para `public/stable/ginna-angry-approved.png`, com expressão
muito brava; o retorno restaura a arte original. Arte criada em modo integrado,
alfa preservado e prompts registrados em [STABLE-GINNA-ANGRY.md](STABLE-GINNA-ANGRY.md).
O tremor da quarta fala aplica-se somente às palavras cujas letras são todas
maiúsculas Unicode, incluindo as acentuadas. “Esta” e “Não” em início de frase
ficam inteiramente estáticas; espaços e pontuação também permanecem estáticos.
A fala da visão escura
usa fonte maior, sem traço no meio, e dois pulsos de vermelho por ciclo de 1,6 s.
As letras permanecem legíveis e o leitor de tela recebe a frase completa.
Movimento reduzido desativa tremor/pulsação, preservando o vermelho.

Cada pico vermelho (10% e 27% do ciclo de 1,6 s) acompanha um batimento
cardíaco grave abafado. `useGinnaHeartbeat.ts` usa Web Audio e o relógio da
própria animação CSS para manter cor/som sincronizados, sem um loop de áudio
separado. Som sintetizado localmente, sem dependência de gravação externa.
Respeita volume/mute de Efeitos sonoros, pausa ao ocultar a aba e encerra recursos ao
desmontar; movimento reduzido, sem pulso visual, também desativa os batimentos.
Trocar para a resposta à promessa mantém a mesma animação e sincronia.

`public/stable/paddock-ruined-eye-mountain-v2.webp` restaura apenas um pequeno
pico central. A máscara do olho acompanha a crista mais alta, sem cortar a íris.
As artes foram editadas com a ferramenta integrada image_gen e convertidas em
WebP; as versões anteriores foram preservadas.

Ao escolher Não vou machucá-los!, GinnaTentacles inicia 5,6 s de movimento:
um tentáculo distante surge do lago, abaixo da ponte, e sobe ao céu; um segundo desce
perto da câmera e forma voltas ao redor do visitante. Tubo afilado em Three.js,
ventosas em relevo, textura existente do kraken e sombras reais, adaptados à tela.
O visitante fica dentro de um eixo vertical: as voltas passam atrás e à frente
da câmera em alturas diferentes, apertando-se no final. Não é uma espiral
desenhada no plano da tela. Luz/material dessaturados acompanham o cenário;
ondas elípticas se expandem sobre a água quando a raiz emerge.
A subida distante e as ondas acompanham o enquadramento cover e a transformação
real do cenário em tremor, incluindo translação e rotação. A pele distante
recebe escurecimento adicional discreto. A aproximação
ocupa o viewport. Em seguida as pálpebras cobrem a cena e o estábulo normal
retorna. Respiração começa somente nessa troca de cenário. Aba oculta pausa
o avanço dos tentáculos; desmontar cancela o frame pendente e libera a GPU. Movimento reduzido
mostra uma composição estática breve e mantém o fade de retorno.

Ao aceitar a promessa, o balão escuro troca imediatamente para “Melhor assim.
Estarei de olho em você.” e retira o botão. A fala continua visível durante
a subida/descida dos tentáculos até a visão ser coberta; reaparece no dia
com a mesma frase. Música, respiração e contador mantêm o fluxo existente.

### Contato com o lago e ventosas separadas

`ginna-lake-effects.ts` integra a raiz à água: transição suave no nível ondulado,
pele molhada mais escura, reflexo deformado da própria geometria, menisco com
espuma irregular, pequenos salpicos e névoa localizada. As ondas deixam de ser
elipses uniformes contínuas. Esses elementos compartilham o mesmo grupo do
tentáculo distante e acompanham exatamente o tremor e o enquadramento do fundo.
A alternativa Canvas 2D mantém os mesmos sinais de contato/reflexo.

`ginna-tentacle-cups.ts` mantém duas fileiras de ventosas pela distância real
percorrida na curva a cada pose. Todos os pares, inclusive de voltas diferentes,
limitam o tamanho usando esferas que contêm a malha completa, preservando ao
menos 0,022 unidades de espaço entre elas durante a constrição. O corpo próximo
mantém a textura anterior. Só as ventosas ganham rugas radiais, poros, aro
irregular e variação de rugosidade no interior, com UV próprio da cavidade.
Geometria, material e mapa de detalhes são liberados ao encerrar.

### Relevo dos olhos

`GinnaGroundEyes.tsx` renderiza os 22 olhos sobre superfícies curvas com
44 × 44 subdivisões. Globo, pálpebras e terra têm elevação própria, normais
calculadas e sombra de contato. O atlas original fornece a pele e a íris,
preservando a qualidade da pintura. Uma máscara separa a íris do entorno:
terra e pálpebras recebem escurecimento maior, sem mudar a cor interna cinza.
Durante a emergência, a superfície sobe de baixo do solo com recorte na
altura zero; piscar combina a forma fechada com a segunda metade do atlas.

O olho da montanha também usa superfície curva quase frontal, com globo e
pálpebras em relevo, máscara da crista e esmaecimento da base preservados.
Um canvas transparente compartilha geometria/textura entre os 23 olhos e
usa o mesmo plano cover do fundo.
Os componentes da visão/retorno são carregados sob demanda, mantendo Three.js
fora do carregamento inicial; o retorno é antecipado ao entrar na visão.
Renderização limitada a 30 fps e resolução limitada; aba oculta pausa o relógio,
movimento reduzido mostra a pose final estática. Falha/perda de contexto WebGL
mantém os olhos raster como alternativa. Recursos, observer e listeners são
liberados ao desmontar. Sem novos assets ou imagens geradas nesta revisão.

### Prompt final — expressão séria

> Use case: identity-preserve. Asset type: transparent character sprite for a fantasy stable website. Input image 1 is the edit target, the existing Ginna character. Change ONLY her facial expression and a tiny natural adjustment of head angle: she has now become serious, visibly losing patience, with brows drawn slightly inward and down, direct firm gaze at the viewer, lips closed and unsmiling with mild tension. The expression is a stern warning from a protective caretaker, believable and clear at small size, not cartoon anger. Preserve exactly the same youthful woman, face identity, blonde hair and braids, no hat, purple dress, ivory blouse/apron, red ribbon, hay in hands, hand/arm/body pose, complete full body including boots, realistic painterly style, warm daylight, scale, original silhouette and placement. Keep feet and face in the same image positions for seamless sprite swap. Transparent background with actual alpha. No scene, no shadow backdrop, no extra objects, no lettering, no red/glowing eyes, no supernatural transformation.

### Prompt final — pequena crista da montanha

> Use case: precise-object-edit. Asset type: wide background for the existing Ginna nightmare scene. Image 1 is the edit target. Change ONLY the small central distant mountain crest in the middle-left of the image, centered at 47% of image width: restore a modest amount of jagged gray-black mountain rock ABOVE its current flattened ridge, making a shallow natural peak and rocky shoulder that rises only about 3% of the total image height. It is intended to frame a separately composited eye placed on the mountain face, so leave the face rock empty. Preserve EXACTLY the existing landscape, camera, framing, image proportions, ruin at left, foreground earth/fences, dead trees, lake/bridge, castle at right, sky/clouds, nighttime lighting, dark desaturated palette. Keep the ridge natural and local, do not restore an enormous peak and do not alter mountains elsewhere. NO eye, tentacle, creature, person, text, UI, or extra fog painted in: those will be animated separately.

## Validação dos refinamentos

Smoke do estábulo verifica troca de arte na terceira e quarta falas, imagens carregadas,
palavras totalmente maiúsculas animadas e iniciais maiúsculas estáticas na quarta,
fonte vermelha ampliada sem traço, pulsação e movimento reduzido na visão,
as três etapas dos tentáculos, cena escura até envolver o visitante e retorno
com pálpebras/respiração. Capturas em `test-results/ginna-serious-warning.png`,
`ginna-angry-warning.png`,
`ginna-tentacle-sky.png`, `ginna-tentacle-descending.png` e
`ginna-tentacle-wrapping.png`.

`node scripts/test-stable-isolated.mjs` usa PostgreSQL descartável e Microsoft
Edge. Cobre saudação alegre sem nome e revelação pela pergunta, retirada do
rótulo Conversar, brilho em hover/foco, fluxo de perguntas/respostas como a
loja, distância da ponta até o rosto nas duas formas e seis viewports,
balão sem modal central, quatro desculpas sucessivas com balão mantido,
cinco insistências com fechamento/reabertura, ocultação/retorno da
montaria, distribuição/proporções dos 23 olhos, ausência dos olhos de encosta,
olho no pico, piscar
aberto/fechado, canvas WebGL com 23 olhos e malhas em relevo, tremor,
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

`node scripts/smoke-ginna-visuals.mjs` também exercita os componentes reais em
desktop/celular sem acessar o banco. Verifica canvas de olhos, sequência 3D
do retorno e ausência de erros WebGL; capturas em
`test-results/ginna-eyes-3d-*.png` e `ginna-tentacle-volume-*.png`.

Revisão 04/10/2026: build cliente/servidor, smoke isolado do estábulo e smoke
visual passaram. A revisão da montanha/lago/batimentos também passou nos dois
smokes: tremor somente em maiúsculas, piscada na malha da montanha, ondas,
transformação distante idêntica à da cena e resposta durante o retorno.
Áudio validado no Edge com disparos nos picos 10%/27%, mute/volume zero,
pausa da aba, movimento reduzido, troca de frase sem reiniciar o relógio e
fechamento do AudioContext ao sair. Verificação adicional no Edge cobriu movimento reduzido,
troca da preferência sem nova emergência, pausa em aba oculta e perda/retorno
de contexto WebGL com alternativa raster. Serviço local reconstruído no Docker.

Revisão da última advertência/contato/ventosas em 04/10/2026: TypeScript,
build cliente/servidor e smoke completo do estábulo em banco descartável passaram.
Smoke visual monitorou 623 poses em desktop e 634 no celular, sempre com
folga mínima de 0,022 e zero colisões entre ventosas. Capturas finais da nova
expressão e das cavidades revisadas. Menisco/reflexo e sincronização com três
fases do tremor também conferidos em desktop/celular, movimento reduzido e
alternativa Canvas. Novos recursos de GPU são liberados ao encerrar o retorno.


## Piscada ao entrar na visão — 04/10/2026

A quinta insistência inicia `GinnaEntry`: pálpebras curvas fecham sobre o
estábulo diurno em 240 ms. Apenas com a visão totalmente coberta a cena
escura é montada e os animais diurnos são ocultados. A cobertura permanece
fechada até o componente e suas artes estarem prontos; após uma pausa de
120 ms, as pálpebras abrem em 360 ms. O antigo fade de revelação foi removido.

A visão e a piscada usam diálogos no top layer, com ordem controlada no
layout antes do paint. Assim, cabeçalho e menu diurnos não aparecem sobre a
cena durante a abertura. A cuidadora escura recebe foco somente ao terminar;
Escape e interação com o cenário são bloqueados enquanto a piscada ocorre.
Movimento reduzido usa fade de 100/160 ms, mantendo a troca sob preto.
O diálogo da visão usa `overflow: clip` para que o foco não desloque a cena
horizontalmente ao abrir a resposta ou repetir a sequência no celular.

O chunk da visão é antecipado na quarta advertência e o preload usa a arte
vigente `paddock-ruined-eye-mountain-v2.webp`. Falha do WebGL conserva o
alternativo raster; prontidão da entrada não depende de WebGL. Animações,
timer e callbacks pendentes são cancelados ao sair da página. O retorno com
tentáculos, sons, pálpebras e respiração mantém sua sequência anterior.

`node scripts/smoke-ginna-entry.mjs` exercita os componentes reais sem banco:
fechamento no dia, montagem sob cobertura, arte atrasada, pixels pretos,
abertura no escuro, camadas acima do HUD, foco, Escape, movimento reduzido,
navegação durante a piscada e retorno. O smoke isolado do estábulo também
aguarda a entrada terminar antes das interações na visão.

O smoke focado passou em desktop e celular, incluindo a segunda entrada
após retorno/redimensionamento. A cena permaneceu sem rolagem, o balão ficou
dentro do viewport e a abertura não mostrou pixels do HUD diurno. A cobertura
fechada ficou totalmente preta mesmo com a arte atrasada.
TypeScript, build cliente/servidor e smoke completo do estábulo em PostgreSQL
descartável também passaram, cobrindo retorno, áudio, compras e seis viewports.
Docker reconstruído; healthcheck e bundle da piscada confirmados no serviço local.
