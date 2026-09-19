import type { MapRect } from './exploration.ts';
import { text, textWidth } from './font.ts';
import { UI_THEME } from './ui-theme.ts';
import { skyAtTime, worldTimeLabel } from './world-time.ts';

const palette = UI_THEME.palette;

function fittedLabel(value: string, width: number, size: number): string {
  if (textWidth(value, size) <= width) return value;
  let label = value;
  while (label.length && textWidth(`${label}…`, size) > width) label = label.slice(0, -1);
  return label ? `${label.trimEnd()}…` : '';
}

/** Light & Open chrome, shared by outdoor and dungeon minimaps. */
export function drawMinimapFrame(c: CanvasRenderingContext2D, box: MapRect,
  location: string, area: string, time: number, active = false): void {
  c.save();
  c.fillStyle = `${palette.panel}db`;
  c.fillRect(box.x, box.y, box.width, box.height);
  c.strokeStyle = `${palette.silverDim}${active ? 'aa' : '60'}`;
  c.lineWidth = 1;
  c.strokeRect(box.x + .5, box.y + .5, box.width - 1, box.height - 1);
  text(c, fittedLabel(location, box.width - 37, .95), box.x + 8, box.y + 9, .95, palette.ivory);
  c.strokeStyle = `${palette.silverDim}60`;
  c.strokeRect(box.x + box.width - 22.5, box.y + 6.5, 15, 14);
  text(c, 'M', box.x + box.width - 15, box.y + 10, .8, palette.muted, 'center', 'interface');

  const night = skyAtTime(time).daylight < .35;
  const clock = `${night ? 'Night' : 'Day'} · ${worldTimeLabel(time)}`;
  const size = .78, y = box.y + box.height - 12;
  const areaWidth = box.width - 24 - textWidth(clock, size);
  text(c, fittedLabel(area, areaWidth, size), box.x + 8, y, size, area === 'Sanctuary' ? palette.jade : palette.text);
  text(c, clock, box.x + box.width - 8, y, size, night ? '#a7c6e4' : palette.brass, 'right');
  c.restore();
}
