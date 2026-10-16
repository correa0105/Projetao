# Lore como arquivo de leitura — 16/10/2026

O título e a frase da Linha Temporal agora ficam no alto à esquerda do card,
com margem adaptada à largura. Linha de eras e botão de edição conservam sua
posição. Conferência visual e limites do título validados de 320 a 1920 px.

O menu de visualização foi promovido para todas as páginas do portal. Há somente
uma aba lateral global, inclusive na Lore, com estado por sessão e conta. A prévia
consulta o servidor com capacidades básicas, sem rascunhos e sem privilégios de
ouro infinito ou edição administrativa. Voltar não altera o papel real da conta.
Guia e verificações: `ACCOUNT-PREVIEW.md`.

O pergaminho aberto ganhou uma ilustração original com camadas reais de papel,
bordas gastas e manuscrito discreto, substituindo apenas o desenho anterior.
Os quatro rastros mágicos, dez partículas e animação de abertura permanecem
idênticos. Arte do imagegen embutido em `public/lore/open-parchment-20261016.webp`;
prompt completo, alpha, dimensões e hashes em `data/lore-open-parchment-20261016.json`.

A seção regional segue a composição de Regras: barra de consulta e busca,
sumário à esquerda, selos de bronze do mesmo sistema ilustrado, títulos em
Marcellus, superfícies carvão e detalhes de cobre. O cabeçalho de região/pasta
recebe um selo maior; crônicas têm numeração. Após o refino adicional pedido,
as ações administrativas são ícones na mesma linha de cada pasta/crônica,
com rótulos acessíveis e descrição ao passar o mouse. Pastas têm linhas de
44 px, selos de 30 px e títulos de 12 px; as entradas e o cabeçalho também
ficaram menores. A busca foi alinhada à coluna principal, usando o espaço
antes vazio da faixa. No celular, o sumário abre e recolhe por botão e fecha após
escolher uma pasta/região. A linha temporal, suas imagens, engrenagens, viagens,
sons e editores permanecem.

Administradores têm uma aba **Visualização** na borda direita que abre um
menu lateral com **Ver como conta básica** e o retorno à visão administrativa.
A faixa horizontal anterior foi removida. Escape, fechar e clique fora
recolhem o menu; a troca também o recolhe, e Escape devolve o foco à aba.
A prévia remove rascunhos da lista e dos contadores, esconde ações
de criação/edição/exclusão/restauração e o editor de eras. Abrir uma crônica
publicada continua possível. A troca é local à página e não altera a conta nem
o banco; recarregar retorna à visão administrativa. Enquanto há uma edição ou
diálogo aberto, a troca fica indisponível para preservar o trabalho em curso.
As regras de autorização do servidor permanecem como antes.

O fundo ilustrado volta ao passar o mouse ou focar uma crônica: a primeira
imagem da página, ou o cenário de castelo usado anteriormente, cobre a linha
com transparência e máscara para preservar o título. Os selos reproduzem os
efeitos de Regras: relevo no hover/foco, reflexo metálico de 1,05 s e brilho
discreto no item selecionado. Movimento reduzido desliga essas animações.

A névoa externa foi suavizada: quatro oitavas de ruído em volumes maiores,
menos deformação, contraste menor e transição mais suave junto à biblioteca,
sem os filamentos claros e redemoinhos apertados anteriores. O limite de
15 quadros/s, pausa, fallback e proteção da leitura continuam. Detalhes e QA
de máscara/alpha em `LORE-SMOKE-20261015.md`.

## Cópia da versão anterior

Antes da reforma foram guardados 14 arquivos de código/arte, a captura enviada
pelo usuário e um dump PostgreSQL de 3.140.037 bytes em
`.local/lore-before-codex-20261016/`. O dump inclui nove tabelas de Lore e seus
territórios/registros de origem, com imagens e revisões. `manifest.json` contém
o SHA-256 e o commit anterior `c63cc7d30f6a6dfd35303f0f3e5ce84291c5f014`.
`LEIA-ME.txt` orienta a recuperação e `restore-list.txt` registra a inspeção
aprovada com `pg_restore --list`. O backup com dados privados permanece local,
fora do Git. O desenho anterior também pode ser recuperado pelo commit.

## Verificação

TypeScript e build do cliente; navegador integrado em seis dimensões de 320 a
1920 px com sumário, busca, leitura, editor e cancelamento de exclusão. A prévia
foi comparada com uma conta básica real: mesmos títulos publicados, ausência
de rascunhos e controles administrativos, permissões da conta e rascunho
preservados ao voltar. O teste de API existente cobre regiões, subpastas,
uploads, publicação, privacidade, ownership e conflitos em PostgreSQL UUID
descartável. Capturas do arquivo, leitor, sumário móvel e prévia foram
inspecionadas.

A comparação com Regras passou em cinco larguras, com e sem movimento
reduzido: mesmas margens/largura, folga do cabeçalho, seleção e teclado na
linha temporal e abertura/fechamento do editor de eras, dez cenários ao todo.

Reprodução: após compilar o cliente e disponibilizar as mídias públicas, usar
`node scripts/test-lore-codex-isolated.mjs` e
`node scripts/test-lore-isolated.mjs`. A publicação é somente do cliente,
derivada da versão com House em tela inteira e brasas no Hall, conservando o
servidor, dados, assets anteriores e alterações independentes.
