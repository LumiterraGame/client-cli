import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sendCommand } from "../../../src/client.js";
import { runCommandAndStop } from "./_helpers.js";

const TARGET_ANIMAL_CID = 111;  // README: fixture capturable world animal CID

describe("stop: capture-pet", { concurrency: false }, () => {
  it("capture-pet responds to stop within 2s", async () => {
    const { longResp, stopResp, stopElapsedMs } = await runCommandAndStop(
      sendCommand,
      "capture-pet",
      { target: TARGET_ANIMAL_CID },
      { settleMs: 1500 }   // allow capture setup to enter the running phase
    );

    assert.equal(stopResp.success, true);
    assert.ok(stopResp.data.stoppedCommands.includes("capture-pet"));
    assert.equal(stopResp.data.drained, true);
    assert.ok(stopElapsedMs < 2000, `stop ${stopElapsedMs}ms timed out`);

    assert.equal(longResp.data.endReason, "cancelled");
  });
});
