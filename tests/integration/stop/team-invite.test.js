import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sendCommand } from "../../../src/client.js";
import { runCommandAndStop } from "./_helpers.js";

// Fake Role ID; invite waits long enough for stop without affecting a real player.
const FAKE_PLAYER_ID = 999999999;

describe("stop: team-invite", { concurrency: false }, () => {
  it("team-invite responds to stop within 2s", async () => {
    const { longResp, stopResp, stopElapsedMs } = await runCommandAndStop(
      sendCommand,
      "team-invite",
      { "player-id": FAKE_PLAYER_ID },
      { settleMs: 800 }
    );

    assert.equal(stopResp.success, true);
    assert.ok(stopResp.data.stoppedCommands.includes("team-invite"));
    assert.equal(stopResp.data.drained, true, "drained should be true");
    assert.ok(stopElapsedMs < 2000, `stop ${stopElapsedMs}ms timed out`);

    assert.equal(
      longResp.data.endReason,
      "cancelled",
      `endReason should be cancelled, got: ${longResp.data.endReason}`
    );
  });
});
