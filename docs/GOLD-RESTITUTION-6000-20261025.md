# Restituição pontual até 6.000 PO — 25/10/2026

O proprietário solicitou restituição para todas as contas e esclareceu a regra:
**completar os saldos abaixo de 6.000 PO até esse valor**. Não somar 6.000 PO a
cada saldo nem reduzir saldos maiores. O ouro pertence ao personagem.

Todas as 12 contas foram consideradas. Na transação havia oito personagens
ativos em cinco contas: **cinco personagens de quatro contas** receberam a
diferença exata até **600.000 PC = 6.000 PO**, totalizando **889.500 PC = 8.895 PO**
restituídos. Os outros três personagens ativos já tinham pelo menos 6.000 PO e
ficaram iguais. Sete contas não tinham ficha ativa; não foi criada carteira ou
ficha para elas. Novas criações continuam recebendo os 6.000 PO iniciais normais.

Backup completo antes da aplicação e snapshots privados das linhas efetivamente
bloqueadas. Transação com trava de manutenção, contas bloqueadas antes das
fichas, saldo anterior/dono/estado ativo conferidos em cada UPDATE. Comparação
integral de todas as linhas comprovou que apenas `gold_cp` das cinco fichas
elegíveis mudou. Excluídos, demais escolhas, riqueza inicial já concedida,
inventário, compras, recursos, regras, artes e cotas preservados.

Operação única `gold-floor-6000-20261025`, protegida por diretório/resultado
exclusivos no host; não repetir após gastos futuros. Nenhum piso permanente foi
adicionado ao site. Não houve migration, seed, endpoint nem alteração de versão
para este ajuste. Manutenção e validação local em `.local/gold-floor-6000-20261025`.

Validação em PostgreSQL local UUID descartável: valor exato em PC, contas com
várias fichas, saldo zero, limite inteiro, saldos maiores e excluídos, repetição
sem soma e falha do snapshot sem alterações passaram. Produção recebeu apenas
a restituição solicitada, com confirmação transacional do resultado.

Backups privados com permissão 600:

- `/opt/alvorada/backups/gold-floor-6000-before-20261025.dump`
- `/opt/alvorada/backups/gold-floor-6000-before-20261025.json`
- `/opt/alvorada/backups/gold-floor-6000-after-20261025.json`

Resultado da operação guardado em
`/opt/alvorada/releases/gold-floor-6000-20261025/result.json`.
