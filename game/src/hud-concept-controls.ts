import { drawHUDOrb } from './hud-orb.ts';
import { drawHUDSkillIcon, drawHUDMenuIcon } from './hud-icons.ts';
import { text } from './font.ts';

/** Review-only fixtures. Identical information keeps the art directions comparable. */
export type ConceptMaterial = 'reliquary' | 'thornbound' | 'astral';
const materials = {
  reliquary: { face: '#172023', edge: '#8a7751', glint: '#d1be8d', well: '#090f13' },
  thornbound: { face: '#17251f', edge: '#737451', glint: '#b8bd8d', well: '#080f0c' },
  astral: { face: '#142129', edge: '#6d828a', glint: '#b5d0d7', well: '#080f16' },
};
const TAU = Math.PI * 2;

export function drawConceptControls(c: CanvasRenderingContext2D, material: ConceptMaterial, pressured: boolean, time: number): void {
  const m = materials[material];
  c.save();
  for (const [x, mana] of [[61, false], [459, true]] as const) {
    c.save(); c.translate(x, 79); c.scale(1.18, 1.18);
    drawHUDOrb(c, 0, 0, mana ? pressured ? .68 : .94 : pressured ? .39 : 1,
      time + (mana ? 7 : 0), mana, !mana && pressured ? .73 : undefined);
    c.restore();
    c.fillStyle = '#070d11ed'; c.beginPath();
    c.moveTo(x - 34, 120); c.lineTo(x + 34, 120); c.lineTo(x + 29, 142); c.lineTo(x - 29, 142); c.closePath(); c.fill();
    c.strokeStyle = m.edge; c.lineWidth = .7; c.stroke();
    text(c, mana ? pressured ? '68 / 100' : '94 / 100' : pressured ? '39 / 100' : '100 / 100',
      x, 127, 1.04, mana ? '#b9cee0' : '#dfb9af', 'center');
  }
  // Open-backed tabs keep the secondary actions subordinate to the four skills.
  for (let i = 0; i < 4; i++) {
    const x = 186 + i * 37;
    c.fillStyle = '#080e11d9'; c.fillRect(x, 30, 35, 22);
    c.strokeStyle = `${m.edge}70`; c.lineWidth = .65;
    c.beginPath(); c.moveTo(x + 4, 51.5); c.lineTo(x + 30, 51.5); c.stroke();
    drawHUDMenuIcon(c, i, x + 11, 40);
    text(c, ['C', 'I', 'T', 'J'][i], x + 26, 36.5, .86, '#8a988c', 'center');
  }
  for (let i = 0; i < 4; i++) {
    const x = 135 + i * 64, y = 70;
    c.save();
    c.beginPath(); c.moveTo(x + 4, y); c.lineTo(x + 54, y); c.lineTo(x + 58, y + 4);
    c.lineTo(x + 58, y + 52); c.lineTo(x + 54, y + 56); c.lineTo(x + 4, y + 56);
    c.lineTo(x, y + 52); c.lineTo(x, y + 4); c.closePath();
    const inset = c.createLinearGradient(0, y, 0, y + 56);
    inset.addColorStop(0, m.face); inset.addColorStop(1, m.well);
    c.fillStyle = inset; c.fill(); c.lineWidth = .8; c.strokeStyle = m.edge; c.stroke();
    c.strokeStyle = `${m.glint}60`; c.beginPath(); c.moveTo(x + 5, y + 1.5); c.lineTo(x + 53, y + 1.5); c.stroke();
    // Enamel behind the engraved skill gives each recess its own material depth.
    const colors = ['#d3ba80', '#d99359', '#7fb6b1', '#a1b276'];
    const glow = c.createRadialGradient(x + 29, y + 23, 0, x + 29, y + 23, 25);
    glow.addColorStop(0, colors[i] + '15'); glow.addColorStop(1, colors[i] + '00');
    c.fillStyle = glow; c.fillRect(x + 2, y + 2, 54, 38);
    c.save(); c.translate(x + 29, y + 22); c.scale(1.24, 1.24);
    drawHUDSkillIcon(c, i, 0, 0, time, false); c.restore();
    if (pressured && i === 1) {
      c.save(); c.beginPath(); c.rect(x + 1, y + 1, 56, 39); c.clip();
      c.fillStyle = '#050b13be'; c.beginPath(); c.moveTo(x + 29, y + 22);
      c.arc(x + 29, y + 22, 43, -Math.PI / 2, Math.PI * .7); c.closePath(); c.fill(); c.restore();
      text(c, '0.3', x + 29, y + 18, 1.2, '#e4dfca', 'center');
    }
    c.strokeStyle = '#b6baa226'; c.lineWidth = .6;
    c.beginPath(); c.moveTo(x + 9, y + 40); c.lineTo(x + 49, y + 40); c.stroke();
    text(c, ['LMB', 'RMB', 'SPACE', 'Q'][i], x + 29, y + 44, .93, '#bfc5b6', 'center');
    if (i >= 2) for (let j = 0; j < 2; j++) {
      c.beginPath(); c.arc(x + 44 + j * 6, y + 6, 1.4, 0, TAU);
      c.fillStyle = pressured && j === 1 ? '#101a19' : colors[i]; c.fill();
      c.strokeStyle = m.edge; c.lineWidth = .6; c.stroke();
    }
    c.restore();
  }
  c.restore();
}
