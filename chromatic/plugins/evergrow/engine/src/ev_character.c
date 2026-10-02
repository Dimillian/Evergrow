#pragma bank 255
#include "ev.h"

UINT16 ev_random(void *state) BANKED {
 UINT32 x;memcpy(&x,state,sizeof(x)); if(!x)x=0x9e3779b9UL;
 x^=x<<13; x^=x>>17; x^=x<<5; memcpy(state,&x,sizeof(x)); return (UINT16)(x>>8);
}
UINT16 ev_hash(UINT32 seed,UINT16 identity,UINT8 salt) BANKED {
 UINT32 x=seed ^ ((UINT32)identity*2654435761UL) ^ ((UINT32)salt*2246822519UL);
 return ev_random(&x);
}
static UINT16 bounded(UINT32 n,UINT16 max) { return n>max?max:(UINT16)n; }
static void empty_item(EvItem *item) { memset(item,0,sizeof(*item));item->type=EV_EMPTY; }

UINT16 ev_item_power(const EvItem *item) BANKED {
 UINT16 base=4; EvWeapon weapon;
 if(item->type==EV_EMPTY)return 0;
 if(item->type==EV_WEAPON){ev_weapon(item->profile,&weapon);base=weapon.damage;}
 else if(item->type==EV_CHEST)base=12;
 else if(item->type==EV_SHIELD)base=8+item->profile*4;
 else if(item->type==EV_FOCUS)base=10;
 return bounded((UINT32)base*(100+(UINT32)(item->level-1)*18+item->rarity*18+item->enchant*8)/100,30000);
}
UINT16 ev_item_price(const EvItem *item) BANKED {
 if(item->type==EV_EMPTY)return 0;
 return bounded(10UL+ev_item_power(item)*(3+item->rarity*2)+item->enchant*15UL,65535);
}
void ev_item_generate(EvItem *item,UINT16 seed,UINT16 level,UINT8 kind,UINT8 rank) BANKED {
 UINT32 rng=(UINT32)seed*65537UL+0x7193UL; UINT16 roll=ev_random(&rng)%1000;
 memset(item,0,sizeof(*item));item->level=level?level:1;
 item->type=kind<12?kind:ev_random(&rng)%12;
 item->rarity=roll<10+rank*10?4:roll<45+rank*30?3:roll<160+rank*70?2:roll<500+rank*90?1:0;
 item->profile=ev_random(&rng)%(item->type==EV_WEAPON?17:item->type==EV_SHIELD?3:item->type==EV_FOCUS?6:4);
 item->affix=ev_random(&rng)%12;item->value=2+item->rarity*2+level/8;
 if(item->value>60)item->value=60;
 item->element=EV_PHYSICAL;
 if(item->type==EV_WEAPON){EvWeapon w;ev_weapon(item->profile,&w);item->element=w.element;
  if(w.family==EV_MELEE && item->rarity && item->affix>=7 && item->affix<=9)item->element=item->affix-6;}
}
UINT8 ev_insert(EvItem *array,UINT8 count,const EvItem *item) BANKED {
 UINT8 i;for(i=0;i<count;i++)if(array[i].type==EV_EMPTY){array[i]=*item;return 1;}return 0;
}
UINT8 ev_debit(UINT32 value) BANKED { if(value>EV_GOLD_MAX||ES->gold<value)return 0;ES->gold-=value;return 1; }
void ev_credit(UINT32 value) BANKED { if(value>EV_GOLD_MAX-ES->gold)ES->gold=EV_GOLD_MAX;else ES->gold+=value; }
UINT8 ev_node_owned(UINT8 node) BANKED { return node<EV_NODES && (ES->nodes[node>>3]&(1<<(node&7))); }
UINT8 ev_skill_unlocked(UINT8 skill) BANKED { return skill<EV_SKILLS&&ev_node_owned((skill/5)*16+skill%5); }
UINT8 ev_node_allocate(UINT8 node) BANKED {
 UINT8 local=node%16,group=node/16,cost=1,adjacent=0;
 if(node>=EV_NODES||ev_node_owned(node))return 0;
 if(local<5){EvSkill skill;ev_skill(group*5+local,&skill);cost=2+skill.tier;}
 if(local==12||local==15)adjacent=1;
 if(local%4&&ev_node_owned(node-1))adjacent=1;
 if(local%4<3&&ev_node_owned(node+1))adjacent=1;
 if(local>=4&&ev_node_owned(node-4))adjacent=1;
 if(local<12&&ev_node_owned(node+4))adjacent=1;
 if(!adjacent||ES->skill_points<cost)return 0;
 ES->skill_points-=cost;ES->nodes[node>>3]|=1<<(node&7);ev_derive();return 1;
}
UINT8 ev_skill_rank(UINT8 skill) BANKED {
 if(!ev_skill_unlocked(skill)||!ES->skill_points||ES->ranks[skill]>=20)return 0;
 ES->skill_points--;ES->ranks[skill]++;return 1;
}
static UINT8 compatible_weapon(UINT8 requirement,const EvItem *item) {
 EvWeapon weapon;if(item->type!=EV_WEAPON)return 0;ev_weapon(item->profile,&weapon);
 switch(requirement){
 case EV_REQ_MELEE:return weapon.family==EV_MELEE;
 case EV_REQ_BLADE:return item->profile==0||item->profile==3||item->profile==4;
 case EV_REQ_HEAVY:return item->profile==1||item->profile==2||item->profile==4||item->profile==5||item->profile==6;
 case EV_REQ_DAGGER:return item->profile==3;
 case EV_REQ_BOW:return weapon.family==EV_BOW;
 case EV_REQ_MAGIC:return weapon.family==EV_STAFF||weapon.family==EV_WAND;
 }return 0;
}
UINT8 ev_skill_compatible(UINT8 skill) BANKED {
 return ev_skill_hand(skill)!=EV_EMPTY;
}
UINT8 ev_skill_hand(UINT8 skill) BANKED {
 EvSkill data;if(skill>=30)return EV_EMPTY;ev_skill(skill,&data);
 if(data.requirement==EV_ANY)return 0;
 if(data.requirement==EV_REQ_SHIELD)return ES->equipment[1].type==EV_SHIELD?0:EV_EMPTY;
 if(compatible_weapon(data.requirement,&ES->equipment[0]))return 0;
 if(compatible_weapon(data.requirement,&ES->equipment[1]))return 1;
 return EV_EMPTY;
}
static UINT8 equip_to(UINT8 index,UINT8 offhand) {
 EvItem source,old;EvWeapon weapon;UINT8 target=0,i,free=0,needed=0,conflict=0;
 if(index>=EV_BAG||ES->bag[index].type==EV_EMPTY)return 0;
 source=ES->bag[index];if(source.level>ES->level+3)return 0;
 switch(source.type){
 case EV_WEAPON:target=offhand?1:0;ev_weapon(source.profile,&weapon);
  if(offhand&&weapon.hands==2)return 0;
  if(!offhand&&weapon.hands==2&&ES->equipment[1].type!=EV_EMPTY)conflict=1;
  if(offhand&&ES->equipment[0].type==EV_WEAPON){ev_weapon(ES->equipment[0].profile,&weapon);if(weapon.hands==2)return 0;}break;
 case EV_SHIELD:case EV_FOCUS:target=1;
  if(ES->equipment[0].type==EV_WEAPON){ev_weapon(ES->equipment[0].profile,&weapon);if(weapon.hands==2)return 0;}break;
 case EV_CHARM:
  for(i=0;i<4;i++)if(ES->charms[i].type==EV_EMPTY){ES->charms[i]=source;empty_item(&ES->bag[index]);ev_derive();return 1;}return 0;
 default:target=source.type-1;if(source.type==EV_RING)target=ES->equipment[9].type==EV_EMPTY?9:10;break;
 }
 if(target>10)return 0;
 for(i=0;i<EV_BAG;i++)if(ES->bag[i].type==EV_EMPTY)free++;
 needed=(ES->equipment[target].type!=EV_EMPTY)+conflict;
 if(free+1<needed)return 0;
 old=ES->equipment[target];empty_item(&ES->bag[index]);ES->equipment[target]=source;
 if(old.type!=EV_EMPTY)ev_insert(ES->bag,EV_BAG,&old);
 if(conflict){ev_insert(ES->bag,EV_BAG,&ES->equipment[1]);empty_item(&ES->equipment[1]);}
 ev_derive();return 1;
}
UINT8 ev_equip(UINT8 index) BANKED { return equip_to(index,0); }
UINT8 ev_equip_offhand(UINT8 index) BANKED { return equip_to(index,1); }

void ev_derive(void) BANKED {
 EvStats *stats=&EG->stats;UINT8 i,n,group,local;UINT16 bonuses[12],power;
 memset(stats,0,sizeof(*stats));memset(bonuses,0,sizeof(bonuses));
 for(i=0;i<15;i++){
  EvItem *item=i<11?&ES->equipment[i]:&ES->charms[i-11];if(item->type==EV_EMPTY)continue;
  power=ev_item_power(item);
  if(item->type==EV_SHIELD){stats->block+=20+item->profile*8;stats->armor+=power;}
  else if(item->type==EV_FOCUS){stats->max_mana+=power;stats->regen+=item->profile<3?1:0;}
  else if(item->type>=EV_HEAD&&item->type<=EV_CLOAK)stats->armor+=power;
  if(item->rarity)bonuses[item->affix%12]+=item->value;
 }
 for(n=0;n<96;n++)if(ev_node_owned(n)&&n%16>=5){
  group=n/16;local=n%16;
  if(group==0){stats->armor+=ES->level*2;bonuses[3]+=local==15?4:2;}
  if(group==1)bonuses[0]+=local==15?6:3;
  if(group==2){bonuses[1]+=3;stats->crit+=1;}
  if(group==3){bonuses[5]+=2;stats->move_speed+=local==15?2:1;}
  if(group==4){bonuses[2]+=3;stats->cost_reduction+=1;}
  if(group==5){bonuses[6]+=3;stats->regen+=local%4==3;stats->life_on_hit+=local%4==1;}
 }
 stats->max_hp=bounded(90UL+ES->level*5UL+(ES->attributes[3]+bonuses[3])*5UL,30000);
 stats->max_mana+=bounded(45UL+ES->level*2UL+(ES->attributes[2]+bonuses[2])*2UL,10000);
 stats->damage=bounded(100UL+(ES->attributes[0]+bonuses[0])*3UL+bonuses[1],500);
 stats->spell=bounded(100UL+(ES->attributes[2]+bonuses[2])*3UL+bonuses[6],500);
 stats->speed=bounded(bonuses[5]+ES->attributes[1],80);
 stats->crit=bounded(5+stats->crit+ES->attributes[1]/4+bonuses[1]/3,40);
 stats->regen+=1;stats->cost_reduction=bounded(stats->cost_reduction+bonuses[6]/3,40);
 stats->armor+=ES->level*2+bonuses[4]*3;
 stats->block=bounded(stats->block,60);stats->life_on_hit+=bonuses[11];
 for(i=0;i<4;i++)stats->resistance[i]=bounded(bonuses[7+i]*2,75);
 if(ES->hp>stats->max_hp)ES->hp=stats->max_hp;
 if(ES->mana>stats->max_mana)ES->mana=stats->max_mana;
}
void ev_reset_runtime(void) BANKED {
 memset(EG->cooldowns,0,sizeof(EG->cooldowns));memset(EG->projectiles,0,sizeof(EG->projectiles));
 EG->action_timer=EG->dodge=EG->guard=EG->ward=EG->ward_timer=EG->field_timer=0;
 EG->action_release=EG->invulnerable=EG->rally=EG->ghost=EG->portal_timer=EG->death_timer=0;
 EG->potion_cooldown=EG->dodge_cooldown=EG->select_used=EG->select_ticks=EG->message_timer=0;
 EG->autosave=0;EG->action_hand=1;EG->active_character=1;
}
void ev_new(UINT8 starter,UINT32 seed) BANKED {
 UINT8 i;memset(ES,0,sizeof(*ES));ES->seed=seed?seed:7319;ES->level=1;
 ES->area=EV_HOME;ES->x=80;ES->y=111;ES->direction=2;ES->starter=starter;
 ES->potions=2;ES->sound=1;ES->dungeon_id=EV_EMPTY;
 for(i=0;i<11;i++)empty_item(&ES->equipment[i]);
 for(i=0;i<EV_BAG;i++)empty_item(&ES->bag[i]);
 for(i=0;i<EV_STASH;i++)empty_item(&ES->stash[i]);
 for(i=0;i<4;i++)empty_item(&ES->charms[i]);
 for(i=0;i<6;i++)empty_item(&ES->buyback[i]);
 for(i=0;i<5;i++)ES->slots[i]=EV_EMPTY;
 for(i=0;i<8;i++){ES->wounded[i].area=EV_EMPTY;ES->wounded[i].floor=EV_EMPTY;}
 for(i=0;i<16;i++)ES->dungeons[i].area=EV_EMPTY;
 ev_item_generate(&ES->equipment[0],17,1,EV_WEAPON,0);
 ES->equipment[0].rarity=0;ES->equipment[0].profile=starter==0?0:starter==1?4:starter==2?16:starter==3?10:starter==4?7:9;
 {EvWeapon w;ev_weapon(ES->equipment[0].profile,&w);ES->equipment[0].element=w.element;}
 if(starter==0){ev_item_generate(&ES->equipment[1],18,1,EV_SHIELD,0);ES->equipment[1].rarity=0;ES->equipment[1].profile=0;}
 if(starter==2){ev_item_generate(&ES->equipment[1],19,1,EV_FOCUS,0);ES->equipment[1].rarity=0;ES->equipment[1].profile=2;}
 ev_item_generate(&ES->equipment[3],21,1,EV_CHEST,0);ES->equipment[3].rarity=0;
 EG->rng=ES->seed;ev_derive();ES->hp=EG->stats.max_hp;ES->mana=EG->stats.max_mana;
 ev_reset_runtime();
}
UINT32 ev_xp_needed(UINT16 level) BANKED { return 60UL+level*35UL+(UINT32)level*level*3UL; }
void ev_xp(UINT16 amount,UINT16 source_level) BANKED {
 UINT16 factor=100;INT16 gap=(INT16)ES->level-(INT16)source_level;
 if(gap>0)factor=gap>=10?10:100-gap*9;
 else if(gap<0)factor=100+(-gap>5?50:-gap*10);
 ES->xp+=(UINT32)amount*factor/100;
 while(ES->level<EV_LEVEL_MAX&&ES->xp>=ev_xp_needed(ES->level)){
  ES->xp-=ev_xp_needed(ES->level);ES->level++;ES->stat_points+=5;ES->skill_points++;ev_derive();ev_message("LEVEL UP - NEW POINTS");ev_sound(4);
 }
 if(ES->level==EV_LEVEL_MAX&&ES->xp>ev_xp_needed(ES->level))ES->xp=ev_xp_needed(ES->level);
}
void ev_potion(void) BANKED {
 if(!ES->potions||(ES->hp==EG->stats.max_hp&&ES->mana==EG->stats.max_mana))return;
 if(EG->potion_cooldown)return;
 EG->portal_timer=0;EG->potion_cooldown=48;
 ES->potions--;ES->hp=bounded(ES->hp+(UINT32)EG->stats.max_hp*42/100,EG->stats.max_hp);
 ES->mana=bounded(ES->mana+(UINT32)EG->stats.max_mana*40/100,EG->stats.max_mana);
 ev_message("LIFE AND MANA RESTORED");ev_sound(3);
}

UINT8 ev_shop_item(UINT8 vendor,UINT8 index,EvItem *item) BANKED {
 UINT8 town=EG->town,epoch=ES->level/3,kind;UINT16 seed,level=ES->level;
 if(vendor>1||index>=(vendor?8:12))return 0;
 if(ES->shop_epoch[town]!=epoch){ES->shop_epoch[town]=epoch;ES->shop_bought[town]=0;ES->refreshes[town]=0;}
 if(ES->shop_bought[town]&(1UL<<(index+(vendor?12:0))))return 0;
 seed=ev_hash(ES->seed,ES->area,(UINT8)(index+vendor*12+epoch*20+ES->refreshes[town]*37));
 kind=vendor?(index%3==0?EV_AMULET:index%3==1?EV_RING:EV_CHARM):index<6?EV_WEAPON:index==6?EV_SHIELD:index==7?EV_FOCUS:EV_HEAD+(index-8);
 if(level>ES->area_level[ES->area]+10)level=ES->area_level[ES->area]+10;
 ev_item_generate(item,seed,level,kind,EG->tier);
 if(EG->tier&&index<EG->tier&&item->rarity<2)item->rarity=2;
 return 1;
}
UINT8 ev_shop_buy(UINT8 vendor,UINT8 index) BANKED {
 EvItem item;UINT8 i;UINT32 price;
 if(!ev_shop_item(vendor,index,&item))return 0;
 for(i=0;i<EV_BAG&&ES->bag[i].type!=EV_EMPTY;i++){}if(i==EV_BAG)return 0;
 price=(UINT32)ev_item_price(&item)*2;if(!ev_debit(price))return 0;
 ES->bag[i]=item;ES->shop_bought[EG->town]|=1UL<<(index+(vendor?12:0));ev_sound(3);return 1;
}
UINT8 ev_sell(UINT8 index) BANKED {
 UINT8 i;EvItem item;if(index>=EV_BAG||ES->bag[index].type==EV_EMPTY)return 0;
 item=ES->bag[index];for(i=5;i;i--)ES->buyback[i]=ES->buyback[i-1];ES->buyback[0]=item;
 ev_credit(ev_item_price(&item));empty_item(&ES->bag[index]);ev_sound(3);return 1;
}
UINT32 ev_improve_price(UINT8 index,UINT8 operation) BANKED {
 EvItem *item;if(index>=EV_BAG||operation>3)return 0;item=&ES->bag[index];
 return (UINT32)ev_item_price(item)*(operation==0?item->enchant+1:operation==1?4:operation==2?2:3);
}
UINT32 ev_refresh_price(void) BANKED {
 UINT32 price=150UL*ES->level;UINT8 r=ES->refreshes[EG->town];return r<10?price<<r:EV_GOLD_MAX;
}
UINT32 ev_gamble_price(UINT8 category) BANKED {
 UINT32 price=(120UL+(ES->level-1)*12UL)*(10+EG->tier*4)/10;
 return category==EV_RING||category==EV_AMULET?price*3/2:price;
}
UINT8 ev_improve(UINT8 index,UINT8 operation) BANKED {
 EvItem *item;UINT32 price;
 if(index>=EV_BAG)return 0;item=&ES->bag[index];if(item->type==EV_EMPTY)return 0;
 price=ev_improve_price(index,operation);
 if(operation==0&&item->enchant>=10)return 0;
 if(operation==1&&item->rarity>=4)return 0;
 if(operation>3||!ev_debit(price))return 0;
 if(operation==0)item->enchant++;
 if(operation==1)item->rarity++;
 if(operation==3)item->level=ES->level;
 if(operation==2){item->affix=ev_random(&EG->rng)%12;item->value=2+item->rarity*2+item->level/8;if(item->value>60)item->value=60;}
 if(item->type==EV_WEAPON){EvWeapon w;ev_weapon(item->profile,&w);item->element=w.element;
  if(w.family==EV_MELEE&&item->rarity&&item->affix>=7&&item->affix<=9)item->element=item->affix-6;}
 return 1;
}
UINT8 ev_respec(void) BANKED {
 UINT8 node,skill;UINT16 refund=0;EvSkill data;
 for(node=0;node<96;node++)if(ev_node_owned(node)){if(node%16<5){ev_skill((node/16)*5+node%16,&data);refund+=2+data.tier;}else refund++;}
 for(skill=0;skill<30;skill++)refund+=ES->ranks[skill];
 if(!refund||!ev_debit(100UL+ES->level*15UL))return 0;
 ES->skill_points+=refund;memset(ES->nodes,0,12);memset(ES->ranks,0,30);memset(ES->slots,EV_EMPTY,5);ev_derive();return 1;
}
UINT8 ev_gamble(UINT8 category) BANKED {
 EvItem item;UINT8 i;UINT32 price;
 if(category>=12)return 0;
 for(i=0;i<EV_BAG&&ES->bag[i].type!=EV_EMPTY;i++){}if(i==EV_BAG)return 0;
 price=ev_gamble_price(category);
 if(!ev_debit(price))return 0;
 ev_item_generate(&item,ev_random(&EG->rng),ES->level,category,EG->tier);ES->bag[i]=item;return 1;
}
