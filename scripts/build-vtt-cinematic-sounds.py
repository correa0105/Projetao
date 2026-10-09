"""Compose short cinematic cues from credited CC0 recordings and original DSP.
Offline asset generator only; no runtime Python dependency.
"""
import sys,json,hashlib,math
from pathlib import Path
if len(sys.argv)>1: sys.path.insert(0,sys.argv[1])
import numpy as np
import soundfile as sf
from scipy.signal import butter,sosfilt
RATE=44100
ROOT=Path.cwd()
jobs=json.loads((ROOT/'data/vtt/cinematic-sound-jobs.json').read_text(encoding='utf-8'))
catalog={a['id']:a for a in json.loads((ROOT/'shared/vtt-sound-catalog.json').read_text(encoding='utf-8'))}
sources={}
def source(key):
 if key not in sources:
  a=catalog[key];samples,sr=sf.read(ROOT/'public'/a['path'].lstrip('/'),dtype='float32',always_2d=True)
  if sr!=RATE: raise ValueError('Source sample rate')
  if samples.shape[1]==1:samples=np.repeat(samples,2,axis=1)
  sources[key]=samples[:,:2]
 return sources[key]
recipes={
 'fire':(['amb-hearth','sfx-chop1','sfx-magic-1'],110,9200),
 'frost':(['sfx-metalclick1','sfx-metallatch1','sfx-magic-2'],350,13000),
 'lightning':(['sfx-magic-3','sfx-metalpot1','sfx-metalclick2'],170,10500),
 'acid':(['amb-river','sfx-magic-4','sfx-metalpot2'],280,7400),
 'poison':(['amb-forest','sfx-cloth1','sfx-magic-4'],220,5600),
 'heal':(['sfx-magic-5','amb-forest','sfx-cloth2'],420,10000),
 'radiant':(['sfx-magic-5','sfx-metalclick3','amb-wind'],420,12500),
 'nature':(['amb-forest','sfx-cloth3','sfx-creak1'],110,8400),
 'necrotic':(['amb-haunted-crypt','sfx-creak2','sfx-magic-6'],65,6100),
 'psychic':(['sfx-magic-7','amb-wind','sfx-creak3'],210,9400),
 'illusion':(['sfx-magic-2','sfx-cloth4','amb-wind'],340,12400),
 'portal':(['sfx-magic-7','amb-wind','sfx-magic-3'],90,8200),
 'water':(['amb-river','amb-rain','sfx-metalpot3'],200,9800),
 'wind':(['amb-wind','sfx-cloth2','amb-forest'],100,12000),
 'earth':(['sfx-chop2','sfx-creak2','amb-deep-cave'],55,5500),
 'time':(['sfx-metalclick1','sfx-magic-2','sfx-metallatch2'],340,10000),
 'ward':(['sfx-magic-5','sfx-metalpot2','sfx-metalclick3'],210,11000),
 'divination':(['sfx-magic-1','sfx-cloth1','amb-wind'],430,13000),
 'force':(['sfx-magic-3','sfx-chop3','amb-wind'],150,10200)
}
# Catalog spellings are fixed here rather than silently reusing one generic clip.
aliases={'ice':'frost','electric':'lightning','air':'wind','soul':'necrotic','light':'radiant','healing':'heal','arcane':'force'}
effect_family={
 'death':'necrotic','sparks':'lightning','shield':'ward','shadow':'necrotic',
 'vines':'nature','teleport':'portal','shockwave':'psychic','explosion':'fire',
 'vortex':'wind','smoke':'wind','blizzard':'frost','embers':'fire',
 'chain-lightning':'lightning','lava':'fire','runes':'illusion','curse':'necrotic',
 'bless':'heal','web':'nature','swarm':'nature','leaves':'nature','petals':'nature',
 'blades':'force','sonic':'psychic','inferno':'fire','blue-fire':'fire',
 'acid-rain':'acid','hail':'frost','ice-lattice':'frost','steam':'water',
 'sandstorm':'wind','earthquake':'earth','thunderstorm':'lightning',
 'bubbles':'water','solar-halo':'radiant','lunar-halo':'illusion',
 'starfield':'divination','comets':'force','mirror-shield':'ward',
 'prismatic-barrier':'ward','clockwork':'time','gravity-well':'portal',
 'astral-threads':'illusion','spectral-chains':'necrotic','thorn-cage':'nature',
 'spores':'nature','mushrooms':'nature','butterflies':'nature','feathers':'wind',
 'rage':'fire','sleep':'psychic','fear':'necrotic','petrify':'earth','soul-flames':'necrotic'
}
# Resolve numbered Foley labels against the actual bundled catalog.
for family,(keys,lo,hi) in list(recipes.items()):
 fixed=[]
 for key in keys:
  if key in catalog:fixed.append(key);continue
  candidates=[k for k in catalog if k.startswith(key.rstrip('1234567890'))]
  if not candidates:raise ValueError('Missing source '+key)
  fixed.append(sorted(candidates)[int(key[-1])%len(candidates)])
 recipes[family]=(fixed,lo,hi)
records=[]
def compose(job,kind):
 id=job['id'] if kind=='spell' else job['kind']
 recipe=job.get('recipe') or {}
 family=job.get('family') or recipe.get('family') or effect_family.get(id,id)
 family=aliases.get(family,family)
 if family not in recipes:raise ValueError('Missing semantic recipe '+family+' '+id)
 digest=hashlib.sha256((kind+id).encode()).digest();seed=int.from_bytes(digest[:8],'little');rng=np.random.default_rng(seed)
 keys,lo,hi=recipes[family];length=3.65+float(rng.uniform(0,.35));n=int(length*RATE);time=np.arange(n)/RATE;out=np.zeros((n,2),np.float32)
 flight=float(recipe.get('flight',0)) if recipe.get('delivery')=='projectile' else .12
 # Spatial cast, material flight, physical impact, lingering release.
 delays=[0,max(.07,flight*.38),max(.18,flight)]
 for layer,key in enumerate(keys):
  clip=source(key);duration=(1.5,2.5,1.75)[layer];m=min(int(duration*RATE),len(clip))
  start=int(rng.integers(0,max(1,len(clip)-m)));chunk=clip[start:start+m].copy()
  chunk=sosfilt(butter(3,[lo*(.75+layer*.16),min(19000,hi*(1+.05*layer))],btype='bandpass',fs=RATE,output='sos'),chunk,axis=0)
  chunk/=max(.02,float(np.sqrt(np.mean(chunk*chunk))))*7.5
  env=np.sin(np.linspace(0,math.pi,len(chunk)))**(.7 if layer==1 else 1.8)
  if family in ['earth','fire','lightning'] and layer==2:env=np.exp(-np.linspace(0,5,len(chunk)))*np.minimum(1,np.arange(len(chunk))/(RATE*.012))
  chunk*=env[:,None]*(.38 if layer==1 else .57)
  offset=int(delays[layer]*RATE);amount=min(len(chunk),n-offset);out[offset:offset+amount]+=chunk[:amount]
 # Original low impact only for physical families, never the same beep for every spell.
 if family in ['fire','earth','lightning','force']:
  age=time-flight;hit=np.maximum(age,0);freq=(42 if family=='earth' else 66)+float(rng.uniform(-7,12))
  bass=np.sin(2*math.pi*(freq*hit-12*hit*hit))*np.exp(-hit*7)*(age>=0)*np.minimum(1,hit/.009)
  out+=bass[:,None]*.13
 if family=='frost':
  for k in range(5):
   age=time-(flight+k*.055);u=np.maximum(age,0)
   # Inharmonic, rapidly decaying ice fracture partials.
   f=float(rng.uniform(1800,5800));s=(np.sin(tau*f*u)+.25*np.sin(tau*f*1.43*u))*np.exp(-u*38)*(age>=0)*np.minimum(1,u/.002)
   out[:,k%2]+=s*.027
 # Stereo early reflections create depth without a long music-like tail.
 dry=out.copy()
 for lag,gain in [(0.067,.13),(0.139,.095),(0.241,.075),(0.389,.055)]:
  shift=int(lag*RATE);out[shift:]+=dry[:-shift,::-1]*gain
 out-=np.mean(out,axis=0)
 out*=np.minimum(1,time/.018)[:,None]*np.minimum(1,(length-time)/.2)[:,None]
 rms=float(np.sqrt(np.mean(out*out)));out*=min(2.6,.115/max(.005,rms));peak=float(np.max(np.abs(out)));out*=min(1,.84/max(.001,peak))
 folder=ROOT/'public/audio'/('vtt-spells-20261009' if kind=='spell' else 'vtt-effects-20261009');folder.mkdir(parents=True,exist_ok=True)
 path=folder/(id+'.ogg');sf.write(path,out,RATE,format='OGG',subtype='VORBIS')
 reread,sr=sf.read(path,always_2d=True)
 peak=float(np.max(np.abs(reread)));rms=float(np.sqrt(np.mean(reread*reread)))
 if peak>1 or rms<.007 or sr!=RATE or not np.isfinite(reread).all():raise ValueError('Invalid audio '+id)
 records.append({'id':id,'kind':kind,'family':family,'behavior':recipe.get('kind',recipe.get('layout',id)),'sources':keys,'duration':len(reread)/RATE,'rmsDb':round(20*np.log10(rms),2),'peakDb':round(20*np.log10(max(peak,.00001)),2),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
tau=2*math.pi
for job in jobs['effects']:compose(job,'effect')
for job in jobs['spells']:compose(job,'spell')
if len({r['sha256'] for r in records})!=len(records):raise ValueError('Duplicate cues')
manifest={'date':'2026-10-09','generator':'Original phased material compositions with credited CC0 Foley/ambience; see public/audio/vtt/manifest.json and data/vtt/sound-credits*.json for source provenance.','assets':records}
(ROOT/'public/audio/cinematic-20261009-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print(f'PASS {len(records)} unique original layered stereo cues; decoded, peak/RMS/DC/fade checked.')
