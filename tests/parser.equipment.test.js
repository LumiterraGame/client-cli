import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parse,
  validateClaimRecycleReward,
  validateClaimDismantlingMats,
  validateDismantleEquipment,
  validateDoEquipmentRecovery,
  validateEnhanceEquipment,
  validateQueryDismantlingRecord,
  validateQueryEquipment,
  validateQueryRecyclePool,
  validateQueryRecycleRecord,
} from "../src/parser.js";

describe("validateEnhanceEquipment", () => {
  it("parses enhance-equipment protective stone flag", () => {
    const result = parse([
      "enhance-equipment",
      "--item-instance-id",
      "1001",
      "--totem-id",
      "2001",
      "--use-protective-stone",
      "true",
    ]);
    assert.equal(result.cmd, "enhance-equipment");
    assert.equal(result.params["use-protective-stone"], "true");
  });

  it("validates enhance-equipment protective stone flag", () => {
    const defaultResult = validateEnhanceEquipment({ "item-instance-id": "1001", "totem-id": "2001" });
    assert.equal(defaultResult.valid, true);
    assert.equal(defaultResult.params["use-protective-stone"], "false");

    const trueResult = validateEnhanceEquipment({
      "item-instance-id": "1001",
      "totem-id": "2001",
      "use-protective-stone": "true",
    });
    assert.equal(trueResult.valid, true);
    assert.equal(trueResult.params["use-protective-stone"], "true");

    const falseResult = validateEnhanceEquipment({
      "item-instance-id": "1001",
      "totem-id": "2001",
      "use-protective-stone": "0",
    });
    assert.equal(falseResult.valid, true);
    assert.equal(falseResult.params["use-protective-stone"], "false");
  });

  it("rejects invalid enhance-equipment protective stone flag", () => {
    const result = validateEnhanceEquipment({
      "item-instance-id": "1001",
      "totem-id": "2001",
      "use-protective-stone": "maybe",
    });
    assert.equal(result.valid, false);
    assert.equal(result.error, "--use-protective-stone only supports true/false/1/0");
  });
});

describe("validateQueryEquipment", () => {
  it("validates query-equipment target-id flag", () => {
    const defaultResult = validateQueryEquipment({});
    assert.equal(defaultResult.valid, true);

    const validResult = validateQueryEquipment({ "target-id": "123" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params["target-id"], "123");

    const legacyResult = validateQueryEquipment({ "role-id": "456" });
    assert.equal(legacyResult.valid, true);
    assert.equal(legacyResult.params["target-id"], "456");

    const invalidResult = validateQueryEquipment({ "target-id": "0" });
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.error, "--target-id must be a positive integer");
  });
});

describe("validateDismantleEquipment", () => {
  it("validates dismantle-equipment item-instance-id flag", () => {
    const validResult = validateDismantleEquipment({ "item-instance-id": "1001" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params["item-instance-id"], "1001");

    const invalidResult = validateDismantleEquipment({});
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.error, "Missing required parameter: --item-instance-id");
  });

  it("parses multi-value dismantle-equipment item-instance-id args", () => {
    const result = parse(["dismantle-equipment", "--item-instance-id", "1001", "1002", "1003"]);
    assert.equal(result.cmd, "dismantle-equipment");
    assert.equal(result.params["item-instance-id"], "1001,1002,1003");
  });

  it("validates multi-value dismantle-equipment item-instance-id flag", () => {
    const commaResult = validateDismantleEquipment({ "item-instance-id": "1001, 1002,1003" });
    assert.equal(commaResult.valid, true);
    assert.equal(commaResult.params["item-instance-id"], "1001,1002,1003");

    const localIdResult = validateDismantleEquipment({
      "item-instance-id": "local#0x0000000000000000000000000000000000000000#93472209464764212902508670274184814238785155088",
    });
    assert.equal(localIdResult.valid, true);

    const duplicateResult = validateDismantleEquipment({ "item-instance-id": "1001,1002,1001" });
    assert.equal(duplicateResult.valid, false);
    assert.equal(
      duplicateResult.error,
      "--item-instance-id does not support duplicate equipment instance IDs",
    );

    const invalidIdResult = validateDismantleEquipment({ "item-instance-id": "1001,abc" });
    assert.equal(invalidIdResult.valid, false);
    assert.equal(invalidIdResult.error, "--item-instance-id must be an equipment instance ID");
  });

  it("validates query-dismantling-record pagination flags", () => {
    const defaultResult = validateQueryDismantlingRecord({});
    assert.equal(defaultResult.valid, true);

    const validResult = validateQueryDismantlingRecord({ begin: "0", count: "20" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params.begin, "0");
    assert.equal(validResult.params.count, "20");

    const invalidBeginResult = validateQueryDismantlingRecord({ begin: "-1" });
    assert.equal(invalidBeginResult.valid, false);
    assert.equal(
      invalidBeginResult.error,
      "--begin must be an integer greater than or equal to 0",
    );

    const invalidCountResult = validateQueryDismantlingRecord({ count: "0" });
    assert.equal(invalidCountResult.valid, false);
    assert.equal(invalidCountResult.error, "--count must be a positive integer");
  });

  it("validates claim-dismantling-mats record-id flag", () => {
    const validResult = validateClaimDismantlingMats({ "record-id": "dis-1001" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params["record-id"], "dis-1001");

    const invalidResult = validateClaimDismantlingMats({});
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.error, "Missing required parameter: --record-id");
  });
});

describe("validateEquipmentRecovery", () => {
  it("validates query-recycle-pool filters", () => {
    const defaultResult = validateQueryRecyclePool({});
    assert.equal(defaultResult.valid, true);

    const validResult = validateQueryRecyclePool({ "pool-id": "pool-1", "pool-type-id": "9001" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params["pool-id"], "pool-1");
    assert.equal(validResult.params["pool-type-id"], "9001");

    const invalidResult = validateQueryRecyclePool({ "pool-type-id": "0" });
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.error, "--pool-type-id must be a positive integer");
  });

  it("validates query-recycle-record pagination flags", () => {
    const validResult = validateQueryRecycleRecord({ "pool-type-id": "9001", begin: "0", count: "20" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params["pool-type-id"], "9001");
    assert.equal(validResult.params.begin, "0");
    assert.equal(validResult.params.count, "20");

    const missingResult = validateQueryRecycleRecord({});
    assert.equal(missingResult.valid, false);
    assert.equal(missingResult.error, "Missing required parameter: --pool-type-id");

    const invalidBeginResult = validateQueryRecycleRecord({ "pool-type-id": "9001", begin: "-1" });
    assert.equal(invalidBeginResult.valid, false);
    assert.equal(
      invalidBeginResult.error,
      "--begin must be an integer greater than or equal to 0",
    );
  });

  it("parses and validates do-equipment-recovery item-instance-id args", () => {
    const parsed = parse(["do-equipment-recovery", "--pool-id", "pool-1", "--item-instance-id", "1001", "1002"]);
    assert.equal(parsed.cmd, "do-equipment-recovery");
    assert.equal(parsed.params["item-instance-id"], "1001,1002");

    const validResult = validateDoEquipmentRecovery({ "pool-id": "pool-1", "item-instance-id": "1001, 1002" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params["pool-id"], "pool-1");
    assert.equal(validResult.params["item-instance-id"], "1001,1002");

    const countResult = validateDoEquipmentRecovery({ "pool-id": "pool-1", "item-instance-id": "1001", count: "3" });
    assert.equal(countResult.valid, true);
    assert.equal(countResult.params.count, "3");

    const multiCountResult = validateDoEquipmentRecovery({ "pool-id": "pool-1", "item-instance-id": "1001,1002", count: "2" });
    assert.equal(multiCountResult.valid, false);
    assert.equal(
      multiCountResult.error,
      "--count is only supported with a single --item-instance-id",
    );

    const duplicateResult = validateDoEquipmentRecovery({ "pool-id": "pool-1", "item-instance-id": "1001,1001" });
    assert.equal(duplicateResult.valid, false);
    assert.equal(
      duplicateResult.error,
      "--item-instance-id does not support duplicate item instance IDs",
    );
  });

  it("validates claim-recycle-reward pool-id flag", () => {
    const validResult = validateClaimRecycleReward({ "pool-id": "previous-pool-1" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params["pool-id"], "previous-pool-1");

    const invalidResult = validateClaimRecycleReward({});
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.error, "Missing required parameter: --pool-id");
  });
});
