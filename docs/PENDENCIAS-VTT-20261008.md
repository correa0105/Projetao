# Pedidos guardados — VTT, monstros, sons e efeitos

## Estado atual após retomada parcial

O usuário pediu depois “entao aplica no vtt pq ainda nao apareceu”. Isso autoriza
os sons/efeitos, Favoritos, intervalos e chat do checkpoint; foram testados e
aplicados no Docker local em 08/10. Também pediu seleção das proteções desenhadas
na barda e perspectiva da House pelo chão, implementadas e validadas nesta etapa.
O novo acervo dos 330 monstros com quatro alternativas continua pausado.

## Instrução de pausa original

Em 08/10/2026, o usuário pediu: “guarde essa atualização para 00:30” e
“quando eu pedir para fazer essas alterações voce faça com todos os pedidos
que citei”. Depois acrescentou continuar efeitos, sons e aplicação após
terminar os monstros. O horário não autoriza retomada automática. O pedido
posterior retomou apenas os recursos descritos acima; aguardar pedido específico
para os monstros/alternativas.

Sequência aceita: concluir as artes e alternativas dos monstros, continuar
os refinamentos e verificações dos efeitos e sons, verificar o chat e aplicar
a atualização no site preservando os dados existentes.

## Salvamento antes da aplicação dos monstros

O checkpoint pedido já foi enviado e conferido no GitHub:

- Branch: Welson.
- Commit: [d76d62d](https://github.com/correa0105/Projetao/commit/d76d62db4204ebb8dc9ccfc6ca6f233a3d60b3fd).
- Tag: codex/checkpoint-antes-variantes-monstros-2026-10-08.
- Estado e verificações: VTT-CHECKPOINT-20261008.md.

Ele inclui os 155 sons, favoritos/remoção/intervalos, 36 efeitos, imagens no
chat e as três correções individuais. Não inclui a revisão completa dos 330
monstros nem o trabalho local posterior de alternativas. Não reverter arquivos
ou dados para o checkpoint por padrão.

## Monstros: pedido completo ainda pendente

- Refazer todos os 330 monstros presentes no VTT com artes próprias, usando
  as referências fornecidas para estudar anatomia, perspectiva e acabamento.
- Quatro alternativas por criatura. Manter corpo e pose, variando as cores;
  humanoides podem representar pessoas distintas.
- Escolher a alternativa antes de adicionar ou arrastar o monstro ao mapa.
- Perspectiva superior real, com corpo, cabeça, pés e mãos coerentes na mesma
  direção; humanoides com coluna natural, sem postura artificialmente curvada.
- Rever especialmente patas traseiras de dragões/hipogrifo, corpo robusto e
  sinuoso do behir, anatomia e armas do balor.
- Não substituir imagens de tokens já colocados nem modificar fichas existentes.
- Criar composições originais; não incorporar ou redistribuir as artes FA nem
  apresentar recoloração de arquivos licenciados como arte nova liberada.

A pasta informada originalmente mudou de lugar. Local encontrado:
`C:/Users/limaw/Downloads/Token/FA_Tokens_Expansion_Webp_v1.14/FA_Tokens_Webp/`.
Inventário: 12.283 WebPs, 1.653 grupos de poses. Mapeamento inicial relacionou
289 dos 330 monstros; 41 ainda precisam de aliases/revisão manual. Não considerar
as correspondências automáticas aprovadas. Script e inventário em
`.local/catalog-fa-reference.mjs` e `.local/fa-reference-catalog.json`.

Aboleth: uma amostra original foi gerada e revisada, ainda não aplicada ao VTT.
PNG e metadados guardados em `.local/pending-vtt-20261008/`. O arquivo de
metadados conserva prompt e referência de estudo. A amostra tem quatro
tentáculos, três olhos alinhados e silhueta superior completa.

Dragão negro adulto, behir e balor já tiveram correções individuais anteriores
salvas no checkpoint. Prompts, hashes e auditoria alpha em
`data/vtt/monster-structure-20261008.json`; originais em
`.local/backups/monster-structure-20261008/`.

### Trabalho local interrompido

Há um protótipo de seleção de quatro variantes em
`shared/vtt-monster-variants.ts` e `src/VttMonsterVariants.tsx`, com campo
opcional artVariant, seleção antes de clique/arraste, render Canvas, miniaturas,
ficha e presets. São filtros de cor em tempo de execução sobre artes próprias,
não quatro arquivos novos por criatura nem o acervo completo já produzido.
Rever paletas antes de considerar adequadas, especialmente cinza/preto/metais.

Arquivos locais alterados: shared/vtt.ts, src/Vtt.tsx, src/VttMonsterSheet.tsx,
src/VttPrivateLibrary.tsx, src/vtt-canvas.ts, src/vtt-effects-canvas.ts,
src/vtt.css, além dos dois arquivos novos acima. Cópia de recuperação em
`.local/pending-vtt-20261008/wip/`; diff dos arquivos rastreados em
`.local/pending-vtt-20261008/variants-wip.patch`.

Última checagem TypeScript falhou em src/Vtt.tsx:1682: artVariant do schema é
number | undefined, mas MonsterProfile espera MonsterVariant | undefined.
Resolver ao retomar, validar e só então publicar. Não rodar deploy com este WIP.
Ainda não há rota/manifest de novas edições de artes. Uma futura edição precisa
de rota autenticada e validação explícita no servidor, conservando as URLs
antigas usadas pelos tokens existentes.

## Efeitos aplicados e refinamentos futuros

Pedidos a preservar: perspectiva de cima, efeitos partindo do centro do token
em altura na direção da câmera; círculo de chão centralizado e atrás; espiral
circundando o mesmo eixo vista de cima. Veneno foi referência de qualidade,
mas as bolinhas sólidas devem ser retiradas. Gelo mantém prismas largos mesmo
ao aumentar tamanho; relâmpago e faísca usam vários pontos de emissão e múltiplas
descargas simultâneas. Melhorar cura, gelo e raio e ampliar a variedade usando
PeriSFX/JB2A como referências de qualidade, sem incorporar seus arquivos.

O checkpoint tem 36 modelos (16 anteriores + 20 novos), busca/categorias,
prismas de paredes largas e três emissores elétricos. Render validado em três
proporções, editor em quatro larguras e tamanhos 0,5–3. A medição de desempenho
anterior cobre 15 efeitos antigos; ainda avaliar a mistura dos modelos novos.
Guia: VTT-EFFECTS-QUALITY.md. Os 36 modelos foram aplicados por pedido posterior.
Não afirmar que foi produzida uma biblioteca de mais de cem efeitos.

## Sons aplicados

Pedidos a preservar: biblioteca de músicas, ambientes e efeitos individuais;
busca e ajuste na aba Som; tocar na mesa ou Fixar/arrastar aos dez atalhos
existentes; volume e repetição por som; administrador pode remover/restaurar;
estrela marca Favoritos; escolher de quanto em quanto tempo um som toca.
Ampliar portas de madeira/aço abrindo e fechando, animais, monstros, lamparina,
tocha, eco e ambientes tensos. Tabletop Audio, SoundPad e Sanctum são referências
de funcionamento/qualidade. Como o acesso ao site é pago, usar material próprio
e fontes compatíveis; os arquivos restritos do SoundPad não foram incorporados.

O checkpoint tem 155 sons: 13 músicas, 22 ambientes e 120 efeitos. Os 75
anteriores conservaram hashes. Fontes e licenças em public/audio/vtt.
Favoritos/Removidos são por mesa; somente dono administrador vigente altera.
Remover interrompe reprodução e conserva arquivo, ajustes e atalhos; restaurar
recupera o acesso. Intervalo opcional de 1–3600 segundos entre inícios segue a
timeline compartilhada; quem entra durante silêncio aguarda o próximo ciclo.
Guia: VTT-SOUNDS.md.

Navegador validou favoritos/remoção/restauração, intervalos com mestre e jogador,
controles/atalhos persistentes e reprodução real. A qualidade artística permanece
sujeita à revisão do usuário. Não reconstruir o catálogo
com o antigo build-vtt-sound-library.py, que poderia substituir a expansão.
O script append-only da expansão é scripts/expand-vtt-sound-library.py.

## Chat, House e visita de perfil

Estes pedidos anteriores devem permanecer atendidos durante a atualização:

- House: distorcer imagem por quatro pontos, limite de 12%, substituindo o
  controle Giro; retirar o formulário de nome/enviar pose/guardar versão.
- Manter RP aberto em Configurações do menu lateral; histórico com scroll após
  clicar para falar e falas em balão sobre o personagem.
- Excluir itens do inventário House com confirmação e ownership preservado.
- Acervo de monstros disponível na versão básica, sem etiqueta ou bloqueio
  Premium; acesso autenticado às artes permanece.
- Chat VTT junto ao campo Mensagem no rodapé; retirar bloco Macros dessa área,
  preservando os atalhos existentes.
- Visita de perfil com o enquadramento, fundo e chão da aba padrão de
  Personagens, incluindo pets e montaria; placas de madeira com nomes,
  contorno no hover/foco/clique e navegação correspondente; seletor do
  personagem visitado no canto superior direito.
- Chat interpreta (Texto)[URL da imagem] e [Texto](URL), mostrando a imagem.
  Parser/renderer implementados e imagem decodificada no navegador, preservando
  segurança e texto literal inválido.

Os itens históricos da House, perfil, layout e acesso básico já foram
implementados; preservar e verificar regressão, sem recriar do zero.

## Verificações e aplicação

Checkpoint: TypeScript, Vite e build do servidor passaram; 16/16 testes
combinados de schema/engine/chat/VFX e 8/8 testes API de som em banco descartável.
O trabalho de variantes posterior não passou TypeScript ainda.

Na retomada dos monstros: corrigir e completar implementação/artes, executar
verificações pertinentes e testes reais de navegador. Sons/efeitos já passaram
na validação e regressão VTT/perfis/comunidade (23/23) e foram aplicados.
Para testes, usar bancos UUID descartáveis, nunca limpar dados da aplicação.
Antes/depois da aplicação, comparar dados persistidos e conferir arquivos
servidos, saúde do serviço, artes privadas e acesso anônimo bloqueado.
Publicar progresso validado na branch Welson conforme autorização existente.

Houve deploy da expansão de 08/10 no runtime localhost:3000, conferindo 155 áudios,
bundles publicados, 330 artes privadas e acesso anônimo 401. As 43 tabelas de
dados comparadas conservaram os hashes. O protótipo de variantes não foi publicado.
Backups, verificações e fonte de release estão em `.local/`, sem publicar segredos.
