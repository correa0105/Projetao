# Aparência do Warforged

Na criação da ficha, Warforged oferece seis estruturas ilustradas: Equilibrado,
Esguio, Robusto, Braços reforçados, Pernas alongadas e Compacto. As seis cabeças
são Máscara lisa, Visor, Angular, Olhos circulares, Mandíbula segmentada e Cúpula
rebitada. Oito cores metálicas principais podem ser combinadas com acabamento
Polido, Escovado, Envelhecido ou Enferrujado. Detalhes têm doze cores sugeridas,
seletor de cor personalizada e opção de não usar cor secundária.

São escolhas cosméticas: não concedem CA, alcance, Força, mudança de tamanho,
metal valioso ou equipamento. Cores do corpo não substituem as cores das armas,
armaduras ou roupas compradas. Texto livre de aparência continua disponível.

`warforgedAppearance` é um objeto opcional no JSON existente da ficha, validado
no servidor. Novas criações recebem um padrão editável. Registros antigos sem a
chave não são reescritos nem ganham instruções cosméticas automaticamente; troca
de espécie remove a escolha incompatível. Salvar e recarregar conserva as opções.

Retrato usa as duas pranchas como referências somente da célula selecionada,
junto da referência do jogador e do estilo existente. Equipamentos múltiplos
usam a prancha de equipamento já existente para respeitar cinco referências.
Token e revisão também recebem estrutura, cabeça, acabamento e paleta; oclusão
natural e revisão anatômica continuam obrigatórias. Nenhuma geração real de
personagem é consumida pelos testes.

Artes originais pelo image_gen embutido, PNGs sem transformação/compressão:

- `public/character-creation/warforged-bodies-20261021.png`
- `public/character-creation/warforged-heads-20261021.png`

Ambas as pranchas têm 1536 × 1024 px, três colunas e duas linhas, exibidas por
recorte SVG sem editar os bytes (corpos divididos em y=490 para preservar a
cabeça inteira dos modelos inferiores). Seletores são preparados juntos dentro do
formulário, sem reabrir o loading geral a cada clique. Referência do usuário:
[busca Warforged no Pinterest](https://br.pinterest.com/search/pins/?q=warforged&rs=typed).
Prévias públicas consultadas, sem copiar imagens de terceiros. Prompts completos,
origem e hashes em `data/character-creation/warforged-appearance-20261021.json`.

Validação: matriz de 36 corpos/cabeças sem alteração nos valores derivados,
rejeição de campos inválidos, espécie incompatível e compatibilidade legada.
Navegador em 1440/768/390/320 px cobre escolha, cor personalizada, gravação pela
API, recarregamento e controles visíveis. Capturas em test-results/warforged-appearance.
