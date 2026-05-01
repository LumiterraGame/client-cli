import { parsePositiveInt } from "../utils.js";

function normalizeTalentTypeParam(rawTalentType) {
  if (rawTalentType === undefined) {
    return { ok: false, error: "Missing required parameter: --talent-type" };
  }

  const normalized = String(rawTalentType).trim().toLowerCase();
  const aliases = {
    battle: "battle",
    combat: "battle",
    farming: "farming",
    farm: "farming",
    gather: "gather",
    gathering: "gather",
  };

  if (!aliases[normalized]) {
    return { ok: false, error: "--talent-type only supports battle/farming/gather" };
  }

  return { ok: true, value: aliases[normalized] };
}

export function validateQueryTalent(params) {
  if (params["talent-node-id"] !== undefined) {
    const r = parsePositiveInt(params["talent-node-id"], "talent-node-id");
    if (!r.ok) {
      return { valid: false, error: r.error };
    }
    return { valid: true, params: { "talent-node-id": r.value } };
  }

  if (params["talent-type"] === undefined) {
    return { valid: true, params };
  }

  const parsed = normalizeTalentTypeParam(params["talent-type"]);
  if (!parsed.ok) {
    return { valid: false, error: parsed.error };
  }

  return {
    valid: true,
    params: {
      ...params,
      "talent-type": parsed.value,
    },
  };
}

export function validateTalentManage(params) {
  if (!params.action) {
    return { valid: false, error: "Missing required parameter: --action" };
  }

  if (!["upgrade", "downgrade"].includes(params.action)) {
    return { valid: false, error: "--action only supports upgrade or downgrade" };
  }

  if (!params["talent-type"]) {
    return { valid: false, error: "Missing required parameter: --talent-type" };
  }

  const parsed = normalizeTalentTypeParam(params["talent-type"]);
  if (!parsed.ok) {
    return { valid: false, error: parsed.error };
  }

  if (!params["node-id"]) {
    return { valid: false, error: "Missing required parameter: --node-id" };
  }

  return {
    valid: true,
    params: {
      ...params,
      "talent-type": parsed.value,
    },
  };
}
