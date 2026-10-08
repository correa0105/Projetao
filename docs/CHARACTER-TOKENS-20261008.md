# Arte principal e token do personagem — 08/10/2026

Cada geração de personagem entrega duas artes: a figura principal existente para perfil/acampamento e uma nova vista estritamente de cima para o VTT. O ilustrador gera e aprova a figura principal primeiro, depois a usa como referência de identidade, raça, cores e equipamentos do token. A referência de câmera/pintura é a arte superior aprovada do Berserker do acervo do VTT; sua identidade não deve ser copiada. Prompt em CHARACTER-TOKEN-PROMPT-v1.md.

As duas imagens são validadas e publicadas na mesma transação. Se a geração ou a revisão do token falhar, nenhuma das duas substitui a arte anterior; a tentativa segue o fluxo de falha que preserva a cota. O par usa um único pedido, idempotency key e unidade do orçamento mensal existente. Companheiros mantêm sua geração atual.

Migration 084 cria character_tokens, separada de character_portraits. O perfil continua lendo somente portrait. A importação no VTT prefere a vista de cima, com alfa e proporção preservados. Personagens anteriores sem essa imagem continuam usando sua arte existente até uma nova geração.

Complemento posterior: Irineu e nana receberam suas vistas de token sem regenerar
os retratos. Nana usa exatamente a imagem anexada e escolhida por último pelo
usuário. O original fica intacto; a versão do site é reduzida proporcionalmente
para 1024, com transparência. Guia/proveniência em VTT-CHARACTER-DROP-20261008.md.
A lista Fichas mostra a miniatura via GET /api/characters/:id/token, somente ao
proprietário, com fallback para o retrato antigo e cache privado por revisão.
Clique seleciona/coloca o personagem; arraste coloca ou reposiciona seu token no
mapa sem abrir a folha completa. A abertura da ficha continua em seu botão próprio.


Tokens já importados que usam a arte automática do personagem recebem a nova imagem, sem mudar posição, rotação, tamanho, ficha, HP ou outras propriedades. Uploads personalizados ficam independentes. As cópias automáticas têm provenance em vtt_assets; a migration identifica apenas as antigas cópias de retrato associadas ao personagem/controlador e ao nome produzido pelo importador. IDs novos das imagens evitam cache antigo. Endpoints /top-down mantêm autorização de sala/visibilidade, e o canvas desenha a silhueta inteira sem moldura circular.

Validação: TypeScript/Vite/tsup; nove testes isolados sobre atomicidade, falha/revisão, idempotência, criação, cota, identidade nas referências, equipamentos, exclusão e permissões. Smoke de navegador importa o token transparente real, confere o asset servido e quatro larguras; o perfil usa somente a arte principal. Também há regressão do VTT após a alteração de caminhos de assets.

O worker local usa o fluxo existente da sessão ChatGPT e a ferramenta nativa de imagem, sem API key. Sua implementação está em scripts/character-art-worker.ts e server/character-token-illustrator.ts. Aplicado no Docker local, migration 084 confirmada e worker reiniciado/online. Bundles e servidor servido correspondem ao build; 43 tabelas anteriores preservadas. Backup: .local/backups/before-character-tokens-20261008.dump.
