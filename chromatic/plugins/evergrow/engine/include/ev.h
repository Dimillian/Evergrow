#ifndef EVERGROW_NATIVE_H
#define EVERGROW_NATIVE_H
#ifdef EV_HOST
#include <stdint.h>
#include <stddef.h>
typedef uint8_t UINT8;
typedef int8_t INT8;
typedef uint16_t UINT16;
typedef int16_t INT16;
typedef uint32_t UINT32;
#define BANKED
#define NONBANKED
#define J_RIGHT 1
#define J_LEFT 2
#define J_UP 4
#define J_DOWN 8
#define J_A 16
#define J_B 32
#define J_SELECT 64
#define J_START 128
#define DIV_REG 0
#else
#include <gb/gb.h>
#include <gb/cgb.h>
#endif
#include <string.h>

#define EV_VERSION 1
#define EV_AREAS 256
#define EV_BAG 24
#define EV_STASH 96
#define EV_ENEMIES 6
#define EV_PROJECTILES 8
#define EV_DROPS 24
#define EV_SKILLS 30
#define EV_NODES 96
#define EV_EMPTY 255
#define EV_GOLD_MAX 999999999UL
#define EV_LEVEL_MAX 999
#define EV_HOME 136
#define EV_SAVE_BYTES 4096

enum { EV_WEAPON, EV_SHIELD, EV_FOCUS, EV_HEAD, EV_CHEST, EV_GLOVES,
 EV_LEGS, EV_BOOTS, EV_CLOAK, EV_AMULET, EV_RING, EV_CHARM };
enum { EV_PHYSICAL, EV_FIRE, EV_FROST, EV_LIGHTNING, EV_ARCANE };
enum { EV_MELEE, EV_BOW, EV_STAFF, EV_WAND };
enum { EV_ANY, EV_REQ_MELEE, EV_REQ_BLADE, EV_REQ_HEAVY, EV_REQ_SHIELD,
 EV_REQ_BOW, EV_REQ_DAGGER, EV_REQ_MAGIC };
enum { EV_SWEEP, EV_DASH, EV_NOVA, EV_GUARD, EV_FAN, EV_PIERCE, EV_CHAIN,
 EV_RAIN, EV_THRUST, EV_BOLT, EV_METEOR, EV_SIPHON, EV_SMOKE, EV_STEP,
 EV_WARD, EV_VAULT, EV_RALLY, EV_GHOST, EV_STORM };
enum { EV_WILD, EV_TOWN, EV_RUIN, EV_SHRINE, EV_TRIAL, EV_LAIR, EV_DUNGEON, EV_INTERIOR };
enum { EV_PLAY, EV_TITLE, EV_HALL, EV_NEW, EV_MENU, EV_BAG_MENU, EV_ITEM_MENU,
 EV_EQUIP_MENU, EV_ATLAS_MENU, EV_SKILL_MENU, EV_MAP_MENU, EV_JOURNEY_MENU,
 EV_SHOP_MENU, EV_STASH_MENU, EV_STATS_MENU, EV_OPTIONS_MENU, EV_CONFIRM_MENU,
 EV_SERVICE_MENU, EV_BUYBACK_MENU, EV_CONTROLS_MENU };
enum { EV_NAME_BIOME, EV_NAME_WEAPON, EV_NAME_SKILL, EV_NAME_ITEM,
 EV_NAME_AFFIX, EV_NAME_ENEMY, EV_NAME_TERRITORY, EV_NAME_RARITY };

#ifdef EV_HOST
#pragma pack(push,1)
#endif
typedef struct {
 UINT16 level;
 UINT8 type, profile, rarity, enchant, affix, value, element;
} EvItem;
typedef struct { UINT8 area, floor, x, y, active; EvItem item; UINT16 gold; } EvDrop;
typedef struct { UINT8 area, floor; UINT16 hp[EV_ENEMIES]; } EvWounded;
typedef struct { UINT8 area, level, cleared[5], claimed; } EvDungeon;
typedef struct {
 UINT32 seed, gold, xp;
 UINT16 level, hp, mana, kills, stat_points, skill_points, attributes[4], rift_tier, rift_level;
 UINT8 area, floor, x, y, direction, starter, potions, potion_kills, selected_skill;
 UINT8 visited[32], cleared[256], area_level[256], claimed[32];
 UINT8 nodes[12], ranks[30], slots[5];
 UINT8 shop_epoch[16], refreshes[16]; UINT32 shop_bought[16];
 EvItem equipment[11], bag[EV_BAG], stash[EV_STASH], charms[4], buyback[6];
 EvDrop drops[EV_DROPS]; EvWounded wounded[8]; EvDungeon dungeons[16],rift;
 UINT8 sound, difficulty, dungeon_id, expedition, journey_flags;
 UINT8 return_area,return_floor,return_x,return_y,has_return,return_expedition,return_dungeon_id;
 UINT8 interior,house_x,house_y,return_interior;
} EvSave;
typedef struct {
 UINT16 max_hp, max_mana, damage, armor, spell, regen, life_on_hit;
 UINT8 speed, crit, block, resistance[4], cost_reduction, move_speed;
} EvStats;
typedef struct {
 UINT16 hp, max_hp, damage, level;
 UINT8 x,y,home_x,home_y,kind,rank,state,timer,direction,flash,burn,chill,stun;
 UINT8 alive,aim_x,aim_y,turns; UINT16 burn_damage; UINT16 seed;
} EvEnemy;
typedef struct {
 UINT16 damage, source_level, life_on_hit;
 INT8 dx,dy; UINT8 x,y,life,owner,element,pierce,chain,hit_mask,kind;
} EvProjectile;
typedef struct {
 UINT16 damage; UINT8 family,hands,element,cadence,reach;
} EvWeapon;
typedef struct {
 UINT16 cooldown;
 UINT8 requirement, execution, mana, multiplier, radius, element, tier;
} EvSkill;
typedef struct {
 EvSave save;
 EvStats stats;
 EvEnemy enemies[EV_ENEMIES];
 EvProjectile projectiles[EV_PROJECTILES];
 UINT8 map[320], palette[320];
 UINT32 rng;
 UINT16 tick, cooldowns[30], action_damage, action_life_on_hit, autosave, ward, ward_timer, field_timer, save_generation;
 UINT16 field_damage,field_life_on_hit,field_source_level;
 UINT8 blocked,repeat_ticks,nav_depth,nav[6][4],slot_status[8];
 UINT8 held,pressed,previous,mode,cursor,page,subpage,slot,service,item_index,item_source;
 UINT8 biome,place,town,tier,enemy_count,action,action_timer,action_element,action_kind;
 UINT8 action_range,action_hits,action_hand,action_direction,action_release,invulnerable,dodge,guard;
 UINT8 field_x,field_y,field_kind,field_pulses,field_element,field_range,field_skill,rally,ghost,menu_dirty;
 UINT8 message_timer,select_used,select_ticks,death_timer,potion_cooldown,portal_timer,dodge_cooldown,active_character;
 char message[21], scratch[21];
} EvGame;
#ifdef EV_HOST
#pragma pack(pop)
#endif
#ifdef EV_HOST
extern EvGame ev_host_game;
#define EG (&ev_host_game)
#else
/* Dedicated CGB WRAM bank 2. The native scene owns its loop, so GBVM's bank-1
 * data and IRQs are never accessed while this bank is selected. */
extern EvGame * __at(0xFF94) ev_game;
#define EG ev_game
#endif
#define ES (&EG->save)

/* Both SDCC and host builds must enforce the actual cartridge allocation. */
typedef char EvGameFitsWRAM[(sizeof(EvGame)<=4096)?1:-1];
typedef char EvSaveFitsRecord[(sizeof(EvSave)<=2718)?1:-1];

UINT16 ev_random(void *state) BANKED;
UINT16 ev_hash(UINT32 seed,UINT16 identity,UINT8 salt) BANKED;
void ev_name(UINT8 kind,UINT8 id,char *out) BANKED;
void ev_weapon(UINT8 profile,EvWeapon *out) BANKED;
void ev_skill(UINT8 id,EvSkill *out) BANKED;
void ev_new(UINT8 starter,UINT32 seed) BANKED;
void ev_reset_runtime(void) BANKED;
void ev_derive(void) BANKED;
void ev_item_generate(EvItem *item,UINT16 seed,UINT16 level,UINT8 kind,UINT8 rank) BANKED;
UINT16 ev_item_power(const EvItem *item) BANKED;
UINT16 ev_item_price(const EvItem *item) BANKED;
UINT8 ev_insert(EvItem *array,UINT8 count,const EvItem *item) BANKED;
UINT8 ev_equip(UINT8 index) BANKED;
UINT8 ev_equip_offhand(UINT8 index) BANKED;
UINT8 ev_debit(UINT32 value) BANKED;
void ev_credit(UINT32 value) BANKED;
void ev_xp(UINT16 amount,UINT16 source_level) BANKED;
UINT32 ev_xp_needed(UINT16 level) BANKED;
UINT8 ev_node_owned(UINT8 node) BANKED;
UINT8 ev_node_allocate(UINT8 node) BANKED;
UINT8 ev_skill_unlocked(UINT8 skill) BANKED;
UINT8 ev_skill_compatible(UINT8 skill) BANKED;
UINT8 ev_skill_hand(UINT8 skill) BANKED;
UINT8 ev_skill_rank(UINT8 skill) BANKED;
void ev_potion(void) BANKED;
UINT8 ev_respec(void) BANKED;
UINT8 ev_shop_item(UINT8 vendor,UINT8 index,EvItem *item) BANKED;
UINT8 ev_shop_buy(UINT8 vendor,UINT8 index) BANKED;
UINT8 ev_sell(UINT8 index) BANKED;
UINT32 ev_improve_price(UINT8 index,UINT8 operation) BANKED;
UINT32 ev_gamble_price(UINT8 category) BANKED;
UINT32 ev_refresh_price(void) BANKED;
UINT8 ev_improve(UINT8 index,UINT8 operation) BANKED;
UINT8 ev_gamble(UINT8 category) BANKED;

void ev_area_info(UINT8 area,UINT8 *biome,UINT8 *place,UINT8 *tier) BANKED;
void ev_generate_area(void) BANKED;
void ev_enter(UINT8 area,UINT8 floor,UINT8 x,UINT8 y) BANKED;
UINT8 ev_walkable(INT16 x,INT16 y) BANKED;
void ev_move(INT8 dx,INT8 dy,UINT8 speed) BANKED;
UINT8 ev_interact(void) BANKED;
void ev_update(UINT8 held) BANKED;
void ev_remember(void) BANKED;
void ev_spawn(void) BANKED;
void ev_combat_tick(void) BANKED;
UINT8 ev_action(UINT8 skill) BANKED;
void ev_dodge(void) BANKED;
void ev_damage_enemy(UINT8 index,UINT16 damage,UINT8 element) BANKED;
void ev_damage_player(UINT16 damage,UINT8 element,UINT16 source_level) BANKED;
void ev_pickups(void) BANKED;

void ev_art_load(void) BANKED;
void ev_palettes(void) BANKED;
void ev_draw_area(void) BANKED;
void ev_draw_actors(void) BANKED;
void ev_hud(void) BANKED;
void ev_screen_init(void) BANKED;
void ev_present(void) BANKED;
void ev_tile(UINT8 x,UINT8 y,UINT8 tile,UINT8 palette) BANKED;
void ev_text(UINT8 x,UINT8 y,const char *text,UINT8 palette) NONBANKED;
void ev_number(UINT8 x,UINT8 y,UINT32 value,UINT8 palette) BANKED;
void ev_clear(UINT8 palette) BANKED;
void ev_message(const char *message) NONBANKED;
void ev_menu_draw(void) BANKED;
void ev_menu_input(void) BANKED;
void ev_menu_open(UINT8 mode) BANKED;
void ev_menu_close(void) BANKED;
void ev_menu_back(void) BANKED;
UINT8 ev_save(UINT8 slot) BANKED;
UINT8 ev_load(UINT8 slot,UINT8 preview) BANKED;
UINT8 ev_slot_status(UINT8 slot) BANKED;
void ev_delete(UINT8 slot) BANKED;
void ev_sound(UINT8 sound) BANKED;
void ev_audio_tick(void) BANKED;
void evergrow_init(void) BANKED;
void evergrow_update(void) BANKED;
#endif
