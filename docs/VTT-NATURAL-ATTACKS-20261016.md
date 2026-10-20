# Animações dos ataques naturais — 16/10/2026

A seleção Automática do ataque identifica nomes em português/inglês, usando
somente a parte depois do nome do ator. `Adult Black Dragon · Rend` passa a
mostrar **Garras**. Mordida não usa espada e cauda não usa corte de lâmina.

Treze famílias compartilhadas atendem o acervo: mordida, garras, cauda, chifres,
pancada, ferrão, tentáculo, bico, cascos, asas, toque sobrenatural, pinças e
rajada sobrenatural. São modelos por tipo de golpe, não 330 ilustrações novas
por monstro. Ataques com armas continuam escolhendo sua arma; sopros/efeitos
de magias continuam no sistema de magias existente.

Mordida fecha duas mandíbulas; garras têm três unhas curvas e rastros separados;
cauda/tentáculo varrem um arco; ferrão e chifre avançam; pancadas têm contato
amplo. Mordida, garras e cauda usam três ilustrações originais transparentes
criadas individualmente pelo imagegen embutido, reduzidas a até 640 px. Os outros
sprites usam Canvas 2D com relevo e materiais derivados dessas mesmas artes,
poros, ranhuras e luz de borda. Texturas e sprites ficam em cache, sem custo de
geração a cada frame. Prompts, recortes, hashes e dimensões estão em
`data/vtt/natural-attacks-20261016.json`; arquivos em
`public/vtt/natural-attacks-20261016/`. Tokens e acervo de monstros preservados.

Em 20/10, **Soco/Pancada (`slam`)** usa uma nova ilustração de **luva de couro
fechada semirrealista**, conforme os ajustes do usuário. Sem mão nua nem estilo
fotográfico. Arte original do imagegen embutido, com fundo realmente transparente,
convertida para WebP 640×477 (85.526 bytes). Arquivo versionado em
`public/vtt/natural-attacks-20261020/fist-leather-glove-v1.webp`; prompt completo,
origem, dimensões e hashes em `data/vtt/fist-leather-glove-20261020.json`.

Foi alterado somente o carregamento do sprite `slam`. Os arquivos de movimento
natural/armas permanecem idênticos: avanço, direção, tempos (1300 ms), impacto,
erro e crítico, sons e aplicação de dano conservados. A arte é pré-carregada e
reutilizada, sem gerar textura nem fazer pedido de rede por frame. O desenho
anterior continua como fallback se a imagem não carregar. Não concede luvas ao
inventário e não exige luvas equipadas; é apenas a apresentação do golpe.

QA do renderer real: comparação em quatro fases, quatro direções, acerto/erro e
crítico, desktop/celular; 57 frames dos outros 19 tipos ficaram idênticos pixel
a pixel. P95 de desenho em 100 amostras: 0,2 ms nesta máquina. Cinco testes de
seleção/contrato e TypeScript/build aprovados. Sem migration ou edição de dados.

Publicação `fist-leather-20261020` saudável: HTML, bundles e WebP conferidos em
localhost/Radmin; servidor idêntico ao anterior. Auditoria de 146 tabelas manteve
145 integralmente idênticas; somente o heartbeat do ilustrador avançou.

Todos usam direção atacante → alvo, tamanho limitado pelo alvo, trajetória de
erro deslocada, impacto somente no acerto e realce no crítico. São efeitos
visuais: não aplicam PV/dano automaticamente. Preservam Sem animação e som,
volume/mute, movimento reduzido, pausa em aba oculta, visibilidade e descarte.
Sons físicos reaproveitam os arquivos já existentes do VTT.

O contrato de evento JSONB acrescenta `kind: natural` com tipo obrigatório;
eventos anteriores de espada/flecha continuam legíveis. Protocolo VTT 22 pede
recarregar clientes antigos antes de alterar a mesa. Não há migration de VTT,
reescrita de documentos nem retomada da revisão pausada dos monstros.

Verificação: nomes PT/EN, todos os 252 ataques nomeados de mordida/garra/cauda/
ferrão/tentáculo/chifre/bico/casco/pancada/toque/pinça identificados no catálogo;
as outras famílias também têm casos próprios. Fluxo real de atalhos de Bite,
Rend e Tail, eventos das treze famílias, contrato/ownership no servidor, ausência
de débito de PV e frames móveis/estáticos no renderer. Vinte e um frames das
sete armas anteriores são comparados pixel a pixel com o código do commit base.

Reprodução: `node --import tsx --test tests/vtt-natural-animation.test.ts
tests/vtt-weapon-animation.test.ts` e `node scripts/test-vtt-natural-isolated.mjs`
depois do build do cliente. Testes integrados usam somente banco UUID descartável.
