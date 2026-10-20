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
