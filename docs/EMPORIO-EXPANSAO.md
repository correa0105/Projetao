# Expansão do Empório — 06/10/2026

O catálogo ativo reúne 1.319 itens de aventura: os 71 já aprovados e 1.248
adições. A vitrine inclui ainda os doze itens de House na categoria nativa
Itens de House, totalizando 1.331 ofertas. A grade conserva duas colunas
estruturais (prateleiras e produtos), sem o link externo que deformava o painel.

## Cobertura efetiva

Fonte de regras: [SRD 5.2.1 (2024)](https://www.dndbeyond.com/srd), conferido no
[PDF oficial](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf).
Armas, armaduras, munição, equipamento de aventura, ferramentas de artesão,
instrumentos, kits, comida/bebida, bardas e veículos físicos das tabelas foram
incluídos. Animais vivos continuam no Estábulo; serviços, hospedagem, aluguel,
estilo de vida e tripulantes não são itens físicos de inventário.

As 258 famílias do índice de itens mágicos estão representadas, incluindo
1.060 novos produtos mágicos concretos: armas/munições/escudos/armaduras com
bônus, versões de resistências, poções, pergaminhos de níveis 0–9, gemas,
estatuetas, bolsas, instrumentos, colares e demais variantes previstas no SRD.
O índice normalizado em data/emporium-source/srd-magic-index.json permite
comparar número, nome original, página, tipo e raridade de cada família.
Os 65 produtos originais fornecidos pelo usuário conservam fonte, conteúdo,
preços e IDs; não afirmar que seus efeitos históricos foram convertidos ao SRD.
SRD é uma seleção aberta, não o conjunto de todos os suplementos de D&D.

Cosméticos: quatro botas, quatro luvas, quatro colares, quatro capas e quatro
acessórios de cabeça (20 produtos). Os cinco anteriores permanecem; quinze
novos acessórios não têm bônus mecânico.

Preços novos seguem as referências de raridade: comum 100 PO, incomum 400 PO,
raro 4.000 PO, muito raro 40.000 PO e lendário 200.000 PO; consumíveis têm metade,
com as exceções próprias de pergaminhos. Variantes adicionam o preço do item
base quando aplicável. Artefatos sem preço continuam indisponíveis para compra.
O catálogo registra página/fonte e preços inteiros em cobre. Compras anteriores
e os preços dos 71 itens aprovados não são recalculados.

Descrições em português são resumos de consulta. Recursos, cargas, sintonia,
magias, bônus mágicos, dano e cura não ganharam automação presumida. Equipamento
reconhece os slots e armas de duas mãos; bardas/veículos não ocupam slots
humanoides. Consumíveis novos entram no fluxo manual/auditado já existente.

## Arte, falas e sons

487 artes transparentes originais em public/shop/expanded. Objetos com mesma
forma e bônus distintos podem compartilhar a imagem adequada. Prompts completos,
dimensões e SHA-256 em public/shop/expanded/art-manifest.json. Todos os arquivos
referenciados foram verificados e as pranchas visuais foram inspecionadas.
Flame Tongue, Rod of Absorption e Rod of Resurrection receberam as correções
pedidas: lâmina/haste, cabo e ponta alinhados no mesmo eixo, sem curvatura.

O Pinterest fornecido foi consultado, mas exigiu login para os pins. Não
atribuir análise visual a conteúdo bloqueado. As ilustrações são próprias,
sem copiar/distribuir imagens alheias.

Cada produto tem fala individual do mercador. Os 1.331 IDs têm um WAV próprio,
com hash único, derivado das dez gravações reais de materiais já licenciadas
em CC0 para o balcão. Variam pitch, amortecimento e reflexão curta por objeto;
não são 1.331 gravações independentes. Arquivos PCM16 mono e créditos de origem
em public/audio/emporium/manifest.json e public/audio/shop-counter-manifest.json.
Sons carregam por item usado, respeitam mute/volume, limite de vozes e saída
da página. House usa os mesmos doze arquivos próprios.

## Dados, atualização e verificação

data/emporium-expansion.json contém as adições; fontes normalizadas em
data/emporium-source. Regeração portátil:

1. node scripts/build-emporium-catalog.mjs
2. node scripts/generate-emporium-media.mjs
3. migrations/seed no ambiente escolhido.

Migration 073 acrescenta audio_path. O seed faz upsert sem apagar inventário,
saldo ou histórico; componentes avulsos legados da full plate continuam inativos.
shared/emporium-equipment.json, emporium-materials.json e
emporium-consumables.json são gerados junto aos arquivos de som. Não reimportar
o catálogo antigo para substituir a expansão.

node scripts/test-emporium-isolated.mjs testa cobertura/variantes, preços
anteriores, quatro cosméticos por tipo, arquivos/SHA/alpha, falas, áudio,
concorrência/saldo/idempotência, ownership e seed preservando histórico.
--browser testa a vitrine em 1755/768/390/320 px, carta de House, 20 cosméticos,
fala própria, áudio real por item, mute e compra mundana com débito correto.
Testes sempre usam PostgreSQL descartável; nunca o banco dos jogadores.
