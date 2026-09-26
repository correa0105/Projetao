# Acampamento e ilustrador local

A aba Personagens mostra os personagens de corpo inteiro sobre
`public/character-camp-v1.png`: acampamento medieval ilustrado, barraca à esquerda,
carroça e fogueira à direita, clareira central para duas figuras. Fundo criado
com a geração nativa do Codex. Não há editor de aparência.

## Regras implementadas

- Até **dois personagens por conta**, contando criações em fila. Contas antigas
  com mais personagens mantêm todos os registros; não podem criar outros.
- Até **duas imagens por personagem por mês civil UTC**, renovadas no dia 1.
  A imagem inicial também conta. Uma solicitação aceita reserva a cota; falhas
  liberam a tentativa. A data vem do PostgreSQL, nunca do navegador.
- Cada envio de referência corresponde a uma geração. A referência é obrigatória
  (PNG/JPEG/WebP, até 8 MB e 40 megapixels). Não há upload direto de arte final.
- Personagens novos só são inseridos em `characters` após a geração terminar.
  Até lá existe um pedido com os dados da ficha. Personagens antigos sem imagem
  continuam utilizáveis e aparecem como silhueta, com a ação **Gerar imagem**.
- Uma substituição preserva a imagem anterior até a nova estar pronta.
- A lixeira no cartão permite excluir o personagem após confirmar seu nome.
  `deleted_at` (migration 016) libera a vaga e bloqueia o uso da ficha, preservando
  auditoria e participações já registradas. A imagem é removida. É preciso esperar
  uma geração em andamento terminar antes de excluir.
- Créditos iniciais e ficha continuam seguindo as regras anteriores. A arte
  não altera equipamento, atributos ou saldo do personagem.

## Agente e padrão visual

O worker carrega sempre [CHARACTER-ART-PROMPT-v1.md](CHARACTER-ART-PROMPT-v1.md)
e anexa duas referências em ordem: `docs/references/character-style-v1.png`
(estilo fornecido pelo usuário) e a referência privada do jogador (aparência).
O estilo do mago não impõe seu cabelo ou rosto a outros personagens. A raça e a
classe vêm da ficha validada. O agente recebe somente esses campos enumerados,
não nome, biografia, IDs de usuário, conexão com banco ou credenciais.

O agente solicita PNG transparente, corpo inteiro sem cortes, ilustração
semirrealista medieval. A padronização é feita pelas instruções e pela referência
visual, não por um modelo treinado. Resultados de geração podem variar.
O servidor verifica formato, orientação, dimensões e transparência; julgamento
artístico e fidelidade facial não são verificações automáticas determinísticas.

## Iniciar o ilustrador

No computador com o projeto, Node, dependências instaladas e Codex CLI:

```sh
codex login
codex login status
npm run art:worker
```

Use o login **ChatGPT**, não API key. O worker roda **no host**, separado do
container da aplicação, acessando o PostgreSQL pela configuração local `.env`.
Ele chama `codex exec` sem shell intermediário, força autenticação ChatGPT,
desabilita ferramentas de shell do agente e usa sandbox somente leitura.
Nenhuma credencial Codex é copiada para Docker ou enviada ao navegador.
`OPENAI_API_KEY` e segredos do projeto são removidos do ambiente do subprocesso.
`CODEX_BIN` opcional aceita o executável nativo do Codex quando ele não é encontrado
no PATH; no Windows o entry point Node da instalação npm também é detectado.

O computador e o worker precisam permanecer ligados. Reiniciar Docker não inicia
o worker. O indicador fica offline 45 segundos após perder seu heartbeat.
Somente um worker é permitido pelo advisory lock do PostgreSQL; ele processa
uma imagem por vez. `npm run art:worker -- --once` processa no máximo um pedido.
Interrupções são marcadas como falha na próxima inicialização, sem repetir
gerações silenciosamente. Não há fallback para a API paga.

Gerações usam os limites incluídos na assinatura do operador. Documentação
oficial: [geração de imagens](https://learn.chatgpt.com/docs/image-generation)
e [autenticação](https://learn.chatgpt.com/docs/auth). O fluxo nativo foi testado
localmente com Codex CLI 0.156.1. Não representa um serviço hospedado de geração.

## Persistência e privacidade

Migration 015 cria `character_art_jobs`, `character_portraits`, o heartbeat do
worker e a revisão da imagem em `characters`. Imagens finais ficam em `bytea`.
Endpoints privados verificam sessão e usuário. Não existe rota HTTP de publicação
de resultado: somente o worker confiável finaliza a transação. A referência no
banco é apagada ao concluir/falhar; arquivos temporários do worker ficam em
`.local/character-art` (ignorado pelo Git), e a referência temporária é removida.
O Codex preserva seu próprio artefato gerado na pasta padrão de imagens.

Criação e cota usam bloqueio do usuário, idempotência e transação. Finalizar
novamente o mesmo pedido não cria personagem nem crédito duplicado. As imagens
do jogador nunca são servidas como arquivos públicos estáticos.

## Verificação

`npm run build`, `npm test` e `npm run test:browser`. A integração cobre imagens
obrigatórias, proprietário, concorrência, cota mensal, falha, legado e offline.
O browser testa envio pela interface e usa um renderizador de teste determinístico;
a geração real pelo Codex foi verificada separadamente. Fixtures de teste só
operam sobre contas `@example.test`, sem endpoint de bypass na aplicação.
