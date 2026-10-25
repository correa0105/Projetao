"""Offline, append-only dungeon sound build (numpy, scipy, soundfile).

Optional first argument: local Python dependency directory. Download the four
pinned sources in data/vtt/dungeon-sounds-20261024.json with the existing source
downloader first. Reuses the previously pinned CC0 creature and RPG packs.
Never run at application startup or regenerate an existing catalog ID.
"""
import sys
if len(sys.argv) > 1:
    sys.path.insert(0, sys.argv[1])
import hashlib
import json
from pathlib import Path
import zipfile
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/audio/vtt'
PROVENANCE = ROOT / 'data/vtt/dungeon-sounds-20261024.json'
RATE = 44100
catalog = json.loads((ROOT / 'shared/vtt-sound-catalog.json').read_text(encoding='utf8'))
manifest = json.loads((OUT / 'manifest.json').read_text(encoding='utf8'))
batch = json.loads(PROVENANCE.read_text(encoding='utf8'))
old_catalog = json.loads(json.dumps(catalog[:155]))
old_assets = json.loads(json.dumps(manifest['assets'][:155]))
assert len(old_catalog) == 155
for asset in manifest['assets']:
    assert hashlib.sha256((OUT / asset['file']).read_bytes()).hexdigest() == asset['sha256'], asset['id']

SRC = ROOT / '.local/dungeon-sound-sources-20261024'
for source in batch['sources']:
    file = ROOT / source['file']
    assert file.stat().st_size == source['bytes']
    assert hashlib.sha256(file.read_bytes()).hexdigest() == source['sha256'], source['slug']
    if file.suffix == '.zip':
        dest = SRC / {'kenney-impact.zip': 'kenney-impact', 'metal-wood.zip': 'metal-wood', 'water-slime.zip': 'water-slime'}[file.name]
        with zipfile.ZipFile(file) as archive:
            assert all((dest / n).resolve().is_relative_to(dest.resolve()) for n in archive.namelist())
            archive.extractall(dest)

PACKS = {
    'k': (SRC / 'kenney-impact/Audio', 'dungeon-kenney-impact-20261024'),
    'm': (SRC / 'metal-wood', 'dungeon-metal-wood-20261024'),
    'w': (SRC / 'water-slime', 'dungeon-water-slime-20261024'),
    'c': (ROOT / '.local/vtt-sound-expansion/80-cc0-creature-sfx', '80-cc0-creature-sfx'),
    'r': (ROOT / '.local/vtt-sound-sources/kenney-rpg/Audio', 'kenney-rpg'),
    's': (SRC, 'dungeon-stone-move-20261024'),
}
for key in ['c', 'r']:
    pinned = next(s for s in manifest['sources'] if s['slug'] == PACKS[key][1])
    assert hashlib.sha256((ROOT / pinned['file']).read_bytes()).hexdigest() == pinned['sha256']

cache = {}
used = set()
rng = np.random.default_rng(20261024)
recipes = []

def fade(a, attack=.015, release=.1):
    a = a.copy()
    n = min(round(attack * RATE), len(a) // 3)
    m = min(round(release * RATE), len(a) // 3)
    if n: a[:n] *= np.linspace(0, 1, n)[:, None]
    if m: a[-m:] *= np.linspace(1, 0, m)[:, None]
    return a

def filt(a, cutoff, mode='lowpass'):
    return sosfilt(butter(3, cutoff, fs=RATE, btype=mode, output='sos'), a, axis=0).astype('float32')

def clip(key, speed=1., pan=0.):
    pack, name = key.split(':', 1)
    base, slug = PACKS[pack]
    file = base / (name if '.' in name else name + '.ogg')
    used.add(slug + '/' + file.name)
    if key not in cache:
        a, rate = sf.read(file, dtype='float32', always_2d=True)
        if a.shape[1] == 1: a = np.repeat(a, 2, axis=1)
        a = a[:, :2]
        if rate != RATE:
            x = np.arange(round(len(a) * RATE / rate)) * rate / RATE
            a = np.stack([np.interp(x, np.arange(len(a)), a[:, c]) for c in range(2)], axis=1)
        a -= a.mean(axis=0)
        a *= min(.16 / max(float(np.sqrt(np.mean(a*a))), 1e-6), .85 / max(float(np.max(np.abs(a))), 1e-6))
        cache[key] = a.astype('float32')
    a = cache[key]
    if speed != 1:
        x = np.arange(round(len(a) / speed)) * speed
        a = np.stack([np.interp(x, np.arange(len(a)), a[:, c]) for c in range(2)], axis=1).astype('float32')
    return fade(a * np.array([1 - max(pan, 0)*.7, 1 + min(pan, 0)*.7]), .006, .025)

def noise(seconds, cutoff=180, attack=.2, release=1., band=None):
    used.add('original:dungeon-filtered-noise-envelope')
    a = rng.normal(0, 1, (round(seconds * RATE), 2)).astype('float32')
    a = filt(a, band if band else cutoff, 'bandpass' if band else 'lowpass')
    a *= .14 / max(float(np.sqrt(np.mean(a*a))), 1e-6)
    return fade(a, attack, release)

def mix(parts, seconds):
    a = np.zeros((round(seconds*RATE), 2), dtype='float32')
    for sound, at, gain in parts:
        n = round(at*RATE)
        count = min(len(a)-n, len(sound))
        if count > 0: a[n:n+count] += sound[:count] * gain
    return a

def room(a, wet=.22, tail=1.4):
    # Dense, diffuse stereo reflections instead of a repeated discrete delay.
    ir = np.zeros((round(tail*RATE), 2), dtype='float32')
    t = np.arange(len(ir))/RATE
    for c in range(2):
        ir[:, c] = rng.normal(0, 1, len(ir)) * np.exp(-t*6/tail) * .002
        for at, level in [(.041, .24), (.079, .17), (.127, .10)]:
            ir[round((at+c*.009)*RATE), c] += level
    return np.stack([np.pad(a[:,c], (0,len(ir)-1)) + wet*fftconvolve(a[:,c], ir[:,c]) for c in range(2)], axis=1).astype('float32')

def scatter(keys, start, end, count, gain=.5, speed=(.75,1.2)):
    parts = []
    for at in sorted(rng.uniform(start,end,count)):
        key = keys[int(rng.integers(len(keys)))]
        parts.append((clip(key, rng.uniform(*speed), rng.uniform(-.8,.8)), at, gain*rng.uniform(.5,1.)))
    return parts

stone = ['k:impactMining_%03d' % i for i in range(5)]
wood = ['m:wood_cracking_%02d' % i for i in range(1,5)]
metal = ['m:metal_sheet_%02d' % i for i in range(1,7)]

def add(key, name, category, seconds, parts, description, *, loop=False, wet=.25):
    id = ('amb-' if loop else 'sfx-') + 'dungeon-' + key
    sources = sorted(used)
    used.clear()
    existing = next((e for e in catalog if e['id'] == id), None)
    if existing:
        recipes.append(next(r for r in batch['sounds'] if r['id'] == id))
        return
    a = mix(parts, seconds)
    a = room(a, wet, 2.4 if loop else 1.6)
    if loop:
        # Equal-power head/tail overlap, followed by a circular splice far from a transient.
        n = RATE
        x = np.linspace(0, np.pi/2, n)[:, None]
        a = np.concatenate([a[-n:]*np.cos(x)+a[:n]*np.sin(x), a[n:-n]])
        a = np.roll(a, RATE//3, axis=0)
    else:
        a = fade(a, .008, .32)
    a = filt(a, 32, 'highpass')
    a -= a.mean(axis=0)
    rms = float(np.sqrt(np.mean(a*a)))
    a *= min((.075 if loop else .105)/max(rms,1e-6), .78/max(float(np.max(np.abs(a))),1e-6))
    file = OUT / (id+'.ogg')
    with sf.SoundFile(file,'w',samplerate=RATE,channels=2,format='OGG',subtype='VORBIS') as writer:
        for start in range(0,len(a),8192): writer.write(a[start:start+8192])
    decoded, rate = sf.read(file, always_2d=True)
    rms = float(np.sqrt(np.mean(decoded**2)))
    peak = float(np.max(np.abs(decoded)))
    seam = float(np.max(np.abs(decoded[0]-decoded[-1])))
    assert np.isfinite(decoded).all() and .008 < rms < .18 and peak < .95, id
    if loop: assert seam < .025, (id, seam)
    duration = len(decoded)/rate
    entry = dict(id=id,name=name,kind='ambience' if loop else 'effect',category=category,
        path='/audio/vtt/'+file.name,duration=round(duration,4),loop=loop,volume=.5 if loop else .6,
        credit='Alvorada Cinzenta · foley CC0: Kenney, rubberduck e pauliuw',description=description+' Masmorra; composição de foley e ecos.')
    asset = dict(id=id,file=file.name,sha256=hashlib.sha256(file.read_bytes()).hexdigest(),bytes=file.stat().st_size,
        duration=duration,sampleRate=rate,channels=2,rmsDb=round(20*np.log10(rms),2),peakDb=round(20*np.log10(peak),2),sources=sources)
    catalog.append(entry)
    manifest['assets'].append(asset)
    recipes.append(dict(id=id,name=name,category=category,loop=loop,sources=sources,
        arrangement=description,sha256=asset['sha256'],duration=duration,rmsDb=asset['rmsDb'],peakDb=asset['peakDb'],loopSeam=round(seam,6)))
    print(name, round(duration,2), flush=True)

# Seven structural events, each with a different onset, scale and debris timing.
add('ceiling-collapse','Teto desabando','Desabamentos',10,
    [(noise(8,140,1,2),.1,.65),(clip('m:wood_breaking_01',.7),.2,.5),(clip('k:impactMining_000',.6),1.3,1.5)]
    +scatter(stone,1.3,7.7,46,.8)+scatter(wood,2,5,8,.32),
    'Estalos de sustentação, queda súbita do teto e uma cascata de pedras e poeira.')
add('falling-rubble','Pedregulhos caindo','Desabamentos',4.2,
    scatter(stone,.1,2.7,12,.7,speed=(1,1.45)), 'Pequenos fragmentos ricocheteiam no piso e param aos poucos.')
add('pillar-cracking','Coluna de pedra rachando','Desabamentos',5.5,
    [(clip('m:wood_cracking_03',.55),.1,.85),(clip('m:wood_cracking_01',.8),1.6,.7),(noise(3.5,95,.6,1),.8,.45)]+scatter(stone,2.3,4.4,6,.4),
    'Três rachaduras profundas sob tensão, com lascas de pedra se soltando.')
add('pillar-collapse','Coluna tombando','Desabamentos',7.5,
    [(clip('s:stone-move.mp3',.75),.1,.55),(noise(5.5,120,1.3,2),.5,.6),(clip('k:impactMining_003',.5),2.5,2.1)]
    +scatter(stone,2.6,5.7,26,.8), 'Uma coluna se inclina, atinge o chão com um impacto pesado e se fragmenta.')
add('wall-collapse','Parede de alvenaria desmoronando','Desabamentos',7,
    [(noise(6,210,.5,2),.1,.65),(clip('s:stone-move.mp3',.9),.1,.6)]+scatter(stone,.7,5.3,38,.8),
    'A parede cede em vários blocos sucessivos, com rolagem de entulho.')
add('wooden-bridge-break','Ponte de madeira rompendo','Desabamentos',7,
    [(clip('m:wood_squeak_02',.7),0,.7),(clip('m:wood_breaking_02',.8),1.1,1),(clip('m:wood_breaking_01',.7),1.5,.9)]
    +scatter(['m:wood_falling_%02d'%i for i in range(1,7)],1.7,4.8,20,.8),
    'A ponte range, as vigas partem e tábuas despencam em sequência.')
add('rubble-slide','Avalanche de entulho','Desabamentos',8,
    [(noise(6.7,260,.8,1.5),.1,.8)]+scatter(stone,.3,6.5,55,.65,speed=(.65,1.3)),
    'Uma massa de pedras desliza pelo túnel, cresce e se dispersa.')

# Six mechanical passages, with a recognizable latch / motion / stop sequence.
add('secret-door-open','Porta secreta de pedra abrindo','Passagens secretas',6,
    [(clip('m:lock_open_01'),0,.7),(clip('s:stone-move.mp3',.72),.5,.85),(clip('s:stone-move.mp3',.85),2.2,.55),(clip('k:impactMining_004',.8),4.4,.7)],
    'A trava oculta solta, o painel de pedra desliza e encaixa no fim do curso.')
add('secret-door-close','Porta secreta de pedra fechando','Passagens secretas',5.6,
    [(clip('s:stone-move.mp3',.8),.1,.8),(clip('s:stone-move.mp3',.65),1.7,.7),(clip('k:impactMining_001',.65),3.8,1),(clip('m:metal_close_01'),4.2,.5)],
    'O painel volta pelo trilho, bate na parede e trava com um clique abafado.')
add('hidden-lever','Alavanca liberando passagem','Passagens secretas',3.2,
    [(clip('m:metal_spring_01',.8),0,.7),(clip('m:tools_04',.7),.3,.55),(clip('m:lock_open_01',.7),.85,.85),(noise(1.2,120,.1,.8),1,.3)],
    'Alavanca antiga acionada, mola tensionada e destravamento no interior da parede.')
add('stone-slab','Laje de pedra sendo arrastada','Passagens secretas',7,
    [(clip('s:stone-move.mp3',.58),.1,.8),(clip('s:stone-move.mp3',.76),2.8,.65),(clip('k:impactMining_002',.7),5.7,.55)]+scatter(stone,.3,5.3,9,.2),
    'Uma laje pesada raspa lentamente o piso, com cascalho preso sob a pedra.')
add('portcullis-rise','Grade de ferro subindo','Passagens secretas',6,
    [(clip('m:metal_open_01',.8),0,.7),(clip('m:metal_sheet_03',.7),.2,.6),(clip('m:metal_sheet_05',.8),2,.55),(clip('m:metal_close_01',.7),4.9,.8)]
    +scatter(['m:tools_01','m:tools_03','m:metal_hit_03'],.5,4.4,13,.28),
    'Engrenagens e corrente erguem uma grade pesada até o engate superior.')
add('portcullis-drop','Grade de ferro despencando','Passagens secretas',3.8,
    [(clip('m:metal_open_01',1.3),0,.5),(clip('m:metal_sheet_06',1.1),.1,.8),(clip('m:metal_slam_01',.65),.8,1.2),(clip('k:impactMetal_heavy_004',.7),.85,.9)],
    'A trava solta, a grade despenca rapidamente e ressoa ao bater no chão.')

# Nine traps. No damage or game rules are attached to these cosmetic sounds.
add('pressure-plate','Placa de pressão acionada','Armadilhas',2.2,
    [(clip('k:impactMining_003',1.25),0,.5),(clip('m:metal_spring_02',.75),.18,.8),(clip('r:metalClick'),.45,.6)],
    'Um piso afunda com um clique e uma mola dispara sob a placa.')
add('dart-volley','Rajada de dardos da parede','Armadilhas',3.2,
    [(clip('r:metalClick'),0,.5)]+[(noise(.22,attack=.015,release=.17,band=[1700,8000]),.25+i*.13,.5) for i in range(7)]
    +scatter(['k:impactWood_light_000','k:impactWood_light_003'],.5,1.6,7,.4),
    'Sete dardos passam em rajada e se cravam no lado oposto do corredor.')
add('sliding-blades','Lâminas saindo da parede','Armadilhas',3.8,
    [(clip('m:metal_spring_01',1.2),0,.6),(clip('m:metal_sheet_02',1.3),.25,.85),(noise(.6,attack=.01,release=.4,band=[500,6500]),.4,.55),(clip('m:metal_hit_02'),1.1,.7)],
    'Um mecanismo arma e uma fileira de lâminas atravessa o corredor.')
add('trapdoor-open','Alçapão se abrindo','Armadilhas',3.8,
    [(clip('m:lock_open_01'),0,.75),(clip('m:wood_squeak_01',.8),.2,.6),(clip('r:doorOpen_1'),.4,.7),(clip('m:wood_slam_02',.8),1.8,.8)],
    'A trava estala, a tampa de madeira abre bruscamente e bate nas dobradiças.')
add('pitfall','Queda no fosso','Armadilhas',4.8,
    [(noise(1.8,attack=.5,release=.25,band=[350,6500]),0,.65),(clip('k:impactSoft_heavy_001',.65),1.9,1.1),(clip('k:impactMining_004',.9),2.05,.8)],
    'Ar passando durante a queda e um impacto profundo no fundo de um fosso.')
add('jaw-trap','Armadilha de mandíbulas fechando','Armadilhas',2.6,
    [(clip('m:metal_spring_02',1.2),0,.75),(clip('m:metal_hit_01',.85),.13,.95),(clip('m:metal_close_01',1.2),.17,.6)],
    'Uma mola forte dispara e dentes de ferro se fecham com um golpe seco.')
add('pendulum-blade','Pêndulo de lâmina oscilando','Armadilhas',7,
    [(clip('m:metal_sheet_04',.8),0,.4)]+[(noise(.75,attack=.2,release=.5,band=[250,4800]),.6+i*1.25,.7) for i in range(4)]
    +[(clip('r:creak2',.75),1.1+i*1.25,.35) for i in range(4)],
    'Quatro passagens de uma lâmina pendular, com eixo rangendo e ar cortado.')
add('rolling-boulder','Pedra gigante rolando','Armadilhas',10,
    [(noise(8.5,170,.9,2),.1,.9),(clip('s:stone-move.mp3',.55),0,.5)]+scatter(stone,.5,7.3,35,.65,speed=(.5,.85)),
    'Um bloco de pedra ganha velocidade no corredor, rolando e golpeando as juntas do piso.')
add('poison-gas','Gás venenoso escapando','Armadilhas',6.5,
    [(clip('m:metal_open_01',1.4),0,.6),(noise(5.3,attack=.18,release=1.6,band=[1200,10000]),.2,.75),(clip('c:spit_02',.8),.3,.22)],
    'Uma válvula libera um jato prolongado de gás sob pressão.')

# Four tremors and looming heavy movement.
add('distant-tremor','Tremor distante','Tremores',9,
    [(filt(noise(8,95,1.5,2.5),65),0,1)]+scatter(stone,1.5,6.8,7,.09,speed=(.5,.8)),
    'Um abalo grave e distante percorre as galerias sem desmoronar o teto.',wet=.5)
add('earthquake','Terremoto na masmorra','Tremores',12,
    [(noise(10.5,155,1.1,2),0,1.1)]+scatter(stone,.4,9,44,.45)+scatter(wood,1,8,7,.25),
    'Abalo prolongado, paredes vibrando e pedras soltas caindo ao redor.')
add('giant-footsteps','Passos de gigante se aproximando','Tremores',9,
    [(filt(clip('k:footstep_concrete_%03d'%(i%5),.46),160),.2+i*1.22,.45+i*.13) for i in range(6)]
    +[(noise(.65,100,.02,.6),.2+i*1.22,.25+i*.07) for i in range(6)],
    'Seis passadas pesadas ficam mais próximas e fazem o piso vibrar.')
add('floor-fissure','Rachadura se abrindo no chão','Tremores',6.8,
    [(clip('m:wood_cracking_04',.5),0,.9),(clip('s:stone-move.mp3',.6),.9,.6),(noise(5,110,.3,1.7),.2,.75)]+scatter(stone,1,4.9,15,.45),
    'A pedra se parte em linha, a fissura se alarga e fragmentos despencam.')

# Ten creatures using previously unused CC0 vocal takes, not renamed old roars.
add('beast-growl','Fera nas sombras rosnando','Monstros',5,
    [(clip('c:alien_02',.68),0,.9),(clip('c:burble_02',.75),2,.4)],
    'Rosnado gutural baixo com vibração da garganta e respiração áspera.')
add('giant-roar','Rugido do guardião subterrâneo','Monstros',6,
    [(clip('c:scream_02',.58),.1,1),(clip('c:alien_06',.62),.8,.45),(noise(3.5,120,.2,1.5),.4,.2)],
    'Um rugido longo e grave preenche uma câmara de pedra.',wet=.55)
add('undead-moan','Lamento de morto-vivo','Monstros',6,
    [(clip('c:misc_07',.7),.1,.85),(clip('c:ooh',.62),1.7,.65)],
    'Voz arrastada e rouca de um morto-vivo surgindo da cripta.',wet=.45)
add('specter-wail','Uivo de espectro','Monstros',7,
    [(filt(clip('c:scream_01',.72),[300,5000],'bandpass'),.2,.75),(clip('c:weird_05',.9),1.7,.4)],
    'Um grito espectral distante sobe de intensidade e deixa um eco difuso.',wet=.9)
add('cavern-insect','Estalos de inseto cavernícola','Monstros',5,
    [(clip('c:bug_04',s,p),at,.7) for s,p,at in [(1.1,-.3,0),(.9,.2,1.2),(1.25,-.1,2.7)]],
    'Mandíbulas e carapaça de um inseto gigante estalam em três movimentos.')
add('ooze-movement','Gosma se arrastando','Monstros',6.5,
    [(clip('w:slime_03',.8),0,.6),(clip('w:slime_08',.75),1.4,.65),(clip('w:slime_15',.8),3,.7),(clip('w:bubble_02',.9),3.8,.4)],
    'Um corpo viscoso avança, borbulha e se desprende do piso úmido.')
add('reptile-hiss','Serpente monstruosa sibilando','Monstros',4.8,
    [(clip('c:spit_03',.7),0,.5),(noise(2.6,attack=.15,release=1,band=[2400,9500]),.3,.5),(clip('c:alien_01',.85),1.3,.55)],
    'Sibilo áspero, vibração da garganta e um estalo curto de mandíbulas.')
add('bat-swarm','Enxame de morcegos levantando voo','Monstros',7,
    scatter(['r:cloth1','r:cloth2','r:cloth3','r:cloth4'],.1,4.9,45,.35,speed=(1.2,1.8))
    +scatter(['c:cute_08','c:cute_09'],.3,4.5,12,.12,speed=(1.25,1.65)),
    'Dezenas de asas batem e pequenos guinchos cruzam o túnel em direções diferentes.')
add('claws-on-stone','Garras raspando a pedra','Monstros',5.5,
    [(clip('m:tools_08',.7),0,.6),(clip('s:stone-move.mp3',1.3),.3,.5),(clip('m:tools_11',.8),2.3,.55),(clip('c:alien_03',.8),2.9,.3)],
    'Três garras riscam uma superfície de pedra, seguidas de uma voz baixa.')
add('lurking-breath','Respiração de monstro à espreita','Monstros',8,
    [(filt(clip('c:snore',.78),2200),.2,.65),(clip('c:burble_01',.7),2,.35),(filt(clip('c:snore',.95),1500),4,.55)],
    'Inspirações profundas e irregulares, com borbulho na garganta atrás da parede.')

# Four layered loops, independent from the one-shot events above.
add('dripping-cells','Masmorra úmida com goteiras','Masmorras',36,
    [(noise(36,attack=.2,release=.2,band=[120,1600]),0,.12)]
    +scatter(['w:bubble_01','w:splash_03','w:splash_09'],.2,34,25,.23,speed=(.9,1.3)),
    'Gotas espaçadas, pequenas poças e ar baixo em celas vazias.',loop=True,wet=.75)
add('unstable-tunnel','Túnel instável e vento nas frestas','Masmorras',36,
    [(noise(36,attack=.2,release=.2,band=[100,900]),0,.6)]
    +scatter(stone,.2,34,21,.16)+scatter(wood,1,33,5,.12,speed=(.55,.85)),
    'Vento passa pelas frestas enquanto cascalho e suportes estalam ao longe.',loop=True,wet=.55)
add('creature-den','Covil de criaturas adormecidas','Masmorras',36,
    [(noise(36,attack=.2,release=.2,band=[70,650]),0,.18)]
    +scatter(['c:snore','c:burble_01','c:alien_04'],.8,32,11,.23,speed=(.6,.9))
    +scatter(['w:slime_11','w:bubble_03'],1,33,9,.09),
    'Respirações e murmúrios de várias criaturas ecoam em um covil profundo.',loop=True,wet=.7)
add('ancient-mechanism','Engrenagens antigas sob a masmorra','Masmorras',36,
    [(noise(36,190,.2,.2),0,.3)]
    +[(clip('m:metal_hit_%02d'%(i%5+1),.75,(-1)**i*.25),.3+i*.9,.18) for i in range(38)]
    +scatter(['m:metal_sheet_01','m:metal_spring_01','m:tools_06'],1,33,16,.17,speed=(.6,.9)),
    'Engrenagens lentas, correntes tensionadas e batidas regulares de uma máquina subterrânea.',loop=True,wet=.4)

assert len(recipes) == 40 and sum(r['loop'] for r in recipes) == 4
assert len(catalog) == 195 and len(manifest['assets']) == 195
assert catalog[:155] == old_catalog and manifest['assets'][:155] == old_assets
assert len({a['sha256'] for a in manifest['assets']}) == 195
for asset in old_assets:
    assert hashlib.sha256((OUT / asset['file']).read_bytes()).hexdigest() == asset['sha256']
for source in batch['sources']:
    if not any(s['slug'] == source['slug'] for s in manifest['sources']): manifest['sources'].append(source)
manifest['date'] = '2026-10-24'
batch['sounds'] = recipes
batch['preservedAssets'] = 155
batch['totalCatalog'] = 195
for file, obj in [(ROOT/'shared/vtt-sound-catalog.json',catalog),(OUT/'manifest.json',manifest),(PROVENANCE,batch)]:
    file.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('Verified: 40 new sounds, 155 preserved, 195 total; stereo 44100 Hz, no clipping.')
