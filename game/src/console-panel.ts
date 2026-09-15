import './console-panel.css';
import { escapeUI, trapDialogFocus } from './ui-components.ts';
import type { ActionResult } from './character-types.ts';
import { consoleSuggestions, parseConsoleCommand, CONSOLE_LIMITS, type ConsoleSuggestion } from './console-content.ts';
export { executeConsoleCommand } from './console-command.ts';
export interface ConsolePanelActions {close():void;execute(raw:string):Promise<ActionResult>}
/** Shared with the disposable proposal. The owner supplies execution and phase changes. */
export class ConsolePanel {
  readonly element=document.createElement('section');
  private readonly input:HTMLInputElement;
  private readonly list:HTMLElement;
  private readonly result:HTMLElement;
  private readonly closeButton:HTMLButtonElement;
  private abort=new AbortController();
  private focus?:ReturnType<typeof trapDialogFocus>;
  private options:ConsoleSuggestion[]=[];
  private selected=0;
  private history:string[]=[];
  private historyIndex=0;
  private draft='';
  private busy=false;
  private disposed=false;
  private readonly actions:ConsolePanelActions;
  constructor(mount:HTMLElement, actions:ConsolePanelActions) {
    this.actions=actions;
    const el=this.element;el.className='command-overlay';el.hidden=true;
    el.innerHTML=`<section class="command-window ui-window" role="dialog" aria-modal="true" aria-label="Local command console">
      <header class="command-heading"><span class="command-title"><span class="command-sigil">⌘</span> Command</span><span class="command-local"><i></i> LOCAL ONLY</span></header>
      <div class="command-well"><span class="command-prompt" aria-hidden="true">&gt;</span><input type="text" role="combobox" aria-label="Command" aria-autocomplete="list" aria-controls="command-suggestions" aria-expanded="false" autocomplete="off" spellcheck="false" placeholder="Enter a command…" maxlength="${CONSOLE_LIMITS.text}"><button class="command-close" aria-label="Close console">ESC</button></div>
      <div class="command-suggestions-heading"><span data-label>SUGGESTED COMMANDS</span><span data-count></span></div>
      <div id="command-suggestions" class="command-suggestions" role="listbox" aria-label="Command suggestions"></div>
      <p class="command-result" role="status" hidden></p>
      <footer class="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navigate <kbd>Tab</kbd> complete</span><span><kbd>↵</kbd> run</span></footer>
    </section>`;
    mount.append(el);
    this.input=el.querySelector('input')!;this.list=el.querySelector('.command-suggestions')!;this.result=el.querySelector('.command-result')!;this.closeButton=el.querySelector('button')!;
    const signal=this.abort.signal;
    this.closeButton.addEventListener('click',()=>{if(!this.busy)actions.close();},{signal});
    this.input.addEventListener('input',()=>{this.selected=0;this.result.hidden=true;this.historyIndex=this.history.length;this.draft=this.input.value;this.render();},{signal});
    this.list.addEventListener('mousedown',e=>e.preventDefault(),{signal});
    this.list.addEventListener('click',e=>{const row=(e.target as HTMLElement).closest<HTMLElement>('[data-index]');if(row&&!this.busy){this.selected=Number(row.dataset.index);this.complete();}},{signal});
    this.input.addEventListener('keydown',e=>this.key(e),{signal});
    el.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(!this.busy)actions.close();}},{signal});
  }
  open(){if(this.disposed)return;this.element.hidden=false;this.render();this.focus?.dispose();this.focus=trapDialogFocus(this.element,{initialFocus:this.input,restoreFocus:false});}
  close(){this.focus?.dispose();this.focus=undefined;this.element.hidden=true;}
  setDraft(value:string){if(this.busy)return;this.input.value=value.slice(0,CONSOLE_LIMITS.text);this.selected=0;this.result.hidden=true;this.render();this.input.focus();this.input.setSelectionRange(this.input.value.length,this.input.value.length);}
  private render(){
    this.options=consoleSuggestions(this.input.value).slice(0,40);this.selected=Math.min(this.selected,Math.max(0,this.options.length-1));
    this.input.setAttribute('aria-expanded',String(this.options.length>0));
    if(this.options.length)this.input.setAttribute('aria-activedescendant',`command-option-${this.selected}`);else this.input.removeAttribute('aria-activedescendant');
    this.element.querySelector('[data-label]')!.textContent=this.input.value.includes(' ')?'COMPLETE YOUR COMMAND':'SUGGESTED COMMANDS';
    this.element.querySelector('[data-count]')!.textContent=this.options.length?`${this.options.length} available`:'';
    let empty='No matching suggestions. Type help for commands.';
    try{parseConsoleCommand(this.input.value);empty='Press Enter to run this command.';}catch{/* Incomplete input remains editable. */}
    this.list.innerHTML=this.options.length?this.options.map((s,i)=>`<div id="command-option-${i}" class="command-suggestion" role="option" aria-selected="${i===this.selected}" data-index="${i}"><span class="command-mark">${s.mark}</span><span class="command-copy"><strong>${escapeUI(s.label)}</strong><small>${escapeUI(s.detail)}</small></span><span class="command-complete-key">Tab ↹</span></div>`).join(''):`<div class="command-empty">${empty}</div>`;
    this.list.querySelector('[aria-selected="true"]')?.scrollIntoView({block:'nearest'});
  }
  private complete(){if(this.options[this.selected])this.setDraft(this.options[this.selected].value);}
  private key(e:KeyboardEvent){
    if(e.isComposing||this.busy)return;
    if(e.key==='Tab'&&!e.shiftKey&&this.options.length){e.preventDefault();this.complete();}
    else if(e.key==='ArrowDown'||e.key==='ArrowUp'){
      e.preventDefault();const step=e.key==='ArrowDown'?1:-1;
      if((e.altKey||!this.input.value||!this.options.length)&&this.history.length){
        if(this.historyIndex===this.history.length)this.draft=this.input.value;
        this.historyIndex=Math.max(0,Math.min(this.history.length,this.historyIndex+step));
        this.setDraft(this.history[this.historyIndex]??this.draft);
      } else if(this.options.length) {this.selected=(this.selected+step+this.options.length)%this.options.length;this.render();}
    } else if(e.key==='Enter'&&!e.repeat){e.preventDefault();void this.submit();}
  }
  private async submit(){
    if(this.busy||!this.input.value.trim())return;
    const raw=this.input.value.trim();
    try{parseConsoleCommand(raw);}catch(error){this.result.hidden=false;this.result.dataset.ok='false';this.result.textContent=(error as Error).message;return;}
    this.busy=true;this.input.readOnly=true;this.closeButton.disabled=true;this.element.setAttribute('aria-busy','true');
    this.result.hidden=false;this.result.dataset.ok='true';this.result.textContent='Applying command…';
    try{
      const response=await this.actions.execute(raw);
      if(this.disposed)return;
      this.result.dataset.ok=String(response.ok);this.result.textContent=response.message??(response.ok?'Done.':'Could not complete this command.');
      if(response.ok){if(this.history.at(-1)!==raw)this.history.push(raw);this.history=this.history.slice(-CONSOLE_LIMITS.history);this.historyIndex=this.history.length;}
    }catch{if(!this.disposed){this.result.dataset.ok='false';this.result.textContent='Could not complete this command.';}}
    finally{this.busy=false;this.input.readOnly=false;this.closeButton.disabled=false;this.element.removeAttribute('aria-busy');if(!this.disposed&&!this.element.hidden)this.input.focus();}
  }
  dispose(){if(this.disposed)return;this.disposed=true;this.close();this.abort.abort();this.element.remove();}
}
