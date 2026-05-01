# L1-7: Fishing earning loop (fishing)

> Source of truth: this file. When executing this workflow, agents **must** follow the order in the "Execution steps" section and may not merge or skip steps.
> Number index: L1-7.

This workflow is the unified entry for "repeatedly fish the same fish species for output" scenarios (**not task-driven**): the user wants to continuously catch a fish type to obtain a batch of fish (sell / crafting materials / quantity accumulation). This L1 handles **backpack snapshot + bait / rod prechecks + gap calculation**; the actual action chain is SW-5 `fishing-loop`.

**L1-7 ~= SW-5 `fishing-loop` scheduling wrapper**: the single fishing action chain fully reuses SW-5. This L1 only prepares materials / rod / bait before starting and performs delta verification after running.

## Trigger conditions

- Trigger phrases:
  - "fishing for money" / "fish farming loop" / "farm X fish" / "keep fishing X"
  - "grind fishing X" / "farm fish X"
- User intent traits:
  - Goal is to **repeatedly catch one fish species** (`targetFishCid`) for multiple rounds
  - **Not task-driven** (not a `Fishing` subitem of daily-quest / token-task / normal-quest)
- Boundary with nearby entries:
  - User only asks to **catch N fish once**, not bound to task and no pre-material check needed -> **directly** use SW-5 (see SW-5 Entry B), not this L1
  - User goal is **to obtain an item** (fish-cooking material, fish-derived material) and did not specify which fish -> use L1-get-item, which dispatches by `query-item-sources`; when hitting `source.type = fishing`, it eventually calls SW-5
  - Task-driven fishing subitems (currently none; `Fishing` is not yet a quest subtype) -> reserved for the corresponding L1 (future L1-1 / L1-4 if added, through task dispatch)

## State maintained during execution (explicit variables; do not estimate verbally)

- `targetFishCid` -- fishCid of target fish species (must be fish species cid, **not** finished itemCid such as grilled fish / fish meat)
- `requiredCount` -- catch quantity requested by user (N fish)
- `beforeCount` -- current inventory from `query-inventory --item-cid <targetFishCid>` before work starts
- `afterCount` -- inventory read again after each SW-5 return
- `remainingCount = requiredCount - (afterCount - beforeCount)`
- `targetCatchCount` -- target catch count passed to SW-5 (`= remainingCount × multiplier (recommended ×1.2 ~ ×1.5)`, because QTE Bad still counts into backpack and needs less redundancy than combat)
- `baitCount` -- total bait-type itemCid count in `query-inventory` before starting (any usable bait; server auto-selects bait)

## Success criteria

- **Must compare beforeCount / afterCount**: success only if `afterCount - beforeCount >= requiredCount`
- Only seeing SW-5 return `completed` **does not count as success**; SW-5 internal targetCatchCount reached also does not prove target fish obtained
- If `afterCount - beforeCount == 0`:
  - Check whether SW-5 stopped mid-way due to `no_bait` / no rod (`stopped-blocker`)
  - Check whether target fishCid was wrong (for example finished itemCid passed as fishCid -> `query-spawn-point` no response)

## Preconditions / Blockers

**Self-check before starting** (report blocker early when unmet):

- Character alive & HP safety line: `query-status`; HP = 0 -> first `revive`; fishing itself does not consume energy, but HP 0 cannot trigger `fish`
- **Enough bait (hard rule of this L1)**: `query-inventory` must find any compatible bait; if bait is insufficient -> first use L1-get-item to replenish bait (source may be purchase / craft / gather); if cannot replenish -> report blocker. **Do not** start SW-5 at bait = 0 (it immediately returns `no_bait`)
- **Compatible fishing rod**: `targetFishCid` must have at least one usable rod (`DRFish(target).SupportRod`), and rod `UseLv <= character level`; `switch-weapon --weapon-type fishing-rod --target-fish-cid <targetFishCid>` must produce a result. If not -> report blocker and tell user to purchase / craft the corresponding rod
- Target fish resolution ambiguity: user only gives fish name, `query-item-sources --item-cid <finished product>` returns multiple `fishing` sources (multiple species can craft same product) and cannot uniquely lock target -> **report blocker; do not choose randomly**
- Current map has spawn point: `query-spawn-point --type fish --cid <targetFishCid>` must return a result; if none -> report blocker and suggest switching map / fish

## Execution steps (numbered; do not skip)

```
1. lumiterra query-status
   -> Confirm character alive; HP = 0 -> revive before continuing
   -> Fishing does not consume energy and does not need energy gate; energy = 0 can still fish

2. Inventory snapshot (target fish + bait status)
   a. lumiterra query-inventory --item-cid <targetFishCid>
      -> Record beforeCount (if not in backpack, beforeCount = 0)
      -> If beforeCount >= requiredCount -> completed directly; do not start fishing loop
   b. lumiterra query-inventory --type all
      -> Scan bait-type itemCids and record baitCount
      -> baitCount = 0 -> report blocker (or route to L1-get-item to replenish bait, then return to step 2)

3. Resolve target fish
   a. User **explicitly specified** fish species (fishCid / fish name)
      -> Lock targetFishCid directly
      -> Optional: lumiterra query-item-sources --item-cid <product / finished itemCid>
        Verify a source.type = fishing entry contains this fish; if not found, report blocker (fish remembered incorrectly)
   b. User **only gave finished product**, no fish specified
      lumiterra query-item-sources --item-cid <finished itemCid>
      -> Filter source.type = fishing entries
      -> Unique -> targetFishCid = source.sourceId
      -> Multiple fishing sources -> filter by "current map + level-matching rod"; if still not unique -> report blocker
      -> sources empty / no fishing -> this L1 does not apply; hand off to L1-get-item for other source.type dispatch

4. Precheck rod
   lumiterra switch-weapon --weapon-type fishing-rod --target-fish-cid <targetFishCid>
   -> Success -> record compatible rod equipped
   -> Failure (no compatible rod / level too low) -> report blocker and suggest purchase / craft; do not enter SW-5

5. Compute targetCatchCount
   gap = requiredCount - beforeCount           (= requiredCount if beforeCount = 0)
   targetCatchCount = gap × multiplier         (recommended ×1.2 ~ ×1.5; QTE Bad still counts into backpack, so large multiplier is not needed)
   -> Note: unlike combat, fishing almost never loses drops (QTE Bad affects quantity / quality, not zero), so small multiplier is enough

6. Dispatch to SW-5 fishing-loop
   Call SW-5 (see references/base-workflows/SW-5-fishing-loop.md), parameters:
     fishCid          = targetFishCid
     targetCatchCount = value computed in step 5
   -> query-spawn-point / navigate / switch-weapon / fish loop / failReason routing
      are handled inside SW-5; this L1 does not duplicate them
   -> SW-5 returns completed -> enter step 7
   -> SW-5 returns stopped-blocker (no_bait / no compatible rod) -> report unchanged and stop for user intervention
   -> SW-5 returns stalled-no-target (this fish has no spawn point) -> report unchanged, suggest switching fish / map

7. Progress check (target fish delta verification)
   lumiterra query-inventory --item-cid <targetFishCid>
   -> afterCount = current quantity
   -> remainingCount = requiredCount - (afterCount - beforeCount)
   -> remainingCount <= 0 -> completed and exit
   -> remainingCount >  0 -> periodic recheck:
      - bait still enough -> return to step 5, recompute targetCatchCount, then enter step 6
      - bait exhausted -> report stopped-blocker (or route to L1-get-item to replenish bait, then return to step 2)
      - multiple rounds delta = 0 (SW-5 says completed but backpack unchanged) -> verify targetFishCid is not wrong
        (for example finished itemCid passed as fishCid); if still unexplained -> report blocker

8. Stop condition
   Only afterCount - beforeCount >= requiredCount counts as completed
   If gap remains and cannot progress -> return partial / blocker to upper layer
```

## Called base workflows / common workflows

- `SW-5-fishing-loop.md` -- actual fishing action chain (only downstream)
- Indirect dependencies:
  - `query-item-sources` -- validate / resolve `fishing` source
  - `query-status` / `query-inventory` -- precheck + progress verification
  - `query-spawn-point --type fish` -- called inside SW-5 (this L1 does not call directly except blocker precheck)
  - `switch-weapon --weapon-type fishing-rod --target-fish-cid` -- step 4 rod precheck (SW-5 also calls again internally)
  - `use-item` (bait) / L1-get-item -- precondition fix for missing bait / rod materials
- This L1 **does not separately** maintain `failReason` routing / `navigate` casting distance / `fish` loop control; these rules are embedded in SW-5

## Important notes (HARD RULES)

- Warning: **fishing does not consume energy; it consumes bait**. Do not reuse combat/gather energy gate. Long loop must check `baitCount > 0` before starting. If bait is insufficient, replenish first, then enter SW-5; **do not** hard-start the loop and receive `no_bait`.
- Warning: **rod level / compatibility precheck**: step 4 must run `switch-weapon --weapon-type fishing-rod --target-fish-cid <fishCid>` first; if it fails, report blocker directly and do not enter SW-5 only to roll back after `rod_not_match` (wastes navigate / fish overhead).
- Warning: **HP safety line**: HP = 0 cannot trigger `fish`; run `query-status` before starting and `revive` if HP = 0.
- Warning: **success is judged only by backpack delta**: require `afterCount - beforeCount >= requiredCount`; relying on SW-5 `completed` / `targetCatchCount reached` is wrong.
- Warning: **`targetCatchCount = gap × multiplier` should be small (×1.2 ~ ×1.5)**: QTE Bad still counts into backpack, and drop loss is minimal; combat-style ×2 ~ ×5 wastes bait.
- Warning: **do not randomly choose on resolution ambiguity**: when `query-item-sources` returns multiple `fishing` sources and no unique target, report blocker; catching the wrong fish wastes time.
- Warning: **do not pass finished itemCid as fishCid**: `targetFishCid` must be fish species cid (from `query-item-sources.sources[].sourceId`, type=fishing). Passing grilled fish / fish meat itemCid to SW-5 makes `query-spawn-point` return nothing.
- Warning: **do not `navigate` directly at L1 layer**: let SW-5 handle it (SW-5 uses navPosition to move to the lower-layer computed "safe shore casting position", consistent with SW-1/2/4 and other workflows).
- Task-driven `Fishing` (if added to daily / token / normal quests later) **does not use this L1**; it uses corresponding L1-1 / L1-4 / L1-17, which also call SW-5 but with task progress semantics.

## Notes / common mistakes

- Skip `query-inventory` and start loop directly -- no beforeCount, so result cannot be judged; or beforeCount already satisfied requirement and the loop was unnecessary.
- Start SW-5 at bait = 0 -- first `fish` returns `no_bait` and `stopped-blocker`, wasting query-spawn-point / navigate / switch-weapon overhead; this L1 must precheck in step 2.
- Skip step 4 rod precheck and enter SW-5 directly -- SW-5 internal `switch-weapon` fails with `stopped-blocker`, but query-spawn-point / navigate already ran.
- Pass **finished itemCid** (for example "grilled fish" itemCid) as `targetFishCid` to SW-5 -> `query-spawn-point --type fish --cid <grilledFishCid>` returns nothing. Must first run `query-item-sources` to get `sources[].sourceId` (type=fishing).
- Use combat multiplier ×2 ~ ×5 -- fishing QTE Bad still outputs, so high multiplier wastes bait; recommend ×1.2 ~ ×1.5.
- User says "catch bass to make bait", agent skips `query-item-sources` and locks fish species from memory -- in-game fish/product mapping can change; verbal lists expire.
- User says "catch 20 bass" (one-off, not task-bound) -- should **directly** call SW-5 Entry B, not this L1 (beforeCount / afterCount comparison is less useful unless user explicitly wants a farming loop).
- Stop after one SW-5 `completed` -- SW-5 exits by `targetCatchCount` and does not compare beforeCount / afterCount; this L1 must inspect backpack in step 7 and continue if not enough.
- Reuse combat energy gate ("restore energy before fishing") -- fishing does not consume energy at all; check `baitCount`, not `energy`.
