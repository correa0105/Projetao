# Aparência do Warforged

22/10: a geração/revisão de montagem recebe referências privadas isoladas do corpo
e da cabeça selecionados, extraídas das mesmas células mostradas na criação.
Os PNGs originais ficam intactos, sem redimensionamento ou recompressão. A cabeça
do modelo de corpo não vale como referência de rosto. O token também recebe a
cabeça isolada, mantendo câmera superior, paleta e oclusão. Limite de cinco anexos
e limpeza dos arquivos temporários preservados.

Retrato e token de montagem exigem `selected_head_correct=true`, separado da
aprovação geral, da anatomia e da roupa; falta do campo ou divergência bloqueia
entrega. Revisão compara silhueta, placas, lente/visor, mandíbula e mecanismos
visíveis. O Artífice exige a lente saliente e o amplo mecanismo lateral/posterior
do modelo, em lugar da antiga descrição de pequenas engrenagens. A cabeça escolhida
prevalece sobre erro de cabeça em uma BASE antiga; corpo, identidade e paleta
continuam preservados. Modo de referência não recebe referências de montagem.

Roupa inicial comum às espécies agora é traje simples de aventureiro medieval:
túnica de linho cru até o quadril, gola com cordão, debrum verde-musgo discreto,
faixa de tecido e calça castanho-escura inteira até os tornozelos. Equipamento
escolhido substitui apenas sua posição, sem conceder itens novos. Prompt antigo
de trapos/pijama removido, incluindo a orientação de copiar roupa da imagem de
estilo. Geração, correção e revisão de retrato/token exigem tecido por fora de
ambas as pernas até os tornozelos/calçado, barras inteiras e simétricas, sem
rasgos expondo canelas nem interpenetração. Oclusão natural permanece correta.
`clothing_correct=false` sempre impede entrega, com até três tentativas.

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

O seletor **Como criar a aparência** aparece imediatamente acima de **Construa seu
Warforged**, junto das opções de estrutura/cabeça/cores. Ele permanece nesse local
quando o modo de referência oculta a montagem; outras espécies e fichas salvas
não recebem o seletor de modo da criação.

Na criação, os modos **Criar apenas com as características escolhidas** e
**Enviar uma imagem de referência** são exclusivos. Escolher referência desmarca e
oculta toda a montagem; um aviso explica essa exigência. `warforgedArtMode` guarda
o modo na ficha e não pode ser trocado posteriormente. Referência com montagem
ativa é rejeitada pela API. Sem upload, o servidor aceita uma construção validada. A fila salva referência NULL,
mantém todas as escolhas e permite retomar o mesmo pedido após falha. Trocar de
uma referência enviada para construção sem imagem remove a referência anterior e
invalida o retrato já aprovado. Arte inicial continua gratuita.

**Vestir** e **Nova imagem** de um Warforged montado não pedem nem aceitam upload.
A API copia a identidade BASE privada para o pedido; a revisão compara estrutura,
rosto e proporções com essa base e exige a paleta/metal/acabamento salvos. Apenas
roupas e itens selecionados podem mudar. A cor das roupas não recolore o corpo.
Robôs criados por referência continuam usando referência e não anexam as pranchas
de montagem. Outras espécies mantêm o fluxo anterior.

Migration 123 adiciona `character_portraits.construction_base` e o modo protegido
de cada pedido. Na criação montada, a primeira arte aprovada vira a base e vestir
nunca a substitui. Fichas legadas com montagem salva seguem o modo construction;
sem montagem, reference. A base legada é preservada no primeiro pedido de vestir.
Pedidos pendentes sem referência da versão anterior são identificados pela própria
criação Warforged validada; não reescrever escolhas de fichas ou cotas históricas.

No modo montagem, o retrato usa a prancha do corpo e da cabeça escolhida somente
nas células selecionadas, com o estilo existente. A criação usa as escolhas
validadas; vestir usa a identidade BASE privada, sem imagem do jogador. No modo
referência, usa o estilo e a imagem enviada, sem pranchas de montagem. Equipamentos múltiplos
usam a prancha de equipamento já existente para respeitar cinco referências.
Token e revisão também recebem estrutura, cabeça, acabamento e paleta; oclusão
natural e revisão anatômica continuam obrigatórias. Nenhuma geração real de
personagem é consumida pelos testes.

Geração, correção e revisão do retrato/token recebem a regra de caimento da roupa:
tecido envolve o corpo e nunca atravessa pernas ou articulações metálicas. Mangas
precisam ligar-se ao ombro; uma camisa sem mangas não pode criar punhos soltos nos
antebraços. O resultado exige `clothing_correct=true` na revisão visual, além de
anatomia aprovada e nenhum defeito pendente. Ausência desse campo falha a revisão;
false força correção mesmo que `approved=true`. Após três reprovações, não publicar.
Testes simulam essas contradições e ausência de resposta tanto no retrato como no token. Rasgos
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
Também cobre referência/montagem incompatíveis, modo fixo, vestir sem upload,
base imutável após trocar a arte, snapshot da paleta e ambos os acessos no navegador.
XD 2 foi excluído pelo proprietário antes da correção preparada ser aplicada;
os guardas preservaram os demais personagens e nenhuma cota foi cobrada.
