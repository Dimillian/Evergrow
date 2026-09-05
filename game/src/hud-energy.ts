import { HUD_ART } from './hud-layout.ts';

/** Decorative currents behind the instrument. Open light never catches input. */
export function drawHUDEnergy(c: CanvasRenderingContext2D, time: number) {
  for (const mana of [false, true]) {
    c.save();
    c.translate(mana ? HUD_ART.orb.right : HUD_ART.orb.left, HUD_ART.orb.y);
    c.scale(mana ? -1 : 1, 1);
    c.globalCompositeOperation = 'screen';
    const color = mana ? '#58adff' : '#f05c7f';
    const core = mana ? '#9fddff' : '#ff9daa';
    const phase = time * .65 + (mana ? 2 : 0);
    const breath = .82 + Math.sin(phase) * .12;

    // Light pools against the inner collar; the middle of the orb remains glass.
    const halo = c.createRadialGradient(32, 11, 3, 32, 11, 37);
    halo.addColorStop(0, color + '60'); halo.addColorStop(.5, color + '23'); halo.addColorStop(1, color + '00');
    c.globalAlpha = breath; c.fillStyle = halo; c.fillRect(-5, -26, 74, 74);

    // A crescent hangs just outside the silver socket. Layered strokes create
    // native-resolution glow without depending on the world's CRT/bloom pass.
    for (const [width, alpha] of [[10, .065], [5, .2], [2, .78], [.65, .95]]) {
      c.beginPath(); c.arc(0, 0, 45.7, -.87, 1.02);
      c.lineWidth = width; c.strokeStyle = width < 1 ? core : color;
      c.globalAlpha = alpha * breath; c.stroke();
    }

    // Two tapered streams spill from the collar and curl under the end plate.
    // Every segment is bounded; no particle state or persistent allocation.
    for (let strand = 0; strand < 2; strand++) {
      const point = (t: number) => {
        const u = 1 - t;
        return {
          x: u ** 3 * 29 + 3 * u * u * t * 54 + 3 * u * t * t * 37 + t ** 3 * 102,
          y: u ** 3 * 35 + 3 * u * u * t * 39 + 3 * u * t * t * 63 + t ** 3 * 57
            + Math.sin(t * Math.PI) * (Math.sin(phase + t * 5 + strand * 2) * 2.2 + strand * 4),
        };
      };
      const points = Array.from({ length: 19 }, (_, i) => point(i / 18));
      for (const [width, alpha] of [[8, .1], [3.1, .35], [.85, .8]]) {
        c.beginPath();
        for (const side of [1, -1]) for (let j = 0; j < points.length; j++) {
          const i = side === 1 ? j : points.length - 1 - j;
          const p = points[i], before = points[Math.max(0, i - 1)], after = points[Math.min(18, i + 1)];
          const dx = after.x - before.x, dy = after.y - before.y, length = Math.hypot(dx, dy);
          const taper = Math.sin((.15 + i / 18 * .85) * Math.PI) * width * .5 * side;
          const x = p.x - dy / length * taper, y = p.y + dx / length * taper;
          if (side === 1 && j === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.closePath(); c.fillStyle = width < 1 ? core : color;
        c.globalAlpha = alpha * breath * (strand ? .55 : 1); c.fill();
      }
      for (let i = 0; i < 3; i++) {
        const t = (time * .22 + i / 3 + strand * .17) % 1, p = point(t);
        c.globalAlpha = Math.sin(t * Math.PI) * .85;
        c.fillStyle = core; c.beginPath(); c.arc(p.x, p.y, .8 - t * .35, 0, Math.PI * 2); c.fill();
      }
    }
    // An orbiting pulse makes each crescent feel charged, even at full resource.
    const angle = -.83 + ((time * .16 + (mana ? .45 : 0)) % 1) * 1.8;
    const x = Math.cos(angle) * 45.7, y = Math.sin(angle) * 45.7;
    const pulse = c.createRadialGradient(x, y, 0, x, y, 5);
    pulse.addColorStop(0, core + 'bb'); pulse.addColorStop(.25, color + '66'); pulse.addColorStop(1, color + '00');
    c.globalAlpha = breath; c.fillStyle = pulse; c.fillRect(x - 5, y - 5, 10, 10);
    c.restore();
  }
}
