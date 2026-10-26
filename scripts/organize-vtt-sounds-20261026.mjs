import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),path=new URL('shared/vtt-sound-catalog.json',root),catalog=JSON.parse(await readFile(path,'utf8'));
const descriptions=[
  [/^sfx-belthandle/,'O couro e a fivela se movem ao manusear uma correia ou peça de equipamento.',['couro','equipamento']],
  [/^sfx-bookclose/,'Um livro é fechado, com contato seco da capa e das páginas.',['livro','biblioteca']],
  [/^sfx-bookflip/,'Uma página é virada; use ao ler um grimório, diário ou documento.',['livro','página']],
  [/^sfx-bookopen/,'Um livro é aberto para leitura ou consulta de um grimório.',['livro','grimório']],
  [/^sfx-bookplace/,'Um livro é apoiado numa superfície; útil em bibliotecas e estudos.',['livro','biblioteca']],
  [/^sfx-clothbelt/,'Uma correia ou cinto de tecido é ajustado junto ao equipamento.',['tecido','equipamento']],
  [/^sfx-cloth/,'Movimento curto de tecido, para roupas, capas e bolsas.',['tecido','roupa']],
  [/^sfx-creak/,'Rangido de madeira; pontua tábuas antigas, portas e móveis sob pressão.',['madeira','rangido']],
  [/^sfx-doorclose-/,'Uma porta de madeira se fecha com batente curto.',['porta','fechar']],
  [/^sfx-dooropen-/,'Uma porta de madeira é aberta; combine com um rangido para uma passagem antiga.',['porta','abrir']],
  [/^sfx-drawknife/,'Uma lâmina curta é sacada antes de um ataque ou ameaça.',['arma','adaga']],
  [/^sfx-dropleather/,'Uma bolsa ou peça de couro é largada sobre uma superfície.',['couro','bolsa']],
  [/^sfx-footstep/,'Passo isolado para acompanhar a movimentação. Ative um intervalo para repetir a caminhada.',['passos','caminhada']],
  [/^sfx-handlecoins/,'Moedas tilintam ao manusear uma bolsa; para pagamento, saque ou tesouro.',['moedas','ouro','tesouro']],
  [/^sfx-handlesmallleather/,'Uma pequena bolsa de couro é manuseada; útil para inventário e ferramentas.',['couro','bolsa']],
  [/^sfx-metalclick/,'Duas peças metálicas se encaixam com um clique curto.',['metal','mecanismo']],
  [/^sfx-metallatch/,'Uma tranca de metal é acionada; para portas, baús ou grades.',['tranca','fechadura']],
  [/^sfx-metalpot/,'Uma panela ou recipiente metálico é tocado e movimentado.',['metal','cozinha']],
  [/^sfx-knifeslice/,'Uma lâmina corta o ar em um movimento rápido de ataque.',['arma','corte']],
  [/^sfx-chop$/,'Golpe curto de machado ou ferramenta cortante.',['arma','machado']],
  [/^sfx-creature-monster/,'Voz gutural de monstro para uma presença próxima ou uma reação da criatura.',['monstro','voz']],
  [/^sfx-creature-roar/,'Rugido de criatura para ameaça, desafio ou início de confronto.',['monstro','rugido']],
  [/^sfx-creature-troll/,'Vocalização grave de troll para fala bestial ou reação em combate.',['troll','voz']],
  [/^sfx-creature-grunt/,'Rosnado curto de criatura, para hostilidade e esforço.',['monstro','rosnado']],
  [/^sfx-creature-hurt/,'Reação vocal de uma criatura ferida ou atingida.',['monstro','dor']],
  [/^sfx-creature-bug/,'Vocalização de inseto monstruoso, para túneis, colmeias e encontros.',['inseto','criatura']],
  [/^sfx-creature-cute/,'Pequena vocalização aguda de criatura fictícia ou familiar.',['familiar','criatura pequena']],
  [/^sfx-creature-weird/,'Voz estranha e não humana para aberrações e presenças sobrenaturais.',['aberração','voz']],
  [/^sfx-creature-barking/,'Latido isolado de cão para alerta, resposta ou encontro com animais.',['cachorro','cão','latido']],
  [/^sfx-creature-howl/,'Uivo de animal para uma alcateia, ameaça distante ou floresta noturna.',['lobo','uivo']],
  [/^sfx-creature-breath/,'Respiração audível de uma fera próxima, para pausa e tensão.',['fera','respiração']],
  [/^sfx-beast-growl/,'Rosnado animal grave para uma fera ameaçando ou protegendo seu território.',['fera','rosnado']],
  [/^sfx-beast-voice/,'Vocalização bestial para grandes animais ou criaturas de um covil.',['fera','voz']],
];
for(const e of catalog){
  const match=descriptions.find(([pattern])=>pattern.test(e.id));
  if(match){e.description=match[1];e.tags=match[2];}
  if(e.id==='sfx-beast-growl')e.name='Rosnado de fera 3';
  if(e.id==='sfx-beast-voice')e.name='Voz de fera 4';
  if(/undead|specter/.test(e.id))e.tags=[...(e.tags||[]),'morto-vivo','fantasma'];
  if(/giant-roar|creature-roar|distant-beast/.test(e.id))e.tags=[...(e.tags||[]),'dragão','rugido'];
  if(/creature-bug|cavern-insect|bat-swarm/.test(e.id))e.tags=[...(e.tags||[]),'insetos','enxame'];
  if(!e.tags?.length)e.tags=[e.category.toLocaleLowerCase('pt-BR'),e.kind==='music'?'trilha':e.kind==='ambience'?'ambiente':'efeito'];
  e.tags=[...new Set(e.tags)];
}
await writeFile(path,JSON.stringify(catalog,null,2)+'\n');
console.log('Organized',catalog.length,'sounds; no media files changed.');
