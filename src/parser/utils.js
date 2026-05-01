export function collectMultiValueArgs(args, startIndex) {
  const values = [];
  let consumed = 0;

  while (startIndex + consumed < args.length && !args[startIndex + consumed].startsWith("--")) {
    const tokens = splitCommaSeparatedValues(args[startIndex + consumed]);
    for (const token of tokens) {
      values.push(token);
    }
    consumed++;
  }

  values.consumed = consumed;
  return values;
}

export function splitCommaSeparatedValues(rawValue) {
  return String(rawValue)
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
}

export function normalizeBooleanParam(value, defaultValue) {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 0) return false;
    if (value === 1) return true;
    return null;
  }

  const text = String(value).trim().toLowerCase();
  if (text === "true" || text === "1") {
    return true;
  }
  if (text === "false" || text === "0") {
    return false;
  }

  return null;
}

export function parsePositiveInt(raw, fieldName) {
  if (raw === undefined || raw === "" || raw === null) {
    return { ok: false, error: `Missing required parameter: --${fieldName}` };
  }
  const s = String(raw);
  // Keep the string form to avoid Number precision loss (ulong may exceed 2^53).
  if (!/^[1-9]\d*$/.test(s)) {
    return { ok: false, error: `--${fieldName} must be a positive integer` };
  }
  return { ok: true, value: s };
}
