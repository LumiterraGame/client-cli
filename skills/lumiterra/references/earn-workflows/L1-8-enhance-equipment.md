# L1-8: Equipment Enhancement Loop (enhance-equipment)

> Source of truth: this file. When executing this workflow, the Agent **must** follow the order in the "Execution Steps" section and must not merge or skip steps.
> Number index: L1-8.

This workflow is the unified entry point for "send one or more pieces of equipment to a totem for enhancement + wait for the queue to extract the result + re-equip it": given one or more equipment items to enhance (`itemInstanceId`), this L1 is responsible for unequipping -> choosing a totem -> submitting the enhancement request -> waiting for the queue -> deciding whether to continue based on result fields, and re-equipping the item.

## Trigger Conditions

- Trigger phrases:
  - "enhance equipment" / "enhance X" / "enhance my X"
  - "+X enhancement" / "enhance to +N" / "enhance this weapon"
  - "enhance equipment" / "upgrade equipment"
- User intent characteristics:
  - The goal is to **increase the enhancement level of owned equipment** (`originLevel -> newLevel`), with the attached YOLO lottery reward
  - The equipment already exists in the inventory or is equipped; this L1 is not responsible for "first obtaining a piece of equipment"
- Boundaries with nearby entries:
  - If the user asks to "craft X first and then enhance it" -> run L1-5 first to craft the equipment, then return to this L1 for enhancement
  - If the user asks to "dismantle equipment for fragments" -> run L1-9A (Dismantling), not this L1
  - If the user asks to "put equipment into the recovery pool for an airdrop" -> run L1-9B (EquipmentRecovery), not this L1
  - If enhancement stones / protective stones or other consumables are missing -> this L1 identifies the gap and routes to L1-get-item to replenish, then returns

## Runtime State to Maintain (explicit variables; do not estimate verbally)

- `targetItemInstanceId` -- the itemInstanceId of the equipment currently being enhanced (it may become a new id after enhancement; fetch it again for the next round)
- `targetSlot` -- the slot containing the equipment to enhance (`head|coat|pant|shoe|hand|weapon`); required when unequipping
- `targetId` -- the character / entity id that owns the enhancement target (`query-equipment` `--target-id` / `equip` `--wearer-id`)
- `totemId` -- the selected totem id (can be a totem NFT ID or a scene entity ID)
- `totemPos` -- the selected totem coordinates (passed to `navigate`)
- `useProtectiveStone` -- whether this run consumes a protective stone (default `false`; set to `true` only when explicitly requested by the user)
- `originLevel` -- enhancement level before enhancement (from `query-equipment` or the enhancement response)
- `newLevel` -- enhancement level after enhancement (from the `enhance-equipment` extracted result)
- `beforeItemInstanceId` / `afterItemInstanceId` -- original id before enhancement / new id matched after enhancement
- `queuedList` -- queue of `itemInstanceId` values to enhance in multi-item loops (process one by one, not concurrently)

## Success Criteria

- **Use the enhancement fields extracted by `enhance-equipment` as the source of truth**: `originLevel` / `newLevel` / `attributes` / `yoloResult`, etc. are the result source
- **`afterItemInstanceId` may be empty, but that does not mean enhancement failed** (it remains empty when the add event cannot be uniquely matched); do not use it as the success criterion
- `beforeItemInstanceId` / `afterItemInstanceId` are only used to locate the instance id to re-equip / continue enhancing in the next round
- If `enhance-equipment` fails at submission and returns `enhanceStoneItemCid` + `material.itemCid/name/need/have/enough` -> this is not enhancement failure; it means "not enough enhancement stones". Route to L1-get-item to replenish, then return to step 5

## Preconditions / Blockers

**Self-check before starting** (report blockers early if unmet):

- Character alive & HP above the safety line: `query-status`; HP = 0 -> `revive`, then continue; enhancement itself does not consume energy, but navigating to the totem may encounter enemies and needs HP
- **Equipment must be unequipped first** (hard game rule): `enhance-equipment` checks this and fails if the equipment is worn; step 2 is responsible for unequipping and must not be skipped
- **Enhancement stone / protective stone inventory**: this L1 does not pre-check; `enhance-equipment` reports missing materials in step 5 (`enhanceStoneItemCid` / `material`). Missing materials go to L1-get-item for replenishment. **Do not** force `enhance-equipment` when enhancement stones = 0 and waste navigation cost (suggest that the user can run `query-inventory` for a quick check first)
- **Totem availability**: `totemId` must come from the current response of `query-totem-list` or `query-near-totem`; do not reuse an old `totemId` (totems may go offline / change ownership / change fee rate)
- **Totem fee / owner confirmation**: when choosing a totem in step 3, read `bonusPool` / `ownerName` / `isMine` and other fields so the user knows where the fee goes; **do not** choose a high-fee totem without explicit user authorization
- **Do not randomly choose when parsing is ambiguous**: if the user only says "enhance weapon" but there are multiple weapon-slot candidates (player + pet both have `weapon`) -> report a blocker and clarify `targetId` + `targetSlot`

## Execution Steps (numbered; do not skip)

```
1. lumiterra query-status
   -> Confirm the character is alive; HP = 0 -> revive, then continue
   -> Enhancement does not consume energy, so no energy gate is needed

2. Locate target equipment
   lumiterra query-equipment --target-id <targetId>
     -> Read slots and lock targetItemInstanceId + targetSlot + originLevel
     -> If --target-id is omitted, default to the current character; pet equipment enhancement must pass targetId explicitly
     -> If the user gives multiple items at once, put all itemInstanceId values into queuedList and process subsequent steps in order, one item at a time

3. Unequip target (hard rule)
   lumiterra equip --action unequip --wearer-id <targetId> --slot <targetSlot>
     -> After success, the equipment enters the inventory
     -> Failure -> report a blocker; do not bypass unequip and call enhance-equipment directly

4. Choose a totem
   a. User already provided target coordinates / knows which area to use:
      lumiterra query-near-totem --x <x> --y <y> --z <z>
      -> Return the nearest totem and read totemId / ownerName / isMine / bonusPool / pos
   b. User wants to browse all totems / compare fee rates:
      lumiterra query-totem-list
      -> Return all totems and let the user choose by ownerName / bonusPool / pos
   -> After confirming totemId + totemPos + fee / ownership, enter step 5; do not compose a totemId without querying

5. Navigate to totem
   lumiterra navigate --x <totemPos.x> --y <totemPos.y> --z <totemPos.z>
   -> 15s timeout; after timeout or failure, run query-status / query-near-entities to re-check before retrying
   -> You may also use totem-teleport --x --y --z to teleport directly to the nearest totem (equivalent effect, avoids manual navigate)

6. Submit enhancement
   lumiterra enhance-equipment --item-instance-id <targetItemInstanceId> --totem-id <totemId> [--use-protective-stone true|false]
     -> --use-protective-stone defaults to false; set true only when the user explicitly requests consuming a protective stone
     -> totem-id supports either a totem NFT ID or a scene entity ID; both are equivalent
     -> If the response contains enhanceStoneItemCid + material (itemCid/name/need/have/enough) -> enhancement stones are insufficient;
       route to L1-get-item to replenish the corresponding itemCid (need - have), then return to step 6 and resubmit
     -> Submission success -> equipment enters the enhancement queue; wait for the queue to complete

7. Wait for queue + extract result
   -> The CLI internally waits until queue finishTime and then extracts the result; it does not open in-game FormEquipmentEnhanceResult
   -> Key fields in the extracted response: originLevel / newLevel / attributes / yoloResult /
     beforeItemInstanceId / afterItemInstanceId
   -> The YOLO lottery is built into enhancement and participates automatically; no separate command is needed
   -> Empty afterItemInstanceId does not mean failure (only that the add event was not uniquely matched); judge by newLevel / attributes

8. Re-equip enhanced item
   lumiterra equip --action equip --item-instance-id <afterItemInstanceId or latest instance id> --wearer-id <targetId>
     -> If afterItemInstanceId is non-empty, use it directly
     -> If afterItemInstanceId is empty, rerun step 2 query-equipment / query-inventory --type wearable to locate the new id, then equip it
     -> If re-equip fails, report a blocker; do not leave the equipment in the inventory and mark the workflow complete

9. Verify
   lumiterra query-status
     -> Check combat power / attribute changes
   lumiterra query-equipment --target-id <targetId>
     -> Re-check that the new equipment is correctly equipped and newLevel is reflected

10. Loop or stop
    -> If queuedList still has another item, return to step 2 (take the next itemInstanceId),
      then redo unequip -> choose totem (the same totem can be reused, but reconfirm bonusPool has not changed) -> enhance -> re-equip
    -> If queuedList is empty / the user asks to stop / enhancement stones repeatedly cannot be replenished -> return completed / partial / blocker to the upper layer
```

## Called Base Workflows / Shared Workflows

- `L1-get-item` -- prerequisite repair when enhancement stones / protective stones or other consumables are missing (single repair entry; do not branch into craft / purchase / gather yourself)
- Indirect dependencies:
  - `query-status` / `query-inventory` / `query-equipment` -- pre-checks + state verification
  - `query-totem-list` / `query-near-totem` -- totem selection
  - `navigate` / `totem-teleport` -- move to the totem
  - `equip --action unequip|equip` -- unequip / re-equip (called once before and once after enhancement)
  - `enhance-equipment` -- integrated command for enhancement request + queue wait + result extraction
- This L1 **no longer separately** maintains YOLO lottery commands / FormEquipmentEnhanceResult toggles; all of that is handled inside `enhance-equipment`

## Important Notes (HARD RULES)

- ⚠️ **Equipment must be unequipped before enhancement** (hard game rule): the `enhance-equipment` command checks this internally, and enhancing while worn fails directly; step 3 must not be skipped, and do not concurrently "unequip + submit enhancement"
- ⚠️ **The YOLO lottery is part of the enhancement flow, not an independent command**: do not look for extra commands like "yolo-lottery"; the `yoloResult` field in the `enhance-equipment` response is this run's lottery result
- ⚠️ **Insufficient enhancement stones are not enhancement failure**: before submission, `enhance-equipment` can fail and return `enhanceStoneItemCid` + `material.itemCid/name/need/have/enough`; this is a "missing material signal". Route to L1-get-item to replenish and then return to step 6. **Do not** misjudge it as enhancement failure and stop the workflow
- ⚠️ **`--use-protective-stone` defaults to false**: pass `true` only when the user explicitly says "use a protective stone on this item"; otherwise keep the default. **Do not** proactively enable protective stones for "safety" (protective stones have their own cost)
- ⚠️ **Totem owner / fee must be confirmed first**: step 4 must read `ownerName` / `isMine` / `bonusPool` from `query-totem-list` / `query-near-totem` and let the user know where the fee goes; **do not** compose a `totemId` without querying or reuse an old `totemId` (totems may go offline / fee rates may change)
- ⚠️ **`afterItemInstanceId` may be empty and does not mean enhancement failed**: it only means the add event was not uniquely matched; success is judged by `originLevel` / `newLevel` / `attributes` / `yoloResult`. When re-equipping, if `afterItemInstanceId` is empty -> rerun `query-equipment` / `query-inventory --type wearable` to locate the new id; do not give up on re-equipping
- ⚠️ **Enhancement is queue-based**: `enhance-equipment` already performs "submit -> wait for queue -> extract" internally, so when the CLI returns, the result is already available. **Do not** additionally query queue status or wait extra time; the CLI will not open the in-game `FormEquipmentEnhanceResult` screen
- ⚠️ **Process multiple items one by one**: equipment in queuedList **must not** be submitted to multiple totems concurrently; each item must complete the full unequip -> enhance -> re-equip loop before moving to the next one, avoiding itemInstanceId mismatches

## Notes / Common Mistakes

- Skipping step 3 and calling `enhance-equipment` directly without unequipping -- the command will fail, and you still waste the `navigate` cost
- Not running `query-totem-list` / `query-near-totem` and passing an old remembered `totemId` -- the totem may be offline / ownership may have changed / fee rate may have changed, causing `bonusPool` to differ from the user's expectation
- Treating missing materials from `enhanceStoneItemCid` as "enhancement failure" and stopping -- route to L1-get-item to replenish, then return to step 6 and resubmit
- Proactively enabling `--use-protective-stone true` "just to be safe" -- protective stones cost resources; keep the default false unless the user explicitly requests it
- Seeing an empty `afterItemInstanceId` and judging enhancement as failed -- instead check `originLevel` / `newLevel` / `attributes` / `yoloResult`; if empty, rerun `query-equipment` to locate the new id and re-equip it
- Submitting multiple pieces of equipment to different totems in parallel -- `enhance-equipment` runs the queue one item at a time, and `itemInstanceId` changes after enhancement; concurrency can easily mismatch ids. Loop strictly one by one
- Running another workflow after enhancement without re-equipping -- equipment in the inventory is not effective, so combat power / attribute verification will be wrong; step 8 must not be skipped
- Not clarifying `targetId` when both the player and pet have weapons, defaulting to the player -- the user may have intended to enhance the pet weapon, causing the wrong object to be enhanced; step 2 `--target-id` must be explicit
- User only gives a "weapon" name without a specific `itemInstanceId`, and there are multiple weapons of the same type -- report a blocker and let the user choose; do not randomly pick one
