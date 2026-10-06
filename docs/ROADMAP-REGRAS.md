# Regras: estado atual e próximas etapas

Registro da conversa de 28/09/2026. Atualizar este documento conforme as etapas forem implementadas.

## Como retomar a conversa

Quando o usuário voltar perguntando o que falta ou como está o sistema, consultar este documento,
`CONTEXTO.md` e `SRD-2024.md`, conferindo o código atual antes de afirmar que algo já funciona.
Separar implementação, conteúdo apenas descritivo e planos futuros.

## O que existe hoje

Empório (06/10): equipamentos físicos das tabelas do SRD 5.2.1 e as 258 famílias
mágicas com variantes concretas, sem automatizar efeitos, sintonia/cargas ou
recursos de classes. Catálogo antigo preservado; cobertura e fontes em
EMPORIO-EXPANSAO.md. Isso não implementa o conjunto de todos os suplementos.

- Códice de consulta editável na aba Regras, com capítulos, artigos, busca,
  blocos de conteúdo e imagens. A conta autorizada e staff/admin podem editar
  a apresentação e todo o conteúdo, importar/exportar e recuperar versões.
  Esse editor publica textos da mesa; não acrescenta automação às regras abaixo.
- Base de regras revisadas de D&D 2024/5.5e, usando SRD 5.2.1.
- Criação e ficha inicial de nível 1: nove espécies, doze classes, quatro antecedentes,
  escolhas de origem, atributos, equipamentos, maestrias e conjuração inicial.
- Catálogo de 83 magias de níveis 0/1; não é o catálogo completo de magias de D&D.
- Dados e escolhas persistidos no PostgreSQL, validação no servidor e preservação de fichas legadas.
- Nível e patente evoluem por missões concluídas, com quatro testes obrigatórios de promoção;
  ver `PATENTES.md`. XP antigo é preservado no histórico, sem concessões novas.
  Isso não significa que a evolução mecânica completa das classes esteja implementada.
- Efeitos, ataques, condições e descansos continuam dependendo da resolução na mesa;
  registrar escolhas ou recursos não significa simular automaticamente todas as regras.

Detalhes técnicos, limites e testes da migração: `SRD-2024.md`.

## O que falta

1. **Recursos da ficha do nível 1 ao 20:** fluxo de escolhas por nível,
   PV, bônus de proficiência, recursos de classe, talentos/aumentos de atributos e validação no servidor.
2. **Subclasses:** seleção no nível apropriado e implementação dos recursos adquiridos ao evoluir.
3. **Conjuração nos níveis superiores:** catálogo, preparação/aprendizado, espaços e progressão,
   incluindo as particularidades de cada classe.
4. **Multiclasse:** pré-requisitos, progressões combinadas, proficiências e conjuração correspondentes.
5. **Opções oficiais além do catálogo atual:** completar o escopo escolhido do Livro do Jogador
   e acrescentar suplementos selecionados, com fonte e versão identificadas.
6. **Cobertura de automação:** definir quais efeitos o sistema calcula e quais continuam na mesa;
   não presumir que o usuário pediu um simulador de combate completo.

## Suplementos e conteúdo oficial

O SRD é uma seleção oficial sob licença aberta, não o conjunto de todos os livros.
A migração ao SRD 5.2.1 não implementou todo o SRD nem todos os suplementos.

Exemplos discutidos, **ainda sem escolha do usuário para implementação**:

- Player’s Handbook 2024: faltam opções fora do SRD, como Aasimar, além do catálogo completo
  de antecedentes, talentos, subclasses e magias.
- Mordenkainen Presents: Monsters of the Multiverse: espécies adicionais, incluindo Fada.
- Tasha’s Cauldron of Everything: opções adicionais de classes, subclasses, talentos e magias.
- Fizban’s Treasury of Dragons: variantes de draconatos e opções temáticas de dragões.
- Eberron: Forge of the Artificer: Artífice revisado e opções de Eberron.

Esta lista é ilustrativa, não um levantamento exaustivo. Conferir fontes oficiais atuais,
compatibilidade com 2024, versões substituídas e condições de uso antes de incorporar conteúdo.
Não misturar automaticamente versões antigas e revisadas, nem importar homebrew como oficial.

**Correção importante:** Fada é uma espécie/raça oficial, não uma classe. Pode ser clériga,
guerreira etc. Ser clériga não elimina asas; características da espécie e da classe são distintas.

## Ordem proposta para o trabalho futuro

1. Auditar a cobertura atual e listar regras pendentes por classe e nível.
2. Planejar e implementar a progressão básica até o nível 20 com testes e migrações que preservem jogadores.
3. Incorporar os livros/opções que o usuário escolher, em etapas verificáveis.
4. Avaliar uma estrutura de catálogo extensível para reduzir alterações de código ao adicionar conteúdo.
   Essa estrutura é uma possibilidade discutida, ainda não implementada; mecânicas novas podem
   continuar exigindo programação além de cadastrar nomes e descrições.

Não é necessário incluir todos os livros para lançar. O escopo de níveis e livros disponível
no lançamento deve ser explícito. Posteriormente o usuário autorizou a progressão por
missões e patentes, agora implementada. Recursos de classe de níveis altos e importação
de suplementos continuam dependendo de etapas próprias.

## Referências

- SRD: https://www.dndbeyond.com/srd
- Livro do Jogador 2024: https://www.dndbeyond.com/sources/dnd/phb-2024
- Monsters of the Multiverse: https://www.dndbeyond.com/sources/dnd/motm
- Atribuição e fontes do projeto: `ATTRIBUTION.md`.

## Decisão de 29/09/2026

O fluxo de evolução de PV, habilidades, subclasses e magias será implementado posteriormente. Não apresentar essa lacuna como obrigação de conferir com o mestre. O aviso de nível comunica o nível registrado e a implementação pendente.
