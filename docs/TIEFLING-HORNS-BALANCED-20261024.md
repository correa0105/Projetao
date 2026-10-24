# Anelados com espessura intermediária

O proprietário pediu reduzir o volume desproporcional dos chifres do Asterios,
do Bellis, e corrigir o modelo Anelados em geral. A primeira correção muito fina
foi rejeitada. A direção final mantém volume firme, anéis marcados e a curvatura
compacta, com uma redução moderada de largura, sem transformar em hastes finas.

`ridged` mantém ID, nome e regras. Sua descrição/instrução deixou de exigir
chifres grandes, robustos e cristas largas; agora usa espessura proporcional e
moderada. A referência aponta para o PNG original versionado
`public/character-creation/tiefling-horns-ridged-balanced-20261024.png`.
O WebP anterior e os outros sete modelos permanecem preservados. Prompt e hash
em `data/tiefling-horns-balanced-20261024.json`, ferramenta `image_gen` embutida.

O retrato do Asterios foi editado a partir do original, mantendo rosto, corpo,
cabelo, roupa, cauda e pose. Redução de aproximadamente 25–30% na largura dos
chifres, conforme a revisão intermediária. PNG de 1024 × 1536 com alfa real,
aprovado na revisão de anatomia, roupa e correspondência do modelo. Original,
candidato e revisão ficam privados em `.local/asterios-horns-20261024/`.

Aplicação pelo `completeArt` existente, no mesmo personagem e checkpoint do
pedido inicial. Identidade, ficha, equipamentos, cota, histórico e concessão
única de ouro preservados. O token foi retomado a partir do retrato corrigido.
Nenhuma outra arte pronta foi regravada automaticamente.

TypeScript, builds, cinco testes de modelos/resolução do CLI e revisão visual
real aprovados. Publicação incremental inclui cliente, PNG original e registro,
sem migration ou alteração de dependências. Ilustrador recarregado ocioso antes
de retomar o token; publicação web conserva o worker e os demais pedidos.

Publicado em `alvoradacinzenta.com` como `horns-balanced-20261024`, código
`65523bc7703aa7f2aef2c492c10128e99ecbc094`. Os 83 arquivos do pacote, os 21
arquivos públicos acessados por HTTPS e o espelho do PNG conferem por SHA-256.
Retrato corrigido do Asterios e personagem original conferidos no banco somente
por leitura; token em processamento no momento da publicação. O pedido ia
concluiu retrato e token. Ambas as criações iniciais mantêm sua gratuidade.
Backup anterior ao deploy:
`/opt/alvorada/backups/vtt-brush-loading-before-20261024T212912Z.dump`.
