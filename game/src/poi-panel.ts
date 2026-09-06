import type { DungeonEntrance } from './dungeon.ts';
import { BLESSINGS, blessingChoices, type EventSite, type EventChoice } from './poi-content.ts';
import { escapeUI, trapDialogFocus } from './ui-components.ts';
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
      else if(this.entrance) this.hooks.enter?.(this.entrance);
      else if (this.site)
        this.hooks.choose(this.site, (button.dataset.choice || null) as EventChoice | null);
    }, { signal: this.lifetime.signal });
  }
  openDungeon(entrance:DungeonEntrance) {
    this.entrance=entrance;this.element.innerHTML=`<section class="ui-window event-window" role="dialog" aria-modal="true" aria-label="Dungeon entrance"><header class="ui-window-header"><h2 class="ui-title">${escapeUI(entrance.name)}</h2><span class="ui-muted">Level ${entrance.level}</span><button class="ui-button ui-button--icon" data-close aria-label="Close">×</button></header><div class="ui-window-body event-choices"><p>The Hollow Warden · One floor</p><button class="ui-button" data-enter>Enter crypt</button></div></section>`;
    this.element.hidden=false;this.focus=trapDialogFocus(this.element,{signal:this.lifetime.signal});
  }
  open(site: EventSite) {
    this.site = site;
    const choices = site.kind === 'caravan' ? [{ id: 'goods', name: 'Recover goods', description: 'Two equipment items' }, { id: 'coin', name: 'Take coin', description: 'A larger gold cache' }]
      : site.kind === 'standingStones' ? blessingChoices(site).map(id => ({ id, ...BLESSINGS[id] }))
        : [{ id: '', name: 'Disturb the vigil', description: 'Defeat six guardians · equipment and XP' }];
    this.element.innerHTML = `<section class="ui-window event-window" role="dialog" aria-modal="true" aria-labelledby="event-title"><header class="ui-window-header"><h2 class="ui-title" id="event-title">${escapeUI(site.name)}</h2><span class="ui-muted">Level ${site.level}</span><button class="ui-button ui-button--icon" data-close aria-label="Close">×</button></header><div class="ui-window-body event-choices">${choices.map(c => `<button class="ui-button event-choice" data-choice="${c.id}"><strong>${c.name}</strong><span>${c.description}</span></button>`).join('')}</div></section>`;
    this.element.hidden = false;
    this.focus = trapDialogFocus(this.element, { signal: this.lifetime.signal });
  }
  close() { this.focus?.dispose(); this.focus = null; this.element.hidden = true; this.site = null; this.entrance = null; }
  dispose() { this.close(); this.lifetime.abort(); this.element.remove(); }
}
