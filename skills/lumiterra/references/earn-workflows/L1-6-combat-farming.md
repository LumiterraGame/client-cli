# L1-6: Combat material farming (combat-farming)

> Source of truth: this file. When executing this workflow, agents **must** follow the order in the "Execution steps" section and may not merge or skip steps.
> Number index: L1-6.

This workflow is the unified entry for scattered monster farming / material farming scenarios (**not task-driven**): the user wants to repeatedly kill a monster type to obtain some materials (monster drops, pet egg fragments, combat consumables, etc.).
This L1 handles **backpack snapshot + gap calculation + source confirmation**; the actual action chain is SW-4 `combat-loop`.

## Trigger conditions

- Trigger phrases:
  - "farm monsters for materials" / "farm Y dropped by X" / "fight X monsters for drops" / "kill X for Y"
  - "farm monster" / "farm X for Y" / "go farm several packs of X"
- User intent traits:
  - Goal is to **obtain a material** (`targetMaterialCid`) by **repeatedly killing a monster type**
  - **Not task-driven** (not a `KillMonster` subitem of daily-quest / token-task / normal-quest)
- Boundary with nearby entries:
  - Goal is **killing a monster type itself** (leveling, kill count, not bound to material) -> call SW-4 directly, not this L1
  - Goal is **obtaining an item** but user did not specify monster; source routing is needed -> use L1-get-item,
    which dispatches by `query-item-sources` (may land on SW-4, SW-1, SW-2, craft, etc.)
  - Task-driven `KillMonster` subitem -> use L1-1 / L1-4 / L1-17 dispatch tables, eventually also calling SW-4

## State maintained during execution (explicit variables; do not estimate verbally)

- `targetMaterialCid` -- itemCid of the target material
- `targetMonsterCid` -- monster cid specified by user / resolved from `query-item-sources`
- `requiredCount` -- material quantity requested by user
- `beforeCount` -- current inventory read by `query-inventory --item-cid <targetMaterialCid>` before work starts
- `afterCount` -- inventory read again after each combat round
- `remainingCount = requiredCount - (afterCount - beforeCount)`
- `targetKillCount` -- kill count passed to SW-4 (`= remainingCount × multiplier (recommended ×2)`,
  due to drop probability / fragmentation redundancy)

## Success criteria

- **Must compare beforeCount / afterCount**: success only if `afterCount - beforeCount >= requiredCount`
- Only seeing SW-4 return `success=true` **does not count as success**; kill count reaching targetKillCount also does not prove material obtained
- If `afterCount - beforeCount == 0`, check:
  - Whether energy is 0 (command success but no drops)
  - Whether `monster_drop` source from `query-item-sources` matches (does the monster really drop this material)
  - Whether the material has very low drop rate / fragmented drops (multiplier too small)

## Preconditions / Blockers

**Self-check before starting** (report blocker early when unmet):

- Character alive & HP safety line: `query-status`; `hp/maxHp < 40%` -> first follow HP safety line (`escape-combat` -> move away / `back-to-town`), do not enter combat loop
- **Energy gate (hard rule of this L1)**: at `energy = 0`, monster drops / exp are zero (command still success). **Before long loop, ensure `energy > 0`**; prefer backpack energy potion (`use-item`), then `energy-manage --action buy|borrow` only with user authorization (buy/borrow only produces energy potion items, then `use-item` is still required)
- Weapon: must have battle weapon equipped; if missing -> `switch-weapon --weapon-type <sword|bow|...>`; if no suitable weapon in backpack -> return to L1-get-item first
- Target monster resolution ambiguity: user only gives name / only gives material name, `query-item-sources` returns multiple `monster_drop` sources and cannot distinguish -> **report blocker; do not choose randomly**
- `query-item-sources` sources contain **no** `monster_drop` -> this L1 does not apply; hand off to L1-get-item to dispatch to correct SW

## Execution steps (numbered; do not skip)

```
1. lumiterra query-status
   -> Confirm character alive & HP safety line; if HP < 40%, follow survival workflow first and return
   -> Record current energy; energy = 0 and cannot recover (insufficient potion + user disallows buy/borrow) -> report blocker

2. Inventory snapshot (current target material quantity)
   lumiterra query-inventory --item-cid <targetMaterialCid>
   -> Record beforeCount (if not in backpack, beforeCount = 0)
   -> If beforeCount >= requiredCount -> completed directly; do not start combat loop

3. Resolve target monster
   a. User **explicitly specified** monster (name / cid)
      -> Lock targetMonsterCid directly
      -> Optional: lumiterra query-item-sources --item-cid <targetMaterialCid>
        Verify "this monster really drops this material"; if no matching monster_drop entry for that monsterCid exists in sources -> report blocker (user remembered monster incorrectly)
   b. User **only gave material**, no monster
      lumiterra query-item-sources --item-cid <targetMaterialCid>
      -> Filter source.type = monster_drop entries
      -> Unique -> targetMonsterCid = source.sourceId
      -> Multiple monster_drop sources -> choose by "shortest dependency chain + level match" (prefer monsters current level can fight);
         if still not unique -> report blocker; do not choose randomly
      -> sources empty / no monster_drop -> this L1 does not apply; hand off to L1-get-item for other source.type dispatch

4. Compute targetKillCount
   gap = requiredCount - beforeCount          (= requiredCount if beforeCount = 0)
   targetKillCount = gap × multiplier         (recommended ×2; very low drop-rate materials may use ×3~×5)
   -> Keep redundancy; treating gap 1:1 as kill count will often fail under drop probability

5. Dispatch to SW-4 combat-loop
   Call SW-4 (see references/base-workflows/SW-4-combat-loop.md), parameters:
     monsterCid      = targetMonsterCid
     targetKillCount = value computed in step 4
   -> HP safety line, energy gate, escape-combat / revive decisions are handled inside SW-4; this L1 does not duplicate them
   -> After SW-4 returns, enter step 6
   -> If SW-4 returns partial / blocker (empty monster spawn, repeated deaths, cannot recover), report it unchanged

6. Progress check (material delta verification)
   lumiterra query-inventory --item-cid <targetMaterialCid>
   -> afterCount = current quantity
   -> remainingCount = requiredCount - (afterCount - beforeCount)
   -> remainingCount <= 0 -> completed and exit
   -> remainingCount >  0 -> continue loop:
      - If drops stalled due to energy depletion -> restore energy first (use-item / energy-manage; buy/borrow only produces item and must then be consumed with use-item), then return to step 4 and recompute
         targetKillCount (note: beforeCount unchanged; recompute gap by remaining portion of requiredCount - beforeCount)
      - If energy is normal but drop rate is low -> increase multiplier (×3~×5), return to step 5
      - If suspect monster does not drop this material (afterCount unchanged over multiple rounds) -> return to step 3 and re-run
         query-item-sources validation; if still mismatched -> report blocker

7. Stop condition
   Only afterCount - beforeCount >= requiredCount counts as completed
   If gap remains and cannot progress -> return partial / blocker to upper layer
```

## Called base workflows / common workflows

- `SW-4-combat-loop.md` -- actual combat action chain (only downstream)
- Indirect dependencies:
  - `query-item-sources` -- validate / resolve `monster_drop` source
  - `query-status` / `query-inventory` -- precheck + progress verification
  - `switch-weapon` / `use-item` / `energy-manage` -- energy / weapon precondition fixes
- This L1 **does not separately** maintain HP safety line / automatic energy recovery / `escape-combat` / `revive` decision table; these rules are embedded in SW-4

## Important notes (HARD RULES)

- Warning: **energy 0 can continue combat but gives no drops / no exp**: long loop must ensure `energy > 0`; when energy is low, prefer `use-item <energyPotionItemInstanceId>`, then `energy-manage --action buy|borrow` only with user authorization (buy/borrow only produces potion item and still requires `use-item`). **Do not** farm at energy 0 (command success but backpack does not change).
- Warning: **HP < 40% safety line**: check `query-status` before starting and after SW-4 returns; dangerous HP forbids starting the next combat loop.
- Warning: **success is judged only by backpack delta**: require `afterCount - beforeCount >= requiredCount`; relying only on SW-4 `success=true` / `targetKillCount reached` is wrong.
- Warning: **keep redundancy in `targetKillCount = gap × multiplier`** (recommended ×2; low drop-rate ×3~×5). Treating gap 1:1 as kill count fails under drop variance.
- Warning: **do not randomly choose on resolution ambiguity**: when `query-item-sources` returns multiple `monster_drop` sources and no unique target, report blocker; wrong monster makes all output useless.
- Warning: **no `monster_drop` from `query-item-sources`**: target material is not a combat drop. **Do not** force it into SW-4; hand off to L1-get-item for correct dispatch.
- Task-driven `KillMonster` (daily / bounty / token / normal) **does not use this L1**; it uses corresponding L1-1 / L1-4 / L1-17, which also call SW-4 but with task progress semantics.
- Death -> handled by SW-4 internal `revive` decision; after SW-4 returns, still prefer returning to step 1 and fresh `query-status` before the next round (HP / position / backpack may have changed).

## Notes / common mistakes

- Skip `query-inventory` and start loop directly -- no beforeCount, so result cannot be judged; or beforeCount already satisfied requirement and the loop was unnecessary.
- Farm at energy 0 -- all commands succeed and kill count rises, but backpack material delta is 0, wasting lots of time.
- Treat `gap` 1:1 as `targetKillCount` -- a 50% drop-rate material will be short by half and require another run; start with `×2`.
- User says "farm jelly dropped by slime", agent skips `query-item-sources` and locks monster from memory -- drop tables may change; verbal lists expire.
- Target is "get 50 iron ore" (`gathering`) but sent into this L1 -- source is `gathering`, not `monster_drop`; use L1-get-item.
- Target is "kill 20 slimes" (pure kills, no material goal) -- call SW-4 **directly**; this L1's beforeCount / afterCount comparison is meaningless there.
- Multiple `monster_drop` sources (for example novice monster vs high-level monster drops same material) and agent chooses randomly -- may be too hard or inefficient; choose by level match + shortest chain, otherwise report blocker.
- Stop after one SW-4 return -- SW-4 exits by `targetKillCount` and does not compare beforeCount / afterCount; this L1 must inspect backpack in step 6 and continue if not enough.
