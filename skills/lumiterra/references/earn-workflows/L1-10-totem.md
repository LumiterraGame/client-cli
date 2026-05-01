# L1-10: Totem (use totem)

> Source of truth: this file. When executing this workflow, agents **must** follow the order in the "Execution steps" section and may not merge or skip steps.
> Number index: L1-10.

This workflow is the unified entry for "query map totems -> choose target totem -> teleport to totem position -> perform follow-up operations at the totem (enhancement, etc.)" scenarios. The totem itself is not the endpoint; it is a precondition for flows such as L1-8 (enhance-equipment).

## Trigger conditions

- Trigger phrases:
  - "use totem" / "totem teleport" / "go to totem"
  - "choose totem" / "nearest totem" / "query totems"
  - "totem" / "totem teleport"
- User intent traits:
  - Goal is to **find and reach a totem position** (usually to enhance equipment at that totem afterward)
  - Or the user explicitly asks to "list totems / query nearest totem / teleport to totem"
- Boundary with nearby entries:
  - User's core goal is "enhance equipment" -> use L1-8 (enhance-equipment); this L1-10 is called as L1-8 steps 3-4 subflow
  - User only wants to view the totem list and does not plan to reach one -> only run step 1, do not enter step 3

## State maintained during execution (explicit variables; do not estimate verbally)

- `totemId` -- target totem id (**64-bit large integer**, used later for `enhance-equipment --totem-id`)
- `totemCid` -- totem type cid (distinguishes NFT totem vs scene world totem entity)
- `ownerName` / `ownerId` -- totem owner (used to judge fee / whether it is the user's own totem)
- `isMine` -- whether the totem is owned by this account
- `bonusPool` -- totem bonus pool / fee information (decision basis for choosing a totem)
- `totemPosition` -- totem coordinates `{x, y, z}` (used for `totem-teleport` or `navigate`)
- `targetCoord` -- user-specified target coordinates (if any); `query-near-totem` / `totem-teleport` uses this as anchor to find the nearest totem

## Success criteria

- **Query phase**: `query-totem-list` / `query-near-totem` returns non-empty result, and `totemId` / `totemPosition` are recorded
- **Arrival phase**: `totem-teleport` successfully returns `totemId` / `position`, or `navigate` returns arrival confirmation
- After arrival, verify the character is actually near the totem; otherwise later `enhance-equipment` may be rejected for "not in totem range"

## Preconditions / Blockers

**Self-check before starting** (if unmet, report blocker early):

- **Totems have owner and fee**: different totems have different enhancement fees / bonus-pool ownership; before use, the agent must ask the user to confirm which one to choose and must not default to the first one
- **NFT totem vs scene world totem entity IDs differ**: `totemId` may be an NFT ID or a scene entity ID; they are different namespaces on the server. When passing to `enhance-equipment --totem-id`, use the id returned by `query-totem-list` / `query-near-totem` / `totem-teleport`; do not construct it manually
- **64-bit ID precision trap**: `totemId` is a 64-bit integer and may exceed `2^53`. Do not extract it with `jq -r '.totemId'`; use `python3` or `grep -oE '[0-9]+'` to preserve the original numeric string
- **`totem-teleport` finds nearest by coordinates only**: must have `targetCoord` first (coordinates provided by user, or coordinates of the totem selected from `query-totem-list`); `totem-teleport` does not accept direct `totemId`
- **Teleport does not guarantee operability**: teleporting to the totem only satisfies spatial position; later commands (such as `enhance-equipment`) still validate server rules (fuel / fee / bonus-pool state, etc.)

## Execution steps (numbered; do not skip)

```
1. Query candidate totems (choose one)
   a. lumiterra query-totem-list
      -> List all map totems: id / cid / ownerName / ownerId / isMine / bonusPool / pos
      -> Suitable when the user has not chosen a target and needs to browse all totems for a decision
   b. lumiterra query-near-totem --x <x> --y <y> --z <z>
      -> Query the nearest totem to the specified coordinates, additionally returning distance
      -> Suitable when the user already has targetCoord and only wants the nearest one

2. Confirm target totem with the user
   -> Choose based on ownerName / bonusPool / distance
   -> Record totemId / totemCid / totemPosition / ownerName / isMine
   -> Do not enter step 3 without user confirmation (different totems have different fees; do not choose by default)

3. Reach the totem position (choose one)
   a. lumiterra totem-teleport --x <x> --y <y> --z <z>
      -> Use targetCoord (usually the coordinates of the totem selected in step 2) as anchor and teleport to the nearest totem
      -> Returns totemId / totemCid / ownerName / position
      -> Must verify returned totemId matches the one selected in step 2; if not, nearest totem changed, return to step 1
   b. lumiterra navigate --x <x> --y <y> --z <z>
      -> If teleport is inconvenient / not allowed, use normal pathfinding to the totem coordinates
      -> Takes longer but is friendly for users who want to pick things up or do other work along the route

4. Perform follow-up operation at the totem
   -> This L1 ends here; follow-up action is decided by the caller:
     - Enhance equipment: use L1-8 (enhance-equipment --item-instance-id <id> --totem-id <totemId>)
     - Other totem-related operations: continue according to the caller workflow
```

## Called base workflows / common workflows

- This L1 is **called by** L1-8 (enhance-equipment) as a subflow: L1-8 steps 3-4 are exactly "choose totem + reach totem", consistent with this L1
- Indirect dependencies:
  - `query-totem-list` -- list all totems
  - `query-near-totem` -- query nearest totem
  - `totem-teleport` -- teleport to nearest totem
  - `navigate` -- normal pathfinding to the totem coordinates (fallback)
- This L1 **does not include** `enhance-equipment` itself; enhancement belongs to L1-8

## Important notes (HARD RULES)

- Warning: **Totems have owner and fee**: before choosing, show `ownerName` / `bonusPool` / `isMine` to the user. Different totems have different fees, and choosing the first one by default may make the user pay unexpected cost.
- Warning: **NFT totem ID != scene world totem entity ID**: `totemId` comes from CLI return (`query-totem-list` / `query-near-totem` / `totem-teleport`) and cannot be manually constructed. `enhance-equipment --totem-id` accepts either kind, but it must be the id returned by CLI.
- Warning: **`totemId` is a 64-bit large integer**: do not extract with `jq -r '.totemId'` (precision loss); use `python3 -c "import json,sys;print(json.load(sys.stdin)['totemId'])"` or `grep -oE` to preserve the original string. Details: SKILL.md "64-bit ID precision trap".
- Warning: **`totem-teleport` finds nearest by coordinates and does not accept totemId**: first locate coordinates (step 2 `totemPosition`), then call with `--x --y --z`; wrong coordinates may teleport to another totem.
- Warning: **after teleport, verify returned totemId matches expectation**: `totem-teleport` may return a different totemId from step 2 (for example a new totem appears or distance order changes); if mismatch, return to step 1 and reselect.
- Warning: **this L1 does not perform enhancement**: enhancement belongs to L1-8; this L1 only handles "choose + arrive". Calling `enhance-equipment` inside this L1 bypasses L1-8 prechecks (such as `equip --action unequip`).

## Notes / common mistakes

- Using `jq -r '.totemId'` to extract totem ID -- 64-bit precision is lost, and later `enhance-equipment --totem-id` will inevitably report "not found".
- Directly choosing the first result from `query-totem-list` -- it may have the most expensive fee or unsuitable owner; user confirmation is required.
- Manually constructing a scene entity ID from an NFT totem ID -- they are different namespaces; the constructed id is not recognized by the server. Use the original value returned by CLI.
- `totem-teleport --totem-id <id>` -- the command does not accept totemId and only accepts `--x --y --z`; wrong parameters fail directly.
- Not verifying returned totemId after teleport -- if the map totem list changed, the character may teleport to another totem while later `enhance-equipment --totem-id` still uses the old id and fails validation.
- Calling `enhance-equipment` directly inside this L1 -- skips L1-8's `unequip` precondition, so `enhance-equipment` fails because the equipment is still worn.
