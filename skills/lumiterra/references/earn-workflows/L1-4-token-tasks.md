# L1-4: Token-pool tasks (token-tasks)

> Source of truth: this file. Number index: L1-4.

## Trigger conditions

- Trigger phrases: "token-pool task" / "do token task" / "farm token pool" / "do token tasks" / "complete N token tasks"
- When the user specifies a count (for example "30 times"), only successful `token-task-claim` returns count. accept / refresh / failed attempts / being killed do not count.

## Preconditions / Blockers

- Character alive and HP safe: `query-status` first; if unsafe, follow [survival workflow](../base-workflows/SW-survival.md) and then return
- Talent direction:
  - User specifies battle/combat -> `--talent battle`
  - User specifies gather/gathering -> `--talent gather`
  - User specifies farming/farm -> `--talent farming`
  - Unspecified -> query all three directions with `token-task-list` and choose by reward priority
- When an accepted task is `inprogress`, do not proactively refresh; prioritize completing the current task
- Constrained by daily TokenBox cap; stop when quota is exhausted

## Reward priority (used when selecting tasks)

1. Prefer tasks whose `rewards[]` contains direct token rewards or known token reward items
2. When multiple token-reward tasks exist, choose the one with the fewest remaining subtasks
3. When no token-reward task exists and there is no `inprogress` task, proactively run `token-task-refresh [--talent <type>]`, then list again
4. When an `inprogress` task exists, refresh is forbidden; only use `token-task-abandon --task-id <id>` if the user explicitly asks to abandon or the current task conflicts with declared priority and abandon cooldown has passed
5. When there are no `state=unaccept` tasks, if `inprogress` is empty, refresh once; if refresh fails/unavailable or still no acceptable task, wait for auto-refresh and list again
6. Token pool auto-refreshes about every 15 minutes; prefer `autoRefreshCdMs` returned by `token-task-list` as wait duration; if field is missing, wait 15 minutes
7. If still no token-reward task: when user asked to count by "completion quantity", choose the best non-token task; otherwise report no available token task

## Execution steps (numbered; do not skip)

1. `lumiterra query-status`
   - Confirm character is alive; if HP is unsafe, follow survival workflow first
2. `lumiterra token-task-list [--talent <type>]`
   - Has `inprogress` task -> resume it directly and jump to step 4
   - Otherwise choose a task from `state=unaccept` by reward priority above
   - No acceptable task and refresh allowed -> run `lumiterra token-task-refresh [--talent <type>]`, then list again
   - Still no acceptable task -> wait by `autoRefreshCdMs` (or 15 minutes), then list; busy polling is forbidden
3. `lumiterra token-task-accept --task-id <taskId>`
   - Accept the selected `state=unaccept` task
4. **[RESUME POINT]** `lumiterra token-task-list [--talent <type>]`
   - Read the `inprogress` task's `subItems[]`
   - Dispatch to base workflow by `subItem.type` (see table below), executing through `Shared TaskOption Atom Dispatch`
   - After each atom or short batch ends, run `token-task-list` again and continue from remaining unfinished `subItems`
5. `lumiterra token-task-claim --task-id <taskId>`
   - Claim only after all `subItem` entries are complete
   - **Immediately after successful claim**, run `lumiterra close-token-task-reward-ui` (Unity opens the full-screen `FormTokenTaskReward` reward UI; if not closed, it blocks subsequent automation)
   - Increment `completed += 1` only when claim returns success
6. Loop back to step 1 or 2 until the user-requested count is reached
   - Run `query-status` every few completions
   - Character dead -> `revive` -> resume from step 4

## subItem.type -> base workflow dispatch table

| subItem.type | Base workflow |
|---|---|
| `KillMonster` | [SW-4 combat-loop](../base-workflows/SW-4-combat-loop.md) |
| `GatherResource` | [SW-1 gather-entity](../base-workflows/SW-1-gather-entity.md) |
| `Watering` / `HarvestHomeItem` | [SW-2 crop-farming](../base-workflows/SW-2-crop-farming.md) |
| `PetAppease` | [SW-3 animal-petting](../base-workflows/SW-3-animal-petting.md) |
| `CatchFish` | [SW-5 fishing-loop](../base-workflows/SW-5-fishing-loop.md) |
| `HandInItem` | [L1-get-item](./L1-get-item.md) |

## Called base workflows

- SW-1-gather-entity / SW-2-crop-farming / SW-3-animal-petting / SW-4-combat-loop / SW-5-fishing-loop (dispatched by `subItem.type`)
- L1-get-item (material shortage or HandInItem subtask)

## Important notes (HARD RULES)

- **Energy gate / HP safety line**: evaluate every time returning to step 1 / 4; farming subtasks that hoe soil with insufficient energy are directly blocked by server
- **close-token-task-reward-ui must be closed manually**: after successful `token-task-claim`, Unity opens the full-screen `FormTokenTaskReward`; if not closed, later automation commands such as `token-task-list` all get stuck
- **Talent isolation**: when explicitly doing only one specialization, `token-task-refresh` must pass the same `--talent`, avoiding refresh of other specialization pools
- **Refresh forbidden condition**: when there is an `inprogress` task, proactive refresh is forbidden
- **No busy polling during auto-refresh wait**: wait once by `autoRefreshCdMs` (or 15 minutes), then list again
- **Counting semantics**: when the user specifies a count, only successful `token-task-claim` counts; accept, refresh, failure, and being killed do not count
- **`query-tokenbox` usage boundary**: it is not part of token-task selection / progress; unless the user explicitly asks to query TokenBox quota-pool information, this workflow does not call it
- **Abandon limitation**: `token-task-abandon` must satisfy in-game abandon cooldown; use it only when the user explicitly asks or the current task conflicts with declared priority

## Notes / common mistakes

- Infinite refresh loop: repeatedly refreshing when no token-reward task exists -> must wait by `autoRefreshCdMs`.
- Missing reward UI close: skip `close-token-task-reward-ui` after claim -> later `token-task-list` and other commands all hang.
- Wrong counting: count accept / refresh / failed attempts as "completed times" -> when user specifies a count, only successful claim counts.
- Cross-specialization pollution: when doing only battle, refresh without `--talent` -> gather/farming pools are also refreshed.
- Mistakenly abandoning inprogress: directly abandon to choose a better task -> only abandon when cooldown passed and user agreed or priority conflict is explicit.
- Misusing `query-tokenbox`: insert it into the main loop -> it is not required for token-task flow unless the user explicitly asks to query quota.
