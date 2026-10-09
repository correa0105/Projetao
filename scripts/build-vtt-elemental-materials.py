"""Original animated materials for the user's second visual review.
No source images: molten crust / photometric light / pressure fronts / wet
corrosion / branched ion channels are baked procedurally, with native alpha.
"""
from pathlib import Path
import hashlib, json, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/vtt/elemental-20261009'; OUT.mkdir(parents=True,exist_ok=True)
SIZE,FRAMES,PAD=256,32,2
Y,X=np.mgrid[-1:1:complex(SIZE),-1:1:complex(SIZE)].astype(np.float32)
R,A=np.hypot(X,Y),np.arctan2(Y,X)

def smooth(a,b,x):
    u=np.clip((x-a)/(b-a),0,1); return u*u*(3-2*u)

def noise(x,y,seed=0):
    ix,iy=np.floor(x),np.floor(y); u,v=x-ix,y-iy
    u,v=u*u*(3-2*u),v*v*(3-2*v)
    def h(dx,dy):
        z=np.sin((ix+dx)*127.1+(iy+dy)*311.7+seed*17.37)*43758.5453
        return z-np.floor(z)
    return (h(0,0)*(1-u)+h(1,0)*u)*(1-v)+(h(0,1)*(1-u)+h(1,1)*u)*v

def fbm(x,y,p,seed=0):
    out=np.zeros_like(x)
    for k,w in enumerate([.49,.26,.14,.075,.035]):
        s=2**k; out+=noise(x*s+math.cos(p*(k+1))*.8,y*s+math.sin(p*(k+1))*.8,seed+k*11)*w
    return out

def rgba(rgb,alpha):
    return Image.fromarray(np.uint8(np.dstack([np.clip(rgb,0,1),np.clip(alpha,0,1)])*255))

def cells(x,y,seed,count=37):
    rng=np.random.default_rng(seed); points=rng.uniform(-1.35,1.35,(count,2))
    first=np.full_like(x,20); second=np.full_like(x,20)
    for px,py in points:
        d=np.hypot(x-px,y-py)
        second=np.minimum(second,np.maximum(first,d)); first=np.minimum(first,d)
    return first,second-first

# Fixed topography with subpixel rough boundaries. It is not a rotating crack
# drawing. Only molten convection/light changes inside the channels over time.
coarse0=fbm(X*3,Y*3,0,24)
warpx=X+(fbm(X*3,Y*3,0,16)-.5)*.23
warpy=Y+(fbm(X*3,Y*3,0,79)-.5)*.23
dist,gap=cells(warpx,warpy,42,43)
stone_grain=noise(X*75,Y*75,53)
crust_height=smooth(.018,.085,gap)*(coarse0*.67+stone_grain*.17+.19)
gy,gx=np.gradient(crust_height)
light=np.clip(.55-gx*8-gy*12,.19,.94)
edge=smooth(1,.84,R+(coarse0-.5)*.15)

def lava(frame):
    p=frame/FRAMES*math.tau
    conv=fbm(X*8,Y*8,p,88)
    vein=1-smooth(.011,.065+(coarse0-.5)*.04,gap)
    heat=np.clip(.4+conv*.59+.13*np.sin(X*7-Y*5+p),0,1)
    hot=np.stack([np.ones_like(X),.17+heat*.68,.006+heat**5*.52],-1)
    rock=np.stack([light*.24,light*.215,light*.19],-1)*( .76+stone_grain[...,None]*.36)
    glow=np.exp(-gap*30)*(.14+conv*.15)
    mix=np.clip(vein*.94+glow,0,1)
    return rgba(rock*(1-mix[...,None])+hot*mix[...,None],edge*.96)

def bless(frame):
    p=frame/FRAMES*math.tau
    drift=fbm(X*4,Y*4,p,9)
    radial=smooth(.13,.38,R)*smooth(1,.8,R)
    # Soft gold curtains split into fine moving filaments. Bright areas are
    # translucent, with an ivory core; no feathers, rune stamp or hard outline.
    band=(.5+.5*np.sin(A*4+drift*2+math.sin(p)*.4))**3
    rays=(.5+.5*np.sin(A*32+drift*2+math.sin(p*2)*.15))**7
    halo=np.exp(-((R-.68)/.13)**2)
    density=radial*(band*.17+rays*.055+halo*.25)*(.7+drift*.4)
    shimmer=fbm(X*22,Y*22,p,57)
    density*=.66+shimmer*.7
    hot=np.clip(density*1.7,0,1)
    rgb=np.stack([np.ones_like(X),.69+hot*.29,.30+hot*.66],-1)
    return rgba(rgb,density*smooth(1,.87,R))

def sonic(frame):
    p=frame/FRAMES*math.tau
    n=fbm(X*8,Y*8,p,27)
    # Travelling pressure packets, with compression on one edge and turbulent
    # diffraction behind it. Dense fine grain describes the medium, not a line.
    wave=.5+.5*np.cos(R*19-p*2+(n-.5)*1.1)
    ridge=smooth(.67,.985,wave)
    lobe=.36+.64*(.5+.5*np.cos(A*3+math.sin(p)*.25))
    fade=smooth(.09,.3,R)*smooth(1,.81,R)
    density=(ridge*.6+smooth(.25,.66,wave)*.08)*lobe*fade
    density*=.52+n*.72
    rgb=np.stack([.64+density*.35,.82+density*.17,np.ones_like(X)],-1)
    return rgba(rgb,density)

def acid(frame):
    p=frame/FRAMES*math.tau
    n=fbm(X*4+.1*np.sin(p),Y*4,p,113)
    fine=fbm(X*10,Y*10,p,72)
    shape=R+(n-.5)*.28+.05*np.sin(A*7+p)
    wet=smooth(.96,.68,shape)
    edge=(1-smooth(.007,.026,np.abs(shape-.77)))*wet
    bubbles=np.maximum(0,np.cos(X*13+np.sin(p)) * np.cos(Y*17+np.cos(p*2))-.78)
    gy,gx=np.gradient(n); shine=np.clip(.2-gx*7-gy*11,0,1)
    rgb=np.stack([.15+shine*.29,.33+shine*.47,.09+shine*.19],-1)
    rgb+=edge[...,None]*np.array([.17,.29,.08])+bubbles[...,None]*np.array([.8,.8,.45])
    return rgba(rgb,(wet*(.39+fine*.10)+edge*.40+bubbles*.46)*smooth(1,.87,R))

def water(frame):
    p=frame/FRAMES*math.tau
    n=fbm(X*5,Y*5,p,178)
    n2=fbm(X*11,Y*11,p,216)
    radius=R+(n-.5)*.09
    # Two travelling, breaking crests. Fine cellular speculars sit on a deep
    # transparent water body; no fixed curl or radially arranged brush arms.
    wave=.5+.5*np.cos(radius*14-p*2+(n-.5)*2)
    foam=smooth(.79,.97,wave)*smooth(.24,.71,n2)
    wet=smooth(.98,.85,R)*smooth(.11,.28,R)
    caustic=(1-smooth(.022,.12,np.abs(n2-.51))) * .21
    shine=np.clip(foam*.85+caustic,0,1)
    rgb=np.stack([.07+shine*.86,.35+shine*.59,.47+shine*.50],-1)
    return rgba(rgb,wet*(.16+wave*.19+foam*.54+caustic*.20))

def water_jet(frame):
    p=frame/FRAMES*math.tau
    u=(1-Y)/2
    n=fbm(X*7,Y*6,p,712)
    fine=fbm(X*24,Y*19,p,838)
    center=.1*np.sin(u*8-p)+.07*np.sin(u*17+p*2)
    width=.055+u**1.4*.55
    fan=np.exp(-((X-center)/width)**2)*smooth(.03,.16,u)*smooth(.98,.66,u)
    density=smooth(.22,.76,fan*(.44+n*.77+fine*.3))
    glints=smooth(.52,.75,fine)*density
    rgb=np.stack([.14+glints*.85,.49+glints*.50,.62+glints*.37],-1)
    return rgba(rgb,density*.77)

def rift(frame):
    p=frame/FRAMES*math.tau
    n=fbm(X*9,Y*7,p,307)
    bend=.04*np.sin(Y*8+p)+.035*np.sin(Y*15-p*2)
    width=.19*np.sqrt(np.clip(1-(Y/.9)**2,0,1))
    seam=np.abs(X-bend)-width-(n-.5)*.055
    inner=smooth(.014,-.018,seam)*smooth(.94,.84,np.abs(Y))
    lip=np.exp(-(seam/.018)**2)*smooth(.95,.84,np.abs(Y))
    aura=np.exp(-(seam/.10)**2)*smooth(.97,.77,np.abs(Y))
    stars=smooth(.84,.93,noise(X*58+math.sin(p)*.4,Y*58+math.cos(p)*.4,312))*inner
    rgb=np.stack([.035+lip*.42+aura*.11+stars*.4,.018+lip*.60+aura*.07+stars*.35,.085+lip*.86+aura*.25+stars*.65],-1)
    return rgba(rgb,np.clip(inner*.87+lip*.77+aura*.27,0,1))

def prism(frame):
    p=frame/FRAMES*math.tau
    n=fbm(X*5,Y*5,p,418)
    q=R*15-p*2+(n-.5)*3
    caustic=(.5+.5*np.cos(q))**5
    density=caustic*smooth(.18,.4,R)*smooth(.99,.78,R)*(.38+n*.4)
    hue=A+R*4+p
    rgb=np.stack([.45+.55*(.5+.5*np.cos(hue)),.45+.55*(.5+.5*np.cos(hue-2.1)),.45+.55*(.5+.5*np.cos(hue+2.1))],-1)
    rgb=rgb*(1-density[...,None]*.5)+density[...,None]*.5
    return rgba(rgb,density)

def fire_volume(frame):
    p=frame/FRAMES*math.tau
    nx=X+.18*np.sin(Y*6+p)+.07*np.sin(Y*17-p*2)
    ny=Y+.14*np.sin(X*7-p)
    coarse=fbm(nx*4,ny*4,p,529)
    fine=fbm(nx*12,ny*12,p,617)
    envelope=np.exp(-((np.hypot(nx,ny)/.59)**2))
    fuel=envelope*(.38+coarse*.9+fine*.33)
    density=smooth(.20,.75,fuel)*smooth(1,.81,R)
    heat=np.clip((fuel-.23)*1.8,0,1)
    rgb=np.stack([np.ones_like(X),.15+heat*.81,.014+heat**3*.73],-1)
    return rgba(rgb,density)

def electric(frame):
    w,h,up=480,128,3
    rng=random.Random(914+frame//4*47); layer=Image.new('RGBA',(w*up,h*up))
    draw=ImageDraw.Draw(layer)
    def path(a,b,depth=6,rough=.19):
        pts=[a,b]
        for level in range(depth):
            out=[pts[0]]
            for p,q in zip(pts,pts[1:]):
                dx,dy=q[0]-p[0],q[1]-p[1];d=math.hypot(dx,dy)
                offset=rng.uniform(-1,1)*d*rough
                out.extend([((p[0]+q[0])/2-dy/(d or 1)*offset,(p[1]+q[1])/2+dx/(d or 1)*offset),q])
            pts=out
        return pts
    def channel(pts,width,alpha):
        for i,(p,q) in enumerate(zip(pts,pts[1:])):
            power=alpha*(.65+rng.random()*.35)
            draw.line([(p[0]*up,p[1]*up),(q[0]*up,q[1]*up)],fill=(215,238,255,int(power)),width=max(1,int(width*up*(.66+rng.random()*.52))))
    points=path((18,64),(462,64),rough=.13)
    channel(points,1.9,244)
    for i in [9,19,29,41,52]:
        origin=points[i]; sign=rng.choice([-1,1]);end=(origin[0]+rng.uniform(23,67),np.clip(origin[1]+sign*rng.uniform(15,45),8,120))
        branch=path(origin,end,4,.26);channel(branch,.75,192)
        root=branch[len(branch)//2]; fork=(root[0]+rng.uniform(8,23),np.clip(root[1]+sign*rng.uniform(5,15),4,124))
        channel(path(root,fork,3,.28),.25,98)
    layer=layer.resize((w,h),Image.Resampling.LANCZOS)
    # Ionized blue sheath + broader faint scatter + hot, irregular white core.
    alpha=np.asarray(layer)[:,:,3].astype(np.float32)/255
    glow=layer.getchannel('A').filter(ImageFilter.GaussianBlur(2.4))
    broad=layer.getchannel('A').filter(ImageFilter.GaussianBlur(6))
    g=np.asarray(glow).astype(np.float32)/255; b=np.asarray(broad).astype(np.float32)/255
    phase=frame%4/4; envelope=.43+.57*math.exp(-phase*3.7)
    opacity=np.clip(alpha+g*.78+b*.4,0,1)*envelope
    core=alpha/np.maximum(.001,alpha+g*.85+b*.55)
    rgb=np.stack([.29+core*.7,.65+core*.35,np.ones_like(core)],-1)
    return rgba(rgb,opacity)

def fracture():
    n=fbm(X*15,Y*15,0,63)
    width=.013+(n-.5)*.012
    cavity=1-smooth(width,width+.012,gap)
    rim=np.exp(-((gap-(width+.019))/.012)**2)*(.35+stone_grain*.4)
    # Only cracks and eroded rims carry alpha. The existing ground material,
    # boulders and dust in Fissuras sísmicas are preserved by the renderer.
    shadow=np.stack([.10+stone_grain*.055,.075+stone_grain*.05,.05+stone_grain*.04],-1)
    bevel=np.stack([.47+light*.22,.38+light*.19,.27+light*.17],-1)
    total=np.clip(cavity*.79+rim*.47,0,1)*edge
    rgb=(shadow*cavity[...,None]+bevel*rim[...,None]) / np.maximum(.001,(cavity+rim)[...,None])
    return rgba(rgb,total)

manifest={'generator':'scripts/build-vtt-elemental-materials.py','provenance':'Original procedural art; no third-party source media.',
          'frames':FRAMES,'fps':24,'gutter':PAD,'materials':{},'files':[]}
for kind,fn in [('lava',lava),('blessing',bless),('resonance',sonic),('acid',acid),('electric',electric),('water',water),('rift',rift),('prism',prism),('fire-volume',fire_volume),('water-jet',water_jet)]:
    w,h=(480,128) if kind=='electric' else (SIZE,SIZE)
    manifest['materials'][kind]={'width':w,'height':h,'pages':2}
    for page in range(2):
        atlas=Image.new('RGBA',((w+PAD*2)*4,(h+PAD*2)*4))
        for local in range(16):
            im=fn(page*16+local); atlas.paste(im,((local%4)*(w+PAD*2)+PAD,(local//4)*(h+PAD*2)+PAD))
        path=OUT/f'{kind}-{page}.webp';atlas.save(path,'WEBP',quality=93,method=5,exact=True)
        manifest['files'].append({'path':str(path.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    # A dark checker-free review shows native alpha compositing clearly.
    strip=Image.new('RGBA',(w*4,h),(18,27,34,255))
    for i in range(4):strip.alpha_composite(fn(i*7),(i*w,0))
    review=ROOT/'.local/elemental-review';review.mkdir(parents=True,exist_ok=True)
    strip.convert('RGB').save(review/f'{kind}.png');print(kind,FRAMES,'frames',flush=True)
path=OUT/'earth-fracture.webp';fracture().save(path,'WEBP',quality=96,method=5,exact=True)
manifest['files'].append({'path':str(path.relative_to(ROOT)).replace('\\','/'),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
(ROOT/'data/vtt/elemental-materials-20261009.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
