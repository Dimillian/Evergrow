import { ItemTooltip } from './item-tooltip.ts';
import { groundLootIsSafe, hoveredGroundLoot, type GroundLootLabel } from './ground-loot-hover.ts';
import type { GroundItem } from './character-types.ts';
import type { Player, Enemy, Projectile } from './model.ts';
import type { CombatViewport } from './combat-visibility.ts';

/** DOM presentation of canvas loot. Owns no pickup, combat, pause or save state. */
export class GroundLootTooltip {
  private tooltip: ItemTooltip;
  private canvas: HTMLCanvasElement;
  private positionKey = '';
  private itemId: number | null = null;
  constructor(mount: HTMLElement, canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.tooltip = new ItemTooltip(mount, 'ground-item-tooltip');
  }
  update(player: Player, drops: readonly GroundItem[], enemies: readonly Enemy[], projectiles: readonly Projectile[],
    labels: readonly GroundLootLabel[], view: CombatViewport, width: number, height: number,
    pointer: { x: number; y: number } | null): void {
    const label = pointer && hoveredGroundLoot(labels, pointer.x, pointer.y);
    const drop = label && drops.find(d => d.id === label.id);
    if (!label || !drop || !groundLootIsSafe(player, drop, enemies, projectiles, view)) { this.hide(); return; }
    const canvas = this.canvas.getBoundingClientRect(), sx = canvas.width / width, sy = canvas.height / height;
    const bounds = { left: canvas.left + label.x * sx, right: canvas.left + (label.x + label.width) * sx,
      top: canvas.top + label.y * sy, bottom: canvas.top + (label.y + label.height) * sy };
    const key = [bounds.left, bounds.right, bounds.top, bounds.bottom].map(Math.round).join(':');
    if (this.itemId !== drop.id) {
      this.tooltip.show(drop.item, { sheet: player.character, level: player.level }, this.canvas, bounds);
      this.itemId = drop.id;
    } else if (key !== this.positionKey) this.tooltip.position(bounds);
    this.positionKey = key;
  }
  hide(): void { if (this.itemId === null) return; this.itemId = null; this.positionKey = ''; this.tooltip.hide(); }
  dispose(): void { this.tooltip.dispose(); }
}
