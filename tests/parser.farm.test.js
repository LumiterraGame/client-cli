import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateFarmHoe,
  validateFarmEradicate,
  validateFarmWater,
  validateFarmHarvest,
  validateFarmQuery,
} from "../src/parser.js";

describe("validateFarmHoe", () => {
  it("missing soil-id returns error", () => {
    const r = validateFarmHoe({});
    assert.equal(r.valid, false);
    assert.match(r.error, /soil-id/);
  });

  it("valid soil-id parses to integer", () => {
    const r = validateFarmHoe({ "soil-id": "101" });
    assert.equal(r.valid, true);
    assert.equal(r.params["soil-id"], "101");
  });

  it("rejects non-integer soil-id", () => {
    const r = validateFarmHoe({ "soil-id": "abc" });
    assert.equal(r.valid, false);
  });

  it("rejects zero or negative soil-id", () => {
    assert.equal(validateFarmHoe({ "soil-id": "0" }).valid, false);
    assert.equal(validateFarmHoe({ "soil-id": "-1" }).valid, false);
  });
});

describe("validateFarmEradicate", () => {
  it("missing soil-id returns error", () => {
    const r = validateFarmEradicate({});
    assert.equal(r.valid, false);
    assert.match(r.error, /soil-id/);
  });

  it("valid soil-id parses to integer", () => {
    const r = validateFarmEradicate({ "soil-id": "101" });
    assert.equal(r.valid, true);
    assert.equal(r.params["soil-id"], "101");
  });

  it("rejects non-integer soil-id", () => {
    const r = validateFarmEradicate({ "soil-id": "abc" });
    assert.equal(r.valid, false);
  });

  it("rejects zero or negative soil-id", () => {
    assert.equal(validateFarmEradicate({ "soil-id": "0" }).valid, false);
    assert.equal(validateFarmEradicate({ "soil-id": "-1" }).valid, false);
  });
});

describe("validateFarmWater", () => {
  it("missing soil-id returns error", () => {
    assert.equal(validateFarmWater({}).valid, false);
  });

  it("valid soil-id parses to integer", () => {
    const r = validateFarmWater({ "soil-id": "3" });
    assert.equal(r.valid, true);
    assert.equal(r.params["soil-id"], "3");
  });
});

describe("validateFarmHarvest", () => {
  it("missing soil-id returns error", () => {
    assert.equal(validateFarmHarvest({}).valid, false);
  });

  it("valid soil-id parses to integer", () => {
    const r = validateFarmHarvest({ "soil-id": "7" });
    assert.equal(r.valid, true);
    assert.equal(r.params["soil-id"], "7");
  });
});

describe("validateFarmQuery", () => {
  it("accepts no params (full query)", () => {
    const r = validateFarmQuery({});
    assert.equal(r.valid, true);
  });

  it("accepts --soil-id alone", () => {
    const r = validateFarmQuery({ "soil-id": "101" });
    assert.equal(r.valid, true);
    assert.equal(r.params["soil-id"], "101");
  });

  it("accepts --cid alone", () => {
    const r = validateFarmQuery({ cid: "50001" });
    assert.equal(r.valid, true);
    assert.equal(r.params.cid, "50001");
  });

  it("rejects both --soil-id and --cid", () => {
    const r = validateFarmQuery({ "soil-id": "101", cid: "50001" });
    assert.equal(r.valid, false);
    assert.match(r.error, /mutually exclusive/);
  });

  it("rejects invalid soil-id", () => {
    assert.equal(validateFarmQuery({ "soil-id": "abc" }).valid, false);
    assert.equal(validateFarmQuery({ "soil-id": "0" }).valid, false);
  });
});
