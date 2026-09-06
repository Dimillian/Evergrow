import { BLESSINGS, eventLabel, focusEvent, type EventSite, type EventRecord } from './poi-content.ts';
import type { Simulation } from './simulation.ts';
import type { World } from './world.ts';
import { text } from './font.ts';
export class EventArt {
  private lids = new Map<string, number>();
  draw(c: CanvasRenderingContext2D, site: EventSite, record: EventRecord | undefined, time: number, dt: number, reduced: boolean) {
    const claimed = record?.phase === 'claimed', active = record?.phase === 'active';
    const target = claimed ? 1 : 0, old = this.lids.get(site.id) ?? target;
    const open = reduced ? target : old + (target - old) * (1 - Math.exp(-dt * 12));
    this.lids.delete(site.id);
    this.lids.set(site.id, open);
    if (this.lids.size > 64)
      this.lids.delete(this.lids.keys().next().value!);
    c.save();
    c.translate(site.x, site.y);
    c.fillStyle = '#02060a88';
    c.beginPath();
    c.ellipse(0, 5, 26, 8, 0, 0, Math.PI * 2);
    c.fill();
    const ritual = site.kind === 'standingStones' || site.kind === 'watchtower';
    const color = ritual ? '#95dacc' : site.kind === 'graveyard' ? '#b6a4d9' : '#d2b77b';
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
    else {
      c.fillStyle = site.kind === 'graveyard' || site.kind === 'reliquary' ? '#4a5353' : '#534332';
      c.fillRect(-18, -14, 36, 17);
      c.strokeStyle = '#ad9570';
      c.strokeRect(-18, -14, 36, 17);
      c.fillStyle = '#0a1013';
      c.fillRect(-15, -13, 30, 6);
      c.save();
      c.translate(0, -14);
      c.scale(1, 1 - open * 1.8);
      c.fillStyle = '#665842';
      c.fillRect(-19, -8, 38, 10);
      c.strokeStyle = color;
      c.strokeRect(-19, -8, 38, 10);
      c.fillStyle = '#aa9875';
      c.fillRect(-13, -8, 3, 10);
      c.fillRect(10, -8, 3, 10);
      c.restore();
      if (!claimed) {
        c.fillStyle = color;
        c.fillRect(-3, -11, 6, 7);
        c.fillStyle = '#273335';
        c.fillRect(-1, -9, 2, 3);
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
  const p = sim.player, site = focusEvent(sites, p, world);
  if (site) {
    const point = project(site.x, site.y - 52), label = eventLabel(site, sim.eventState, sim.getCampState(site.id) === 'cleared');
    c.save();
    c.font = '13px "Evergrow Numerals", system-ui';
    c.textAlign = 'center';
    const value = sim.eventChannel.site?.kind !== 'cryptChest' && sim.eventChannel.site?.id === site.id ? `${label} · ${(sim.eventChannel.duration - sim.eventChannel.elapsed).toFixed(1)}s` : `${label}  [${gamepad ? 'A' : 'E'}]`;
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
