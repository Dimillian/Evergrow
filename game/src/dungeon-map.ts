import { cryptOutline } from './dungeon-contours.ts';
import type { DungeonFloor } from './dungeon.ts';
import type { DungeonRun } from './dungeon-state.ts';
import { getMinimapRect } from './map-view.ts';
import { trapDialogFocus } from './ui-components.ts';
import { text } from './font.ts';
import './dungeon.css';
export function dungeonMapBounds(f: DungeonFloor) { const left = Math.min(...f.rooms.map(r => r.x)) - 100, top = Math.min(...f.rooms.map(r => r.y)) - 100, right = Math.max(...f.rooms.map(r => r.x + r.width)) + 100, bottom = Math.max(...f.rooms.map(r => r.y + r.height)) + 100; return { x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top }; }
export function drawDungeonMap(c: CanvasRenderingContext2D, f: DungeonFloor, run: DungeonRun, p: {
    x: number;
    y: number;
    angle: number;
}, box: {
    x: number;
    y: number;
    width: number;
    height: number;
}, zoom: number, cx: number, cy: number) {
    c.save();
    c.beginPath();
    c.rect(box.x, box.y, box.width, box.height);
    c.clip();
    c.fillStyle = '#071018ee';
    c.fillRect(box.x, box.y, box.width, box.height);
    c.translate(box.x + box.width / 2 - cx * zoom, box.y + box.height / 2 - cy * zoom);
    c.scale(zoom, zoom);
    const shape = (r: DungeonFloor['rooms'][number]) => {
        c.beginPath();
        cryptOutline(r).forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
        c.closePath();
    };
    const seen = new Set(run.explored);
    c.fillStyle = '#263c3b';
    f.edges.forEach(([a, b], i) => { if (seen.has(a) || seen.has(b))
        for (const r of f.corridors.slice(i * 2, i * 2 + 2))
            { shape(r); c.fill(); } });
    for (const r of f.rooms)
        if (seen.has(r.id)) {
            c.fillStyle = r.kind === 'boss' ? '#49433a' : '#3b5550';
            c.strokeStyle = '#94b2a0';
            c.lineWidth = 1 / zoom;
            shape(r); c.fill(); c.stroke();
        }
    f.chests.forEach((ch, i) => { if (seen.has(ch.room)) {
        c.fillStyle = (run.chestMasks[i] & (i === 2 ? 15 : 9)) === (i === 2 ? 15 : 9) ? '#506459' : '#e7c485';
        c.fillRect(ch.x - 4 / zoom, ch.y - 3 / zoom, 8 / zoom, 6 / zoom);
    } });
    c.strokeStyle = '#a9decc';
    c.lineWidth = 2 / zoom;
    c.beginPath();
    c.arc(f.entry.x, f.entry.y, 5 / zoom, 0, 7);
    c.stroke();
    if (seen.has(12)) {
        const b = f.members.find(m => m.id === 'warden')!;
        c.fillStyle = run.states.warden.hp > 0 ? '#e48c73' : '#78887f';
        c.beginPath();
        c.arc(b.x, b.y, 5 / zoom, 0, 7);
        c.fill();
    }
    c.translate(p.x, p.y);
    c.rotate(p.angle);
    c.fillStyle = '#fff0bf';
    c.beginPath();
    c.moveTo(8 / zoom, 0);
    c.lineTo(-5 / zoom, -4 / zoom);
    c.lineTo(-3 / zoom, 0);
    c.lineTo(-5 / zoom, 4 / zoom);
    c.closePath();
    c.fill();
    c.restore();
    c.strokeStyle = '#718b85';
    c.lineWidth = 1;
    c.strokeRect(box.x + .5, box.y + .5, box.width - 1, box.height - 1);
}
export class DungeonMap {
    readonly element: HTMLElement;
    private canvas: HTMLCanvasElement;
    private tooltip: HTMLDivElement;
    private abort = new AbortController();
    private focus: ReturnType<typeof trapDialogFocus> | null = null;
    private floor: DungeonFloor | null = null;
    private run: DungeonRun | null = null;
    private player = { x: 0, y: 0, angle: 0 };
    private zoom = .17;
    private center = { x: 1450, y: 1400 };
    private drag: {
        x: number;
        y: number;
    } | null = null;
    constructor(mount: HTMLElement, onClose: () => void, overworld: () => void) {
        this.element = document.createElement('section');
        this.element.className = 'crypt-map';
        this.element.hidden = true;
        this.element.innerHTML = '<section class="ui-window" role="dialog" aria-modal="true" aria-label="Dungeon map"><header class="ui-window-header"><h2 class="ui-title">Dungeon map</h2><button class="ui-button" data-world>Overworld</button><button class="ui-button ui-button--icon" data-close aria-label="Close">×</button></header><canvas aria-label="Explored crypt rooms"></canvas></section>';
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'ui-tooltip crypt-map-tooltip';
        this.tooltip.setAttribute('role', 'tooltip');
        this.tooltip.hidden = true;
        this.element.append(this.tooltip);
        mount.append(this.element);
        this.canvas = this.element.querySelector('canvas')!;
        this.element.querySelector('[data-close]')!.addEventListener('click', onClose, { signal: this.abort.signal });
        this.element.querySelector('[data-world]')!.addEventListener('click', () => { this.close(); overworld(); }, { signal: this.abort.signal });
        this.canvas.addEventListener('wheel', e => { e.preventDefault(); this.zoom = Math.max(.08, Math.min(.8, this.zoom * Math.exp(-e.deltaY * .001))); this.draw(); }, { passive: false, signal: this.abort.signal });
        this.canvas.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, y: e.clientY }; this.canvas.setPointerCapture(e.pointerId); }, { signal: this.abort.signal });
        this.canvas.addEventListener('pointermove', e => { if (!this.drag) {
            this.hover(e.clientX, e.clientY);
            return;
        } this.tooltip.hidden = true; const r = this.canvas.getBoundingClientRect(); this.center.x -= (e.clientX - this.drag.x) * this.canvas.width / r.width / this.zoom; this.center.y -= (e.clientY - this.drag.y) * this.canvas.height / r.height / this.zoom; this.drag = { x: e.clientX, y: e.clientY }; this.draw(); }, { signal: this.abort.signal });
        this.canvas.addEventListener('pointerup', () => this.drag = null, { signal: this.abort.signal });
        this.canvas.addEventListener('pointerleave', () => this.tooltip.hidden = true, { signal: this.abort.signal });
        this.canvas.addEventListener('pointercancel', () => this.drag = null, { signal: this.abort.signal });
    }
    open(f: DungeonFloor, r: DungeonRun, p: {
        x: number;
        y: number;
        angle: number;
    }) { this.floor = f; this.run = r; this.player = p; const bounds = dungeonMapBounds(f); this.center = { x: bounds.x, y: bounds.y }; this.zoom = Math.min(1120 / bounds.width, 680 / bounds.height); this.element.hidden = false; this.canvas.width = 1200; this.canvas.height = 760; this.draw(); this.focus = trapDialogFocus(this.element, { signal: this.abort.signal }); }
    private hover(clientX: number, clientY: number) {
        if (!this.floor || !this.run)
            return;
        const r = this.canvas.getBoundingClientRect(), x = this.center.x + ((clientX - r.left) * 1200 / r.width - 600) / this.zoom, y = this.center.y + ((clientY - r.top) * 760 / r.height - 380) / this.zoom;
        const targets = [{ ...this.floor.entry, label: 'Exit to overworld', room: 0 }, ...this.floor.chests.map((ch, i) => ({ ...ch, label: this.run!.chestMasks[i] === (i === 2 ? 15 : 9) ? 'Chest · Claimed' : i === 2 ? 'Warden chest' : 'Guarded chest' })), { ...this.floor.members.find(m => m.id === 'warden')!, label: this.run.states.warden.hp > 0 ? 'The Hollow Warden' : 'The Hollow Warden · Defeated', room: 12 }];
        const target = targets.find(p => this.run!.explored.includes(p.room) && Math.hypot(p.x - x, p.y - y) < 16 / this.zoom);
        this.tooltip.hidden = !target;
        if (!target)
            return;
        this.tooltip.textContent = target.label;
        this.tooltip.style.left = `${Math.min(clientX + 16, window.innerWidth - this.tooltip.offsetWidth - 12)}px`;
        this.tooltip.style.top = `${Math.min(clientY + 16, window.innerHeight - this.tooltip.offsetHeight - 12)}px`;
    }
    private draw() { if (this.floor && this.run)
        drawDungeonMap(this.canvas.getContext('2d')!, this.floor, this.run, this.player, { x: 0, y: 0, width: 1200, height: 760 }, this.zoom, this.center.x, this.center.y); }
    close() { this.focus?.dispose(); this.focus = null; this.element.hidden = true; this.drag = null; this.tooltip.hidden = true; }
    dispose() { this.close(); this.abort.abort(); this.element.remove(); }
}
export function drawCryptMinimap(c: CanvasRenderingContext2D, f: DungeonFloor, r: DungeonRun, p: {
    x: number;
    y: number;
    angle: number;
}, w: number, h: number) { const box = getMinimapRect(w, h); drawDungeonMap(c, f, r, p, box, .095, p.x, p.y); text(c, `CRYPT · ${r.entrance.level}`, box.x + box.width / 2, box.y + box.height - 8, .9, '#b9cbbb', 'center'); }
