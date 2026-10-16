# Hall dos melhores — 16/10/2026

Refino posterior no mesmo dia: largura total, nomes/números centralizados, informações agrupadas e fumaça na passagem para o ranking. Ver `HALL-LORE-POLISH-20261016.md`.

O salão de três nichos iguais foi substituído por uma galeria de honra, com três pedestais de pedra em alturas diferentes. O primeiro fica mais alto, no centro, sob uma coroa e louros iluminados. Segundo e terceiro recebem bases laterais, luz e números em prata e bronze. As identificações acompanham as placas físicas da pintura; pontuação, classe, jogador e acesso ao perfil ficam abaixo.

A arte original foi criada com o `image_gen` embutido. Arquivo público: `public/community/hall-laureates-20261016.webp`, 1672 × 941 pixels, 234.352 bytes. Prompt integral, origem e coordenadas estão em `data/hall-laureates-20261016.json`. A versão anterior é preservada.

Figuras e inscrições usam o mesmo plano da pintura. Os apoios dos pés são aproximadamente (835, 473), (395, 521) e (1277, 568), para primeiro, segundo e terceiro. Os números ficam nas faces dos pedestais, e os nomes nas placas. A figura do campeão recebe maior espaço e um realce de luz. As artes dos jogadores mantêm suas proporções.

No celular, o salão começa no campeão e permite deslizar para os demais ou usar as setas. Foco de teclado, movimento reduzido, filtros, busca, visita ao perfil e edição administrativa são mantidos. O componente é compartilhado com o Hall da aba Perfis. O título personalizado é respeitado; a frase introdutória deixou de ser exibida no refino posterior.

Esta alteração é apenas de apresentação: sem mudança de servidor, fórmula de pontuação, dados ou migrations. O release deriva da imagem que já contém a retirada de Arcana Unleashed, e mantém os arquivos anteriores e as alterações independentes fora do pacote.

Validação: TypeScript, build do cliente, decodificação da arte e dos retratos, navegador em 1920×1080, 1440×960, 1266×659, 1024×768, 768×960, 390×844 e 320×740; Hall em Perfis em 1440×960 e 390×844, navegação lateral e menu. Testes usam PostgreSQL UUID descartável. Reprodução: `node scripts/test-hall-exhibition-isolated.mjs` após o build e disponibilização dos arquivos públicos no servidor de teste. `HALL_QA_PORTRAITS_DIR` é opcional e permite retratos locais de QA sem versionar imagens privadas.
