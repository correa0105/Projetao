# Armaduras mágicas vestidas e contorno do Anfitrião

As peças secundárias herdavam a imagem do conjunto, mas não seus dados de encantamento na fila do ilustrador. Por isso, uma composição com aparência de armadura mundana podia ser aprovada. O snapshot de Vestir agora consulta os metadados do conjunto e registra o acabamento mágico junto de cada peça selecionada. O personagem pode usar apenas uma peça mágica ou misturar peças comuns e mágicas; o efeito fica restrito às peças mágicas expostas.

O desenho obrigatório varia conforme família, bônus e resistência elemental. Couro, tecido, malha e placas mantêm material, corte e construção da referência. A geração inicial, a correção e a revisão exigem encantamento visível na escala do personagem, respeitando oclusão natural, transparência e acessórios mundanos. A geração e a revisão do token preservam o mesmo acabamento. São instruções cosméticas; regras e bônus de combate não mudam.

Imagens já concluídas não são alteradas automaticamente. Para refazer uma composição anterior, o usuário deve selecionar o equipamento e usar **Vestir** novamente; cotas existentes permanecem vigentes. A fila usa referências e nomes persistidos no pedido, sem migração de dados de jogadores.

O contorno do Anfitrião foi redesenhado com curvas suaves e trechos separados onde a cadeira encobre o corpo. O alvo de clique fica independente da linha visível. O destaque fino e dourado aparece ao passar o mouse, focar pelo teclado ou abrir a conversa, com transição desativada para quem prefere movimento reduzido. NPC e cenário permanecem intactos.

Validação: compilação TypeScript, cliente Vite e servidor; 14 testes em PostgreSQL descartável, incluindo 431 conjuntos, 27 famílias, 13 modelos e seis posições, composição mista, ownership, snapshot da fila, reprovação/correção de magia ausente e preservação no token. O CLI de imagem é simulado nos testes de prompt/revisão; eles verificam o fluxo sem consumir gerações reais. Smoke no Edge confere conversa por clique e teclado em cinco larguras e perfil de cartas em quatro.

Publicação usa build isolado e camada sobre a imagem anterior, preservando mídia e compatibilidade já publicada do moinho. Trabalhos pausados do VTT não entram no release. O ilustrador é atualizado somente entre pedidos, sem interromper gerações.
