import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateTogglePvp } from "../src/parser.js";

describe("validateTogglePvp", () => {
  it("requires --mode", () => {
    const r = validateTogglePvp({});
    assert.equal(r.valid, false);
    assert.match(r.error, /mode/);
  });

  it("accepts --mode peace", () => {
    const r = validateTogglePvp({ mode: "peace" });
    assert.equal(r.valid, true);
    assert.equal(r.params.mode, "peace");
  });

  it("accepts --mode pvp", () => {
    const r = validateTogglePvp({ mode: "pvp" });
    assert.equal(r.valid, true);
    assert.equal(r.params.mode, "pvp");
  });

  it("rejects unknown mode", () => {
    const r = validateTogglePvp({ mode: "war" });
    assert.equal(r.valid, false);
  });

  it("rejects extras", () => {
    const r = validateTogglePvp({ mode: "pvp", foo: "bar" });
    assert.equal(r.valid, false);
  });
});
