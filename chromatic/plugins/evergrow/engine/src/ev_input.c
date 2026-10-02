#pragma bank 255
#include "ev.h"

/* The cartridge and host regression suite share this exact input owner. */
void ev_update(UINT8 physical) BANKED {
 UINT8 held,pressed;INT8 dx,dy;
 EG->blocked&=physical;held=physical&~EG->blocked;
 pressed=held&~EG->previous;EG->previous=held;EG->held=held;
 if(EG->mode!=EV_PLAY){
  if(!(held&15)||(pressed&15))EG->repeat_ticks=0;
  else if(++EG->repeat_ticks>=18){pressed|=held&15;EG->repeat_ticks=12;}
 }else EG->repeat_ticks=0;
 EG->pressed=pressed;
  if(EG->mode!=EV_PLAY){
   EG->tick++;if(EG->message_timer&&!--EG->message_timer)EG->menu_dirty=1;ev_menu_input();return;
  }
  if(pressed&J_START){ev_remember();ev_menu_open(EV_MENU);return;}
  if(held&J_SELECT){
   if(EG->select_ticks<250)EG->select_ticks++;
   if(pressed&J_A){EG->blocked|=J_A;EG->select_used=1;EG->action_direction=ES->direction;ev_dodge();}
   if(pressed&J_B){EG->blocked|=J_B;EG->select_used=1;ev_potion();}
  }else if(EG->select_ticks){
   if(!EG->select_used){
    UINT8 skill;ES->selected_skill=(ES->selected_skill+1)%5;skill=ES->slots[ES->selected_skill];
    if(skill<30){ev_name(EV_NAME_SKILL,skill,EG->scratch);ev_message(EG->scratch);}else ev_message("EMPTY SKILL SLOT");
   }
   EG->select_used=EG->select_ticks=0;ev_hud();
  }
  dx=held&J_LEFT?-1:held&J_RIGHT?1:0;dy=held&J_UP?-1:held&J_DOWN?1:0;
  /* Keep diagonal aim stable; move both axes on seven of ten ticks. */
  if(dx&&dy){
   if(EG->tick%10==2||EG->tick%10==5||EG->tick%10==8)dx=dy=0;
  }
  if(!EG->death_timer&&!EG->dodge&&(dx||dy)){EG->portal_timer=0;ev_move(dx,dy,1+(EG->stats.move_speed>=12&&EG->tick%4==0));}
  if(!(held&J_SELECT)&&!EG->death_timer){
   if((pressed&J_A)&&ev_interact()){EG->blocked|=J_A;EG->held&=~J_A;return;}
   if(held&J_A){EG->portal_timer=0;ev_action(EV_EMPTY);}
   if(held&J_B){
    UINT8 skill=ES->slots[ES->selected_skill],accepted=0;EG->portal_timer=0;
    if(skill<30)accepted=ev_action(skill);
    if(pressed&J_B){
     if(skill==EV_EMPTY)ev_message("ASSIGN A SKILL FIRST");
     else if(!ev_skill_compatible(skill))ev_message("NEEDS DIFFERENT GEAR");
     else if(!accepted&&EG->cooldowns[skill])ev_message("SKILL IS RECOVERING");
    }
   }
  }
  ev_combat_tick();
  if(EG->portal_timer&&!EG->death_timer){
   EG->portal_timer--;
   if(!EG->portal_timer){
    if(EG->place==EV_TOWN&&ES->area==EV_HOME&&ES->has_return){
     ES->has_return=0;ES->expedition=ES->return_expedition;ES->dungeon_id=ES->return_dungeon_id;ES->interior=ES->return_interior;ev_enter(ES->return_area,ES->return_floor,ES->return_x,ES->return_y);
    }else{ES->return_area=ES->area;ES->return_floor=ES->floor;ES->return_x=ES->x;ES->return_y=ES->y;ES->return_expedition=ES->expedition;ES->return_dungeon_id=ES->dungeon_id;ES->return_interior=ES->interior;ES->has_return=1;ES->expedition=0;ES->interior=0;ES->dungeon_id=EV_EMPTY;ev_enter(EV_HOME,0,80,104);}
    ev_save(EG->slot);
   }
  }
  ev_audio_tick();
}
