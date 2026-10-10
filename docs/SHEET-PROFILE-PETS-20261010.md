# Fichas, perfis e mascotes — 10/10/2026

As fichas da Mesa Virtual agora abrem no alto da tela, reservando espaço para a barra de ações e seus menus. O cabeçalho permite arrastar a janela ou movê-la pelas setas do teclado; minimizar e restaurar conserva a aba e o conteúdo aberto. O menu do token se fecha ao abrir uma ficha e permanece oculto enquanto ela estiver aberta. A função de minimizar foi retirada do menu do token e mantida na ficha.

O banner da ficha perdeu a chamada “ALVORADA CINZENTA · FICHA DE MESA”. O retrato do personagem aparece à esquerda do nome, sem moldura, usando a rota de imagem já autorizada para o token. Fichas de monstros usam a mesma janela móvel.

No perfil, a navegação usa setas menores com brilho discreto, respeitando movimento reduzido. A seta de retorno aparece a partir da segunda aba. A sala de Conquistas mantém o lustre visível; a estante acompanha a escala do cenário e encosta no chão junto à parede. Acampamento perdeu o título e o resumo de patente/raça/classe no canto superior.

Somente no perfil, nomes de personagens, companheiros e retratos aparecem ao passar o mouse ou focar/clicar. O menu sob cada personagem só aparece depois de clicar na sua figura. A seleção inicial não abre esse menu; a escolha pelo seletor de personagem também o recolhe. As telas normais de personagens mantêm seus nomes e controles.

A avaliação fica oculta para o dono do perfil. Visitantes veem “Avalie” acima das cinco estrelas, com efeito discreto, sem o texto “Sem votos”. O fluxo existente conserva uma avaliação por visitante, justificativa obrigatória para uma ou duas estrelas, anonimato público e classificação geral no Hall da Fama.

O cão foi deslocado um pouco à esquerda tanto no perfil quanto na tela normal de personagens. Outras espécies mantêm suas posições. A Casa dos mascotes reúne seleção de espécie/preço, aparência, raça, nome e compra em um único menu à esquerda, semelhante ao estábulo. A grade inferior foi retirada. Em telas estreitas, o mesmo menu segue abaixo do jardim, sem duplicação ou rolagem horizontal.

## Validação

- TypeScript e build do estágio limpo aprovados.
- Microsoft Edge real, com banco PostgreSQL temporário: perfis em cinco larguras (1898, 1440, 768, 390 e 320 px); fichas e mascotes em quatro (1440, 768, 390 e 320 px).
- Verificados retorno/avanço, retrato selecionado e atualização automática, nomes por interação, abertura da ficha pública, votação como visitante e ocultação para o dono.
- Verificados arraste e teclado, minimizar/restaurar sem perder a aba, espaço acima dos menus de ação, ausência do menu do token sobre a ficha e permissões de mestre/jogador/espectador.
- Verificados as dez espécies no seletor, troca de aparência/espécie, nome e disponibilidade da compra; posição do cão nas duas telas.
- Publicação somente do cliente, sem alterar servidor, migrations, catálogo ou mídia. Comparação completa de 113 tabelas manteve os dados idênticos; o trabalhador de arte continuou ativo. Bundles, HTML sem cache e mídias originais conferidos ao vivo.

## Publicação

Imagem: `alvorada-cinzenta-app:sheet-profile-pets-v1-20261010`, também apontada por `alvorada-cinzenta-app:local`. Container saudável em `http://localhost:3000`.

Rollback preservado: `alvorada-cinzenta-app:before-sheet-profile-pets-v1-20261010`. Alterações independentes do checkout foram preservadas; somente os trechos necessários de `Vtt.tsx`, `VttMonsterSheet.tsx` e `CONTEXTO.md` entraram no commit.
