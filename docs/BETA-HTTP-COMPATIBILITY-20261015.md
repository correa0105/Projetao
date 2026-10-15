# Acesso HTTP do beta — 15/10/2026

A tela vazia no acampamento foi reproduzida no endereço Radmin: a API nativa crypto.randomUUID não existe nessa origem HTTP. O erro interrompia a renderização depois de Preparando sua mesa. O acesso localhost usado em verificações anteriores não reproduzia essa restrição.

A inicialização do cliente agora instala UUID v4 com crypto.getRandomValues antes de importar a aplicação, somente quando a implementação nativa está ausente. Preserva versão/variante e aleatoriedade criptográfica; não usa Math.random. Referência: https://w3c.github.io/webcrypto/#Crypto-interface . O tratamento geral de erros de renderização apresenta recuperação e retorno ao início.

O catálogo autenticado tinha 2.569.427 bytes e bloqueava a abertura do acampamento. A primeira carga agora libera a interface após os dados essenciais; o catálogo continua em segundo plano. O Empório tem espera e nova tentativa próprios. Atualizações após ações continuam aguardando todos os dados.

O catálogo usa gzip negociado e conserva no-store; os bundles com hash usam cache imutável e arquivos gzip opcionais com Vary correto. Clientes sem gzip recebem o mesmo conteúdo original. Fundo do acampamento convertido para WebP com a mesma composição e dimensões, de 2.414.965 para 321.898 bytes; PNG original preservado.

Validação: UUID nativo/fallback, versão/variante/unicidade; oito contas novas em banco UUID descartável, acesso HTTP não seguro pela interface VPN, acampamento carregado enquanto catálogo está deliberadamente retido, formulário de criação, navegação, conteúdo gzip idêntico e cache de bundles. Sem alteração de contas, saldos ou personagens de produção.
