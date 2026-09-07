import { InventoryPanel } from './inventory-panel.ts';
import { initialPlayer } from './simulation.ts';
import { executeCharacterCommand } from './character-commands.ts';
import { refreshCharacter } from './character.ts';
import { generateItem } from './items.ts';
import type { CharacterSheet } from './character-types.ts';
import type { ItemKind } from './character-types.ts';

/** Actual inventory panel with a memory-only player and the proposed editor entry point. */
export class AppearanceInventoryReview {
  readonly panel:InventoryPanel;
  private readonly player=initialPlayer(0,0);
  private seeded=false;
  get character(){return this.player.character;}
  constructor(mount:HTMLElement, onEdit:()=>void, onClose:()=>void) {
    const apply=(command:Parameters<typeof executeCharacterCommand>[1])=>{executeCharacterCommand(this.player,command);this.panel.refresh(this.player);};
    this.panel=new InventoryPanel(mount,{
      close:onClose, editAppearance:onEdit, equip:(index,slot)=>apply({type:'equip',index,slot}),unequip:(slot,index)=>apply({type:'unequip',slot,index}),
      move:(from,to)=>apply({type:'moveItem',from,to}),equipBest:choice=>apply({type:'equipBest',choice}),sort:mode=>apply({type:'sortInventory',mode}),allocate:attribute=>apply({type:'allocateAttribute',attribute}),
    });

  }
  open(sheet:CharacterSheet) {
    this.player.character=structuredClone(sheet);
    // A few real generated bag items make the inventory context recognizable.
    if(!this.seeded) for(let i=0;i<12;i++)this.player.character.inventory[i]=generateItem(8310+i*13,1,['head','chest','gloves','legs','boots','cloak'][i%6] as ItemKind,undefined,i%3===0?'rare':'common');
    this.seeded=true;
    refreshCharacter(this.player);this.panel.open(this.player);
  }
  dispose(){this.panel.dispose();}
}
