# Perfil do viajante e imagens do Hall — 10/10/2026

O cabeçalho do perfil deixou de ser um painel retangular. Mantém somente o retrato redondo ao lado de “Perfil do viajante”, o nome do perfil e, abaixo, o personagem selecionado. O seletor foi substituído por texto: clicar em outro personagem no acampamento ou na estante atualiza nome e retrato automaticamente. A mudança do nome é anunciada aos leitores de tela.

O cachorro foi deslocado novamente à esquerda, tanto no perfil quanto na tela normal de personagens. A montaria do perfil recebe o mouse: o nome aparece no hover e pode permanecer visível pelo clique. As áreas transparentes dos cartões de personagem deixam passar o ponteiro para a montaria, mantendo cliques na imagem, teclado e os controles do personagem.

O diretório usa “Conheça os aventureiros de Alvorada”. Foram retirados os botões “Perfis da Alvorada”, “Meu perfil” e “Amigos e chat” dessa página.

No pódio do Hall da Fama, as três posições exibem a imagem inteira do personagem, usando a mesma rota do acampamento, sem recorte redondo ou moldura. Uma silhueta representa quem ainda não tem imagem. As posições, pontuação, rankings e links de visita continuam funcionando; a lista compacta conserva seus retratos.

## Verificação e publicação

TypeScript e build aprovados. QA no Microsoft Edge real, com PostgreSQL UUID descartável: perfil em cinco larguras (1898, 1440, 768, 390 e 320 px), pódio em quatro (1440, 768, 390 e 320 px), diretório em três (1440, 390 e 320 px). Verificados troca de personagem/nome/retrato, hover/clique da montaria, posição do cão nas duas páginas, ausência dos botões, imagens inteiras e silhueta no Hall, visita a partir do pódio e ausência de rolagem horizontal. Os fluxos anteriores de votação, navegação do perfil, mascotes e fichas móveis também passaram.

Imagem publicada: `alvorada-cinzenta-app:profile-identity-v1-20261010`, também apontada por `alvorada-cinzenta-app:local`. Container saudável em `http://localhost:3000`. Publicação somente do cliente: servidor e mídias originais conferidos ao vivo, sem migrations. Comparação completa de 113 tabelas manteve os dados idênticos; o trabalhador de arte permaneceu ativo.

Rollback: `alvorada-cinzenta-app:before-profile-identity-v1-20261010`. O commit contém somente os seis arquivos revisados e esta documentação; as alterações independentes foram preservadas.
