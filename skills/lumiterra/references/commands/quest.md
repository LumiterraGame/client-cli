# Quest commands — quest (including token-pool tasks)

> Command interface source of truth: the "Quest commands:" / "Token-pool task commands:" sections in `src/parser/help.js` + `src/parser/validators/quest.js`
> Command list (quests): `quest-list` / `quest-accept` / `quest-claim` / `quest-abandon` / `quest-normal-list` / `quest-dialog` / `quest-normal-claim` / `quest-submit` / `quest-normal-abandon`
> Command list (token pool): `token-task-list` / `token-task-accept` / `token-task-claim` / `close-token-task-reward-ui` / `token-task-abandon` / `token-task-refresh`

Quest commands cover three categories: **daily/bounty quest chains** (`quest-list`/`quest-accept`/`quest-claim`/`quest-abandon`), **main/side normal quests** (`quest-normal-*`/`quest-dialog`/`quest-submit`), and **token-pool tasks** (`token-task-*`/`close-token-task-reward-ui`). All commands return JSON; failures return `{ "success": false, "errors": [...] }`.

---

## Quest commands

### `quest-list`

**Purpose**: view quest list (daily/bounty quest chains).

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--type` | No | Quest type filter: `daily` or `bounty`; when omitted, returns all |

**Examples**:

```bash
lumiterra quest-list
lumiterra quest-list --type daily
```

**Return fields**:

- `quests[]`: `{chainId, name, type, status, progress, subtasks[], rewards[]}`
- `subtasks[]` structured fields include `desc`, `curRate`/`maxRate`, `type`, `guiderPoint`, `guidePos{x,y,z}`, and target fields added by `type`:
  - `UserLevel`: `level`
  - `KillMonster`: `monsterCid`, `num` (-> `auto-combat --target`)
  - `GetItem` / `HandInItem` / `UseItem`: `itemCid`, `num`, `nftId`
  - `TargetPosition`: `targetPos{x,y,z,radius}` (-> `navigate --x --y --z`)
  - `GatherResource`: `resourceCid`, `num`
  - `HarvestHomeItem`: `seedCid`, `num`
  - `UseRecipe`: `recipeId`, `times` (-> `craft-execute --recipe`)
  - `RecipeUseCount`: `count`
  - `FinishTaskCount` / `FinishTaskListCount`: `taskListType`, `count`
  - `TalentLevel`: `talentType`, `level`
  - `NodeLevel`: `nodeId`, `level`
  - `NpcDialog`: `npcCid`, `dialogCount`
  - `Watering`: `seedCid`, `num` (one progress = one full planting cycle, not one watering action)
  - `PetAppease`: `petCid`, `num`
  - `CaptureTargetPet`: `petCid`, `num`
  - `DungeonChapterPass`: `dungeonId`, `chapterId`, `count`

**Notes**:

- `guiderPoint` + `guidePos` exist on almost all subtask types; they are guide resource point ID + resolved coordinates.
- Target IDs in structured fields are all `CID`, not `itemInstanceId`.

---

### `quest-accept`

**Purpose**: accept a daily/bounty quest for the specified type + specialization direction.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--type` | Yes | Quest type: `daily` or `bounty` |
| `--talent` | Yes | Talent direction: `battle`/`farming`/`gather` |

**Example**:

```bash
lumiterra quest-accept --type daily --talent battle
```

**Return fields**:

- `chainId`: quest chain ID
- `taskName`: current quest name

---

### `quest-claim`

**Purpose**: claim rewards for a completed quest chain.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--type` | Yes | Quest type: `daily` or `bounty` |

**Example**:

```bash
lumiterra quest-claim --type daily
```

**Return fields**: quest chain progress, subtask completion status (including structured fields, same as `quest-list`), reward preview.

**Note**: rewards are issued automatically when the quest is completed.

---

### `quest-abandon`

**Purpose**: abandon a quest chain or normal quest (choose one of two usages).

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--type` | One of two | Abandon quest chain by type: `daily` or `bounty` |
| `--taskId` | One of two | Abandon normal quest by task ID (note this is camelCase `--taskId`, not `--task-id`) |

**Examples**:

```bash
lumiterra quest-abandon --type daily
lumiterra quest-abandon --taskId 50001
```

**Return fields**: abandoned quest chain / task ID.

**Notes**:

- Quest-chain abandon and normal-quest abandon use different protocols; do not mix them.
- This command's parameter name is `--taskId` (camelCase); other main/side commands use `--task-id` (kebab). Distinguish them carefully.

---

### `quest-normal-list`

**Purpose**: view main/side quest list (uses `TaskNormalChainList`).

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--task-id` | No | Specify task ID; only returns this task status |
| `--type` | No | `main` or `side`; when omitted, returns all |

**Examples**:

```bash
lumiterra quest-normal-list
lumiterra quest-normal-list --type main
lumiterra quest-normal-list --task-id 100001
```

**Return fields**:

- `quests[]`: `{taskId, name, status, subtasks[], canAccept, prerequisites}`

**Notes**:

- By default, only `canAccept`/`active` quests are returned.
- Main quests have prerequisite quest chains and talent-level requirements; return values include acceptability state.

---

### `quest-dialog`

**Purpose**: talk to the specified NPC (auto-accept / submit quests).

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--npc-cid` | Yes | NPC ConfigId |

**Example**:

```bash
lumiterra quest-dialog --npc-cid 20001
```

**Return fields**:

- `completed`: whether the dialogue completed successfully

**Notes**:

- Server validates distance <= 5 meters (`NPC_TASK_DIALOGUE_DISTANCE = 5f`); the agent must first `navigate` near the NPC.
- **docs vs code difference**: `docs/commands.md` additionally marks `--task-id` as required, but help.js and `validateQuestDialog` only require `--npc-cid`. Code is authoritative.

---

### `quest-normal-claim`

**Purpose**: directly claim rewards for completed main/side quests (`isSelfEnd` tasks).

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--task-id` | Yes | Task ID |

**Example**:

```bash
lumiterra quest-normal-claim --task-id 100001
```

**Return fields**:

- `rewards[]`: reward list
- `taskId`: claimed task ID

**Note**: only `isSelfEnd` tasks can be claimed directly; non-`isSelfEnd` tasks must be submitted to the corresponding NPC through `quest-dialog`.

---

### `quest-submit`

**Purpose**: submit items required by HandInItem subtasks (supports main/side/token-pool tasks; independent operation, no need to stand near NPC).

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--task-id` | Yes | Task ID |

**Example**:

```bash
lumiterra quest-submit --task-id 100001
```

**Return fields**:

- `taskId`, `taskKind`, `status=submitted`
- `items[]`: submitted items
- `subItems[]`: when the task is still in progress after submission, returns latest subtask list; when submission completes the task, only `items` is returned

**Notes**:

- Normal quests use `TaskUpgradeTaskProgressAction.ReqSubmitItem`; token-task uses `UpgradeLuaUsdtTaskProgressAction.Req`.
- Submitted items are automatically read from task data. **The client does not need to manually pass item parameters or count**; the command automatically selects available backpack items with the same `itemCid` to submit.
- Waits up to 5 seconds for the corresponding task update event to confirm successful submission.
- If the task has no item to submit (not `HandInItem` type), it returns failure.
- If backpack materials are insufficient, it returns failure and gives `itemCid / need / have / missing` in `data.missingItems[]`; run `query-item-sources --item-cid <itemCid>` for missing `itemCid`, fill through crafting/gathering/drops, then retry.

---

### `quest-normal-abandon`

**Purpose**: abandon a main/side quest.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--task-id` | Yes | Task ID |

**Example**:

```bash
lumiterra quest-normal-abandon --task-id 100001
```

**Return fields**:

- `taskId`: abandoned task ID

**Note**: after abandonment there is a 5-minute cooldown during which the same task cannot be accepted again.

---

## Token-pool task commands

### `token-task-list`

**Purpose**: view token-pool task list (filter by talent direction; when omitted, returns all directions).

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--talent` | No | Talent direction: `battle`/`farming`/`gather` |

**Examples**:

```bash
lumiterra token-task-list
lumiterra token-task-list --talent battle
```

**Return fields**:

- `pools[]`: `{talent, autoRefreshCdMs, canAutoRefresh, refreshItemCid, tasks[], lotteryTask}`
- `count`: pool count
- `tasks[]` / `lotteryTask`: `{taskId, taskType, state, subItems[], rewards[], expireMs, acceptMs}`

**Note**: tasks with `state=unaccept` must first be accepted with `token-task-accept` before subtasks can progress.

---

### `token-task-accept`

**Purpose**: accept a token-pool task (precondition `state=unaccept`).

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--task-id` | Yes | Task ID |

**Example**:

```bash
lumiterra token-task-accept --task-id 700001
```

**Return fields**:

- `taskId`, `taskName`

---

### `token-task-claim`

**Purpose**: claim token-pool task reward (after all subtasks are complete).

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--task-id` | Yes | Task ID |

**Example**:

```bash
lumiterra token-task-claim --task-id 700001
```

**Return fields**:

- `rewards[]`, `taskId`

**Note**: the Unity client opens the full-screen `FormTokenTaskReward` reward UI. Automation workflows should immediately call `close-token-task-reward-ui` after a successful claim to close it and avoid blocking subsequent operations.

---

### `close-token-task-reward-ui`

**Purpose**: close the full-screen token-pool task reward UI that appears after a successful `token-task-claim`.

**Parameters**: none.

**Example**:

```bash
lumiterra close-token-task-reward-ui
```

**Return fields**:

- `closed`: whether closing succeeded
- `form`: closed form identifier

**Note**: only cleans up `FormTokenTaskReward`; it does not close other UI.

---

### `token-task-abandon`

**Purpose**: abandon an accepted token-pool task (uses the `AbandonLuaUsdtTask` protocol).

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--task-id` | Yes | Task ID |

**Example**:

```bash
lumiterra token-task-abandon --task-id 700001
```

**Return fields**:

- `taskId`, `taskName`, `talent`, `status`

**Note**: must satisfy the in-game abandon cooldown; if cooldown is not ready, it returns failure.

---

### `token-task-refresh`

**Purpose**: refresh the token-pool task list (when omitted, refreshes all directions).

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--talent` | No | Refresh only the specified talent direction: `battle`/`farming`/`gather` (aliases `combat`/`farm`/`gathering` also accepted) |

**Examples**:

```bash
lumiterra token-task-refresh
lumiterra token-task-refresh --talent farming
```

**Return fields**:

- `refreshed`: whether refresh succeeded

**Note**: refresh is constrained by `autoRefreshCdMs` / `canAutoRefresh` returned by `token-task-list`; it may fail if cooldown is not ready.

---
