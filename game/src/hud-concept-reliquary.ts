const TAU = Math.PI * 2;
const STONE_DARK = '#080f13';
const BRASS = '#8c7954';

function polygon(c: CanvasRenderingContext2D, points: readonly number[]): void {
  c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.closePath();
}

function outline(c: CanvasRenderingContext2D): void {
  c.beginPath(); c.moveTo(12, 89);
  c.bezierCurveTo(10, 64, 23, 44, 42, 35);
  c.lineTo(53, 23); c.quadraticCurveTo(61, 12, 69, 23); c.lineTo(81, 35);
  c.bezierCurveTo(97, 43, 107, 55, 111, 72);
  c.lineTo(122, 65); c.lineTo(129, 58); c.lineTo(163, 55);
  c.lineTo(176, 59); c.lineTo(177, 32); c.lineTo(185, 24);
  c.lineTo(240, 24); c.lineTo(248, 9); c.quadraticCurveTo(260, 1, 272, 9);
  c.lineTo(280, 24); c.lineTo(335, 24); c.lineTo(343, 32); c.lineTo(344, 59);
  c.lineTo(357, 55); c.lineTo(391, 58); c.lineTo(398, 65); c.lineTo(409, 72);
  c.bezierCurveTo(413, 55, 423, 43, 439, 35);
  c.lineTo(451, 23); c.quadraticCurveTo(459, 12, 467, 23); c.lineTo(478, 35);
  c.bezierCurveTo(497, 44, 510, 64, 508, 89);
  c.lineTo(514, 97); c.lineTo(509, 113); c.lineTo(494, 124);
  c.lineTo(483, 141); c.lineTo(455, 146); c.lineTo(433, 142);
  c.lineTo(411, 130); c.lineTo(399, 128); c.lineTo(388, 145);
  c.lineTo(132, 145); c.lineTo(121, 128); c.lineTo(109, 130);
  c.lineTo(87, 142); c.lineTo(65, 146); c.lineTo(37, 141);
  c.lineTo(26, 124); c.lineTo(11, 113); c.lineTo(6, 97); c.closePath();
}

function line(c: CanvasRenderingContext2D, points: readonly number[], color: string, width = 1): void {
  c.beginPath(); c.moveTo(points[0], points[1]);
  for (let i = 2; i < points.length; i += 2) c.lineTo(points[i], points[i + 1]);
  c.strokeStyle = color; c.lineWidth = width; c.stroke();
}

/** All foreground content belongs to the shared concept renderer. */
function reserveContent(c: CanvasRenderingContext2D): void {
  c.beginPath(); c.rect(0, 0, 520, 150);
  for (const x of [61, 459]) { c.moveTo(x + 36.6, 79); c.arc(x, 79, 36.6, 0, TAU); }
  for (const x of [135, 199, 263, 327]) c.rect(x, 70, 58, 56);
  c.rect(186, 29, 148, 23);
  c.rect(23, 122, 76, 15); c.rect(421, 122, 76, 15);
  c.clip('evenodd');
}

function rivet(c: CanvasRenderingContext2D, x: number, y: number): void {
  c.beginPath(); c.arc(x, y, 2.3, 0, TAU); c.fillStyle = '#040a0e'; c.fill();
  c.beginPath(); c.arc(x, y - .15, 1.25, 0, TAU); c.fillStyle = '#817153'; c.fill();
  c.fillStyle = '#c0b18a'; c.fillRect(x - .7, y - .8, .8, .8);
}

function stoneSurface(c: CanvasRenderingContext2D): void {
  outline(c);
  const stone = c.createLinearGradient(0, 12, 60, 147);
  stone.addColorStop(0, '#29332f'); stone.addColorStop(.25, '#1d292a');
  stone.addColorStop(.67, '#101b20'); stone.addColorStop(1, '#071015');
  c.fillStyle = stone; c.fill();
  c.strokeStyle = '#02070a'; c.lineWidth = 4; c.stroke();
  c.strokeStyle = '#536052'; c.lineWidth = 1.1; c.stroke();
  c.save(); outline(c); c.clip();
  // Fixed mineral flecks read as hewn stone rather than a smooth enamel panel.
  for (let i = 0; i < 210; i++) {
    const hash = (Math.imul(i + 31, 1597334677) ^ Math.imul(i + 13, 3812015801)) >>> 0;
    const x = (hash % 1031) / 1031 * 520, y = ((hash >>> 11) % 307) / 307 * 150;
    c.fillStyle = i % 4 ? '#bbc3a609' : '#02080d36';
    c.fillRect(x, y, 1 + (i % 3) * .75, i % 5 ? .65 : 1.7);
  }
  c.restore();
  line(c, [14, 87, 17, 66, 25, 53, 42, 40], '#a2a58a51', .8);
  line(c, [480, 40, 495, 53, 503, 67, 506, 87], '#bac2a331', .8);
  line(c, [139, 143, 381, 143], '#b7a57958', .8);
  line(c, [139, 145, 381, 145], '#00060ac9', 1.3);
}

function pointedArch(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number): void {
  c.beginPath(); c.moveTo(x - width / 2, y + height);
  c.lineTo(x - width / 2, y + height * .5);
  c.quadraticCurveTo(x - width / 2, y + height * .2, x, y);
  c.quadraticCurveTo(x + width / 2, y + height * .2, x + width / 2, y + height * .5);
  c.lineTo(x + width / 2, y + height);
}

function orbCollar(c: CanvasRenderingContext2D): void {
  c.save(); c.translate(61, 79);
  const seating = c.createLinearGradient(-40, -45, 38, 44);
  seating.addColorStop(0, '#9b916c'); seating.addColorStop(.17, '#5b634f');
  seating.addColorStop(.43, '#19262a'); seating.addColorStop(.69, '#7e7151');
  seating.addColorStop(.84, '#484d3e'); seating.addColorStop(1, '#243235');
  c.beginPath(); c.arc(0, 0, 41.9, 0, TAU);
  c.strokeStyle = '#040a0e'; c.lineWidth = 9; c.stroke();
  c.strokeStyle = seating; c.lineWidth = 6.3; c.stroke();
  c.beginPath(); c.arc(0, 0, 38.2, 0, TAU);
  c.strokeStyle = '#b6a3736e'; c.lineWidth = .85; c.stroke();
  c.beginPath(); c.arc(0, 0, 45.6, .08, Math.PI * 1.91);
  c.strokeStyle = '#080f15'; c.lineWidth = 1.2; c.stroke();

  // Narrow pointed recesses give the collar a cathedral-window profile.
  for (const angle of [-1.02, -.52, 0, .52, 1.02]) {
    c.save(); c.rotate(angle); c.translate(0, -43.5);
    pointedArch(c, 0, -10, 8, 12); c.closePath();
    c.fillStyle = '#070f15'; c.fill(); c.strokeStyle = '#566353'; c.lineWidth = 1; c.stroke();
    pointedArch(c, 0, -8, 4.4, 8);
    c.strokeStyle = '#b6a3768a'; c.lineWidth = .65; c.stroke();
    c.restore();
  }
  c.beginPath(); c.arc(0, 0, 43.1, 3.7, 4.82);
  c.strokeStyle = '#d1c5a1aa'; c.lineWidth = .85; c.stroke();
  c.beginPath(); c.arc(0, 0, 40.5, .08, .62);
  c.strokeStyle = '#b1a07654'; c.lineWidth = 1; c.stroke();
  for (let i = 0; i < 17; i++) {
    const angle = i * .37 + .15, r = i % 3 ? 42.8 : 40.8;
    line(c, [Math.cos(angle) * r, Math.sin(angle) * r,
      Math.cos(angle + .024) * (r + .6), Math.sin(angle + .024) * (r + .6)], '#4e80715e', .7);
  }

  // Carved buttresses spread the weight onto the lower stone foot.
  polygon(c, [-47, 9, -39, 17, -32, 32, -27, 39, -22, 44, -27, 53, -39, 40, -45, 29, -51, 18]);
  c.fillStyle = '#202c2b'; c.fill(); c.strokeStyle = '#5e6754'; c.lineWidth = 1; c.stroke();
  polygon(c, [-42, 20, -35, 30, -29, 45, -32, 45, -42, 32]);
  c.fillStyle = '#0a141a'; c.fill();
  line(c, [-45, 16, -39, 27, -32, 38], '#aa9f7882', .8);
  polygon(c, [40, 16, 45, 12, 52, 22, 59, 37, 45, 37, 32, 49, 25, 45, 33, 34]);
  c.fillStyle = '#1e2b2b'; c.fill(); c.strokeStyle = '#56614f'; c.lineWidth = 1; c.stroke();
  line(c, [43, 20, 48, 28, 51, 32, 43, 32, 34, 39], '#b09e7180', .85);
  rivet(c, -43, 17); rivet(c, 44, 24);

  c.beginPath(); c.moveTo(-23, 59); c.quadraticCurveTo(0, 68, 24, 59);
  c.lineTo(20, 65); c.quadraticCurveTo(0, 69, -20, 65); c.closePath();
  c.fillStyle = '#141e20'; c.fill(); c.strokeStyle = '#827655'; c.lineWidth = .85; c.stroke();
  line(c, [-14, 62, 0, 64, 15, 62], '#b7a47762', .7);
  c.restore();
}

function skillArcade(c: CanvasRenderingContext2D): void {
  polygon(c, [118, 80, 128, 65, 392, 65, 402, 80, 399, 126, 386, 141, 134, 141, 121, 126]);
  const face = c.createLinearGradient(0, 59, 0, 143);
  face.addColorStop(0, '#3d463a'); face.addColorStop(.18, '#26332d');
  face.addColorStop(.78, '#111e21'); face.addColorStop(1, '#23302b');
  c.fillStyle = face; c.fill(); c.strokeStyle = '#0a1115'; c.lineWidth = 2; c.stroke();
  for (const x of [164, 228, 292, 356]) {
    pointedArch(c, x, 55, 63, 32);
    c.strokeStyle = '#050c11'; c.lineWidth = 8; c.stroke();
    c.strokeStyle = '#59614d'; c.lineWidth = 5.3; c.stroke();
    c.strokeStyle = '#293a32'; c.lineWidth = 2.8; c.stroke();
    pointedArch(c, x, 56.8, 61, 28);
    c.strokeStyle = '#b4a67a9c'; c.lineWidth = .8; c.stroke();
    line(c, [x - 12, 65, x - 5, 61, x, 58.5], '#d0c59d55', .7);

    pointedArch(c, x, 129.7, 18, 11.4); c.closePath();
    c.fillStyle = STONE_DARK; c.fill(); c.strokeStyle = '#4d5b4d'; c.lineWidth = .8; c.stroke();
    pointedArch(c, x, 131.5, 10, 8.8);
    c.strokeStyle = '#8c825d87'; c.lineWidth = .6; c.stroke();
    line(c, [x - 26, 132, x - 16, 132], '#988c6261', .75);
    line(c, [x + 16, 132, x + 26, 132], '#988c6261', .75);
  }
  // Thin recessed piers keep the bays separate without thick gold dividers.
  for (const x of [130, 196, 260, 324, 390]) {
    polygon(c, [x - 2.5, 68, x + 2.5, 68, x + 2, 126, x + 4, 130, x - 4, 130, x - 2, 126]);
    c.fillStyle = '#27362f'; c.fill();
    line(c, [x - 1.6, 73, x - 1.6, 125], '#a59c7284', .7);
    line(c, [x + 1.6, 73, x + 1.6, 126], '#020a10b3', 1);
    rivet(c, x, 134);
  }
  line(c, [124, 120, 125, 126, 135, 138, 385, 138, 395, 126, 396, 120], '#786d4e', .8);
}

function shortcutRidge(c: CanvasRenderingContext2D): void {
  polygon(c, [175, 56, 178, 32, 186, 24, 334, 24, 342, 32, 345, 56, 332, 61, 188, 61]);
  const ridge = c.createLinearGradient(0, 24, 0, 61);
  ridge.addColorStop(0, '#5a5f49'); ridge.addColorStop(.19, '#26332e');
  ridge.addColorStop(.8, '#142127'); ridge.addColorStop(1, '#384030');
  c.fillStyle = ridge; c.fill(); c.strokeStyle = '#080f14'; c.lineWidth = 1.5; c.stroke();
  line(c, [180, 33, 187, 26, 239, 26], '#b1a076a8', .9);
  line(c, [281, 26, 333, 26, 340, 33], '#b1a07678', .9);
  line(c, [186, 54, 334, 54], '#92835d9c', .8);
  line(c, [192, 57, 238, 57], '#496052', .7);
  line(c, [282, 57, 328, 57], '#496052', .7);
  for (const x of [180, 340]) {
    line(c, [x, 37, x, 49], '#bbc4a751', .7);
    rivet(c, x, 54);
  }
}

function heraldry(c: CanvasRenderingContext2D, time: number): void {
  c.save(); c.translate(260, 18);
  // A small escutcheon carries a branching sprig rather than another empty jewel.
  c.beginPath(); c.moveTo(-13, -7); c.quadraticCurveTo(0, -13, 13, -7);
  c.lineTo(11, 3); c.quadraticCurveTo(8, 9, 0, 12);
  c.quadraticCurveTo(-8, 9, -11, 3); c.closePath();
  const shield = c.createLinearGradient(-12, -8, 11, 11);
  shield.addColorStop(0, '#64715a'); shield.addColorStop(.45, '#2b4239'); shield.addColorStop(1, '#12272a');
  c.fillStyle = shield; c.fill(); c.strokeStyle = '#030b10'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = '#ab956b'; c.lineWidth = 1.1; c.stroke();
  line(c, [-9, -6, 0, -9, 9, -6], '#d3c299ad', .75);
  line(c, [0, 7, 0, -5, -3, -8], '#bac8a3', 1);
  line(c, [0, 2, -5, -1, -6, -4], '#a7b38f', .85);
  line(c, [0, -1, 5, -4, 6, -7], '#a7b38f', .85);
  polygon(c, [-5, -1, -8, -2, -7, -5, -4, -3]); c.fillStyle = '#879b79'; c.fill();
  polygon(c, [5, -4, 4, -7, 7, -9, 8, -6]); c.fillStyle = '#a7b593'; c.fill();
  for (const side of [-1, 1]) {
    c.save(); c.scale(side, 1);
    line(c, [14, 8, 18, 2, 19, -6], '#776d4e', .9);
    polygon(c, [17, 2, 23, -1, 21, -4, 18, -1]); c.fillStyle = '#766d4e'; c.fill();
    polygon(c, [19, -5, 21, -11, 18, -10, 17, -7]); c.fillStyle = '#918262'; c.fill();
    c.restore();
  }
  c.globalAlpha = .32 + Math.sin(time * .65) * .035;
  line(c, [-10, -6, -2, -8.5], '#f0e3b5', .65);
  c.restore();

  // An open knot joins the heraldry to the arcade in the slim unoccupied band.
  c.beginPath(); c.moveTo(243, 60); c.bezierCurveTo(247, 54, 255, 56, 260, 64);
  c.bezierCurveTo(265, 56, 273, 54, 277, 60);
  c.strokeStyle = '#111c20'; c.lineWidth = 3; c.stroke();
  c.strokeStyle = BRASS; c.lineWidth = .85; c.stroke();
}

/** Review-only chassis: 520 × 156, with all shared controls and liquids reserved. */
export function drawReliquary(c: CanvasRenderingContext2D, time: number): void {
  c.save(); c.lineJoin = 'round'; c.lineCap = 'round';
  c.shadowColor = 'transparent'; c.shadowBlur = 0;
  reserveContent(c);
  stoneSurface(c);
  skillArcade(c);
  shortcutRidge(c);
  orbCollar(c);
  c.save(); c.translate(520, 0); c.scale(-1, 1); orbCollar(c); c.restore();
  heraldry(c, time);
  c.restore();
}
