"""Explicit append-only maintenance build. Requires numpy, soundfile and py7zr.
Download pinned sources first. Existing IDs/files are never regenerated.
"""
import hashlib
import json
import pathlib
import zipfile
import numpy as np
import soundfile as sf
import py7zr

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / ".local/vtt-sound-expansion"
BASE = ROOT / ".local/vtt-sound-sources"
OUT = ROOT / "public/audio/vtt"
RATE = 44100
catalog = json.loads((ROOT / "shared/vtt-sound-catalog.json").read_text(encoding="utf8"))
manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf8"))
existing = {a["id"] for a in catalog}
original_hashes = {a["file"]: a["sha256"] for a in manifest["assets"]}
new_sources = json.loads((SRC / "sources.json").read_text(encoding="utf8"))

for source in new_sources:
    file = ROOT / source["file"]
    assert hashlib.sha256(file.read_bytes()).hexdigest() == source["sha256"], source["slug"]
    if file.suffix not in [".zip", ".7z"]:
        continue
    dest = (SRC / file.stem).resolve()
    dest.mkdir(parents=True, exist_ok=True)
    archive = zipfile.ZipFile(file) if file.suffix == ".zip" else py7zr.SevenZipFile(file, "r")
    with archive as z:
        names = z.namelist() if file.suffix == ".zip" else z.getnames()
        assert all((dest / n).resolve().is_relative_to(dest) for n in names)
        z.extractall(dest)

def read(file):
    a, rate = sf.read(file, dtype="float32", always_2d=True)
    if a.shape[1] == 1:
        a = np.repeat(a, 2, axis=1)
    a = a[:, :2]
    if rate != RATE:
        x = np.arange(round(len(a) * RATE / rate)) * rate / RATE
        a = np.stack([np.interp(x, np.arange(len(a)), a[:, c]) for c in range(2)], axis=1).astype("float32")
    return a

def normalize(a, rms=.10):
    a = a - a.mean(axis=0)
    gain = min(rms / max(float(np.sqrt(np.mean(a*a))), 1e-7), .82 / max(float(np.max(np.abs(a))), 1e-7))
    return a * gain

def fades(a, seconds=.025):
    a = a.copy()
    n = min(round(seconds*RATE), len(a)//4)
    ramp = np.linspace(0, 1, n)[:, None]
    a[:n] *= ramp
    a[-n:] *= ramp[::-1]
    return a

def seam(a):
    n = min(RATE, len(a)//6)
    ramp = np.linspace(0, 1, n)[:, None]
    return np.concatenate([a[-n:]*(1-ramp)+a[:n]*ramp, a[n:-n]])

def tile(a, seconds, shift=0):
    a = seam(a)
    return np.roll(np.tile(a, (int(np.ceil(seconds*RATE/len(a))), 1))[:round(seconds*RATE)], shift, axis=0)

def pitch(a, speed):
    x = np.arange(round(len(a)/speed))*speed
    return np.stack([np.interp(x, np.arange(len(a)), a[:, c]) for c in range(2)], axis=1).astype("float32")

def echo(a, length=2.8, amount=.5):
    out = np.zeros((len(a)+round(length*RATE), 2), dtype="float32")
    out[:len(a)] = a
    for i, delay in enumerate([.13, .23, .37, .53, .71, .97, 1.31, 1.73, 2.29]):
        if delay > length:
            continue
        start = round(delay*RATE)
        tail = a[:, ::-1] if i%2 else a
        out[start:start+len(a)] += tail * amount * np.exp(-delay*1.6)
    return fades(out)

def combine(parts, seconds):
    out = np.zeros((round(seconds*RATE), 2), dtype="float32")
    for a, start, gain in parts:
        pos = round(start*RATE)
        end = min(len(out), pos+len(a))
        out[pos:end] += a[:end-pos]*gain
    return out

def add(id, name, kind, category, a, sources, credit, description, loop=False, volume=.6):
    if id in existing:
        return
    a = normalize(a, .085 if kind == "ambience" else .11)
    file = OUT / (id+".ogg")
    with sf.SoundFile(file, "w", samplerate=RATE, channels=2, format="OGG", subtype="VORBIS") as writer:
        for start in range(0, len(a), 8192):
            writer.write(a[start:start+8192])
    decoded, rate = sf.read(file, always_2d=True)
    rms = float(np.sqrt(np.mean(decoded**2)))
    peak = float(np.max(np.abs(decoded)))
    assert np.isfinite(decoded).all() and rms>.005 and peak<.999, id
    duration = len(decoded)/rate
    catalog.append(dict(id=id, name=name, kind=kind, category=category, path="/audio/vtt/"+file.name,
                        duration=round(duration,4), loop=loop, volume=volume, credit=credit, description=description))
    manifest["assets"].append(dict(id=id,file=file.name,sha256=hashlib.sha256(file.read_bytes()).hexdigest(),
                                  bytes=file.stat().st_size,duration=duration,sampleRate=rate,channels=2,
                                  rmsDb=round(20*np.log10(rms),2),peakDb=round(20*np.log10(peak),2),sources=sources))
    existing.add(id)
    print(id, round(duration,2), flush=True)

music = [
    ("unexplored-expansion", "music-unexplored", "Terras inexploradas", "Viagem", "Bo Jingles / TAD", "Exploração com instrumental orquestral.", ".mp3"),
    ("treasure-hunter", "music-treasure-hunter", "Caçadores de tesouros", "Aventura", "TAD", "Orquestra para descobertas e expedições.", ".mp3"),
    ("determined-pursuit-epic-orchestra-loop", "music-pursuit", "Perseguição implacável", "Batalha", "Emma_MA", "Cordas, metais e percussão em perseguição.", ".wav"),
    ("cave-theme", "music-cave", "Segredos da caverna", "Mistério", "Brandon75689 / HaelDB", "Trilha de exploração subterrânea.", ".ogg"),
    ("a-legend-will-rise-orchestral", "music-legend", "Uma lenda se ergue", "Épico", "CodeManu", "Orquestra para momentos de triunfo.", ".mp3"),
    ("new-sunrise", "music-sunrise", "Um novo amanhecer", "Épico", "nene", "Cordas, coro e metais para uma nova jornada.", ".wav"),
]
for slug, id, name, category, author, desc, ext in music:
    add(id,name,"music",category,read(SRC/(slug+ext)),[slug],author,desc,True,.55)

creatures = SRC / "80-cc0-creature-sfx"
groups = [
    ("monster",7,"Voz monstruosa","Monstros"),("roar",3,"Rugido","Monstros"),
    ("troll",3,"Voz de troll","Monstros"),("grunt",5,"Rosnado de criatura","Monstros"),
    ("hurt",3,"Criatura ferida","Monstros"),("bug",3,"Inseto gigante","Monstros"),
    ("cute",4,"Pequena criatura","Animais"),("weird",3,"Voz aberrante","Monstros"),
    ("barking",2,"Latido","Animais"),
]
for prefix, count, name, category in groups:
    for i in range(1,count+1):
        file = creatures / (prefix+"_%02d.ogg"%i)
        add("sfx-creature-"+prefix+"-"+str(i),name+" "+str(i),"effect",category,read(file),
            ["80-cc0-creature-sfx/"+file.name],"rubberduck","Vocalização de criatura para encontros e ações.")
for key, name, category in [("howl","Uivo","Animais"),("breath","Respiração de fera","Monstros")]:
    add("sfx-creature-"+key,name,"effect",category,read(creatures/(key+".ogg")),
        ["80-cc0-creature-sfx/"+key+".ogg"],"rubberduck","Vocalização curta para pontuar a cena.")

beasts = SRC / "animal-or-beast-sounds/Beast or Animal"
for file in sorted(beasts.glob("*.wav")):
    key = file.stem.lower().replace(" ","-")
    add("sfx-beast-"+key,("Rosnado de fera" if key.startswith("growl") else "Voz de fera")+" "+key.split("-")[-1],
        "effect","Monstros",read(file),["animal-or-beast-sounds/"+file.name],"pauliuw","Voz de uma fera ameaçadora.")

doors = SRC / "door-open-door-close-set/qubodup-DoorSet/ogg"
for mode, action in [("Open","Abrir"),("Close","Fechar")]:
    for i in [1,3,5,7]:
        file = doors / ("qubodup-Door"+mode+"%02d.ogg"%i)
        add("sfx-door-"+mode.lower()+"-"+str(i),action+" porta pesada "+str(i),"effect","Portas",read(file),
            ["door-open-door-close-set/"+file.name],"qubodup","Porta articulada com trinco, rangido e impacto.")

for id, name, file, author, source in [
    ("raven","Grasnado de corvo","raven-caw-v3.wav","Bidone","https://freesound.org/people/Bidone/sounds/66763/"),
    ("rat","Rato","rat.wav","Zabuhailo","https://freesound.org/people/Zabuhailo/sounds/143125/"),
    ("guinea-pig","Roedor pequeno","guinea-pig.wav","Breviceps","https://freesound.org/people/Breviceps/sounds/583077/"),
]:
    add("sfx-animal-"+id,name,"effect","Animais",read(ROOT/"public/audio/pets"/file),
        ["pets-cc0/"+file],author,"Gravação de animal; fonte CC0 identificada em CREDITS.md.")

fire = read(BASE/"fireplace-sound-loop.wav")
wind = read(BASE/"short-wind-sound-0.wav")
rain = read(OUT/"amb-rain.ogg")
forest = read(BASE/"forest-ambience.mp3")
river = read(OUT/"amb-river.ogg")
raven = read(ROOT/"public/audio/pets/raven-caw-v3.wav")
kenney = BASE/"kenney-rpg/Audio"
step = read(kenney/"footstep03.ogg")
metal = read(kenney/"metalLatch.ogg")
click = read(kenney/"metalClick.ogg")
door = read(doors/"qubodup-DoorClose07.ogg")
growl = read(beasts/"Growl 1.wav")
own = "Alvorada Cinzenta · bases CC0"
def own_effect(id,name,a,sources,desc,category="Objetos"):
    add("sfx-"+id,name,"effect",category,a,sources,own,desc)

own_effect("steel-door-open","Abrir porta de aço",echo(combine([(pitch(read(doors/"qubodup-DoorOpen05.ogg"),.8),0,.65),(metal,.08,.6),(click,.8,.3)],2),1.3,.25),
           ["door-open-door-close-set/qubodup-DoorOpen05.ogg","kenney-rpg/metalLatch.ogg","kenney-rpg/metalClick.ogg"],"Foley composto: tranca, dobradiça pesada e ressonância metálica.","Portas")
own_effect("steel-door-close","Fechar porta de aço",echo(combine([(pitch(door,.8),0,.7),(metal,.35,.6),(click,.48,.4)],1.7),2,.4),
           ["door-open-door-close-set/qubodup-DoorClose07.ogg","kenney-rpg/metalLatch.ogg","kenney-rpg/metalClick.ogg"],"Foley composto: impacto, trava e cauda metálica.","Portas")
for id,name,a in [
    ("lantern-light","Acender lamparina",combine([(click,0,.7),(fades(wind[:round(.6*RATE)]),.12,.3),(fades(fire[:RATE],.18),.35,.35)],1.8)),
    ("lantern-out","Apagar lamparina",combine([(click,0,.4),(fades(wind[:round(.4*RATE)]),.1,.4)],.9)),
    ("torch-light","Acender tocha",combine([(read(kenney/"chop.ogg"),0,.35),(fades(wind[:RATE],.1),.08,.35),(fades(fire[:RATE*2],.2),.25,.8)],2.5)),
    ("torch-out","Apagar tocha",combine([(fades(wind[:RATE],.2),0,.7),(fades(fire[:RATE],.15),0,.3)],1.2)),
]:
    own_effect(id,name,a,["kenney-rpg","short-wind-sound-0","fireplace-sound-loop"],"Foley próprio com mecanismo, sopro e transição do fogo.","Fogo e luz")
own_effect("echo-step","Passo com eco",echo(step,3,.55),["kenney-rpg/footstep03.ogg"],"Passo com reflexões estéreo de um salão de pedra.","Eco")
own_effect("echo-door","Porta com eco",echo(door,3,.65),["door-open-door-close-set/qubodup-DoorClose07.ogg"],"Impacto de porta com reverberação de pedra.","Eco")
own_effect("distant-beast","Rugido distante",echo(pitch(growl,.8),4,.65),["animal-or-beast-sounds/Growl 1.wav"],"Voz de fera mais grave com reverberação distante.","Monstros")

def drone(seconds, frequencies, level=.03):
    t=np.arange(round(seconds*RATE))/RATE
    channels=[]
    for phase in [0,.31]:
        a=sum(np.sin(2*np.pi*f*t+phase)*(.65+.25*np.sin(2*np.pi*(.035+i*.012)*t)) / (i+1)
              for i,f in enumerate(frequencies))
        channels.append(a*level)
    return np.stack(channels,axis=1).astype("float32")

def ambience(id,name,category,a,sources,desc):
    add("amb-"+id,name,"ambience",category,seam(a),sources,own,desc,True,.55)

ambience("torch","Tocha acesa","Fogo e luz",tile(fire,32)*.65+tile(wind,32,RATE*9)*.08,["fireplace-sound-loop","short-wind-sound-0"],"Fogo próximo com estalos e ar suave.")
ambience("oil-lamp","Lamparina acesa","Fogo e luz",tile(fire,28,RATE*4)*.22+drone(28,[93,186],.003),["fireplace-sound-loop","original-synthesis"],"Chama suave com crepitação discreta.")
ambience("tense-dungeon","Masmorra tensa","Tensão",tile(wind,62)*.18+drone(62,[43,65.4,89,130],.035),["short-wind-sound-0","original-synthesis"],"Bordão dissonante original e ar subterrâneo.")
ambience("haunted-crypt","Cripta assombrada","Tensão",tile(wind,62)*.15+drone(62,[37,57,114.5],.032),["short-wind-sound-0","original-synthesis"],"Baixas frequências oscilantes para um lugar inquietante.")
ambience("deep-cave","Caverna profunda","Subterrâneos",tile(wind,62)*.16+tile(echo(river[:RATE*9],3,.55),62,RATE*6)*.10,["short-wind-sound-0","sea-and-river-wave-sounds-0"],"Ar profundo e água com reflexões entre pedras.")
ambience("forest-night","Floresta à noite","Natureza",tile(forest,62)*.35+tile(wind,62,RATE*11)*.18+drone(62,[55,110],.012),["forest-ambience","short-wind-sound-0","original-synthesis"],"Mata ao longe, vento e bordão sutil de tensão.")
calls=combine([(raven,s,.35) for s in [3,17.2,35.8,49]],62)
ambience("ruin-crows","Corvos nas ruínas","Ruínas",tile(wind,62)*.23+calls,["short-wind-sound-0","pets-cc0/raven-caw-v3.wav"],"Grasnados espaçados entre rajadas de vento.")
lair=combine([(echo(pitch(growl,.85),3,.5),s,.2) for s in [5,23,43]],62)
ambience("beast-lair","Covil da fera","Tensão",tile(wind,62)*.18+lair+drone(62,[49,98],.02),["short-wind-sound-0","animal-or-beast-sounds/Growl 1.wav","original-synthesis"],"Rosnados distantes, ar e tensão de um covil.")
ambience("wind-fortress","Vento na fortaleza","Castelo",tile(wind,62)*.65+tile(fire,62,RATE*13)*.08,["short-wind-sound-0","fireplace-sound-loop"],"Rajadas entre muralhas com braseiro ao fundo.")
ambience("underground-river","Rio subterrâneo","Subterrâneos",tile(echo(river[:RATE*14],3,.45),62)*.65+tile(wind,62)*.12,["sea-and-river-wave-sounds-0","short-wind-sound-0"],"Água próxima e reflexões de uma galeria subterrânea.")
footsteps=combine([(echo(step,3,.55),s,.35) for s in [1,1.8,2.7,14,15,30,30.9,45,46]],62)
ambience("echo-hall","Salão de pedra","Interiores",tile(wind,62)*.1+footsteps,["short-wind-sound-0","kenney-rpg/footstep03.ogg"],"Passos em grupos com ecos e longas pausas.")
ambience("dark-ritual","Ritual sombrio","Tensão",drone(62,[41.2,61.8,82.5,123.7],.04)+tile(fire,62)*.15+tile(wind,62)*.08,["original-synthesis","fireplace-sound-loop","short-wind-sound-0"],"Bordões originais em camadas e braseiro de ritual.")

for file, digest in original_hashes.items():
    assert hashlib.sha256((OUT/file).read_bytes()).hexdigest()==digest, "Existing audio changed: "+file
known={s["slug"] for s in manifest["sources"]}
manifest["sources"] += [s for s in new_sources if s["slug"] not in known]
manifest["date"]="2026-10-08"
(ROOT/"shared/vtt-sound-catalog.json").write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
(OUT/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
credits=OUT/"CREDITS.md"
if "Expansão de 08/10/2026" not in credits.read_text(encoding="utf8"):
    with credits.open("a",encoding="utf8") as f:
        f.write("""

## Expansão de 08/10/2026

Todas as bases abaixo são CC0 1.0. Preservados os 75 arquivos originais.

- Bo Jingles / TAD: [Unexplored expansion](https://opengameart.org/content/unexplored-expansion).
- TAD: [Treasure Hunter](https://opengameart.org/content/treasure-hunter).
- Emma_MA: [Determined Pursuit](https://opengameart.org/content/determined-pursuit-epic-orchestra-loop).
- Brandon75689 / HaelDB: [Cave theme](https://opengameart.org/content/cave-theme), opção CC0.
- CodeManu: [A Legend Will Rise](https://opengameart.org/content/a-legend-will-rise-orchestral).
- nene: [New Sunrise](https://opengameart.org/content/new-sunrise).
- rubberduck: [80 CC0 creature SFX](https://opengameart.org/content/80-cc0-creature-sfx); seleção de 35 vocalizações, não todos os arquivos do pacote.
- pauliuw: [Animal or beast sounds](https://opengameart.org/content/animal-or-beast-sounds), sete vocalizações.
- qubodup: [Door Open, Door Close Set](https://opengameart.org/content/door-open-door-close-set), oito portas e bases para foley metálico.
- Bidone: [Corvo](https://freesound.org/people/Bidone/sounds/66763/); Breviceps: [Roedor](https://freesound.org/people/Breviceps/sounds/583077/); Zabuhailo: [Rato](https://freesound.org/people/Zabuhailo/sounds/143125/). Tratamentos já existentes em public/audio/pets, também CC0; licença e origem conservadas aqui.
- Alvorada Cinzenta: nove efeitos compostos de foley e doze ambientes, com bases CC0 já identificadas e síntese original de bordões. Porta de aço, lamparina e tocha são composições de foley; os ecos são reflexões estéreo adicionadas. Novas composições também CC0.

Build explícita em scripts/expand-vtt-sound-library.py: preservação dos hashes anteriores, validação das fontes baixadas, leitura segura de ZIP/7z, picos sem clipping, fades e ciclos sobrepostos. Não executada no deploy/startup.
""")
print("TOTAL",len(catalog),{k:sum(c["kind"]==k for c in catalog) for k in ["music","ambience","effect"]},flush=True)
