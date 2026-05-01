# SW-5: fishing-loop — fishing loop

> Source of truth: this file. Number index: SW-5 (agents can locate it by number or name as dual keys).

## Trigger conditions

| Type | Example / value |
|---|---|
| User intent keywords | "fish X", "go fishing" |
| L1 subtask type | — |
| `query-item-sources.type` | `fishing` |

## Input parameters

| Parameter | Required | Description |
|---|---|---|
| `fishCid` | Yes | ConfigId of the target fish species |
| `targetCatchCount` | No | Target catch count (controls loop exit) |

## Trigger entries

### Entry A: called by an upper-level L1 workflow orchestration (atomic mode)

- Referenced by these L1 workflows:
  - `L1-get-item.md` (dispatches here when `source.type = fishing`)
  - `L1-7-fishing.md` (fishing earning loop)
  - `L1-5-crafting.md` (when filling fishing-material shortages)
- Parameter mapping (Get Item -> SW-5): `fishCid = source.sourceId`, `targetCatchCount = shortage × multiplier`

### Entry B: direct user request

- When the user asks for a one-off fishing action ("catch 20 bass for me / go fishing") and it is not bound to any task, the agent may **directly** enter the SW-5 execution steps without running an L1 first.
- Typical Entry B phrasing:
  - "fish X", "go fishing"
  - "fish for me for a while"

## Execution steps (numbered; do not skip)

```
1. lumiterra query-status
   <- Read hp (fishing does not consume energy)
   HP = 0 -> lumiterra revive --type <town|respawn>
2. lumiterra query-spawn-point --type fish --cid <fishCid>
   <- navPosition is the lower-layer computed "safe shore casting position" (on the ring outside the water, about 8m from the water edge; casting toward the water center keeps the lure within rod range). Use it directly as the navigate target.
   No response -> tell the user "this fish species has no spawn point on the current map", return stalled-no-target, stop or switch fish
3. lumiterra switch-weapon --weapon-type fishing-rod --target-fish-cid <fishCid>
   <- Must pass --target-fish-cid; the CLI automatically chooses a compatible fishing rod
   No compatible rod -> tell the user a purchase / crafting is required, return stopped-blocker, and stop
4. lumiterra navigate --x <navPosition.x> --y <navPosition.y> --z <navPosition.z>
   <- Use navPosition consistently with other workflows; the lower layer guarantees it is a safe shore casting position outside the water
5. Fishing loop:
   a. lumiterra fish --target <fishCid> [--timeout <30-300 seconds>]
      <- Single attempt is about 60s; server automatically chooses bait; timeout defaults to 90s; stop can interrupt within 2s
   b. Read failReason (see table below) and decide the next step
   c. Exit decision:
      - targetCatchCount reached      -> return completed and exit
      - no_bait                       -> tell the user bait must be purchased / crafted, return stopped-blocker, and stop
      - other stable failReason        -> handle according to the table or give up (stalled-no-target / stopped-blocker)
      Otherwise return to step 5a
6. lumiterra query-inventory --type all
   <- Inventory check (for independent trigger scenarios; when called by Get Item, the outer layer is responsible and this may be omitted)
```

## failReason routing table

| failReason | Meaning | Handling |
|---|---|---|
| `out_of_range` | Distance from the water edge is greater than the fishing rod's maximum cast distance (10m) | Rerun `query-spawn-point --type fish --cid` to get a new `navPosition`, then `navigate`, then return to step 5 |
| `no_fishing_area_for_cid` | No nearby water area contains this fish species | Rerun `query-spawn-point --cid` with broader search, or switch target fish |
| `rod_not_match` | Current fishing rod does not support the target fish | Return to step 3 and rerun `switch-weapon --target-fish-cid` |
| `no_bait` | No bait in inventory | Tell the user to purchase / craft bait, return stopped-blocker, and stop |
| `wait_bite_timeout` | No bite within 45s | Normal probability; retry directly |
| `fish_escaped` | QTE failed and the fish escaped | Normal retry |
| `cast_miss` | Cast landing point is invalid | Adjust standing position (usually `navigate` closer fixes it), then return to step 5 |
| `battle_timeout` | Total 30s QTE timeout | Extremely rare (network anomaly); retry later |

## Important notes (HARD RULES)

- Warning: **fishing does not consume energy; it consumes bait**. The server automatically chooses bait. No bait -> `no_bait`, return `stopped-blocker`. Do not reuse the combat / gathering energy-gate logic.
- Warning: **you must run `query-spawn-point --type fish --cid <fishCid>` before `navigate`, then run `fish`**. **Do not** guess coordinates from memory.
- Warning: **`switch-weapon --weapon-type fishing-rod` must include `--target-fish-cid <fishCid>`**. Different fish species require different fishing rods; the CLI automatically chooses a compatible rod. Omitting it can cause `rod_not_match`.
- Warning: **navigate uses `navPosition`**, consistent with SW-1/2/4 and other workflows. The lower layer guarantees the fishing navPosition is a "safe shore casting position" outside the water.
- In `fish --target <fishCid>`, `--target` is required. `--timeout` range is 30-300 seconds and defaults to 90s.
- QTE randomly produces Good / Bad (70/30, no Perfect), following the "automation should be worse than a human" principle.
- **When called by Get Item**: the outer workflow is responsible for total inventory verification; this sub-workflow exits by `targetCatchCount` and **does not query inventory again**.
- 64-bit IDs: do not use `jq`. In this workflow, `fishCid` usually comes from the user / `query-item-sources` and does not use the ID extraction path, but be careful in multi-entity scenarios (see SKILL.md §64-bit ID precision trap).

## Exit semantics (return-value convention)

The sub-workflow returns one of the following semantic states so the upper layer (Get Item / L1) can decide what to do next:

| State | Meaning |
|---|---|
| `completed` | `targetCatchCount` reached; normal exit |
| `stalled-no-target` | No spawn point found / no water area contains this fish species; suggest switching fish or map |
| `stopped-blocker` | Hard blocker such as no compatible fishing rod / no bait; user intervention required |

## Notes / common mistakes

- Wrong: call `fish` without switching to a fishing rod -> action trigger fails / `rod_not_match`.
- Wrong: switch to a fishing rod without passing `--target-fish-cid` -> the CLI cannot choose a compatible rod, and runtime reports `rod_not_match`.
- Wrong: use `center` instead of `navPosition` for navigate -> center is in the water area, and the player is routed into water and drowns.
- Wrong: start `fish` too far from the water -> repeated `out_of_range` / `cast_miss`, wasting loop attempts.
- Wrong: reuse combat energy-gate logic and "restore energy before fishing" -> fishing does not consume energy at all; check bait, not energy.
- Wrong: hard-loop retry `fish` with no bait -> only repeatedly returns `no_bait`; stop immediately and ask the user to replenish bait.
- Wrong: pass the **finished itemCid** (for example an itemCid for "grilled fish") as `fishCid` -> `query-spawn-point` finds nothing / unrelated spawn points. You must first run `query-item-sources` to get `sources[].sourceId` of type `fishing`, then pass it.
