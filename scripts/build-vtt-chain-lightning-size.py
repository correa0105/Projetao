"""Enlarge only the editable native electrical channels; keep paths/timing/colors."""
from pathlib import Path
import ast, hashlib, json, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
source=(ROOT/'scripts/build-vtt-elemental-materials.py').read_text(encoding='utf8')
tree=ast.parse(source)
functions={n.name:ast.get_source_segment(source,n) for n in tree.body if isinstance(n,ast.FunctionDef)}
assert 'channel(points,1.9,244)' in functions['electric']
assert 'channel(branch,.75,192)' in functions['electric']
electric_source=functions['electric'].replace('channel(points,1.9,244)','channel(points,3.4,244)').replace('channel(branch,.75,192)','channel(branch,1.25,192)').replace('),.25,98)', '),.42,98)')
assert electric_source!=functions['electric']
exec(functions['rgba'])
exec(electric_source)
OUT=ROOT/'public/vtt/chain-lightning-20261010';OUT.mkdir(parents=True,exist_ok=True)
w,h,pad,frames=480,128,2,32
manifest={'generator':'scripts/build-vtt-chain-lightning-size.py','provenance':'Existing original editable native channel generator; only primary/fork widths increased. Paths, seeds, envelope, timing and colors unchanged.','width':w,'height':h,'frames':frames,'fps':24,'gutter':pad,'primary_width':3.4,'branch_width':1.25,'minor_width':.42,'files':[]}
for page in range(2):
 atlas=Image.new('RGBA',((w+2*pad)*4,(h+2*pad)*4))
 for local in range(16):atlas.paste(electric(page*16+local),((local%4)*(w+2*pad)+pad,(local//4)*(h+2*pad)+pad))
 dest=OUT/f'electric-{page}.webp';atlas.save(dest,'WEBP',quality=95,method=5,exact=True)
 manifest['files'].append({'path':dest.relative_to(ROOT).as_posix(),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
(ROOT/'data/vtt/chain-lightning-size-20261010.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf8')
print('Saved two original electrical atlases with broader cores and tapered branches; paths/timing unchanged.')
