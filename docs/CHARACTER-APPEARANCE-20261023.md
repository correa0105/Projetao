# Personalização física na criação — 23/10/2026

Pedido: todas as espécies escolhem altura, porte físico e idade aparente, inclusive quando enviam referência. Warforged com referência continua escolhendo a estrutura do corpo.

- Altura: baixo, mediano e alto, relativa à própria espécie e categoria de tamanho.
- Porte físico: magro, mediano, atlético, musculoso, robusto e corpulento.
- Gênero do personagem: Homem ou Mulher; obrigatório na nova criação, mesmo com referência.
- Idade aparente: Jovem, Adulto, Meia-idade e Idoso. No Warforged, maturidade do desenho e marcas de uso compatíveis, sem criar pele humana ou trocar o metal/acabamento.
- `choices.physicalTraits` contém `height`, `build`, `age` e `gender`. `middle-aged` é a opção adicional de idade; `old` mantém seu identificador anterior. O formulário começa sem esses quatro valores: é necessário escolher. A API exige o conjunto completo em novas criações e substituições de rascunho.
- Warforged com referência salva `choices.warforgedBody`, com as seis estruturas existentes. A seleção ilustrada fica visível; cabeça, paleta e materiais vêm da imagem enviada. A montagem completa continua em `warforgedAppearance`. Misturar os dois campos é rejeitado. Trocar de modo no formulário conserva a estrutura selecionada e remove cabeça/paleta da montagem ao entrar no modo referência.
- A referência temporária de corpo é extraída da prancha original, sem modificar ou redimensionar o original; não fornece cabeça/paleta. O plano de anexos continua limitado a cinco imagens, usando prancha de equipamentos quando necessário.
- Geração, correção e revisão do retrato e token recebem as escolhas. `physical_traits_correct=true` é obrigatório quando há personalização; resultado falso ou ausente não é publicado. Preservar checks independentes de anatomia, roupa e cabeça da montagem. Na câmera superior, julgar só partes visíveis, sem exigir altura absoluta ou rosto oculto.
- A referência numérica de altura do prompt varia em ±12% para baixo/alto, sem alterar tamanho de regra, atributos, CA, deslocamento ou escala de grade. A anatomia racial do prompt deixa de impor adulto/robusto a quem escolheu outra aparência.
- Escolhas persistem no JSON da ficha e são recuperadas pelo ilustrador ao vestir/gerar novamente. As fichas e jobs antigos continuam válidos sem os campos, inclusive quando possuem altura/porte/idade mas ainda não possuem gênero; retomar um job antigo sem substituir dados continua possível. Não há migration, alteração automática de artes ou reescrita de fichas antigas. Campos narrativos antigos de idade/medida/peso permanecem opcionais e separados.

Validação: nove testes em PostgreSQL local descartável (`scripts/test-portal-controls-isolated.mjs --appearance`), TypeScript e builds cliente/servidor. Inclui todas as espécies, combinações de porte/altura/idade, invariância mecânica, estrutura obrigatória com referência, validação de payloads, persistência, ownership, retomada legada e rejeição de revisão falsa/ausente. CLI de imagens simulada, sem consumir gerações reais.

Navegador (`--warforged`): criação completa, troca entre os modos, opções obrigatórias em todas as espécies, upload, retomada e vestir; QA visual em 1440/768/390/320 px, sem overflow ou erros de JavaScript. Capturas em `test-results/warforged-appearance/`.

Publicação concluída: `physical-appearance-20261023`, código `895d0bfb7fa17933c803c1431a0fdbeaf7db5570`. Backup: `/opt/alvorada/backups/physical-appearance-before-20261023T174421Z.dump`. Os 45 arquivos do release e o bundle servido por HTTPS foram conferidos por hash, com os controles novos presentes. APIs de consulta, cache privado de retratos e três magias revisadas preservados. Verificação de produção somente por leitura; nenhuma geração real consumida. Ilustrador recarregado após confirmar zero jobs pendentes/em execução em ambas as filas.

Complemento solicitado: os rótulos finais são **Gênero do personagem** (Homem/Mulher) e **Idade aparente** (Jovem/Adulto/Meia-idade/Idoso). Validação ampliada para dez testes, com todas as combinações em todas as espécies, gênero inválido/ausente rejeitado na criação, manutenção das escolhas anteriores e ausência de gênero automático nos legados. Geração/revisão do retrato e token conferem também a opção Homem/Mulher. Release complementar ainda em preparação.
