# General query / utility commands - core

> Command interface source of truth: the "General query commands" section in `src/parser/help.js` and `src/parser/validators/core.js`.
> Command list: `query-app-info` / `query-status` / `query-inventory` / `query-wallet` / `query-zone` / `query-battle-areas` / `query-equipment` / `query-near-entities` / `query-spawn-point`.

General query commands only read current game data. They do not change world state. All commands return JSON; failures return `{ "success": false, "errors": [...] }`.
---

## `query-app-info`

**Purpose**: query basic process and game information: language, version, platform, server line.

**Parameters**: none.

**Examples**:

```bash
lumiterra query-app-info
```

**Response fields**:

| field | Type | Description |
|---|---|---|
| `language` | string | Current game language, such as `en` or `zh`. |
| `gameVersion` | string | Game client version. |
| `platform` | string | Runtime platform, such as `OSXEditor`, `WindowsPlayer`, `Android`, or `IOS`. |
| `unityVersion` | string | Unity engine version. |
| `serverLine` | string | Server line display name, such as `LINE#3`; usually present only after login. |
| `isGrandOpen` | bool | Whether the current line is a temporary grand-open line. |

**Notes**:

- Use `language` as the authority for name matching and keyword search.
- `serverLine` / `isGrandOpen` depend on login-time `LineInfo`; they may be absent before login.

---

## `query-status`

**Purpose**: query current character status: level, HP, energy, coordinates, and camp.

**Parameters**: none.

**Examples**: `lumiterra query-status`

**Response fields**: `roleId` / `level` / `hp` / `maxHp` / `position{x,y,z}` / `energy` / `maxEnergy` / `camp` (`"peace"|"pvp"`) / `onChainWealth` / `offChainWealth` / `totalWealth`.

**Notes**:

- `roleId` can be passed to later commands as `--target-id` when needed.
- `camp` is changed by `toggle-pvp`; `peace` prevents attacking and being attacked by players.
- Wealth fields are read-only status fields and must not be renamed.

---

## `query-inventory`

**Purpose**: filter inventory items by type, wear level, talent, item CID, or item instance ID.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--type` | no | Item type filter: `all` / `wearable` / `food` / `material` / `pet-egg`. Supports space-separated or comma-separated multiple values; multiple values are ORed. |
| `--lv` | no | Exact match on item `useLv`. |
| `--talent` | no | Talent filter: `battle` / `farming` / `gather`. |
| `--item-cid` | no | Exact filter by item config ID. |
| `--item-instance-id` | no | Exact filter by item instance ID. |

**Examples**:

```bash
lumiterra query-inventory --type material wearable pet-egg
lumiterra query-inventory --type wearable --lv 10 --talent battle
lumiterra query-inventory --item-cid 1234
```

**Response fields**:

- `items[]`: `{itemInstanceId, itemCid, name, count, quality, useLv, category, talents}`.
- `filter`: normalized filter object `{type, level, talent, itemCid, itemInstanceId}`.

**Notes**:

- Multiple `type` values are ORed; `type`, `lv`, `talent`, `item-cid`, and `item-instance-id` are ANDed together.
- `itemInstanceId` is a string and may be numeric-like (`"10001"`) or local (`"local#..."`). Never coerce it to number.

---

## `query-spawn-point`

**Purpose**: query the nearest spawn point or area for monsters, NPCs, gathering resources, fish, farm plots, or animals. Returns navigation-ready coordinates.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--type` | yes | `monster` / `npc` / `gather` / `fish` / `farm` / `animal`. |
| `--cid` | choose one | Entity or area ConfigId. Mutually exclusive with `--keyword`; if both are provided, `--cid` is authoritative. |
| `--keyword` | choose one | Fuzzy name search against entity configs. Matching uses `CliSearchUtil.ScoreMatch`; no match returns a "not found" error. |

**Description**: one of `--cid` or `--keyword` is required. `--type` alone is invalid.

**Examples**:

```bash
lumiterra query-spawn-point --type monster --cid 2001
lumiterra query-spawn-point --type fish --cid 7001
lumiterra query-spawn-point --type monster --keyword "wolf"
lumiterra query-spawn-point --type npc --keyword "merchant"
lumiterra query-spawn-point --type gather --keyword "ore"
```

**Response fields**:

- `position`: original spawn position for monster/NPC points, `{x,y,z}`.
- `navPosition`: **preferred navigation target**, already adjusted through land-table and NavMesh validation.
- `distance`: straight-line distance to `position` or `center`.
- `cid`: resolved ConfigId.
- `center`: area center for gather/fish/farm/animal, `{x,y,z}`.
- `size`: area size, `{x,y,z}`.
- `reachable`: true when a valid navigation target exists.

**Notes**:

- `--cid` is an **entity CID**: `monsterCid`, `resourceCid`, `seedCid`, `petCid`, `fishCid`, or `npcCid`. It is **not** the finished item's `itemCid`.
- If you only have a finished item `itemCid`, first run `query-item-sources --item-cid <itemCid>` and map `sources[]` to the source CID (`monster_drop` -> `monsterCid`, `gathering` -> `resourceCid`, `seed_planting` -> `seedCid`, `animal_pet` -> `animalCid`, `fishing` -> `fishCid`).
- For `HarvestHomeItem` / `Watering`, pass the quest subItem `seedCid` to `--type farm --cid`.
- Use `navPosition` for `navigate`. `center` is for display and distance only.

---

## `query-near-entities`

**Purpose**: query entities currently loaded near the protagonist in the active scene. This uses the runtime EntityMgr view, not static spawn config.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--type` | yes | `player`, `pet`, `npc`, `resource`, `monster`, `world-animal`. |
| `--radius` | no | Query radius in meters, > 0; default `100`. |
| `--limit` | no | Return limit `1-100`; default `10`; sorted by distance ascending. |
| `--cid` | no | Config ID filter; `0` means no filter. |

**Examples**: `lumiterra query-near-entities --type monster --radius 50 --limit 5`

**Response fields**:

- `count` / `radius` / `limit` / `type` / `typeName` / `cid` (`0` means no filter).
- `entities[]`: `{entityId, entityType, entityTypeName, cid, name, level?, hp?, maxHp?, isInBattle?, status?, distance, position{x,y,z}}`.

**Notes**:

- Difference from `query-spawn-point`: this command returns loaded scene entities; spawn-point returns static spawn/area config.
- No match returns `count=0` and an empty array, not an error.

---

## `query-battle-areas`

**Purpose**: query all loaded `BattleAreaConfig` regions in the current scene, including `AreaID`, world-space center/size, and config description from `DRBattleArea`.

**Parameters**: none.

**Examples**:

```bash
lumiterra query-battle-areas --pretty
```

**Response fields**:

- `count`: number of loaded `BattleAreaConfig` entries.
- `areas[]`:
  - `areaId`: `BattleAreaConfig.AreaID`.
  - `priority`: `BattleAreaConfig.Priority`.
  - `name` / `desc` / `type` / `areaSort`: from `DRBattleArea`.
  - `colliderType`: collider type used for range calculation.
  - `center{x,y,z}`: world-space area center.
  - `size{x,y,z}`: world-space area size.
  - `warnings[]`: missing config, missing collider, non-trigger collider, and related diagnostics.

**Notes**:

- `center` / `size` are world-space bounds, not local coordinates.
- The same `areaId` may appear multiple times in a scene; the command returns scene objects, not deduplicated config IDs.

---

## `query-equipment`

**Purpose**: query equipped items, attributes, and enhancement level on the target entity.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--target-id` | no | Target entity ID. Defaults to current protagonist. Can target pets and other entities. Validator also accepts alias `--role-id`. |

**Examples**: `lumiterra query-equipment --target-id 12345`

**Response fields**:

- `targetId`.
- `items[]`: `{slot(head|coat|pant|shoe|hand|weapon), itemInstanceId, name, itemCid, quality, level, enhanceLevel, attributes, abilityLevel, talentType}`.

**Notes**: `query-status.roleId` can be passed directly as `--target-id`.

---

## `query-zone`

**Purpose**: query the player's current zone information from the local SceneAreaMgr cache.

**Parameters**: none.

**Examples**: `lumiterra query-zone`

**Response fields**: `{zoneId, zoneName, sceneType, sceneSubtype, isPvp}`.

**Notes**: use this as a PvP precheck before entering PvP zones.

---

## `query-wallet`

**Purpose**: query wallet token balance from the local WalletCenter cache.

**Parameters**: none.

**Examples**: `lumiterra query-wallet`

**Response fields**: `tokenCount` (on-chain balance, float).

**Notes**:

- This is a local cached read, refreshed by game startup/actions and roughly every few seconds.
- Before expensive actions such as L1-16 moves, use this as a cost precheck.

---
