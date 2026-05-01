# L1-15: NFT stake / smelt (nft-stake / nft-smelt)

> Source of truth: this file. When executing this workflow, agents **must** follow the order in the "Execution steps" section and may not merge or skip steps.
> Number index: L1-15.
> Merged sources: SKILL.md L172-199 "Workflow: NFT Stake / Smelt" + docs/workflows.md "L1-15: NFT stake / smelt".

This workflow is the only entry for scenarios where the user wants to stake stakeable NFTs from the backpack for passive income, or smelt already staked NFTs to recover about 50% wealth value. **Success criteria have two phases**: the stake phase checks whether the corresponding nftId appears in `query-staked`; the smelt phase checks whether `smelted[]` / `count` returned by `nft-smelt` includes the input nftId.

## Trigger conditions

- Trigger phrases:
  - "stake NFT" / "stake equipment" / "earn with NFT" / "earn passive equipment income"
  - "smelt NFT" / "smelt equipment NFT" / "destroy staked NFT for money"
  - "nft stake" / "nft smelt" / "stake backpack nft"
- User intent traits:
  - Goal is to **put stakeable NFTs into the staking pool** (passive earnings), or **destroy staked NFTs** (recover about 50% wealth value as lvMon)
  - User may ask to "stake then smelt" in one go, or only do one phase; both start from this L1 entry
- Boundary with nearby entries:
  - User asks to "move equipment NFT on-chain / off-chain" -> use L1-16 (NFT On-Chain / Off-Chain), not this L1
  - User asks to "dismantle equipment for materials / recycle JSM" -> use L1-9A (dismantle) / L1-9B (equipment-recovery), not this L1
  - User asks to "retrieve NFT without destroying" (unstake) -> **current scope does not include** `nft-unstake`; tell the user this ability is unavailable
  - User only wants to "view stakeable list / query staked list" -> only run query command in step 1 or step 4; do not enter stake / smelt

## State maintained during execution (explicit variables; do not estimate verbally)

- `stakeableItems` -- `items[]` returned by `query-stakeable-nft`, each with `nftId` / `itemCid` / `name` / `enhanceLevel` / `wealthValue` / `count`
- `stakePairs` -- `nftId:num` pair list prepared for `nft-stake --items`; **`nftId` must come from `stakeableItems[i].nftId`**, and `num` uses corresponding `count` (or user-specified sub-count)
- `wealthBefore` / `wealthAfter` -- `equipmentWealthValue` snapshot returned by `query-wealth`; used for accounting before/after stake and before/after smelt
- `stakedItems` -- `items[]` returned by `query-staked`, each with `nftId` / `itemCid` / `name` / `count` / `quality` / `enhanceLevel` / `wealthValue`; **smelt can only use the `nftId` from here**
- `smeltTargetNftIds` -- nftId list (comma-separated) prepared for `nft-smelt --staked-nft-ids`; **must** come from `stakedItems[i].nftId`, extracted after matching targets by both `itemCid + enhanceLevel`
- `smeltResult` -- `smelted[]` / `count` returned by `nft-smelt`; used to verify whether smelting actually happened

## Success criteria

- **Stake phase**: after `nft-stake` returns success, run `query-staked` again; every input `nftId:num` can be correspondingly matched in `stakedItems` by `itemCid + enhanceLevel`; `equipmentWealthValue` from `query-wealth` decreases accordingly
- **Smelt phase (optional)**: `smelted[]` returned by `nft-smelt` contains all input nftIds and `count` equals input count; after smelt, `query-staked` no longer returns these nftIds, and lvMon balance increases accordingly (about 50% wealthValue)
- Looking only at "command did not error" **does not count as success**: state change must be confirmed by the next query command
- Looking only at a shorter `query-stakeable-nft` list **does not equal** stake success: the item may disappear from backpack but not enter staking pool; account with `query-staked`

## Preconditions / Blockers

**Self-check before starting** (identify and report blockers early; do not wait for CLI failure):

- **Stakeable list non-empty**: if `query-stakeable-nft` returns empty `items`, this workflow cannot start; report blocker and ask the user to obtain stakeable NFTs first (on-chain, capture, craft, etc.), do not autonomously obtain them for the user
- **`nft-stake --items` supports at most 20 pairs per call**: if there are more than 20 `nftId:num` pairs, split into batches of <= 20; do not force over-limit parameters
- **`nft-stake --items` format is strict**: only accepts comma-separated `nftId:num` (for example `12345:1,67890:2`); do not pass spaces, semicolons, newlines, or other separators
- **Same itemCid with different enhanceLevel means different nftId**: `query-stakeable-nft` / `query-staked` group by `(itemCid, enhanceLevel)`; when the user says "stake that +3 sword", match using both `itemCid + enhanceLevel`, **not** only `itemCid`
- **nftId for smelt must come from `query-staked`**: `nft-smelt --staked-nft-ids` takes **staking record id**, not nftId from `query-stakeable-nft`; passing stakeable nftId to smelt fails directly or smelts the wrong target. **Always run `query-staked` first** to obtain fresh ids
- **`nft-smelt --staked-nft-ids` supports at most 20 ids per call**: comma-separated; split when over limit
- **Smelting is irreversible**: `nft-smelt` destroys NFTs and returns about 50% wealthValue as lvMon; the remaining 50% value is **permanently lost**. Execute only with explicit user authorization; do not decide on the user's behalf
- **Current scope does not include unstake**: there is no `nft-unstake` command. Staking is one-way, and the only value retrieval path is `nft-smelt` (50% loss). If the user expects original retrieval, explain before step 3
- **64-bit ID precision trap**: `nftId` is a 64-bit large integer. Do not extract with `jq -r '.nftId'` (precision loss); use `python3 -c "import json,sys;print(json.load(sys.stdin)['items'][0]['nftId'])"` or `grep -oE '[0-9]+'` to preserve the original string (see SKILL.md "64-bit ID precision trap")
- **Assets are sacred**: staking has poor reversibility (only smelt can redeem, with 50% loss), and smelting is fully irreversible; both are in the SKILL.md §1 "assets are sacred" list and **require** explicit user authorization
- **Spending actions are rejected by default**: this workflow has no spending subpath, but if related blockers appear (for example "wealthValue not enough to trigger threshold"), **do not** default to `energy-manage --action buy|borrow`; ask the user first

## Execution steps (numbered; do not skip)

```
1. Query stakeable NFTs
   lumiterra query-stakeable-nft
   -> Record stakeableItems: nftId / itemCid / name / enhanceLevel / wealthValue / count for each entry
   -> If items is empty: report blocker and stop this L1
   -> Filter the subset to stake according to user intent (optional: --item-cid filter)

2. Query current equipment wealth value (baseline snapshot)
   lumiterra query-wealth
   -> Record wealthBefore = equipmentWealthValue
   -> Used after step 3 to account that staking actually reduced available wealth (or after step 5 to account smelt return)

3. Execute stake (after user authorization)
   lumiterra nft-stake --items <nftId1:num1,nftId2:num2,...>
   -> nftId comes from step 1 stakeableItems[i].nftId; num uses count (or user-specified sub-count)
   -> Up to 20 pairs per call; split if over limit
   -> Strict format: comma-separated, colon-connected, no spaces/semicolons/newlines
   -> If failed: read failReason in response, report blocker accordingly, do not blindly retry

4. Account stake result (only authoritative source)
   lumiterra query-staked
   -> Record stakedItems: nftId / itemCid / name / count / quality / enhanceLevel / wealthValue for each entry
   -> **`nftId` must be taken from here**; do not reuse step 1 nftId -- staking record id and stakeable id are different namespaces
   -> Match step 3 input by itemCid + enhanceLevel and confirm every target entered staking pool
   -> If this L1 only stakes, it can end here; if not smelting, jump to step 6

5. (Optional) Execute smelt
   Requires explicit user authorization (irreversible destroy + ~50% wealth return)
   lumiterra nft-smelt --staked-nft-ids <nftId1,nftId2,...>
   -> nftId comes from step 4 stakedItems[i].nftId (not step 1)
   -> Target matching uses both itemCid + enhanceLevel; same itemCid at different levels has different nftId, so both fields must be checked
   -> Up to 20 ids per call; split if over limit
   -> Returned smelted[] / count: verify all input nftIds are included

6. Final accounting
   lumiterra query-wealth
   -> Record wealthAfter; stake phase should show equipmentWealthValue decrease, and smelt phase should show corresponding lvMon return of about 50%
   lumiterra query-staked
   -> Stake-only phase: account stable new staked list
   -> If smelt phase ran: smelted nftIds should no longer be in the list
   -> Report to user: what was staked / what was smelted / before-after wealth comparison / estimated lvMon return
```

## Called base workflows / common workflows

- This L1 does **not** recursively call other L1 workflows; stake / smelt are terminal actions
- Indirectly dependent CLI commands:
  - `query-stakeable-nft` -- stakeable NFT list entry in step 1 (`items[].nftId` for `nft-stake --items`)
  - `query-wealth` -- `equipmentWealthValue` snapshot in step 2 / step 6
  - `nft-stake` -- stake action in step 3; `--items` format is comma-separated `nftId:num`, up to 20 pairs
  - `query-staked` -- staked list in step 4 (`items[].nftId` for `nft-smelt --staked-nft-ids`)
  - `nft-smelt` -- smelt action in step 5; `--staked-nft-ids` accepts comma-separated nftId values, up to 20 ids

## Important notes (HARD RULES)

- Warning: **`nft-stake --items` format is strict**: `nftId:num` with colon, comma-separated. Do not include spaces / semicolons / newlines. Up to 20 pairs per call; over-limit must be batched.
- Warning: **nftId for `nft-smelt` must come from `query-staked`**: not `query-stakeable-nft`. Staking record id and stakeable id are different namespaces. **Every smelt must first run `query-staked`** to obtain fresh ids; do not cache or reuse step 1 nftId.
- Warning: **same itemCid with different enhanceLevel means different nftId**: `query-stakeable-nft` / `query-staked` group by `(itemCid, enhanceLevel)`. When the user says "stake / smelt that +3 sword", **must** match by both `itemCid + enhanceLevel`; matching only by itemCid can choose the wrong target (even the highest-level / most valuable one).
- Warning: **smelting is irreversible and loses about 50% value**: `nft-smelt` destroys NFT, returns about 50% wealthValue as lvMon, and permanently loses the other 50%. It is in the SKILL.md §1 "assets are sacred" list and **requires** explicit user authorization. Without authorization, do not execute; do not decide for the user because it "looks profitable".
- Warning: **current scope does not include `nft-unstake`**: staking is one-way; the only redemption path is `nft-smelt` (50% loss). If the user expects original retrieval, explain before step 3; otherwise they will be surprised that "retrieving" loses half.
- Warning: **`nftId` is a 64-bit large integer**: do not use `jq -r '.nftId'` (precision loss); use `python3` or `grep -oE '[0-9]+'` to preserve the original string. Precision loss makes `nft-stake` / `nft-smelt` hit the wrong nftId.
- Warning: **stake success is judged only by `query-staked`**: `nft-stake` returning success does not equal entering the staking pool; step 4 must account. Similarly, smelt success is judged by `nft-smelt` `smelted[]` / `count` + target disappearance from `query-staked`.
- Warning: **each batch must be independently verified**: when more than 20 pairs / ids require batching, verify every batch separately (step 4 / step 6). Do not run all batches and account only once at the end; a middle batch failure may be missed.
- Warning: **Assets are sacred**: staking and smelting both involve player backpack NFTs. Do **not** execute without user authorization; even vague permission like "you decide" still requires asking "which nftIds and quantities exactly to stake / smelt" before starting.
- Warning: **spending actions are rejected by default**: this L1 does not call any spending subpath by default; on related blockers, query/ask first and do not default to `energy-manage --action buy|borrow`.

## Notes / common mistakes

- Passing nftId from `query-stakeable-nft` directly to `nft-smelt --staked-nft-ids` -- they are ids from different namespaces; smelt must first run `query-staked` to obtain staking record id.
- Matching only by itemCid -- can confuse the +3 sword the user wants to keep with the +0 sword they want to smelt (same itemCid at different enhanceLevel has different nftId).
- Treating 200 return from `nft-stake` as success -- no `query-staked` accounting; target item may fail backend validation and not enter pool, causing later `nft-smelt` to find nothing.
- Passing more than 20 `nftId:num` pairs to `nft-stake --items` in one call -- command rejects or partially handles; must split into batches.
- Passing `nft-smelt --staked-nft-ids` with spaces or semicolons -- format accepts only comma-separated nftIds; other separators parse incorrectly.
- Using `jq -r '.items[].nftId'` to batch-extract nftId -- 64-bit precision loss changes nftId into the wrong number; `nft-stake` / `nft-smelt` cannot find the target or may operate on another NFT.
- Automatically doing "stake -> immediately smelt" without user authorization -- 50% value loss is permanent and irreversible; this is an assets-are-sacred action and requires explicit authorization for both phases.
- Assuming staked NFT can be retrieved with `nft-unstake` -- no such command in current scope; only `nft-smelt` (50% loss) or continue holding staked.
- Not running `query-wealth` after smelting to account lvMon return -- the user cannot see where the about 50% return went; step 6 must explicitly compare wealthBefore / wealthAfter and estimate lvMon gain.
- Mixing this L1 with L1-16 (NFT On-Chain / Off-Chain) -- L1-16 moves game NFTs and on-chain NFTs between domains; this L1 only operates the in-game staking pool. Data flows are completely different; do not mix them.
