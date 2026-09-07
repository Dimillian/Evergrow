import { InventoryPanel } from './inventory-panel.ts';
import { initialPlayer } from './simulation.ts';
import { executeCharacterCommand } from './character-commands.ts';
import { refreshCharacter } from './character.ts';
import { generateItem } from './items.ts';
import { uiIcon } from './ui-components.ts';
import type { CharacterSheet } from './character-types.ts';
import type { ItemKind } from './character-types.ts';
import type { drawCharacterPortrait } from './character-portrait.ts';

/** Actual inventory panel with a memory-only player and the proposed editor entry point. */
export class AppearanceInventoryReview {
  readonly panel:InventoryPanel;
  private readonly player=initialPlayer(0,0);
  private readonly abort=new AbortController();
  private seeded=false;
  get character(){return this.player.character;}
  constructor(mount:HTMLElement, draw:typeof drawCharacterPortrait, onEdit:(tab:'character'|'armor')=>void, onClose:()=>void) {
    const apply=(command:Parameters<typeof executeCharacterCommand>[1])=>{executeCharacterCommand(this.player,command);this.panel.refresh(this.player);};
    this.panel=new InventoryPanel(mount,{
      close:onClose, equip:(index,slot)=>apply({type:'equip',index,slot}),unequip:(slot,index)=>apply({type:'unequip',slot,index}),
      move:(from,to)=>apply({type:'moveItem',from,to}),equipBest:choice=>apply({type:'equipBest',choice}),sort:mode=>apply({type:'sortInventory',mode}),allocate:attribute=>apply({type:'allocateAttribute',attribute}),
    },draw);
    const tools=document.createElement('div');tools.className='appearance-inventory-tools';
    tools.innerHTML=`<button type="button" class="ui-button ui-button--quiet ui-button--icon" aria-label="Edit appearance" aria-expanded="false" aria-controls="appearance-inventory-menu">${uiIcon('character')}</button><div id="appearance-inventory-menu" class="appearance-inventory-menu" hidden><button type="button" data-edit="character">Edit character</button><button type="button" data-edit="armor">Edit armor</button></div>`;
    this.panel.element.querySelector('.character-doll-stage')!.append(tools);
    const toggle=tools.querySelector<HTMLButtonElement>('button')!, menu=tools.querySelector<HTMLElement>('.appearance-inventory-menu')!;
    const close=()=>{menu.hidden=true;toggle.setAttribute('aria-expanded','false');};
    toggle.addEventListener('click',()=>{menu.hidden=!menu.hidden;toggle.setAttribute('aria-expanded',String(!menu.hidden));if(!menu.hidden)menu.querySelector<HTMLButtonElement>('button')!.focus();},{signal:this.abort.signal});
    menu.addEventListener('click',event=>{const value=(event.target as HTMLElement).dataset.edit;if(value==='character'||value==='armor'){close();this.panel.close();onEdit(value);}},{signal:this.abort.signal});
    tools.addEventListener('keydown',event=>{if(event.key==='Escape'&&!menu.hidden){event.preventDefault();event.stopPropagation();close();toggle.focus();}},{signal:this.abort.signal});
    document.addEventListener('pointerdown',event=>{if(!tools.contains(event.target as Node))close();},{signal:this.abort.signal});
  }
  open(sheet:CharacterSheet) {
    this.player.character=structuredClone(sheet);
    // A few real generated bag items make the inventory context recognizable.
    if(!this.seeded) for(let i=0;i<12;i++)this.player.character.inventory[i]=generateItem(8310+i*13,1,['head','chest','gloves','legs','boots','cloak'][i%6] as ItemKind,undefined,i%3===0?'rare':'common');
    this.seeded=true;
    refreshCharacter(this.player);this.panel.open(this.player);
  }
  dispose(){this.abort.abort();this.panel.dispose();}
}
