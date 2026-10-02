#pragma bank 255
#include "ev.h"

#ifndef EV_HOST
static const UINT16 foliage[9][4]={
 {RGB(3,6,7),RGB(6,11,9),RGB(11,17,11),RGB(22,23,16)},
 {RGB(3,7,6),RGB(6,13,9),RGB(12,21,12),RGB(22,26,17)},
 {RGB(3,6,8),RGB(5,10,10),RGB(10,17,14),RGB(18,23,17)},
 {RGB(4,7,11),RGB(8,13,16),RGB(17,23,24),RGB(28,30,28)},
 {RGB(7,5,6),RGB(11,8,7),RGB(19,12,8),RGB(28,20,12)},
 {RGB(6,6,6),RGB(13,10,6),RGB(23,16,8),RGB(29,24,15)},
 {RGB(5,7,9),RGB(10,12,14),RGB(17,19,16),RGB(25,26,21)},
 {RGB(6,8,6),RGB(11,14,9),RGB(20,22,13),RGB(28,28,20)},
 {RGB(10,7,5),RGB(16,12,7),RGB(25,21,13),RGB(30,28,20)}
};
static const UINT16 materials[7][4]={
 {RGB(5,7,7),RGB(13,13,10),RGB(18,18,13),RGB(25,24,17)},
 {RGB(4,6,7),RGB(10,9,7),RGB(25,20,11),RGB(30,27,18)},
 {RGB(5,5,7),RGB(11,6,5),RGB(26,13,8),RGB(31,26,14)},
 {RGB(3,6,9),RGB(6,11,15),RGB(12,19,22),RGB(24,28,28)},
 {RGB(5,5,9),RGB(10,9,16),RGB(17,14,24),RGB(25,23,30)},
 {RGB(2,4,5),RGB(5,8,9),RGB(18,20,16),RGB(29,27,20)},
 {RGB(3,6,9),RGB(7,12,16),RGB(16,22,23),RGB(30,28,20)}
};
static const UINT16 objects[8][4]={
 {0,RGB(2,4,5),RGB(25,20,11),RGB(30,27,18)},
 {0,RGB(2,4,5),RGB(16,17,15),RGB(28,27,21)},
 {0,RGB(2,5,8),RGB(11,20,25),RGB(27,30,30)},
 {0,RGB(7,3,4),RGB(25,10,8),RGB(31,23,17)},
 {0,RGB(3,6,5),RGB(13,21,12),RGB(25,29,18)},
 {0,RGB(5,4,9),RGB(18,12,25),RGB(29,24,30)},
 {0,RGB(7,5,3),RGB(28,22,10),RGB(31,29,21)},
 {0,RGB(3,5,7),RGB(21,23,25),RGB(31,31,28)}
};
void ev_palettes(void) BANKED {
 UINT8 i;set_bkg_palette(0,1,foliage[EG->biome<9?EG->biome:0]);
 for(i=1;i<8;i++)set_bkg_palette(i,1,materials[i-1]);
 for(i=0;i<8;i++)set_sprite_palette(i,1,objects[i]);
}
/* Host checks exercise screen composition without emulating hardware. */
#else
void ev_palettes(void) BANKED {}
#endif

/* Text pointers may belong to any caller's ROM bank. Fixed-bank readers retain
 * that bank while reading; banked drawing receives only scalar tile values. */
void ev_text(UINT8 x,UINT8 y,const char *text,UINT8 palette) NONBANKED {
 while(*text&&x<20){UINT8 ch=*text++;if(ch<32||ch>127)ch=32;ev_tile(x++,y,ch+96,palette);}
}
void ev_number(UINT8 x,UINT8 y,UINT32 value,UINT8 palette) BANKED {
 char buffer[11];UINT8 n=0,i;do{buffer[n++]='0'+value%10;value/=10;}while(value&&n<10);
 for(i=0;i<n/2;i++){char c=buffer[i];buffer[i]=buffer[n-i-1];buffer[n-i-1]=c;}buffer[n]=0;ev_text(x,y,buffer,palette);
}
void ev_clear(UINT8 palette) BANKED {
 UINT8 y,x;for(y=0;y<18;y++)for(x=0;x<20;x++)ev_tile(x,y,128,palette);
}
void ev_draw_area(void) BANKED {
 UINT8 y,x;for(y=0;y<15;y++)for(x=0;x<20;x++)
  ev_tile(x,y+2,EG->map[(UINT16)y*20+x],EG->palette[(UINT16)y*20+x]);
 for(y=0;y<20;y++){ev_tile(y,0,128,6);ev_tile(y,1,128,6);ev_tile(y,17,128,6);}
}
void ev_message(const char *message) NONBANKED {
 UINT8 i=0;while(message[i]&&i<20){EG->message[i]=message[i];i++;}EG->message[i]=0;EG->message_timer=180;
}
void ev_hud(void) BANKED {
 UINT8 i,skill=ES->slots[ES->selected_skill];
 for(i=0;i<20;i++){ev_tile(i,0,128,6);ev_tile(i,1,128,6);ev_tile(i,17,128,6);}
 ev_text(0,0,"L",6);ev_number(1,0,ES->level,6);
 ev_text(4,0,"HP",6);ev_number(6,0,ES->hp,6);
 ev_text(11,0,"MP",6);ev_number(13,0,ES->mana,6);
 ev_text(0,1,"G",6);ev_number(1,1,ES->gold,6);
 ev_text(10,1,"P",6);ev_number(11,1,ES->potions,6);
 ev_text(14,1,"S",6);ev_number(15,1,ES->selected_skill+1,6);
 if(skill<30)ev_tile(17,1,EG->cooldowns[skill]?71:72,ev_skill_compatible(skill)?7:3);
 {UINT8 fill=(UINT32)ES->xp*16/ev_xp_needed(ES->level);if(fill>16)fill=16;ev_tile(18,1,74+(fill>8?8:fill),4);ev_tile(19,1,74+(fill>8?fill-8:0),4);}
 if(EG->message_timer)ev_text(0,17,EG->message,6);
 else{ev_name(EV_NAME_BIOME,EG->biome,EG->scratch);ev_text(0,17,EG->scratch,6);
  if(ES->floor){ev_text(17,17,"F",6);ev_number(18,17,ES->floor,6);}}
}
#ifndef EV_HOST
static UINT8 __at(0xFF98) sprite_count;
static UINT8 __at(0xFF99) rows[18];
static void object(INT16 x,INT16 y,UINT8 tile,UINT8 palette,UINT8 flip){
 UINT8 first,last,i;if(x<-7||x>159||y<-15||y>143||sprite_count>=40)return;
 first=y<0?0:y/8;last=(y+15)>143?17:(y+15)/8;
 for(i=first;i<=last;i++)if(rows[i]>=10)return;
 for(i=first;i<=last;i++)rows[i]++;
 set_sprite_tile(sprite_count,tile);set_sprite_prop(sprite_count,8|palette|flip);
 move_sprite(sprite_count,x+8,y+16);sprite_count++;
}
void ev_draw_actors(void) BANKED {
 UINT8 i,frame=0,tile,palette;INT16 x,y;
 sprite_count=0;memset(rows,0,sizeof(rows));
 if(EG->mode!=EV_PLAY){for(i=0;i<40;i++)hide_sprite(i);return;}
 if(EG->held&15)frame=(EG->tick/10)&1;
 tile=ES->direction*8+frame*4;
 if(!EG->invulnerable||EG->tick%4<2){object((INT16)ES->x-8,ES->y,tile,EG->death_timer?3:0,0);object(ES->x,ES->y,tile+2,EG->death_timer?3:0,0);}
 {UINT8 hand;for(hand=0;hand<2;hand++){
  EvItem *held=&ES->equipment[hand];if(held->type==EV_WEAPON)tile=82+held->profile*2;
  else if(held->type==EV_FOCUS)tile=116+held->profile*2;
  else if(held->type==EV_SHIELD)tile=128+held->profile*2;else continue;
  palette=held->element==EV_FIRE?3:held->element==EV_FROST?2:held->element==EV_LIGHTNING?5:held->element==EV_ARCANE?0:7;
  x=ES->x+(hand?-10:5);y=ES->y+2;
  if(EG->action_timer&&hand==EG->action_hand){y-=3;if(ES->direction==1)x+=3;else if(ES->direction==3)x-=3;}
  object(x,y,tile,palette,ES->direction==3?32:0);
 }}
 /* Live projectiles are prioritized above cosmetic arc objects. */
 for(i=0;i<8;i++)if(EG->projectiles[i].life){
  EvProjectile *p=&EG->projectiles[i];palette=p->element==1?3:p->element==2?2:p->element==3?5:p->element==4?0:7;
  object((INT16)p->x-4,p->y+8,p->element?68:66,palette,0);
 }
 for(i=0;i<EG->enemy_count;i++)if(EG->enemies[i].alive){
  EvEnemy *e=&EG->enemies[i];palette=e->flash||e->state==2?3:e->kind==6?5:e->kind==10?2:e->rank==3?3:e->kind>=8?4:1;
  object((INT16)e->x-4,e->y+1,32+e->kind*2,palette,e->direction==3?32:0);
  if(e->rank==3)object((INT16)e->x+4,e->y+1,32+e->kind*2,palette,32);
  if(e->hp<e->max_hp){UINT8 fill=((UINT32)e->hp*8+e->max_hp-1)/e->max_hp;object((INT16)e->x-4,(INT16)e->y-5,134+fill*2,fill<3?3:4,0);}
  if(e->state==2)object((INT16)e->x-4,e->y+8,80,3,0);
 }
 if(EG->place==EV_INTERIOR){object(40,32,32,4,0);object(112,40,38,0,0);}
 if(EG->place==EV_TOWN){
  object(63,30,32,0,0);object(103,87,38,2,0);object(31,70,38,5,0);object(119,63,32,3,0);
  if(EG->tier){object(30,46,32,4,0);object(127,46,32,1,0);}
 }
 for(i=0;i<EV_DROPS;i++)if(!ES->interior&&ES->drops[i].active&&ES->drops[i].area==ES->area&&ES->drops[i].floor==ES->floor){
  EvDrop *d=&ES->drops[i];object((INT16)d->x-4,d->y+4,d->gold?70:72,d->gold?6:d->item.rarity==0?1:d->item.rarity==1?2:d->item.rarity==2?6:d->item.rarity==3?5:3,0);
 }
 if(EG->action_timer&&EG->action_timer<=EG->action_release&&EG->action_timer+12>=EG->action_release&&EG->action_kind<=EV_NOVA){
  UINT8 phase=EG->action_release-EG->action_timer;INT16 side=(INT16)phase*2-10;
  x=ES->x-4;y=ES->y;
  if(EG->action_direction==1){x+=12;y+=side;}else if(EG->action_direction==3){x-=12;y-=side;}
  else {x+=EG->action_direction==0?side:-side;y+=EG->action_direction==0?-10:10;}
  object(x,y,74,0,EG->action_direction==3?32:0);
  if(phase<8)object(x+(EG->action_direction==0||EG->action_direction==2?8:0),y+8,74,0,64);
 }
 if(EG->guard||EG->ward)object(ES->x-4,ES->y,80,2,0);
 if(EG->field_timer){object(EG->field_x-4,EG->field_y,80,EG->field_element==1?3:EG->field_element==3?5:2,0);}
 for(i=sprite_count;i<40;i++)hide_sprite(i);
}

#else
void ev_draw_actors(void) BANKED {}
#endif
