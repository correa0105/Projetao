# Checkpoint antes do novo acervo de monstros — 08/10/2026

Solicitação explícita: salvar no GitHub antes da aplicação da revisão dos
330 monstros; continuar em seguida. Branch de trabalho: Welson, origin/Welson.

## Incluído neste ponto de recuperação

- 36 efeitos originais, com busca e 20 modelos adicionais. Removidas bolhas
  sólidas; gelo com paredes largas; relâmpago/faísca com três emissores e vários
  ramos simultâneos, vistos de cima. IDs antigos e acesso básico conservados.
- 155 arquivos de som: 13 músicas, 22 ambientes e 120 efeitos. 80 adições CC0/
  composições próprias; os 75 hashes anteriores permanecem. Portas pesadas e
  foley de aço, criaturas, animais, lamparina, tocha, ecos e ambientes de tensão.
- Favoritos por estrela, remover/restaurar por mesa, ajustes mantidos no hotbar.
  Controle exige dono administrador. Repetição contínua ou intervalo de 1–3600 s
  entre inícios, com timeline compartilhada e espera silenciosa entre ciclos.
- Imagens no chat com `(Texto)[https://imagem]` e `[Texto](https://imagem)`,
  caminho local, fallback e manutenção da posição de rolagem.
- Correções individuais anteriormente solicitadas: dragão negro adulto, behir
  e balor. Arquivos privados e rotas existentes; outras 327 artes preservadas.
  Prompts finais no arquivo `data/vtt/monster-structure-20261008.json`.
  Ferramenta: imagegen embutida. Backup de originais em
  `.local/backups/monster-structure-20261008`.

## Nova revisão pausada

O usuário forneceu a pasta FA_Tokens_Webp (12.283 arquivos) como inspiração.
São quatro versões por monstro, com mudança de cores mantendo a criatura,
exceto humanoides que podem ser personagens distintos. Novo seletor antes
do clique/arraste; conservar fichas, ownership e imagens de tokens já colocados.
Não incorporar arquivos FA ao site. Produzir ilustrações próprias com anatomia
e perspectiva conferidas, sem prometer equivalência por percentual.

Esse checkpoint precede a aplicação do novo acervo completo. Não há substituição
dos 330 por esses arquivos de referência nem quatro alternativas prontas.

## Validação já realizada

Schema/engine/chat/render: 16 testes aprovados. API de som em PostgreSQL UUID
descartável: 8 testes aprovados, incluindo permissões vigentes, favoritos, remover,
restaurar, intervalo, limites e concorrência. Navegador Canvas: 36 efeitos em três
formatos; escala 0,5–3 e biblioteca em 320/390/768/1440 px. Cache limitado a 24,
sem reconstrução de atlas no benchmark dos 15 modelos anteriores.
TypeScript, build do cliente Vite e bundle do servidor tsup aprovados.

Decode e medições de todos os sons foram registrados pelo gerador; comparação de
hashes dos 75 anteriores. Após novo pedido de aplicação, navegador mestre/jogador
validou áudio real em três ciclos a cada 3 s, silêncio entre disparos, favoritos,
remoção/restauração, ajustes/atalhos persistentes e imagem decodificada no chat.
Layout aprovado em 320/390/768/1440 px. Regressão VTT/perfis/comunidade: 23/23.

Checkpoint aplicado ao Docker local em 08/10: 155 arquivos OGG e bundles servidos
conferidos por hash; 330 artes privadas preservadas e acesso anônimo 401. Backup
PostgreSQL anterior e comparação de 43 tabelas pré/pós sem alterações de dados.
O protótipo de quatro variantes e o novo acervo completo foram excluídos do release.
