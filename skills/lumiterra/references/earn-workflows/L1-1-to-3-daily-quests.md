# L1-1-to-3: Daily + Bounty Quests (Three Talents Merged)

> Source of truth: this file. When executing this workflow, the Agent **must** follow the order in each subsection's "Execution Steps" section and must not merge or skip steps.
> Number index: L1-1 / L1-2 / L1-3 (merged; agents can locate it by either number or name).
> Merge basis from the original three docs/workflows.md sections: each section title already contained "daily/bounty", and the two quest types were never separated; both "today's daily" and "bounty" triggers route to this file.

This workflow is the **quest skeleton layer** in the Earn system: it is only responsible for the closed loop of quest-list / quest-accept / subItem dispatch / quest-submit / quest-claim. All action sub-tasks are delegated to `base-workflows/SW-*`; submission sub-tasks are delegated to `L1-get-item`. This file does not repeat HP safety line / energy gate / weapon switching / navigate details from child workflows -- those are embedded in the corresponding SW files.

## Trigger Conditions

- Trigger phrases: "today's daily" / "bounty" / "daily" / "farm daily" / "do bounty" / "do today's quests"
- Covered talent directions: `battle` / `gather` / `farming`
- L1 / upper-layer call scenarios:
  - User says "do today's daily" -> choose talent direction (battle / gather / farming) according to current equipment / energy / HP, then route to the corresponding subsection
  - User says "do bounty" -> same as above; bounty and daily share the `quest --type daily` entry
  - User explicitly says "do battle daily" / "farm gather bounty" / "do farming daily" -> directly enter the L1-1 / L1-2 / L1-3 subsection

## Preconditions / Blockers

**Self-check before starting** (report blockers early if unmet; do not wait until halfway through):

- Character alive: `query-status` -> if `state=dead`, run `revive` first
- HP safety line: if `HP / MaxHP < 40%`, follow the HP safety path first (`escape-combat` / `back-to-town`); do not enter combat / gathering loops
- Energy: `energy = 0` causes all production except fishing to return "success but no drops"; hoeing (`farm-hoe`) is directly blocked by the server when energy is insufficient
- Equipment / tools (by talent direction):
  - `battle` -> sword / bow / hammer and other combat weapons; if missing, `switch-weapon` or run L1-get-item for equipment first
  - `gather` -> pickaxe / axe / sickle (by resource type; mapped inside SW-1)
  - `farming` -> hoe / pickaxe (for clearing expired soil) / water-bottle / brush; switching is embedded in SW-2 / SW-3
- Do only one talent direction's daily at a time (do not mix battle / gather / farming)

## Shared Flow Skeleton (used by all three subsections)

```
query-status -> quest-list --type daily -> quest-accept --talent <battle|gather|farming>
-> quest-list --type daily (obtain structured subItem data)
-> dispatch by subItem.type (see table below)
-> quest-submit (HandInItem material submission) / quest-claim (claim reward)
```

## subItem Dispatch Table (used by all three subsections)

Sub-tasks returned by `quest-list` are routed by subItem type to child workflows or `L1-get-item`. **Action loop details (HP / energy management, weapon switching, navigate, `query-spawn-point` fallback) are encapsulated inside SW files; this table only lists entries**.

| subItem.type | Route | Key parameters |
|---|---|---|
| `KillMonster` | SW-4 `combat-loop` | `monsterCid` |
| `GatherResource` | SW-1 `gather-entity` | `resourceCid` |
| `Watering` | SW-2 `crop-farming` | `seedCid` |
| `HarvestHomeItem` | SW-2 `crop-farming` | `seedCid` |
| `PetAppease` | SW-3 `animal-petting` | `animalCid = petCid` |
| `HandInItem` | Try `quest-submit --task-id <taskId>` directly; if it returns `missingItems[].itemCid`, recursively run `L1-get-item` for each missing itemCid, then retry | -- |
| `TargetPosition` | `navigate --x <x> --y <y> --z <z>` (coordinates come from `subItem.targetPos`) | -- |
| `UseRecipe` | `craft-execute --recipe <recipeId>` (if materials are missing, use the craft branch in `L1-get-item`) | -- |
| `UseItem` | Use `query-inventory` to find `itemInstanceId` -> `use-item --item-instance-id <itemInstanceId>` | -- |

---

## L1-1: Battle Talent Daily + Bounty

**L1-1 is only responsible for the quest skeleton**. All action sub-tasks (mainly `KillMonster`) are delegated to SW-4-combat-loop; submission tasks (`HandInItem`) are delegated to `L1-get-item`.

### Execution Steps

```
1. lumiterra query-status
   -> Confirm the character is alive, HP safety line is met (>= 40%), and energy is sufficient

2. lumiterra quest-list --type daily
   -> Check daily quest state; if an inprogress quest already exists, skip step 3 and go directly to step 4

3. lumiterra quest-accept --type daily --talent battle
   -> Accept battle-direction daily

4. lumiterra quest-list --type daily
   -> Extract structured data from subItem:
     - type=KillMonster -> monsterCid (used as SW-4 target)
     - guidePos -> x, y, z (optional; SW-4 internally falls back to query-spawn-point --type monster --cid <monsterCid>)

5. Dispatch by subItem.type (see subItem Dispatch Table)
   - KillMonster -> call SW-4-combat-loop (pass monsterCid; HP safety line, auto-combat loop, weapon selection, and navigate are handled inside SW-4)
   - HandInItem -> quest-submit --task-id <taskId>; if missingItems is non-empty, call L1-get-item for each itemCid, replenish, then retry

6. lumiterra quest-claim --type daily
   -> Claim rewards after the quest completes

7. lumiterra query-status
   -> Check HP / energy and decide whether to continue to the next daily
```

### Called Base Workflows

- `SW-4-combat-loop.md` -- handles `KillMonster`
- `L1-get-item` -- replenishes `missingItems` for `HandInItem`

### Battle Daily Specific Tips

- Battle dailies are best run when both energy and HP are healthy
- **Must switch to a combat weapon** (sword / bow / hammer); otherwise `auto-combat` may attack monsters with a pickaxe / hoe, causing extremely low damage or no practical progress. Weapon switching is handled inside SW-4, but the L1-1 layer must ensure the inventory has at least one combat weapon for the corresponding talent; if missing, craft / L1-get-item first
- L1-1 **does not proactively decide** "whether to switch monsters" or "when to switch spawn points" -- those are delegated to SW-4 loop exit conditions
- HP safety rules, energy gates, and `escape-combat` choices are already embedded in SW-4; L1-1 does not repeat them

### Notes / Common Mistakes

- Fighting monsters with a pickaxe / hoe -- `switch-weapon` was not run first, so `auto-combat` may succeed but HP loss / progress is terrible
- Skipping the second `quest-list` call and guessing `monsterCid` -- each quest can have a different `monsterCid`; it must be read from the real subItem
- Calling `quest-claim` just because a command succeeded -- first rely on `quest-claim`'s own progress check or rerun `quest-list` to inspect `curRate/maxRate`
- Forcing combat at HP < 40% -- `auto-combat` can kill the character; disengage / heal first

---

## L1-2: Gathering Talent Daily + Bounty

**L1-2 is also only responsible for the quest skeleton**. Action sub-tasks (`GatherResource`) are delegated to SW-1-gather-entity; submission tasks (`HandInItem`) are delegated to `L1-get-item`. The dispatch rules are identical to L1-1 (see subItem Dispatch Table).

### Execution Steps

```
1. lumiterra query-status
   -> Confirm the character is alive and energy is sufficient (gathering consumes energy; when energy=0, commands succeed but produce no drops)

2. lumiterra quest-list --type daily
   -> Check daily state; if there is no inprogress quest, go to step 3 to accept one

3. lumiterra quest-accept --type daily --talent gather
   -> Accept gathering-direction daily

4. lumiterra quest-list --type daily
   -> Extract structured data from subItem:
     - type=GatherResource -> resourceCid (used as SW-1 target)
     - type=HandInItem     -> itemCid (material CID to submit)
     - guidePos            -> x, y, z (optional; SW-1 internally falls back to query-spawn-point --type gather --cid <resourceCid>)

5. Dispatch by subItem.type (see subItem Dispatch Table)
   - GatherResource -> call SW-1-gather-entity (pass resourceCid;
     SW-1 already contains resourceCid -> tool mapping: ore/stone/metal/crystal -> pickaxe, tree/wood -> axe, grass/fiber/flower/berry/mushroom -> sickle)
   - HandInItem -> quest-submit --task-id <taskId>; if missingItems is non-empty, call L1-get-item for each itemCid, replenish, then retry

6. lumiterra quest-claim --type daily
   -> Claim rewards after the quest completes
```

### Called Base Workflows

- `SW-1-gather-entity.md` -- handles `GatherResource`
- `L1-get-item` -- replenishes `missingItems` for `HandInItem`

### Gathering Daily Specific Tips

- Gathering dailies mainly contain `GatherResource` + `HandInItem`; the former goes to SW-1, the latter uses L1-get-item to replenish materials
- SW-1 already contains resourceCid -> weapon/tool mapping (ore -> pickaxe / tree -> axe / herb -> sickle) and energy gating, so L1-2 does not repeat them
- When one quest involves multiple resources (ore + wood), **SW-1 reruns `switch-weapon` internally before each new resourceCid**; the L1-2 layer only passes resourceCid in order

### Notes / Common Mistakes

- Carrying a sword while mining stone -- `auto-gather` misses; rely on SW-1 tool mapping to switch automatically
- Skipping the second `quest-list` call and using a remembered `resourceCid` -- each accepted gathering target can differ
- Forcing gathering at energy = 0 -- `auto-gather` succeeds but produces no drops; use `use-item` to restore energy first, or `energy-manage` (buy/borrow does not restore energy directly; it produces energy potion items that must then be consumed with `use-item`)
- Guessing materials are already available and skipping the `quest-submit` `missingItems` result -- try `quest-submit` first, then replenish the real gap

---

## L1-3: Farming Talent Daily + Bounty

**L1-3 is also a quest skeleton**. Crop-line actions are delegated to SW-2-crop-farming, and animal-line actions are delegated to SW-3-animal-petting. Dispatch rules are identical to L1-1 (see subItem Dispatch Table).

⚠️ **Important premise**: homestead is closed, and all farming / animal operations happen in **open-world farmland / animal areas**. Hoeing (`farm-hoe`) **automatically plants seeds**, so there is no manual planting step. Each fixed open-world farmland area auto-plants one crop type. SW-2 is already arranged correctly for "open world + auto-planting"; L1-3 does not need to care.

### Execution Steps

```
1. lumiterra query-status
   -> Confirm the character is alive and energy is sufficient (server directly blocks hoeing when energy is insufficient -- this is the only farming-line operation fully blocked by energy)

2. lumiterra quest-list --type daily
   -> Check daily state; if there is no inprogress quest, go to step 3 to accept one

3. lumiterra quest-accept --type daily --talent farming
   -> Accept farming-direction daily

4. lumiterra quest-list --type daily
   -> Extract structured data from subItem and decide whether to use the crop line or animal line by type:
     Crop line:
     - type=HarvestHomeItem -> seedCid (harvest target seed CID, curRate/maxRate)
     - type=Watering        -> seedCid (watering target; progress counts once only after the full crop cycle completes)
     Animal line:
     - type=PetAppease      -> petCid (= animalCid, animal target to appease)
     General:
     - type=HandInItem      -> itemCid (material CID to submit)
     - guidePos             -> x, y, z (optional)

   ⚠️ guidePos for Watering / PetAppease is often empty (serialization gap); SW-2 / SW-3 internally use
      query-spawn-point --type farm/animal --cid <seedCid|petCid> as the fallback area coordinates, so L1-3 need not handle it separately

5. Dispatch by subItem.type (see subItem Dispatch Table)
   Crop line:
   - Watering / HarvestHomeItem -> call SW-2-crop-farming (pass seedCid;
     SW-2 internally handles: farm-query chooses empty / expired soil -> farm-hoe auto-plants -> farm-water loop
     until mature -> farm-harvest; includes hoe / pickaxe / water-bottle switching and 30s timeout rules)
   Animal line:
   - PetAppease -> call SW-3-animal-petting (pass animalCid = petCid;
     SW-3 internally handles: animal-query filters ownerless / expired animals -> animal-pet appeases for 10-30s)
   General:
   - HandInItem -> quest-submit --task-id <taskId>; if missingItems is non-empty, call L1-get-item for each itemCid

6. lumiterra quest-claim --type daily
   -> Claim rewards after the quest completes
```

### Called Base Workflows

- `SW-2-crop-farming.md` -- handles `Watering` / `HarvestHomeItem` (crop line)
- `SW-3-animal-petting.md` -- handles `PetAppease` (animal line)
- `L1-get-item` -- replenishes `missingItems` for `HandInItem`

### Farming Daily Specific Tips

- ⚠️ **Progress rule for `Watering` sub-tasks**: the full crop cycle must be completed (all watering stages through growth completion) to count 1 progress. The watering loop inside SW-2 already encapsulates this rule; L1-3 only needs to pass `seedCid` to SW-2 when `subItem.type=Watering`
- ⚠️ **`guidePos` is usually empty for `Watering`(18) and `PetAppease`(19) sub-tasks**; SW-2 / SW-3 internally run `query-spawn-point --type farm/animal` to get area coordinates, so L1-3 does not need extra handling
- Homestead is closed, and all farming / animal operations happen in the open world; SW-2 is already arranged correctly for "open world + auto-planting"
- Equipment / tool switching (hoe / pickaxe / water-bottle / brush) is embedded in SW-2 / SW-3, so L1-3 does not repeat it
- Special energy gate for farming sub-tasks: **the server directly blocks hoeing when energy is insufficient** (unlike combat / gathering, which only produce "no drops"); SW-2 already checks energy at the start of the loop
- 30s pending-operation timeout, serial vs concurrent handling (`nextOpTime <= 60s` must be serial), and other WorldSoil rules are all encapsulated inside SW-2; the L1-3 layer does not care

### Notes / Common Mistakes

- Running `farm-hoe` + `farm-water` on N plots in a row and assuming you can come back to harvest all of them together -- the server 30s timeout clears early opened plots and resets progress; SW-2 is serial by default, and L1-3 must not force concurrency
- Passing `PetAppease` `petCid` as an `entityId` to `animal-pet` -- `petCid` is a class CID; SW-3 must run `animal-query` first and choose a concrete `entityId`
- Seeing "Home" in a `HarvestHomeItem` task name and assuming you need to enter homestead -- homestead is closed; everything is in the open world
- Skipping `query-status` and starting hoeing directly -- insufficient energy is blocked by the server, wasting the call
- Drops are sent through broadcasts -- CLI responses do not contain dropped items; progress / drops are verified by `query-inventory` and `quest-claim` progress

---

## Shared HARD RULES (used by all three subsections)

- ⚠️ **The closed loop must be complete**: `quest-list -> quest-accept -> dispatch by subItem.type -> quest-submit (HandInItem) / quest-claim (reward claim)`, and **`quest-claim` must not be skipped**; rewards are not deposited automatically
- ⚠️ **Do only one talent direction at a time**: battle / gather / farming directions **must not be mixed**; mixing causes quest-accept conflicts or subItem dispatch mismatches
- ⚠️ **HP < 40% must disengage** (see SKILL.md hard rule): do not enter SW-4 combat / SW-1 gathering / SW-3 petting loops at dangerous HP
- ⚠️ **Energy priority**: first consume inventory potions with `use-item` -> if still insufficient, use `energy-manage --action buy|borrow` (`buy|borrow` requires user authorization; buy/borrow does not restore energy directly, it only produces energy potion items that must then be consumed with `use-item`)
- ⚠️ **Death -> `revive`**, then resume the original flow; do not `quest-abandon` and accept again
- ⚠️ **For `HandInItem`, must try `quest-submit` once first** to obtain the real `missingItems` gap, then call `L1-get-item`; do not calculate the gap manually from `query-inventory`
- ⚠️ **`HandInItem` `quest-submit` does not require manual `item` / `count` parameters**; items are read automatically from quest data. If materials are insufficient, call L1-get-item according to `missingItems[].itemCid`, then retry
- Internal rules of action loops (weapon switching, navigate, `query-spawn-point` fallback, 30s timeout, drop broadcasts) are all encapsulated inside SW-1 / SW-2 / SW-3 / SW-4; **the L1-1 / L1-2 / L1-3 layer does not repeat them**
