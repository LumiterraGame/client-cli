# L1-17-18: Main + Side Quests (normal quests)

> Source of truth: this file. Number index: L1-17 / L1-18 (merged).

## Trigger Conditions

- Trigger phrases: "main quest" / "side quest" / "do main quest" / "do side quest" / "push main quest" / "clear side quests" / "run main story" / "complete N main quests" / "complete N side quests"
- Main and side quests share the same `quest-normal-*` + `quest-dialog` command set and are filtered only by `--type main|side`; when the user specifies a count, only tasks with successful `quest-dialog action=completed` or `quest-normal-claim` count, not accept / failed attempts / deaths

## Preconditions / Blockers

- Character alive, HP / energy safe: run `query-status` first; if unsafe, use [survival workflow](../base-workflows/SW-survival.md), then return
- Insufficient energy -> restore with `use-item`, then continue; if no recovery item exists, stop and report
- Resume entry: when the Agent starts, first run `quest-normal-list` to check for `status=active`; if present, jump directly to Step 5 and continue from current progress without accepting again
- When sub-task type is `DungeonChapterPass`, the CLI currently has no dungeon-clear atom -> stop and report blocker (dungeonId/chapterId/count), then refresh progress every 30s after the player completes it manually

---

## L1-17: Main Quests

### Execution Steps (numbered; do not skip)

1. `lumiterra query-status`
   - Confirm the character is alive; if HP / energy is insufficient, first use survival workflow or `use-item` to recover
2. `lumiterra quest-normal-list --type main`
   - If a `status=active` quest exists -> record `taskId` and jump directly to Step 5 (resume)
   - If no active quest exists, take the first `canAccept` quest
   - Record `taskId` / `acceptNpc.cid` / `acceptNpc.pos` / `submitNpc.cid` / `submitNpc.pos`
   - If there is no canAccept and no active quest -> end this run (main quests unlock linearly and prerequisites must be completed first)
3. `lumiterra navigate --x <acceptNpc.pos.x> --y <acceptNpc.pos.y> --z <acceptNpc.pos.z>`
   - Move to the accepting NPC; coordinates are returned directly by Step 2, so no `query-spawn-point` is needed
4. `lumiterra quest-dialog --npc-cid <acceptNpc.cid>`
   - Accept the quest; when `action=accepted` returns, record `taskId`
5. **[RESUME POINT]** `lumiterra quest-normal-list --task-id <taskId>`
   - Read current progress from `subItems[]` (`curRate` / `maxRate` / `completed` / `type`)
   - For each `completed=false` subItem, dispatch by `subItem.type` (see dispatch table below)
   - After each subItem finishes, rerun `quest-normal-list --task-id <taskId>` to confirm `completed=true`
   - All subItems complete -> enter Step 6
6. `lumiterra navigate --x <submitNpc.pos.x> --y <submitNpc.pos.y> --z <submitNpc.pos.z>`
   - Move to the submitting NPC
7. Submit quest (try-first strategy):
   - First try `lumiterra quest-normal-claim --task-id <taskId>`
   - Success (`isSelfEnd=true` tasks such as TargetPosition) -> workflow ends
   - Failure ("not an isSelfEnd task") -> `lumiterra quest-dialog --npc-cid <submitNpc.cid>`
   - Returns `action=completed` -> workflow ends

### Called Base Workflows

- SW-1-gather-entity (`GatherResource`)
- SW-2-crop-farming (`Watering` / `HarvestHomeItem`)
- SW-3-animal-petting (`PetAppease`)
- SW-4-combat-loop (`KillMonster`)
- SW-5-fishing-loop (`CatchFish`, if it appears)
- L1-get-item (`GetItem` / `HandInItem` missing materials)

### Notes

- Main quests use `TaskListType.Unknown`, a different quest system from daily/bounty
- Main quests progress linearly: completing one unlocks the next (`preTaskReq` dependency chain)
- `isSelfEnd=true` tasks can use `quest-normal-claim` directly after sub-tasks complete, without returning to an NPC
- `quest-normal-abandon --task-id <taskId>` is used only when the user explicitly asks to abandon the current main quest (note: after abandoning, the preTaskReq chain still requires re-accepting in order)

---

## L1-18: Side Quests

### Execution Steps (numbered; do not skip)

1. `lumiterra query-status`
   - Same as L1-17 Step 1
2. `lumiterra quest-normal-list --type side`
   - If an active side quest with `status=active` exists -> record `taskId` and jump to Step 5 (resume)
   - Otherwise choose target side quest (user-specified or by reward / distance priority), and read `taskId` / `acceptNpc` / `submitNpc`
   - Side quests can run concurrently; the Agent may accept multiple and advance them one by one, but one at a time is recommended to avoid state divergence
3. `lumiterra navigate --x <acceptNpc.pos.x> --y <acceptNpc.pos.y> --z <acceptNpc.pos.z>`
4. `lumiterra quest-dialog --npc-cid <acceptNpc.cid>`
   - Accept quest; returns `action=accepted`
5. **[RESUME POINT]** `lumiterra quest-normal-list --task-id <taskId>`
   - Same subItem dispatch logic as L1-17 Step 5 (see dispatch table below)
6. `lumiterra navigate --x <submitNpc.pos.x> --y <submitNpc.pos.y> --z <submitNpc.pos.z>`
7. Submit quest (same try-first strategy as L1-17):
   - First `quest-normal-claim --task-id <taskId>`
   - If it fails, run `quest-dialog --npc-cid <submitNpc.cid>`; returns `action=completed`

### Called Base Workflows

- Exactly the same as L1-17: SW-1 / SW-2 / SW-3 / SW-4 / SW-5 + L1-get-item (dispatch by `subItem.type`)

### Notes

- Side quests and main quests share the same command set; the only difference is the `--type side` filter
- Side quests can progress concurrently, but when multiple quests are active, each refresh must use `quest-normal-list --task-id <taskId>` to lock the specific task
- `preTaskReq` may depend on main quests (main/side can be prerequisites for each other): if the target side quest cannot be accepted, check main quest progress first
- `quest-normal-abandon --task-id <taskId>`: side quests can be abandoned more freely than main quests, and this is used when the user asks to switch target side quest or when multiple side quests conflict

---

## subItem.type -> Base Workflow / Atom Dispatch Table (shared by L1-17 / L1-18)

All `subItem.type` names come from `CliSubItemSerializer.cs` `DataCase.ToString()` and share semantics with the `TaskOptionType` proto enum across main/side/daily/bounty/token-task.

| subItem.type | Automation | Action |
|---|---|---|
| `UserLevel` | yes | `query-status` -> if `level < requirement`, stop and report blocker (insufficient level cannot be auto-upgraded) |
| `KillMonster` | yes | [SW-4 combat-loop](../base-workflows/SW-4-combat-loop.md): `navigate(guidePos or query-spawn-point --type monster --cid <monsterCid>)` -> `switch-weapon --weapon-type <sword\|hammer\|bow>` -> `auto-combat --target <monsterCid> --count <remaining>` (`remaining=maxRate-curRate`, cap 5, batch if above 5) |
| `GatherResource` | yes | [SW-1 gather-entity](../base-workflows/SW-1-gather-entity.md): `navigate(guidePos or query-spawn-point --type gather --cid <resourceCid>)` -> `switch-weapon --weapon-type <pickaxe\|axe\|sickle>` -> `auto-gather --target <resourceCid> --count <remaining>` |
| `GetItem` | yes | [L1-get-item](./L1-get-item.md) (subItem already provides `itemCid`, prefer direct CID entry) |
| `HandInItem` | yes | `quest-submit --task-id <taskId>` -> if it returns `missingItems`, run [L1-get-item](./L1-get-item.md) for each missing `itemCid` -> retry `quest-submit` after replenishment |
| `UseItem` | yes | Use `query-inventory` to find the target item's `itemInstanceId` -> `use-item --item-instance-id <itemInstanceId>` |
| `UseRecipe` | yes | Check materials -> `craft-execute --recipe <recipeId>`, repeat `times` times (missing materials use L1-get-item craft branch) |
| `RecipeUseCount` | yes | `query-recipes --craftable` -> choose a craftable recipe -> loop `craft-execute` until accumulated count reaches `count` |
| `TargetPosition` | yes | `navigate --x <targetPos.x> --y <targetPos.y> --z <targetPos.z>` -- completes after entering radius |
| `NpcDialog` | yes | `query-spawn-point --type npc --cid <npcCid>` -> `navigate` -> `quest-dialog --npc-cid <npcCid>` |
| `TalentLevel` | yes | `query-talent` -> locate the trunk for `talentType` -> `talent-manage --action upgrade --talent-type <talentType>` until `level` is reached |
| `NodeLevel` | yes | `query-talent` -> locate `nodeId` -> `talent-manage --action upgrade --talent-type <type> --node-id <nodeId>` until `level` is reached |
| `FinishTaskCount` / `FinishTaskListCount` | yes | Recursively call the corresponding task workflow according to `taskListType` (daily/bounty/talent), accumulating `count` completions |
| `HarvestHomeItem` | yes | [SW-2 crop-farming](../base-workflows/SW-2-crop-farming.md): `query-spawn-point --type farm --cid <seedCid>` -> `navigate` -> crop loop (hoe -> water -> harvest) -> until `curRate` reaches `maxRate` |
| `Watering` | yes | [SW-2 crop-farming](../base-workflows/SW-2-crop-farming.md): each progress = a full crop cycle (from hoeing to growth complete), not one watering action |
| `PetAppease` | yes | [SW-3 animal-petting](../base-workflows/SW-3-animal-petting.md): filter `ownerId=null` or `expireInSeconds<=0` -> `switch-weapon brush` -> loop `animal-pet --entity-id <entityId>` (⚠️ do not use jq for entityId; use python3/grep) |
| `CaptureTargetPet` | yes | `query-capture-setup --target <petCid>` -> resolve blockers (skill/weapon/prop) -> loop `capture-pet --target <petCid>` until `curRate` reaches `maxRate` |
| `DungeonChapterPass` | [MANUAL] | CLI currently has no dungeon-clear atom; stop and report blocker (dungeonId/chapterId/count), then call `quest-normal-list --task-id <taskId>` every 30s after the player completes it manually to check `completed=true` |

---

## Shared HARD RULES (L1-17 / L1-18)

- **Choose the correct command variant**: `quest-normal-list` / `quest-normal-claim` / `quest-normal-abandon` are only for normal quests (main + side); do not mix them with `quest-daily-*` (daily), `token-task-*` (token pool), or `quest-bounty-*` (bounty)
- **`quest-dialog --npc-cid` is the only way to talk for accept / submit**: accepting checks `action=accepted`, submitting checks `action=completed`; commands like `quest-accept` / `quest-complete` do not exist here
- **NpcDialog distance check**: the server checks player distance to NPC <= 5 meters (`NPC_TASK_DIALOGUE_DISTANCE = 5f`). Before `quest-dialog`, navigate near the NPC first, or the server returns `npcTooFar`
- **NPC coordinate source**: `acceptNpc.pos` / `submitNpc.pos` are returned directly by `quest-normal-list`; do not run extra `query-spawn-point` for these two NPCs. Only use `query-spawn-point --type npc --cid <npcCid>` when sub-task type is `NpcDialog` and guidePos is missing
- **Submit quest try-first**: first try `quest-normal-claim` (handles `isSelfEnd=true` tasks), then use `quest-dialog` on failure; do not reverse the order, or isSelfEnd tasks can get stuck looking for an NPC
- **Missing guidePos**: when `KillMonster` / `GatherResource` has no guidePos, use `query-spawn-point` to supplement coordinates; do not guess coordinates
- **Batch remaining above 5**: `auto-combat` / `auto-gather` `--count` cap is 5; when remaining > 5, loop in batches and refresh progress after each batch
- **Multiple subItems order**: process `subItems[]` in array order one by one; after each completion, rerun `quest-normal-list --task-id` to refresh progress before processing the next one
- **Only Step 5 is the resume entry**: after Agent restart, when Step 2 detects an active quest, jump directly to Step 5 to resume; do not accept again
- **Counting semantics**: when the user specifies "complete N", count only successful submission (`action=completed` or successful `quest-normal-claim`); accept / failed attempts / death and revive do not count

## Notes / Common Mistakes

- Accepting the same quest repeatedly: after Agent restart, it calls `quest-dialog` again without checking `status=active` -> Step 2 must check active first
- Using the wrong command variant: treating `token-task-claim` / `quest-daily-claim` as a generic finisher -> main/side quests must use `quest-normal-claim`
- Skipping navigate: directly calling `quest-dialog` is rejected with `npcTooFar` -> server strictly checks 5-meter distance
- Looking for NPC for isSelfEnd tasks: routing `TargetPosition` and other isSelfEnd tasks back to submitNpc dialogue wastes travel time; try-first should call `quest-normal-claim` first
- Treating guidePos as the "final coordinate": guidePos is a reference point; if it is too far, use `query-spawn-point` for calibration
- Abandoning main quest breaks dependency chain: after `quest-normal-abandon` on a main quest, the `preTaskReq` dependency chain requires progressing again in order; do not abandon main quests casually
- Misrouting subItems: treating `HandInItem` as `GetItem` -> HandInItem must run `quest-submit` so the server reports `missingItems`, and only then use the missing list with L1-get-item
