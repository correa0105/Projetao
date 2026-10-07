# Explicações dos itens — 07/10/2026

Cada oferta do Empório tem **? — O que este item faz?** junto de Comprar. A janela
mostra a explicação em português, o nome da variante e os links da fonte. Famílias
com escolhas exigem selecionar o modelo antes de consultar suas regras; assim,
uma arma ou resistência não recebe a explicação de outra variante. O mesmo
controle atende objetos de House e as ofertas no balcão.

## Fonte e tradução

O catálogo licenciado usa os registros do SRD 5.2.1 disponibilizados no 5etools.
O importador aceita somente registros marcados `srd52`, da revisão imutável
`b9061583536101068b3a59d27e886d1fa664e366` de `5etools-mirror-3/5etools-src`.
São lidos `items.json`, `items-base.json` e `magicvariants.json`; seus SHA-256,
atribuição e licença CC BY 4.0 acompanham `data/shop-item-rules.json`.

`scripts/import-shop-item-rules.ts` resolve descrições, tabelas, referências
internas e estatísticas de cada variante. A tradução local usa um glossário de
termos de jogo em `scripts/shop-rules-glossary.ts`. CD, dados, valores e unidades
devem conservar o significado original. Revisões manuais ficam versionadas em
`data/shop-item-rules-reviewed.json` e prevalecem ao repetir a importação.

Montarias, cosméticos, armaduras de mascote e objetos de House criados para o
aplicativo são identificados como **Conteúdo do projeto**. Não atribuir esses
produtos ao 5etools nem inventar benefícios oficiais. As explicações apresentam
o uso; os efeitos mágicos continuam sendo resolvidos na mesa.

## API e interface

`GET /api/catalog/:id/rules` exige sessão e consulta o catálogo ativo. O servidor
carrega o arquivo de regras uma vez e retorna somente o item pedido, evitando
baixar todo o acervo no cliente. Fonte ausente retorna erro de indisponibilidade;
não substituir silenciosamente a regra por uma descrição inventada.

`src/ItemInfoButton.tsx` abre um diálogo acessível, permite Escape, restaura o
foco e cancela a requisição ao fechar. Texto longo rola dentro da janela, inclusive
em telas de 320 px. Os links aceitam somente HTTP/HTTPS e apresentam a referência
real da variante selecionada.

Os testes cobrem variantes de cura, força de gigante, resistência, aprimoramentos,
conteúdo próprio, autenticação e mapeamento completo do catálogo licenciado.
`scripts/smoke-shop-variants.ts` também verifica ofertas sem escolha, diálogo,
links, rolagem longa e House em quatro larguras.
