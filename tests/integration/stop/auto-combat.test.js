import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sendCommand } from "../../../src/client.js";
import { runCommandAndStop } from "./_helpers.js";

const TARGET_MONSTER_CID = 111;  // fixture monster CID that should be fightable nearby

describe("stop: auto-combat", { concurrency: false }, () => {
  it("auto-combat responds to stop within 2s", async () => {
    const { longResp, stopResp, stopElapsedMs } = await runCommandAndStop(
      sendCommand,
      "auto-combat",
      { target: TARGET_MONSTER_CID, count: 5 },
      { settleMs: 1000 }
    );

    assert.equal(stopResp.success, true);
    assert.ok(stopResp.data.stoppedCommands.includes("auto-combat"));
    assert.equal(stopResp.data.drained, true, "drained should be true");
    assert.ok(stopElapsedMs < 2000, `stop ${stopElapsedMs}ms timed out`);

    assert.equal(
      longResp.data.endReason,
      "cancelled",
      `endReason should be cancelled, got: ${longResp.data.endReason}`
    );
  });
});
