# Ataques e controles locais do VTT

Atualização de 08/10/2026. Na ficha ou barra rápida, escolha o ataque, marque o alvo
clicando no token inimigo e use **Rolar ataque**. A animação automática usa flecha
para arco/besta e corte para as outras armas. O seletor **Animação do ataque**
permite escolher corte, flecha ou nenhum som/animação para aquele ataque.

A espada percorre a direção atacante–alvo com um corte metálico; o arco tensiona,
dispara uma flecha com rastro curto e mostra impacto ao acertar. Erros passam ao
lado do alvo. Acerto, falha e crítico seguem a rolagem/CA existente. A animação não
gasta recursos nem aplica dano automaticamente. O fluxo separado de dano continua.

Em **Configurações e ajuda → Mesa → Personalização**:

- **Mostrar efeitos visuais** desliga efeitos dos tokens, morte, turno, pings,
  dados 3D, animações de ataque, prévias e transições do VTT. Permanecem mapa,
  seleção, alvo e informações de jogo. O renderer para seus loops de efeitos.
- **Som dos efeitos e ataques** ativa ou silencia as novas pistas.
- **Volume dos efeitos e ataques** ajusta seu volume, combinado com o volume de
  efeitos sonoros do site. Não altera música/ambientes da mesa.

Preferências persistem por conta neste navegador, sem alterar a mesa nem outros
participantes. Se necessário, ative o áudio neste navegador pela aba Som.

Os 36 modelos têm pista sonora por família (18 pistas originais), tocada uma vez
quando aplicados; efeitos permanentes não repetem som em cada poll/render.
Arco e impactos usam mais três pistas originais; corte usa o som CC0 já existente.
Fonte reproduzível: `scripts/build-vtt-attack-sounds.mjs`. Arquivos e hashes em
`public/audio/vtt-attack-effects-manifest.json`, CC0-1.0. Sem gravações dos sites
de referência. O limite de oito pistas simultâneas evita sobrecarga sonora.

Migration 082 adiciona somente `vtt_messages.attack_visual` anulável. O servidor
valida d20, cena, atacante controlado e alvo visível, e calcula o acerto; clientes
não informam resultado nem coordenadas. Mensagens privadas continuam privadas.
Histórico não repete animações/sons ao entrar ou recarregar. Metadados de eventos
com tokens indisponíveis ficam ocultos para aquele observador.

Selecionar um token mantém a aba lateral, os rascunhos e os menus abertos. Abrir
ficha por ação explícita/double click continua disponível. O gelo projeta prismas
da base central no chão; a arma não define sua origem. As paredes facetadas são
preenchidas da base à ponta e o tamanho amplia os prismas mantendo a base fixa.

Validação: TypeScript/Vite/tsup, dez testes de parser/render e navegador Edge
com mestre, jogador e espectador em PostgreSQL descartável. Teste de ataques
reais da barra rápida, persistência, permissões, controles locais, sons servidos
e telas 1440/768/390/320 px: `scripts/test-vtt-chat-attacks-isolated.mjs`.
Capturas em `test-results/vtt-sword-attack.png`, `vtt-arrow-attack.png` e
`vtt-effects-scale-corrections.png`; renderer verifica os 36 modelos.

Aplicado no Docker local, serviço saudável em localhost:3000. Migration 082
conferida; bundles de release, 155 sons da biblioteca, 21 pistas novas e 330
artes existentes conferidos por hash. Acesso anônimo às artes continua 401.
Backup anterior: `.local/backups/before-vtt-attack-20261008.dump`. Conteúdo
anterior das 43 tabelas conferido igual (nova coluna nullable excluída do hash
dos registros históricos). Revisão de variantes de monstros permanece pausada.
