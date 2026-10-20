# Margens, Casa dos Mascotes e edição pela conta básica

Pedidos de 20/10/2026:

- Ficha, Inventário e Conquistas compartilham espaço inferior de 116,25 px em
  computador e 96 px até 760 px de largura, mais a área segura do dispositivo.
  Isso reduz em 25% o espaço anterior do Inventário. O cenário decorativo de
  Conquistas não pode aumentar a altura da página além do conteúdo.
- A coleção de cartas usa seu cenário no fundo inteiro da janela, mantendo os
  painéis centralizados. Nome do personagem na visita recebe padding inferior.
- Retirado o link “Visitar Garalho” do Inventário.
- Casa dos Mascotes ocupa 100dvh sem rolagem da página. O painel pode rolar por
  dentro para conservar acesso a aparência, nome e compra em telas baixas.
  Retirado o link “Créditos dos sons” do rodapé; arquivos de créditos preservados.
- Conta básica conserva a identidade do proprietário e permite ações normais
  sobre seus personagens e bens. A restrição global de gravação foi retirada;
  ownership e autorização administrativa continuam verificados em cada rota.
  Compras na visualização básica debitam o saldo real, sem ouro ilimitado.

Validação: TypeScript e builds de cliente/servidor do estágio isolado; nove
testes de prévia/permissões/economia em PostgreSQL UUID descartável, incluindo
compra com débito e replay, edição dos próprios animais, bloqueio de outro dono
e bloqueio administrativo. Componentes no Edge em 1920, 1440 e 390 px; controles
de compra acessíveis por rolagem interna em 1280×720 e 390×640, sem rolar a página.

Publicação incremental no Docker local, imagem
`alvorada-cinzenta-app:page-spacing-owner-20261020`, derivada da publicação de
entrega de personagens. Sem migrations novas. Preservar chunks antigos para
abas já abertas e manter alterações independentes fora desta publicação.

## Refino posterior dos painéis e itens

O painel de compra dos mascotes passa de 356 para 380 px nas telas maiores,
começa 15 px mais acima e tem 64 px adicionais de altura disponível. A lista
de espécies acompanha a altura da janela, eliminando a rolagem externa do
painel nas telas de computador verificadas. Telas pequenas conservam acesso
a todos os controles pela rolagem interna necessária.

As labels dos recursos de Combate não recebem mais o fundo aplicado a cartões;
campos numéricos e demais superfícies mantêm seus fundos.

Em toda a mochila e cofre, o slot do item usa duas áreas de grade fixas: arte e
nome. O nome ocupa uma linha de 13 px, com reticências no excedente, sem mudar
a posição ou tamanho da imagem. Nome integral preservado no rótulo acessível
e no painel de detalhes; quantidade e espaços vazios permanecem independentes.

Build do cliente e conferência visual no Edge em 1440×908, 1280×720, 1024×768,
860×640 e 390×844. Medidas relativas de imagem/nome iguais entre nomes curtos e
longos, reticências, labels transparentes e campos opacos conferidos. Publicação
`visual-refinements-20261020` somente do cliente, preservando o servidor e assets
anteriores.

Refino seguinte: nomes dos itens recebem 4 px de padding em cada lateral,
preservando largura contida, linha fixa e reticências. O filtro do Hall da Fama
passa para a seção inferior, ao lado da busca, em fluxo normal, tanto no Hall
independente quanto no Hall dos perfis. Conferidos padding em 1440/390 px,
posição, troca de categoria e busca em 1440/760/390 px nas duas versões do Hall;
TypeScript e build aprovados. Publicação `item-padding-hall-filter-20261020`
somente do cliente, com servidor e arquivos anteriores preservados.
