import { NPC_COLORS, type TownNPC } from './npcs.ts';
/** Layered cloth, skin and work tools, drawn at the same world scale as the player. */
export function drawNPC(c: CanvasRenderingContext2D, npc: TownNPC, time: number, reduced = false): void {
  const t = reduced ? 0 : time + npc.seed % 31, breath = reduced ? 0 : Math.sin(t * 1.6) * .45;
  const smith = npc.role === 'blacksmith', mage = npc.role === 'enchanter', color = NPC_COLORS[npc.role];
  const poly = (points: number[][], fill: string, stroke?: string) => {
    c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = .7; c.stroke(); }
  };
  const limb = (a: number[], b: number[], width: number, fill: string) => {
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.strokeStyle = fill; c.lineWidth = width; c.lineCap = 'round'; c.stroke();
  };
  c.save(); c.translate(npc.x, npc.y); c.scale(1.25, 1.25);
  c.fillStyle = '#02080ca0'; c.beginPath(); c.ellipse(0, 2, 13, 4, 0, 0, Math.PI * 2); c.fill();
  limb([-4, -11], [-5, 0], 5, '#333940'); limb([4, -11], [5, 0], 5, '#333940');
  poly([[-8, 0], [-2, 0], [-2, 3], [-9, 3]], '#232629', '#736e5b');
  poly([[2, 0], [8, 0], [9, 3], [2, 3]], '#232629', '#736e5b');
  c.translate(0, breath);
  const cloth = mage ? '#514669' : smith ? '#514036' : '#315753';
  poly([[-8, -29], [7, -29], [10, -9], [mage ? 12 : 7, -2], [-10, -3]], cloth, '#8c8975');
  poly([[-5, -28], [5, -28], [7, -7], [-7, -7]], mage ? '#2b304e' : '#786147', '#a89871');
  if (!smith) { limb([-6, -23], [1, -6], 1, color); limb([7, -25], [-2, -5], .7, color); }
  limb([-8, -25], [-12, -15], 5, cloth); limb([-12, -15], [-6, -13], 3.5, '#b99170');
  const work = reduced ? 0 : Math.pow(Math.max(0, Math.sin(t * 2.1)), 3);
  limb([7, -25], [11, -17 - work * (smith ? 7 : 1)], 5, cloth);
  limb([11, -17 - work * (smith ? 7 : 1)], [5, -15 - work * (smith ? 8 : 1)], 3.5, '#b99170');
  limb([-7, -11], [7, -11], 2, '#2a262a'); c.fillStyle = '#d2b578'; c.fillRect(-1.6, -12.5, 3.2, 3);
  limb([0, -28], [0, -31], 5, '#b98b66');
  poly([[-5, -40], [3, -41], [6, -36], [4, -30], [-3, -29], [-6, -34]], '#c39c78', '#685342');
  poly([[-6, -35], [-6, -40], [-3, -44], [4, -43], [6, -37], [2, -40], [-3, -39]], npc.seed % 2 ? '#8d8577' : '#34343a');
  limb([-3, -35], [-1, -35], .9, '#252c31'); limb([2, -35], [4, -35], .9, '#252c31');
  if (smith) {
    poly([[-4, -33], [0, -32], [4, -34], [3, -28], [0, -26], [-4, -29]], '#777067');
    limb([5, -15 - work * 8], [6, -24 - work * 8], 2, '#71543a');
    poly([[1, -26 - work * 8], [11, -26 - work * 8], [11, -22 - work * 8], [1, -22 - work * 8]], '#93a1a5', '#d0d4c0');
  } else if (mage) {
    poly([[-8, -38], [0, -48], [8, -38], [4, -42], [-3, -42]], '#514669', color);
    c.strokeStyle = color; c.lineWidth = .6; c.beginPath(); c.ellipse(0, -19, 13, 3, Math.sin(t * .5) * .2, 0, Math.PI * 2); c.stroke();
  } else {
    c.strokeStyle = '#d8bb7c'; c.lineWidth = .7;
    for (const x of [-2.5, 3]) { c.beginPath(); c.arc(x, -35, 2.1, 0, Math.PI * 2); c.stroke(); }
  }
  if (!smith) {
    const y = -17 + (reduced ? 0 : Math.sin(t * 2) * 2);
    const glow = c.createRadialGradient(0, y, 0, 0, y, 14); glow.addColorStop(0, `${color}70`); glow.addColorStop(1, `${color}00`);
    c.fillStyle = glow; c.fillRect(-14, y - 14, 28, 28);
    poly([[0, y - 5], [4, y], [0, y + 5], [-4, y]], color, '#e3eadc');
  }
  c.restore();
}
export function npcEmblem(role: TownNPC['role']): string {
  const path = role === 'blacksmith' ? '<path d="M9 8h14l-3 6H12l-3-3H5V8Zm4 6h7v7h5v3H8v-3h5ZM22 4l5 4-2 3-5-4Z"/>'
    : role === 'jeweler' ? '<path d="m16 4 9 8-9 15-9-15Zm-9 8h18M16 4l-4 8 4 15 4-15Z"/>'
    : '<circle cx="16" cy="16" r="11"/><path d="m16 5 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/>';
  return `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
