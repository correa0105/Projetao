# Arquivos, cartas e vistas da casa — 12/10/2026

Escopo autorizado: corrigir o giro da estante, banqueta, barril e códice; reimaginar a entrada da Lore; reconstruir o Salão das Cartas preservando o Anfitrião; corrigir o livro no fundo da ficha; organizar a coleção privada com menu lateral e narrativa.

## Apresentação

- Lore: gravura original em tinta e papel escuro, entrada com 160–235 px e linha temporal perto do topo. Editor, navegação de eras, pastas e crônicas conservados.
- Salão: gabinete de mansão gótica sóbria, pedra/carvalho/veludo vinho, Anfitrião com a mesma identidade, roupa e pose. Oito cartas em grade legível, três espaços de equipamento identificados, detalhe ao lado no desktop e navegação para o detalhe no celular. História expansível, preços e disponibilidade reais, conversa pelo botão visível.
- Cartas do personagem: coleção lateral com busca por nome/família, nível e estado; três espaços equipados, registro ampliado da seleção, narrativa e ações de equipar/retirar. A apresentação pública da coleção permanece compatível.
- Ficha: somente o recorte do livro foi editado e recolocado na mesa, com bordas suaves; duas páginas e lombada coerentes. Cenário externo ao recorte mantido.
- Casa: 19 artes corrigidas em pasta versionada. Quatro intermediárias da estante, sete direções da banqueta, três do barril e cinco do códice. IDs históricos, posição, tamanho salvo, inventário e preço preservados. Cada vista possui sua calibração proporcional; nenhuma rotação é fabricada espelhando o bitmap.

Os novos registros em `shared/card-stories.ts` são narrativa de ambientação. Não concedem poderes nem inventam formas de obtenção para as cartas indisponíveis.

## Artes e reprodução

Imagegen embutido utilizado para cada imagem individual. Prompts finais: `data/site-art-plan-20261012.json`; fontes e SHA-256: `data/site-art-completed-20261012/`. Arte antiga permanece disponível. `scripts/save-site-art-20261012.mjs` faz a exportação, e `scripts/prepare-house-facing-repairs.mjs` verifica alpha/hash e calcula as larguras.

## Validação

Aprovado: TypeScript no checkout e na validação isolada; builds cliente/servidor; revisão visual das artes, telas de computador/celular e livro. `scripts/test-archive-refit-isolated.mjs` passou em PostgreSQL UUID descartável e removido: compra, coleção, busca, equipamento, persistência, conversa, quatro páginas em cinco larguras (20 telas) e 36 vistas disponíveis dos quatro objetos com SHA-256. `scripts/review-lore-podium-polish.mjs` passou: 40 ações de eras, mouse/teclado/editor, movimento normal/reduzido, título estável e ausência de transbordamento. O fixture usa `journey.css`, como a aplicação real, e espera o carregamento das fontes antes de medir.

Publicado: `alvorada-cinzenta-app:archive-cards-house-v1-20261012`, aplicação saudável. Publicação incremental de bundles, servidor com catálogo de vistas e 22 mídias; 58 arquivos do cliente e servidor conferidos por SHA-256. As 120 tabelas mantiveram linhas idênticas, e 8.767 arquivos anteriores do cliente foram preservados. Backup completo de 476.679.596 bytes decodificado com `pg_restore` sem restaurar sobre o banco. Sem migrations ou alteração de regras/economia. O estado do ilustrador é idêntico ao anterior; seu heartbeat já estava antigo e nenhum worker foi reiniciado. Imagem anterior conservada para rollback. A biblioteca nova de assets/pincel/borracha e o seletor de pedidos de revisão continuam **pausados**, fora deste release.
