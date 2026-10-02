"""Exact native tile/sprite authoring; no generated illustration is imported.

The editor atlas uses the four standard source shades. Hardware data is 2bpp;
sprites use three opaque indices plus transparency, in CGB VRAM bank one.
Fonts are rasterized from Evergrow's bundled display/numeral fonts.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
tiles = [Image.new('L', (8,8), 0) for _ in range(128)]
sprites = []

def tile(index, pixels):
    im=Image.new('L',(8,8)); im.putdata([int(v) for row in pixels for v in row]);tiles[index]=im

tile(0,['00000000','00000000','00000000','00000000','00000000','00000000','00000000','00000000'])
tile(1,['00000000','00000000','00000000','00000000','00002000','00020200','00000000','00000000'])
tile(2,['11111111','11111111','11121111','11111111','11111111','11111111','12111111','11111111'])
tile(3,['11111111','11111111','22211111','11111111','11112221','11111111','11111111','11111111'])
tile(4,['00000000','00001000','00012100','00121210','01222221','00122100','00011000','00011000'])
tile(5,['00000000','00000000','00111100','01223210','12222221','01111110','00000000','00000000'])
tile(6,['00000000','01111100','12322210','12221221','12222121','01111110','00000000','00000000'])
tile(7,['11111111','11111111','11211111','11111111','11111111','11111111','11111111','11111111'])
tile(8,['00000000','03333330','03111130','03133130','03133130','03111130','03333330','00000000'])
tile(9,['00020000','00232000','02333200','00232000','00020000','00010000','00111000','01111100'])
tile(10,['00000000','03300330','03233230','00322300','00322300','03233230','03300330','00000000'])
tile(11,['00000000','00100100','01211210','12222221','01222210','00122100','00011000','00000000'])

def stamp(first,width,height,draw):
    im=Image.new('L',(width*8,height*8));d=ImageDraw.Draw(im);draw(d)
    for y in range(height):
        for x in range(width):tiles[first+y*width+x]=im.crop((x*8,y*8,x*8+8,y*8+8))

def tree(d):
    d.rectangle((6,16,9,23),fill=1)
    d.polygon([(8,0),(1,8),(4,8),(0,15),(3,15),(0,19),(15,19),(12,15),(15,15),(11,8),(14,8)],fill=1)
    d.polygon([(8,1),(3,8),(6,8),(1,14),(4,14),(1,17),(13,17),(10,14),(13,14),(9,8),(12,8)],fill=2)
    d.line([(8,2),(5,7),(8,7),(3,13),(6,13),(3,16)],fill=3)
stamp(12,2,3,tree)

def tent(d):
    d.polygon([(0,21),(12,1),(23,21)],fill=1)
    d.polygon([(2,20),(12,3),(21,20)],fill=2)
    d.polygon([(12,3),(12,20),(20,20)],fill=1)
    d.polygon([(8,20),(12,9),(16,20)],fill=0)
    d.line((3,20,0,23),fill=3);d.line((21,20,23,23),fill=3)
    d.line((6,15,9,9),fill=3)
stamp(18,3,3,tent)

def stall(d):
    d.rectangle((0,0,23,4),fill=1);d.rectangle((1,1,22,3),fill=2)
    d.rectangle((1,5,2,15),fill=1);d.rectangle((21,5,22,15),fill=1)
    d.rectangle((3,12,20,15),fill=1);d.line((3,12,20,12),fill=3)
    d.rectangle((7,9,9,11),fill=2);d.rectangle((15,8,17,11),fill=3)
stamp(27,3,2,stall)

def fire(d):
    d.line((1,14,14,12),fill=1,width=2);d.line((1,12,14,14),fill=1,width=2)
    d.polygon([(3,11),(5,5),(7,8),(10,1),(13,10),(11,13),(6,13)],fill=2)
    d.polygon([(7,11),(9,6),(10,11)],fill=3)
stamp(33,2,2,fire)

def chest(d):
    d.rectangle((1,1,14,7),fill=1);d.rectangle((2,2,13,4),fill=2)
    d.line((2,3,13,3),fill=3);d.rectangle((7,4,8,6),fill=3)
stamp(37,2,1,chest)

def ruins(d):
    d.rectangle((0,0,31,23),fill=1);d.rectangle((3,4,28,23),fill=2)
    d.rectangle((10,8,21,23),fill=0)
    for y in (3,7,11,15,19):d.line((0,y,31,y),fill=3)
    d.rectangle((11,9,20,23),fill=0)
stamp(39,4,3,ruins)
tile(47,['11111111','11111111','11133111','11132111','11111111','11111111','11111111','11111111'])
tile(48,['00000000','00100100','01022010','01233210','01233210','01022010','00100100','00000000'])
tile(49,['00000000','00333300','03111130','03222230','03222230','03111130','00333300','00000000'])

def water(d):
    d.rectangle((0,0,15,15),fill=1)
    for y in (2,7,12):d.line((2,y,6,y),fill=2);d.line((10,y+1,14,y+1),fill=3)
stamp(50,2,2,water)

def house(d):
    d.polygon([(0,9),(12,0),(23,9)],fill=1);d.polygon([(2,8),(12,2),(21,8)],fill=2)
    d.rectangle((3,10,20,23),fill=2);d.rectangle((10,15,15,23),fill=0)
    d.rectangle((5,13,7,15),fill=3);d.rectangle((17,13,19,15),fill=3)
    d.line((4,11,19,11),fill=1);d.line((4,19,8,19),fill=1)
stamp(54,3,3,house)
stamp(63,2,2,lambda d:(d.polygon([(8,0),(15,8),(8,15),(0,8)],fill=1),d.polygon([(8,2),(13,8),(8,13),(2,8)],fill=2),d.line((8,4,8,11),fill=3)))
tile(67,['00000000','00000000','00011000','00122100','00123100','00011000','00000000','00000000'])
tile(68,['00000000','00100100','01212100','01232100','00121000','00010000','00000000','00000000'])
tile(69,['00000000','00010000','00121000','01232100','00121000','00010000','00000000','00000000'])
tile(70,['00000000','00000000','00333000','03111300','03222300','03333300','00000000','00000000'])
tile(71,['00333000','03111300','31000130','31000130','31000130','03111300','00333000','00000000'])
tile(72,['00333000','03222300','32222230','32232230','32222230','03222300','00333000','00000000'])
tile(73,['00000000','00030000','00033000','33333300','00033000','00030000','00000000','00000000'])

for idx in range(74,128):tiles[idx]=tiles[0].copy()
for fill in range(9):
    d=ImageDraw.Draw(tiles[74+fill]);d.rectangle((0,3,7,5),fill=1)
    if fill:d.rectangle((0,3,fill-1,5),fill=3)

def hero(direction,frame):
    im=Image.new('L',(16,16));d=ImageDraw.Draw(im)
    d.rectangle((5,1,10,4),fill=1);d.rectangle((6,2,9,3),fill=3)
    d.rectangle((5,4,10,6),fill=2);d.point((9,5),fill=1)
    d.polygon([(4,7),(10,7),(12,13),(3,13)],fill=1)
    d.rectangle((5,7,9,11),fill=2);d.rectangle((6,7,7,9),fill=3)
    d.rectangle((2,8,4,11),fill=2);d.rectangle((10,8,12,10),fill=2)
    d.rectangle((4,13,6,14+frame),fill=1);d.rectangle((9,13+frame,11,15),fill=1)
    if direction==0:d.rectangle((5,2,10,5),fill=1);d.rectangle((5,7,9,11),fill=2)
    if direction==1:d.rectangle((9,3,11,5),fill=3)
    if direction==3:im=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    return im

def mob(kind):
    im=Image.new('L',(8,16));d=ImageDraw.Draw(im)
    if kind in (4,12):
        d.polygon([(0,7),(1,3),(4,5),(7,3),(7,12),(2,13)],fill=1)
        d.rectangle((1,7,6,10),fill=2);d.point((5,7),fill=3)
        d.line((1,11,0,15),fill=2);d.line((6,11,7,15),fill=2)
    elif kind==6:
        d.polygon([(4,1),(7,6),(4,12),(0,6)],fill=2);d.rectangle((2,4,5,8),fill=3)
        d.point((3,14),fill=2)
    else:
        d.rectangle((1,2,6,6),fill=1);d.rectangle((2,3,5,5),fill=2)
        d.point((2,4),fill=3);d.point((5,4),fill=3)
        d.polygon([(2,7),(5,7),(7,12),(0,12)],fill=1)
        d.rectangle((2,8,5,10),fill=2)
        d.rectangle((1,13,2,15),fill=2);d.rectangle((5,13,6,15),fill=2)
        if kind in (2,7,14,15,16):d.rectangle((0,8,7,10),fill=2)
        if kind in (3,5,9,11,13):d.line((7,4,7,13),fill=3)
    return im

sprite_images=[hero(d,f) for d in range(4) for f in range(2)]
def append_sprite(im):
    # 8x16 hardware objects: top tile, bottom tile, then next column.
    for x in range(0,im.width,8):
        sprites.append(im.crop((x,0,x+8,8)))
        sprites.append(im.crop((x,8,x+8,16)))
for im in sprite_images:append_sprite(im)
for k in range(17):append_sprite(mob(k))
for kind in range(8):
    im=Image.new('L',(8,16));d=ImageDraw.Draw(im)
    if kind==0:d.line((3,3,3,13),fill=3);d.line((1,5,3,3),fill=2);d.line((5,5,3,3),fill=2)
    elif kind==1:d.polygon([(3,3),(6,7),(3,11),(0,7)],fill=2);d.rectangle((2,5,4,8),fill=3)
    elif kind==2:d.rectangle((1,7,6,9),fill=2);d.line((2,7,5,7),fill=3)
    elif kind==3:d.rectangle((2,4,5,11),fill=2);d.line((2,4,5,4),fill=3)
    elif kind==4:d.line([(0,2),(4,4),(6,8),(4,12),(0,14)],fill=2,width=2);d.line([(0,3),(3,5),(5,8),(3,11)],fill=3)
    elif kind==5:d.line((3,2,3,9),fill=3);d.point((3,12),fill=3)
    elif kind==6:d.rectangle((1,1,6,2),fill=1);d.rectangle((1,1,5,1),fill=3)
    else:d.ellipse((0,4,7,11),outline=3);d.point((3,7),fill=2)
    append_sprite(im)

# Held silhouettes preserve the source profile order, using one 8x16 object.
for profile in range(26):
    im=Image.new('L',(8,16));d=ImageDraw.Draw(im)
    if profile in (0,3,4):
        d.line((3,2 if profile!=3 else 6,3,11),fill=3,width=2 if profile==4 else 1)
        d.line((1,11,6,11),fill=2);d.line((3,12,3,15),fill=1)
    elif profile in (1,5):
        d.line((3,3,3,15),fill=2);d.polygon([(3,2),(7,1),(7,7),(3,6)],fill=3)
        if profile==5:d.polygon([(3,2),(0,1),(0,7),(3,6)],fill=3)
    elif profile in (2,6):
        d.line((3,5,3,15),fill=2);d.rectangle((1,2,6,6 if profile==6 else 4),fill=3)
        d.point((0,3),fill=2);d.point((7,3),fill=2)
    elif profile in (7,8,9):
        d.line([(2,1),(5,4),(6,8),(5,12),(2,15)],fill=2,width=2 if profile==9 else 1)
        d.line((2,2,2,14),fill=3);d.line((0,8,6,8),fill=1)
    elif profile<17:
        d.line((3,5 if profile>=13 else 2,3,15),fill=2)
        d.polygon([(3,0 if profile<13 else 3),(5,3 if profile<13 else 6),(3,6 if profile<13 else 8),(1,3 if profile<13 else 6)],fill=3)
    elif profile<23:
        if profile<20:
            d.rectangle((1,6,6,12),fill=2);d.rectangle((2,7,5,11),fill=3);d.line((3,7,3,11),fill=1)
        else:d.ellipse((1,6,6,11),fill=2);d.point((3,7),fill=3)
    else:
        d.polygon([(0,5),(7,5),(6,11),(3,14),(1,11)],fill=2)
        d.line((1,6,6,6),fill=3);d.line((3,7,3,12),fill=3)
    append_sprite(im)

# Nine readable, eight-pixel health meters, in native 8x16 object slots.
# Only wounded enemies draw one; untouched scenery keeps its OAM budget.
assert len(sprites)==134
for fill in range(9):
    im=Image.new('L',(8,16));d=ImageDraw.Draw(im)
    d.rectangle((0,1,7,4),fill=1)
    if fill:d.rectangle((0,2,fill-1,3),fill=3)
    append_sprite(im)

display_font=ImageFont.truetype(str(REPO/'game/src/assets/fonts/PixelifySans-Variable.ttf'),10)
number_font=ImageFont.truetype(str(REPO/'game/src/assets/fonts/Barlow-Medium.ttf'),10)
for ch in range(32,128):
    glyph=Image.new('L',(8,8));d=ImageDraw.Draw(glyph);c=chr(ch)
    font=number_font if c in '0123456789.,:%+-/' else display_font
    d.text((0,-3),c,font=font,fill=255,stroke_width=0)
    # Fixed native tile cell with natural glyph rasterization, not pixel-box letters.
    tiles.append(glyph.point(lambda value:3 if value>=96 else 0))

def encode(images):
    data=[]
    for im in images:
        for y in range(8):
            row=[im.getpixel((x,y)) for x in range(8)]
            data.extend([sum((v&1)<<(7-x) for x,v in enumerate(row)),sum(((v>>1)&1)<<(7-x) for x,v in enumerate(row))])
    return data

source='/* Generated exact 2bpp artwork. See tools/generate-art.py. */\n#pragma bank 255\n#include "ev.h"\n'
for name,images in [('ev_background_tiles',tiles),('ev_sprite_tiles',sprites)]:
    values=encode(images)
    source+=f'static const UINT8 {name}[{len(values)}] = {{\n'
    for i in range(0,len(values),16):source+=','.join(f'0x{x:02x}' for x in values[i:i+16])+',\n'
    source+='};\n'
source+=f'void ev_art_load(void) BANKED {{ VBK_REG=0;set_bkg_data(0,{len(tiles)},ev_background_tiles);VBK_REG=1;set_sprite_data(0,{len(sprites)},ev_sprite_tiles);VBK_REG=0; }}\n'
(ROOT/'plugins/evergrow/engine/src/ev_art.c').write_text(source)
palette=['#193d3b','#35634b','#64935b','#d9d29b']
atlas=Image.new('RGB',(128,((len(tiles)+15)//16)*8))
for i,im in enumerate(tiles):
    rgb=Image.new('RGB',(8,8));rgb.putdata([tuple(bytes.fromhex(palette[v][1:])) for v in im.get_flattened_data()]);atlas.paste(rgb,((i%16)*8,(i//16)*8))
(ROOT/'art').mkdir(exist_ok=True)
atlas.save(ROOT/'art/evergrow-native.png')
# Manual-source atlas is an editable art reference; engine imports exact bytes.
manual=Image.new('RGB',atlas.size);source_palette=['#071821','#306850','#86c06c','#e0f8cf']
for i,im in enumerate(tiles):
    rgb=Image.new('RGB',(8,8));rgb.putdata([tuple(bytes.fromhex(source_palette[v][1:])) for v in im.get_flattened_data()]);manual.paste(rgb,((i%16)*8,(i//16)*8))
manual.save(ROOT/'art/evergrow-source.png')
print(f'Authored {len(tiles)} background/font tiles and {len(sprites)} sprite tiles; three opaque sprite indices.')
