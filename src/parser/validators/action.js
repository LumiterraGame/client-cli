import { parsePositiveInt } from "../utils.js";

/**
 * Validate auto-combat command parameters.
 * @param {object} params - Params object returned by parse().
 * @returns {{ valid: boolean, error?: string, params: object }} Validation result with
 * default-filled params.
 */
export function validateAutoCombat(params) {
  const count = params.count ? Number(params.count) : 1;

  if (!Number.isInteger(count) || count < 1 || count > 5) {
    return { valid: false, error: "--count must be in range 1-5" };
  }

  return { valid: true, params: { ...params, count: String(count) } };
}

export function validateEscapeCombat(params) {
  const timeout = params.timeout === undefined ? 20 : Number(params.timeout);
  if (!Number.isInteger(timeout) || timeout < 5 || timeout > 60) {
    return { valid: false, error: "--timeout must be an integer in range 5-60" };
  }

  return { valid: true, params: { ...params, timeout: String(timeout) } };
}

/**
 * Validate auto-gather command parameters.
 * @param {object} params - Params object returned by parse().
 * @returns {{ valid: boolean, error?: string, params: object }} Validation result.
 */
export function validateAutoGather(params) {
  if (!params.target) {
    return { valid: false, error: "Missing required parameter: --target" };
  }

  const count = params.count ? Number(params.count) : 1;

  if (!Number.isInteger(count) || count < 1 || count > 5) {
    return { valid: false, error: "--count must be in range 1-5" };
  }

  return { valid: true, params: { ...params, count: String(count) } };
}

const DEFAULT_TIMEOUT_SEC = 90;
const MIN_TIMEOUT_SEC = 30;
const MAX_TIMEOUT_SEC = 300;

export function validateFish(params) {
  const next = { ...params };

  // --target is required (target fish cid).
  if (params.target === undefined || params.target === "" || params.target === true) {
    return { valid: false, error: "Missing required parameter: --target (target fish cid)" };
  }
  const rawTarget = String(params.target);
  if (!/^\d+$/.test(rawTarget)) {
    return { valid: false, error: `--target must be a positive integer: "${params.target}"` };
  }
  const targetCid = parseInt(rawTarget, 10);
  if (targetCid <= 0) {
    return { valid: false, error: `--target must be greater than 0; received ${targetCid}` };
  }
  next.target = targetCid;

  // --timeout is optional.
  if (params.timeout === undefined || params.timeout === "" || params.timeout === true) {
    next.timeout = DEFAULT_TIMEOUT_SEC;
  } else {
    const raw = String(params.timeout);
    if (!/^-?\d+$/.test(raw)) {
      return {
        valid: false,
        error: `--timeout must be an integer: "${params.timeout}"`,
      };
    }
    const n = parseInt(raw, 10);
    if (n < MIN_TIMEOUT_SEC || n > MAX_TIMEOUT_SEC) {
      return {
        valid: false,
        error: `--timeout must be in range ${MIN_TIMEOUT_SEC}-${MAX_TIMEOUT_SEC}; received ${n}`,
      };
    }
    next.timeout = n;
  }

  return { valid: true, params: next };
}

const VALID_SHORTCUT_WEAPON_TYPES = [
  "default", "sword", "hammer", "bow", "sickle", "axe", "pickaxe", "hoe", "water-bottle", "brush",
];

export function validateSetSkillShortcut(params) {
  const skillIdResult = parsePositiveInt(params["skill-id"], "skill-id");
  if (!skillIdResult.ok) {
    return { valid: false, error: skillIdResult.error };
  }

  if (params.slot === undefined) {
    return { valid: false, error: "Missing required parameter: --slot" };
  }

  const slot = Number(params.slot);
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) {
    return { valid: false, error: "--slot only supports 1-3" };
  }

  const normalizedWeaponType = normalizeShortcutWeaponType(params["weapon-type"]);
  if (normalizedWeaponType === null) {
    return { valid: false, error: "--weapon-type only supports default/sword/hammer/bow/sickle/axe/pickaxe/hoe/water-bottle/brush" };
  }

  return {
    valid: true,
    params: {
      ...params,
      "skill-id": skillIdResult.value,
      slot: String(slot),
      ...(normalizedWeaponType !== undefined ? { "weapon-type": normalizedWeaponType } : {}),
    },
  };
}

function normalizeShortcutWeaponType(value) {
  if (value === undefined) {
    return undefined;
  }

  const text = String(value).trim().toLowerCase();
  if (!VALID_SHORTCUT_WEAPON_TYPES.includes(text)) {
    if (text === "none") return "default";
    if (text === "waterbottle") return "water-bottle";
    return null;
  }

  return text;
}

export function validateSetCaptureProp(params) {
  if (!params["item-instance-id"]) {
    return { valid: false, error: "Missing required parameter: --item-instance-id" };
  }

  const next = { ...params };
  if (next.target !== undefined) {
    const r = parsePositiveInt(next.target, "target");
    if (!r.ok) return { valid: false, error: r.error };
    next.target = r.value;
  }

  return {
    valid: true,
    params: next,
  };
}
