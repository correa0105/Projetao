# Escolhas da ficha, acampamento e House 2.0 — 17/10/2026

O avanço de classe oferece a melhoria de atributos ou um talento elegível. A melhoria tem orçamento total de dois pontos, com limite 20; talentos usam seu próprio aumento e atributos permitidos, com limite 30 para dádivas épicas. A interface desabilita distribuições excedentes e o servidor revalida orçamento, nível, pré-requisitos, repetição e escolhas associadas. Não são aceitos aumentos livres em todos os atributos.

`shared/feats-2024.json` contém 76 definições do PHB 2024, com dados factuais e resumos originais. A proveniência e o hash da fonte estão em `data/feats-2024-provenance.json`. Para reproduzir, baixe a fonte indicada e execute `node scripts/build-feats-catalog.mjs caminho/feats.json`. As duas alternativas de conjuração de Paladino/Patrulheiro permanecem identificadas separadamente dos dez talentos de Estilo de Luta. Não importar versões de 2014 sobre as regras de 2024.

Recursos aparecem em Classe, Talento, Espécie e Antecedente. Os recursos de classe e talentos recebidos por melhoria mostram classe e nível de aquisição; valores atuais de reservas são distinguidos do nível em que o recurso foi recebido. Escolhas e histórico de multiclasse permanecem salvos por avanço. Guerreiro pode trocar um estilo por nível de Guerreiro, pela evolução ou pelo seletor da ficha, com validação transacional e replay idempotente. Ganhar nível em outra classe não libera nova troca. Trocas atualizam os estilos efetivos usados por CA e ataques.

PV atuais/temporários, dados de vida e salvaguardas contra morte ficam somente para leitura para jogadores comuns. O servidor protege esses campos e preserva seus valores quando o jogador salva anotações ou magias; administradores podem gerenciá-los. Descanso longo administrativo recupera PV, dados de vida e espaços e limpa sucessos/falhas. O recurso de Bruxo Celestial de nível 10 concede seus PV temporários no evento de descanso. PV temporários não acumulam e não são repostos por leitura/recarga da página. Fontes como Heroísmo, Falsa Vida, proteção do patrono e petiscos do Cozinheiro exigem os respectivos eventos; a disponibilidade de uma magia não cria uma reserva permanentemente renovável. Efeitos de combate e usos condicionais continuam sendo resolvidos na mesa quando não há evento automatizado.

Concessão administrativa de nível atualiza `progression_missions` ao mínimo de `MISSION_THRESHOLDS` do nível resultante, sem reduzir contadores maiores. Migration 106 corrige concessões anteriores registradas com `granted: true`. Não fabrica inscrições, conclusões, ouro, recompensas ou testes de patente. O histórico de avanço continua auditável e os testes de patente continuam seguindo as regras próprias.

Administradores têm quatro personagens; jogadores comuns mantêm dois. Consulta, reserva de vaga e publicação da arte usam o privilégio atual do banco, sob trava da conta, incluindo pedidos pendentes. O acampamento administrativo tem duas posições à frente e duas atrás, com giro por setas, seleção de figuras e vagas de criação. Montarias, pets e ações de ficha/títulos/arte são preservados. Movimento reduzido desliga a transição.

A ficha usa imagens do catálogo para itens iniciais reconhecidos e mostra os itens da loja realmente equipados, com a mesma arte do inventário. Nomes sem correspondência conservam o ícone de categoria. Identidade usa uma grade compacta responsiva com rótulos, história e anotações separados.

## House 2.0

Lamparinas, velas, candelabros, braseiros, fogões e lareiras têm perfis de luz vinculados ao catálogo. A coleção ganhou Velas em suporte e Fogueira de pedras, reutilizando artes existentes. Acender/Apagar luz pertence ao objeto, com revisão própria, ownership e estado persistente; salvar a decoração não sobrescreve o estado da luz. Objetos antigos começam apagados. O brilho ilumina a noite com transição radial, oscilação por tipo e chama discreta; paredes e portas usam os mesmos limites físicos dos tokens. Fontes internas ficam cobertas pelo telhado quando o interior não está visível. Movimento reduzido mantém iluminação estática.

Sons de acender/apagar reutilizam os arquivos do VTT. Fogueiras/lareiras/braseiros têm crepitação contínua; lamparinas têm ruído discreto. Volume considera distância e interior. Trocar de vizinhança, sair da House, ocultar a aba, apagar o item ou silenciar efeitos interrompe os loops. O painel comum de música/efeitos fica no cabeçalho da House 2.0 e conserva as preferências existentes.

A loja oferece 12 revestimentos: quatro telhados, três paredes e cinco pisos. O desbloqueio usa créditos de teste e pode ser reutilizado nas casas da conta. Compra tem confirmação, preço do servidor e idempotência; aplicar exige posse do terreno/casa, desbloqueio da categoria e revisão atual. É possível restaurar o original. Telhados usam artes ortográficas existentes; pisos e paredes usam texturas existentes recortadas na estrutura. Geometria, porta, posições de mobília/tokens e pinturas do pátio não mudam. Migration 107 adiciona estado de iluminação, revestimentos por terreno e a tabela de desbloqueios, sem remover dados anteriores.

## Verificação

- `node scripts/test-character-advancement-isolated.mjs`: regras, multiclasse, escolha/talento, estilo, recursos, capacidade, progressão e concorrência em PostgreSQL UUID descartável.
- `node scripts/test-house2-isolated.mjs`: compras, layout concorrente, iluminação, revestimentos e paredes/porta nas quatro rotações.
- `node scripts/test-character-advancement-isolated.mjs --browser --choices`: interface real do acampamento/ficha/House, quatro larguras, orçamento global, proveniência, recursos protegidos, luz/som e revestimentos.
- `node scripts/test-house2-isolated.mjs --browser`: regressão visual da vila, câmera, terrenos, pátios, pincel, impressão e mobília.
- `npm run build`: TypeScript, cliente e servidor.

Fontes: [Guerreiro 2024](https://www.dndbeyond.com/classes/2190879-fighter), [talentos das regras básicas 2024](https://www.dndbeyond.com/sources/dnd/br-2024/feats), [PV temporários](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game), [índice de talentos do 5etools](https://5e.tools/feats.html).

Publicação deve ser incremental a partir da imagem em uso, preservando todos os assets imutáveis e o stylesheet de acabamento do header. Backup PostgreSQL integral validado antes de migrations; auditoria compara linhas antigas desconsiderando apenas novas colunas, crédito administrativo esperado e heartbeat do ilustrador. Nunca executar testes no banco de jogadores.

Publicação local `choices-house2-lights-v1-20261017` saudável: 38 arquivos novos, 15.307 arquivos anteriores preservados por SHA-256, 137 tabelas anteriores auditadas e uma tabela nova. Duas migrations; um contador administrativo antigo corrigido exatamente ao mínimo esperado, sem mudar recompensas ou demais dados. Backup integral de 512.019.774 bytes decodificado com `pg_restore`. TypeScript/build, 94 testes da ficha/progressão e 17 da House, navegador real em quatro/cinco larguras, orçamento de atributos, artes reais equipadas, giro, oscilação ativa/movimento reduzido, controles de áudio, interrupção de loops e revestimentos aprovados.

Acabamento final `choices-house2-lights-v2-20261017`: Velas em suporte reutiliza a arte publicada do VTT. As 28 imagens/áudios usados pela iluminação e pelos revestimentos foram conferidos diretamente no site por conteúdo e SHA-256, evitando depender de arte local ainda não publicada. Atualização sem migrations ou mudanças de dados, aplicação saudável e 15.345 arquivos anteriores preservados, com novo build validado.
