import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { sendCommand } from "../../../src/client.js";

async function ensureCleanState() {
  const q = await sendCommand("team-query", {});
  if (q.success && q.data.inTeam) {
    if (q.data.isLeader) {
      await sendCommand("team-disband", {});
    } else {
      await sendCommand("team-leave", {});
    }
  }
}

describe("escort-accept + escort-status baseline", { concurrency: false }, () => {
  before(ensureCleanState);
  after(ensureCleanState);

  it("escort-status when not in escort returns inEscort=false with times", async () => {
    const s = await sendCommand("escort-status", {});
    assert.equal(s.success, true, `escort-status failed: ${s.error}`);
    assert.equal(s.data.inEscort, false);
    assert.ok(s.data.times, "times field must be present even when not in escort");
    assert.equal(typeof s.data.times.remainToday, "number");
    assert.equal(typeof s.data.times.worldRemain, "number");
  });

  it("escort-accept without team returns not_team_leader", async () => {
    const r = await sendCommand("escort-accept", {});
    assert.equal(r.success, false);
    assert.equal(r.data.failReason, "not_team_leader");
  });

  // The happy-path "accept then status" test requires a fully configured account
  // with tickets, open wagons, and the right level. Covered as manual verification
  // in team-escort/README.md.
});
