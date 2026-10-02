#include "ev.h"
#include <assert.h>
#include <stdio.h>

EvGame ev_host_game;
UINT8 ev_host_sram[4][8192];
void ev_sound(UINT8 sound){(void)sound;}
void ev_audio_tick(void){}
extern UINT8 ev_screen_read(UINT8 x,UINT8 y);

static void reset(void){memset(EG,0,sizeof(*EG));ev_screen_init();ev_new(0,7319);ev_generate_area();ev_spawn();}
static void test_profiles_and_starters(void){
 UINT8 i;EvWeapon w;EvSkill skill;
 for(i=0;i<17;i++){ev_weapon(i,&w);assert(w.damage>0&&w.cadence>=12&&w.cadence<=80);assert(w.hands==1||w.hands==2);}
 for(i=0;i<30;i++){ev_skill(i,&skill);assert(skill.execution<=EV_STORM&&skill.requirement<=EV_REQ_MAGIC);assert(skill.mana>0);}
 for(i=0;i<6;i++){ev_new(i,7319);assert(ES->level==1&&ES->gold==0&&ES->skill_points==0);assert(ES->hp==EG->stats.max_hp);assert(ES->potions==2);
  for(UINT8 j=0;j<5;j++)assert(ES->slots[j]==EV_EMPTY);
  ev_weapon(ES->equipment[0].profile,&w);if(w.hands==2)assert(ES->equipment[1].type==EV_EMPTY);
 }
 puts("starter loadouts, shared profiles and empty skill slots");
}
static void test_handedness(void){
 EvSave before;UINT8 i;reset();
 for(i=0;i<24;i++)ev_item_generate(&ES->bag[i],i,1,EV_WEAPON,0);
 ES->bag[0].profile=4;before=*ES;assert(!ev_equip(0));assert(!memcmp(ES,&before,sizeof(before)));
 ES->bag[1].type=EV_EMPTY;assert(ev_equip(0));assert(ES->equipment[0].profile==4&&ES->equipment[1].type==EV_EMPTY);
 ES->bag[2].type=EV_SHIELD;before=*ES;assert(!ev_equip(2));assert(!memcmp(ES,&before,sizeof(before)));
 reset();ev_item_generate(&ES->bag[0],22,1,EV_WEAPON,0);ES->bag[0].profile=16;assert(ev_equip_offhand(0));assert(ES->equipment[1].profile==16);
 puts("transactional hand conflicts and one-handed pairing");
}
static void test_wallet_items_and_resources(void){
 EvItem a,b;EvSave before;reset();ev_credit(100);assert(!ev_debit(101));assert(ES->gold==100);assert(ev_debit(60)&&ES->gold==40);
 ev_credit(EV_GOLD_MAX);assert(ES->gold==EV_GOLD_MAX);ev_credit(1);assert(ES->gold==EV_GOLD_MAX);
 ev_item_generate(&a,42,12,EV_WEAPON,2);ev_credit(100);ev_item_generate(&b,42,12,EV_WEAPON,2);assert(!memcmp(&a,&b,sizeof(a)));
 ES->hp=10;ES->mana=0;ES->stat_points=5;ES->attributes[3]++;ev_derive();assert(ES->hp==10&&ES->mana==0);
 UINT16 hp=ES->hp,mana=ES->mana;ev_potion();assert(ES->potions==1&&ES->hp>hp&&ES->mana>mana);
 before=*ES;ev_potion();assert(!memcmp(ES,&before,sizeof(before)));
 puts("bounded wallet, independent item rolls, no healing on derivation, shared potion charge/cooldown");
}
static void test_tree(void){
 UINT8 n,pass;reset();EvSave before=*ES;assert(!ev_node_allocate(0));assert(!memcmp(ES,&before,sizeof(before)));
 ES->skill_points=250;
 for(pass=0;pass<8;pass++)for(n=0;n<96;n++)ev_node_allocate(n);
 for(n=0;n<96;n++)assert(ev_node_owned(n));for(n=0;n<30;n++)assert(ev_skill_unlocked(n));
 ES->skill_points=25;for(n=0;n<20;n++)assert(ev_skill_rank(0));assert(!ev_skill_rank(0));assert(ES->ranks[0]==20);
 assert(ev_skill_compatible(0));assert(!ev_skill_compatible(20));
 puts("96-node multi-entry atlas, actual unlocks, twenty ranks and weapon requirements");
}
static void flood(UINT8 *seen){
 UINT16 queue[300],head=0,tail=0;memset(seen,0,300);queue[tail++]=7*20+10;seen[7*20+10]=1;
 while(head<tail){UINT16 cell=queue[head++];UINT8 x=cell%20,y=cell/20;INT16 next[4]={cell-1,cell+1,cell-20,cell+20};
  for(UINT8 n=0;n<4;n++){if((n==0&&!x)||(n==1&&x==19)||(n==2&&!y)||(n==3&&y==14))continue;
   UINT16 c=next[n];if(c<300&&!seen[c]&&ev_walkable((c%20)*8+4,(c/20)*8+4)){seen[c]=1;queue[tail++]=c;}
  }
 }
}
static void test_world(void){
 UINT16 area;UINT8 seen[300],map[320],biomes=0;UINT16 climate_mask=0;reset();memcpy(map,EG->map,320);ev_generate_area();assert(!memcmp(map,EG->map,320));
 assert(EG->place==EV_TOWN&&EG->tier==0&&EG->enemy_count==0);
 for(UINT16 i=0;i<320;i++)assert(EG->map[i]<54||EG->map[i]>62); /* no houses at home */
 for(area=0;area<256;area++){
  ES->area=area;ES->floor=0;ev_generate_area();climate_mask|=1<<EG->biome;flood(seen);
  assert(seen[7*20]&&seen[7*20+19]&&seen[10]&&seen[14*20+10]);
  assert(ES->visited[area>>3]&(1<<(area&7)));
 }
 for(UINT8 i=0;i<9;i++)if(climate_mask&(1<<i))biomes++;assert(biomes==9);
 puts("deterministic 256-area world, all nine climates, connected approaches and tent-only home");
}
static void test_snapshots_and_rewards(void){
 UINT16 level;UINT32 xp,gold;UINT8 i;reset();ev_enter(137,0,80,100);assert(EG->enemy_count>0);level=EG->enemies[0].level;
 ES->level=40;ev_derive();assert(EG->enemies[0].level==level);ev_damage_enemy(0,30000,EV_ARCANE);assert(!EG->enemies[0].alive);
 xp=ES->xp;gold=ES->gold;ev_damage_enemy(0,30000,EV_ARCANE);assert(ES->xp==xp&&ES->gold==gold&&ES->kills==1);
 for(i=0;i<24;i++)if(ES->drops[i].active&&ES->drops[i].item.type!=EV_EMPTY)assert(ES->drops[i].item.level==level);
 ev_enter(138,0,80,100);ev_enter(137,0,80,100);assert(!EG->enemies[0].alive&&EG->enemies[0].level==level);
 puts("source-level snapshots, exactly-once rewards, loot level and persistent casualties");
}
static void set_weapon(UINT8 profile){
 ES->equipment[0].profile=profile;ES->equipment[0].type=EV_WEAPON;ES->equipment[0].rarity=0;
 EvWeapon w;ev_weapon(profile,&w);ES->equipment[0].element=w.element;if(w.hands==2)ES->equipment[1].type=EV_EMPTY;ev_derive();
}
static void test_all_actions(void){
 for(UINT8 skill=0;skill<30;skill++){
  reset();memset(ES->nodes,255,12);ES->level=100;ev_derive();
  for(UINT8 p=0;p<17&&!ev_skill_compatible(skill);p++)set_weapon(p);
  if(!ev_skill_compatible(skill)){ev_item_generate(&ES->equipment[1],20,1,EV_SHIELD,0);set_weapon(0);}
  assert(ev_skill_compatible(skill));ES->mana=EG->stats.max_mana;EG->enemy_count=0;ES->x=80;ES->y=80;ES->direction=0;
  UINT16 before=ES->mana;assert(ev_action(skill));assert(ES->mana<before);assert(!ev_action(skill));
  for(UINT16 tick=0;tick<320;tick++)ev_combat_tick();
  assert(!EG->action_timer&&!EG->dodge&&!EG->field_timer);
 }
 reset();assert(!ev_skill_compatible(30));assert(!ev_action(30));
 /* Compatible skills prefer the appropriate offhand, not a generic main weapon. */
 memset(ES->nodes,255,12);set_weapon(1);ev_item_generate(&ES->equipment[1],22,1,EV_WEAPON,0);ES->equipment[1].profile=3;
 assert(ev_skill_hand(15)==1);assert(ev_action(15)&&EG->action_hand==1);
 puts("all 30 action lifecycles, one-time mana, capacity/recovery and compatible offhand snapshots");
}
static void test_fields_dodge_and_portal(void){
 reset();memset(ES->nodes,255,12);set_weapon(10);ES->level=100;ev_derive();ES->mana=EG->stats.max_mana;
 EG->enemy_count=0;ES->x=80;ES->y=80;ES->direction=0;assert(ev_action(24));
 while(!EG->field_timer)ev_combat_tick();UINT16 damage=EG->field_damage;
 /* Opening the pause panel clears recovery while the existing field stays paused. */
 EG->action_timer=0;assert(ev_action(20));assert(EG->action_damage!=damage&&EG->field_damage==damage);
 EvEnemy *e=&EG->enemies[0];memset(e,0,sizeof(*e));EG->enemy_count=1;e->alive=1;e->hp=e->max_hp=20000;e->level=1;e->x=e->home_x=EG->field_x;e->y=e->home_y=EG->field_y;e->state=3;e->timer=250;
 UINT8 pulse=EG->field_pulses;while(EG->field_pulses==pulse)ev_combat_tick();assert(e->hp<=20000-damage);assert(EG->field_damage==damage);
 reset();EG->action_kind=EV_DASH;ES->direction=1;EG->portal_timer=180;ev_dodge();assert(EG->action_kind==EV_STEP&&EG->portal_timer==0);
 UINT8 cooldown=EG->dodge_cooldown;for(UINT8 i=0;i<10;i++)ev_combat_tick();ev_dodge();assert(!EG->dodge&&EG->dodge_cooldown<cooldown);
 EG->portal_timer=180;EG->invulnerable=0;ev_damage_player(10,EV_FIRE,1);assert(!EG->portal_timer);
 puts("cast-owned fields survive later actions; ordinary dodge cannot inherit lunge damage; damage cancels portals");
}
static void test_services_and_interiors(void){
 reset();ES->gold=100000;ev_item_generate(&ES->bag[0],30,1,EV_WEAPON,1);ES->bag[0].profile=0;
 UINT32 price=ev_improve_price(0,0),gold=ES->gold;assert(ev_improve(0,0)&&ES->gold==gold-price&&ES->bag[0].enchant==1);
 for(UINT8 i=1;i<10;i++)assert(ev_improve(0,0));EvSave before=*ES;assert(!ev_improve(0,0)&&!memcmp(ES,&before,sizeof(before)));
 ES->level=12;assert(ev_improve(0,3)&&ES->bag[0].level==12);
 ES->skill_points=250;for(UINT8 pass=0;pass<8;pass++)for(UINT8 n=0;n<96;n++)ev_node_allocate(n);
 ES->skill_points=500;UINT16 spent=0;for(UINT8 n=0;n<96;n++){EvSkill data;if(n%16<5){ev_skill((n/16)*5+n%16,&data);spent+=2+data.tier;}else spent++;}
 assert(ev_skill_rank(20));ES->slots[0]=20;UINT16 points=ES->skill_points;assert(ev_respec());assert(ES->skill_points==points+spent+1&&ES->slots[0]==EV_EMPTY&&!ev_skill_unlocked(20));
 UINT8 town=0,biome,place,tier;for(UINT16 a=0;a<256;a++){ev_area_info(a,&biome,&place,&tier);if(place==EV_TOWN&&tier){town=a;break;}}
 assert(town!=EV_HOME);ev_enter(town,0,36,40);ev_interact();assert(ES->interior==1&&EG->place==EV_INTERIOR&&!EG->enemy_count);
 ES->x=80;ES->y=106;ev_interact();assert(!ES->interior&&EG->place==EV_TOWN&&ES->x==36);
 ES->level=20;ES->x=84;ES->y=91;ev_interact();assert(ES->expedition&&ES->floor==1&&ES->dungeon_id==EV_EMPTY);
 UINT16 base=ES->rift_level;ES->rift_tier++;ev_spawn();assert(ES->rift_level==base&&EG->enemies[0].level<base+5);
 ev_damage_enemy(0,30000,EV_ARCANE);assert(ES->rift.cleared[0]&1);assert(ES->dungeons[0].area==EV_EMPTY);
 puts("quoted commerce, +10 cap, geographic relevel, complete respec, family interiors and independent rift records");
}
static UINT16 legacy_crc(const UINT8 *bytes,UINT16 length){
 UINT16 crc=65535;for(UINT16 i=0;i<length;i++){crc^=(UINT16)bytes[i]<<8;for(UINT8 bit=0;bit<8;bit++)crc=crc&32768?(crc<<1)^0x1021:crc<<1;}return crc;
}
static void test_saves(void){
 reset();assert(sizeof(EvGame)<4096&&sizeof(EvSave)+12<=2730);memset(ev_host_sram,0xFF,sizeof(ev_host_sram));
 /* Preserve the existing v1 layout and exact checksum, including early empty markers. */
 for(UINT8 i=0;i<8;i++){ES->wounded[i].area=255;ES->wounded[i].floor=0;}
 ES->gold=111;assert(ev_save(0));
 UINT16 crc=legacy_crc((UINT8 *)ES,sizeof(EvSave));assert(ev_host_sram[0][8]==(crc&255)&&ev_host_sram[0][9]==(crc>>8));
 assert(ev_load(0,0));for(UINT8 i=0;i<8;i++)assert(ES->wounded[i].floor==EV_EMPTY);
ES->gold=222;assert(ev_save(0));ES->gold=0;assert(ev_load(0,0)&&ES->gold==222);
 /* Simulate a torn latest payload. The older committed record remains valid. */
 ev_host_sram[0][30]^=0x40;assert(ev_load(0,0)&&ES->gold==111);
 ES->gold=333;assert(ev_save(1));assert(ev_load(1,0)&&ES->gold==333);assert(ev_load(0,0)&&ES->gold==111);
 ev_delete(0);assert(!ev_load(0,0)&&ev_load(1,1));
 ES->level=1000;assert(!ev_save(2));assert(!ev_load(2,1));
 for(UINT8 i=2;i<8;i++){reset();ES->gold=1000+i;assert(ev_save(i));}
 for(UINT8 i=1;i<8;i++){assert(ev_load(i,0));assert(ES->gold==(i==1?333:1000+i));}
 /* Unsupported records remain visible and cannot be overwritten by new saves. */
 ev_host_sram[0][2730+10]=EV_VERSION+1;assert(ev_slot_status(1)==2);assert(!ev_load(1,0));assert(!ev_save(1));
 ev_delete(1);assert(ev_slot_status(1)==0);assert(ev_save(1));
 puts("eight isolated slots in 32KB SRAM, recovery journal, CRC, bounds, targeted deletion and unsupported-version preservation");
}
static void press(UINT8 keys){ev_update(0);ev_update(keys);}
static void test_ui(void){
 reset();EG->mode=EV_PLAY;ES->x=80;ES->y=104;
 press(J_START);assert(EG->mode==EV_MENU);UINT16 tick=EG->tick;
 ev_menu_draw();ev_present();assert(ev_screen_read(1,0)=='P'+96);
 for(UINT8 i=0;i<60;i++)ev_update(J_START);
 assert(EG->mode==EV_MENU&&EG->tick==tick+60);assert(!EG->action_timer);
 press(J_DOWN);assert(EG->cursor==1);press(J_A);assert(EG->mode==EV_EQUIP_MENU);
 press(J_B);assert(EG->mode==EV_MENU&&EG->cursor==1);
 EG->cursor=9;press(J_A);assert(EG->mode==EV_OPTIONS_MENU);
 press(J_DOWN);press(J_A);assert(EG->mode==EV_CONTROLS_MENU);
 press(J_B);assert(EG->mode==EV_OPTIONS_MENU&&EG->cursor==1);
 press(J_START);assert(EG->mode==EV_PLAY);
 for(UINT8 i=0;i<30;i++)ev_update(J_START);assert(EG->mode==EV_PLAY);
 press(J_START);press(J_B);assert(EG->mode==EV_PLAY);
 press(J_B);assert(!strcmp(EG->message,"ASSIGN A SKILL FIRST"));
 /* A consumed by the rift fixture must not also swing or repeat an attack. */
 ES->x=84;ES->y=91;press(J_A);assert(!EG->action_timer);
 for(UINT8 i=0;i<30;i++)ev_update(J_A);assert(!EG->action_timer);
 ES->x=80;ES->y=104;press(J_SELECT|J_A);
 for(UINT8 i=0;i<30;i++)ev_update(J_A);assert(!EG->action_timer);
 press(J_START);press(J_A);assert(EG->mode==EV_BAG_MENU);
 for(UINT8 i=0;i<30;i++)ev_update(J_DOWN);assert(EG->cursor>1);
 EG->cursor=10;ev_item_generate(&ES->bag[10],99,1,EV_WEAPON,0);
 press(J_A);assert(EG->mode==EV_ITEM_MENU);press(J_B);assert(EG->mode==EV_BAG_MENU&&EG->cursor==10);
 /* A clear is only staging: the old frame survives until present. */
 ev_clear(6);ev_text(1,0,"COMPLETE FRAME",6);ev_present();
 ev_clear(6);assert(ev_screen_read(1,0)=='C'+96);
 ev_text(1,0,"NEXT FRAME",6);assert(ev_screen_read(1,0)=='C'+96);
 ev_present();assert(ev_screen_read(1,0)=='N'+96);
 ev_present();assert(ev_screen_read(1,0)=='N'+96);
 puts("real input/menu owner: pause, held-button suppression, nested Back, preserved selection, repeat, consumed interactions and atomic screen composition");
}
static void test_all_spawns(void){
 for(UINT8 seed=0;seed<16;seed++){
  reset();ES->seed=7319UL+seed*19937UL;
  for(UINT16 area=0;area<256;area++){
   ES->area=area;ES->x=80;ES->y=104;ev_generate_area();ev_spawn();
   for(UINT8 i=0;i<EG->enemy_count;i++){
    EvEnemy *e=&EG->enemies[i];assert(e->alive&&e->hp);
    assert(ev_walkable(e->x-3,e->y)&&ev_walkable(e->x+3,e->y)&&ev_walkable(e->x,e->y-3)&&ev_walkable(e->x,e->y+3));
   }
  }
 }
 puts("4096 generated surface encounters: bounded spawning, clear footprints and no area-255 sentinel collision");
}
int main(void){
 test_ui();test_all_spawns();test_profiles_and_starters();test_handedness();test_wallet_items_and_resources();test_tree();test_world();test_snapshots_and_rewards();test_all_actions();test_fields_dodge_and_portal();test_services_and_interiors();test_saves();
 printf("All native rules checks passed. Game memory %zu/4096 bytes; save %zu/2718 bytes.\n",sizeof(EvGame),sizeof(EvSave));return 0;
}
