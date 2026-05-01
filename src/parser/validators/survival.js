import { parsePositiveInt } from "../utils.js";

export function validateUseItem(params) {
  const hasItemInstanceId = params["item-instance-id"] !== undefined && String(params["item-instance-id"]).trim() !== "";
  const hasItemCid = params["item-cid"] !== undefined;

  if (!hasItemInstanceId && !hasItemCid) {
    return { valid: false, error: "Missing required parameter: --item-instance-id or --item-cid" };
  }

  const result = { ...params };

  if (hasItemCid) {
    const r = parsePositiveInt(params["item-cid"], "item-cid");
    if (!r.ok) {
      return { valid: false, error: r.error };
    }
    result["item-cid"] = r.value;
  }

  if (params.count !== undefined) {
    const count = Number(params.count);
    if (!Number.isInteger(count) || count < 1) {
      return { valid: false, error: "--count must be greater than 0" };
    }
    result.count = String(count);
  }

  return { valid: true, params: result };
}

export function validateRevive(params) {
  const type = params.type;
  if (!type) {
    return { valid: false, error: "Missing required parameter: --type" };
  }

  if (!["respawn", "town"].includes(type)) {
    return { valid: false, error: "--type only supports respawn or town" };
  }

  return { valid: true, params };
}

export function validateEnergyManage(params) {
  const action = params.action;
  if (!action) {
    return { valid: false, error: "Missing required parameter: --action" };
  }

  if (!["buy", "borrow", "repay"].includes(action)) {
    return { valid: false, error: "--action only supports buy/borrow/repay" };
  }

  if (action === "repay") {
    if (params.count !== undefined) {
      return { valid: false, error: "repay does not accept --count" };
    }
    return { valid: true, params };
  }

  const count = Number(params.count);
  if (!Number.isInteger(count) || count < 1) {
    return { valid: false, error: "--count must be greater than 0 for buy/borrow" };
  }

  return { valid: true, params: { ...params, count: String(count) } };
}
