# Perfil, mapa mundi e chifres — 20/10/2026

O perfil do viajante começa diretamente no fundo ilustrado. Foi removida a navegação isolada “Voltar ao personagem”, que reservava 98 px no computador e 94 px no celular. Os cartões de personagens continuam abrindo seus acampamentos e a personalização permanece acessível.

O atalho “Meu perfil” foi removido do cabeçalho do diretório Perfis. O acesso no menu da conta foi redesenhado com ícone, fundo escuro, borda de latão e estados de foco/hover, mantendo o destino do próprio perfil.

## Mapa mundi

O botão de efeitos fica imediatamente à direita do percentual de zoom. A escolha é local ao navegador, persiste ao recarregar e não muda a mesa ou a visão de outros jogadores. Desligar esconde nuvens, dragão, frota/kraken, tempestade e névoa cosmética; mantém o oceano estático e o mapa utilizável. Quando parado nesse modo, o renderer não agenda quadros contínuos. Zoom, arraste, teclado, centralização, marcadores e realce territorial continuam ativos.

A otimização mantém resolução, texturas, costa, relevo e normais originais. Apenas triângulos totalmente submersos abaixo de -0,12 deixam de ser enviados para desenho; a malha completa continua servindo à amostragem de altura. A camada de contornos desenha somente durante um realce. Matrizes dos grupos estáticos ficam prontas, e redimensionamentos desnecessários do canvas são evitados. Essa alteração específica do Mundo foi solicitada depois da reversão da otimização geral.

O terreno passou de 1.036.800 para 438.324 triângulos enviados, redução de 57,7%, preservando os 519.901 vértices originais usados para alturas/normais. Comparação do canvas estático antes/depois: diferença média de 0,0245 por canal na escala 0–255. Efeitos desligados: zero quadros contínuos em repouso; zoom, teclado, realce e retomada aprovados.

## Criação e atributos de magia

As fontes com atributo fixado pela regra da mesa exibem seu valor como informação. Iniciado em Magia usa Inteligência para Mago e Sabedoria para Clérigo/Druida nas novas origens. O valor continua validado no servidor. Escolhas autorizadas pelas regras vigentes de uma origem antiga ou espécie continuam selecionáveis durante a criação.

Changeling não recebe seletor de atributo de magia racial: Metamorfo não é magia de espécie nas regras cadastradas. A interface foi verificada ao alternar Changeling/Elfo/Changeling. Nenhum personagem existente foi regravado.

## Soma dos atributos rolados

Novos conjuntos de seis atributos devem somar de 72 a 90 inclusive, após descartar o menor dado de cada 4d6 e antes dos bônus do antecedente. `server/ability-rolls.ts` usa os mesmos d6 criptográficos anteriores e repete o conjunto inteiro quando a soma sai do intervalo. Não corrige nem aumenta dados individualmente. Somente o conjunto aceito é salvo pela transação com trava de autoria existente. Cliques repetidos/concorrentes devolvem os mesmos resultados persistidos; rolagens já existentes são preservadas.

A regra aparece em uma faixa vermelha dentro da janela 3D, acima dos dados, em cada um dos seis lançamentos. Por correção explícita do usuário, saiu do formulário de escolhas. Testes determinísticos cobrem soma abaixo/acima dos limites, aceitação de 72/90 e mil conjuntos reais. Onze testes de criação/ficha/API passaram, incluindo concorrência e persistência. O navegador confere texto vermelho, posição acima dos dados na janela, soma salva e sequência dos seis dados.

`SHEET_ROLL_RULE_ONLY=1 node scripts/test-sheet-isolated.mjs` verifica o fluxo real de criação, aviso vermelho em cada janela de lançamento, seis resultados, recarga, distribuição e persistência. O modo completo desse teste alcançou uma expectativa antiga de cor de fundo (23/27/30 versus tema aprovado 54/53/48); não foi alterado o fundo para satisfazer essa expectativa.

## Oito modelos de chifres

Carneiro, Alongados, Erguidos, Curtos, Sinuosos, Em gancho, Anelados e Abertos. As últimas quatro opções seguem os formatos dos quatro anexos enviados pelo usuário. As imagens de seleção são ilustrações originais de um manequim neutro; não reproduzem identidade, roupa ou assinatura das referências. A busca do Pinterest fornecida não ficou acessível e não foi usada como fonte de imagens copiadas.

Miniaturas WebP de 384 × 384 em `public/character-creation/`, total de 90.398 bytes. Prompts completos e ferramenta nativa registrados em `data/tiefling-horns-20261020.json` e `data/tiefling-horns-references-20261020.json`. A seleção usa radios com teclado, quatro colunas no computador e duas no celular.

A seleção é preservada em mudanças de classe/antecedente. Fichas antigas sem escolha continuam válidas. O ilustrador recebe o modelo escolhido e a revisão anatômica obrigatória do retrato/token rejeita bases incoerentes ou formato diferente. Defeitos reprovados não consomem a cota nem substituem a arte anterior.

## Validação

- TypeScript e builds do cliente/servidor.
- `node scripts/test-vtt-personal-isolated.mjs --art`: 15 testes de geração/revisão, equipamentos, companheiros, alfa e publicação atômica, com ilustrador simulado. Inclui rejeição de anatomia mesmo com aprovação geral verdadeira e envio real do arquivo de chifres como referência.
- `node --import tsx --test tests/tiefling-horns.test.ts tests/eberron-species.test.ts tests/character-creation.test.ts`: 14 testes de origem, legado, regras e persistência dos oito modelos.
- `node scripts/test-vtt-personal-isolated.mjs --browser`: sessão real em PostgreSQL UUID descartável; perfil em 1440/390, oito miniaturas/seleções, atributo fixo por fonte, VTT básico, missão/link/login e Mundo com efeitos, recarga, zoom, teclado, realce e celular.

O teste visual compara o canvas estático do Mundo antes/depois e registra a diferença média por canal, além de contagem de triângulos e quadros. Relatórios e capturas em `test-results/vtt-personal/`. Falhas legadas da suíte ampla estão descritas em `VTT-PESSOAL-20261020.md`.

## Publicação

Imagem incremental `alvorada-cinzenta-app:vtt-personal-20261020` sobre a versão `lore-initial-20261020`, mantendo a reversão da otimização geral, arquivos anteriores, volumes e o IP do Radmin. HTML, bundles e oito miniaturas verificados por SHA-256 nos dois endereços. Ilustrador local reiniciado somente após confirmar fila vazia; nova revisão anatômica ativa.

Na conferência das 146 tabelas houve atividade simultânea de jogador: finalização de ficha, avaliação nova de perfil, compras, equipamento e pedidos de arte. A comparação registra essas diferenças e o heartbeat do ilustrador, sem restaurar o banco por cima delas. A migration 118 já aplicada segue única; os demais ajustes não exigem migração.
