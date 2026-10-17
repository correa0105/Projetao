# VTT — camadas, personagens, Ctrl e captura

## Uso

- **Brush do mapa → Grama fina clara** é a primeira textura da lista. As quatro gramas enviadas/derivadas ficam no início, com **Buscar textura** e prévia da seleção, como na House 2.0. A ordenação visual mantém os 42 materiais e seus IDs salvos.

- **Camadas → Ordem de sobreposição dos itens** abre a lista de itens, do que aparece por cima para o que aparece por baixo. Selecionar pela lista permite alcançar uma peça coberta. Frente, Subir, Descer e Trás reorganizam a seleção dentro da camada atual; os mesmos comandos aparecem nas opções do objeto. O seletor permite mover itens entre Fundo, Objetos e personagens e Mestre. Grupos vinculados conservam o apoio e os vínculos.
- **Fichas → Personagens da mesa**, para o mestre, lista os personagens dos participantes que entraram como jogadores, além dos personagens do próprio mestre. Clique para colocar/selecionar ou arraste até a posição desejada. Atualizar personagens da mesa recarrega a lista. O token conserva o controlador original, a ficha e a imagem disponíveis; repetir a operação seleciona o token existente. Personagens de outras contas fora da mesa e de espectadores ficam fora da lista.
- **Ctrl + arraste**, sobre um item selecionado, gira em torno do seu centro; Ctrl + roda gira em passos de 15°. Esc cancela o gesto. O jogador também pode girar o próprio personagem. Sem uma peça selecionada sob o ponteiro, Ctrl + arraste conserva a navegação. Bloqueio de token e modo de visualização continuam respeitados.
- **Print HD**, no topo do VTT, aparece somente para administradores. O botão confere novamente a permissão no servidor e baixa um PNG da área visível do mapa, sem painéis, alças, seleção, réguas ou traços temporários. A cena é renderizada em até quatro vezes a resolução lógica, limitada a 8192 pixels por lado e 32 milhões de pixels. A visão e os efeitos permanentes da cena acompanham a captura.

## Implementação e permissões

`shared/vtt-stacking.ts` reorganiza os níveis visuais existentes sem mudar posições, propriedades de jogo ou camadas de outros grupos. A seleção de um token vinculado reorganiza o conjunto com seu apoio. O documento continua persistido pelo fluxo normal de revisão, Salvar/Desfazer e PostgreSQL, sem migration.

`GET /vtt/rooms/:id/characters` exige dono da mesa e administrador. Retorna apenas identificação pública dos personagens elegíveis, sem ouro, biografia, inventário ou e-mail. `POST /vtt/rooms/:id/characters/:character` resolve o proprietário real no servidor e permite ao mestre trazer personagens dos jogadores daquela mesa. A importação vincula imagem/ficha ao proprietário original e conserva a autorização de controle; dados do personagem do site permanecem intactos.

`GET /vtt/rooms/:id/capture-permission` exige acesso à mesa e administrador vigente, inclusive quando a permissão foi revogada depois da página carregar. A captura usa o renderer e a visão disponíveis no navegador. Não cria nem altera dados de jogo.

## Validação

- TypeScript e build de cliente/servidor, usando HEAD mais somente as alterações solicitadas.
- Três testes de ordenação, incluindo seleção por sobreposição, múltiplos itens, profundidades extremas, repetição e grupos vinculados.
- `node scripts/test-vtt-map-controls-isolated.mjs`: navegador real com PostgreSQL UUID descartável; ordem salva, troca de camada, seleção coberta, Ctrl por arraste/roda e Esc, controle do jogador, importação por clique/arraste, idempotência, imagens, privacidade, espectador, revogação administrativa e personagem original intacto.
- PNG real de **4224 × 3744**, sem controles de edição; layout em 1440, 768 e 390 px, sem erros JavaScript. Evidência em `test-results/vtt-map-controls/result.json` no estágio local.
- A suíte ampla de VTT/perfis passou em 21 testes. Mantém uma falha anterior no teste “perfil mantém avatar e cenário legado; novo envio de cenário fica indisponível”: o endpoint atual retorna 200 e o teste espera 403. A mesma falha foi reproduzida com `server/vtt.ts` de HEAD, sem estas alterações. Evidência local em `.local/vtt-social-baseline-result.json`; teste e funcionalidade de perfil preservados.
- Publicação incremental local: `alvorada-cinzenta-app:vtt-map-controls-v1-20261017`, com backup PostgreSQL validado, auditoria dos dados e SHA-256 dos arquivos anteriores. Resultado em `.local/vtt-map-deployment-result.json`.

Recarregar a página para carregar o novo cliente em uma aba já aberta.
