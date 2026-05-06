// tests/mock/runner.js
import { spawn, execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MOCK_PORT = 7861;
const SCENARIO = process.env.MOCK_SCENARIO || "success";
const TEST_FILE = join(__dirname, "mock.test.js");
const SERVER_FILE = join(__dirname, "server-process.js");
const MOCK_HOST = `http://127.0.0.1:${MOCK_PORT}`;

if (SCENARIO === "disconnected") {
  console.log("[mock] disconnected scenario: not starting server");
  try {
    execSync(`node --test ${TEST_FILE}`, {
      stdio: "inherit",
      env: { ...process.env, LUMITERRA_HOST: MOCK_HOST, MOCK_SCENARIO: "disconnected" },
    });
  } catch {
    process.exit(1);
  }
} else {
  // Server runs in a separate child process so execSync won't block its event loop
  const serverProc = spawn("node", [SERVER_FILE], {
    stdio: "inherit",
    env: { ...process.env, MOCK_PORT: String(MOCK_PORT), MOCK_SCENARIO: SCENARIO },
  });

  // Wait for server to start (200ms is enough for node:http listen)
  await new Promise(r => setTimeout(r, 200));
  console.log(`[mock] server started on ${MOCK_HOST}, scenario: ${SCENARIO}`);

  let exitCode = 0;
  try {
    execSync(`node --test ${TEST_FILE}`, {
      stdio: "inherit",
      env: { ...process.env, LUMITERRA_HOST: MOCK_HOST, MOCK_SCENARIO: SCENARIO },
    });
  } catch {
    exitCode = 1;
  }

  serverProc.kill();
  process.exit(exitCode);
}
