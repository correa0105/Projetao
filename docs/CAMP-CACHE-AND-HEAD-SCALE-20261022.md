# Cache dos animais e escala da cabeça

As artes geradas de montaria/mascote eram devolvidas com `private, no-store`,
obrigando novos downloads. A rota mantém a autorização e usa, para o proprietário
com a revisão correta no URL, `private, max-age=3600, immutable` e `Vary: Cookie`.
URL sem revisão ou com revisão desatualizada revalida (`private, no-cache`).
Convidados da House continuam com `private, no-store`, verificando convite,
posicionamento e bloqueios a cada acesso. Fora dessas permissões, segue 404.
ETag permite 304; a revisão nova recebe outro URL, conservando bytes originais.

O acampamento prepara e decodifica as imagens completas antes de inserir o cavalo
e o pet na cena. Marcadores `data-page-preparing` fazem a primeira abertura
aguardar esses dados/arquivos. Cache de no máximo 64 seleções já preparadas evita
o reaparecimento tardio ao voltar às abas; metadados continuam sendo consultados.
Uma nova arte mantém a anterior até estar pronta, sem reabrir o loading geral.
Não há transformação, redução ou compressão das artes dos jogadores.

Warforged: close-up de cabeça define formato e detalhes, não escala. A construção
usa a escala do corpo selecionado e proporção adulta de cerca de 7–8 cabeças em
corpo inteiro. Mecanismos/lentes não justificam cabeça gigante; a revisão separada
`selected_head_correct` reprova escala desproporcional além do modelo errado.
Token mantém escala tridimensional com oclusão/encurtamento natural de câmera,
sem impor a razão projetada de corpo inteiro. Identidade e paleta preservadas.

Validação: `node scripts/test-companion-equipment-isolated.mjs` cobre cabeçalhos,
ETag/304, revisão antiga, ownership e autorização/revogação da House, equipamentos
e barda. `node scripts/test-companion-equipment-browser-isolated.mjs --cache`
retém respostas reais do servidor, sem interceptação que desative o cache: primeira
abertura espera os animais inteiros, três idas/voltas e reload não os baixam de novo,
revisão nova só substitui após decode sem loading global e layout 390 px preservado.
Testes simulados do ilustrador conferem regra de escala em geração/reparo/revisão.
Todos usam banco UUID descartável ou CLI simulada; nenhum provedor pago em testes.
