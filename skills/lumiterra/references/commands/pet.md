# Pet commands — pet

> Command interface source of truth: the "Pet commands:" section in `src/parser/help.js` + `src/parser/validators/pet.js`
> Command list: `query-pets` / `query-capture-setup` / `pet-summon` / `pet-feed` / `make-pet-egg` / `hatch-pet` / `claim-pet` / `pet-wash` / `capture-pet`

Pet commands cover the full pet lifecycle: query (`query-pets` / `query-capture-setup`), summon/follow (`pet-summon`), feed (`pet-feed`), convert to egg (`make-pet-egg` -> `hatch-pet` -> `claim-pet`, three-step hatching), wash (`pet-wash`), and capture wild animals as pets (`capture-pet`). All commands return JSON; failures return `{ "success": false, "errors": [...] }`.

> **HARD RULE (asset respect; see SKILL.md Game Essentials §1-4)**:
> - `make-pet-egg` **destroys the current pet instance** and converts it into a pet egg; it must not be proactively executed without explicit user authorization
> - `capture-pet` consumes the mounted capture item (rope / trap) and may fail; before execution, `query-capture-setup --target <petCid>` must confirm enough items
> - `pet-wash` resets pet talents/attributes, consumes material items, and **cannot be rolled back**; treat it as a sensitive operation by default
> - Pets and players share the same backpack equipment pool; pet-related commands (including feeding/washing) must not proactively unequip current player gear

---

## `query-pets`

**Purpose**: query pet list, attributes, follow status, and hunger.

**Parameters**: none.

**Example**: `lumiterra query-pets`

**Return fields**:

- `pets[]`: `{petId, cid, name, followStatus, hunger, maxHunger, level, abilities, attributes}`
- `followingPetId`, `maxPetLimit`, `remainingPetSlots`

---

## `query-capture-setup`

**Purpose**: query preconditions for the `Capture` skill; used as structured pre-check before `capture-pet`.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--target` | No | Target animal CID; when passed, additionally estimates whether the currently mounted item is enough to catch that monster |

**Example**: `lumiterra query-capture-setup --target 3001`

**Return fields**:

- `ready`, `blockerCode`, `blockerMessage`
- `targetCid`, `requirementDerivedFromTarget`, `requiredPropCount`
- `favoriteItemCids`, `mountedPropIsFavoriteItem`
- `captureSkillLearned`, `currentWeaponType`, `requiredWeaponTypes`, `captureInShortcut`, `shortcutSlots[]`
- `mountedPropItemInstanceId`, `mountedPropItemCid`, `mountedPropCount`, `mountedPropEnough`
- `petCount`, `maxPetLimit`, `remainingPetSlots`

**`blockerCode` enum**: `skill_not_learned` / `weapon_unsupported` / `shortcut_missing` / `mounted_prop_missing` / `mounted_prop_insufficient`.

**Notes**:

- Without `--target`, it only performs basic config checks (skill / weapon / shortcut / mounted item / mounted count > 0 / pet capacity)
- Before catching monsters, **always pass `--target` when possible**; it estimates `requiredPropCount` with the server formula and accounts for favorite-item bonus

---

## `pet-summon`

**Purpose**: summon the specified pet to follow, or dismiss the current follower. Only one pet can follow at a time.

**Parameters** (validator: `validatePetSummon`):

| flag | Required | Description |
|---|---|---|
| `--pet-id` | Yes | Pet ID (from `pets[].petId` returned by `query-pets`) |
| `--action` | Yes | `follow` or `dismiss` |

CLI-side validation:

- Missing `--pet-id` reports `"Missing required parameter: --pet-id"`
- Missing `--action` reports `"Missing required parameter: --action"`
- `--action` outside `follow/dismiss` reports `"--action only supports follow or dismiss"`

**Examples**:

```bash
# Summon pet to follow
lumiterra pet-summon --pet-id 50012 --action follow

# Dismiss follower
lumiterra pet-summon --pet-id 50012 --action dismiss
```

**Key return fields**: `petId`, `action`

**Preconditions**:

- Character is loaded and alive
- `--pet-id` belongs to the current account's pet list (`query-pets`)

**Notes**:

- Current following pet can be identified by `followingPetId` from `query-pets`
- `pet-feed` only supports feeding the currently following pet (see `pet-feed` section)

---

## `pet-feed`

**Purpose**: feed the currently following pet. Current version **does not accept** `--food-id`; it automatically chooses the first available food.

**Parameters** (validator: `validatePetFeed`):

| flag | Required | Description |
|---|---|---|
| `--pet-id` | Yes | Pet ID (must be the currently following pet) |

CLI-side validation:

- Missing `--pet-id` reports `"Missing required parameter: --pet-id"`
- Explicitly passing `--food-id` directly reports `"Current pet-feed does not accept --food-id"` (validator forcibly rejects it and does not silently ignore)

**Example**:

```bash
lumiterra pet-feed --pet-id 50012
```

**Key return fields**: `petId`, `foodItemInstanceId`, `foodItemCid`, `foodName`, `remainingFood`, `before`, `after`

**Preconditions**:

- Target pet is the currently following pet (first run `pet-summon --action follow`)
- Backpack contains at least one usable food item

**Failure scenarios**:

| Scenario | Handling |
|---|---|
| Passed `--food-id` | Remove the parameter and let the CLI auto-select food |
| Target pet is not following | First run `pet-summon --pet-id <id> --action follow` |
| Backpack has no usable food | Follow `Workflow: Get Item` to obtain the corresponding food |

**Notes**:

- Auto-food-selection logic: "first available food" is decided by the CLI; agents do not need to and cannot intervene.
- Feeding is mainly used to raise pet hunger / gain attribute buffs; exact `before` / `after` field semantics are returned by the server.

---

## `make-pet-egg`

**Purpose**: convert an **owned** pet into a pet egg (consumes the pet instance and generates one egg item). After successful creation, call `hatch-pet` separately to enter the hatching flow.

**Parameters** (validator: `validateMakePetEgg`):

| flag | Required | Description |
|---|---|---|
| `--pet-id` | Yes | Pet ID (from `pets[].petId` returned by `query-pets`) |

CLI-side validation: missing `--pet-id` reports `"Missing required parameter: --pet-id"`.

**Example**:

```bash
lumiterra make-pet-egg --pet-id 50012
```

**Key return fields**: `petId`, `removedFromPetList`, `createdEgg`

- `createdEgg` returns only when the new egg can be clearly identified after backpack refresh; structure includes `eggItemInstanceId`, `eggItemCid`, `name`, `petCid`, `abilities`

**Preconditions**:

- `--pet-id` belongs to the current account's pet list
- Pet is currently **not following** (if needed, first run `pet-summon --action dismiss`)

**Notes**:

- **HARD RULE**: `make-pet-egg` **destroys the original pet instance**; do not proactively execute without explicit user authorization.
- The command does not automatically continue to hatch. After obtaining `createdEgg.eggItemInstanceId`, explicitly call `hatch-pet`.
- If backpack refresh latency prevents identifying `createdEgg`, the agent should locate the new egg through before/after `query-inventory` delta.

---

## `hatch-pet`

**Purpose**: start hatching a pet egg, wait for hatching completion, then **auto-claim**.

**Parameters** (validator: `validateHatchPet`):

| flag | Required | Description |
|---|---|---|
| `--egg-item-instance-id` | Yes | Pet egg item instance ID (from `createdEgg.eggItemInstanceId` returned by `make-pet-egg`, or from `query-inventory`) |

CLI-side validation: missing `--egg-item-instance-id` reports `"Missing required parameter: --egg-item-instance-id"`.

**Example**:

```bash
lumiterra hatch-pet --egg-item-instance-id 800145
```

**Key return fields**: `egg`, `materials`, `hatching`, `received`, `beforePetCount`, `afterPetCount`, `newPet`

- `materials` lists each hatching material's `need/have/enough`
- On normal completion, `received=true`
- `newPet` tries to return full pet details; if detail query fails, it degrades to basic information

**Preconditions**:

- Only one pet egg can be hatching at the same time. If the hatch slot is occupied, the command fails directly and returns current hatching data.
- Required hatching materials are sufficient (CLI pre-checks `materials[].enough`)

**Failure scenarios**:

| Scenario | Handling |
|---|---|
| Hatch slot occupied | Inspect the `hatching` field in the response; first run `claim-pet` to claim a completed egg, or wait for the existing egg to finish |
| Materials insufficient | Fill shortages according to `materials[].need/have`, then retry |

**Notes**:

- The command first starts hatching, then waits until near `endAt` before querying confirmation; **normally it does not poll every second**.
- After hatching completes, it auto-claims. `received=true` means already claimed; no separate `claim-pet` is needed.
- `claim-pet` is mainly a manual fallback / recovery command.

---

## `claim-pet`

**Purpose**: manually claim the completed pet in the **current hatch slot**. Usually `hatch-pet` auto-claims; `claim-pet` is a backup path.

**Parameters** (validator: `validateClaimPet`): none; **explicitly passing any parameter directly reports** `"claim-pet does not accept parameters"`.

**Example**:

```bash
lumiterra claim-pet
```

**Key return fields**: `received`, `newPet`, `hatching`

**Preconditions**:

- The current hatch slot contains a completed pet egg (there is only one global hatching egg, including "hatched but not yet claimed" state)

**Notes**:

- Because the hatch slot is globally unique, no egg ID is needed when claiming.
- Prefer `hatch-pet` for the closed loop "start hatching -> wait for completion -> auto-claim"; use `claim-pet` only when auto-claim fails or manual recovery is needed.

---

## `pet-wash`

**Purpose**: wash pet attributes (reset and rerandomize / optimize attributes, consuming specified materials).

**Parameters** (validator: `validatePetWash`):

| flag | Required | Description |
|---|---|---|
| `--pet-id` | Yes | Pet ID |

CLI-side validation: missing `--pet-id` reports `"Missing required parameter: --pet-id"`.

**Example**:

```bash
lumiterra pet-wash --pet-id 50012
```

**Key return fields**: `petId`, `material`, `before`, `after`

- `material` returns the consumed item's `itemCid/name/need/have/enough` for this wash

**Preconditions**:

- `--pet-id` belongs to the current account's pet list
- Backpack contains enough wash material (`material.enough=true`)

**Notes**:

- **HARD RULE**: washing resets pet attributes and **cannot be rolled back**; do not proactively execute without explicit user authorization.
- `before` / `after` are used to compare attribute changes. The agent should explicitly tell the user the result changes from the response.

---

## `capture-pet`

> **`capture-pet --target` semantics**: `--target` accepts an **animal CID** (cataloging ID / config ID), not `--entity-id`. The CLI automatically finds the "nearest same-CID capturable target" in current view. This is the key difference between `capture-pet` and `animal-pet` (which accepts `--entity-id`).

**Purpose**: capture a world animal of the specified CID (rope/trap Capture FSM). On success, may return a new pet ID. On failure, returns `endReason` and, when identifiable, `failReason`.

**Parameters** (validator: `validateCapturePet`):

| flag | Required | Description |
|---|---|---|
| `--target` | Yes | Animal CID (**not entity-id**, positive integer) |

CLI-side validation:

- Missing / empty `--target` reports `"Missing required parameter: --target"`
- Non-positive-integer `--target` reports according to `parsePositiveInt` rules

**Example**:

```bash
# Capture wild animal with CID=1001
lumiterra capture-pet --target 1001
```

**Key return fields**: `captured`, `targetCid`, `targetEntityId`, `endReason`, optional `petId`, optional `failReason`; when preconditions are not satisfied, returns the same structured blocker data as `query-capture-setup --target <cid>`.

**Preconditions** (the CLI hard-validates before casting; if any are not satisfied, it fails directly and includes `query-capture-setup`-style structured blocker data in the response):

1. `Capture` skill is **learned** (locate with `query-talent` and upgrade with `talent-manage --action upgrade`)
2. Current **weapon supports** `Capture` (use `switch-weapon` to switch to a capture-capable weapon)
3. `Capture` is equipped in the current **skill shortcut bar** (`set-skill-shortcut --skill-id <captureSkillId> --slot <1|2|3>`)
4. A **legal capture item is mounted** (`set-capture-prop --item-instance-id <itemInstanceId> --target <petCid>`)
5. **Currently mounted item quantity is enough** to catch the target (estimated by scene-server capture formula + monster favorite-item bonus)
6. **Pet capacity is not full** (`remainingPetSlots > 0` from `query-pets`)

**Failure scenarios**:

| Scenario | Handling |
|---|---|
| Any precondition 1-6 is not satisfied | Read the structured blocker in the response and fill it as needed (see the blocker recovery section in SKILL.md "Workflow: CatchPet"); retry after fixing |
| Failure after entering lock phase | Returns `endReason` + (when identifiable) `failReason`; diagnose according to `failReason` (insufficient item / target left range, etc.) |
| `petId` missing but `captured=true` | Synchronization timing issue; locate the new pet by before/after `query-pets` diff |

**Notes**:

- **Recommended workflow order** (see SKILL.md `Workflow: CatchPet`):
  1. `query-pets` to record current pet list (diff baseline)
  2. `query-capture-setup --target <petCid>` to inspect blocker
  3. Fix blockers one by one (`talent-manage` / `switch-weapon` / `set-skill-shortcut` / `set-capture-prop` / `equip`)
  4. Loop `capture-pet --target <petCid>` until `captured=true`
  5. If `petId` is not returned, use `query-pets` diff to get the new `petId`
- **`--target` is CID, not entity-id**: this is the most common confusion point. `animal-pet` uses `--entity-id`; `capture-pet` uses `--target <cid>`.
- **`capture-pet` and `animal-pet` are different workflows**: the former "captures a wild animal as a pet", while the latter "pets a world animal for production loop". When the user plainly says "pet X", use `animal-pet`; when the user says "capture X" or receives a `CaptureTargetPet` task target, use `capture-pet`.
- **Item consumption**: every `capture-pet` attempt consumes the mounted capture item. The agent should let the CLI estimate whether items are enough during `set-capture-prop --target <petCid>`, rather than blindly retrying.
