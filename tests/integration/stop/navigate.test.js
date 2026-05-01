// tests/integration/stop/navigate.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sendCommand } from "../../../src/client.js";
import { runCommandAndStop, navigateTargetOffset } from "./_helpers.js";

describe("stop: navigate", { concurrency: false }, () => {
  it("navigate responds to stop within 2s", async () => {
    // Helper finds a nearby target with a usable NavMesh route.
    const target = await navigateTargetOffset(sendCommand);
    const { longResp, stopResp, stopElapsedMs } = await runCommandAndStop(
      sendCommand,
      "navigate",
      target
    );

    assert.equal(stopResp.success, true, "stop should succeed");
    assert.ok(
      stopResp.data.stoppedCommands.includes("navigate"),
      `stoppedCommands should include navigate, got: ${JSON.stringify(stopResp.data.stoppedCommands)}`
    );
    assert.equal(stopResp.data.drained, true, "drained should be true");
    assert.ok(
      stopElapsedMs < 2000,
      `stop should return within 2s, got ${stopElapsedMs}ms`
    );

    // A stopped navigate should return success=false even when endReason varies.
    assert.equal(longResp.success, false, "stopped navigate should return success=false");
  });
});
