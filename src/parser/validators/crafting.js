import { parsePositiveInt } from "../utils.js";

export function validateCraftLottery(params) {
  const recipeId = Number(params["recipe-id"]);
  if (!params["recipe-id"] || !Number.isInteger(recipeId) || recipeId <= 0) {
    return { valid: false, error: "Missing required parameter: --recipe-id (positive integer)" };
  }

  const count = params.count !== undefined ? Number(params.count) : 1;
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    return { valid: false, error: "--count must be in range 1-10" };
  }

  return {
    valid: true,
    params: { ...params, "recipe-id": String(recipeId), count: String(count) },
  };
}

export function validateQueryRecipes(params) {
  const normalized = { ...params };

  if (params["recipe-id"] !== undefined) {
    const parsed = parsePositiveInt(params["recipe-id"], "recipe-id");
    if (!parsed.ok) {
      return { valid: false, error: parsed.error };
    }
    normalized["recipe-id"] = parsed.value;
  }

  if (params.level !== undefined) {
    const parsed = parsePositiveInt(params.level, "level");
    if (!parsed.ok) {
      return { valid: false, error: parsed.error };
    }
    normalized.level = parsed.value;
  }

  if (params["talent-type"] !== undefined) {
    const rawTalentType = String(params["talent-type"]).trim().toLowerCase();
    const aliases = {
      battle: "battle",
      combat: "battle",
      farming: "farming",
      farm: "farming",
      gather: "gather",
      gathering: "gather",
    };

    if (!aliases[rawTalentType]) {
      return { valid: false, error: "--talent-type only supports battle/farming/gather" };
    }

    normalized["talent-type"] = aliases[rawTalentType];
  }

  return { valid: true, params: normalized };
}

export function validateQueryItemSources(params) {
  const itemCid = parsePositiveInt(params["item-cid"], "item-cid");
  if (!itemCid.ok) {
    return { valid: false, error: itemCid.error };
  }

  return {
    valid: true,
    params: {
      ...params,
      "item-cid": itemCid.value,
    },
  };
}
