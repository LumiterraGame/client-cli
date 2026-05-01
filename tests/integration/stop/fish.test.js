import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sendCommand } from "../../../src/client.js";
import { runCommandAndStop } from "./_helpers.js";

// Channel catfish fixture; requires a compatible rod and reachable water area.
const TARGET_FISH_CID = 1095;

describe("stop: fish", { concurrency: false }, () => {
  it("fish responds to stop within 2s and returns cancelled", async () => {
    const { longResp, stopResp, stopElapsedMs } = await runCommandAndStop(
      sendCommand,
      "fish",
      { target: TARGET_FISH_CID },
      { settleMs: 1500 }   // leave time for validation and ShootRod to enter Waiting
    );

    assert.equal(stopResp.success, true);
    assert.ok(
      stopResp.data.stoppedCommands.includes("fish"),
      `stoppedCommands should include fish, got ${JSON.stringify(stopResp.data.stoppedCommands)}`
    );
    assert.equal(stopResp.data.drained, true, "drained should be true");
    assert.ok(stopElapsedMs < 2000, `stop ${stopElapsedMs}ms timed out`);

    assert.equal(
      longResp.data.endReason,
      "cancelled",
      `endReason should be cancelled, got: ${longResp.data.endReason}`
    );
  });
});
