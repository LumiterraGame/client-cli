import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { helpText } from "../src/parser.js";

describe("helpText query-spawn-point", () => {
  it("documents required cid or keyword filter", () => {
    const text = helpText();
    assert.match(
      text,
      /query-spawn-point --type <monster\|npc\|gather\|fish\|farm\|animal> \(--cid <ID> \| --keyword <keyword>\)/,
    );
  });
});
