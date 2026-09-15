import { MAP_LEGEND_GROUPS, type MapIconId, type MapServiceKind, MapIconVisibility } from './map-legend-content.ts';
import { drawMapPOIIcon, drawMapPlayerIcon, drawMapEnemyIcon } from './map-icon-art.ts';
import { drawDungeonMapIcon, type DungeonMapIcon } from './dungeon-map-icon-art.ts';
import { drawMapSymbol } from './map-symbol-art.ts';
import { POI_DEFINITIONS, type POIKind } from './world-pois.ts';
import { escapeUI, uiIcon } from './ui-components.ts';

/** Shared native controls. No NPC list, simulation, save storage, or procedural location queries. */
export class MapLegend {
  readonly element: HTMLElement;
  readonly toggle: HTMLButtonElement;
  private abort = new AbortController();
  private unsubscribe: () => void;
  private groups;
  private visibility: MapIconVisibility;
  private onLayout: () => void;
  private changedByUser = false;
  private media = window.matchMedia('(max-width: 900px), (max-height: 560px)');
  constructor(visibility: MapIconVisibility, owner: HTMLElement, header: HTMLElement, context: 'world' | 'dungeon',
    onLayout: () => void, ping?: (kind: MapServiceKind) => void) {
    this.visibility = visibility; this.onLayout = onLayout;
    this.groups = MAP_LEGEND_GROUPS.filter(g => context === 'world' || ['navigation', 'dungeons', 'enemies'].includes(g.id));
    this.element = document.createElement('aside'); this.element.className = 'map-legend';
    this.element.id = `map-legend-${context}`; this.element.setAttribute('aria-label', 'Map legend');
    this.toggle = document.createElement('button'); this.toggle.type = 'button'; this.toggle.className = 'ui-button ui-button--quiet map-legend-toggle';
    this.toggle.innerHTML = `${uiIcon('journal')}<span>Legend</span>`; this.toggle.setAttribute('aria-controls', this.element.id);
    header.insertBefore(this.toggle, header.querySelector('.world-map-close, [data-close]')); 
    this.element.innerHTML = `<div class="map-legend-heading"><div><h3 class="ui-title">Legend</h3><p class="ui-muted">Map icons & locations</p></div></div>
      <label class="map-legend-all"><span>Show all icons</span><input type="checkbox" data-all aria-label="Show all map icons"></label>
      <div class="map-legend-scroll">${this.groups.map(g => `<section><div class="map-legend-category"><button type="button" aria-expanded="${g.id === (context === 'world' ? 'services' : 'dungeons')}" aria-controls="${this.element.id}-${g.id}">${uiIcon('chevron')}<span>${escapeUI(g.label)}</span><span class="map-legend-count">${g.entries.length}</span></button><input type="checkbox" data-category="${g.id}" aria-label="Show all ${escapeUI(g.label)} icons"></div><div id="${this.element.id}-${g.id}" ${g.id === (context === 'world' ? 'services' : 'dungeons') ? '' : 'hidden'}>${g.entries.map(e => `<div class="map-legend-row" data-entry="${e.id}"><canvas aria-hidden="true" data-icon="${e.id}"></canvas><label><span>${escapeUI(e.label)}</span><small>${escapeUI(e.description)}</small><input type="checkbox" data-visible="${e.id}" aria-label="Show ${escapeUI(e.label)} icons"></label>${e.service && ping ? `<button type="button" class="map-legend-ping ui-button ui-button--quiet" data-ping="${e.service}" aria-label="Ping nearest ${escapeUI(e.label)}">${uiIcon('center')}<span>Ping nearest</span></button>` : ''}</div>`).join('')}</div></section>`).join('')}</div>
      <p class="map-legend-note" role="status" aria-live="polite">${context === 'world' ? 'Pings use discovered locations nearest to you.' : 'Only explored rooms reveal their icons.'}</p>`;
    owner.append(this.element);
    this.toggle.addEventListener('click', () => this.setOpen(this.element.hidden), { signal: this.abort.signal });
    this.element.addEventListener('click', event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button'); if (!button) return;
      if (button.dataset.ping) ping?.(button.dataset.ping as MapServiceKind);
      else if (button.hasAttribute('aria-expanded')) {
        const expanded = button.getAttribute('aria-expanded') !== 'true'; button.setAttribute('aria-expanded', String(expanded));
        this.element.querySelector<HTMLElement>(`#${button.getAttribute('aria-controls')}`)!.hidden = !expanded;
      }
    }, { signal: this.abort.signal });
    this.element.addEventListener('change', event => {
      const input = event.target as HTMLInputElement;
      const entries = input.dataset.visible ? [input.dataset.visible as MapIconId] : (input.dataset.category ? this.groups.find(g => g.id === input.dataset.category)!.entries : this.groups.flatMap(g => g.entries)).map(e => e.id);
      this.visibility.set(entries, input.checked);
    }, { signal: this.abort.signal });
    this.media.addEventListener('change', () => { if (!this.changedByUser) this.setOpen(!this.media.matches, false); }, { signal: this.abort.signal });
    this.unsubscribe = visibility.subscribe(() => this.refresh());
    this.setOpen(!this.media.matches, false); this.refresh(); this.drawIcons();
  }
  setOpen(open: boolean, user = true) {
    this.changedByUser ||= user; this.element.hidden = !open; this.toggle.setAttribute('aria-expanded', String(open));
    this.element.parentElement?.classList.toggle('map-legend-open', open); this.onLayout();
  }
  closeCompact() { if (this.media.matches) this.setOpen(false); }
  announce(message: string) { this.element.querySelector('.map-legend-note')!.textContent = message; }
  setAvailable(available: ReadonlySet<MapServiceKind>) {
    for (const button of this.element.querySelectorAll<HTMLButtonElement>('[data-ping]')) {
      button.disabled = !available.has(button.dataset.ping as MapServiceKind);
      button.title = button.disabled ? 'No discovered location of this type' : '';
    }
  }
  private refresh() {
    const update = (input: HTMLInputElement, ids: readonly MapIconId[]) => {
      const shown = ids.filter(id => this.visibility.isVisible(id)).length; input.checked = shown === ids.length; input.indeterminate = shown > 0 && shown < ids.length;
    };
    for (const input of this.element.querySelectorAll<HTMLInputElement>('[data-visible]')) {
      update(input, [input.dataset.visible as MapIconId]); input.closest('.map-legend-row')!.classList.toggle('map-legend-row--hidden', !input.checked);
    }
    for (const input of this.element.querySelectorAll<HTMLInputElement>('[data-category]')) update(input, this.groups.find(g => g.id === input.dataset.category)!.entries.map(e => e.id));
    update(this.element.querySelector('[data-all]')!, this.groups.flatMap(g => g.entries.map(e => e.id)));
  }
  drawIcons() {
    const ratio = Math.min(4, window.devicePixelRatio || 1);
    for (const canvas of this.element.querySelectorAll<HTMLCanvasElement>('canvas[data-icon]')) {
      canvas.width = canvas.height = Math.round(28 * ratio); const c = canvas.getContext('2d')!;
      c.setTransform(ratio, 0, 0, ratio, 14 * ratio, 14 * ratio); const id = canvas.dataset.icon!;
      if (id === 'player') drawMapPlayerIcon(c, 0, 0, -Math.PI / 2, false);
      else if (id.startsWith('dungeon:')) drawDungeonMapIcon(c, id.slice(8) as DungeonMapIcon, 0, 0);
      else if (id.startsWith('enemy:')) { c.scale(2.8, 2.8); const kind = id.slice(6); drawMapEnemyIcon(c, 0, 0, kind, kind === 'elite' || kind === 'veteran' ? kind : undefined); }
      else if (id.startsWith('journey:')) drawMapSymbol(c, id === 'journey:search' ? 'search' : 'destination', 9, '#ead7a1', '#101b22');
      else if (Object.hasOwn(POI_DEFINITIONS, id)) drawMapPOIIcon(c, id as POIKind, 0, 0, 9);
    }
  }
  dispose() { this.abort.abort(); this.unsubscribe(); this.toggle.remove(); this.element.remove(); }
}
