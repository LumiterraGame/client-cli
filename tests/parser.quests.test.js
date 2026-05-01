import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateQuestDialog,
  validateQuestNormalClaim,
  validateQuestSubmit,
  validateQuestNormalAbandon,
} from "../src/parser.js";

describe("validateQuestDialog", () => {
  it("rejects missing --npc-cid", () => {
    const r = validateQuestDialog({});
    assert.equal(r.valid, false);
    assert.match(r.error, /npc-cid/);
  });

  it("accepts valid --npc-cid", () => {
    const r = validateQuestDialog({ "npc-cid": "19" });
    assert.equal(r.valid, true);
    assert.equal(r.params["npc-cid"], "19");
  });
});

describe("validateQuestNormalClaim", () => {
  it("rejects missing --task-id", () => {
    const r = validateQuestNormalClaim({});
    assert.equal(r.valid, false);
    assert.match(r.error, /task-id/);
  });

  it("accepts valid --task-id", () => {
    const r = validateQuestNormalClaim({ "task-id": "21" });
    assert.equal(r.valid, true);
  });
});

describe("validateQuestSubmit", () => {
  it("rejects missing --task-id", () => {
    const r = validateQuestSubmit({});
    assert.equal(r.valid, false);
    assert.match(r.error, /task-id/);
  });

  it("accepts valid --task-id", () => {
    const r = validateQuestSubmit({ "task-id": "21" });
    assert.equal(r.valid, true);
  });
});

describe("validateQuestNormalAbandon", () => {
  it("rejects missing --task-id", () => {
    const r = validateQuestNormalAbandon({});
    assert.equal(r.valid, false);
    assert.match(r.error, /task-id/);
  });

  it("accepts valid --task-id", () => {
    const r = validateQuestNormalAbandon({ "task-id": "21" });
    assert.equal(r.valid, true);
  });
});
