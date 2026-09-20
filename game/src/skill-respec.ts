import type { ActionResult, CharacterSheet } from './character-types.ts';
import { spendGold } from './wallet.ts';
import { SKILL_NODES } from './skill-tree.ts';
import { learnedSkillRank, OVERLOAD_NODE } from './skill-progression.ts';
import { auraReservation } from './aura-content.ts';

export const RESPEC_GOLD_PER_POINT = 25;
export const respecPoints = (sheet: CharacterSheet): number => sheet.allocatedNodes.length - 1
  + Object.values(sheet.skillRanks).reduce((sum, rank) => sum + rank - 1, 0);

export interface SkillChainRefund { nodeIds: string[]; points: number; }

/** Only nodes that lose every allocated path to Origin belong to the refund. */
export function planSkillChainRefund(sheet: CharacterSheet, id: string): SkillChainRefund | null {
  const node = SKILL_NODES.get(id);
  if (!node || node.kind === 'origin' || !sheet.allocatedNodes.includes(id) || node.skill && learnedSkillRank(sheet, node.skill) > 1) return null;
  const remaining = new Set(sheet.allocatedNodes); remaining.delete(id);
  const reached = new Set(['origin']), queue = ['origin'];
  for (let i = 0; i < queue.length; i++) for (const neighbor of SKILL_NODES.get(queue[i])!.neighbors) {
    if (remaining.has(neighbor) && !reached.has(neighbor)) { reached.add(neighbor); queue.push(neighbor); }
  }
  const nodeIds = [id, ...[...remaining].filter(nodeId => !reached.has(nodeId)).sort()];
  const points = nodeIds.reduce((sum, nodeId) => {
    const skill = SKILL_NODES.get(nodeId)?.skill;
    return sum + (skill ? learnedSkillRank(sheet, skill) : 1);
  }, 0);
  return { nodeIds, points };
}

/** Refund one purchased point, keeping every remaining allocation connected to Origin. */
export function refundSkillPoint(sheet: CharacterSheet, id: string, confirmedChain?: SkillChainRefund): ActionResult {
  const node = SKILL_NODES.get(id);
  if (!node || !sheet.allocatedNodes.includes(id)) return { ok: false, message: 'This node has no invested point.' };
  if (node.kind === 'origin') return { ok: false, message: 'Origin cannot be refunded.' };
  const chain = planSkillChainRefund(sheet, id);
  if (confirmedChain && (!chain || chain.points !== confirmedChain.points || chain.nodeIds.length !== confirmedChain.nodeIds.length
      || chain.nodeIds.some((nodeId, i) => nodeId !== confirmedChain.nodeIds[i])))
    return { ok: false, message: 'Your build changed. Review the chain refund again.' };
  if (chain && chain.nodeIds.length > 1 && !confirmedChain)
    return { ok: false, message: 'Confirm the chain refund first.' };
  const points = chain?.points ?? 1, price = points * RESPEC_GOLD_PER_POINT;
  if (!Number.isSafeInteger(sheet.skillPoints) || sheet.skillPoints < 0 || !Number.isSafeInteger(sheet.skillPoints + points))
    return { ok: false, message: 'This refund exceeds the supported limit.' };
  const next: CharacterSheet = { ...sheet, allocatedNodes: [...sheet.allocatedNodes], skillSlots: [...sheet.skillSlots],
    skillRanks: { ...sheet.skillRanks }, activeSkillRanks: { ...sheet.activeSkillRanks }, skillSpecializations: { ...sheet.skillSpecializations } };
  const rank = node.skill ? learnedSkillRank(sheet, node.skill) : 0;
  if (node.skill && rank > 1) {
    if (rank === 2) delete next.skillRanks[node.skill]; else next.skillRanks[node.skill] = rank - 1;
    if (next.activeSkillRanks[node.skill] !== undefined) next.activeSkillRanks[node.skill] = Math.min(next.activeSkillRanks[node.skill]!, rank - 1);
    if (auraReservation(next) >= 100) return { ok: false, message: 'This rank would reserve all your mana. Unassign an aura first.' };
  } else {
    const removed = new Set(chain!.nodeIds);
    next.allocatedNodes = next.allocatedNodes.filter(nodeId => !removed.has(nodeId));
    for (const nodeId of removed) {
      const removedNode = SKILL_NODES.get(nodeId)!;
      if (removedNode.skill) {
        delete next.skillRanks[removedNode.skill]; delete next.activeSkillRanks[removedNode.skill]; delete next.skillSpecializations[removedNode.skill];
        next.skillSlots = next.skillSlots.map(skill => skill === removedNode.skill ? null : skill);
      }
      if (removedNode.specialization && removedNode.developmentSkill && next.skillSpecializations[removedNode.developmentSkill] === removedNode.specialization)
        delete next.skillSpecializations[removedNode.developmentSkill];
      if (nodeId === OVERLOAD_NODE) next.arcaneOverload = false;
    }
  }
  if (!spendGold(next, price)) return { ok: false, message: `This refund costs ${price} gold.` };
  next.skillPoints += points;
  Object.assign(sheet, next);
  return { ok: true, message: `${points} skill ${points === 1 ? 'point' : 'points'} refunded · ${price} gold.` };
}

/** Shared paid refund for the atlas and enchanter. Validate before changing the ledger. */
export function resetSkillTree(sheet: CharacterSheet, expectedPoints: number): ActionResult {
  const points = respecPoints(sheet);
  if (!Number.isSafeInteger(points) || points <= 0) return { ok: false, message: 'No spent skill points to refund.' };
  if (points !== expectedPoints) return { ok: false, message: 'Your build changed. Review the respec cost again.' };
  if (!Number.isSafeInteger(sheet.skillPoints + points)) return { ok: false, message: 'This refund exceeds the supported limit.' };
  if (!spendGold(sheet, points * RESPEC_GOLD_PER_POINT)) return { ok: false, message: 'Not enough gold.' };
  sheet.skillPoints += points;
  sheet.allocatedNodes = ['origin'];
  sheet.skillRanks = {}; sheet.activeSkillRanks = {}; sheet.skillSpecializations = {};
  sheet.skillSlots = Array(5).fill(null); sheet.arcaneOverload = false;
  return { ok: true, message: `${points} skill points refunded.` };
}
