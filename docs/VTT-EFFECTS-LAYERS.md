# Efeitos e camada de barreiras — 07/10/2026

O VTT oferece 16 modelos. Os seis IDs existentes continuam válidos em mesas e
atalhos salvos: sangue, chamas, gelo, veneno, cura e faíscas. Os dez novos são
relâmpagos, selo arcano, barreira, luz radiante, sombras, ácido, vendaval, água,
terra e raízes. Cor, tamanho, duração e aplicação em grupo continuam disponíveis.

As animações são desenhadas no Canvas da mesa, com partes atrás e à frente do
token. O enquadramento acompanha a proporção real da imagem. O sangue conserva
a imagem inteira avermelhada, com poça irregular; os elementos usam gradientes,
partículas e formas próprias. Não alterar IDs antigos ao reorganizar a galeria.

A galeria mostra prévias estáticas; somente a prévia sob foco ou cursor anima.
A preferência de movimento reduzido é respeitada em tempo real. Fechar a galeria
ou o editor libera seus loops. O cache de superfícies auxiliares tem limite de
24 entradas. Efeitos encerrados não continuam sendo desenhados.

## Paredes

Paredes, portas e janelas só podem ser exibidas, selecionadas e editadas na
camada **Iluminação e barreiras** pelo mestre autorizado. A troca de camada
encerra gestos de barreira e limpa sua seleção. Ferramentas e listas de barreiras
acompanham essa camada; uma porta invisível não deve responder a duplo clique.

As paredes salvas continuam participando da visão, iluminação e bloqueio de
movimento em qualquer camada. A restrição é da interface de edição: não apagar
paredes do documento ao sair da camada nem ignorá-las no cálculo da física.
Prévia de jogador e jogadores comuns não revelam a geometria administrativa.

## Arquivos e verificação

`shared/vtt-effects.ts` define os modelos e valida dados salvos. Os módulos
`src/vtt-effects-*.ts` desenham os efeitos; `VttEffects.tsx` e
`VttEffectPreview.tsx` apresentam e editam os modelos. `Vtt.tsx` controla as
ferramentas e a camada de barreiras.

`tests/vtt-effects-render.test.ts` e `scripts/smoke-vtt-effects-quality.mjs`
verificam todos os modelos, transparência, três tamanhos, duração, limpeza dos
loops e o editor em 1440, 768, 390 e 320 px. A restrição de paredes é verificada
alternando camadas com geometria salva, incluindo seleção e gestos em andamento.
