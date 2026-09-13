import './ground-loot-highlight.css';
import { groundPickupProblem } from './ground-item-pickup.ts';
import { TIER_COLORS } from './items.ts';
import { hoveredGroundLoot, type GroundLootLabel } from './ground-loot-hover.ts';
import type { GroundItem } from './character-types.ts';
import type { Player } from './model.ts';
import { itemHoverCards } from './item-ui.ts';
import './item-ui.css';
import './tooltip-material.css';

/** Ground highlight follows the label; passive inspection follows the pointer. */
export class GroundLootHighlight {
  private affordance = document.createElement('div');
  private tooltip = document.createElement('div');
  private inspected: GroundItem['item'] | null = null;
  private inspectedLevel = -1;
  private inspectedStats: Player['stats'] | null = null;
  private cursor: string;
  private canvas: HTMLCanvasElement;
  constructor(mount: HTMLElement, canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.cursor = canvas.style.cursor;
    this.affordance.className = 'ground-loot-affordance';
    this.affordance.hidden = true;
    this.tooltip.className = 'ui-tooltip ui-item-tooltip-group ground-loot-tooltip';
    this.tooltip.setAttribute('role', 'tooltip');
    this.tooltip.setAttribute('aria-label', 'Ground item');
    this.tooltip.hidden = true;
    mount.append(this.affordance, this.tooltip);
  }
  update(player: Player, drops: readonly GroundItem[], labels: readonly GroundLootLabel[], width: number, height: number,
    pointer: { x: number; y: number } | null, time = 0, selectedId: number | null = null): void {
    const hovered = pointer && hoveredGroundLoot(labels, pointer.x, pointer.y);
    const label = hovered??labels.find(b=>b.id===selectedId && b.visible !== false);
    const drop = label && drops.find(d => d.id === label.id);
    if (!label || !drop) { this.hide(); return; }
    const problem=groundPickupProblem(player,drop,time);
    this.canvas.style.cursor=hovered?(problem?'not-allowed':'pointer'):this.cursor;
    const canvas = this.canvas.getBoundingClientRect(), sx = canvas.width / width, sy = canvas.height / height;
    const bounds = { left: canvas.left + label.x * sx, right: canvas.left + (label.x + label.width) * sx,
      top: canvas.top + label.y * sy, bottom: canvas.top + (label.y + label.height) * sy };
    const affordance=this.affordance;
    affordance.hidden=false;
    affordance.style.left=`${bounds.left}px`;affordance.style.top=`${bounds.top}px`;
    affordance.style.width=`${bounds.right-bounds.left}px`;affordance.style.height=`${bounds.bottom-bounds.top}px`;
    affordance.style.setProperty('--loot-accent',problem?'#9a9290':TIER_COLORS[drop.item.tier]);
    // Selected walking targets retain their highlight, but only actual mouse hover inspects.
    if (hovered) {
      if (this.inspected !== drop.item || this.inspectedLevel !== player.level || this.inspectedStats !== player.stats) {
        const cards = itemHoverCards(drop.item, { sheet: player.character, level: player.level, compactComparison: true });
        this.tooltip.innerHTML = cards.join('');
        this.tooltip.style.setProperty('--tooltip-columns', String(cards.length));
        this.inspected = drop.item;
        this.inspectedLevel = player.level;
        this.inspectedStats = player.stats;
      }
      this.tooltip.hidden = false;
      const x = canvas.left + pointer!.x * sx, y = canvas.top + pointer!.y * sy;
      const viewportWidth = document.documentElement.clientWidth, viewportHeight = document.documentElement.clientHeight;
      const tooltipWidth = this.tooltip.offsetWidth, tooltipHeight = this.tooltip.offsetHeight;
      const gap = 16, margin = 16;
      let left = x + gap, top = y + gap;
      if (left + tooltipWidth > viewportWidth - margin) left = x - tooltipWidth - gap;
      if (top + tooltipHeight > viewportHeight - margin) top = y - tooltipHeight - gap;
      this.tooltip.style.left = `${Math.max(margin, Math.min(viewportWidth - tooltipWidth - margin, left))}px`;
      this.tooltip.style.top = `${Math.max(margin, Math.min(viewportHeight - tooltipHeight - margin, top))}px`;
      // Keep the hovered loot nearest the cursor when the comparison flips left.
      const cards = [...this.tooltip.children] as HTMLElement[];
      const stacked = viewportWidth <= 680;
      cards.forEach((card, index) => { card.style.order = String(!stacked && left < x ? (index === 0 ? cards.length - 1 : index - 1) : index); });
    } else this.hideTooltip();
  }
  private hideTooltip(): void { this.tooltip.hidden = true; this.inspected = null; }
  hide(): void { this.affordance.hidden = true; this.hideTooltip(); this.canvas.style.cursor = this.cursor; }
  dispose(): void { this.hide(); this.affordance.remove(); this.tooltip.remove(); }
}
