import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sendCommand } from "../../../src/client.js";
import { runCommandAndStop } from "./_helpers.js";

const RECIPE_CID = 4001;  // README: fixture recipe CID usable for stop testing

describe("stop: craft-execute", { concurrency: false }, () => {
  it("craft-execute responds to stop within 2s", async () => {
    const { longResp, stopResp, stopElapsedMs } = await runCommandAndStop(
      sendCommand,
      "craft-execute",
      { recipe: RECIPE_CID, count: 1 },
      { settleMs: 1500 }
    );

    assert.equal(stopResp.success, true);
    assert.ok(stopResp.data.stoppedCommands.includes("craft-execute"));
    assert.equal(stopResp.data.drained, true);
    assert.ok(stopElapsedMs < 2000, `stop ${stopElapsedMs}ms timed out`);

    assert.equal(longResp.success, false, "stopped craft-execute should return success=false");
  });
});
