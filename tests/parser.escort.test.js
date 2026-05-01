import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateEscortAccept,
  validateEscortStatus,
} from "../src/parser.js";

describe("validateEscortAccept", () => {
  it("no params is valid", () => {
    const r = validateEscortAccept({});
    assert.equal(r.valid, true);
    assert.deepEqual(r.params, {});
  });

  it("rejects any extra param", () => {
    const r = validateEscortAccept({ foo: "bar" });
    assert.equal(r.valid, false);
    assert.match(r.error, /Unsupported parameter/);
  });
});

describe("validateEscortStatus", () => {
  it("no params is valid", () => {
    const r = validateEscortStatus({});
    assert.equal(r.valid, true);
  });

  it("rejects any extra param", () => {
    const r = validateEscortStatus({ "wagon-cid": "1001" });
    assert.equal(r.valid, false);
  });
});
