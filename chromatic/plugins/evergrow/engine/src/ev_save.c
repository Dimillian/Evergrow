#pragma bank 255
#include "ev.h"

/* Official GB Studio cartridges declare 32KB SRAM. Eight packed primary
 * records occupy banks 0..2; bank 3 is the write-ahead recovery journal.
 * Before every write, the old valid checkpoint is journaled and committed.
 * A torn primary is recovered before that journal can be reused by another slot.
 * This provides eight full-capacity characters without lying in the ROM header.
 * It is write recovery, not eight independent historical backup copies. */
#ifdef EV_HOST
#pragma pack(push,1)
#endif
typedef struct {UINT32 magic;UINT16 generation,length,checksum;UINT8 version,slot;} EvHeader;
#ifdef EV_HOST
#pragma pack(pop)
#endif
#define EV_MAGIC 0x45564752UL
#define EV_RECORD_STRIDE 2730
#define EV_JOURNAL_BANK 3
#ifdef EV_HOST
extern UINT8 ev_host_sram[4][8192];
#define RAM_BASE(slot) ev_host_sram[slot]
#else
extern UINT8 * __at(0xFF96) ev_sram;
#define RAM_BASE(slot) ev_sram
#endif
static void ram_open(UINT8 slot){
#ifndef EV_HOST
 ENABLE_RAM;SWITCH_RAM(slot);
#else
 (void)slot;
#endif
}
static void ram_close(void){
#ifndef EV_HOST
 DISABLE_RAM;
#endif
}
/* Same CRC16-CCITT as version 1, two lookups per byte instead of eight
 * bit loops. Save validation must not stall menu navigation on an 8-bit CPU. */
static const UINT16 crc_nibbles[16]={0x0000,0x1021,0x2042,0x3063,0x4084,0x50A5,0x60C6,0x70E7,0x8108,0x9129,0xA14A,0xB16B,0xC18C,0xD1AD,0xE1CE,0xF1EF};
static UINT16 checksum(const UINT8 *data,UINT16 length){
 UINT16 crc=0xFFFF;UINT8 value;
 while(length--){value=*data++;crc=(crc<<4)^crc_nibbles[(crc>>12)^(value>>4)];crc=(crc<<4)^crc_nibbles[(crc>>12)^(value&15)];}
 return crc;
}
static UINT8 item_valid(const EvItem *item){
 return item->type==EV_EMPTY||(item->type<12&&item->level>0&&item->level<=999&&item->rarity<5&&item->enchant<=10&&item->affix<12&&item->value<=60&&item->element<5&&
  (item->type!=EV_WEAPON||item->profile<17)&&(item->type!=EV_SHIELD||item->profile<3)&&(item->type!=EV_FOCUS||item->profile<6));
}
static UINT8 valid(const EvSave *save){
 UINT8 i;if(save->level<1||save->level>999||save->gold>EV_GOLD_MAX||save->starter>5||save->potions>2||save->selected_skill>4||save->floor>5||save->x>159||save->y>119||save->direction>3||save->sound>1||save->interior>2||save->return_interior>2||save->rift_tier>195||save->rift_level>995||save->return_floor>5||save->expedition>1||save->return_expedition>1||save->hp>30000||save->mana>30000||save->dungeon_id!=EV_EMPTY&&save->dungeon_id>=16)return 0;
 for(i=0;i<11;i++)if(!item_valid(&save->equipment[i]))return 0;
 for(i=0;i<24;i++)if(!item_valid(&save->bag[i]))return 0;
 for(i=0;i<96;i++)if(!item_valid(&save->stash[i]))return 0;
 for(i=0;i<4;i++)if(!item_valid(&save->charms[i]))return 0;
 for(i=0;i<6;i++)if(!item_valid(&save->buyback[i]))return 0;
 for(i=0;i<30;i++)if(save->ranks[i]>20)return 0;
 for(i=0;i<5;i++)if(save->slots[i]!=EV_EMPTY&&save->slots[i]>=30)return 0;
 for(i=0;i<24;i++)if(save->drops[i].active&&(!item_valid(&save->drops[i].item)||save->drops[i].floor>5))return 0;
 return 1;
}
static UINT8 record_valid(const UINT8 *base,UINT8 slot){
 const EvHeader *header=(const EvHeader *)base;
 if(header->magic!=EV_MAGIC||header->version!=EV_VERSION||header->slot!=slot||header->length!=sizeof(EvSave))return 0;
 if(checksum(base+sizeof(EvHeader),sizeof(EvSave))!=header->checksum)return 0;
 return valid((const EvSave *)(base+sizeof(EvHeader)));
}
static UINT8 *primary(UINT8 slot){return RAM_BASE(slot/3)+(UINT16)(slot%3)*EV_RECORD_STRIDE;}
static void copy_record(UINT8 from_bank,UINT16 from_offset,UINT8 to_bank,UINT16 to_offset){
 UINT8 bytes[32],count;UINT16 at=sizeof(EvHeader),total=sizeof(EvSave)+sizeof(EvHeader);EvHeader header;
 ram_open(from_bank);memcpy(&header,RAM_BASE(from_bank)+from_offset,sizeof(EvHeader));
 ram_open(to_bank);((EvHeader*)(RAM_BASE(to_bank)+to_offset))->magic=0;
 while(at<total){count=total-at>32?32:total-at;
  ram_open(from_bank);memcpy(bytes,RAM_BASE(from_bank)+from_offset+at,count);
  ram_open(to_bank);memcpy(RAM_BASE(to_bank)+to_offset+at,bytes,count);at+=count;
 }
 {UINT32 magic=header.magic;header.magic=0;ram_open(to_bank);memcpy(RAM_BASE(to_bank)+to_offset,&header,sizeof(EvHeader));((EvHeader*)(RAM_BASE(to_bank)+to_offset))->magic=magic;}
}
static void recover_journal(void){
 EvHeader header;UINT8 slot,good;
 ram_open(EV_JOURNAL_BANK);memcpy(&header,RAM_BASE(3),sizeof(header));slot=header.slot;
 if(slot>=8||!record_valid(RAM_BASE(3),slot))return;
 ram_open(slot/3);good=record_valid(primary(slot),slot);
 if(!good)copy_record(3,0,slot/3,(UINT16)(slot%3)*EV_RECORD_STRIDE);
}
UINT8 ev_slot_status(UINT8 slot) BANKED {
 UINT8 status=0;EvHeader header;
 if(slot>=8)return 3;ram_open(slot/3);memcpy(&header,primary(slot),sizeof(header));
 if(header.magic==EV_MAGIC&&header.slot==slot){
  if(header.version!=EV_VERSION||header.length!=sizeof(EvSave))status=2;
  else status=record_valid(primary(slot),slot)?1:3;
 }
 if(status!=2&&status!=1){ram_open(3);memcpy(&header,RAM_BASE(3),sizeof(header));
  if(header.magic==EV_MAGIC&&header.slot==slot){
   if(header.version!=EV_VERSION||header.length!=sizeof(EvSave))status=2;
   else if(record_valid(RAM_BASE(3),slot))status=1;
  }
 }
 ram_close();return status;
}
UINT8 ev_load(UINT8 slot,UINT8 preview) BANKED {
 UINT8 *base,good;EvHeader header;
 if(slot>=8||ev_slot_status(slot)!=1)return 0;ram_open(slot/3);base=primary(slot);good=record_valid(base,slot);
 if(!good){ram_open(3);base=RAM_BASE(3);good=record_valid(base,slot);}
 if(!good){ram_close();return 0;}
 memcpy(&header,base,sizeof(header));
 if(!preview){memcpy(ES,base+sizeof(EvHeader),sizeof(EvSave));EG->save_generation=header.generation;
  /* Early v1 used area 255 as the empty marker, although it is a real area.
   * Empty/all-dead entries can be discarded: casualty bits own the deaths. */
  {UINT8 i,j;for(i=0;i<8;i++)if(ES->wounded[i].area==255&&ES->wounded[i].floor==0){
   for(j=0;j<6&&!ES->wounded[i].hp[j];j++);
   if(j==6)ES->wounded[i].floor=EV_EMPTY;
  }}
 }
 ram_close();return 1;
}
UINT8 ev_save(UINT8 slot) BANKED {
 UINT8 good;UINT8 *base;EvHeader header;UINT16 next=1;
 if(slot>=8||ev_slot_status(slot)==2||sizeof(EvSave)+sizeof(EvHeader)>EV_RECORD_STRIDE||!valid(ES))return 0;
 ram_open(3);memcpy(&header,RAM_BASE(3),sizeof(header));
 if(header.magic==EV_MAGIC&&header.slot<8&&(header.version!=EV_VERSION||header.length!=sizeof(EvSave))){ram_close();return 0;}
 recover_journal();ram_open(slot/3);base=primary(slot);good=record_valid(base,slot);
 if(good){next=((EvHeader *)base)->generation+1;
  copy_record(slot/3,(UINT16)(slot%3)*EV_RECORD_STRIDE,3,0);
 }else{
  /* A first save is staged in the journal before creating its primary. */
  ram_open(3);base=RAM_BASE(3);((EvHeader*)base)->magic=0;
  header.magic=0;header.generation=next;header.length=sizeof(EvSave);header.version=EV_VERSION;header.slot=slot;header.checksum=checksum((const UINT8*)ES,sizeof(EvSave));
  memcpy(base+sizeof(EvHeader),ES,sizeof(EvSave));memcpy(base,&header,sizeof(header));((EvHeader*)base)->magic=EV_MAGIC;
 }
 ram_open(slot/3);base=primary(slot);((EvHeader *)base)->magic=0;
 memcpy(base+sizeof(EvHeader),ES,sizeof(EvSave));
 header.magic=0;header.generation=next;header.length=sizeof(EvSave);header.version=EV_VERSION;header.slot=slot;
 header.checksum=checksum((const UINT8 *)ES,sizeof(EvSave));memcpy(base,&header,sizeof(EvHeader));
 if(checksum(base+sizeof(EvHeader),sizeof(EvSave))!=header.checksum){ram_close();return 0;}
 /* The only commit marker is written after payload and CRC readback. */
 ((EvHeader*)base)->magic=EV_MAGIC;EG->save_generation=next;ram_close();return 1;
}
void ev_delete(UINT8 slot) BANKED {
 if(slot>=8)return;ram_open(slot/3);((EvHeader*)primary(slot))->magic=0;
 ram_open(3);if(((EvHeader*)RAM_BASE(3))->slot==slot)((EvHeader*)RAM_BASE(3))->magic=0;ram_close();
}
