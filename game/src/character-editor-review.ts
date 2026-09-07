import './character-editor-review.css';
import {loadGameFont} from './font.ts';
import {createAppearanceEditor} from './character-editor.ts';
import {createCharacterSheet} from './items.ts';
import {AppearanceInventoryReview} from './appearance-inventory-review.ts';
if(!import.meta.env.DEV)throw new Error('Local appearance study only.');
await loadGameFont();
const root=document.querySelector<HTMLElement>('#editor')!,params=new URLSearchParams(location.search);
let sheet=createCharacterSheet('sword-shield'),editor:ReturnType<typeof createAppearanceEditor>|undefined;
sheet.look.appearance={...sheet.look.appearance,hair:'braid',hairColor:'copper',skin:'sand'};
const inventory=new AppearanceInventoryReview(root,()=>{closeInventory();},()=>{closeInventory();});
function showEditor(){editor=createAppearanceEditor(root,{sheet,name:'Rowan',study:!params.has('runtime'),view:params.get('view')??undefined,
  onCancel:()=>{editor?.dispose();showEditor();},onSave:async look=>{sheet.look=structuredClone(look);return {ok:true};},
  onInventory:()=>{sheet=structuredClone(editor!.getSheet());sheet.look=editor!.getLook();editor!.dispose();editor=undefined;inventory.open(sheet);},
});}
function closeInventory(){sheet=structuredClone(inventory.character);inventory.panel.close();showEditor();}
const mobile=matchMedia('(max-width:700px)');
const updateTouch=()=>document.documentElement.classList.toggle('touch-mode',mobile.matches);
updateTouch();mobile.addEventListener('change',updateTouch);
if(params.get('view')==='inventory')inventory.open(sheet);else showEditor();
if(import.meta.hot)import.meta.hot.dispose(()=>{mobile.removeEventListener('change',updateTouch);editor?.dispose();inventory.dispose();});
