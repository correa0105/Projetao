"""Append-only CC0 audio expansion. Explicit maintenance, never startup/seed.

Usage: python build-vtt-audio-20261026.py [optional-dependency-directory]
Requires numpy, scipy, soundfile and pyloudnorm. Source downloads are pinned by
prepare-vtt-audio-20261026.mjs. Existing media is always checked and preserved.
"""
import sys
if len(sys.argv) > 1: sys.path.insert(0, sys.argv[1])
import io, json, hashlib, zipfile
from pathlib import Path
import numpy as np
import soundfile as sf
import pyloudnorm as pyln
from scipy.signal import resample_poly, butter, sosfilt, fftconvolve

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'public/audio/vtt'
CAT=ROOT/'shared/vtt-sound-catalog.json'
MAN=OUT/'manifest.json'
RATE=48000
catalog=json.loads(CAT.read_text(encoding='utf8'))
manifest=json.loads(MAN.read_text(encoding='utf8'))
batch=json.loads((ROOT/'data/vtt/audio-expansion-20261026-sources.json').read_text(encoding='utf8'))
sources={s['slug'].removeprefix('audio-20261026-'):s for s in batch['sources']}
sha=lambda b:hashlib.sha256(b).hexdigest()
for a in manifest['assets']:
    assert sha((OUT/a['file']).read_bytes())==a['sha256'],a['id']
for s in sources.values():
    p=ROOT/s['file'];assert p.stat().st_size==s['bytes'] and sha(p.read_bytes())==s['sha256'],s['slug']
assert not any(e['id'].startswith(('music-scene-','sfx-scene-','sfx-screen-','amb-scene-')) for e in catalog),'Already built; do not overwrite assets.'
old_media={a['id']:a['sha256'] for a in manifest['assets']}
rng=np.random.default_rng(20261026)
cache={}

def read(file):
    a,rate=sf.read(file,dtype='float32',always_2d=True)
    if a.shape[1]==1:a=np.repeat(a,2,axis=1)
    a=a[:,:2]
    if rate!=RATE:
        from math import gcd
        g=gcd(rate,RATE);a=resample_poly(a,RATE//g,rate//g,axis=0)
    assert np.isfinite(a).all()
    return a.astype('float32')
def source(key):
    if key not in cache:cache[key]=read(ROOT/sources[key]['file'])
    return cache[key].copy()
def fade(a,attack=.025,release=.12):
    a=a.copy();n=min(round(attack*RATE),len(a)//3);m=min(round(release*RATE),len(a)//3)
    if n:a[:n]*=np.linspace(0,1,n)[:,None]
    if m:a[-m:]*=np.linspace(1,0,m)[:,None]
    return a
def loop(a,seconds=40,overlap=1.):
    n=round(seconds*RATE);out=np.zeros((n+len(a),2),dtype='float32');step=max(1,len(a)-round(overlap*RATE))
    for at in range(0,n,step):out[at:at+len(a)]+=fade(a,overlap,overlap)
    return out[:n]
def low(a,hz=6000):return sosfilt(butter(3,hz,fs=RATE,output='sos'),a,axis=0).astype('float32')
def mix(seconds,parts):
    a=np.zeros((round(seconds*RATE),2),dtype='float32')
    for b,at,gain in parts:
        n=round(at*RATE);k=min(len(b),len(a)-n)
        if k>0:a[n:n+k]+=b[:k]*gain
    return a
def normalize(a,target):
    a-=a.mean(axis=0)
    meter=pyln.Meter(RATE)
    padded=np.pad(a,((0,max(0,RATE-len(a))),(0,0)))
    loud=meter.integrated_loudness(padded)
    if np.isfinite(loud):a*=10**((target-loud)/20)
    # Oversampled ceiling, with headroom for lossy encoding; no hard clipping.
    peak=float(np.max(np.abs(resample_poly(a,4,1,axis=0))))
    if peak>10**(-2.5/20):a*=10**(-2.5/20)/peak
    return a
def add(id,name,kind,category,a,description,provenance,scenarios,tags):
    a=normalize(a,-21 if kind=='music' else -24 if kind=='ambience' else -20)
    path=OUT/(id+'.ogg');assert not path.exists()
    # libsndfile's VBR Vorbis output is stereo 48 kHz. Encode in bounded blocks.
    with sf.SoundFile(path,'w',samplerate=RATE,channels=2,format='OGG',subtype='VORBIS') as f:
        for start in range(0,len(a),65536):f.write(a[start:start+65536])
    decoded=read(path);peak=float(np.max(np.abs(resample_poly(decoded,4,1,axis=0))))
    assert np.isfinite(decoded).all() and peak<.95 and np.sqrt(np.mean(decoded**2))>.0001,id
    loud=pyln.Meter(RATE).integrated_loudness(np.pad(decoded,((0,max(0,RATE-len(decoded))),(0,0))))
    authors=sorted(set(sources[k]['author'] for k in provenance if k in sources))
    credit=' / '.join(authors) if authors else 'Alvorada Cinzenta · composição com fontes CC0'
    catalog.append(dict(id=id,name=name,kind=kind,category=category,path='/audio/vtt/'+path.name,duration=round(len(decoded)/RATE,4),loop=kind!='effect',volume=.55 if kind=='music' else .6,credit=credit,description=description,scenarios=scenarios,tags=tags))
    manifest['assets'].append(dict(id=id,file=path.name,sha256=sha(path.read_bytes()),bytes=path.stat().st_size,duration=len(decoded)/RATE,sampleRate=RATE,channels=2,rmsDb=round(20*np.log10(max(float(np.sqrt(np.mean(decoded**2))),1e-8)),2),peakDb=round(20*np.log10(max(float(np.max(np.abs(decoded))),1e-8)),2),lufs=round(loud,2),truePeakDb=round(20*np.log10(max(peak,1e-8)),2),sources=[sources[k]['slug'] if k in sources else k for k in provenance]))
    print(id,round(len(decoded)/RATE,1),round(loud,1),flush=True)

music=[
('market-day','Dia de feira','Cidade e taverna','Melodia medieval animada para compras, feiras e encontros na vila.','Taverna e cidade',['mercado','comércio','alegre']),
('minstrel-dance','Dança dos menestréis','Cidade e taverna','Dança medieval para bardos, festas populares e uma taverna movimentada.','Taverna e cidade',['bardo','dança','festa']),
('rejoicing','Celebração na vila','Celebração','Música festiva para o retorno dos aventureiros, banquetes e boas notícias.','Taverna e cidade',['alegria','vitória','festa']),
('harvest','Tempo de colheita','Viagem','Tema campestre para aldeias, fazendas e travessias tranquilas.','Viagem e natureza',['campo','aldeia','tranquilo']),
('final-battle','O confronto final','Batalha','Orquestra dramática para o guardião final e combates decisivos.','Combate e perigos',['chefe','boss','épico']),
('hope','Resistir até o amanhecer','Batalha','Tema orquestral de batalha com energia e esperança, em ciclo musical.','Combate e perigos',['heroico','orquestra','ação']),
('orchestral-theme','O chamado da aventura','Épico','Abertura orquestral que cresce de uma passagem serena a um clímax.','Viagem e natureza',['abertura','jornada','orquestra']),
('home','De volta ao lar','Drama','Peça orquestral calma para abrigo, reconciliação e descanso.','Drama e celebração',['calmo','descanso','melancolia']),
('dungeon','Nas profundezas','Mistério','Texturas musicais escuras para explorar uma masmorra desconhecida.','Masmorras e ruínas',['subterrâneo','tensão','exploração']),
('evil-approach','O mal se aproxima','Tensão','Cordas e tensão crescente para revelar uma ameaça ou preparar uma emboscada.','Combate e perigos',['ameaça','suspense','sombrio']),
('dark-shrine','Santuário nas sombras','Mistério','Tema sombrio de santuário para criptas, cultos e lugares abandonados.','Magia e sobrenatural',['ritual','templo','terror']),
('serpents','O poder das serpentes','Mistério','Tema misterioso para ruínas antigas, descobertas e segredos de um templo.','Masmorras e ruínas',['templo','antigo','mistério']),
]
for key,name,category,description,scenario,tags in music:
    a=source(key)
    # Preserve the author's entire arrangement, with millisecond edge fades only.
    add('music-scene-'+key,name,'music',category,fade(a,.006,.025),description,[key],[scenario],tags)
for key,name,desc in [
('park-birds','Bosque com pássaros','Gravação de campo: pássaros conversando entre árvores antes da chuva; sem música.'),
('park-river','Córrego e vida silvestre','Gravação de campo: água corrente, pássaros e fauna próxima; sem música.'),
('park-wind','Campo aberto ao vento','Gravação de campo: rajadas atravessam uma área aberta; sem música.')]:
    a=source(key)[RATE*5:RATE*80];a=loop(a,70,1.5)
    add('amb-scene-'+key,name,'ambience','Natureza',a,desc,[key],['Viagem e natureza'],['exterior','campo','real','paisagem'])

archive=zipfile.ZipFile(ROOT/sources['foley']['file'])
def foley(key):return read(io.BytesIO(archive.read('sfx100v2_'+key+'.ogg')))
effects=[
('thunder_01','Trovão próximo','Clima','Um trovão grave e prolongado, para tempestade ou presságio.','Viagem e natureza'),
('air_01','Rajada de ar','Clima','Sopro de ar em passagem curta, para uma fresta ou abertura repentina.','Viagem e natureza'),
('air_02','Ar escapando','Clima','Ar sob pressão sendo liberado; serve a válvulas e mecanismos.','Masmorras e ruínas'),
('footstep_wet_01','Passo em solo molhado','Passos','Passada curta sobre uma superfície úmida, com respingo.','Viagem e natureza'),
('footstep_wet_02','Passo pesado na água','Passos','Contato mais pesado com o chão encharcado.','Viagem e natureza'),
('footstep_wet_03','Passo com respingo','Passos','Um respingo isolado de pé em superfície molhada.','Viagem e natureza'),
('footstep_wood_01','Passo no assoalho','Passos','Passada sobre tábuas, para casas, tavernas e pontes.','Taverna e cidade'),
('footstep_wood_02','Passo na ponte de madeira','Passos','Contato de pé com madeira, para uma travessia sobre tábuas.','Viagem e natureza'),
('glass_01','Vidro quebrando','Vidro e cerâmica','Quebra de vidro para frascos, copos e pequenos objetos.','Objetos e ações'),
('glass_02','Estilhaços de vidro','Vidro e cerâmica','Impacto seguido de pequenos fragmentos de vidro.','Objetos e ações'),
('glass_03','Frasco se partindo','Vidro e cerâmica','Vidro se parte em um impacto curto; útil para poções e alquimia.','Objetos e ações'),
('glass_04','Vidro atingido','Vidro e cerâmica','Outro impacto em vidro, para variar o material da cena.','Objetos e ações'),
('lock_open_01','Destrancar fechadura','Fechaduras','Clique de uma fechadura sendo aberta, para baús e portas.','Masmorras e ruínas'),
('metal_01','Metal sendo manuseado','Metal','Pequeno movimento de peças metálicas, para ferramentas e mecanismos.','Objetos e ações'),
('metal_02','Peças de metal','Metal','Contato e vibração de peças metálicas soltas.','Objetos e ações'),
('metal_03','Raspagem metálica','Metal','Movimento de metal com ressonância curta.','Objetos e ações'),
('metal_hit_01','Impacto em metal','Combate','Batida seca e ressonante em uma superfície de metal.','Combate e perigos'),
('metal_hit_02','Pancada metálica','Combate','Pancada alternativa para escudos, grades e estruturas metálicas.','Combate e perigos'),
('stones_01','Pedras pequenas caindo','Pedra e entulho','Pedras se chocam e se acomodam, para trilhas e ruínas.','Masmorras e ruínas'),
('stones_02','Cascalho deslocado','Pedra e entulho','Fragmentos de pedra em um movimento curto.','Masmorras e ruínas'),
('stones_03','Pedras se chocando','Pedra e entulho','Contato de pedras com pequenos impactos sucessivos.','Masmorras e ruínas'),
('wood_hit_01','Batida em madeira','Madeira','Impacto curto em tábuas ou mobiliário de madeira.','Objetos e ações'),
('wood_hit_02','Pancada na porta','Madeira','Batida ressonante para porta, barril ou caixa de madeira.','Taverna e cidade'),
('wood_hit_03','Golpe em estrutura de madeira','Madeira','Pancada alternativa sobre uma peça de madeira.','Combate e perigos'),
]
for key,name,category,desc,scenario in effects:
    add('sfx-scene-'+key.replace('_','-'),name,'effect',category,fade(foley(key),.006,.05),desc,['foley'],[scenario],[category.lower(),'ação'])

# Full-screen cues: restrained layered sound design, no synthetic hard clipping.
def old(id):return read(OUT/next(a['file'] for a in manifest['assets'] if a['id']==id))
def scatter(a,seconds,count,gain=.25):
    return [(a,float(at),gain*float(rng.uniform(.5,1))) for at in sorted(rng.uniform(.3,seconds-len(a)/RATE-.4,count))]
seconds=24
rumble=loop(old('sfx-dungeon-distant-tremor'),seconds,1.5)
wind=loop(low(source('park-wind')[RATE*10:RATE*35],2200),seconds,1.)
rain=loop(old('amb-rain'),seconds,1.)
hearth=loop(old('amb-hearth'),seconds,1.)
screen={
'earthquake':('Tremor com terra e cascalho',mix(seconds,[(rumble,0,.65)]+scatter(foley('stones_02'),seconds,12,.2)),['audio-local:distant-tremor','foley'],'Tremor grave, cascalho e terra caindo em camadas, com espaço para a narração.'),
'cave-in':('Desabamento com poeira',mix(seconds,[(rumble,0,.5)]+scatter(old('sfx-dungeon-falling-rubble'),seconds,5,.28)+scatter(foley('stones_01'),seconds,13,.22)),['audio-local:falling-rubble','foley'],'Ruptura de pedra, fragmentos em queda e uma cauda grave controlada.'),
'thunderstorm':('Tormenta com trovões',mix(seconds,[(rain,0,.7),(wind,0,.15),(foley('thunder_01'),2,.7),(foley('thunder_01'),13,.5)]),['audio-local:rain','foley','park-wind'],'Chuva contínua com dois trovões espaçados e vento discreto.'),
'blizzard':('Vento de nevasca',mix(seconds,[(wind,0,.8),(loop(low(old('amb-wind'),1800),seconds,1.),0,.35)]),['park-wind','audio-local:wind'],'Camadas de vento filtrado para uma nevasca, sem frequências agudas agressivas.'),
'embers':('Fogo, cinzas e brasas',mix(seconds,[(hearth,0,.75),(wind,0,.08)]),['audio-local:hearth','park-wind'],'Crepitar natural e ar em movimento para cinzas e brasas flutuantes.'),
'haunting':('Presença espectral distante',mix(seconds,[(wind,0,.3)]+scatter(low(old('sfx-dungeon-specter-wail'),2600),seconds,3,.12)),['audio-local:specter-wail','park-wind'],'Vento frio e lamentos distantes, com reverberação e volume contido.'),
'arcane':('Pulso e ruptura arcana',mix(seconds,[(wind,0,.08)]+scatter(old('sfx-magic-4'),seconds,5,.22)+scatter(old('sfx-magic-7'),seconds,4,.15)),['audio-local:magic-4','audio-local:magic-7','park-wind'],'Pulsos arcanos em camadas e ressonância suave para uma ruptura de energia.'),
}
for key,(name,a,provenance,description) in screen.items():
    add('sfx-screen-'+key,name,'effect','Efeitos de tela',fade(a,.7,1.5),description,provenance,['Efeitos imersivos'],['tela inteira','cinemático',key])
for s in sources.values():
    if not any(p['slug']==s['slug'] for p in manifest['sources']):manifest['sources'].append(s)
manifest['date']='2026-10-26'
assert all(next(a['sha256'] for a in manifest['assets'] if a['id']==id)==digest for id,digest in old_media.items())
CAT.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
MAN.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
credits='\n\n## Ampliação de 26/10/2026\n\nFontes CC0 verificadas nas páginas dos autores em 26/10/2026.\n'
for s in sources.values():credits+=f"\n- {s['author']}: [{s['slug']}]({s['page']}) — CC0-1.0. SHA-256 e arquivo em manifest.json."
credits+='\n\nAs sete composições de tela usam estas bases e os efeitos CC0 já creditados acima. Músicas preservam os arranjos completos dos autores. Novos arquivos: estéreo 48 kHz, volume integrado medido e pico verdadeiro com margem antes/depois da codificação. Originais anteriores preservados.\n'
with (OUT/'CREDITS.md').open('a',encoding='utf8') as f:f.write(credits)
print('TOTAL',len(catalog),flush=True)
