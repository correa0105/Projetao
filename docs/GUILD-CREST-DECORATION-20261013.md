# Oficina de brasões e decoração da guilda — 13/10/2026

O brasão da fundação agora usa quatro camadas independentes: formato, símbolo, fundo e borda. Seis formatos, doze símbolos heráldicos próprios, seis fundos e seis acabamentos de borda: metal lapidado, rebites, corda, runas, louros e espinhos. Prévia ao vivo, relevo metálico, campo com textura, quatro paletas e quatro cores editáveis. A chave histórica border continua sendo o formato; ornament é o novo acabamento. Brasões salvos antes desta versão recebem defaults apenas na leitura; não há migração nem reescrita coletiva.

Nome, história e brasão aparecem somente na fundação. Personalizar sede abre os controles de decoração à direita da sala no desktop, com objetos, tamanho, vista, atmosfera, remoção e salvar/descartar. Em telas pequenas o painel passa abaixo da sala. O giro usa as mesmas imagens, ordem e função houseTurnFacing da House; setas aparecem ao lado da peça selecionada. Não é uma rotação plana da imagem.

Arraste conserva a distância do cursor ao ponto de apoio do objeto. Clique ou tremor menor que 3 px somente seleciona; captura cancelada é limpa. Arrastar muda apenas a posição, respeitando limites; giro e tamanho mantêm o ponto de apoio.

Validação: TypeScript/Vite/tsup; dez testes PostgreSQL descartáveis, incluindo JSON antigo e persistência independente das bordas. Edge real em 1440/768/390/320 px, fundação, cores, salvar/reabrir, painel à direita, giro para ambos os lados, clique sem salto e arraste com deslocamento esperado. Guildas existentes, economia, convites, amigos/chat e perfis preservados.
