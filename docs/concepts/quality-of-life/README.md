# Quality of life mockups

2026-09-07. Branch: `codex/quality-of-life-improvements`.

Status: four visual proposals awaiting the player's selection. No runtime changes,
save changes, browser gameplay tests or publication are part of this checkpoint.
Each board pairs a shop state with a separate gameplay skill-picker state; these
are not intended to be open together in the game.

## Displayed choices

Numbers match the order the generated images were displayed in the task.

1. [Anchored tools](01-anchored-tools.png): compact inventory popovers, sale review
   beside the bag, and an anchored vertical skill list.
2. [Review drawer](02-review-drawer.png): dedicated sale drawer with checked item
   rows, expanded browsing tools, and a wide skill tray.
3. [Focused dialogs](03-focused-dialogs.png): centered sale review and a separate
   centered skill dialog with a focused skill description.
4. [Inline selection](04-inline-selection.png): sale candidates checked directly
   in the bag, pinned sale footer, and a radial skill menu.

## Shared requested behavior

- Reuse inventory sorting (Rarity, Type, Recent pickup) and independent type and
  exact-rarity multi-selection in the player's shop bag. Type choices are All,
  Weapons, Armor, Jewelry and Off-hand. Rarities are Common, Magic, Rare, Epic and
  Legendary. All clears that filter group; it is not selected alongside specifics.
- Offer separately scoped vendor-stock browsing tools. Rarity and Type sorting
  apply to stock; pickup recency belongs to the player's inventory.
- Sell by filter exposes a rarity ceiling. Epic and lower means Common, Magic,
  Rare and Epic inclusive. Preview the actual bag candidates and total before
  executing the sale. The concepts propose individual exclusions from that list.
  Equipped items are excluded. Existing buyback holds only the latest 12 items.
- Clicking/tapping an empty assignable slot, or pressing its gamepad control,
  opens the picker. Show only unlocked skills compatible with current equipment,
  excluding every skill already assigned to another slot. Use the existing
  compatible-hand rules, including off-hand weapons and shield requirements.
- Keep LMB basic and exactly five assignable slots (RMB, 1-4); Q and Space remain
  separate utilities. Opening or confirming assignment must not cast a skill.
  Support mouse, touch and controller focus/confirm/cancel with the same choices.
- Example loadout is sword + shield with Crescent Cleave already on RMB. The
  illustrated candidates are Whirlwind, Rift Lunge, Shield Bash and Bulwark.
  This is sample unlocked progression, not a new-character grant.

## Implementation details to resolve after selection

- Empty picker: explain that no unlocked unassigned skills match current gear,
  and offer the existing skill atlas. Do not show incompatible/duplicate skills
  as selectable filler. Radial layout must handle counts beyond this four-skill
  example, including hybrid loadouts.
- Consume the triggering input; coordinate focus, input buffering, dismissal and
  combat pause with existing panels. Preserve manual Thor companion pause rules.
- Keep browsing filters and sale scope explicit. Exact-rarity browsing and an
  inclusive sale ceiling are distinct controls. Preview must always show the
  precise transaction candidates, including any retained type scope.
- Bulk sale must use shared quotes, validated wallet and save-before-commit
  commerce commands, with stale/duplicate request protection and atomic failure.
  Read persistence guides before implementation. No reset is proposed.
- Use shared skill resolution for displayed mana/cooldowns; the mockups use base
  costs only. Revalidate eligibility on assignment and refresh for gear changes.
- Use actual item art, skill glyphs, shared item components, locally bundled fonts
  and current HUD layout when implementing. Fit narrow/touch/Thor surfaces after
  choosing a direction; these boards are desktop composition studies.

## Visual limitations

These are generated layout mockups, not verified screenshots or economy data.
Some item prices, icons, filter highlights and incidental labels were reproduced
imprecisely. The intended illustrative eight sale values are 5, 5, 12, 18, 44,
24, 6 and 12 (126 total); live prices must come from commerce. In the third board,
the generated RMB icon resembles Whirlwind; its intended assignment is Crescent
Cleave, and Whirlwind is unassigned. Any misplaced equipment filter, missing
equipment rows/menu-rail details or duplicate filter controls are rendering
artifacts, not proposed behavior. The shared rules above take precedence.

Grounding: the user's Blacksmith screenshot, the existing desktop inventory
capture, the historical Astral HUD study, `inventory-panel.ts`,
`inventory-tools.ts`, `skill-content.ts`, and `docs/npcs-and-vendors.md`.
