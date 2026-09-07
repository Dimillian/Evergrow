import './character-editor-review.css';
import {loadGameFont} from './font.ts';
import {createAppearanceEditor} from './character-editor.ts';
import {createCharacterSheet} from './items.ts';
import {AppearanceInventoryReview} from './appearance-inventory-review.ts';
import {GamepadInput, PAD, type PadSnapshot} from './gamepad-input.ts';
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
// Only the focused study iframe owns controller input; sibling phone views stay idle.
const pad=new GamepadInput();let padFrame=0;
function pollPad(now:number){
  let pads:(PadSnapshot|null)[]=[];
  try{pads=navigator.getGamepads?[...navigator.getGamepads()]:[];}catch{/* Browser may deny gamepad access. */}
  pad.poll(pads,document.hasFocus()&&!document.hidden);
  if(editor){if(pad.pressed.has(PAD.dodge)||pad.pressed.has(PAD.pause)){editor.cancel();pad.clear();}else editor.updateGamepad(pad,now);}
  else if(pad.pressed.has(PAD.dodge)||pad.pressed.has(PAD.pause)){if(!inventory.panel.dismissPopup())closeInventory();pad.clear();}
  else inventory.panel.updateGamepad(pad,now);
  padFrame=requestAnimationFrame(pollPad);
}
padFrame=requestAnimationFrame(pollPad);
if(import.meta.hot)import.meta.hot.dispose(()=>{cancelAnimationFrame(padFrame);mobile.removeEventListener('change',updateTouch);editor?.dispose();inventory.dispose();});
