# Refino dos efeitos — PeriSFX e JB2A (07/10/2026)

O usuário indicou [PeriSFX](https://www.patreon.com/cw/PeriSFX) e a
[biblioteca JB2A](https://library.jb2a.com/) como referências de qualidade.
A [publicação pública PSFX 0.4.0](https://www.patreon.com/PeriSFX/posts/august-early-0-4-134335759)
identifica PSFX como produtor de áudio sincronizado aos visuais JB2A. A página
principal Patreon não pôde ser lida pela ferramenta web; a publicação e a galeria
JB2A foram acessíveis, e as prévias da galeria foram inspecionadas no navegador.

Referências visuais observadas: Healing Generic/Loop Greenorange (fluxos com
cores secundárias e brilho central), Ice Spikes/Radial Loop White (facetas e
névoa), Lightning Orb (núcleo e descargas irregulares), Fumes/Steam White
(densidade, volume e bordas transparentes). São referências de direção artística.
Os efeitos implementados são originais em Canvas; nenhum vídeo/arquivo JB2A foi
copiado, e a mesa não consulta esses sites para funcionar.

## Implementação

`src/vtt-effects-materials.ts` gera campos de densidade/fluxo com quatro escalas
de ruído e distorção de domínio. Atlas com duas variantes transparentes de
160×160 recebem rotação e transição suave. Vapor tem iluminação variável;
fogo combina temperatura e turbulência; energia tem filamentos em espiral.
LRU de 24 atlas, sem loops de pixels a cada quadro. O cache legado de retratos
permanece independente e limitado. Sem downloads, timers ou objetos de partículas
acumulados por efeito.

`src/vtt-effects-overhead-magic.ts` redesenha gelo, cura/radiante e raio/faíscas.
Cristais têm facetas vistas de cima, chão com névoa, geada segue alpha e pequenos
fragmentos se elevam. Cura usa faixas de largura variável com bordas suaves,
verde/ouro e estrelas, hélice em altura sobre um círculo de chão centrado.
Descargas têm disparo rápido e decaimento, ramificações e núcleo luminoso; o
traçado fica estável por descarga para evitar tremor contínuo.

`src/vtt-effects-overhead.ts` aplica materiais também ao veneno, fogo, sombras,
ácido e poeira, e fluxos às correntes de água/vento, arcano e barreira. Bolhas do
veneno e materiais de terra/raízes mantêm suas identidades.

Perspectiva e emissão continuam no centro, em altura em direção à câmera superior;
nenhuma elipse abaixo dos pés ou espiral de perfil. Máscara alpha, contain,
giro e espelho permanecem. `renderEffect` aplica tamanho salvo ao plano aéreo/chão,
conservando ajuste real da máscara de superfície. Mantidos IDs, cor, duração,
presets/atalhos, acesso básico e renderer circular antigo. Sem alteração SQL.

## Verificação

Testes de footprint/projeção/render: 8/8. `smoke-vtt-effects-quality.mjs` verifica
16 modelos em três tamanhos/proporções, repouso reduzido, expiração e limpeza dos
loops; editor em 1440/768/390/320 px. Verifica círculo no mapa e eixo central em
100×100/80×150/220×90 e aumento real do efeito ao passar de tamanho 0,5 para 1,5.

Material de vapor sem pixels nas bordas da superfície de teste, 19.136 pixels
parcialmente transparentes; cache limitado a 24 e liberável. Os 15 modelos
simultâneos aquecem 22 atlas e não geram outros durante os próximos quadros.
Medição local de cerca de 9 ms/quadro para 15 efeitos em dois passes, em Edge;
não constitui garantia para outro hardware. Revisão visual de todos os modelos
e ampliação de veneno/cura/gelo/raio em dois tempos em `test-results`.

Prévia prática: `test-results/vtt-effects-refined.webm`, seis segundos, quatro
efeitos no Assassin overhead, com duas camadas no mesmo renderer da mesa;
captura `vtt-effects-refined.png`. Build TypeScript/Vite/tsup/Docker concluída.
Deploy localhost:3000 verificado por hash, saudável, Vtt-C2Otf8qn; artes privadas
e acesso anônimo 401 mantidos. 43 tabelas idênticas antes/depois, sem migrations.
