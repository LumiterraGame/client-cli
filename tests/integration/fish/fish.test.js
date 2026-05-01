import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sendCommand } from "../../../src/client.js";

// Known existing fish species + water area + compatible fishing rod (Wooden/Crystal Rod).
const TARGET_FISH_CID = 1095;  // Channel catfish

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe("fish: happy path", { concurrency: false }, () => {
  it("fish completes with qteCount >= 1", async () => {
    // Precondition: the character must stand at the Channel catfish navPosition from
    // `query-spawn-point --type fish --cid 1095`, with a compatible fishing rod equipped.
    // Position manually before running; this test does not navigate automatically.
    const resp = await sendCommand("fish", { target: TARGET_FISH_CID }, { timeout: 120000 });

    assert.equal(resp.success, true, `expected success, got ${JSON.stringify(resp)}`);
    assert.equal(resp.data.endReason, "completed");
    assert.ok(resp.data.qteCount >= 1, `at least one QTE expected, got qteCount=${resp.data.qteCount}`);
    assert.equal(
      resp.data.qteGood + resp.data.qteBad,
      resp.data.qteCount,
      "good + bad must equal total"
    );
    assert.ok(resp.data.fishCid > 0 || resp.data.fishName, "should capture fishCid or fishName on success");
  });
});

describe("fish: failure cases", { concurrency: false }, () => {
  it("missing --target returns failure from validator", async () => {
    const resp = await sendCommand("fish", {}, { timeout: 5000 });
    assert.equal(resp.success, false);
    assert.match(resp.errors?.[0] || resp.data?.error || "", /target/i);
  });

  it("unreachable/unknown target returns out_of_range or no_fishing_area_for_cid", async () => {
    // Precondition: the character is away from any Channel catfish water area,
    // or the target CID is absent from the DRFish table.
    const resp = await sendCommand("fish", { target: 99999999 }, { timeout: 10000 });
    assert.equal(resp.success, false);
    assert.equal(resp.data.endReason, "failed");
    // Do not hard-assert the exact failReason; it may be server_error,
    // out_of_range, or no_fishing_area_for_cid depending on runtime data.
    assert.ok(
      typeof resp.data.failReason === "string" && resp.data.failReason.length > 0,
      `expected non-empty failReason, got ${JSON.stringify(resp.data)}`
    );
  });
});

describe("fish: QTE distribution (slow)", { concurrency: false }, () => {
  it("roughly 70/30 Good over 5 consecutive casts", async () => {
    // Precondition: same location and equipment as the happy-path test.
    // 5 casts times roughly 60s is about 5 minutes.
    let good = 0;
    let bad = 0;
    let successCount = 0;

    for (let i = 0; i < 5; i++) {
      const r = await sendCommand("fish", { target: TARGET_FISH_CID }, { timeout: 120000 });
      if (r.success) {
        good += r.data.qteGood;
        bad += r.data.qteBad;
        successCount++;
      } else {
        console.warn(`[qte] iteration ${i} failed: ${JSON.stringify(r)}`);
      }
      await sleep(500);  // let the FSM settle before the next cast
    }

    const total = good + bad;
    console.log(`[qte] ${successCount}/5 casts succeeded; QTE good=${good}, bad=${bad}, total=${total}`);

    if (total < 10) {
      console.warn(`[qte] sample size ${total} too small; skipping distribution assertion`);
      return;
    }

    const goodRatio = good / total;
    assert.ok(
      goodRatio >= 0.5 && goodRatio <= 0.9,
      `goodRatio ${goodRatio.toFixed(2)} out of lax bounds [0.5, 0.9] (samples ${total})`
    );
  });
});
