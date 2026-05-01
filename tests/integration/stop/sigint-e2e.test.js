import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { sendCommand } from "../../../src/client.js";
import { sleep, navigateTargetOffset } from "./_helpers.js";

const CLI_PATH = new URL("../../../bin/lumiterra.js", import.meta.url).pathname;

function spawnCli(args) {
  return spawn("node", [CLI_PATH, ...args], { stdio: ["ignore", "pipe", "pipe"] });
}

function onceExit(child) {
  return new Promise((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });
}

describe("stop: SIGINT end-to-end", { concurrency: false }, () => {
  it("SIGINT triggers server stop and exits cleanly", async () => {
    const target = await navigateTargetOffset(sendCommand);
    const child = spawnCli([
      "navigate",
      "--x", String(target.x),
      "--y", String(target.y),
      "--z", String(target.z),
      "--pretty",
    ]);

    // Wait until the command is likely registered as long-running.
    await sleep(800);

    // Send SIGINT.
    child.kill("SIGINT");

    // Wait for process exit, with a 5s safety timeout.
    const exitResult = await Promise.race([
      onceExit(child),
      sleep(5000).then(() => ({ code: null, signal: "TIMEOUT" })),
    ]);

    assert.notEqual(exitResult.signal, "TIMEOUT", "CLI did not exit within 5s");
    // SIGINT should exit with code 130.
    assert.equal(exitResult.code, 130, `expected exit code 130, got ${exitResult.code}`);

    // Give the server drain path a short settle period.
    await sleep(500);

    // A later query should work, proving the server command registry is usable again.
    const status = await sendCommand("query-status", {});
    assert.equal(status.success, true, "server should be drained and query-status should return");
  });
});
