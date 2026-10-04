#!/usr/bin/env python3
"""Exact derivatives of the supplied kit; no generated/replacement artwork.
Requires Pillow. Usage: python3 scripts/brand/build_assets.py /path/MSRobot.zip
The user-supplied archive remains the source; raw boards are not shipped.
"""
import hashlib, io, json, sys, zipfile
from pathlib import Path
from PIL import Image, ImageOps
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'public/brand/ms-robot'
OUT.mkdir(parents=True, exist_ok=True)
z = zipfile.ZipFile(sys.argv[1])
seen = {}; inventory = []
for name in sorted(z.namelist()):
    if name.endswith('/'): continue
    raw = z.read(name); digest = hashlib.sha256(raw).hexdigest()
    duplicate = seen.get(digest)
    inventory.append({'source': name, 'sha256': digest, 'bytes': len(raw), 'canonical_source': duplicate or name, 'archive_only': name.startswith('msROBOT/10_') or duplicate is not None})
    seen.setdefault(digest, name)

def source(name):
    return Image.open(io.BytesIO(z.read('msROBOT/' + name))).convert('RGBA')

files = []
def save(image, name, width, square=False, png=False):
    image = ImageOps.fit(image, (width, width), method=Image.Resampling.LANCZOS) if square else image.resize((width, round(image.height * width / image.width)), Image.Resampling.LANCZOS)
    path = OUT / (name + '.webp'); image.save(path, 'WEBP', quality=86, method=6)
    files.append({'path': '/brand/ms-robot/' + path.name, 'width': image.width, 'height': image.height, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    if png:
        path = OUT / (name + '.png'); image.save(path, 'PNG', optimize=True)
        files.append({'path': '/brand/ms-robot/' + path.name, 'width': image.width, 'height': image.height, 'bytes': path.stat().st_size, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})

icon = source('02_App_Icons_Favicon/neon_cyberpunk_portrait_icon.png')
for size in [32,48,96,192,512]: save(icon, 'icon-' + str(size), size, square=True, png=True)
for size in [32,48,64,96,128,256]: save(icon, 'avatar-' + str(size), size, square=True)
logo = source('01_Logos/neon_ms_robot_cyberpunk_emblem.png')
logo = logo.crop(logo.getchannel('A').point(lambda value: 255 if value > 20 else 0).getbbox())
for width in [192,384]: save(logo, 'signature-' + str(width), width)
sheet = source('04_Character_States_Expressions/ms_robot_expressions_status_sheet.png')
# Visually reviewed portrait-only crops, excluding headings/captions/board chrome.
for index,state in enumerate(['neutral','welcome','happy','thinking','analysing','explaining','excited','success','alert','confused','offline','idle']):
    col,row=index%4,index//4
    box=(round(sheet.width*(.018+col*.25)),round(sheet.height*(.078+row*.289)),round(sheet.width*(.243+col*.25)),round(sheet.height*(.300+row*.289)))
    portrait=sheet.crop(box)
    for width in [96,192]: save(portrait,'state-'+state+'-'+str(width),width)
manifest={'schema':'ms-robot.brand.v1','identity':'Ms Robot','system':'cyan graphite','source_archive_sha256':hashlib.sha256(Path(sys.argv[1]).read_bytes()).hexdigest(),'source_inventory':inventory,'production':files,'favicon':'/favicon.svg','rules':['Existing simple M mark is retained for tiny favicon legibility; portrait is never a 16px favicon.','Alternate MR red/purple board is reference-only.','Marketing mockup measurements are not analytics evidence.','Character images are decorative; backend status and ordinary text remain authoritative.','No raw PNG boards or duplicate source folders in public build.']}
(ROOT/'docs/brand/asset-registry.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'sources':len(inventory),'unique_sources':len(seen),'production_files':len(files),'production_bytes':sum(x['bytes'] for x in files)}))
