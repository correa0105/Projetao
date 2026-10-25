# Revisão dos sons de masmorra — 25/10/2026

O proprietário relatou áudio estourado/áspero nas armadilhas de lâminas e nos terremotos. A medição digital anterior excluía clipping nas amostras, mas não verificava equilíbrio de graves/agudos, picos entre amostras ou intensidade em janelas curtas. Não confundir arquivo decodificável com qualidade auditiva aprovada pelo usuário.

A auditoria dos 40 arquivos encontrou concentração excessiva abaixo de 120 Hz nos tremores (99% no distante, 67% no terremoto), e acima de 3,5 kHz nas lâminas deslizantes (59%). A mistura anterior usava ruído filtrado contínuo, chapas metálicas e transposição com interpolação linear.

## Correção

14 sons revistos, mantendo os 195 IDs, nomes, durações, loops e ajustes por mesa. Dez reconstruídos com foley gravado: duas lâminas, quatro tremores, pedra rolando, teto, parede e avalanche de entulho. Os quatro efeitos vizinhos de dardos, gás, sibilo e queda no fosso receberam tratamento de graves/agudos e transientes. Os outros 181 registros/arquivos do catálogo e todos os 195 arquivos originais foram preservados.

Lâminas usam saques e cortes de metal curtos, com encaixe discreto; pêndulo tem quatro passagens separadas. Tremores usam pedra gravada e impactos com espaço entre eles, sem camada contínua de ruído sintético. Reamostragem polifásica evita aliasing na mudança de velocidade. Reflexões discretas e baixas substituem reverberação com cauda de ruído. Filtros suaves reduzem extremos; controle suave dos picos de milissegundos, seguido de ganho com margem, conserva o corpo sem hard clipping.

OGG estéreo 44,1 kHz. Depois da decodificação: true peak medido com oversampling 4× abaixo de -8 dBFS; RMS máximo de 50 ms abaixo de -20 dBFS; fração de graves abaixo de 35%, agudos abaixo de 20%; salto entre amostras abaixo de 0,18. As lâminas passam para 7,2% e 6,8% de energia aguda; o terremoto passa para 1,3% de energia abaixo de 120 Hz, conservando o corpo do atrito de pedra nos médios. Esses limites são critérios desta correção, não uma certificação perceptual.

Mesmos IDs garantem favoritos, atalhos, volumes e repetição existentes. Novas URLs terminadas em -r2-20261025.ogg evitam reutilizar a mídia antiga em cache; cliente e servidor recebem o catálogo atualizado juntos. Nenhuma reescrita de documentos, migração ou mudança no mixer/volume global.

## Proveniência e validação

Fontes CC0 já fixadas no manifest: Kenney RPG/Impact Sounds, metal/madeira de rubberduck e pedra de pauliuw. Créditos em public/audio/vtt/CREDITS.md. Script offline scripts/refine-vtt-dungeon-audio-20261025.py; hashes antes/depois, fonte individual e medições em data/vtt/dungeon-audio-refinement-20261025.json. O script verifica arquivos e arquivos-fonte, conserva originais, recusa reprocessamento silencioso e não roda no startup/deploy.

TypeScript/builds e 11 testes unitários/integridade aprovados. O smoke do navegador usa a URL real do catálogo para detectar os players, decodifica os 40 sons, mede picos/RMS dos 14 revistos e verifica prévia privada, compartilhamento, favoritos, hotbar e quatro larguras em banco UUID descartável. Navegador aprovado: 40 decodes, picos e RMS dos 14 revisados, compartilhamento, persistência e quatro larguras sem erros. Publicação em preparação.
