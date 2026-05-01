# Equipment commands — equipment

> Command interface source of truth: the "Equipment commands:" section in `src/parser/help.js` + `src/parser/validators/equipment.js`
> Command list: `equip` / `switch-weapon` / `enhance-equipment` / `dismantle-equipment` / `claim-dismantling-mats` / `do-equipment-recovery` / `claim-recycle-reward` / `query-dismantling-record` / `query-recycle-pool` / `query-recycle-record`

Equipment commands cover four workflows: **wear/switch** (`equip` / `switch-weapon`), **enhance** (`enhance-equipment`, queue-based flow at world totems), **dismantle** (`dismantle-equipment` -> `query-dismantling-record` -> `claim-dismantling-mats`, three-step fragment claim), and **recycle pool** (`do-equipment-recovery` / `query-recycle-pool` / `query-recycle-record` / `claim-recycle-reward`, periodic airdrop settlement). All commands return JSON; failures return `{ "success": false, "errors": [...] }`.

> Note: querying current equipment worn by self/pets uses `query-equipment` (a core command; see `core.md`). This document covers write/change commands under the "Equipment commands:" section and their supporting record queries (including dismantling records and recycle-pool queries).

> **HARD RULE (asset respect; see SKILL.md Game Essentials §1-4)**:
> - `dismantle-equipment` / `do-equipment-recovery` **destroy equipment instances** and must not be proactively executed without explicit user authorization
> - `enhance-equipment` consumes enhancement stones before starting the YOLO lottery; failure has downgrade risk. Protective stone (`--use-protective-stone=true`) consumes one extra protective stone and is not used by default
> - Pets and players share the same backpack equipment pool; **do not** proactively remove currently equipped player gear just to gear a pet

---

## `equip`

**Purpose**: equip or unequip gear (unified command; parameters are interpreted by `--action`; parameters unrelated to the current action are ignored and do not error). Supports targets as character or pet.

**Parameters** (validator: `validateEquip`):

| flag | Required | Description |
|---|---|---|
| `--action` | Yes | `equip` or `unequip` |
| `--wearer-id` | No | Wearer entity ID (character ID or pet ID both go here, positive integer). Defaults to current main character |
| `--item-instance-id` | Required when `action=equip` | Equipment instance ID (from `query-inventory` or `query-equipment`). May be replaced by `--item-cid`; when both are passed, this parameter takes priority |
| `--item-cid` | No | Equipment config ID. Required when `action=equip` and `--item-instance-id` is not passed. Uses the first matching CID equipment from the backpack |
| `--slot` | Required when `action=unequip` | Slot to unequip; only `head` / `coat` / `pant` / `shoe` / `hand` / `weapon` |

CLI-side validation (`validators/equipment.js`):

- Missing `--action` reports `"Missing required parameter: --action"`
- `--action` outside `equip/unequip` reports `"--action only supports equip/unequip"`
- When `--wearer-id` is omitted, it defaults to the current main character; if passed as non-positive integer, it reports according to `parsePositiveInt` rules
- `action=equip` missing both `--item-instance-id` and `--item-cid` reports `"action=equip requires --item-instance-id or --item-cid"`
- Non-positive-integer `--item-cid` reports according to `parsePositiveInt` rules
- `action=unequip` missing `--slot` reports `"action=unequip requires --slot"`
- With `action=unequip`, `--slot` outside the allowlist reports `"--slot only supports head/coat/pant/shoe/hand/weapon"`
- With `action=equip`, `--slot` is ignored even if passed (not validated and no error)
- After validation, `action` is forced to lowercase; `unequip` `slot` is forced to lowercase

**Examples**:

```bash
# Equip gear on main character (instance ID)
lumiterra equip --action equip --item-instance-id 100234 --wearer-id 1

# Equip gear on main character (config CID)
lumiterra equip --action equip --item-cid 10023 --wearer-id 1

# Unequip main character helmet
lumiterra equip --action unequip --wearer-id 1 --slot head

# Equip gear on a pet
lumiterra equip --action equip --item-instance-id 100234 --wearer-id 50012
```

**Key return fields**: `action` (equip/unequip), `itemInstanceId`, `slot`, `changed`, `replacedItemInstanceId`, `wearerId`, `wearerType`

**Notes**:

- When equipping gear on a pet, the corresponding talent level is checked against equipment `UseLv`; insufficient level fails directly.
- If the target slot already has gear during `action=equip`, it is replaced and returned in `replacedItemInstanceId`.
- HARD RULE: automated workflows should not proactively unequip currently equipped player gear to equip a pet unless the user explicitly requests it.

---

## `switch-weapon`

**Purpose**: switch held weapon/tool by weapon type. Automatically chooses the highest UseLv weapon in the backpack whose talent level requirement is satisfied.

**Parameters** (validator: `validateSwitchWeapon`):

| flag | Required | Description |
|---|---|---|
| `--weapon-type` | Yes | Weapon type; only `sword` / `hammer` / `bow` / `sickle` / `axe` / `pickaxe` / `hoe` / `water-bottle` / `brush` / `scissors` / `milker` / `fishing-rod` |

CLI-side validation (`validators/equipment.js`):

- Missing `--weapon-type` reports `"Missing required parameter: --weapon-type"`
- Outside allowlist reports `"--weapon-type only supports: sword/hammer/bow/sickle/axe/pickaxe/hoe/water-bottle/brush/scissors/milker/fishing-rod"`
- After validation, `weapon-type` is forced to lowercase

> **Docs drift**: `docs/commands.md` additionally describes `--target-fish-cid` for `switch-weapon` (fishing-rod only), used to filter compatible fishing rods by target fish cid. Current `validators/equipment.js` `validateSwitchWeapon` only validates `--weapon-type` and does not validate `--target-fish-cid`; if the actual CLI passes that flag downstream, behavior depends on runtime. By code source of truth, this parameter is only handled as a pass-through parameter.

**Examples**:

```bash
# Switch to hoe (for farm operations)
lumiterra switch-weapon --weapon-type hoe

# Switch to fishing rod
lumiterra switch-weapon --weapon-type fishing-rod
```

**Key return fields**:

- `changed` (boolean): whether switching actually occurred (`false` when already this type)
- `weaponType` (string): requested weapon type
- `itemInstanceId` (string): equipped weapon instance ID
- `name` (string): weapon name
- `level` (int): weapon level (UseLv)
- `replacedItemInstanceId` (string?): old weapon instance ID replaced during switch (only present when switching)

**Notes**:

- Used to switch between hoe, water bottle, brush, combat weapons, and other tools. Failure means the backpack has no such type or talent level is not unlocked.
- If the target weapon type is already equipped, it skips switching and returns `changed=false`.

---

## `enhance-equipment`

**Purpose**: enhance equipment at a world totem. This is a server-side queue flow. The CLI single command returns the final extracted fields and does not additionally open the enhancement result UI.

**Parameters** (validator: `validateEnhanceEquipment`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--item-instance-id` | Yes | - | Equipment instance ID to enhance |
| `--totem-id` | Yes | - | Totem ID, **dual source**: totem NFT ID (`totemNftId`) **or** world totem entity ID in the scene |
| `--use-protective-stone` | No | `false` | Whether to use a protective stone; accepts `true/false/1/0` |

CLI-side validation (`validators/equipment.js`):

- Missing `--item-instance-id` reports `"Missing required parameter: --item-instance-id"`
- Missing `--totem-id` reports `"Missing required parameter: --totem-id"`
- Non-boolean literal `--use-protective-stone` reports `"--use-protective-stone only supports true/false/1/0"`
- After validation, `use-protective-stone` is normalized to string `"true"` or `"false"` before being sent

**Examples**:

```bash
# Enhance using totem NFT (without protective stone)
lumiterra enhance-equipment --item-instance-id 100234 --totem-id 88001

# Use scene world totem entity + protective stone
lumiterra enhance-equipment --item-instance-id 100234 --totem-id 77001 --use-protective-stone true
```

**Key return fields**:

- `beforeItemInstanceId`: original itemInstanceId before enhancement
- `afterItemInstanceId`: new equipment instance ID after enhancement (may be empty when event matching fails; **does not mean failure**)
- `originLevel` / `newLevel`: level before/after enhancement
- `attributes`: attributes after enhancement
- `yoloResult`: YOLO lottery result
- `useProtectiveStone`: whether a protective stone was used this time
- `extractedAtMs` / `queueWaitSeconds`: extraction time and queue wait
- When enhancement stones are insufficient, additionally returns `enhanceStoneItemCid` and `material.itemCid/name/need/have/enough`

**Notes**:

- **Equipment must first be unequipped** (checked inside the command), and it automatically participates in the YOLO lottery.
- Must be performed at a world totem (if `--totem-id` is a scene entity ID, first move near it).
- The real enhancement result should be read from `originLevel` / `newLevel` / `attributes` / `yoloResult`; do not judge success/failure by whether `afterItemInstanceId` is empty.
- When enhancement stones are insufficient, the command fails **before starting enhancement** and does not consume materials.

---

## `dismantle-equipment`

**Purpose**: submit a dismantling request for one or more equipment items (only sends `Dismantling`, enters the server dismantling queue, does not wait for completion, and does not auto-claim fragments).

**Parameters** (validator: `validateDismantleEquipment`):

| flag | Required | Description |
|---|---|---|
| `--item-instance-id` | Yes | Equipment instance ID, **batch supported**: multiple IDs separated by spaces or ASCII commas |

CLI-side validation (`validators/equipment.js`):

- Missing `--item-instance-id` reports `"Missing required parameter: --item-instance-id"`
- Empty array after splitting reports `"Missing required parameter: --item-instance-id"`
- Duplicate IDs within the batch report `"--item-instance-id does not support duplicate equipment instance IDs"`
- Any ID not matching equipment instance format (`[1-9]\d*` or `local#xxx#N`) reports `"--item-instance-id must be an equipment instance ID"`
- After validation, all IDs are joined by `,` into a single string before being sent

**Examples**:

```bash
# Single dismantle
lumiterra dismantle-equipment --item-instance-id 100234

# Batch dismantle (comma-separated)
lumiterra dismantle-equipment --item-instance-id 100234,100235,100236

# Batch dismantle (space-separated)
lumiterra dismantle-equipment --item-instance-id "100234 100235 100236"
```

**Key return fields**: `itemInstanceIds` (ID list requested this time), `items[]` (corresponding equipment summaries), `itemCount` (batch count), `submittedAtMs`

**Notes**:

- HARD RULE: dismantling **destroys equipment instances**. Do not execute without explicit user authorization.
- After submitting, use `query-dismantling-record` to find `recordId`; once state becomes `DismantlingSuccess`, call `claim-dismantling-mats --record-id <recordId>` to claim materials.

---

## `query-dismantling-record`

**Purpose**: query the current user's equipment dismantling record list (used to find claimable `recordId`).

**Parameters** (validator: `validateQueryDismantlingRecord`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--begin` | No | 0 | Start position (non-negative integer) |
| `--count` | No | all | Query count (positive integer) |

CLI-side validation (`validators/equipment.js`):

- Non-`>=0` integer `--begin` reports `"--begin must be an integer greater than or equal to 0"`
- Non-positive-integer `--count` reports according to `parsePositiveInt` rules

**Examples**:

```bash
lumiterra query-dismantling-record
lumiterra query-dismantling-record --begin 0 --count 20
```

**Key return fields**: `records[]`, `count`, `begin`

**`records[]` fields**:

- `recordId` / `disMsgId`: dismantling record ID, passed to `claim-dismantling-mats --record-id`
- `state`: dismantling state; enum `DismantlingPlaying` / `DismantlingSuccess` / `DismantlingFail` / `DismantlingMatClaimed`
- `action`: record source; user-initiated dismantling is `UserDismantling`
- `createAt`: record creation timestamp
- `items[]`: equipment summaries dismantled in this batch
- `materials[]`: material summaries claimable after dismantling completes

---

## `claim-dismantling-mats`

**Purpose**: claim materials from a completed dismantling record (CLI claim does not open the dismantling result UI).

**Parameters** (validator: `validateClaimDismantlingMats`):

| flag | Required | Description |
|---|---|---|
| `--record-id` | Yes | `recordId` / `disMsgId` returned by `query-dismantling-record` (non-empty string) |

CLI-side validation (`validators/equipment.js`):

- Missing `--record-id` or empty string reports `"Missing required parameter: --record-id"`
- After validation, `record-id` calls `.trim()` to remove surrounding whitespace

**Example**:

```bash
lumiterra claim-dismantling-mats --record-id DMR_abc123
```

**Key return fields**: `record`, `claimedAtMs`

**Notes**:

- Only records with `state=DismantlingSuccess` can be claimed.
- After claiming, the record becomes claimed or disappears from the claimable list; the next `query-dismantling-record` response is authoritative.

---

## `do-equipment-recovery`

**Purpose**: put equipment or fragments into the specified recycle pool, gaining recycle points and participating in periodic airdrop distribution.

**Parameters** (validator: `validateDoEquipmentRecovery`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--pool-id` | Yes | - | **Current pool ID** (from `poolId` returned by `query-recycle-pool`; different from reward-claim `previousExtraReward.poolId`) |
| `--item-instance-id` | Yes | - | Backpack item instance ID; supports multiple IDs separated by spaces or ASCII commas |
| `--count` | No | - | May specify contribution quantity when there is a single `--item-instance-id`; for multiple items each quantity is fixed to 1 |

CLI-side validation (`validators/equipment.js`):

- Missing `--pool-id` or empty string reports `"Missing required parameter: --pool-id"`
- Missing `--item-instance-id` or empty after splitting reports `"Missing required parameter: --item-instance-id"`
- Duplicate IDs within the batch report `"--item-instance-id does not support duplicate item instance IDs"`
- Any ID not matching instance format reports `"--item-instance-id must be an item instance ID"`
- Non-positive-integer `--count` reports according to `parsePositiveInt` rules
- When there are multiple items (`itemInstanceIds.length > 1`), if `count !== "1"`, reports `"--count only supports a single --item-instance-id"`
- After validation, `pool-id` is trimmed, `item-instance-id` is joined by `,`, and `count` is converted to string before being sent

**Examples**:

```bash
# Single item contribution
lumiterra do-equipment-recovery --pool-id POOL_2024W15 --item-instance-id 100234

# Batch contribution (multiple items)
lumiterra do-equipment-recovery --pool-id POOL_2024W15 --item-instance-id 100234,100235

# Single item with specified quantity
lumiterra do-equipment-recovery --pool-id POOL_2024W15 --item-instance-id 100234 --count 5
```

**Key return fields**: `poolId`, `poolTypeId`, `items[]`, `itemCount`, `submittedAtMs`

**Notes**:

- HARD RULE: putting items into the recycle pool **destroys equipment instances**. Do not execute without explicit user authorization.
- The command first validates whether the itemCid belongs to this pool's recyclable list using `DRItemBuyBack.BuyItemList`.
- It does not automatically claim airdrops. After the cycle ends, use `query-recycle-pool` to inspect `previousExtraReward`, then call `claim-recycle-reward` with that `poolId`.

---

## `query-recycle-pool`

**Purpose**: query equipment recycle-pool list, current points, deadline, and previous-cycle airdrop reward.

**Parameters** (validator: `validateQueryRecyclePool`):

| flag | Required | Description |
|---|---|---|
| `--pool-id` | No | Return only the specified current pool ID (non-empty string) |
| `--pool-type-id` | No | Return only the specified `DRItemBuyBack` config ID (positive integer) |

CLI-side validation (`validators/equipment.js`):

- Empty string `--pool-id` reports `"--pool-id cannot be empty"`
- Non-positive-integer `--pool-type-id` reports according to `parsePositiveInt` rules
- After validation, `pool-id` is trimmed

**Examples**:

```bash
lumiterra query-recycle-pool
lumiterra query-recycle-pool --pool-type-id 10001
lumiterra query-recycle-pool --pool-id POOL_2024W15
```

**Key return fields**: `pools[]`, `count`

**`pools[]` fields**:

- `poolId`: current recycle pool ID, passed to `do-equipment-recovery --pool-id` when contributing items
- `poolTypeId`: recycle pool config ID, corresponding to `DRItemBuyBack`
- `userScore` / `poolScore` / `shareRate`: my points, total points, current share
- `expireTime`: current-cycle deadline timestamp (seconds)
- `extraRewardToken` / `extraRewardItems[]`: total airdrop reward for the current cycle
- `previousExtraReward`: previous-cycle reward; **use its `poolId` when claiming**
- `buyItemList[]`: items accepted by this pool, including `itemCid`, name, and points

---

## `query-recycle-record`

**Purpose**: query exchange/airdrop records for an equipment recycle pool.

**Parameters** (validator: `validateQueryRecycleRecord`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--pool-type-id` | Yes | - | `poolTypeId` returned by `query-recycle-pool` (positive integer) |
| `--begin` | No | 0 | Start position (non-negative integer) |
| `--count` | No | all | Query count (positive integer) |

CLI-side validation (`validators/equipment.js`):

- Non-positive-integer `--pool-type-id` reports according to `parsePositiveInt` rules
- Non-`>=0` integer `--begin` reports `"--begin must be an integer greater than or equal to 0"`
- Non-positive-integer `--count` reports according to `parsePositiveInt` rules

**Examples**:

```bash
lumiterra query-recycle-record --pool-type-id 10001
lumiterra query-recycle-record --pool-type-id 10001 --begin 0 --count 10
```

**Key return fields**: `records[]`, `count`, `logsCount`, `begin`, `poolTypeId`

---

## `claim-recycle-reward`

**Purpose**: claim the previous-cycle equipment recycle-pool airdrop reward.

**Parameters** (validator: `validateClaimRecycleReward`):

| flag | Required | Description |
|---|---|---|
| `--pool-id` | Yes | **`previousExtraReward.poolId`** returned by `query-recycle-pool`; **not** the current pool's `poolId` |

CLI-side validation (`validators/equipment.js`):

- Missing `--pool-id` or empty string reports `"Missing required parameter: --pool-id"`
- After validation, `pool-id` is trimmed

**Example**:

```bash
# pool-id comes from query-recycle-pool.pools[].previousExtraReward.poolId
lumiterra claim-recycle-reward --pool-id POOL_2024W14
```

**Key return fields**: `poolId`, `poolTypeId`, `reward`, `claimedAtMs`

**Notes**:

- **pool-id source difference (CRITICAL)**:
  - `do-equipment-recovery --pool-id` <- `query-recycle-pool.pools[].poolId` (**current pool**)
  - `claim-recycle-reward --pool-id` <- `query-recycle-pool.pools[].previousExtraReward.poolId` (**previous-cycle pool**)
  - Passing the wrong one means no reward can be claimed
- Only claim rewards in `previousExtraReward` that are **unclaimed and non-empty**.
- Current-cycle rewards must wait until the cycle ends and becomes previous-cycle reward before claiming.
