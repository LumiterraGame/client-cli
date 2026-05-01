import { normalizeBooleanParam, parsePositiveInt, splitCommaSeparatedValues } from "../utils.js";

export function validateEquip(params) {
  const hasItemInstanceId = Boolean(params["item-instance-id"]);
  const hasSlot = Boolean(params.slot);
  const hasWearerId = params["wearer-id"] !== undefined;
  const hasAction = params.action !== undefined && String(params.action).trim() !== "";
  const normalizedAction = hasAction ? String(params.action).trim().toLowerCase() : "";

  if (!hasAction) {
    return { valid: false, error: "Missing required parameter: --action" };
  }

  if (!["equip", "unequip"].includes(normalizedAction)) {
    return { valid: false, error: "--action only supports equip/unequip" };
  }

  let wearerIdValue = undefined;
  if (hasWearerId) {
    const wearerIdResult = parsePositiveInt(params["wearer-id"], "wearer-id");
    if (!wearerIdResult.ok) {
      return { valid: false, error: wearerIdResult.error };
    }
    wearerIdValue = wearerIdResult.value;
  }

  const normalizedSlot = hasSlot ? String(params.slot).toLowerCase() : undefined;
  if (normalizedAction === "unequip" && hasSlot && !["head", "coat", "pant", "shoe", "hand", "weapon"].includes(normalizedSlot)) {
    return { valid: false, error: "--slot only supports head/coat/pant/shoe/hand/weapon" };
  }

  let itemCidValue = undefined;
  if (params["item-cid"] !== undefined) {
    const itemCidResult = parsePositiveInt(params["item-cid"], "item-cid");
    if (!itemCidResult.ok) {
      return { valid: false, error: itemCidResult.error };
    }
    itemCidValue = itemCidResult.value;
  }

  if (normalizedAction === "equip") {
    if (!hasItemInstanceId && itemCidValue === undefined) {
      return { valid: false, error: "action=equip requires --item-instance-id or --item-cid" };
    }
  } else if (!hasSlot) {
    return { valid: false, error: "action=unequip requires --slot" };
  }

  return {
    valid: true,
    params: {
      ...params,
      action: normalizedAction,
      ...(normalizedAction === "unequip" && hasSlot ? { slot: normalizedSlot } : {}),
      ...(wearerIdValue !== undefined ? { "wearer-id": wearerIdValue } : {}),
      ...(itemCidValue !== undefined ? { "item-cid": itemCidValue } : {}),
    },
  };
}

const VALID_WEAPON_TYPES = [
  "sword", "hammer", "bow", "sickle", "axe", "pickaxe",
  "hoe", "water-bottle", "brush", "scissors", "milker", "fishing-rod",
];

export function validateSwitchWeapon(params) {
  if (!params["weapon-type"]) {
    return { valid: false, error: "Missing required parameter: --weapon-type" };
  }

  const weaponType = String(params["weapon-type"]).toLowerCase();
  if (!VALID_WEAPON_TYPES.includes(weaponType)) {
    return { valid: false, error: `--weapon-type only supports: ${VALID_WEAPON_TYPES.join("/")}` };
  }

  return { valid: true, params: { ...params, "weapon-type": weaponType } };
}

export function validateEnhanceEquipment(params) {
  if (!params["item-instance-id"]) {
    return { valid: false, error: "Missing required parameter: --item-instance-id" };
  }

  if (!params["totem-id"]) {
    return { valid: false, error: "Missing required parameter: --totem-id" };
  }

  const normalized = normalizeBooleanParam(params["use-protective-stone"], false);
  if (normalized === null) {
    return { valid: false, error: "--use-protective-stone only supports true/false/1/0" };
  }

  return {
    valid: true,
    params: {
      ...params,
      "use-protective-stone": normalized ? "true" : "false",
    },
  };
}

export function validateDismantleEquipment(params) {
  if (!params["item-instance-id"]) {
    return { valid: false, error: "Missing required parameter: --item-instance-id" };
  }

  const itemInstanceIds = splitCommaSeparatedValues(params["item-instance-id"]);
  if (itemInstanceIds.length === 0) {
    return { valid: false, error: "Missing required parameter: --item-instance-id" };
  }

  if (new Set(itemInstanceIds).size !== itemInstanceIds.length) {
    return { valid: false, error: "--item-instance-id does not support duplicate equipment instance IDs" };
  }

  for (const itemInstanceId of itemInstanceIds) {
    if (!isEquipmentInstanceId(itemInstanceId)) {
      return { valid: false, error: "--item-instance-id must be an equipment instance ID" };
    }
  }

  return {
    valid: true,
    params: {
      ...params,
      "item-instance-id": itemInstanceIds.join(","),
    },
  };
}

function isEquipmentInstanceId(itemInstanceId) {
  const text = String(itemInstanceId).trim();
  if (/^[1-9]\d*$/.test(text)) return true;
  return /^local#[^#]+#[1-9]\d*$/.test(text);
}

export function validateQueryDismantlingRecord(params) {
  const normalized = { ...params };

  if (params.begin !== undefined) {
    const text = String(params.begin).trim();
    if (!/^(0|[1-9]\d*)$/.test(text)) {
      return { valid: false, error: "--begin must be an integer greater than or equal to 0" };
    }
    normalized.begin = text;
  }

  if (params.count !== undefined) {
    const countResult = parsePositiveInt(params.count, "count");
    if (!countResult.ok) {
      return { valid: false, error: countResult.error };
    }
    normalized.count = countResult.value;
  }

  return { valid: true, params: normalized };
}

export function validateClaimDismantlingMats(params) {
  if (params["record-id"] === undefined || String(params["record-id"]).trim() === "") {
    return { valid: false, error: "Missing required parameter: --record-id" };
  }

  return {
    valid: true,
    params: {
      ...params,
      "record-id": String(params["record-id"]).trim(),
    },
  };
}

export function validateQueryRecyclePool(params) {
  const normalized = { ...params };

  if (params["pool-id"] !== undefined) {
    const poolId = String(params["pool-id"]).trim();
    if (poolId === "") {
      return { valid: false, error: "--pool-id cannot be empty" };
    }
    normalized["pool-id"] = poolId;
  }

  if (params["pool-type-id"] !== undefined) {
    const poolTypeIdResult = parsePositiveInt(params["pool-type-id"], "pool-type-id");
    if (!poolTypeIdResult.ok) {
      return { valid: false, error: poolTypeIdResult.error };
    }
    normalized["pool-type-id"] = poolTypeIdResult.value;
  }

  return { valid: true, params: normalized };
}

export function validateQueryRecycleRecord(params) {
  const poolTypeIdResult = parsePositiveInt(params["pool-type-id"], "pool-type-id");
  if (!poolTypeIdResult.ok) {
    return { valid: false, error: poolTypeIdResult.error };
  }

  const normalized = { ...params, "pool-type-id": poolTypeIdResult.value };

  if (params.begin !== undefined) {
    const text = String(params.begin).trim();
    if (!/^(0|[1-9]\d*)$/.test(text)) {
      return { valid: false, error: "--begin must be an integer greater than or equal to 0" };
    }
    normalized.begin = text;
  }

  if (params.count !== undefined) {
    const countResult = parsePositiveInt(params.count, "count");
    if (!countResult.ok) {
      return { valid: false, error: countResult.error };
    }
    normalized.count = countResult.value;
  }

  return { valid: true, params: normalized };
}

export function validateDoEquipmentRecovery(params) {
  if (params["pool-id"] === undefined || String(params["pool-id"]).trim() === "") {
    return { valid: false, error: "Missing required parameter: --pool-id" };
  }

  if (!params["item-instance-id"]) {
    return { valid: false, error: "Missing required parameter: --item-instance-id" };
  }

  const itemInstanceIds = splitCommaSeparatedValues(params["item-instance-id"]);
  if (itemInstanceIds.length === 0) {
    return { valid: false, error: "Missing required parameter: --item-instance-id" };
  }

  if (new Set(itemInstanceIds).size !== itemInstanceIds.length) {
    return { valid: false, error: "--item-instance-id does not support duplicate item instance IDs" };
  }

  for (const itemInstanceId of itemInstanceIds) {
    if (!isEquipmentInstanceId(itemInstanceId)) {
      return { valid: false, error: "--item-instance-id must be an item instance ID" };
    }
  }

  const normalized = {
    ...params,
    "pool-id": String(params["pool-id"]).trim(),
    "item-instance-id": itemInstanceIds.join(","),
  };

  if (params.count !== undefined) {
    const countResult = parsePositiveInt(params.count, "count");
    if (!countResult.ok) {
      return { valid: false, error: countResult.error };
    }
    if (itemInstanceIds.length > 1 && countResult.value !== "1") {
      return { valid: false, error: "--count is only supported with a single --item-instance-id" };
    }
    normalized.count = countResult.value;
  }

  return { valid: true, params: normalized };
}

export function validateClaimRecycleReward(params) {
  if (params["pool-id"] === undefined || String(params["pool-id"]).trim() === "") {
    return { valid: false, error: "Missing required parameter: --pool-id" };
  }

  return {
    valid: true,
    params: {
      ...params,
      "pool-id": String(params["pool-id"]).trim(),
    },
  };
}
