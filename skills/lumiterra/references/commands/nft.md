# NFT commands — nft

> Command interface source of truth: the "NFT commands:" section in `src/parser/help.js` + `src/parser/validators/nft.js`
> Command list: `nft-stake` / `nft-smelt` / `nft-to-onchain` / `onchain-nft-to-game` / `query-stakeable-nft` / `query-staked` / `query-onchain-items`

NFT commands cover four chain-asset actions: **stake** (`nft-stake`, move backpack NFTs into the staking pool to generate wealth value), **smelt** (`nft-smelt`, destroy staked NFTs and return about 50% wealth value), **to on-chain** (`nft-to-onchain`, mint backpack game items into on-chain NFTs), **from on-chain** (`onchain-nft-to-game`, redeem on-chain NFTs back into the game backpack), plus supporting queries `query-stakeable-nft` / `query-staked` / `query-onchain-items`. All commands return JSON; failures return `{ "success": false, "errors": [...] }`.

> **HARD RULE (asset/currency respect; see SKILL.md Game Essentials §1-4)**:
> - NFTs are on-chain assets. All four commands (stake / smelt / to-onchain / onchain-to-game) are **asset-changing actions** and must **not** be proactively executed without explicit user authorization.
> - `nft-smelt` **destroys** staked NFTs and returns only about 50% wealth value. This is irreversible loss and requires repeated confirmation of user intent.
> - `nft-to-onchain` consumes on-chain gas and locks backpack items onto the chain. It is **not** a free operation.
> - **nftId has ambiguous semantics**: backpack NFT instance ID (`query-stakeable-nft`/`query-inventory`), staking record ID (`query-staked`), and on-chain NFT ID (`query-onchain-items`) are **three different ID spaces** and must never be mixed.

---

## `nft-stake`

**Purpose**: batch-stake NFTs from the backpack into the staking pool, up to 20 pairs per call. After staking, wealth value is gained and NFTs move from the backpack into the staking pool (visible in `query-staked`).

**Parameters** (validator: `validateNftStake`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--items` | Yes | - | Comma-separated `nftId:num` pair list; up to 20 pairs; `nftId` comes from `query-stakeable-nft` `items[].nftId`, and `num` uses corresponding `items[].count` |

CLI-side validation (`validators/nft.js`):

- Missing `--items` immediately reports `"Missing required parameter: --items (format: nftId1:num1,nftId2:num2,...)"`
- Empty after splitting `--items` reports `"--items cannot be empty"`
- Pair count > 20 reports `"nft-stake supports at most 20 nftIds"`
- Any `pair` missing `nftId` or `num` reports `"--items format error: "${pair}", each item must be nftId:num"`
- Any non-positive-integer `num` reports `"num in --items must be a positive integer: "${pair}""`

**Examples**:

```bash
lumiterra nft-stake --items 10001:3,10002:1
lumiterra nft-stake --items 10001:5
```

**Return fields**:

- `staked[]`: nftId list actually staked
- `count`: total quantity staked this time

**Notes**:

- **HARD RULE**: do **not** stake without explicit user authorization (Game Essentials §1); NFTs are the player's on-chain assets.
- First use `query-stakeable-nft` to get `items[].nftId` + `items[].count`, then assemble `--items`; `num` must not exceed `items[].count`.
- **Different enhanceLevel values for the same itemCid have different `nftId` values**: when matching target NFTs, confirm with both `itemCid + enhanceLevel`, not only `itemCid`.
- After staking, use `query-staked` to query staking records. Note that `nftId` returned by that command is a **staking record ID**, not the original backpack `nftId`.

---

## `nft-smelt`

**Purpose**: smelt staked NFTs (destroy them, returning about 50% wealth value). Batch operation, up to 20 per call.

**Parameters** (validator: `validateNftSmelt`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--staked-nft-ids` | Yes | - | Comma-separated staking record ID list; up to 20 IDs; from `query-staked` `items[].nftId` |

CLI-side validation:

- Missing `--staked-nft-ids` immediately reports `"Missing required parameter: --staked-nft-ids"`
- Empty after splitting reports `"Missing valid --staked-nft-ids"`
- Count > 20 reports `"nft-smelt supports at most 20 staked-nft-id values"`

**Example**:

```bash
lumiterra nft-smelt --staked-nft-ids s10001,s10002
```

**Return fields**:

- `smelted[]`: smelted nftId list
- `count`: smelt count this time

**Notes**:

- **HARD RULE (irreversible loss)**: smelting **destroys** NFTs and returns only about 50% wealth value. Execute only after explicit authorization and **repeated confirmation** from the user (Game Essentials §1/§4).
- The `nftId` in **`--staked-nft-ids` must come from `query-staked`, not `query-stakeable-nft`**: they are different ID spaces and mixing them fails directly (see the "nftId semantics" HARD RULE at the top of this file).
- Smelting only operates on staked NFTs. Unstaked NFTs in the backpack cannot be smelted directly; they must first go through `nft-stake`.

---

## `nft-to-onchain`

**Purpose**: move game items from the backpack on-chain as NFTs. After going on-chain, items leave the backpack and become visible in `query-onchain-items`.

**Parameters** (validator: `validateNftToOnchain`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--nft-id` | Yes | - | NFT instance ID of the backpack item, from `query-inventory` `items[].itemInstanceId` or `query-stakeable-nft` `items[].nftId` |
| `--amount` | Yes | - | On-chain amount, positive integer |

CLI-side validation:

- Missing `--nft-id` or empty string immediately reports `"Missing required parameter: --nft-id"`
- Non-safe-integer or `<= 0` `--amount` immediately reports `"--amount must be a positive integer"`
- After validation, `nft-id` is trimmed and `amount` is converted to string before being sent

**Example**:

```bash
lumiterra nft-to-onchain --nft-id 10001 --amount 3
```

**Return fields**:

- `nftId`: NFT instance ID moved on-chain
- `itemCid`: item config ID
- `amount`: actual amount moved on-chain

**Notes**:

- **HARD RULE (on-chain action)**: moving on-chain involves chain transaction cost and is **not** free; do **not** execute without explicit user authorization (Game Essentials §1-4).
- `--nft-id` must come from the **backpack** (`query-inventory.items[].itemInstanceId` or `query-stakeable-nft.items[].nftId`), not from `query-onchain-items` (that is already on-chain).
- Different enhanceLevel values for the same `itemCid` have different `nftId` values; identify targets with `itemCid + enhanceLevel` together.
- `--amount` must not exceed the `count` of this `nftId` in the backpack.

---

## `onchain-nft-to-game`

**Purpose**: move on-chain NFTs back into the game backpack. After redemption, assets leave the chain and return to the backpack (visible in `query-inventory`).

**Parameters** (validator: `validateOnchainNftToGame`):

| flag | Required | Default | Description |
|---|---|---|---|
| `--nft-id` | Yes | - | On-chain NFT instance ID, from `query-onchain-items` `items[].nftId` |
| `--amount` | Yes | - | Down-chain amount, positive integer and not greater than on-chain available quantity |

CLI-side validation:

- Missing `--nft-id` or empty string immediately reports `"Missing required parameter: --nft-id"`
- Non-safe-integer or `<= 0` `--amount` immediately reports `"--amount must be a positive integer"`
- After validation, `nft-id` is trimmed and `amount` is converted to string before being sent

**Example**:

```bash
lumiterra onchain-nft-to-game --nft-id 0xabc123 --amount 2
```

**Return fields**:

- `nftId`: NFT instance ID moved back into game
- `itemCid`: item config ID
- `amount`: actual amount moved back into game

**Notes**:

- **HARD RULE (on-chain action)**: moving from chain back to game also involves chain transaction cost and must **not** be executed without explicit user authorization (Game Essentials §1-4).
- `--nft-id` must come from **on-chain** (`query-onchain-items.items[].nftId`), not from `query-inventory` / `query-stakeable-nft` (those are backpack IDs).
- `--amount` must not exceed `query-onchain-items.items[].count`.
- This is the inverse of `nft-to-onchain`, but each command validates independently and **does not** automatically roll back the other.

---

## `query-stakeable-nft`

**Purpose**: query stakeable NFT instances in the backpack, optionally filtered by item config ID.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--item-cid` | No | Filter by item config ID; returns all when omitted |

**Example**: `lumiterra query-stakeable-nft --item-cid 1234`

**Return fields**:

- `items[]`: `{nftId, itemCid, name, enhanceLevel, wealthValue, count}`
- `nftId` is passed as the `nftId` part of `nft-stake --items` and also used for `nft-to-onchain --nft-id`; `count` is passed as the `num` part of `nft-stake --items`

**Note**: `nft-stake --items` format is `nftId1:num1,nftId2:num2,...`, up to 20 pairs.

---

## `query-staked`

**Purpose**: query staked NFT list.

**Parameters**: none.

**Example**: `lumiterra query-staked`

**Return fields**:

- `items[]`: `{nftId, itemCid, name, count, quality, enhanceLevel, wealthValue}`
- `totalCount`, `totalItemCount`, `totalWealthValue`

**Note**: the `nftId` semantics are **different** from `query-stakeable-nft`: here it is a **staking record ID** (used for `nft-smelt`); there it is a **backpack NFT instance ID** (used for `nft-stake`/`nft-to-onchain`).

---

## `query-onchain-items`

**Purpose**: query items already on-chain, optionally filtered by item config ID.

**Parameters**:

| flag | Required | Description |
|---|---|---|
| `--item-cid` | No | Filter by item config ID; returns all when omitted |

**Example**: `lumiterra query-onchain-items --item-cid 1234`

**Note**: returned `nftId` is used for `onchain-nft-to-game --nft-id` (move on-chain item back into game).
