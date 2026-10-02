#pragma bank 255
#include "ev.h"
#include "interrupts.h"

/* GBVM's ordinary globals extend into switchable WRAM. Native pointers must
 * live in fixed HRAM, beyond GBDK's FF80..FF92 DMA/banking workspace. */
EvGame * __at(0xFF94) ev_game;
UINT8 * __at(0xFF96) ev_sram;

static void ev_run(void) {
 /* A dedicated native scene owns rendering/input/save timing. Core GBVM remains
  * intact and editable; we neither eject nor patch its shared engine. */
 DISPLAY_OFF;SVBK_REG=2;memset(EG,0,sizeof(EvGame));
 _shadow_OAM_base=(UINT8)((UINT16)&shadow_OAM>>8);
 LCDC_REG=LCDCF_BG8000|LCDCF_BG9800|LCDCF_OBJ16|LCDCF_OBJON|LCDCF_BGON;
 SCX_REG=0;SCY_REG=0;HIDE_WIN;
 ev_screen_init();ev_art_load();EG->biome=0;ev_palettes();EG->mode=EV_TITLE;EG->menu_dirty=1;EG->save.sound=1;
 DISPLAY_ON;
 while(1){
  wait_vbl_done();
  ev_update(joypad());
  if(EG->mode!=EV_PLAY){if(EG->menu_dirty){ev_menu_draw();EG->menu_dirty=0;}}
  else if(EG->tick%12==0)ev_hud();
  ev_draw_actors();ev_present();

 }
}
void evergrow_init(void) BANKED {
 remove_LCD_ISRs();remove_VBL(VBL_isr);set_interrupts(VBL_IFLAG);
 ev_game=(EvGame *)0xD000;ev_sram=(UINT8 *)0xA000;
 /* The hardware stack must stay in fixed WRAM when bank two is selected.
  * This scene never returns to GBVM, whose old stack lives in bank one. */
 __asm
  ld sp,#0xcff0
 __endasm;
 ev_run();
}
void evergrow_update(void) BANKED { /* Native owner loop entered by init. */ }
