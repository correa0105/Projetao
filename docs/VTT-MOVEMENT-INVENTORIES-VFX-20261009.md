# Movimento vinculado, mochilas individuais e VFX — 09/10/2026

## Uso

No VTT, selecione o personagem e use **Vincular sobre outro token** na barra
esquerda, depois clique na montaria ou apoio. O menu do botão direito também
tem **Token de apoio** e **Soltar do token**. O personagem fica centralizado por
cima do apoio; continua selecionável, abre sua própria ficha e usa seus ataques.
Arrastar ou mover com as setas desloca a base e todos os tokens vinculados.

Segure o botão direito sobre um token e arraste para mostrar a régua durante
o movimento. Um clique curto continua abrindo as ações. A régua comum e a do
arraste usam **Distância por célula** da sala; ambas mostram pés (ft). Configurar
5 ou 10 ft por célula muda o resultado. A regra diagonal 5/10 mantém a alternância
ao longo de todas as etapas do percurso; metros são convertidos para pés.

Inventário → **Personagem / Montaria / Mascote** alterna tanto o equipamento
quanto a mochila. Cada animal possui seus próprios itens, incluindo unidades
equipadas. **Transferir entre inventários** permite escolher origem, destino,
item e quantidade entre personagem, animais e cofre. Desequipe unidades antes
de transferir/excluir. O peso/resumo acompanha o dono selecionado. Itens já
equipados nos animais foram atribuídos às mochilas correspondentes.

## Dados e regras

Protocolo VTT **7**: abas anteriores precisam recarregar. `attachment` é opcional
no documento antigo e normalizado para null. O vínculo conserva identidade,
controlador, PV, orientação, condições e recursos de ficha; apenas translação
vem da base. A ordenação desenha/seleciona o filho acima do seu apoio. Rejeitar
ciclos, apoio ausente, profundidade excessiva ou camadas incompatíveis. Ocultar
o apoio oculta seus filhos na visão do jogador, inclusive acessos de ficha/arte.
Jogadores vinculam somente criaturas próprias e movem somente bases autorizadas.
Paredes e limites são verificados em todas as posições carregadas. Importar um
personagem/animal já vinculado não pode reposicionar o filho separadamente.
Presets e duplicações começam independentes.

Migration **090** adiciona `companion_inventory` e auditoria de movimentações.
O estoque comprado agregado em `inventory` é preservado: as mochilas animais
alocam cópias desse estoque, retiradas da disponibilidade e peso do personagem.
Migration copia reservas existentes, sem recriar compras, peças ou saldo.
Equipamentos são reservados localmente; API antiga pode destinar uma unidade
livre ao animal atomicamente. Cofre, exclusão, equipamento humano e armas do
VTT respeitam todas as cópias destinadas aos animais, inclusive não equipadas.
Transferências/exclusões usam ownership, ordem de locks conta → personagem,
limites de quantidade e chave idempotente; não devolvem ouro.

## Efeitos

As referências consultadas foram a [biblioteca JB2A](https://library.jb2a.com/),
incluindo Fireball, Ice Spikes, Healing Generic, Shield e Entangle. Os materiais
publicados são originais do projeto; nenhum arquivo JB2A foi incorporado.

Três materiais nativos com alfa (vapor, chama e energia) usam oito quadros de
deformação periódica e atlas de cores limitado a 24. O frame usa drawImage e
interpolação, sem sintetizar textura por pixel a cada desenho. Falha de carregamento
mantém o fallback; carregamento posterior redesenha prévia/mapa em repouso.
Cristais têm faces, veios e sombras; raízes/espinhos têm volume, correntes têm
elos de metal, barreiras têm fluxo e borda luminosa. Os 30 modelos adicionais
foram refinados e continuam entre os 66 modelos existentes.

Todas as 339 magias usam o renderer revisto, materiais fluidos, partículas e
geometria sombreada, com partículas atmosféricas nas áreas elementais. Cura
usa luz circulante em vez do pictograma de flor. As receitas individuais,
alcance, área, slots, duração, concentração e regras permanecem preservados.
Campos grandes desenham somente o viewport com orçamento de partículas.
Movimento reduzido congela o efeito; desligar efeitos/sons continua independente.

## Validação

- `tests/vtt-attachments.test.ts`: transporte, offsets aninhados, ciclos,
  visibilidade, paredes, escala e diagonais.
- Runner descartável `test-vtt-attached-inventory-isolated.mjs`: ownership,
  ficha/ataques próprios, vínculo/soltar, barreiras, régua 5/10 ft, mochilas,
  conservação, unidades equipadas, replay e navegador 1440/768/390.
- `test-inventory-isolated.mjs` e `test-companion-equipment-isolated.mjs`:
  transferências/cofre/exclusão e compatibilidade/arte dos animais.
- `smoke-vtt-effects-quality.mjs`: 66 modelos, três proporções, escala 0,5–3,
  paridade personagem/monstro/customizado, animação/repouso, cache, desempenho
  e editor 1440/768/390/320.
- `smoke-vtt-spell-quality.mjs`: 339 receitas com pixels/alfa/animação/repouso,
  nove folhas de revisão e 12 casos representativos.
- Testes unitários e navegador de magias/armas/retrato; TypeScript e build.

O protótipo local de 330 monstros × quatro versões permanece pausado e excluído.
