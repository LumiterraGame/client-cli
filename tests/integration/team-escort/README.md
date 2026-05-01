# Team / Escort / PvP Integration Tests

## Automated Tests

Preconditions: Unity Editor is running + account is logged in + CLI server has started.

```bash
node --test tests/integration/team-escort/
node --test tests/integration/stop/team-invite.test.js
```

Covered scenarios:
- `toggle-pvp.test.js` -- camp switching + query-status.camp two-way verification + idempotency
- `team-create-disband.test.js` -- create team -> query -> disband; duplicate create rejected; empty disband rejected
- `escort-accept-status.test.js` -- `escort-status` baseline, `escort-accept` precondition validation
- `../stop/team-invite.test.js` -- stop during 10s wait period -> cancelled within 2s

## Manual Verification Checklist

The following scenarios require two accounts or a full escort open window and cannot be automated.

### Cross-account Invite Flow (two accounts)

- [ ] A `team-create`
- [ ] A `team-invite --player-id <B.roleId>` (or `--player-name <B.name>` if in same vision range)
- [ ] B `team-query` verifies `pendingInvites` contains one entry, and `teamName`/`inviterName` are correct
- [ ] B `team-reply --team-id <T> --inviter-id <A.roleId> --action accept`
- [ ] A's `team-invite` response has `joined=true`
- [ ] A `team-query` -> `members` contains A + B

### Reject Invite (two accounts)

- [ ] A invites B
- [ ] B `team-reply --action reject`
- [ ] A's `team-invite` returns `endReason=timeout, failReason=invite_not_accepted` after 10s
- [ ] B `team-query` pendingInvites is empty

### Full Escort Loop (single account, within escort window)

Prerequisites: account level meets requirement, inventory has enough escort tickets, daily escort attempts are not used up.

- [ ] `query-status` records `camp=peace`
- [ ] `team-create`
- [ ] `escort-accept` returns `completed`, with `wagonCid/wagonName`
- [ ] `toggle-pvp --mode pvp`
- [ ] Loop:
  - `escort-status` observes increasing `progress` and changing `wagonPosition`
  - `navigate` moves near the wagon (stopRadius ~= wagon stay threshold - 2m)
  - `auto-combat --count=1` clears monsters (enemy-player counterattack is L2 TODO)
- [ ] Wagon reaches destination -> `escort-status` returns `inEscort=false`
- [ ] `toggle-pvp --mode peace` restores original camp
- [ ] `query-status` confirms `camp=peace` and HP is normal

### team-query pendingInvites (two accounts)

- [ ] A invites B
- [ ] B `team-query` -> `pendingInvites[]` contains this invite, with complete fields (teamId / teamName / inviterId / inviterName / memberCount / isLeader)
- [ ] After B accepts/rejects, `pendingInvites` becomes empty
