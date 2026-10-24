# Brushes salvas e carregamento progressivo

Uma textura pode expor `naturalWidth` antes de `complete`. O renderer guardava
essa imagem e sua largura no cache, mas ignorava sua pintura enquanto o download
estava incompleto. Ao terminar sem mudar de largura, nenhuma invalidação ocorria:
os tiles e o piso consolidado podiam continuar vazios.

`vtt-terrain-canvas.ts` agora inclui no snapshot somente imagens completas com
largura válida. A conclusão do carregamento invalida tiles/piso mesmo quando a
instância e as dimensões não mudam. Quadros seguintes reutilizam o cache existente.
O image-loader continua aguardando decode e solicitando redesenho, com as mesmas
tentativas automáticas e preparação somente das texturas usadas.

Validação de 24/10/2026:

- `node scripts/verify-vtt-terrain-readiness.mjs`: reproduziu piso vazio antes da
  correção; depois, o resultado coincide pixel a pixel com renderização nova.
- `node scripts/verify-vtt-terrain-cache.mjs`: zoom sem repetir strokes, pintura,
  desfazer e visibilidade de camadas aprovados.
- Cinco testes unitários de image-loader, bordas e suavização aprovados.
- `node scripts/test-portal-controls-isolated.mjs --vtt-entry`: banco descartável,
  entrada, download seletivo, espera, pixels reais da grama, persistência/celular,
  iluminação e horário aprovados.
- Cópia privada somente leitura do mapa relatado: 75 traços, nove texturas HTTP
  200, camada Chão visível; pintura progressiva e renderização nova equivalentes
  dentro da tolerância existente (diferença média 0,51/255).
- TypeScript e builds cliente/servidor aprovados. Build incremental preserva os
  arquivos públicos existentes; nenhuma imagem foi transformada.

Sem migration ou alteração do documento da mesa. Publicação somente do cliente
sobre a imagem `starting-gold-20261023`, com manifesto de hashes e imagem anterior
preservada. Evidências e cópia privada ficam fora do Git, em `.local/` e
`test-results/`.

Publicado em `alvoradacinzenta.com` como `vtt-brush-loading-20261024`, código
`7ab84c513fbaf5a68860985fb0a3e14377ef111d`. Os 111 arquivos do pacote e os 56
arquivos sem gzip acessados por HTTPS conferem por SHA-256. Histórico dos 75 traços
idêntico ao snapshot anterior e ilustrador online, verificados somente por leitura.
Backup: `/opt/alvorada/backups/vtt-brush-loading-before-20261024T195138Z.dump`.
