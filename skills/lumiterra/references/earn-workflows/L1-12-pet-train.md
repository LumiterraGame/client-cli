# L1-12: Train Pet (pet-train)

> Source of truth: this file. When executing this workflow, the Agent **must** follow the order in the "Execution Steps" section and must not merge or skip steps.
> Number index: L1-12.
> This file merges SKILL.md L1145-1244 "Pet Workflow Pattern: Resolve Blockers First" -- that shared blocker recovery pattern is specifically for pet-related workflows and exists inside this L1 as the `## Blocker Recovery Pattern` section.

This workflow is the unified entry point for "resolve target pet -> prepare before combat/gathering -> follow + hunger maintenance -> combat / gathering training -> re-check specialization progress". The training target is the pet's **specialization ability level** (currently only `battle` and `gather`; farming ability is not included yet).

## Trigger Conditions

- Trigger phrases:
  - "train pet" / "level pet" / "raise pet ability" / "feed pet + fight monsters"
  - "train pet" / "level up pet" / "boost pet battle ability" / "boost pet gather ability"
- User intent characteristics:
  - The goal is to **raise one pet's battle or gather ability level**
  - The flow may first capture a new pet (default path), or may target an existing pet (given `petId` / pet name / pet cid)
- Boundaries with nearby entries:
  - If the user only wants to "make a pet egg" -> use L1-13 (make-pet-egg), not this L1
  - If the user only wants "player talent upgrade" -> use the single `talent-manage` command; do not mix it with pet specialization levels
  - If the user asks to "obtain a specific pet's egg/equipment/feed" -> use shared L1-get-item; this L1 only calls L1-get-item as a child flow when such blockers appear

## Runtime State to Maintain (explicit variables; do not estimate verbally)

- `targetPetId` -- final locked training target `petId`; may come from the `capture-pet` response or from a user-specified match in `query-pets`
- `targetPetCid` -- when using the "new capture" path, the target `petCid` specified by the user (passed to `query-capture-setup` / `capture-pet` / `set-capture-prop`)
- `petsBefore` / `petsAfter` -- `query-pets` snapshots before and after capture, used to diff out `targetPetId` when `capture-pet` does not directly return petId
- `maxPetLimit` / `remainingPetSlots` -- fields returned by `query-pets`; when `remainingPetSlots == 0`, capture must stop and report blocker before starting
- `trainDirection` -- `battle` or `gather`; determines whether the loop uses `auto-combat` or `auto-gather`
- `playerEquippedIds` -- equipment ID set currently worn by the player from `query-equipment` (default current character); used as an **exclusion set** when choosing pet equipment
- `petCurrentGearByslot` -- current pet equipment per slot from `query-equipment --target-id <petId>`; used to decide whether upgrades are still needed
- `currentHunger` / `maxHunger` -- pet hunger state returned by `query-pets`; training loop maintains it around `~50%`
- `washConfirmed` -- whether the user explicitly requested or confirmed `pet-wash`; do not wash automatically without confirmation

## Success Criteria

- **Success is based on the user-specified specialization direction reaching the target level**: stop when the pet battle / gather specialization ability level returned by `query-pets` reaches the user's requested value
- Only seeing "one auto-combat / auto-gather training run did not error" **does not count as success**: training is a loop and must be judged by the final `query-pets` ability level
- Only seeing "the pet is following" **does not count as success**: following is a prerequisite for entering training, not the training result
- Single-run results from `pet-feed` / `auto-combat` / `auto-gather` inside the loop **do not determine overall success or failure**; they only affect progress. Do not exit the loop because one battle failed; continue until ability level reaches target or the user asks to stop

## Preconditions / Blockers

**Self-check before starting** (identify blockers early and handle them through the Blocker Recovery Pattern instead of terminating directly):

- **Pet slots**: if `query-pets` returns `remainingPetSlots == 0`, and the flow is on the "new capture" path, stop and report blocker (ask the user to decide whether to release a slot or use an existing pet)
- **Capture skill available**: player battle talent must have `Capture` unlocked and at the level required by the target pet; otherwise use Blocker Recovery Pattern §1
- **Capture in skill shortcut bar**: current skill shortcut bar must include `Capture`; otherwise use Blocker Recovery Pattern §2
- **Capture prop sufficient and mounted**: `Capture` needs the corresponding capture prop (`pet-egg` / `capture-trap`, etc.) mounted, with enough quantity for target `targetPetCid`; missing or not mounted uses Blocker Recovery Pattern §3
- **Weapon compatible with Capture**: some weapons do not support casting `Capture`; incompatibility uses Blocker Recovery Pattern §4
- **Pet feed sufficient**: the training loop must maintain hunger around `~50%`; insufficient feed uses Blocker Recovery Pattern §5
- **Pet equipment**: before entering `auto-combat` / `auto-gather`, the pet should wear the **highest-level pet equipment currently wearable from the inventory**; missing equipment uses Blocker Recovery Pattern §6
- **HP < 40% is a global HARD RULE**: if player HP drops below 40% during the training loop, disengage and recover first (see SKILL.md Operating Principles); do not use potions by default
- **Paid actions are rejected by default**: when materials/equipment/feed are missing, **do not** default to store purchases / `energy-manage --action buy|borrow` or other paid paths; first recurse through L1-get-item, and ask the user only when no path exists
- **Do not move player equipment to the pet**: player and pet share the equipment pool, but by default you **must not** unequip player-worn equipment for the pet unless the user explicitly authorizes it; `playerEquippedIds` as exclusion set implements this rule
- **pet-wash is skipped by default**: `pet-wash` is rerolling / rebuilding, not a stable one-way gain; run it only when `washConfirmed == true`

## Execution Steps (numbered; do not skip)

```
1. Resolve training target (decide between "new capture" and "existing pet")
   - Default: new capture path
     a. lumiterra query-pets                       -> record petsBefore, maxPetLimit, remainingPetSlots
        -> If remainingPetSlots == 0: stop and report blocker; do not enter capture
     b. lumiterra query-capture-setup --target <targetPetCid>
        -> Structured pre-check for capture prerequisites; use Blocker Recovery Pattern to fill gaps according to the response (see next chapter)
        -> After recovery, return to this step and retry until pre-check passes
     c. lumiterra capture-pet --target <targetPetCid>
        -> capture-pet finds the target and moves to the spawn area itself; do not add extra navigate
        -> Prefer petId from the response -> targetPetId
        -> If the response has no petId: run lumiterra query-pets as petsAfter, diff the new pet -> targetPetId
   - User-specified: existing pet path
     a. lumiterra query-pets
     b. Match a concrete petId by user-provided petId / pet name / pet cid -> targetPetId
        -> Name / cid matching must happen agent-side; success requires a unique hit, and multiple hits require user clarification

2. Prepare before combat / gathering (equip the highest-level currently wearable equipment on the pet)
   a. lumiterra query-equipment
      -> By default read equipment IDs worn by the current character -> playerEquippedIds (exclusion set, protects player equipment)
   b. lumiterra query-equipment --target-id <targetPetId>
      -> Read the pet's current equipment per slot -> petCurrentGearByslot (decide whether replacement is needed)
   c. lumiterra query-inventory --type wearable
      -> Among equipment outside playerEquippedIds, choose the highest-level currently wearable item for each relevant pet slot
      -> If suitable equipment is missing: use Blocker Recovery Pattern §6 (recursively replenish via L1-get-item)
   d. lumiterra equip --action equip --item-instance-id <itemInstanceId> --wearer-id <targetPetId>
      -> Replace slots one by one with the highest-level inventory equipment the pet can wear; do not touch currently worn player equipment
   e. Optional: lumiterra pet-wash --pet-id <targetPetId>
      -> Execute only when washConfirmed == true; skip by default

3. Enter working state (follow + hunger maintenance)
   a. lumiterra pet-summon --pet-id <targetPetId> --action follow
   b. lumiterra query-pets
      -> Read targetPetId currentHunger / maxHunger
   c. If currentHunger / maxHunger is clearly < 50%:
      -> If feed is insufficient: use Blocker Recovery Pattern §5 to replenish feed
      -> lumiterra pet-feed --pet-id <targetPetId>
      -> Currently only following pets can be fed, so pet-summon follow must happen before pet-feed

4. Training loop (branch by trainDirection)
   loop:
     # Hunger maintenance
     q = lumiterra query-pets
     if q.pet(targetPetId).hunger / maxHunger is clearly < 0.5:
       -> if feed is insufficient, use Blocker Recovery Pattern §5
       -> lumiterra pet-feed --pet-id <targetPetId>

     # HP maintenance (HARD RULE; see SKILL.md Operating Principles)
     s = lumiterra query-status
     if s.hp / s.maxHp < 0.4:
       -> escape-combat -> move away -> wait for automatic recovery (or back-to-town / revive)
       -> do not use potions by default unless the user explicitly authorizes potion use

     # Training body (choose branch by trainDirection)
     if trainDirection == battle:
       lumiterra auto-combat --target <monsterCid>
     elif trainDirection == gather:
       lumiterra auto-gather --target <resourceCid>
     # Farming direction is not included in this workflow yet

     # Re-check
     p = lumiterra query-pets
     if p.pet(targetPetId).ability(trainDirection).level >= user target:
       break

5. Finish
   lumiterra query-pets
   -> Re-check targetPetId level / ability / attributes / hunger
   -> Report the current specialization level to the user, plus next-step suggestions (continue training / change equipment / switch pet)
```

## Blocker Recovery Pattern (from SKILL.md L1145-1244)

For pet-related workflows, **do not** terminate at the first missing prerequisite / missing material; treat the blocker as a sub-goal, fix it, then return to the original blocked step and continue. The following are the 6 standard recovery paths, numbered to match the precondition self-check sections.

### §1 Capture unavailable or level too low

- `lumiterra query-talent` -> inspect player `battle` talent tree nodes related to Capture
- `lumiterra talent-manage --action upgrade --talent-type battle --node-id <captureNodeId>` -> upgrade until the target requirement is met
- Return to the blocked `query-capture-setup` / `capture-pet` and retry

### §2 Capture not in current skill shortcut group

- Read `captureSkillId` from current character data
- `lumiterra set-skill-shortcut --skill-id <captureSkillId> --slot <1|2|3>` -> put `Capture` into the current shortcut bar
- Return to the blocked capture step and retry

### §3 Capture prop missing / not mounted / insufficient

- `lumiterra query-inventory --type wearable,food,material,pet-egg` -> check whether the required capture prop already exists
- If inventory quantity is insufficient, call **L1-get-item (shared workflow: obtain item)** to replenish enough quantity
- `lumiterra set-capture-prop --item-instance-id <itemInstanceId> --target <targetPetCid>` -> mount it to `Capture`
- Return to `query-capture-setup` / `capture-pet` and retry

### §4 Current weapon incompatible with Capture

- `lumiterra query-inventory --type wearable` -> find a weapon `itemInstanceId` that supports casting Capture
- If no compatible weapon exists, call **L1-get-item** to replenish one
- `lumiterra equip --action equip --item-instance-id <weaponItemInstanceId>` -> equip the compatible weapon
- Return to the blocked capture step and retry

### §5 Pet feed missing

- `lumiterra query-inventory --type food` -> find feed usable by the current pet
- If quantity is insufficient, call **L1-get-item** to replenish it (for craft sources, L1-get-item internally expands `query-recipes` -> `craft-execute`)
- `lumiterra pet-feed --pet-id <targetPetId>` -> bring hunger back to ~50%
- Return to the training loop

### §6 Pet equipment missing

- `lumiterra query-equipment` (default current character) -> record `playerEquippedIds` as the **exclusion set**
- `lumiterra query-inventory --type wearable` -> among equipment outside playerEquippedIds, choose the **highest-level currently wearable** pet equipment
- If the inventory does not even have the lowest tier, or the level is insufficient: call **L1-get-item** to replenish it
- `lumiterra equip --action equip --item-instance-id <itemInstanceId> --wearer-id <targetPetId>` -> equip the pet
- Return to step 2 (preparation) or step 4 (equipment confirmation before training loop) and continue

### Target State Rules (general principle of Blocker Recovery Pattern)

- **Skill shortcut configuration / prop mounting are part of workflow execution**, not manual prerequisites; when the agent detects misconfiguration, configure it directly instead of handing it to the user
- **All material blockers recurse into L1-get-item**: feed, capture props, pet equipment, compatible weapons, and other material gaps all use L1-get-item child flow
- **Stop only when the user explicitly forbids the recovery path**; for example, if the user says "do not upgrade talent" / "do not farm materials", respect that intent and report blocker. By default, try to recover
- **After recovery, return to the original blocked step and retry**, instead of restarting the entire workflow from scratch

## Called Base Workflows / Shared Workflows

- **L1-get-item (shared workflow: obtain item)** -- unified material replenishment entry for Blocker Recovery Pattern §3 / §4 / §5 / §6
- **SW-4-combat-loop / auto-combat** -- training body when `trainDirection == battle` (requires pet following)
- **SW-1-gather-entity / auto-gather** -- training body when `trainDirection == gather` (requires pet following)
- Indirect CLI command dependencies:
  - `query-pets` -- single source of truth for list / capacity / hunger / ability levels
  - `query-capture-setup` -- structured pre-check entry before capture (with `--target <petCid>`, it automatically estimates required capture prop quantity)
  - `capture-pet` -- capture (finds target + moves by itself; do not add extra navigate)
  - `query-talent` / `talent-manage` -- §1 upgrade player `Capture`-related battle nodes (only for player talent, not pet specialization)
  - `set-skill-shortcut` -- §2 put `Capture` into the current shortcut bar
  - `set-capture-prop` -- §3 mount capture prop to `Capture`
  - `query-inventory` -- find capture props / weapons / feed / pet equipment
  - `query-equipment` -- default reads player worn equipment (as exclusion set); `--target-id <petId>` reads current pet equipment
  - `equip` -- §4 change weapon, §6 equip the pet slot by slot
  - `pet-summon` -- follow / dismiss (training requires follow)
  - `pet-feed` -- maintain hunger around ~50%
  - `pet-wash` -- reroll (not automatic by default)
  - `query-status` -- read player HP during the loop and trigger HP<40% disengage
  - `escape-combat` / `back-to-town` / `revive` -- disengage path for HP<40%

## Important Notes (HARD RULES)

- ⚠️ **Default is new capture; user-specified means existing pet**: if the user gives `petId` / pet name / pet cid, you **must** prioritize locking the existing pet and must not capture a new pet yourself; name / cid matching must happen agent-side, and multiple hits require user clarification
- ⚠️ **Pet slots are a hard gate**: when `query-pets` returns `remainingPetSlots == 0`, you **must not enter capture**; report blocker and let the user decide (release a slot / switch to existing pet path)
- ⚠️ **Do not add navigate before capture-pet**: `capture-pet` finds the target and moves to the corresponding spawn area itself; adding navigate can cause position drift
- ⚠️ **Blocker recovery is the default behavior**: when a prerequisite / material is missing, you **must** use the Blocker Recovery Pattern to try to fill it; do not terminate the workflow at the first blocker unless the user explicitly forbids the recovery path
- ⚠️ **Material gaps always use L1-get-item**: feed, capture props, pet equipment, compatible weapons, etc. all use the L1-get-item child flow; L1-get-item decides which path to use (buy / loot / gather / craft)
- ⚠️ **Player equipment is an exclusion set and cannot be unequipped for the pet by default**: `playerEquippedIds` read in step 2a is only an exclusion set; by default, **do not** transfer equipment worn by the player to the pet. Only explicit user authorization allows it
- ⚠️ **pet-wash is skipped by default**: `pet-wash` is a reroll, not a stable one-way improvement; skip by default and run only when `washConfirmed == true`
- ⚠️ **Must pet-summon follow before feeding**: `pet-feed` currently only feeds a following pet; calling pet-feed before follow fails
- ⚠️ **Maintain hunger around ~50%**: do not feed to full (wastes feed), and do not let it fall to 0 (leaves working state); evaluate this threshold after every loop `query-pets`
- ⚠️ **Training target is the pet's specialization ability level**: `query-talent` / `talent-manage` are for the **player talent tree**, **not** pet specialization upgrades; do not mistake "upgrade player talent" for the default pet training chain
- ⚠️ **HP<40% is a global HARD RULE**: every loop must calculate `hp/maxHp` from `query-status`; below 40%, immediately `escape-combat` -> move away -> wait for automatic recovery. **Do not use potions by default** (see SKILL.md Operating Principles)
- ⚠️ **Paid actions are rejected by default**: when feed / equipment / capture props are missing, **do not** default to store purchases or `energy-manage --action buy|borrow`; first recurse through L1-get-item, and ask the user only when no path exists
- ⚠️ **User abort -> run `lumiterra stop` first**: if the user says "stop training" / "do not train anymore", the first action is `lumiterra stop` (cancel `auto-combat` / `auto-gather` / `capture-pet` and other long tasks), then optionally `pet-summon --action dismiss`
- ⚠️ **petId is a 64-bit ID**: external scripts / logs must not use `jq -r` for `petId` (precision loss); use `python3` or `grep -oE` to preserve the original string (see SKILL.md "64-bit ID precision trap")

## Notes / Common Mistakes

- The user gave `petId` / pet name but you still run `capture-pet` for a new pet -- existing pet path must take priority; do not expand the task yourself
- Running capture-pet even when `remainingPetSlots == 0` -- the server rejects it; read slots in step 1 first
- Adding `query-spawn-point + navigate` before `capture-pet` -- duplicate target finding, and it may conflict with `capture-pet`'s own movement logic
- Treating `query-talent` / `talent-manage` as the default pet training chain -- this is **player talent**, not pet specialization; use it only in Blocker Recovery Pattern §1 (to satisfy `Capture` skill requirements)
- Forgetting `pet-summon --action follow` before `pet-feed` -- current version can only feed following pets; non-following pets cannot be fed
- Unequipping equipment from the player when equipping the pet -- violates the default rule; unless the user explicitly authorizes it, choose only from inventory equipment outside `playerEquippedIds`
- Looking only at "wearable" and not "highest level" when equipping -- higher-level pets can wear higher gear, and equipment further improves ability level; random low gear wastes training value
- Terminating immediately when capture props / feed / equipment are missing -- violates Blocker Recovery Pattern; recursively run L1-get-item to replenish, then return to the original step
- Running `pet-wash` by default -- rerolling can worsen the pet; unless `washConfirmed == true`, do not do it
- Continuing to fight when HP drops below 40% in the training loop -- violates the HARD RULE in Operating Principles; disengage and recover first
- Using `energy-manage --action buy` or store actions when feed / items are missing -- paid actions are rejected by default; use L1-get-item first, and ask the user if there is no path
- Using `jq -r '.petId'` to read petId for reconciliation -- 64-bit precision is lost; use `python3` or `grep -oE` to preserve the original string
