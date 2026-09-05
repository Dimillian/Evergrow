const INK = '#080d10';
const EDGE = '#bec4ac';
const BRONZE = '#8e774c';

function polygon(c: CanvasRenderingContext2D, points: readonly number[]): void {
  c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
}

function sword(c: CanvasRenderingContext2D, active: boolean): void {
  c.rotate(.67);
  const blade = c.createLinearGradient(-2.5, 0, 2.5, 0);
  blade.addColorStop(0, '#475651'); blade.addColorStop(.48, '#8b9990');
  blade.addColorStop(.51, active ? '#eee3b2' : '#c7cbb0'); blade.addColorStop(1, '#6d7875');
  polygon(c, [-2.1, 3.5, -2.1, -8.5, 0, -13, 2.1, -8.5, 2.1, 3.5]);
  c.fillStyle = blade; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke();
  c.strokeStyle = EDGE; c.lineWidth = .75;
  c.beginPath(); c.moveTo(0, -11); c.lineTo(0, 2.5); c.stroke();
  c.strokeStyle = '#35433f'; c.lineWidth = .6;
  c.beginPath(); c.moveTo(-1.1, -7); c.lineTo(-1.1, 1.5); c.stroke();

  polygon(c, [-5.3, 3.5, -4.6, 2.6, -1.6, 3.6, 1.6, 3.6, 4.6, 2.6, 5.3, 3.5,
    4.7, 5.1, 1.4, 4.8, -1.4, 4.8, -4.7, 5.1]);
  c.fillStyle = BRONZE; c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  c.strokeStyle = '#baaa7b'; c.lineWidth = .7;
  c.beginPath(); c.moveTo(-4.4, 3.5); c.lineTo(-1.5, 4); c.lineTo(1.5, 4); c.lineTo(4.4, 3.5); c.stroke();

  c.fillStyle = '#473e33'; c.fillRect(-1.3, 5, 2.6, 5);
  c.strokeStyle = '#9b8c64'; c.lineWidth = .6;
  for (const y of [5.7, 7.3, 8.9]) {
    c.beginPath(); c.moveTo(-1, y); c.lineTo(1, y + .5); c.stroke();
  }
  polygon(c, [-1.2, 9.5, 1.2, 9.5, 1.7, 11, 0, 12, -1.7, 11]);
  c.fillStyle = BRONZE; c.fill(); c.strokeStyle = INK; c.lineWidth = .8; c.stroke();
  c.fillStyle = '#c3b486'; c.fillRect(-.6, 10, 1, 1);
}

function ember(c: CanvasRenderingContext2D, time: number, active: boolean): void {
  const flicker = active ? Math.sin(time * 8) * .6 : 0;
  const outer = c.createLinearGradient(-4, -12, 4, 10);
  outer.addColorStop(0, '#b18b4e'); outer.addColorStop(.4, '#a15d32');
  outer.addColorStop(.76, '#643627'); outer.addColorStop(1, '#352827');
  c.beginPath(); c.moveTo(-1.4, -12 - flicker);
  c.bezierCurveTo(1.9, -8.3, 4.9, -7.4, 3.8, -3.1);
  c.bezierCurveTo(5.2, -4.1, 5.8, -5.9, 5.7, -7);
  c.bezierCurveTo(8.4, -2.6, 7.9, 3.5, 5.5, 6.9);
  c.bezierCurveTo(2.9, 10.7, -2.6, 11, -5.5, 7);
  c.bezierCurveTo(-8.9, 3, -8, -1.4, -5.1, -4.3);
  c.bezierCurveTo(-5.5, -1.5, -4.3, -.5, -3.4, .1);
  c.bezierCurveTo(-4.4, -5, -.2, -6.7, -1.4, -12 - flicker); c.closePath();
  c.fillStyle = outer; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.3; c.stroke();

  const heat = c.createLinearGradient(0, -5, 0, 8);
  heat.addColorStop(0, '#c09b5c'); heat.addColorStop(.6, active ? '#edb564' : '#cf9650');
  heat.addColorStop(1, '#a56b3d');
  c.beginPath(); c.moveTo(-.1, -5.8);
  c.bezierCurveTo(3.1, -3, 1, -.7, 3, 1.3);
  c.bezierCurveTo(4.3, .5, 4.5, -.1, 4.5, -.9);
  c.bezierCurveTo(5.4, 3.8, 2.7, 8, -.2, 8.1);
  c.bezierCurveTo(-3.8, 8.1, -5.2, 4.4, -3.6, 1);
  c.bezierCurveTo(-2.2, 3, -.4, 2.4, -1.3, .7);
  c.bezierCurveTo(-2.5, -1.5, -.4, -3.4, -.1, -5.8); c.closePath();
  c.fillStyle = heat; c.fill();

  c.beginPath(); c.moveTo(.2, .1); c.bezierCurveTo(1.6, 2.1, -.1, 3, 1.8, 4.4);
  c.bezierCurveTo(2.8, 6.5, .6, 7.5, -.7, 6.9);
  c.bezierCurveTo(-2.6, 6, -1.7, 3.7, .2, .1); c.closePath();
  c.fillStyle = active ? '#f1ddb1' : '#dcc18c'; c.fill();
  c.strokeStyle = '#c89a5d'; c.lineWidth = .7;
  c.beginPath(); c.moveTo(-5.6, 2); c.quadraticCurveTo(-6.5, 4.2, -4.8, 6.2); c.stroke();
  c.fillStyle = active ? '#b58c54' : '#776146';
  c.fillRect(5.4, -10, .8, 1.5); c.fillRect(-5.5, -8.2, .8, .8);
}

function greave(c: CanvasRenderingContext2D, active: boolean): void {
  c.strokeStyle = '#535f58'; c.lineWidth = .8;
  c.beginPath(); c.moveTo(-11.5, -5); c.lineTo(-6.5, -6);
  c.moveTo(-12, 0); c.lineTo(-7.5, -.8); c.stroke();
  const plate = c.createLinearGradient(-4, 0, 8, 0);
  plate.addColorStop(0, '#35413f'); plate.addColorStop(.45, '#7e8d83');
  plate.addColorStop(.58, active ? '#bdc6a7' : '#a0ab96'); plate.addColorStop(1, '#4b5953');
  polygon(c, [-3.3, -11, 3.8, -12, 5.6, -8.4, 3.2, -.2, 6.5, 3,
    9.8, 4.2, 11.4, 7.3, 8.8, 9.1, -4.5, 9.1, -5.5, 6.5, -.8, 1.9, -1.8, -2.2]);
  c.fillStyle = plate; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
  polygon(c, [-2.3, -10.2, 3.4, -11, 4.4, -8.8, -1.5, -8]);
  c.fillStyle = '#695f47'; c.fill();
  c.strokeStyle = '#b8b49a'; c.lineWidth = .75;
  c.beginPath(); c.moveTo(-1.9, -9.9); c.lineTo(3.3, -10.6); c.stroke();
  c.strokeStyle = EDGE;
  c.beginPath(); c.moveTo(1, -7.1); c.lineTo(.2, -.7); c.lineTo(2.2, 2.1); c.stroke();
  polygon(c, [-.8, 1.5, 2.2, .8, 4.4, 3.3, 1.6, 4.6, -2, 4.3]);
  c.fillStyle = '#49544d'; c.fill(); c.strokeStyle = '#94977e'; c.lineWidth = .65; c.stroke();
  c.strokeStyle = '#bac0a4'; c.lineWidth = .75;
  c.beginPath(); c.moveTo(4.5, 4.6); c.lineTo(8.1, 5.3); c.lineTo(9.2, 6.6); c.stroke();
  polygon(c, [-4.8, 7.4, -.8, 8, 8.3, 7.7, 10.5, 6.9, 10.6, 8.3, 8.3, 10, -4.2, 10]);
  c.fillStyle = '#2c3030'; c.fill(); c.strokeStyle = INK; c.lineWidth = .8; c.stroke();
  c.strokeStyle = '#727164'; c.beginPath(); c.moveTo(-3.6, 8.6); c.lineTo(7.9, 8.6); c.stroke();
}

function flask(c: CanvasRenderingContext2D, time: number, active: boolean): void {
  const glass = c.createLinearGradient(-6, 0, 6, 0);
  glass.addColorStop(0, '#273c35'); glass.addColorStop(.3, '#516350');
  glass.addColorStop(.55, '#2f4339'); glass.addColorStop(1, '#182a27');
  polygon(c, [-2.8, -9.2, 2.8, -9.2, 2.8, -4.6, 5.8, -.7,
    5.5, 8.3, 3.3, 10.7, -3.3, 10.7, -5.5, 8.3, -5.8, -.7, -2.8, -4.6]);
  c.fillStyle = glass; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.4; c.stroke();
  c.strokeStyle = '#758575'; c.lineWidth = .7; c.stroke();

  const surface = .9 + (active ? Math.sin(time * 6) * .35 : 0);
  const life = c.createLinearGradient(-4, 0, 0, 10);
  life.addColorStop(0, active ? '#ed9295' : '#c66c78'); life.addColorStop(1, '#653c57');
  const mana = c.createLinearGradient(0, 0, 4, 10);
  mana.addColorStop(0, active ? '#9bcaff' : '#6d9ed4'); mana.addColorStop(1, '#354e80');
  polygon(c, [-4.5, surface, 0, surface + .3, 0, 9.2, -2.5, 9.2, -4.2, 7.7]); c.fillStyle = life; c.fill();
  polygon(c, [0, surface + .3, 4.5, surface, 4.2, 7.7, 2.5, 9.2, 0, 9.2]); c.fillStyle = mana; c.fill();
  c.strokeStyle = '#c8bbdf'; c.lineWidth = .7;
  c.beginPath(); c.moveTo(-4.1, surface + .2); c.lineTo(0, surface + .5); c.lineTo(4.1, surface + .2); c.stroke();
  c.strokeStyle = '#c4cfb19e'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(-1.5, -7.5); c.lineTo(-1.5, -4.8);
  c.moveTo(-3.7, -.4); c.lineTo(-3.5, 4.7); c.stroke();
  c.strokeStyle = '#89a17f'; c.lineWidth = .7;
  c.beginPath(); c.moveTo(3.5, 6.1); c.lineTo(3.3, 7.5); c.lineTo(2, 8.7); c.stroke();

  polygon(c, [-3.8, -11.7, 3.8, -11.7, 3.4, -8.8, -3.4, -8.8]);
  c.fillStyle = '#77705a'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
  c.strokeStyle = '#b6ad86'; c.lineWidth = .75;
  c.beginPath(); c.moveTo(-2.8, -10.7); c.lineTo(2.8, -10.7); c.stroke();
  c.fillStyle = '#c1cf966e'; c.fillRect(.6, 3.5, 1, 1);
}

/** Engraved skill symbols share an iron/bronze palette and fit a 28 px field. */
export function drawHUDSkillIcon(c: CanvasRenderingContext2D, index: number,
  x: number, y: number, time: number, active: boolean): void {
  c.save(); c.translate(x, y);
  c.lineJoin = 'round'; c.lineCap = 'round'; c.shadowBlur = 0; c.shadowColor = 'transparent';
  if (index === 0) sword(c, active);
  else if (index === 1) ember(c, time, active);
  else if (index === 2) greave(c, active);
  else if (index === 3) flask(c, time, active);
  c.restore();
}

/** Subdued menu engravings; bindings remain native-resolution text. */
export function drawHUDMenuIcon(c: CanvasRenderingContext2D, index: number, x: number, y: number): void {
  c.save(); c.translate(x, y); c.scale(1.08, 1.08); c.lineCap = 'round'; c.lineJoin = 'round';
  c.shadowBlur = 0; c.shadowColor = 'transparent';
  c.strokeStyle = index === 3 ? '#4e626c' : '#9bb1b8'; c.fillStyle = c.strokeStyle; c.lineWidth = 1.15;
  c.beginPath();
  if (index === 0) {
    c.arc(0, -2.6, 1.8, 0, Math.PI * 2);
    c.moveTo(-1.6, .5); c.lineTo(-4.2, 1.9); c.lineTo(-4.5, 4.5); c.lineTo(4.5, 4.5);
    c.lineTo(4.2, 1.9); c.lineTo(1.6, .5);
    c.moveTo(-1.6, .5); c.lineTo(0, 2); c.lineTo(1.6, .5);
  } else if (index === 1) {
    c.rect(-4.2, -1.5, 8.4, 6);
    c.moveTo(-2, -1.5); c.lineTo(-2, -3.7); c.lineTo(2, -3.7); c.lineTo(2, -1.5);
    c.moveTo(-4.2, .5); c.lineTo(4.2, .5); c.moveTo(0, .1); c.lineTo(0, 2);
  } else if (index === 2) {
    c.moveTo(0, 3.4); c.lineTo(0, -3.1);
    c.moveTo(0, .4); c.lineTo(-3.8, -2.2); c.moveTo(0, .4); c.lineTo(3.8, -2.2);
    c.stroke();
    for (const [nx, ny] of [[0, -4], [-4.2, -2.7], [4.2, -2.7], [0, 4.2]]) {
      polygon(c, [nx, ny - .8, nx + .8, ny, nx, ny + .8, nx - .8, ny]);
      c.fill();
    }
    c.restore(); return;
  } else if (index === 3) {
    c.moveTo(0, -2.8); c.quadraticCurveTo(-1.9, -4.2, -4.5, -3.6);
    c.lineTo(-4.5, 3.4); c.quadraticCurveTo(-2, 2.8, 0, 4.2);
    c.quadraticCurveTo(2, 2.8, 4.5, 3.4); c.lineTo(4.5, -3.6);
    c.quadraticCurveTo(1.9, -4.2, 0, -2.8); c.lineTo(0, 4.2);
    c.moveTo(-3, -.9); c.lineTo(-1.6, -.5); c.moveTo(1.6, -.5); c.lineTo(3, -.9);
  }
  c.stroke(); c.restore();
}
