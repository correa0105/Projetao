# Tokens pessoais, miniaturas e arraste — 08/10/2026

Fichas → Personagens mostra a miniatura da arte usada pelo token. Arrastar a linha
até o mapa coloca o personagem naquele ponto. Se já estiver na cena, move a mesma
cópia, mantendo tamanho, giro, ficha, PV e condições. Clicar coloca/seleciona sem
abrir a ficha e conserva a aba lateral. A folha completa abre pelo botão próprio.

O servidor aceita position opcional na rota existente de importação, ajusta à grade
e aos limites do mapa e conserva a autorização do proprietário. Espectadores não
importam; tokens bloqueados/ocultos e paredes seguem as permissões de movimento.
A miniatura usa uma rota privada, cache por revisão e fallback para o retrato antigo.

## Artes escolhidas

- **nana:** imagem anexada codex-clipboard-735fda04-fad9-488c-a0d9-2f74530af19f.png.
  Essa escolha substitui as tentativas anteriores de alterar a parte inferior de
  banana. O PNG anexado foi copiado exatamente como recebido; a versão para o site
  foi apenas reduzida proporcionalmente de 1254 para 1024 pixels, com alfa e imagem
  inteira. Sem nova geração ou alteração de cores, pose, arma ou anatomia.
- **Irineu:** geração nativa do image_gen baseada no retrato existente, corrigida
  para a câmera superior do VTT. Normalização proporcional dentro de 880 pixels e
  margem transparente em 1024, sem recortar a capa ou redesenhar a figura.

Fontes originais e arquivos usados pelo site ficam em
data/vtt/character-art/character-tokens-20261008. O art-manifest.json nessa pasta
contém caminhos, referências, prompt integral de Irineu, escolha explícita de nana
e hashes. As versões de banana rejeitadas não integram o acervo publicado.

Publicação em uma transação somente para os dois personagens identificados do
usuário. Seus retratos de perfil mantiveram exatamente os mesmos bytes; a revisão
de arte aumentou para invalidar o cache. Uma cópia automática de token existente
na mesa recebeu a nova arte, preservando todas as demais propriedades. Uploads
personalizados permanecem independentes; nenhum consumo de geração/cota ocorreu.

## Colocação sobre móveis na House

A borda traseira do chão limitava o arraste dos objetos, impedindo chegar ao tampo
do balcão. Objetos podem agora subir acima dessa borda. Nessa região a escala fica
no mínimo definido pelo chão, sem passar a usar a parede para diminuir. A posição
capturada acompanha o cursor durante a mudança de escala. Personagens, montarias
e mascotes conservam o limite do piso; quadros continuam com projeção de parede.
Tamanho manual, vistas, camadas e persistência não mudaram.

## Validação e aplicação

TypeScript, Vite, tsup e build Docker aprovados. Nove testes isolados de arte,
propriedade, equipamento e fluxo de geração; dez de perspectiva/arraste. Smoke
de navegador com arraste real, seleção sem ficha, posição/grade/limites, autorização,
cache, persistência e perfil separado. House validada arrastando candelabro e
pergaminhos sobre um balcão real, em 1440, 768, 390 e 320 pixels, com salvar/recarregar.
Desvio do ponto capturado inferior a dois pixels, sem overflow ou erros de página.

Aplicado no Docker local. Bundles/servidor correspondem ao build; acervos de House
e VTT conferidos. Antes de publicar as duas artes, 44 tabelas completas permaneceram
idênticas; a transação de arte conferiu 40 tabelas protegidas, outros personagens,
outros tokens, retratos e toda a geometria/ficha das mesas. Backup integral validado:
.local/backups/before-vtt-character-drop-20261008.dump. Evidência da publicação:
.local/current-character-token-publication.json. Acervo geral 330×4 permanece pausado.
