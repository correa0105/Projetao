# Cortar corda do arpão — 27/10/2026

No painel lateral ou menu do lançador, uma corda presa mostra a ação **Cortar corda**, junto de Carregar/Mirar/Disparar. Enquanto ligada, ela bloqueia nova carga e novo disparo. Cortar libera o lançador, preserva o arpão preso na superfície/alvo e permite Carregar → Mirar → Disparar novamente, com a munição de reserva e as ações usuais.

O mestre pode cortar sem selecionar operador. Jogadores precisam de personagem controlado, capaz e próximo a até 5 pés; espectadores não operam. O corte não consome munição, não restitui a carga anterior, não muda dano, pontos de vida, mira/carga já existente nem as ações de cerco. É uma liberação da ligação visual; as três etapas do tiro continuam com uma ação cada.

Comando autoritativo `cutRope`: valida sala, mapa, visibilidade, revisão e operador; serializa pelo lock da mesa/arma e preserva idempotência por operação. Atua somente nos impactos de arpão ainda ligados à arma escolhida naquele mapa. `ropeCutAt` e `ropeOrigin=null` são persistidos no JSON dos impactos, mantendo ID, posição, alvo e âncora local. `ropeAttached` informa a disponibilidade do lançador sem revelar coordenadas de alvos ocultos. Várias cordas legadas da mesma arma são liberadas juntas; outros lançadores, balas e mapas permanecem. Sem migration ou mudança de protocolo (28/migration 132).

O renderer deixa de desenhar a corda assim que recebe o corte, inclusive em clientes anteriores que reconhecem `ropeOrigin=null`. O projétil continua acompanhando o alvo e fica até o mestre remover; recarregar a página não restaura a corda. Um segundo tiro recebe corda própria. Água continua sem deixar projétil persistente. Arquivos PNG/áudios, tempos, animações e worker de arte preservados.

Validação: TypeScript, builds cliente/servidor, quatro testes de impactos/água/sigilo e um de mecânicas/ações/munição. API verifica bloqueio da recarga, controle e distância, espectador, canhão sem corda, repetição segura, corte pelo mestre sem operador, preservação do projétil e segundo tiro. Navegador real com mestre/jogador, quatro larguras, pixels da corda antes/depois, persistência após nova entrada e novo disparo.

Publicado em alvoradacinzenta.com como vtt-harpoon-cut-rope-20261027, código 8b312f35f3d381f7e437bdd3374966cf75ab94e7. Backup anterior completo; 44 arquivos novos, 1.490 anteriores e 41 HTTPS conferidos. Seis mesas, 37 assets privados, 26 slots, fichas, inventários, compras, marcas e armas/munição/vínculos idênticos por hash antes/depois. PNGs/242 áudios e ilustrador online preservados, sem recarga do worker. Ctrl+F5.
