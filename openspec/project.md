# Project Context

## What This Repo Is

An example repository under the `rollfuse` GitHub organization: a
feature-flagged demo checkout service showing
[`@rollfuse/sdk-js`](https://github.com/rollfuse/js-sdk) instrumented with
OpenTelemetry, runnable end-to-end via `docker compose up` with no
rollfuse account required (a bundled mock stands in for the platform
API). It is not part of the rollfuse platform itself.

## Repository Shape

```text
/
├── src/
│   ├── tracing.js          OpenTelemetry Node SDK bootstrap (must load first).
│   └── server.js           The demo service: evaluates a flag per request,
│                            wraps it in a manual span, simulates two
│                            checkout implementations.
├── mock-rollfuse-api/
│   └── server.js            Self-contained stand-in for the real platform
│                             API (GET /v1/config, POST /v1/exposure-events).
├── config/
│   └── checkout-config.json Static Configuration the mock API serves.
└── docker-compose.yml       The whole stack (app, mock, Jaeger, load
                              generator), one command.
```

## Working On This Repo

- Keep it runnable with a single `docker compose up` — never add a step
  that requires manual setup (an account, a token, a config edit) before
  the demo works.
- Plain ESM JavaScript, no build step, no TypeScript — this is a demo
  meant to be read top to bottom in a few minutes, not a library.
- `node --check` on every source file and `npm audit --audit-level=high`
  must stay clean; there is no test suite beyond that and the CI compose
  smoke test (`.github/workflows/ci.yml`) — this is a demo, not a
  library, so correctness is verified by "does the documented flow
  actually work," not unit tests.
- The README's claims about trace propagation (what chains into a
  request's trace vs. what gets its own) are load-bearing and were
  verified against real Jaeger output, not assumed from the SDK's docs —
  keep them accurate if the demo's request flow changes.
- OpenSpec here is for planning nontrivial changes to the demo itself,
  not for specifying rollfuse platform behavior (that lives in
  `rollfuse/rollfuse` and `rollfuse/js-sdk`).
