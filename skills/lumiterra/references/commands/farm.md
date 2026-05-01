# Farm commands — farm

> Command interface source of truth: the "Farm commands:" section in `src/parser/help.js` + `src/parser/validators/farm.js`
> Command list: `farm-hoe` / `farm-eradicate` / `farm-water` / `farm-harvest` / `farm-query`

Farm commands cover writes and queries for the farmland soil state machine: `farm-hoe` / `farm-eradicate` / `farm-water` / `farm-harvest` drive state progression, while `farm-query` reads state. All commands return JSON; failures return `{ "success": false, "errors": [...] }`.

> **HARD RULE (energy and asset respect; see SKILL.md Game Essentials §1-4)**:
> - `farm-hoe` / `animal-pet` refuse execution by default when energy is 0. Passing `--ignore-energy` can force execution, but at energy 0 the action "appears successful but produces no output" (no drops / no earnings). Agents should usually restore energy first instead of forcing execution (Game Essentials §3).
> - Running `farm-hoe` on empty soil = **auto-sowing**. Each world farmland area automatically plants one fixed crop type. There is **no manual sowing step**, and seed type is not chosen by inventory; it is determined by the soil's `HomeResourcesArea`.
> - The `nextOpTime` returned by `farm-water` (seconds until next watering) must be read. When it is <= 60s, the agent **MUST process one soil's full lifecycle serially** and must not spread work across multiple plots concurrently. The server clears each "actionable state" after a 30s timeout.
> - `farm-eradicate` requires an equipped pickaxe. It is usually used to clear expired other-player soil (`expireInSeconds <= 0`) or the player's own non-empty soil. After success, the soil returns to empty, usually followed immediately by `switch-weapon(hoe)` + `farm-hoe`.

---

## Farm operations

Farm operations revolve around the soil state machine: `empty` -> (`farm-hoe` auto-sows) -> `thirsty` -> (`farm-water` loops until mature) -> `harvestable` -> (`farm-harvest`) -> `empty`. Action triggers only accept soil whose `soil.status` is in the matching state. Use `farm-query` for state reads. Hard distance constraint is <= 0.5m.

---

## `farm-hoe`

**Purpose**: hoe soil; when executed on empty soil, this **auto-sows**. Only accepts soil with `status=empty`. If the target is "occupied by another player and expired", first equip a pickaxe and call `farm-eradicate`, then call `farm-hoe`.

**Parameters** (validator: `validateFarmHoe`):

| flag | Required | Description |
|---|---|---|
| `--soil-id` | Yes | Target soil ID (from `farm-query`, positive integer) |
| `--ignore-energy` | No | Force execution at energy 0; if omitted, energy 0 is rejected directly |

CLI-side validation:

- Non-positive-integer `--soil-id` reports an error according to `parsePositiveInt` rules
- `--ignore-energy` is a pass-through flag (the validator does not read it; help.js declares it)

**Examples**:

```bash
lumiterra farm-hoe --soil-id 101
lumiterra farm-hoe --soil-id 101 --ignore-energy
```

**Success response**:

```json
{
  "success": true,
  "data": {
    "soilId": 101,
    "status": "thirsty",
    "ownerId": 12345,
    "nextOpTime": null,
    "expireInSeconds": 7200,
    "plantedCid": 1001
  },
  "errors": null
}
```

**Preconditions**:

- Character is loaded and alive
- Soil exists in the current view
- Distance to soil <= 0.5m
- `soil.status == empty`
- Hoe is equipped (`WeaponSubType.Hoe=7`, `switch-weapon --weapon-type hoe`)
- Fertility remain > 0 (final check is server-side)

**Failure scenarios**:

| Scenario | errors | Handling |
|---|---|---|
| Distance > 0.5m | `"Too far away (>0.5m), cannot hoe soil"` | Navigate closer |
| Hoe not equipped | `"No hoe equipped, cannot operate"` | `switch-weapon --weapon-type hoe` |
| Soil occupied by self | `"This soil is already occupied by you"` | Check status, switch to `farm-water` or `farm-harvest` |
| Soil occupied by another player and not expired | `"This soil is occupied by another player; wait X seconds"` | Wait or choose another soil |
| Soil occupied by another player but expired (`expireInSeconds <= 0`) | `"This soil is occupied by another player but expired; equip a pickaxe and run farm-eradicate first"` | `switch-weapon pickaxe` + `farm-eradicate`, then hoe |
| Fertility insufficient | `"Insufficient fertility, cannot sow"` | Switch gear to raise fertility |
| Energy 0 and `--ignore-energy` not passed | Energy-insufficient error | Restore energy or add `--ignore-energy` (but energy 0 gives no output, usually not recommended) |
| Character dead | `"Character is dead"` | Retry after `revive` |

**Notes**:

- **Auto-sowing does not distinguish seeds**: `farm-hoe` on empty soil directly plants according to that `HomeResourcesArea` config. It does not require matching seeds in the backpack, and the agent does not need to "buy seeds".
- "Expired other-player soil" must first run `switch-weapon pickaxe` + `farm-eradicate`; the hoe **does not** automatically eradicate soil.
- **Energy HARD RULE**: although `--ignore-energy` can force execution at energy 0, the action produces no output (Game Essentials §3). Prefer `use-item` to consume an energy potion and restore energy first.

---

## `farm-eradicate`

**Purpose**: eradicate soil (clear only, no sowing). Requires an equipped pickaxe. Applies to: (1) taking over another player's expired soil (`expireInSeconds <= 0`, typical L1-3 farm cycle scenario); (2) proactively clearing the player's own occupied non-empty soil. After successful eradication, soil returns to `empty`, usually followed immediately by `switch-weapon(hoe)` + `farm-hoe`.

**Parameters** (validator: `validateFarmEradicate`):

| flag | Required | Description |
|---|---|---|
| `--soil-id` | Yes | Target soil ID (integer, serialized as string) |

CLI-side validation: non-positive-integer `--soil-id` reports an error according to `parsePositiveInt` rules.

**Example**:

```bash
lumiterra farm-eradicate --soil-id 101
```

**Success response**:

```json
{
  "success": true,
  "data": {
    "soilId": "101",
    "status": "empty",
    "ownerId": null,
    "expireInSeconds": null,
    "position": {"x": 120, "y": 0, "z": -50}
  }
}
```

**Preconditions**:

- Already in the large-world farming scene
- Pickaxe is equipped (pickaxe, gather-specialization weapon)
- `soil.status != empty`
- If the target is occupied by another player, `expireInSeconds <= 0` is required

**Failure scenarios**:

| Scenario | errors | Handling |
|---|---|---|
| Missing `--soil-id` | `"Missing required parameter: --soil-id"` | Add the parameter |
| Character not loaded / dead / not in farming scene | Corresponding fixed message | Same as other farm-* commands |
| Soil not found or scene entity missing | `"Soil {id} not found"` / `"Scene entity for soil {id} not found"` | Refresh with `farm-query` |
| Pickaxe not equipped | `"No pickaxe equipped, cannot operate"` | `switch-weapon --weapon-type pickaxe` |
| Soil already empty | `"This soil is already empty; no need to eradicate"` | Run `farm-hoe` directly |
| Soil occupied by another player and not expired | `"This soil is occupied by another player; wait X seconds"` | Wait or switch target |
| Skill timeout | `"Eradicate operation timed out: no server response received"` | Retry |
| Server validation failed | `"Eradicate failed: {server error}"` | Diagnose according to server message |

**Notes**:

- Must use a pickaxe; a hoe does not automatically eradicate soil.
- Eradicate -> hoe -> water is a complete "take over expired soil" action chain. After obtaining expired soil, the agent should execute it serially in order and not insert unrelated queries.

---

## `farm-water`

**Purpose**: water soil, advancing it from `thirsty` to `growing`, and return the next operation time for the agent to plan waiting.

**Parameters** (validator: `validateFarmWater`):

| flag | Required | Description |
|---|---|---|
| `--soil-id` | Yes | Target soil ID (from `farm-query`, positive integer) |

CLI-side validation: non-positive-integer `--soil-id` reports an error according to `parsePositiveInt` rules.

**Example**:

```bash
lumiterra farm-water --soil-id 101
```

**Success response**:

```json
{
  "success": true,
  "data": {
    "soilId": 101,
    "status": "growing",
    "ownerId": 12345,
    "nextOpTime": 3600,
    "expireInSeconds": 7200,
    "plantedCid": 1001
  },
  "errors": null
}
```

**Key return fields**:

| Field | Meaning |
|---|---|
| `nextOpTime` | **Seconds until next watering** (core field; the agent must read it to decide serial/concurrent strategy) |
| `status` | Status after watering; normally `growing`; repeated watering eventually becomes `harvestable` |
| `expireInSeconds` | Seconds remaining before another player may eradicate it |

**Preconditions**:

- Character is loaded and alive
- Soil exists in the current view
- Distance to soil <= 0.5m
- `soil.ownerId == self`
- `soil.status == "thirsty"`
- Water bottle is equipped (`WeaponSubType.WaterBottle=8`, `switch-weapon --weapon-type water-bottle`)

**Failure scenarios**:

| Scenario | errors |
|---|---|
| Distance > 0.5m | `"Too far away (>0.5m), cannot water"` |
| `ownerId != self` | `"This soil does not belong to you; cannot water"` |
| `status != thirsty` | `"This soil is not thirsty; cannot water"` |
| Water bottle not equipped | `"No water bottle equipped, cannot water"` |
| Character dead | `"Character is dead"` |

**Notes**:

- **HARD RULE (concurrency window)**: when `nextOpTime <= 60s`, the agent **MUST serially** process one soil's complete lifecycle (hoe -> water -> grow -> water again -> ... -> harvest), finishing one plot before starting another. The server clears each "actionable state" after a 30s timeout; spreading many plots concurrently makes earlier plots clear before the agent rotates back, resetting progress.
- Small-batch concurrency is allowed only when `nextOpTime > 60s` and the agent confirms it can rotate through every soil's 30s window (usually <= 2-3 plots, and `farm-query` must be continuously monitored).
- `farm-water` is only a prerequisite for `farm-harvest`; it does not count farming exp by itself. For `Watering` task targets, "one progress" = one full planting cycle, not one watering action.

---

## `farm-harvest`

**Purpose**: harvest mature crops, returning soil to `empty` state. Drops are broadcast through `BroadCastDropGotInfoAction`; agents perceive them through backpack delta.

**Parameters** (validator: `validateFarmHarvest`):

| flag | Required | Description |
|---|---|---|
| `--soil-id` | Yes | Target soil ID (from `farm-query`, positive integer) |

CLI-side validation: non-positive-integer `--soil-id` reports an error according to `parsePositiveInt` rules.

**Example**:

```bash
lumiterra farm-harvest --soil-id 101
```

**Success response**:

```json
{
  "success": true,
  "data": {
    "soilId": 101,
    "status": "empty",
    "ownerId": null,
    "nextOpTime": null,
    "expireInSeconds": null,
    "plantedCid": null
  },
  "errors": null
}
```

**Preconditions**:

- Character is loaded and alive
- Soil exists in the current view
- Distance to soil <= 0.5m
- `soil.ownerId == self`
- `soil.status == "harvestable"`

**Failure scenarios**:

| Scenario | errors |
|---|---|
| Distance > 0.5m | `"Too far away (>0.5m), cannot harvest"` |
| `ownerId != self` | `"This soil does not belong to you; cannot harvest"` |
| `status != harvestable` | `"This soil is not mature, cannot harvest"` |
| Character dead | `"Character is dead"` |

**Notes**:

- No hard equipment requirement: any weapon or empty hands can harvest (unlike `farm-hoe`, which needs hoe, and `farm-water`, which needs water bottle).
- `harvestable` also has the 30s timeout clearing mechanism. After obtaining harvestable soil, run `farm-harvest` **immediately**; do not first query backpack/status or navigate.
- The main source of farming exp is `farm-harvest` (and `animal-pet`); `farm-hoe` / `farm-water` themselves do not count as farming exp.

---

## `farm-query`

**Purpose**: query farmland soil status. No parameters = full list.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--soil-id` | No | Single soil ID; mutually exclusive with `--cid` |
| `--cid` | No | Filter by seed CID; mutually exclusive with `--soil-id` |

**Example**: `lumiterra farm-query --soil-id 101`

**Note**: passing both `--soil-id` and `--cid` reports `--soil-id and --cid are mutually exclusive`.
