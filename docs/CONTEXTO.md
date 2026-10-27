# Contexto atual — Alvorada Cinzenta

Resumo consolidado em 27/10/2026. As regras permanentes estão em [AGENTS.md](../AGENTS.md). Leia apenas a área da tarefa; a cronologia não é pré-requisito para trabalhar. Pedido novo do usuário e regras vigentes prevalecem sobre instruções antigas dos guias.

## Estado de continuidade

- Produção: https://alvoradacinzenta.com/. Código em `Welson`, publicação incremental pela Hostinger. Última entrega de aplicação: `character-account-camp-20261027`, fonte `d5057422`; migrations até 135, protocolo VTT 28. Isso é referência da consolidação, não substitui verificar a versão real quando necessário.
- Entregues: quatro slots somente para Pai do Cris/Crowley; dois personagens exibidos com troca/reserva; administração global de fichas/características; salvos discretos com remoção; sombra de contato na guilda. Arpão já permite cortar a corda para recarregar, conservando a ponta no alvo.
- Não reaplicar correções pontuais já concluídas em OBruxo, Ken Kaneki, saldos ou casas do nana. São fatos históricos, não tarefas pendentes. Dados/arte atuais devem ser preservados.
- Pausado: refazer 330 monstros com quatro versões. Protótipo/checkpoint privado preservado e fora de releases. Expansão completa dos itens mágicos e regras de níveis altos ainda não equivale a implementação integral de D&D; não retomar sem relação com o pedido atual.

## Onde procurar

| Área afetada | Guia principal / complemento |
| --- | --- |
| Ambiente, comandos, estrutura e backup | [README](../README.md), [ARQUITETURA](ARQUITETURA.md), [HOSTINGER](HOSTINGER-20261021.md) |
| Identidade e carregamento | [IDENTIDADE](IDENTIDADE.md), [ASSET-LOADING](ASSET-LOADING-20261021.md) |
| Permissões globais e por área | [CONTENT-ADMIN-SCOPES](CONTENT-ADMIN-SCOPES-20261026.md), [CHARACTER-ACCOUNT-CAMP](CHARACTER-ACCOUNT-CAMP-20261027.md) |
| Fichas, slots, equipamentos iniciais | [CHARACTER-ACCOUNT-CAMP](CHARACTER-ACCOUNT-CAMP-20261027.md), [VTT-VEHICLES-SLOT-DICE](VTT-VEHICLES-SLOT-DICE-20261026.md), [APPEARANCE-SIEGE-REFINEMENTS](APPEARANCE-SIEGE-REFINEMENTS-20261027.md) |
| Aparência e ilustrador | [CHARACTER-STYLE](CHARACTER-STYLE-20261026.md), [CHARACTER-PAIR-PUBLICATION](CHARACTER-PAIR-PUBLICATION-20261026.md), [WARFORGED-APPEARANCE](WARFORGED-APPEARANCE-20261021.md) |
| VTT: acesso, combate e sessão | [VTT-PERFIS-HALL](VTT-PERFIS-HALL.md), [VTT-ROLAGENS](VTT-ROLAGENS.md), [VTT-SPECTATOR-AND-SHAKE](VTT-SPECTATOR-AND-SHAKE-20261026.md) |
| VTT: sons, vozes e efeitos de tela | [VTT-IMMERSIVE-AUDIO](VTT-IMMERSIVE-AUDIO-20261026.md), [VTT-SOUNDS](VTT-SOUNDS.md) |
| VTT: veículos, vínculos e oceano | [VTT-NAVAL-OCEAN](VTT-NAVAL-OCEAN-20261026.md), [VTT-RIGGING-LINK-CONTROLS](VTT-RIGGING-LINK-CONTROLS-20261026.md) |
| Canhão, arpão, recarga e impactos | [VTT-SIEGE](VTT-SIEGE-20261026.md), [VTT-SIEGE-IMPACTS](VTT-SIEGE-IMPACTS-20261026.md), [VTT-SIEGE-CUT-ROPE](VTT-SIEGE-CUT-ROPE-20261027.md) |
| Efeitos de tokens e biblioteca | [VTT-EFFECTS-QUALITY](VTT-EFFECTS-QUALITY.md), [VTT-ACERVO-PREMIUM](VTT-ACERVO-PREMIUM.md), [PENDENCIAS-VTT](PENDENCIAS-VTT-20261008.md) |
| Loja, inventário e equipamento | [EQUIPMENT](EQUIPMENT.md), [SHOP-ITEM-RULES](SHOP-ITEM-RULES.md), [SHOP-MAGIC-COMPLETION](SHOP-MAGIC-COMPLETION-20261009.md) |
| Mascotes/montarias e suas artes | [COMPANION-EQUIPMENT](COMPANION-EQUIPMENT.md), [ANIMAL-ARMOR-MAGIC-SKINS](ANIMAL-ARMOR-MAGIC-SKINS.md) |
| Mundo, reino e pins | [KINGDOM-2D](KINGDOM-2D.md), [WORLD-PINS](WORLD-PINS-20261021.md), [ATLAS-3D-MATERIALS](ATLAS-3D-MATERIALS.md) |
| Missões, patentes e regras | [PATENTES](PATENTES.md), [ROADMAP-REGRAS](ROADMAP-REGRAS.md) |
| House e perspectiva da mobília | [HOUSE](HOUSE.md), [HOUSE-ART-DIRECTION](HOUSE-ART-DIRECTION.md) |
| Torre | [TORRE-EXPERIMENTAL](TORRE-EXPERIMENTAL.md) |
| Comunidade, conquistas e calendário | [SALAO-CONQUISTAS](SALAO-CONQUISTAS.md), [CALENDARIO-MASCOTES](CALENDARIO-MASCOTES.md), [PROFILE-VISIT-SIGNPOST](PROFILE-VISIT-SIGNPOST.md) |

Use `rg` se o assunto for mais específico. Não abrir todos os guias da tabela.

## Detalhes vigentes que evitam regressões

**Arte e criação.** Altura, porte, idade e gênero são escolhas exigidas nas novas criações; fichas legadas sem essas chaves continuam válidas. Idade inclui Ancião. Postura pode ser ereta/levemente curvada/curvada; bengala é independente e conjuradores elegíveis podem escolher cajado de madeira, sem receber item ou bônus. Roupas têm quatro modelos por peça, cores com prévia e faixa opcional. Barba/bigode/cor/grisalho e chifres são respeitados na arte/token. Warforged tem sete estruturas, incluindo Corpulento, e seis cabeças; referência e montagem continuam exclusivas. Token curvado precisa de encurtamento/oclusão reais, sem figura frontal deitada. Corpo, orelhas, chifres, mãos, equipamento e roupa exigem revisão. Preservar arte antiga até aprovação e escolha do dono; falhas mantêm checkpoints privados recuperáveis.

**VTT.** Mestre autorizado controla cena e recursos; contas com escopo VTT administram também mesas alheias sem trocar propriedade. Servidor filtra fichas/notas/assets ocultos antes de responder. Movimento respeita barreiras independentemente de efeitos visuais; edição de barreiras fica na camada própria. Dados/resultados vêm do servidor; dano e consumíveis usam ação explícita e auditoria. Sangue cria pequenos respingos no impacto, sem novos rastros no movimento; morte conserva o token e a escolha da mesa. Atalhos trancados exigem destrancar para editar. Manter IDs e compatibilidade dos documentos antigos sem resetar escolhas salvas.

**Som, tela e voz.** Biblioteca com busca, categorias, descrição/representação, favoritos/removidos, repetição e intervalo compartilhado; preservar uploads e music legado. Créditos acessíveis em Configurações e ajuda. Dez vozes de monstros são ouvidas dentro do VTT; Espectro e Aberração já refinados. Efeitos de tela são somente Desabamento e Cinzas e brasas, com áudio/mute/intensidade/duração; tremor não cria barras de rolagem. Efeitos cosméticos não mudam ficha.

**Veículos e cerco.** Compras habilitam os veículos em Fichas ao lado de personagens/animais, em vista superior e escala própria. Cobertura fica translúcida sobre personagens visíveis; casco/piso continua. Mastros vistos em zênite, velas infláveis com escotas presas e pontas baixas; vento e remos possuem animações independentes. Oceano pode animar ou pausar, respeita terra pintada e oferece mar/vento com volume/mute. Cache, recorte da viewport e pausa em aba oculta preservam desempenho. Canhão 8d10/arpão 3d10, carregar/mirar/disparar por ações e munição do servidor; mira angular com X e operador opcional para mestre. Impactos persistem fora da água até remoção do mestre; corda acompanha arma/alvo e respeita sigilo. Corda presa bloqueia novo tiro até cortar; corte conserva o projétil.

**Loja e companheiros.** Preços administrativos sobrevivem ao seed; variantes/famílias conservam IDs reais, regras e edição da fonte. Efeitos descritivos não viram automação implicitamente. Compra exige nome pessoal de animal, sem fallback automático. Animais não equipam itens humanos; montaria usa barda inteira, mascotes/humanoides usam conjuntos reais de seis peças quando definidos no catálogo. Exclusão confirma quantidade, não devolve ouro nem apaga compra/reserva. Ouro ilimitado só pelo administrador global atual.

**House, perfis e comunidade.** House conserva bens, layouts, presentes, convites e privacidade. Vistas reais dos móveis não são substituídas por espelho/rotação plana; distorção de quatro quinas limitada a ±12%, camadas 1–6 e sombras de contato por sala. Campo visual segue o piso, quadros ficam na parede; não alterar layouts antigos automaticamente. Acampamento público usa cenário da fogueira, sem aplicar o fundo personalizado do viajante. Montarias/mascotes seguem escala/clipPath próprios e arte atual. Conquistas mantém estante original; títulos dentro de Conquistas; cartas têm três espaços sem inventar upgrades/drops. Calendário fica ao final de Início → Diário. Torre mantém encontros privados até conquista e recompensas idempotentes, sem criaturas inventadas.

**Mundo e missões.** Mundo preserva relevo, silhueta, fronteiras e navegação 3D; árvores visíveis distribuídas naturalmente, sem miniaglomerados repetidos ou contornos brancos no mar. Fulkushima/ilhotas removidas da cena continuam nos registros históricos. Reino do Norte é o território explorável, mapa publicado fixo com pan limitado; editor antigo e botões não voltam, mas seus dados privados permanecem. Remover pin só retira marcador, preservando local/História/missões/mesas. Missões têm data/hora e patente exata; valores fixos do servidor: Ferro 150, Bronze 230, Adamantium 300, Ametista 390 e Obsidiana 500 PO por inscrito. Testes de patente exigem nível/missões 4/22, 8/53, 12/80, 16/102; sem promover automaticamente ou contar teste como missão comum.

## Histórico preservado

Textos integrais anteriores à consolidação, sem alteração de conteúdo:

- [Regras e diário antigo](history/20261027-before-summary/project-instructions.md)
- [Contexto e cronologia antiga](history/20261027-before-summary/project-context.md)
- [README anterior](history/20261027-before-summary/project-readme.md)

Esses arquivos são memória histórica e podem conter regras substituídas. Consultar só para uma dúvida histórica concreta. A consolidação alterou documentação, sem mudar aplicação, banco, contas, cotas ou dados de jogadores.
