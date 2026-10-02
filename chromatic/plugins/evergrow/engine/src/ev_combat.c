#pragma bank 255
#include "ev.h"

static INT16 magnitude(INT16 n){return n<0?-n:n;}
static UINT8 distance(UINT8 x,UINT8 y,UINT8 a,UINT8 b){INT16 dx=magnitude((INT16)x-a),dy=magnitude((INT16)y-b);return dx>dy?dx:dy;}
static INT8 dir_x(UINT8 d){return d==1?1:d==3?-1:0;}
static INT8 dir_y(UINT8 d){return d==2?1:d==0?-1:0;}
static UINT8 direction_to(INT16 dx,INT16 dy){return magnitude(dx)>magnitude(dy)?(dx>0?1:3):(dy>0?2:0);}
static UINT8 line_clear(UINT8 x,UINT8 y,UINT8 a,UINT8 b){
 UINT8 i;INT16 dx=(INT16)a-x,dy=(INT16)b-y;
 for(i=1;i<8;i++)if(!ev_walkable(x+dx*i/8,y+dy*i/8))return 0;return 1;
}
static UINT16 scale_damage(UINT16 damage,UINT16 percent){UINT32 n=(UINT32)damage*percent/100;return n>30000?30000:n?n:1;}
static void drop(UINT8 x,UINT8 y,UINT16 gold,const EvItem *item){
 UINT8 i;for(i=0;i<EV_DROPS;i++)if(!ES->drops[i].active){
  EvDrop *d=&ES->drops[i];d->active=1;d->area=ES->area;d->floor=ES->floor;d->x=x;d->y=y;d->gold=gold;
  if(item)d->item=*item;else{memset(&d->item,0,sizeof(EvItem));d->item.type=EV_EMPTY;}return;
 }
 if(gold)ev_credit(gold);
 if(item&&!ev_insert(ES->bag,EV_BAG,item))ev_message("LOOT SPACE EXHAUSTED");
}
static void reward(UINT8 index){
 EvEnemy *e=&EG->enemies[index];EvItem item;UINT16 gold;
 /* Commit death before presentation or reward. Retiring actors never enters here. */
 if(!e->alive)return;e->alive=0;e->hp=0;
 if(ES->floor&&ES->expedition)ES->rift.cleared[ES->floor-1]|=1<<index;
 else if(ES->floor&&ES->dungeon_id<16)ES->dungeons[ES->dungeon_id].cleared[ES->floor-1]|=1<<index;
 else ES->cleared[ES->area]|=1<<index;
 gold=4+e->level*2+(ev_hash(e->seed,e->level,91)%9);drop(e->x,e->y,gold,0);
 if(!ES->kills||e->rank>=2||ev_hash(e->seed,e->level,92)%100<42){
  ev_item_generate(&item,e->seed,e->level,EV_EMPTY,e->rank);
  if(e->rank==3&&item.rarity<2)item.rarity=2;
  drop(e->x+5,e->y+3,0,&item);
 }
 if(ES->kills<65535)ES->kills++;ES->potion_kills++;
 if(ES->potion_kills>=8){ES->potion_kills-=8;if(ES->potions<2)ES->potions++;}
 ev_xp((18+e->level*3)*(1+e->rank),e->level);
 ev_sound(2);
 if(e->rank==3){ES->journey_flags|=1;
  if(ES->floor==5&&ES->expedition){if(ES->rift_tier<195)ES->rift_tier++;ES->journey_flags|=4;ev_message("RIFT CONQUERED");}
  else if(ES->floor==5){ES->journey_flags|=2;ev_message("RUIN CONQUERED");}
  else ev_message("LAIR BOSS DEFEATED");
 }
}
static UINT16 hit(UINT8 index,UINT16 damage,UINT8 element,UINT16 healing){
 EvEnemy *e;UINT16 removed;
 if(index>=EG->enemy_count)return 0;e=&EG->enemies[index];if(!e->alive)return 0;
 /* Enemy armor applies only to physical contacts. Elemental defenses are local
  * archetype/biome traits, not the player's current equipment. */
 if(element==EV_PHYSICAL)damage=scale_damage(damage,10000UL/(100+e->level*2));
 else if((e->kind==10&&element==EV_FROST)||(e->kind==11&&element==EV_FIRE))damage=scale_damage(damage,65);
 if(element==EV_FIRE&&e->chill){damage=scale_damage(damage,125);e->chill=0;}
 if(element==EV_LIGHTNING&&(e->chill||e->burn)){damage=scale_damage(damage,120);e->stun=18;}
 removed=damage>e->hp?e->hp:damage;e->hp-=removed;e->flash=8;
 if(element==EV_FIRE){e->burn=180;e->burn_damage=damage/12+1;}
 if(element==EV_FROST)e->chill=150;
 if(healing&&removed){UINT32 hp=ES->hp+healing;ES->hp=hp>EG->stats.max_hp?EG->stats.max_hp:hp;}
 if(!e->hp)reward(index);else if(e->state==0)e->state=1;
 return removed;
}
void ev_damage_enemy(UINT8 index,UINT16 damage,UINT8 element) BANKED {hit(index,damage,element,0);}
void ev_damage_player(UINT16 damage,UINT8 element,UINT16 source_level) BANKED {
 UINT16 armor;UINT32 hp;
 if(EG->invulnerable||EG->death_timer)return;
 if(element==EV_PHYSICAL){armor=EG->stats.armor;damage=(UINT32)damage*(40+source_level*10)/(40+source_level*10+armor);}
 else damage=(UINT32)damage*(100-EG->stats.resistance[element-1])/100;
 if(EG->stats.block&&ev_random(&EG->rng)%100<EG->stats.block)damage=damage*45UL/100;
 if(EG->guard)damage=damage*40UL/100;
 if(EG->ward){if(EG->ward>=damage){EG->ward-=damage;damage=0;}else{damage-=EG->ward;EG->ward=0;}}
 if(damage){EG->portal_timer=0;hp=ES->hp;ES->hp=damage>=hp?0:hp-damage;EG->invulnerable=24;ev_sound(5);}
 if(!ES->hp){EG->death_timer=90;EG->action_timer=0;ev_message("FALLEN - RETURNING HOME");}
}
static UINT8 projectile(UINT8 x,UINT8 y,INT8 dx,INT8 dy,UINT16 damage,UINT8 owner,UINT8 element,UINT8 kind,UINT8 pierce,UINT8 chain,UINT16 level,UINT16 healing){
 UINT8 i;for(i=0;i<EV_PROJECTILES;i++)if(!EG->projectiles[i].life){
  EvProjectile *p=&EG->projectiles[i];memset(p,0,sizeof(*p));p->x=x;p->y=y;p->dx=dx;p->dy=dy;p->damage=damage;
  p->owner=owner;p->element=element;p->kind=kind;p->life=60;p->pierce=pierce;p->chain=chain;p->source_level=level;p->life_on_hit=healing;return 1;
 }return 0;
}
static UINT8 aim(UINT8 x,UINT8 y,UINT8 direction,INT8 *dx,INT8 *dy,UINT8 exclude){
 UINT8 i,target=EV_EMPTY,best=100;INT16 a,b,dot,cross;INT8 fx=dir_x(direction),fy=dir_y(direction);
 *dx=fx*3;*dy=fy*3;
 for(i=0;i<EG->enemy_count;i++)if(EG->enemies[i].alive&&!(exclude&(1<<i))){
  EvEnemy *e=&EG->enemies[i];UINT8 dist=distance(x,y,e->x,e->y);
  a=(INT16)e->x-x;b=(INT16)e->y-y;dot=a*fx+b*fy;cross=magnitude(a*fy-b*fx);
  if(dot>0&&cross*2<=dot+8&&dist<best&&line_clear(x,y,e->x,e->y)){target=i;best=dist;}
 }
 if(target!=EV_EMPTY){a=(INT16)EG->enemies[target].x-x;b=(INT16)EG->enemies[target].y-y;
  dot=magnitude(a)>magnitude(b)?magnitude(a):magnitude(b);if(dot){*dx=a*3/dot;*dy=b*3/dot;}}
 return target;
}
UINT8 ev_action(UINT8 skill) BANKED {
 EvWeapon weapon;EvSkill data;EvItem *item;UINT16 damage,cost=0;UINT8 hand=0,kind=EV_SWEEP,range=20,element=0,cadence;
 if(EG->action_timer||EG->death_timer||EG->dodge)return 0;
 if(skill!=EV_EMPTY&&(!ev_skill_unlocked(skill)||!ev_skill_compatible(skill)||EG->cooldowns[skill]))return 0;
 if(skill==EV_EMPTY&&ES->equipment[1].type==EV_WEAPON)hand=EG->action_hand^1;
 item=&ES->equipment[hand];
 if(skill!=EV_EMPTY){ev_skill(skill,&data);hand=ev_skill_hand(skill);item=&ES->equipment[hand];}
 if(item->type==EV_WEAPON){ev_weapon(item->profile,&weapon);damage=ev_item_power(item);}
 else{memset(&weapon,0,sizeof(weapon));weapon.cadence=40;weapon.reach=16;weapon.family=EV_MELEE;damage=8+ES->level*2;}
 damage=scale_damage(damage,weapon.family==EV_STAFF||weapon.family==EV_WAND?EG->stats.spell:EG->stats.damage);
 cadence=(UINT16)weapon.cadence*100/(100+EG->stats.speed);if(cadence<12)cadence=12;
 element=item->type==EV_WEAPON?item->element:0;range=weapon.reach;
 if(skill==EV_EMPTY){
  if(weapon.family!=EV_MELEE)kind=EV_BOLT;
  if(weapon.family==EV_STAFF)cost=4;if(weapon.family==EV_WAND)cost=2;
 }else{
  kind=data.execution;range=data.radius;if(data.element)element=data.element;
  damage=data.multiplier?scale_damage(damage,(UINT16)data.multiplier*10):0;
  if(damage)damage=scale_damage(damage,100+ES->ranks[skill]*5);
  cost=(UINT16)data.mana*(200+ES->ranks[skill]*3)/200;
 }
 cost=cost*(100-EG->stats.cost_reduction)/100;
 if(ES->mana<cost){ev_message("NOT ENOUGH MANA");return 0;}
 /* Capacity is checked before mana and cooldown commitment. */
 if(kind==EV_BOLT||kind==EV_PIERCE||kind==EV_CHAIN||kind==EV_FAN||kind==EV_VAULT||kind==EV_SIPHON){UINT8 i,free=0;for(i=0;i<8;i++)if(!EG->projectiles[i].life)free++;if(free<(kind==EV_FAN?3:1))return 0;}
 if((kind==EV_RAIN||kind==EV_METEOR||kind==EV_STORM||skill==27)&&EG->field_timer)return 0;
 ES->mana-=cost;
 if(damage&&ev_random(&EG->rng)%100<EG->stats.crit)damage=scale_damage(damage,150);
 if(damage&&EG->rally&&weapon.family==EV_MELEE){damage=scale_damage(damage,150);EG->rally--;}
 EG->action_damage=damage;EG->action_life_on_hit=EG->stats.life_on_hit;EG->action_element=element;EG->action_kind=kind;
 EG->action=skill;EG->action_timer=cadence;EG->action_release=cadence-(kind==EV_BOLT?cadence/3:4);
 EG->action_range=range;EG->action_hits=0;EG->action_hand=hand;EG->action_direction=ES->direction;
 if(skill!=EV_EMPTY)EG->cooldowns[skill]=data.cooldown;
 ev_sound(kind==EV_SWEEP?0:1);return 1;
}
void ev_dodge(void) BANKED {
 if(EG->dodge||EG->dodge_cooldown||EG->death_timer)return;
 EG->action_direction=ES->direction;EG->action_kind=EV_STEP;EG->dodge_cooldown=45;
 EG->portal_timer=0;EG->dodge=10;EG->invulnerable=10;EG->action_timer=0;ev_sound(0);
}
static void release(void){
 UINT8 kind=EG->action_kind,i;INT8 dx,dy;UINT16 damage=EG->action_damage;
 UINT8 x=ES->x,y=ES->y,direction=EG->action_direction;
 if(kind==EV_GUARD){EG->guard=180;return;}
 if(kind==EV_WARD){EG->ward=EG->stats.max_hp/2+ES->level*2;EG->ward_timer=600;return;}
 if(kind==EV_RALLY){EG->rally=5;EG->guard=180;return;}
 if(kind==EV_GHOST){EG->ghost=5;return;}
 if(kind==EV_STEP){EG->dodge=8;EG->invulnerable=0;return;}
 if(kind==EV_DASH){EG->dodge=12;EG->invulnerable=0;return;}
 if(kind==EV_BOLT||kind==EV_PIERCE||kind==EV_CHAIN||kind==EV_FAN||kind==EV_SIPHON||kind==EV_VAULT){
  aim(x,y,direction,&dx,&dy,0);
  projectile(x,y,dx,dy,damage,0,EG->action_element,kind,kind==EV_PIERCE?4:0,kind==EV_CHAIN?4:0,ES->level,EG->action_life_on_hit);
  if(kind==EV_FAN){projectile(x,y,dx+(dy!=0),dy+(dx!=0),damage,0,0,kind,0,0,ES->level,EG->action_life_on_hit);projectile(x,y,dx-(dy!=0),dy-(dx!=0),damage,0,0,kind,0,0,ES->level,EG->action_life_on_hit);}
  if(kind==EV_VAULT){EG->dodge=8;EG->action_direction=(direction+2)%4;EG->invulnerable=0;}
  if(EG->ghost&&EG->action_element==EV_PHYSICAL&&kind!=EV_FAN){EG->ghost--;projectile(x,y+3,dx,dy,damage/2,0,EG->action_element,EV_BOLT,0,0,ES->level,0);}
  return;
 }
 if(kind==EV_RAIN||kind==EV_METEOR||kind==EV_STORM||EG->action==27){
  INT16 target_x=x+dir_x(direction)*28,target_y=y+dir_y(direction)*28;
  EG->field_timer=kind==EV_STORM?240:kind==EV_METEOR?270:EG->action==27?90:180;
  EG->field_damage=damage;EG->field_life_on_hit=EG->action_life_on_hit;EG->field_source_level=ES->level;
  EG->field_element=EG->action_element;EG->field_range=EG->action_range;EG->field_skill=EG->action;
  EG->field_kind=kind;EG->field_x=target_x<8?8:target_x>151?151:target_x;
  EG->field_y=target_y<8?8:target_y>111?111:target_y;EG->field_pulses=0;return;
 }
 if(kind==EV_SMOKE){EG->guard=180;for(i=0;i<EG->enemy_count;i++)if(EG->enemies[i].alive&&distance(x,y,EG->enemies[i].x,EG->enemies[i].y)<=EG->action_range)EG->enemies[i].chill=180;return;}
 for(i=0;i<EG->enemy_count;i++)if(EG->enemies[i].alive){
  EvEnemy *e=&EG->enemies[i];INT16 a=(INT16)e->x-x,b=(INT16)e->y-y;
  if(distance(x,y,e->x,e->y)>EG->action_range||!line_clear(x,y,e->x,e->y))continue;
  if((kind==EV_SWEEP||kind==EV_THRUST||EG->action==0||EG->action==3)&&a*dir_x(direction)+b*dir_y(direction)<-3)continue;
  if((kind==EV_THRUST||EG->action==18)&&e->direction==direction)hit(i,scale_damage(damage,150),EG->action_element,EG->action_life_on_hit);
  else hit(i,damage,EG->action_element,EG->action_life_on_hit);
  EG->action_hits|=1<<i;
  if(kind==EV_NOVA&&EG->action_element==0)e->stun=45;
  if(kind==EV_SMOKE)e->chill=180;
 }
 if(EG->action==4)EG->guard=180;
}
static void enemies(void){
 UINT8 i;for(i=0;i<EG->enemy_count;i++){
  EvEnemy *e=&EG->enemies[i];UINT8 dist,range;INT16 dx,dy;INT8 mx=0,my=0;
  if(!e->alive)continue;
  if(e->flash)e->flash--;
  if(e->burn){e->burn--;if(EG->tick%30==0){/* Burns cannot crit, trigger life-on-hit or refresh themselves. */
   if(e->burn_damage>=e->hp){reward(i);continue;}e->hp-=e->burn_damage;e->flash=5;
  }}
  if(e->chill)e->chill--;if(e->stun){e->stun--;continue;}
  if(e->timer)e->timer--;
  dx=(INT16)ES->x-e->x;dy=(INT16)ES->y-e->y;dist=distance(e->x,e->y,ES->x,ES->y);
  range=(e->kind==3||e->kind==5||e->kind==6||e->kind==9||e->kind==11||e->kind==13)?58:18;
  if(e->state==0){
   if(dist<70&&line_clear(e->x,e->y,ES->x,ES->y)){e->state=1;e->timer=0;}
   else if((EG->tick+i)%4==0){
    mx=dir_x((e->seed+EG->tick/90)%4);my=dir_y((e->seed+EG->tick/90)%4);
    if(distance(e->x,e->y,e->home_x,e->home_y)>12){mx=e->home_x>e->x?1:-1;my=e->home_y>e->y?1:-1;}
   }
  }else if(e->state==1){
   if(distance(e->x,e->y,e->home_x,e->home_y)>75||dist>100){e->state=4;e->timer=0;}
   else if(dist<=range&&line_clear(e->x,e->y,ES->x,ES->y)){e->state=2;e->timer=e->rank==3?48:e->kind==4?20:32;e->direction=direction_to(dx,dy);e->aim_x=ES->x;e->aim_y=ES->y;}
   else if(EG->tick%(e->chill?6:e->kind==4||e->kind==0?2:3)==0){
    if(magnitude(dx)>magnitude(dy))mx=dx>0?1:-1;else my=dy>0?1:-1;
   }
  }else if(e->state==2&&!e->timer){
   if(range>20){INT16 length;dx=(INT16)e->aim_x-e->x;dy=(INT16)e->aim_y-e->y;length=magnitude(dx)>magnitude(dy)?magnitude(dx):magnitude(dy);
    if(length)projectile(e->x,e->y,dx*2/length,dy*2/length,e->damage,1,e->kind==5?0:e->kind==11?1:e->kind==13?3:4,EV_BOLT,0,0,e->level,0);
   }else if(dist<(e->rank==3?35:24)&&dx*dir_x(e->direction)+dy*dir_y(e->direction)>-4)ev_damage_player(e->damage,0,e->level);
   e->turns++;e->state=3;e->timer=e->rank==3?(e->hp<e->max_hp/2?35:65):40;
  }else if(e->state==3&&!e->timer)e->state=1;
  else if(e->state==4){
   if(distance(e->x,e->y,e->home_x,e->home_y)<5)e->state=0;
   else if(EG->tick%3==0){mx=e->home_x>e->x?1:-1;my=e->home_y>e->y?1:-1;}
  }
  if(mx&&ev_walkable((INT16)e->x+mx*4,e->y))e->x+=mx;
  if(my&&ev_walkable(e->x,(INT16)e->y+my*4))e->y+=my;
 }
}
static void projectiles(void){
 UINT8 i,j;for(i=0;i<8;i++){
  EvProjectile *p=&EG->projectiles[i];INT16 x,y;if(!p->life)continue;
  p->life--;x=(INT16)p->x+p->dx;y=(INT16)p->y+p->dy;
  if(!ev_walkable(x,y)){p->life=0;continue;}p->x=x;p->y=y;
  if(p->owner){if(distance(p->x,p->y,ES->x,ES->y)<7){ev_damage_player(p->damage,p->element,p->source_level);p->life=0;}}
  else for(j=0;j<EG->enemy_count;j++)if(EG->enemies[j].alive&&!(p->hit_mask&(1<<j))&&distance(p->x,p->y,EG->enemies[j].x,EG->enemies[j].y)<9){
   UINT16 removed=hit(j,p->damage,p->element,p->life_on_hit);p->hit_mask|=1<<j;
   if(p->kind==EV_SIPHON){UINT32 hp=ES->hp+removed/4;ES->hp=hp>EG->stats.max_hp?EG->stats.max_hp:hp;}
   if(p->kind==EV_BOLT&&p->element==EV_FIRE){UINT8 k;for(k=0;k<EG->enemy_count;k++)if(k!=j&&EG->enemies[k].alive&&distance(p->x,p->y,EG->enemies[k].x,EG->enemies[k].y)<18)hit(k,p->damage/2,EV_FIRE,p->life_on_hit);}
   if(p->chain){UINT8 target=EV_EMPTY,best=48,k;INT16 dx,dy,n;
    p->chain--;p->damage=scale_damage(p->damage,78);
    for(k=0;k<EG->enemy_count;k++)if(EG->enemies[k].alive&&!(p->hit_mask&(1<<k))){UINT8 d=distance(p->x,p->y,EG->enemies[k].x,EG->enemies[k].y);if(d<best&&line_clear(p->x,p->y,EG->enemies[k].x,EG->enemies[k].y)){best=d;target=k;}}
    if(target==EV_EMPTY)p->life=0;
    else{dx=(INT16)EG->enemies[target].x-p->x;dy=(INT16)EG->enemies[target].y-p->y;n=magnitude(dx)>magnitude(dy)?magnitude(dx):magnitude(dy);p->dx=n?dx*3/n:0;p->dy=n?dy*3/n:0;}
   }else if(p->pierce)p->pierce--;else p->life=0;break;
  }
 }
}
void ev_pickups(void) BANKED {
 UINT8 i;if(ES->interior)return;for(i=0;i<EV_DROPS;i++){
  EvDrop *drop=&ES->drops[i];if(!drop->active||drop->area!=ES->area||drop->floor!=ES->floor||distance(drop->x,drop->y,ES->x,ES->y)>10)continue;
  if(drop->gold){ev_credit(drop->gold);drop->active=0;ev_sound(3);}
  else if(ev_insert(ES->bag,EV_BAG,&drop->item)){drop->active=0;ev_name(drop->item.type==EV_WEAPON?EV_NAME_WEAPON:EV_NAME_ITEM,drop->item.type==EV_WEAPON?drop->item.profile:drop->item.type,EG->scratch);ev_message(EG->scratch);ev_sound(3);}
  else if(EG->tick%120==0)ev_message("PACK FULL - LOOT WAITS");
 }
}
void ev_combat_tick(void) BANKED {
 UINT8 i;EG->tick++;
 for(i=0;i<30;i++)if(EG->cooldowns[i])EG->cooldowns[i]--;
 if(EG->invulnerable)EG->invulnerable--;if(EG->guard)EG->guard--;if(EG->potion_cooldown)EG->potion_cooldown--;
 if(EG->message_timer)EG->message_timer--;
 if(EG->dodge_cooldown)EG->dodge_cooldown--;if(EG->ward_timer){EG->ward_timer--;if(!EG->ward_timer)EG->ward=0;}
 if(EG->death_timer){EG->death_timer--;if(!EG->death_timer){ES->gold-=ES->gold/10;ES->expedition=0;ES->interior=0;ES->dungeon_id=EV_EMPTY;ev_enter(EV_HOME,0,80,104);ES->hp=EG->stats.max_hp;ES->mana=EG->stats.max_mana;ES->potions=2;ev_save(EG->slot);}return;}
 if(EG->tick%60==0){UINT32 mana=ES->mana+EG->stats.regen;ES->mana=mana>EG->stats.max_mana?EG->stats.max_mana:mana;}
 if(EG->action_timer){EG->action_timer--;if(EG->action_timer==EG->action_release)release();}
 if(EG->dodge){EG->dodge--;ev_move(dir_x(EG->action_direction),dir_y(EG->action_direction),3);
  if(EG->action_kind==EV_DASH)for(i=0;i<EG->enemy_count;i++)if(EG->enemies[i].alive&&!(EG->action_hits&(1<<i))&&distance(ES->x,ES->y,EG->enemies[i].x,EG->enemies[i].y)<16){hit(i,EG->action_damage,EG->action_element,EG->action_life_on_hit);EG->action_hits|=1<<i;}
 }
 if(EG->field_timer){
  EG->field_timer--;if(EG->field_kind==EV_STORM){EG->field_x=ES->x;EG->field_y=ES->y;}
  if(EG->field_timer%30==0){
   UINT8 impact=EG->field_kind!=EV_METEOR||!EG->field_pulses||(EG->field_skill==29&&EG->field_pulses<3);
   for(i=0;i<EG->enemy_count;i++)if(EG->enemies[i].alive&&distance(EG->field_x,EG->field_y,EG->enemies[i].x,EG->enemies[i].y)<EG->field_range){
    EvEnemy *e=&EG->enemies[i];
    if(impact)hit(i,EG->field_damage,EG->field_element,EG->field_life_on_hit);
    else if(e->alive){e->burn=60;if(e->burn_damage<EG->field_damage/12+1)e->burn_damage=EG->field_damage/12+1;}
   }
   EG->field_pulses++;if(EG->field_kind==EV_STORM){if(ES->mana)ES->mana--;else EG->field_timer=0;}
  }
 }
 enemies();projectiles();ev_pickups();
 if(++EG->autosave>=1200){ev_remember();ev_save(EG->slot);EG->autosave=0;}
}
