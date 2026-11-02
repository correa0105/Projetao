# Economia e progressão

As missões pagam ouro ao personagem e Créditos do Bastião (CB) ao jogador. CB servem exclusivamente para House e guilda, sem conversão em ouro. O objetivo é uma progressão média a lenta, com compras relevantes exigindo poupança.

## Recompensas por missão

Cada célula indica **PO + CB**. Ouro é pago por personagem; CB são pagos uma vez por conta em cada missão, mesmo com dois personagens inscritos. Testes usam a patente de origem e a dificuldade. Os contadores de nível e os quatro testes de patente permanecem iguais.

| Patente | Tranquila | Moderada | Perigosa |
|---|---:|---:|---:|
| Ferro / Iniciante | 100 + 40 | 125 + 50 | 150 + 60 |
| Bronze / Intermediário | 250 + 60 | 300 + 75 | 350 + 90 |
| Adamantium / Profissional | 500 + 80 | 625 + 100 | 750 + 120 |
| Ametista / Mestre | 1.000 + 120 | 1.250 + 150 | 1.500 + 180 |
| Obsidiana / Heroico | 2.000 + 160 | 2.500 + 200 | 3.000 + 240 |

Missões abertas/em andamento recebem a tabela atual. Missões concluídas conservam os valores e pagamentos históricos, sem recompensa retroativa. A conclusão inteira é transacional e não repete créditos em reenvios.

No lançamento oficial, personagens novos começarão com **250 PO**. A concessão de teste de 6.000 PO permanece ativa até esse lançamento; saldos já salvos não são reduzidos.

## Loja

| Raridade | Referência de permanente | Consumível na mesma faixa |
|---|---:|---:|
| Comum | 200 PO | 50 PO |
| Incomum | 1.000 PO | 250 PO |
| Raro | 8.000 PO | 2.000 PO |
| Muito raro | 50.000 PO | 12.500 PO |
| Lendário | 250.000 PO | 62.500 PO |

As referências são pisos por raridade. O catálogo mantém faixas relativas de valor a partir dos preços anteriores, em múltiplos de 0,5 até o máximo de quatro vezes a referência. Consumíveis usam ¼ da respectiva faixa. Equipamentos comuns sem raridade mágica conservam preços próprios. Artefatos e itens sem preço continuam indisponíveis até definição explícita.

A aplicação inicial registra o preço anterior e a alteração em `economy_price_history`. Depois, edições administrativas sobrevivem ao seed. O editor recusa lendários permanentes abaixo de 250.000 PO e consumíveis lendários abaixo de 62.500 PO. Não altera inventários nem preços históricos de compras.

O livro de regras recebe uma revisão única dos artigos de recompensas e moedas, conservando os demais artigos, imagens e anotações adicionais. O documento anterior permanece no histórico; reiniciar o servidor não repete essa revisão.

## House e guilda

- Móveis: 20, 40, 75, 120, 200 ou 300 CB conforme tamanho; peças luxuosas custam o dobro, limitadas a 800 CB. Carta: 15 CB; moldura: 60 CB.
- Revestimentos: 50–150 CB. Terreno: 600 CB. Casas: 500–1.100 CB em grupos de modelos.
- Fundação de guilda: 1.500 CB pessoais. Membros podem contribuir com CB ao tesouro; somente o fundador compra mobília e autoriza evoluções.
- Custos monetários de instalações, níveis 2–10: 300, 600, 1.000, 1.600, 2.400, 3.600, 5.200, 7.500 e 10.000 CB. A atualização troca somente requisitos monetários já existentes. Benefícios, níveis liberados, missões, tags e cristais continuam conforme configuração administrativa; níveis pendentes não são liberados automaticamente.
- Recompensas semanais da companhia agora alimentam o tesouro em CB; mantêm os objetivos e valores configurados. Valores antigos em ouro ficam preservados separadamente, sem conversão. Recompensas já recebidas não são concedidas de novo.

A carteira pessoal reutiliza `house2_accounts`; novas carteiras começam em zero. Saldos experimentais que já existiam são preservados. Todo novo movimento é auditado em `bastion_currency_ledger`. A guilda usa `bastion_treasury_cp`; o tesouro anterior em `treasury_cp` permanece registrado como ouro legado. Campos de configuração antigos `founding_po`/`gold_po` e campos de preço `price_cp` são mantidos para compatibilidade, com CB nas operações e na interface destas áreas. Tesouro e preços legados de House conservam centésimos no armazenamento; a carteira pessoal usa CB inteiros.

Clientes antigos precisam recarregar antes de gastar a nova moeda. O servidor valida sessão, titularidade, preço, saldo, revisão e repetição do pedido; nenhum preço ou recompensa enviado pelo navegador substitui a tabela do servidor.

Validação reproduzível: `node scripts/test-economy-isolated.mjs` em PostgreSQL local descartável; `--browser` verifica as telas após gerar o cliente. Evidências privadas ficam em `.local/economy-20261102`.
