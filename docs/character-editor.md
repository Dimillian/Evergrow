# Character appearance editor

Integrated on `character-editor` · 2026-09-07. Local build only; no Site deployment or native install.

## Player flow

Choose an empty hall slot, enter a name/world seed and select starting gear. **Create character** opens the appearance editor before anything is saved. The editor's **Create character** button persists the chosen look with the fresh character and enters the world. Cancel returns to the hall and retains that slot's appearance draft for another attempt. A failed creation keeps the editor open with its draft and error message.

During play, open Character/Inventory (C or I) and select the edit icon directly beside **Equipment**. It matches the sort tools and opens the Character tab directly; Armor is available in the same editor. Gameplay stays paused. **Save changes** waits for the durable save before applying the appearance and returning to inventory. Cancel/Escape/controller B returns without applying the draft. A failed save leaves the editor open and the live character unchanged. Editing appearance never spends gold, changes equipment, reallocates points or heals resources.

The editor has sixteen skin palettes, sixteen hair palettes, twenty-four hairstyles, eight facial-hair choices and eight accessory choices, including None. Skin/hair colors have two pages; hair has three. Hover/focus reveals paging arrows on desktop. Phone layouts keep the character visible above an independently scrolling sheet, expose arrows continuously, use larger touch controls and retain Character/Armor tabs at the sheet's top. Keyboard and controller navigation reuse the shared focus/menu controls. No height or body-proportion controls are included.

Armor colors apply independently to helmet, chest, shoulders, gloves, legs, boots and cloak. Sixteen tints preserve geometry, shading and trim. Tints belong to the character's visual parts, so they follow replacement gear. Shoulders inherit geometry from chest equipment but have their own tint. **Use original color** restores one part; **Reset all armor colors** restores every part. **Show helmet** appears only in the Armor tab and defaults off on new characters. Players can enable it during creation or later through the inventory editor. A hidden helmet remains equipped and contributes its normal stats. The live preview replaces the redundant Review look step.

## Ownership and persistence

`CharacterSheet.look` is a required `CharacterLook`: head appearance IDs, a sparse map of armor tint IDs and a boolean helmet visibility flag. `character-look.ts` validates bounded catalog IDs and rejects unknown keys. `appearance-armor-content.ts` keeps cosmetic content within the headless compiler boundary.

`appearance-command.ts`, exported through the character command entrypoint, stages a detached sheet and persists it before live commitment. Game holds new commands and simulation while saving. `character-editor.ts` owns only a disposable draft and Canvas presentation. The hall remains the owner of name, seed and starting loadout; appearance editing does not rename existing characters.

`playerPose` supplies the same appearance and tinted outfit to world rendering and `drawCharacterPortrait` (hall and inventory). `character-framing.ts` includes actual hair/accessory contours. Cosmetic choices do not alter collision, targeting, attack geometry or stat derivation. Long hair remains head-local procedural art without independent physics; existing hood coverage rules hide hair/ear jewelry/circlets.

**Save format v4 requires the appearance recipe. Valid pre-editor v3 saves migrate automatically with the default look and keep their progress.** The default is warm skin, chestnut swept hair, no facial hair/accessory, original armor colors and helmet hidden. Players can change it later through the inventory editor. Decode adds only a missing appearance and updates the version on a parsed copy, then validates the entire checkpoint; it preserves any valid existing look and rejects malformed data. Reading does not rewrite storage. The next successful save writes v4 using existing atomic revision checks and backup handling. Character identity, timestamps, progression, gear, resources, world state and chart ownership remain unchanged during migration. Unsupported v1/2 saves remain preserved.

Local/IndexedDB saves, portable bundles and cloud validation share this decoder. Existing hosted clients remain on their deployed version until a separately requested deployment: this build accepts v3 exports, but old clients cannot read new v4 exports. Cloud cache reads apply the same migration to the returned character while leaving stored recovery data, revision tokens and immutable pending upload requests unchanged. No database-table migration is needed.

## Verification and review

The initial integration passed 767 code tests (historical), strict application/headless compilation and the local production build. New tests cover all appearance catalog IDs, malformed recipes, independent defaults/drafts, pending and failed save isolation, creation/edit/load round trips, unsupported-schema rejection and shared portrait/world pose projection. Migration tests cover full-record preservation, repeated decode, default isolation, existing-look preservation, malformed-data rejection, failed writes, stale writers, backup recovery and portable/cloud chart retention. Existing armor tests cover all part/tint combinations and source-material isolation; art tests cover facings, coverage and action poses.

`/character-editor.html` and `/character-editor-phone.html` now use the production component in memory-only harnesses. Add `?runtime` to the former to review the production save/cancel controls without writing a save. `/appearance-catalog.html` remains the procedural parts comparison. These routes are development-only. Browser review is confined to static editor/hall interactions; gameplay feel and actual device acceptance remain the user's testing.

The appearance migration checkpoint passed the full 770-test suite before the additional cloud-cache migration case, then all 20 focused appearance/cloud tests including that case. Strict application/headless compilation and the production build passed after the final changes. No user saves were manually modified during verification.
