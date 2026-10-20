# Chat de RP e carregamento da House 2.0

- Chat fixo junto à esquerda, com largura compacta no desktop e adaptação ao celular. Botão renomeado para Chat de RP.
- Cartão do cenário junto à borda esquerda e ação Lobby de RP abaixo dele.
- Falas sobre pergaminho usam texto escuro e nome destacado; seletor específico impede que o tema global aplique texto claro ao balão.
- Limite de movimento segue o chão dos novos cenários: praia até y=0,18; mercado e praça até 0,28; pátio e jardim até 0,30. Demais cenários preservam 0,40. Escala em perspectiva e ponto agarrado permanecem consistentes. Servidor, objetos e constraint do banco aceitam o intervalo ampliado; migration 117 não altera posições ou mensagens existentes.
- House 2.0 abriu em sessão nova, tanto diretório como vizinhança. Um módulo de publicação anterior era respondido como HTML pelo fallback da aplicação. A publicação preserva os módulos anteriores; scripts/retain-client-assets.mjs fornece a rotina de preservação para próximas publicações. Falhas de importação dinâmica acionam uma única recarga automática, preservando a rota; bloqueio de repetição por um minuto evita ciclos.

Validação: navegador em 1440 e 390 pixels com envio de mensagem, cor computada, posições do chat/cartão/botão e arrasto para y menor que 0,4; House 2.0 sem erros de execução ao abrir diretório e vizinhança; recuperação de importação sem ciclo; teste de geometria do chão; migration validada em banco descartável com posições antigas preservadas e rejeição de valores fora do limite. TypeScript e build aprovados. Backup das tabelas de RP antes da publicação; nenhuma imagem foi alterada.
