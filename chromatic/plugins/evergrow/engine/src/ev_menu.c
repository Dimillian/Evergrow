#pragma bank 255
#include "ev.h"

static const char * const main_choices[]={"PACK","EQUIPMENT","ATTRIBUTES","ASTRAL ATLAS","SKILLS AND RANKS","EXPLORED CHART","JOURNEYS","HOME PORTAL","SAVE CHARACTER","OPTIONS","CHARACTER HALL","RESUME"};
static const char * const item_choices[]={"EQUIP","EQUIP OFFHAND","STORE","SELL","ENHANCE +1","UPGRADE RARITY","REROLL AFFIX","RELEVEL TO YOU","BACK"};
static const char * const starters[]={"SWORD AND SHIELD","TWO-HANDED SWORD","WAND AND GRIMOIRE","FIRE STAFF","SHORTBOW","LONGBOW"};
static const char * const attributes[]={"STRENGTH","DEXTERITY","INTELLIGENCE","VITALITY"};
static const char * const equipment[]={"MAIN HAND","OFF HAND","HEAD","CHEST","GLOVES","LEGS","BOOTS","CLOAK","AMULET","RING 1","RING 2","CHARM 1","CHARM 2","CHARM 3","CHARM 4"};
static const char * const passives[]={"FORTITUDE","WEAPON POWER","PRECISION","QUICKENING","SPELL POWER","SUSTAIN"};
static void label(UINT8 kind,UINT8 id,UINT8 x,UINT8 y,UINT8 color){ev_name(kind,id,EG->scratch);ev_text(x,y,EG->scratch,color);}
static void heading(const char *name){ev_clear(6);ev_text(1,0,name,6);ev_text(1,17,"B BACK   START CLOSE",6);}
static void choice(UINT8 row,UINT8 index,const char *name){ev_text(1,row,EG->cursor==index?">":" ",EG->cursor==index?7:6);ev_text(2,row,name,EG->cursor==index?7:6);}
static void item_name(const EvItem *item,UINT8 x,UINT8 y){
 if(item->type==EV_EMPTY){ev_text(x,y,"- EMPTY -",6);return;}
 label(item->type==EV_WEAPON||item->type==EV_FOCUS?EV_NAME_WEAPON:EV_NAME_ITEM,item->type==EV_WEAPON?item->profile:item->type==EV_FOCUS?17+item->profile:item->type,x,y,item->rarity==0?6:item->rarity==1?4:item->rarity==2?2:item->rarity==3?5:3);
}
void ev_menu_open(UINT8 mode) BANKED {
 UINT8 i;
 if(mode==EV_TITLE||EG->mode==EV_PLAY)EG->nav_depth=0;
 else if(EG->nav_depth<6){
  UINT8 *parent=EG->nav[EG->nav_depth++];parent[0]=EG->mode;parent[1]=EG->cursor;parent[2]=EG->page;parent[3]=EG->subpage;
 }
 EG->mode=mode;EG->cursor=0;EG->page=0;EG->subpage=0;EG->menu_dirty=1;
 EG->action_timer=0;EG->pressed=0;EG->repeat_ticks=0;EG->message_timer=0;
 EG->blocked|=EG->held;EG->held=0;
 if(mode==EV_HALL)for(i=0;i<8;i++)EG->slot_status[i]=ev_slot_status(i);
}
void ev_menu_close(void) BANKED {
 EG->mode=EV_PLAY;EG->nav_depth=0;EG->blocked|=EG->held;
 EG->previous=EG->held;EG->held=EG->pressed=0;EG->select_used=EG->select_ticks=0;
 ev_draw_area();ev_hud();
}
void ev_menu_back(void) BANKED {
 if(EG->nav_depth){
  UINT8 *parent=EG->nav[--EG->nav_depth];EG->mode=parent[0];EG->cursor=parent[1];EG->page=parent[2];EG->subpage=parent[3];
  EG->blocked|=EG->held;EG->held=EG->pressed=0;EG->repeat_ticks=0;EG->menu_dirty=1;
 }else if(EG->active_character)ev_menu_close();else ev_menu_open(EV_TITLE);
}
static void draw_menu(void) {
 UINT8 i,index,row,mode=EG->mode;EvItem item;UINT8 start=(EG->cursor/7)*7;
 if(mode==EV_TITLE){
  ev_clear(0);
  for(i=0;i<20;i+=2){ev_tile(i,2,12,0);ev_tile(i+1,2,13,0);ev_tile(i,3,14,0);ev_tile(i+1,3,15,0);}
  ev_text(5,5,"EVERGROW",2);ev_text(5,7,"CHROMATIC",4);
  choice(10,0,"CHARACTERS");choice(12,1,"CONTROLS");choice(14,2,"OPTIONS");
  ev_text(1,17,"A NATIVE COLOR RPG",0);return;
 }
 if(mode==EV_HALL){
  heading("CHARACTER HALL");
  for(i=0;i<8;i++){ev_text(1,2+i*2,EG->cursor==i?">":" ",7);ev_number(2,2+i*2,i+1,6);
   {UINT8 status=EG->slot_status[i];ev_text(4,2+i*2,status==1?"CONTINUE":status==2?"OTHER VERSION":status==3?"DAMAGED SAVE":"NEW CHARACTER",EG->cursor==i?7:6);}}
  ev_text(1,17,"A OPEN   SELECT ERASE",6);return;
 }
 if(mode==EV_NEW){
  heading("NEW CHARACTER");for(i=0;i<6;i++)choice(3+i*2,i,starters[i]);
  ev_text(1,15,"SEED",6);ev_number(6,15,EG->rng,6);ev_text(1,17,"A BEGIN SELECT SEED",6);return;
 }
 if(mode==EV_MENU){
  heading("PAUSED");ev_number(15,0,EG->cursor+1,6);ev_text(17,0,"/12",6);for(i=start;i<start+7&&i<12;i++)choice(3+(i-start)*2,i,main_choices[i]);return;
 }
 if(mode==EV_BAG_MENU||mode==EV_STASH_MENU||mode==EV_BUYBACK_MENU){
  UINT8 count=mode==EV_BAG_MENU?24:mode==EV_STASH_MENU?96:6;EvItem *array=mode==EV_BAG_MENU?ES->bag:mode==EV_STASH_MENU?ES->stash:ES->buyback;
  heading(mode==EV_BAG_MENU?"PACK":mode==EV_STASH_MENU?"PERSONAL STORAGE":"BUYBACK");
  ev_text(1,1,"G",6);ev_number(3,1,ES->gold,6);ev_number(14,1,EG->cursor+1,6);ev_text(17,1,"/",6);ev_number(18,1,count,6);
  for(i=start;i<start+7&&i<count;i++){row=3+(i-start)*2;ev_text(0,row,EG->cursor==i?">":" ",7);item_name(&array[i],1,row);}
  if(mode==EV_STASH_MENU)ev_text(1,17,"A TAKE  SELECT PACK",6);return;
 }
 if(mode==EV_ITEM_MENU){
  EvItem *p=&ES->bag[EG->item_index];heading("ITEM");item_name(p,0,2);
  label(EV_NAME_RARITY,p->rarity,1,4,2);ev_text(1,5,"LEVEL",6);ev_number(8,5,p->level,6);
  ev_text(1,6,p->type==EV_WEAPON?"DAMAGE":"POWER",6);ev_number(8,6,ev_item_power(p),6);
  ev_text(1,7,"ENHANCE",6);ev_number(9,7,p->enchant,6);
  if(p->rarity){label(EV_NAME_AFFIX,p->affix,1,9,4);ev_number(15,9,p->value,6);}
  ev_text(1,10,"SELL VALUE",6);ev_number(13,10,ev_item_price(p),6);
  choice(13,EG->cursor,item_choices[EG->cursor]);
  if(EG->cursor>=4&&EG->cursor<=7){ev_text(1,15,"COST",6);ev_number(6,15,ev_improve_price(EG->item_index,EG->cursor-4),2);}
  else ev_text(1,15,"UP/DOWN ACTION",6);return;
 }
 if(mode==EV_EQUIP_MENU){
  heading("EQUIPMENT");for(i=start;i<start+7&&i<15;i++){
   row=3+(i-start)*2;choice(row,i,equipment[i]);
   if(i==1&&ES->equipment[0].type==EV_WEAPON){EvWeapon w;ev_weapon(ES->equipment[0].profile,&w);if(w.hands==2){ev_text(2,row+1,"RESERVED FOR 2H",4);continue;}}
   item_name(i<11?&ES->equipment[i]:&ES->charms[i-11],2,row+1);
  }ev_text(1,17,"A STOW    B BACK",6);return;
 }
 if(mode==EV_ATLAS_MENU){
  heading("ASTRAL ATLAS");label(EV_NAME_TERRITORY,EG->page,1,1,2);ev_number(16,1,ES->skill_points,6);ev_text(18,1,"PT",6);
  for(i=0;i<16;i++){
   UINT8 x=3+(i%4)*4,y=4+(i/4)*3;index=EG->page*16+i;
   if(i%4<3){ev_text(x+1,y,"--",ev_node_owned(index)&&ev_node_owned(index+1)?2:0);}
   if(i<12){ev_text(x,y+1,"|",0);ev_text(x,y+2,"|",0);}
   ev_tile(x,y,ev_node_owned(index)?72:71,EG->cursor==i?7:ev_node_owned(index)?2:i<5?4:6);
  }
  if(EG->cursor<5)label(EV_NAME_SKILL,EG->page*5+EG->cursor,0,15,6);
  else ev_text(1,15,passives[EG->page],6);
  ev_text(0,17,"A LEARN SELECT NEXT",6);return;
 }
 if(mode==EV_SKILL_MENU){
  heading("SKILLS AND RANKS");ev_text(1,1,"ASSIGN SLOT",6);ev_number(13,1,EG->subpage+1,6);
  for(i=start;i<start+7&&i<30;i++){
   row=3+(i-start)*2;ev_text(0,row,EG->cursor==i?">":" ",7);label(EV_NAME_SKILL,i,1,row,ev_skill_unlocked(i)?ev_skill_compatible(i)?6:3:0);
   if(ev_skill_unlocked(i)){EvSkill data;UINT16 cost;ev_skill(i,&data);cost=(UINT16)data.mana*(200+ES->ranks[i]*3)/200;cost=cost*(100-EG->stats.cost_reduction)/100;
    ev_text(2,row+1,"R",4);ev_number(3,row+1,ES->ranks[i],4);ev_text(6,row+1,"MP",4);ev_number(8,row+1,cost,4);ev_text(11,row+1,"CD",4);ev_number(13,row+1,data.cooldown/60,4);ev_text(16,row+1,"S",4);}
  }ev_text(0,17,"A ASSIGN SELECT RANK",6);return;
 }
 if(mode==EV_STATS_MENU){
  heading("ATTRIBUTES");ev_text(1,1,"POINTS",6);ev_number(9,1,ES->stat_points,6);
  for(i=0;i<4;i++){choice(3+i*2,i,attributes[i]);ev_number(16,3+i*2,ES->attributes[i],6);}
  ev_text(1,12,"LIFE",6);ev_number(7,12,EG->stats.max_hp,6);ev_text(1,13,"MANA",6);ev_number(7,13,EG->stats.max_mana,6);
  ev_text(1,14,"ARMOR",6);ev_number(7,14,EG->stats.armor,6);ev_text(1,15,"XP",6);ev_number(4,15,ES->xp,6);
  ev_text(1,17,"A ALLOCATE   B BACK",6);return;
 }
 if(mode==EV_MAP_MENU){
  ev_clear(6);ev_text(0,0,"EXPLORED CHART",6);
  for(i=0;i<16;i++)for(index=0;index<16;index++){
   UINT8 area=i*16+index,biome,place,tier,tile=128,palette=6;
   if(ES->visited[area>>3]&(1<<(area&7))){ev_area_info(area,&biome,&place,&tier);tile=place==EV_TOWN?49:place==EV_RUIN?8:place==EV_SHRINE?9:place==EV_LAIR?11:place==EV_TRIAL?10:1;palette=biome==3?4:biome==4?3:0;}
   if(area==ES->area){tile=48;palette=2;}if(area==EG->cursor)palette=7;
   ev_tile(index+2,i+1,tile,palette);
  }
  ev_area_info(EG->cursor,&i,&index,&row);if(ES->visited[EG->cursor>>3]&(1<<(EG->cursor&7)))label(EV_NAME_BIOME,i,0,17,6);else ev_text(1,17,"UNEXPLORED",6);return;
 }
 if(mode==EV_JOURNEY_MENU){
  heading("JOURNEYS");choice(3,0,"DISCOVER A SHRINE");choice(5,1,"CLEAR A RUIN");choice(7,2,"DEFEAT A LAIR BOSS");choice(9,3,"REACH LEVEL 20");choice(11,4,"CONQUER A RIFT");
  if(ES->journey_flags&8)ev_text(1,4,"COMPLETED",4);if(ES->journey_flags&2)ev_text(1,6,"COMPLETED",4);if(ES->journey_flags&1)ev_text(1,8,"COMPLETED",4);
  if(ES->level>=20)ev_text(1,10,"COMPLETED",4);if(ES->journey_flags&4)ev_text(1,12,"COMPLETED",4);
  ev_text(1,14,"KILLS",6);ev_number(8,14,ES->kills,6);ev_text(1,15,"RIFT TIER",6);ev_number(12,15,ES->rift_tier,6);return;
 }
 if(mode==EV_SERVICE_MENU){
  heading(EG->service==0?"BLACKSMITH":EG->service==1?"JEWELER":EG->service==2?"ENCHANTER":"GAMBLER");
  choice(3,0,EG->service==3?"GAMBLE":"BROWSE STOCK");choice(5,1,"PACK AND IMPROVEMENTS");choice(7,2,"BUYBACK");choice(9,3,"REFRESH STOCK");
  if(EG->service==2){choice(11,4,"RESET ATLAS");ev_number(14,11,100UL+ES->level*15UL,2);}
  if(EG->service!=2){ev_text(1,11,"REFRESH",6);ev_number(9,11,ev_refresh_price(),2);}
  ev_text(1,13,"GOLD",6);ev_number(7,13,ES->gold,6);return;
 }
 if(mode==EV_SHOP_MENU){
  UINT8 count=EG->service==3?12:EG->service==1?8:12;heading(EG->service==3?"GAMBLE CATEGORY":"MERCHANT STOCK");
  ev_text(1,1,"G",6);ev_number(3,1,ES->gold,6);
  for(i=start;i<start+7&&i<count;i++){
   row=3+(i-start)*2;ev_text(0,row,EG->cursor==i?">":" ",7);
   if(EG->service==3){label(EV_NAME_ITEM,i,2,row,6);ev_text(2,row+1,"COST",4);ev_number(7,row+1,ev_gamble_price(i),2);}
   else if(ev_shop_item(EG->service,i,&item)){item_name(&item,2,row);ev_number(2,row+1,(UINT32)ev_item_price(&item)*2,2);}
   else ev_text(2,row,"SOLD",0);
  }return;
 }
 if(mode==EV_OPTIONS_MENU){heading("OPTIONS");choice(3,0,ES->sound?"SOUND ON":"SOUND OFF");choice(5,1,"CONTROLS");return;}
 if(mode==EV_CONTROLS_MENU){
  heading("CONTROLS");ev_text(1,3,"D-PAD MOVE AND AIM",6);ev_text(1,5,"A ATTACK / INTERACT",6);ev_text(1,7,"B ASSIGNED SKILL",6);
  ev_text(1,9,"SELECT NEXT SLOT",6);ev_text(1,11,"SELECT + A DODGE",6);ev_text(1,13,"SELECT + B POTION",6);ev_text(1,15,"START PAUSE MENU",6);return;
 }
 if(mode==EV_CONFIRM_MENU){heading("ERASE CHARACTER?");ev_text(1,4,"THIS SLOT IS DELETED",3);choice(8,0,"CANCEL");choice(10,1,"ERASE SLOT");return;}
}
void ev_menu_draw(void) BANKED {
 draw_menu();
 if(EG->message_timer){UINT8 x;for(x=0;x<20;x++)ev_tile(x,17,128,6);ev_text(0,17,EG->message,7);}
}
static UINT8 count(void){
 switch(EG->mode){case EV_TITLE:return 3;case EV_HALL:return 8;case EV_NEW:return 6;case EV_MENU:return 12;case EV_BAG_MENU:return 24;case EV_ITEM_MENU:return 9;
 case EV_EQUIP_MENU:return 15;case EV_ATLAS_MENU:return 16;case EV_SKILL_MENU:return 30;case EV_STATS_MENU:return 4;case EV_STASH_MENU:return 96;
 case EV_JOURNEY_MENU:return 5;case EV_SERVICE_MENU:return EG->service==2?5:4;case EV_SHOP_MENU:return EG->service==1?8:12;case EV_BUYBACK_MENU:return 6;case EV_OPTIONS_MENU:return 2;case EV_CONFIRM_MENU:return 2;default:return 1;}
}
static void persist(UINT8 ok){
 if(ok){if(ev_save(EG->slot)){ev_sound(3);ev_message("SAVED");}else{ev_sound(5);ev_message("SRAM SAVE FAILED");}}
 else{
  ev_sound(5);
  if(EG->mode==EV_ATLAS_MENU)ev_message("NEEDS POINTS OR PATH");
  else if(EG->mode==EV_SKILL_MENU)ev_message("NEEDS POINTS / UNLOCK");
  else if(EG->mode==EV_EQUIP_MENU||EG->mode==EV_STASH_MENU)ev_message("PACK IS FULL");
  else if(EG->mode==EV_ITEM_MENU&&EG->cursor>=2&&EG->place!=EV_TOWN)ev_message("VISIT A TOWN FIRST");
  else ev_message("CHECK GOLD AND SPACE");
 }
 EG->menu_dirty=1;
}
static void home_portal(void){
 EG->portal_timer=180;ev_menu_close();ev_message("PORTAL - HOLD STILL");
}
void ev_menu_input(void) BANKED {
 UINT8 p=EG->pressed,n=count(),mode=EG->mode;UINT8 i,ok=0;
 if(p&J_START){if(EG->active_character&&mode>=EV_MENU&&mode!=EV_CONFIRM_MENU)ev_menu_close();return;}
 if(p&J_B){if(mode!=EV_TITLE)ev_menu_back();return;}
 if(mode==EV_MAP_MENU){
  if(p&J_UP&&EG->cursor>=16)EG->cursor-=16;if(p&J_DOWN&&EG->cursor<240)EG->cursor+=16;
  if(p&J_LEFT&&EG->cursor%16)EG->cursor--;if(p&J_RIGHT&&EG->cursor%16<15)EG->cursor++;if(p&15)EG->menu_dirty=1;return;
 }
 if(mode==EV_ATLAS_MENU){
  if(p&J_UP)EG->cursor=(EG->cursor+12)%16;if(p&J_DOWN)EG->cursor=(EG->cursor+4)%16;
  if(p&J_LEFT)EG->cursor=(EG->cursor+15)%16;if(p&J_RIGHT)EG->cursor=(EG->cursor+1)%16;
  if(p&J_SELECT){EG->page=(EG->page+1)%6;EG->menu_dirty=1;}
 }else{
  if(p&J_UP)EG->cursor=EG->cursor?EG->cursor-1:n-1;
  if(p&J_DOWN)EG->cursor=(EG->cursor+1)%n;
  if(mode==EV_SKILL_MENU){if(p&J_LEFT)EG->subpage=(EG->subpage+4)%5;if(p&J_RIGHT)EG->subpage=(EG->subpage+1)%5;}
  else {if(p&J_LEFT)EG->cursor=EG->cursor>=7?EG->cursor-7:0;if(p&J_RIGHT)EG->cursor=EG->cursor+7<n?EG->cursor+7:n-1;}
 }
 if(p&15)EG->menu_dirty=1;
 if(p&J_SELECT){
  if(mode==EV_HALL){EG->slot=EG->cursor;ev_menu_open(EV_CONFIRM_MENU);}
  if(mode==EV_NEW){EG->rng^=EG->tick*7919UL+DIV_REG;ev_random(&EG->rng);EG->menu_dirty=1;}
  if(mode==EV_SKILL_MENU)persist(ev_skill_rank(EG->cursor));
  if(mode==EV_STASH_MENU)ev_menu_open(EV_BAG_MENU);
 }
 if(!(p&J_A))return;
 switch(mode){
 case EV_TITLE:ev_menu_open(EG->cursor==0?EV_HALL:EG->cursor==1?EV_CONTROLS_MENU:EV_OPTIONS_MENU);break;
 case EV_HALL:
  EG->slot=EG->cursor;
  if(ev_load(EG->slot,0)){ev_reset_runtime();ev_derive();ev_generate_area();ev_spawn();ev_palettes();ev_menu_close();}
  else if(ev_slot_status(EG->slot)==0){EG->rng=7319UL+EG->tick*31337UL;ev_menu_open(EV_NEW);}else ev_sound(5);break;
 case EV_NEW:
  ev_new(EG->cursor,EG->rng);ev_generate_area();ev_spawn();ev_palettes();ev_save(EG->slot);ev_menu_close();break;
 case EV_MENU:
  i=EG->cursor;
  if(i==0)ev_menu_open(EV_BAG_MENU);if(i==1)ev_menu_open(EV_EQUIP_MENU);if(i==2)ev_menu_open(EV_STATS_MENU);
  if(i==3)ev_menu_open(EV_ATLAS_MENU);if(i==4)ev_menu_open(EV_SKILL_MENU);
  if(i==5){ev_menu_open(EV_MAP_MENU);EG->cursor=ES->area;}
  if(i==6)ev_menu_open(EV_JOURNEY_MENU);if(i==7)home_portal();
  if(i==8){ev_remember();ok=ev_save(EG->slot);ev_menu_close();ev_message(ok?"CHARACTER SAVED":"SRAM SAVE FAILED");ev_sound(ok?3:5);}
  if(i==9)ev_menu_open(EV_OPTIONS_MENU);if(i==10){ev_remember();ev_save(EG->slot);EG->enemy_count=0;EG->active_character=0;ev_menu_open(EV_TITLE);}if(i==11)ev_menu_close();break;
 case EV_BAG_MENU:
  if(ES->bag[EG->cursor].type!=EV_EMPTY){EG->item_index=EG->cursor;ev_menu_open(EV_ITEM_MENU);}break;
 case EV_ITEM_MENU:
  i=EG->cursor;
  if(i==0)ok=ev_equip(EG->item_index);if(i==1)ok=ev_equip_offhand(EG->item_index);
  if(i>=2&&i<=7&&EG->place==EV_TOWN){
   if(i==2){ok=ev_insert(ES->stash,96,&ES->bag[EG->item_index]);if(ok)ES->bag[EG->item_index].type=EV_EMPTY;}
   if(i==3)ok=ev_sell(EG->item_index);if(i>=4)ok=ev_improve(EG->item_index,i-4);
  }
  if(i==8)ev_menu_back();else{persist(ok);if(ok)ev_menu_back();}break;
 case EV_EQUIP_MENU:{EvItem *item=EG->cursor<11?&ES->equipment[EG->cursor]:&ES->charms[EG->cursor-11];if(item->type!=EV_EMPTY){ok=ev_insert(ES->bag,24,item);if(ok){item->type=EV_EMPTY;ev_derive();}persist(ok);}break;}
 case EV_ATLAS_MENU:persist(ev_node_allocate(EG->page*16+EG->cursor));break;
 case EV_SKILL_MENU:if(ev_skill_unlocked(EG->cursor)){ES->slots[EG->subpage]=EG->cursor;persist(1);}else{ev_message("UNLOCK IN THE ATLAS");EG->menu_dirty=1;}break;
 case EV_STATS_MENU:if(ES->stat_points){ES->stat_points--;ES->attributes[EG->cursor]++;ev_derive();persist(1);}else{ev_message("NO ATTRIBUTE POINTS");EG->menu_dirty=1;}break;
 case EV_STASH_MENU:if(ES->stash[EG->cursor].type!=EV_EMPTY){ok=ev_insert(ES->bag,24,&ES->stash[EG->cursor]);if(ok)ES->stash[EG->cursor].type=EV_EMPTY;persist(ok);}break;
 case EV_BUYBACK_MENU:{EvItem *item=&ES->buyback[EG->cursor];UINT32 cost=ev_item_price(item);if(item->type!=EV_EMPTY&&ES->gold>=cost){for(i=0;i<24&&ES->bag[i].type!=EV_EMPTY;i++){}if(i<24){ev_debit(cost);ES->bag[i]=*item;item->type=EV_EMPTY;persist(1);}}break;}
 case EV_SERVICE_MENU:
  if(EG->cursor==0)ev_menu_open(EG->service==2?EV_BAG_MENU:EV_SHOP_MENU);
  else if(EG->cursor==1)ev_menu_open(EV_BAG_MENU);
  else if(EG->cursor==2)ev_menu_open(EV_BUYBACK_MENU);
  else if(EG->cursor==4)persist(ev_respec());
  else{UINT32 price=ev_refresh_price();
   if(ev_debit(price)){ES->refreshes[EG->town]++;ES->shop_bought[EG->town]=0;persist(1);}}
  break;
 case EV_SHOP_MENU:persist(EG->service==3?ev_gamble(EG->cursor):ev_shop_buy(EG->service,EG->cursor));break;
 case EV_OPTIONS_MENU:if(EG->cursor==0){ES->sound=!ES->sound;EG->menu_dirty=1;if(EG->active_character)ev_save(EG->slot);}else ev_menu_open(EV_CONTROLS_MENU);break;
 case EV_CONFIRM_MENU:if(EG->cursor==1){ev_delete(EG->slot);EG->slot_status[EG->slot]=ev_slot_status(EG->slot);}ev_menu_back();break;
 default:break;
 }
}
