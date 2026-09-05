import { SKILL_TREE, SKILL_NODES, type SkillNode } from './skill-tree.ts';
import { drawSkillGlyph } from './skill-tree-glyphs.ts';
import { UI_THEME } from './ui-theme.ts';

export const SKILL_DOMAIN_COLORS = { Might: '#c69b71', Cunning: '#80b29d', Arcana: '#a49ecb' } as const;
export interface SkillAtlasView {
  width: number; height: number; zoom: number; centerX: number; centerY: number;
  allocated: ReadonlySet<string>; reachable: ReadonlySet<string>;
  selected: string; hovered: string | null; route: readonly string[];
  matches(node: SkillNode): boolean;
}
const TAU = Math.PI * 2;
const edges = SKILL_TREE.edges.map(edge => ({ ...edge, a: SKILL_NODES.get(edge.from)!, b: SKILL_NODES.get(edge.to)! }));
const edgeKey = (a: string, b: string) => a < b ? `${a}|${b}` : `${b}|${a}`;
export const skillNodeRadius = (node: SkillNode) => node.kind === 'origin' ? 27 : node.kind === 'major' ? 24 : node.kind === 'notable' ? 14 : node.role === 'travel' ? 5.5 : 8;

/** One map projection owns all strokes, medallions and level-of-detail decisions. */
export function drawSkillAtlas(c: CanvasRenderingContext2D, view: SkillAtlasView): void {
  const { width: w, height: h, zoom: z } = view;
  const sx = (x: number) => (x - view.centerX) * z + w / 2;
  const sy = (y: number) => (y - view.centerY) * z + h / 2;
  c.clearRect(0, 0, w, h);
  const background = c.createRadialGradient(w * .5, h * .45, 10, w * .5, h * .5, Math.max(w, h) * .8);
  background.addColorStop(0, '#142127'); background.addColorStop(.5, '#10181e'); background.addColorStop(1, '#080e14');
  c.fillStyle = background; c.fillRect(0, 0, w, h);
  // Subtle world-anchored dust and pools of domain color preserve orientation while panning.
  for (let i = 0; i < 700; i++) {
    const x = sx(((i * 1777 + 871) % 8011) - 4000), y = sy(((i * 2311 + 643) % 8009) - 4000);
    if (x < 0 || x > w || y < 0 || y > h) continue;
    c.fillStyle = i % 13 === 0 ? '#b6af945a' : '#63798225'; c.fillRect(x, y, i % 13 === 0 ? 1.1 : .7, .7);
  }
  for (const cluster of SKILL_TREE.clusters) {
    const x = sx(cluster.x), y = sy(cluster.y), r = Math.max(9, cluster.radius * z);
    if (x + r * 2 < 0 || x - r * 2 > w || y + r * 2 < 0 || y - r * 2 > h) continue;
    const color = SKILL_DOMAIN_COLORS[cluster.domain];
    const haze = c.createRadialGradient(x, y, 0, x, y, r * 1.8);
    haze.addColorStop(0, color + '0b'); haze.addColorStop(1, color + '00');
    c.fillStyle = haze; c.fillRect(x - r * 1.8, y - r * 1.8, r * 3.6, r * 3.6);
    if (z > .28) {
      c.strokeStyle = color + '16'; c.lineWidth = .6;
      c.beginPath(); c.arc(x, y, r * .78, -.3, .9); c.stroke();
      c.beginPath(); c.arc(x, y, r * .82, Math.PI - .25, Math.PI + .45); c.stroke();
    }
  }
  const ox = sx(0), oy = sy(0);
  if (z > .18) {
    c.save(); c.translate(ox, oy); c.scale(z, z);
    c.strokeStyle = '#a7906035'; c.lineWidth = .6 / Math.sqrt(z);
    for (const radius of [39, 44, 80]) { c.beginPath(); c.arc(0, 0, radius, 0, TAU); c.stroke(); }
    for (let i = 0; i < 48; i++) {
      const a = i * TAU / 48, inside = i % 4 === 0 ? 72 : 77;
      c.beginPath(); c.moveTo(Math.cos(a) * inside, Math.sin(a) * inside); c.lineTo(Math.cos(a) * 81, Math.sin(a) * 81); c.stroke();
    }
    c.restore();
  }
  const routeEdges = new Set(view.route.slice(1).map((id, i) => edgeKey(id, view.route[i])));
  const routeNodes = new Set(view.route);
  // Curved connectors sit beneath nodes, with a dark engraving and a fine metal edge.
  for (const edge of edges) {
    const { a, b, control } = edge;
    const ax = sx(a.x), ay = sy(a.y), bx = sx(b.x), by = sy(b.y);
    const cx = control ? sx(control.x) : (ax + bx) / 2, cy = control ? sy(control.y) : (ay + by) / 2;
    if (Math.max(ax, bx, cx) < -12 || Math.min(ax, bx, cx) > w + 12 || Math.max(ay, by, cy) < -12 || Math.min(ay, by, cy) > h + 12) continue;
    const owned = view.allocated.has(a.id) && view.allocated.has(b.id);
    const route = routeEdges.has(edgeKey(a.id, b.id));
    const available = view.allocated.has(a.id) || view.allocated.has(b.id);
    const sameCluster = a.cluster && a.cluster === b.cluster;
    const color = a.domain === b.domain ? SKILL_DOMAIN_COLORS[a.domain] : '#b6ad8c';
    c.globalAlpha = owned || route || view.matches(a) || view.matches(b) ? 1 : .12;
    c.beginPath(); c.moveTo(ax, ay); c.quadraticCurveTo(cx, cy, bx, by);
    c.strokeStyle = '#040a10'; c.lineWidth = Math.max(1, 3 * Math.sqrt(z)); c.stroke();
    if (owned) { c.strokeStyle = '#e7be5b26'; c.lineWidth = Math.max(3, 7 * Math.sqrt(z)); c.stroke(); }
    c.strokeStyle = owned ? '#e9d094' : route ? '#d3c29d' : available ? '#b0a17d' : color + (sameCluster ? 'a0' : '83');
    c.lineWidth = owned ? Math.max(1.3, 1.8 * Math.sqrt(z)) : route ? 1.2 : Math.max(.45, .9 * Math.sqrt(z));
    if (route && !owned) c.setLineDash([4, 4]);
    c.stroke(); c.setLineDash([]);
  }
  c.globalAlpha = 1;
  const labels: Array<{x:number;y:number;width:number;height:number}> = [];
  const label = (value: string, x: number, y: number, color: string, size = 12, force = false) => {
    c.font = `${size}px ${UI_THEME.typography.font}`;
    const width = c.measureText(value).width + 12, height = size + 8;
    if (x + width / 2 < 0 || x - width / 2 > w || y < 0 || y + height > h - 4) return;
    if (!force && labels.some(box => Math.abs(box.x - x) < (box.width + width) / 2 + 4 && y < box.y + box.height + 3 && y + height > box.y - 3)) return;
    labels.push({ x, y, width, height });
    c.fillStyle = '#0a1219e8'; c.fillRect(x - width / 2, y - 2, width, height);
    c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = color; c.fillText(value, x, y + 1);
  };
  // Draw small travel nodes first; landmarks and their framed icons win visual priority.
  for (const node of SKILL_TREE.nodes) {
    const x = sx(node.x), y = sy(node.y), radius = Math.max(.72, skillNodeRadius(node) * z);
    if (x < -radius - 10 || x > w + radius + 10 || y < -radius - 10 || y > h + radius + 10) continue;
    const owned = view.allocated.has(node.id), reachable = view.reachable.has(node.id);
    const selected = view.selected === node.id, hover = view.hovered === node.id;
    const major = node.kind === 'major' || node.kind === 'origin', notable = node.kind === 'notable';
    const color = SKILL_DOMAIN_COLORS[node.domain];
    c.globalAlpha = owned || selected || hover || routeNodes.has(node.id) || view.matches(node) ? 1 : .16;
    if (owned || selected || hover || (major && z > .35)) {
      const light = c.createRadialGradient(x, y, radius * .2, x, y, radius * 2.7);
      light.addColorStop(0, (owned ? '#edcf87' : color) + '45'); light.addColorStop(1, color + '00');
      c.fillStyle = light; c.fillRect(x - radius * 2.7, y - radius * 2.7, radius * 5.4, radius * 5.4);
    }
    c.beginPath(); c.arc(x, y, radius, 0, TAU);
    c.fillStyle = owned ? '#4b442c' : major || notable ? '#142025' : '#101a1e'; c.fill();
    c.strokeStyle = owned ? '#f0d59a' : reachable ? '#cabb90' : major ? '#ab936b' : notable ? '#8b8168' : color + 'b0';
    c.lineWidth = major || notable ? Math.max(.9, 1.2 * z) : Math.max(.65, .8 * z); c.stroke();
    if ((major || notable) && radius >= 4) {
      c.strokeStyle = owned ? '#ab9760' : '#434636'; c.lineWidth = .65;
      c.beginPath(); c.arc(x, y, radius + (major ? 3 : 1) * z, 0, TAU); c.stroke();
      if (major) {
        for (let i = 0; i < 4; i++) {
          const a = Math.PI / 4 + i * Math.PI / 2;
          const tx = x + Math.cos(a) * (radius + 3 * z), ty = y + Math.sin(a) * (radius + 3 * z);
          c.fillStyle = owned ? '#e8cc8e' : '#9b8965'; c.save(); c.translate(tx, ty); c.rotate(a); c.fillRect(-1.8 * z, -1.8 * z, 3.6 * z, 3.6 * z); c.restore();
        }
      }
    }
    if (radius > 4.5) drawSkillGlyph(c, node, x, y, radius * (major ? 1.33 : 1.35), owned ? '#f3dda7' : color);
    else if (owned && radius > 1.8) { c.fillStyle = '#ffe5a8'; c.beginPath(); c.arc(x, y, radius * .4, 0, TAU); c.fill(); }
    if (selected || hover) {
      c.strokeStyle = selected ? '#f0d597' : '#b5c7bf'; c.lineWidth = 1;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x, y, radius + 7, i * TAU / 4 + .15, i * TAU / 4 + .9); c.stroke(); }
    }
  }
  c.globalAlpha = 1;
  const priorityNodes = SKILL_TREE.nodes.filter(node => node.kind === 'major' || node.kind === 'origin' || node.id === view.selected);
  for (const node of priorityNodes) {
    if (z < .15 || z < .36 && node.id !== view.selected) continue;
    label(node.kind === 'origin' ? 'THE FIRST STAR' : node.name, sx(node.x), sy(node.y) + skillNodeRadius(node) * z + 11,
      view.allocated.has(node.id) ? '#efdaad' : '#c8bba0', 12);
  }
  if (z >= .27 && z <= 1.6) for (const cluster of SKILL_TREE.clusters) {
    const x = sx(cluster.x), y = sy(cluster.y + cluster.radius + 22);
    if (x < 40 || x > w - 40 || y < 10 || y > h - 60) continue;
    label(cluster.name.toUpperCase(), x, y, SKILL_DOMAIN_COLORS[cluster.domain] + 'be', 10);
  }
  // A local hover card retains the name even at overview scale.
  if (view.hovered && view.hovered !== view.selected) {
    const node = SKILL_NODES.get(view.hovered)!;
    const x = Math.max(120, Math.min(w - 120, sx(node.x))), y = Math.max(8, sy(node.y) - skillNodeRadius(node) * z - 32);
    label(node.name, x, y, '#eee0bf', 13, true);
  }
}
