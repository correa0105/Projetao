import soundfile as sf, numpy as np, json, pathlib, hashlib, shutil, zipfile
root=pathlib.Path('.');src=root/'.local/vtt-sound-sources';out=root/'public/audio/vtt';out.mkdir(parents=True,exist_ok=True)
sources=json.loads((src/'sources.json').read_text());catalog=[];manifest=[];R=44100
for archive,directory in [('kenney-rpg.zip','kenney-rpg'),('rain-loopable-0.zip','rain')]:
 target=(src/directory).resolve()
 if not target.exists():
  with zipfile.ZipFile(src/archive) as z:
   for member in z.infolist():
    path=(target/member.filename).resolve()
    if not path.is_relative_to(target):raise ValueError('Invalid archive path')
   z.extractall(target)
def load(path):
 a,r=sf.read(path,dtype='float32',always_2d=True)
 if a.shape[1]==1:a=np.repeat(a,2,axis=1)
 if r!=R:
  n=round(len(a)*R/r);x=np.arange(n)*r/R;a=np.stack([np.interp(x,np.arange(len(a)),a[:,c]) for c in range(2)],axis=1).astype('float32')
 return a
def norm(a,rms=.12):
 a=a-np.mean(a,axis=0);actual=np.sqrt(np.mean(a*a));gain=min(rms/max(actual,1e-7),.89/max(np.max(np.abs(a)),1e-7));return a*gain
def seam(a,n=R):
 n=min(n,len(a)//6);t=np.linspace(0,1,n,dtype='float32')[:,None];a=a.copy();join=a[-n:]*(1-t)+a[:n]*t;return np.concatenate([join,a[n:-n]])
def tile(a,seconds,shift=0):
 a=seam(a);n=round(seconds*R);return np.roll(np.tile(a,(int(np.ceil(n/len(a))),1))[:n],shift,axis=0)
def add(id,name,kind,category,a,credit,description,inputs,loop=False,volume=.65):
 a=norm(a,.09 if kind=='ambience' else .12);file=out/(id+'.ogg')
 with sf.SoundFile(file,'w',samplerate=R,channels=2,format='OGG',subtype='VORBIS') as writer:
  for offset in range(0,len(a),8192):writer.write(a[offset:offset+8192])
 decoded,sr=sf.read(file,always_2d=True)
 assert np.isfinite(decoded).all() and np.max(np.abs(decoded))<.999 and np.sqrt(np.mean(decoded**2))>.005
 duration=len(decoded)/sr
 catalog.append(dict(id=id,name=name,kind=kind,category=category,path='/audio/vtt/'+file.name,duration=round(duration,4),loop=loop,volume=volume,credit=credit,description=description))
 manifest.append(dict(id=id,file=file.name,sha256=hashlib.sha256(file.read_bytes()).hexdigest(),bytes=file.stat().st_size,duration=duration,sampleRate=sr,channels=decoded.shape[1],rmsDb=round(float(20*np.log10(np.sqrt(np.mean(decoded**2)))),2),peakDb=round(float(20*np.log10(np.max(np.abs(decoded)))),2),sources=inputs))
 print(id,round(duration,2),file.stat().st_size,flush=True)
music=[('medieval-the-old-tower-inn','music-old-inn','A antiga taverna','Taverna','Uma trilha tranquila para encontros e histórias.'),('medieval-the-bards-tale','music-bards-tale','A canção do bardo','Taverna','Música medieval para conversa e descanso.'),('medieval-battle','music-battle','Ao combate','Batalha','Uma trilha de batalha para confrontos e perseguições.'),('medieval-exploration','music-exploration','Além das muralhas','Viagem','Exploração de estradas, ruínas e terras desconhecidas.'),('medieval-kings-feast','music-kings-feast','Banquete do rei','Castelo','Música para festas, salões e grandes celebrações.'),('fantasy-rising-moon','music-rising-moon','Lua crescente','Mistério','Uma noite de fantasia, silêncio e expectativa.'),('fantasy-lament-for-a-warriors-soul','music-warriors-lament','Lamento do guerreiro','Drama','Uma trilha melancólica para perdas e despedidas.')]
for slug,id,name,category,desc in music:add(id,name,'music',category,load(src/(slug+'.mp3')),'RandomMind',desc,[slug],True,.55)
names={'beltHandle1':'Fivela de couro 1','beltHandle2':'Fivela de couro 2','bookOpen':'Abrir livro','bookClose':'Fechar livro','bookFlip1':'Virar página 1','bookFlip2':'Virar página 2','bookFlip3':'Virar página 3','bookPlace1':'Colocar livro 1','bookPlace2':'Colocar livro 2','bookPlace3':'Colocar livro 3','chop':'Golpe de machado','cloth1':'Tecido 1','cloth2':'Tecido 2','cloth3':'Tecido 3','cloth4':'Tecido 4','clothBelt':'Ajustar cinto 1','clothBelt2':'Ajustar cinto 2','creak1':'Madeira rangendo 1','creak2':'Madeira rangendo 2','creak3':'Madeira rangendo 3','doorClose_1':'Fechar porta 1','doorClose_2':'Fechar porta 2','doorClose_3':'Fechar porta 3','doorClose_4':'Fechar porta 4','doorOpen_1':'Abrir porta 1','doorOpen_2':'Abrir porta 2','drawKnife1':'Sacar lâmina 1','drawKnife2':'Sacar lâmina 2','drawKnife3':'Sacar lâmina 3','dropLeather':'Largar bolsa de couro','handleCoins':'Moedas na bolsa 1','handleCoins2':'Moedas na bolsa 2','handleSmallLeather':'Bolsa de couro 1','handleSmallLeather2':'Bolsa de couro 2','knifeSlice':'Corte de lâmina 1','knifeSlice2':'Corte de lâmina 2','metalClick':'Encaixe metálico','metalLatch':'Tranca de metal','metalPot1':'Panela de metal 1','metalPot2':'Panela de metal 2','metalPot3':'Panela de metal 3'}
kenney=src/'kenney-rpg/Audio'
for p in sorted(kenney.glob('*.ogg')):
 key=p.stem;category='Passos' if key.startswith('footstep') else 'Portas' if key.startswith(('door','creak','metalLatch')) else 'Combate' if key.startswith(('knife','drawKnife','chop')) else 'Livros' if key.startswith('book') else 'Objetos'
 name=names.get(key,'Passo '+str(int(key[8:])+1) if key.startswith('footstep') else key)
 add('sfx-'+key.lower().replace('_','-'),name,'effect',category,load(p),'Kenney','Efeito individual para pontuar a cena.',['kenney-rpg/'+p.name])
for i in range(7):add('sfx-magic-'+str(i+1),['Pulso arcano','Faísca mágica','Encantamento','Ritual crescente','Selo mágico','Toque encantado','Onda de energia'][i],'effect','Magia',load(src/('magic-spell-sfx-'+str(i)+'.ogg')),'JaggedStone','Um efeito mágico curto, com cauda de energia.',['magic-spell-sfx-'+str(i)])
forest=load(src/'forest-ambience.mp3');fire=load(src/'fireplace-sound-loop.wav');river=load(src/'sea-and-river-wave-sounds-0.mp3');wind=load(src/'short-wind-sound-0.wav');rain=load(src/'rain/1.ogg')
for id,name,a,credit,slug,desc in [('forest','Floresta tranquila',forest,'TinyWorlds','forest-ambience','Pássaros e atmosfera de floresta.'),('hearth','Lareira acesa',fire,'PagDev','fireplace-sound-loop','Lenha e brasas estalando.'),('river','À beira do rio',river[:R*75],'RandomMind','sea-and-river-wave-sounds-0','Ondas leves junto à margem.'),('rain','Chuva constante',rain,'Ylmir','rain-loopable-0','Chuva em um ciclo contínuo.'),('wind','Vento nas ruínas',tile(wind,36),'remaxim','short-wind-sound-0','Correntes de vento e rajadas suaves.')]:add('amb-'+id,name,'ambience','Natureza' if id not in ['hearth','wind'] else 'Interiores' if id=='hearth' else 'Ruínas',seam(a),' / '.join([credit]),desc,[slug],True,.6)
def mix(parts,seconds=60):return seam(sum(tile(norm(a,.1),seconds,shift)*gain for a,gain,shift in parts),R*2)
for id,name,parts,inputs,desc in [('forest-camp','Acampamento na floresta',[(forest,.65,0),(fire,.5,R*7)],['forest-ambience','fireplace-sound-loop'],'Fogueira próxima e floresta ao redor.'),('rainy-shelter','Abrigo durante a chuva',[(rain,.8,0),(fire,.35,R*12)],['rain-loopable-0','fireplace-sound-loop'],'Chuva ao fundo, lenha estalando no abrigo.'),('riverside-camp','Fogueira à beira do rio',[(river,.65,0),(fire,.45,R*9)],['sea-and-river-wave-sounds-0','fireplace-sound-loop'],'Água na margem e fogo junto ao acampamento.'),('ruins-rain','Ruínas sob chuva',[(rain,.75,0),(wind,.3,R*6)],['rain-loopable-0','short-wind-sound-0'],'Vento entre pedras antigas e chuva constante.')]:add('amb-'+id,name,'ambience','Cenas compostas',mix(parts),'Alvorada Cinzenta · bases CC0',desc,inputs,True,.6)
# Foley sequence made from several separate steps, with an unobtrusive room tail.
steps=np.zeros((R*24,2),dtype='float32')
for i in range(42):
 a=load(kenney/('footstep%02d.ogg'%(i%10)));start=int((i*.55+.2)*R);end=min(len(steps),start+len(a));steps[start:end]+=a[:end-start]*(.7 if i%2 else .85)
add('amb-steps','Passos no corredor','ambience','Interiores',seam(steps),'Alvorada Cinzenta · Kenney','Uma sequência de passos para exploração de corredores.',['kenney-rpg/footstep00-09.ogg'],True,.5)
(root/'shared/vtt-sound-catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
(out/'manifest.json').write_text(json.dumps({'date':'2026-10-07','assets':manifest,'sources':sources},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
shutil.copyfile(src/'kenney-rpg/License.txt',out/'KENNEY-LICENSE.txt')
(out/'CREDITS.md').write_text('''# Biblioteca de som — Alvorada Cinzenta

Todos os arquivos incluídos têm bases CC0 1.0. Podem ser usados no site com acesso pago. Os nomes em português não substituem os nomes originais dos autores.

- **RandomMind**: [músicas medievais](https://opengameart.org/content/cc0-audio-uploader-randommind), The Old Tower Inn, The Bard’s Tale, Battle, Exploration, King’s Feast, Rising Moon, Lament for a Warrior’s Soul (reupload) e Sea and river wave sounds.
- **Kenney Vleugels**: [RPG Audio, 50 efeitos](https://kenney.nl/assets/rpg-audio). Licença do pacote conservada em KENNEY-LICENSE.txt.
- **JaggedStone**: [Magic Spell SFX](https://opengameart.org/content/magic-spell-sfx), magical_1 a magical_7.
- **TinyWorlds**: [Forest Ambience](https://opengameart.org/content/forest-ambience).
- **PagDev**: [Fireplace Sound loop](https://opengameart.org/content/fireplace-sound-loop).
- **Ylmir**: [Rain (loopable)](https://opengameart.org/content/rain-loopable), versão OGG.
- **remaxim**: [Short wind sound](https://opengameart.org/content/short-wind-sound).
- **Alvorada Cinzenta**: composições Acampamento na floresta, Abrigo durante a chuva, Fogueira à beira do rio, Ruínas sob chuva e sequência Passos no corredor. Mistura/posicionamento temporal próprios de bases CC0; ciclos com sobreposição e normalização. Essas composições também são disponibilizadas como CC0 1.0.

Licença: https://creativecommons.org/publicdomain/zero/1.0/

Referência de organização e qualidade: https://tabletopaudio.com/ e SoundPad. Nenhum áudio do Tabletop Audio foi incorporado; suas restrições de uso são diferentes. Este projeto não é afiliado ao Tabletop Audio.

manifest.json identifica fontes, hashes originais/finais, duração e medições dos arquivos. Tratamento aplicado: remoção de DC, ganho RMS com limite de pico, OGG estéreo 44,1 kHz e sobreposição dos ciclos de ambiente. As músicas preservam a composição original.
''',encoding='utf8')
print('TOTAL',len(catalog),sum(a['bytes'] for a in manifest))
