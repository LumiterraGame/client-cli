# L1-5: Craft earning (craft)

> Source of truth: this file. When executing this workflow, agents **must** follow the order in the "Execution steps" section and may not merge or skip steps.
> Number index: L1-5.

This workflow is the only entry for "craft the target finished item": given a target item (`recipeId` known / name only), this L1 queries the recipe, recursively fills all missing materials, executes crafting, and verifies the result by backpack quantity delta.

## Trigger conditions

- Trigger phrases: "craft X" / "make X" / "manufacture X" / "synthesize X" / "make one X" / "craft N X"
- User explicitly says to make/craft/synthesize one finished product (equipment, tool, potion, consumable, processed material, etc.)
- Upper-level scenarios:
  - `HandInItem` subitem in daily-quest / token-task and target item has `source.type = craft`
  - When L1-get-item hits `source.type = craft`, it expands directly inside L1-get-item; if user **directly** asks in a "craft" wording, use this L1-5

## State maintained during execution (explicit variables; do not estimate verbally)

- `targetItemCid` -- target finished item itemCid
- `recipeId` -- recipe id for the target finished item
- `requiredCount` -- craft quantity requested by the user (N)
- `beforeCount` -- current finished-item inventory read by `query-inventory` before work starts
- `afterCount` -- finished-item inventory read again after crafting ends
- Each material's `need` (= per-craft material amount in recipe.materials × `requiredCount`) and `have`

## Success criteria

- **Must compare beforeCount / afterCount**: success only if `afterCount - beforeCount >= requiredCount`
- Only seeing `craft-execute` return `success=true` **does not count as success**; existing item in backpack alone also cannot be treated as craft completion
- If `afterCount - beforeCount == 0` (or < requiredCount), inspect `craft-execute` error messages and `data.stage` to locate failure (`navigate` / `interact` / `craft_submit` / `craft_wait` / `craft_extract`)

## Preconditions / Blockers

**Self-check before starting** (report blocker early when unmet):

- Character alive & HP safety line: `query-status`; `hp/maxHp < 40%` -> first follow HP safety line (`escape-combat` -> move away / `back-to-town`), do not enter production chain
- Energy: crafting itself usually does not consume energy, but material-filling `gather` / `combat` / `farm-harvest` / `animal-pet` returns "success but no drops" at `energy = 0`; pass the energy gate before filling materials
- Name resolution ambiguity: user only gives a name and `query-recipes` has multiple tied candidates that cannot be resolved uniquely -> **report blocker directly; do not choose randomly**
- Recipe unlock state: when `recipe.unlocked = false`, it cannot be crafted; report blocker and tell unlock condition
- Crafting scene: needs to be near the corresponding crafting station; `craft-execute` automatically `navigate`s to suitable position; on failure, inspect `data.stage`

## Execution steps (numbered; do not skip)

```
1. lumiterra query-status
   -> Confirm character alive & HP safety line; if unsafe, follow survival workflow first and return

2. Resolve recipe
   lumiterra query-recipes
     -> Prefer `--recipe-id` / `--level` / `--talent-type` / `--craftable` to narrow scope
     -> Add `--include-locked` only when locked recipes are genuinely needed
     -> If default result misses target and returns `lockedRecipeCount > 0`, first recheck with `--include-locked` to see if it is only locked
     -> Find target recipe from result; record recipeId, unlocked, materials list
   a. User gave recipeId / itemCid
      -> Directly `query-recipes --recipe-id <recipeId>` (or filter by itemCid), record targetItemCid and materials
   b. User only gave name / description
      -> Choose candidates by priority:
        1. recipe.name exact match
        2. highest overlap with description keywords
        3. most consistent with current task context
      -> Unique candidate -> record recipeId and targetItemCid
      -> No candidate or still tied -> report blocker; do not choose randomly

3. Inventory snapshot (current finished-item count)
   lumiterra query-inventory --item-cid <targetItemCid>
   -> Record beforeCount (if not in backpack, beforeCount = 0)
   -> Do not skip crafting just because beforeCount > 0; when user explicitly asks to "craft N items",
      goal is afterCount - beforeCount >= requiredCount, not "exists in backpack"

4. Material gap analysis
   For each recipe.materials entry:
     need = material.count × requiredCount
     have = current materialItemCid count from query-inventory
     If have >= need -> this material is sufficient
     If have <  need -> record missingMaterialCid + deficit = need - have
   -> All materials sufficient -> jump to step 6 and craft
   -> Any missing material -> enter step 5

5. Gather missing materials (recursive fill)
   For each missingMaterialCid:
     -> Call L1-get-item (targetItemCid = missingMaterialCid, requiredCount = deficit)
     -> L1-get-item dispatches by query-item-sources source.type to:
        - gathering -> SW-1
        - monster_drop -> SW-4
        - seed_planting -> SW-2
        - animal_pet -> SW-3
        - fishing -> SW-5
        - craft -> inside L1-get-item: query-recipes + recursive material fill + craft-execute
     -> After return, go back to step 4 and redo gap analysis (do not assume one run was enough)

   Batch boundaries must re-check backpack. With batch outputs / drop probability variance, one run may not fill the gap.

6. lumiterra craft-execute --recipe <recipeId> --count <requiredCount>
   -> Wait for command completion
   -> On failure, inspect data.stage (navigate / interact / craft_submit / craft_wait / craft_extract)
     - navigate / interact failure -> check scene / retry
     - craft_submit failure -> materials may have been consumed by another flow; return to step 3 for fresh snapshot + gap analysis
     - craft_wait / craft_extract failure -> record error and report blocker

7. Progress check (finished-item quantity verification)
   lumiterra query-inventory --item-cid <targetItemCid>
   -> afterCount = current quantity
   -> afterCount - beforeCount >= requiredCount -> completed and exit
   -> afterCount - beforeCount <  requiredCount -> record gap, return to step 4 and continue (partial success possible)
   -> afterCount == beforeCount -> crafting fully failed; inspect craft-execute error / stage
```

## Called base workflows / common workflows

- `L1-get-item` (unified entry for all missing materials; it dispatches by `source.type`)
- Indirectly triggered through L1-get-item:
  - `SW-1-gather-entity` -- gathering materials
  - `SW-2-crop-farming` -- planting materials
  - `SW-3-animal-petting` -- petting materials
  - `SW-4-combat-loop` -- monster drop materials
  - `SW-5-fishing-loop` -- fishing materials
- This L1 **does not directly** call SW-*; all material routing goes through L1-get-item to avoid duplicating source dispatch logic

## Important notes (HARD RULES)

- Warning: **query recipe before gathering materials**: must run `query-recipes` to get `recipe.materials`; **do not guess** what materials an equipment/item needs from memory. In-game recipes can change, and verbal material lists may be outdated.
- Warning: **equipment cross-crafting rule** (see SKILL.md Game Essentials §6): the three profession equipment recipes (battle / gather / farming) **depend on each other**; battle gear may require gathering or farming materials. **Do not assume "each profession crafts its own gear"**. Always inspect full `materials` from `query-recipes`.
- Warning: **success is judged only by backpack delta**: require `afterCount - beforeCount >= requiredCount`; relying only on `craft-execute success=true` or "item already exists" is wrong.
- Warning: **missing materials go through L1-get-item; do not invent source routing**: L1-5 does not maintain another source.type -> base-workflow dispatch table.
- Warning: **unlock state check**: `recipe.unlocked = false` is a blocker; do not attempt craft-execute because it will fail.
- Warning: **hidden locked recipe count**: default `query-recipes` does not return locked recipes. If target is missing but `lockedRecipeCount > 0`, recheck with `--include-locked` or `--recipe-id` before deciding "locked" vs "no recipe".
- Energy gate / HP safety line: L1-get-item handles checks before entering SW-* during material filling; L1-5 performs one initial gate in step 1.
- Batch crafting: large `requiredCount` may be submitted once with `craft-execute --count N`, but if it fails mid-way (materials consumed by parallel flow, etc.), return to step 3 for a fresh snapshot.
- Death: after `revive`, return to step 1 and rerun checks (HP / backpack / scene may have changed; fresh precheck is safer than resuming mid-step).

## Notes / common mistakes

- Skip `query-recipes` and craft from memory -- material list outdated / cross-crafting triggered -- **hard wrong**, query recipe first.
- Query only `query-item-sources` for finished itemCid without checking recipe -- for "craft" semantics, use recipe-direct path (see L1-get-item step 3); recipe branch is shorter than source branch.
- Manually run a temporary SW-* route for missing materials -- use L1-get-item consistently to avoid dual-maintained source dispatch.
- Forget beforeCount before crafting -- after crafting, "item exists" may include pre-existing quantity.
- Give up after one craft-execute failure -- inspect `data.stage`; `craft_submit` often means materials were consumed by another task and can continue after fresh snapshot.
- Force crafting when `recipe.unlocked = false` -- command inevitably fails; report blocker and unlock condition first.
- Craft battle gear while checking only combat materials -- cross-crafting means battle gear often needs gathering/farming materials; trust `query-recipes.materials`.
- Infinite material recursion -- every L1-get-item layer checks backpack and dispatches by source; depth follows recipes naturally. If circular dependency appears (A needs B, B needs A), report blocker.
