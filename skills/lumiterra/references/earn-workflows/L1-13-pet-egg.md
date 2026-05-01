# L1-13: Make Pet Egg (make-pet-egg)

> Source of truth: this file. When executing this workflow, the Agent **must** follow the order in the "Execution Steps" section and must not merge or skip steps.
> Number index: L1-13.
> Merged source: SKILL.md L1245-1287 "Workflow: Make Pet Egg" + docs/workflows.md "L1-13: Make Pet Egg".

This workflow is the only entry point for "convert a pet into a pet egg". **Success is judged only by "egg has been created"**: by default, do **not continue** to `hatch-pet` / `claim-pet`; hatching / claiming is an independent follow-up flow and does not belong to this L1.

## Trigger Conditions

- Trigger phrases:
  - "make pet egg" / "make egg" / "turn pet into egg" / "make me an egg"
  - "make pet egg" / "pet egg" / "turn pet into egg"
- User intent characteristics:
  - The goal is to **obtain a pet egg as an item**, not to train / deploy / follow
  - The flow may first capture a new pet (capture then make egg), or may convert an existing pet specified by `petId` / pet name / pet cid
- Boundaries with nearby entries:
  - If the user wants to "train pet" / "level pet" -> use L1-12 (pet-train), not this L1
  - If the user wants to "hatch egg" / "claim pet" -> **not part of this L1**; this L1 stops after `createdEgg` is established
  - If the user wants to "obtain pet egg item / capture prop" -> use shared L1-get-item; this L1 calls L1-get-item as a child flow only when the corresponding blocker appears

## Runtime State to Maintain (explicit variables; do not estimate verbally)

- `targetPetId` -- the final pet `petId` to convert into an egg; comes from `capture-pet` response (new capture branch) or a user-specified match in `query-pets` (existing pet branch)
- `targetPetCid` -- when using the "new capture" path, the target `petCid` specified by the user (passed to `query-capture-setup` / `capture-pet` / `set-capture-prop`)
- `petsBefore` / `petsAfter` -- `query-pets` snapshots before and after capture, used to diff out `targetPetId` when `capture-pet` does not directly return petId
- `maxPetLimit` / `remainingPetSlots` -- fields returned by `query-pets`; in the new capture branch, `remainingPetSlots == 0` must stop and report blocker before capture
- `createdEgg` -- new egg object returned by `make-pet-egg`; primary success signal
- `removedFromPetList` -- flag returned by `make-pet-egg`; if `createdEgg` is missing but `removedFromPetList == true`, also treat it as success (only egg identity was not fully parsed)

## Success Criteria

- **Use "pet egg has been created" as the criterion**: prefer `createdEgg` returned by `make-pet-egg`
- If `createdEgg` is missing but `removedFromPetList == true` -- still success, but tell the user "egg identity was only partially parsed"
- Only seeing "pet was captured" **does not count as success**: capture is only an intermediate step in the new capture branch
- Only seeing "make-pet-egg did not error" **does not count as success**: success must be judged by `createdEgg` or `removedFromPetList`

## Preconditions / Blockers

**Self-check before starting** (identify blockers early and handle them through the Blocker Recovery Pattern instead of terminating directly):

- **Pet slots** (new capture branch only): if `query-pets` returns `remainingPetSlots == 0`, stop and report blocker (ask the user to decide whether to release a slot or use the "existing pet" path)
- **Capture skill available** (new capture branch only): player battle talent must have `Capture` unlocked and at the level required by the target pet; otherwise use Blocker Recovery Pattern §1
- **Capture in shortcut bar** (new capture branch only): current skill shortcut bar must include `Capture`; otherwise use Blocker Recovery Pattern §2
- **Capture prop sufficient and mounted** (new capture branch only): `Capture` needs the corresponding capture prop (`pet-egg` / `capture-trap`, etc.); `query-capture-setup --target <petCid>` automatically estimates required quantity for the target; missing or unmounted prop uses Blocker Recovery Pattern §3
- **Weapon compatible with Capture** (new capture branch only): some weapons do not support casting `Capture`; incompatibility uses Blocker Recovery Pattern §4
- **make-pet-egg material prerequisites**: if `make-pet-egg` returns missing materials, use Blocker Recovery Pattern §5 (uniformly use L1-get-item to replenish)
- **Paid actions are rejected by default**: when materials/items are missing, **do not** default to store purchases / `energy-manage --action buy|borrow` or other paid paths; first recurse through L1-get-item, and ask the user only when no path exists
- **The target is "have an egg", not "have a new pet"**: after `createdEgg` / `removedFromPetList == true` is established, this workflow must stop; do not continue to `hatch-pet` / `claim-pet`

## Execution Steps (numbered; do not skip)

```
1. Resolve source pet (decide between "capture new pet then egg" and "existing pet to egg")
   - The user must explicitly choose the path; if not explicit, ask first and do not choose "new capture" yourself
   - New capture then egg path:
     a. lumiterra query-pets                       -> record petsBefore, maxPetLimit, remainingPetSlots
        -> If remainingPetSlots == 0: stop and report blocker; do not enter capture
     b. lumiterra query-capture-setup --target <targetPetCid>
        -> Structured pre-check for capture prerequisites; fill gaps through Blocker Recovery Pattern according to the response
        -> After --target is passed, it automatically estimates whether the currently mounted prop is enough for this target pet
        -> After recovery, return to this step and retry until pre-check passes
     c. lumiterra capture-pet --target <targetPetCid>
        -> capture-pet finds the target and moves to the spawn area itself; do not add extra navigate
        -> Prefer petId from the response -> targetPetId
        -> If the response has no petId: run lumiterra query-pets as petsAfter, diff the new pet -> targetPetId
   - Existing pet to egg path:
     a. lumiterra query-pets
     b. Match a concrete petId by user-provided petId / pet name / pet cid -> targetPetId
        -> Name / cid matching must happen agent-side; success requires a unique hit, and multiple hits require user clarification

2. Optional cleanup (reduce state ambiguity)
   If targetPetId is currently following, dismiss once first:
   lumiterra pet-summon --pet-id <targetPetId> --action dismiss
   -> This step is optional, not a hard prerequisite; skip it if the pet is not following

3. Convert the target pet into an egg
   lumiterra make-pet-egg --pet-id <targetPetId>
   -> If missing materials or other unmet prerequisites are returned: use Blocker Recovery Pattern §5 to replenish, then return to this step and retry
   -> Do not bypass with another command (for example craft-execute); pet-to-egg conversion must use make-pet-egg

4. Verify success / finish
   - Prefer reading createdEgg from the step 3 response:
     -> createdEgg exists -> record the egg itemInstanceId / itemCid / level, tell the user "egg has been created", stop this L1
   - If createdEgg is missing but removedFromPetList == true:
     -> Treat as success, but tell the user "egg was created, but this run did not fully parse the egg identity"
   - If neither field is satisfied:
     -> Do not retry make-pet-egg on your own; first query-pets to confirm whether targetPetId is still in the list
       - Still in the list -> return to step 3, inspect prerequisites / replenish, then retry
       - No longer in the list -> treat it by the previous "removedFromPetList" criterion
```

## Blocker Recovery Pattern

For this workflow, **do not** terminate at the first missing prerequisite / missing material; treat the blocker as a sub-goal, fix it, then return to the original blocked step and continue. The following recovery paths are shared with L1-12, and their numbers correspond to the precondition self-check sections.

### §1 Capture unavailable or level too low (new capture branch only)

- `lumiterra query-talent` -> inspect player `battle` talent tree nodes related to Capture
- `lumiterra talent-manage --action upgrade --talent-type battle --node-id <captureNodeId>` -> upgrade until the target requirement is met
- Return to the blocked `query-capture-setup` / `capture-pet` and retry

### §2 Capture not in current skill shortcut group (new capture branch only)

- Read `captureSkillId` from current character data
- `lumiterra set-skill-shortcut --skill-id <captureSkillId> --slot <1|2|3>` -> put `Capture` into the current shortcut bar
- Return to the blocked capture step and retry

### §3 Capture prop missing / not mounted / insufficient (new capture branch only)

- `lumiterra query-inventory --type wearable,food,material,pet-egg` -> check whether the required capture prop already exists
- If inventory quantity is insufficient, call **L1-get-item (shared workflow: obtain item)** to replenish enough quantity
- `lumiterra set-capture-prop --item-instance-id <itemInstanceId> --target <targetPetCid>` -> mount it to `Capture`
- Return to `query-capture-setup` / `capture-pet` and retry

### §4 Current weapon incompatible with Capture (new capture branch only)

- `lumiterra query-inventory --type wearable` -> find a weapon `itemInstanceId` that supports casting Capture
- If no compatible weapon exists, call **L1-get-item** to replenish one
- `lumiterra equip --action equip --item-instance-id <weaponItemInstanceId>` -> equip the compatible weapon
- Return to the blocked capture step and retry

### §5 make-pet-egg missing material / prerequisite

- Read structured missing material / prerequisite information from the `make-pet-egg` response
- Material gaps: call **L1-get-item** to replenish enough quantity
- After replenishment, return to step 3 and retry `make-pet-egg --pet-id <targetPetId>`
- Do not bypass through `craft-execute` / store paths

### Target State Rules (general principle of Blocker Recovery Pattern)

- **Skill shortcut configuration / prop mounting are part of workflow execution**, not manual prerequisites; when the agent detects misconfiguration, configure it directly instead of handing it to the user
- **All material blockers recurse into L1-get-item**: capture props, compatible weapons, and materials required by make-pet-egg all use the L1-get-item child flow
- **Stop only when the user explicitly forbids the recovery path**; for example, if the user says "do not upgrade talent" / "do not farm materials", respect that intent and report blocker. By default, try to recover
- **After recovery, return to the original blocked step and retry**, instead of restarting the entire workflow from scratch

## Called Base Workflows / Shared Workflows

- **L1-get-item (shared workflow: obtain item)** -- unified material replenishment entry for Blocker Recovery Pattern §3 / §4 / §5
- Indirect CLI command dependencies:
  - `query-pets` -- single source of truth for list / capacity / target location / diff before and after capture
  - `query-capture-setup` -- structured pre-check entry before capture (with `--target <petCid>`, it automatically estimates required capture prop quantity)
  - `capture-pet` -- capture command in the new capture branch (finds target + moves by itself; do not add extra navigate)
  - `query-talent` / `talent-manage` -- §1 upgrade `Capture`-related battle nodes
  - `set-skill-shortcut` -- §2 put `Capture` into the current shortcut bar
  - `set-capture-prop` -- §3 mount capture prop to `Capture`
  - `query-inventory` -- §3 / §4 find capture props / compatible weapons
  - `equip` -- §4 equip compatible weapon
  - `pet-summon` -- optional dismiss in step 2
  - `make-pet-egg` -- core action in step 3, **consumes** source pet

## Important Notes (HARD RULES)

- ⚠️ **make-pet-egg consumes the source pet irreversibly**: after success, `targetPetId` disappears from the `query-pets` list; the user **must** explicitly identify which pet to convert into an egg. Do not convert a pet that the user did not specify
- ⚠️ **The workflow endpoint is "have an egg", not "hatch egg" / "claim pet"**: stop once `createdEgg` / `removedFromPetList == true`; **do not continue by default** to `hatch-pet` / `claim-pet`. If the user wants hatching, enter the hatching chain separately
- ⚠️ **Path choice must be explicit from the user**: capture-new-then-egg vs existing-pet-to-egg have completely different pet-slot / Capture prerequisites; do not choose for the user by default, ask before starting
- ⚠️ **Pet slots are a hard gate for the new capture branch**: when `query-pets` returns `remainingPetSlots == 0`, you **must not enter capture**; report blocker and let the user decide (release a slot / switch to existing pet path)
- ⚠️ **Do not add navigate before capture-pet**: `capture-pet` finds the target and moves to the corresponding spawn area itself; adding navigate can cause position drift
- ⚠️ **Blocker recovery is the default behavior**: when a prerequisite / material is missing, you **must** use the Blocker Recovery Pattern to try to fill it; do not terminate the workflow at the first blocker unless the user explicitly forbids the recovery path
- ⚠️ **Material gaps always use L1-get-item**: capture props, compatible weapons, and materials required by make-pet-egg all use the L1-get-item child flow; L1-get-item decides which path to use (buy / loot / gather / craft)
- ⚠️ **Paid actions are rejected by default**: when items / materials are missing, **do not** default to store purchases or `energy-manage --action buy|borrow`; first recurse through L1-get-item, and ask the user only when no path exists
- ⚠️ **Existing pet path must not capture again**: if the user gives `petId` / pet name / pet cid, prioritize locking the existing pet and do not capture a new pet for egg-making; name / cid matching must happen agent-side, and multiple hits require user clarification
- ⚠️ **User abort -> run `lumiterra stop` first**: if the user says "do not do it" / "stop" during the new capture branch, the first action is `lumiterra stop` (cancel `capture-pet` and other long tasks), then optionally `pet-summon --action dismiss`
- ⚠️ **petId is a 64-bit ID**: external scripts / logs must not use `jq -r` for `petId` (precision loss); use `python3` or `grep -oE` to preserve the original string (see SKILL.md "64-bit ID precision trap")

## Notes / Common Mistakes

- Running `hatch-pet` / `claim-pet` immediately after `make-pet-egg` -- outside this L1 scope; hatching / claiming is an independent follow-up chain, and should not run unless the user explicitly asks
- User only gave pet name / cid, but you run `capture-pet` to catch a new pet for egg-making -- existing pet path must take priority; do not expand the task yourself
- Forcing `capture-pet` in the new capture branch when `remainingPetSlots == 0` -- the server rejects it; read slots in step 1 first
- Adding `query-spawn-point + navigate` before `capture-pet` -- duplicate target finding, and it may conflict with `capture-pet`'s own movement logic
- Immediately judging failure when `createdEgg` is missing from `make-pet-egg` response -- check `removedFromPetList` first; if true, it is still success (egg identity was not fully parsed)
- Immediately retrying `make-pet-egg` when both `createdEgg` and `removedFromPetList` are missing -- first run `query-pets` to confirm whether the pet has already been consumed, avoiding a duplicate attempt after a successful run
- Terminating immediately when capture props / materials are missing -- violates Blocker Recovery Pattern; recursively run L1-get-item to replenish, then return to the original step
- Using `energy-manage --action buy` or store actions when materials are missing -- paid actions are rejected by default; use L1-get-item first, and ask the user if there is no path
- Mixing this workflow with L1-12 (pet-train) -- L1-12 targets specialization level increase (pet remains), while L1-13 targets **consuming the pet for an egg**; the directions are opposite and must not be mixed
- Using `jq -r '.petId'` to read petId for reconciliation -- 64-bit precision is lost; use `python3` or `grep -oE` to preserve the original string
