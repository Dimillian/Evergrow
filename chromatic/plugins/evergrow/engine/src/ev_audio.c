#pragma bank 255
#include "ev.h"

void ev_sound(UINT8 sound) BANKED {
 if(!ES->sound)return;
 NR52_REG=0x80;NR50_REG=0x77;NR51_REG=0xFF;
 if(sound==0||sound==2||sound==5){
  NR41_REG=0x20;NR42_REG=sound==5?0xB2:0x82;NR43_REG=sound==0?0x24:sound==2?0x35:0x46;NR44_REG=0xC0;
 }else{
  NR10_REG=sound==4?0x16:0x00;NR11_REG=0x80;NR12_REG=0x82;
  NR13_REG=sound==3?0xD0:sound==4?0xE0:0xA0;NR14_REG=0xC6;
 }
}
void ev_audio_tick(void) BANKED {
 /* A quiet five-note home motif; combat and menus leave the pulse channel free
  * for action cues. Timer IRQs from GBVM are disabled by the native owner. */
 if(ES->sound&&EG->mode==EV_PLAY&&EG->place==EV_TOWN&&EG->tick%90==0){
  static const UINT8 notes[]={0x9D,0xC4,0xD4,0xC4,0xA8};
  NR52_REG=0x80;NR50_REG=0x55;NR51_REG=0xFF;NR21_REG=0x80;NR22_REG=0x42;NR23_REG=notes[(EG->tick/90)%5];NR24_REG=0xC6;
 }
 if(!ES->sound)NR52_REG=0;
}
