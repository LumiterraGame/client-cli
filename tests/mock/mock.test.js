import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sendCommand } from "../../src/client.js";

async function run(cmd, params = {}) {
  return sendCommand(cmd, params);
}

function assertFields(obj, fieldTypes) {
  for (const [path, type] of Object.entries(fieldTypes)) {
    const val = path.split(".").reduce((o, k) => o?.[k], obj);
    assert(typeof val === type, `Expected field "${path}" to be ${type}, got ${typeof val} (value: ${JSON.stringify(val)})`);
  }
}

const SCENARIO = process.env.MOCK_SCENARIO || "success";

describe("Mock - success scenario", { skip: SCENARIO !== "success" }, () => {
  it("query-status returns complete structure", async () => {
    const res = await run("query-status");
    assert.equal(res.success, true);
    assertFields(res, {
      "data.level": "number",
      "data.hp": "number",
      "data.energy": "number",
      "data.position": "object",
      "data.camp": "string",
    });
    assert(res.data.hp >= 0);
    assert(res.data.energy >= 0);
  });

  it("command without fixture returns success:true + empty data (fallback)", async () => {
    const res = await run("query-wallet");
    assert.equal(res.success, true);
    assert.deepEqual(res.data, {});
  });

  it("navigate returns arrived:true", async () => {
    const res = await run("navigate", { x: 100, y: 0, z: 200 });
    assert.equal(res.success, true);
    assert.equal(res.data.arrived, true);
  });
});

describe("Mock - command_error scenario", { skip: SCENARIO !== "command_error" }, () => {
  it("any command returns success:false + errors", async () => {
    const res = await run("query-status");
    assert.equal(res.success, false);
    assert(Array.isArray(res.errors) && res.errors.length > 0);
  });
});

describe("Mock - disconnected scenario", { skip: SCENARIO !== "disconnected" }, () => {
  it("connection failure returns success:false with connection error message", async () => {
    const res = await run("query-status");
    assert.equal(res.success, false);
    assert(
      res.errors.some(e => e.toLowerCase().includes("connect")),
      `Expected connection error, got: ${JSON.stringify(res.errors)}`
    );
  });
});
