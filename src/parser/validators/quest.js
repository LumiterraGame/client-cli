// === Quest commands ===
export function validateQuestDialog(params) {
  if (!params["npc-cid"]) {
    return { valid: false, error: "Missing required parameter: --npc-cid" };
  }
  return { valid: true, params };
}

export function validateQuestNormalClaim(params) {
  if (!params["task-id"]) {
    return { valid: false, error: "Missing required parameter: --task-id" };
  }
  return { valid: true, params };
}

export function validateQuestSubmit(params) {
  if (!params["task-id"]) {
    return { valid: false, error: "Missing required parameter: --task-id" };
  }
  return { valid: true, params };
}

export function validateQuestNormalAbandon(params) {
  if (!params["task-id"]) {
    return { valid: false, error: "Missing required parameter: --task-id" };
  }
  return { valid: true, params };
}

// === Token-task commands ===
export function validateTokenTaskAccept(params) {
  if (!params["task-id"]) {
    return { valid: false, error: "Missing required parameter: --task-id" };
  }
  return { valid: true, params };
}

export function validateTokenTaskClaim(params) {
  if (!params["task-id"]) {
    return { valid: false, error: "Missing required parameter: --task-id" };
  }
  return { valid: true, params };
}

export function validateTokenTaskAbandon(params) {
  if (!params["task-id"]) {
    return { valid: false, error: "Missing required parameter: --task-id" };
  }
  return { valid: true, params };
}

export function validateTokenTaskRefresh(params) {
  if (
    params.talent &&
    !["battle", "combat", "farming", "farm", "gather", "gathering"].includes(params.talent)
  ) {
    return { valid: false, error: "--talent only supports battle/farming/gather" };
  }

  return { valid: true, params };
}
