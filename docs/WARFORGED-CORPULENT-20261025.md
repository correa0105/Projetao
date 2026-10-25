# Warforged Corpulento e recuperação da arte do Jackpot

O corpo **Corpulento** (`corpulent`) acrescenta a silhueta pedida pelo proprietário:
tronco largo, barriga redonda e saliente, braços grossos e pernas fortes mais
curtas. É a sétima estrutura, distinta de Robusto e Compacto. Está disponível
tanto na montagem quanto no modo com imagem de referência. Cabeça, material,
acabamento, cores e equipamento continuam independentes; não altera regras.

PNG nativo criado pelo `image_gen` embutido, conservado sem redimensionamento ou
recompressão em `public/character-creation/warforged-body-corpulent-20261025.png`.
Prompt, referências, dimensões e SHA-256 em
`data/character-creation/warforged-body-corpulent-20261025.json`.
A referência enviada define apenas proporções, sem copiar gesto, rosto ou roupa.

Cliente e ilustrador resolvem a mesma referência. O novo PNG é usado inteiro;
as seis células antigas conservam recortes e bytes. O schema de estrutura é
compartilhado pelos dois modos. Pré-carregamento inclui a nova imagem. Nenhuma
ficha antiga recebe a opção automaticamente e nenhuma arte pronta é regenerada.

Validação: TypeScript e builds cliente/servidor; 13 testes em PostgreSQL local
UUID descartável; smoke real em Edge com quatro larguras (1440/768/390/320),
sete corpos/doze cabeças, imagem carregada, escolha Corpulento salva/recarregada,
troca de modo e retomada. Nenhuma geração real consumida pelos testes.

## Jackpot: causa e reparo privado

Pedido original `9d95814c-a1a0-4741-80ff-59fe36140392`, personagem
`993e6757-467d-433d-80bc-1ef635bb01ec`. O retrato havia sido aprovado, mas as
tentativas do token falharam na revisão: a última também tinha canvas retangular
1312 × 1199 e canelas expostas abaixo da calça. Como a publicação exige o par,
o site conservou as imagens antigas. Falha não consumia cota.

Reaproveitado o retrato nativo aprovado. Correção do token pelo ImageGen embutido
em duas etapas, canvas quadrado/transparente e tecido contínuo até os pés.
Revisor visual final aprovou anatomia, roupa, câmera e identidade. PNGs nativos,
revisões e manutenção privada em `.local/jackpot-recovery-20261025`.
As imagens passam pela normalização existente do pipeline ao entrar no banco;
os originais permanecem guardados. Não adicionar imagens privadas ao catálogo.

Aplicado pelo finalizador existente `completeArt` somente ao pedido original,
após backup e guardas de dono/ficha/status/revisão/cota. Resultado completed,
revisão 3 → 4; escolhas e demais campos da ficha idênticos; incremento de um uso
na cota da conta, sem criar outro job. Backups privados no servidor:
`/opt/alvorada/backups/jackpot-recovery-before-20261025.dump` e
`/opt/alvorada/backups/jackpot-before-20261025.json`.

Publicação concluída: imagem `alvorada-cinzenta:warforged-corpulent-20261025`,
código `ca07ef7432848c73696aa5e36fe51f11fc9d5f89`, a partir de
`vtt-shift-selection-20261025`. Release de 46 arquivos, 22 respostas HTTPS e 68
assets anteriores conferidos por hash; os 195 sons, três documentos de sala,
três hotbars, o PNG privado da Caverna e o par corrigido do Jackpot permaneceram
iguais. Backup `/opt/alvorada/backups/warforged-corpulent-before-20261025T184558Z.dump`.
Ilustrador recarregado somente com as duas filas vazias, sob trava que impede
claim/enqueue durante a conferência e parada: PID 3664 → 41944. Login/heartbeat
online, contêiner saudável. O shell de transporte devolveu um CR final depois
da conclusão; inspeção independente confirmou a imagem correta e todas as
verificações de produção passaram. Não foi necessário repetir o deploy.

## Estrutura padrão do Budah

Pedido explícito posterior: o Budah, criado antes da disponibilidade deste
modelo, passa de `warforgedBody=robust` para `corpulent`. Ele permanece no modo
`reference`; cabeça, metal dourado e identidade continuam vindo da referência
dele. Altura alta, porte corpulento, idade adulta e gênero masculino preservados.

Aplicação privada após a publicação, em transação com dono/ficha/seleção anterior
conferidos e sem pedido de arte pendente para essa ficha. Validação pelo schema e
pelas instruções físicas vigentes. Apenas a estrutura e a data de atualização da
ficha mudaram; demais campos, ouro, retrato/token, revisão de arte e jobs iguais.
Vale para próximas gerações; nenhuma imagem foi solicitada nem cota consumida.
Snapshot privado em `/opt/alvorada/backups/budah-structure-before-20261025.json`.
