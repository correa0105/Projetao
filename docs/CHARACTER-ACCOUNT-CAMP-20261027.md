# Personagens, acampamento e administração — 27/10/2026

Quatro slots são uma concessão explícita por conta. Somente Pai do Cris e Crowley devem recebê-la nesta entrega; demais contas conservam dois, inclusive outros administradores. A concessão não altera função, escopos, cota de arte nem ouro. Crowley conserva administrador=0 e oito áreas administrativas.

O acampamento exibe dois personagens, escolhidos em **Personagens e slots** ou **Trocar personagem**. O botão fica ao lado do contador, com a mesma cor, transparência e borda arredondada. Escolher esquerda/direita substitui o ocupante; escolher alguém já exibido troca suas posições. **Retirar da tela** conserva personagem, ficha e pertences. A mesma disposição aparece no perfil público; os demais personagens continuam disponíveis para consulta da ficha. Posições vazias são persistentes. Revisão otimista e verificação de titularidade impedem alterações concorrentes ou personagens de terceiros.

O contador inclui criações ativas. O painel mostra também seu nome e estado no slot: Em preparação (fila/processamento) ou Criação salva (falha), com motivo e ações para tentar concluir ou abrir os salvos. Um slot com arte pendente deixa de parecer disponível. Arquivados e pedidos de troca de arte de personagens existentes não aparecem como novos ocupantes.

**Editar ficha · Admin**, na ficha própria e na ficha visitada, abre um seletor de personagens/jogadores. Apenas administrador global pode consultar e salvar esse editor. Permite nome, espécie, classe inicial, nível, atributos finais, ouro, missões, biografia, origem, características/aparência, ajustes de valores calculados, perícias, idiomas, proficiências, recursos, magias preparadas e notas. Campos vazios de ajuste usam o cálculo normal. O JSON avançado permite escolhas estruturadas de progressão. Redução de nível remove avanços posteriores, preservados no histórico administrativo. A aparência vale para a próxima arte, sem gerar imagens automaticamente; alterações visuais aguardam o término de uma arte pendente.

Cada edição exige a revisão atual e registra autor, motivo, antes e depois. Não muda dono, imagens, histórico de dados, inventário ou cota. Os tokens vinculados recebem apenas os recursos efetivamente alterados; posição, giro, imagem e alcunha local são conservados. Alterar somente notas conserva ajustes locais de PV/CA. Nível quatro amadurece o slot sem apagar os dados originais.

**Criações salvas** usa um pequeno ícone com contador no canto inferior esquerdo. A lista abre recolhida e permite **Remover da lista** por entrada ou remover todas as falhas. Arquivamento idempotente conserva jobs, referências privadas, dados do slot e histórico de cota; não permite remover jobs ativos, artes prontas ou criações alheias. Entradas removidas deixam de poder ser retomadas/repetidas.

A guilda usa sombra de contato pelo alfa da imagem, com desfoque e deslocamento proporcionais. Remove a elipse dura deslocada que fazia o personagem parecer flutuar. Imagens e posições não são alteradas.

## Dados e publicação

Migrations 133–135: capacidade/disposição e auditoria de concessão; ajustes/auditoria de ficha; arquivo dos rascunhos. Constraints dos três registros de slot passam a aceitar 1–4. Migrations não concedem slots nem reescrevem rolagens. Após validar e recarregar o ilustrador ocioso, conceder quatro aos dois IDs verificados e criar somente as duas linhas extras de cada conta, com comparação integral das linhas antigas. Protocolo VTT permanece 28.

Publicação incremental a partir de `vtt-harpoon-cut-rope-20261027`, backup integral antes de atualizar, preservação por hash dos arquivos anteriores e do estado de jogo. Na comparação de personagens, remover apenas a nova coluna vazia `sheet_overrides` da representação anterior/posterior. Nunca restaurar o banco sobre alterações legítimas.

## Validação

- Oito testes de conta/administração, incluindo quarto personagem real pelo pipeline de teste, quinto bloqueado, autorização, revisão, aparência, sincronização de tokens, dados preservados e arquivo idempotente.
- Seis testes de slots/veículos, seis de ficha/dados e três de escopos/espectador.
- Navegador real em 1440/768/390/320: limite de dois visíveis, substituição, retirada/persistência/perfil público, bloqueio padrão, editor de ficha alheia, remoção individual/em lote e acesso discreto. Sem erros de página ou transbordamento horizontal.
- Renderer real da guilda com token Nana, sombra pelo alfa e comparação com a antiga elipse. TypeScript e builds aprovados.

Evidências privadas: `test-results/character-account/` e `.local/character-account-*-20261027.log`. Fixtures usam banco descartável e artes locais, sem chamar o ilustrador real.

## Resultado publicado

Imagem `alvorada-cinzenta:character-account-camp-20261027`, fonte `d5057422dfc3daa234a4e3d468ca333e8b2dfdb4`, ativa em alvoradacinzenta.com. Conferidos 48 arquivos da entrega, 1.532 anteriores e 41 respostas HTTPS. Seis mesas, 37 assets privados, fichas/imagens/inventários/compras/jobs/armas/impactos íntegros por hash antes e depois da atualização. PNGs originais e 242 áudios preservados. Migration 135 e protocolo 28.

Concessões transacionais aplicadas somente a Pai do Cris (global1) e Crowley (global0/oito escopos): quatro slots cada. Comparadas integralmente as 26 linhas anteriores de rolagens, todas idênticas; quatro novas linhas vazias, total 30. Dois registros de capacidade, com auditoria própria. Nenhuma ficha, imagem, mochila, job ou permissão alterada durante a concessão. Ilustrador recarregado ocioso, PID 29948 → 37208 e heartbeat confirmado antes das concessões.

Atualizar com Ctrl+F5. Salvos ficam no pequeno ícone inferior esquerdo; disposição em Personagens e slots; edição global em Editar ficha · Admin.
