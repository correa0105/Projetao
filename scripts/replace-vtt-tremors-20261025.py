"""Replace four rejected r2 effects with dedicated, newly pinned CC0 sources.

Offline only. Optional first argument: directory with numpy/scipy/soundfile.
Keep IDs/settings and previous files; use r3 URLs and natural event lengths.
"""
import sys
if len(sys.argv)>1:sys.path.insert(0,sys.argv[1])
import json,hashlib,zipfile
from pathlib import Path
import numpy as np
import soundfile as sf
from scipy.signal import butter,sosfiltfilt,resample_poly

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'public/audio/vtt';SRC=ROOT/'.local/vtt-tremor-replacement-20261025'
REPORT=ROOT/'data/vtt/tremor-replacement-20261025.json'
RATE=44100
catalog=json.loads((ROOT/'shared/vtt-sound-catalog.json').read_text(encoding='utf8'))
manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf8'))
batch=json.loads((ROOT/'data/vtt/dungeon-sounds-20261024.json').read_text(encoding='utf8'))
before={a['id']:dict(a) for a in manifest['assets']}
hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for a in before.values():assert hashfile(OUT/a['file'])==a['sha256']
if REPORT.exists():
    report=json.loads(REPORT.read_text(encoding='utf8'))
    for s in report['sounds']:assert before[s['id']]['sha256']==s['after']['sha256']
    print('Replacement already applied; all catalog files verified.');sys.exit(0)
sources=[s for s in json.loads((SRC/'sources.json').read_text(encoding='utf8')) if s['slug'] in {
    'quake-shake-20261025','quake-deep-rumble-20261025','quake-breaking-pack-20261025','quake-giant-run-20261025'}]
assert len(sources)==4
for s in sources:assert hashfile(ROOT/s['file'])==s['sha256']
dest=SRC/'breaking'
with zipfile.ZipFile(SRC/'breaking.zip') as z:
    assert all((dest/n).resolve().is_relative_to(dest.resolve()) for n in z.namelist());z.extractall(dest)
report=dict(date='2026-10-25',revision='r3',reason='Owner rejected distant tremor, earthquake, giant steps and ground fracture after r2.',
    build='scripts/replace-vtt-tremors-20261025.py',license='CC0-1.0',sources=sources,sounds=[])

def read(file):
    a,r=sf.read(file,dtype='float32',always_2d=True)
    if a.shape[1]==1:a=np.repeat(a,2,axis=1)
    a=a[:,:2];a-=a.mean(axis=0)
    if r!=RATE:a=resample_poly(a,RATE,r,axis=0)
    return a

def filt(a,hz,mode='lowpass'):
    return sosfiltfilt(butter(3,hz,fs=RATE,btype=mode,output='sos'),a,axis=0)

def fade(a,attack=.03,release=.2):
    a=a.copy();n=min(round(attack*RATE),len(a)//3);m=min(round(release*RATE),len(a)//3)
    a[:n]*=np.sin(np.linspace(0,np.pi/2,n))[:,None]**2
    a[-m:]*=np.sin(np.linspace(np.pi/2,0,m))[:,None]**2
    return a

def mix(parts,seconds):
    a=np.zeros((round(seconds*RATE),2),dtype='float32')
    for sound,at,gain in parts:
        start=round(at*RATE);n=min(len(a)-start,len(sound))
        if n>0:a[start:start+n]+=sound[:n]*gain
    return a

def echo(a,wet=.12):
    out=np.pad(a,((0,round(.6*RATE)),(0,0)))
    for sec,gain in [(.085,.28),(.17,.16),(.31,.07)]:
        n=round(sec*RATE);out[n:n+len(a)]+=a[:,::-1]*gain*wet
    return out

def add(key,name,a,sources,credit,description,targetRms):
    id='sfx-dungeon-'+key;old=before[id]
    # Preserve audible bass for rumble: the former universal 110-Hz high-pass
    # removed the defining body. Only remove subsonic DC/very-low excursion.
    a=filt(a,28,'highpass');a=fade(a,.02,.22)
    a-=a.mean(axis=0)
    gain=min(targetRms/max(float(np.sqrt(np.mean(a*a))),1e-9),.47/max(float(abs(a).max()),1e-9))
    a*=gain
    file=OUT/(id+'-r3-20261025.ogg')
    with sf.SoundFile(file,'w',samplerate=RATE,channels=2,format='OGG',subtype='VORBIS') as f:
        for start in range(0,len(a),8192):f.write(a[start:start+8192])
    final,r=sf.read(file,always_2d=True,dtype='float32')
    rms=float(np.sqrt(np.mean(final**2)));peak=float(abs(final).max())
    truepeak=float(abs(resample_poly(final,4,1,axis=0)).max())
    assert np.isfinite(final).all() and rms>.006 and truepeak<.56
    duration=len(final)/r;sha=hashfile(file)
    entry=next(e for e in catalog if e['id']==id)
    entry.update(path='/audio/vtt/'+file.name,duration=round(duration,4),credit=credit,description=description)
    asset=next(e for e in manifest['assets'] if e['id']==id)
    asset.update(file=file.name,sha256=sha,bytes=file.stat().st_size,duration=duration,sources=sources,
        rmsDb=round(20*np.log10(rms),2),peakDb=round(20*np.log10(peak),2))
    recipe=next(e for e in batch['sounds'] if e['id']==id)
    recipe.update(sha256=sha,sources=sources,rmsDb=asset['rmsDb'],peakDb=asset['peakDb'],duration=duration,
        arrangement=description,revision='r3-2026-10-25',loopSeam=round(float(abs(final[0]-final[-1]).max()),6))
    report['sounds'].append(dict(id=id,name=name,sources=sources,description=description,
        before=dict(file=old['file'],sha256=old['sha256'],duration=old['duration']),
        after=dict(file=file.name,sha256=sha,duration=duration,rmsDb=asset['rmsDb'],peakDb=asset['peakDb'],truePeakDb=round(20*np.log10(truepeak),2))))
    # Standalone MP3 audition copies remain in ignored workspace storage.
    print(name,round(duration,2),'s, RMS',asset['rmsDb'],'true peak',round(20*np.log10(truepeak),2),flush=True)

# One continuous distant event, using a dedicated recorded rumble excerpt.
rumble=read(SRC/'deep-rumble.ogg')[round(18*RATE):round(27*RATE)]
rumble=fade(rumble,.8,1.5)
add('distant-tremor','Tremor distante',rumble,['quake-deep-rumble-20261025/deep-rumble.ogg'],
    'gmason · CC0 · edição Alvorada Cinzenta',
    'Masmorra: um ronco grave e distante cresce lentamente, atravessa a galeria e desaparece.',.037)

# Dedicated earthquake design used once, preserving its native progression.
quake=read(SRC/'shake.flac')
add('earthquake','Terremoto na masmorra',fade(quake,.06,.35),['quake-shake-20261025/shake.flac'],
    'mieki256 · CC0 · edição Alvorada Cinzenta',
    'Masmorra: abalo forte e contínuo, com vibração irregular e um fim definido.',.075)

# Five genuine giant-stomp takes, separated into six approaching steps. Never
# substitute tiny concrete footsteps or sustain a grinding loop underneath.
stomps=read(SRC/'giant-run.mp3')
parts=[]
for i,index in enumerate([0,1,2,3,4,1]):
    start=round(max(0,index*.41)*RATE);end=round(min(len(stomps)/RATE,(index+1)*.41)*RATE)
    step=stomps[start:end]
    step=resample_poly(step,5,4,axis=0)
    step=fade(step,.008,.09)
    parts.append((step,.2+i*1.27,[.28,.38,.50,.63,.79,1][i]))
steps=echo(mix(parts,7.3),.17)
add('giant-footsteps','Passos de gigante se aproximando',steps,['quake-giant-run-20261025/giant-run.mp3'],
    'aroth4 · CC0 · edição Alvorada Cinzenta',
    'Masmorra: seis pisadas profundas e espaçadas ficam mais próximas, cada uma com impacto e cauda próprios.',.056)

def rock(name):return read(next(dest.rglob(name+'.ogg')))
fracture=echo(mix([(rock('bfh1_rock_breaking_01'),.06,1.1),
    (rock('bfh1_rock_breaking_03'),.42,.75),(rock('bfh1_rock_breaking_02'),.72,.8),
    (rock('bfh1_rock_falling_03'),1.18,.7),(rock('bfh1_rock_falling_08'),1.72,.4)],2.4),.12)
add('floor-fissure','Rachadura se abrindo no chão',fracture,['quake-breaking-pack-20261025/bfh1_rock_breaking_01.ogg',
    'quake-breaking-pack-20261025/bfh1_rock_breaking_02.ogg','quake-breaking-pack-20261025/bfh1_rock_breaking_03.ogg',
    'quake-breaking-pack-20261025/bfh1_rock_falling_03.ogg','quake-breaking-pack-20261025/bfh1_rock_falling_08.ogg'],
    'rubberduck · CC0 · edição Alvorada Cinzenta',
    'Masmorra: a pedra se parte em estalos secos sucessivos, seguida por fragmentos caindo. Evento curto.',.060)

changed={s['id'] for s in report['sounds']};assert len(changed)==4
for a in manifest['assets']:
    if a['id'] not in changed:assert a==before[a['id']]
for a in before.values():assert hashfile(OUT/a['file'])==a['sha256']
for s in report['sources']:
    assert not any(e['slug']==s['slug'] for e in manifest['sources']);manifest['sources'].append(s)
report['unchangedCatalogAssets']=191;report['totalCatalog']=195
batch['latestAudioRevision']='r3-2026-10-25'
for p,obj in [(ROOT/'shared/vtt-sound-catalog.json',catalog),(OUT/'manifest.json',manifest),
    (ROOT/'data/vtt/dungeon-sounds-20261024.json',batch),(REPORT,report)]:
    p.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Four replacements complete; 191 other catalog assets unchanged.')
