# Espelhamento na House e sangue no VTT — 09/10/2026

## House

Personagem → **Espelhar imagem** vira horizontalmente a arte do próprio
personagem. O botão funciona também com a presença já selecionada. Uma segunda
ativação restaura a direção original. O nome, a fala, a seleção e os controles
continuam legíveis; posição, tamanho, perspectiva e camada permanecem iguais.

Migration 086 acrescenta `house_presence.flip_x`, inicialmente falso. O PUT de
presença aceita boolean opcional e preserva o valor quando clientes antigos
movem a figura sem enviar esse campo. Somente o próprio jogador pode alterar
sua presença, inclusive numa casa em que foi convidado. Retratos, versões e
arquivos originais não são reescritos.

## VTT

Dano aplicado aumenta as manchas no corpo; cura parcial reduz as manchas que
já existem; cura completa limpa a criatura. O estado visual usa PV efetivos,
sem provocar dano adicional. Acima de metade dos PV há gotas espaçadas durante
movimentos aceitos; com metade dos PV ou menos o rastro fica mais denso.

O servidor calcula o sangue sob o mesmo lock do dano, cura e movimento. Replays
idempotentes não criam marcas adicionais. Caminhos rejeitados por paredes ou
permissões não geram rastros. Clientes não podem enviar feridas arbitrárias.

O sangue no chão permanece depois da cura. O mestre pode removê-lo em
Configurações e ajuda → Mesa → **Limpar sangue do mapa**. Marcas de criaturas
ocultas e áreas fora da visão não revelam posições aos jogadores/espectadores.

São até 12 manchas por criatura e 800 marcas no chão por cena, removendo as mais
antigas ao atingir o limite. O desenho usa a transparência real do token e
preserva sua textura, rotação e espelhamento. Desligar efeitos visuais também
oculta o sangue neste navegador. Dados antigos recebem os padrões vazios sem
reescrita de todas as mesas. A versão 2 do protocolo continua compatível.

## Verificação

- Cinco testes de regras e um teste de API em PostgreSQL UUID descartável:
  dano, replays, curas, caminhos, limiar de metade, permissões e visibilidade.
- Dezessete testes da House, incluindo preservação do flip em arraste legado,
  validação booleana e proteção da presença de outro jogador.
- Navegador: espelhamento, nome legível, âncora imóvel, arraste e persistência;
  controles em 1440, 768, 390 e 320 px.
- Revisão visual do sangue em seis estados de PV; máscara alfa, espelhamento,
  privacidade e medição aquecida de 20 criaturas/800 gotas (~1 ms no ambiente
  de teste, sem representar garantia em outros aparelhos).

## Menu de visita

As cinco abas agora ficam numa faixa compacta com textura de madeira, fundo
discreto e destaque da seleção. A mesma posição é usada nas cinco páginas,
com espaço reservado acima do conteúdo. Em telas estreitas, só a faixa rola
horizontalmente. A escala e o chão dos personagens/animais permanecem iguais.
QA comparou o acampamento original em cinco telas e navegou nas cinco abas em
quatro larguras, com teclado, seletor e dados preservados.

## Aplicação local

Docker aplicado com migration 086, saúde e hash do servidor conferidos. Backup
integral antes da mudança (457.986.672 bytes), catálogo pg_restore validado.
Todos os dados existentes em 44 tabelas foram preservados; somente o novo campo
flip_x=false foi excluído da comparação. Ilustrador reiniciado no release limpo,
online e com fila vazia. Os oito arquivos do protótipo pausado foram preservados
fora do build e do índice do commit.

Os demais pedidos de efeitos, tokens de animais e variantes
temáticas do Empório continuam em andamento. A reconstrução 330×4 está pausada.
