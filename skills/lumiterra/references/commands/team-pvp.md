# Team / escort / PvP commands — team-pvp

> Command interface source of truth: the "Team commands:" / "Escort commands:" / "PvP commands:" sections in `src/parser/help.js` + `src/parser/validators/team-pvp.js`
> Command list (team): `team-create` / `team-disband` / `team-leave` / `team-invite` / `team-reply` / `team-query`
> Command list (escort): `escort-accept` / `escort-status`
> Command list (PvP): `toggle-pvp`

This file expands the full command set enumerated by the three help.js sections: **team commands** (`team-create` / `team-disband` / `team-leave` / `team-invite` / `team-reply` / `team-query`), **escort commands** (`escort-accept` / `escort-status`), and **PvP commands** (`toggle-pvp`). `query-status.camp` is the shared pre/post condition for all three command groups; see [query.md](./query.md).

> **HARD RULE (asset/social respect; see SKILL.md Game Essentials §1-4)**:
> - `team-disband` / `team-leave` affects other players' social state (especially if someone is escorting during disband, escort may also be interrupted). Do **not** proactively execute without explicit user authorization.
> - `team-invite` is an **external interaction** sent to another player. By default, execute only when the user explicitly gives target `player-id` or `player-name`; do not randomly invite based on "someone nearby".
> - `toggle-pvp --mode pvp` exposes the character to kill risk in PvP areas (assets may drop in PvP zones). Treat it as sensitive by default; when restoring, explicitly switch back to `peace`.
> - `escort-accept` requires ticket + times + level. On failure it returns `failReason` instead of throwing; callers should read `failReason` to decide the next path.
> - L1-11 escort workflow (see SKILL.md) requires: after ending, run `toggle-pvp --mode <origCamp>` to restore original camp; do not leave the player permanently in pvp state.

---

## Team commands

Team commands cover five workflows: **create/disband** (`team-create` / `team-disband`), **member entry/exit** (`team-leave`), **invite/reply** (`team-invite` / `team-reply`), and **status query** (`team-query`, also the only entry to get `pendingInvites`). Solo escort is possible, but the agent must first create a "one-person team" with `team-create`.

---

## `team-create`

**Purpose**: create a team. Available when the character is not in a team; after success, current character becomes leader.

**Parameters** (validator: `validateTeamCreate`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--name` | No | `"<mainCharacterName>'s team"` | Team name, string; empty string is ignored and default is used |
| `--desc` | No | empty | Team description, string |
| `--public` | No | `true` | Whether public, bool; only accepts `true` / `false` |

CLI-side validation:

- Passing unknown parameter immediately reports `"Unsupported parameter: --xxx"`
- Non-`true`/`false` `--public` immediately reports `"--public must be true or false"`
- Empty-string `--name` is treated as omitted and uses the default value

**Examples**:

```bash
# Use default name and public team
lumiterra team-create

# Custom name and description
lumiterra team-create --name "Escort squad" --desc "Automated escort" --public true

# Private team
lumiterra team-create --public false
```

**Key return fields**: `teamId`, `teamName`, `isLeader`, basic team information

**Preconditions**:

- Character is loaded and alive
- **Currently not in any team** (if in another team, first `team-leave`)

**Failure scenarios**:

- Already in a team: first confirm with `team-query`, then `team-leave` or `team-disband`

---

## `team-disband`

**Purpose**: disband the current team. Only leader can use it. After disbanding, all members leave the team.

**Parameters** (validator: `validateTeamDisband`): none; passing any flag reports `"Unsupported parameter: --xxx"`.

**Example**:

```bash
lumiterra team-disband
```

**Key return fields**: disband result

**Preconditions**:

- In a team and `isLeader=true` (confirm with `team-query`)

**Notes**:

- **HARD RULE**: affects the current state of other teammates (for example escort in progress). Do **not** proactively disband without explicit user authorization.
- Non-leader calls fail.

---

## `team-leave`

**Purpose**: leave the current team. When called by leader and the team has other members, server usually transfers leader first, then leaves.

**Parameters** (validator: `validateTeamLeave`): none.

**Example**:

```bash
lumiterra team-leave
```

**Key return fields**: leave result

**Preconditions**:

- In a team (`team-query.inTeam=true`)

**Notes**:

- If the goal is to "switch to a new team", order is `team-leave` -> `team-create` / accept someone else's invite.
- For a one-person team leader, `team-leave` is equivalent to disbanding, but semantically prefer `team-disband`.

---

## `team-invite`

**Purpose**: invite another player to the team. Only leader can use it. Long-running command (`IsLongRunning=true`), waits up to 10 seconds for the other player's response.

**Parameters** (validator: `validateTeamInvite`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--player-id` | One of two | - | Target player's RoleID (long), not limited by view range |
| `--player-name` | One of two | - | Target player's nickname (string), **only effective for players currently in view** |

CLI-side validation:

- `--player-id` and `--player-name` are **mutually exclusive**. Passing either one is enough; passing both reports `"--player-id and --player-name are mutually exclusive; specify only one"`.
- Passing neither reports `"Must specify --player-id or --player-name"`
- Non-positive-integer `--player-id` reports an error

**Examples**:

```bash
# Invite by RoleID (recommended; not limited by view range)
lumiterra team-invite --player-id 1234567890

# Invite by nickname (only players currently in view)
lumiterra team-invite --player-name "Alice"
```

**Key return fields**: invite result (whether the other player accepted / timed out / rejected)

**Preconditions**:

- In a team and `isLeader=true`
- Target player: no distance limit when inviting by RoleID; when inviting by nickname, target must be currently in view (`query-near-entities --type player` can get nearby players' `roleId` and `name`)

**Long-running and cancellation**:

- After sending, waits up to 10 seconds for the other player's response
- Can be cancelled within 2 seconds after start with `lumiterra stop team-invite`

**Notes**:

- **HARD RULE**: invitation is an external interaction; by default, execute only when the user explicitly provides the target.
- Players outside view / cross-scene players must use `--player-id`.
- The other player must accept through `team-query` -> `team-reply` before actually joining the team.

---

## `team-reply`

**Purpose**: reply to someone else's invite. Accepting joins the inviter's team; rejecting removes the invite record from `pendingInvites`.

**Parameters** (validator: `validateTeamReply`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--team-id` | Yes | - | Source team ID of the invite (long); from `team-query.pendingInvites[].teamId` |
| `--inviter-id` | Yes | - | Inviter RoleID (long); from `team-query.pendingInvites[].inviterId` |
| `--action` | Yes | - | `accept` or `reject` |

CLI-side validation:

- Missing `--team-id` / `--inviter-id` / `--action` immediately reports an error
- Non-positive-integer `--team-id`, `--inviter-id` reports an error
- Non-`accept`/`reject` `--action` reports `"--action must be accept or reject"`

**Examples**:

```bash
# First query pending invites
lumiterra team-query --pretty

# Then reply (team-id / inviter-id are taken from pendingInvites)
lumiterra team-reply --team-id 88877766 --inviter-id 1234567890 --action accept
lumiterra team-reply --team-id 88877766 --inviter-id 1234567890 --action reject
```

**Key return fields**: reply result, whether successfully joined the target team

**Preconditions**:

- `team-query.pendingInvites` contains a matching `teamId + inviterId` invite
- When accepting: currently not in another team (if in another team, first `team-leave`)

**Notes**:

- Invites expire (usually 10 seconds); timed-out invites do not appear in `pendingInvites`.
- Warning: `teamId` / `inviterId` are 64-bit integers. Direct `jq` parsing loses precision (see SKILL.md "64-bit ID precision trap"). Prefer python, or `jq -r` only when preserving strings.

---

## `team-query`

**Purpose**: query current team state + inbox (`pendingInvites`). Returns pending invites even when not in a team.

**Parameters** (validator: `validateTeamQuery`): none.

**Example**:

```bash
lumiterra team-query --pretty
```

**Key return fields**:

| Field | Description |
|---|---|
| `inTeam` | bool, whether in a team |
| `teamId` / `teamName` | returned only when `inTeam=true` |
| `leaderRoleId` / `isLeader` | leader RoleID and whether current character is leader |
| `members[]` | member list (only when `inTeam=true`) |
| `pendingInvites[]` | pending invite list (contains `teamId / teamName / inviterId / inviterName`), **returned whether in a team or not** |

**Notes**:

- When not in a team, only returns `inTeam=false` + `pendingInvites`.
- `pendingInvites` is the only data source for calling `team-reply`.
- This is the key probe entry for escort flow: before `escort-accept`, first run `team-query` to determine whether already in a team and whether current player is leader.

---

## Escort commands

Escort commands cover a two-step workflow: **accept** (`escort-accept`) -> **progress query** (`escort-status`). The escort process itself is driving a wagon along a fixed route + resisting events + final delivery. For the full loop, see SKILL.md **Workflow: L1-11 escort**.

---

## `escort-accept`

**Purpose**: accept the escort task in the currently open time window. The server automatically chooses the only wagon in the current open window; no manual target selection is needed.

**Parameters** (validator: `validateEscortAccept`): none; passing any flag reports `"Unsupported parameter: --xxx"`.

**Example**:

```bash
lumiterra escort-accept
```

**Key return fields**:

- Success: `wagonCid`, `wagonName`, initial progress
- Failure: `failReason` (see below)

**Preconditions (all four must pass)**:

- **Must be team leader** (not being in a team also fails; first `team-create`)
- **Enough escort tickets** (insufficient returns `failReason=ticket_not_enough`)
- **Character level meets requirement** (insufficient returns `failReason=level_error`)
- **Personal daily attempts not used up** and **world daily attempts not used up** (corresponding to `failReason=times_used_up` / `world_times_used_up`)

**Common failReason**:

| failReason | Meaning | Handling |
|---|---|---|
| `ticket_not_enough` | Not enough tickets | Get tickets from shop / quests first |
| `level_error` | Level too low | Level up first |
| `times_used_up` | Current character's daily attempts used up | Refresh tomorrow |
| `world_times_used_up` | World's daily attempts used up | Wait for next day or cross-server refresh |
| `not_leader` | Not team leader | `team-leave` + `team-create` |

**Notes**:

- After successful accept, the character enters escort state (`escort-status.inEscort=true`); other long-running commands cannot run at this time.
- Escort route requires the player to actively drive the wagon. During pushing, enabling PvP is recommended to respond to other players robbing the escort.

---

## `escort-status`

**Purpose**: query current escort progress. This is the **only** completion criterion in the escort loop: `inEscort=false` means this escort has ended (success or failure).

**Parameters** (validator: `validateEscortStatus`): none.

**Example**:

```bash
lumiterra escort-status --pretty
```

**Key return fields** (two states):

**In escort** (`inEscort=true`):

| Field | Description |
|---|---|
| `wagonCid` / `wagonName` | Current wagon config |
| `progress` | **Canonical progress field** (0-100 or 0-1 depending on server definition), used to determine whether near completion |
| `wagonPosition` | Current wagon coordinates, can assist driving with `navigate` |
| `team` | Current team snapshot |
| `times` | Attempt information (used / remaining) |

**Not in escort** (`inEscort=false`):

| Field | Description |
|---|---|
| `times` | Attempt information (kept for pre-accept checks) |

**Notes**:

- **The only completion signal is `inEscort=false`**; do not judge by `progress=100`, because server settlement + state writeback has timing differences.
- Typical escort-loop polling interval: 5-10 seconds (do not poll more frequently, to avoid looking abnormal).
- Escort failure / robbery also produces `inEscort=false`; infer success/failure with combat logs / events.

---

## PvP commands

PvP commands contain only `toggle-pvp`, which switches the `query-status.camp` field between `peace` and `pvp`.

---

## `toggle-pvp`

**Purpose**: switch the current character's PvP camp. Idempotent: if already in the target camp, no protocol is sent and `completed` is returned directly.

**Parameters** (validator: `validateTogglePvp`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--mode` | Yes | - | `peace` or `pvp` |

CLI-side validation:

- Missing `--mode` immediately reports `"Missing required parameter: --mode"`
- Non-`peace`/`pvp` `--mode` immediately reports `"--mode must be peace or pvp"`

**Examples**:

```bash
# Switch to PvP (before escort / challenge)
lumiterra toggle-pvp --mode pvp

# Switch back to Peace (restore after escort)
lumiterra toggle-pvp --mode peace
```

**Key return fields**: switch result (`completed` in idempotent scenario)

**Preconditions**:

- Character is loaded
- Current zone allows camp switching (some scenes such as safe zones / dungeons may reject it; `query-zone.isPvp` can predict this)

**Notes**:

- **HARD RULE**: `pvp` camp makes the character killable by other players in PvP zones and **may drop assets**, so treat it as sensitive by default.
- **State sync**: after successful switch, `query-status.camp` updates immediately and can be used as before/after comparison.
- **Idempotent**: switching repeatedly to current camp does not error and returns `completed` directly.
- **Escort workflow**: typical L1-11 escort usage is
  1. First `query-status` to record `origCamp`
  2. `toggle-pvp --mode pvp` (enable PvP during escort to allow counter-robbery)
  3. After escort ends, `toggle-pvp --mode <origCamp>` to **restore original camp**
- Switching camp does not affect current team and does not change position / equipment.
