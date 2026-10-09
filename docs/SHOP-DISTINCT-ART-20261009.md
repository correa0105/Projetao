# Artes distintas do Empório — 09/10/2026

122 ícones originais substituem as imagens repetidas, com tema aplicado à construção, materiais e ornamentos do objeto. Foram gerados com `image_gen.imagegen`, transparência nativa e revisão visual em seis folhas de contato. Não são simples recolorações.

- Quatro poções de cura: pequeno frasco comum de vidro/cortiça; maior com bronze; superior em cristal/prata; suprema com ouro e rubis.
- Cinco poções de força de gigante: colina, gelo/pedra (a variante combinada existente), fogo, nuvens e tempestade.
- Dez poções de resistência com frasco, emblema e materiais relacionados ao dano.
- Quatro anéis de comando elemental com desenho próprio de ar, terra, fogo e água.
- 70 munições exterminadoras: cinco formatos × 14 alvos. Flechas, virotes, balas de arma de fogo, balas de funda e agulhas mantêm seu formato e recebem sinais próprios do alvo.
- 15 munições mágicas (+1/+2/+3), nove níveis de pergaminho, dois baralhos e três varinhas de mago de guerra; riqueza da construção acompanha a variante.

Arquivos publicados em `public/shop/thematic-20261009`; prompts, fontes nativas, hashes e revisão em `data/shop-thematic-art-20261009/published-manifest.json`. O publicador compara os catálogos antes/depois removendo apenas `image_path` e exige igualdade dos demais dados. IDs, nomes, preços, descrição, peso, regras e histórico não foram alterados. O seed reconhece o caminho da nova cura comum e conserva preços administrativos.

`scripts/test-shop-distinct-art-isolated.mjs` usa banco descartável: confirma as 122 imagens públicas, hashes únicos e alfa, repetição do seed sem alterar dados/preços administrativos, cinco famílias em três larguras e checkout real de sete itens, incluindo as quatro curas. Confere IDs, quantidades, valores, saldo e histórico de compra.
