# Configurações de som — 04/10/2026

O ícone de som abre dois controles horizontais: **Músicas** e **Efeitos sonoros**.
Cada canal tem volume de 0–100%, percentual e botão próprio de silenciar/ativar.
As preferências continuam no navegador, tanto no login quanto no perfil e na
visão da Ginna. Escape e clique fora fecham o painel; Escape devolve o foco
ao botão. O painel cabe também nos celulares de 320 px.

`src/SiteMusic.tsx` mantém os canais separados:

- `useMusicInterlude()`: músicas do site, faixa da loja e trilha temporária da
  Ginna. O interlúdio preserva a posição da música principal para retomá-la.
- `#events` e `#tower` têm faixas próprias no mesmo reprodutor central: **Vigília
  das Lanternas** (harpa e sopro suave) e **Além do Véu** (cordas graves e sinos).
  Ambas são composições originais de 96 segundos em loop. O vento do Átrio segue
  o canal de efeitos, com panorama estéreo durante o apagamento das luzes.
- `useSoundEffects()`: sino da loja, pergaminho da lore, objetos sobre o balcão,
  batimentos da Ginna, emergência/envolvimento dos tentáculos e respiração.
- `useLoreScrollSound()`: continua fornecendo o disparo do pergaminho, mas seu
  volume e silêncio seguem o canal de efeitos.

Mudar ou silenciar um canal não muda o outro. Efeitos são interrompidos quando
seu canal é silenciado ou chega a zero, sem repetir sons antigos ao reativar.
Ocultar a aba e desmontar as cenas mantém os cancelamentos existentes.

Na reação à pergunta “E se eu causar problemas aqui?”, a música do Átrio pausa
ao completar 4,2 segundos visíveis, quando o cenário fica preto. Continua pausada
na iluminação vermelha e retoma da mesma posição ao voltar a um assunto neutro,
pedir desculpas ou fechar a conversa. Insistir nas provocações mantém a pausa e
a mesma reação, sem reiniciar o apagamento. Navegar troca diretamente para a faixa da nova área. A sequência,
o vento e as animações pausam na aba oculta; fechar ou sair cancela os disparos
pendentes. Silenciar efeitos interrompe o vento sem alterar a música nem repetir
a rajada ao reativar. O gerador e hashes dos três áudios estão em
`scripts/generate-atrium-tower-audio.mjs` e `data/atrium-tower-audio-20261031.json`;
não há amostras externas. Licença CC0 com uso comercial permitido em
`public/audio/atrium-tower-20261031-license.txt`, acessível nos créditos de áudio.

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

A sequência do Átrio e a navegação real entre Átrio/Torre/loja/início são verificadas
por `node scripts/test-atrium-ambience-isolated.mjs`, no Edge e em banco descartável.
Por padrão, o teste usa o cliente em `.local/atrium-ambient-client-20261031`;
`ATRIUM_CLIENT_DIR` permite apontar outro build. A visibilidade é simulada por
evento no Edge sem janela; mídia real e estados CSS são inspecionados.

Verificação da revisão concluída no Edge: controles independentes, áudio HTML
e Web Audio, persistência, migração, ausência de armazenamento, teclado,
login/perfil/celular, continuidade da música e música/batimento da Ginna.
As suites da loja e tentáculos também passaram; TypeScript e build passaram,
e a versão Docker foi atualizada. Capturas de layout incluem telas de 320 px.
