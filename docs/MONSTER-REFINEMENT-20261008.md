# Revisão individual de monstros e créditos do VTT — 08/10/2026

Sete artes foram redesenhadas em vista de cima e aplicadas ao acervo existente.
Os IDs e os endereços dos tokens continuam os mesmos. A biblioteca mantém 330
criaturas; esta revisão individual não retoma o projeto pausado de quatro
alternativas para cada monstro.

| Criatura | Direção da arte final | Arquivo |
| --- | --- | --- |
| Adult Black Dragon | Curva contínua no pescoço, tronco, quadril e cauda; asas assimétricas e articulações das patas | [WEBP](../data/vtt/premium-art/monster-adult-black-dragon-v1.webp) |
| Basilisk | Corpo robusto azul acinzentado, oito patas, espinhos escuros e cabeça larga | [WEBP](../data/vtt/premium-art/monster-basilisk-v1.webp) |
| Balor | Torção corporal, asas assimétricas, musculatura vermelha e membranas vinho; espada elétrica e chicote de fogo | [WEBP](../data/vtt/premium-art/monster-balor-v1.webp) |
| Black Dragon Wyrmling | Escamas negras, membranas verde oliva, anatomia juvenil e silhueta assimétrica | [WEBP](../data/vtt/premium-art/monster-black-dragon-wyrmling-v1.webp) |
| Elephant | Patas verticais sob o corpo, encobertas pela projeção superior; dobras de pele e orelhas modeladas | [WEBP](../data/vtt/premium-art/monster-elephant-v1.webp) |
| Berserker | Duas mãos envolvendo o cabo, uma no terço central e outra perto da extremidade; punhos e antebraços conectados | [WEBP](../data/vtt/premium-art/monster-berserker-v1.webp) |
| Shrieker Fungus | Chapéu fechado arredondado, abertura central pequena, bulbos posteriores, dois membros laterais e duas bases curtas | [WEBP](../data/vtt/premium-art/monster-shrieker-fungus-v1.webp) |

Produção com **Imagegen integrado**, por edição/redesenho de referências.
As referências fornecidas guiam anatomia, gesto e material; os recortes são
ilustrações próprias. Prompts, fontes, dimensões e hashes anterior/final estão
em [monster-refinement-20261008.json](../data/vtt/monster-refinement-20261008.json).
O manifesto continua em [premium-art/manifest.json](../data/vtt/premium-art/manifest.json).

Entrega WebP com qualidade 95, alpha preservado e margem transparente adicional
de 4% em cada dimensão. As silhuetas completas permanecem dentro do quadro.
Backups das sete artes anteriores e do manifesto ficam em
`.local/backups/monster-refinement-20261008`. O PNG gerado original permanece
na pasta de imagens do Codex.

## Créditos de áudio

O bloco saiu da aba **Som** e está no fim de
**Configurações e ajuda → Mesa**, em **Créditos e licenças de áudio**.
A seção começa recolhida e pode ser aberta pelo resumo. Atribuições, link local
de fontes/licenças e referência ao SoundPad permanecem disponíveis para mestre
e jogador. A mudança só reposiciona a apresentação dos créditos.

## Verificação

Pedido posterior: a coluna do dragão negro foi suavizada para uma curva leve,
conservando movimento, vista superior, asas, patas e cauda. O arquivo e ID
existentes continuam iguais. Nova auditoria, prompt e hash em
`data/vtt/black-dragon-gentle-20261008.json`; as outras 329 artes foram preservadas.

- TSC e builds cliente/servidor aprovados na fonte de release.
- Renderer real no navegador: sete WebP decodificados, tokens de 240 e 90 px,
  giro e espelho, sem erros de JavaScript; captura local
  `test-results/monster-refinement-renderer-qa.png`.
- Créditos ausentes do painel Som, recolhidos nas configurações e expansíveis.
- Teste HTTP do acervo em banco descartável aprovado, incluindo acesso por
  jogador, HEAD de todas as 330 artes, cache privado e limites independentes.
- Conferência de hashes mantém intactas as outras 323 artes.
- Aplicação local atualizada; bundles, 330 artes e 155 sons conferidos.
- Comparação pré/pós de 43 tabelas conserva bens, saldos, mensagens e mesas.
- Protótipo local de variantes preservado e excluído do release.

Uma mesa já aberta conserva imagens em memória; **Ctrl+F5** carrega os novos
recortes. Tokens com imagem personalizada continuam usando a imagem escolhida.
