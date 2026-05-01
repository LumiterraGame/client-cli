# Totem commands — totem

> Command interface source of truth: the "Totem commands:" section in `src/parser/help.js` + `src/parser/validators/totem.js` (placeholder empty file)
> Command list: `query-totem-list` / `query-near-totem` / `totem-teleport`

Totems are large-world teleport points + bonus pools. All totem commands have no parameter validator (the server handles parameter validation directly).

---

## `query-totem-list`

**Purpose**: query the list of all large-world totems (status, bonus pool).

**Parameters**: none.

**Example**: `lumiterra query-totem-list`

**Return fields**: `count`, `totems[]`: `{id, cid, ownerName, ownerId, isMine, bonusPool, pos{x,y,z}}`.

---

## `query-near-totem`

**Purpose**: query the nearest totem to the specified coordinates.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--x` | Yes | X coordinate |
| `--y` | Yes | Y coordinate |
| `--z` | Yes | Z coordinate |

**Example**: `lumiterra query-near-totem --x 120 --y 5 --z -340`

**Return fields**: `{id, cid, ownerName, ownerId, isMine, bonusPool, distance, pos{x,y,z}}`.

**Note**: use with `totem-teleport --x --y --z`.

---

## `totem-teleport`

**Purpose**: teleport to the nearest totem to the specified coordinates.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--x` | Yes | X coordinate |
| `--y` | Yes | Y coordinate |
| `--z` | Yes | Z coordinate |

**Example**:

```bash
lumiterra totem-teleport --x 248.5 --y 0.0 --z 179.2
```

**Return fields**: `totemId`, `totemCid`, `ownerName`, `position{x,y,z}`.

**Notes**:

- First choose the target totem coordinates through `query-totem-list` or `query-near-totem`, then teleport there
- Like `back-to-town`, this is a hard disengage tool; `escape-combat` does not call it automatically
