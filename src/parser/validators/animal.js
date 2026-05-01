import { parsePositiveInt } from "../utils.js";

export function validateAnimalPet(params) {
  const r = parsePositiveInt(params["entity-id"], "entity-id");
  if (!r.ok) return { valid: false, error: r.error };
  return { valid: true, params: { ...params, "entity-id": r.value } };
}

export function validateAnimalQuery(params) {
  const hasEntityId = params["entity-id"] !== undefined && params["entity-id"] !== "";
  const hasCid = params["cid"] !== undefined && params["cid"] !== "";
  if (hasEntityId && hasCid) {
    return { valid: false, error: "--entity-id and --cid are mutually exclusive; specify only one" };
  }
  const next = { ...params };
  if (hasEntityId) {
    const r = parsePositiveInt(params["entity-id"], "entity-id");
    if (!r.ok) return { valid: false, error: r.error };
    next["entity-id"] = r.value;
  }
  if (hasCid) {
    const r = parsePositiveInt(params["cid"], "cid");
    if (!r.ok) return { valid: false, error: r.error };
    next["cid"] = r.value;
  }
  return { valid: true, params: next };
}
