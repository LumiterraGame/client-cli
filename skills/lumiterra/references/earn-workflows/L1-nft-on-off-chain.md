# L1-16: NFT On-Chain / Off-Chain (nft-to-onchain / onchain-nft-to-game)

> Source of truth: this file. When executing this workflow, the Agent **must** follow the order in the "Execution Steps" section and must not merge or skip steps.
> Number index: L1-16.
> Merged source: SKILL.md L201-235 "Workflow: NFT On-Chain / Off-Chain" (single source of truth; docs/workflows.md has no corresponding L1-X section).

This workflow is the only entry point for "move an NFT item from the in-game inventory to the chain (on-chain), or move an on-chain NFT back to the game inventory (off-chain)". **The two directions are independent**: on-chain uses `query-inventory` -> `nft-to-onchain` -> `query-onchain-items`; off-chain uses `query-onchain-items` -> `onchain-nft-to-game` -> `query-inventory`. **Success is judged by reconciliation queries**: on-chain checks whether the target nftId appears in `query-onchain-items`; off-chain checks whether the target appears in `query-inventory`.

## Trigger Conditions

- Trigger phrases:
  - "NFT on-chain" / "item on-chain" / "move equipment on-chain" / "move inventory NFT to chain"
  - "NFT off-chain" / "move on-chain NFT back to game" / "return on-chain item to inventory"
  - "nft on-chain" / "nft off-chain" / "move nft to chain" / "move nft to game"
- User intent characteristics:
  - The goal is to **move an in-game NFT to the chain** (on-chain, becoming a tradable on-chain asset), or **move an on-chain NFT back into the game** (off-chain, usable / stakeable / smeltable in game again)
  - The user may request only one direction at a time; both directions enter through this L1
- Boundaries with nearby entries:
  - If the user asks to "stake / smelt an NFT" -> run L1-15 (NFT Stake / Smelt), not this L1
  - If the user asks to "dismantle equipment to recover materials" -> run L1-9A (dismantle) / L1-9B (equipment-recovery), not this L1
  - If the user asks to "trade on-chain / list on market" -> **current scope does not include** on-chain marketplace operations; clearly tell the user this capability is unavailable
  - If the user only wants to "see which NFTs are on-chain" -> just run `query-onchain-items`; do not enter a move action

## Runtime State to Maintain (explicit variables; do not estimate verbally)

- `inventoryItems` -- `items[]` returned by `query-inventory`; each item includes `itemInstanceId` (= nftId used for on-chain), `itemCid`, `name`, `enhanceLevel`, `count`
- `stakeableItems` -- `items[]` returned by `query-stakeable-nft` (backup source); each item includes `nftId` / `itemCid`; `nftId` can also be used as `nft-to-onchain --nft-id` input
- `onchainItems` -- `items[]` returned by `query-onchain-items`; each item includes `nftId` / `itemCid` / `name` / `count` (available balance); **off-chain can only use the `nftId` from here**
- `moveAmount` -- the `--amount` value for `nft-to-onchain` / `onchain-nft-to-game`; during off-chain it **must** be <= `onchainItems[i].count` (available balance)
- `moveResult` -- `{ nftId, itemCid, amount }` returned by the two move commands; used for cross-checking in reconciliation steps

## Success Criteria

- **On-chain segment**: after `nft-to-onchain` succeeds and returns `{nftId, itemCid, amount}`, run `query-onchain-items` again; the passed `nftId` must appear in `onchainItems[].nftId` and `count` must align with `amount`; meanwhile the corresponding `itemInstanceId` count in `query-inventory` should decrease (or the item should disappear)
- **Off-chain segment**: after `onchain-nft-to-game` succeeds, run `query-inventory` again; the item corresponding to the passed nftId should appear in inventory `items[]` (match by `itemCid + enhanceLevel`); meanwhile the corresponding `nftId` count in `query-onchain-items` should decrease (or the item should disappear)
- Only seeing "the command did not report an error" **does not count as success**: success must be based on state changes from reconciliation queries
- Only seeing a slight list change in `query-inventory` / `query-onchain-items` **is not enough**: the specific `nftId` + `amount` must be consistent

## Preconditions / Blockers

**Self-check before starting** (identify and report blockers early if unmet; do not wait for the CLI to fail):

- **On-chain: `--nft-id` must come from the inventory**: the nftId for `nft-to-onchain --nft-id` **must** come from `query-inventory` `items[].itemInstanceId` or `query-stakeable-nft` `items[].nftId`; **do not** take it from `query-onchain-items` (that is the on-chain namespace); **do not** guess from memory or history
- **Off-chain: `--nft-id` must come from `query-onchain-items`**: the nftId for `onchain-nft-to-game --nft-id` **must** come from `query-onchain-items` `items[].nftId`; **do not** take it from `query-inventory` / `query-stakeable-nft` (those are in-game ids)
- **Off-chain `--amount` cannot exceed available balance**: it must be <= the target quantity in `onchainItems[i].count`; exceeding the limit will fail or partially execute. For batched off-chain moves, rerun `query-onchain-items` before each batch to get a fresh balance
- **`query-onchain-items` reads the local DataManager cache and does not use the network**: it reads the local cache delivered at game startup and updated by events; it **will not** actively request the latest on-chain state from the server. If the cache may be stale (for example, another client changed on-chain state), reconnect / restart the game to refresh DataManager; do not repeatedly retry this command
- **Both move commands have a 15s timeout**: after `nft-to-onchain` / `onchain-nft-to-game` is submitted, it waits for server confirmation and fails on timeout. **After timeout, re-check state first** (`query-inventory` / `query-onchain-items`) to confirm whether the move actually happened before deciding whether to retry; do not resend blindly, or you may duplicate the move or move the wrong direction
- **The same itemCid with different enhanceLevel values uses different nftIds**: `query-inventory` / `query-onchain-items` distinguish by `(itemCid, enhanceLevel)`. When the user says "move that +3 sword on-chain", you **must** match by both `itemCid + enhanceLevel`; do not use only `itemCid`
- **64-bit ID precision trap**: `nftId` / `itemInstanceId` are 64-bit large integers. Do not use `jq -r '.nftId'` (it loses precision); use `python3 -c "import json,sys;print(json.load(sys.stdin)['items'][0]['nftId'])"` or `grep -oE '[0-9]+'` to preserve the original string (see SKILL.md "64-bit ID precision trap")
- **Assets are sacred**: on-chain / off-chain moves affect the player's inventory / on-chain NFTs; after on-chain the asset moves to the chain, and after off-chain it returns to the game. Although both directions are reversible, every move **must** have explicit user authorization (clear nftId and amount). Do not run it on the user's behalf just because it "looks lossless"
- **Paid actions are rejected by default**: this L1 does not involve paid actions by default; if a related blocker appears (such as insufficient on-chain gas), **do not** default to `energy-manage --action buy|borrow`; ask the user first

## Execution Steps (numbered; do not skip)

### Direction A: On-Chain (Game -> Chain)

```
A1. Query NFTs in the inventory that can be moved on-chain
    lumiterra query-inventory [--type wearable]
    -> Record inventoryItems: itemInstanceId / itemCid / name / enhanceLevel / count for each item
    -> Filter the target by user intent (match by both itemCid + enhanceLevel)
    -> Alternative: run lumiterra query-stakeable-nft and use items[].nftId (also a valid source)
    -> If the target cannot be found: report a blocker and stop this L1

A2. Execute on-chain move (after user authorization)
    lumiterra nft-to-onchain --nft-id <nftId> --amount <n>
    -> nftId comes from A1 inventoryItems[i].itemInstanceId or stakeableItems[i].nftId
    -> amount uses the user-specified quantity (or count)
    -> 15s timeout; do not retry immediately after timeout, run A3 first to check whether the move actually happened
    -> Returns { nftId, itemCid, amount }

A3. Reconcile on-chain result (only authoritative source)
    lumiterra query-onchain-items
    -> Confirm the passed nftId appears in onchainItems[].nftId and count aligns with amount
    -> Cross-run lumiterra query-inventory to confirm the corresponding inventory itemInstanceId count decreased
    -> If it does not appear in onchainItems: handle as blocker; do not retry blindly
```

### Direction B: Off-Chain (Chain -> Game)

```
B1. Query the on-chain NFT list
    lumiterra query-onchain-items [--item-cid <itemCid>]
    -> Reads the local DataManager cache (no network request)
    -> Record onchainItems: nftId / itemCid / name / count (available balance) for each item
    -> Filter the target by user intent (match by both itemCid + enhanceLevel)
    -> If items is empty or the target is missing: report a blocker and stop this L1
    -> If the cache may be stale: ask the user to reconnect / restart the game to refresh DataManager; do not repeatedly rerun this command

B2. Execute off-chain move (after user authorization)
    lumiterra onchain-nft-to-game --nft-id <nftId> --amount <n>
    -> nftId must come from B1 onchainItems[i].nftId (not ids from query-inventory / query-stakeable-nft)
    -> amount must be <= onchainItems[i].count (available balance); exceeding it will fail
    -> 15s timeout; do not retry immediately after timeout, run B3 first to check whether the move actually happened
    -> Returns { nftId, itemCid, amount }

B3. Reconcile off-chain result (only authoritative source)
    lumiterra query-inventory
    -> Confirm the target item (matched by itemCid + enhanceLevel) appears in inventory items[] and count aligns
    -> Cross-run lumiterra query-onchain-items to confirm the corresponding nftId count decreased
    -> If it does not appear in the inventory: handle as blocker; do not retry blindly
```

## Called Base Workflows / Shared Workflows

- This L1 **does not** recursively call other L1 workflows; on-chain / off-chain movement is the terminal action itself
- Indirect CLI command dependencies:
  - `query-inventory` -- inventory query for Direction A step A1 / A3 / B3 (`items[].itemInstanceId` feeds `nft-to-onchain --nft-id`)
  - `query-stakeable-nft` -- alternate nftId source for Direction A (`items[].nftId` can also feed `nft-to-onchain --nft-id`)
  - `nft-to-onchain` -- on-chain action for Direction A step A2; 15s timeout
  - `query-onchain-items` -- on-chain query for Direction A step A3 / Direction B step B1 / B3; **reads local DataManager cache, no network**
  - `onchain-nft-to-game` -- off-chain action for Direction B step B2; 15s timeout

## Important Notes (HARD RULES)

- ⚠️ **`nft-to-onchain --nft-id` must come from the inventory**: valid sources are `query-inventory` `items[].itemInstanceId` or `query-stakeable-nft` `items[].nftId`; **do not** take it from `query-onchain-items` (that is the on-chain namespace); **do not** guess from history / memory
- ⚠️ **`onchain-nft-to-game --nft-id` must come from `query-onchain-items`**: **run `query-onchain-items` before every off-chain move to get a fresh nftId**; do not cache or reuse ids from elsewhere. In-game ids and on-chain ids are different namespaces; mixing them can hit the wrong target or fail directly
- ⚠️ **`query-onchain-items` reads local cache and does not use the network**: it reads the DataManager cache delivered at game startup and updated by events. If the data may be stale, the fix is reconnecting / restarting the game to refresh DataManager, **not** repeatedly rerunning this command
- ⚠️ **After a 15s timeout, re-check state before retrying**: both `nft-to-onchain` / `onchain-nft-to-game` have a 15s timeout. Timeout does not mean not executed; **must** run the corresponding reconciliation queries (`query-inventory` + `query-onchain-items`) to confirm actual state, and retry only after confirming it really did not move. Blind resend may duplicate the move or move the wrong direction
- ⚠️ **Off-chain `--amount` must be <= available balance**: `onchain-nft-to-game --amount` must be <= the target `count` in `query-onchain-items`. For batched off-chain moves, rerun the query before each batch to get a fresh balance; do not reuse old snapshots
- ⚠️ **The same itemCid with different enhanceLevel values uses different nftIds**: `query-inventory` / `query-onchain-items` distinguish by `(itemCid, enhanceLevel)`. When the user says "move that +3 item on-chain", you **must** match by both `itemCid + enhanceLevel`; matching by itemCid alone may choose the wrong level
- ⚠️ **`nftId` is a 64-bit large integer**: do not use `jq -r '.nftId'` (precision loss); use `python3` or `grep -oE '[0-9]+'` to preserve the original string; losing precision causes `nft-to-onchain` / `onchain-nft-to-game` to hit the wrong target
- ⚠️ **Move success is accepted only by reconciliation queries**: success from `nft-to-onchain` / `onchain-nft-to-game` does not mean the move is complete; step A3 / B3 must reconcile. Similarly, list-size changes alone are not enough; the specific `nftId` + `amount` must align
- ⚠️ **Assets are sacred**: both directions involve the player's NFT assets; without explicit user authorization (clear nftId and amount), **do not** execute. Even vague approval such as "you decide" must be clarified once more before starting
- ⚠️ **Paid actions are rejected by default**: this L1 does not involve paid subpaths by default; if related blockers appear (such as insufficient gas), **do not** default to `energy-manage --action buy|borrow`; ask the user first

## Notes / Common Mistakes

- Passing the nftId from `query-onchain-items` directly into `nft-to-onchain --nft-id` -- the two ids are in different namespaces; on-chain nftId must come from `query-inventory.items[].itemInstanceId` or `query-stakeable-nft.items[].nftId`
- Treating `query-inventory` itemInstanceId as `onchain-nft-to-game --nft-id` input -- off-chain must use `query-onchain-items.items[].nftId`; mixing ids can fail or move the wrong target
- Matching only by one field for the same itemCid -- this may confuse a +3 sword the user wants to keep with a +0 sword to move (same itemCid but different enhanceLevel means different nftId)
- Immediately resending after a 15s timeout -- this may duplicate the move; first run reconciliation queries to inspect actual state
- Setting off-chain `--amount` above the target `count` in `query-onchain-items` -- the command will fail or move only partially; query balance before setting amount
- Reusing the first `onchainItems` snapshot during batched off-chain moves -- the balance has changed; rerun `query-onchain-items` before each batch
- Repeatedly rerunning `query-onchain-items` expecting to see the "latest" chain state -- this command reads local DataManager cache, and repeated runs do not refresh it; reconnect / restart the game instead
- Using `jq -r '.items[].nftId'` to batch-extract nftId -- 64-bit precision is lost and nftId becomes the wrong number; `nft-to-onchain` / `onchain-nft-to-game` cannot find the target or moves the wrong one
- Judging success only because `nft-to-onchain` / `onchain-nft-to-game` returned 200 -- no reconciliation; step A3 / B3 must run the corresponding queries and verify the specific nftId + amount
- Mixing this L1 with L1-15 (NFT Stake / Smelt) -- L1-15 operates the in-game staking pool (one-way, can only smelt with 50% loss on redemption), while this L1 is bidirectional movement between game / chain; their data flows and risks are completely different, so do not mix them
- Running "move on-chain then off-chain to test" without user authorization -- although movement is reversible, every action requires explicit nftId + amount authorization from the user; do not run it on their behalf
