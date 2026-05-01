import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { discoveryCandidateHosts, sendCommand } from "../src/client.js";

const DISCOVERY_START_PORT = 24366;

describe("client", () => {
  let server;
  let port;
  let previousHost;
  const discoveryServers = [];

  function handler(req, res) {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const parsed = JSON.parse(body);

      if (parsed.cmd === "query-status") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: true,
          data: { level: 45, hp: 1200, maxHp: 1500, position: { x: 10, y: 0, z: 20 }, energy: 80, maxEnergy: 100 },
          earnings: null,
          errors: [],
        }));
      } else {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          success: false,
          data: null,
          earnings: null,
          errors: [`Unknown command: ${parsed.cmd}`],
        }));
      }
    });
  }

  before(async () => {
    previousHost = process.env.LUMITERRA_HOST;
    delete process.env.LUMITERRA_HOST;

    server = createServer(handler);

    await new Promise((resolve) => {
      server.listen({ host: "127.0.0.1", port: 0 }, () => {
        port = server.address().port;
        resolve();
      });
    });
  });

  afterEach(async () => {
    await Promise.all(discoveryServers.splice(0).map((entry) => closeServer(entry.server)));
    delete process.env.LUMITERRA_HOST;
  });

  after(() => {
    server.close();
    if (previousHost == null) {
      delete process.env.LUMITERRA_HOST;
    } else {
      process.env.LUMITERRA_HOST = previousHost;
    }
  });

  it("sends command and receives success response", async () => {
    const result = await sendCommand("query-status", {}, { host: `http://localhost:${port}` });
    assert.equal(result.success, true);
    assert.equal(result.data.level, 45);
  });

  it("handles error response", async () => {
    const result = await sendCommand("fail-cmd", {}, { host: `http://localhost:${port}` });
    assert.equal(result.success, false);
    assert.ok(result.errors[0].includes("Unknown command"));
  });

  it("handles connection failure", async () => {
    const result = await sendCommand("query-status", {}, { host: "http://localhost:1" });
    assert.equal(result.success, false);
    assert.ok(result.errors[0].includes("Unable to connect to the game"));
  });

  it("discovers the default Lumiterra server on 24366", async () => {
    const found = await listenDiscoveryServer(DISCOVERY_START_PORT, {
      lumiterra: true,
      level: 66,
    });

    const result = await sendCommand("query-status");

    assert.equal(result.success, true);
    assert.equal(result.data.level, 66);
    assert.deepEqual(
      found.requests.map((request) => request.cmd),
      ["query-app-info", "query-status"],
    );
  });

  it("scans to the next port when 24366 is unavailable", async () => {
    const found = await listenDiscoveryServer(DISCOVERY_START_PORT + 1, {
      lumiterra: true,
      level: 67,
    });

    const result = await sendCommand("query-status");

    assert.equal(result.success, true);
    assert.equal(result.data.level, 67);
    assert.deepEqual(
      found.requests.map((request) => request.cmd),
      ["query-app-info", "query-status"],
    );
  });

  it("skips a non-Lumiterra service while scanning", async () => {
    const fake = await listenDiscoveryServer(DISCOVERY_START_PORT, {
      lumiterra: false,
      level: 11,
    });
    const found = await listenDiscoveryServer(DISCOVERY_START_PORT + 1, {
      lumiterra: true,
      level: 67,
    });

    const result = await sendCommand("query-status");

    assert.equal(result.success, true);
    assert.equal(result.data.level, 67);
    assert.deepEqual(fake.requests.map((request) => request.cmd), ["query-app-info"]);
    assert.deepEqual(
      found.requests.map((request) => request.cmd),
      ["query-app-info", "query-status"],
    );
  });

  it("uses the lowest Lumiterra port when multiple instances are available", async () => {
    const first = await listenDiscoveryServer(DISCOVERY_START_PORT, {
      lumiterra: true,
      level: 66,
    });
    const second = await listenDiscoveryServer(DISCOVERY_START_PORT + 1, {
      lumiterra: true,
      level: 67,
    });

    const result = await sendCommand("query-status");

    assert.equal(result.success, true);
    assert.equal(result.data.level, 66);
    assert.deepEqual(
      first.requests.map((request) => request.cmd),
      ["query-app-info", "query-status"],
    );
    assert.deepEqual(second.requests, []);
  });

  it("includes the legacy game CLI port as the final default discovery fallback", () => {
    assert.equal(discoveryCandidateHosts().at(-1), "http://127.0.0.1:7860");
  });

  it("does not send the command when discovery finds no Lumiterra server", async () => {
    const fakes = [];
    for (let i = 0; i < 10; i++) {
      fakes.push(await listenDiscoveryServer(DISCOVERY_START_PORT + i, {
        lumiterra: false,
        level: 10 + i,
      }));
    }

    const result = await sendCommand("query-status", {}, {
      discoveryHosts: discoveryHostsFor(fakes),
    });

    assert.equal(result.success, false);
    assert.ok(result.errors[0].includes("Unable to connect to the game"));
    for (const fake of fakes) {
      assert.deepEqual(fake.requests.map((request) => request.cmd), ["query-app-info"]);
    }
  });

  it("falls back to the legacy game CLI port after scanning the default range", async () => {
    const fakes = [];
    for (let i = 0; i < 10; i++) {
      fakes.push(await listenDiscoveryServer(DISCOVERY_START_PORT + i, {
        lumiterra: false,
        level: 10 + i,
      }));
    }
    const legacy = await listenDiscoveryServer(0, {
      lumiterra: true,
      level: 78,
    });

    const result = await sendCommand("query-status", {}, {
      discoveryHosts: discoveryHostsFor([...fakes, legacy]),
    });

    assert.equal(result.success, true);
    assert.equal(result.data.level, 78);
    for (const fake of fakes) {
      assert.deepEqual(fake.requests.map((request) => request.cmd), ["query-app-info"]);
    }
    assert.deepEqual(
      legacy.requests.map((request) => request.cmd),
      ["query-app-info", "query-status"],
    );
  });

  it("does not scan when LUMITERRA_HOST is set", async () => {
    const fake = await listenDiscoveryServer(DISCOVERY_START_PORT, {
      lumiterra: true,
      level: 66,
    });
    process.env.LUMITERRA_HOST = `http://127.0.0.1:${port}`;

    const result = await sendCommand("query-status");

    assert.equal(result.success, true);
    assert.equal(result.data.level, 45);
    assert.deepEqual(fake.requests, []);
  });

  async function listenDiscoveryServer(portToListen, { lumiterra, level }) {
    const requests = [];
    const testServer = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        const parsed = JSON.parse(body);
        requests.push(parsed);

        if (parsed.cmd === "query-app-info") {
          res.writeHead(200, { "Content-Type": "application/json", "Connection": "close" });
          res.end(JSON.stringify(lumiterra
            ? {
                success: true,
                data: {
                  language: "en",
                  gameVersion: "0.0.test",
                  platform: "Editor",
                  unityVersion: "2021.3.8f1",
                },
                earnings: null,
                errors: [],
              }
            : {
                success: true,
                data: { service: "not-lumiterra" },
                earnings: null,
                errors: [],
              }));
          return;
        }

        if (parsed.cmd === "query-status") {
          res.writeHead(200, { "Content-Type": "application/json", "Connection": "close" });
          res.end(JSON.stringify({
            success: true,
            data: { level },
            earnings: null,
            errors: [],
          }));
          return;
        }

        res.writeHead(200, { "Content-Type": "application/json", "Connection": "close" });
        res.end(JSON.stringify({
          success: false,
          data: null,
          earnings: null,
          errors: [`Unknown command: ${parsed.cmd}`],
        }));
      });
    });

    await new Promise((resolve, reject) => {
      testServer.once("error", reject);
      testServer.listen({ host: "127.0.0.1", port: portToListen }, () => {
        testServer.off("error", reject);
        resolve();
      });
    });

    const entry = { server: testServer, requests };
    discoveryServers.push(entry);
    return entry;
  }

  function discoveryHostsFor(entries) {
    return entries.map((entry) => {
      return `http://127.0.0.1:${entry.server.address().port}`;
    });
  }

  async function closeServer(serverToClose) {
    await new Promise((resolve, reject) => {
      serverToClose.close((err) => {
        if (err) reject(err);
        else resolve();
      });
      serverToClose.closeAllConnections?.();
    });
  }
});
