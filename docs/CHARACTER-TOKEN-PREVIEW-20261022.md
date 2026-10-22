# Prévia do token no canto da tela

Um botão circular com mira e pequeno brilho dourado fica no canto inferior direito
quando há um personagem selecionado. Hover e foco abrem a prévia; clique/toque a
mantém aberta. Escape, fechar, clique externo e saída do hover sem fixação fecham.
O brilho respeita movimento reduzido e a posição respeita as áreas seguras do celular.

A imagem é o token real e privado do personagem selecionado:
`/api/characters/:id/token?preview=1&v=:revision`. Essa variante não usa o retrato
como fallback. Sem token, mostra preparação; falha de leitura permite tentar
novamente na prévia, sem loading global. O token é preparado em segundo plano
e só aparece após decodificação completa. Trocar personagem ou revisão reinicia
a prévia e usa o URL atualizado. `token_available` na lista privada informa a
existência do token; a imagem BASE da montagem não é exposta. Sessão e ownership
continuam obrigatórios.

Ícone SVG do conjunto Lucide existente, brilho e painel em CSS. Nenhuma imagem
do site é transformada ou comprimida. Arquivos: `src/CharacterTokenPreview.tsx`
e `src/character-token-preview.css`, integrados ao App.

`node scripts/test-portal-controls-isolated.mjs --token-preview` valida navegador
real e banco UUID descartável: bytes do token, privacidade 401/404, fallback legado
fora da prévia, canto da tela, hover, foco/Escape, toque, fechar, troca de personagem
e revisão, token pendente e layout 390/320 px.
