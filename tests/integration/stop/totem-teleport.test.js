import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sendCommand } from "../../../src/client.js";
import { runCommandAndStop } from "./_helpers.js";

const TOTEM_ID = 1;  // README: fixture totem ID

describe("stop: totem-teleport", { concurrency: false }, () => {
  it("totem-teleport responds to stop within 2s", async () => {
    const { longResp, stopResp, stopElapsedMs } = await runCommandAndStop(
      sendCommand,
      "totem-teleport",
      { totem: TOTEM_ID },
      { settleMs: 300 }
    );

    assert.equal(stopResp.success, true);
    if (stopResp.data.stoppedCommands.includes("totem-teleport")) {
      assert.equal(stopResp.data.drained, true);
      assert.ok(stopElapsedMs < 2000, `stop ${stopElapsedMs}ms`);
      assert.equal(longResp.success, false);
    } else {
      console.log("totem-teleport completed before stop signal");
    }
  });
});
