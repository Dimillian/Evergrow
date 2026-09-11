# Cloud saves on Sites

Local settlement rework · generation 10 (2026-09-09): three settlement tiers, outdoor starting refuges without houses, families, gambling and personal storage. Generation-9 characters upgrade on Continue, preserving progression and exploration. The original save is retained until the upgrade commits. The matching Worker accepts generation-9 uploads so an existing outbox can finish; the next saved bundle upgrades character and chart together. See the generation upgrade in `character-saves.md`. See [Settlements](settlements.md). Earlier generation/layout statements below describe the prior checkpoint.
Local regional scaling, 2026-09-08: The local regional-scaling pass adds optional encounter snapshots to shared validation. Current v4 saves and the existing v3 appearance migration remain supported; no D1 migration or generation reset. Saved actors, started events and entered dungeons preserve their original difficulty. The matching client/server build was published; see the verified release records. See [regional scaling](region-scaling.md).

Cloud saves deployed · 2026-09-06. Chronicle and the current cadence are included in the verified v0.5.0 publication on 2026-09-07.

## Player flow

The Sites build defaults to **Cloud** in the character hall. Sign in with ChatGPT to see eight account-owned slots. **Local** switches to the current browser’s existing characters without copying, replacing or deleting them. Android and ordinary local builds expose only local saves and never contact the cloud API.

Select a character and **Continue**, or choose an empty slot and **Create character**. The compact hall keeps the roster, starting gear and primary action together. Larger screens retain the equipped portrait; handheld layouts prioritize the controls. Extremely small split windows and enlarged text retain overflow as an accessibility fallback.

**File transfers are local-only** starting in v0.6.0 (2026-09-08). The Local tab retains Download/Import for a character and its explored chart; imports require an empty slot and create a new identity. Cloud hides both controls, the save hub rejects file transfers in Cloud mode, and the cloud repository/worker no longer expose bundle import/export operations. Android remains local-only without browser transfer controls.

Cloud characters are created in the cloud character hall. Localhost, Safari, Android and the hosted domain keep separate storage. Previously imported cloud characters are retained; this change does not reset progress, and all existing Cloud characters are included in the leaderboard. Normal authenticated save reads/uploads remain necessary for playing and synchronization. Removing supported file transfers is not competitive anti-cheat.

## Appearance schema checkpoint - 2026-09-07

The character-editor branch now uses save v4 with a required validated appearance recipe (head parts/colors, armor tints and helmet visibility). Valid pre-editor v3 characters migrate on decode with the default appearance, preserving progress and chart identity. Reads leave the original bytes untouched; the next successful save writes v4. Local saves, portable bundles and shared server validation use the same contract. The hosted client/server now include the appearance-aware save contract; older builds cannot read v4 exports. Compatible client/server builds are still required for synchronization. No database migration is needed.

## Storage and synchronization

Cloud recovery fix — published in v0.3.6 (2026-09-10): the character hall reads the roster without first flushing uploads. Cache summaries isolate incompatible characters per slot, preserving their bytes and keeping other slots usable. The upload loop continues past individual HTTP/save failures so a rejected early slot cannot starve a newly created character in another slot. Network, authentication and local storage failures still stop that upload pass.

Cloud worker startup now waits for IndexedDB readiness, handles startup errors and bounds an unresponsive startup to ten seconds. The hall distinguishes **Reload required** (a missing/failed game worker), **Storage unavailable**, **Cloud unavailable** and **Save needs attention** from **Offline**, with explicit Reload, Retry or sign-in actions. Reload is player initiated in the hall; it never clears browser storage or interrupts gameplay automatically. Retry reopens the same account database after a storage startup failure. Existing stale clients need a reload to receive this code.

Modern server checkpoints already store a validated Chronicle in D1. Replacement and explicit deletion use that ledger without requiring the old gameplay bundle to pass today's validator; deletion retains historical counters and marks the slot's characters deleted. Legacy rows without a ledger still require history reconstruction from their original checkpoint. Incompatible legacy data remains preserved. Backend diagnostics record HTTP status, route, a request reference and failure stage/code, excluding identities, save contents and storage object keys. No save reset or database migration.

The local storage-tab pass accepts one to five consecutive 96-item stash tabs in the shared character validator. Existing single-tab saves remain valid. Purchases save the gold debit and new capacity together through the usual durable NPC transaction. Ship the matching client and Worker together; no database migration or character reset is required.

As of the September 9 whole-number bonus pass, shared save decoding rounds validated item bonuses on the parsed copy, including equipped, stored and dropped items. This preserves ownership, recipe rolls, progress and the original stored bytes until a successful save; no schema or database migration is required. See [item rounding](equipment-affixes.md#weights-and-specialist-budgets).

- `save-hub.ts` selects the active repository and chart persistence. The Site-only build flag enables capability discovery; the Android bridge explicitly disables it.
- `cloud-client.ts` implements the same repository interface as `SaveClient`. Gameplay writes a durable local recovery bundle first, then uploads asynchronously. NPC transactions and reward commitments still wait for the local transaction, not a network round trip.
- `cloud-worker.ts` / `cloud-cache.ts` own serialization, validation and an account-scoped IndexedDB outbox. Character, map and upload state share one transaction. An immutable in-flight operation survives new checkpoints, interrupted uploads and browser restarts. Acknowledging an older upload never discards newer local progress.
- The server’s D1 row is the publication boundary. It holds owner, slot, monotonic revision, summary, current/previous private R2 keys and the last operation receipt. R2 objects are immutable. Failed upload/publication leaves the previous checkpoint readable; uncertain commits are checked before cleanup.
- Only acknowledged uploads show **Synced**. Pending uploads show **Saving…**; failures use the distinct states described above, plus **Conflict** and **Sign in again**. Routine checkpoints are durable locally every 20 seconds; explicit gear/point and transactional saves remain immediate. Pending uploads coalesce and publish every 30 seconds, plus explicit flushes on return to the hall, deletion and backgrounding. Clean slots generate no PUT requests. Offline uploads retry on the same cadence. Browser exit is best effort; leave the game open until Synced before switching devices.

The server retains one predecessor; older referenced backups are pruned after successful publication. Interrupted, unreferenced uploads can remain in R2 if cleanup cannot be confirmed. Scheduled orphan collection and an in-product server-backup restore flow are deferred.

## Cloud-first character selection — v0.3.9

The Cloud roster checks server summaries before choosing a character. Selecting a slot and pressing Continue each fetch the committed server revision; ordinary Local-tab saves are never consulted. A clean device cache adopts newer cloud data. An unsent checkpoint based on the same server revision remains available as **This device · awaiting upload**. If the server advanced independently, the hall shows **Cloud save** and **This device’s recovery** separately, with name, level, equipped gear power, played time and save date/time. Inspection never uploads or discards either branch.

Continue cannot silently load a conflicting recovery, including through keyboard/controller shortcuts or when another device saves after the portrait loaded. Explicit **Continue recovery** checks the displayed cache token; it keeps that branch local and blocked from uploading. Confirmed **Use cloud version** replaces the recovery with the latest server copy. Server deletions and incompatible recovery records remain visible without hiding readable cloud progress. Offline fallbacks are explicitly labeled as device copies; an unknown server branch is never presented as current.

The owned single-slot GET includes the last committed operation receipt. A lost upload acknowledgement can therefore be reconciled without a false conflict, preserving any subsequent unsent checkpoint. Cache metadata is reread after network waits, and revision/token guards prevent delayed reads from overwriting concurrent uploads or edits. Background conflict/sync changes refresh the selected hall character. No save reset or database migration is required.

## Conflicts

Every upload compares the server revision it started from. Two devices can play independently, but only one divergent branch can publish. The other remains a durable recovery copy with **Conflict**. Returning to the hall offers **Continue recovery** or a confirmed **Use cloud version** action. Choosing the cloud version explicitly discards the local recovery branch; cancelling preserves it. Cloud recovery has no file export. No field-level merging of XP, gold, items or world claims occurs.

**Delete** also works during a conflict. Its confirmation explicitly deletes both the cloud save and this device’s recovery copy; Conflict deletion requires a connection and compares the latest server revision before deleting. Recovery remains intact until the server acknowledges deletion. A failed request or concurrent server save leaves recovery available and shows a retry message; a concurrent recovery edit is retained. This deletion fix was published in v0.3.2.

There is no exclusive gameplay lease in this first implementation. Optimistic revision checks and idempotent operation receipts protect shared progress. Account changes invalidate requests rather than writing an old session into a different account.

## Authentication and API

Sites owns `/signin-with-chatgpt`, `/signout-with-chatgpt` and `/callback`; sign-in/out uses top-level navigation. The Worker trusts only the dispatcher’s `oai-authenticated-user-id`. This Worker must stay behind that dispatcher; do not expose it directly with caller-controlled identity headers. The request’s account header is an additional session-consistency check, never the authentication source.

| Route | Purpose |
| --- | --- |
| `GET /api/cloud/session` | Optional signed-in identity / capability |
| `GET /api/cloud/characters` | Eight owned summaries; no full checkpoints |
| `GET /api/cloud/characters/:slot` | Owned committed bundle, revision and last operation receipt |
| `PUT /api/cloud/characters/:slot` | Validated revision-checked publication; null bundle is a tombstone |

Private replies use `Cache-Control: no-store`. Writes require same-origin JSON, bounded streamed bodies, a valid operation ID, shared character/point/item/world validation and a chart matching the character’s world. Slot IDs are 0–7. Payloads are capped at 24 MiB on transport, with the existing smaller character/chart validators inside. These checks protect persistence integrity, not competitive anti-cheat. User-edited valid solo saves remain possible.

## Build and deployment

`npm run build:site` builds the Site-enabled Vite client into `dist/client/` and a Cloudflare Worker into `dist/server/index.js`. `sites()` stages hosting metadata and generated Drizzle migrations. `.openai/hosting.json` retains the existing Evergrow project and declares logical `DB` / `SAVES` bindings. Sites provisions their physical D1/R2 resources on deployment.

The schema entrypoint is `db/schema.ts`, re-exporting `game/server/schema.ts`; generate additive migrations with `cd game && npx drizzle-kit generate`. Existing applied migrations must not be rewritten. Regular `npm run dev`, `npm run build`, and `npm run android:build` remain local-only; no development identity reaches the production Worker.

`/title.html?cloud&full` stages the real hall with eight memory-only characters. Add `empty`, `signedout` or `conflict` for alternate states. This preview never signs in, contacts save APIs or starts gameplay.

## Leaderboard and home — published in v0.6.0

Every Cloud character now has an automatic public ranking projection: character name, level and equipped gear power. Multiple characters per account can appear. The home leaderboard queries D1 summaries without flushing the outbox; only missing gear scores trigger a bounded server-side read of existing R2 equipment. Local/Android saves remain private to their device. Migration `0002_amazing_old_lace.sql` adds the projections and backfills existing names/levels; migration `0003_blue_mercury.sql` enables automatic gear-score backfill without another player save. Backfill updates only ranking metadata and guards against concurrent saves/deletions. See [leaderboard and home](leaderboard.md) for scoring, controls and API details.

## Verification and remaining acceptance

Code tests exercise two-user isolation, two-writer races, stale deletion, duplicate requests, account mismatch, cross-origin requests, invalid stats/maps, failed R2/D1 writes, uncertain commit acknowledgements, outbox recovery/coalescing, explicit conflict replacement and atomic local import/export. Browser and Android builds are checked separately.

After the first approved deployment, verify the actual Sites sign-in dispatch, provisioned bindings and a same-account save/continue round trip on two browsers with the player. Sustained large-save latency, device-offline play and visual/controller acceptance remain player testing. This checkpoint has not exercised live cloud saves.

## Deployment checkpoint — 2026-09-06

The cloud/local character hall and account-owned save backend were published to the existing public [Evergrow Site](https://evergrow.dimillian.chatgpt.site) after approval. Sites reported deployment success for source `302202f`. Cross-client authenticated save/continue acceptance remains a player check; Android stays local-only.

## Chronicle — published in v0.5.0

Chronicle counters travel in the existing character checkpoint. D1 stores a validated history summary alongside each slot (including deleted-slot tombstones), updated by the same revision-checked publication. The authenticated Chronicle endpoint merges only the current account. IndexedDB cloud cache v2 preserves fetched account history offline. Local imports retain source identities and branch future progress to avoid double counting; cloud file imports are now disabled. No extra per-event upload requests. The subsequent local polish shows cached history before a server refresh, builds its compact projection in the storage worker, and does not flush saves when opening Chronicle. The successful v0.5.0 deployment includes `drizzle/0001_worthless_slipstream.sql` and matching client/server code. See [Chronicle](chronicle.md).

### Local resource repricing — September 11, 2026

Current local item recipes carry `manaVersion: 1`. Validated reads update prior mana capacity, regeneration and mana-on-kill values from their existing recipes across equipment, bag/charms, stash, buyback and all surface/dungeon ground items. Other affixes, random rolls, ownership and progress remain intact. Regeneration bonuses now represent mana per five seconds. Original stored bytes remain unchanged until a subsequent save. This change requires the matching client and Worker in the next publication and a client reload; it is not deployed by local testing. Older stored mana vials without a source amount remain collectible at the new level-one amount. No D1 migration or save reset.
