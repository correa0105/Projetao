# Recuperação do ilustrador após atualização do Codex

Em 24/10, a atualização do Codex às 16h35 retirou o executável da pasta versionada
anterior. O worker continuou vivo com `CODEX_BIN` herdado daquela versão. Os dois
pedidos seguintes falharam em `spawn`, antes de gerar imagens. A conexão com o
PostgreSQL continuava saudável, por isso o heartbeat anunciava disponibilidade.
Referências, escolhas e cota foram preservadas.

`server/codex-command.ts` resolve o programa a cada execução. Mantém um override
existente, procura a entrada npm/PATH e, no Windows, encontra um executável real
na instalação atual do aplicativo. Pastas antigas sem executável são ignoradas;
uma variável apontando para a versão removida não bloqueia a recuperação.

O heartbeat do worker agora verifica também `codex login status` pela mesma
resolução antes de anunciar disponibilidade. Verificações não se sobrepõem.
Enquanto indisponível, a fila permanece aguardando, sem consumir pedidos.
Credenciais continuam locais; nenhum token ou transcript é registrado.

Onze testes de resolução/login, equipamentos, montagem de Warforged e pares de
artes de companheiros passaram, além de TypeScript e build do servidor. Um assert
de texto anterior à personalização física foi alinhado à redação já vigente do
prompt, sem alterar esse prompt. Uma verificação real com o override removido
encontrou o Codex atual e confirmou o login ChatGPT.

Com ambas as filas ociosas, o supervisor reiniciou o worker de 38304 para 41732.
Os dois pedidos originais com erro de inicialização foram recuperados numa
transação com trava por conta e validação de status, referência, ficha e limite
de personagens. Sem novos jobs, mudanças de escolhas, reembolsos artificiais ou
alterações de histórico/cotas. Auditoria privada em `.local/`.

Aplicação feita no worker local; servidor web e banco não precisam de novo
deploy ou migration. O ilustrador continua dependendo deste computador e da
sessão ChatGPT, com a recuperação automática já existente.
