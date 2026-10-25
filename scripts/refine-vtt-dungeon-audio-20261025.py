"""Explicit audio repair requested by the owner: preserve IDs and original files.

Requires numpy/scipy/soundfile (optional dependency directory as first argument).
Rebuilds harsh blade/stone mixes from pinned CC0 recordings; remasters four
related effects. Writes revision URLs so browser caches cannot replay old audio.
"""
import sys
if len(sys.argv) > 1:
    sys.path.insert(0, sys.argv[1])
from pathlib import Path
from fractions import Fraction
import hashlib
import json
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfiltfilt, resample_poly, fftconvolve
from scipy.ndimage import maximum_filter1d, gaussian_filter1d

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/audio/vtt'
REPORT = ROOT / 'data/vtt/dungeon-audio-refinement-20261025.json'
RATE = 44100
catalog = json.loads((ROOT/'shared/vtt-sound-catalog.json').read_text(encoding='utf8'))
manifest = json.loads((OUT/'manifest.json').read_text(encoding='utf8'))
batch = json.loads((ROOT/'data/vtt/dungeon-sounds-20261024.json').read_text(encoding='utf8'))
before = {a['id']: dict(a) for a in manifest['assets']}
assert len(catalog) == len(manifest['assets']) == 195
for a in before.values():
    assert hashlib.sha256((OUT/a['file']).read_bytes()).hexdigest() == a['sha256']
PACKS = {
    'r': (ROOT/'.local/vtt-sound-sources/kenney-rpg/Audio', 'kenney-rpg'),
    'k': (ROOT/'.local/dungeon-sound-sources-20261024/kenney-impact/Audio', 'dungeon-kenney-impact-20261024'),
    'm': (ROOT/'.local/dungeon-sound-sources-20261024/metal-wood', 'dungeon-metal-wood-20261024'),
    's': (ROOT/'.local/dungeon-sound-sources-20261024', 'dungeon-stone-move-20261024'),
}
for _, slug in PACKS.values():
    s = next(s for s in manifest['sources'] if s['slug'] == slug)
    assert hashlib.sha256((ROOT/s['file']).read_bytes()).hexdigest() == s['sha256']
if REPORT.exists():
    report = json.loads(REPORT.read_text(encoding='utf8'))
    for a in report['sounds']:
        assert before[a['id']]['sha256'] == a['after']['sha256']
    print('Audio refinement already applied; all current hashes verified.')
    sys.exit(0)

rng = np.random.default_rng(20261025)
used = set()
cache = {}
report = dict(date='2026-10-25',reason='Owner reported harsh, distorted-sounding blade traps and earthquakes.',
    build='scripts/refine-vtt-dungeon-audio-20261025.py',license='CC0-1.0',sounds=[])

def filt(a, hz, mode='lowpass'):
    return sosfiltfilt(butter(4,hz,fs=RATE,btype=mode,output='sos'),a,axis=0).astype('float32')

def fades(a, attack=.018, release=.09):
    a=a.copy()
    n=min(round(attack*RATE),len(a)//3); m=min(round(release*RATE),len(a)//3)
    a[:n]*=np.linspace(0,1,n)[:,None]
    a[-m:]*=np.linspace(1,0,m)[:,None]
    return a

def read(key,speed=1,pan=0):
    pack,name=key.split(':',1); base,slug=PACKS[pack]
    path=base/(name if '.' in name else name+'.ogg')
    used.add(slug+'/'+path.name)
    if key not in cache:
        a,sr=sf.read(path,always_2d=True,dtype='float32')
        if a.shape[1]==1:a=np.repeat(a,2,axis=1)
        a=a[:,:2];a-=a.mean(axis=0)
        if sr!=RATE:a=resample_poly(a,RATE,sr,axis=0)
        a=filt(filt(a,65,'highpass'),5800)
        a*=min(.065/max(np.sqrt(np.mean(a*a)),1e-6),.26/max(abs(a).max(),1e-6))
        cache[key]=a
    a=cache[key]
    if speed!=1:
        ratio=Fraction(1/speed).limit_denominator(300)
        a=resample_poly(a,ratio.numerator,ratio.denominator,axis=0)
    return fades(a*np.array([1-max(pan,0)*.55,1+min(pan,0)*.55]),.012,.055)

def mix(parts,seconds):
    a=np.zeros((round(seconds*RATE),2),dtype='float32')
    for clip,at,gain in parts:
        start=round(at*RATE); n=min(len(clip),len(a)-start)
        if n>0:a[start:start+n]+=clip[:n]*gain
    return a

def reverb(a,wet=.16):
    # Quiet, low-passed reflections; no white-noise convolution tail.
    result=a.copy()
    for delay,level in [(.057,.28),(.111,.19),(.193,.11),(.307,.065),(.479,.035)]:
        n=round(delay*RATE)
        result[n:]+=filt(a[:-n,::-1],3000)*wet*level
    return result

def debris(start,end,count,gain=.5):
    return [(read('k:impactMining_%03d'%int(rng.integers(5)),rng.uniform(.9,1.25),rng.uniform(-.7,.7)),at,gain*rng.uniform(.45,1))
            for at in sorted(rng.uniform(start,end,count))]

def grinding(start,end,gain=.5):
    # Recorded stone movement, overlapping gently; never continuous synthetic hiss.
    parts=[];at=start
    while at<end:
        a=read('s:stone-move.mp3',rng.uniform(.85,1.1),rng.uniform(-.35,.35))
        a=fades(a,.16,.25)
        parts.append((a,at,gain*rng.uniform(.65,1)))
        at+=len(a)/RATE*.78
    return parts

def measures(a):
    rms=float(np.sqrt(np.mean(a*a))); frame=round(.05*RATE)
    frames=a[:len(a)//frame*frame].reshape(-1,frame,2)
    short=float(np.sqrt(np.mean(frames**2,axis=(1,2))).max())
    power=max(float(np.mean(a*a)),1e-12)
    return dict(rmsDb=round(20*np.log10(max(rms,1e-9)),2),peakDb=round(20*np.log10(max(float(abs(a).max()),1e-9)),2),
        truePeakDb=round(20*np.log10(max(float(abs(resample_poly(a,4,1,axis=0)).max()),1e-9)),2),
        shortRmsDb=round(20*np.log10(max(short,1e-9)),2),
        bassRatio=round(float(np.mean(filt(a,120)**2))/power,4),
        trebleRatio=round(float(np.mean(filt(a,3500,'highpass')**2))/power,4),
        maxSampleStep=round(float(abs(np.diff(a,axis=0)).max()),5))

def save(key,parts=None,description='',metal=False):
    id='sfx-dungeon-'+key
    old=before[id]
    original,sr=sf.read(OUT/old['file'],always_2d=True,dtype='float32')
    assert sr==RATE
    duration=len(original)/RATE
    a=reverb(mix(parts,duration)) if parts is not None else original.copy()
    sources=sorted(used) if parts is not None else old['sources']
    used.clear()
    # Remove speaker-excursion-heavy sub-bass and sharp hiss, with a gentle low shelf.
    a=filt(a,110 if not metal else 150,'highpass')
    a=filt(a,4300 if metal else 2600)
    a-=filt(a,200)*(.35 if not metal else .1)
    a=fades(a,.02,.3)
    frame=round(.05*RATE)
    rms=np.sqrt(np.mean(a*a))
    short=np.sqrt(np.mean(a[:len(a)//frame*frame].reshape(-1,frame,2)**2,axis=(1,2))).max()
    # Smooth look-ahead gain tames millisecond spikes without hard clipping.
    # This keeps the steel body audible instead of turning down the whole file.
    envelope=maximum_filter1d(abs(a).max(axis=1),size=round(.016*RATE))
    gain=np.minimum(1,(.035/np.maximum(envelope,1e-8))**.72)
    gain=gaussian_filter1d(gain,round(.0025*RATE))
    a*=gain[:,None]
    rms=np.sqrt(np.mean(a*a))
    short=np.sqrt(np.mean(a[:len(a)//frame*frame].reshape(-1,frame,2)**2,axis=(1,2))).max()
    # Reserve at least 8 dB of decoded true-peak headroom; no sample clipping.
    a*=min(.043/max(rms,1e-8),.085/max(short,1e-8),.34/max(abs(a).max(),1e-8))
    file=OUT/(id+'-r2-20261025.ogg')
    with sf.SoundFile(file,'w',samplerate=RATE,channels=2,format='OGG',subtype='VORBIS') as writer:
        for start in range(0,len(a),8192):writer.write(a[start:start+8192])
    decoded,rate=sf.read(file,always_2d=True,dtype='float32')
    metric=measures(decoded); previous=measures(original)
    assert len(decoded)==len(original) and rate==RATE and np.isfinite(decoded).all()
    assert metric['truePeakDb'] < -8 and metric['shortRmsDb'] < -20
    assert metric['bassRatio'] < .35 and metric['trebleRatio'] < .2, (id,metric)
    assert metric['maxSampleStep'] < .18, (id,metric)
    sha=hashlib.sha256(file.read_bytes()).hexdigest()
    entry=next(e for e in catalog if e['id']==id)
    entry['path']='/audio/vtt/'+file.name
    if description:entry['description']=description+' Masmorra; foley CC0, revisão suave de 25/10/2026.'
    asset=next(a for a in manifest['assets'] if a['id']==id)
    asset.update(file=file.name,sha256=sha,bytes=file.stat().st_size,duration=duration,rmsDb=metric['rmsDb'],peakDb=metric['peakDb'],sources=sources)
    recipe=next(s for s in batch['sounds'] if s['id']==id)
    recipe.update(sha256=sha,sources=sources,rmsDb=metric['rmsDb'],peakDb=metric['peakDb'],duration=duration,
        arrangement=description or recipe['arrangement'],revision='2026-10-25',loopSeam=round(float(abs(decoded[0]-decoded[-1]).max()),6))
    report['sounds'].append(dict(id=id,method='rebuild-recorded-foley' if parts is not None else 'remaster',
        sources=sources,description=description,before=dict(file=old['file'],sha256=old['sha256'],**previous),
        after=dict(file=file.name,sha256=sha,**metric)))
    print(id,'true peak',metric['truePeakDb'],'bass',metric['bassRatio'],'treble',metric['trebleRatio'],flush=True)

# Blade traps: actual steel movement and a short latch, without broad hiss/sheet crashes.
save('sliding-blades',[
    (read('m:lock_open_01'),0,.32),(read('r:drawKnife3'),.27,.8),
    (read('r:drawKnife2',1.03,-.2),.45,.45),(read('r:knifeSlice',.93,.3),.63,.4),
    (read('k:impactMetal_light_002'),1.15,.23)],
    'Trava curta, lâminas deslizando nos trilhos e um encaixe leve; metal sem rajada de chiado.',metal=True)
save('pendulum-blade',[
    *[(read('r:knifeSlice',speed,pan),.55+i*1.35,.55) for i,(speed,pan) in enumerate([(1,-.6),(.93,.6),(1.05,-.6),(.96,.6)])],
    *[(read('r:creak3',.95),1.05+i*1.35,.14) for i in range(4)]],
    'Quatro passagens espaçadas de lâmina, com corte de ar curto e rangido discreto do eixo.',metal=True)

# Tremors and heavy stone: midrange detail carries the event, with restrained lows.
save('distant-tremor',grinding(.25,7.1,.35)+debris(.8,7,9,.12),
    'Pedra vibrando ao longe, um abalo contido e poucos fragmentos no fim; sem bordão de subgrave.')
save('earthquake',grinding(.1,10.2,.65)+debris(.6,9.8,27,.48)+[
    (read('m:wood_cracking_01'),2.1,.23),(read('m:wood_cracking_04'),5.7,.18)],
    'Abalo irregular com atrito de pedra, juntas estalando e entulho leve, sem parede de ruído.')
save('giant-footsteps',[
    (read('k:footstep_concrete_%03d'%(i%5),.82,(-1)**i*.12),.25+i*1.22,.32+i*.08) for i in range(6)],
    'Seis passos pesados se aproximam, com o contato do pé e o eco legível, sem pulsos artificiais de grave.')
save('floor-fissure',[
    (read('m:wood_cracking_04',.85),.15,.5),(read('m:wood_cracking_03'),1.3,.25)]
    +grinding(.8,4.5,.42)+debris(1,4.9,12,.3),
    'Uma fratura avança por estalos curtos e raspagem de pedra, com fragmentos caindo nos intervalos.')
save('rolling-boulder',grinding(.1,7.9,.7)+debris(.7,7.5,23,.5),
    'Um bloco pesado rola em solavancos, com atrito de pedra e impactos separados, sem ruído grave contínuo.')
save('ceiling-collapse',[
    (read('m:wood_cracking_02',.9),.15,.4),(read('m:wood_breaking_01',.9),1,.65)]
    +grinding(1.2,7.7,.4)+debris(1.3,8.2,43,.65),
    'O suporte racha e o teto cede em impactos de pedra separados, seguidos de pequenos fragmentos.')
save('wall-collapse',grinding(.2,5.6,.55)+debris(.6,5.9,32,.62)+[
    (read('m:wood_cracking_03'),.1,.25)],
    'Blocos de alvenaria se soltam em sequência, com queda de cascalho e pausas entre os impactos.')
save('rubble-slide',grinding(.2,6.4,.5)+debris(.4,7,42,.45),
    'Uma cascata de cascalho cruza o piso, cresce e diminui sem o sopro artificial de graves.')

# Same excessive treble / bass envelope found during the audit in adjacent effects.
for key in ['dart-volley','poison-gas','reptile-hiss','pitfall']:
    save(key)

changed={s['id'] for s in report['sounds']}
assert len(changed)==14
for a in manifest['assets']:
    if a['id'] not in changed:assert a==before[a['id']]
for a in before.values():
    assert hashlib.sha256((OUT/a['file']).read_bytes()).hexdigest()==a['sha256'],'Original file preserved'
report['preservedCatalogAssets']=195-len(changed)
report['preservedOriginalFiles']=195
report['totalCatalog']=195
manifest['date']='2026-10-25'
batch['latestAudioRevision']='2026-10-25'
for path,obj in [(ROOT/'shared/vtt-sound-catalog.json',catalog),(OUT/'manifest.json',manifest),
                 (ROOT/'data/vtt/dungeon-sounds-20261024.json',batch),(REPORT,report)]:
    path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('14 repaired mixes, 181 unchanged catalog assets, all 195 original files retained.')
