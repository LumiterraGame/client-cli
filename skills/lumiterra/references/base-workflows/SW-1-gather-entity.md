# SW-1: gather-entity — gather entities

> Source of truth: this file. Number index: SW-1 (agents can locate it by number or name as dual keys).

## Trigger conditions

| Type | Example / value |
|---|---|
| User intent keywords | "gather X", "mine ore", "chop trees", "cut grass", "gather herbs" |
| L1 subtask type | `GatherResource` |
| `query-item-sources.type` | `gathering` |

## Input parameters

| Parameter | Required | Description |
|---|---|---|
| `resourceCid` | Yes | ConfigId of the target gather resource (warning: this is the **entity cid**, not the finished itemCid) |
| `targetCount` | No | Target quantity (controls loop exit); when omitted, the user or outer workflow decides |

## Trigger entries

### Entry A: called by an upper-level L1 workflow orchestration (atomic mode)

- Referenced by these L1 workflows:
  - `L1-get-item.md` (dispatches here when `source.type = gathering`)
  - `L1-1-to-3-daily-quests.md` (gathering daily / bounty subtask `GatherResource`)
  - `L1-4-token-tasks.md` (when token-pool tasks involve `GatherResource`)
  - Main / side quest L1 workflows also use this atom when they contain a `GatherResource` subtask
- Parameter mapping (Get Item -> SW-1): `resourceCid = source.sourceId`, `targetCount = shortage × 1.2`

### Entry B: direct user request

- When the user asks for a one-off gathering action ("gather 100 iron ore for me / chop 50 trees") and it is not bound to any task, the agent may **directly** enter the SW-1 execution steps without running an L1 first.
- Typical Entry B phrasing:
  - "gather X", "mine ore", "chop trees", "cut grass", "gather herbs"
  - "farm X for me for a while (gathering type)"

## resourceCid -> weapon type mapping (critical)

Gather entities determine the tool by resource type. Before `switch-weapon --weapon-type <type>`, the agent must determine which category `resourceCid` belongs to:

| Gather resource type | Tool | `--weapon-type` |
|---|---|---|
| Ore (Mineral) | Pickaxe | `pickaxe` |
| Trees (Wood) | Axe | `axe` |
| Herbs / fiber / grass | Sickle | `sickle` |
| Other | Check the Unity-side `GatherResource` config or ask the user first | — |

> Warning: if the `resourceCid` -> tool mapping is uncertain, first cross-check with `lumiterra query-item-sources --item-cid <itemCid>`, or ask the user to confirm the tool type directly. **Do not** guess the tool.

## Execution steps (numbered; do not skip)

```
1. lumiterra query-status
   <- Read hp and energy
   HP / MaxHP < 40% -> immediately follow the HP safety line (escape-combat -> move away / back-to-town), do not enter gathering
   energy = 0      -> follow the energy gate: query-inventory --type food -> use-item to recover;
                    energy-manage --action buy|borrow is allowed only after food is insufficient and the user authorizes it
                    (buy/borrow does not restore energy directly; it only produces energy potion items, which must then be consumed with use-item)
                    If recovery is still impossible -> return stopped-low-energy and stop
2. Determine the tool type for resourceCid (see the table above)
3. lumiterra switch-weapon --weapon-type <pickaxe|axe|sickle>
4. lumiterra query-spawn-point --type gather --cid <resourceCid>
   <- HARD RULE: do not skip this step and navigate directly; do not guess coordinates from memory
   No response / no navPosition -> tell the user "this resource has no spawn point on the current map", return stalled-no-target, and stop
5. lumiterra navigate --x <navPosition.x> --y <navPosition.y> --z <navPosition.z>
6. lumiterra auto-gather --target <resourceCid>
   <- Single gather loop (optional --count 1-5 / --timeout / --search-mode / --patrol-radius)
7. Loop exit decision:
   - targetCount reached                      -> return completed and exit
   - after query-status, energy = 0           -> follow step 1 energy gate; if insufficient, return stopped-low-energy
   - HP < 40%                                 -> disengage immediately and return stopped-blocker
   - auto-gather repeatedly returns "no target" -> switch spawn point (rerun step 4); if still none -> stalled-no-target
   Otherwise return to step 6
```

## Important notes (HARD RULES)

- Warning: **you must run `query-spawn-point --type gather --cid <resourceCid>` before `navigate`, then run `auto-gather`**. **Do not** guess coordinates from memory. **Do not** skip `query-spawn-point` and navigate directly. This is the core reason SW-1 exists.
- Warning: **`--cid` must be the entity cid (resourceCid), not the target item's itemCid**. If you only have the finished itemCid, first run `lumiterra query-item-sources --item-cid <itemCid>` to get `sources[].sourceId`, then pass that value.
- When energy = 0, `auto-gather` may succeed as an action but produces **no drops / no output**. Material-farming goals must ensure energy > 0.
- Drops are **not in the CLI response**. For independent trigger scenarios, progress is measured by comparing `lumiterra query-inventory` beforeCount. When called by Get Item, the **outer workflow is responsible for total inventory verification**; this sub-workflow exits by `targetCount` and **does not query inventory again**.
- HP safety line (HARD RULE): after every `query-status`, if `hp/maxHp < 40%`, the agent must immediately disengage and naturally recover HP. **Do not** use HP potions by default unless the user explicitly authorizes it.
- Tool switching is mandatory: ore -> `pickaxe`, trees -> `axe`, herbs -> `sickle`. The wrong tool may prevent `auto-gather` from triggering or make it ineffective.
- 64-bit IDs: do not use `jq`. If you need to extract `entityId` / `soilId` / `itemInstanceId` and similar fields from JSON, **do not** use `jq -r '.xxxId'` (precision trap; see SKILL.md §64-bit ID precision trap). String fields / small integer fields may use `jq`; large IDs must use `python3 -c 'import json,sys;...'` or `grep -oE`. In this workflow, `resourceCid` usually comes from the user / `query-item-sources` and does not use the ID extraction path, but be careful when switching spawn points or handling multi-entity scenarios.

## Exit semantics (return-value convention)

The sub-workflow returns one of the following semantic states so the upper layer (Get Item / L1) can decide what to do next:

| State | Meaning |
|---|---|
| `completed` | `targetCount` reached; normal exit |
| `stalled-no-target` | No spawn point found / no target after repeated attempts; suggest switching source or map |
| `stopped-low-energy` | Energy gate failed (insufficient food and energy-manage was not authorized) |
| `stopped-blocker` | Hard blocker such as low HP / missing tool / locked skill; user intervention required |

## Notes / common mistakes

- Wrong: skip `query-spawn-point` and navigate directly to a remembered coordinate from the previous run -> the resource may no longer be there, and `auto-gather` repeatedly wastes loops with "no target".
- Wrong: pass the **finished itemCid** (for example an itemCid for "refined iron ingot") as `resourceCid` to `query-spawn-point --cid` -> no result / unrelated spawn point. You must first run `query-item-sources` to get `sources[].sourceId` of type `gathering`, then pass it.
- Wrong: call `auto-gather` directly at energy = 0 without the energy gate -> the action succeeds but gives no drops, wasting time.
- Wrong: use axe for ore / pickaxe for trees -> the gathering action does not trigger or is ineffective.
- Wrong: use `jq -r '.data.entities[0].entityId'` to extract a 64-bit ID -> precision is lost, and later commands will definitely report "not found".
