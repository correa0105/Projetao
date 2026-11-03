# Direção de arte dos equipamentos

O proprietário autorizou substituir **todo o acervo antigo feito com sobreposição de texturas, em lotes**, incluindo armas, armaduras e cada peça dos conjuntos. A regra vale também para artes futuras. Os geradores antigos de skins e peças por máscara/textura estão bloqueados; suas fontes, receitas e arquivos permanecem preservados.

Cada tema precisa existir na construção do objeto: silhueta, recortes, articulações, camadas, costuras, ferragens e materiais. Acessórios da mesma família compartilham uma linguagem de fabricação, adaptada à função de cada peça. Uma espada e um machado continuam sendo armas distintas; tecido continua tecido, couro continua couro e malha não vira placas. Evitar padrão estampado, simples recoloração, textura recortada pela silhueta ou brilho usado como substituto de desenho. Não acrescentar poderes, peças vendidas ou bônus por causa da aparência.

## Fluxo por lote

1. Consultar o plano em `data/thematic-equipment-redesign-plan-20261102.json` e selecionar famílias completas; começar pelos dois exemplos enviados: mitral de espinhos e acolchoada do marinheiro.
2. Gerar um item nativo por chamada de `image_gen.imagegen`, com transparência real. Criar primeiro o modelo principal e usar sua construção como referência para as peças separadas. Não usar scripts de revestimento ou fazer uma prancha recortada passar por artes individuais.
3. Importar os arquivos com `scripts/import-themed-equipment-art.mjs --sources=arquivo-privado.json`. O arquivo privado contém `id`, `source` e o prompt exato. O importador conserva PNGs em `artwork-archive/thematic-equipment-20261102/` e cria WebPs de até 768 px, sem ampliar, achatar ou distorcer.
4. Conferir peça correta, modelos/pares, recortes, materiais, coerência familiar, ausência de cortes, transparência em fundos claro e escuro e legibilidade pequena. Só depois usar `--approve-reviewed` para incluir as referências em `shared/thematic-equipment-images.json`.
5. Conferir integridade e conservação do catálogo, publicar com backup e verificar as imagens na loja e no inventário. IDs, preços administrativos, estatísticas, quantidades, donos e histórico permanecem. Personagens e tokens já aprovados não são regenerados automaticamente.

`data/thematic-equipment-art-20261102.json` conserva prompts, caminho da arte anterior, originais, hashes, tamanhos e estado da revisão. O mapa leve compartilhado contém somente IDs e URLs aprovados; os prompts não vão para o cliente. O seed aplica o mapa depois das fontes antigas para impedir regressão ao reconstruir o catálogo. Peças separadas usam a mesma prioridade.

## Otimização

Publicar URLs novas e versionadas para preservar cache. Manter proporção, transparência e detalhe legível; o limite de 768 px corresponde à política de imagens da loja, com compressão WebP e alfa de alta qualidade. Não enviar os PNGs de produção para a página. Originais, mapas, backgrounds, máscaras e atlas não são sobrescritos. A política geral permanece em [ASSET-LOADING](ASSET-LOADING-20261021.md).

## Continuidade

A troca integral permanece em andamento até que não haja mais trabalhos pendentes no plano. Um lote concluído não representa conclusão do acervo inteiro. Atualizar o plano após importar/aprovar novas artes e registrar a publicação de cada lote com sua evidência privada.
