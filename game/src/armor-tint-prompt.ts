import { ARMOR_TINTS } from './appearance-armor-content.ts';
import { GamepadMenu } from './gamepad-menu.ts';
import { PAD, type GamepadInput } from './gamepad-input.ts';
import { escapeUI } from './ui-components.ts';

/** Gesture and confirmation ownership for every armor tint swatch in one editor draft. */
export function bindArmorTintPrompt(root:HTMLElement, available:()=>boolean, apply:(tint:string)=>void) {
  const abort=new AbortController(),signal=abort.signal,menu=new GamepadMenu();
  const shell=root.querySelector<HTMLElement>('.editor-shell')!;
  const overlay=document.createElement('div');overlay.className='armor-tint-overlay';overlay.hidden=true;
  overlay.innerHTML='<section class="armor-tint-dialog ui-window" role="alertdialog" aria-modal="true" aria-labelledby="all-tint-title" aria-describedby="all-tint-message"><h2 id="all-tint-title">Apply color to all parts?</h2><p id="all-tint-message"></p><div class="armor-tint-dialog-actions"><button type="button" class="ui-button ui-button--quiet" data-tint-cancel>Cancel</button><button type="button" class="ui-button ui-button--primary" data-tint-apply>Apply to all</button></div></section>';
  root.append(overlay);
  let source:HTMLButtonElement|null=null,tint:string|null=null,suppressClick=false;
  let pointer:{id:number;x:number;y:number;button:HTMLButtonElement;timer:ReturnType<typeof setTimeout>}|null=null;
  let held:{button:HTMLButtonElement;since:number}|null=null;
  const swatch=(target:EventTarget|null)=>target instanceof Element?target.closest<HTMLButtonElement>('button[data-tint]'):null;
  function clearPointer(){if(pointer)clearTimeout(pointer.timer);pointer=null;}
  function clearHold(){clearPointer();held=null;}
  function request(button:HTMLButtonElement){
    const color=ARMOR_TINTS.find(c=>c.id===button.dataset.tint);
    if(!available()||tint||!color||button.disabled||button.closest('[hidden], [inert]'))return;
    clearHold();source=button;tint=color.id;shell.inert=true;overlay.hidden=false;menu.clear();
    overlay.querySelector('#all-tint-message')!.innerHTML=`Use <strong>${escapeUI(color.name)}</strong> on every armor part?`;
    overlay.querySelector<HTMLButtonElement>('[data-tint-cancel]')!.focus();
  }
  function cancel(){
    clearHold();
    if(!tint)return false;
    tint=null;overlay.hidden=true;shell.inert=false;menu.clear();source?.focus({preventScroll:true});source=null;return true;
  }
  overlay.querySelector('[data-tint-cancel]')!.addEventListener('click',event=>{event.stopPropagation();cancel();},{signal});
  overlay.querySelector('[data-tint-apply]')!.addEventListener('click',event=>{
    event.stopPropagation();const selected=tint;if(selected&&available()){cancel();apply(selected);}
  },{signal});
  root.addEventListener('dblclick',event=>{const button=swatch(event.target);if(button){event.preventDefault();request(button);}},{signal});
  root.addEventListener('pointerdown',event=>{
    suppressClick=false;clearPointer();
    const button=swatch(event.target);
    if(!button||!event.isPrimary||event.button!==0||!available()||tint)return;
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY,button,timer:setTimeout(()=>{
      if(!pointer)return;
      const target=pointer.button;clearPointer();suppressClick=true;request(target);
    },650)};
  },{signal});
  root.addEventListener('pointermove',event=>{if(pointer?.id===event.pointerId&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>10)clearPointer();},{signal});
  for(const type of ['pointerup','pointercancel'])window.addEventListener(type,clearPointer,{signal});
  root.addEventListener('scroll',clearPointer,{capture:true,signal});
  // A held touch must be released before it can activate a newly opened dialog button.
  root.addEventListener('click',event=>{if(suppressClick&&event.detail>0){event.preventDefault();event.stopImmediatePropagation();}},{capture:true,signal});
  root.addEventListener('contextmenu',event=>{if(swatch(event.target))event.preventDefault();},{signal});
  window.addEventListener('blur',clearHold,{signal});
  document.addEventListener('visibilitychange',clearHold,{signal});
  return {
    cancel,
    updateGamepad(pad:GamepadInput,now:number){
      if(!available()||document.hidden){clearHold();return;}
      if(!pad.active){held=null;menu.clear();return;}
      menu.update(tint?overlay:root,pad,now,{activate:target=>{
        const button=swatch(target);
        if(button&&!tint)held={button,since:now};
        return false;
      }});
      if(held){
        if(!pad.held.has(PAD.interact)||document.activeElement!==held.button||tint)held=null;
        else if(now-held.since>=650)request(held.button);
      }
    },
    dispose(){clearHold();abort.abort();shell.inert=false;overlay.remove();},
  };
}
