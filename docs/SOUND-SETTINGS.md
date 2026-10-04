# Configurações de som — 04/10/2026

O ícone de som abre dois controles horizontais: **Músicas** e **Efeitos sonoros**.
Cada canal tem volume de 0–100%, percentual e botão próprio de silenciar/ativar.
As preferências continuam no navegador, tanto no login quanto no perfil e na
visão da Ginna. Escape e clique fora fecham o painel; Escape devolve o foco
ao botão. O painel cabe também nos celulares de 320 px.

`src/SiteMusic.tsx` mantém os canais separados:

- `useMusicInterlude()`: músicas do site, faixa da loja e trilha temporária da
  Ginna. O interlúdio preserva a posição da música principal para retomá-la.
- `useSoundEffects()`: sino da loja, pergaminho da lore, objetos sobre o balcão,
  batimentos da Ginna, emergência/envolvimento dos tentáculos e respiração.
- `useLoreScrollSound()`: continua fornecendo o disparo do pergaminho, mas seu
  volume e silêncio seguem o canal de efeitos.

Mudar ou silenciar um canal não muda o outro. Efeitos são interrompidos quando
seu canal é silenciado ou chega a zero, sem repetir sons antigos ao reativar.
Ocultar a aba e desmontar as cenas mantém os cancelamentos existentes.

As chaves anteriores `alvorada-music-volume` e `alvorada-music-muted` continuam
para músicas. As novas são `alvorada-effects-volume` e `alvorada-effects-muted`.
Na primeira visita após a atualização, efeitos herdam os valores antigos,
que antes controlavam todos os sons, e passam a ser persistidos separadamente.
Sem preferências existentes, ambos iniciam em 40%, ativos. Somente preferências
de áudio usam localStorage; dados de jogo continuam no PostgreSQL.

Verificação sem banco: `node scripts/smoke-sound-settings.mjs`,
`node scripts/smoke-shop-counter-audio.mjs` e
`node scripts/smoke-ginna-tentacle-audio.mjs`. O fluxo com login, perfil,
continuidade de faixas e sino é verificado em banco descartável por
`node scripts/test-world-dragon-isolated.mjs`.

Verificação da revisão concluída no Edge: controles independentes, áudio HTML
e Web Audio, persistência, migração, ausência de armazenamento, teclado,
login/perfil/celular, continuidade da música e música/batimento da Ginna.
As suites da loja e tentáculos também passaram; TypeScript e build passaram,
e a versão Docker foi atualizada. Capturas de layout incluem telas de 320 px.
