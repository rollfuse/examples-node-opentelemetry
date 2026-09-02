// A minimal stand-in for the real rollfuse platform API, so this example
// runs end-to-end with `docker compose up` alone — no rollfuse account or
// credential required. Serves a static Configuration for GET /v1/config
// and accepts (and logs) POST /v1/exposure-events, matching the wire
// shapes @rollfuse/sdk-js expects.
//
// This is a demo fixture, not a reference implementation of the rollfuse
// API: it does not validate the Authorization header, version
// Configuration, or persist anything.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const configPath = process.env.CONFIG_PATH ?? "/config/checkout-config.json";
const configJson = readFileSync(configPath, "utf8");

// Fail fast if the fixture isn't even valid JSON — this file is
// hand-maintained, not generated.
JSON.parse(configJson);

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url === "/v1/config") {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(configJson);

    return;
  }

  if (req.method === "POST" && req.url === "/v1/exposure-events") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      let events = [];
      try {
        events = JSON.parse(body).events ?? [];
      } catch {
        res.writeHead(400);
        res.end("invalid request body");

        return;
      }

      console.log(`exposure-events: accepted ${events.length} event(s)`);

      res.setHeader("Content-Type", "application/json");
      res.writeHead(202);
      res.end(JSON.stringify({ accepted: events.length }));
    });

    return;
  }

  if (req.method === "GET" && req.url === "/healthz") {
    res.writeHead(200);
    res.end("ok");

    return;
  }

  res.writeHead(404);
  res.end("not found");
});

const listenAddr = process.env.LISTEN_PORT ?? 8090;
server.listen(listenAddr, () => {
  console.log(`mock-rollfuse-api: serving ${configPath} on :${listenAddr}`);
});
