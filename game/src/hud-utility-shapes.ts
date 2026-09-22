type C = CanvasRenderingContext2D;
function gradient(c: C, colors: string[], x = 10, y = 8, ex = 50, ey = 58) {
  const g = c.createLinearGradient(x, y, ex, ey);
  colors.forEach((color, i) => g.addColorStop(i / (colors.length - 1), color));
  return g;
}
function shape(c: C, data: string, fill: string | CanvasGradient, stroke = '#1a2931', width = 1.8) {
  const path = new Path2D(data);
  c.fillStyle = fill; c.fill(path);
  c.strokeStyle = stroke; c.lineWidth = width; c.stroke(path);
}
function line(c: C, data: string, color: string, width = 1.5) {
  c.strokeStyle = color; c.lineWidth = width; c.stroke(new Path2D(data));
}

export function drawSilverVial(c: C) {
  c.lineJoin = c.lineCap = 'round';
  const silver = gradient(c, ['#e0e3d8', '#92a7ac', '#394f5d', '#b4c9cc']);
  const glass = gradient(c, ['#9cbbc6', '#253e50', '#101d2c', '#58788c']);
  const elixir = gradient(c, ['#f0b6bc', '#c15b84', '#703c82', '#a393d6'], 16, 25, 48, 59);
  shape(c, 'M25 12H39V24C39 30 51 32 51 43V48Q50 58 40 59H24Q14 58 13 48V43C13 32 25 30 25 24Z', glass, '#a5bac0');
  shape(c, 'M17 38Q25 35 33 40Q42 44 47 39V48Q46 55 39 55H25Q18 55 17 48Z', elixir, '#cfa5cb', .7);
  shape(c, 'M23 6H41V15H23ZM24 20H40V24H24Z', silver);
  line(c, 'M27 27Q26 31 21 35M20 40V47', '#e2ebdf', 2.4);
  line(c, 'M14 46Q14 59 26 61H38Q50 59 50 46', '#91a4ae', 2.8);
  line(c, 'M21 11H43', '#e1e3d1', 1);
}

export function drawPhantomStep(c: C) {
  c.lineJoin = c.lineCap = 'round';
  const silver = gradient(c, ['#e0e3d8', '#92a7ac', '#394f5d', '#b4c9cc']);
  const jade = gradient(c, ['#e0f2dc', '#93c9b7', '#408c85', '#244a59']);
  line(c, 'M3 23H19M1 34H14M5 46H17', '#77a79c', 3);
  shape(c, 'M35 17L47 22 39 32 48 39 42 56 35 54 39 42 30 38 22 49 10 54 7 49 18 42 25 29 21 24 16 29 12 25 21 16 29 20Z', jade, '#9ebeb9', .8);
  shape(c, 'M40 4Q47 4 47 10Q47 17 40 17Q34 17 34 11Q34 5 40 4Z', silver);
  line(c, 'M37 23L47 29 56 25', '#d4e2d7', 4);
  line(c, 'M29 27L25 35', '#edf0dd', 2);
}
