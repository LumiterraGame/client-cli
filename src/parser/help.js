export function helpText() {
  return `Lumiterra CLI - AI Agent game control tool

Usage: lumiterra <command> [--param value]

General query commands:
  query-app-info                        Query basic app info (language, version, platform)
  query-status                          Query character status (level, HP, energy, position)
  query-inventory [--type <all|wearable|food|material|pet-egg>] [--lv <required-level>] [--talent <battle|farming|gather>] [--item-cid <CID>] [--item-instance-id <instance-id>]
                                        Filter backpack items (example: --type material wearable pet-egg food; comma-separated values are also supported; supports exact filtering by itemCid / itemInstanceId)
  query-wallet                          Query wallet token balance (tokenCount)

  query-zone                            Query the player's zone (zoneId/zoneName/sceneType/sceneSubtype/isPvp)
  query-equipment [--target-id <ID>]     Query equipped gear on the current entity (defaults to current protagonist or character; can target pets and other entities)
  query-battle-areas                    Query all BattleArea regions in the current scene (AreaID, center, size, description)
  query-near-entities --type <player|pet|npc|resource|monster|world-animal> [--radius <meters>] [--limit <1-100>] [--cid <CID>]
                                        Query nearby currently loaded entities (runtime EntityMgr view; default radius 100, default limit 10)
  query-spawn-point --type <monster|npc|gather|fish|farm|animal> (--cid <ID> | --keyword <keyword>)
                                         Query the nearest spawn point/area coordinates; one of --cid or --keyword is required

Action commands:
  navigate --x <x> --y <y> --z <z>     Auto-navigate to 3D coordinates
  auto-combat --target <CID> [--count <1-5>] [--timeout <seconds>] [--search-mode <wait|patrol>] [--patrol-radius <tiles>] [--ignore-energy]
                                        Auto combat: kill monsters with the specified CID (count defaults to 1, max 5; rejects at 0 energy by default, --ignore-energy can force execution)
  escape-combat [--timeout <5-60-seconds>]
                                        Escape combat: keep moving toward the lowest-threat reachable direction until the protagonist leaves combat
  auto-gather --target <CID> [--count <1-5>] [--timeout <seconds>] [--search-mode <wait|patrol>] [--patrol-radius <tiles>] [--ignore-energy]
                                        Auto gather: gather resources with the specified CID (count defaults to 1, max 5; rejects at 0 energy by default, --ignore-energy can force execution)
  fish --target <CID> [--timeout <30-300-seconds>]
                                        Fish: target fish cid is required, timeout defaults to 90s; supports interruption by stop within 2s
  set-skill-shortcut --skill-id <skill-id> --slot <1-3> [--weapon-type <type>]
                                        Set a skill to the specified weapon group shortcut slot (defaults to the currently active group)
  set-capture-prop --item-instance-id <prop-id> [--target <CID>]
                                        Attach a capture prop to the Capture skill; when target is provided, also estimates whether the prop is enough to capture that target
  stop                                  Stop the current long-running command
  back-to-town                          Return the character to town (use when the character is stuck)

Wild animal commands:
  animal-query [--entity-id N | --cid N] Query animal status (no args = all; entity-id = one item; cid = filter by species)
  animal-pet --entity-id <N> [--ignore-energy]  Pet an animal (first petting obtains ownership; rejects at 0 energy by default, --ignore-energy can force execution)

Crafting commands:
  craft-execute --recipe <recipe-id> --count <count>  Craft items
  query-recipes [--recipe-id <recipe-id>] [--include-locked] [--level <level>] [--talent-type <battle|farming|gather>] [--craftable]
                                        Query recipes (only unlocked by default; lockedRecipeCount indicates hidden locked recipes)
  query-item-sources --item-cid <ID>     Query all acquisition sources for an item

Equipment commands:
  equip --action equip --item-instance-id <equipment-id> | --item-cid <CID> [--wearer-id <wearer-id>]
                                        Equip gear (defaults to protagonist; wearer can be a character ID or pet ID)
  equip --action unequip [--wearer-id <wearer-id>] --slot <equipment-slot>
                                        Unequip gear from the specified slot (defaults to protagonist; head/coat/pant/shoe/hand/weapon)
  switch-weapon --weapon-type <sword|hoe|axe|...>
                                        Switch by weapon type (automatically selects the highest-level wearable weapon)
  enhance-equipment --item-instance-id <equipment-id> --totem-id <totem-id> [--use-protective-stone <true|false>]
                                        Enhance equipment (returns beforeItemInstanceId = pre-enhancement itemInstanceId and afterItemInstanceId = new enhanced instance ID; when enhancement stones are insufficient, returns enhanceStoneItemCid/material; totem ID supports NFT ID or scene entity ID; protective stone defaults to false)
  dismantle-equipment --item-instance-id <equipment-id...> Submit an equipment dismantling request (supports batch input; asynchronously enters the dismantling queue)
  claim-dismantling-mats --record-id <dismantling-record-id>
                                        Claim fragments from a completed dismantling record (does not open the dismantling result UI)
  do-equipment-recovery --pool-id <pool-id> --item-instance-id <item-id...> [--count <count>]
                                        Put equipment/fragments into the shared recovery pool (when multiple items are provided, each count is 1)
  claim-recycle-reward --pool-id <previous-reward-pool-id>
                                        Claim the previous recovery pool airdrop reward
  query-dismantling-record [--begin <0-start>] [--count <count>]
                                        Query the equipment dismantling record list
  query-recycle-pool [--pool-id <pool-id>] [--pool-type-id <config-id>]
                                        Query recovery pool list, points, deadline, and previous unclaimed airdrop
  query-recycle-record --pool-type-id <config-id> [--begin <0-start>] [--count <count>]
                                        Query recovery pool exchange/airdrop records

Farm commands:
  farm-hoe --soil-id <N> [--ignore-energy]      Hoe soil (empty soil only; rejects at 0 energy by default, --ignore-energy can force execution)
  farm-eradicate --soil-id <N>                   Eradicate soil (requires a pickaxe; clears owned or others' expired soil)
  farm-water --soil-id <N>                       Water soil
  farm-harvest --soil-id <N>                     Harvest mature crops
  farm-query [--soil-id N | --cid N]     Query farm soil status (no args = all; soil-id = one item; cid = filter by seed area)

NFT commands:
  query-stakeable-nft [--item-cid <CID>]     Query stakeable NFTs in the backpack (can filter by itemCid)
  nft-stake --items <nftId1:num1,nftId2:num2,...>
                                        Batch stake NFTs (up to 20 pairs; items come from nftId+count in query-stakeable-nft)
  query-staked                          Query staked NFT list
  nft-smelt --staked-nft-ids <nftId,...>      Smelt staked NFTs (up to 20, comma-separated)
  nft-to-onchain --nft-id <NFT-instance-id> --amount <count>
                                        Move backpack game items on-chain (nft-id comes from query-inventory or query-stakeable-nft)
  onchain-nft-to-game --nft-id <NFT-instance-id> --amount <count>
                                        Move on-chain items back into the game (nft-id comes from query-onchain-items)
  query-onchain-items [--item-cid <CID>]     Query on-chain item list (can filter by itemCid)

Pet commands:
  query-pets                            Pet list and details
  query-capture-setup [--target <CID>]  Query Capture prerequisites; without target, only basic setup is checked; target is recommended before capture
  pet-summon --pet-id <pet-id> --action <follow|dismiss>
                                                Summon or dismiss follow
  pet-feed --pet-id <pet-id>                    Feed the current following pet (automatically selects the first available food)
  make-pet-egg --pet-id <pet-id>               Turn a pet into a pet egg
  hatch-pet --egg-item-instance-id <pet-egg-id>                Start hatching and automatically claim the pet after completion
  claim-pet                                    Claim the completed pet in the current hatching slot (manual fallback)
  pet-wash --pet-id <pet-id>                   Reroll pet attributes
  capture-pet --target <CID>            Capture the specified CID animal as a pet (automatically estimates whether the currently attached prop is enough before execution)

Quest commands:
  quest-list [--type <daily|bounty>]    View quest list
  quest-accept --type <daily|bounty> --talent <battle|farming|gather>  Accept a quest
  quest-claim --type <daily|bounty>     Claim rewards for completed quests
  quest-abandon --type <daily|bounty>  Abandon a quest chain
  quest-abandon --taskId <ID>          Abandon a normal quest
  quest-normal-list [--task-id <ID>] [--type <main|side>]
                                       Main/side quest status (returns only canAccept/active by default)
  quest-dialog --npc-cid <CID>         Talk to the specified NPC (automatically accepts/turns in quests)
  quest-normal-claim --task-id <ID>    Directly claim completed quest rewards (isSelfEnd quests)
  quest-submit --task-id <ID>          Submit HandInItem items (normal quest/token task)
  quest-normal-abandon --task-id <ID>  Abandon a main/side quest

Token pool quest commands:
  token-task-list [--talent <battle|farming|gather>]  View token pool quest list (by talent direction; returns all if omitted)
  token-task-accept --task-id <ID>                    Accept a token pool quest (state=unaccept)
  token-task-claim --task-id <ID>                     Claim token pool quest rewards (after all subtasks are complete)
  close-token-task-reward-ui                          Close the full-screen reward UI after claiming token task rewards
  token-task-abandon --task-id <ID>                   Abandon an accepted token pool quest (requires in-game cooldown eligibility)
  token-task-refresh [--talent <battle|farming|gather>] Refresh token pool quest list (refreshes all directions if omitted)

Survival and energy commands:
  use-item --item-instance-id <item-id> | --item-cid <CID> [--count <count>]     Use potions/food
  revive --type <respawn|town>                    Revive
  energy-manage --action <buy|borrow|repay> [--count <count>]
                                                Energy purchase/borrow/repay

Talent commands:
  query-talent [--talent-type <battle|farming|gather>] [--talent-node-id <node-id>]
                                        Talent tree, experience, and unlocked skills (--talent-type is ignored when --talent-node-id is provided)
  talent-manage --action <upgrade|downgrade> --talent-type <battle|farming|gather> --node-id <node-id>
                                                Manage talent node upgrade/downgrade (downgrade only trunk)

Team commands:
  team-create [--name <name>] [--desc <description>] [--public <true|false>]
                                        Create a team (name defaults to a runtime-generated leader team name, public defaults to true)
  team-disband                          Disband the team (leader only)
  team-leave                            Leave the team
  team-invite --player-id <RoleID> | --player-name <nickname>
                                        Invite a player to join the team (waits 10s for acceptance; supports cancellation by stop within 2s)
  team-reply --team-id <ID> --inviter-id <ID> --action <accept|reject>
                                        Reply to an invitation (read from team-query.pendingInvites)
  team-query                            Query current team status + pendingInvites

Escort commands:
  escort-accept                         Accept the escort task in the current open period (requires leader + ticket + level + remaining attempts)
  escort-status                         Query escort progress (inEscort / progress / wagonPosition / team / times)

PvP commands:
  toggle-pvp --mode <peace|pvp>         Switch camp (idempotent; query-status.camp is updated accordingly)

Totem commands:
  query-totem-list                      World totem information (status, prize pool)
  query-near-totem --x <x> --y <y> --z <z>  Nearest totem to the specified coordinates
  totem-teleport --x <x> --y <y> --z <z>  Teleport to the nearest totem to the specified coordinates

Options:
  --pretty    Pretty-print JSON output
  --help      Show help`;
}
