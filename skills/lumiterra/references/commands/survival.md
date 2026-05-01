# Survival and energy commands — survival

> Command interface source of truth: the "Survival and energy commands:" section in `src/parser/help.js` + `src/parser/validators/survival.js`
> Command list: `use-item` / `revive` / `energy-manage`

Survival and energy commands cover three required action types: **item use** (`use-item`, HP recovery / energy recovery / effect potions), **death revive** (`revive`, revive in place or return to town), and **energy operations** (`energy-manage`, purchase / borrow / repay). All commands return JSON; failures return `{ "success": false, "errors": [...] }`.

> **HARD RULE (asset/currency respect; see SKILL.md Game Essentials §1-4)**:
> - `use-item` is a consumptive action and must **not** be proactively used without explicit user authorization (especially "use HP potions to heal" is forbidden by default; at low HP, first `escape-combat` and naturally recover after disengaging)
> - `energy-manage --action buy|borrow` consumes LuaUSD / introduces interest-bearing debt, so it is **not executed by default**; first run `query-inventory --type food` to find existing energy potions and recover with `use-item`, then ask the user only if none exist
> - Borrowing carries interest. While in debt, the character enters `trial mode` and some operations are locked

---

## `use-item`

**Purpose**: use consumable items in the backpack (HP potion / energy potion / food / effect potion, etc.).

**Parameters** (validator: `validateUseItem`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--item-instance-id` | Yes | - | Backpack item instance ID (from `items[].itemInstanceId` returned by `query-inventory`). May be replaced by `--item-cid`; when both are passed, this parameter takes priority |
| `--item-cid` | No | - | Item config ID. Required when `--item-instance-id` is not passed. Uses the first matching CID item from the backpack |
| `--count` | No | 1 | Use count, positive integer |

CLI-side validation (`validators/survival.js`):

- Missing both `--item-instance-id` and `--item-cid` reports `"Missing required parameter: --item-instance-id or --item-cid"`
- Non-positive-integer `--item-cid` reports an error according to `parsePositiveInt` rules
- Non-integer `--count` or `< 1` immediately reports `"--count must be greater than 0"`
- After validation, `count` is converted to a string before being sent

**Examples**:

```bash
lumiterra use-item --item-instance-id 30001
lumiterra use-item --item-instance-id 30001 --count 3
lumiterra use-item --item-cid 10023
```

**Return fields**:

- `used`: actual used count
- `remaining`: remaining backpack count after use
- Key character status before/after use (HP / energy) and backpack delta

**Notes**:

- **HARD RULE**: do **not** call consumptive `use-item` without explicit user authorization. All backpack items are player assets (Game Essentials §1).
- **Do not use HP potions by default at HP < 40%**: the HARD RULE requires first `escape-combat` -> move away -> wait for natural recovery -> use `back-to-town`/`revive` if needed. Only when the user explicitly authorizes "HP potions are allowed" may the agent use `use-item` for healing (Game Essentials §9).
- First run `query-inventory --type food` or filter by `--item-cid` to find the target item's `itemInstanceId`, then pass it to `--item-instance-id`.
- `energy-manage` `buy`/`borrow` produces energy potion **items**. To actually recover energy, they must be consumed afterward with `use-item`.

---

## `revive`

**Purpose**: revive after character death. Supports two paths: revive in place (`respawn`) and revive in town (`town`).

**Parameters** (validator: `validateRevive`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--type` | Yes | - | Revive method; only supports `respawn` or `town` |

CLI-side validation:

- Missing `--type` immediately reports `"Missing required parameter: --type"`
- Non-`respawn`/`town` `--type` immediately reports `"--type only supports respawn or town"`

**Examples**:

```bash
lumiterra revive --type respawn
lumiterra revive --type town
```

**Return fields**:

- `type`: revive method used this time
- `position`: coordinates after revive
- HP recovery summary

**Notes**:
- `respawn` (revive in place): fast, but has **cooldown** and **deducts talent exp** (see Game Essentials / talent-manage note: `revive --type respawn` deducts talent exp)
- `town` (revive in town): no talent-exp deduction and no cooldown, but sends the character back to town, so the agent **must run back to the original location**
- When long loops (such as combat/gathering) encounter `endReason=player_dead`: exit the inner loop -> `revive` -> replan from step 1. Do not directly continue after death.
- Revive choice depends on the current scene (dungeon, PvP zone, etc.). Usually read `query-status` first to confirm death state.

---

## `energy-manage`

**Purpose**: energy operations: purchase energy potions, borrow energy potions, repay borrowing debt. It **does not restore energy directly**; it only generates/settles energy potion items or debt.

**Parameters** (validator: `validateEnergyManage`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--action` | Yes | - | Action type; only supports `buy` / `borrow` / `repay` |
| `--count` | Conditionally required | - | **Required** and positive integer for `buy` / `borrow`; **not accepted** for `repay` |

CLI-side validation:

- Missing `--action` immediately reports `"Missing required parameter: --action"`
- `--action` outside the three options immediately reports `"--action only supports buy, borrow, or repay"`
- Passing `--count` under `repay` immediately reports `"repay does not accept --count"`
- Non-integer `--count` or `< 1` under `buy` / `borrow` immediately reports `"--count must be greater than 0 for buy/borrow"`
- After validation, `count` is converted to a string before being sent

**Examples**:

```bash
lumiterra energy-manage --action buy --count 3
lumiterra energy-manage --action borrow --count 2
lumiterra energy-manage --action repay
```

**Return fields**:

- `energy`: current energy value
- `debt`: current debt
- `needRepay`: total amount required for repayment (interest included)
- `canBorrow`: server-issued borrowing eligibility

**Action descriptions** (confirmed from client code):

- `buy`: spend LuaUSD to buy energy potion items (corresponds to `UserEnergyDealBuy`), producing the corresponding item count according to `--count`
- `borrow`: borrow energy potion items (corresponds to `UserEnergyDealBorrow`), producing the corresponding item count according to `--count` and creating interest-bearing debt
- `repay`: settle **all** debt at the current `needRepay` amount in one payment (corresponds to `UserEnergyRepay`); partial repayment is not supported

**Notes**:

- **HARD RULE (currency caution)**: `energy-manage --action buy|borrow` is **not executed by default** and requires explicit user authorization (Game Essentials §2/§4). First prioritize `query-inventory --type food` to find energy potions in the backpack -> recover with `use-item`.
- **buy/borrow does not directly restore energy**: they only generate energy potion **items**. To actually recover energy, the agent must then consume the item with `use-item --item-instance-id <energyPotionId>`.
- Borrowing eligibility is controlled by server `canBorrow`; after purchasing energy, the character usually enters purchase-only state, and when `canBorrow=false`, the client directly forbids borrowing.
- **Cannot buy energy while in debt**: `EnergyModule.CheckCanOperate()` validates this first, so the debt must be cleared with `repay` before buying again.
- `repay` settles the full `needRepay` amount in one payment (interest included); partial repayment by `--count` is not supported.
- While in debt, the character enters `trial mode`, and some operations are locked.
