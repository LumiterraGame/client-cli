---
name: auto-test
description: |
  Full-coverage test for all lumiterra CLI commands. Execute in order: Phase 1 (independent queries) → Phase 2 (full command matrix) → Phase 3 (workflow smoke).
  Triggers: test commands, test CLI, auto-test, verify commands, full test, check commands
allowed-tools: Bash(lumiterra:*)
---

# Lumiterra CLI Auto-Test Protocol v2

## Execution Rules (MUST)

1. **Strict order**: Phase 1 → Phase 2 → Phase 3. Do not skip or parallelize.
2. **A single FAIL within a Phase does not abort**: record it and continue running the rest of the Phase.
3. **SKIP ≠ FAIL**; **BLOCKED-SKIP** (predecessor failed, dependent case cannot run) is recorded separately.
4. **Always honor SKILL.md Hard Rules**: respect assets, be careful with currency. Test data may be consumed, but always at minimum cost.
5. **All coordinates / ids are obtained dynamically**: source them from `query-*` commands. Hardcoding is forbidden.
6. **Phase 3 precondition**: only run when Phase 1 + Phase 2 produced no FAIL (or the user explicitly authorizes a skip).
7. **L0–L3 are all executed**: test data is low-value, no longer SKIP high-risk commands by default; complete the test at minimum cost.
8. **Error branches count as independent PASS cases**: returning the expected error (success:false containing the keyword) = PASS.
9. **Strict pairing within a chain**: L1 commands must complete their pair to restore the original state (equip ↔ unequip, etc.).
10. **Run a `stop` safety net at the end of each Group**: clear any residual long-running command.

## Risk and Verification Levels

| Level | Meaning | Verification | Default |
|---|---|---|---|
| L0 | Side-effect-free query / rejected branch | success:true + field types | Always test |
| L1 | Reversible action (paired restore) | Post-execution query + paired restore to original state | Always test |
| L2 | Consumes a small amount of low-value assets | Side effect actually occurred + delta check | Test once at minimum cost |
| L3 | Irreversible / high-value | Delta check + asset awareness (minimum cost) | Test once at minimum cost |
| ERR | Error-branch case | Returns the expected error keyword | Always test |

---

## Phase 1 — Independent Commands (L0 verification)

Call directly and verify success:true + field types. Each row is one independent test case.

### Core Queries

| Case | Command | Verified Fields |
|---|---|---|
| query-app-info | `lumiterra query-app-info` | data.language(string) data.gameVersion(string) data.platform(string) data.unityVersion(string) |
| query-status | `lumiterra query-status` | data.hp(number) data.maxHp(number) data.energy(number) data.maxEnergy(number) data.position.x(number) data.position.z(number) data.camp(string) data.level(number) |
| query-inventory no args | `lumiterra query-inventory` | data.items(array) |
| query-inventory --lv | `lumiterra query-inventory --lv 1` | data.items(array) |
| query-inventory --type wearable | `lumiterra query-inventory --type wearable` | data.items(array) |
| query-inventory --type food | `lumiterra query-inventory --type food` | data.items(array) |
| query-inventory --type material | `lumiterra query-inventory --type material` | data.items(array) |
| query-inventory --type pet-egg | `lumiterra query-inventory --type pet-egg` | data.items(array) |
| query-inventory --talent | `lumiterra query-inventory --talent battle` | data.items(array) |
| query-inventory --item-cid | `lumiterra query-inventory --item-cid 1` | data.items(array) |
| query-wallet | `lumiterra query-wallet` | success:true, data not null, contains at least one currency field |
| query-zone | `lumiterra query-zone` | success:true, data not null |
| query-equipment no args | `lumiterra query-equipment` | success:true, data not null |
| query-near-entities monster | `lumiterra query-near-entities --type monster` | success:true, data.entities(array) |
| query-near-entities player | `lumiterra query-near-entities --type player` | success:true, data.entities(array) |
| query-near-entities resource | `lumiterra query-near-entities --type resource` | success:true, data.entities(array) |
| query-near-entities pet | `lumiterra query-near-entities --type pet` | success:true, data.entities(array) |
| query-near-entities npc | `lumiterra query-near-entities --type npc` | success:true, data.entities(array) |
| query-near-entities world-animal | `lumiterra query-near-entities --type world-animal` | success:true, data.entities(array) |
| query-near-entities --radius | `lumiterra query-near-entities --type monster --radius 20` | success:true, data.entities(array) |
| query-near-entities --limit | `lumiterra query-near-entities --type monster --limit 5` | success:true, data.entities(array) |

### Spawn Point Queries

⚠️ **Current CLI constraint**: `query-spawn-point` **requires** `--cid` or `--keyword` (without it, returns `Missing filter; specify --cid or --keyword`). The no-arg form is deprecated; the table below assumes a filter is always supplied.

⚠️ **monster keyword Chinese matching BUG** (zh-CN client, observed repeatedly): using a Chinese monster name (e.g. `--keyword Metal Mutt` translated) typically returns `No match found...`, **KNOWN-FAIL**; fall back to `--cid` to obtain navPosition. On an en-US client, an English monster name (e.g. `wolf`) usually matches.

| Case | Command | Verified Fields |
|---|---|---|
| spawn-point monster --cid | Take monsterCid from `quest-list` / `query-near-entities` (e.g. Metal Mutt cid=6) → `lumiterra query-spawn-point --type monster --cid {cid}` | data.navPosition(object) — SKIP if the current zone has no spawn point for that monster |
| spawn-point monster --keyword | zh-CN: Chinese monster name; en-US: `--keyword wolf` | zh-CN typically **KNOWN-FAIL** (Chinese keyword BUG); en-US PASS |
| spawn-point gather --keyword | `lumiterra query-spawn-point --type gather --keyword wood` (en) / Chinese equivalent (zh) | data.navPosition(object) |
| spawn-point fish --keyword | `lumiterra query-spawn-point --type fish --keyword fish` (en) / Chinese equivalent (zh) | data.navPosition(object) |
| spawn-point animal --keyword | `--keyword {known animal name in current language}` | data.navPosition(object) — SKIP if keyword does not match |
| spawn-point farm --keyword | `--keyword {farm or its Chinese equivalent}` | data.navPosition(object) — SKIP if no match |
| spawn-point npc --cid | `query-near-entities --type npc` → take cid → `lumiterra query-spawn-point --type npc --cid {cid}` | success:true, data not null — SKIP if no NPC in scene |
| spawn-point npc --keyword | `--keyword {NPC name}` (e.g. Gunner, Lucas) | success:true — NPC keyword matching works in practice (unlike monster) |

### Farm / Animal

| Case | Command | Verified Fields |
|---|---|---|
| farm-query no args | `lumiterra farm-query` | data.farmSoils(array); if non-empty: farmSoils[0].soilId(string) farmSoils[0].status(string) |
| farm-query --soil-id | `lumiterra farm-query --soil-id {soilId from no-arg result}` | data.farmSoils(array) — SKIP if no known soilId |
| farm-query --cid | `lumiterra farm-query --cid {cid from no-arg result}` | data.farmSoils(array) — SKIP if no known cid |
| animal-query no args | `lumiterra animal-query` | success:true, data.animals(array) |
| animal-query --entity-id | `lumiterra animal-query --entity-id {id from no-arg result}` | data.animals(array) — SKIP if no known id |
| animal-query --cid | `lumiterra animal-query --cid {cid from no-arg result}` | data.animals(array) — SKIP if no known cid |

### NFT Queries

| Case | Command | Verified Fields |
|---|---|---|
| query-stakeable-nft | `lumiterra query-stakeable-nft` | success:true, data not null |
| query-staked | `lumiterra query-staked` | success:true, data not null |
| query-onchain-items | `lumiterra query-onchain-items` | success:true, data not null |
| query-dismantling-record no args | `lumiterra query-dismantling-record` | success:true, data not null |
| query-dismantling-record paged | `lumiterra query-dismantling-record --begin 0 --count 10` | success:true, data not null |
| query-recycle-pool no args | `lumiterra query-recycle-pool` | success:true, data not null |
| query-recycle-record | `lumiterra query-recycle-record --pool-type-id 1` | success:true, data not null — SKIP if no known pool-type-id |

### Pets / Quests / Crafting / Talents

| Case | Command | Verified Fields |
|---|---|---|
| query-pets | `lumiterra query-pets` | data.pets(array) |
| query-capture-setup no args | `lumiterra query-capture-setup` | success:true, data not null |
| query-capture-setup --target | `lumiterra query-capture-setup --target {cid from spawn-point}` | success:true, data not null — SKIP if no known cid |
| quest-list | `lumiterra quest-list` | success:true, data contains task list |
| quest-normal-list | `lumiterra quest-normal-list` | success:true, data not null |
| token-task-list | `lumiterra token-task-list` | success:true, data contains task list |
| query-recipes no args | `lumiterra query-recipes` | success:true, data.recipes(array) |
| query-recipes --craftable | `lumiterra query-recipes --craftable true` | success:true, data.recipes(array) |
| query-recipes --talent-type battle | `lumiterra query-recipes --talent-type battle` | success:true, data.recipes(array) |
| query-recipes --talent-type farming | `lumiterra query-recipes --talent-type farming` | success:true, data.recipes(array) |
| query-recipes --talent-type gather | `lumiterra query-recipes --talent-type gather` | success:true, data.recipes(array) |
| query-item-sources | `lumiterra query-recipes` → take itemCid of the first ingredient → `lumiterra query-item-sources --item-cid {cid}` | success:true, data not null — SKIP if no recipe |
| query-talent no args | `lumiterra query-talent` | success:true, data not null |
| query-talent battle | `lumiterra query-talent --talent-type battle` | success:true, data not null |
| query-talent farming | `lumiterra query-talent --talent-type farming` | success:true, data not null |
| query-talent gather | `lumiterra query-talent --talent-type gather` | success:true, data not null |

### Team / Escort / Totem / Survival

| Case | Command | Verified Fields |
|---|---|---|
| team-query | `lumiterra team-query` | success:true, data not null |
| escort-status | `lumiterra escort-status` | success:true, data not null |
| query-totem-list | `lumiterra query-totem-list` | success:true, data not null |
| query-near-totem | `lumiterra query-status` → take position.x/y/z → `lumiterra query-near-totem --x {x} --y {y} --z {z}` | success:true, data not null |
| query-craft-lottery | `lumiterra query-craft-lottery` | success:true, data not null |
| stop | `lumiterra stop` | success:true |
| back-to-town | `lumiterra back-to-town` | success:true |

---

## Phase 2 — Full Command Matrix

Split into 13 Groups by dependency (A–L, plus the mutex-lock specialist L). Within each Group, execute strictly in table order; chains must complete their pair to restore the original state.


### Per-Group Execution Template

```
PRE-CHECK   Snapshot key state (HP / energy / inventory / equipment / talent / pets)
RUN         Run cases in matrix order
            - happy path → param boundary → ERR error branch
            - L1 commands must complete their pair
ROLLBACK    Restore the original state (worn equipment / talent levels / following pet / team / camp)
POST-CHECK  Reconciliation queries (query-equipment / query-status / query-pets, etc.)
STOP        Run `lumiterra stop` at the end of each group
```

---

### Group A — Standalone Toggles / Side-Effect-Free

**Pre-check**: `query-status` records origCamp + origPos

⚠️ **toggle-pvp client cache race**: after toggle-pvp switches camp, there is a ~2–3s sync delay between handler-side `campData.CampType` and what `query-status` returns. Paired toggles **must `sleep 2-3`** between them; otherwise the second toggle reads the stale camp and returns `endReason=completed` immediately without sending a request, causing ROLLBACK to silently fail.

⚠️ **toggle-pvp zone-rule override (important game mechanic)**: the camp state set by toggle-pvp **only persists PVP inside "danger zones"**. In **safe zones / towns / non-PVP areas**:
- The toggle PVP command itself returns success (command-level PASS)
- But the camp shown in query-status is **periodically overwritten back to the zone default** by the scene rule (usually pvp, but not "player-chosen pvp")
- Symptom: after toggle peace + sleep, query shows pvp again, "auto-bouncing" repeatedly
- ROLLBACK validation cannot require camp to stabilize after a single toggle; allow retries, or treat "command returned success" as PASS

→ **PASS criterion adjustment**: A-2 / A-3 only verify that **the command itself returned success** (success:true + response fields). They do **not** require query-status to match the chosen mode; ROLLBACK does not require a final camp value (the zone rule has taken over).

| # | Case | Command + Args | Risk | PASS Criterion |
|---|---|---|---|---|
| A-1 | navigate short distance | `navigate --x {pos.x+5} --y {pos.y} --z {pos.z+5}` | L0 | success:true, arrived=true |
| A-2 | toggle-pvp (same mode as origCamp) | `toggle-pvp --mode {origCamp}` | L1 | success:true, endReason=completed |
| A-2.5 | sleep sync | `sleep 3` | — | — |
| A-3 | toggle-pvp (switch to the other mode) | `toggle-pvp --mode {!origCamp}` | L1 | command returns success:true, data.camp matches mode (do not verify query-status, the zone may overwrite) |
| A-3.5 | sleep sync | `sleep 3` | — | — |
| A-4 | ERR mode invalid | `toggle-pvp --mode invalid` | ERR | error message contains "peace or pvp" |
| A-5 | ERR mode missing | `toggle-pvp` | ERR | error message contains "peace or pvp" (equivalent to A-4) |
| A-6 | ERR navigate missing param | `navigate --y 0 --z 0` | ERR | "Missing required parameter: --x" |
| A-7 | stop (idle) | `stop` | L0 | success:true, drained=true |
| A-8 | stop (cancel an in-flight long command) | take navPosition from `query-spawn-point --type animal` → background `navigate --x {nx} --y {ny} --z {nz} &` → `sleep 1` → `stop` | L0 | stoppedCommands contains "navigate", drained=true |

**ROLLBACK**:
- `sleep 3` to make sure A-3 sync completes
- `toggle-pvp --mode {origCamp}` to switch back to the initial camp (**command returns success = PASS**)
- Do not require query-status verification (the zone rule may already have overwritten)
- navigate position does not need to be restored

**Known protocol issues**:
- A-8 navigate target must be a NavMesh-reachable point; otherwise the command fails instantly and stop returns stoppedCommands=[]. Recommended: take navPosition from `query-spawn-point`
- A-4 / A-5 share the same error message (combined required + enum check); use keyword inclusion as the PASS criterion
- toggle-pvp zone-rule override: PVP only persists inside danger zones; in safe zones / towns the camp is periodically overwritten by the scene rule. A complete stability test requires running once inside a danger zone separately.

---

### Group B — Reversible Paired Short Commands

**Pre-check**: `query-equipment` records worn equipment (including origWeapon.useLv) / `query-talent` records each talent type's level + canUpgrade nodes / `team-query` records team state. Explicitly record the relationship between each worn item's useLv and the corresponding talent.level.

> **Scope adjustment**: the original B-15~B-18 (pet-summon) cases moved to Group H (full pet lifecycle); this group now only retains equip / talent / team.

⚠️ **Strong coupling between equipment useLv and talent.level (REQUIRED READING)**:
- equip checks useLv ≤ the corresponding talent type's level; if not satisfied it returns `insufficient talent level to wear this equipment`
- talent downgrade will **automatically unequip** all worn items of that talent whose useLv exceeds the new level
- **If origWeapon.useLv > the corresponding talent.level** (account was manually set up with mismatched gear), B-2 unequip leaves B-3 unable to ROLLBACK. You must pick one of:
  - (A) First `talent-manage upgrade` to origWeapon.useLv → equip restore → **accept a permanent +1 talent level as the new baseline**
  - (B) **SKIP B-2 / B-3 as a pair** until that talent.level ≥ origWeapon.useLv
- **Before B-10 downgrade you must first unequip every item under that talent whose useLv exceeds the new level**; otherwise items get auto-unequipped and the ROLLBACK chain breaks

→ **Case-selection rules**:
- B-1 positive: pick an item with useLv ≤ the corresponding talent.level; B-1b negative ERR: pick an item with useLv > talent.level
- B-1c negative ERR: construct a non-existent itemInstanceId
- When origWeapon.useLv > talent.level, SKIP B-2 / B-3 as a pair (not FAIL)

| # | Case | Command + Args | Risk | PASS Criterion |
|---|---|---|---|---|
| B-1 | equip positive (useLv ≤ talent.level) | `query-inventory --type wearable` → first item with useLv ≤ corresponding talent.level → `equip --action equip --item-instance-id {iid}` | L1 | success:true (replacedItemInstanceId may be absent if the slot was empty) |
| B-1b | ERR equip useLv exceeds talent.level | pick an item with useLv > the corresponding talent.level → `equip --action equip --item-instance-id {iid}` | ERR | "insufficient talent level" — SKIP if inventory has no over-level item |
| B-1c | ERR equip item does not exist | `equip --action equip --item-instance-id "local#0x0000000000000000000000000000000000000000#999999999"` | ERR | "Cannot find wearable equipment" or equivalent |
| B-2 | equip unequip | `equip --action unequip --slot weapon` —— **only execute if origWeapon.useLv ≤ talent.level**, otherwise SKIP together with B-3 | L1 | success:true, weapon slot empty |
| B-3 | equip restore origWeapon | `equip --action equip --item-instance-id {origWeapon}` | L1 | weapon slot = origWeapon —— see pre-check ⚠️ |
| B-4 | ERR equip missing action | `equip` | ERR | "Missing required parameter: --action" |
| B-5 | ERR equip invalid action | `equip --action xyz` | ERR | "only supports equip/unequip" |
| B-6 | ERR equip missing item | `equip --action equip` | ERR | "requires --item-instance-id or --item-cid" |
| B-7 | ERR unequip missing slot | `equip --action unequip` | ERR | "requires --slot" |
| B-8 | ERR unequip invalid slot | `equip --action unequip --slot xyz` | ERR | slot range error |
| B-9 | talent upgrade | `query-talent` → take a node with canUpgrade=true → `talent-manage --action upgrade --talent-type {t} --node-id {nid}` | L1 | newLevel > beforeLevel |
| B-10 | talent downgrade (**first unequip items in that talent with useLv > new level**) | `query-equipment` → find items in that talent type with useLv > new level → unequip them all → `talent-manage --action downgrade --talent-type {t} --node-id {nid}` | L1 | newLevel < beforeLevel —— see pre-check ⚠️ |
| B-11 | ERR talent invalid action | `talent-manage --action xyz --talent-type battle --node-id 1` | ERR | "only supports upgrade or downgrade" |
| B-12 | ERR talent invalid talent-type | `talent-manage --action upgrade --talent-type xyz --node-id 1` | ERR | "only supports battle/farming/gather" |
| B-13 | ERR talent missing node-id | `talent-manage --action upgrade --talent-type battle` | ERR | "Missing required parameter: --node-id" |
| B-14 | ERR talent node does not belong to type | `talent-manage --action upgrade --talent-type battle --node-id {farmingNodeId}` | ERR | "Node X does not belong to battle" |
| B-19 | team-create | `team-create` | L1 | inTeam=true, isLeader=true |
| B-20 | team-disband | `team-disband` | L1 | inTeam=false |
| B-21 | ERR team-disband not in team | `team-disband` | ERR | "Not currently in a team" |
| B-22 | ERR team-create already in team | `team-create` then `team-create` again | ERR | "Already in a team" (then disband immediately to clean up) |

**ROLLBACK**:
- Equipment introduced by B-1: before the test ends, `equip --action unequip` to restore the corresponding slot; if it replaced origWeapon, B-3 already restored it explicitly
- B-9 / B-10 pair: if B-10 is SKIPped (to protect equipment), record the permanent +1 talent level as the new baseline in the report
- team pair already completed in B-19 / B-20

---

### Group C — Equipment Slot Helpers

**Pre-check**: `query-equipment` records origWeapon; call `set-skill-shortcut --skill-id {anySkill} --slot 1` once and read origShortcuts (the skillId of each slot at PRE-CHECK time)

⚠️ **set-skill-shortcut one-way property (game design, not a BUG)**: handler rejects `--skill-id <= 0`, so a slot cannot be "cleared". Underlying game logic: every shortcut slot always holds a valid skill; even if `query` returns `skillId=0`, **a barehanded character still uses the basic skill**. Once an explicit skill is set, the `skillId=0` state cannot be returned to, **but this does not affect game functionality** (the basic skill remains automatically available when the character is barehanded).
- ROLLBACK does not require restoring a slot to `skillId=0`
- If a slot in origShortcuts already has an explicit skill it can be restored; for slots that were 0, leaving the most recently set skillId is acceptable

| # | Case | Command + Args | Risk | PASS Criterion |
|---|---|---|---|---|
| C-1 | switch-weapon sword | `switch-weapon --weapon-type sword` | L1 | success:true (already-sword → changed=false also counts as PASS) |
| C-2 | switch-weapon hammer | `switch-weapon --weapon-type hammer` | L1 | success:true (or "no such item in inventory" → explicit error) |
| C-3 | switch-weapon bow | `switch-weapon --weapon-type bow` | L1 | success:true |
| C-4 | switch-weapon sickle | `switch-weapon --weapon-type sickle` | L1 | success:true |
| C-5 | switch-weapon axe | `switch-weapon --weapon-type axe` | L1 | success:true |
| C-6 | switch-weapon pickaxe | `switch-weapon --weapon-type pickaxe` | L1 | success:true |
| C-7 | switch-weapon hoe | `switch-weapon --weapon-type hoe` | L1 | success:true |
| C-8 | switch-weapon water-bottle | `switch-weapon --weapon-type water-bottle` | L1 | success:true |
| C-9 | switch-weapon brush | `switch-weapon --weapon-type brush` | L1 | success:true |
| C-10 | switch-weapon fishing-rod | `switch-weapon --weapon-type fishing-rod` | L1 | success:true |
| C-11 | ERR invalid weapon-type | `switch-weapon --weapon-type xyz` | ERR | "unknown weapon type" |
| C-12 | ERR missing weapon-type | `switch-weapon` | ERR | required-parameter error |
| C-13 | set-skill-shortcut slot 1 | `query-talent` → take unlockedSkills[0] → `set-skill-shortcut --skill-id {s} --slot 1` | L1 | shortcutSlots[0].skillId == s |
| C-14 | set-skill-shortcut slot 2 | `set-skill-shortcut --skill-id {s} --slot 2` | L1 | shortcutSlots[1].skillId == s |
| C-15 | set-skill-shortcut slot 3 | `set-skill-shortcut --skill-id {s} --slot 3` | L1 | shortcutSlots[2].skillId == s |
| C-16 | ERR slot out of range | `set-skill-shortcut --skill-id {s} --slot 4` | ERR | "slot only supports 1-3" |
| C-17 | ERR missing skill-id | `set-skill-shortcut --slot 1` | ERR | "Missing required parameter: --skill-id" |
| C-18 | ERR skill not owned | `set-skill-shortcut --skill-id 99999 --slot 1` | ERR | "Skill is not owned" |
| C-19 | ERR skill-id=0 (clear intent) | `set-skill-shortcut --skill-id 0 --slot 3` | ERR | "--skill-id must be a positive integer" (verifies one-way property) |

**ROLLBACK**:
- Restore origWeapon (`equip --action equip --item-instance-id {origWeaponIid}`)
- For each slot where origShortcuts[i].skillId > 0, re-issue `set-skill-shortcut` with the original skillId
- Slots whose origShortcuts[i].skillId == 0 cannot and need not be restored (game design); a leftover valid skillId does not affect functionality

**Known protocol / game-design behavior**:
- set-skill-shortcut one-way (see ⚠️ above): some slots may end the test holding an explicit skill instead of 0; this is expected and does not count as a ROLLBACK failure

---

### Group D — Async Queue Chain

**Pre-check**: `query-inventory --type material` records beforeMaterialCount / `query-recipes --craftable true` to take a low-cost recipe

| # | Case | Command + Args | Risk | PASS Criterion |
|---|---|---|---|---|
| D-1 | dismantle-equipment (low value) | pick a backup item with useLv ≥ 1 → `dismantle-equipment --item-instance-id {iid}` | L3 | success:true, submittedAtMs present |
| D-2 | query-dismantling-record locate this batch | `query-dismantling-record` → use submittedAtMs to locate | L0 | recordId uniquely identified |
| D-3 | claim-dismantling-mats | `claim-dismantling-mats --record-id {recordId}` | L2 | success:true, material delta ≥ expected |
| D-4 | ERR claim missing record-id | `claim-dismantling-mats` | ERR | required-parameter error |
| D-5 | ERR claim invalid record-id | `claim-dismantling-mats --record-id 0xINVALID` | ERR | "Cannot find dismantle record" |
| D-6 | ERR dismantle non-dismantleable equipment | `dismantle-equipment --item-instance-id {useLv0_iid}` | ERR | "No dismantling materials configured" |
| D-7 | craft-lottery once | `query-craft-lottery` → pick an executable one → `craft-lottery --recipe-id {rid} --count 1` | L3 | success:true, result contains a reward — SKIP if no usable recipe |
| D-8 | ERR craft-lottery missing recipe-id | `craft-lottery` | ERR | required-parameter error |
| D-9 | ERR craft-lottery count out of range | `craft-lottery --recipe-id {rid} --count 0` | ERR | "count must be in range 1-MAX" |
| D-10 | do-equipment-recovery | `query-recycle-pool` → pick eligible equipment → `do-equipment-recovery --pool-id {pid} --item-instance-id {iid}` | L3 | userScore increases — SKIP if pools=[] |
| D-11 | claim-recycle-reward (previous round) | `query-recycle-pool` → take previousExtraReward.poolId → `claim-recycle-reward --pool-id {ppid}` | L2 | success:true, token / items credited — SKIP if nothing to claim |
| D-12 | ERR claim-recycle already claimed | repeat D-11 | ERR | "already been claimed" |

**ROLLBACK**: the async chain is irreversible; record consumption and verify

---

### Group E — NFT

**Pre-check**: `query-stakeable-nft` / `query-staked` / `query-onchain-items` / `query-wealth` capture a baseline

| # | Case | Command + Args | Risk | PASS Criterion |
|---|---|---|---|---|
| E-1 | nft-to-onchain (lowest value) | pick the NFT with the lowest wealthValue → `nft-to-onchain --nft-id {nid} --amount 1` | L1 | onchain count +1, inventory count -1 |
| E-2 | onchain-nft-to-game (restore) | `onchain-nft-to-game --nft-id {monad_nid} --amount 1` | L1 | inventory count restored |
| E-3 | ERR to-onchain missing nft-id | `nft-to-onchain --amount 1` | ERR | required-parameter error |
| E-4 | ERR to-onchain amount=0 | `nft-to-onchain --nft-id {nid} --amount 0` | ERR | "must be a positive integer" |
| E-5 | ERR to-onchain amount over limit | `nft-to-onchain --nft-id {nid} --amount 999999` | ERR | "Insufficient backpack quantity" |
| E-6 | ERR off-chain with inventory id | `onchain-nft-to-game --nft-id {local_nid} --amount 1` | ERR | "Not found on-chain" |
| E-7 | nft-stake (lowest value, 1 unit) | pick the lowest wealthValue → `nft-stake --items {nid}:1` | L3 | the cid appears in query-staked, count=1 |
| E-8 | ERR stake invalid format | `nft-stake --items "nid;1"` | ERR | "Invalid --items format" |
| E-9 | ERR stake more than 20 pairs | construct 21 pairs | ERR | "supports at most 20 nftIds" |
| E-10 | nft-smelt (smelt the one from E-7) | `query-staked` → take nid → `nft-smelt --staked-nft-ids {nid}` | L3 | smelted[] contains the input id, wealth increases |
| E-11 | ERR smelt missing staked-nft-ids | `nft-smelt` | ERR | required-parameter error |

**ROLLBACK**: E-1 ↔ E-2 already paired; E-7 + E-10 accept a 50% loss (test data)

---

### Group F — Quest Command Family

**Pre-check**: `quest-list --type daily` / `quest-normal-list` / `token-task-list` capture initial state

| # | Case | Command + Args | Risk | PASS Criterion |
|---|---|---|---|---|
| F-1 | quest-accept | `quest-accept --type daily --talent battle` | L2 | task accepted — SKIP if one is already in progress |
| F-2 | quest-abandon | `quest-abandon --type daily` | L1 | success:true |
| F-3 | quest-accept (restore) | `quest-accept --type daily --talent battle` | L2 | re-accept |
| F-4 | ERR accept invalid type | `quest-accept --type xyz --talent battle` | ERR | "Unsupported task type" |
| F-5 | ERR accept invalid talent | `quest-accept --type daily --talent xyz` | ERR | "Unsupported talent type" |
| F-6 | quest-submit (HandInItem subitem) | task has a HandInItem → `quest-submit --task-id {tid}` | L2 | success:true or missingItems |
| F-7 | quest-claim (progress=full) | after subitems complete → `quest-claim --type daily` | L2 | success:true, rewards credited — SKIP if progress not full |
| F-8 | ERR submit missing task-id | `quest-submit` | ERR | "Missing required parameter: --task-id" |
| F-9 | ERR claim invalid type | `quest-claim --type xyz` | ERR | "Unsupported task type" |
| F-10 | quest-dialog (accept via NPC) | `query-near-entities --type npc` → take a nearby NPC → navigate → `quest-dialog --npc-cid {cid}` | L2 | action=accepted/completed — SKIP if no NPC |
| F-11 | ERR dialog invalid npc-cid | `quest-dialog --npc-cid 99999` | ERR | "NPC not found" |
| F-12 | quest-normal-claim | find an isSelfEnd-completed main quest → `quest-normal-claim --task-id {tid}` | L2 | success:true — SKIP if no isSelfEnd completion |
| F-13 | quest-normal-abandon | `quest-normal-list` → take an active task → `quest-normal-abandon --task-id {tid}` | L1 | success:true — SKIP if no active task |
| F-14 | token-task-accept | `token-task-list` → take an unaccept task → `token-task-accept --task-id {tid}` | L2 | state=inprogress — SKIP if pools=[] |
| F-15 | token-task-claim | after subitems complete → `token-task-claim --task-id {tid}` | L2 | success:true — SKIP if not complete |
| F-16 | token-task-abandon | `token-task-abandon --task-id {tid}` | L3 | success:true, enters cooldown |
| F-17 | token-task-refresh | `token-task-refresh --talent battle` | L3 | task pool refreshed |
| F-18 | ERR token-task-refresh invalid talent | `token-task-refresh --talent xyz` | ERR | invalid-talent error |
| F-19 | close-token-task-reward-ui (immediately after F-15 claim) | `close-token-task-reward-ui` | L0 | success:true (closed=true after claim, closed=false without claim also counts as PASS) |

**ROLLBACK**: restore the quest-accepted state (e.g. after F-2 abandon, re-accept in F-3)

---

### Group G — Farming Chain (287s ownership window must be continuous)

**Pre-check**: `farm-query` finds a soil with status=empty; `switch-weapon --weapon-type hoe`

| # | Case | Command + Args | Risk | PASS Criterion |
|---|---|---|---|---|
| G-1 | farm-hoe (with hoe) | `farm-hoe --soil-id {sid}` | L3 | soil status changes to thirsty/growing |
| G-2 | farm-hoe --ignore-energy | `farm-hoe --soil-id {sid2} --ignore-energy true` | L3 | success:true — SKIP if energy>0 (cannot verify the flag) |
| G-3 | ERR hoe missing soil-id | `farm-hoe` | ERR | required-parameter error |
| G-4 | ERR hoe without hoe equipped | `switch-weapon --weapon-type sword` → `farm-hoe --soil-id {sid}` | ERR | "Has not equipped hoe" |
| G-5 | farm-water | `switch-weapon --weapon-type water-bottle` → wait until status=thirsty → `farm-water --soil-id {sid}` | L3 | status no longer thirsty |
| G-6 | ERR water wrong status | call on a non-thirsty soil | ERR | "not in thirsty state" |
| G-7 | farm-harvest (after maturity) | wait until status=harvestable → `farm-harvest --soil-id {sid}` | L2 | crops added to inventory — SKIP if not mature (may not finish within 287s) |
| G-8 | ERR harvest not mature | call on status=growing | ERR | "not mature" |
| G-9 | farm-eradicate (expired soil claimed by others) | `query-near-entities` → find an expired soil → `switch-weapon --weapon-type pickaxe` → `farm-eradicate --soil-id {sid}` | L3 | success:true — SKIP if no expired soil |
| G-10 | ERR eradicate already empty | `farm-eradicate --soil-id {empty_sid}` | ERR | "already empty, no need to eradicate" |

**Note**: G-1 → G-5 → G-7 must run sequentially within 287s; do not interleave other long commands.

---

### Group H — Full Pet Lifecycle

**Pre-check**: `query-pets` records originalPets / `query-capture-setup` checks skill state / `query-inventory --type pet-egg` finds eggs / `query-inventory --type food` finds feed / `query-inventory --type material` finds wash material

⚠️ **Serial business-flow test**: this group is ordered by the actual business flow (capture → follow → feed → wash → make egg → list → hatch). **The output of one case (petId / eggIid) is the input of the next**. If a case fails, mark its dependents as BLOCKED-SKIP, not FAIL.

⚠️ **Asset chain**: this group consumes 1 low-value pet (turned back into an egg by make-pet-egg) + a small amount of feed / wash material; the egg ends up on-chain and can be retrieved via onchain-nft-to-game (already counted in Group E's asset records).

⚠️ **monsterCid source**: Metal Mutt cid is actually **6** in client (matching the daily quest "Kill Metal Mutt monsterCid:6"); H-2 / H-6 should not hard-code the early protocol value 665 (deprecated). All monsterCids should be fetched live from `quest-list` / `query-near-entities --type monster` / the live monster table.

⚠️ **hatch-pet auto-refill mechanic (known server behavior, not a command BUG)**: once the client enters a hatching state, the slot is **periodically auto-refilled** by the server, causing:
- A brand-new `hatch-pet --egg-item-instance-id ...` may immediately return `success:false errors:["incubating pet not success"]`, but `query-pets` / response data shows **a hatch is already in progress** —— record this case as **KNOWN-FAIL** (the command itself is fine)
- The H-22 "no hatching" branch is almost impossible to trigger reliably; auto-hatch state is the default during the test — record it as **KNOWN-FAIL**
- Diagnosis path: before calling, check the hatch slot (`query-pets` or probe with `claim-pet`); a return of "not yet hatched" means the slot is occupied

| # | Case | Command + Args | Risk | PASS Criterion |
|---|---|---|---|---|
| **Pre — equip Capture skill** ||||
| H-0 | equip Capture into slot 3 | `set-skill-shortcut --skill-id 166 --slot 3` | L1 | shortcutSlots[2].skillId == 166 (restored in ROLLBACK) |
| **set-capture-prop chain** ||||
| H-1 | set-capture-prop (material item) | `query-inventory --type material` → first item → `set-capture-prop --item-instance-id {iid}` | L2 | success:true |
| H-2 | set-capture-prop --target | `set-capture-prop --item-instance-id {iid} --target 6` (Metal Mutt) | L2 | success:true, requiredPropCount is reasonable |
| H-3 | ERR missing item-instance-id | `set-capture-prop` | ERR | "Missing required parameter: --item-instance-id" |
| H-4 | ERR illegal prop (pet-egg) | `set-capture-prop --item-instance-id {petEggIid}` | ERR | "is not a prop that can be mounted to Capture skill" |
| H-5 | ERR --target invalid | `set-capture-prop --item-instance-id {iid} --target 0` | ERR | "--target must be greater than 0" |
| **capture-pet** ||||
| H-6 | capture-pet --target 6 (Metal Mutt) | preflight H-2 passed → `capture-pet --target 6` | L3 | success:true, new petId appears in query-pets — SKIP if preflight failed / no target in range |
| H-7 | ERR capture-pet missing target | `capture-pet` | ERR | "Missing required parameter: --target" |
| **summon ↔ dismiss** ||||
| H-8 | pet-summon follow (newly captured petId) | after H-6 diff `query-pets` for newPetId → `pet-summon --pet-id {newPetId} --action follow` | L1 | followingPetId == newPetId |
| H-9 | ERR pet-summon missing pet-id | `pet-summon --action follow` | ERR | "Missing required parameter: --pet-id" |
| H-10 | ERR pet-summon dismiss not following pet | `pet-summon --pet-id {otherPetId} --action dismiss` | ERR | "is not this pet" |
| **feed / wash** ||||
| H-11 | pet-feed | `pet-feed --pet-id {newPetId}` | L2 | hunger increases — SKIP if no feedable item |
| H-12 | ERR pet-feed not following | first `pet-summon dismiss` → `pet-feed --pet-id {newPetId}` | ERR | "Only the currently following pet can be fed" (re-follow afterwards) |
| H-13 | pet-wash | `pet-wash --pet-id {newPetId}` | L2 | success:true — SKIP if wash material is insufficient |
| H-14 | ERR pet-wash missing material | pick a pet with no wash material (or wash until material is exhausted) | ERR | "wash material insufficient" |
| **dismiss** ||||
| H-15 | pet-summon dismiss | `pet-summon --pet-id {newPetId} --action dismiss` | L1 | followingPetId == 0 |
| **make pet-egg (consumes source pet)** ||||
| H-16 | make-pet-egg (consumes newPetId) | `make-pet-egg --pet-id {newPetId}` | L3 | createdEgg present or removedFromPetList=true |
| H-17 | ERR make-pet-egg missing pet-id | `make-pet-egg` | ERR | "Missing required parameter: --pet-id" |
| **list (egg goes on-chain)** ||||
| H-18 | nft-to-onchain (the produced egg) | after H-16 `query-inventory --type pet-egg` → find new egg → `nft-to-onchain --nft-id {eggIid} --amount 1` | L1 | onchain count +1, inventory count -1 |
| **hatch path (use a different egg)** ||||
| H-19 | hatch-pet (other hatchable egg) | `query-inventory --type pet-egg` → take another egg → `hatch-pet --egg-item-instance-id {iid}` | L3 | success:true hatch begins — **KNOWN-FAIL** if it returns "incubating pet not success" but data shows hatching (auto-refill); SKIP if a hatch is already in progress |
| H-20 | ERR hatch-pet already hatching | immediately call `hatch-pet ...` again | ERR | "A pet egg is already hatching" |
| H-21 | claim-pet | `claim-pet` | L2 | success:true or "not yet hatched" — SKIP if hatch not finished |
| H-22 | ERR claim-pet no hatching | call `claim-pet` with no hatching state | ERR | "There is no hatching pet egg" — **KNOWN-FAIL** if the server's auto-refill keeps a hatch always present (the protocol's default state) |

**ROLLBACK**:
- H-0 Capture in slot 3: leave it to the user to keep or not (Group C ROLLBACK already explains set-skill-shortcut is one-way)
- H-8 / H-15 paired (dismiss already retrieved)
- After H-16 newPetId becomes an egg and cannot be restored (asset awareness: use the lowest-value pet)
- H-18 on-chain can be retrieved via `onchain-nft-to-game` (counted under Group E); not required

**Known protocol issues**:
- set-capture-prop returns success:true but with all query fields empty (blocker tier display) when captureSkillLearned=false or captureInShortcut=false; H-0 must equip Capture before the full mountedProp fields are visible
- capture-pet has its own target-finding + movement logic; do not call navigate before it
- hatch-pet hatch time is long (TimeoutSeconds=1800); H-19~H-21 should not wait for hatch completion, focus on verifying the command itself works
- hatch-pet auto-refill: the server periodically restarts hatching, causing H-19 to report "incubating pet not success" while a hatch is actually in progress, and making H-22's "no hatching" branch impossible to construct (see ⚠️ above the table)
- make-pet-egg irreversibly consumes the source pet; **the user must explicitly specify the petId**; automation must not pick a high-value pet on its own

---

### Group I — Combat Actions (high-energy gated)

**Pre-check**: `query-status` confirm energy ≥ 30; HP ≥ 40%; combat weapon equipped

| # | Case | Command + Args | Risk | PASS Criterion |
|---|---|---|---|---|
| I-1 | auto-combat 1 target | find a monster cid → `auto-combat --target {mc} --count 1 --timeout 30` | L3 | success:true or endReason explicit |
| I-2 | auto-combat --search-mode wait | `auto-combat --target {mc} --count 1 --search-mode wait --timeout 30` | L3 | success:true |
| I-3 | auto-combat --ignore-energy | `auto-combat --target {mc} --count 1 --ignore-energy true --timeout 15` | L3 | success:true |
| I-4 | ERR combat count out of range | `auto-combat --target {mc} --count 6` | ERR | "1-5" |
| I-5 | ERR combat missing target | `auto-combat` | ERR | required-parameter error |
| I-6 | auto-gather 1 unit | find a resource cid → `auto-gather --target {rc} --count 1 --timeout 30` | L3 | success:true |
| I-7 | ERR gather count out of range | `auto-gather --target {rc} --count 6` | ERR | "1-5" |
| I-8 | escape-combat (in combat) | while in combat → `escape-combat --timeout 20` | L3 | endReason=escaped — SKIP if not in combat |
| I-9 | ERR escape not in combat | call when not in combat | ERR | "not in combat" |
| I-10 | ERR escape timeout out of range | `escape-combat --timeout 1` | ERR | "5-60" |
| I-11 | fish | rod + bait + fish point → `fish --target {fishCid} --timeout 30` | L2 | success:true — SKIP if bait=0 |
| I-12 | ERR fish missing target | `fish` | ERR | required-parameter error |
| I-13 | animal-pet | `animal-query` → take an unowned animal → `switch-weapon brush` → `animal-pet --entity-id {eid}` | L2 | success:true |

**ROLLBACK**: combat actions are mostly irreversible consumption (monsters / resources); verifying the energy decrease is enough.

---

### Group J — Team / Escort / Teleport

**Pre-check**: `team-query` confirms inTeam=false; this group has three segments:
1. **Join-other-team flow (J-1~J-4)**: passively respond to invitations; if no invitation arrives, the entire segment is SKIP
2. **Self-built team flow (J-5~J-10)**: full create → invite → escort → disband chain
3. **No-team-state commands (J-11~J-15)**: rely on the post-J-10 disband state to test ERR + totem / back-to-town

| # | Case | Command + Args | Risk | PASS Criterion |
|---|---|---|---|---|
| J-1 | team-reply accept | wait for an invitation → `team-reply --team-id {tid} --inviter-id {iid} --action accept` | L1 | inTeam=true — SKIP if no invitation |
| J-2 | team-reply reject | `team-reply --team-id {tid} --inviter-id {iid} --action reject` | L1 | success:true — SKIP if no invitation |
| J-3 | ERR reply invalid action | `team-reply --team-id 1 --inviter-id 1 --action xyz` | ERR | "must be accept or reject" |
| J-4 | team-leave from another team | after J-1 accept → `team-leave` | L1 | inTeam=false — SKIP if J-1 SKIPped |
| J-5 | team-create (self-built team skeleton) | `team-create` | L1 | inTeam=true, isLeader=true |
| J-6 | team-invite | `team-invite --player-name {existing player}` | L1 | success:true — SKIP if no online player |
| J-7 | ERR invite missing param | `team-invite` | ERR | "Must specify --player-id or --player-name" |
| J-8 | ERR invite not leader | while in another team → `team-invite ...` | ERR | "must be the team leader" — SKIP if no other-team state |
| J-9 | escort-accept | after J-5 with leader role + maxToday>0 → `escort-accept` | L1 | inEscort=true — SKIP if maxToday=0 |
| J-10 | team-disband (close out self-built team skeleton) | `team-disband` | L1 | inTeam=false |
| J-11 | ERR leave not in team | after J-10 → `team-leave` | ERR | "Not currently in a team" |
| J-12 | ERR escort not leader | after J-10 → `escort-accept` | ERR | "must be the team leader" |
| J-13 | totem-teleport | `query-totem-list` → take a totem → `totem-teleport --x {x} --y {y} --z {z}` | L1 | totemId matches the list |
| J-14 | ERR totem-teleport missing x | `totem-teleport --y 0 --z 0` | ERR | x required-parameter error |
| J-15 | back-to-town | `back-to-town` | L1 | player position = town |

**ROLLBACK**: J-10 already disbanded the self-built team explicitly; after J-1 accept the J-4 leave completes the pair; if any step accidentally leaves inTeam=true, run an extra `team-disband` / `team-leave` before finishing.

---

### Group K — Survival / Revive / High-Cost

**Pre-check**: sufficient energy / HP; pick the lowest-value asset for testing

| # | Case | Command + Args | Risk | PASS Criterion |
|---|---|---|---|---|
| K-1 | revive respawn | when the character is dead → `revive --type respawn` | L3 | HP > 0, in-place respawn — SKIP if not dead |
| K-2 | revive town | when the character is dead → `revive --type town` | L3 | HP > 0, teleported to town — SKIP if not dead |
| K-3 | ERR revive not dead | `revive --type town` while HP > 0 | ERR | "Player character is not dead; revive is not needed" |
| K-4 | ERR revive invalid type | `revive --type xyz` | ERR | "unsupported revive type" |
| K-5 | energy-manage buy | not in debt → `energy-manage --action buy --count 1` | L3 | energy increased — SKIP if IsOwing |
| K-6 | energy-manage borrow | CanBorrow=true → `energy-manage --action borrow --count 1` | L3 | debt incurred — SKIP if borrowing not available |
| K-7 | energy-manage repay | IsOwing=true → `energy-manage --action repay` | L3 | debt cleared — pairs with K-6 |
| K-8 | ERR energy buy count=0 | `energy-manage --action buy --count 0` | ERR | "must be greater than 0 for buy" |
| K-9 | ERR energy invalid action | `energy-manage --action xyz` | ERR | "supports: buy, borrow, repay" |
| K-10 | use-item (low-value consumable) | pick the lowest-value itemCid → `use-item --item-instance-id {iid}` | L2 | item count -1 |
| K-11 | ERR use-item both missing | `use-item` | ERR | "requires --item-instance-id or --item-cid" |
| K-12 | craft-execute (recipe with sufficient material) | pick the lowest-cost recipe → `craft-execute --recipe {rid} --count 1` | L3 | product +1 |
| K-13 | ERR craft missing recipe | `craft-execute` | ERR | required-parameter error |
| K-14 | ERR craft recipe does not exist | `craft-execute --recipe 99999` | ERR | "Recipe does not exist" |
| K-15 | enhance-equipment (sufficient enhance stones) | `query-totem-list` → take totemId → unequip → `enhance-equipment --item-instance-id {iid} --totem-id {tid}` | L3 | newLevel > originLevel — SKIP if enhance stones insufficient; re-equip after the test |
| K-16 | ERR enhance equipment is worn | with an item worn on the body → `enhance-equipment ...` | ERR | "Unequip the equipment before enhancing it" |
| K-17 | ERR enhance missing stones | enhance stone count = 0 → `enhance-equipment ...` | ERR | "enhance stones insufficient" |

**ROLLBACK**: re-equip the item after K-15; K-6 + K-7 pair clears the energy debt.

---

### Group L — Mutex Lock Specialist (MUTEX)

**Pre-check**: ensure no residual long command (`lumiterra stop` safety net); from `query-near-entities` take a nearby monster cid / resource cid + a NavMesh-reachable coordinate

| # | Case | Command + Args | Risk | PASS Criterion |
|---|---|---|---|---|
| L-1 (M-1) | dual long-command mutex | background `navigate --x ... &` → immediately `auto-combat --target {mc}` | L0 | the second returns "A long-running command is already running: navigate" or similar |
| L-2 (M-2) | stop cancels a long command | background `auto-gather --target {rc} &` → `stop` | L0 | stoppedCommands contains "auto-gather"; drained=true |
| L-3 (M-3) | new long command after stop | after `stop` → `navigate ...` | L0 | the new command starts successfully (arrived=true or running) |

**ROLLBACK**: after L-3, run `lumiterra stop` once more as a safety net to ensure no residual.

---

### Group Execution Order Summary

```
A → B → C → D → E → F → G → H → I → J → K → L
```


Run `lumiterra stop` between groups as a safety net; whenever state changes, run PRE / POST reconciliation.

---

## Phase 3 — Workflow Integration Smoke Test

**Goal**: run one happy path per L1 workflow to verify the steps connect end-to-end; **do not cover command variants again** (already done in Phase 2).

**Precondition**: Phase 1 + Phase 2 produced no FAIL; the file referenced by the workflow is the source of truth.

**PASS criterion**: the step sequence described by the workflow runs through, decision branches trigger correctly, and the final goal is reached.

### Workflow List

| # | Workflow | Reference File | Smoke Path (simplest happy path) |
|---|---|---|---|
| 1 | L1-get-item | `references/earn-workflows/L1-get-item.md` | pick an existing material → step 1 immediately completed |
| 2 | L1-1~3 daily | `L1-1-to-3-daily-quests.md` | accept daily → complete 1 subitem → claim |
| 3 | L1-4 token pool | `L1-4-token-tasks.md` | with an inprogress task → claim — SKIP if pools=[] |
| 4 | L1-5 craft | `L1-5-craft.md` | pick a recipe with enough material → craft 1 → verify +1 |
| 5 | L1-6 combat farming | `L1-6-combat-farming.md` | pick a target monster → auto-combat 1 → verify drop |
| 6 | L1-7 fishing | `L1-7-fishing.md` | rod + bait → fish 1 → verify +1 — SKIP if bait=0 |
| 7 | L1-8 enhance | `L1-8-enhance-equipment.md` | unequip → totem-teleport → enhance → re-equip |
| 8 | L1-9 equipment recycle | `L1-9-equipment-recycle.md` | 9A: dismantle → record → claim verify; 9B: SKIP if pools=[] |
| 9 | L1-10 totem | `L1-10-totem.md` | totem-list → totem-teleport |
| 10 | L1-11 escort | `L1-11-convoy.md` | team-create → escort-accept → follow until end — SKIP if maxToday=0 |
| 11 | L1-12 pet training | `L1-12-pet-train.md` | follow → feed → short auto-combat loop → verify ability exp |
| 12 | L1-13 pet egg | `L1-13-pet-egg.md` | user explicitly specifies petId → make-pet-egg → verify egg generated |
| 13 | L1-15 NFT staking | `L1-15-nft-stake-smelt.md` | stake 1 of the lowest value → verify in query-staked |
| 14 | L1-nft on/off chain | `L1-nft-on-off-chain.md` | to-onchain 1 → off-chain 1 → balance restored |
| 15 | L1-17/18 main/side quests | `L1-17-18-normal-quests.md` | with an active task → complete → claim — SKIP if tasks=[] |

### Phase 3 Known Protocol Issues

| Issue | Impact | Notes |
|---|---|---|
| `query-spawn-point --type gather` has no cid | L1-6 | navigate to the area first, then take cid via `query-near-entities` |
| farm-harvest soil ownership ~287s expiry | L1-6 | hoe → water → harvest must complete back-to-back |
| escape-combat must be in combat | L1-6 | when auto-combat runs in background, sleep 2 then call |
| hatch-pet auto-hatch occupies the slot | L1-13 | the slot is auto-refilled immediately after claim-pet, KNOWN-FAIL |
| claim-pet without hatching returns success:false | L1-13 | "no hatching pet egg" is a normal state, record SKIP not FAIL |

---

## Summary Report Format

After each Phase finishes output a subtotal; after everything finishes output a grand total.

### Counting Granularity

- **Phase 1**: per-command (each variant counted independently)
- **Phase 2**: per-variant (each case = 1; ERR error branches counted independently)
- **Phase 3**: per-workflow (any command FAIL inside a workflow → workflow FAIL)
- **Per-command rollup (REQUIRED)**: across Phase 1+2+3, fold all cases of the same CLI command (e.g. `toggle-pvp`, `equip`, `craft-execute`) into **a single row** (the same command name MUST NOT appear twice; deduplicate before output) and report PASS/SKIP/FAIL/KNOWN-FAIL counts; ERR branches that returned the expected error keyword count as PASS
- **Test account baseline (REQUIRED)**: the report opens with a baseline snapshot to make SKIP causes easy to investigate. Includes: level / HP / energy / currency (tokenCount) / itemWealthValue / three-talent level+treeLevel / pets totalCount+maxPetLimit+followingPetId / key asset counts (enhance stones 945/946/947, equipment shards 738/747/756, energy potion 1040, hatch material 693, capture lure 30) + farm-soil count / animal count / quest state / token-task pools / escort maxToday

### Report Template

```
=== Lumiterra CLI Auto-Test Report v2 ===
Run time: YYYY-MM-DD HH:mm

--- Test account baseline ---
Role:    roleId=XXX  level=X  HP=XXX/XXX  energy=XX/XXX  camp=pvp/peace
Finance: tokenCount=XXX  itemWealthValue=XXX
Talent:  battle lv=X tree=X / farming lv=X tree=X / gather lv=X tree=X
Pets:    X/15  following=XXX  remainingSlots=X
Key assets: enhance stones battle/gather/farming = X/X/X
            equipment shards battle/farming/gather = X/X/X
            energy potion=X  spirit of nature=X  capture lure (Green Slime)=X
Environment: farmSoils=X  animals=X  quest-daily=ON_DOING/none  token-task pools=X  escort maxToday=X

Phase 1 (independent queries):  XX PASS / XX SKIP / XX KNOWN-FAIL / XX FAIL  (total XX cases)
Phase 2 (command matrix):       XX PASS / XX SKIP / XX BLOCKED-SKIP / XX KNOWN-FAIL / XX FAIL  (total XX cases)
  - L0:  XX PASS
  - L1:  XX PASS / XX paired
  - L2:  XX PASS
  - L3:  XX PASS
  - ERR: XX PASS (error branch)
Phase 3 (workflow smoke):       XX PASS / XX SKIP / XX FAIL  (total 15 workflows)
Group L (mutex specialist):     X PASS / X FAIL  (total 3 cases)

--- FAIL details ---
[Phase 2 / Group X / case ID] Reason: ...
[Phase 3 / L1-X] Failed step: ... Reason: ...

--- BLOCKED-SKIP details ---
[Phase 2 / Group X / case ID] Predecessor failed: case Y did not pass

--- SKIP details ---
[Phase 1 / case] Reason: state reason (executable but no precondition data)
[Phase 2 / Group X / case ID] Reason: state reason / asset awareness

--- KNOWN-FAIL details ---
[Phase 3 / L1-13 hatch-pet] Reason: auto-hatch occupies the slot (known server mechanic)

--- Asset-restore confirmation ---
- weapon slot / talent nodes / following pet / team / camp etc. L1 state fully restored
- Test-consumed asset list (L2/L3): xxx

--- Per-command rollup ---
| Command | PASS | SKIP | FAIL | Notes |
|---|---|---|---|---|
| query-app-info        | 1 | 0 | 0 | |
| query-status          | X | 0 | 0 | PRE/POST-CHECK does not count toward case totals |
| query-inventory       | X | 0 | 0 | covers every --type variant |
| query-pets            | 1 | 0 | 0 | |
| toggle-pvp            | X | 0 | X | A-2/A-3/A-4/A-5 |
| navigate              | X | 0 | 0 | A-1/A-6/L-1/L-3 etc. |
| equip                 | X | 0 | 0 | B-1~B-8 + ROLLBACK |
| talent-manage         | X | 0 | 0 | B-9~B-14 |
| team-create           | X | 0 | 0 | |
| team-disband          | X | 0 | 0 | |
| team-invite / leave / reply | X | X | 0 | |
| switch-weapon         | X | 0 | 0 | C-1~C-12 |
| set-skill-shortcut    | X | 0 | 0 | C-13~C-19 |
| dismantle-equipment   | X | X | 0 | |
| claim-dismantling-mats| X | 0 | 0 | |
| craft-lottery         | X | X | 0 | |
| do-equipment-recovery | X | X | 0 | |
| claim-recycle-reward  | X | X | 0 | |
| nft-to-onchain        | X | 0 | 0 | E-1/E-3~E-5/H-18 |
| onchain-nft-to-game   | X | 0 | 0 | E-2/E-6 |
| nft-stake             | X | 0 | 0 | |
| nft-smelt             | X | 0 | 0 | |
| quest-accept / abandon / submit / claim | X | X | 0 | |
| quest-dialog          | X | X | 0 | |
| quest-normal-claim / abandon | X | X | 0 | |
| token-task-*          | X | X | 0 | |
| close-token-task-reward-ui | 1 | 0 | 0 | |
| farm-hoe / water / harvest / eradicate | X | X | 0 | |
| set-capture-prop      | X | 0 | 0 | |
| capture-pet           | X | X | 0 | |
| pet-summon            | X | 0 | 0 | |
| pet-feed / pet-wash   | X | X | 0 | |
| make-pet-egg          | X | 0 | 0 | |
| hatch-pet / claim-pet | X | X | 0 | |
| auto-combat           | X | 0 | 0 | I-1~I-5/L-1 |
| auto-gather           | X | 0 | 0 | I-6/I-7/L-2 |
| escape-combat         | X | X | 0 | |
| fish                  | X | X | 0 | |
| animal-pet            | X | 0 | 0 | |
| escort-accept / status| X | X | 0 | |
| totem-teleport        | X | 0 | 0 | |
| back-to-town          | 1 | 0 | 0 | |
| revive                | X | X | 0 | K-1~K-4 |
| energy-manage         | X | X | 0 | K-5~K-9 |
| use-item              | X | 0 | 0 | K-10/K-11 |
| craft-execute         | X | 0 | 0 | K-12~K-14 |
| enhance-equipment     | X | X | 0 | |
| stop                  | X | 0 | 0 | A-7/A-8/L-2/L-3 + safety net |

> Note: the table above is a reference skeleton; the actual report should only list **commands actually exercised in this run**, adding/removing rows accordingly. Each command's stats fold all of its appearances across Phase 1/2/3 and every Group.
```
