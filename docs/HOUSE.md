# House — 06/10/2026

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
