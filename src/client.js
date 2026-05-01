import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const DEFAULT_PORT = 24366;
const DISCOVERY_PORT_COUNT = 10;
const LEGACY_DISCOVERY_PORT = 7860;
const DEFAULT_HOST = `http://127.0.0.1:${DEFAULT_PORT}`;
const DEFAULT_TIMEOUT = 600000; // 10 minutes
const DEFAULT_CONNECT_TIMEOUT = 1500;
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1"]);

function normalizeHost(host) {
  return host.replace(/\/+$/, "");
}

function parseHost(host) {
  try {
    return new URL(normalizeHost(host));
  } catch {
    return null;
  }
}

function isLocalHost(host) {
  const url = parseHost(host);
  return url != null && LOCAL_HOSTNAMES.has(url.hostname);
}

function loopbackHostsFor(host) {
  const url = parseHost(host);
  if (url == null || !isLocalHost(host)) {
    return [normalizeHost(host)];
  }

  const protocol = url.protocol || "http:";
  const port = url.port || String(DEFAULT_PORT);
  const ipv4 = `${protocol}//127.0.0.1:${port}`;
  const localhost = `${protocol}//localhost:${port}`;

  return [ipv4, localhost];
}

function explicitCandidateHosts(host) {
  const normalized = normalizeHost(host);
  return [...new Set(loopbackHostsFor(normalized).map(normalizeHost))];
}

export function discoveryCandidateHosts() {
  const defaultHosts = Array.from({ length: DISCOVERY_PORT_COUNT }, (_, index) => {
    return `http://127.0.0.1:${DEFAULT_PORT + index}`;
  });

  return [
    ...defaultHosts,
    `http://127.0.0.1:${LEGACY_DISCOVERY_PORT}`,
  ];
}

function describeConnectionError(err) {
  if (!err) return "";
  const code = err.code ? `${err.code}: ` : "";
  return `${code}${err.message || String(err)}`;
}

function abortError() {
  const err = new Error("Command timed out or was interrupted");
  err.name = "AbortError";
  return err;
}

async function postCommand(host, body, signal, {
  connectTimeout = DEFAULT_CONNECT_TIMEOUT,
  responseTimeout = null,
} = {}) {
  const url = new URL(`${host}/api/command/`);
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${url.protocol}`);
  }

  return await new Promise((resolve, reject) => {
    let settled = false;
    let connected = false;
    let connectTimer = null;
    let responseTimer = null;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      if (connectTimer) clearTimeout(connectTimer);
      if (responseTimer) clearTimeout(responseTimer);
      signal?.removeEventListener("abort", onAbort);
      fn(value);
    };

    const onAbort = () => {
      const err = abortError();
      req.destroy(err);
      finish(reject, err);
    };

    const req = request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (response) => {
      connected = true;
      if (connectTimer) clearTimeout(connectTimer);
      if (responseTimeout != null) {
        responseTimer = setTimeout(() => {
          const err = new Error(`Timed out waiting for ${host} to respond`);
          err.code = "RESPONSE_TIMEOUT";
          req.destroy(err);
          finish(reject, err);
        }, responseTimeout);
      }

      let text = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        text += chunk;
      });
      response.on("end", () => {
        try {
          finish(resolve, JSON.parse(text));
        } catch {
          finish(resolve, {
            success: false,
            data: null,
            earnings: null,
            errors: [`Server returned non-JSON content: ${text.slice(0, 200)}`],
          });
        }
      });
    });

    req.on("socket", (socket) => {
      if (!socket.connecting) {
        connected = true;
        return;
      }

      connectTimer = setTimeout(() => {
        if (connected) return;
        const err = new Error(`Timed out connecting to ${host}`);
        err.code = "CONNECT_TIMEOUT";
        req.destroy(err);
        finish(reject, err);
      }, connectTimeout);

      socket.once("connect", () => {
        connected = true;
        if (connectTimer) clearTimeout(connectTimer);
      });
      socket.once("secureConnect", () => {
        connected = true;
        if (connectTimer) clearTimeout(connectTimer);
      });
    });

    req.on("error", (err) => {
      finish(reject, err);
    });

    if (signal?.aborted) {
      onAbort();
      return;
    }

    signal?.addEventListener("abort", onAbort, { once: true });
    req.write(body);
    req.end();
  });
}

function isLumiterraAppInfo(response) {
  return response?.success === true
    && response.data != null
    && typeof response.data === "object"
    && typeof response.data.gameVersion === "string"
    && typeof response.data.platform === "string"
    && typeof response.data.unityVersion === "string";
}

async function discoverDefaultHost(signal, candidateHosts = discoveryCandidateHosts()) {
  const body = JSON.stringify({ cmd: "query-app-info", params: {} });
  const triedHosts = [];
  let lastConnectionError = null;

  for (const candidate of candidateHosts) {
    triedHosts.push(candidate);
    try {
      const response = await postCommand(candidate, body, signal, {
        responseTimeout: DEFAULT_CONNECT_TIMEOUT,
      });
      if (isLumiterraAppInfo(response)) {
        return { host: candidate, triedHosts, lastConnectionError };
      }
    } catch (err) {
      if (err.name === "AbortError") {
        throw err;
      }
      lastConnectionError = err;
    }
  }

  return { host: null, triedHosts, lastConnectionError };
}

/**
 * Sends a command to the game HTTP server.
 * @param {string} cmd Command name.
 * @param {object} params Parameters.
 * @param {object} options { host, timeout, abortController, discoveryHosts }
 * @returns {Promise<object>} Parsed JSON response.
 */
export async function sendCommand(cmd, params = {}, options = {}) {
  const hasExplicitHost = options.host != null
    || process.env.LUMITERRA_HOST != null;
  const host = normalizeHost(options.host || process.env.LUMITERRA_HOST || DEFAULT_HOST);
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  const body = JSON.stringify({ cmd, params });

  const controller = options.abortController || new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const triedHosts = [];
  let lastConnectionError = null;

  try {
    if (!hasExplicitHost) {
      const discovered = await discoverDefaultHost(controller.signal, options.discoveryHosts);
      triedHosts.push(...discovered.triedHosts);
      lastConnectionError = discovered.lastConnectionError;

      if (discovered.host != null) {
        const result = await postCommand(discovered.host, body, controller.signal);
        return result;
      }
    }

    if (hasExplicitHost) {
      for (const candidate of explicitCandidateHosts(host)) {
        triedHosts.push(candidate);
        try {
          const result = await postCommand(candidate, body, controller.signal);
          return result;
        } catch (err) {
          if (err.name === "AbortError") {
            return {
              success: false,
              data: null,
              earnings: null,
              errors: ["Command timed out or was interrupted"],
            };
          }
          lastConnectionError = err;
          if (!isLocalHost(host)) break;
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      return {
        success: false,
        data: null,
        earnings: null,
        errors: ["Command timed out or was interrupted"],
      };
    }
  } finally {
    clearTimeout(timer);
  }

  const tried = triedHosts.length > 1 ? `, tried: ${triedHosts.join(", ")}` : "";
  const detail = lastConnectionError
    ? `, last error: ${describeConnectionError(lastConnectionError)}`
    : "";
  return {
    success: false,
    data: null,
    earnings: null,
    errors: [`Unable to connect to the game (${host})${tried}${detail}. Please make sure the game is running`],
  };
}
