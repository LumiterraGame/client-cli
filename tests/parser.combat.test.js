import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateAutoCombat,
  validateEscapeCombat,
  validateAutoGather,
} from "../src/parser.js";

describe("validateAutoCombat", () => {
  it("defaults count to 1 when not provided", () => {
    const result = validateAutoCombat({ target: "111" });
    assert.equal(result.valid, true);
    assert.equal(result.params.count, "1");
  });

  it("accepts count within range 1-5", () => {
    assert.equal(validateAutoCombat({ target: "111", count: "3" }).valid, true);
    assert.equal(validateAutoCombat({ target: "111", count: "5" }).valid, true);
    assert.equal(validateAutoCombat({ target: "111", count: "1" }).valid, true);
  });

  it("rejects count > 5", () => {
    const result = validateAutoCombat({ target: "111", count: "6" });
    assert.equal(result.valid, false);
    assert.equal(result.error, "--count must be in range 1-5");
  });

  it("rejects count < 1", () => {
    const result = validateAutoCombat({ target: "111", count: "0" });
    assert.equal(result.valid, false);
  });

  it("rejects non-integer count", () => {
    const result = validateAutoCombat({ target: "111", count: "abc" });
    assert.equal(result.valid, false);
  });
});

describe("validateEscapeCombat", () => {
  it("defaults timeout when not provided", () => {
    const result = validateEscapeCombat({});
    assert.equal(result.valid, true);
    assert.equal(result.params.timeout, "20");
  });

  it("accepts timeout within range", () => {
    const result = validateEscapeCombat({ timeout: "30" });
    assert.equal(result.valid, true);
    assert.equal(result.params.timeout, "30");
  });

  it("rejects invalid timeout", () => {
    assert.equal(validateEscapeCombat({ timeout: "4" }).valid, false);
    assert.equal(validateEscapeCombat({ timeout: "61" }).valid, false);
    assert.equal(validateEscapeCombat({ timeout: "abc" }).valid, false);
  });
});

describe("validateAutoGather", () => {
  it("requires --target", () => {
    const result = validateAutoGather({});
    assert.equal(result.valid, false);
    assert.equal(result.error, "Missing required parameter: --target");
  });

  it("defaults count to 1 when not provided", () => {
    const result = validateAutoGather({ target: "200" });
    assert.equal(result.valid, true);
    assert.equal(result.params.count, "1");
  });

  it("accepts count within range 1-5", () => {
    assert.equal(validateAutoGather({ target: "200", count: "3" }).valid, true);
    assert.equal(validateAutoGather({ target: "200", count: "5" }).valid, true);
    assert.equal(validateAutoGather({ target: "200", count: "1" }).valid, true);
  });

  it("rejects count > 5", () => {
    const result = validateAutoGather({ target: "200", count: "6" });
    assert.equal(result.valid, false);
    assert.equal(result.error, "--count must be in range 1-5");
  });

  it("rejects count < 1", () => {
    const result = validateAutoGather({ target: "200", count: "0" });
    assert.equal(result.valid, false);
  });

  it("rejects non-integer count", () => {
    const result = validateAutoGather({ target: "200", count: "abc" });
    assert.equal(result.valid, false);
  });
});
