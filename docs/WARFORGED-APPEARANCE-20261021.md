# Aparência do Warforged

Na criação da ficha, Warforged oferece seis estruturas ilustradas: Equilibrado,
Esguio, Robusto, Braços reforçados, Pernas alongadas e Compacto. As seis cabeças
são Máscara lisa, Visor, Angular, Olhos circulares, Mandíbula segmentada e Cúpula
rebitada. Mais seis cabeças detalhadas ampliam a seleção para doze: Sentinela,
Cavaleiro, Oráculo, Guardião, Artífice e Veterano. Cada uma usa a célula correspondente
da nova prancha; as seis escolhas anteriores continuam válidas. Os seis modelos
novos aparecem primeiro e Sentinela é o padrão das novas criações, sem substituir
escolhas já salvas. Oito cores metálicas principais podem ser combinadas com acabamento
Polido, Escovado, Envelhecido ou Enferrujado. Detalhes têm doze cores sugeridas,
seletor de cor personalizada e opção de não usar cor secundária.

São escolhas cosméticas: não concedem CA, alcance, Força, mudança de tamanho,
metal valioso ou equipamento. Cores do corpo não substituem as cores das armas,
armaduras ou roupas compradas. Texto livre de aparência continua disponível.

`warforgedAppearance` é um objeto opcional no JSON existente da ficha, validado
no servidor. Novas criações recebem um padrão editável. Registros antigos sem a
chave não são reescritos nem ganham instruções cosméticas automaticamente; troca
de espécie remove a escolha incompatível. Salvar e recarregar conserva as opções.

Na criação, o jogador pode escolher **Criar apenas com as características escolhidas**
ou **Enviar uma imagem de referência**. Sem upload, o servidor aceita somente
uma nova criação Warforged com construção validada. A fila salva referência NULL,
mantém todas as escolhas e permite retomar o mesmo pedido após falha. Trocar de
uma referência enviada para construção sem imagem remove a referência anterior e
invalida o retrato já aprovado. Outras espécies e novas artes de personagens
existentes mantêm suas exigências anteriores. Arte inicial continua gratuita.

Retrato usa a prancha do corpo e a prancha da cabeça escolhida como referências
somente das células selecionadas, com o estilo existente e, opcionalmente, a imagem
do jogador. Sem ela, cria uma identidade original pelas escolhas validadas. Equipamentos múltiplos
usam a prancha de equipamento já existente para respeitar cinco referências.
Token e revisão também recebem estrutura, cabeça, acabamento e paleta; oclusão
natural e revisão anatômica continuam obrigatórias. Nenhuma geração real de
personagem é consumida pelos testes.

Geração, correção e revisão do retrato/token recebem a regra de caimento da calça:
tecido envolve o corpo e nunca atravessa pernas ou articulações metálicas. Rasgos
com bordas e volume coerentes são permitidos. Reprovação usa o ciclo existente de
até três correções, sem publicar imagem reprovada. Isso se aplica às próximas
gerações; imagens já entregues não são alteradas automaticamente.

O botão **Criações salvas** foi restaurado no acampamento para permitir abrir a
janela de retomada já existente, inclusive com pedidos sem imagem de referência.

Artes originais pelo image_gen embutido, PNGs sem transformação/compressão:

- `public/character-creation/warforged-bodies-20261021.png`
- `public/character-creation/warforged-heads-20261021.png`
- `public/character-creation/warforged-heads-detailed-20261021.png`

As três pranchas têm 1536 × 1024 px, três colunas e duas linhas, exibidas por
recorte SVG sem editar os bytes (corpos divididos em y=490 para preservar a
cabeça inteira dos modelos inferiores). Seletores são preparados juntos dentro do
formulário, sem reabrir o loading geral a cada clique. Referência do usuário:
[busca Warforged no Pinterest](https://br.pinterest.com/search/pins/?q=warforged&rs=typed).
Prévias públicas consultadas, sem copiar imagens de terceiros. Prompts completos,
origem e hashes em `data/character-creation/warforged-appearance-20261021.json`.
As seis cabeças detalhadas têm prompt inicial, edição de orientação do Cavaleiro
e hashes em `data/character-creation/warforged-heads-detailed-20261021.json`.

Validação: matriz de 72 corpos/cabeças sem alteração nos valores derivados,
rejeição de campos inválidos, espécie incompatível e compatibilidade legada.
Navegador em 1440/768/390/320 px cobre escolha, cor personalizada, gravação pela
API, recarregamento e controles visíveis. Capturas em test-results/warforged-appearance.
API em banco descartável cobre fila sem upload, troca de modo, privacidade,
retry, entrega em duas etapas e cota inicial. CLI simulada captura anexos e prompts
reais sem gerar arte paga, força reprovação de tecido atravessando pernas e
confirma a correção/revisão, escolhas e limite de cinco referências.
