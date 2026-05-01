import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateTeamCreate,
  validateTeamDisband,
  validateTeamLeave,
  validateTeamInvite,
  validateTeamReply,
  validateTeamQuery,
} from "../src/parser.js";

describe("validateTeamCreate", () => {
  it("no params is valid (all optional)", () => {
    const r = validateTeamCreate({});
    assert.equal(r.valid, true);
    assert.equal(r.params.name, undefined);
    assert.equal(r.params.desc, undefined);
    assert.equal(r.params.public, undefined);
  });

  it("name/desc/public passes through", () => {
    const r = validateTeamCreate({ name: "x", desc: "y", public: "false" });
    assert.equal(r.valid, true);
    assert.equal(r.params.name, "x");
    assert.equal(r.params.desc, "y");
    assert.equal(r.params.public, false);
  });

  it("rejects invalid --public", () => {
    const r = validateTeamCreate({ public: "maybe" });
    assert.equal(r.valid, false);
    assert.match(r.error, /public/);
  });
});

describe("validateTeamDisband", () => {
  it("no params is valid", () => {
    assert.equal(validateTeamDisband({}).valid, true);
  });
  it("rejects extras", () => {
    assert.equal(validateTeamDisband({ x: "1" }).valid, false);
  });
});

describe("validateTeamLeave", () => {
  it("no params is valid", () => {
    assert.equal(validateTeamLeave({}).valid, true);
  });
});

describe("validateTeamQuery", () => {
  it("no params is valid", () => {
    assert.equal(validateTeamQuery({}).valid, true);
  });
});

describe("validateTeamInvite", () => {
  it("requires player-id or player-name", () => {
    const r = validateTeamInvite({});
    assert.equal(r.valid, false);
    assert.match(r.error, /player-id|player-name/);
  });

  it("player-id alone is valid", () => {
    const r = validateTeamInvite({ "player-id": "123" });
    assert.equal(r.valid, true);
    assert.equal(r.params["player-id"], "123");
  });

  it("player-name alone is valid", () => {
    const r = validateTeamInvite({ "player-name": "alice" });
    assert.equal(r.valid, true);
    assert.equal(r.params["player-name"], "alice");
  });

  it("cannot pass both", () => {
    const r = validateTeamInvite({ "player-id": "1", "player-name": "a" });
    assert.equal(r.valid, false);
    assert.match(r.error, /mutually exclusive/);
  });

  it("rejects non-positive player-id", () => {
    assert.equal(validateTeamInvite({ "player-id": "abc" }).valid, false);
    assert.equal(validateTeamInvite({ "player-id": "0" }).valid, false);
  });
});

describe("validateTeamReply", () => {
  it("requires team-id, inviter-id, action", () => {
    const r = validateTeamReply({});
    assert.equal(r.valid, false);
  });

  it("valid accept", () => {
    const r = validateTeamReply({
      "team-id": "123",
      "inviter-id": "456",
      action: "accept",
    });
    assert.equal(r.valid, true);
    assert.equal(r.params.action, "accept");
  });

  it("valid reject", () => {
    const r = validateTeamReply({
      "team-id": "123",
      "inviter-id": "456",
      action: "reject",
    });
    assert.equal(r.valid, true);
  });

  it("rejects unknown action", () => {
    const r = validateTeamReply({
      "team-id": "1",
      "inviter-id": "2",
      action: "xxx",
    });
    assert.equal(r.valid, false);
    assert.match(r.error, /action/);
  });
});
