import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateAnimalPet,
  validateAnimalQuery,
} from "../src/parser.js";

describe("validateAnimalPet", () => {
  it("missing entity-id returns error", () => {
    const r = validateAnimalPet({});
    assert.equal(r.valid, false);
    assert.match(r.error, /entity-id/);
  });

  it("valid entity-id parses to integer", () => {
    const r = validateAnimalPet({ "entity-id": "5001" });
    assert.equal(r.valid, true);
    assert.equal(r.params["entity-id"], "5001");
  });

  it("rejects non-integer entity-id", () => {
    assert.equal(validateAnimalPet({ "entity-id": "abc" }).valid, false);
  });

  it("rejects zero or negative entity-id", () => {
    assert.equal(validateAnimalPet({ "entity-id": "0" }).valid, false);
    assert.equal(validateAnimalPet({ "entity-id": "-5" }).valid, false);
  });
});

describe("validateAnimalQuery", () => {
  it("accepts no params (full query)", () => {
    const r = validateAnimalQuery({});
    assert.equal(r.valid, true);
  });

  it("accepts --entity-id alone", () => {
    const r = validateAnimalQuery({ "entity-id": "5001" });
    assert.equal(r.valid, true);
    assert.equal(r.params["entity-id"], "5001");
  });

  it("accepts --cid alone", () => {
    const r = validateAnimalQuery({ cid: "30012" });
    assert.equal(r.valid, true);
    assert.equal(r.params.cid, "30012");
  });

  it("rejects both --entity-id and --cid", () => {
    const r = validateAnimalQuery({ "entity-id": "5001", cid: "30012" });
    assert.equal(r.valid, false);
    assert.match(r.error, /mutually exclusive/);
  });

  it("rejects invalid entity-id", () => {
    assert.equal(validateAnimalQuery({ "entity-id": "abc" }).valid, false);
    assert.equal(validateAnimalQuery({ "entity-id": "0" }).valid, false);
  });
});
