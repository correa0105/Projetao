# Menu dos tokens, perfil e disponibilidade da loja — 10/10/2026

O clique simples em um token da mesa abre controles compactos ao redor dele: PV, CA e deslocamento acima; configurações, condições, ficha, minimizar e fechar abaixo. A posição acompanha a câmera e o token, respeita as bordas da tela e permite rolar os painéis no celular. Minimizar conserva uma identificação curta que reabre os controles. Clique direito continua funcionando. Espectadores não recebem ações de edição.

O painel mantém os controles anteriores: edição de PV, barra de tamanho, indicação de sangramento, combate, camadas, vínculo, orientação, visibilidade, bloqueio, duplicação e remoção. Os trinta ícones de condições ficam em uma grade com nomes; as permissões de mestre e jogador permanecem no servidor. As três bolhas usam os valores reais existentes, sem criar atributos ou auras fictícias.

O perfil tem quatro áreas: Acampamento, Conquistas, Hall da Fama e Cartas. Uma seta de metal trabalhado à direita avança para a próxima área e retorna ao Acampamento depois da última. Teclado e nomes acessíveis identificam a navegação. O bloco superior mostra o jogador, o retrato circular do personagem selecionado e o seletor; trocar o personagem troca o retrato. O título do acampamento deixa de repetir o nome do personagem.

Conquistas preenche o tamanho da tela com a arte original da sala. Estante, retratos e chão usam o mesmo enquadramento da imagem de fundo. Os antigos painéis inferiores de navegação, personalização, identidade duplicada e avaliações foram removidos de todas as áreas. O perfil consulta novamente os dados ao ganhar foco, tornar-se visível e a cada trinta segundos.

A Ficha deixou de ser uma área do perfil. Ver ficha, no cartão de um personagem do Acampamento, abre a ficha pública daquele personagem em modal somente para leitura, com fechamento por Escape. O modal espera os dados do personagem correto antes de exibi-los. A edição continua nas páginas normais.

Cinco estrelas no canto inferior esquerdo avaliam o perfil inteiro. O visitante pode registrar e atualizar sua única avaliação; não pode avaliar o próprio perfil. Uma ou duas estrelas exigem justificativa também no servidor. A API pública fornece somente média, quantidade e a própria avaliação de quem consulta: não expõe autores ou justificativas de terceiros. Melhores perfis, no Hall da Fama, usa a avaliação geral e apresenta cada jogador uma vez. Os outros rankings continuam funcionando.

O botão Transferir entre inventários saiu do inventário. O texto do equipamento de animais foi ajustado para não apontar para esse botão.

Pistola laser, pistola semiautomática, revólver, rifle automático, rifle antimatéria e rifle laser foram retirados das ofertas e dos seletores da loja, inclusive versões mágicas. As linhas históricas continuam no catálogo, inativas; pedidos, itens já comprados e equipamentos são preservados. O rifle de caça continua disponível. A regra está centralizada em shared/shop-availability.ts e aplicada por seed idempotente, sem migration.

## Validação e publicação

- TypeScript e builds do cliente e servidor passaram no estágio limpo de publicação.
- Os 23 testes sociais e de persistência passaram em PostgreSQL descartável, incluindo ownership, justificativa obrigatória e anonimato.
- scripts/review-token-profile.ts, executado pelo wrapper scripts/test-token-profile-isolated.mjs, passou com Microsoft Edge real e banco UUID descartável. Cobriu perfil em 1898, 1440, 768, 390 e 320 px, fundo completo, navegação, troca de retrato, atualização automática, ficha modal, avaliações e Hall; inventário; clique e minimização dos tokens, condições, controles anteriores, mestre/jogador/espectador e limites de tela.
- As seis famílias foram verificadas em catálogo, seletores, compra e carrinho. Reseeding, replay de compra antiga, saldo, inventário e equipamento histórico foram conferidos.
- Release token-profile-v1-20261010 publicada e saudável. Servidor, 43 bundles, HTML sem cache persistente e 3496 mídias anteriores conferidos por hash.
- Comparação antes/depois: 112 tabelas completas idênticas. O catálogo mudou somente 150 flags active das seis famílias; outras dezoito variantes correspondentes já estavam inativas. A disponibilidade e o heartbeat do ilustrador permaneceram normais.
- A imagem anterior permanece em before-token-profile-v1-20261010. Alterações independentes da mesa e as 39 armaduras drow pendentes foram preservadas; somente o patch deste menu foi incorporado ao arquivo Vtt.tsx na publicação.
