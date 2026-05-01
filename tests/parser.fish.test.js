import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateFish } from "../src/parser.js";

describe("validateFish", () => {
  // --- target required validation ---
  it("missing --target returns error", () => {
    const r = validateFish({});
    assert.equal(r.valid, false);
    assert.match(r.error, /target/);
  });

  it("non-integer --target rejected", () => {
    const r = validateFish({ target: "abc" });
    assert.equal(r.valid, false);
    assert.match(r.error, /target/);
  });

  it("zero or negative --target rejected", () => {
    assert.equal(validateFish({ target: "0" }).valid, false);
    assert.equal(validateFish({ target: "-5" }).valid, false);
  });

  it("valid --target parses to integer", () => {
    const r = validateFish({ target: "1001" });
    assert.equal(r.valid, true);
    assert.equal(r.params.target, 1001);
  });

  // --- timeout behavior (when target is valid) ---
  it("only --target yields default timeout=90", () => {
    const r = validateFish({ target: "1001" });
    assert.equal(r.valid, true);
    assert.equal(r.params.timeout, 90);
  });

  it("accepts --timeout within [30, 300]", () => {
    assert.equal(validateFish({ target: "1001", timeout: "30" }).params.timeout, 30);
    assert.equal(validateFish({ target: "1001", timeout: "90" }).params.timeout, 90);
    assert.equal(validateFish({ target: "1001", timeout: "300" }).params.timeout, 300);
  });

  it("rejects --timeout < 30", () => {
    const r = validateFish({ target: "1001", timeout: "29" });
    assert.equal(r.valid, false);
    assert.match(r.error, /timeout/);
  });

  it("rejects --timeout > 300", () => {
    const r = validateFish({ target: "1001", timeout: "301" });
    assert.equal(r.valid, false);
    assert.match(r.error, /timeout/);
  });

  it("rejects non-integer --timeout", () => {
    const r = validateFish({ target: "1001", timeout: "abc" });
    assert.equal(r.valid, false);
    assert.match(r.error, /timeout/);
  });

  it("rejects float --timeout", () => {
    const r = validateFish({ target: "1001", timeout: "90.5" });
    assert.equal(r.valid, false);
  });

  it("flag without value (timeout === true) yields default timeout=90", () => {
    const r = validateFish({ target: "1001", timeout: true });
    assert.equal(r.valid, true);
    assert.equal(r.params.timeout, 90);
  });

  it("rejects negative --timeout", () => {
    const r = validateFish({ target: "1001", timeout: "-5" });
    assert.equal(r.valid, false);
    assert.match(r.error, /timeout/);
  });
});
