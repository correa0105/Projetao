# Evolução do bastião da guilda

Cada instalação tem uma progressão própria de dez níveis. O nível 1 é a base e já oferece o benefício que o administrador cadastrar. Cada evolução passa a oferecer o benefício completo do novo nível, substituindo o anterior. Não somar todos os textos de benefícios como bônus cumulativos.

O proprietário ainda vai decidir os benefícios, valores e metas. Nenhum número de balanceamento foi criado como regra oficial. Níveis e tesouros existentes são preservados; um nível sem regras liberadas aguarda configuração e não pode ser comprado pelo custo genérico antigo. Instalações bloqueadas pelo nível da guilda continuam bloqueadas. Benefícios já configurados em níveis inferiores continuam vigentes para guildas que possuam níveis legados mais altos ainda sem definição.

## Configuração e uso

Clique na instalação da sede e use **Configurar objeto e evolução**, disponível apenas ao administrador global. O cadastro vale para aquela instalação em todas as guildas. Escolha cada nível, escreva o benefício e adicione os requisitos desejados. Libere os níveis em ordem, começando pelo benefício base. Níveis futuros podem permanecer em rascunho. Os níveis liberados exigem benefício preenchido; requisitos repetidos do mesmo tipo/tag/identificador são rejeitados.

Todos os requisitos de um nível devem ser cumpridos juntos. É possível combinar:

- Missões concluídas pela companhia: uma missão soma uma vez por guilda, mesmo com vários participantes.
- Tags de monstro: escolher uma tag do catálogo existente. Cada participante membro soma as tags recebidas na conclusão.
- Cristais da Torre: total conquistado pelos membros, incluindo recompensa base e bônus do tesouro.
- Ouro do tesouro: custo opcional por nível, debitado somente na evolução. O formulário usa PO e o servidor conserva PC inteiros.
- Outros critérios: nome, identificador estável e quantidade. O administrador confirma o progresso da guilda com justificativa e revisão concorrente.

**Missões, tags e cristais são metas acumuladas, sem consumo**, conforme decisão do proprietário. Cristais contam pelo que foi conquistado, independentemente do saldo atual da carteira. Não reduzir tags pessoais, conquistas ou cristais para evoluir uma instalação. Requisitos próprios também representam metas, sem gasto automático.

O progresso conta conquistas realizadas durante a participação na guilda. Os registros novos são duráveis: sair da guilda, remover personagem/missão ou gastar cristais não apaga o progresso já registrado. A migração recupera o histórico comprovável dos membros atuais a partir de sua data de entrada; não inventa filiações passadas que o banco não registrou.

A janela mostra benefício vigente, próximo benefício, requisitos com barras de progresso e benefícios dos dez níveis. Visitantes podem consultar a definição pública e os benefícios, mas não recebem os totais privados da companhia. Somente o fundador membro autoriza a evolução. O sistema registra o benefício vigente como regra da instalação; automações de combate, produção, descontos ou outras mecânicas específicas dependem dos benefícios que o proprietário ainda definirá.

## Persistência e validação

A migração aditiva `136_guild_bastion_progression.sql` acrescenta a progressão ao catálogo existente, créditos duráveis e progresso administrativo auditado. Não altera os níveis, tesouros, carteiras ou tags pessoais existentes. A conclusão da missão e as recompensas da Torre registram créditos na mesma transação do pagamento original, com referências únicas para impedir repetição.

A evolução bloqueia a guilda, confere nível e regras atuais no servidor, verifica todos os critérios, debita somente o custo explícito em ouro e registra ledger e fotografia dos requisitos/benefício. Reenvios não repetem débito ou evolução. Alterações administrativas usam revisão e auditoria, com permissão revalidada na transação.

Os testes de bastião cobrem configuração pendente, benefício base e evolução, critérios combinados, sigilo, revogação administrativa, revisão, créditos repetidos, saída de membro, rollback e evolução concorrente sem consumo. As regressões de sede e instalações cadastram regras explícitas em fixtures privadas de teste; nenhum desses benefícios ou preços de teste é levado ao seed real.
