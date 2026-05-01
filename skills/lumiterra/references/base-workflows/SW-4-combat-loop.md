# SW-4: combat-loop — monster combat loop

> Source of truth: this file. Number index: SW-4 (agents can locate it by number or name as dual keys).

## Trigger conditions

| Type | Example / value |
|---|---|
| User intent keywords | "fight X", "farm X monsters", "clear X monsters", "kill X" |
| L1 subtask type | `KillMonster` |
| `query-item-sources.type` | `monster_drop` |

## Input parameters

| Parameter | Required | Description |
|---|---|---|
| `monsterCid` | Yes | ConfigId of the target monster (warning: this is the **entity cid**, not the finished itemCid) |
| `targetKillCount` | No | Target kill count (controls loop exit); for material-farming goals, the outer layer may instead decide by `targetItemCid + targetItemCount` |

## Trigger entries

### Entry A: called by an upper-level L1 workflow orchestration (atomic mode)

- Referenced by these L1 workflows:
  - `L1-get-item.md` (dispatches here when `source.type = monster_drop`)
  - `L1-1-to-3-daily-quests.md` (combat daily + bounty, `KillMonster` subtask)
  - `L1-4-token-tasks.md` (when token-pool combat tasks involve `KillMonster`)
  - `L1-6-combat-farming.md` (kill monsters to farm materials)
  - L1-11 (escort / guard combat), L1-12 (pet battle training), L1-17/18 (`KillMonster` subtask)
- Parameter mapping (Get Item -> SW-4): `monsterCid = source.sourceId`, `targetKillCount = shortage × multiplier (recommended ×2)`

### Entry B: direct user request

- When the user asks for a one-off monster-combat action ("kill 20 slimes for me / farm wolves") and it is not bound to any task, the agent may **directly** enter the SW-4 execution steps without running an L1 first.
- Typical Entry B phrasing:
  - "fight X", "farm X monsters", "clear X monsters", "kill X"
  - "farm X for me for a while (combat type)"

## Execution steps (numbered; do not skip)

```
1. lumiterra query-status
   <- Read hp and energy
   HP / MaxHP < 40% -> immediately follow the HP safety line (escape-combat -> move away / back-to-town), do not enter combat
   energy = 0      -> energy gate: material-farming goals must have energy > 0 (otherwise no drops / no exp / no materials)
                    query-inventory --type food -> use-item to recover;
                    energy-manage --action buy|borrow is allowed only after food is insufficient and the user authorizes it
                    (buy/borrow does not restore energy directly; it only produces energy potion items, which must then be consumed with use-item)
                    If recovery is still impossible -> return stopped-low-energy and stop
2. lumiterra switch-weapon --weapon-type <weapon for the battle class>
   <- Must wear a full set of battle-class gear at the matching level + the correct weapon; mixed gear / low-level gear can get the character one-shot by monsters
3. lumiterra query-spawn-point --type monster --cid <monsterCid>
   <- HARD RULE: do not skip this step and navigate directly; do not guess coordinates from memory
   No response / no navPosition -> tell the user "this monster has no spawn point on the current map", return stalled-no-target, and stop
4. lumiterra navigate --x <navPosition.x> --y <navPosition.y> --z <navPosition.z>
5. Combat loop:
   a. lumiterra auto-combat --target <monsterCid> [--count 1-5] [--timeout seconds] [--ignore-energy]
      <- Default --count 1 (returns quickly in 10-30s, making HP / energy control easier);
         stable areas may use --count 2-5, timeout = count × 60s, maximum 5;
         at energy = 0 the command refuses by default, while --ignore-energy can force execution (only for non-material-farming scenarios)
   b. lumiterra query-status                 <- Check HP / energy every round
      HP < 40%   -> [HP safety line] lumiterra escape-combat [--timeout 20] -> move away -> naturally recover HP -> return to step 5
      HP = 0     -> lumiterra revive --type <town|respawn>
                   (default town: no penalty, but must run back to the spawn point;
                     respawn: revive in place, with cooldown + talent-exp cost)
      energy = 0 -> energy gate (return to the energy branch in step 1); if insufficient, stop the loop
   c. Exit decision:
      - targetKillCount reached                        -> return completed and exit
      - targetItemCount reached (outer-layer decision, material-farming scenario) -> return completed and exit
      - auto-combat repeatedly returns "no target"      -> switch spawn point (rerun step 3); if still none -> stalled-no-target
      Otherwise return to step 5a
6. lumiterra query-inventory --type all
   <- Inventory dropped items (for independent trigger scenarios; when called by Get Item, the outer layer is responsible and this may be omitted)
```

## Important notes (HARD RULES)

> **HP < 40% HP safety line** (HARD RULE): after every `query-status`, if `hp/maxHp < 40%`, the agent must **immediately** run `lumiterra escape-combat [--timeout 20]` to disengage, **move away -> naturally recover HP**, and stop fighting. **Do not** use HP potions by default unless the user explicitly authorizes it. Long loops must reread HP before every round.

- Warning: **you must run `query-spawn-point --type monster --cid <monsterCid>` before `navigate`, then run `auto-combat`**. **Do not** guess coordinates from memory. **Do not** skip `query-spawn-point` and navigate directly.
- Warning: **`--cid` must be the entity cid (monsterCid), not the target drop item's itemCid**. If you only have the finished itemCid, first run `lumiterra query-item-sources --item-cid <itemCid>` to get `sources[].sourceId` of type `monster_drop`, then pass it.
- Warning: **target equipment must be complete (HARD RULE)**: full battle-class gear at the matching level + correct weapon is required. Mixed gear / low-level gear / wrong-class gear -> instant death in combat. If pieces are missing, complete the set first or downgrade the target monster; do not force it.
- **At energy = 0, the character can still attack but receives no drops / no exp / no materials**. Material-farming / leveling goals must ensure energy > 0; long loops should check energy on every `query-status`.
- Short `auto-combat --count` batches (1) make real-time HP / energy control easier. Stable areas may go up to 5; 5 is the upper bound (CLI hard limit).
- Death recovery:
  - `revive --type town` (default, safe with no penalty, but must run back to the spawn point)
  - `revive --type respawn` (revive in place, with cooldown + talent-exp cost)
- `escape-combat [--timeout 5-60]` actively disengages at low HP; it keeps moving toward the reachable direction with the lowest threat until combat state ends.
- HP safety line (HARD RULE): after every `query-status`, if `hp/maxHp < 40%`, the agent must immediately disengage and naturally recover HP. **Do not** use HP potions by default.
- **When called by Get Item**: the outer workflow is responsible for total inventory verification; this sub-workflow exits by `targetKillCount` and **does not query inventory again**.
- 64-bit IDs: do not use `jq`. If you need to extract `entityId` / `itemInstanceId` and similar fields from JSON, **do not** use `jq -r '.xxxId'` (precision trap; see SKILL.md §64-bit ID precision trap). In this workflow, `monsterCid` usually comes from the user / `query-item-sources` and does not use the ID extraction path, but be careful in multi-entity scenarios.

## Exit semantics (return-value convention)

The sub-workflow returns one of the following semantic states so the upper layer (Get Item / L1) can decide what to do next:

| State | Meaning |
|---|---|
| `completed` | `targetKillCount` (or outer-layer `targetItemCount`) reached; normal exit |
| `stalled-no-target` | No spawn point found / `auto-combat` repeatedly returned "no target"; suggest switching source or map |
| `stopped-low-energy` | Energy gate failed (insufficient food and energy-manage was not authorized) |
| `stopped-blocker` | Hard blocker such as low HP / incomplete gear / missing weapon / level too low; user intervention required |

## Notes / common mistakes

- Wrong: keep fighting at low HP (without `escape-combat`) -> death, talent-exp loss, and wasted travel time.
- Wrong: do not periodically run `query-status` during a long `auto-combat` loop -> after energy is depleted, the agent keeps idling with no drops / no exp.
- Wrong: skip `query-spawn-point` and navigate directly to remembered coordinates from the previous run -> the monster pack may no longer be there, and `auto-combat` repeatedly wastes loops with "no target".
- Wrong: pass the **finished itemCid** (for example a drop itemCid) as `monsterCid` to `query-spawn-point --cid` -> no result / unrelated spawn point. You must first run `query-item-sources` to get `sources[].sourceId` of type `monster_drop`, then pass it.
- Wrong: force high-level monsters with mixed gear / low-level gear / non-battle-class gear -> instant death.
- Wrong: use `auto-combat --count 5` without checking HP -> HP may bottom out halfway through the five kills and trigger death.
- Wrong: use `--ignore-energy` to force material farming at energy = 0 -> the action succeeds but gives no drops, wasting time.
- Wrong: after death, default to `revive --type respawn` to farm exp -> prefer `--type town` unless the user authorizes respawn cooldown / talent-exp cost.
