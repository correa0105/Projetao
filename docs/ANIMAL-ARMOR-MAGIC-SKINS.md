# Equipamentos, conjuntos e skins — 07/10/2026

O Inventário oferece **Personagem**, **Montaria** e **Mascote**. Os espaços vazios
dos animais usam desenhos próprios: montarias têm testeira/capacete, barda inteira,
pescoço, capa, alforjes, arreios/acessórios e sela. Mascotes mantêm proteções de
patas/garras conforme o conjunto e a espécie. As posições seguem
a anatomia da espécie; serpentes e aves não recebem posições de quadrúpedes.

## Categoria correta para cada animal

Montarias aceitam somente equipamentos com destino **mount**. Mascotes aceitam
somente destino **pet**. Armaduras, roupas e acessórios humanoides têm destino
**human** e não aparecem nas escolhas dos animais. O servidor verifica o catálogo
confiável mesmo quando o cliente envia um destino falso. Equipamentos pagos no
estábulo continuam disponíveis como bens legados; não são convertidos em itens
humanoides. Reservas incompatíveis antigas são liberadas sem apagar a mochila.

A loja contém **Acessórios para pet** com quatro armaduras próprias (acolchoada,
couro, malha e escamas), coleira, lenço, peitoral bordado e capa. **Equipamentos
de montaria** inclui testeira cerimonial, manta bordada, penacho e cabeçada.
Os cosméticos não concedem bônus de combate. Materiais e nomes são conteúdo do
projeto; o equipamento desenhado pelo ilustrador se adapta à espécie.

O painel Selaria foi retirado do Estábulo. Sela de montaria e sela militar são
vendidas no Empório em Equipamentos de montaria e equipadas no Inventário.
As ofertas usam os IDs existentes; bens e imagens das compras antigas permanecem.
As categorias legadas no singular e plural aparecem como uma única prateleira
**Equipamentos de montaria**, reunindo 12 bardas, quatro cosméticos e duas selas.

Catálogo: `data/animal-equipment-catalog.json`. Artes transparentes e prompts:
`public/shop/animal-equipment/art-manifest.json`. As imagens foram geradas com
a ferramenta nativa image_gen e copiadas para o projeto preservando transparência.

## Comprar e equipar uma armadura

Cada um dos 254 conjuntos humanoides ou armaduras de mascote entrega seis
peças independentes: tronco, cabeça, braços/patas dianteiras, pernas/patas traseiras,
pés/patas e ombros. Escudos permanecem escudos. O peso total e o preço da vitrine
são os do conjunto completo; no inventário cada peça tem seu peso e nome próprios.
O ID original identifica o tronco, e os IDs históricos da armadura de placas
continuam válidos. As demais peças não são ofertas vendidas separadamente.

Pedido posterior: as 12 bardas são itens completos, com peso integral e um único
encaixe Armadura/barda no Inventário. Não destrinchar uma compra em partes. O
ilustrador considera a barda inteira e os acessórios equipados nos outros espaços;
ferraduras são acessórios e aparecem nas patas. Não usar um seletor de conjunto
de seis itens na montaria. Pedido posterior de 08/10: o jogador pode marcar as
seis regiões que quer desenhar em **Partes da barda na imagem**, antes de Vestir.
É escolha visual, sem desmembrar estoque, peso, reservas ou atributos da barda.
Todas são marcadas por padrão; instruções/revisão abrangem também bardas legadas.

No painel equipado, **Armadura completa → Escolher conjunto → Equipar armadura**
equipa todas as partes compatíveis de uma vez. As peças precisam estar na mochila
e disponíveis para aquele personagem ou animal. Uma parte no cofre, faltante ou
reservada por outro animal impede toda a operação, sem equipar metade do conjunto.
As aves e serpentes equipam apenas as partes que sua anatomia admite; as demais
continuam na mochila. Não se cria nem se duplica uma cópia ao equipar.

As operações usam uma única transação: `POST /inventory/equipment-set` e
`PUT /companions/:characterId/equipment-set`. Repetir a mesma escolha não consome
itens nem avança novamente a revisão da arte. O ilustrador recebe o modelo real
do conjunto e uma instrução explícita de reproduzir somente cada parte equipada.

Migration 077 registrou uma vez as armaduras antigas da mochila e do cofre. O seed
concede suas partes restantes, mantendo a quantidade original, o peso total, os
saldos e o histórico de compras. Repetir o seed não concede as partes novamente.
Migration 078 substitui somente a divisão das bardas: arquiva linhas antigas,
consolida filhos entre mochilas/cofre por dono, recupera parent ausente sem
multiplicar estoque, preserva itens inteiros/reservas válidas e desativa filhos.
A revisão da montaria muda para exigir nova arte; a imagem anterior permanece.
Preços, compras e saldos não mudam. `test-whole-mount-armor-isolated.mjs` verifica
upgrade de estoque antigo e referências de barda inteira mais acessórios.

## Aparência das variantes mágicas

Cada família mantém um acabamento comum em seus modelos. A geometria continua
sendo a do modelo escolhido: uma machadinha não recebe a silhueta de uma espada.
Afiação, Dançarina, Vingadora sagrada, Matadora de gigantes e as demais famílias
têm materiais e ornamentos próprios. Chamas e gelo mantêm suas identidades.

As skins são fontes SVG nativas com o modelo e materiais incorporados, recortadas
pela transparência da peça. As texturas são imagens novas geradas por image_gen;
não são filtros aplicados indiscriminadamente à interface. O mesmo image_path
é usado na loja, mochila, peças equipadas e referência do ilustrador. SVGs só são
aceitos como referência no diretório interno de skins, sem scripts ou recursos
externos; antes de enviar ao ilustrador são renderizados como PNG.

O acervo inclui 660 skins por família/modelo, 25 texturas e cinco artes completas
novas para arco curto e cinturões. Os 12 produtos animais completam as 42 imagens
novas geradas neste refino; os prompts e arquivos finais ficam nos manifests.

O **Arco de energia (arco curto)** tem sua própria arte completa, com formato de
arco curto, corda e flecha de energia. Os cinturões de gigante usam designs
distintos para colina, gelo/pedra, fogo, nuvens e tempestade, preservando IDs,
preços, força e regras da variante.

O seletor **Tipo de arma** acrescenta **— SKIN TEMÁTICA** aos modelos com arte
completa dedicada ao item. O índice compartilhado contém 32 variantes; apenas
receber o acabamento SVG da família não atribui essa indicação. Nomes, IDs,
preços e a variante enviada na compra continuam sendo os originais.

Fontes e prompts: `public/shop/magic-materials/art-manifest.json`,
`public/shop/magic-skins/art-manifest.json` e `skin-manifest.json` nesse diretório.
`scripts/build-magic-skins.mjs` reconstrói as fontes SVG e mapeia o catálogo;
`scripts/build-emporium-catalog.mjs` preserva as escolhas ao regenerar os dados.

## Verificações

As suítes de conjuntos e companions cobrem compra/replay, peso, divisão de peças,
equipamento atômico, cofre, reservas concorrentes, ownership, categoria falsa,
migração/seed repetido e referências de arte. O navegador verifica os três
painéis em 1440, 768, 390 e 320 px. Pedidos de Vestir nos testes são concluídos por
fixture interna; não gastam geração no provedor.

`scripts/test-magic-skins.mjs` decodifica as skins transparentes, verifica seus
hashes e recursos incorporados e confere estabilidade ao reconstruir o catálogo.
