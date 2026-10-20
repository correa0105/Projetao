# Armas da mesa, miniaturas e retrato com fumaça

No VTT, **Ficha → Essencial → Ataques → Armas na mesa** permite escolher armas
da mochila para a mão principal e secundária. A escolha é salva por sala e
personagem, separada do equipamento do site. Inicialmente usa as armas realmente
equipadas no site; a declaração de equipamento inicial não concede ataques.
Armas de duas mãos impedem uma segunda arma. Não há compra, gasto ou alteração
de inventário ao alternar armas. Uma arma removida da mochila deixa de conceder
ataque. Atalhos antigos podem ser organizados/removidos, mas não executam armas
ausentes; um atalho válido pode selecionar a arma possuída na mesa.

A ficha do site mostra ataques das armas possuídas e equipadas no site. A ficha
da mesa usa a escolha da sala. O cálculo existente de nível 1 foi conservado;
este trabalho não amplia regras de níveis altos ou poderes de itens mágicos.

## Mão vazia e Soco — 20/10/2026

As seleções vazias das mãos mostram **Mão vazia · Soco**. O VTT oferece o ataque
**Soco**, contundente/desarmado, quando há uma mão vazia: sem arma na mochila,
sem arma selecionada, após remover a arma, ou com arma em apenas uma mão.
Duas armas e arma de duas mãos não deixam mão vazia. O escudo, sozinho, não
remove o soco da mão livre. Personagem sem origem finalizada também tem a ação.

`shared/unarmed-attack.ts` reutiliza o cálculo já exibido na ficha: Força e
proficiência para acerto, dano fixo de 1 + Força com mínimo zero; monge conserva
seu dado marcial e o melhor atributo aplicável. Dano fixo não ganha dado no
crítico. O ícone existente de punho é usado na ficha e no atalho; a animação
existente reconhece Soco como pancada natural.

É uma ação inata, identificada por `unarmed-strike`, sem item de catálogo,
compra, reserva ou alteração do estoque. Fixar exige ownership da ficha; executar
consulta os ataques atuais. Um atalho de Soco libera a mão secundária na seleção
da sala se ambas estiverem armadas, ou libera as duas quando a arma ocupa ambas.
Não modifica o equipamento do site. Fichas e salas antigas não são reescritas.

Validação: `node scripts/test-vtt-weapons-portrait-isolated.mjs --unarmed`
aprova seis testes de regras/armas e
`node scripts/test-vtt-weapons-portrait-isolated.mjs --unarmed-browser` cobre
inventário vazio, legado, escudo, mão livre, duas mãos/duas armas, troca/remoção,
ficha, rolagem, atalho/ícone, estoque preservado e desktop/celular, sem provedor
de imagens. Banco UUID descartável. Sem migration nova.

Publicado junto ao ajuste do subtítulo da Lore em `vtt-unarmed-lore-20261020`.
TypeScript, builds, seis testes e smoke de ficha/atalho aprovados. Backup atual
PGDMP de 543.860.745 bytes validado; comparadas 146 tabelas, 143 idênticas, com
avanço do heartbeat e uma edição de Lore/versionamento durante o uso do site
preservados. Servidor e bundles conferidos em localhost/Radmin, sem interromper
o ilustrador nem restaurar dados de jogadores.

Miniaturas do catálogo aparecem antes dos nomes dos ataques e dos itens da
mochila, incluindo armaduras e consumíveis. A barra rápida mostra essas imagens,
a imagem de monstros ou uma prévia estática do efeito quando disponível. Sons
mantêm o símbolo de áudio. Imagem ausente/falha conserva um ícone apropriado.

**Efeitos** fica na barra da esquerda. A galeria abre ao lado e conserva a
prévia privada no token e o editor abaixo. O espaço inferior esquerdo do mapa
mostra o retrato do personagem selecionado com fumaça realista nas bordas e
recorte do peito ao rosto. O token visto de cima continua no mapa. O retrato
usa a arte principal privada, sem alterar o original, exige importação válida
na sala e respeita ocultação/visão. Multisseleção e prévia do jogador não exibem
esse retrato. Movimento reduzido e efeitos desligados interrompem a animação.

Migration `088_vtt_weapon_loadouts.sql` é apenas aditiva. `087` continua
reservada ao trabalho de tokens de animais. Protocolo VTT **5** pede recarregar
abas antigas; sem isso um cliente anterior ainda calcularia os ataques antigos.

Validação: TypeScript, build Vite/servidor; runner descartável
`node scripts/test-vtt-weapons-portrait-isolated.mjs` e `--unit`; regressão
`node scripts/test-vtt-room-effects-isolated.mjs`. Testados inventário vazio,
arma possuída sem equipar no site, troca persistida só na sala, duas mãos,
arma removida/atalho antigo, acesso privado ao retrato, miniaturas e galeria/
retrato em 1920/1366/768/390 px, sem cobrir a barra rápida no celular.

Durante a verificação, uma execução direta do teste antigo de ficha usou o
banco local por falta de trava no próprio arquivo. As contas temporárias foram
limpas pelo teste. O arquivo agora exige banco descartável com UUID antes de
migrar. Auditoria confirmou a limpeza e integridade das contas/personagens e
demais tabelas originais; não restaurar inventário/cofre/salas de um snapshot
histórico porque usuários continuaram alterando esses dados. O novo release
exige snapshot/backup atual antes de aplicação.

Tokens dos animais, 122 variantes temáticas e refino de efeitos JB2A continuam
em andamento. A revisão dos 330 monstros permanece pausada e fora do release.
