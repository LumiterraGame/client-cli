# Wild animal commands — animal

> Command interface source of truth: the "Wild animal commands:" section in `src/parser/help.js` + `src/parser/validators/animal.js`
> Command list: `animal-query` / `animal-pet`

Wild animal commands operate on loaded animal entities in the large world. Run `animal-query` first to get entityId, then operate on it. entityId is 64-bit, so **do not extract it with `jq`** (see SKILL.md "64-bit ID precision trap").

---

## `animal-query`

**Purpose**: query animal status. No parameters = full list.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--entity-id` | No | Single animal entity ID; mutually exclusive with `--cid` |
| `--cid` | No | Filter by animal species CID; mutually exclusive with `--entity-id` |

**Example**: `lumiterra animal-query --cid 3001`

**Note**: use with `animal-pet`: find an actionable `entityId` with `--cid`, then call `animal-pet --entity-id <entityId>`.

---

## `animal-pet`

**Purpose**: pet a world animal (about 10-30 seconds). If the target is unowned or expired, ownership is **first acquired**. After successful petting, the animal enters `producing` state, and output drops to the backpack through broadcast.

**Parameters** (validator: `validateAnimalPet`):

| flag | Required | Description |
|---|---|---|
| `--entity-id` | Yes | Animal entity ID (from `animals[].entityId` or a single `entityId` returned by `animal-query`; positive integer) |
| `--ignore-energy` | No | Force execution at energy 0; if omitted, energy 0 is rejected directly |

CLI-side validation:

- Non-positive-integer `--entity-id` reports an error according to `parsePositiveInt` rules
- `--ignore-energy` is a pass-through flag (the validator does not read it; help.js declares it)

> Warning: **`entityId` is 64-bit. Do not extract it with `jq -r '.xxx.entityId'`** (jq parses numbers as double by default and loses trailing digits). You must use `python3` or `grep -oE '"entityId":"[0-9]+"'` to obtain the original numeric string. See SKILL.md "64-bit ID precision trap".

**Examples**:

```bash
lumiterra animal-pet --entity-id 5001
lumiterra animal-pet --entity-id 5001 --ignore-energy
```

**Success response**:

```json
{
  "success": true,
  "data": {
    "entityId": 5001,
    "animalCid": 1001,
    "status": "producing",
    "ownerId": 12345,
    "expireInSeconds": 7200,
    "productionTimeRemaining": 3600,
    "requiredHappiness": 50
  },
  "errors": null
}
```

**Preconditions**:

- Character is loaded and alive
- Animal exists in the current view
- Distance to the animal <= 0.5m
- **Actionable condition (one of three)**: `ownerId == null` / `ownerId == self` / (`expireInSeconds <= 0` && `ownerId != null`)
- Brush is equipped (`WeaponSubType.Brush=9`, `switch-weapon --weapon-type brush`)
- `brush.PetHappinessCapacity >= animal.requiredHappiness`
- Account happiness remain >= `animal.requiredHappiness`

**Failure scenarios**:

| Scenario | errors | Handling |
|---|---|---|
| Distance > 0.5m | `"Too far away (>0.5m), cannot pet"` | Navigate closer |
| `ownerId != null && ownerId != self && expireInSeconds > 0` | `"This animal belongs to another player; wait X seconds"` | Wait or choose another animal |
| Brush not equipped | `"No brush equipped, cannot pet"` | `switch-weapon --weapon-type brush` |
| Brush capacity insufficient | `"Brush happiness capacity insufficient (need X, have Y)"` | Switch to a better brush |
| Account happiness insufficient | `"Account happiness insufficient (need X, remaining Y)"` | Switch gear to raise account happiness |
| Energy 0 and `--ignore-energy` not passed | Energy-insufficient error | Restore energy or add `--ignore-energy` (but energy 0 gives no output, usually not recommended) |
| Character dead | `"Character is dead"` | Retry after `revive` |

**Notes**:

- **Use world-animal directly**: wild `world-animal` (`query-near-entities --type world-animal` / `animal-query`) can be petted directly and is **not limited to** daily quest targets. When the user plainly says "pet X", follow the on-demand workflow; do not autonomously accept a `PetAppease` quest or switch to `capture-pet` (that captures a pet and is a different workflow).
- **HARD RULE (30s operation window)**: the server's large-world farmland/animal player-operation window is about 30 seconds. After timeout, it resets to empty state. After `animal-query` returns an actionable `entityId`, run `animal-pet` **immediately**. Do not insert unrelated `query-inventory` / `query-status` / long thinking or navigate.
- **Energy HARD RULE**: similar to `farm-hoe`, `--ignore-energy` can force execution at energy 0 but gives no output; restore energy first.
- Drops from `animal-pet`, like `farm-harvest`, arrive through broadcast. Agents perceive them through backpack delta. For `animal_pet` sources in `query-item-sources`, `sourceId=animalCid`; first run `animal-query --cid <animalCid>` to get `entityId`, then `animal-pet`.
