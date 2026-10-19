# Roupas medievais e pergaminhos dos títulos

Oito novas ofertas em Cosméticos: Camiseta de linho (1,2 PO), Camiseta de algodão (1,8 PO), Calça de viagem (2,5 PO), Calça de lã (3 PO), Sapatos de couro (3,5 PO), Sandálias de estrada (1 PO), Traje de viajante (12 PO) e Túnica de estrada (4,5 PO). Valores e pesos são próprios do Empório. Não concedem CA ou efeitos mágicos.

Peitoral recebe camisetas e túnicas; pernas recebem calças e pés recebem calçados. Atualização de 19/10: o traje entrega túnica, cinto, calça e botas separadamente, cada uma com seu ícone e posição de equipamento. Detalhes e migração dos trajes antigos em `CHARACTER-RP-GUILD-REFINEMENTS-20261019.md`. Produtos avulsos continuam disponíveis. Não há zíperes, estampas modernas ou bolsos cargo. O catálogo anterior e suas edições administrativas de preço são preservados.

Artes individuais criadas com ImageGen integrado e revisadas visualmente. PNGs originais permanecem no diretório de geração; arquivos finais transparentes de 512 px em `public/shop/clothing-20261018`. Prompts completos e hashes em `data/shop-clothing-art-20261018.json`. Cada oferta tem fala e WAV individual derivado dos sons de tecido/couro já licenciados, respeitando volume e mute.

O painel Títulos do personagem usa exatamente a madeira do Catálogo de conquistas. Todos os ícones foram substituídos pelo pergaminho realista enrolado, amarrado e lacrado em cera vermelha, sem medalhão circular. Arte em `public/titles/sealed-scroll-20261018.webp`; prompt e hash em `data/title-scroll-20261018.json`. Identidades, metas, concessões e título exibido permanecem.

Validação: `scripts/test-shop-clothing-isolated.mjs --browser` usa PostgreSQL descartável. Confere oito ofertas/arte/alfa/som, 28 cosméticos, busca e fala, compra real de todas as peças com débito exato, replay sem débito duplicado, equipamento correto e rejeição do espaço errado, preservação do inventário e histórico após seed; vitrine e títulos em 1440/768/390 px, sem erro JavaScript ou rolagem horizontal. TypeScript e build de produção conferidos. Publicação incremental mantém servidor e arquivos anteriores; dados recebem somente as oito ofertas.
