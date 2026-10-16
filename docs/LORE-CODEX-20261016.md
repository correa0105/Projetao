# Lore como arquivo de leitura — 16/10/2026

A seção regional segue a composição de Regras: barra de consulta e busca,
sumário à esquerda, selos de bronze do mesmo sistema ilustrado, títulos em
Marcellus, superfícies carvão e detalhes de cobre. O cabeçalho de região/pasta
recebe um selo maior; crônicas têm numeração e ações administrativas abaixo do
título. Foram reduzidos o tamanho dos títulos, a separação entre entradas e a
altura das pastas. No celular, o sumário abre e recolhe por botão e fecha após
escolher uma pasta/região. A linha temporal, suas imagens, engrenagens, viagens,
sons e editores permanecem.

Administradores têm **Ver como conta básica**, com indicação da prévia e botão
para voltar. A prévia remove rascunhos da lista e dos contadores, esconde ações
de criação/edição/exclusão/restauração e o editor de eras. Abrir uma crônica
publicada continua possível. A troca é local à página e não altera a conta nem
o banco; recarregar retorna à visão administrativa. Enquanto há uma edição ou
diálogo aberto, a troca fica indisponível para preservar o trabalho em curso.
As regras de autorização do servidor permanecem como antes.

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
