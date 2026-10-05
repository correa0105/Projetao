# Refino do calendário, perfis e mesa — 05/10/2026

Calendário permanece ao final do Diário. Tema carvão/azul de noite/cobre, título padrão Calendário, sem selo de agenda nem subtítulo. Selecionar dia escolhe seu primeiro compromisso; clicar no título de outro compromisso troca a arte da capa. Eventos usam presentation.image, publicações usam image_path; missões e registros sem imagem usam a arte genérica correspondente. Imagem quebrada também recebe fallback. Editores preservam título e arte fallback personalizados; migration 061 só substitui os padrões antigos.

Personagem → Cartas abre a coleção individual, três espaços grandes equipados e inventário. Retirar uma carta do espaço mantém sua propriedade. Visitas têm a mesma composição para consulta, sem controles de equipamento. Loja → Salão das cartas continua a compra. Perfil tem ações em uma linha, sem upload de cenário próprio; avatares e cenários anteriormente enviados permanecem. O servidor rejeita novos cenários próprios. Quadros ficam escalonados na diagonal dos dois lados da estante; painel inferior de resumo do acampamento foi retirado.

## Artes do calendário

Validação: build completo cliente/servidor, 18 testes VTT/social e 5 de
calendário/mascotes em PostgreSQL descartável; fluxos de navegador em duas
contas e telas 1440/768/390/320. Verificados capa do compromisso/fallback,
três espaços e equipamento de cartas persistido, perfil sem upload de cenário,
ações em uma linha, busca de mapas alinhada, boss/cura/morte, menus de formas e
polígonos, seleção de dados, arraste de consumível para atalhos, tranca/abas/
remoção, uso debitado e pixels de visão cinza/luz colorida/fog. Atualização
local com backup PostgreSQL completo antes das migrations; contagens, saldos,
progressão e documento das mesas preservados, salvo os três campos de visão
explicitamente corrigidos pela 061.

Geração nova via ferramenta image_gen incorporada (sem edição de referência), sem transparência, uma chamada por imagem. PNGs inspecionados visualmente; versões finais WebP de 1400 px, qualidade 88. Não usam imagens remotas. Arquivos servidos em public/calendar/.

### village-night-v1.webp

Arquivo: public/calendar/village-night-v1.webp

Prompt enviado:

Use case: stylized-concept. Asset type: wide landscape header background for a dark medieval fantasy RPG guild calendar on a website. Primary request: a generic everyday medieval village gathering place at night, calm empty tavern courtyard with stone paving, simple timber tables, a small lantern under a worn awning, distant modest houses. Style/medium: highly detailed realistic painted fantasy environment, coherent natural perspective, subtle texture. Composition/framing: wide 3:2 landscape, important scenery remains in the central horizontal band for banner cropping; open dark negative space on the left for a cream calendar heading. Lighting/mood: deep charcoal shadows, muted blue night, small soft amber lantern light; atmospheric, mundane and inviting. Palette: charcoal, desaturated slate, aged wood and restrained copper, no olive green cast. Constraints: no people, no text, no symbols, no ornate palace, no grand chandeliers, no watermark, no calendar drawn in the image.

### roadside-camp-v1.webp

Arquivo: public/calendar/roadside-camp-v1.webp

Prompt enviado:

Use case: stylized-concept. Asset type: wide landscape header background for a dark medieval fantasy RPG guild calendar. Primary request: a generic journey scene, a simple roadside camp at night with a low resting fire, modest canvas tent and travel packs, an empty stone path leading toward distant wooded mountains. Style/medium: highly detailed realistic painted fantasy environment, coherent natural perspective. Composition/framing: wide 3:2 landscape, important scenery in the central horizontal band for banner cropping, ample shadowed space on the left for a cream calendar heading. Lighting/mood: deep charcoal shadows, muted slate-blue night and soft restrained copper firelight, grounded everyday fantasy. Constraints: no people, no monsters, no readable text, no logo, no castle interior, no ornate palace, no strong olive green cast, no watermark, no calendar drawn in the image.

### guild-desk-v1.webp

Arquivo: public/calendar/guild-desk-v1.webp

Prompt enviado:

Use case: stylized-concept. Asset type: wide landscape header background for a dark medieval fantasy RPG guild calendar. Primary request: a generic quiet guild planning scene, a worn oak desk beside a rain-darkened window, a closed leather journal, rolled parchment charts, a small brass lantern, stone and simple timber surroundings. Style/medium: highly detailed realistic painted fantasy environment, rich tactile weathered materials, coherent perspective. Composition/framing: wide 3:2 landscape, important scenery in central horizontal band for banner cropping, darker negative space on left for a cream calendar heading. Lighting/mood: intimate deep charcoal shadows, muted slate-blue window light, subtle copper and amber lantern, mundane medieval atmosphere. Constraints: no people, no readable writing, no ornate palace, no luxurious chandeliers, no olive green cast, no watermark, no calendar drawn in the image.
