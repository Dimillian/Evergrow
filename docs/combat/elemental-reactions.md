# ⚡ 元素反应与物理/数学模型设计规范 (Elemental Reactions & Physics Specification)

## 1. 基础元素体系 (Base Elements)

Evergrow 包含五大基础元素/魔法流派：
- 🔥 **火 (Fire)**：造成直接伤害并附加 `Burn`（灼烧 DoT），每秒造成火属性伤害。
- ❄️ **冰 (Frost)**：施加 `Chill`（40% 减速），满层或强效技能造成 `Freeze`（冻结无法行动）。
- ⚡ **雷 (Lightning)**：高暴击率，攻击伴随电弧传导，造成瞬时爆发。
- 🔮 **奥术 / 虚空 (Arcane / Void)**：纯净魔法能量与空间扭曲，擅长时空重力操控与真伤打击。
- ⚔️ **物理 (Physical)**：受怪物护甲 (Armor) 减免，可配合击退与格挡机制。

---

## 2. 元素反应全景矩阵 (Reaction Matrix)

| 阶段 | 反应名称 | 触发组合 | 基础倍率 / 范围 | 核心机制与物理反馈 |
| :--- | :--- | :--- | :--- | :--- |
| **阶段 1** | **融化 (Melt)** | 火 (`Fire`) 命中 冰霜目标 (`Frost/Freeze`) | 1.6× 伤害 (Boss 1.3×) | 消耗冰霜状态，触发金黄色高温融解爆发。 |
| **阶段 1** | **超载 (Overload)** | 雷 (`Lightning`) 命中 灼烧目标 (`Burn`) | 140px 半径 AoE | 消耗灼烧，向外径向推开怪物，造成 0.5× 范围伤害。 |
| **阶段 1** | **超导 (Superconduct)** | 雷 (`Lightning`) 命中 冰霜目标 (`Frost`) | 3.0s 持续时间 | 产生冰蓝冲击，降低目标 20% 护甲 (`Fracture`) 并延长硬直。 |
| **阶段 2** | **引力奇点 (Singularity)**| 奥术 (`Arcane`) 命中 冰霜目标 (`Frost/Freeze`) | 1.45× 伤害 / 180px 范围 | **向心引力场物理吸入** + 1.2s 破韧硬直 + 黑洞视界。 |
| **阶段 2** | **虚空燃爆 (Combustion)** | 奥术 (`Arcane`) 命中 灼烧目标 (`Burn`) | 1.5× 真实伤害 / 120px 范围 | **无视护甲 True Damage** + 太阳耀斑冲击波 + 范围引燃。 |
| **阶段 2** | **超导连锁 (Cascade)** | 超载波及命中冰霜次级目标 | 0.3× 额外伤害 / 链式电弧 | **次级连锁闪电** + 群体破甲扩散 + 连锁硬直。 |

---

## 3. 【引力奇点 Singularity】物理与数学模型解析

### 3.1 向心速度矢量公式
当 Singularity 在坐标 $\vec{P}_{center}$ 触发时，对半径 $R = 180\text{px}$ 内的敌方单位 $\vec{P}_{enemy}$ 施加即时向心初速度：

$$\vec{v}_{pull} = \frac{\vec{P}_{center} - \vec{P}_{enemy}}{|\vec{P}_{center} - \vec{P}_{enemy}|} \times V_{max} \times \left(1 - \frac{dist}{R}\right)$$

其中：
- $\hat{u}_{pull} = \frac{\vec{P}_{center} - \vec{P}_{enemy}}{|\vec{P}_{center} - \vec{P}_{enemy}|}$ 为指向黑洞中心的**单位向心矢量 (Normalized Centripetal Unit Vector)**。
- $dist = |\vec{P}_{center} - \vec{P}_{enemy}|$ 为目标到奇点中心的欧氏距离。
- $V_{max} = 240\text{ px/s}$ 为奇点中心爆发的最大瞬时牵引冲量速度。
- $\left(1 - \frac{dist}{R}\right)$ 为**线性距离衰减权重 (Linear Distance Falloff)**。
- 引入最大冲量限速阀值：$v_{clamped} = \min(130, |\vec{v}_{pull}|)$，防止近距离单位产生超高速穿模。

### 3.2 为什么采用线性衰减而非天体物理反平方律？
1. **反平方律局限 ($F \propto 1/r^2$)**：
   在真实万有引力中，当 $r \to 0$ 时引力趋向无穷大。若在 2D 俯视角动作游戏中采用 $1/r^2$，黑洞核心附近的怪物会获得无限大的加速度，导致瞬间穿模碰撞盒、怪物堆叠振荡或穿出屏幕。
2. **线性衰减模型优势**：
   - **边缘平滑过渡**：当 $dist \to 180\text{px}$ 时，衰减权重趋于 0，使得引力场边界外的怪物不会感受到突兀的瞬时顿移。
   - **核心聚集适度**：当怪物被拉入核心后，受阻尼衰减速度自然降为 0，刚好形成紧凑的聚怪阵列供玩家使用 AoE 技能收割。

### 3.3 物理惯性阻尼结合 (Knockback Damping)
Evergrow 物理引擎通过 `COMBAT_TIMING.knockbackDecay` 进行每帧速度指数衰减：

$$\vec{v}(t) = \vec{v}_{pull} \cdot e^{-t \cdot \gamma_{decay}}$$

使得怪物在 $1.2\text{s}$ 内呈现“**先迅猛被扯入、再平滑减速定格在黑洞视界边缘**”的自然物理手感。

---

## 4. 【虚空燃爆 Combustion】真实伤害与热扩散模型

1. **真实伤害机制 (True Damage)**：
   - 传统伤害计算公式：$Damage_{final} = Damage_{base} \times (1 - \text{ArmorReduction})$
   - Combustion 真实伤害公式：$Damage_{true} = Damage_{base} \times 1.5$，**跳过所有护甲减免与防御抗性判定**，专克高甲高防精英怪。
2. **热能扩散链 (Thermal Proliferation)**：
   - 对中心 $120\text{px}$ 范围内的所有从属敌怪触发 `applyElementalContact(other, 'fire', statusDamage * 0.6)`，赋予基础火属性灼烧并造成 $0.4\times$ 溅射冲击。

---

## 5. 【超导连锁 Cascade】链式图遍历算法

1. 超载主爆炸产生向外击退冲击波。
2. 射线检测所有受波及目标：
   ```ts
   if (otherHasFrost && dist <= overloadRadius) {
     // 触发级联连锁
     emitChainLightning(primary.x, primary.y, other.x, other.y);
     applyFractureDebuff(other, duration = 3.0s, shred = 20%);
     applyStagger(other, bonus = 0.25s);
   }
   ```
3. 动态生成两段锯齿折线光束，在多个冰霜目标之间形成蛛网式导电视觉。
