# Checkpoint: 25 plantas, 25 casas e revisão das cartas

Pedido de 14/10/2026. As 50 artes estão concluídas e salvas. Imagegen embutido
produziu uma imagem por planta e uma imagem de duas camadas por casa. Os prompts
completos estão em `data/vtt/plants-plan-20261014.json` e
`data/vtt/houses-plan-20261014.json`. Nenhuma arte anterior foi substituída.

Plantas: 25 WebPs transparentes de até 768 px em `public/vtt/plants-20261014`;
originais em `data/vtt/plants-sources-20261014`. Casas: 25 telhados e 25 interiores
transparentes de 1024 px em `public/vtt/houses-20261014`; originais em
`data/vtt/houses-sources-20261014`. Registros de câmera, prompt, dimensões,
retângulos de registro e SHA-256 estão nas respectivas pastas `*-completed-*`.

O código acrescenta Biblioteca → Cenários, com categorias Plantas/Casas, busca
sem acentos, prévia de interior/telhado, escala e arraste. O mestre coloca as
peças na camada Mapa. Casas do novo catálogo têm barreiras na base derivadas da
posição, tamanho, giro e espelhamento do próprio objeto. A abertura principal
fica no centro da borda inferior. Cliente e servidor usam a mesma geometria;
remover a casa remove as barreiras derivadas. Casas antigas ficam preservadas.

O interior é desenhado sob os tokens e o telhado acima. Quando um token visível
entra no perímetro interno, o telhado some; quando o último sai, ele volta.
Salvar/recarregar recupera a aparência pela posição dos tokens. Não há SQL novo,
campos novos no documento nem geração de paredes soltas na cena.

TypeScript e 29 testes de geometria/movimento passaram. O servidor-base foi
comparado com o servidor instalado e corresponde byte a byte. Verificação das
75 mídias e teste completo do navegador estão preparados em
`scripts/verify-vtt-nature-assets.mjs` e `scripts/test-vtt-nature-isolated.mjs`.
**Este é um checkpoint solicitado antes de reiniciar o PC. A publicação local
destas peças e a validação completa do navegador ainda devem ser concluídas.**

## Pedidos das cartas ainda pendentes neste checkpoint

- Distribuir o reflexo cromado por toda a frente; o efeito atual concentra brilho
  perto das bordas.
- Fazer o seletor de nível 3 usar o acabamento final atualizado.
- Remover os contornos verdes das cartas.
- Preservar os detalhes dourados da arte de nível 2 na versão cromada e dar a eles
  aparência de ouro mais intensa.
- Usar o verso de corvo enviado pelo usuário. A referência original foi guardada
  em `data/cards/raven-back-source-20261014.png` para sobreviver ao reinício.

O site local continua na publicação de cromado `9ef9cfc`; esses últimos ajustes
das cartas ainda não foram aplicados. Preservar as 14 alterações independentes
do checkout e o protótipo pausado dos monstros. Para retomar, trabalhar na branch
Welson e na cópia canônica `companion-delivery-validation`, sem publicar WIP alheio.
