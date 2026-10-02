#pragma bank 255
#include "ev.h"

static UINT8 abs8(INT16 value){return value<0?(UINT8)-value:(UINT8)value;}
static void stamp(UINT8 x,UINT8 y,UINT8 w,UINT8 h,UINT8 first,UINT8 palette){
 UINT8 a,b;for(b=0;b<h;b++)for(a=0;a<w;a++)if(x+a<20&&y+b<15){
  EG->map[(y+b)*20+x+a]=first+b*w+a;EG->palette[(y+b)*20+x+a]=palette;
 }
}
void ev_area_info(UINT8 area,UINT8 *biome,UINT8 *place,UINT8 *tier) BANKED {
 UINT8 x=area&15,y=area>>4;UINT16 hash=ev_hash(ES->seed,area,2);
 *biome=(ev_hash(ES->seed,(x/3)+(y/3)*6,1)%9);*tier=0;*place=EV_WILD;
 if(abs8((INT16)x-8)+abs8((INT16)y-8)<3)*biome=ev_hash(ES->seed,EV_HOME,1)%9;
 if((x%4==0&&y%4==0)||area==EV_HOME){*place=EV_TOWN;*tier=area==EV_HOME?0:(hash%3);}
 else if(x%4==2&&y%4==2)*place=EV_RUIN;
 else if(hash%19==0)*place=EV_LAIR;
 else if(hash%17==0)*place=EV_TRIAL;
 else if(hash%13==0)*place=EV_SHRINE;
}
UINT8 ev_walkable(INT16 x,INT16 y) BANKED {
 UINT8 tile;if(x<0||x>=160||y<0||y>=120)return 0;
 tile=EG->map[(y>>3)*20+(x>>3)];
 return tile<3||tile==7||tile==8||tile==9||tile==10||tile==11||tile==47||tile==48||tile==49;
}
void ev_generate_area(void) BANKED {
 UINT8 x,y,tile,dist,low,high;UINT32 rng;UINT8 area=ES->area;
 ev_area_info(area,&EG->biome,&EG->place,&EG->tier);
 EG->town=((area&15)/4)+((area>>4)/4)*4;
 if(ES->floor)EG->place=EV_DUNGEON;
 if(ES->interior)EG->place=EV_INTERIOR;
 rng=ES->seed ^ ((UINT32)area*77813UL) ^ ((UINT32)ES->floor*19937UL);
 EG->rng=rng;
 for(y=0;y<16;y++)for(x=0;x<20;x++){
  tile=ev_random(&rng)%9==0?1:0;
  if(ev_random(&rng)%17==0)tile=6;
  if(x==0||x==19||y==0||y==14||y==15)tile=4;
  if((x==9||x==10||y==7||y==8)&&y<15)tile=2;
  if(EG->place==EV_DUNGEON){tile=ev_random(&rng)%13==0?6:7;
   if(x==0||x==19||y==0||y==14||y==15)tile=6;
   if(x==9||x==10||y==7||y==8)tile=7;
  }
  EG->map[y*20+x]=tile;EG->palette[y*20+x]=(tile==2)?1:0;
 }
 /* Tiny clusters, with a two-tile cross-road kept open in every room. */
 if(EG->place!=EV_TOWN&&EG->place!=EV_DUNGEON){
  for(y=1;y<12;y+=3)for(x=1;x<17;x+=3)if(x<7||x>11){
   if(y>=5&&y<=8)continue;
   if(ev_random(&rng)%3)stamp(x,y,2,3,12,0);
   else if(EG->biome==2||EG->biome==3)stamp(x,y,2,2,50,4);
  }
 }
 if(EG->place==EV_TOWN){
  for(y=1;y<14;y++)for(x=2;x<18;x++){EG->map[y*20+x]=2;EG->palette[y*20+x]=1;}
  /* Home remains a tent settlement. Houses belong only to other tiers. */
  stamp(3,2,3,3,18,2);stamp(14,2,3,3,18,2);
  stamp(2,10,3,3,18,2);
  stamp(7,2,3,2,27,2);stamp(12,9,3,2,27,5);
  stamp(3,7,3,2,27,4);stamp(14,6,3,2,27,3);
  stamp(8,8,2,2,33,3);stamp(13,12,2,1,37,2);
  EG->map[11*20+8]=47;EG->palette[11*20+8]=4;
  EG->map[11*20+10]=48;EG->palette[11*20+10]=5;
  if(EG->tier){stamp(3,2,3,3,54,2);stamp(14,2,3,3,54,2);}
 }
 if(EG->place==EV_RUIN){stamp(8,2,4,3,39,5);EG->map[4*20+10]=8;}
 if(EG->place==EV_SHRINE){stamp(4,3,2,2,63,4);EG->map[5*20+5]=9;}
 if(EG->place==EV_TRIAL){EG->map[4*20+10]=10;EG->palette[4*20+10]=5;}
 if(EG->place==EV_LAIR){EG->map[3*20+10]=11;EG->palette[3*20+10]=3;}
 if(EG->place==EV_DUNGEON){
  EG->map[12*20+10]=8;EG->palette[12*20+10]=4;
  if(ES->floor<5){EG->map[2*20+10]=8;EG->palette[2*20+10]=5;}
 }
 if(EG->place==EV_INTERIOR){
  for(y=0;y<15;y++)for(x=0;x<20;x++){
   EG->map[y*20+x]=x<2||x>17||y<1||y>13?6:7;EG->palette[y*20+x]=1;
  }
  stamp(4,3,2,1,37,2);stamp(13,3,2,1,37,2);
  stamp(7,6,3,2,27,2);stamp(13,10,2,2,33,3);
  EG->map[13*20+10]=8;EG->palette[13*20+10]=4;
 }
 ES->visited[area>>3]|=1<<(area&7);
 if(!ES->area_level[area]){
  dist=abs8((INT16)(area&15)-8)+abs8((INT16)(area>>4)-8);
  low=dist<3?1:dist<5?4:dist<8?7:dist<11?12:18;high=dist<3?12:dist<5?18:dist<8?22:dist<11?28:35;
  ES->area_level[area]=ES->level<low?low:ES->level>high?high:(UINT8)ES->level;
 }
}
void ev_remember(void) BANKED {
 UINT8 i,index=EV_EMPTY;
 if(!EG->enemy_count)return;
 for(i=0;i<8;i++)if(ES->wounded[i].area==ES->area&&ES->wounded[i].floor==ES->floor){index=i;break;}
 if(index==EV_EMPTY){for(i=0;i<8;i++)if(ES->wounded[i].floor==EV_EMPTY){index=i;break;}}
 if(index==EV_EMPTY)index=ES->area%8;
 ES->wounded[index].area=ES->area;ES->wounded[index].floor=ES->floor;
 for(i=0;i<6;i++)ES->wounded[index].hp[i]=EG->enemies[i].alive?EG->enemies[i].hp:0;
}
void ev_spawn(void) BANKED {
 UINT8 i,j,dead,kind;UINT16 level,seed;UINT32 rng;
 memset(EG->enemies,0,sizeof(EG->enemies));EG->enemy_count=0;
 if(EG->place==EV_TOWN||EG->place==EV_SHRINE||EG->place==EV_INTERIOR)return;
 dead=ES->cleared[ES->area];
 if(ES->floor&&ES->dungeon_id<16)dead=ES->dungeons[ES->dungeon_id].cleared[ES->floor-1];
 if(ES->floor&&ES->expedition)dead=ES->rift.cleared[ES->floor-1];
 EG->enemy_count=EG->place==EV_DUNGEON?5:EG->place==EV_LAIR?4:EG->place==EV_TRIAL?6:3;
 rng=ES->seed ^ ES->area*733UL ^ ES->floor*7919UL;
 for(i=0;i<EG->enemy_count;i++){
  EvEnemy *e=&EG->enemies[i];seed=ev_random(&rng);e->seed=seed;
  e->x=24+(seed%7)*16;e->y=24+((seed>>5)%4)*16;
  if(EG->place==EV_DUNGEON){e->x=32+i*22;e->y=24+(i%3)*20;}
  /* Search a finite permutation of all interior cells. Never retry one
   * blocked fallback forever (ruin masonry used to hang the owner loop). */
  {UINT16 attempt,cell;UINT8 clear;
   for(attempt=0;attempt<234;attempt++){
    cell=(seed%234+attempt*37)%234;e->x=12+(cell%18)*8;e->y=12+(cell/18)*8;
    clear=ev_walkable(e->x-3,e->y)&&ev_walkable(e->x+3,e->y)&&ev_walkable(e->x,e->y-3)&&ev_walkable(e->x,e->y+3);
    if(abs8((INT16)e->x-ES->x)+abs8((INT16)e->y-ES->y)<28)clear=0;
    for(j=0;j<i;j++)if(abs8((INT16)e->x-EG->enemies[j].x)+abs8((INT16)e->y-EG->enemies[j].y)<12)clear=0;
    if(clear)break;
   }
   if(attempt==234){EG->enemy_count=i;break;}
  }
  e->home_x=e->x;e->home_y=e->y;
  kind=seed%8;
  if(i==0&&seed%3==0)kind=8+EG->biome%6;
  e->rank=seed%19==0?2:seed%7==0?1:0;
  if((EG->place==EV_LAIR||ES->floor==5)&&i==0){kind=EG->place==EV_LAIR?14+EG->biome%3:7;e->rank=3;}
  e->kind=kind;e->state=0;e->timer=(seed%50)+20;
  level=ES->area_level[ES->area];
  if(ES->floor&&ES->dungeon_id<16)level=ES->dungeons[ES->dungeon_id].level+ES->floor-1;
  if(ES->expedition)level=ES->rift_level+ES->floor;
  level+=e->rank;if(seed%3==0&&level>1)level--;else if(seed%3==2)level++;
  if(level>999)level=999;e->level=level;
  e->max_hp=(kind==2?65:kind==4?25:kind==7||kind>=14?180:kind>=8?60:32)+(level-1)*(kind==7||kind>=14?25:7);
  {UINT32 hp=(UINT32)e->max_hp*(10+e->rank*4)/10;e->max_hp=hp>30000?30000:hp;}e->hp=e->max_hp;
  e->damage=(7+(level-1)*2)*(10+e->rank*3)/10;
  e->alive=!(dead&(1<<i));
  for(j=0;j<8;j++)if(ES->wounded[j].area==ES->area&&ES->wounded[j].floor==ES->floor){
   if(ES->wounded[j].hp[i]<e->hp)e->hp=ES->wounded[j].hp[i];e->alive=e->alive&&e->hp;
  }
 }
}
void ev_enter(UINT8 area,UINT8 floor,UINT8 x,UINT8 y) BANKED {
 ev_remember();ES->area=area;ES->floor=floor;ES->x=x;ES->y=y;
 EG->action_timer=EG->dodge=EG->guard=EG->ward=EG->ward_timer=EG->field_timer=0;
 memset(EG->projectiles,0,sizeof(EG->projectiles));
 ev_generate_area();ev_spawn();
 if(!ev_walkable(x,y)){ES->x=80;ES->y=64;}
 ev_palettes();ev_draw_area();ev_hud();EG->autosave=0;
}
void ev_move(INT8 dx,INT8 dy,UINT8 speed) BANKED {
 INT16 x=(INT16)ES->x+dx*speed,y=(INT16)ES->y+dy*speed;
 if(dx&&dy){
  if(ES->direction!=(dx>0?1:3)&&ES->direction!=(dy>0?2:0))ES->direction=dx>0?1:3;
 }else if(dx)ES->direction=dx>0?1:3;else if(dy)ES->direction=dy>0?2:0;
 if(!ES->floor&&!ES->interior){
  if(x<3&&ES->area%16&&ev_walkable(0,ES->y-3)&&ev_walkable(0,ES->y+3)){ev_enter(ES->area-1,0,151,ES->y);return;}
  if(x>156&&ES->area%16<15&&ev_walkable(159,ES->y-3)&&ev_walkable(159,ES->y+3)){ev_enter(ES->area+1,0,8,ES->y);return;}
  if(y<3&&ES->area>=16&&ev_walkable(ES->x-3,0)&&ev_walkable(ES->x+3,0)){ev_enter(ES->area-16,0,ES->x,108);return;}
  if(y>116&&ES->area<240&&ev_walkable(ES->x-3,119)&&ev_walkable(ES->x+3,119)){ev_enter(ES->area+16,0,ES->x,9);return;}
 }
 if(ev_walkable(x-3,ES->y)&&ev_walkable(x+3,ES->y))ES->x=x;
 if(ev_walkable(ES->x,y-3)&&ev_walkable(ES->x,y+3))ES->y=y;
}
static UINT8 near(UINT8 x,UINT8 y){return abs8((INT16)ES->x-x)+abs8((INT16)ES->y-y)<22;}
UINT8 ev_interact(void) BANKED {
 UINT8 i,nearest=EV_EMPTY,best=22;UINT8 xs[8]={67,107,35,123,112,72,68,84},ys[8]={43,96,83,75,108,75,91,91};
 if(EG->place==EV_INTERIOR){
  if(near(80,106)){ES->interior=0;ev_enter(ES->area,0,ES->house_x,ES->house_y);return 1;}
  if(near(112,94)){ES->hp=EG->stats.max_hp;ES->mana=EG->stats.max_mana;ev_message("WARMTH OF THE HEARTH");return 1;}
  ev_message(ES->interior==1?"WELCOME TO OUR HEARTH":"THE ROADS GROW DARKER");return 1;
 }
 if(EG->place==EV_TOWN){
  if(EG->tier&&(near(36,40)||near(124,40))){ES->house_x=ES->x;ES->house_y=ES->y;ES->interior=ES->x<80?1:2;ev_enter(ES->area,0,80,96);return 1;}
  for(i=0;i<8;i++){UINT8 d=abs8((INT16)ES->x-xs[i])+abs8((INT16)ES->y-ys[i]);if(d<best){nearest=i;best=d;}}
  if(nearest<4){EG->service=nearest;ev_menu_open(EV_SERVICE_MENU);return 1;}
  if(nearest==4){ev_menu_open(EV_STASH_MENU);return 1;}
  if(nearest==5){ES->hp=EG->stats.max_hp;ES->mana=EG->stats.max_mana;ES->potions=2;ev_save(EG->slot);ev_message("RESTED AND SAVED");return 1;}
  if(nearest==6){ev_menu_open(EV_JOURNEY_MENU);return 1;}
  if(nearest==7&&ES->level<20){ev_message("RIFTS UNLOCK AT LV 20");return 1;}
  if(nearest==7){
   ES->expedition=1;ES->dungeon_id=EV_EMPTY;ES->rift.area=ES->area;ES->rift.level=20;ES->rift_level=20+ES->rift_tier*5;
   memset(ES->rift.cleared,0,5);ES->rift.claimed=0;
   for(i=0;i<8;i++)if(ES->wounded[i].area==ES->area&&ES->wounded[i].floor)ES->wounded[i].floor=EV_EMPTY;
   ev_enter(ES->area,1,80,96);ev_message("CRIMSON RIFT");return 1;
  }
 }
 if(EG->place==EV_RUIN&&near(80,40)){
  for(i=0;i<16;i++)if(ES->dungeons[i].area==ES->area)break;
  if(i==16){for(i=0;i<16;i++)if(ES->dungeons[i].area==EV_EMPTY)break;}
  if(i==16){ev_message("DUNGEON RECORDS FULL");return 1;}
  ES->dungeon_id=i;
  if(ES->dungeons[i].area==EV_EMPTY){ES->dungeons[i].area=ES->area;ES->dungeons[i].level=ES->area_level[ES->area];}
  ES->expedition=0;ev_enter(ES->area,1,80,96);ev_message("DESCENT INTO THE RUIN");return 1;
 }
 if(ES->floor){
  if(near(80,100)){
   if(ES->floor>1)ev_enter(ES->area,ES->floor-1,80,24);
   else {ES->expedition=0;ev_enter(ES->area,0,80,48);}return 1;
  }
  if(ES->floor<5&&near(80,20)){
   for(i=0;i<EG->enemy_count;i++)if(EG->enemies[i].alive){ev_message("CLEAR THIS FLOOR FIRST");return 1;}
   ev_enter(ES->area,ES->floor+1,80,92);return 1;
  }
 }
 if(EG->place==EV_SHRINE&&near(40,42)&&!(ES->claimed[ES->area>>3]&(1<<(ES->area&7)))){
  ES->claimed[ES->area>>3]|=1<<(ES->area&7);ES->skill_points++;ES->hp=EG->stats.max_hp;ES->mana=EG->stats.max_mana;
  ES->journey_flags|=8;
  ev_message("SHRINE GRANTS A POINT");ev_sound(4);ev_save(EG->slot);return 1;
 }
 return 0;
}
