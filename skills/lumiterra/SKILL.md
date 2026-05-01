---
name: lumiterra
description: |
  Control Lumiterra game characters via `lumiterra` CLI. Use whenever
  interacting with Lumiterra - questing, crafting, gathering, fighting,
  fishing, farming, NFT management, equipment enhancement.
  Triggers: lumiterra, game automation, farm iron ore, do quests, enhance equipment.
license: MIT
allowed-tools: Bash(lumiterra:*)
version: 0.1.3
---

# Lumiterra Game Control

You control a Lumiterra character via the `lumiterra` CLI.

## Game Context

Lumiterra is an open-world, real-time combat GameFi MMORPG.
This CLI wraps the available game operations as scriptable commands so agents can execute them automatically.

- **Three talents**: combat (`battle`) / gathering (`gather`) / farming (`farming`).
- **Core Earn activities**: token-pool tasks, escort missions, NFT staking/smelting, equipment recycle-pool airdrops, daily/bounty quests.
- **Energy**: precondition for most yield-producing actions; when energy is 0, some actions are blocked by the CLI unless `--ignore-energy` is used.
- **World objects**: soil / animal / monster / NPC objects are identified by 64-bit entity ids.

## Prerequisites


- Lumiterra game running (HTTP server auto-discovered on localhost:24366-24375, then legacy 7860).
- `lumiterra` CLI installed. If missing, run `./scripts/install-cli.sh`.

## Hard Rules - MUST read every task

### 1. Respect Player Assets (CRITICAL)

> Every item is a player asset. Do not proactively consume assets without authorization.

- Treat every inventory item as an asset: equipment, materials, props, pet eggs, potions, and food.
- **NEVER call these commands without explicit user authorization**:
  - `dismantle-equipment` (dismantle equipment)
  - `do-equipment-recovery` (deposit into recycle pool)
  - `nft-smelt` (smelt NFT)
  - `nft-to-onchain` / `onchain-nft-to-game` (move assets on-chain or back to game)
  - `use-item` for consumables that disappear, decrement count, or permanently break after use
  - `enhance-equipment` because enhancement can damage or downgrade gear
- If uncertain, default to doing nothing and ask the user.

### 2. Spend Currency Carefully (CRITICAL)

> Spending, borrowing, and on-chain actions always require authorization.

- Game currency (`lvMon`, tokens, bound currency) and on-chain assets are scarce resources.
- High-risk commands include `energy-manage --action buy|borrow`, shop purchases, NFT on-chain moves, and escort staking/betting actions.
- Before spending, ask three questions:
  1. Did the user explicitly allow this?
  2. Is there a free alternative?
  3. Does the expected reward justify the cost?

### 3. Energy Gate (CRITICAL)

> When energy is 0, actions may appear to succeed but produce **no yield**; fishing is the exception.

| Action | When energy is 0 |
|------|----------|
| Monster combat | Can fight, but no drops and no experience |
| Gather entity | Can gather, but no drops |
| Crop harvest | Can harvest, but no drops |
| Animal petting | Can pet, but no drops |
| Hoe soil | **Blocked directly** |
| Fishing | Does not consume energy and is not limited |
| Quest / activity / on-chain yield | Depends on the specific source |

**MUST run `query-status` and read energy before actions.** If energy is insufficient, follow the refill order in §4.

> Natural experience sources: `battle` mainly comes from `combat` monster fighting; `gather` mainly comes from gathering resources; `farming` mainly comes from world `farm-harvest` crop harvest and `animal-pet` animal petting.

- `farm-hoe` / `farm-water` are only setup actions for `farm-harvest`; they move soil toward a harvestable state and **do not count as farming experience by themselves**.
- When experience is insufficient, prefer stable same-talent daily/bounty quest chains (`quest-list` / `quest-accept` / `quest-submit`) or same-talent `token-task` chains (`token-task-list` / `token-task-accept` / `token-task-claim`).

### 4. Energy Refill Order (MUST)

> Use physical inventory items first. Borrowing or buying comes later.

1. `query-inventory --type food` to find energy potions or food.
2. `use-item` to recover energy.
3. If no physical items are available **and the user authorized it**, run `energy-manage --action buy|borrow`.
   > **buy/borrow does not directly restore energy**: it only creates energy potion items. Real recovery still requires `use-item --item-instance-id <potionID>` to consume the potion.
4. Borrowed energy is **interest-bearing debt** and can consume later yield; net profit is often negative.
5. After borrowing, remember `energy-manage --action repay`.

**If energy becomes insufficient inside a loop:** stop and report. **Do not decide by yourself** to borrow or buy.

### 5. Three Talents

> `battle` / `gather` / `farming`; these correspond to the `--talent` parameter.

- Quests, equipment, skills, and yields are separated by talent.
- `quest-accept`, `token-task-*`, inventory filtering, and skill switching must use the matching `--talent`.
- Wrong talent means the quest may not be recognized, equipment may not be wearable, or the skill may not work.

### 6. Cross-Talent Equipment Crafting

> Equipment recipes for the three talents depend on each other. Do not assume each talent crafts only its own gear.

- Battle gear may require gathering materials plus farming materials.
- Before crafting, run `query-recipes` to inspect material requirements; coordinate across talents when needed.
- By default, `query-recipes` only returns unlocked recipes. If the target is missing and `lockedRecipeCount > 0`, use `--include-locked` or `--recipe-id` to confirm whether the recipe is only locked.
- This affects §8 preparation: switching to a talent does not mean the matching gear can be crafted immediately.

### 7. Wear Level vs Enhancement Level

| Concept | Field | Decides |
|------|------|------|
| Wear level | `useLv` | Whether the character can wear it (`level >= useLv`) |
| Enhancement level | `enhanceLevel` | Stat bonus; does not decide wearability |

- If the user says "level 5 sword", default to wear level unless they explicitly say "+5 enhancement".
- `query-stakeable-nft` / `query-staked` group by `(itemCid, enhanceLevel)`.

### 8. Full Target Gear Set (Talent + Level)

> Mixed gear, low-level gear, or wrong-talent gear can cause instant combat death or sharply lower gathering/farming yield.

Execution flow:
1. Confirm the target level and talent requirement.
2. Run `query-inventory --type wearable --talent <...> --lv <targetLv>`.
3. If the full set exists, proceed.
4. If pieces are missing, **do not brute-force the target**. Decide:
   - Can the missing pieces be filled quickly by crafting, buying, or taking from storage?
   - Can a lower-level target be used?
   - Should the user confirm continuing anyway?

### 9. HP Safety Line (HARD RULE)

> HP < 40% requires immediate disengage and natural recovery.

- After every `query-status`, compute `hp/maxHp`.
- If below 40%, **immediately** run: `escape-combat` -> move away / mount -> wait for auto recovery -> if needed `back-to-town` -> `revive` after death.
- **Do not default to HP potions** unless one of these is true:
  - The user explicitly says potions may be used, such as "use potions if needed".
  - The user specifies another recovery path, such as a particular food, skill, or NPC.
- Re-read HP at the start of every long-loop iteration.
- Choose `revive --type respawn` versus `revive --type town` based on user context and distance.

> Each action cycle: §9 -> §3/§4 -> §8 -> §1/§2.

### 10. Call CLI Strictly by Spec (CRITICAL)

> NEVER invent command names, flag names, or enum values. All available values come from the spec.

**Before calling**

- For unfamiliar commands, first read the command's "Parameters" table in [references/commands/](references/commands/). That table is authoritative.
- Backup channel: `lumiterra --help` lists all command specs at once. The CLI does not support per-command help; passing `<cmd> --help` still prints the full table, so locate the command yourself.
- Any value not listed in the spec, including natural-looking synonyms, is invalid. Do not "try it once".

**Forbidden actions**

- Never pass enum parameters such as `--type` with values that sound reasonable but are not listed in the spec. Examples that do not exist: `--type world-resource`, `--type wild-resource`, `--type game-asset`.
- Do not try flag names that are not listed in the spec, such as trying `--types`, `--kind`, or `--category` instead of `--type`.
- After an error, do not retry with a "more natural" spelling. The legal values returned in the error message are ground truth.

**Wrong -> correct**

| Wrong call | Correct handling |
|---|---|
| `query-near-entities --type world-resource` | `world-resource` does not exist. Choose from legal `--type` literals: use `world-animal` for wild animals and `resource` for gatherable resources. See [core.md](references/commands/core.md). |
| `query-near-entities --types player` | The flag is `--type`, with no `s`. |
| `query-near-entities --type Player` | Use lowercase hyphenated literals. Validators may accept aliases such as `EntityTypePlayer`, but prefer the exact literals listed in the spec. |

**Error loop**

- If an error says `--xxx only supports a/b/c/...`, choose from that list and retry. **Do not invent another spelling**.
- If an error says an argument is unknown, stop and return to [references/commands/](references/commands/).
- To interrupt a long command, send `lumiterra stop`; do not SIGKILL.

## 64-bit ID Precision Pitfall (CRITICAL)

Server-returned `entityId` / `soilId` / `petId` / `itemInstanceId` / `teamId` / `roleId` / `totemId` / `nftId` values are 64-bit integers and usually exceed `2^53` (about 9x10^15). **By default, jq parses numbers as C doubles with only 53 bits of precision, which changes trailing digits to 0.** Passing that ID back to the CLI will produce "not found".

```bash
# Wrong: trailing ID digits are changed, server cannot find it
ID=$(echo "$RESP" | jq -r '.data.entities[0].entityId')
# 4743910035246702080 -> 4743910035246702000

# Correct A: parse with python (recommended; built-in big integers)
ID=$(echo "$RESP" | python3 -c "import json,sys;print(json.load(sys.stdin)['data']['entities'][0]['entityId'])")

# Correct B: grep the raw string (no third-party dependency)
ID=$(echo "$RESP" | grep -oE '"entityId"[[:space:]]*:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+$')

# Correct C: let the CLI print the field and paste it as-is
lumiterra query-near-entities --type world-animal --limit 2 --pretty
# Read entityId from JSON and paste it unchanged into the next command
```

Rules:
- **Never extract a 64-bit ID from JSON with `jq -r '.xxxId'`**. `| tostring` does not help because precision is already lost during parse.
- `jq` may be used for string fields (`name`, `status`, `type`) and small integer fields (`count`, `lv`, `radius`), but large IDs require python or grep.
- If unsure about value range, treat the field as a large ID: `entityId / soilId / petId / itemInstanceId / nftId / totemId / teamId / roleId / chainId / taskId`.

### SubItem Structured Fields

`quest-list` / `quest-claim` / `quest-normal-list` / `token-task-list` return subItems using the same TaskOption structure. Agents can dispatch operation atoms directly by `type`; `optionKind` preserves the protocol-layer `TaskOptionType` name for debugging.

```json
{
  "desc": "Kill Forest Wolf",
  "curRate": 0, "maxRate": 5,
  "type": "KillMonster",
  "monsterCid": 10023,
  "guiderPoint": 42,
  "guidePos": {"x": 120, "y": 0, "z": 340}
}
```

| type | Extra fields | Meaning |
|------|---------|------|
| `UserLevel` | `level` | Required character level; no direct atom. Stop and report a level blocker if unmet. |
| `KillMonster` | `monsterCid` | Target monster CID, passed directly to `auto-combat --target`. |
| `GetItem` / `HandInItem` / `UseItem` | `itemCid`, `num`, `nftId` | Target item CID, count, and optional NFT ID. |
| `TargetPosition` | `targetPos` {x, y, z, radius} | Target coordinates, passed directly to `navigate --x --y --z`. |
| `GatherResource` | `resourceCid`, `num` | Resource CID and count to gather. |
| `HarvestHomeItem` | `seedCid`, `num` | Seed CID and count to harvest. |
| `Watering` | `seedCid` | Target seed CID. **One progress unit means one full planting cycle** through all watering stages until growth completes, not one watering action. Use `farm-water` repeatedly until the seed finishes growing. |
| `PetAppease` | `petCid` | Target pet CID for animal petting, used with `animal-pet`. |
| `UseRecipe` | `recipeId`, `times` | Recipe ID and repeat count, used with `craft-execute --recipe`. |
| `RecipeUseCount` | `count` | Total craft count; choose a craftable recipe with `query-recipes --craftable`, then run `craft-execute`. |
| `FinishTaskCount` / `FinishTaskListCount` | `taskListType`, `count` | Complete the specified task chain/type `count` times. `taskListType`: `daily` -> daily/bounty workflow, `bounty` -> bounty workflow, `talent` -> token-task workflow. |
| `TalentLevel` | `talentType`, `level` | Target talent level; use `query-talent` to find the gap, then `talent-manage` as needed. |
| `NodeLevel` | `nodeId`, `level` | Target talent node level; locate with `query-talent`, then `talent-manage` as needed. |
| `NpcDialog` | `npcCid`, `dialogCount` | NPC CID, used with `quest-dialog --npc-cid`. |
| `CaptureTargetPet` | `petCid`, `num` | Pet CID and count, used with `capture-pet`. |
| `DungeonChapterPass` | `dungeonId`, `chapterId`, `count` | Dungeon objective; current CLI has no dungeon-clear atom. Stop and report a blocker. |

Common fields: `guiderPoint` (guide resource point ID) + `guidePos` (parsed coordinates). Most quest types include them.

**guidePos caveat:** `Watering` and `PetAppease` have empty `guidePos`; they do not navigate to a fixed point but to a farm or animal area. When navigation is needed, use `query-spawn-point --type farm --cid <seedCid>` or `--type animal --cid <petCid>`.

### Shared TaskOption Atom Dispatch

Main/side quests, daily/bounty quests, and token tasks all use the same subItem dispatch table. Token tasks do not need a separate atom set; use `token-task-*` only for task-pool actions such as accept, refresh, claim, and abandon.

All type names come from `CliSubItemSerializer.cs DataCase.ToString()` and share the `TaskOptionType` proto enum.

| TaskOption type | Shared atom / workflow |
|------|------|
| `UserLevel` | `query-status`; if `level` is below the requirement, report a blocker. Level shortage cannot be auto-resolved. |
| `KillMonster` | `query-spawn-point --type monster --cid <monsterCid>` -> `navigate` -> `switch-weapon` for combat weapon -> `auto-combat --target <monsterCid>` |
| `GatherResource` | `query-spawn-point --type gather --cid <resourceCid>` -> `navigate` -> `switch-weapon` for the matching tool -> `auto-gather --target <resourceCid>` |
| `GetItem` | Run `Workflow: Get Item`; prefer the itemCid path because the subItem already provides `itemCid`. |
| `HandInItem` | `quest-submit --task-id` -> if `missingItems`, run `Workflow: Get Item` for each missing `itemCid` -> retry `quest-submit`. |
| `UseItem` | `query-inventory` to find the target `itemInstanceId` -> `use-item --item-instance-id <itemInstanceId>`. |
| `UseRecipe` | Check materials -> `craft-execute --recipe <recipeId>`, repeat `times`. |
| `RecipeUseCount` | `query-recipes --craftable` -> choose a craftable recipe -> loop `craft-execute` until `count`. |
| `TargetPosition` | `navigate --x --y --z` using `targetPos`. |
| `NpcDialog` | `query-spawn-point --type npc --cid <npcCid>` -> `navigate` -> `quest-dialog --npc-cid <npcCid>`. |
| `TalentLevel` | `query-talent` -> find `talentType` trunk node -> `talent-manage --action upgrade --talent-type <talentType>` until `level`. |
| `NodeLevel` | `query-talent` -> find `nodeId` -> `talent-manage --action upgrade --talent-type <type> --node-id <nodeId>` until `level`. |
| `FinishTaskCount` | `taskListType` (`daily`/`bounty`/`talent`) -> recursively call the matching quest workflow until `count` completions. |
| `FinishTaskListCount` | `taskListType` (`daily`/`bounty`/`talent`) -> recursively call the matching quest workflow until `count` completions. |
| `HarvestHomeItem` | `query-spawn-point --type farm --cid <seedCid>` -> `navigate` -> planting loop (hoe -> water -> harvest) until `curRate` reaches `maxRate`. |
| `Watering` | `query-spawn-point --type farm --cid <seedCid>` -> `navigate` -> hoe if needed -> `farm-water` loop until growth completes; one progress unit is one full planting cycle. |
| `PetAppease` | `query-spawn-point --type animal --cid <petCid>` -> `navigate` -> `animal-query` -> `switch-weapon brush` -> `animal-pet` loop. Never extract `entityId` with jq. |
| `CaptureTargetPet` | `query-capture-setup --target <petCid>` -> resolve blockers -> `capture-pet --target <petCid>` loop. |
| `DungeonChapterPass` | No CLI dungeon atom yet; report blocker (`dungeonId`/`chapterId`/`count`); poll `quest-normal-list --task-id <taskId>` every 30s until `completed=true`. |
| unknown `type` | Stop and report unsupported task option with raw subItem. |

## Response Format

All commands return:
```json
{"success": true, "data": {}, "earnings": null, "errors": []}
```
- Check `success` after every call; on `false`, read the `errors` array.
- Add `--pretty` for indented output.

## Task Routing - What the User Says -> Which Reference to Read

| User intent | Read first |
|---|---|
| "Give me N X" / "missing materials" | `references/earn-workflows/L1-get-item.md` |
| "gather X / mine ore / chop wood / cut grass / gather herbs" | `references/base-workflows/SW-1-gather-entity.md` |
| "plant X / water / harvest X" | `references/base-workflows/SW-2-crop-farming.md` |
| "pet X / brush X / batch petting" | `references/base-workflows/SW-3-animal-petting.md` (direct user request entry; **do not accept a farming quest automatically**) |
| "fight X / farm X / clear X" | `references/base-workflows/SW-4-combat-loop.md` |
| "fish X once" | `references/base-workflows/SW-5-fishing-loop.md` |
| "world farming patrol" | `SW-2-crop-farming.md` + `SW-3-animal-petting.md`; **MUST do farm plots before animals** (30s timeout + serial order) |
| "today's daily / bounty" | `references/earn-workflows/L1-1-to-3-daily-quests.md` |
| "token-pool task" | `references/earn-workflows/L1-4-token-tasks.md` |
| "main / side quest" | `references/earn-workflows/L1-17-18-normal-quests.md` |
| "craft X" | `references/earn-workflows/L1-5-craft.md` |
| "fishing profit loop" | `references/earn-workflows/L1-7-fishing.md` |
| "escort" | `references/earn-workflows/L1-11-convoy.md` |
| "enhance equipment" | `references/earn-workflows/L1-8-enhance-equipment.md` |
| "dismantle equipment / claim materials" | `references/earn-workflows/L1-9-equipment-recycle.md#9a-equipment-dismantling` |
| "equipment recycle pool / airdrop" | `references/earn-workflows/L1-9-equipment-recycle.md#9b-equipment-recycle-pool-airdrop` |
| "totem" | `references/earn-workflows/L1-10-totem.md` |
| "NFT staking / smelting" | `references/earn-workflows/L1-15-nft-stake-smelt.md` |
| "NFT on-chain / back to game" | `references/earn-workflows/L1-nft-on-off-chain.md` |
| "train pet / raise pet" | `references/earn-workflows/L1-12-pet-train.md` |
| "make pet egg" | `references/earn-workflows/L1-13-pet-egg.md` |
| "farm monsters for materials" | `references/earn-workflows/L1-6-combat-farming.md` |

## Commands Reference (Quick Summary)

Most commonly used commands. See [references/commands/](references/commands/) for complete command parameters.

| Command | Purpose | Details |
|---|---|---|
| `query-app-info` | Language / version / platform | [query.md](references/commands/core.md) |
| `query-status` | HP / energy / position | [query.md](references/commands/core.md) |
| `query-inventory` | Inventory filtering | [query.md](references/commands/core.md) |
| `query-battle-areas` | Scene BattleArea regions | [query.md](references/commands/core.md) |
| `query-item-sources` | Acquisition routes | [crafting.md](references/commands/crafting.md) |
| `query-spawn-point` | Spawn points | [query.md](references/commands/core.md) |
| `query-recipes` | Recipes | [crafting.md](references/commands/crafting.md) |
| `navigate` | Auto-pathfinding | [action.md](references/commands/action.md) |
| `auto-combat` | Automated combat | [action.md](references/commands/action.md) |
| `auto-gather` | Automated gathering | [action.md](references/commands/action.md) |
| `escape-combat` | Disengage from combat | [action.md](references/commands/action.md) |
| `use-item` | Use item | [survival.md](references/commands/survival.md) |
| `equip` | Equip / unequip gear | [equipment.md](references/commands/equipment.md) |
| `switch-weapon` | Switch weapon | [equipment.md](references/commands/equipment.md) |
| `stop` | Interrupt loop | [action.md](references/commands/action.md) |
| `revive` | Revive | [survival.md](references/commands/survival.md) |
| `energy-manage` | Buy / borrow energy | [survival.md](references/commands/survival.md) |

See [references/commands/](references/commands/) for all command groups and roughly 90 commands.

## Operating Principles

- **HP < 40% -> disengage and recover immediately (HARD RULE)** - after every `query-status` / combat loop, compute `hp/maxHp`; below 40% requires `escape-combat` -> move away -> wait for recovery. Do not use potions by default unless authorized. See Hard Rules §9.
- **Assets are sacred** - every inventory item is a player asset. Without explicit user authorization, never call `dismantle-equipment` / `do-equipment-recovery` / `nft-smelt` / `nft-to-onchain` / `onchain-nft-to-game` / consumable `use-item` / discard. See §1.
- **Spend money only with explicit consent** - `energy-manage --action buy|borrow` and any currency-spending action are disabled by default. Use physical inventory items first; if none exist, ask the user. Borrowing has interest. buy/borrow creates energy potion items; actual recovery requires consuming them with `use-item`. See §2-4.
- **Energy gates real yield** - run `query-status` before actions. When energy is 0, actions may look successful but yield nothing except fishing. See §3.
- **Match talent + full gear to target** - before talent-specific work, run `query-inventory --type wearable --talent <x> --lv <n>` and check for a full set. If pieces are missing, downgrade or fill the gap instead of brute-forcing. See §5-8.
- **User abort signal -> call `lumiterra stop` FIRST** - when the user says stop/abort/cancel/pause or similar, the first action **MUST** be `lumiterra stop` with no parameters. Do not explain first, do not run `query-status` first, and do not wait for loops to exit naturally. Afterward read `stoppedCommand` to confirm what was stopped.
- **Never extract 64-bit IDs via `jq -r '.xxxId'`** - precision is already lost during parse. Use `python3 -c` or `grep -oE`. See "64-bit ID Precision Pitfall".
- **Direct user action is not a quest workflow** - if the user directly says "pet animal / water / harvest / fish", run the corresponding SW workflow. Do not automatically accept daily/bounty/token tasks. Wild `world-animal` entities can be petted directly; do not accept a `PetAppease` quest first.
- **Idempotent & retryable** - commands are retryable; on failure, **report the error** instead of continuing silently.
- **Never guess IDs** - always get real IDs through `query-*`, not from memory or templates.
- **Target state, not step count** - judge completion by the target state, not by "step 1 finished". Resolve blockers such as missing materials, missing skills, or missing feed, then return to the blocked step.
- **30s window on world entities** - soil, animals, and other world objects must be used within their 30s actionable window. Otherwise rerun `animal-query` / `farm-status`.
- **Always check `success`** - never assume success; read the response and use the `errors` array to decide retry/skip/report.
- **Chain data via return values** - feed IDs and coordinates from one command into the next.
- **Pet care** - `claim-pet` has no parameters because there is one hatch slot. `pet-feed` does not support `--food-id` and auto-selects the first available food. Player and pet share the equipment inventory; do not move gear the player is currently wearing onto the pet. Before combat/gathering, give the pet the highest wearable gear and keep hunger around 50%.
- **`query-spawn-point` `--cid` = entity cid** - pass the ConfigId of a monster/resource/seed/pet/fish/npc, **not** the target item's `itemCid`. If the CID is unknown, use `--keyword` for fuzzy name search.
- **quest-submit vs quest-claim** - `quest-submit --task-id` submits HandInItem materials; if it returns `missingItems`, run Get Item for each missing `itemCid` and retry. `quest-claim` claims rewards after all subtasks are complete. They are independent.
- **query-inventory `--type` accepts multiple values** - space-separated or comma-separated; multiple types are ORed, and `--lv` / `--talent` are ANDed with them.
