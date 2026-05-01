# L1-get-item: Obtain a Specific Item (Routing Core)

> Source of truth: this file. When executing this workflow, the Agent **must** follow the order in the "Execution Steps" section and must not merge or skip steps.
> Number index: L1-get-item (routing core; agents can locate it by either number or name).

This workflow is the **routing core** of the Earn system: every scenario that "needs a specific item" goes through this entry first. It decides whether to use gathering / combat / crafting / farming / animal care / fishing, instead of letting the upper layer guess the path from memory.

## Trigger Conditions

- Trigger phrases:
  - "get me N X" / "help me get X" / "missing material" / "farm 50 iron ore" / "get some Y"
  - Any scenario for "obtaining a specific item" (including when itemCid is known, or only a name / description is given)
- L1 / upper-layer call scenarios:
  - The user directly requests obtaining an item
  - A quest sub-item is `GetItem`
  - `HandInItem` is blocked by `missingItems`
  - Crafting, pet, capture, convoy, and other workflows are blocked by missing materials / items / feed / tickets / equipment

## Runtime State to Maintain (explicit variables; do not estimate verbally)

- `targetItemCid` -- target itemCid
- `requiredCount` -- quantity required by the outer layer
- `beforeCount` -- current inventory count from `query-inventory` before starting
- `afterCount` -- inventory count from a fresh `query-inventory` after one production round
- `remainingCount = requiredCount - (afterCount - beforeCount)`
- `recipeId` -- appears only when name / description resolves to a recipe, or when the source is `source.type = craft`

## Success Criteria

- First run `query-inventory` and record `beforeCount`
- If `beforeCount >= requiredCount` -- return success immediately; do not run any production chain
- Success requires `afterCount - beforeCount >= requiredCount`
- ⚠️ **Do not judge completion only by child workflow / command `success=true`**; inventory quantity increase is the required source of truth

## Get Item Calling Convention (interface of this L1)

This section defines how upper layers (daily-quest / craft / convoy / capture / other L1 workflows) call L1-get-item, and how L1-get-item dispatches downward to `base-workflows/SW-*`. Base workflows do not repeat this convention; update this section directly when it changes.

### Input / Output Contract

- **Input parameters**
  - `targetItemCid` (required; if the upper layer only has a name / description, L1-get-item resolves it through `query-recipes` in step 2 before setting `targetItemCid`)
  - `requiredCount` (required; required quantity)
- **Output semantics**
  - `completed` -- `afterCount - beforeCount >= requiredCount`; exits normally
  - `blocker` -- `query-item-sources` returns empty / `source.type` is not covered / name cannot be uniquely resolved / energy cannot be restored / required equipment is missing / no usable target entity exists; report clearly and **do not skip silently**
  - `partial` -- some progress was made, but a gap remains and cannot continue; return this with the same incident context as `blocker`

### Inventory Check Semantics & Gap Calculation

- After each production chain round, rerun `query-inventory` and calculate `remainingCount = requiredCount - (afterCount - beforeCount)`
- `remainingCount <= 0` -> complete and exit
- `remainingCount > 0` -> continue only for the remaining gap; when continuing, **return to step 3 or step 4** depending on whether the previous round used the recipe-direct or source-resolution branch
- ⚠️ After every round, query the inventory directly; do not rely on old estimates, and do not rely on the output count reported by the child workflow

### targetCount Passing Convention (L1-get-item -> base-workflows)

After Get Item receives `source.type` from `query-item-sources`, pass "gap + buffer" to the downstream base workflow according to the table below:

| `source.type` | Dispatch to | Parameters |
|---|---|---|
| `monster_drop` | SW-4 `combat-loop` | `monsterCid = source.sourceId`, `targetKillCount = gap x multiplier` (recommend x2) |
| `gathering` | SW-1 `gather-entity` | `resourceCid = source.sourceId`, `targetCount = gap x 1.2` |
| `seed_planting` | SW-2 `crop-farming` | `seedCid = source.sourceId`, `targetHarvestCount = gap` |
| `animal_pet` | SW-3 `animal-petting` | `animalCid = source.sourceId`, `targetPetCount = gap x multiplier` |
| `fishing` | SW-5 `fishing-loop` | `fishCid = source.sourceId`, `targetCatchCount = gap x multiplier` |
| `craft` | **Do not jump to a black-box workflow**; expand directly inside this L1: `query-recipes --recipe-id <sourceId>` -> analyze missing materials -> recursively enter L1-get-item for each missing material -> `craft-execute --recipe <sourceId> --count <n>` | -- |
| `unknown / future type` | Record `type/sourceId/sourceName`, report blocker, keep a TODO workflow stub | -- |

- The buffer covers drop probability / fragmentation overhead: `monster_drop` recommends x2, `gathering` around x1.2, `animal_pet` / `fishing` according to probability; `seed_planting` is usually 1:1 (plant several seeds and harvest several crops)
- Downstream base workflows keep their semantic parameter names (`monsterCid` / `resourceCid` / `seedCid` / `animalCid` / `fishCid`) and **do not force them into a unified `targetCid`**

### Progress Verification Responsibility Split

| Scenario | L1-get-item responsibility | base-workflow responsibility |
|---|---|---|
| Triggered independently (user directly runs a base-workflow) | -- | Loop to `targetCount` itself, and use `query-inventory` to confirm drops |
| Called by L1-get-item | `beforeCount` / `afterCount` total inventory verification | Loop only to `targetCount` and exit; **do not repeat beforeCount/afterCount comparison** |

When a base-workflow is called by L1-get-item, after it returns, **L1-get-item reruns `query-inventory` to calculate `afterCount - beforeCount`**, and then decides whether to continue / switch source / retry / report blocker according to whether `requiredCount` has been reached.

## Preconditions / Blockers

**Self-check before starting** (report blockers early if unmet; do not wait until halfway through):

- HP: if `HP / MaxHP < 40%` -> first follow the HP safety path (`escape-combat` -> move away / `back-to-town`); do not enter a production chain
- Energy: when `energy = 0`, every production path except `fishing` can return `success=true` but no drops; pass the energy gate first
- Equipment / tools:
  - Combat targets (`monster_drop`) -> require a weapon (sword / bow / etc.); if missing, `switch-weapon` or run L1-get-item for equipment first
  - Gathering targets (`gathering`) -> require pickaxe / axe / sickle (see SW-1 tool mapping)
  - Craft targets (`craft`) -> require being near a crafting station, and all sub-materials must be obtainable
  - Planting targets (`seed_planting`) -> require an available `soil-id` (see SW-2)
  - Animal targets (`animal_pet`) -> require being able to approach the animal's petting window (see SW-3)
- Name resolution ambiguity: if the user only gives a name and `query-recipes` has multiple tied candidates that cannot be resolved uniquely -> **report a blocker directly; do not choose randomly**

## Default Source Priority (when `query-item-sources` returns multiple sources)

**Prefer the shortest dependency chain**:

1. Current inventory already satisfies the requirement (`beforeCount >= requiredCount`)
2. Current materials are sufficient and can run `craft-execute` directly
3. Single-layer source (does not depend on additional sub-materials)
4. Multi-layer recursive source

If dependency depth is the same, prefer the source that already has a complete command chain and a clear verification method; if still tied -> report a blocker and do not guess.

## Execution Steps (numbered; do not skip)

```
1. Inventory snapshot
   lumiterra query-inventory --item-cid <targetItemCid>
   -> Record beforeCount
   -> If beforeCount >= requiredCount, return completed directly

2. Resolve the target
   a. If the user already provided itemCid:
      -> targetItemCid = itemCid
   b. If the user only provided a name / description:
      lumiterra query-recipes
      -> By default only unlocked recipes are returned; if no candidate exists but lockedRecipeCount > 0, re-check locked candidates with `--include-locked`
      -> Select candidate by priority:
        1. recipe.name exact match
        2. highest overlap with description keywords
        3. most consistent with current quest context
      -> Unique candidate -> record targetItemCid and recipeId
      -> No candidate -> report blocker: there is currently no generic "lookup itemCid by name" capability
      -> Still tied -> report blocker; do not choose randomly

3. Recipe-direct branch (only when step 2b successfully resolved recipeId)
   ⚠️ When recipeId already exists, do not call query-item-sources first
   lumiterra query-recipes --recipe-id <recipeId>
   -> Analyze each material need vs have gap
   -> For each missing materialItemCid, recursively enter this L1-get-item (requiredCount = that material gap)
   lumiterra craft-execute --recipe <recipeId> --count <amount>
   -> After completion, jump to step 6

4. Source-resolution branch (used by step 2a or when recipe-direct does not hit)
   lumiterra query-item-sources --item-cid <targetItemCid>
   -> sources empty -> report blocker
   -> Choose source by "shortest dependency chain first" (see priority section above)

5. Dispatch by source.type (use the "Get Item Calling Convention -> targetCount Passing Convention" table)
   Calculate gap = requiredCount - (current inventory count), then add buffer according to source.type:
   a. source.type = gathering
      -> Call SW-1-gather-entity (resourceCid = source.sourceId, targetCount = gap x 1.2)
   b. source.type = monster_drop
      -> Call SW-4-combat-loop (monsterCid = source.sourceId, targetKillCount = gap x 2)
   c. source.type = seed_planting
      -> Call SW-2-crop-farming (seedCid = source.sourceId, targetHarvestCount = gap)
   d. source.type = animal_pet
      -> Call SW-3-animal-petting (animalCid = source.sourceId, targetPetCount = gap x multiplier)
   e. source.type = fishing
      -> Call SW-5-fishing-loop (fishCid = source.sourceId, targetCatchCount = gap x multiplier)
   f. source.type = craft
      -> Stay inside this L1 and expand:
         lumiterra query-recipes --recipe-id <sourceId>
         -> Analyze material gaps; recursively enter this L1-get-item for each missing material
         lumiterra craft-execute --recipe <sourceId> --count <n>
      -> **Do not jump to any black-box workflow**
   g. source.type = unknown / future addition
      -> Record raw type / sourceId / sourceName, report blocker, keep a TODO workflow stub; do not invent a fallback
   After each branch returns, jump to step 6

6. Progress check
   lumiterra query-inventory --item-cid <targetItemCid>
   -> afterCount = current quantity
   -> remainingCount = requiredCount - (afterCount - beforeCount)
   -> remainingCount <= 0 -> completed and exit
   -> remainingCount > 0  -> continue only for the remaining gap;
                           if the original path was recipe-direct (step 3), return to step 3
                           if the original path was source-resolution (step 4/5), return to step 4

7. Stop condition
   Only when the requested quantity truly appears in the inventory is it completed
   If a gap remains and no source can advance it -> return partial / blocker to the upper layer
```

## Called Base Workflows (base-workflows)

Dispatch by `source.type`; see the table above for downstream numbers and parameters:

- `SW-1-gather-entity.md` -- `gathering`
- `SW-2-crop-farming.md` -- `seed_planting`
- `SW-3-animal-petting.md` -- `animal_pet`
- `SW-4-combat-loop.md` -- `monster_drop`
- `SW-5-fishing-loop.md` -- `fishing`
- `source.type = craft` is not delegated; this L1 directly expands with `query-recipes --recipe-id <sourceId>` + `craft-execute`
- `source.type = farming` (daily / bounty Farming semantics) -> use `L1-1-to-3-daily-quests.md`

## Important Notes (HARD RULES)

- ⚠️ **Must run `query-item-sources --item-cid <targetItemCid>` first to get the acquisition path**; **do not guess the source from memory**, and do not skip this step to directly run `auto-gather` / `auto-combat` / `fish`
- ⚠️ **Keep the `targetCount = gap x multiplier` buffer** (`monster_drop` >= x2, `gathering` x1.2, `animal_pet` / `fishing` by probability); using gap 1:1 as the target can fail under drop rate / fragmentation loss
- ⚠️ **When `recipeId` already exists, do not call `query-item-sources` first** (step 3 recipe-direct branch); checking the recipe's internal material gap is the shorter path
- ⚠️ **Default recipe lists hide locked recipes**: when name/description resolution fails but `lockedRecipeCount > 0`, first run `query-recipes --include-locked` to inspect locked recipes, then decide whether to report "not unlocked" or "no generic itemCid lookup capability"
- ⚠️ **`source.type = craft` must not "jump to another black-box workflow"**; it must directly run `query-recipes --recipe-id <sourceId>` + recursively call L1-get-item for materials + `craft-execute` inside this L1
- ⚠️ **Success is judged only by inventory increase**: `afterCount - beforeCount >= requiredCount`; only checking command / child workflow `success=true` can misjudge
- HP < 40% must disengage (see SKILL.md hard rule; do not enter combat / gathering / petting loops at dangerous HP)
- Energy priority: use inventory potions first (`use-item`), then `energy-manage --action buy|borrow` if still insufficient (buy/borrow does not restore energy directly; it only produces energy potion items, which must then be consumed with `use-item`), and `buy|borrow` requires user authorization
- Death -> `revive`, then resume the original flow
- After every production chain round, **rerun `query-inventory`**; do not rely on old estimates or verbal output counts from child workflows
- Uncovered `source.type` always reports blocker + keeps a TODO stub; **do not invent fallback paths**

## Notes / Common Mistakes

- Skipping `query-inventory` and starting production directly -- you do not know the existing count, and may discover after running that it was already enough
- Skipping `query-item-sources` and directly running `auto-gather` / `auto-combat` -- you do not know spawn points / drop rate, and often have a cid but no spawned entity on the map
- Treating `gap` as a 1:1 `targetCount` -- gathering loss / combat drop probability can leave the target unmet and require another round
- Randomly choosing a candidate when name resolution is ambiguous -- wrong resolution wastes all production; report a blocker instead
- Not checking inventory after a round and judging success from the child workflow's "estimated output" -- common with `monster_drop`, where drop variance can leave one or two missing
- Calling `query-item-sources` first in the recipe-direct branch -- wastes a call and may route into a longer path outside craft
- Sending `source.type = craft` into combat-loop / gather-entity -- the type was misread; craft must expand inside this L1
- Forcing a run when HP < 40% or energy = 0 -- `auto-gather` / `auto-combat` may "succeed" but produce nothing, wasting time
