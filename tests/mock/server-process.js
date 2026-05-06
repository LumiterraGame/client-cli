// tests/mock/server-process.js
import { startMockServer } from "./server.js";

const port = parseInt(process.env.MOCK_PORT || "7861");
const scenario = process.env.MOCK_SCENARIO || "success";

await startMockServer(port, scenario);
console.log(`[mock-server] listening on ${port}, scenario: ${scenario}`);
// HTTP server keeps the event loop active; the process will not exit on its own
