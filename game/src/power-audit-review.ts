import { buildPowerAudit, readAuditSample, enemyAudit, type AuditSample } from './power-audit.ts';
import { ENEMY_DEFINITIONS } from './combat-content.ts';
import { escapeUI as e } from './ui-components.ts';
import { downloadJSON } from './tools/common.ts';

/** Disposable input files only. No playable session, save repository or cloud writes. */
export function mountPowerAudit(root: HTMLElement, signal: AbortSignal) {
  let sample: AuditSample = {};
  const fmt = (n: number) => new Intl.NumberFormat('en', {maximumFractionDigits:2}).format(n);
  root.innerHTML = `<header class="study-heading"><div><h1>Combat power audit</h1><p>Inspect current rules, import a read-only snapshot, and compare proposed enemy tuning.</p></div></header>
    <section class="ui-window study-controls"><label>Character snapshot<input type="file" accept=".json,application/json" data-snapshot class="ui-well"></label>
    <label>Enemy level<input type="number" min="1" max="1000000" step="1" value="32" data-level class="ui-well"></label>
    <label>Health ×<input type="number" min="0.25" max="5" step="0.05" value="1" data-health class="ui-well"></label>
    <label>Damage ×<input type="number" min="0.25" max="5" step="0.05" value="1" data-damage class="ui-well"></label>
    <label>Recovery time ×<input type="number" min="0.25" max="2" step="0.05" value="1" data-recovery class="ui-well"></label>
    <button type="button" class="ui-button" data-export>Export audit</button></section>
    <p data-status role="status">No character loaded. Tables below describe the game rules, not your build.</p>
    <div data-results></div>`;
  const input = (name: string) => root.querySelector<HTMLInputElement>(`[data-${name}]`)!;
  const val = (name: string, min: number, max: number) => {
    const control = input(name), value = Number(control.value);
    const bounded = Number.isFinite(value) ? Math.min(max,Math.max(min,value)) : 1;
    control.value = String(bounded); return bounded;
  };
  function render() {
    const level = Math.floor(val('level',1,1e6)), hp = val('health',.25,5), damage = val('damage',.25,5), recovery = val('recovery',.25,2);
    const report = buildPowerAudit(sample);
    const rows = (['stalker','brute','caster'] as const).flatMap(kind => (['normal','veteran','elite'] as const).map(rank => {
      const base = ENEMY_DEFINITIONS[kind], stats = enemyAudit(level,kind,rank);
      const cadence = 1 / (base.windup + base.active + stats.recovery * recovery);
      return `<tr><th>${e(base.name)} · ${rank}</th><td>${fmt(stats.maxHp)} → ${fmt(stats.maxHp*hp)}</td><td>${fmt(stats.damage)} → ${fmt(stats.damage*damage)}</td><td>${fmt(stats.idealAttacksPerSecond)} → ${fmt(cadence)}</td><td>${fmt(stats.rawIdealDps)} → ${fmt(stats.damage*damage*cadence)}</td></tr>`;
    }));
    const metricRows = report.sample ? Object.entries(report.sample.metrics).map(([key,value])=>`<tr><th>${e(key)}</th><td>${fmt(value)}</td></tr>`).join('') : '';
    const exact = report.exactBuild;
    root.querySelector('[data-results]')!.innerHTML = `
      <section class="ui-window study-detail"><h2>Enemy pressure · level ${level}</h2><p>Current → proposed. Ideal back-to-back attacks, before armor, resistance, block, misses or control. Windups stay unchanged.</p>
      <div class="study-table-wrap"><table><thead><tr><th>Enemy</th><th>Life</th><th>Raw hit</th><th>Attacks / second</th><th>Raw damage / second</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></section>
      ${exact ? `<section class="ui-window study-detail"><h2>${e(exact.name)} · Lv ${exact.level}</h2><p>Life ${fmt(exact.hp)} · Mana ${fmt(exact.mana)} · Basic theoretical DPS ${fmt(exact.basicDps)}</p><pre>${e(JSON.stringify(exact.arc,null,2))}</pre><p>Skill estimate excludes mana downtime, travel, missed targets and temporary combat buffs.</p></section>` : '<p>A full character snapshot is required for current DPS, resistances, charm bonuses, tree and mana sustainability. Summary power alone cannot reconstruct them.</p>'}
      ${report.sample ? `<section class="ui-window study-detail"><h2>${e(report.sample.name)} · cloud history</h2><p>Level ${report.sample.level} · ${e(new Date(report.sample.updatedAt).toISOString())}. Cumulative across the journey; not current combat DPS.</p><div class="study-table-wrap"><table><tbody>${metricRows}</tbody></table></div></section>` : ''}
      <section class="ui-window study-detail"><h2>Level growth · relative to level one</h2><div class="study-table-wrap"><table><thead><tr><th>Level</th><th>Weapon</th><th>Monster life</th><th>Monster hit</th><th>Weapon + 3 Int / level</th><th>Enemy cadence</th></tr></thead><tbody>${report.growth.filter(p=>[1,12,20,32,50,100].includes(p.level)).map(p=>`<tr><th>${p.level}</th><td>${fmt(p.weapon)}×</td><td>${fmt(p.monsterHp)}×</td><td>${fmt(p.monsterHit)}×</td><td>${fmt(p.casterHit)}×</td><td>${fmt(p.enemyCadence)}×</td></tr>`).join('')}</tbody></table></div><p>Attribute-only caster illustration: same-quality weapon, no affixes, charms, tree or skill multipliers.</p></section>`;
    root.dataset.ready = 'true'; root.setAttribute('aria-busy','false');
  }
  root.querySelector('[data-snapshot]')!.addEventListener('change', async () => {
    const file = input('snapshot').files?.[0]; if (!file) return;
    const status = root.querySelector<HTMLElement>('[data-status]')!;
    try {
      if (file.size > 24 * 1024 * 1024) throw new Error('Snapshot is too large.');
      const next = readAuditSample(await file.text()); if (signal.aborted) return;
      sample = next; input('level').value = String(sample.record?.checkpoint.level ?? sample.observation?.level ?? 32);
      status.textContent = sample.record ? 'Full character loaded into disposable memory.' : 'Cloud summary and cumulative history loaded. Full gear/tree snapshot unavailable.';
      status.setAttribute('role','status'); render();
    } catch (error) { status.textContent = String(error); status.setAttribute('role','alert'); }
  }, {signal});
  for (const name of ['level','health','damage','recovery']) input(name).addEventListener('change',render,{signal});
  root.querySelector('[data-export]')!.addEventListener('click',()=>downloadJSON('power-audit.json', {
    ...buildPowerAudit(sample), proposal: {level:Number(input('level').value),health:Number(input('health').value),damage:Number(input('damage').value),recovery:Number(input('recovery').value)}
  }),{signal});
  render();
}
