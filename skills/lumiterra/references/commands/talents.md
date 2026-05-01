# Talent commands — talents

> Command interface source of truth: the "Talent commands:" section in `src/parser/help.js` + `src/parser/validators/talents.js`
> Command list: `query-talent` / `talent-manage`

Talent commands query and upgrade the character talent trees (battle / farming / gather specializations).

---

## `query-talent`

**Purpose**: query talent tree / exp / unlocked skills (optionally only one specialization).

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--talent-type` | No | Return only the specified specialization: `battle`/`farming`/`gather` (aliases `combat`/`farm`/`gathering`) |

**Example**: `lumiterra query-talent --talent-type battle`

**Return fields**:

- `talents[]`: without `--talent-type`, returns all; when passed, contains only one entry. Each entry is `{type, name, level, treeLevel, exp, trunkMaxLayer, unlockedSkills, nodes[]}`
- `talents[].nodes[]`: `{nodeId, level, unlocked, isTrunk, layer, skillGains, canUpgrade, upgradeBlockedReason, canDowngrade, downgradeBlockedReason}` (`canDowngrade` only for trunk)

---

## `talent-manage`

**Purpose**: manage talent node upgrade/downgrade. **Note: the validator belongs to `talents.js`; help.js currently places this under a subgroup in "Pet commands:" due to section disorder, which Phase 2 will fix.**

**Parameters** (validator: `validateTalentManage`):

| flag | Required | Description |
|---|---|---|
| `--action` | Yes | `upgrade` or `downgrade` (**`downgrade` only for trunk**) |
| `--talent-type` | Yes | Talent type; only `battle` / `farming` / `gather` (`combat` -> `battle`, `farm` -> `farming`, `gathering` -> `gather` are aliases normalized by the validator) |
| `--node-id` | Yes | Node ID (from `nodes[].nodeId` returned by `query-talent`) |

CLI-side validation:

- Missing `--action` reports `"Missing required parameter: --action"`
- `--action` outside `upgrade/downgrade` reports `"--action only supports upgrade or downgrade"`
- Missing `--talent-type` reports `"Missing required parameter: --talent-type"`
- `--talent-type` outside `battle/farming/gather` (including aliases) reports `"--talent-type only supports battle/farming/gather"`
- Missing `--node-id` reports `"Missing required parameter: --node-id"`
- After validation, `talent-type` is normalized to a standard value (battle/farming/gather)

**Examples**:

```bash
# Upgrade a battle-specialization node
lumiterra talent-manage --action upgrade --talent-type battle --node-id 10101

# Alias combat is normalized to battle
lumiterra talent-manage --action upgrade --talent-type combat --node-id 10101

# Downgrade a trunk node (only trunk supports this)
lumiterra talent-manage --action downgrade --talent-type farming --node-id 20100
```

**Key return fields**: `action`, `talentType`, `nodeId`, `beforeLevel`, `newLevel`, `treeLevel`, `exp`, `node`

**Preconditions**:

- `upgrade`: target node satisfies prerequisite unlock conditions and the corresponding specialization has enough talent exp. If exp is insufficient, the CLI returns current `exp/required exp`.
- `downgrade`: target `node-id` must be the currently unlocked **outermost trunk node**. The lower layer actually "resets one outermost trunk layer by branch", not arbitrary node-by-node rollback.

**Failure scenarios**:

| Scenario | Handling |
|---|---|
| Insufficient talent exp | Fill exp according to `exp/required exp` in the response: prioritize same-specialization `daily/bounty` task chain (`quest-list` / `quest-accept` / `quest-submit`) or same-specialization `token-task` chain (`token-task-list` / `token-task-accept` / `token-task-submit`) |
| `downgrade` target is not trunk | Switch to the current branch's outermost trunk `node-id` and retry |
| Node prerequisites not unlocked | Unlock prerequisite nodes first (upgrade level by level along the tree path) |

**Notes**:

- **Natural exp sources** (see SKILL.md Game Essentials §3): `battle` mainly comes from `combat` monster combat; `gather` mainly comes from `gather` resource gathering; `farming` mainly comes from large-world `farm-harvest` crop harvest + `animal-pet` animal petting. `farm-hoe` / `farm-water` **do not count as farming exp**.
- **At energy 0, the above natural exp is not gained** (Game Essentials §3)
- **`revive --type respawn` deducts talent exp**, so prefer non-exp-loss options such as `revive --type free` (see `action.md` for details)
- Typical `downgrade` usage is resetting a misdirected build; a carefully planned build should not be downgraded lightly
