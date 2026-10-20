# Interface, sede e relógio — 20/10/2026

## Alterações publicadas

- Criação de personagem: fundo carvão do painel de equipamentos e título no dourado da interface.
- Ficha: resumos com o carvão do inventário; blocos com o mesmo pergaminho escuro da mochila. Consulta de níveis 1–20 integrada ao painel Caminho do personagem, em um acionador compacto.
- Guildas: banner menor, um único acesso à própria companhia, explicações recolhidas e busca/filtros/ordenação agrupados.
- Equipamento inicial: 78 descrições das regras vinculadas a 66 imagens já existentes do Empório. O fallback é exclusivamente visual; não cria produtos, inventário ou concessões. Imagens retornadas pela API continuam prioritárias.
- Portas e venezianas: sprites individuais transparentes, vista superior, madeira quente e ferragens; folhas giram nas dobradiças e a entrada ocupa o vão entre os batentes. Arquivos em `public/guild/openings-20261020/`; procedência em `data/guild-openings-20261020.json`.
- Visibilidade: tolerância numérica nas extremidades dos segmentos impede raios de atravessar a junção entre parede e porta fechada. Quatro posições que reproduziam a fresta viraram regressões automatizadas.
- House 2.0: `worldClockRate = 4` aplicado no servidor e na interpolação do cliente. Um ciclo de 24 horas do jogo dura seis horas reais, inclusive fora da página; quatro ciclos por dia real. Mantidos sincronização, ajuste administrativo e revisão concorrente.

## Validação

TypeScript do checkout e da versão isolada; build de cliente e servidor; ficha e criação em 1440/390 px; seis equipamentos iniciais do exemplo com imagens carregadas; busca e filtros de guildas; sede real em 1440/390 px com menu, portas, visão, edição e persistência do brasão; quatro regressões de visão. Testes do relógio executados em banco temporário isolado, incluindo autenticação, permissão administrativa, concorrência e quatro ciclos.

Publicação incremental sobre `profile-footer-20261019`, com fontes preservadas em `.local/ui-refinement-20261020/source`. A conferência verificou 102 arquivos publicados e preservou os outros 17.187 arquivos. Não foram publicadas as alterações independentes de VTT, treinamento ou a expansão de assets ainda incompleta.

## Ícones e expansão de artes concluídos

Os 21 destinos dos submenus usam ilustrações individuais de pergaminho, cobre e couro. Torre, Salão das Cartas e Mascotes tiveram suas primeiras versões substituídas conforme a correção do usuário: torre esguia de pedra, cartas simples de fantasia e coleira com medalha de patinha. Os cinco menus foram conferidos em desktop e celular, incluindo imagens carregadas, navegação e Escape. Publicação incremental verificou os 21 hashes ao vivo.

A conferência dos registros locais recuperou mais peças do chat anterior do que constavam no manifesto parcial. O lote final tem **100 objetos novos de House 2.0**, com imagem e miniatura próprias; **20 tecidos, 20 bordas e 20 símbolos** adicionais para brasões, totalizando 40 opções em cada categoria; e **oito cenários completos de RP** com decoração pintada na imagem. Móveis anteriores, compras e brasões salvos mantêm seus IDs. A migration 116 remove apenas as sobreposições dos quatro lobbies públicos; salas privadas conservam sua decoração.

### Arquivos finais e prompts

- `public/navigation/illustrated-20261020/`: 21 ícones; prompts e hashes em `data/navigation-icons-20261020.json`.
- `public/house2/expansion-20261019/` e `public/house2/expansion-thumbs-20261019/`: 100 objetos e 100 miniaturas.
- `public/guild/crests-expansion-20261019/`: 60 peças de brasão.
- `public/rp-lobby/20261019-integrated/`: oito cenários.
- Prompts, fontes e hashes dos 168 assets acima em `data/asset-expansion-20261019-results.json`; plano em `data/asset-expansion-20261019.json`.

Todas as artes foram produzidas com `image_gen` embutido. O preparo preserva o alfa original e converte para WebP. Um aviso de margem no original de Engrenagens da forja foi inspecionado visualmente; a moldura está íntegra e o arquivo final recebeu margem transparente.

Validação final: hashes e arquivos dos 168 assets, transparência e 100 miniaturas; compras idempotentes de três peças novas; catálogo completo com 450 móveis à venda; fluxo real de House 2.0 em cinco larguras; RP com dois jogadores, quatro salas públicas sem sobreposições e oito cenários, convites, arraste e recuperação de falha ao salvar; editor de brasão em desktop/celular, 40 opções por categoria, preservação de brasões antigos e salvamento das três últimas opções novas. Testes de banco usam instâncias descartáveis. Fontes publicadas isoladas em `.local/asset-expansion-release-20261020/source`, sem incorporar os trabalhos independentes do checkout.

Publicação final saudável: 371 arquivos conferidos, outros 17.286 arquivos preservados e 168 imagens verificadas por hash via HTTP. Os quatro lobbies públicos receberam a migration 116. Backup PostgreSQL anterior em `.local/backups/before-assets-20261020.dump`; não houve necessidade de restauração.
