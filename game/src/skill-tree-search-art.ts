import { SKILL_TREE } from './skill-tree.ts';
import { skillNodeScreenRadius } from './skill-tree-labels.ts';
import type { SkillAtlasView } from './skill-tree-art.ts';

export const ATLAS_SEARCH_COLOR = '#ff9fdb';

/** All visible matches receive a screen-sized marker, including tiny travel nodes at overview. */
export function atlasSearchMarkers(view: SkillAtlasView) {
  if (!view.filterActive) return [];
  return SKILL_TREE.nodes.filter(node => view.matches(node)).map(node => ({
    id: node.id, x: (node.x - view.centerX) * view.zoom + view.width / 2,
    y: (node.y - view.centerY) * view.zoom + view.height / 2,
    radius: Math.max(4.5, skillNodeScreenRadius(node, view.zoom) + 3),
  })).filter(marker => marker.x + marker.radius + 10 >= 0 && marker.x - marker.radius - 10 <= view.width
    && marker.y + marker.radius + 10 >= 0 && marker.y - marker.radius - 10 <= view.height);
}

export function drawAtlasSearchMarkers(c: CanvasRenderingContext2D, view: SkillAtlasView): void {
  c.save(); c.globalAlpha = 1; c.strokeStyle = ATLAS_SEARCH_COLOR; c.lineWidth = 1.6;
  c.shadowColor = ATLAS_SEARCH_COLOR; c.shadowBlur = 8;
  for (const marker of atlasSearchMarkers(view)) {
    c.beginPath(); c.arc(marker.x, marker.y, marker.radius, 0, Math.PI * 2); c.stroke();
    if (view.zoom < .22) {
      c.beginPath(); c.arc(marker.x, marker.y, 1.8, 0, Math.PI * 2);
      c.fillStyle = '#ffe5f5'; c.fill();
    }
  }
  c.restore();
}
