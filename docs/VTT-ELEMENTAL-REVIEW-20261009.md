# Revisão posterior dos efeitos — 09/10/2026

Pedidos posteriores às 28 imagens: Corrente elétrica, Lava inteira, Bênção,
Ressonância sonora, Fogo azul, Salpicos corrosivos, Gêiser de água, Onda de maré,
Véu de areia, Fenda dimensional e Pulsos prismáticos receberam novos materiais
ou composições. Dez campos originais, 32 quadros a 24 fps, 20 atlas WebP com
alfa nativo e uma textura de fraturas. Gerador em
`scripts/build-vtt-elemental-materials.py`; origem e hashes em
`data/vtt/elemental-materials-20261009.json`.

O Círculo infernal conserva integralmente o fogo animado de baixo; foram retiradas
as línguas sobrepostas. Fúria conserva a base e muda somente as chamas de cima.
Cometas de brasas, Maré de fogo, Gêiser de chamas e Espiral incandescente conservam
a paleta e os materiais aprovados; volumes de fogo com nascimento/expansão/fim
substituem os pequenos carimbos rígidos. Caudas de cometas seguem posições
anteriores da trajetória curva. Fissuras sísmicas muda somente as rachaduras,
mantendo os mesmos detritos, pedras, poeira e movimento.

Vórtice de almas e Procissão espectral usam exatamente dois fantasmas maiores,
em posições opostas na órbita, com cabeça legível, vestes ondulantes e dissolução
no rastro. Rastro espectral nasce na parte traseira e usa apenas o passe atrás
do personagem. Os controles de som, duração, cor, intensidade, movimento
reduzido e desligar efeitos mantêm seus IDs e comportamento.

O navegador interpola quadros premultiplicados em dez canvases reutilizados.
Sem leitura de pixels na animação e sem caches associados a tokens/cenas.
Prévia estática dos 16 assets, barco com espuma, moinho v5/controles e retrato
sem fumaça permanecem no release.

TypeScript e build na cópia de release limpa passaram. Smoke cobre 105 efeitos
e 16 assets. `scripts/review-vtt-elemental.mjs` cobre os 21 efeitos desta revisão,
estado reduzido estável, dez materiais animados/fechamento do ciclo, limite de
21 mídias/10 canvases e comparação exata dos passes aprovados de inferno/fúria
e do primeiro plano sísmico com o commit 38f2c06. Pranchas e sequências ficam
somente em `test-results`, incluindo o token privado usado na inspeção.
Cadência observada no Edge local: submissão 1,73 ms, RAF 5,55 ms para seis
efeitos simultâneos; não é promessa para outros dispositivos.

Aplicado ao Docker local a partir da imagem vigente, mantendo servidor/migrations
e mídias anteriores. 43 bundles e 21 novas mídias conferidos por SHA-256 via HTTP.
59 tabelas mantiveram linhas integrais iguais; 337 presets anteriores também
iguais, mais um preset criado pelo usuário antes do deploy. Edição legítima da
sala anterior ao deploy permaneceu intacta. Ilustrador PID 24260 continua ativo.
Protótipo 330 × 4 e trabalho independente do moinho preservados, sem entrar no
commit desta revisão.

Pedido seguinte em andamento: baús das famílias devem mostrar o objeto com a
skin apoiado na caixa, atualizando a prévia com a variante escolhida. Usuário
também autorizou comparar todos os itens mágicos do 5etools e completar a loja
com artes/falas individuais, sem duplicações; levantamento ainda não publicado.
