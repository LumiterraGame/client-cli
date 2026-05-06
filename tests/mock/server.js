import http from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

function handleRequest(scenario, req, res) {
  let body = "";
  req.on("data", chunk => { body += chunk; });
  req.on("end", () => {
    let cmd;
    try {
      cmd = JSON.parse(body).cmd;
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, data: null, earnings: null, errors: ["invalid JSON body"] }));
      return;
    }

    let response;
    if (scenario === "command_error") {
      response = { success: false, data: null, earnings: null, errors: [`mock: command '${cmd}' failed`] };
    } else {
      const fixturePath = join(FIXTURES_DIR, `${cmd}.json`);
      if (existsSync(fixturePath)) {
        response = JSON.parse(readFileSync(fixturePath, "utf8"));
      } else {
        // No fixture: return empty success response (fallback)
        response = { success: true, data: {}, earnings: null, errors: [] };
      }
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response));
  });
}

export function startMockServer(port = 7861, scenario = "success") {
  return new Promise((resolve, reject) => {
    const server = http.createServer(handleRequest.bind(null, scenario));
    server.listen(port, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
}

export function stopMockServer(server) {
  return new Promise((resolve, reject) => {
    server.close(err => err ? reject(err) : resolve());
  });
}
