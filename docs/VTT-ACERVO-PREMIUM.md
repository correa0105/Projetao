# Acervo premium e fichas privadas — 06/10/2026

## Uso

Biblioteca → Monstros conserva o catálogo SRD e suas artes anteriores. Presets de
monstros reúne cópias privadas de todos os monstros trazidos às mesas do mestre,
incluindo mesas anteriores. Fichas → Abrir folha completa → Editar permite alterar
nome, imagem enviada, tipo, tamanho, ND, PV/CA, atributos, deslocamentos, informações,
características, ações, fórmulas e anotações. Salvar ficha e preset atualiza apenas
a cópia da sessão e o acervo do dono. IDs de ações são conservados ao editar/traduzir
nomes e descrições; os atalhos continuam resolvendo a ação correta. Importar preset
em outra mesa copia também a imagem enviada, mantendo ownership e autorização.

Traduzir para português prepara um rascunho revisável no mesmo editor. O serviço
local LibreTranslate/Argos usa os modelos inglês/português, sem envio a terceiros.
Frases/linhas são preservadas; dados, números, tipos de dano, condições e tamanhos
recebem proteção explícita. Quando o modelo perde um marcador, traduzem-se os
trechos de prosa separadamente, conservando todas as regras. Fórmulas dos ataques
nunca são traduzidas. O catálogo original permanece intacto.
[Instalação oficial](https://docs.libretranslate.com/guides/installation/).

Biblioteca → Premium mostra somente artes individuais concluídas, com contador
real em relação aos 330 monstros. Clique na aba novamente para atualizar o acervo;
clique no cartão para consultar a ficha ou arraste para a mesa. Silhuetas usam
proporção integral e transparência, sem recorte circular. Nenhum atlas é usado.

Acesso atual: **administrador=1 E tag Tokens premium** (`vtt_premium=true`). O usuário
recebeu uma pergunta para distinguir esse comportamento de administrador OU tag;
até resposta, vale a leitura restrita do pedido. Administradores concedem/revogam
a tag em Configurações e ajuda → Acesso premium. Perfil/cadastro não podem concedê-la.
Biblioteca, importação e novas colocações/duplicações são protegidas no servidor.
Participantes de uma mesa podem visualizar uma arte já colocada em um token que
possam ver; isso não concede acesso ao acervo nem capacidade de usá-lo em outra mesa.
Arquivos ficam em data/vtt/premium-art, fora da publicação estática, e são servidos
com autenticação, verificação de visibilidade e cache privado desabilitado.

## Chat e dano

O chat segue o rodapé somente quando o usuário está a até 2 px do final. Ao ler
mensagens anteriores ou carregar histórico, conserva a posição de leitura.
Após rolar dano, mestre aplica pela barra compacta ou pelo cartão do chat; dono
também pode registrar dano recebido pelo seu próprio token. O alvo vinculado à
rolagem não muda depois. A API usa o total sorteado e armazenado pelo servidor,
nunca um valor enviado pelo navegador. Locks e chave rolagem/token evitam desconto
duplicado. Dano descartado fica marcado e não pode ser aplicado; dano já aplicado
não pode ser descartado. Apenas PV da sessão, sem alterar personagem do site.

## Dados e serviços

Migration 069 adiciona a tag, presets privados, contexto de dano e auditoria de
aplicações. Preserva documentos, fichas, atalhos, personagens e assets existentes.
Campos privados novos também são removidos das projeções de jogadores/espectadores.
Tradutor está em serviço Docker interno, sem porta pública, com imagem oficial
v1.9.6 fixada por digest e volume próprio de modelos. Não apagar os volumes.
VTT_TRANSLATOR_URL pode apontar para outra instalação compatível.
Em Docker local, a pasta de arte premium é montada somente para leitura, permitindo
adicionar artes durante a produção sem reconstruir o site para cada monstro.

## Arte e continuidade

Pedido: todos os 330 monstros, cada qual em sua imagem, vista superior e fundo
transparente. Produção ainda em andamento; não confundir catálogo completo com
imagens premium concluídas. `manifest.json` é a fonte do contador e contém ID/nome,
arquivo, dimensões, pixels transparentes, hash SHA-256, prompt completo e referências
pesquisadas no Pinterest. Modo usado: **imagegen embutido**, geração individual; azul
recebeu edição de margem. Originais preservados no diretório de imagens geradas.

Marco de produção: 310 artes concluídas em 06/10, do Aboleth ao Werewolf, incluindo os
dez dragões adultos e os dez anciões, todos com arquivos próprios. Armadura, árvore,
bico de machado, azer, golem de argila e bugbear receberam revisão da câmera.
Basilisco e cão teleportador tiveram os membros corrigidos; behir foi redesenhado
com doze patas em seis pares visíveis. Chuul e filhote de dragão negro receberam
ajuste de enquadramento. Serpente constritora teve a continuidade corrigida; manto
sombrio recebeu oito tentáculos e drider foi redesenhado com oito patas separadas
em quatro pares. Caranguejo gigante foi redesenhado com oito patas de caminhada e
duas pinças; polvo gigante teve os oito braços corrigidos. Cubo gelatinoso usa
face superior quadrada em perspectiva ortográfica. Escorpião gigante teve os
quatro pares de patas corrigidos, além das pinças; aranha gigante recebeu mais
margem preservando oito patas. Górgona segue o touro de placas metálicas do catálogo.
Hezrou recebeu margem adicional; capitão hobgoblin, homúnculo, cavaleiro e lich
tiveram a câmera superior revisada. Hidra tem cinco cabeças e kraken tem dez
tentáculos separados, corrigidos após a revisão visual. Os cinco testes isolados
passaram neste marco, incluindo vínculos, transparência real e hashes das 310 artes.
Nobre e senhor das múmias receberam revisão da câmera; polvo tem oito braços,
marilith seis braços, otyugh três pernas e dois tentáculos de combate. Sacerdote e
acólito receberam câmera estritamente dorsal; salamandra tem as duas pontas da
lança inteiras. Aranha de fase tem oito patas e roper seis tentáculos. Escorpião comum
recebeu oito patas; fungo gritador teve a anatomia humanoide removida e naga espiritual
teve os ombros substituídos por pescoço de serpente. Três esfinges e cinco enxames têm
artes específicas. Vrock recebeu margem para as asas completas; unicórnio teve a
câmera e os quatro membros corrigidos. Familiar de vampiro é o humanoide da ficha,
e os cinco licantropos usam formas híbridas próprias. O total restante é 20;
o contador ao vivo continua vindo do manifest, sem estimar imagens prontas.
Silhuetas estreitas, como a espada animada, são validadas sem exigir a área de
um corpo largo. Verificação visual no navegador confirmou alpha e bordas limpas.
Quando não há token superior específico indexado no Pinterest, essa limitação
fica explícita nos metadados de pesquisa; a referência geral e a anatomia do
catálogo orientam o desenho original.

Referência do usuário: [Creature Tokens Pack 07](https://br.pinterest.com/pin/324611085643692072/).
O Pinterest apresentou uma janela de entrada; apenas a imagem pública visível e
resultados públicos foram consultados. Artes novas são originais, sem copiar ou
redistribuir os arquivos de artistas. A pesquisa por monstro é registrada no manifest.

Registre uma arte concluída usando `node scripts/register-premium-token.mjs
monster-ID arquivo.png metadados.json`. O script verifica catálogo/alpha e escreve
WebP de alta qualidade; o manifest é atualizado atomicamente. Não registrar
placeholders nem reaproveitar uma imagem para fingir múltiplos monstros concluídos.

## Verificação

`node scripts/test-vtt-premium-isolated.mjs`: permissões premium, revogação,
visibilidade, biblioteca intacta, presets separados por dono, IDs de ações, dano
concorrente/idempotente, privacidade, descarte e hashes/alpha.
`node scripts/test-vtt-premium-isolated.mjs --browser`: editor e presets, arte,
chat no final e leitura anterior, aplicação do dano e larguras 1440/768/390/320.
Regressão: os 23 testes de VTT/perfis existentes passaram. Tradução real do ataque
do Aboleth verificada com bônus +9, alcance 15, dano 12 (2d6+5) e escape 14 intactos.
