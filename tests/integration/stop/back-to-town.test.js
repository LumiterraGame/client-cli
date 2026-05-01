import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sendCommand } from "../../../src/client.js";
import { runCommandAndStop } from "./_helpers.js";

describe("stop: back-to-town", { concurrency: false }, () => {
  it("back-to-town responds to stop within 2s", async () => {
    // Use a short settle window because back-to-town can finish quickly.
    // The goal is to catch it while it is still registered as long-running.
    const { longResp, stopResp, stopElapsedMs } = await runCommandAndStop(
      sendCommand,
      "back-to-town",
      {},
      { settleMs: 50 }
    );

    assert.equal(stopResp.success, true);
    assert.ok(
      stopResp.data.stoppedCommands.includes("back-to-town"),
      `stoppedCommands should include back-to-town, got: ${JSON.stringify(stopResp.data.stoppedCommands)}`
    );
    assert.equal(stopResp.data.drained, true);
    assert.ok(stopElapsedMs < 2000, `stop ${stopElapsedMs}ms`);
    assert.equal(longResp.success, false);
  });
});
