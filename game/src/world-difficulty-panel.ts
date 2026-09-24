import type { ActionResult } from './character-types.ts';
import { WORLD_DIFFICULTIES, worldDifficulty, type WorldDifficulty } from './world-difficulty.ts';
import { difficultyBadgeSVG } from './world-difficulty-art.ts';
import './world-difficulty-panel.css';

export interface DifficultyActions {
  difficulty?(): WorldDifficulty;
  difficultyProblem?(): string | null;
  setDifficulty?(id: WorldDifficulty): Promise<ActionResult>;
}
const bonus = (n:number) => n === 1 ? '—' : `+${Math.round((n-1)*100)}%`;
export function difficultyMarkup(current: WorldDifficulty = 'normal'): string {
  return `<div class="difficulty-intro"><p class="ui-kicker">Choose your challenge</p><p>A fiercer world. Richer spoils.</p></div>
    <div class="difficulty-tiers" role="group" aria-label="World difficulty">${WORLD_DIFFICULTIES.map(d=>`<button type="button" class="difficulty-tier" data-difficulty="${d.id}" style="--difficulty-color:${d.color}" aria-pressed="${current===d.id}">
      <span class="difficulty-current">${current===d.id?'Current world':' '}</span>${difficultyBadgeSVG(d.id)}<strong>${d.name}</strong><span class="difficulty-subtitle">${d.subtitle}</span>
      <span class="difficulty-rule"></span><span class="difficulty-metric"><span>Monster life</span><b>×${d.health}</b></span><span class="difficulty-metric"><span>Monster damage</span><b>×${d.damage}</b></span>
      <span class="difficulty-rewards"><span class="difficulty-metric"><span>Experience</span><b>${bonus(d.experience)}</b></span><span class="difficulty-metric"><span>Gold</span><b>${bonus(d.gold)}</b></span><span class="difficulty-metric"><span>Epic+ loot weight</span><b>${bonus(d.quality)}</b></span></span>
    </button>`).join('')}</div>
    <p class="difficulty-note">Applies to the wilderness, dungeons and rifts. Monster levels stay the same. Loot bonuses improve rarity odds, not item quantity; Legendary and Unique keep equal weights. Existing encounters retain their lowest reward tier.</p>
    <div class="difficulty-commit"><span data-difficulty-status role="status" aria-live="polite">Choose a tier. Change it safely in town.</span><button type="button" class="ui-button" data-difficulty-apply disabled>Current difficulty</button></div>`;
}
/** A view over the durable runtime command. Previews provide disposable actions. */
export class DifficultyPanel {
  busy = false;
  private selected: WorldDifficulty;
  private root: HTMLElement;
  private actions: DifficultyActions;
  constructor(root: HTMLElement, actions: DifficultyActions, signal: AbortSignal) {
    this.root=root;this.actions=actions;
    this.selected=actions.difficulty?.()??'normal';
    root.innerHTML=difficultyMarkup(this.selected);
    for(const button of root.querySelectorAll<HTMLButtonElement>('[data-difficulty]'))
      button.addEventListener('click',()=>{ if(!this.busy){this.selected=button.dataset.difficulty as WorldDifficulty;this.refresh();} },{signal});
    root.querySelector('[data-difficulty-apply]')!.addEventListener('click',async()=>{
      if(this.busy||!actions.setDifficulty||actions.difficultyProblem?.())return;
      this.busy=true;this.refresh('Saving difficulty…');
      let result:ActionResult;
      try{result=await actions.setDifficulty(this.selected);}catch{result={ok:false,message:'Could not save difficulty. Please try again.'};}
      this.busy=false;if(!signal.aborted)this.refresh(result.message);
    },{signal});
    this.refresh();
  }
  private refresh(message?:string):void {
    const current=this.actions.difficulty?.()??'normal',problem=this.actions.difficultyProblem?.();
    for(const button of this.root.querySelectorAll<HTMLButtonElement>('[data-difficulty]')){
      button.disabled=this.busy;button.setAttribute('aria-pressed',String(button.dataset.difficulty===this.selected));
      button.querySelector('.difficulty-current')!.textContent=button.dataset.difficulty===current?'Current world':' ';
    }
    const apply=this.root.querySelector<HTMLButtonElement>('[data-difficulty-apply]')!;
    apply.disabled=this.busy||!!problem||!this.actions.setDifficulty||this.selected===current;
    apply.textContent=this.busy?'Saving…':this.selected===current?'Current difficulty':`Enter ${worldDifficulty(this.selected).name}`;
    this.root.querySelector('[data-difficulty-status]')!.textContent=message??problem??'Choose a tier. Change it safely in town.';
  }
}
