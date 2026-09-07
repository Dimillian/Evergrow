import { ChestArt } from './chest-art.ts';
import { eventRecipe, sealPoint } from './event-recipes.ts';
import { eventInteractionSites, type EventState } from './poi-content.ts';
import { BLESSINGS, eventLabel, focusEvent, type EventSite, type EventRecord } from './poi-content.ts';
import type { Simulation } from './simulation.ts';
import type { World } from './world.ts';
import { text } from './font.ts';
export class EventArt {
  readonly chests = new ChestArt();
  draw(c: CanvasRenderingContext2D, site: EventSite, record: Pick<EventRecord, 'phase'> & Partial<Pick<EventRecord,'delivered'|'bonusGranted'>> | undefined, time: number, _dt: number, reduced: boolean, preparation=0) {
    const claimed = record?.phase === 'claimed', active = record?.phase === 'active';
    if(site.kind!=='standingStones'&&site.kind!=='watchtower') {
      this.chests.draw(c,site.id,site.x,site.y,claimed||!!record?.bonusGranted||!!record?.delivered,time,Math.max(preparation,active?.2:0),site.kind==='cursedChest',reduced);return;
    }
    c.save();
    c.translate(site.x, site.y);
    c.fillStyle = '#02060a88';
    c.beginPath();
    c.ellipse(0, 5, 26, 8, 0, 0, Math.PI * 2);
    c.fill();
    const ritual = site.kind === 'standingStones' || site.kind === 'watchtower';
    const color = '#95dacc';
    if (!claimed || ritual) {
      const glow = c.createRadialGradient(0, -10, 2, 0, -10, 45);
      glow.addColorStop(0, color + '35');
      glow.addColorStop(1, color + '00');
      c.fillStyle = glow;
      c.fillRect(-46, -56, 92, 92);
    }
    c.fillStyle = '#1c2a2d';
    c.strokeStyle = '#687879';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-23, 3);
    c.lineTo(-18, -5);
    c.lineTo(19, -5);
    c.lineTo(24, 3);
    c.lineTo(20, 8);
    c.lineTo(-20, 8);
    c.closePath();
    c.fill();
    c.stroke();
    if (ritual) {
      c.fillStyle = '#314847';
      c.fillRect(-10, -25, 20, 28);
      c.strokeStyle = color;
      c.strokeRect(-10, -25, 20, 28);
      c.fillStyle = claimed || active ? color : '#718683';
      c.beginPath();
      c.moveTo(0, -43);
      c.lineTo(9, -31);
      c.lineTo(0, -19);
      c.lineTo(-9, -31);
      c.closePath();
      c.fill();
      if (claimed || active) {
        c.strokeStyle = color + '80';
        c.beginPath();
        c.ellipse(0, -29, 17, 6, Math.sin(time * .6) * .3, 0, Math.PI * 2);
        c.stroke();
      }
    }
    if (active || record?.phase === 'completed')
      for (let i = 0; i < 5; i++) {
        const phase = reduced ? i / 5 : (time * .25 + i / 5) % 1;
        c.fillStyle = color;
        c.globalAlpha = (1 - phase) * .65;
        c.fillRect(Math.sin(i * 2.4 + time * .4) * 19, -22 - phase * 38, 2, 2);
      }
    c.restore();
  }
}
export function drawEventUI(c: CanvasRenderingContext2D, sim: Simulation, world: World, project: (x: number, y: number) => {
  x: number;
  y: number;
}, gamepad: boolean, sites: readonly EventSite[]) {
  const p = sim.player, site = focusEvent(eventInteractionSites(sites,sim.eventState), p, world);
  if (site) {
    const point = project(site.x, site.y - 52), label = eventLabel(site, sim.eventState, sim.getCampState(site.id) === 'cleared');
    c.save();
    c.font = '13px "Evergrow Numerals", system-ui';
    c.textAlign = 'center';
    const value = sim.eventChannel.site?.id === site.id ? `${label} · ${(sim.eventChannel.duration - sim.eventChannel.elapsed).toFixed(1)}s` : `${label}  [${gamepad ? 'A' : 'E'}]`;
    const w = c.measureText(value).width + 20;
    c.fillStyle = '#071019ed';
    c.fillRect(point.x - w / 2, point.y - 16, w, 25);
    c.fillStyle = '#e5d7b7';
    c.fillText(value, point.x, point.y + 1);
    c.restore();
  }
  const trial = sim.eventState.trial;
  if (trial && !sim.dungeonFloor) {
    const s = sim.eventState.sites[trial.siteId];
    text(c, s.name, 24, 90, 1.1, '#c5b0e1');
    text(c, eventLabel(s, sim.eventState, false), 24, 109, .95, '#d2d6cc');
  }
  const blessing = p.character.blessing;
  if (blessing)
    text(c, `${BLESSINGS[blessing.kind].name} · ${Math.ceil(blessing.remaining)}s`, 24, 138, 1, BLESSINGS[blessing.kind].color);
}

export function drawEventObjectives(c:CanvasRenderingContext2D,state:EventState,time:number):void {
  const trial=state.trial;if(!trial)return;const site=state.sites[trial.siteId],r=eventRecipe(site)!;
  if(r.mode!=='defend'&&r.mode!=='seals')return;
  const point=r.mode==='seals'?sealPoint(site,trial.wave):site;
  c.save();c.translate(point.x,point.y);const radius=r.mode==='defend'?175:24;
  const glow=c.createRadialGradient(0,0,0,0,0,radius);glow.addColorStop(0,'#9bd6c21a');glow.addColorStop(.8,'#9bd6c209');glow.addColorStop(1,'#9bd6c200');c.fillStyle=glow;c.fillRect(-radius,-radius,radius*2,radius*2);
  c.strokeStyle=trial.sealReady?'#f3d79c':'#9bd6c299';c.lineWidth=1.5;c.setLineDash([8,12]);c.lineDashOffset=-time*9;c.beginPath();c.ellipse(0,0,radius,radius*.72,0,0,Math.PI*2);c.stroke();c.setLineDash([]);
  if(r.mode==='seals'){c.fillStyle=trial.sealReady?'#efd3a0':'#516d69';c.beginPath();c.moveTo(0,-28);c.lineTo(10,-12);c.lineTo(0,1);c.lineTo(-10,-12);c.closePath();c.fill();}
  c.restore();
}
