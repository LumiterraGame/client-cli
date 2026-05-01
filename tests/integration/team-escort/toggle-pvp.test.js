import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sendCommand } from "../../../src/client.js";

describe("toggle-pvp + query-status.camp roundtrip", { concurrency: false }, () => {
  it("switches camp to pvp and query-status reflects it", async () => {
    const toPvp = await sendCommand("toggle-pvp", { mode: "pvp" });
    assert.equal(toPvp.success, true, `toggle-pvp failed: ${toPvp.error}`);
    assert.equal(toPvp.data.camp, "pvp");
    assert.equal(toPvp.data.endReason, "completed");

    const q1 = await sendCommand("query-status", {});
    assert.equal(q1.success, true);
    assert.equal(q1.data.camp, "pvp");

    const toPeace = await sendCommand("toggle-pvp", { mode: "peace" });
    assert.equal(toPeace.success, true);
    assert.equal(toPeace.data.camp, "peace");

    const q2 = await sendCommand("query-status", {});
    assert.equal(q2.data.camp, "peace");
  });

  it("toggle-pvp idempotent when already in target mode", async () => {
    await sendCommand("toggle-pvp", { mode: "peace" });
    const r = await sendCommand("toggle-pvp", { mode: "peace" });
    assert.equal(r.success, true);
    assert.equal(r.data.endReason, "completed");
    assert.equal(r.data.previousCamp, "peace");
    assert.equal(r.data.camp, "peace");
  });
});
