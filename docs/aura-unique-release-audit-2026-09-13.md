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

No drop-rate or general damage-balance change is introduced by these audit fixes. Existing saves remain supported. The release also includes custom controls; focused buff/explanation input tests cover Space, Enter, Tab and rebound gameplay keys, preserving native activation while preventing combat leakage. Potion glossary text no longer assumes its default binding.

## Verification

All 1,403 combined code tests passed, including actual combat and DOM event-owner regressions. After incorporating the already-merged CSS-only mobile gesture correction, all 19 affected touch/input/release-note checks passed. Application and core type checks, local and cloud-enabled production client/Worker builds, archive validation and clean-source release validation passed. Published as v0.5.1; see the verified publication record in `releases.md`.
