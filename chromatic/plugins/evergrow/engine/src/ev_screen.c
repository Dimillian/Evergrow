#pragma bank 255
#include "ev.h"

/* Bank 3 is a private display workspace, independent of the simulation in
 * bank 2. Compose complete screens, then update the hidden hardware tilemap.
 * The only visible change is a map switch during VBlank. */
typedef struct {
 UINT8 tiles[360],colors[360],cached_tiles[2][360],cached_colors[2][360];
 UINT8 active,dirty;
} EvScreen;
typedef char EvScreenFitsWRAM[(sizeof(EvScreen)<=4096)?1:-1];
#ifdef EV_HOST
static EvScreen host_screen;
#define SCREEN (&host_screen)
#else
#define SCREEN ((EvScreen *)0xD000)
#endif
void ev_screen_init(void) BANKED {
#ifndef EV_HOST
 SVBK_REG=3;
#endif
 memset(SCREEN,255,sizeof(EvScreen));
 memset(SCREEN->tiles,128,360);memset(SCREEN->colors,6,360);
 SCREEN->active=0;SCREEN->dirty=1;
#ifndef EV_HOST
 SVBK_REG=2;
#endif
}
void ev_tile(UINT8 x,UINT8 y,UINT8 tile,UINT8 palette) BANKED {
 UINT16 at;if(x>=20||y>=18)return;at=(UINT16)y*20+x;
#ifndef EV_HOST
 SVBK_REG=3;
#endif
 if(SCREEN->tiles[at]!=tile||SCREEN->colors[at]!=palette){
  SCREEN->tiles[at]=tile;SCREEN->colors[at]=palette;SCREEN->dirty=1;
 }
#ifndef EV_HOST
 SVBK_REG=2;
#endif
}
void ev_present(void) BANKED {
 UINT8 next,y,x,start,length;UINT16 row,at;
#ifndef EV_HOST
 UINT8 *destination;SVBK_REG=3;
#endif
 /* A clear followed by identical HUD text is not a new visible frame. */
 if(SCREEN->dirty&&!memcmp(SCREEN->tiles,SCREEN->cached_tiles[SCREEN->active],360)&&!memcmp(SCREEN->colors,SCREEN->cached_colors[SCREEN->active],360))SCREEN->dirty=0;
 if(SCREEN->dirty){
  next=SCREEN->active^1;
#ifndef EV_HOST
  destination=(UINT8 *)(next?0x9C00:0x9800);
#endif
  for(y=0;y<18;y++){
   row=(UINT16)y*20;x=0;
   while(x<20){
    at=row+x;
    if(SCREEN->tiles[at]==SCREEN->cached_tiles[next][at]&&SCREEN->colors[at]==SCREEN->cached_colors[next][at]){x++;continue;}
    start=x++;
    while(x<20&&(SCREEN->tiles[row+x]!=SCREEN->cached_tiles[next][row+x]||SCREEN->colors[row+x]!=SCREEN->cached_colors[next][row+x]))x++;
    length=x-start;at=row+start;
#ifndef EV_HOST
    /* GB Studio's set_tiles adds __map_tile_offset from its bank-1
     * globals. That address aliases unrelated data in our private WRAM.
     * Raw VRAM runs have no engine-global tile offset dependency. */
    VBK_REG=1;set_data(destination+(UINT16)y*32+start,&SCREEN->colors[at],length);
    VBK_REG=0;set_data(destination+(UINT16)y*32+start,&SCREEN->tiles[at],length);
#endif
    memcpy(&SCREEN->cached_tiles[next][at],&SCREEN->tiles[at],length);
    memcpy(&SCREEN->cached_colors[next][at],&SCREEN->colors[at],length);
   }
  }
#ifndef EV_HOST
  /* No drawing to the visible map, including the intermediate clear passes. */
  wait_vbl_done();
  if(next)LCDC_REG|=0x08;else LCDC_REG&=~0x08;
#endif
  SCREEN->active=next;SCREEN->dirty=0;
 }
#ifndef EV_HOST
 SVBK_REG=2;
#endif
}
#ifdef EV_HOST
UINT8 ev_screen_read(UINT8 x,UINT8 y){return SCREEN->cached_tiles[SCREEN->active][y*20+x];}
#endif
