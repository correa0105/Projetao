# Recuperação de criação — 18/10/2026

Uma falha na revisão do token de VTT impedia a publicação do personagem inteiro. O pedido já conservava o JSON com nome, história e ficha, mas limpava a referência de imagem e a interface escondia a criação depois de um aviso temporário.

Correção: pedidos de criação que falham mantêm referência e dados no PostgreSQL. A migration 109 acrescenta `approved_portrait` como checkpoint privado: o trabalhador salva a arte principal aprovada antes de gerar o token e a reaproveita ao tentar novamente. Conclusão continua atômica com ambas as artes aprovadas; não publicar token reprovado. Depois do sucesso, referência e checkpoint temporários são limpos. Interrupção do trabalhador também preserva os dados da criação.

O acampamento mantém a criação que falhou visível, com Tentar novamente e Retomar preenchimento. A retomada carrega nome, história, espécie, classe, antecedente, todas as escolhas e referência; reenvia o mesmo pedido, sem duplicar personagem ou consumo de cota. Edição das escolhas invalida a arte em cache para evitar usar uma aparência antiga. Pedidos antigos sem referência ainda permitem restaurar o texto e a ficha e reenviar somente a imagem.

Rotas `GET /api/character-art/:id/draft` e `POST /api/character-art/:id/retry` filtram pelo proprietário. Retry serializa pela conta e pedido, respeita o limite de dois personagens e a disponibilidade do ilustrador. Chamadas repetidas não duplicam o pedido.

## Retomada automática

Falhas técnicas, de geração ou de revisão devolvem o mesmo pedido à fila automaticamente, sem limite de tentativas. A migration 137 conserva contador, motivo e horário da próxima tentativa no PostgreSQL. O intervalo cresce de 15 segundos até cinco minutos; limite do provedor aguarda uma hora. Novos pedidos e companheiros continuam sendo atendidos durante esses intervalos. Erros que exigem corrigir os dados ou uma referência recusada permanecem salvos para edição.

Interrupção do processo também retoma o pedido após obter a trava exclusiva do ilustrador. Referência, equipamentos, ficha, slot e retrato aprovado permanecem preservados, inclusive em substituições. Não reativar em lote rascunhos antigos, arquivados ou superados. A interface informa que a continuação é automática. Publicação continua exigindo o par aprovado; nova tentativa não cria outro pedido, não concede ouro novamente nem acrescenta consumo à geração original.

Validação em banco descartável cobre cinco falhas consecutivas, intervalo e concorrência, atendimento de outro pedido, reinício repetido, preservação dos checkpoints, publicação idempotente e substituição privada. A retomada manual continua disponível para os casos que exigem correção, com ownership e dados atuais dos slots.

Validação: seis testes de API/ownership, retomada concorrente, conteúdo preservado, finalização atômica e gerador de duas artes; QA no navegador com recarga, restauração literal da história e ficha, imagem preservada e retry no mesmo pedido, em 1440 e 390 px. Fixture do teste de VTT passou a usar a constante vigente do protocolo em vez do valor antigo 7.

Artorias foi recuperado do pedido original e da sessão exata da arte aprovada, preservando os 506 caracteres da história e as escolhas por comparação integral. Retrato e token estão privados no banco; cópia de recuperação e registro ficam em `.local/recovery-artorias-20261018`, fora do Git e dos arquivos públicos.

O token recuperado foi gerado com ImageGen integrado a partir do retrato original e da referência de câmera. Prompt: mesmo Warforged de raízes avermelhadas e placas de ferro, camisa branca rasgada e calça cinza, mãos vazias, vista vertical de cima a 90 graus, cabeça orientada para baixo, sem armas, chão ou moldura, alfa transparente e margem de 8%. Conferidos câmera, anatomia, identidade e transparência antes da publicação pelo finalizador transacional existente.

Correção posterior: os painéis de falhas antigas não podem participar do fluxo flexível do acampamento, pois comprimiam o cenário e sobrepunham a identificação dos personagens. Agora aparecem exclusivamente em um modal aberto pelo botão Criações salvas, sem excluir os rascunhos. QA com dois personagens e seis falhas, em 1868, 1440, 768 e 390 px, incluindo reabertura da ficha salva e retry. Publicação somente do cliente; servidor e dados preservados.
