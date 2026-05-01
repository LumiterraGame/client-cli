# SW-3: animal-petting — animal petting

> Source of truth: this file. Number index: SW-3 (agents can locate it by number or name as dual keys).
>
> This file merges three sources:
> - Original SW-3 atom (single-animal petting loop; see the SW-3 section in `docs/subworkflows.md`)
> - `SKILL.md` L1022-1054 "Workflow: Pet Animals on Demand" — shortest path for direct user requests to pet animals in bulk (Entry B)
> - The animal-care portion of `SKILL.md` L1106-1136 "World Farmland and Animal Care Cycle" + 30s operation-window HARD RULE
>
> **Strategy**: do not create a separate "batch mode" section. Entry A (atomic) and Entry B (batch shortest path) are laid out as two trigger entries; the 30s operation window + serial-by-default rules are written into this file as HARD RULES.

## Trigger conditions

| Type | Example / value |
|---|---|
| User intent keywords | "pet X", "brush X", "pet animals", "pet that pig", "pet the animals" |
| L1 subtask type | `PetAppease` |
| `query-item-sources.type` | `animal_pet` |

## Input parameters

| Parameter | Required | Description |
|---|---|---|
| `animalCid` (= target animal CID) | No | ConfigId of the target animal; may be omitted when Entry B does not filter by species |
| `targetPetCount` | No | Target petting count (controls loop exit); when omitted, the user or outer workflow decides |

## Trigger entries (two types)

### Entry A: called by an upper-level L1 workflow orchestration (atomic mode)

- Referenced by these L1 workflows:
  - `L1-1-to-3-daily-quests.md` (farming daily + bounty, animal branch)
  - `L1-4-token-tasks.md` (when token-pool tasks involve petting)
  - `L1-get-item.md` (dispatches here when `source.type = animal_pet`)
  - L1-5 crafting (`animal_pet` materials), L1-17/18 (`PetAppease` subtask)
- Parameter mapping (Get Item -> SW-3): `animalCid = source.sourceId`, `targetPetCount = shortage × multiplier`

### Entry B: direct user request for batch petting (independent shortest path)

When the user directly asks to pet animals and it is **not bound to any task**, use this shortest path.

Trigger phrases: "pet N animals" / "brush N pigs" / "pet the animals" / "pet that pig" / **"large-world farming and animal patrol"** (the SKILL.md routing table points this phrase to both SW-2 + SW-3; the agent **must finish farmland (SW-2) before animals**) and similar phrases.

```
1. lumiterra query-status
   -> Confirm the character is alive

2. lumiterra query-near-entities --type world-animal --radius 100 --limit <N>
   -> Directly get the wild / farm animal list near the player
   -> When extracting entityId from JSON, **do not use jq** (64-bit precision trap; see SKILL.md §64-bit ID precision trap)
   -> Use python3 or grep extraction, for example:
     python3 -c "import json,sys;r=json.load(sys.stdin);print('\n'.join(str(e['entityId']) for e in r['data']['entities']))"

3. lumiterra switch-weapon --weapon-type brush
   -> Petting requires a brush. If there is no brush, the CLI reports an error; then follow L1-get-item.md to craft one.

4. For each entityId, run serially:
   lumiterra animal-pet --entity-id <entityId>
   -> Petting each animal takes about 15-30 seconds
   -> The server-side operation window for large-world animals is about 30 seconds; after timeout it resets to empty state.
     After obtaining an entityId, run animal-pet immediately; do not insert unrelated queries / thinking / waiting.

5. Stop when the requested count is complete
   -> Do not automatically accept daily quests / token-tasks, and do not "also" eradicate plots or capture pets.
```

> **HARD RULE — Entry B must not drift** (explicit forbidden items; none may be softened):
> - Wrong: **do not** accept farming dailies / bounties / token-pool tasks (when the user says "pet", just pet)
> - Wrong: **do not** first run `query-near-entities --type monster` and switch to combat
> - Wrong: **do not** first run `quest-accept --talent farming` to accept a quest
> - Wrong: **do not** use `jq -r '.data.entities[0].entityId'` to extract IDs (64-bit precision is definitely lost, and the CLI will report "animal not found")
> - Wrong: **do not** delay after obtaining entityId (server operation window is about 30s; if missed, query again)
> - Wrong: **do not** distinguish whether it is a task target / whether it is unowned — any `world-animal` can be petted
> - Wrong: **do not** interpret "petting" as "only possible through quests / capture flow": wild animals can also be petted, no farming daily required

## Execution steps (Entry A atomic flow, single animal / exact cid filtering)

```
1. lumiterra query-status
   <- Read hp and energy
   Petting with energy = 0 can still execute but gives **no drops**; material-farming goals must ensure energy > 0
   HP / MaxHP < 40% -> immediately follow the HP safety line; do not enter petting

2. lumiterra query-spawn-point --type animal --cid <targetAnimalCID>
   <- Query the large-world animal area coordinates (prefer navPosition)
   HARD RULE: do not skip this step and navigate directly; do not guess coordinates from memory
   No response -> return stalled-no-target and tell the user "this animal has no spawn point on the current map"

3. lumiterra navigate --x <navPosition.x> --y <navPosition.y> --z <navPosition.z>
   <- Move to the animal area

4. lumiterra animal-query --cid <targetAnimalCID>
   <- Filter pettable targets (includes entityId, ownerId, expireInSeconds, position)
   Must filter with --cid to avoid accidental operations when multiple animal species overlap in view
   Prefer ownerId = null (unowned) or expireInSeconds <= 0 (expired other-player animal can also be claimed)
   If none exist -> return stalled-no-target and tell the user "no pettable animals"

5. lumiterra switch-weapon --weapon-type brush
   <- Brush level (PetHappinessCapacity) must be >= animal.requiredHappiness
   No brush / insufficient level -> follow L1-get-item.md to craft / switch brush

6. Petting loop (iterate through the animal list returned by step 4):

   HARD RULE (30s timeout + serial by default): **after obtaining an entityId, execute animal-pet immediately**.
      Do not insert time-consuming steps such as query-status / query-inventory / navigate. See "Important notes".

   lumiterra animal-pet --entity-id <entityId>
   -> A single petting action takes about 15-30 seconds, grants ownership and drops
   -> Drops are sent by broadcast; progress is perceived through inventory delta

7. Result confirmation: lumiterra animal-query --entity-id <entityId>
   <- Verify status change (optional but recommended; O(1) single query)

8. Loop exit decision:
   - targetPetCount reached                         -> return completed and exit
   - after query-status, energy = 0 and the goal is material farming -> follow the energy gate; if insufficient, return stopped-low-energy
   - HP < 40%                                       -> disengage immediately and return stopped-blocker
   - animal-query repeatedly returns empty / no pettable animals -> switch area (rerun step 2); if still none -> stalled-no-target
   Otherwise return to step 4 and choose the next animal
```

## Important notes (HARD RULES)

> **HARD RULE — 30s operation window + serial by default** (merged from the animal portion of world-farmland-cycle + Pet Animals on Demand):
> - The server-side actionable window for large-world animals / soil is about **30 seconds** (soil is configured by `GameValue.WorldSoilNoOperateClearTime`; animals are the same order of magnitude). After timeout, the state resets to empty and must be queried again.
> - **Serial by default**: finish petting one animal (about 15-30s) before starting the next. After obtaining an `entityId`, run `animal-pet` **immediately** without inserting any query / thinking / waiting.
> - Only when the agent is sure it can rotate through the animals within 30s may it use small-batch concurrency (<= 2-3 animals).

- Warning: **Entry A must run `query-spawn-point --type animal --cid <targetAnimalCID>` before `navigate`, then `animal-query`**. Do not guess coordinates from memory.
- Warning: **Entry B uses `query-near-entities --type world-animal`** to directly get nearby animals; it does not need `query-spawn-point` first.
- Warning: **`animal-query` must pass `--cid` for exact filtering** (Entry A), avoiding accidental operations when multiple animal species overlap in view.
- Petting duration: about 15-30 seconds per animal. If the animal walks away during the process or the server reports "petting failed", the client may get stuck in the petting animation. If `lumiterra stop` cannot stop it, tell the user to restart the client.
- Equipment requirement: brush (`brush`). If missing, follow `L1-get-item.md` to craft one. Brush `PetHappinessCapacity` must be >= `animal.requiredHappiness`.
- Energy gate: petting **can execute without energy but gives no drops**. Material-farming goals must ensure energy > 0.
- Ownership period: after successful petting, the animal enters an ownership period (`expireInSeconds > 0` and ownerId is self); other players cannot operate it during this period. Expired other-player animals (`expireInSeconds <= 0`) can be claimed.
- HP safety line (HARD RULE): after every `query-status`, if `hp/maxHp < 40%`, the agent must immediately disengage. Do not use HP potions by default.
- **When called by Get Item**: the outer workflow is responsible for total inventory verification; this sub-workflow exits by `targetPetCount` and does not query `inventory` again.
- 64-bit `entityId`: **do not use `jq`**. If you need to extract `entityId` / `itemInstanceId` and similar fields from JSON, **do not** use `jq -r '.xxxId'` (precision trap; see SKILL.md §64-bit ID precision trap). Use `python3 -c 'import json,sys;...'` or `grep -oE`.

## Exit semantics (return-value convention)

The sub-workflow returns one of the following semantic states so the upper layer (Get Item / L1) can decide what to do next:

| State | Meaning |
|---|---|
| `completed` | `targetPetCount` reached; normal exit |
| `stalled-no-target` | No animal spawn point found / `animal-query` / `query-near-entities` repeatedly returned empty |
| `stopped-low-energy` | Energy gate failed (insufficient food and energy-manage was not authorized) |
| `stopped-blocker` | Hard blocker such as low HP / missing brush / insufficient brush level / ownership conflict |

## Notes / common mistakes

- Wrong: confuse `capture-pet` with `animal-pet`: the former captures pets and uses `--target CID`; the latter pets `world-animal` and uses `--entity-id`.
- Wrong: in Entry B, run `query-near-entities --type monster` instead of `world-animal` -> this switches to combat and completely drifts from the request.
- Wrong: in Entry B, run `quest-accept --talent farming` before petting -> the user did not ask to accept a quest; do not improvise.
- Wrong: use `jq -r '.data.entities[0].entityId'` to extract a 64-bit `entityId` -> precision is lost and `animal-pet` will definitely report "animal not found".
- Wrong: after obtaining `entityId`, insert `query-status` / `query-inventory` / `navigate` -> triggers the 30s operation-window timeout and resets the animal state to empty.
- Wrong: force petting with insufficient brush level (`PetHappinessCapacity < animal.requiredHappiness`) -> failure / low efficiency; switch brush or downgrade the target first.
- Wrong: in Entry B, drift "petting" into eradicating plots / capturing / combat / accepting quests. When the user says "pet", just pet, then stop after the requested count.
- Wrong: skip `query-spawn-point` and navigate directly to remembered animal coordinates (Entry A) -> the area may no longer be there.
- Wrong: pass the **finished itemCid** as `animalCid` to `query-spawn-point --cid` -> no result. You must first run `query-item-sources --item-cid <itemCid>` to get `sources[].sourceId` of type `animal_pet`, then pass it.
