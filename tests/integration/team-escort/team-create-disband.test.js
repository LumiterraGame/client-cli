import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { sendCommand } from "../../../src/client.js";

async function ensureNoTeam() {
  const q = await sendCommand("team-query", {});
  if (q.success && q.data.inTeam) {
    if (q.data.isLeader) {
      await sendCommand("team-disband", {});
    } else {
      await sendCommand("team-leave", {});
    }
  }
}

describe("team-create / team-disband / team-query flow", { concurrency: false }, () => {
  before(ensureNoTeam);
  after(ensureNoTeam);

  it("team-create default name works + team-query reflects it", async () => {
    const created = await sendCommand("team-create", {});
    assert.equal(created.success, true, `team-create failed: ${created.error}`);
    assert.equal(created.data.isLeader, true);
    const teamId = created.data.teamId;
    assert.ok(teamId, "teamId missing");

    const q = await sendCommand("team-query", {});
    assert.equal(q.success, true);
    assert.equal(q.data.inTeam, true);
    assert.equal(q.data.teamId, teamId);
    assert.equal(q.data.isLeader, true);
    const defaultTeamNameSuffix = String.fromCodePoint(30340, 38431, 20237);
    assert.equal(typeof q.data.teamName, "string");
    assert.ok(
      q.data.teamName.endsWith(defaultTeamNameSuffix),
      "teamName should end with the game default team-name suffix"
    );

    const disband = await sendCommand("team-disband", {});
    assert.equal(disband.success, true);

    const q2 = await sendCommand("team-query", {});
    assert.equal(q2.data.inTeam, false);
  });

  it("team-create rejects when already in team", async () => {
    await sendCommand("team-create", {});
    const r = await sendCommand("team-create", {});
    assert.equal(r.success, false);
    assert.equal(r.data.failReason, "already_in_team");
    await sendCommand("team-disband", {});
  });

  it("team-disband fails when not in team", async () => {
    const r = await sendCommand("team-disband", {});
    assert.equal(r.success, false);
    assert.equal(r.data.failReason, "not_in_team");
  });
});
