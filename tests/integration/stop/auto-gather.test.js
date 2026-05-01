import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sendCommand } from "../../../src/client.js";
import { runCommandAndStop } from "./_helpers.js";

const TARGET_RESOURCE_CID = 115;  // fixture resource CID that should be gatherable nearby

describe("stop: auto-gather", { concurrency: false }, () => {
  it("auto-gather responds to stop within 2s", async () => {
    const { longResp, stopResp, stopElapsedMs } = await runCommandAndStop(
      sendCommand,
      "auto-gather",
      { target: TARGET_RESOURCE_CID, count: 5 },
      { settleMs: 1000 }
    );

    assert.equal(stopResp.success, true);
    assert.ok(stopResp.data.stoppedCommands.includes("auto-gather"));
    assert.equal(stopResp.data.drained, true);
    assert.ok(stopElapsedMs < 2000, `stop ${stopElapsedMs}ms timed out`);

    assert.equal(longResp.data.endReason, "cancelled");
  });
});
