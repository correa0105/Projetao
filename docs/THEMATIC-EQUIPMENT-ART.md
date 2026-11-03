# Direção de arte dos equipamentos

O proprietário autorizou substituir **todo o acervo antigo feito com sobreposição de texturas, em lotes**, incluindo armas, armaduras e cada peça dos conjuntos. A regra vale também para artes futuras. Os geradores antigos de skins e peças por máscara/textura estão bloqueados; suas fontes, receitas e arquivos permanecem preservados.

A cobertura inclui **todos os tipos de todos os seletores**, além de armas, capas e outros itens que pertençam a uma família temática. Cada modelo físico recebe construção própria dentro do mesmo tema; completar só espinhos não conclui a família Mitral. O campo `family_coverage` do plano lista os modelos e as peças individualmente, incluindo os nativos antigos que ainda precisam de conferência. Uma família só é marcada como concluída quando todos esses registros estão aprovados.

Cada tema precisa existir na construção do objeto: silhueta, recortes, articulações, camadas, costuras, ferragens e materiais. Acessórios da mesma família compartilham uma linguagem de fabricação, adaptada à função de cada peça. Uma espada e um machado continuam sendo armas distintas; tecido continua tecido, couro continua couro e malha não vira placas. Evitar padrão estampado, simples recoloração, textura recortada pela silhueta ou brilho usado como substituto de desenho. Não acrescentar poderes, peças vendidas ou bônus por causa da aparência.

## Fluxo por lote

1. Consultar o plano em `data/thematic-equipment-redesign-plan-20261102.json` e selecionar famílias completas; começar pelos dois exemplos enviados: mitral de espinhos e acolchoada do marinheiro.
2. Gerar um item nativo por chamada de `image_gen.imagegen`, com transparência real. Criar primeiro o modelo principal e usar sua construção como referência para as peças separadas. Não usar scripts de revestimento ou fazer uma prancha recortada passar por artes individuais.

   Usar grupos pequenos nas chamadas da ferramenta e salvar a referência de cada resultado assim que concluir. Não acumular dezenas de imagens nativas numa única resposta do chat; a conferência conjunta usa pranchas locais em fundos claro e escuro. Uma falha no tamanho da prévia não justifica gerar de novo artes que já foram salvas.
3. Importar os arquivos com `scripts/import-themed-equipment-art.mjs --sources=arquivo-privado.json --version=AAAAMMDD`. O arquivo privado contém `id`, `source` e o prompt exato. O importador conserva PNGs em `artwork-archive/thematic-equipment-AAAAMMDD/` e cria WebPs versionados de até 768 px, sem ampliar, achatar ou distorcer.
4. Conferir peça correta, modelos/pares, recortes, materiais, coerência familiar, ausência de cortes, transparência em fundos claro e escuro e legibilidade pequena. Só depois usar `--approve-reviewed` para incluir as referências em `shared/thematic-equipment-images.json`.
5. Conferir integridade e conservação do catálogo, publicar com backup e verificar as imagens na loja e no inventário. IDs, preços administrativos, estatísticas, quantidades, donos e histórico permanecem. Personagens e tokens já aprovados não são regenerados automaticamente.

`data/thematic-equipment-art-20261102.json` conserva prompts, caminho da arte anterior, originais, hashes, tamanhos e estado da revisão. O mapa leve compartilhado contém somente IDs e URLs aprovados; os prompts não vão para o cliente. O seed aplica o mapa depois das fontes antigas para impedir regressão ao reconstruir o catálogo. Peças separadas usam a mesma prioridade.

## Otimização

Publicar URLs novas e versionadas para preservar cache. Manter proporção, transparência e detalhe legível; o limite de 768 px corresponde à política de imagens da loja, com compressão WebP e alfa de alta qualidade. Não enviar os PNGs de produção para a página. Originais, mapas, backgrounds, máscaras e atlas não são sobrescritos. A política geral permanece em [ASSET-LOADING](ASSET-LOADING-20261021.md).

## Continuidade

A troca integral permanece em andamento até que não haja mais trabalhos pendentes no plano. Um lote concluído não representa conclusão do acervo inteiro. Atualizar o plano após importar/aprovar novas artes e registrar a publicação de cada lote com sua evidência privada.

O primeiro lote está publicado: **mitral de espinhos e acolchoada do marinheiro**, seis peças de cada família, 12 artes nativas individuais. O mitral tem armações e espinhos forjados sobre couro; o marinheiro tem recortes e canais acolchoados em ondas, cordas e fechos de conchas. São 24.526.642 bytes de originais PNG preservados e 1.050.976 bytes nas cópias WebP, redução de 95,7%. Transparência e desenho conferidos sobre claro/escuro e na loja em 1440/390 px; três testes passaram, incluindo conservação de compras, inventário, preços administrativos e replay. A publicação manteve o ilustrador ativo e as referências antigas disponíveis. Evidências em `.local/thematic-equipment-20261102/result.json`; manifesto de prompts e originais em `data/thematic-equipment-art-20261102.json`.

O lote seguinte completa **todos os nove modelos de mitral**, totalizando 54 artes aprovadas na família. As 48 novas artes incluem os oito modelos restantes e suas peças separadas; dez dessas peças atendem somente acessórios legados já possuídos. Peitoral e meia armadura continuam compras de peça única. Malha fina, anéis fechados costurados, escamas sobrepostas, talas verticais e placas articuladas têm construções distintas, com a mesma linguagem de forja do mitral.

Os 95.055.945 bytes de PNGs novos estão preservados; as cópias WebP usam 4.565.620 bytes, redução de 95,2%. A revisão cobriu fundos claro/escuro, todos os seletores em computador/celular, quatro testes de integridade e conservação dos dados. Publicação confirmada em `alvorada-cinzenta:mithral-family-20261103`: 60 arquivos HTTPS conferidos por hash, nove modelos de mitral, imagens do catálogo atualizadas e ilustrador ativo. Evidências em `.local/mithral-family-20261103/result.json`; os prompts e originais permanecem no manifesto central.

O levantamento atual registra **4.162 artes físicas**, que atendem 4.317 referências de catálogo/peças. Sessenta artes estão substituídas e **4.102 permanecem pendentes para os próximos lotes**. A diferença de uma arte no levantamento inclui o modelo principal de placas de mitral, refeito para manter a família coerente. Priorizar famílias completas e compartilhar uma arte somente quando os consumidores representarem o mesmo desenho físico, respeitando as variantes e o modelo real. Armas, capas e as demais famílias continuam no escopo autorizado e ainda não estão concluídas.
