# Cloud saves on Sites

Cloud saves deployed · 2026-09-06. Chronicle and the current cadence are included in the verified v0.5.0 publication on 2026-09-07.

## Player flow

The Sites build defaults to **Cloud** in the character hall. Sign in with ChatGPT to see eight account-owned slots. **Local** switches to the current browser’s existing characters without copying, replacing or deleting them. Android and ordinary local builds expose only local saves and never contact the cloud API.

Select a character and **Continue**, or choose an empty slot and **Create character**. The compact hall keeps the roster, starting gear and primary action together. Larger screens retain the equipped portrait; handheld layouts prioritize the controls. Extremely small split windows and enlarged text retain overflow as an accessibility fallback.

**File transfers are local-only** in the next update (2026-09-08, pending publication). The Local tab retains Download/Import for a character and its explored chart; imports require an empty slot and create a new identity. Cloud hides both controls, the save hub rejects file transfers in Cloud mode, and the cloud repository/worker no longer expose bundle import/export operations. Android remains local-only without browser transfer controls.

Cloud characters are created in the cloud character hall. Localhost, Safari, Android and the hosted domain keep separate storage. Previously imported cloud characters are retained; this change does not reset progress or establish eligibility for the proposed leaderboard. Normal authenticated save reads/uploads remain necessary for playing and synchronization. Removing supported file transfers is not competitive anti-cheat.

## Appearance schema checkpoint - 2026-09-07

The character-editor branch now uses save v4 with a required validated appearance recipe (head parts/colors, armor tints and helmet visibility). Valid pre-editor v3 characters migrate on decode with the default appearance, preserving progress and chart identity. Reads leave the original bytes untouched; the next successful save writes v4. Local saves, portable bundles and shared server validation use the same contract. The hosted client/server now include the appearance-aware save contract; older builds cannot read v4 exports. Compatible client/server builds are still required for synchronization. No database migration is needed.

## Storage and synchronization

- `save-hub.ts` selects the active repository and chart persistence. The Site-only build flag enables capability discovery; the Android bridge explicitly disables it.
- `cloud-client.ts` implements the same repository interface as `SaveClient`. Gameplay writes a durable local recovery bundle first, then uploads asynchronously. NPC transactions and reward commitments still wait for the local transaction, not a network round trip.
- `cloud-worker.ts` / `cloud-cache.ts` own serialization, validation and an account-scoped IndexedDB outbox. Character, map and upload state share one transaction. An immutable in-flight operation survives new checkpoints, interrupted uploads and browser restarts. Acknowledging an older upload never discards newer local progress.
- The server’s D1 row is the publication boundary. It holds owner, slot, monotonic revision, summary, current/previous private R2 keys and the last operation receipt. R2 objects are immutable. Failed upload/publication leaves the previous checkpoint readable; uncertain commits are checked before cleanup.
- Only acknowledged uploads show **Synced**. Other compact states are **Saving…**, **Offline**, **Conflict** and **Sign in again**. Routine checkpoints are durable locally every 20 seconds; explicit gear/point and transactional saves remain immediate. Pending uploads coalesce and publish every 30 seconds, plus explicit flushes on return to the hall, deletion and backgrounding. Clean slots generate no PUT requests. Offline uploads retry on the same cadence. Browser exit is best effort; leave the game open until Synced before switching devices.

The server retains one predecessor; older referenced backups are pruned after successful publication. Interrupted, unreferenced uploads can remain in R2 if cleanup cannot be confirmed. Scheduled orphan collection and an in-product server-backup restore flow are deferred.

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
| `GET /api/cloud/characters/:slot` | Owned committed bundle and revision |
| `PUT /api/cloud/characters/:slot` | Validated revision-checked publication; null bundle is a tombstone |

Private replies use `Cache-Control: no-store`. Writes require same-origin JSON, bounded streamed bodies, a valid operation ID, shared character/point/item/world validation and a chart matching the character’s world. Slot IDs are 0–7. Payloads are capped at 24 MiB on transport, with the existing smaller character/chart validators inside. These checks protect persistence integrity, not competitive anti-cheat. User-edited valid solo saves remain possible.

## Build and deployment

`npm run build:site` builds the Site-enabled Vite client into `dist/client/` and a Cloudflare Worker into `dist/server/index.js`. `sites()` stages hosting metadata and generated Drizzle migrations. `.openai/hosting.json` retains the existing Evergrow project and declares logical `DB` / `SAVES` bindings. Sites provisions their physical D1/R2 resources on deployment.

The schema entrypoint is `db/schema.ts`, re-exporting `game/server/schema.ts`; generate additive migrations with `cd game && npx drizzle-kit generate`. Existing applied migrations must not be rewritten. Regular `npm run dev`, `npm run build`, and `npm run android:build` remain local-only; no development identity reaches the production Worker.

`/title.html?cloud&full` stages the real hall with eight memory-only characters. Add `empty`, `signedout` or `conflict` for alternate states. This preview never signs in, contacts save APIs or starts gameplay.

## Verification and remaining acceptance

Code tests exercise two-user isolation, two-writer races, stale deletion, duplicate requests, account mismatch, cross-origin requests, invalid stats/maps, failed R2/D1 writes, uncertain commit acknowledgements, outbox recovery/coalescing, explicit conflict replacement and atomic local import/export. Browser and Android builds are checked separately.

After the first approved deployment, verify the actual Sites sign-in dispatch, provisioned bindings and a same-account save/continue round trip on two browsers with the player. Sustained large-save latency, device-offline play and visual/controller acceptance remain player testing. This checkpoint has not exercised live cloud saves.

## Deployment checkpoint — 2026-09-06

The cloud/local character hall and account-owned save backend were published to the existing public [Evergrow Site](https://evergrow.dimillian.chatgpt.site) after approval. Sites reported deployment success for source `302202f`. Cross-client authenticated save/continue acceptance remains a player check; Android stays local-only.

## Chronicle — published in v0.5.0

Chronicle counters travel in the existing character checkpoint. D1 stores a validated history summary alongside each slot (including deleted-slot tombstones), updated by the same revision-checked publication. The authenticated Chronicle endpoint merges only the current account. IndexedDB cloud cache v2 preserves fetched account history offline. Local imports retain source identities and branch future progress to avoid double counting; cloud file imports are now disabled. No extra per-event upload requests. The subsequent local polish shows cached history before a server refresh, builds its compact projection in the storage worker, and does not flush saves when opening Chronicle. The successful v0.5.0 deployment includes `drizzle/0001_worthless_slipstream.sql` and matching client/server code. See [Chronicle](chronicle.md).
