# Lumiterra CLI Cheatsheet

> Human-facing cheatsheet.
**This is not a source of truth.** When changing code or workflows, update the source locations listed below.

## One-Minute Start

`lumiterra` is a CLI for controlling a Lumiterra GameFi MMORPG character. The local game must be running and listening on one port in `24366-24375`, or the legacy game CLI port `7860`; the CLI auto-discovers the first available Lumiterra instance.

```bash
./skills/lumiterra/scripts/install-cli.sh    # agent auto-install script
lumiterra query-status                        # test connectivity
```

## Source of Truth

| Content | Location |
|---|---|
| Command definitions (interface) | `src/parser/help.js` + `src/parser/validators/*.js` |
| Command reference docs | `skills/lumiterra/references/commands/*.md` (Phase 2 may make this generated) |
| Hard rules + pitfalls | `skills/lumiterra/SKILL.md` (inline, not split into files) |
| Earn workflows (L1-X) | `skills/lumiterra/references/earn-workflows/L1-*.md` |
| Base workflows (SW-X) | `skills/lumiterra/references/base-workflows/SW-*.md` |

## Command Index (Grouped, One Jump per Command)

### General Query (core)
- [`query-status`](../skills/lumiterra/references/commands/core.md#query-status) - current character status: level / HP / energy / coordinates / camp
- [`query-inventory`](../skills/lumiterra/references/commands/core.md#query-inventory) - inventory filtering by type / lv / talent / item-cid / instance-id
- [`query-wallet`](../skills/lumiterra/references/commands/core.md#query-wallet) - wallet token balances from local cache
- Wealth information is merged into `query-status`; see `onChainWealth` / `offChainWealth` / `totalWealth`
- [`query-zone`](../skills/lumiterra/references/commands/core.md#query-zone) - current zone information for PvP prechecks
- [`query-battle-areas`](../skills/lumiterra/references/commands/core.md#query-battle-areas) - all BattleArea regions in the current scene (AreaID / center / size / description)
- [`query-equipment`](../skills/lumiterra/references/commands/core.md#query-equipment) - equipped items / attributes / enhance level for the target entity
- [`query-near-entities`](../skills/lumiterra/references/commands/core.md#query-near-entities) - loaded nearby scene entities from the runtime perspective
- [`query-spawn-point`](../skills/lumiterra/references/commands/core.md#query-spawn-point) - nearest spawn point; requires `--cid` or `--keyword`

### Actions (action)
- [`navigate`](../skills/lumiterra/references/commands/action.md#navigate) - auto-pathfind to 3D coordinates (long-running)
- [`auto-combat`](../skills/lumiterra/references/commands/action.md#auto-combat) - search for and kill a monster with the specified CID (defaults to 1 kill)
- [`escape-combat`](../skills/lumiterra/references/commands/action.md#escape-combat) - soft escape from combat by moving toward the lowest-threat direction
- [`auto-gather`](../skills/lumiterra/references/commands/action.md#auto-gather) - automatically gather a resource with the specified CID (similar to auto-combat)
- [`fish`](../skills/lumiterra/references/commands/action.md#fish) - one complete fishing attempt (cast -> bite -> QTE -> collect)
- [`set-skill-shortcut`](../skills/lumiterra/references/commands/action.md#set-skill-shortcut) - place a skill in a weapon-group shortcut slot
- [`set-capture-prop`](../skills/lumiterra/references/commands/action.md#set-capture-prop) - attach a capture prop to the Capture skill
- [`stop`](../skills/lumiterra/references/commands/action.md#stop) - stop the current long-running command
- [`back-to-town`](../skills/lumiterra/references/commands/action.md#back-to-town) - return to town; useful for stuck positions or hard escape

### Wild Animals (animal)
- [`animal-query`](../skills/lumiterra/references/commands/animal.md#animal-query) - query animal status, filterable by entity-id / cid
- [`animal-pet`](../skills/lumiterra/references/commands/animal.md#animal-pet) - pet a world animal (10-30s, enters producing status)

### Crafting (crafting)
- [`craft-execute`](../skills/lumiterra/references/commands/crafting.md#craft-execute) - craft an item by recipeId at a crafting NPC (long-running)
- [`query-recipes`](../skills/lumiterra/references/commands/crafting.md#query-recipes) - recipe list; defaults to unlocked recipes only; `lockedRecipeCount` is the number of hidden locked recipes
- [`query-item-sources`](../skills/lumiterra/references/commands/crafting.md#query-item-sources) - all acquisition routes for an item (gathering / combat drop / crafting)

### Equipment (equipment)
- [`equip`](../skills/lumiterra/references/commands/equipment.md#equip) - equip or unequip gear for a character or pet
- [`switch-weapon`](../skills/lumiterra/references/commands/equipment.md#switch-weapon) - switch by weapon type; automatically chooses the highest UseLv
- [`enhance-equipment`](../skills/lumiterra/references/commands/equipment.md#enhance-equipment) - enhance equipment at a world totem (queue-style lottery flow)
- [`dismantle-equipment`](../skills/lumiterra/references/commands/equipment.md#dismantle-equipment) - submit equipment for dismantling, including batch mode
- [`claim-dismantling-mats`](../skills/lumiterra/references/commands/equipment.md#claim-dismantling-mats) - claim materials from completed dismantling records
- [`do-equipment-recovery`](../skills/lumiterra/references/commands/equipment.md#do-equipment-recovery) - deposit equipment/fragments into the recycle pool for score and airdrop eligibility
- [`claim-recycle-reward`](../skills/lumiterra/references/commands/equipment.md#claim-recycle-reward) - claim previous-period recycle-pool airdrop rewards
- [`query-dismantling-record`](../skills/lumiterra/references/commands/equipment.md#query-dismantling-record) - list dismantling records and recordIds for claiming fragments
- [`query-recycle-pool`](../skills/lumiterra/references/commands/equipment.md#query-recycle-pool) - recycle-pool list / score / cutoff time / previous airdrop
- [`query-recycle-record`](../skills/lumiterra/references/commands/equipment.md#query-recycle-record) - recycle-pool exchange and airdrop records

### Farm (farm)
- [`farm-hoe`](../skills/lumiterra/references/commands/farm.md#farm-hoe) - hoe soil / auto-sow, only for soil with `status=empty`
- [`farm-eradicate`](../skills/lumiterra/references/commands/farm.md#farm-eradicate) - clear occupied soil; requires a pickaxe equipped
- [`farm-water`](../skills/lumiterra/references/commands/farm.md#farm-water) - water soil to progress thirsty -> growing; returns `nextOpTime`
- [`farm-harvest`](../skills/lumiterra/references/commands/farm.md#farm-harvest) - harvest mature crops; soil returns to empty
- [`farm-query`](../skills/lumiterra/references/commands/farm.md#farm-query) - query farm soil status, filterable by soil-id / cid

### NFT
- [`nft-stake`](../skills/lumiterra/references/commands/nft.md#nft-stake) - batch stake inventory NFTs into the staking pool (max 20 pairs)
- [`nft-smelt`](../skills/lumiterra/references/commands/nft.md#nft-smelt) - smelt staked NFTs; destroys them and returns about 50% wealth value
- [`nft-to-onchain`](../skills/lumiterra/references/commands/nft.md#nft-to-onchain) - move an inventory game item on-chain as an NFT
- [`onchain-nft-to-game`](../skills/lumiterra/references/commands/nft.md#onchain-nft-to-game) - move an on-chain NFT back into the game inventory
- [`query-stakeable-nft`](../skills/lumiterra/references/commands/nft.md#query-stakeable-nft) - inventory NFT instances that can be staked
- [`query-staked`](../skills/lumiterra/references/commands/nft.md#query-staked) - staked NFT list for smelting
- [`query-onchain-items`](../skills/lumiterra/references/commands/nft.md#query-onchain-items) - on-chain item list for moving back into the game

### Pets (pet)
- [`query-pets`](../skills/lumiterra/references/commands/pet.md#query-pets) - pet list / attributes / follow status / hunger
- [`query-capture-setup`](../skills/lumiterra/references/commands/pet.md#query-capture-setup) - structured precheck for Capture skill and capture props
- [`pet-summon`](../skills/lumiterra/references/commands/pet.md#pet-summon) - summon a pet to follow or dismiss the current follower; only one pet can follow at a time
- [`pet-feed`](../skills/lumiterra/references/commands/pet.md#pet-feed) - feed the current following pet; CLI auto-selects food
- [`make-pet-egg`](../skills/lumiterra/references/commands/pet.md#make-pet-egg) - convert a pet into a pet egg, destroying the original pet instance
- [`hatch-pet`](../skills/lumiterra/references/commands/pet.md#hatch-pet) - start hatching a pet egg and auto-claim when complete
- [`claim-pet`](../skills/lumiterra/references/commands/pet.md#claim-pet) - manually claim a completed pet; fallback command
- [`pet-wash`](../skills/lumiterra/references/commands/pet.md#pet-wash) - reroll pet attributes, consuming materials and with no rollback
- [`capture-pet`](../skills/lumiterra/references/commands/pet.md#capture-pet) - capture a world animal by CID (rope / trap FSM)

### Quests (quest, including token pool)
- [`quest-list`](../skills/lumiterra/references/commands/quest.md#quest-list) - list daily / bounty quest chains
- [`quest-accept`](../skills/lumiterra/references/commands/quest.md#quest-accept) - accept a daily / bounty quest of a specified type + talent
- [`quest-claim`](../skills/lumiterra/references/commands/quest.md#quest-claim) - claim completed quest-chain rewards
- [`quest-abandon`](../skills/lumiterra/references/commands/quest.md#quest-abandon) - abandon either a quest chain or a normal quest
- [`quest-normal-list`](../skills/lumiterra/references/commands/quest.md#quest-normal-list) - list main / side quests
- [`quest-dialog`](../skills/lumiterra/references/commands/quest.md#quest-dialog) - talk to a specified NPC to auto-accept or turn in quests
- [`quest-normal-claim`](../skills/lumiterra/references/commands/quest.md#quest-normal-claim) - directly claim completed main / side quest rewards
- [`quest-submit`](../skills/lumiterra/references/commands/quest.md#quest-submit) - submit HandInItem subtask items; materials are selected automatically
- [`quest-normal-abandon`](../skills/lumiterra/references/commands/quest.md#quest-normal-abandon) - abandon a main / side quest; 5-minute cooldown
- [`token-task-list`](../skills/lumiterra/references/commands/quest.md#token-task-list) - list token-pool tasks, filterable by talent direction
- [`token-task-accept`](../skills/lumiterra/references/commands/quest.md#token-task-accept) - accept a token-pool task; requires `state=unaccept`
- [`token-task-claim`](../skills/lumiterra/references/commands/quest.md#token-task-claim) - claim token-pool task rewards
- [`close-token-task-reward-ui`](../skills/lumiterra/references/commands/quest.md#close-token-task-reward-ui) - close the full-screen reward UI after token-task claim
- [`token-task-abandon`](../skills/lumiterra/references/commands/quest.md#token-task-abandon) - abandon an accepted token-pool task; cooldown-constrained
- [`token-task-refresh`](../skills/lumiterra/references/commands/quest.md#token-task-refresh) - refresh the token-pool task list; CD-constrained

### Survival and Energy (survival)
- [`use-item`](../skills/lumiterra/references/commands/survival.md#use-item) - use consumable items (HP / energy potion / food)
- [`revive`](../skills/lumiterra/references/commands/survival.md#revive) - revive after death, either in place (`respawn`) or in town (`town`)
- [`energy-manage`](../skills/lumiterra/references/commands/survival.md#energy-manage) - energy operations: buy / borrow / repay; creates potion items

### Talents (talents)
- [`query-talent`](../skills/lumiterra/references/commands/talents.md#query-talent) - talent tree / experience / unlocked skills, optionally one talent type
- [`talent-manage`](../skills/lumiterra/references/commands/talents.md#talent-manage) - upgrade / downgrade talent nodes; downgrade only applies to trunk nodes

### Team / Escort / PvP (team-pvp)
- [`team-create`](../skills/lumiterra/references/commands/team-pvp.md#team-create) - create a team; current character becomes leader on success
- [`team-disband`](../skills/lumiterra/references/commands/team-pvp.md#team-disband) - disband the current team; leader only
- [`team-leave`](../skills/lumiterra/references/commands/team-pvp.md#team-leave) - leave the current team
- [`team-invite`](../skills/lumiterra/references/commands/team-pvp.md#team-invite) - invite a player by Role ID or visible nickname
- [`team-reply`](../skills/lumiterra/references/commands/team-pvp.md#team-reply) - reply to another player invite (accept / reject)
- [`team-query`](../skills/lumiterra/references/commands/team-pvp.md#team-query) - team status plus pendingInvites inbox
- [`escort-accept`](../skills/lumiterra/references/commands/team-pvp.md#escort-accept) - accept an escort quest during the current open window
- [`escort-status`](../skills/lumiterra/references/commands/team-pvp.md#escort-status) - query escort progress; `inEscort` is the only completion signal
- [`toggle-pvp`](../skills/lumiterra/references/commands/team-pvp.md#toggle-pvp) - switch PvP camp (peace / pvp), idempotent

### Totem (totem)
- [`query-totem-list`](../skills/lumiterra/references/commands/totem.md#query-totem-list) - list all world totems (status / reward pool)
- [`query-near-totem`](../skills/lumiterra/references/commands/totem.md#query-near-totem) - nearest totem to specified coordinates
- [`totem-teleport`](../skills/lumiterra/references/commands/totem.md#totem-teleport) - teleport to the nearest totem to specified coordinates

## Earn Workflow Cheatsheet (L1-X)

| L1 ID | Workflow | Purpose |
|---|---|---|
| L1-get-item | [get-item](../skills/lumiterra/references/earn-workflows/L1-get-item.md) | Acquire a specified item; routing core |
| L1-1-to-3 | [daily-quests](../skills/lumiterra/references/earn-workflows/L1-1-to-3-daily-quests.md) | Combat/gathering/farming daily + bounty quests |
| L1-4 | [token-tasks](../skills/lumiterra/references/earn-workflows/L1-4-token-tasks.md) | Token-pool tasks |
| L1-5 | [craft](../skills/lumiterra/references/earn-workflows/L1-5-craft.md) | Crafting for profit |
| L1-6 | [combat-farming](../skills/lumiterra/references/earn-workflows/L1-6-combat-farming.md) | Kill monsters for materials |
| L1-7 | [fishing](../skills/lumiterra/references/earn-workflows/L1-7-fishing.md) | Fishing |
| L1-8 | [enhance-equipment](../skills/lumiterra/references/earn-workflows/L1-8-enhance-equipment.md) | Equipment enhancement |
| L1-9 | [equipment-recycle](../skills/lumiterra/references/earn-workflows/L1-9-equipment-recycle.md) | Equipment resource recycling (dismantle + recycle pool) |
| L1-10 | [totem](../skills/lumiterra/references/earn-workflows/L1-10-totem.md) | Totems |
| L1-11 | [convoy](../skills/lumiterra/references/earn-workflows/L1-11-convoy.md) | Escort missions |
| L1-12 | [pet-train](../skills/lumiterra/references/earn-workflows/L1-12-pet-train.md) | Pet training |
| L1-13 | [pet-egg](../skills/lumiterra/references/earn-workflows/L1-13-pet-egg.md) | Pet egg creation |
| L1-15 | [nft-stake-smelt](../skills/lumiterra/references/earn-workflows/L1-15-nft-stake-smelt.md) | NFT staking and smelting |
| L1-nft-on-off | [nft-on-off-chain](../skills/lumiterra/references/earn-workflows/L1-nft-on-off-chain.md) | NFT on-chain / back-to-game movement |
| L1-17-18 | [normal-quests](../skills/lumiterra/references/earn-workflows/L1-17-18-normal-quests.md) | Main + side quests |

## Base Workflow Cheatsheet (SW-X)

| SW ID | Base Workflow | Purpose | Called By |
|---|---|---|---|
| SW-1 | [gather-entity](../skills/lumiterra/references/base-workflows/SW-1-gather-entity.md) | Gather-entity atom | L1-get-item, L1-1-to-3 |
| SW-2 | [crop-farming](../skills/lumiterra/references/base-workflows/SW-2-crop-farming.md) | Planting and harvest loop, including 30s serial hard rule | L1-1-to-3, world farming patrol |
| SW-3 | [animal-petting](../skills/lumiterra/references/base-workflows/SW-3-animal-petting.md) | Animal petting loop, including entry B and 30s hard rule | L1-1-to-3, world farming patrol, direct user request |
| SW-4 | [combat-loop](../skills/lumiterra/references/base-workflows/SW-4-combat-loop.md) | Monster combat loop | L1-1-to-3, L1-6, L1-get-item |
| SW-5 | [fishing-loop](../skills/lumiterra/references/base-workflows/SW-5-fishing-loop.md) | Fishing loop | L1-7 |

## Where to Change What

- **Add/change a command** -> edit `src/parser/help.js` + the matching `validators/*.js`, and **must sync** `skills/lumiterra/references/commands/*.md`.
- **Add/change an Earn workflow** -> edit the matching `skills/lumiterra/references/earn-workflows/*.md`.
- **Add/change a base workflow** -> edit the matching `skills/lumiterra/references/base-workflows/*.md`.
- **Add/change a hard rule / pitfall** -> edit `SKILL.md` directly; hard rules and 64-bit ID pitfalls live inline there, not in split files.
