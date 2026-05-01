import { parsePositiveInt } from "../utils.js";

export function validateFarmHoe(params) {
  const r = parsePositiveInt(params["soil-id"], "soil-id");
  if (!r.ok) return { valid: false, error: r.error };
  return { valid: true, params: { ...params, "soil-id": r.value } };
}

export function validateFarmEradicate(params) {
  const r = parsePositiveInt(params["soil-id"], "soil-id");
  if (!r.ok) return { valid: false, error: r.error };
  return { valid: true, params: { ...params, "soil-id": r.value } };
}

export function validateFarmWater(params) {
  const r = parsePositiveInt(params["soil-id"], "soil-id");
  if (!r.ok) return { valid: false, error: r.error };
  return { valid: true, params: { ...params, "soil-id": r.value } };
}

export function validateFarmHarvest(params) {
  const r = parsePositiveInt(params["soil-id"], "soil-id");
  if (!r.ok) return { valid: false, error: r.error };
  return { valid: true, params: { ...params, "soil-id": r.value } };
}

export function validateFarmQuery(params) {
  const hasSoilId = params["soil-id"] !== undefined && params["soil-id"] !== "";
  const hasCid = params["cid"] !== undefined && params["cid"] !== "";
  if (hasSoilId && hasCid) {
    return { valid: false, error: "--soil-id and --cid are mutually exclusive; specify only one" };
  }
  const next = { ...params };
  if (hasSoilId) {
    const r = parsePositiveInt(params["soil-id"], "soil-id");
    if (!r.ok) return { valid: false, error: r.error };
    next["soil-id"] = r.value;
  }
  if (hasCid) {
    const r = parsePositiveInt(params["cid"], "cid");
    if (!r.ok) return { valid: false, error: r.error };
    next["cid"] = r.value;
  }
  return { valid: true, params: next };
}
