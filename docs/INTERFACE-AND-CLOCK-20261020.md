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

## Trabalho em andamento

Ícones ilustrados para os 21 destinos dos submenus, solicitados após a publicação acima.

Expansão herdada do chat anterior: oito cenários de RP, 60 peças de brasão e 35/100 objetos de House 2.0 gerados. A peça 035 tem fonte e prompt salvos em `.local/asset-expansion-20261019/results/house2-new-035.json`; ainda faltam 65 objetos e a validação/integração do lote completo.
