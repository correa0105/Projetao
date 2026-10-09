# Efeitos e ações da sala — 09/10/2026

Pedido posterior do usuário substitui o rastro contínuo de sangue. Somente
impactos que reduzem PV deixam pequenos respingos separados; movimentos não
criam novas gotas/rastros. Marcas antigas de movimento permanecem armazenadas,
mas não são desenhadas. Cura reduz as manchas do corpo; cura total as remove.

Configurações e ajuda → Mesa → Efeitos da sala:

- Respingos de sangue: escolha do mestre para todos os participantes.
- Efeito de morte → Automático ao zerar PV: ligado inicialmente; desligar e
  voltar à sala conserva a escolha. Aplicar/limpar manualmente usa a seleção.
- Limpar sangue do mapa conserva a ação existente do mestre.

As escolhas ficam no documento da sala, bloodEnabled e automaticDeath. Default
true apenas quando ausentes; pedido legado que omite campos conserva o valor
salvo. Ownership e administrador continuam obrigatórios para mudar a sala.
Não muda regras de morte, salvaguardas ou dano: são apenas efeitos visuais.

Biblioteca de efeitos fica aberta ao escolher um modelo. A seleção abre prévia
privada no token e controles de cor, tamanho e duração abaixo da biblioteca.
Aplicar efeito salva o preset e o aplica; salvar sozinho não aplica. Cancelar,
fechar ou trocar seleção desfaz a prévia. Morte saiu da biblioteca.

Janela de ações com botão direito pode ser arrastada pelo cabeçalho. Captura
de ponteiro, limites da tela, cabeçalho fixo durante rolagem e setas com foco
no cabeçalho. Controles internos continuam editáveis. + Token foi removido
do cabeçalho de Token selecionado; criação por outras ferramentas permanece.

Protocolo VTT 3 acompanha campos novos. Clientes anteriores recebem orientação
de recarregar antes de salvar; HTML usa no-store. Uma aba já carregada com o
parser anterior precisa ser recarregada uma vez para reconhecer blood.

Validação: cinco testes de respingos/manchas/cura/replays/limites, API PostgreSQL
descartável com dano/cura/ocultação, escolhas persistentes e permissões; smoke
de navegador com prévia privada, aplicar, controles e janela em quatro larguras.
Build limpo exclui o protótipo 330×4 pausado.
