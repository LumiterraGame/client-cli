# L1-9: Equipment Resource Recycling

> Source of truth: this file. When executing this workflow, the Agent **must** follow the order in the "Execution Steps" section and must not merge or skip steps.
> Number index: L1-9 (agents can locate it by either number or name)
> Contains two independent paths: 9A equipment dismantling / 9B equipment recovery pool airdrop

---

## 9A. Equipment Dismantling

> Source of truth: this file. When executing this workflow, the Agent **must** follow the order in the "Execution Steps" section and must not merge or skip steps.
> Number index: L1-9A.

> ⚠️ L1-9A Dismantling != L1-9B EquipmentRecovery. Dismantling produces materials/fragments; EquipmentRecovery is recovery-pool airdrop. Do not mix commands.

This workflow is the unified entry point for "dismantle unused equipment into materials/fragments": given a batch of dismantleable equipment `itemInstanceId` values, this L1 submits an async dismantling batch -> polls dismantling records -> claims fragments after success -> verifies materials entered the inventory.

### Trigger Conditions

- Trigger phrases:
  - "dismantle equipment" / "break down equipment" / "dismantle these items" / "break them down for materials"
  - "claim fragments" / "claim dismantle materials" / "claim dismantle"
  - "dismantle equipment"
- User intent characteristics:
  - The goal is to **convert inventory equipment into fragments/materials**, not to receive an airdrop
  - Equipment is already in the inventory, and the user subjectively considers it "no longer needed" (or explicitly lists `itemInstanceId`)
- Boundaries with nearby entries:
  - If the user asks to "put equipment into the recovery pool for an airdrop" -> use L1-9B (EquipmentRecovery), not this L1
  - If the user asks to "enhance this equipment" -> use L1-8 (enhance-equipment), not this L1
  - If the user only wants to view the list of dismantleable equipment and is unsure whether to dismantle -> only run step 1 `query-inventory`; do not enter step 2

### Runtime State to Maintain (explicit variables; do not estimate verbally)

- `candidateList` -- set of dismantleable equipment `itemInstanceId` values read from `query-inventory --type wearable`
- `protectedList` -- set of currently equipped / user-protected equipment `itemInstanceId` values that must not be dismantled
- `submittedIds` -- list of `itemInstanceId` values successfully submitted by this `dismantle-equipment` call
- `submittedAtMs` -- server timestamp at submission (used to locate this batch among multiple records)
- `submittedItemCount` -- number of equipment items in this batch (used to match `query-dismantling-record` results)
- `recordId` -- record id read from `query-dismantling-record` (= `disMsgId`)
- `recordState` -- current record state (`DismantlingPlaying` / `DismantlingSuccess` / `DismantlingFail` / `DismantlingMatClaimed`)
- `expectedMaterials` -- fragments to claim declared in `materials[]` on the record (itemCid / count)
- `beforeMaterialCount` / `afterMaterialCount` -- material inventory snapshots before and after claim (used for verify)

### Success Criteria

- **Use successful `claim-dismantling-mats` + `query-inventory --type material` quantity increase as success**: `afterMaterialCount - beforeMaterialCount` must cover the increments declared in `expectedMaterials`
- Only seeing `dismantle-equipment` return `itemInstanceIds`/`itemCount` **does not count as success**: that only means "batch submitted successfully"; the server has not finished dismantling yet
- Only seeing `query-dismantling-record` `state = DismantlingSuccess` **also does not count as success**: fragments have not been claimed yet, so `claim-dismantling-mats` is still required
- `state = DismantlingMatClaimed` means "already claimed earlier" and cannot be claimed again; this is not failure, report already-claimed

### Preconditions / Blockers

**Self-check before starting** (report blockers early if unmet):

- **Assets are sacred**: `dismantle-equipment` is an **irreversible** asset consumption operation. Any `itemInstanceId` without explicit user authorization is **forbidden** from entering `submittedIds`
- **Do not dismantle currently equipped equipment**: `query-equipment` / `query-inventory` can identify currently equipped equipment, which goes into `protectedList` by default; only if the user **explicitly says** "dismantle the equipped item too" may it enter `submittedIds`
- **Do not dismantle user-protected equipment**: high-level / not fully enhanced / historically marked "keep" equipment goes into `protectedList` by default; ask the user when in doubt, do not dismantle it yourself
- **Do not randomly choose when name resolution is ambiguous**: if the user only says "dismantle trash weapons" without `itemInstanceId`, and the inventory has multiple weapon candidates -> report a blocker and require the user to pick specific items (by `itemInstanceId` or full name + level)
- **Record matching ambiguity**: when `query-dismantling-record` returns multiple records, uniquely locate this batch using `submittedAtMs` + `submittedItemCount` + item summary; **do not** take the latest record casually (it may be an old unclaimed record)
- **Must have recordId before claim**: `claim-dismantling-mats` `--record-id` **can only** come from `query-dismantling-record`; **do not** guess or reuse an old id

### Execution Steps (numbered; do not skip)

```
1. lumiterra query-inventory --type wearable
   -> Read all wearable equipment in inventory and build candidateList
   -> Identify currently equipped / user-protected equipment and put them into protectedList
   -> Also run lumiterra query-inventory --type material
      to read beforeMaterialCount snapshot (for later verify)

2. Confirm submittedIds with the user
   -> Present candidates from candidateList - protectedList to the user
   -> Only after explicit user approval may itemInstanceId values enter submittedIds
   -> If the user says "dismantle all trash equipment" but gives no explicit ids and ambiguity exists -> report blocker and require specific picks

3. lumiterra dismantle-equipment --item-instance-id <id1> [<id2> ...]
   -> Submit one async dismantling batch; multiple ids can be separated by spaces or commas
   -> The command only submits the request; it does not wait for completion and does not claim materials
   -> Returned fields: itemInstanceIds / items / itemCount / submittedAtMs
     -> Record submittedIds / submittedItemCount / submittedAtMs for step 4 matching

4. lumiterra query-dismantling-record
   -> List dismantling records (each contains recordId/disMsgId / state / items / materials)
   -> Uniquely locate this batch using submittedAtMs + submittedItemCount + item summary
   -> Extract recordId and recordState; read expectedMaterials
   -> If multiple candidates cannot be uniquely identified -> report blocker; do not guess

5. Wait / poll until the record is complete
   -> state = DismantlingPlaying -> run query-dismantling-record again later; do not claim immediately
   -> state = DismantlingFail -> stop this batch and report the failure reason to the user; do not claim
   -> state = DismantlingMatClaimed -> already claimed; report already-claimed and do not claim again
   -> state = DismantlingSuccess -> enter step 6

6. lumiterra claim-dismantling-mats --record-id <recordId>
   -> Call only for DismantlingSuccess records
   -> CLI claims the materials; it does not open the in-game dismantling result UI
   -> After success, record claimedAtMs / claimed record

7. lumiterra query-inventory --type material
   -> Read afterMaterialCount
   -> Compare expectedMaterials: afterMaterialCount - beforeMaterialCount must cover the declared increments
   -> Mismatch -> report blocker (claim succeeded but inventory verification failed, usually due to data view mismatch or server delay)
```

### Called Base Workflows / Shared Workflows

- This L1 **does not depend on** L1-get-item: Dismantling means "consume equipment to produce fragments", not "obtain target item"
- Indirect dependencies:
  - `query-inventory --type wearable` -- list dismantleable candidates
  - `query-inventory --type material` -- quantity snapshots before/after claim + final verify
  - `query-equipment` -- help identify currently equipped equipment (goes into protectedList)
  - `dismantle-equipment` -- submit async dismantling batch
  - `query-dismantling-record` -- read this batch's record + poll state
  - `claim-dismantling-mats` -- claim fragments for a `DismantlingSuccess` record
- This L1 **does not mix** L1-9B commands `query-recycle-pool` / `do-equipment-recovery` / `claim-recycle-reward` (different system, different server protocol)

### Important Notes (HARD RULES)

- ⚠️ **Dismantling != EquipmentRecovery** (most important): Dismantling uses `dismantle-equipment` / `query-dismantling-record` / `claim-dismantling-mats` (produces fragments/materials); EquipmentRecovery uses `query-recycle-pool` / `do-equipment-recovery` / `claim-recycle-reward` (shared-pool airdrop). **Do not** borrow commands across systems or confuse `recordId` with `poolId`
- ⚠️ **Irreversible asset consumption**: `dismantle-equipment` directly consumes equipment, and the server provides no undo. Before submission, the user **must** explicitly list or approve `submittedIds`; do not include currently equipped equipment or unauthorized equipment
- ⚠️ **Do not dismantle equipped equipment**: unless the user explicitly says "dismantle this equipped item too", itemInstanceId values in protectedList are **forbidden** from entering `submittedIds`
- ⚠️ **Must query record before claim**: the id for `claim-dismantling-mats --record-id` **can only** come from the current return of `query-dismantling-record`; **do not** guess / reuse old ids / pass `submittedAtMs` as recordId
- ⚠️ **Claim only DismantlingSuccess**: `DismantlingPlaying` means keep waiting, `DismantlingFail` means stop and report, `DismantlingMatClaimed` means already claimed; only `DismantlingSuccess` can enter step 6, and the command fails in other states
- ⚠️ **dismantle is async; do not treat it as sync**: `dismantle-equipment` only submits the batch, does not wait, and does not return recordId; step 4 `query-dismantling-record` is required to get `recordId`. **Do not** claim directly after step 3 returns
- ⚠️ **Multiple records must be uniquely located with submittedAtMs + itemCount + item summary**: the player may have old unclaimed records or multiple batches submitted around the same time; do not assume "latest record" is this batch
- ⚠️ **recordId and disMsgId are synonyms**: both fields in `query-dismantling-record` refer to the same id; pass it to `claim-dismantling-mats` with `--record-id`, and ignore the alias difference

### Notes / Common Mistakes

- Treating Dismantling and EquipmentRecovery as the same system -- running `claim-recycle-reward` after `dismantle-equipment`, or vice versa; the two systems are fully independent, and record / pool ids do not interoperate
- Skipping step 4 and guessing recordId for claim -- `claim-dismantling-mats` will fail; query record first
- Claiming immediately after `dismantle-equipment` returns -- the server is still in `DismantlingPlaying`; poll until `DismantlingSuccess` first
- Putting currently equipped equipment into `submittedIds` -- asset loss is irreversible; step 1 must identify equipped items into protectedList
- Trying to claim after seeing `DismantlingFail` -- only Success can claim; Fail stops the batch and must be reported
- Trying to claim again after seeing `DismantlingMatClaimed` -- already claimed, and another claim will error; this is a normal signal, not failure
- User says only "dismantle trash weapons" while multiple same-type weapons exist -- do not choose randomly; report blocker and ask for specific picks
- Skipping step 7 verify and treating `claim-dismantling-mats` success as completion -- with server delay or data-view mismatch, materials may not have truly entered the inventory; compare before/after

---

## 9B. Equipment Recovery Pool Airdrop

> Source of truth: this file. When executing this workflow, the Agent **must** follow the order in the "Execution Steps" section and must not merge or skip steps.
> Number index: L1-9B.

> ⚠️ L1-9B EquipmentRecovery != L1-9A Dismantling. EquipmentRecovery is recovery-pool airdrop (claim previous-period rewards); Dismantling produces materials from equipment.

This workflow is the unified entry point for "deposit equipment/fragments into a shared recovery pool in exchange for next-period airdrops proportional to score": query pool -> choose items accepted by `buyItemList` -> deposit into current pool -> wait until the period ends -> claim previous-period rewards (note that `claim` uses `previousExtraReward.poolId`, not the current `poolId`).

### Trigger Conditions

- Trigger phrases:
  - "equipment recovery pool" / "recover equipment" / "recycle equipment for token"
  - "airdrop" / "recovery pool airdrop" / "claim previous airdrop"
  - "equipment recovery" / "claim recycle reward"
- User intent characteristics:
  - The goal is to **deposit equipment/fragments into a shared pool and receive an airdrop by score share**, not to convert equipment into materials/fragments
  - Or the user explicitly mentions "claim previous period / claim airdrop / claim recovery pool reward"
- Boundaries with nearby entries:
  - If the user asks to "break equipment into fragments/materials" -> use L1-9A (Dismantling), not this L1
  - If the user asks to "enhance this equipment" -> use L1-8 (enhance-equipment), not this L1
  - If the user only wants to view the current pool state and is unsure whether to deposit -> only run step 1 `query-recycle-pool`; do not enter step 3

### Runtime State to Maintain (explicit variables; do not estimate verbally)

- `poolId` -- current target recovery pool id (used by step 3 `do-equipment-recovery`)
- `poolTypeId` -- pool type id (used by step 4 `query-recycle-record`; **not poolId**)
- `userScore` / `poolScore` -- this user's score / total pool score (used to estimate share)
- `expireTime` -- current period cutoff time (do not attempt to claim the current period before it expires)
- `buyItemList` -- itemCid list accepted by the current pool (filter basis in step 2)
- `candidateList` -- items from `query-inventory --type wearable material` whose itemCid belongs to buyItemList
- `protectedList` -- currently equipped / user-protected itemInstanceId values that must not be deposited
- `submittedIds` -- itemInstanceId values successfully submitted by this `do-equipment-recovery`
- `previousExtraReward` -- previous-period reward structure (contains `poolId` / `canClaim` / `userRewardToken` / `userRewardItems`)
- `previousPoolId` -- the `previousExtraReward.poolId` used for claiming (**not the current poolId**)

### Success Criteria

- **Deposit stage**: `do-equipment-recovery` succeeds + a subsequent `query-recycle-pool` shows `userScore` increased, or `query-recycle-record --pool-type-id <poolTypeId>` can find this exchange record
- **Claim stage**: `claim-recycle-reward --pool-id <previousPoolId>` succeeds + corresponding token / items are credited
- Only seeing `do-equipment-recovery` succeed **does not mean this period's airdrop arrived**: airdrops are settled by server cycle. Wait until after `expireTime`, and only when the next-period `query-recycle-pool` shows `previousExtraReward.canClaim=true` can it be claimed
- The current-period `poolId` **cannot** be used for `claim-recycle-reward`; it can only be claimed after that `poolId` becomes `previousExtraReward.poolId` in a later query

### Preconditions / Blockers

**Self-check before starting** (report blockers early if unmet):

- **Assets are sacred**: `do-equipment-recovery` deposits items into a **shared pool and cannot be withdrawn**. Any itemInstanceId without explicit user authorization is **forbidden** from entering `submittedIds`
- **itemCid must belong to buyItemList**: the pool only accepts itemCid values declared by `buyItemList`; equipment/fragments outside the list are **forbidden** from deposit, or the server will reject / the operation will be wasted
- **Do not deposit currently equipped equipment**: `query-equipment` / `query-inventory` can identify equipped equipment, which goes into `protectedList` by default; only if the user explicitly says "deposit this equipped item too" may it enter `submittedIds`
- **Do not deposit user-protected equipment**: high-level / not fully enhanced / historically marked "keep" equipment goes into `protectedList` by default
- **Cannot claim before the current period ends**: call `claim-recycle-reward` only when `previousExtraReward.canClaim=true`; the current-period `poolId` will not appear in `previousExtraReward` before this period ends
- **Do not confuse poolId and previousPoolId**: `do-equipment-recovery --pool-id` uses the **current** `poolId`; `claim-recycle-reward --pool-id` uses `previousExtraReward.poolId`; they are not the same id, and mixing them fails
- **Do not confuse poolId and poolTypeId**: `do-equipment-recovery` / `claim-recycle-reward` use `poolId`; `query-recycle-record` uses `poolTypeId`; passing the wrong one cannot find the corresponding record

### Execution Steps (numbered; do not skip)

```
1. lumiterra query-recycle-pool
   -> List all recovery pools
   -> Record the target pool's poolId / poolTypeId / userScore / poolScore / expireTime / buyItemList
   -> Also record previousExtraReward (may be empty; canClaim=true means a previous-period reward can be claimed)

2. lumiterra query-inventory --type wearable material
   -> Read all deposit candidates in the inventory
   -> Filter items where item.itemCid belongs to the target pool's buyItemList and build candidateList
   -> Identify currently equipped / user-protected equipment and put them into protectedList
   -> Confirm submittedIds with the user (options from candidateList - protectedList); enter step 3 only after explicit approval

3. lumiterra do-equipment-recovery --pool-id <poolId> --item-instance-id <id1> [<id2> ...]
   -> Deposit selected itemInstanceId values into the current pool
   -> A single stacked item id can add --count <n>; with multiple ids, each quantity is fixed at 1
   -> userScore should increase after deposit

4. lumiterra query-recycle-record --pool-type-id <poolTypeId>   # optional
   -> Confirm this exchange/airdrop record
   -> Note: the parameter is poolTypeId, not poolId

5. Wait until the current period ends (after expireTime)
   -> Do not attempt to claim while the current period is still active
   -> After expiry, the server settles airdrops by score share

6. lumiterra query-recycle-pool
   -> Query again
   -> Read previousExtraReward.poolId (= previousPoolId)
   -> Read previousExtraReward.canClaim / userRewardToken / userRewardItems
   -> canClaim=false or previousExtraReward empty -> no claimable reward; end

7. lumiterra claim-recycle-reward --pool-id <previousPoolId>
   -> ⚠️ Note: pass previousExtraReward.poolId here, not the current poolId from step 3
   -> After success, token / items are credited
```

### Called Base Workflows / Shared Workflows

- This L1 **does not depend on** L1-get-item: EquipmentRecovery means "deposit assets for an airdrop", not "obtain target item"
- Indirect dependencies:
  - `query-recycle-pool` -- read pool state / buyItemList / previousExtraReward
  - `query-inventory --type wearable material` -- list deposit candidates
  - `query-equipment` -- help identify currently equipped equipment (goes into protectedList)
  - `do-equipment-recovery` -- deposit into the current pool
  - `query-recycle-record` -- query exchange/airdrop records by poolTypeId (optional)
  - `claim-recycle-reward` -- claim previousExtraReward reward
- This L1 **does not mix** L1-9A commands `dismantle-equipment` / `query-dismantling-record` / `claim-dismantling-mats` (different system, different server protocol)

### Important Notes (HARD RULES)

- ⚠️ **EquipmentRecovery != Dismantling** (most important): EquipmentRecovery uses `query-recycle-pool` / `do-equipment-recovery` / `claim-recycle-reward` (shared-pool airdrop); Dismantling uses `dismantle-equipment` / `query-dismantling-record` / `claim-dismantling-mats` (produces fragments/materials). **Do not** borrow commands across systems or confuse `poolId` with `recordId`
- ⚠️ **claim-recycle-reward must use `previousExtraReward.poolId`, not the current `poolId`**: the reward being claimed is from the **previous period**, and `--pool-id` comes from step 6 `previousExtraReward.poolId`; passing the current `poolId` from step 1/3 fails or claims the wrong period
- ⚠️ **Current-period rewards cannot be claimed before the period ends**: claim only after `expireTime` has passed and the next `query-recycle-pool` shows `previousExtraReward.canClaim=true`; there is no claimable current-period airdrop before settlement
- ⚠️ **`query-recycle-record` is keyed by `poolTypeId`, not `poolId`**: using the wrong parameter cannot find records; `poolTypeId` comes from step 1 `query-recycle-pool`
- ⚠️ **Irreversible asset deposit**: after `do-equipment-recovery` deposits items into the shared pool, the server provides **no withdrawal**. submittedIds must have explicit user authorization; do not include currently equipped / unauthorized equipment
- ⚠️ **itemCid must belong to buyItemList**: filter by candidateList in step 2 before deposit; items outside buyItemList will be rejected or waste the operation
- ⚠️ **count semantics**: a single stacked id may deposit multiple copies with `--count <n>`; when multiple ids are listed together, each id has quantity fixed at 1, and `--count` cannot count each id separately

### Notes / Common Mistakes

- Treating EquipmentRecovery and Dismantling as one system -- running `claim-dismantling-mats` after `do-equipment-recovery`, or vice versa; the systems are fully independent, and pool / record ids do not interoperate
- Passing the current `poolId` from step 3 to `claim-recycle-reward --pool-id` -- it fails or claims the wrong period; must use step 6 `previousExtraReward.poolId`
- Trying to claim this period's airdrop before `expireTime` -- this period's airdrop does not exist before settlement, and it will not appear in `previousExtraReward`
- Passing `poolId` to `query-recycle-record` -- no record is found; the parameter is named `--pool-type-id`, and the value must be `poolTypeId`
- Depositing equipment whose itemCid is not in `buyItemList` -- the server rejects it or returns an error; step 2 must filter first
- Depositing currently equipped equipment into the pool -- asset loss is irreversible; step 2 must identify equipped items into protectedList
- Using `--count` for each id when multiple ids are supplied -- only one stacked item id can use `--count`; in multi-id scenarios each is fixed at 1
- Calling `claim-recycle-reward` twice for the same `previousExtraReward.poolId` -- already claimed will error; stop after the first successful claim
