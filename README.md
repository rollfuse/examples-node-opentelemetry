# rollfuse + Node.js + OpenTelemetry

A feature-flagged checkout service, instrumented with OpenTelemetry, running
against [rollfuse](https://rollfuse.com)'s [JS SDK](https://github.com/rollfuse/js-sdk)
(`@rollfuse/sdk-js`). Clone it, run one command, and watch a flag
evaluation show up as a real child span in a real trace — no rollfuse
account required.

```bash
git clone https://github.com/rollfuse/examples-node-opentelemetry.git
cd examples-node-opentelemetry
docker compose up --build
```

Then open **http://localhost:16686** (Jaeger, no login needed), pick
**checkout** from the Service dropdown, and open any trace. You'll see
three spans on one trace: `GET` (OpenTelemetry's own HTTP
auto-instrumentation), `evaluate-flag` (wraps `client.evaluate(...)`), and
`simulate-checkout` — each request's whole story, evaluation included, in
one place.

## What this demonstrates

- **Local flag evaluation** (`src/server.js`): `client.evaluate(...)` is
  synchronous — no network call, no added latency on the request path, per
  [ADR 0004](https://github.com/rollfuse/js-sdk#readme). The `evaluate-flag`
  span's own duration (a few dozen microseconds in Jaeger) makes that
  concrete instead of just asserted.
- **The SDK plays well with OpenTelemetry auto-instrumentation**:
  `src/tracing.js` is the standard `@opentelemetry/sdk-node` bootstrap —
  nothing rollfuse-specific. `@rollfuse/sdk-js` doesn't fight it or need
  special wiring.
- **The SDK's own outbound calls carry trace context when one is active**:
  `@rollfuse/sdk-js` depends on `@rollfuse/evaluation-core`'s
  `resolveTraceHeaders`, which injects the *currently active*
  OpenTelemetry context into every outbound call to the platform API (a
  W3C `traceparent` header), or self-issues a fresh one when none is
  active — see the [`js-sdk` repo](https://github.com/rollfuse/js-sdk)'s
  `sdk-trace-propagation` spec. In this demo, that means: the periodic,
  *batched* exposure-report call (fired from a background timer, not tied
  to any one request — see `sdk-js`'s own README on why exposure
  reporting is asynchronous and best-effort) gets **its own, separate
  trace**, not a request's. That's by design, not a limitation: exposure
  reporting is deliberately decoupled from request latency, so it has no
  single request's context to inherit. If you instrument a code path that
  makes an SDK call *synchronously inside* an active span (there isn't
  one on the hot path here — evaluation never calls the network), that
  call's `traceparent` chains into your trace automatically, with zero
  rollfuse-specific code.

## How it's wired

```
loadgen ──> checkout ──> mock-rollfuse-api   (GET /v1/config, POST /v1/exposure-events)
               │
               └── OTLP/HTTP traces ──> jaeger (UI + OTLP receiver, one container)
```

`mock-rollfuse-api` (`mock-rollfuse-api/server.js`) is a small stand-in
for the real rollfuse platform API — it serves the static Configuration in
`config/checkout-config.json` and logs (accepts) exposure events, so this
example runs completely self-contained. Point `checkout` at a real
rollfuse environment instead by setting `ROLLFUSE_API_BASE_URL` and
`ROLLFUSE_SERVICE_CREDENTIAL` and dropping `mock-rollfuse-api` from
`docker-compose.yml` — the application code doesn't change at all.

## Try it against your own rollfuse project

```bash
docker compose stop mock-rollfuse-api
ROLLFUSE_API_BASE_URL=https://api.rollfuse.com \
ROLLFUSE_SERVICE_CREDENTIAL=<your Service Credential> \
  docker compose up checkout jaeger loadgen
```

## Development

```bash
npm install
node --check src/server.js
node --check src/tracing.js
```

`checkout` reads `ROLLFUSE_API_BASE_URL` (default `http://localhost:8090`),
`ROLLFUSE_SERVICE_CREDENTIAL` (default `demo-credential`),
`OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` (default
`http://localhost:4318/v1/traces`), and `LISTEN_PORT` (default `8080`).
`mock-rollfuse-api` reads `CONFIG_PATH` (default
`/config/checkout-config.json`) and `LISTEN_PORT` (default `8090`).

## Related

- [`rollfuse/js-sdk`](https://github.com/rollfuse/js-sdk) — the SDK family
  this example runs (server, browser, React).
- [`rollfuse/go-sdk`](https://github.com/rollfuse/go-sdk) — the Go SDK.
- [`rollfuse/examples-go-prometheus`](https://github.com/rollfuse/examples-go-prometheus) —
  the same idea, with Prometheus metrics instead of traces.
