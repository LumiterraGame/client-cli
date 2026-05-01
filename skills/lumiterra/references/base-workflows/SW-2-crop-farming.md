# SW-2: crop-farming — planting and harvest

> Source of truth: this file. Number index: SW-2 (agents can locate it by number or name as dual keys).
>
> This file merges two sources:
> - Original SW-2 atom (single-plot planting and harvest loop; see the SW-2 section in `docs/subworkflows.md`)
> - The planting-care portion of world-farmland-cycle (serial strategy during large-world batch patrol + 30s timeout hard rule; see original `SKILL.md` lines 1060-1105)
>
> **Strategy**: do not create a separate "batch mode" section. Write the 30s timeout + serial-by-default rules into this file as HARD RULES, and describe the single-plot atomic flow and batch handling in the same step set.

## Trigger conditions

| Type | Example / value |
|---|---|
| User intent keywords | "plant X", "harvest X", "water crops", "sow X", "patrol farmland" |
| L1 subtask type | `Watering` / `HarvestHomeItem` |
| `query-item-sources.type` | `seed_planting` |

## Input parameters

| Parameter | Required | Description |
|---|---|---|
| `seedCid` (= target crop CID) | Yes | ConfigId of the target seed / crop |
| `targetHarvestCount` | No | Target harvest count (controls loop exit); when omitted, the user or outer workflow decides |

## Trigger entries

### Entry A: called by an upper-level L1 workflow orchestration (atomic mode)

- Referenced by these L1 workflows:
  - `L1-1-to-3-daily-quests.md` (farming daily + bounty, crop branch)
  - `L1-4-token-tasks.md` (when token-pool tasks involve planting)
  - `L1-get-item.md` (dispatches here when `source.type = seed_planting`)
  - L1-5 crafting (`seed_planting` materials), L1-17/18 (`Watering` subtask)
- Parameter mapping (Get Item -> SW-2): `seedCid = source.sourceId`, `targetHarvestCount = shortage`

### Entry B: direct user request

- When the user asks for a one-off planting / watering / harvesting action that is not bound to any task, the agent may **directly** enter the SW-2 execution steps without running an L1 first.
- Typical Entry B phrasing:
  - "plant X", "harvest X", "water crops", "sow X"
  - "patrol farmland / take care of the crops"
  - **"large-world farming and animal patrol"** (the SKILL.md routing table points this phrase to both SW-2 + SW-3; the agent **must finish farmland first, then animals**, then call SW-3)

## Execution steps (numbered; do not skip)

```
1. lumiterra query-status
   <- Read hp and energy
   Hoeing soil with insufficient energy is blocked directly; harvesting without energy can execute but gives no drops
   energy = 0 and the goal is material farming -> first follow the energy gate (food -> use-item; only after authorization use energy-manage; buy/borrow does not restore energy directly, it only produces energy potion items that must then be consumed with use-item)
   HP / MaxHP < 40% -> immediately follow the HP safety line; do not enter planting

2. lumiterra query-spawn-point --type farm --cid <targetCropCID>
   <- Query the large-world farmland area coordinates (prefer navPosition; center is the area center)
   HARD RULE: do not skip this step and navigate directly; do not guess coordinates from memory
   No response / no navPosition -> tell the user "this crop has no farmland area on the current map", return stalled-no-target

3. lumiterra navigate --x <navPosition.x> --y <navPosition.y> --z <navPosition.z>
   <- Move to the farmland area

4. lumiterra farm-query --cid <targetCropCID>
   <- Inspect the soil status list in this area (includes position, status, expireInSeconds, nextOpTime)
   Must filter with --cid to avoid accidental cross-area operations
   Empty returned list -> return stalled-no-target and tell the user "no available plots"

5. Soil-care loop (iterate through the soil list returned by step 4, processing by priority):

   HARD RULE (30s timeout + serial by default): **after obtaining a soilId, execute the action command immediately**.
      Do not insert time-consuming steps such as query-status / query-inventory / navigate. See "Important notes".

   a. Crop is mature (status = harvestable):
      lumiterra farm-harvest --soil-id <soilId>
      -> Harvest the crop. Drops are sent by broadcast; progress is perceived through inventory delta.

   b. Soil is empty or expired (status = empty or expireInSeconds <= 0):
      # Empty-plot branch (status = empty):
      lumiterra switch-weapon --weapon-type hoe
      lumiterra farm-hoe --soil-id <soilId>   <- hoeing soil auto-sows; there is no manual sowing step

      # Expired other-player plot branch (expireInSeconds <= 0):
      lumiterra switch-weapon --weapon-type pickaxe
      lumiterra farm-eradicate --soil-id <soilId>   <- eradicate first
      lumiterra switch-weapon --weapon-type hoe
      lumiterra farm-hoe --soil-id <soilId>         <- hoe again (auto-sows)

   c. Needs watering (status = thirsty):
      lumiterra switch-weapon --weapon-type water-bottle
      lumiterra farm-water --soil-id <soilId>
      -> Returns nextOpTime (seconds until the next watering window) and status
      status = harvestable -> return to branch a and harvest directly
      nextOpTime > 60 -> for a single plot, the agent may leave to do other work and come back when due
      nextOpTime <= 60 -> wait briefly; do not start other planting concurrently at this point (see HARD RULES below)
      Repeat until the crop is mature

   Recommended order: harvest first -> hoe soil second -> water last; **finish the full lifecycle of one plot before starting the next plot**.

6. Result confirmation: lumiterra farm-query --soil-id <soilId>
   <- Verify that the status changed as expected (optional but recommended)

7. Loop exit decision:
   - targetHarvestCount reached              -> return completed and exit
   - after query-status, energy = 0          -> follow the energy gate; if insufficient, return stopped-low-energy
   - HP < 40%                                -> disengage immediately and return stopped-blocker
   - farm-query repeatedly returns empty / no actionable plots -> switch area (rerun step 2); if still none -> stalled-no-target
   Otherwise return to step 4 and choose the next plot
```

## Important notes (HARD RULES)

> **HARD RULE — 30s timeout + serial by default** (merged from world-farmland-cycle):
> - The server gives actionable states such as `thirsty` / `harvestable` / `loose` / `specialFunction` / `withered` a **30s timeout** (Unity-side `GameValue.WorldSoilNoOperateClearTime`). After timeout, the state is cleared and must be triggered again.
> - **Serial by default**: after obtaining a `soilId`, execute the action command **immediately**. Do not insert time-consuming steps such as `query-status` / `query-inventory` / `navigate`.
> - When `nextOpTime <= 60s`, the agent must run this plot through its full lifecycle (hoe -> water -> harvest) before moving to the next plot.
> - Only when `nextOpTime > 60s` and the agent is sure it can rotate through the plots within 30s may it run small-batch concurrency (<= 2-3 plots).

- Warning: **you must run `query-spawn-point --type farm --cid <targetCropCID>` before `navigate`, then run `farm-query`**. Do not guess coordinates from memory. Do not skip `query-spawn-point` and navigate directly.
- Warning: **`farm-query` must pass `--cid` to precisely filter the target seed area**, avoiding accidental operations when multiple areas overlap in view.
- Hoeing soil = auto-sowing. There is **no manual sowing step**. Each world farmland area is fixed to one crop; do not mix crops across areas.
- Energy gate: hoeing soil without energy is **blocked directly**; harvesting without energy can execute but gives **no drops**.
- Equipment requirements (three hard requirements; missing any one makes the workflow fail): hoe (`hoe`) for hoeing soil, pickaxe (`pickaxe`) for eradicating expired other-player plots, and water bottle (`water-bottle`) for watering. Use `switch-weapon` to switch automatically.
- Watering has a wait interval (`nextOpTime`), and different crops require different total watering counts. After `farm-water`, when `nextOpTime <= 60s`, **do not start other planting concurrently** (this hits the nextOpTime precision issue; see project commit 6b20c51).
- Plot ownership period: during the ownership period (`expireInSeconds > 0` and ownerId is not self), other players cannot operate the plot; wait for expiration or switch plots.
- `Watering` subtask counting rule: progress counts once only after **all watering stages through growth completion**; exiting mid-way does not count.
- HP safety line (HARD RULE): after every `query-status`, if `hp/maxHp < 40%`, the agent must immediately disengage. Do not use HP potions by default.
- **When called by Get Item**: the outer workflow is responsible for total inventory verification; this sub-workflow exits by `targetHarvestCount` and does not query `inventory` again.
- 64-bit `soilId`: do not use `jq`. If you need to extract `soilId` / `entityId` / `itemInstanceId` and similar fields from JSON, **do not** use `jq -r '.xxxId'` (precision trap; see SKILL.md §64-bit ID precision trap). Use `python3 -c 'import json,sys;...'` or `grep -oE`.

## Exit semantics (return-value convention)

The sub-workflow returns one of the following semantic states so the upper layer (Get Item / L1) can decide what to do next:

| State | Meaning |
|---|---|
| `completed` | `targetHarvestCount` reached; normal exit |
| `stalled-no-target` | No farmland spawn point found / `farm-query` repeatedly returned empty |
| `stopped-low-energy` | Energy gate failed (insufficient food and energy-manage was not authorized) |
| `stopped-blocker` | Hard blocker such as low HP / missing tool / ownership conflict |

## Notes / common mistakes

- Wrong: confuse batch concurrency with serial processing; process multiple soilIds in parallel, causing the first plots' 30s actionable states to time out and clear.
- Wrong: delay after obtaining a `soilId` by inserting `query-status` / `query-inventory`; this also triggers the 30s timeout.
- Wrong: omit `switch-weapon --weapon-type hoe` in the empty-plot branch; different actions require different weapons, and the wrong weapon will not trigger the action.
- Wrong: in the expired other-player plot branch, call `farm-eradicate` directly without `switch-weapon --weapon-type pickaxe`; it fails.
- Wrong: ignore `expireInSeconds <= 0`; expired plots should be `farm-eradicate` then `farm-hoe` again, not continue to `farm-water`.
- Wrong: skip `query-spawn-point` and navigate directly to remembered farmland coordinates from the previous run -> the area may no longer be there.
- Wrong: pass the **finished itemCid** (for example the finished itemCid for "wheat") as `seedCid` to `query-spawn-point --cid` -> no result. You must first run `query-item-sources --item-cid <itemCid>` to get `sources[].sourceId` of type `seed_planting`, then pass it.
- Wrong: use `jq -r '.data.soils[0].soilId'` to extract a 64-bit `soilId` -> precision is lost, and later `farm-water` / `farm-harvest` will definitely report "soil not found".
