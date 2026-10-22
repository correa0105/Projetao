# Mínimo de 8 por atributo

Novas rolagens mantêm os quatro d6 reais e descartam o menor. Cada resultado
inferior a 8 vira 8, antes dos bônus do antecedente. A soma dos seis resultados
**já ajustados** continua entre 72 e 90; o servidor refaz o conjunto completo
quando essa soma sai do intervalo. Cliques repetidos/concomitantes mantêm a
rolagem gravada. Nenhum dado individual é falsificado ou rolado novamente à parte.

Migration 124 acrescenta `character_sheets.ability_roll_floor`, com default 0
para preservar fichas anteriores. A operação `/sheet/roll` grava 8 junto dos
dados de novas rolagens. A distribuição e confirmação no servidor, a janela 3D,
os cartões e os valores da ficha usam o mínimo salvo. A janela explica o ajuste,
por exemplo “6 ajustado para 8”, mantendo os dados e o descarte reais visíveis.
O aviso vermelho segue dentro da janela, acima dos dados, em cada lançamento.

Por pedido explícito, somente Ubel Abuto recebe também o mínimo retroativo:
o resultado 6 passa a 8 e as outras cinco rolagens ficam iguais. O reparo interno
`raiseCharacterAbilityFloor` exige transação, ID e proprietário exatos, trava a
ficha e conserva dados, escolhas e distribuição. Na ficha ainda não finalizada,
somente ativa a regra; na finalizada, soma apenas a diferença da base aos
atributos atuais, conservando bônus/evoluções e recalculando PV/CA. Mantém dano,
PV zero, recursos, anotações, ouro e inventário. Repetição é idempotente.
Nenhuma migração ou leitura altera automaticamente outras fichas antigas.

`node scripts/test-sheet-isolated.mjs --api` cobre limites por resultado/conjunto,
conservação dos d6, API/ownership/concorrência/distribuição e reparo em fichas
pendentes, finalizadas e com PV zero. O runner padrão, com
`SHEET_ROLL_RULE_ONLY=1`, verifica o caso 6→8 no navegador, texto do ajuste,
distribuição, recarga e regra vermelha em desktop/celular. Sempre usa banco UUID
descartável; nunca roda testes em produção.
