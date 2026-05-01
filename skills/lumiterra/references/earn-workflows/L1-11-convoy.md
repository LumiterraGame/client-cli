# L1-11: Escort (Convoy / Escort)

> Source of truth: this file. When an Agent executes this workflow, it **MUST** follow the "Execution steps" section in order. Do not merge or skip steps.
> Index: L1-11.

This workflow is the unified entry point for "accept escort order -> follow wagon -> handle combat on the route -> restore camp after escort".
The server-side wagon BT is authoritative for the whole escort. The client only passively observes progress and completion through `escort-status`.

## Trigger conditions

- Trigger phrases:
  - "escort" / "run escort" / "convoy"
- User intent characteristics:
  - The goal is to **accept the currently open escort order and escort the wagon to the destination**.
  - The user may or may not already have a ticket; both cases enter through this L1.
- Boundaries with nearby entries:
  - User asks to "buy/get escort ticket" -> use L1-get-item (shared workflow: acquire item), not this L1. This L1 calls L1-get-item only when `escort-accept` returns `ticket_not_enough`.
  - User asks for "team only, no escort" -> only call `team-create` / `team-query`; do not enter this L1.
  - User's main goal is "PvP / rob escort" -> do not use this L1. This L1 is from the escort defender perspective; current `auto-combat` also does not handle enemy players.

## State maintained during execution (explicit variables; do not estimate verbally)

- `origCamp` - camp before accepting the escort (`peace` / `pvp`); must be restored after escort ends.
- `origHp` / `origEnergy` - HP / energy snapshot before accepting the escort; used in the loop to decide recovery/refill.
- `inTeam` / `isLeader` - team state read from `team-query`; escort **requires leader status**. If not leader, first run `team-create` as needed.
- `escortTicketCid` - itemCid of the required escort ticket; pass it to L1-get-item in the `ticket_not_enough` branch.
- `escortAccepted` - whether `escort-accept` succeeded; entering the loop is forbidden until this is true.
- `wagonPosition` - current wagon coordinates `{x, y, z}` returned by `escort-status`.
- `inEscort` - `escort-status.inEscort`; `false` is the only completion signal.
- `safeHp` - HP safety threshold. Default follows Game Essentials §9: HP below 40% triggers disengage/recovery.
- `campToggled` - whether step 4 actually switched to pvp (`origCamp=peace`). Step 7 restores camp only when this is true.

## Success criteria

- **Use `escort-status.inEscort = false` as the authority**: after the server wagon BT broadcasts `BroadCastWagonResult`, the client passively observes this through `escort-status`. Both success and failure set `inEscort` to `false`.
- A successful `escort-accept` **does not mean the escort succeeded**. It only means the order was accepted; the server wagon has not completed its route.
- "Player reached the destination coordinates" **does not mean success**. Wagon path and progress are controlled by the server BT; `inEscort` is authoritative.
- Single results from `auto-combat` / `navigate` / `use-item` inside the loop **do not decide workflow success**. They only affect progress and HP. Do not exit just because one combat action fails; wait for `inEscort=false`.

## Preconditions / Blockers

**Precheck before starting**. If unmet, report a blocker early:

- **Must be team leader**: server validates `IsInTeam && IsTeamLeader`. Being out of team or in someone else's team cannot accept escort. Solo escort is allowed, but first create a one-person team with `team-create` so the player is leader.
- **Must have escort ticket**: `escort-accept` validates ticket count. If missing, it returns `failReason=ticket_not_enough`; pass the ticket cid to L1-get-item, then return to step 3 and retry.
- **Level must match**: escort orders have a hard player-level gate. `failReason=level_error` means do **not** independently grind levels; report blocker and let the user decide.
- **Remaining attempts**: personal/world escort quotas apply. `failReason=times_used_up` / `world_times_used_up` means no more escort today; report blocker.
- **Camp switching has side effects**: when `origCamp=peace`, step 4 switches to `pvp`; the player can be attacked on the route. Step 7 must restore `origCamp`. Abnormal exits must also restore it; see Notes.
- **HP < 40% follows SKILL.md**: in every escort loop round, run `query-status` and compute `hp/maxHp`; below 40%, disengage and recover immediately. Do not default to potions unless the user authorized them.
- **Paid actions are denied by default**: if energy runs out during escort, **do not** default to `energy-manage --action buy|borrow`. buy/borrow only creates energy potion items and still requires `use-item`. First check inventory food/potions; if none exist, ask the user.
- **L2 gap: no automatic PvP counterattack**: current `auto-combat` only searches Monsters; it does not handle enemy players/escort robbers. On PvP interference, return to user for manual intervention or abandon this escort.

## Execution steps (numbered; do not skip)

```text
1. lumiterra query-status
   -> record origCamp / origHp / origEnergy
   -> if the character is dead, revive / back-to-town first; do not enter this L1

2. lumiterra team-query
   -> read inTeam / isLeader
   -> inTeam=false: go to 2a
   -> inTeam=true && isLeader=false (in someone else's team): go to 2b
   -> inTeam=true && isLeader=true: already satisfied, go to step 3
   2a. lumiterra team-create -> create a solo team
   2b. lumiterra team-leave -> lumiterra team-create
       -> after leaving another team, create your own team; team-leave alone is not enough

3. lumiterra escort-accept
   -> success: record escortAccepted=true, then enter step 4
   -> failReason=ticket_not_enough:
       -> pass the escort ticket itemCid to L1-get-item (shared workflow: acquire item)
       -> after acquiring it, return to step 3 and retry once; if L1-get-item cannot acquire it, report blocker
   -> failReason=level_error: report blocker and let user decide; do not grind levels on your own
   -> failReason=times_used_up / world_times_used_up: report blocker; no more escort today
   -> failReason=not_leader or similar team validation failure: return to step 2 and recheck inTeam / isLeader
   -> any other failReason: stop and report; do not retry blindly

4. If origCamp == peace:
     lumiterra toggle-pvp --mode pvp
     -> record campToggled=true
   If origCamp == pvp: skip, campToggled=false

5. Escort loop (exit only when inEscort=false)
   loop:
     s = lumiterra escort-status
     if s.inEscort == false: break

     # Follow wagon (WagonCheckEscortRadius = 10m)
     dx = distance(player, s.wagonPosition)
     if dx > 10m:
       lumiterra navigate --x <s.x> --y <s.y> --z <s.z> --stop-radius 8

     # HP maintenance (Operating Principles §HP<40%)
     q = lumiterra query-status
     if q.hp / q.maxHp < 0.4:
       -> HARD RULE: escape-combat -> move away -> wait for auto recovery (or back-to-town / revive)
       -> do not use potions by default unless the user explicitly authorized them
     elif q.hp < safeHp:
       -> check inventory for HP potion itemInstanceId -> use-item --item-instance-id <id>

     # Clear monsters only. PvP players are an L2 gap.
     lumiterra auto-combat --count=1

     # Enemy player / escort robber encountered: automatic counterattack unavailable -> report to user for manual intervention

6. After the loop exits, run lumiterra escort-status once more
   -> confirm inEscort=false (avoid acting on a stale observation)
   -> read and report the end reason: success / timeout / killed

7. If campToggled == true:
     lumiterra toggle-pvp --mode <origCamp>
     -> restore origCamp; otherwise the player remains in pvp mode and can keep being attacked
   If campToggled == false: skip
```

## Called base workflows / shared workflows

- **L1-get-item (shared workflow: acquire item)** - called only when step 3 returns `ticket_not_enough`; after acquiring the escort ticket, return to step 3 and retry.
- Indirect CLI dependencies:
  - `query-status` - read `origCamp`, HP, energy, and loop HP state.
  - `team-query` / `team-create` / `team-leave` - ensure current player is team leader.
  - `escort-accept` - accept the order; only entry point, with `failReason` branching.
  - `toggle-pvp` - switch to pvp before escort and restore `origCamp` afterward.
  - `escort-status` - main loop status; only authoritative progress/completion signal.
  - `navigate` - follow wagon (`stop-radius=8m` leaves 2m margin).
  - `auto-combat` - clear Monsters on the route; does not handle PvP players.
  - `query-inventory` / `use-item` - HP potion maintenance when authorized.
  - `escape-combat` / `back-to-town` / `revive` - HP<40% disengage path.

## Important notes (HARD RULES)

- **Must be leader + must have ticket**: these are the two key preconditions. `escort-accept` server-side checks `IsInTeam && IsTeamLeader` and ticket count. Other failReasons (`level_error` / `times_used_up` / `world_times_used_up`) have their own branches; do not mix recovery actions.
- **`inEscort=false` is the only completion signal**: do not use "player reached destination", "wagon stopped", or "auto-combat found no monster" to decide escort is over. The authoritative signal is `escort-status.inEscort=false` after server `BroadCastWagonResult`.
- **`failReason` branches must be explicit; do not retry blindly**:
  - `ticket_not_enough` -> call L1-get-item for ticket -> return to step 3.
  - `times_used_up` / `world_times_used_up` -> stop; no escort today.
  - `level_error` -> stop; let user decide.
  - `not_leader` / similar team validation -> return to step 2.
- **`origCamp` must be restored**: if step 4 switched to pvp, step 7 must switch back. Remember this on abnormal exits, death/back-to-town paths, and user aborts when `campToggled=true`.
- **Solo escort is allowed**: server only requires "in team and leader"; a one-person team is valid. Do not reject just because the team has only the player.
- **Follow radius is 10m from server config**: `WagonCheckEscortRadius = 1000cm` (`GameValue.csv` eGameValueID=139 / `WagonLifeCycle.cs:25`). Use `navigate --stop-radius 8` to leave 2m margin and avoid repeated replanning. Do not change this threshold arbitrarily.
- **HP<40% is a global HARD RULE**: every loop round must compute `hp/maxHp`; below 40%, immediately `escape-combat` -> move away -> wait for auto recovery. **Do not use potions by default**; see SKILL.md Operating Principles.
- **Enemy players / escort robbers cannot be auto-countered yet** (L2 gap): `auto-combat` only handles Monsters. If PvP interference happens, return the situation to the user instead of spinning in the loop.
- **Enter the loop only after `escort-accept` succeeds**: before accepting the order, `escort-status.inEscort` is always false and would be misread as "escort ended". Verify `escortAccepted=true` before step 5.
- **User abort -> call `lumiterra stop` first**: if the user says to stop escort, the first action is `lumiterra stop` to cancel long-running `auto-combat` / `navigate` / `escort-*` work. Then restore `origCamp` according to `campToggled`; do not just stop future commands.

## Notes / common mistakes

- Calling `escort-accept` while not in a team or while in someone else's team is rejected by the server. First `team-create` so the player is leader.
- Retrying `escort-accept` without acquiring a ticket will never pass `ticket_not_enough`; acquiring the ticket is required, not optional.
- Treating "auto-combat found no monsters" as escort completion is wrong. The wagon may still be moving; only `escort-status.inEscort=false` completes the workflow.
- Entering step 5 without verifying `escortAccepted` makes `escort-status.inEscort` false from the start and causes a false completion.
- Forgetting to restore camp after switching from peace to pvp leaves the player attackable. Every exit path with `campToggled=true` must run step 7.
- Continuing to fight when HP is below 40% violates the Operating Principles HARD RULE. Disengage and recover.
- Running `energy-manage --action buy|borrow` when energy runs out is forbidden by default. buy/borrow only creates potion items and still requires `use-item`; first use inventory food/potions, otherwise ask the user.
- Continuing to run `auto-combat` against enemy players/escort robbers does not work. This is an L2 gap; report to the user for a decision.
- Repeated navigate replanning usually means the stop radius is too close to the 10m threshold. Keep `stop-radius` at 8m to leave 2m margin.
- Reading `teamId` with `jq -r '.teamId'` can lose precision because `teamId` is 64-bit. This flow normally does not pass `teamId`, but if recording it, use `python3` or `grep -oE` to preserve the raw string.
