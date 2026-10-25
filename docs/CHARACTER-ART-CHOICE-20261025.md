# Escolher entre imagem antiga e nova

Pedidos novos de **Nova imagem** e **Vestir**, quando já existe um retrato, passam
a preservar a arte atual até o proprietário decidir. Retrato e token novos só
ficam disponíveis para comparação depois da revisão e normalização existentes.
O acampamento, perfil, inventário e VTT continuam usando o par atual nesse período.

Nas páginas Personagens e Inventário, a comparação abre quando a geração termina:
imagens atual/nova lado a lado, com seus tokens. **Manter imagem antiga** conserva
ambas as artes e a revisão; **Usar imagem nova** aplica o par e atualiza os tokens
gerenciados no VTT; **Decidir depois** fecha a janela e deixa um botão para voltar.
Recarregar mantém a pendência. A comparação não interrompe outro diálogo aberto;
uma decisão em outra aba encerra a comparação e permite mostrar a próxima.

Migration 126 acrescenta ao job a revisão da arte que seria substituída, o par
proposto e os metadados da decisão. Campos anteriores e status da fila conservam
seu contrato. Primeiro retrato de criação e jobs antigos seguem a entrega
existente; pedidos novos com imagem anterior capturam `replacement_revision`.
O finalizador guarda o par proposto e conclui a geração sem editar a arte ativa.
Um checkpoint parcial de substituição também permanece privado.

Somente o dono, com personagem ativo, pode ver a proposta ou decidir. PNGs
propostos usam private/no-store/Vary Cookie e nunca entram no catálogo público.
Aceitar exige a mesma revisão capturada na fila, protegendo uma arte alterada
em outra operação. Conta/job/ficha são serializados; repetição da mesma escolha é
idempotente e escolhas concorrentes opostas têm um único vencedor. Nenhum upload
ou imagem arbitrária pode ser publicado pelo endpoint de decisão.

Aceitação usa o mesmo publicador de retrato/token, preservando a BASE montada do
Warforged, posições e tamanhos de tokens e uploads personalizados. Ao resolver,
os bytes propostos são liberados e a decisão fica registrada. Excluir a ficha
também limpa a proposta. Uma pendência bloqueia nova geração dessa ficha até ser
resolvida. A geração concluída conta uma vez na cota, mesmo mantendo a antiga;
a primeira criação continua gratuita e falhas continuam devolvendo a reserva.
Nenhum saldo, equipamento, regra de criação ou limite mensal muda.

Validação em bancos locais UUID descartáveis: suíte de tokens/equipamento com
10 testes, suíte de aparência/Warforged/retomada com 13 testes; todas aprovadas.
Cobrem privacidade, manter/aceitar, checkpoint, idempotência, concorrência,
revisão alterada, exclusão, tokens personalizados, cota e BASE preservadas.
Edge real em 1440/768/390/320 px aprovou comparação automática, escolha dos dois
lados, fechar/reabrir/recarregar, Inventário e decisão em outra aba. QA pode usar
retratos locais via `CHARACTER_ART_CHOICE_QA_DIRECTORY`; fallback portátil usa
fixtures. Nenhuma geração paga ou conta de teste em produção. TypeScript e builds
cliente/servidor aprovados.

Publicação: em preparação. Recarregar ilustrador somente com filas ociosas;
aceitar jobs legados sem a nova coluna antes da migration é compatível.
