import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateTokenTaskAccept,
  validateTokenTaskClaim,
  validateTokenTaskAbandon,
  validateTokenTaskRefresh,
} from "../src/parser.js";

describe("validateTokenTaskAccept", () => {
  it("rejects missing --task-id", () => {
    const r = validateTokenTaskAccept({});
    assert.equal(r.valid, false);
    assert.match(r.error, /task-id/);
  });

  it("accepts valid --task-id", () => {
    const r = validateTokenTaskAccept({ "task-id": "42" });
    assert.equal(r.valid, true);
  });
});

describe("validateTokenTaskClaim", () => {
  it("rejects missing --task-id", () => {
    const r = validateTokenTaskClaim({});
    assert.equal(r.valid, false);
    assert.match(r.error, /task-id/);
  });

  it("accepts valid --task-id", () => {
    const r = validateTokenTaskClaim({ "task-id": "42" });
    assert.equal(r.valid, true);
  });
});

describe("validateTokenTaskAbandon", () => {
  it("rejects missing --task-id", () => {
    const r = validateTokenTaskAbandon({});
    assert.equal(r.valid, false);
    assert.match(r.error, /task-id/);
  });

  it("accepts valid --task-id", () => {
    const r = validateTokenTaskAbandon({ "task-id": "42" });
    assert.equal(r.valid, true);
  });
});

describe("validateTokenTaskRefresh", () => {
  it("accepts no --talent", () => {
    const r = validateTokenTaskRefresh({});
    assert.equal(r.valid, true);
  });

  it("accepts valid --talent", () => {
    const r = validateTokenTaskRefresh({ talent: "battle" });
    assert.equal(r.valid, true);
  });

  it("rejects invalid --talent", () => {
    const r = validateTokenTaskRefresh({ talent: "alchemy" });
    assert.equal(r.valid, false);
    assert.match(r.error, /talent/);
  });
});

import { helpText } from "../src/parser.js";

describe("helpText includes token-task", () => {
  it("contains token-task-list", () => {
    assert.ok(helpText().includes("token-task-list"));
  });
  it("contains token-task-accept", () => {
    assert.ok(helpText().includes("token-task-accept"));
  });
  it("contains token-task-claim", () => {
    assert.ok(helpText().includes("token-task-claim"));
  });
  it("contains close-token-task-reward-ui", () => {
    assert.ok(helpText().includes("close-token-task-reward-ui"));
  });
  it("contains token-task-abandon", () => {
    assert.ok(helpText().includes("token-task-abandon"));
  });
  it("contains token-task-refresh", () => {
    assert.ok(helpText().includes("token-task-refresh"));
  });
});
