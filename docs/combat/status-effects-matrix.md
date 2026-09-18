# ⏱️ 状态异常与韧性矩阵规范 (Status Effects & Tenacity Matrix)

## 1. 核心状态异常列表

| 状态 ID | 状态名称 | 基础持续时间 | 异常效果 | 反应易伤联动 (Vulnerability) |
| :--- | :--- | :--- | :--- | :--- |
| `burn` | **灼烧 (Burn)** | 4.0s (DoT) | 每 0.25s 造成火属性伤害 | 易伤触发 **Overload** (超载) 与 **Combustion** (虚空燃爆) |
| `chill` | **冰霜 (Chilled)** | 4.0s | 移动与攻击速度减缓 40% | 易伤触发 **Melt** (融化)、**Superconduct** (超导) 与 **Singularity** (虚空坍缩) |
| `freeze` | **冻结 (Frozen)** | 1.8s | 完全无法移动或发起攻击 | 受到火属性必定触发融化破冰；易伤触发 **Singularity** |
| `fracture`| **破甲 (Fracture)** | 3.0s | 怪物物理与元素防御削减 20% | 与物理爆发及连击技能配合增伤 |
| `stagger` | **硬直 (Stagger)** | 0.8s ~ 1.2s | 打断当前蓄力与施法动作 | 奇点引力牵引提供 1.2s 强控硬直 |
| `stun` | **眩晕 (Stun)** | 1.5s | 无法行动与移动 | 盾击与重型控制技能提供 |

---

## 2. 内置冷却 (ICD - Internal Cooldown) 机制

为防止多段高频伤害技能（如旋风斩、流星雨）在单帧内引发反应死循环或无限连击，系统设立了目标级内置冷却：

```ts
export const ELEMENTAL_REACTION_RULES = Object.freeze({
  normalIcd: 0.4, // 普通怪物：0.4 秒反应冷却
  bossIcd: 2.5,   // 首领怪/精英Boss：2.5 秒反应冷却
});
```

- **逻辑流**：
  1. 命中敌人并成功触发元素反应时，立即设置 `enemy.reactionCooldown = isBoss ? bossIcd : normalIcd`。
  2. 在冷却期间，敌人依然承受常规伤害与元素状态挂附，但不会重复触发爆破/黑洞等二次物理结算。
  3. `enemy.reactionCooldown` 每帧随时间衰减至 0 后重新就绪。

---

## 3. 首领怪韧性保护机制 (Boss Tenacity & Immunity)

- **控制衰减**：Boss 受到 Singularity 牵引时，向心位移冲量受到 50% 韧性阻尼限制，避免将大型首领怪吸离战斗主场。
- **融化倍率适配**：Boss 触发 Melt 时采用独立的稳健倍率（1.3×），普通怪采用 1.6×。
- **免控窗口**：Boss 在狂暴阶段（Enrage）免疫强制位移与冻结，但依然正常受破甲（Fracture）与真实伤害（Combustion）影响。
