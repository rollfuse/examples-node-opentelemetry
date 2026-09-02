// Must be the first import: registers OpenTelemetry auto-instrumentation
// before node:http (and anything else) is required.
import "./tracing.js";

import { createServer } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { trace } from "@opentelemetry/api";
import { RollfuseClient } from "@rollfuse/sdk-js";

const FLAG_KEY = "checkout-redesign";
const tracer = trace.getTracer("checkout-example");

const client = new RollfuseClient({
  baseUrl: process.env.ROLLFUSE_API_BASE_URL ?? "http://localhost:8090",
  credential: process.env.ROLLFUSE_SERVICE_CREDENTIAL ?? "demo-credential",
});

// simulateCheckout stands in for the two real checkout implementations a
// production service would branch between — modeled as different latency
// so the two variations produce visibly different span durations in the
// trace viewer, purely for this demo's benefit.
async function simulateCheckout(redesigned) {
  return tracer.startActiveSpan("simulate-checkout", async (span) => {
    span.setAttribute("checkout.redesigned", redesigned);

    const delayMs = redesigned ? 20 + Math.random() * 30 : 80 + Math.random() * 120;
    await sleep(delayMs);

    const failureChance = redesigned ? 0.02 : 0.05;
    const outcome = Math.random() < failureChance ? "error" : "success";
    span.setAttribute("checkout.outcome", outcome);
    span.end();

    return outcome;
  });
}

async function handleCheckout(req, res) {
  const url = new URL(req.url, "http://localhost");
  const subjectKey = url.searchParams.get("user") ?? `user_${Math.floor(Math.random() * 10_000)}`;

  const result = await tracer.startActiveSpan("evaluate-flag", async (span) => {
    span.setAttribute("rollfuse.flag_key", FLAG_KEY);
    span.setAttribute("rollfuse.subject_key", subjectKey);

    const evaluation = client.evaluate(subjectKey, FLAG_KEY, { fallback: false });

    span.setAttribute("rollfuse.variation_key", evaluation.variation_key);
    span.setAttribute("rollfuse.reason", evaluation.reason);
    span.end();

    return evaluation;
  });

  const outcome = await simulateCheckout(Boolean(result.value));

  res.setHeader("Content-Type", "application/json");
  res.writeHead(200);
  res.end(
    JSON.stringify({
      subject_key: subjectKey,
      variation_key: result.variation_key,
      reason: result.reason,
      outcome,
    }),
  );
}

const server = createServer((req, res) => {
  if (req.method === "GET" && req.url.startsWith("/checkout")) {
    handleCheckout(req, res).catch((err) => {
      res.writeHead(500);
      res.end(String(err));
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

const listenAddr = process.env.LISTEN_PORT ?? 8080;
const baseUrl = process.env.ROLLFUSE_API_BASE_URL ?? "http://localhost:8090";

client
  .start()
  .then(() => {
    server.listen(listenAddr, () => {
      console.log(`checkout: connected to ${baseUrl}, serving on :${listenAddr}`);
    });
  })
  .catch((err) => {
    console.error(`client.start failed (is the rollfuse API reachable?): ${err}`);
    process.exit(1);
  });

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, async () => {
    server.close();
    await client.close();
    process.exit(0);
  });
}
