# Locais e histórias no mapa

Admin pode clicar no pin e usar Excluir pin no painel. Há confirmação com nome e
opção Cancelar. DELETE /atlas/locations/:id/pin valida administrador atual e a
revisão enviada; jogador/preview não podem excluir. A ação retira o marcador para
todos, mantendo local, História, missões e vínculos do VTT. É possível recolocá-lo
por Adicionar pin escolhendo o local existente. Falha de rede/revisão mantém a
confirmação aberta e exibe o erro. O antigo editor de objetos do reino foi retirado
da interface; administração de pins permanece independente dele.

Acabamento posterior: nome acima de cada marcador, pin vetorial próprio com aro
metálico/miolo contrastante e área de toque de 44 px. Nenhuma imagem do mapa é
recomprimida. Prévia aquarela fica acima do nome, sem cobrir a legenda. Todo jogador
tem Ocultar todos os pins / Mostrar todos os pins; preferência por navegador
persistida, sem excluir registros nem ocultar os locais para outras pessoas.
Ao mostrar de novo, marcadores são reprojetados na câmera atual; o modo de
adicionar pin volta a exibi-los. Teste de navegador confirma legenda acima do
símbolo, ocultar/mostrar, reload, três balões e missões/História preservados.

Publicado na Hostinger em pin-visibility-20261021; TypeScript, build e navegador
passaram. Conferência somente leitura em produção preservou contas, personagens,
missões e saldos; bundles e artes originais conferidos por hash. Ilustrador online.

Administrador usa Adicionar pin no Reino do Norte e clica no ponto desejado. Pode
criar local ou aproveitar um já cadastrado, editar nome/descrição, mover e ocultar.
Ocultar preserva o local, suas missões e história. Coordenadas normalizadas seguem
o pan/resize do mapa com zoom público fixo de 150%. Os seis locais antigos seguem
cadastrados, inicialmente sem pin visível; não se inventam posições novas para eles.

Click no pin abre o histórico das missões daquele local. Criação de missão e mesa
oferece Reino e Área específica da missão. A área é obrigatória se houver reino e
validada no servidor; clientes antigos sem vínculo geográfico continuam aceitos.
Dono pode mudar o local da própria mesa; mapa pendente é salvo antes da alteração.

Aba História no painel reutiliza os blocos e todas as opções do editor Lore em
formato compacto: texto, materiais, imagens, efeitos, alinhamento, formato,
legenda, reordenação, prévia e publicação. Páginas são criadas em rascunho sob a
pasta História do reino. Jogadores recebem somente conteúdo publicado; preview
de conta básica não herda as permissões administrativas.

Hover ou foco do pin mostra até três primeiros blocos de imagem publicados na
ordem da história, em pequenos balões aquarela. São montados só durante hover/foco
e não integram o loading geral. Respeitam teclado, toque e movimento reduzido.

Migration 120 adiciona vínculos em world_regions/world_locations/vtt_rooms,
visibilidade e revisão do pin. Escritas verificam administrador atual no banco;
conflitos de revisão devolvem 409. Páginas ligadas não podem ser movidas para outro
reino. Remoção de página permite criar nova história, sem apagar missões.

Validação em banco local UUID descartável:

- `node scripts/test-portal-controls-isolated.mjs --atlas-places`: autorização,
  preview, publicação, três prévias, revisão, persistência, missão e VTT.
- `node scripts/test-portal-controls-isolated.mjs --pins-browser`: criação real,
  história com três uploads, edição, pan, formulário, reload, mobile e upload lento
  sem reabrir loading global. Capturas em test-results/world-pins.
