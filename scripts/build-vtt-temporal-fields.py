"""Original seamless VFX density fields. No third-party art or video inputs.

Deterministic periodic advection/domain warping evolves the actual texels;
the browser only samples precomputed frames (never calculates pixel noise).
Run with Python + numpy + Pillow. Atlas gutters prevent adjacent-frame bleed.
"""
from pathlib import Path
import hashlib, json, math, sys
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/vtt/temporal-20261009'
OUT.mkdir(parents=True, exist_ok=True)
SIZE, FRAMES, FPS, PAD = 256, 48, 24, 2
Y, X = np.mgrid[-1:1:complex(SIZE), -1:1:complex(SIZE)].astype(np.float32)
R, A = np.hypot(X, Y), np.arctan2(Y, X)

def noise(x, y, seed=0):
    ix, iy = np.floor(x), np.floor(y)
    u, v = x-ix, y-iy
    u, v = u*u*(3-2*u), v*v*(3-2*v)
    def h(dx, dy):
        z = np.sin((ix+dx)*127.1+(iy+dy)*311.7+seed*19.71)*43758.5453
        return z-np.floor(z)
    return (h(0,0)*(1-u)+h(1,0)*u)*(1-v)+(h(0,1)*(1-u)+h(1,1)*u)*v

def fbm(x, y, p, seed=0):
    result = np.zeros_like(x)
    for k, weight in enumerate([.47,.27,.15,.075,.035]):
        s = 2**k
        result += noise(x*s+math.cos(p*(k+1))*1.2,
                        y*s+math.sin(p*(k+1))*1.2, seed+k*7)*weight
    return result

def smooth(a, b, x):
    q = np.clip((x-a)/(b-a), 0, 1)
    return q*q*(3-2*q)

def field(kind, frame):
    p = frame/FRAMES*math.tau
    # Periodic vortical displacement: a changing flow, not a moving rigid sprite.
    wx = .17*np.sin(Y*7+p)+.12*np.cos(Y*13-p*2)
    wy = .15*np.cos(X*6-p)+.08*np.sin(X*17+p*2)
    tx, ty = X+wx, Y+wy
    coarse = fbm(tx*3, ty*3, p, 31)
    fine = fbm(tx*10, ty*10, p, 92)
    curl = .5+.5*np.sin(A*7+R*12-p*3+coarse*9)
    if kind == 'vortex':
        spiral = .5+.5*np.sin(A*2-R*16+p*2+coarse*4)
        envelope = smooth(1,.79,R)*smooth(.02,.28,R)
        density = smooth(.24,.89,spiral*.63+coarse*.59+fine*.18)*envelope
        shading = np.clip(.27+fine*.37+density*.33,0,1)
        return rgba(np.stack([shading*.87,shading*.96,shading],-1),density*.85)
    if kind == 'ring':
        envelope = np.exp(-((R-(.64+.08*curl))/.19)**2)
        fuel = envelope*(.45+.74*coarse+.32*fine)
    elif kind == 'wave':
        front = .32*np.sin(X*3+p)+.12*np.cos(X*7-p*2)
        envelope = np.exp(-((Y-front)/.31)**2)*smooth(1,.73,np.abs(X))
        fuel = envelope*(.4+.85*coarse+.27*fine)
    elif kind == 'geyser':
        envelope = np.exp(-(R/.67)**2)*(.55+.45*curl)
        fuel = envelope*(.44+coarse+fine*.3)
    elif kind == 'spiral':
        spiral = .5+.5*np.sin(A*2-R*15+p*2+coarse*4)
        envelope = smooth(1,.7,R)*smooth(.05,.26,R)*(.15+.85*spiral)
        fuel = envelope*(.4+.83*coarse+.32*fine)
    elif kind == 'tongue':
        ascent = (1-Y)/2
        center = .15*np.sin(ascent*10-p)+.07*np.cos(ascent*19+p*2)
        width = .09+.43*(1-ascent)
        envelope = np.exp(-((X-center)/width)**2)*smooth(0,.16,ascent)*smooth(1,.56,ascent)
        fuel = envelope*(.44+coarse+.2*fine)
    else: # turbulent vapour / souls / wind
        envelope = smooth(1,.66,R)*np.exp(-((R-.54)/.43)**2)
        density = smooth(.2,.79,coarse+.35*fine)*envelope
        shading = np.clip(.24+density*.55+fine*.3,0,1)
        rgb = np.stack([shading*.9,shading*.98,shading],-1)
        return rgba(rgb, density*.72)
    density = smooth(.28,.94,fuel)*smooth(1,.89,R)
    heat = np.clip((fuel-.31)*1.45,0,1)
    # Hot ivory core, yellow body and transparent red edge; fine wisps die away.
    rgb = np.stack([np.ones_like(heat), .16+heat*.78, .025+heat**3*.7],-1)
    return rgba(rgb, density)

def rgba(rgb, alpha):
    return Image.fromarray(np.uint8(np.dstack([np.clip(rgb,0,1),np.clip(alpha,0,1)])*255))

manifest = {'generator':'scripts/build-vtt-temporal-fields.py',
            'provenance':'Original deterministic procedural fields; no JB2A media incorporated.',
            'size':SIZE,'frames':FRAMES,'fps':FPS,'gutter':PAD,'pages':[]}
for kind in ['ring','wave','geyser','spiral','tongue','vapour','vortex']:
    sample = []
    for page in range(3):
        path = OUT/f'{kind}-{page}.webp'
        if len(sys.argv)>1 and kind not in sys.argv[1:] and path.exists():
            manifest['pages'].append({'path':str(path.relative_to(ROOT)).replace('\\','/'),
                                     'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
            continue
        atlas = Image.new('RGBA', ((SIZE+PAD*2)*4, (SIZE+PAD*2)*4))
        for local in range(16):
            im = field(kind,page*16+local)
            atlas.paste(im, ((local%4)*(SIZE+PAD*2)+PAD,(local//4)*(SIZE+PAD*2)+PAD))
            if page == 0 and local in [0,4,8,12]: sample.append(im)
        atlas.save(path, 'WEBP', quality=90, method=5, exact=True)
        manifest['pages'].append({'path':str(path.relative_to(ROOT)).replace('\\','/'),
                                 'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    if not sample: continue
    strip = Image.new('RGBA',(SIZE*4,SIZE))
    for i,im in enumerate(sample): strip.paste(im,(i*SIZE,0))
    review = ROOT/'.local/temporal-review'; review.mkdir(parents=True,exist_ok=True)
    strip.save(review/f'{kind}.png')
    print(kind, '48 frames', flush=True)
destination = ROOT/'data/vtt/temporal-fields-20261009.json'
destination.write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
