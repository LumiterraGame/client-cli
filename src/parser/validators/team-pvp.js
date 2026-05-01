import { parsePositiveInt, normalizeBooleanParam } from "../utils.js";

function assertNoExtraParams(params, allowed) {
  const extras = Object.keys(params).filter(k => !allowed.includes(k));
  if (extras.length > 0) {
    return `Unsupported parameter(s): ${extras.map(k => "--" + k).join(", ")}`;
  }
  return null;
}

// === Team commands ===

export function validateTeamCreate(params) {
  const err = assertNoExtraParams(params, ["name", "desc", "public"]);
  if (err) return { valid: false, error: err };

  const out = {};
  if (params.name !== undefined && params.name !== "") {
    out.name = String(params.name);
  }
  if (params.desc !== undefined) {
    out.desc = String(params.desc);
  }
  if (params.public !== undefined) {
    const b = normalizeBooleanParam(params.public, null);
    if (b === null) {
      return { valid: false, error: "--public must be true or false" };
    }
    out.public = b;
  }
  return { valid: true, params: out };
}

export function validateTeamDisband(params) {
  const err = assertNoExtraParams(params, []);
  if (err) return { valid: false, error: err };
  return { valid: true, params: {} };
}

export function validateTeamLeave(params) {
  const err = assertNoExtraParams(params, []);
  if (err) return { valid: false, error: err };
  return { valid: true, params: {} };
}

export function validateTeamQuery(params) {
  const err = assertNoExtraParams(params, []);
  if (err) return { valid: false, error: err };
  return { valid: true, params: {} };
}

export function validateTeamInvite(params) {
  const err = assertNoExtraParams(params, ["player-id", "player-name"]);
  if (err) return { valid: false, error: err };

  const hasId = params["player-id"] !== undefined && params["player-id"] !== "";
  const hasName = params["player-name"] !== undefined && params["player-name"] !== "";
  if (!hasId && !hasName) {
    return { valid: false, error: "Must specify --player-id or --player-name" };
  }
  if (hasId && hasName) {
    return { valid: false, error: "--player-id and --player-name are mutually exclusive; specify only one" };
  }
  const out = {};
  if (hasId) {
    const r = parsePositiveInt(params["player-id"], "player-id");
    if (!r.ok) return { valid: false, error: r.error };
    out["player-id"] = r.value;
  }
  if (hasName) {
    out["player-name"] = String(params["player-name"]);
  }
  return { valid: true, params: out };
}

const REPLY_ACTIONS = new Set(["accept", "reject"]);

export function validateTeamReply(params) {
  const err = assertNoExtraParams(params, ["team-id", "inviter-id", "action"]);
  if (err) return { valid: false, error: err };

  const teamId = parsePositiveInt(params["team-id"], "team-id");
  if (!teamId.ok) return { valid: false, error: teamId.error };

  const inviterId = parsePositiveInt(params["inviter-id"], "inviter-id");
  if (!inviterId.ok) return { valid: false, error: inviterId.error };

  const action = params.action;
  if (!action || !REPLY_ACTIONS.has(action)) {
    return { valid: false, error: "--action must be accept or reject" };
  }

  return {
    valid: true,
    params: {
      "team-id": teamId.value,
      "inviter-id": inviterId.value,
      action,
    },
  };
}

// === Escort commands ===

export function validateEscortAccept(params) {
  const err = assertNoExtraParams(params, []);
  if (err) return { valid: false, error: err };
  return { valid: true, params: {} };
}

export function validateEscortStatus(params) {
  const err = assertNoExtraParams(params, []);
  if (err) return { valid: false, error: err };
  return { valid: true, params: {} };
}

// === PvP commands ===

const MODES = new Set(["peace", "pvp"]);

export function validateTogglePvp(params) {
  const err = assertNoExtraParams(params, ["mode"]);
  if (err) return { valid: false, error: err };

  const mode = params.mode;
  if (!mode || !MODES.has(mode)) {
    return { valid: false, error: "--mode must be peace or pvp" };
  }
  return { valid: true, params: { mode } };
}
