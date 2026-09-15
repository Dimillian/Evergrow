import { MapLegend } from './map-legend.ts';
import { MapIconVisibility, mapIconVisible, enemyMapIconId, type MapIconId } from './map-legend-content.ts';
import { dungeonRunChest, dungeonRunExit } from './dungeon-locations.ts';
import { drawMapEnemyIcon } from './map-icon-art.ts';
import { dungeonMapEnemyVisible, type DungeonMapEnemy as MapEnemy } from './dungeon-map-enemies.ts';
import { drawRiftMapTerrain } from './rift-map-art.ts';
import { BIOMES } from './biomes.ts';
import { drawDungeonMapIcon, type DungeonMapIcon } from './dungeon-map-icon-art.ts';
import { dungeonChestMask } from './expedition-route.ts';
import { worldTimeLabel } from './world-time.ts';
import { dungeonTheme, DUNGEON_EVENTS } from './dungeon-content.ts';
import { bindTouchCanvas } from './touch-canvas.ts';
import { drawJourneyMapMarker, type JourneyMarker } from './journey-marker.ts';
import { cryptOutline } from './dungeon-contours.ts';
import type { DungeonFloor } from './dungeon.ts';
import type { DungeonRun } from './dungeon-state.ts';
import { getMinimapRect } from './map-view.ts';
import { trapDialogFocus } from './ui-components.ts';
import { text } from './font.ts';
import './dungeon.css';
export function dungeonMapBounds(f: DungeonFloor) { const left = Math.min(...[...f.rooms,...f.corridors].map(r => r.x)) - 100, top = Math.min(...[...f.rooms,...f.corridors].map(r => r.y)) - 100, right = Math.max(...[...f.rooms,...f.corridors].map(r => r.x + r.width)) + 100, bottom = Math.max(...[...f.rooms,...f.corridors].map(r => r.y + r.height)) + 100; return { x: (left + right) / 2, y: (top + bottom) / 2, width: right - left, height: bottom - top }; }
export function drawDungeonMap(c: CanvasRenderingContext2D, f: DungeonFloor, run: DungeonRun, p: {
    x: number;
    y: number;
    angle: number;
}, box: {
    x: number;
    y: number;
    width: number;
    height: number;
}, zoom: number, cx: number, cy: number, marker:JourneyMarker|null=null, simple=false, enemies:readonly MapEnemy[]=[], visibility?:MapIconVisibility) {
    c.save();
    c.beginPath();
    c.rect(box.x, box.y, box.width, box.height);
    c.clip();
    if (simple) c.globalAlpha = .58;
    else { c.fillStyle = '#071018ee'; c.fillRect(box.x, box.y, box.width, box.height); }
    c.translate(box.x + box.width / 2 - cx * zoom, box.y + box.height / 2 - cy * zoom);
    c.scale(zoom, zoom);
    const shape = (r: DungeonFloor['rooms'][number]) => {
        c.beginPath();
        cryptOutline(r).forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y));
        c.closePath();
    };
    const seen = new Set(run.explored);
    const baseTheme=dungeonTheme(f.seed,f.theme),theme=f.rift?{...baseTheme,map:BIOMES[run.entrance.biome].color,wall:'#58374e',accent:'#e4a2c7'}:baseTheme;
    if(f.rift)drawRiftMapTerrain(c,f,seen,{x:cx-box.width/zoom/2,y:cy-box.height/zoom/2,width:box.width/zoom,height:box.height/zoom});
    else {
    c.fillStyle = theme.map;
    f.edges.forEach(([a, b], i) => { if (seen.has(a) || seen.has(b))
        for (const r of f.corridors.filter(r=>r.connection===i))
            { shape(r); c.fill(); } });
    for (const r of f.rooms)
        if (seen.has(r.id)) {
            c.fillStyle = r.kind === 'boss' ? '#67533e' : theme.map;
            c.strokeStyle = theme.wall;
            c.lineWidth = 1 / zoom;
            shape(r); c.fill(); c.stroke();
        }
    for(const prop of f.props??[]) {
        const room=f.rooms.find(r=>prop.x>=r.x&&prop.x<=r.x+r.width&&prop.y>=r.y&&prop.y<=r.y+r.height);
        if(!room||!seen.has(room.id))continue;
        c.fillStyle=prop.kind==='pool'?'#6bb3c455':theme.wall+'70';
        c.fillRect(prop.x-14,prop.y-20,28,40);
    }
    }
    const icon = (kind: DungeonMapIcon, x: number, y: number, completed = false, angle = 0) => {
        if (!mapIconVisible(visibility, kind === 'player' ? 'player' : `dungeon:${kind}`)) return;
        c.save(); c.translate(x, y); c.scale(1 / zoom, 1 / zoom);
        drawDungeonMapIcon(c, kind, 0, 0, completed, theme.accent, angle); c.restore();
    };
    for (const event of f.events ?? []) if (seen.has(event.room))
        icon(event.kind, event.x, event.y, !!run.events?.[event.id]?.finished);
    f.chests.forEach((_, i) => { const ch=dungeonRunChest(f,run,i); if ((!run.rift||i===2&&run.rift.phase==='complete')&&seen.has(ch.room))
        icon('chest', ch.x, ch.y, (run.chestMasks[i] & dungeonChestMask(run, i)) === dungeonChestMask(run, i));
    });
    icon('entry', f.entry.x, f.entry.y);
    if(run.rift?.phase==='complete'){const exit=dungeonRunExit(f,run);icon('entry',exit.x,exit.y);}
    if (run.rift ? run.rift.phase==='boss'||run.rift.phase==='complete' : seen.has(f.rooms.find(r => r.kind === 'boss')!.id)) {
        const b = run.states.warden;
        icon('boss', b.x, b.y, run.states.warden.hp <= 0);
    }
    const visibleBox={x:cx-box.width/zoom/2,y:cy-box.height/zoom/2,width:box.width/zoom,height:box.height/zoom};
    for(const enemy of enemies){
      if(!mapIconVisible(visibility,enemyMapIconId(enemy))||!dungeonMapEnemyVisible(enemy,f,seen,visibleBox))continue;
      c.save();c.translate(enemy.x,enemy.y);c.scale(1/zoom,1/zoom);
      drawMapEnemyIcon(c,0,0,enemy.kind,enemy.rank);c.restore();
    }
    c.globalAlpha = 1;
    icon('player', p.x, p.y, false, p.angle);
    c.restore();
    drawJourneyMapMarker(c,{...box,zoom,centerX:cx,centerY:cy},marker,true,visibility);
    c.strokeStyle = '#718b85';
    c.lineWidth = 1;
    if (!simple) c.strokeRect(box.x + .5, box.y + .5, box.width - 1, box.height - 1);
}
export class DungeonMap {
    private legend: MapLegend;
    private iconVisibility: MapIconVisibility;
    private unsubscribeIcons: () => void;
    private resizeObserver: ResizeObserver;
    marker:JourneyMarker|null=null;
    readonly element: HTMLElement;
    private canvas: HTMLCanvasElement;
    private clearTouch: (()=>void) | null = null;
    private tooltip: HTMLDivElement;
    private abort = new AbortController();
    private focus: ReturnType<typeof trapDialogFocus> | null = null;
    private floor: DungeonFloor | null = null;
    private run: DungeonRun | null = null;
    private player = { x: 0, y: 0, angle: 0 };
    private zoom = .17;
    private enemies:readonly MapEnemy[]=[];
    private explorationMode = false;
    private center = { x: 1450, y: 1400 };
    private drag: {
        x: number;
        y: number;
    } | null = null;
    constructor(mount: HTMLElement, onClose: () => void, overworld: () => void, iconVisibility = new MapIconVisibility()) {
        this.iconVisibility = iconVisibility;
        this.element = document.createElement('section');
        this.element.className = 'crypt-map';
        this.element.hidden = true;
        this.element.innerHTML = '<section class="ui-window" role="dialog" aria-modal="true" aria-label="Dungeon map"><header class="ui-window-header"><h2 class="ui-title">Dungeon map</h2><button class="ui-button" data-world>Overworld</button><button class="ui-button ui-button--icon" data-close aria-label="Close">×</button></header><div class="map-legend-layout"><div class="crypt-map-viewport"><canvas class="crypt-map-canvas" aria-label="Explored crypt rooms"></canvas></div></div></section>';
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'ui-tooltip crypt-map-tooltip';
        this.tooltip.setAttribute('role', 'tooltip');
        this.tooltip.hidden = true;
        this.element.append(this.tooltip);
        mount.append(this.element);
        this.canvas = this.element.querySelector('canvas')!;
        this.legend = new MapLegend(iconVisibility, this.element.querySelector('.map-legend-layout')!, this.element.querySelector('header')!, 'dungeon', () => this.draw());
        this.unsubscribeIcons = iconVisibility.subscribe(() => { this.tooltip.hidden = true; this.draw(); });
        this.resizeObserver = new ResizeObserver(() => this.draw()); this.resizeObserver.observe(this.canvas.parentElement!);
        this.clearTouch = bindTouchCanvas(this.canvas,this.abort.signal,{
          start:()=>{this.tooltip.hidden=true;},
          pan:(dx,dy)=>{this.center.x-=dx/this.zoom;this.center.y-=dy/this.zoom;this.tooltip.hidden=true;this.draw();},
          zoom:(factor,p)=>this.zoomAt(factor,p.x,p.y),
          tap:p=>{const r=this.canvas.getBoundingClientRect();this.hover(p.x+r.left,p.y+r.top);},
        });
        const zoom = document.createElement('nav'); zoom.className='crypt-touch-zoom touch-only';
        zoom.innerHTML='<button class="ui-button" aria-label="Zoom out">−</button><button class="ui-button" aria-label="Zoom in">+</button>';
        zoom.children[0].addEventListener('click',()=>this.zoomAt(1/1.3));zoom.children[1].addEventListener('click',()=>this.zoomAt(1.3));
        this.canvas.after(zoom);
        this.element.querySelector('[data-close]')!.addEventListener('click', onClose, { signal: this.abort.signal });
        this.element.querySelector('[data-world]')!.addEventListener('click', () => { this.close(); overworld(); }, { signal: this.abort.signal });
        this.canvas.addEventListener('wheel', e => { e.preventDefault(); this.zoom = Math.max(.08, Math.min(.8, this.zoom * Math.exp(-e.deltaY * .001))); this.draw(); }, { passive: false, signal: this.abort.signal });
        this.canvas.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, y: e.clientY }; this.canvas.setPointerCapture(e.pointerId); }, { signal: this.abort.signal });
        this.canvas.addEventListener('pointermove', e => { if (!this.drag) {
            this.hover(e.clientX, e.clientY);
            return;
        } this.tooltip.hidden = true; this.center.x -= (e.clientX - this.drag.x) / this.zoom; this.center.y -= (e.clientY - this.drag.y) / this.zoom; this.drag = { x: e.clientX, y: e.clientY }; this.draw(); }, { signal: this.abort.signal });
        this.canvas.addEventListener('pointerup', () => this.drag = null, { signal: this.abort.signal });
        this.canvas.addEventListener('pointerleave', () => this.tooltip.hidden = true, { signal: this.abort.signal });
        this.canvas.addEventListener('pointercancel', () => this.drag = null, { signal: this.abort.signal });
    }
    open(f: DungeonFloor, r: DungeonRun, p: {
        x: number;
        y: number;
        angle: number;
    }, explorationMode = false, enemies:readonly MapEnemy[]=[]) { this.enemies=enemies; this.floor = f; this.run = r; this.player = p; this.explorationMode=explorationMode; const bounds = dungeonMapBounds(f); this.center = explorationMode ? { x:p.x,y:p.y } : { x: bounds.x, y: bounds.y }; this.zoom = explorationMode ? .17 : Math.min(1120 / bounds.width, 680 / bounds.height); this.element.classList.toggle('crypt-map--exploration',explorationMode); this.element.querySelector('[role="dialog"]')!.setAttribute('aria-modal',String(!explorationMode)); this.element.hidden = false; const rect = this.canvas.getBoundingClientRect(); if (!explorationMode) this.zoom = Math.min((rect.width - 60) / bounds.width, (rect.height - 60) / bounds.height); this.draw(); if (!explorationMode) this.focus = trapDialogFocus(this.element, { signal: this.abort.signal }); }
    setExplorationPointer(point: { x: number; y: number } | null) {
        if (this.element.hidden || !this.explorationMode) return;
        const rect = this.canvas.getBoundingClientRect();
        if (point && point.x >= rect.left && point.x < rect.right && point.y >= rect.top && point.y < rect.bottom) this.hover(point.x, point.y);
        else this.tooltip.hidden = true;
    }
    private hover(clientX: number, clientY: number) {
        if (!this.floor || !this.run)
            return;
        const r = this.canvas.getBoundingClientRect(), x = this.center.x + ((clientX - r.left) - r.width / 2) / this.zoom, y = this.center.y + ((clientY - r.top) - r.height / 2) / this.zoom;
        const targets = [...(this.floor.events??[]).map(e=>({...e,mapIcon:`dungeon:${e.kind}` as MapIconId,label:DUNGEON_EVENTS[e.kind].name})), { ...this.floor.entry, mapIcon:'dungeon:entry' as MapIconId, label: 'Exit to overworld', room: this.floor.rooms.find(r=>r.kind==='entry')?.id??0 }, ...(this.run.rift?.phase==='complete'?[{...dungeonRunExit(this.floor,this.run),mapIcon:'dungeon:entry' as MapIconId,label:'Exit to overworld',room:0}]:[]), ...this.floor.chests.flatMap((_, i) => this.run!.rift&&(i!==2||this.run!.rift.phase!=='complete')?[]:[{ ...dungeonRunChest(this.floor!,this.run!,i), mapIcon:'dungeon:chest' as MapIconId, label: this.run!.chestMasks[i] === dungeonChestMask(this.run!,i) ? 'Chest · Claimed' : i === 2 ? 'Boss chest' : 'Guarded chest' }]), { ...this.run.states.warden, mapIcon:'dungeon:boss' as MapIconId, label: (this.run.rift?'Rift guardian':dungeonTheme(this.floor.seed,this.floor.theme).bossName??'Hollow Warden')+(this.run.states.warden.hp>0?'':' · Defeated'), room: this.floor.rooms.find(r=>r.kind==='boss')!.id }];
        const target = targets.filter(p=>mapIconVisible(this.iconVisibility,p.mapIcon)).filter(p=>!this.run!.rift||p.label==='Exit to overworld'||this.run!.rift.phase==='complete'||this.run!.rift.phase==='boss'&&p.label==='Rift guardian').find(p => (this.run!.rift?.phase==='boss'||this.run!.rift?.phase==='complete'||this.run!.explored.includes(p.room)) && Math.hypot(p.x - x, p.y - y) < 16 / this.zoom);
        this.tooltip.hidden = !target;
        if (!target)
            return;
        this.tooltip.textContent = target.label;
        this.tooltip.style.left = `${Math.min(clientX + 16, window.innerWidth - this.tooltip.offsetWidth - 12)}px`;
        this.tooltip.style.top = `${Math.min(clientY + 16, window.innerHeight - this.tooltip.offsetHeight - 12)}px`;
    }
    update(player: { x: number; y: number; angle: number }, enemies:readonly MapEnemy[]=[]) {
        this.enemies=enemies;
        if (this.element.hidden) return;
        if (this.explorationMode) this.center = { x: player.x, y: player.y };
        this.player = { ...player }; this.draw();
    }
    private draw() { if (!this.element.hidden && this.floor && this.run) {
        const rect = this.canvas.getBoundingClientRect(), ratio = Math.min(4, window.devicePixelRatio || 1);
        if (rect.width <= 0 || rect.height <= 0) return;
        if (this.canvas.width !== Math.round(rect.width * ratio)) this.canvas.width = Math.round(rect.width * ratio);
        if (this.canvas.height !== Math.round(rect.height * ratio)) this.canvas.height = Math.round(rect.height * ratio);
        const c=this.canvas.getContext('2d')!; c.setTransform(ratio,0,0,ratio,0,0); c.clearRect(0,0,rect.width,rect.height);
        drawDungeonMap(c, this.floor, this.run, this.player, { x: 0, y: 0, width: rect.width, height: rect.height }, this.zoom, this.center.x, this.center.y,this.marker,this.explorationMode,this.enemies,this.iconVisibility); } }
    zoomExplorationByWheel(deltaY: number, deltaMode: number) {
        if (this.element.hidden || !this.explorationMode || !Number.isFinite(deltaY)) return;
        const delta = Math.max(-240, Math.min(240, deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? this.canvas.clientHeight : 1)));
        this.zoomAt(Math.exp(-delta * .0016));
    }
    private zoomAt(factor: number, px?: number, py?: number) {
        const r=this.canvas.getBoundingClientRect(), x=(px??r.width/2)-r.width/2,y=(py??r.height/2)-r.height/2;
        const next=Math.max(.04,Math.min(.8,this.zoom*factor));this.center.x+=x/this.zoom-x/next;this.center.y+=y/this.zoom-y/next;this.zoom=next;this.tooltip.hidden=true;this.draw();
    }
    close() { this.clearTouch?.(); this.focus?.dispose(); this.focus = null; this.element.hidden = true; this.drag = null; this.tooltip.hidden = true; }
    dispose() { this.legend.dispose(); this.unsubscribeIcons(); this.resizeObserver.disconnect(); this.close(); this.abort.abort(); this.element.remove(); }
}
export function drawCryptMinimap(c: CanvasRenderingContext2D, f: DungeonFloor, r: DungeonRun, p: {
    x: number;
    y: number;
    angle: number;
}, w: number, h: number, marker:JourneyMarker|null=null, time=0, enemies:readonly MapEnemy[]=[], visibility?:MapIconVisibility) { const box = getMinimapRect(w, h); drawDungeonMap(c, f, r, p, box, .095, p.x, p.y,marker,false,enemies,visibility); text(c, `Lv ${r.entrance.level} · ${worldTimeLabel(time)}`, box.x + box.width / 2, box.y + box.height - 8, .9, '#b9cbbb', 'center'); }
