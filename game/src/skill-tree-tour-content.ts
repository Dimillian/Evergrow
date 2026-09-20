import { SKILL_TREE } from './skill-tree.ts';
import { SKILL_RANK_RULES } from './skill-progression.ts';
import { RESPEC_GOLD_PER_POINT } from './skill-respec.ts';
import { SKILL_DEFINITIONS } from './skill-content.ts';

const passive = SKILL_TREE.nodes.find(n => n.kind === 'notable' && !n.skill && !n.specialization && !n.doctrine)!;
const aura = SKILL_TREE.nodes.find(n => n.skill && SKILL_DEFINITIONS[n.skill].tier === 'aura')!;
// The tour's examples always reference runtime nodes; they never allocate them.
export interface SkillTourExample { node: string; label: string; description: string }
export interface SkillTourStep {
  id: 'welcome' | 'passives' | 'find' | 'inspect' | 'assign' | 'develop' | 'choices' | 'refund' | 'explore';
  title: string; body: string; hint: string; node: string;
  target?: string; examples?: readonly SkillTourExample[];
}
export const SKILL_TOUR_STEPS: readonly SkillTourStep[] = [
  { id: 'welcome', title: 'One path at a time', node: 'origin',
    body: 'Your build begins at the Root. You earn one skill point each level, then choose where to grow. You can mix any of the six territories.',
    hint: 'This short guide only looks around. Your points and build stay yours.' },
  { id: 'passives', title: 'Every step gives you something', node: 'road:crucible:1',
    body: 'Follow connected nodes from your invested path. Small nodes grant bonuses along the way; larger passives offer a stronger or more specialized benefit.',
    hint: 'Gold means invested. A blue route is only a plan, not a purchase.',
    examples: [
      { node: 'road:crucible:1', label: 'Travel & passives', description: 'Bonuses that apply while invested.' },
      { node: passive.id, label: 'Notable passive', description: 'A larger bonus or a special mechanic.' },
    ] },
  { id: 'find', title: 'Pick a skill to build toward', node: 'skill:fireball', target: '.skill-atlas-toolbar',
    body: 'Skills highlights the unlocks. Filter by weapon—or Equipped gear—to find a good fit. Search can also find bonuses such as critical damage.',
    hint: 'Select a destination to see its route and remaining point cost. Skills and weapon filters keep your view in place.',
    examples: [{ node: 'skill:fireball', label: 'Active skill', description: 'Large, double-ring nodes unlock actions. Ultimates are farther along the branches.' }] },
  { id: 'inspect', title: 'See what you’re getting', node: 'skill:fireball', target: '.skill-atlas-inspection',
    body: 'The sidebar brings together effects, mana, cooldown and equipment requirements. Fireball, for example, needs a staff or wand. Open Preview to watch a skill before spending points.',
    hint: 'Allocate path buys the displayed route if you can afford it. Double-clicking an unspent node does the same. Incompatible gear prevents casting, even after unlocking.' },
  { id: 'assign', title: 'Unlock it, then equip it', node: 'skill:fireball', target: '.skill-atlas-loadout',
    body: 'Select an unlocked skill, then choose one of the five skill-bar slots. Your weapon’s basic attack stays separate. Unlocking a skill alone does not put it on your bar.',
    hint: 'Auras use these same slots: assigning one activates its ongoing effect and reserves part of your mana.',
    examples: [{ node: aura.id, label: 'Aura', description: 'Always active while assigned. Leave enough mana for your other skills.' }] },
  { id: 'develop', title: 'Grow a favorite—or change its behavior', node: 'specialization:fireball-ember',
    body: `Skills have up to ${SKILL_RANK_RULES.maximum} purchased ranks. Each upgrade costs one point. Higher ranks improve the skill; spells can also cost more mana. Use a lower casting rank when you want to conserve mana.`,
    hint: 'Techniques are optional one-point branches. Unlock several, then choose one at a time in the skill’s sidebar—or keep Original.',
    examples: [{ node: 'specialization:fireball-ember', label: 'Technique', description: 'Changes how a skill works. Preview it and compare the effects first.' }] },
  { id: 'choices', title: 'Some nodes ask for a tradeoff', node: 'keystone:open-hand',
    body: 'Doctrines let you choose one bonus from a family. Keystones reshape your build with a benefit and a drawback, sometimes tied to particular equipment.',
    hint: 'Read the condition as well as the bonus. Open Hand rewards one melee weapon with an empty offhand; other loadouts take a damage penalty.',
    examples: [
      { node: SKILL_TREE.nodes.find(n => n.doctrine)!.id, label: 'Doctrine', description: 'One choice per family.' },
      { node: 'keystone:open-hand', label: 'Keystone', description: 'A powerful benefit with a tradeoff.' },
    ] },
  { id: 'refund', title: 'You can change your mind', node: 'origin', target: '[data-tree="respec"]',
    body: `Right-click an invested node to refund one point for ${RESPEC_GOLD_PER_POINT} gold. Purchased ranks come off first. If removing a node disconnects a chain, you’ll see its full refund and price before confirming.`,
    hint: 'Respec refunds the whole tree and purchased ranks for the same price per point. It clears skill-bar assignments, but keeps your attributes, gear and world progress.' },
  { id: 'explore', title: 'Start with one skill you want', node: 'origin', target: '.skill-atlas-zoom',
    body: 'Drag to explore and scroll or pinch to zoom. Origin brings you home; All shows the whole tree. The mini-atlas jumps to another area. Click empty space to clear a selection.',
    hint: 'You don’t need to understand every branch today. Choose a skill, check its requirements, and follow your next few steps. Replay this tour anytime with Guide.' },
];
