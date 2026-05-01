import { parsePositiveInt } from "../utils.js";

export function validatePetSummon(params) {
  if (!params["pet-id"]) {
    return { valid: false, error: "Missing required parameter: --pet-id" };
  }

  if (!params.action) {
    return { valid: false, error: "Missing required parameter: --action" };
  }

  if (!["follow", "dismiss"].includes(params.action)) {
    return { valid: false, error: "--action only supports follow or dismiss" };
  }

  return { valid: true, params };
}

export function validatePetFeed(params) {
  if (!params["pet-id"]) {
    return { valid: false, error: "Missing required parameter: --pet-id" };
  }

  if (params["food-id"] !== undefined) {
    return { valid: false, error: "pet-feed does not accept --food-id" };
  }

  return { valid: true, params };
}

export function validateMakePetEgg(params) {
  if (!params["pet-id"]) {
    return { valid: false, error: "Missing required parameter: --pet-id" };
  }

  return { valid: true, params };
}

export function validateHatchPet(params) {
  if (!params["egg-item-instance-id"]) {
    return { valid: false, error: "Missing required parameter: --egg-item-instance-id" };
  }

  return { valid: true, params };
}

export function validateClaimPet(params) {
  if (Object.keys(params).length > 0) {
    return { valid: false, error: "claim-pet does not accept parameters" };
  }

  return { valid: true, params };
}

export function validatePetWash(params) {
  if (!params["pet-id"]) {
    return { valid: false, error: "Missing required parameter: --pet-id" };
  }

  return { valid: true, params };
}

export function validateQueryCaptureSetup(params) {
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

export function validateCapturePet(params) {
  if (params.target === undefined || params.target === "") {
    return { valid: false, error: "Missing required parameter: --target" };
  }

  const r = parsePositiveInt(params.target, "target");
  if (!r.ok) return { valid: false, error: r.error };

  return {
    valid: true,
    params: {
      ...params,
      target: r.value,
    },
  };
}
