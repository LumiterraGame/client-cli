# Action commands — action

> Command interface source of truth: the "Action commands:" section in `src/parser/help.js` + `src/parser/validators/action.js`
> Command list: `navigate` / `auto-combat` / `escape-combat` / `auto-gather` / `fish` / `set-skill-shortcut` / `set-capture-prop` / `stop` / `back-to-town`

Action commands cover player movement, combat, gathering, fishing, skill/item mounting, long-command interruption, and hard disengage. Most commands are long-running and can be cleanly cancelled by `stop` within 2 seconds. All commands return JSON; failures return `{ "success": false, "errors": [...] }`.

All automated commands that consume energy (`auto-combat` / `auto-gather`) **refuse execution by default** when energy is 0. Passing `--ignore-energy` can force execution (reference commit `0342d31 docs(help): surface --ignore-energy flag for auto-action commands`).

---

## `navigate`

**Purpose**: automatically pathfind to three-dimensional coordinates.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--x` | Yes | Target X coordinate |
| `--y` | Yes | Target Y coordinate |
| `--z` | Yes | Target Z coordinate |

**Example**:

```bash
lumiterra navigate --x 248.5 --y 0.0 --z 179.2
```

**Return fields**:

- `arrived`: whether the target was reached
- `target`: target coordinates
- `position`: final position
- `distance`: remaining distance

**Notes**:

- Preconditions: character is not dead and not inside a dungeon
- This is a long-running command and can be interrupted by `stop`

---

## `auto-combat`

**Purpose**: search for and kill monsters of the specified CID. By default, returns after killing 1 monster; the agent drives the outer decision loop.

**Parameters**:

| flag | Required | Default | Description |
|---|---|---|---|
| `--target` | Yes | - | Monster CID |
| `--count` | No | 1 | Target kill count, range `1-5` (validator: `validateAutoCombat`) |
| `--timeout` | No | `count × 60` | Timeout seconds |
| `--search-mode` | No | `patrol` | Strategy when no monster is found: `wait` (wait in place) / `patrol` (patrol) |
| `--patrol-radius` | No | 10 | Patrol radius (grid units), only effective in `patrol` mode |
| `--ignore-energy` | No | false | Force execution at energy 0; if omitted, energy 0 is rejected directly |

CLI-side validation: `--count` outside range `1-5` immediately reports `"--count range is 1-5"`.

**Examples**:

```bash
lumiterra auto-combat --target 2001
lumiterra auto-combat --target 2001 --count 3 --timeout 180
lumiterra auto-combat --target 2001 --search-mode wait --ignore-energy
```

**Return fields**:

| Field | Description |
|---|---|
| `killCount` | Actual kill count |
| `targetCount` | Target kill count |
| `elapsed` | Elapsed time (seconds) |
| `endReason` | End reason |

**`endReason` enum**: `count_reached` (target reached) / `timeout` (timed out) / `player_dead` (character dead) / `cancelled` (interrupted by `stop`).

**Return example**:

```json
{
  "success": true,
  "data": {
    "killCount": 1,
    "targetCount": 1,
    "elapsed": 12.3,
    "endReason": "count_reached"
  }
}
```

**Notes**:

- Preconditions: character is not dead
- This is a long-running command and can be interrupted by `stop`
- If energy is 0 and `--ignore-energy` is not passed, execution is rejected before the command starts

---

## `escape-combat`

**Purpose**: disengage from combat. After stopping the current long command, it continuously moves toward the **least threatening reachable** direction until the main character's `IsInBattle=false` remains stable for a period. This is a **soft disengage** command and does not call hard disengage tools such as `back-to-town` or `totem-teleport`.

**Parameters**:

| flag | Required | Default | Description |
|---|---|---|---|
| `--timeout` | No | 20 | Maximum disengage duration (seconds), range `5-60` (validator: `validateEscapeCombat`) |

**Examples**:

```bash
lumiterra escape-combat
lumiterra escape-combat --timeout 30
```

**Return fields**:

`reason`, `elapsedSeconds`, `distanceMoved`, `initialInBattle`, `finalInBattle`, `stoppedCommands`, `drained`, `plans`, `threatCount`, `pursuerCount`, `initialPosition`, `finalPosition`, `initialArea`, `finalArea`, `lastTarget`.

**Notes**:

- Success is judged by the **main character's own combat state**: returns success after the main character's `IsInBattle=false` stays stable for the required window.
- It samples nearby monsters as threats and combines combat areas (`DRBattleArea` / scene `BattleAreaConfig`) to weight candidate landing points; it usually biases toward safer directions with fewer monsters.
- `monster.isInBattle` is only a weak threat signal and is not directly treated as "this monster is aggroed on you". Monsters truly chasing you are mainly identified by whether relative distance keeps shrinking.

---

## `auto-gather`

**Purpose**: automatically gather resources of the specified CID. Mechanism is similar to `auto-combat` (search -> approach -> attack -> drops).

**Parameters**:

| flag | Required | Default | Description |
|---|---|---|---|
| `--target` | Yes | - | Gatherable CID (validator requires it) |
| `--count` | No | 1 | Target gather count, range `1-5` (validator: `validateAutoGather`) |
| `--timeout` | No | `count × 60` | Timeout seconds |
| `--search-mode` | No | `patrol` | Strategy when no resource is found: `wait` / `patrol` |
| `--patrol-radius` | No | 10 | Patrol radius (grid units) |
| `--ignore-energy` | No | false | Force execution at energy 0; if omitted, energy 0 is rejected directly |

CLI-side validation:
- Missing `--target` immediately reports `"Missing required parameter: --target"`
- `--count` outside range `1-5` immediately reports `"--count range is 1-5"`

**Examples**:

```bash
lumiterra auto-gather --target 5001
lumiterra auto-gather --target 5001 --count 5 --timeout 300
lumiterra auto-gather --target 5001 --ignore-energy
```

**Return fields**:

| Field | Description |
|---|---|
| `gatherCount` | Actual gather count |
| `targetCount` | Target gather count |
| `elapsed` | Elapsed time (seconds) |
| `endReason` | End reason (same shape as `auto-combat`) |

**Notes**:

- Requires an independent `ResourceSearcher` (`EntityType.Resource=5`) and does not reuse `MonsterSearcher`. Search uses `Physics.SphereCast` + the `HOME_RESOURCE` layer.
- This is a long-running command and can be interrupted by `stop`
- If energy is 0 and `--ignore-energy` is not passed, execution is rejected before the command starts

---

## `fish`

**Purpose**: single fishing command (long-running, about 60 seconds per attempt). Automatically completes cast -> wait for bite -> pull rod -> QTE -> harvest.

**Parameters**:

| flag | Required | Default | Description |
|---|---|---|---|
| `--target` | Yes | - | Target fish CID |
| `--timeout` | No | 90 | Maximum duration of the whole command (seconds), range `30-300` |

**Examples**:

```bash
lumiterra fish --target 1095
lumiterra fish --target 1095 --timeout 120
```

**Pre-checks**:

- Character is alive and not in a dungeon
- A `FishingRod` compatible with the target fish is equipped (use `switch-weapon --weapon-type fishing-rod --target-fish-cid <fishCid>` to switch automatically)
- The character stands in a fishing area containing the target fish cid (`worldFishing=6`), and distance to water edge is <= 10m (maximum rod casting distance)

**Return fields (success)**:

| Field | Description |
|---|---|
| `stage` | Stage when the command ended (`finish` / `cast` / `wait_bite` / `pull_rod` / `qte`) |
| `endReason` | End reason; success is `completed` |
| `fishCid` | Caught fish CID |
| `fishName` | Fish name |
| `qteCount` | Total QTE count |
| `qteGood` | Good count (about 70%) |
| `qteBad` | Bad count (about 30%) |
| `elapsed` | Elapsed time (seconds) |

**`data.endReason` on failure**: `failed` / `timeout` / `cancelled` / `player_dead`.

**`data.failReason` on failure (fine-grained)**:

| `failReason` | Meaning |
|---|---|
| `out_of_range` | Distance to water edge is greater than maximum cast distance (10m) |
| `no_fishing_area` | No fishing area nearby |
| `no_fishing_area_for_cid` | No nearby water area contains this fish species CID |
| `no_bait` | No bait in backpack |
| `rod_not_match` | Current fishing rod does not support the target fish |
| `wait_bite_timeout` | No bite within 45s |
| `pull_rod_timeout` | Pull-rod timeout |
| `fish_escaped` | QTE failed and fish escaped |
| `cast_miss` | Cast landing point invalid |
| `battle_timeout` | Total 30s QTE timeout |
| `server_error` | Server exception |

**Return example (success)**:

```json
{
  "success": true,
  "data": {
    "stage": "finish",
    "endReason": "completed",
    "fishCid": 1095,
    "fishName": "Channel catfish",
    "qteCount": 3,
    "qteGood": 2,
    "qteBad": 1,
    "elapsed": 58.3
  }
}
```

**Notes**:

- This is a long-running command (`IsLongRunning=true`) and can be cleanly cancelled by `stop` within 2 seconds (automatically sends `Exit` to leave fishing state)
- QTE randomly produces 70% Good / 30% Bad and is not always Perfect, following the "automation should be worse than a human" principle
- Does not consume energy; consumes bait (server automatically chooses bait)
- For complete `failReason` handling advice, see the corresponding section in `workflows.md`

---

## `set-skill-shortcut`

**Purpose**: place any learned skill into the specified weapon-group shortcut slot.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--skill-id` | Yes | Target skill ID |
| `--slot` | Yes | Target slot, supports `1-3` |
| `--weapon-type` | No | Target weapon group: `default`/`sword`/`hammer`/`bow`/`sickle`/`axe`/`pickaxe`/`hoe`/`water-bottle`/`brush`; when omitted, modifies the currently active weapon group |

**Examples**:

```bash
lumiterra set-skill-shortcut --skill-id 9001 --slot 1
lumiterra set-skill-shortcut --skill-id 9001 --slot 2 --weapon-type sword
```

**Return fields**: `skillId`, `skillName`, `slot`, `weaponType`, `shortcutSlots[]`.

**Notes**:

- Generic skill shortcut command; not only for `Capture`
- `--weapon-type` explicitly edits a weapon group; when omitted, it writes according to the current weapon group
- `default` means the default group, corresponding to the common weapon group in UI
- Validates whether the current character owns the skill; fails directly if unlearned/locked
- When `--weapon-type` points to a specific weapon group, validates whether the skill is compatible with that weapon type; incompatible skills are rejected

---

## `set-capture-prop`

**Purpose**: mount a capture item on the `Capture` skill.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--item-instance-id` | Yes | Item instance ID to mount on the `Capture` skill |
| `--target` | No | Target animal CID; when passed, additionally estimates whether this item is enough to capture that monster after mounting |

**Examples**:

```bash
lumiterra set-capture-prop --item-instance-id 20001
lumiterra set-capture-prop --item-instance-id 20001 --target 3001
```

**Return fields**: same as `query-capture-setup`, plus `capturePropItemInstanceId`.

**Notes**:

- Currently only the `Capture` skill needs a mounted item, so this command is kept separately
- Validates whether the item type satisfies `Capture` skill requirements
- If the goal is to prepare capture for a specific target, pass `--target`; it first validates whether the current quantity is enough before mounting, fails directly if insufficient, and does not modify mount state
- Insufficient quantity failure reuses the structured blocker fields from `query-capture-setup`, with `blockerCode=mounted_prop_insufficient`
- When `--target` is passed, returns the candidate item's estimated result for that target and calculates preference bonus from the monster config's preferred item list

---

## `stop`

**Purpose**: stop the currently executing long-running command (`auto-combat`, `auto-gather`, `navigate`, `fish`, etc.).

**Parameters**: none.

**Example**:

```bash
lumiterra stop
```

**Return fields**:

| Field | Description |
|---|---|
| `stoppedCommand` | Name of the stopped command; `null` when no command is running |

**Notes**:

- All long-running commands (`auto-combat` / `auto-gather` / `navigate` / `fish` / `team-invite`, etc.) support `stop`, usually completing interruption within 2 seconds
- Interrupted long-running commands return `endReason` as `cancelled`

---

## `back-to-town`

**Purpose**: return the character to town (used when the character is stuck or needs hard disengage).

**Parameters**: none.

**Example**:

```bash
lumiterra back-to-town
```

**Notes**:

- This is a hard disengage tool; `escape-combat` **does not** call it automatically. Use it only when the agent explicitly determines hard retreat is needed.
- Common uses: character stuck / fallen into map seam / surrounded and unable to disengage, etc.
