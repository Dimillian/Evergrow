import { loadGameFont } from './font.ts';
import { installUITheme } from './ui-theme.ts';
import { escapeUI as e, uiIcon } from './ui-components.ts';
import { itemIconSVG } from './item-art.ts';
import type { ThorSnapshot, ThorAction, ThorItem } from './thor-protocol.ts';
import type {} from './thor-native.ts';
import './typography.css';
import './ui-kit.css';
import './item-ui.css';
import './thor-screen.css';
await loadGameFont();
installUITheme();
const root = document.querySelector<HTMLElement>('#companion')!;
let previewAction: ((action:ThorAction)=>void)|null=null;
let state: ThorSnapshot | null = null, tab = 'map', map = '', detailClosed: string | null = null, lastContent = '';
const icons = new Map<string, {
    signature: string;
    svg: string;
}>();
const icon = (item: ThorItem) => {
    const signature = JSON.stringify(item.art), cached = icons.get(item.id);
    if (cached?.signature === signature)
        return cached.svg;
    const svg = itemIconSVG(item.art, 40);
    if (icons.size >= 128)
        icons.delete(icons.keys().next().value!);
    icons.set(item.id, { signature, svg });
    return svg;
};
const n = (value: number) => Math.round(value).toLocaleString('en-US');
const send = (command: ThorAction) => {
    if (!state?.session)
        return;
    if(previewAction){previewAction(command);return;}
    window.EvergrowCompanion?.command(JSON.stringify({ ...command, session: state.session }));
};
root.innerHTML = `<div class="thor-shell"><header class="thor-header"><span class="thor-sigil">${uiIcon('star')}</span><div><h1 id="thor-name">EVERGROW</h1><span id="thor-zone"></span></div><span id="thor-level"></span></header>
<div class="thor-resources"><div class="thor-life"><i></i><span></span></div><div class="thor-mana"><i></i><span></span></div></div>
<nav class="thor-tabs" aria-label="Companion panels">${[['map', 'Map', 'map'], ['pack', 'Pack', 'inventory'], ['build', 'Build', 'character']].map(([id, label, icon]) => `<button data-tab="${id}" aria-selected="${id === 'map'}">${uiIcon(icon as Parameters<typeof uiIcon>[0])}<span>${label}</span><em data-badge="${id}"></em></button>`).join('')}</nav>
<section class="thor-content" id="thor-content"></section><footer class="thor-footer"><button data-panel="journeys">${uiIcon('journal')}<span>Journal</span></button><button data-action="portal">${uiIcon('star')}<span>Portal</span></button><button data-action="resume" id="thor-resume">${uiIcon('close')}<span>Resume</span></button></footer><div class="thor-xp"><i></i></div><div id="thor-detail" class="thor-detail" hidden></div></div>`;
const get = (selector: string) => root.querySelector<HTMLElement>(selector)!;
const content = get('#thor-content');
function itemCell(item: ThorItem | null) { return item ? `<button class="thor-item" data-item="${e(item.id)}" style="--rarity:${e(item.color)}" aria-label="${e(item.name)}">${icon(item)}<small>${n(item.level)}</small></button>` : '<span class="thor-item empty"></span>'; }
function render() {
    const s = state, active = !!s?.session;
    get('.thor-shell').classList.toggle('is-empty', !active);
    get('#thor-name').textContent = active ? s.name : 'EVERGROW';
    get('#thor-zone').textContent = active ? s.zone : '';
    get('#thor-level').textContent = active ? `Lv ${n(s.level)}` : '';
    for (const [cls, value, max] of [['life', s?.hp ?? 0, s?.maxHp ?? 1], ['mana', s?.mana ?? 0, s?.maxMana ?? 1]] as const) {
        get(`.thor-${cls} i`).style.width = `${Math.max(0, Math.min(100, value / max * 100))}%`;
        get(`.thor-${cls} span`).textContent = `${n(value)} / ${n(max)}`;
    }
    get('.thor-xp i').style.width = `${s ? Math.min(100, s.xp / s.nextXP * 100) : 0}%`;
    get('[data-badge="pack"]').textContent = active ? String(s.bag.filter(Boolean).length) : '';
    const points = (s?.skillPoints ?? 0) + (s?.statPoints ?? 0);
    get('[data-badge="build"]').textContent = active && points ? String(points) : '';
    get('#thor-resume').hidden = !active || s.phase === 'playing';
    for (const b of root.querySelectorAll<HTMLButtonElement>('.thor-footer button'))
        b.disabled = !active;
    let html = '';
    if (!active)
        html = `<div class="thor-idle"><div class="thor-astrolabe"><span>${uiIcon('star')}</span><i></i><i></i><i></i></div><p>Select a character on the upper screen</p></div>`;
    else if (tab === 'map')
        html = `<div class="thor-map"><img src="${map}" alt="Explored terrain"><span class="thor-north">N</span><div class="thor-map-tools"><button data-zoom="0.8" aria-label="Zoom out">−</button><button data-zoom="1.25" aria-label="Zoom in">+</button><button data-panel="map" aria-label="Open full map">${uiIcon('map')}</button></div><span class="thor-area-level">Lv ${n(s.zoneLevel)}</span></div><div class="thor-section-title"><h2>Nearby</h2><button data-panel="journeys" aria-label="Open journal">${uiIcon('journal')}</button></div><div class="thor-journeys">${s.journeys.length ? s.journeys.map(g => `<button data-track="${e(g.id)}" class="${g.tracked ? 'tracked' : ''}"><span class="journey-diamond">◇</span><span>${e(g.name)}</span><small>${e(g.distance)}</small></button>`).join('') : '<p class="thor-quiet">Explore to discover nearby activities</p>'}</div>`;
    else if (tab === 'pack')
        html = `<div class="thor-pack-layout"><section class="thor-equipped-column"><div class="thor-section-title"><h2>Worn</h2></div><div class="thor-equipment">${s.equipment.map(itemCell).join('')}</div><span class="thor-gold">◈ ${n(s.gold)}</span><button class="thor-character-link" data-panel="character">Character ↗</button></section><section class="thor-bag-column"><div class="thor-section-title"><h2>Pack</h2><span>${s.bag.filter(Boolean).length} / 64</span></div><div class="thor-bag">${s.bag.map(itemCell).join('')}</div></section></div>`;
    else
        html = `<div class="thor-power"><span>${uiIcon('star')}</span><div><strong>${n(s.power)}</strong><small>Power</small></div><div class="thor-build-xp"><b>Lv ${n(s.level)}</b><small>${n(s.xp)} / ${n(s.nextXP)} XP</small></div></div><div class="thor-build-actions"><button data-panel="character">Attributes${s.statPoints ? `<em>+${n(s.statPoints)}</em>` : ''}</button><button data-panel="skills">Skill atlas${s.skillPoints ? `<em>+${n(s.skillPoints)}</em>` : ''}</button></div><div class="thor-stats">${s.stats.filter(v => v.label !== 'Power').map(v => `<div><span>${e(v.label)}</span><strong>${e(v.value)}</strong></div>`).join('')}</div>`;
    // Preserve touch targets and scroll position across telemetry frames.
    if (tab === 'map' && lastContent && active && content.querySelector('.thor-map')) {
        const img = content.querySelector('img')!;
        if (img.getAttribute('src') !== map)
            img.src = map;
        const parsed = document.createElement('template');
        parsed.innerHTML = html;
        const journeys = content.querySelector('.thor-journeys')!, next = parsed.content.querySelector('.thor-journeys')!;
        if (journeys.innerHTML !== next.innerHTML)
            journeys.innerHTML = next.innerHTML;
        content.querySelector('.thor-area-level')!.textContent = `Lv ${n(s.zoneLevel)}`;
    }
    else if (html !== lastContent) {
        const scroll = content.scrollTop;
        content.innerHTML = html;
        content.scrollTop = scroll;
    }
    lastContent = html;
    const detail = get('#thor-detail'), d = s?.detail, visible = active && s.phase !== 'dead' && !!d && d.id !== detailClosed;
    detail.hidden = !visible;
    if (visible) {
        const value = `<div class="thor-detail-toolbar"><button class="thor-back" data-action="close-detail" aria-label="Back to pack">‹ <span>Pack</span><kbd>B</kbd></button><button data-action="close-detail" aria-label="Close item">${uiIcon('close')}</button></div><div class="thor-detail-scroll">${d.html}</div><button class="thor-equip" data-equip="${e(d.id)}" ${d.equipped || (s.phase !== 'playing' && s.phase !== 'paused' && s.phase !== 'character') ? 'disabled' : ''}>${d.equipped ? 'Equipped' : 'Equip'}</button>`;
        detail.style.setProperty('--item-color', d.color);
        if (detail.innerHTML !== value)
            detail.innerHTML = value;
    }
}
root.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!button || button.disabled)
        return;
    const d = button.dataset;
    if (d.tab) {
        tab = d.tab;
        lastContent = '';
        for (const b of root.querySelectorAll<HTMLElement>('[data-tab]'))
            b.setAttribute('aria-selected', String(b.dataset.tab === tab));
        render();
    }
    if (d.item) {
        detailClosed = null;
        send({ type: 'inspect', id: d.item });
    }
    if (d.equip)
        send({ type: 'equip', id: d.equip });
    if (d.track)
        send({ type: 'track', id: d.track });
    if (d.panel && ['map', 'character', 'skills', 'journeys'].includes(d.panel))
        send({ type: 'panel', panel: d.panel as 'map' | 'character' | 'skills' | 'journeys' });
    if (d.zoom)
        send({ type: 'zoom', factor: Number(d.zoom) });
    if (d.action === 'close-detail') {
        detailClosed = state?.detail?.id ?? null;
        send({ type: 'closeInspect' });
        render();
    }
    if (d.action === 'resume' || d.action === 'portal')
        send({ type: d.action });
});
function receive(next: ThorSnapshot) {
    if (next.session !== state?.session) {
        map = '';
        detailClosed = null;
        lastContent = '';
    }
    state = next;
    if (next.map)
        map = next.map;
    render();
}
window.addEventListener('evergrow-companion-state', event => { try {
    receive(JSON.parse((event as CustomEvent).detail));
}
catch { /* A partial frame leaves the last complete display intact. */ } });
render();
window.EvergrowCompanion?.ready();
if (new URLSearchParams(location.search).has('preview'))
    void import('./thor-study.ts').then(m => {const study=m.thorStudy(); receive(study.state); previewAction=action=>receive(study.action(action));});
