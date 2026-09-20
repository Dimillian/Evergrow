import type { DungeonEntrance } from './dungeon.ts';
import type { EventSite, EventChoice } from './poi-content.ts';
import { trapDialogFocus } from './ui-components.ts';
import { dungeonChoicePresentation, eventChoiceMarkup, eventChoicePresentation } from './event-choice-presentation.ts';
import './poi-panel.css';
export class EventPanel {
  readonly element: HTMLElement;
  private lifetime = new AbortController();
  private focus: {
    dispose(): void;
  } | null = null;
  private entrance: DungeonEntrance | null = null;
  private site: EventSite | null = null;
  private hooks: {
    enter?(entrance:DungeonEntrance):void;
    close(): void;
    choose(site: EventSite, choice: EventChoice | null): void;
  };
  constructor(mount: HTMLElement, hooks: {
    enter?(entrance:DungeonEntrance):void;
    close(): void;
    choose(site: EventSite, choice: EventChoice | null): void;
  }) {
    this.hooks = hooks;
    this.element = document.createElement('section');
    this.element.className = 'event-panel';
    this.element.hidden = true;
    mount.append(this.element);
    this.element.addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
      if (!button)
        return;
      if (button.dataset.close !== undefined)
        this.hooks.close();
      else if(this.entrance && button.hasAttribute('data-enter')) this.hooks.enter?.(this.entrance);
      else if (this.site && button.hasAttribute('data-choice'))
        this.hooks.choose(this.site, (button.dataset.choice || null) as EventChoice | null);
    }, { signal: this.lifetime.signal });
  }
  openDungeon(entrance:DungeonEntrance) {
    this.close();
    this.entrance=entrance;this.element.innerHTML=eventChoiceMarkup(dungeonChoicePresentation(entrance), true);
    this.element.hidden=false;this.focus=trapDialogFocus(this.element,{signal:this.lifetime.signal});
  }
  open(site: EventSite) {
    this.close();
    this.site = site;
    this.element.innerHTML = eventChoiceMarkup(eventChoicePresentation(site));
    this.element.hidden = false;
    this.focus = trapDialogFocus(this.element, { signal: this.lifetime.signal });
  }
  close() { this.focus?.dispose(); this.focus = null; this.element.hidden = true; this.site = null; this.entrance = null; }
  dispose() { this.close(); this.lifetime.abort(); this.element.remove(); }
}
