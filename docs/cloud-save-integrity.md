# Cloud save integrity review

Source review, 2026-09-08. No requests were sent to production and no player saves were changed.

## Current boundary

Cloud ownership comes from the Sites dispatcher identity, with account matching and owner-scoped queries. The Worker must remain behind that dispatcher. Origin/content-type checks, a 24 MiB request limit, atomic revision checks and operation receipts protect ordinary writes against cross-site requests, stale writers, conflicting retries and corruption. Shared validation checks save shape, level/point budgets, skill connectivity, equipment compatibility and many value bounds. These controls do not establish that progress was earned.

A modified authenticated client can submit a new, internally consistent checkpoint for its own account. The server does not replay combat or prove rewards against the previous checkpoint. Character creation also accepts a full client checkpoint. Client upload cadence is not a security limit: there is no application-level request rate limiter in the current Worker.

An isolated check of `decodeSaveBundle`, the validator called by the server, accepted both a starter save with invented gold and a starter save with inflated weapon damage. Item validation checks ranges and some relationships but does not compare every derived combat field to an authoritative recipe. The leaderboard recomputes equipped gear power, preventing a simple stored-power override, but still accepts client-reported level, item acquisition, rarity and enhancement history.

Removing cloud file import/download reduces supported transfer routes; it cannot stop authenticated custom uploads or browser-memory changes. Private-account isolation and competitive integrity are separate concerns.

## Recommended sequence

1. Rebuild item combat fields on the server from canonical recipes; reject impossible material/profile/affix combinations. Restrict new-character creation to a validated starter state and preserve character identity on updates.
2. Add server-side upload rate/size budgets and audit suspicious progression deltas against the previous accepted checkpoint and server time. Keep suspicious updates out of rankings pending review, without silently deleting the player's recovery save.
3. For strong competitive guarantees, move XP, item issuance, enhancement and currency transactions to server-owned rules with validated reward provenance. Plausibility checks alone cannot prove combat happened; signing arbitrary client-submitted results cannot solve that either.

These are proposals, not implemented anti-cheat protections. Current rankings should be treated as a casual leaderboard.
