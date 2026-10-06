# House — 06/10/2026

## Vistas, perspectiva, camadas e RP

Os doze objetos possuem oito artes independentes, na ordem Frente, Frente e
direita, Direita, Trás e direita, Trás, Trás e esquerda, Esquerda, Frente e
esquerda. Decoração → Direção da peça troca a vista, enquanto Giro mantém o
ajuste fino. São 96 WebPs transparentes, vistos/revisados individualmente;
prompts, SHA-256 e dimensões em public/house/items/views/art-manifest.json.
Não usar espelhamento ou rotação plana como substituto das oito vistas.

shared/house-perspective.ts calcula o fator pela posição do pé/base no cenário:
0,15 + 0,85 × ((y − 0,08) / 0,76)², com y limitado a 0,08–0,98.
O ajuste base continua salvo; mudar a profundidade altera apenas a renderização.
Cada vista de objeto em pé é calibrada pela altura visível no alpha, mantendo
a altura física ao trocar frente/perfil. O tapete usa sua projeção no plano do
chão. scripts/calibrate-house-views.mjs gera shared/house-view-sizes.json.
Quadros projetam a imagem própria na abertura frontal/diagonal usando as quatro
quinas de shared/house-frame-quads.json; atrás mostram madeira e fixação.

O arraste resolve a posição da base levando em conta a mudança de escala. O
ponto originalmente clicado permanece sob o cursor até os limites da cena,
inclusive no personagem. Enviar para trás/Trazer à frente troca posições
adjacentes reais, incluindo empates/lacunas de layouts anteriores.

Personagem → Camada do personagem oferece À frente de tudo, Atrás de tudo e
Atrás de cada objeto colocado. Migration 074 adiciona house_presence.layer,
inteiro 0–602, padrão 602. Objetos usam z-index 2×layer+2; presença atrás de um
objeto usa 2×layer+1. Convidados ajustam somente a própria presença. Payloads
antigos sem layer conservam a camada existente ao mover/entrar novamente.

RP abre apenas dentro do cenário, com histórico translúcido e campo dourado
junto à base; segue mensagens quando já no final. O painel externo foi retirado.
Sons dos doze objetos usam arquivos próprios /audio/emporium/house-ID.wav e
preservam volume/mute dos efeitos. Tamanhos iniciais de personagens, montarias
e mascotes consideram suas proporções; layouts antigos conservam o ajuste manual.

Treze testes isolados de API, três testes de geometria/cursor/camadas e navegador
em quatro larguras aprovados. O navegador verifica camada persistida, ponto de
arraste a menos de 2 px do cursor, troca de vista, altura/base preservada e
quadros frontais/diagonais/traseiros com imagem privada.

Implementação iniciada depois do checkpoint GitHub `654c304`, com a tag enviada
`codex/checkpoint-antes-house-2026-10-06`. Não modificar o checkpoint.

Explorar → House abre a casa do personagem selecionado. Cada personagem tem uma
casa com sala, cozinha, varanda e jardim, cada ambiente com quatro cenários próprios.
Decorar permite escolher o cenário/nome, colocar a mobília ou companheiro, arrastar,
girar, redimensionar, ordenar camadas e guardar uma peça. Salvar é explícito e usa
revisão: outra aba não pode sobrescrever uma edição mais recente. Descartar volta
à versão persistida. A coleção da House é separada do equipamento de combate;
nenhuma peça possui revenda, peso de combate ou bônus automático.

Mobília vende doze peças por ouro do personagem dono da casa, com preço definido
no servidor, lock, chave idempotente, auditoria e débito inteiro em cobre. O Empório
tem acesso a Mobília/cartas/quadros. Carta Selada guarda texto/assunto. Quadro de
Memórias recebe uma imagem PNG/JPEG/WebP e dedicatória. Imagens são normalizadas
no servidor, até 5 MB/20 milhões de pixels, sem URLs remotas. Oferecer transfere
uma carta/quadro guardado para um personagem de outro jogador, preserva conteúdo
e remetente, audita e impede segundo envio. Peça colocada deve ser guardada antes.
Não são as cartas equipáveis de combate já existentes.

Convidados busca jogadores por nome, envia convite interno e exibe aceites. Apenas
destinatário pode aceitar/recusar; dono revoga. Convidado aceito pode visitar e
participar do RP, sem alterar decoração ou ler a coleção não exposta/saldo/convites.
Não existe bypass administrativo para visitar casas privadas. Bloqueio social
impede acesso/convites/presentes. Revogação retira presença e acesso às imagens.
RP aceita texto simples de até 2.000 caracteres com nome do personagem próprio;
envio idempotente, histórico compartilhado somente entre membros autorizados.

Personagem permite entrar na cena, mover sua presença, escolher tamanho e versão
da aparência. Guardar versão copia o retrato atual ou recebe imagem própria da
pose; até vinte por personagem. Versões permanecem privadas, exceto quando usadas
numa presença da casa à qual o visitante tenha acesso. Companheiros usam as artes,
proporções e recortes aprovados de montarias/mascotes; seleção do acampamento intacta.

Recompensas, exclusivo de administrador, concede uma peça a um personagem com
motivo/auditoria/idempotência, ou vincula a missão específica, número de missões
concluídas ou conquista existente. Ao abrir a própria casa, o servidor consulta
mission_rewards/board_posts/achievements e concede cada regra elegível uma vez.
Ativar/desativar regras conserva concessões anteriores. Não altera ouro de missões,
patente, XP, progresso ou histórico antigo. Não duplica tabelas de missões.

Migration 072 cria tabelas próprias house_*. Seeds existentes preservados. Dados
vivem no PostgreSQL; estado temporário do editor fica em React. Visita/RP atualizam
a cada dez segundos enquanto a aba está visível. Sem envio a e-mail ou serviços.
Vinculação a mapas e compra de propriedades por localização continuam futuras,
conforme o pedido do usuário.

Arte: 16 cenários + 12 objetos individuais feitos com imagegen embutido, inspecionados
visualmente e instalados em public/house. Prompts, hashes e dimensões estão em
public/house/art-manifest.json. Referências fornecidas pelo usuário orientam
perspectiva frontal e cenário medieval; fundos e objetos não usam imagens alheias.

Verificação: doze testes PostgreSQL isolados (incluindo subtestes) de ownership,
economia/concorrência, geometria/revisão, transferências, imagens, convites,
presenças/RP, administração, histórico e bloqueio social. Navegador testa compra,
arraste, giro/tamanho, recarga, mascote/montaria, convite/visita/RP/revogação e quatro
larguras (1440, 768, 390 e 320). Scripts test-house-isolated.mjs e smoke-house.ts.

Empório (06/10): os doze objetos aparecem na prateleira “Itens de House”, junto
às demais categorias. Removido o link externo que se tornava uma terceira célula
na grade da vitrine. A compra abre o formulário dentro do Empório, incluindo
carta/dedicatória/imagem pessoal, e usa o mesmo endpoint transacional de House.
Não cria produtos duplicados no inventário de aventura nem exige abrir a casa.
Layout e compra real de carta validados em PostgreSQL isolado e quatro larguras
(1755, 768, 390 e 320), pelo script test-emporium-isolated.mjs --browser.
