# Patentes e progressão por missões

Regra própria da Alvorada Cinzenta, definida pelo usuário em 28/09/2026. Não é a tabela de XP do SRD.

| Nível | Patente | Total de missões válidas |
|---|---|---|
| 1 | Ferro | 0 |
| 2 | Ferro | 2 |
| 3 | Ferro | 6 |
| 4 | Ferro | 14 |
| 5 | Bronze | 22 |
| 6 | Bronze | 30 |
| 7 | Bronze | 38 |
| 8 | Bronze | 46 |
| 9 | Adamantium | 53 |
| 10 | Adamantium | 60 |
| 11 | Adamantium | 67 |
| 12 | Adamantium | 74 |
| 13 | Ametista | 80 |
| 14 | Ametista | 86 |
| 15 | Ametista | 92 |
| 16 | Ametista | 98 |
| 17 | Obsidiana | 102 |
| 18 | Obsidiana | 106 |
| 19 | Obsidiana | 110 |
| 20 | Obsidiana | 114 |

## Esclarecimento do usuário: quando libera o teste

**14 missões deixam o personagem no nível 4, mas NÃO liberam o teste.** Ele continua
contando missões normais até 22. Com 22 permanece no nível 4, torna-se apto ao teste
Ferro → Bronze e para de acumular progresso em missões normais. Ao concluir o teste,
sobe ao nível 5 com as mesmas 22 missões válidas. Depois precisa de mais 8 para chegar ao nível 6.

O mesmo se aplica a nível 8/53 missões, nível 12/80 e nível 16/102.
Não antecipar a elegibilidade ao simples ingresso nos níveis 4, 8, 12 e 16.
O teste promove, sem acrescentar uma missão ao contador de progressão; a participação
continua registrada no histórico real de missões concluídas.

No bloqueio, missões normais dão somente o ouro previsto, sem nível, XP ou crédito
acumulável para depois. No nível 20 a contagem fica limitada a 114. Não há teste posterior.
As conquistas que consultam o histórico real continuam contando participações concluídas;
esse histórico não é o contador limitado usado para evolução.

## Implementação

### Missões exclusivas por patente e ouro fixo

Toda missão tem uma patente, selecionada no formulário. Somente personagens da
**mesma patente** podem se inscrever, sem acesso a patentes inferiores ou superiores.
O servidor revalida a patente ao concluir: uma promoção ocorrida em outra missão
pode impedir a conclusão conjunta até resolver a participação incompatível.

| Patente | PO por participante |
|---|---|
| Ferro | 150 |
| Bronze | 230 |
| Adamantium | 300 |
| Ametista | 390 |
| Obsidiana | 500 |

O formulário preenche o ouro automaticamente, sem edição. Servidor calcula criação
e pagamento pela tabela, nunca pelo valor enviado pelo navegador. Teste de patente
pertence à patente de **origem** (Ferro → Bronze exige Ferro e paga 150 PO), além
dos requisitos de nível/missões já definidos. Eventos e ganchos não usam essa restrição.

Migration 030 atribui Ferro às missões legadas sem teste, e a patente de origem aos
testes. Atualiza ouro de missões abertas/em andamento; pagamentos e valores de missões
concluídas/encerradas são preservados. Não remove inscrições antigas; incompatibilidades
são rejeitadas na conclusão, sem pagamento parcial. API assume Ferro para clientes
antigos que omitam a patente; valores desconhecidos são rejeitados.

- `shared/progression.ts`: tabela, patentes derivadas do nível, elegibilidade e cálculo.
- Migration `029_rank_progression.sql`: `characters.progression_missions`,
  `board_posts.rank_test_level` (4/8/12/16 ou nulo) e auditoria em `mission_rewards`.
- Testes são missões no mesmo mural, com categoria e patente de destino no formulário.
  São publicados pelos mesmos autores habilitados a publicar missões.
- Inscrição valida titularidade e elegibilidade no servidor. Conclusão só pelo autor,
  com missão em andamento; revalida elegibilidade sob bloqueio dos personagens.
  Se alguém já tiver sido promovido por outro teste, retorna conflito sem crédito parcial.
- Cada inscrito recebe o valor fixo em cobre da patente da missão, uma vez.
  O servidor calcula pela tabela; ignora ouro, nível e XP enviados na conclusão.
  Crédito monetário, progresso, histórico, encerramento e gancho opcional são uma transação.
- Novas conclusões não dão XP. O campo legado é preservado para consulta histórica.
- Migração aproveita `mission_rewards` históricos até o primeiro teste ainda não realizado;
  preserva níveis/patentes já existentes e não concede testes retroativos. Não paga ouro retroativo.
  Registros antigos têm `progression_credit=NULL`, distinguindo-os do novo cálculo.
- Ficha, acampamento e seletor exibem patente; a ficha informa contagem e disponibilidade do teste.

## Limite da ficha

Esta entrega implementa nível/patente, contagem e recompensas. **Não implementa a evolução
completa das classes de D&D até 20** (PV por nível, talentos, subclasses, recursos,
magias superiores e multiclasse). O bônus de proficiência derivado já acompanha o nível,
mas os demais recursos seguem a cobertura descrita em `ROADMAP-REGRAS.md`.

## Verificação

Testes da tabela inteira até 114, bloqueio e quatro promoções; API em PostgreSQL descartável
cobre ownership, elegibilidade, concorrência entre missões/testes, idempotência, ouro,
tentativas de enviar nível/XP/recompensa e rollback por limite de saldo.
