# Códice de regras editável

A aba Regras substitui os cartões fixos por um livro de consulta com capa ilustrada, índice por capítulos, artigos, busca e navegação de leitura. O conteúdo inicial descreve as regras que o projeto já usa; esta entrega não implementa progressão completa de classe, multiclasse ou combate automático.

## Controle do conteúdo

A conta `correa.l@icloud.com` e staff/admin podem editar o manual inteiro. As demais contas autenticadas podem ler e pesquisar. Não há promoção automática de contas.

O modo de edição permite alterar título, subtítulo, introdução e capa, criar/renomear/mover/excluir capítulos e artigos, editar resumos/etiquetas e compor blocos de texto, destaque, lista, tabela ou imagem. Capítulos, artigos e blocos preservam sua ordem. Imagens podem ser enviadas pelo editor ou usar uma URL HTTPS. Remover a capa mantém a escolha sem aplicar uma imagem automática por trás.

Salvar publica o documento inteiro para a guilda. Até salvar, alterações permanecem apenas no estado de edição da aba; Cancelar volta à versão publicada. Navegar para outra área e voltar preserva o rascunho durante a sessão aberta. Recarregar com alterações sem salvar pede confirmação do navegador. Importar JSON carrega um rascunho para revisão, e exportar cria uma cópia do conteúdo escolhido. O histórico carrega uma versão antiga como rascunho, mantendo a revisão atual para a próxima publicação.

## Persistência e integridade

Migration `044_rulebook.sql` acrescenta documento global em JSONB, revisões completas e uploads de imagens em PostgreSQL. Os `world_entries` anteriores são preservados. O conteúdo inicial é criado uma única vez; rodar seed novamente não sobrescreve edições nem recria capítulos que o editor excluiu.

GET/PUT `/api/rulebook` retornam documento, revisão e permissão de edição. PUT valida o documento, confere a revisão sob lock e grava documento/histórico na mesma transação. Uma revisão desatualizada retorna conflito sem sobrescrever uma publicação recente; o editor mantém seu rascunho. Rotas de escrita exigem sessão, origem permitida e permissão verificada no servidor.

Imagens PNG/JPEG/WebP são decodificadas, limitadas e convertidas em WebP. Uploads ainda não usados são visíveis somente aos editores; leitores acessam apenas as imagens referenciadas no documento publicado. Retirar uma imagem da publicação bloqueia seu acesso por leitores, preservando o arquivo no SQL para o histórico.

Histórico: GET `/api/rulebook/history` lista versões sem incluir todos os documentos; GET `/api/rulebook/history/:revision` lê um snapshot. Ambos exigem edição autorizada. Restaurar usa o mesmo PUT comum, depois de revisar o rascunho.

Conteúdo de consulta e cálculos do jogo são independentes. Alterar uma descrição neste livro não muda pagamentos, patentes ou validação das fichas. Atribuição SRD 5.2.1/CC BY 4.0 permanece na leitura.

Arte e prompt da capa em [RULEBOOK-ART.md](RULEBOOK-ART.md).

## Validação

- `node scripts/test-rulebook-isolated.mjs`: autorização real, revisão,
  concorrência, histórico, importação, limites, imagens e seed preservando dados.
- `node scripts/test-rulebook-isolated.mjs --browser`: edição e publicação com
  API real, leitor, recarga, imagens, capa, rascunho entre áreas e recuperação.
- `node scripts/smoke-rulebook-ui.mjs`: editor completo e responsivo no Edge,
  incluindo cinco tipos de blocos, busca, prévia, importação/exportação, conflito
  e respostas atrasadas de salvamento, histórico e upload.

Exportação usa JSON compacto para que uma cópia válida possa ser importada
respeitando o mesmo limite de 2 MB. Digitar durante um salvamento mantém as
edições posteriores no rascunho. Carregar histórico compara o rascunho atual,
mesmo se a pessoa fechar o diálogo e continuar editando antes da resposta.

A suíte geral de 04/10/2026 teve 42 aprovações e duas falhas anteriores em
`tests/world-fleet.test.ts` (órbita durante a retirada e proibição antiga de
manto/olhos/anéis). Os seis arquivos relacionados têm hashes idênticos a HEAD;
o teste isolado reproduziu as mesmas falhas. Essas verificações do mapa não
foram alteradas nesta entrega. Os testes específicos desta mudança passaram.
