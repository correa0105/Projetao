# Moradores do VTT — 18/10/2026

O catálogo Moradores passa de 25 para 50 personagens, com 25 artes individuais de ofícios distintos, de Abrão (sapateiro) a Zeca (barqueiro). IDs resident-026 a resident-050. Todos continuam sendo atores: colocação, movimento, giro, escala, salvamento e regras de visão existentes.

A direção visual final segue o elfo vidreiro enviado pelo usuário: câmera ortográfica totalmente de cima, cabeça em postura natural e olhar à frente, com testa, sobrancelhas e nariz em projeção superior. As versões olhando para a câmera foram rejeitadas e não entram no catálogo nem na publicação.

Artes finais WebP com transparência real, 768 × 768, em `public/vtt/residents-25-20261018/*-topdown-v3.webp`; miniaturas de 192 × 192 em `public/vtt/residents-25-thumbs-20261018`. O imagegen embutido gerou cada personagem separadamente. Originais nativos conservados; prompts, referências, hashes e revisão em `data/vtt/residents-25-20261018`.

As imagens da biblioteca repetem uma carga que falhou temporariamente, até três vezes (400/800/1600 ms). Miniaturas usam a arte completa como alternativa. Isso recupera os cartões quebrados como os de Luan, Olívia e Rosana sem alterar seus arquivos ou os mapas salvos.

Validação: TypeScript/build isolado; navegador real com 50 miniaturas, 25 prévias, falhas deliberadas nas três miniaturas antigas e nas duas primeiras cargas de uma arte nova; colocação pela biblioteca, persistência dos 50 atores, giros 0/90/180/270 e quatro larguras (1440/768/390/320). Resultado em `test-results/vtt-residents-25/result.json` no estágio isolado. Publicação incremental conserva arquivos anteriores e dados PostgreSQL; não requer migration.
