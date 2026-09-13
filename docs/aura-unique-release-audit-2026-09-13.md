# Aura, Unique and tooltip release audit

Scope: seven auras, eighteen Uniques, shared buff/debuff projections and retained/nested tooltips, including save restoration and rank/resource boundaries. This is a source and headless-runtime audit; gameplay feel remains a player check.

## Corrected findings

- Thornbound's boss slow previously lasted 0.325 seconds between 0.6-second pulses. Keep its refresh coverage continuous while retaining half potency, line of sight and the short exit grace.
- Character refresh previously constrained ward/barrier capacities before updating maximum life. Refresh resource limits first, normalize the surviving ward, then calculate the Unique barrier's remaining budget. Equipment changes now produce a consistent immediate combat and UI projection.
- Keyboard activation of focused buff icons and nested explanation terms could bubble to gameplay shortcuts. Preserve native button activation and focus navigation, stop unrelated game input, and retain deepest-first Escape handling.

## Coverage

- Aura admission, allocation paths, all twenty ranks, downranking rejection, resource recovery ceilings, no refill on removal and checkpoint restoration.
- Actual physical mitigation, same-target melee buildup, stationary cost recovery, periodic elemental pulse exclusions, continuous boss slow, matching-element Exposure and released-arrow snapshots.
- Every Unique with Original and all three Techniques; projectile return/rebound budgets, charge/release cancellation, paid Fireball storage, terrain, ward rupture, barrier caps, marks, expiry, removal and restored checkpoints.
- Shared item/stat/Unique explanations, current resolved skill values, status durations and target ownership; escaped glossary markup and bounded nested-card placement.

No drop-rate or general damage-balance change is introduced by these audit fixes. Existing saves remain supported. The concurrent custom-controls work is outside this release snapshot.
