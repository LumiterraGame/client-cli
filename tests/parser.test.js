import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  parse, validateAutoCombat, validateEscapeCombat, validateAutoGather, validateQueryNearEntities, validateDismantleEquipment, validateEnhanceEquipment, validateQueryEquipment, validateEquip,
  validateCapturePet, validateQueryCaptureSetup, validateSetSkillShortcut, validateSetCaptureProp, validateHatchPet,
  validateQuestDialog, validateQuestNormalClaim, validateQuestSubmit, validateQuestNormalAbandon,
  validateQueryTalent,
  validateQueryInventory, validateQueryRecipes, validateQueryItemSources, validateUseItem,
  validateNftStake, validateNftSmelt,
  validateNftToOnchain, validateOnchainNftToGame, validateCraftLottery,
  helpText,
} from "../src/parser.js";

describe("parser", () => {
  it("parses simple command", () => {
    const result = parse(["query-status"]);
    assert.equal(result.cmd, "query-status");
    assert.deepEqual(result.params, {});
    assert.equal(result.pretty, false);
  });

  it("parses command with params", () => {
    const result = parse(["quest-list", "--type", "daily"]);
    assert.equal(result.cmd, "quest-list");
    assert.equal(result.params.type, "daily");
  });

  it("validates equip tightened params", () => {
    const equipResult = parse([
      "equip",
      "--action",
      "equip",
      "--item-instance-id",
      "1001",
      "--wearer-id",
      "2001",
      "--slot",
      "weapon",
      "--pet-id",
      "9999",
    ]);
    assert.equal(equipResult.cmd, "equip");
    assert.equal(equipResult.params["item-instance-id"], "1001");
    assert.equal(equipResult.params["wearer-id"], "2001");
    assert.equal(equipResult.params.action, "equip");

    const unequipResult = parse([
      "equip",
      "--action",
      "unequip",
      "--wearer-id",
      "2001",
      "--slot",
      "weapon",
      "--item-instance-id",
      "1001",
    ]);
    assert.equal(unequipResult.cmd, "equip");
    assert.equal(unequipResult.params["wearer-id"], "2001");
    assert.equal(unequipResult.params.slot, "weapon");

    const optionalWearerId = validateEquip({ action: "equip", "item-instance-id": "1001" });
    assert.equal(optionalWearerId.valid, true);
    assert.equal(optionalWearerId.params["wearer-id"], undefined);

    const missingItemIdResult = validateEquip({ action: "equip", "wearer-id": "2001" });
    assert.equal(missingItemIdResult.valid, false);
    assert.equal(
      missingItemIdResult.error,
      "action=equip requires --item-instance-id or --item-cid",
    );

    const missingSlotResult = validateEquip({ action: "unequip", "wearer-id": "2001" });
    assert.equal(missingSlotResult.valid, false);
    assert.equal(missingSlotResult.error, "action=unequip requires --slot");

    const missingActionResult = validateEquip({
      "item-instance-id": "1001",
      "wearer-id": "2001",
    });
    assert.equal(missingActionResult.valid, false);
    assert.equal(missingActionResult.error, "Missing required parameter: --action");
  });

  it("parses multi-value query-inventory type args", () => {
    const result = parse(["query-inventory", "--type", "material", "wearable", "pet-egg", "food"]);
    assert.equal(result.cmd, "query-inventory");
    assert.equal(result.params.type, "material,wearable,pet-egg,food");
  });

  it("validates query-inventory item filters", () => {
    const validResult = validateQueryInventory({ "item-cid": "301", "item-instance-id": "inst-1", lv: "10" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params["item-cid"], "301");
    assert.equal(validResult.params["item-instance-id"], "inst-1");
    assert.equal(validResult.params.lv, "10");

    const invalidCidResult = validateQueryInventory({ "item-cid": "0" });
    assert.equal(invalidCidResult.valid, false);
    assert.equal(invalidCidResult.error, "--item-cid must be a positive integer");

    const invalidInstanceResult = validateQueryInventory({ "item-instance-id": "   " });
    assert.equal(invalidInstanceResult.valid, false);
    assert.equal(invalidInstanceResult.error, "Missing required parameter: --item-instance-id");
  });

  it("parses nft-stake with --items", () => {
    const result = parse(["nft-stake", "--items", "nftId1:1,nftId2:3"]);
    assert.equal(result.cmd, "nft-stake");
    assert.equal(result.params.items, "nftId1:1,nftId2:3");
  });

  it("parses multi-value nft-smelt staked-nft-ids via comma-separated value", () => {
    const result = parse(["nft-smelt", "--staked-nft-ids", "id1,id2,id3"]);
    assert.equal(result.cmd, "nft-smelt");
    assert.equal(result.params["staked-nft-ids"], "id1,id2,id3");
  });

  it("parses multiple params", () => {
    const result = parse(["auto-combat", "--target", "quest_monster", "--until", "task_complete", "--timeout", "300"]);
    assert.equal(result.cmd, "auto-combat");
    assert.equal(result.params.target, "quest_monster");
    assert.equal(result.params.until, "task_complete");
    assert.equal(result.params.timeout, "300");
  });

  it("parses query-near-entities params", () => {
    const result = parse(["query-near-entities", "--type", "monster", "--radius", "25", "--limit", "5", "--cid", "10023"]);
    assert.equal(result.cmd, "query-near-entities");
    assert.equal(result.params.type, "monster");
    assert.equal(result.params.radius, "25");
    assert.equal(result.params.limit, "5");
    assert.equal(result.params.cid, "10023");
  });

  it("parses escape-combat timeout", () => {
    const result = parse(["escape-combat", "--timeout", "25"]);
    assert.equal(result.cmd, "escape-combat");
    assert.equal(result.params.timeout, "25");
  });

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

  it("validates escape-combat timeout", () => {
    const defaultResult = validateEscapeCombat({});
    assert.equal(defaultResult.valid, true);
    assert.equal(defaultResult.params.timeout, "20");

    const customResult = validateEscapeCombat({ timeout: "45" });
    assert.equal(customResult.valid, true);
    assert.equal(customResult.params.timeout, "45");
  });

  it("rejects invalid escape-combat timeout", () => {
    const result = validateEscapeCombat({ timeout: "3" });
    assert.equal(result.valid, false);
    assert.equal(result.error, "--timeout must be an integer in range 5-60");
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

    const duplicateResult = validateDismantleEquipment({ "item-instance-id": "1001,1002,1001" });
    assert.equal(duplicateResult.valid, false);
    assert.equal(
      duplicateResult.error,
      "--item-instance-id does not support duplicate equipment instance IDs",
    );
  });

  it("validates query-capture-setup target", () => {
    const validResult = validateQueryCaptureSetup({ target: "3001" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params.target, "3001");

    const invalidResult = validateQueryCaptureSetup({ target: "0" });
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.error, "--target must be a positive integer");
  });

  it("validates set-skill-shortcut params", () => {
    const shortcutResult = validateSetSkillShortcut({ "skill-id": "31001", slot: "2" });
    assert.equal(shortcutResult.valid, true);
    assert.equal(shortcutResult.params["skill-id"], "31001");
    assert.equal(shortcutResult.params.slot, "2");

    const explicitWeaponTypeResult = validateSetSkillShortcut({
      "skill-id": "31001",
      slot: "2",
      "weapon-type": "waterbottle",
    });
    assert.equal(explicitWeaponTypeResult.valid, true);
    assert.equal(explicitWeaponTypeResult.params["weapon-type"], "water-bottle");

    const invalidResult = validateSetSkillShortcut({ "skill-id": "31001" });
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.error, "Missing required parameter: --slot");

    const invalidWeaponTypeResult = validateSetSkillShortcut({
      "skill-id": "31001",
      slot: "2",
      "weapon-type": "gun",
    });
    assert.equal(invalidWeaponTypeResult.valid, false);
    assert.equal(
      invalidWeaponTypeResult.error,
      "--weapon-type only supports default/sword/hammer/bow/sickle/axe/pickaxe/hoe/water-bottle/brush",
    );
  });

  it("validates set-capture-prop params", () => {
    const propResult = validateSetCaptureProp({ "item-instance-id": "prop-1", target: "3001" });
    assert.equal(propResult.valid, true);
    assert.equal(propResult.params["item-instance-id"], "prop-1");
    assert.equal(propResult.params.target, "3001");

    const invalidResult = validateSetCaptureProp({});
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.error, "Missing required parameter: --item-instance-id");
  });

  it("validates hatch-pet egg item instance id", () => {
    const validResult = validateHatchPet({ "egg-item-instance-id": "egg-1" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params["egg-item-instance-id"], "egg-1");

    const invalidResult = validateHatchPet({});
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.error, "Missing required parameter: --egg-item-instance-id");
  });

  it("validates capture-pet target", () => {
    const validResult = validateCapturePet({ target: "1001" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params.target, "1001");

    const result = parse(["capture-pet", "--target", "1001"]);
    assert.equal(result.params.target, "1001");
  });

  it("parses --pretty flag", () => {
    const result = parse(["query-status", "--pretty"]);
    assert.equal(result.cmd, "query-status");
    assert.equal(result.pretty, true);
  });

  it("parses flag without value (--craftable)", () => {
    const result = parse(["query-recipes", "--craftable"]);
    assert.equal(result.cmd, "query-recipes");
    assert.equal(result.params.craftable, true);
  });

  it("validates query-recipes optional filters", () => {
    const validResult = validateQueryRecipes({
      "recipe-id": "301",
      "include-locked": true,
      level: "12",
      "talent-type": "combat",
    });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params["recipe-id"], "301");
    assert.equal(validResult.params.level, "12");
    assert.equal(validResult.params["talent-type"], "battle");

    const invalidRecipeResult = validateQueryRecipes({ "recipe-id": "0" });
    assert.equal(invalidRecipeResult.valid, false);
    assert.equal(invalidRecipeResult.error, "--recipe-id must be a positive integer");

    const invalidLevelResult = validateQueryRecipes({ level: "0" });
    assert.equal(invalidLevelResult.valid, false);
    assert.equal(invalidLevelResult.error, "--level must be a positive integer");

    const invalidTalentResult = validateQueryRecipes({ "talent-type": "magic" });
    assert.equal(invalidTalentResult.valid, false);
    assert.equal(invalidTalentResult.error, "--talent-type only supports battle/farming/gather");
  });

  it("validates query-item-sources item-cid", () => {
    const validResult = validateQueryItemSources({ "item-cid": "301" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params["item-cid"], "301");

    const missingResult = validateQueryItemSources({});
    assert.equal(missingResult.valid, false);
    assert.equal(missingResult.error, "Missing required parameter: --item-cid");

    const invalidResult = validateQueryItemSources({ "item-cid": "0" });
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.error, "--item-cid must be a positive integer");
  });

  it("validates use-item item-instance-id", () => {
    const validResult = validateUseItem({ "item-instance-id": "inst-1", count: "2" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params["item-instance-id"], "inst-1");
    assert.equal(validResult.params.count, "2");

    const missingResult = validateUseItem({});
    assert.equal(missingResult.valid, false);
    assert.equal(missingResult.error, "Missing required parameter: --item-instance-id or --item-cid");
  });

  it("validates query-talent optional talent filter", () => {
    const defaultResult = validateQueryTalent({});
    assert.equal(defaultResult.valid, true);

    const validResult = validateQueryTalent({ "talent-type": "gathering" });
    assert.equal(validResult.valid, true);
    assert.equal(validResult.params["talent-type"], "gather");

    const invalidResult = validateQueryTalent({ "talent-type": "magic" });
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.error, "--talent-type only supports battle/farming/gather");
  });

  it("returns help when no args", () => {
    const result = parse([]);
    assert.equal(result.cmd, null);
    assert.equal(result.help, true);
  });

  it("returns help with --help", () => {
    const result = parse(["--help"]);
    assert.equal(result.help, true);
  });

  it("returns help with -h short flag", () => {
    const result = parse(["-h"]);
    assert.equal(result.cmd, null);
    assert.equal(result.help, true);
  });

  it("returns help with -H (case insensitive)", () => {
    const result = parse(["-H"]);
    assert.equal(result.cmd, null);
    assert.equal(result.help, true);
  });

  it("returns help with -help single dash long form", () => {
    const result = parse(["-help"]);
    assert.equal(result.cmd, null);
    assert.equal(result.help, true);
  });

  it("returns help with --h double dash short form", () => {
    const result = parse(["--h"]);
    assert.equal(result.cmd, null);
    assert.equal(result.help, true);
  });

  it("returns help when help flag follows a command", () => {
    const result = parse(["fish", "-h"]);
    assert.equal(result.cmd, "fish");
    assert.equal(result.help, true);
  });
});

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

describe("validateQueryNearEntities", () => {
  it("accepts empty params", () => {
    const result = validateQueryNearEntities({});
    assert.equal(result.valid, false);
    assert.ok(result.error.includes("--type"));
  });

  it("accepts valid type radius limit and cid", () => {
    const result = validateQueryNearEntities({ type: "EntityTypeMonster", radius: "25", limit: "5", cid: "10023" });
    assert.equal(result.valid, true);
    assert.equal(result.params.type, "monster");
    assert.equal(result.params.radius, "25");
    assert.equal(result.params.limit, "5");
    assert.equal(result.params.cid, "10023");
  });

  it("accepts numeric entity type", () => {
    const result = validateQueryNearEntities({ type: "2" });
    assert.equal(result.valid, true);
    assert.equal(result.params.type, "2");
  });

  it("rejects invalid radius", () => {
    const result = validateQueryNearEntities({ type: "monster", radius: "0" });
    assert.equal(result.valid, false);
    assert.equal(result.error, "--radius must be a number greater than 0");
  });

  it("rejects invalid limit", () => {
    const result = validateQueryNearEntities({ type: "monster", limit: "101" });
    assert.equal(result.valid, false);
    assert.equal(result.error, "--limit must be an integer in range 1-100");
  });

  it("rejects invalid cid", () => {
    const result = validateQueryNearEntities({ type: "monster", cid: "0" });
    assert.equal(result.valid, false);
    assert.equal(result.error, "--cid must be a positive integer");
  });

  it("rejects invalid type", () => {
    const result = validateQueryNearEntities({ type: "invalid-type" });
    assert.equal(result.valid, false);
    assert.ok(result.error.includes("--type"));
  });
});

describe("validateQuestDialog", () => {
  it("rejects missing --npc-cid", () => {
    const r = validateQuestDialog({});
    assert.equal(r.valid, false);
    assert.match(r.error, /npc-cid/);
  });

  it("accepts valid --npc-cid", () => {
    const r = validateQuestDialog({ "npc-cid": "1001" });
    assert.equal(r.valid, true);
  });
});

describe("validateQuestNormalClaim", () => {
  it("rejects missing --task-id", () => {
    const r = validateQuestNormalClaim({});
    assert.equal(r.valid, false);
    assert.match(r.error, /task-id/);
  });

  it("accepts valid --task-id", () => {
    const r = validateQuestNormalClaim({ "task-id": "123" });
    assert.equal(r.valid, true);
  });
});

describe("validateQuestSubmit", () => {
  it("rejects missing --task-id", () => {
    const r = validateQuestSubmit({});
    assert.equal(r.valid, false);
    assert.match(r.error, /task-id/);
  });

  it("accepts valid --task-id", () => {
    const r = validateQuestSubmit({ "task-id": "123" });
    assert.equal(r.valid, true);
  });
});

describe("validateQuestNormalAbandon", () => {
  it("rejects missing --task-id", () => {
    const r = validateQuestNormalAbandon({});
    assert.equal(r.valid, false);
    assert.match(r.error, /task-id/);
  });

  it("accepts valid --task-id", () => {
    const r = validateQuestNormalAbandon({ "task-id": "123" });
    assert.equal(r.valid, true);
  });
});

describe("validateNftStake", () => {
  it("rejects missing --items", () => {
    const r = validateNftStake({});
    assert.equal(r.valid, false);
    assert.match(r.error, /items/);
  });

  it("rejects malformed pair (no colon)", () => {
    const r = validateNftStake({ items: "nftId1" });
    assert.equal(r.valid, false);
  });

  it("rejects non-positive num", () => {
    const r = validateNftStake({ items: "nftId1:0" });
    assert.equal(r.valid, false);
  });

  it("accepts single valid pair", () => {
    const r = validateNftStake({ items: "nftId1:1" });
    assert.equal(r.valid, true);
    assert.equal(r.params.items, "nftId1:1");
  });

  it("accepts multiple valid pairs", () => {
    const r = validateNftStake({ items: "nftId1:1,nftId2:3" });
    assert.equal(r.valid, true);
    assert.equal(r.params.items, "nftId1:1,nftId2:3");
  });

  it("trims whitespace around pairs", () => {
    const r = validateNftStake({ items: " nftId1:2 , nftId2:1 " });
    assert.equal(r.valid, true);
    assert.equal(r.params.items, "nftId1:2,nftId2:1");
  });

  it("rejects more than 20 pairs", () => {
    const pairs = Array.from({ length: 21 }, (_, i) => `id${i}:1`).join(",");
    const r = validateNftStake({ items: pairs });
    assert.equal(r.valid, false);
    assert.match(r.error, /20/);
  });
});

describe("validateNftSmelt", () => {
  it("rejects missing --staked-nft-ids", () => {
    const r = validateNftSmelt({});
    assert.equal(r.valid, false);
    assert.match(r.error, /staked-nft-ids/);
  });

  it("accepts single id", () => {
    const r = validateNftSmelt({ "staked-nft-ids": "42" });
    assert.equal(r.valid, true);
    assert.equal(r.params["staked-nft-ids"], "42");
  });

  it("rejects more than 20 staked-nft-ids", () => {
    const ids = Array.from({ length: 21 }, (_, i) => String(i)).join(",");
    const r = validateNftSmelt({ "staked-nft-ids": ids });
    assert.equal(r.valid, false);
    assert.match(r.error, /20/);
  });

  it("validates nft-to-onchain requires nft-id and amount", () => {
    const missing = validateNftToOnchain({});
    assert.equal(missing.valid, false);

    const badAmount = validateNftToOnchain({ "nft-id": "abc123", amount: "0" });
    assert.equal(badAmount.valid, false);

    const ok = validateNftToOnchain({ "nft-id": "abc123", amount: "3" });
    assert.equal(ok.valid, true);
    assert.equal(ok.params["nft-id"], "abc123");
    assert.equal(ok.params.amount, "3");
  });

  it("validates onchain-nft-to-game requires nft-id and amount", () => {
    const missing = validateOnchainNftToGame({});
    assert.equal(missing.valid, false);

    const badAmount = validateOnchainNftToGame({ "nft-id": "xyz789", amount: "-1" });
    assert.equal(badAmount.valid, false);

    const ok = validateOnchainNftToGame({ "nft-id": "xyz789", amount: "2" });
    assert.equal(ok.valid, true);
    assert.equal(ok.params["nft-id"], "xyz789");
    assert.equal(ok.params.amount, "2");
  });

});

describe("query-zone / query-wallet", () => {
  it("parses query-zone command", () => {
    const result = parse(["query-zone"]);
    assert.equal(result.cmd, "query-zone");
    assert.deepEqual(result.params, {});
  });

  it("parses query-battle-areas command", () => {
    const result = parse(["query-battle-areas"]);
    assert.equal(result.cmd, "query-battle-areas");
    assert.deepEqual(result.params, {});
  });

  it("parses query-wallet command", () => {
    const result = parse(["query-wallet"]);
    assert.equal(result.cmd, "query-wallet");
    assert.deepEqual(result.params, {});
  });

  it("documents query-battle-areas in help text", () => {
    assert.match(helpText(), /query-battle-areas\s+Query all BattleArea regions in the current scene/);
  });
});

describe("validateCraftLottery", () => {
  it("rejects missing recipe-id", () => {
    const r = validateCraftLottery({});
    assert.equal(r.valid, false);
    assert.match(r.error, /recipe-id/);
  });

  it("rejects non-integer recipe-id", () => {
    const r = validateCraftLottery({ "recipe-id": "abc" });
    assert.equal(r.valid, false);
  });

  it("accepts valid recipe-id with default count", () => {
    const r = validateCraftLottery({ "recipe-id": "101" });
    assert.equal(r.valid, true);
    assert.equal(r.params["recipe-id"], "101");
    assert.equal(r.params.count, "1");
  });

  it("accepts count=10", () => {
    const r = validateCraftLottery({ "recipe-id": "101", count: "10" });
    assert.equal(r.valid, true);
    assert.equal(r.params.count, "10");
  });

  it("rejects count=0", () => {
    const r = validateCraftLottery({ "recipe-id": "101", count: "0" });
    assert.equal(r.valid, false);
    assert.match(r.error, /count/);
  });

  it("rejects count=11", () => {
    const r = validateCraftLottery({ "recipe-id": "101", count: "11" });
    assert.equal(r.valid, false);
  });
});
