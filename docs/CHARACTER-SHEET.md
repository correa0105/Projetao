# Ficha — regras vigentes

A implementação atual usa **SRD 5.2.1 / D&D 5.5e (2024)**. Consulte [a revisão completa](SRD-2024.md) para escolhas, cálculos, conversão e limites.

## Histórico de implementação em 2014

# Ficha de personagem — nível 1, SRD 5.1 / 2014

## Fluxo

1. Na criação, selecionar raça/sub-raça SRD, classe, alinhamento, antecedente,
   perícias, idiomas/ferramentas, opções raciais/de classe, equipamento e magias.
   Informações de aparência e interpretação são opcionais. Referência visual continua
   obrigatória. As escolhas acompanham o job e só viram ficha após arte válida.
2. Abrir **Ficha**, conferir escolhas e rolar os seis atributos. Servidor usa
   `crypto.randomInt(1,7)` para cada d6: seis grupos de quatro dados, menor descartado.
3. Distribuir os seis resultados por índice (resultados iguais continuam distintos).
   Confirmar aplica bônus raciais, calcula PV/CA e fixa a distribuição.
4. Consultar atributos, perícias, salvaguardas, sentidos, movimento, proficiências,
   ataques, traços, equipamento, história e magias. Registrar PV atuais/temporários,
   inspiração, dados de vida gastos, salvaguardas contra morte, espaços gastos,
   magias preparadas e anotações. Recursos são acompanhamento manual da mesa.

## Integridade

Migration 019 cria `character_sheets`; personagens antigos não são modificados
automaticamente. Ao abrir a ficha antiga, completar escolhas e confirmar rolagem
substitui somente atributos/PV/CA; nome, arte, XP, saldo, inventário e histórico ficam.
Personagens novos recebem a mesma etapa após gerar a arte. Estatísticas antigas
provisórias não são mostradas como ficha concluída.

Todas as rotas exigem sessão e titularidade, incluindo personagens não excluídos.
Mutação bloqueia a linha de `characters` com `FOR UPDATE`. Repetir `/roll` retorna
os mesmos dados persistidos, inclusive em chamadas concorrentes. `/finalize` é
idempotente para a mesma distribuição e rejeita outra após confirmação. O navegador
nunca escolhe valores de dados, PV máximos, bônus ou proficiências fora das regras.
Escolhas ficam fixas depois da rolagem. Nenhum campo de erro é gravado na ficha.

## Escopo explícito

- Nove raças e doze classes existentes, variantes disponibilizadas no SRD 5.1:
  alto elfo, anão da colina, halfling pés-leves e gnomo das rochas; humano padrão.
- Especializações de nível 1 SRD: Vida, Corruptor e Linhagem Dracônica. Demais
  especializações começam em níveis futuros. Não importar suplementos.
- Antecedente Acólito e personalização das perícias/idiomas/ferramentas.
- PV de nível 1 são máximos do dado da classe + Constituição + bônus; não sorteados.
- Riqueza mantém a regra de teste da guilda de 150 PO, sem sorteio ou novo crédito
  ao concluir ficha antiga. Itens iniciais constam na ficha; inventário de compras
  permanece separado. Não há equipar/vender automático nem motor de combate.
- CA considera equipamento inicial; escudo precisa ser guardado para usar arma de
  duas mãos. Bônus condicionais e efeitos são resolvidos na mesa.
- Magias SRD de níveis 0 e 1, escolhas conhecidas/grimório e preparação após atributos.
  Clerigo recebe magias de Vida fora do limite de preparação. Truque de alto elfo usa
  Inteligência, separado da habilidade de conjuração da classe.
- Progressão de níveis, aplicação automática de efeitos, condições, multiclasses,
  talentos e automação de descansos não estão implementadas. XP não eleva nível sozinho.

## Referências e validação

Regras: https://media.wizards.com/2023/downloads/dnd/SRD_CC_v5.1.pdf e
https://www.dndbeyond.com/sources/dnd/basic-rules-2014/step-by-step-characters.
Snapshot mínimo de magias: `shared/srd-spells.json`, fonte e commit dentro do arquivo,
somente SRD 2014, nomes traduzidos localmente. Atribuição em `ATTRIBUTION.md`.

`npm run build` valida cliente/servidor. `npm test` inclui testes de escolhas,
titularidade, concorrência, distribuição, proteção de valores e persistência.
`npm run test:sheet` cria banco PostgreSQL local descartável, serve em porta 3002 e
valida a criação com renderizador de teste, rolagem, recarga, preparação, anotações
e quatro seções mobile no Edge. Exige build prévio. Não chama geração real nem
altera os personagens do banco local. Capturas em `test-results/sheet-*.png`.

## Arte

Fundo: `public/character-library-v1.png` (1672 × 941), criado pela ferramenta nativa
imagegen, sem API key. Prompt usado:

> Create a wide 16:9 background illustration for the character sheet screen of Alvorada Cinzenta, a medieval fantasy RPG. Realistic hand-painted digital concept art, rich physical materials but clearly painted. Ancient medieval library at night, stone arches, tall dark wooden bookcases of leather-bound tomes, aged copper candle holders, a writing desk along the lower right edge with a large open manuscript, stacked tomes, inkwell and elegant feather quill. Cool midnight blue shadows and warm restrained amber candlelight, ivory parchment and weathered copper. Center of composition quiet and dark enough behind a UI, most recognizable detail at outer sides, cinematic depth. No people, no text, no letters, no UI, no symbols, no logo. Landscape 16:9 full bleed.
