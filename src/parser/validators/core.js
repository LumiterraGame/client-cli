import { parsePositiveInt } from "../utils.js";

export function validateQueryInventory(params) {
  const normalized = { ...params };

  if (params.lv !== undefined) {
    const parsed = parsePositiveInt(params.lv, "lv");
    if (!parsed.ok) {
      return { valid: false, error: parsed.error };
    }
    normalized.lv = parsed.value;
  }

  if (params["item-cid"] !== undefined) {
    const parsed = parsePositiveInt(params["item-cid"], "item-cid");
    if (!parsed.ok) {
      return { valid: false, error: parsed.error };
    }
    normalized["item-cid"] = parsed.value;
  }

  if (params["item-instance-id"] !== undefined) {
    const itemInstanceId = String(params["item-instance-id"]).trim();
    if (itemInstanceId === "") {
      return { valid: false, error: "Missing required parameter: --item-instance-id" };
    }
    normalized["item-instance-id"] = itemInstanceId;
  }

  return { valid: true, params: normalized };
}

const ENTITY_TYPE_ALIASES = new Map([
  ["player", "player"],
  ["entitytypeplayer", "player"],
  ["monster", "monster"],
  ["entitytypemonster", "monster"],
  ["npc", "npc"],
  ["entitytypenpc", "npc"],
  ["resource", "resource"],
  ["entitytyperesource", "resource"],
  ["pet", "pet"],
  ["entitytypepet", "pet"],
  ["worldanimal", "world-animal"],
  ["entitytypeworldanimal", "world-animal"],
]);

const ENTITY_TYPE_NUMBERS = new Set(["1", "2", "4", "5", "7", "12"]);

function normalizeEntityType(rawType) {
  if (rawType === undefined || rawType === null || rawType === "") {
    return null;
  }

  const trimmed = String(rawType).trim();
  if (ENTITY_TYPE_NUMBERS.has(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ENTITY_TYPE_ALIASES.get(normalized) ?? null;
}

/**
 * Validate query-near-entities command parameters.
 * @param {object} params - Params object returned by parse().
 * @returns {{ valid: boolean, error?: string, params: object }} Validation result with
 * default-filled params.
 */
export function validateQueryNearEntities(params) {
  const next = { ...params };
  const normalizedType = normalizeEntityType(params.type);

  if (!normalizedType) {
    return {
      valid: false,
      error: "--type only supports player, pet, npc, resource, monster, world-animal",
    };
  }
  next.type = normalizedType;

  if (params.radius !== undefined) {
    const radius = Number(params.radius);
    if (!Number.isFinite(radius) || radius <= 0) {
      return { valid: false, error: "--radius must be a number greater than 0" };
    }
    next.radius = String(radius);
  }

  if (params.limit !== undefined) {
    const limit = Number(params.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return { valid: false, error: "--limit must be an integer in range 1-100" };
    }
    next.limit = String(limit);
  }

  if (params.cid !== undefined && params.cid !== "") {
    const r = parsePositiveInt(params.cid, "cid");
    if (!r.ok) return { valid: false, error: r.error };
    next.cid = r.value;
  }

  return { valid: true, params: next };
}

export function validateQueryEquipment(params) {
  const targetIdValue = params["target-id"] !== undefined ? params["target-id"] : params["role-id"];
  if (targetIdValue !== undefined) {
    const r = parsePositiveInt(targetIdValue, "target-id");
    if (!r.ok) {
      return { valid: false, error: r.error };
    }

    return { valid: true, params: { ...params, "target-id": r.value } };
  }

  return { valid: true, params };
}
