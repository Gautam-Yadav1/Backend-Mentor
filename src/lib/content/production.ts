import type { TopicContent } from "./types";

export const production: Record<string, TopicContent> = {
  testing: {
    lesson: `
## Why professionals test

Tests let you **change code without fear**. In a 100k-line codebase, nobody can manually check that a refactor didn't break checkout. Tests can, in seconds, on every commit, in CI.

## The testing pyramid

~~~
        /\\        E2E: a few (slow, brittle) → full browser + API + DB
       /  \\
      /----\\      Integration: many → HTTP request → app → (real or test) DB
     /      \\
    /--------\\    Unit: lots (fast) → one function, no I/O
~~~

For backend APIs, **integration tests give the most confidence per test**: they exercise routing, middleware, validation, error handling and the database together, exactly as clients use them.

## Tools

- **Vitest** or **Jest**: test runner + assertions (Vitest is faster and ESM-friendly)
- **Supertest**: makes HTTP requests to your Express app **without opening a port**
- **Testcontainers** or docker-compose: a real Postgres/Redis for integration tests

## Make your app testable: separate app from server

~~~js
// app.js: builds and exports the app, does NOT listen
export function createApp(deps) {
  const app = express();
  // ... middleware, routes
  return app;
}

// server.js: the only file that listens
import { createApp } from "./app.js";
createApp().listen(process.env.PORT ?? 3000);
~~~

## Unit tests: pure logic

~~~js
import { describe, it, expect } from "vitest";
import { calculateTotal } from "../src/pricing.js";

describe("calculateTotal", () => {
  it("sums line items in cents", () => {
    expect(calculateTotal([{ priceCents: 1999, qty: 2 }])).toBe(3998);
  });
  it("applies a 10% discount code", () => {
    expect(calculateTotal([{ priceCents: 1000, qty: 1 }], "SAVE10")).toBe(900);
  });
  it("throws for negative quantities", () => {
    expect(() => calculateTotal([{ priceCents: 1000, qty: -1 }])).toThrow();
  });
});
~~~

## Integration tests: the real HTTP flow

~~~js
import request from "supertest";
import { beforeEach, describe, it, expect } from "vitest";
import { createApp } from "../src/app.js";

let app;
beforeEach(() => { app = createApp({ db: createInMemoryDb() }); });   // fresh state for every test

describe("POST /api/todos", () => {
  it("creates a todo and returns 201", async () => {
    const res = await request(app).post("/api/todos").send({ title: "Learn testing" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ id: expect.any(String), title: "Learn testing", done: false });
  });

  it("returns 400 when the title is missing", async () => {
    const res = await request(app).post("/api/todos").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
~~~

## What to test (the high-value list)

1. **Happy paths** for each endpoint
2. **Validation**: 400 with field errors
3. **Auth**: 401 without a token, 403/404 for other users' data (IDOR regression tests!)
4. **Not found**: 404
5. **Business rules**: out of stock gives 409, discounts and edge cases
6. **Bugs you fixed**: every production bug gets a test, so it can never come back

## Good test habits

- **Arrange, Act, Assert** structure, and one behavior per test
- **Descriptive names**: \`"returns 404 when the order belongs to another user"\`
- **Isolation**: reset state in \`beforeEach\`, and no order dependence between tests
- **Test behavior, not implementation**: assert on HTTP responses, not on private functions being called
- **Mock only the edges** (payment providers, email, time) using dependency injection or \`vi.mock\`. Don't mock your own code so much that the test proves nothing.
- **Deterministic**: no real network calls, freeze time with \`vi.useFakeTimers()\` when needed

## CI

Run the tests on every pull request (e.g. GitHub Actions: \`npm ci && npm test\`) and block merges on failures. Coverage numbers are a guide, not a goal: 80% coverage of meaningful paths beats 100% of trivial getters.
`,
    problem: {
      title: "Add a test suite to an untested API before a big refactor",
      scenario: `Your team needs to migrate the Todo/Tasks API from in-memory storage to Postgres next sprint. There are **zero tests**. The last "small change" broke task creation in production for 3 hours, and nobody noticed until customers complained.

Your lead's rule: *"No refactor until we have tests that would have caught that bug."*`,
      task: `Build (or use) a small Express tasks API with \`GET /api/tasks\`, \`POST /api/tasks\` (validates \`title\`), \`PATCH /api/tasks/:id\` and \`DELETE /api/tasks/:id\`, plus a pure function such as \`summarizeTasks(tasks)\` (e.g. counts done vs pending, or calculates a priority score). Then:

1. Separate \`createApp()\` from \`app.listen()\`.
2. Write **integration tests with Supertest** covering: create (201), validation (400), list, update, delete (204), and not found (404).
3. Write **unit tests** for the pure function, including edge cases (an empty list, invalid input).
4. Make tests isolated: fresh data for each test via \`beforeEach\` or dependency injection.
5. Use descriptive test names, and make \`npm test\` run everything.

**Stretch:** add a GitHub Actions workflow that runs the tests on every push.`,
    },
    realWorld: {
      company: "Cloudflare",
      title: "One untested regex took down Cloudflare (2019)",
      story: `On July 2, 2019, Cloudflare deployed a new rule to its Web Application Firewall. The rule contained a **regular expression with catastrophic backtracking**, which pegged CPUs at **100% on servers worldwide** and caused about **27 minutes** of 502 errors for sites behind Cloudflare.

Their public post-mortem was refreshingly honest. Rules were deployed globally at once, there was **no test checking a rule's CPU usage** before deployment, and they had previously removed a protection that would have limited excessive CPU use. Their fixes included performance testing for rules and staged rollouts.`,
      takeaway: "Tests are cheap compared with outages. Test the failure modes (bad input, slow paths, edge cases), and run the tests automatically before anything reaches production.",
    },
  },

  "logging-monitoring": {
    lesson: `
## You can't fix what you can't see

In development you watch your terminal. In production you have 20 containers, millions of requests and a 3am alert. **Observability** is your ability to answer "what is happening and why?" from the outside. It has three pillars:

1. **Logs**: discrete events ("payment failed for order 42")
2. **Metrics**: numbers over time (requests/sec, error rate, p95 latency)
3. **Traces**: the path of one request across services

## Structured logging

~~~js
console.log("User " + userId + " placed order " + orderId);   // ❌ unsearchable text
~~~

~~~json
{"level":"info","time":1710238532,"requestId":"a1b2","userId":7,"orderId":42,"msg":"order placed"}
~~~

**JSON logs** can be searched, filtered and aggregated in tools like Datadog, Grafana Loki, Elasticsearch/Kibana or CloudWatch: *"show all errors for userId 7 in the last hour"*.

**pino** is the fastest and most popular Node logger:

~~~js
import pino from "pino";
import pinoHttp from "pino-http";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.token", "*.cardNumber"],
    censor: "[REDACTED]",
  },
});

app.use(pinoHttp({ logger, genReqId: (req) => req.get("X-Request-Id") ?? crypto.randomUUID() }));

app.post("/orders", async (req, res) => {
  req.log.info({ itemCount: req.body.items.length }, "creating order");   // carries the request id automatically
});
~~~

Use \`pino-pretty\` for readable logs in development only. Production logs stay JSON.

## Log levels

| Level | Use for |
|---|---|
| \`fatal\` | app is about to crash |
| \`error\` | an operation failed and needs attention |
| \`warn\` | unexpected but handled (retry happened, fallback used) |
| \`info\` | important business events (order placed, user signed up) |
| \`debug\` | detailed diagnostics, off in production by default |

## Never log secrets or personal data

Passwords, tokens, cookies, card numbers and often emails or addresses. Logs are copied to many systems and kept for a long time, and far more people can read them than can read your database. Use **redaction** and log ids, not data (\`userId: 7\`, not the whole user object).

## Correlation

Every log line for a request should include its **requestId** (child loggers do this for you). Pass the id to downstream services in a header. Return it in error responses so support can find the logs.

## Metrics: the four golden signals (from Google's SRE book)

1. **Latency**: how long requests take (track **p50/p95/p99**, not averages. Averages hide the slow requests your angriest users get.)
2. **Traffic**: requests per second
3. **Errors**: the rate of 5xx responses
4. **Saturation**: how full you are (CPU, memory, DB connection pool, queue length, event loop lag)

\`prom-client\` exposes metrics at \`/metrics\` for Prometheus, and Grafana charts them. Alert on **symptoms users feel** (error rate > 1% for 5 minutes, p99 > 2s), not on every CPU spike.

## Health checks

Orchestrators (Kubernetes, ECS, load balancers) ask your app two questions:

- **Liveness** (\`/health/live\`): "Is the process alive and not deadlocked?" Keep it trivial (return 200). If it fails, the container is **restarted**.
- **Readiness** (\`/health/ready\`): "Can you serve traffic right now?" Check dependencies (\`SELECT 1\`, Redis \`PING\`) with a short timeout. If it fails, the instance is **removed from the load balancer** but not killed.

~~~js
app.get("/health/live", (req, res) => res.json({ status: "ok" }));

app.get("/health/ready", async (req, res) => {
  const checks = await Promise.allSettled([
    withTimeout(db.query("SELECT 1"), 1000),
    withTimeout(redis.ping(), 1000),
  ]);
  const ok = checks.every((c) => c.status === "fulfilled");
  res.status(ok ? 200 : 503).json({
    status: ok ? "ready" : "not_ready",
    checks: { db: checks[0].status, redis: checks[1].status },
  });
});
~~~

⚠️ Don't check dependencies in **liveness**. If the DB blips, Kubernetes would restart *all* your containers at once and make the outage worse.

## Error tracking and tracing

- **Sentry** (or similar) groups exceptions, shows stack traces with context, and alerts on new errors.
- **OpenTelemetry** is the standard for distributed tracing: see that the 2s request spent 1.8s in one SQL query.
`,
    problem: {
      title: "Make the API debuggable in production",
      scenario: `At 2:47am, the on-call engineer got a vague report: "some users can't check out". The logs were \`console.log\` strings like \`"error!!"\` and \`"here 2"\`, with no request ids, no user ids and no timestamps. Kubernetes kept sending traffic to a pod whose database connection was broken.

Worse, a compliance scan found **plain-text passwords and auth tokens in the logs** from a debug \`console.log(req.body)\`.`,
      task: `Upgrade an Express API with:

1. **pino** structured JSON logging with a configurable level (\`LOG_LEVEL\`).
2. Request logging (\`pino-http\` or your own middleware) with a **request id on every line**, and \`req.log\` available in handlers.
3. **Redaction** of \`authorization\` and \`cookie\` headers and any \`password\`/\`token\` fields. Prove it by logging a login body.
4. \`GET /health/live\` (trivial) and \`GET /health/ready\` (checks a simulated DB with a timeout, and returns \`503\` when it's down).
5. Errors logged at \`error\` level with the stack and request id.

Explain in 2–3 sentences why the readiness check must not be used for liveness.

**Stretch:** expose \`/metrics\` with \`prom-client\` including a request duration histogram.`,
    },
    realWorld: {
      company: "Twitter",
      title: "Twitter told 330 million users to change their passwords (2018)",
      story: `In May 2018, Twitter announced it had discovered a bug that wrote users' passwords **in plain text to an internal log**, before the hashing step. Twitter said it found no evidence of misuse, but because they couldn't be sure who had seen those logs, they advised **all of their 330+ million users** to consider changing their password. GitHub disclosed a very similar bug the same month.

The passwords were properly hashed in the database. The leak happened through logging, the place engineers forget to protect.`,
      takeaway: "Logs are data that gets copied everywhere. Use structured logs with redaction by default, log ids instead of payloads, and treat logging code as security-sensitive.",
    },
  },

  deployment: {
    lesson: `
## From "works on my machine" to production

Production is a different world: multiple instances, restarts, deploys several times a day, secrets that differ per environment, and traffic that never stops.

## 12-factor config

The **Twelve-Factor App** methodology says: **store config in the environment**. The same build (Docker image) runs in staging and production, and only the env vars differ.

~~~js
// config.js: validate once at startup, FAIL FAST
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  REDIS_URL: z.string().url().optional(),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);        // crash at boot, not at 3am when the first request needs JWT_SECRET
}
export const config = parsed.data;
~~~

Import \`config\` everywhere instead of reading \`process.env\` all over the codebase.

## Docker: ship the environment with the code

A **container image** packages your app, the Node runtime and dependencies, so it runs the same everywhere.

~~~dockerfile
# ---- build/deps stage ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev          # reproducible install, no dev deps

# ---- runtime stage ----
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
USER node                      # never run as root
EXPOSE 3000
CMD ["node", "src/server.js"]  # run node directly so it receives SIGTERM
~~~

Also add a \`.dockerignore\` (\`node_modules\`, \`.env\`, \`.git\`) so you don't copy secrets or bloat the image.

## Graceful shutdown: zero-downtime deploys

When you deploy, the orchestrator sends **SIGTERM** to old containers. If Node exits immediately, **in-flight requests are cut off**: a payment half-processed, a user sees an error. A graceful shutdown:

1. Stop accepting new connections.
2. Let in-flight requests finish.
3. Close DB pools, Redis and queue workers.
4. Exit, with a **forced timeout** in case something hangs.

~~~js
const server = app.listen(config.PORT);

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "shutting down gracefully");

  const forceExit = setTimeout(() => {
    logger.error("forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async (err) => {           // stops new connections, waits for open requests
    try {
      await db.end();
      await redis.quit();
      process.exit(err ? 1 : 0);
    } catch (e) {
      logger.error(e);
      process.exit(1);
    }
  });
  server.closeIdleConnections?.();        // close idle keep-alive sockets (Node 18.2+)
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));   // Ctrl+C locally
~~~

Pro tip: during shutdown, make \`/health/ready\` return 503 so the load balancer stops routing to this instance first.

## Using all CPU cores

One Node process uses one core for JavaScript. Options:
- Run **multiple containers** (the modern approach: let Kubernetes/ECS scale them)
- Node's \`cluster\` module or **PM2** (\`pm2 start server.js -i max\`) on a single VM

Either way, this is why your app must be **stateless**: sessions, rate limits and caches live in Redis or the DB, not in process memory.

## Deployment strategies

- **Rolling**: replace instances a few at a time (the default in Kubernetes)
- **Blue/green**: run the new version alongside the old one, then switch traffic all at once (instant rollback)
- **Canary**: send 5% of traffic to the new version, watch the error rates, then increase
- **Feature flags**: deploy code switched off, then turn it on separately

Always be able to **roll back** in minutes.
`,
    problem: {
      title: "Zero-downtime deploys for the orders API",
      scenario: `Every time your team deploys (5× a day), monitoring shows a spike of **~200 failed requests** and a few customers get "payment status unknown". Investigation shows:
- containers are killed while requests are in flight
- once, a deploy went out without \`DATABASE_URL\`. The app started "fine" and then crashed on the first request, 20 minutes later
- the Docker image is 1.4GB, runs as root, and includes dev dependencies and the \`.env\` file`,
      task: `For an Express app (it can include a slow \`/slow\` route that takes 5s):

1. A \`config.js\` that validates required env vars at startup with Zod (or manually) and **exits** with a clear message if anything is missing.
2. **Graceful shutdown** on SIGTERM/SIGINT: stop accepting connections, finish in-flight requests, close resources (simulate a DB pool), and force exit after 10s.
3. Prove it: start a request to \`/slow\`, send SIGTERM (Ctrl+C), and show the request still completes.
4. A production **Dockerfile**: small base image, \`npm ci --omit=dev\`, non-root user, \`CMD ["node", ...]\`, plus a \`.dockerignore\`.

**Stretch:** make \`/health/ready\` return 503 as soon as shutdown begins.`,
    },
    realWorld: {
      company: "Knight Capital",
      title: "$440 million lost in 45 minutes from a bad deploy (2012)",
      story: `On August 1, 2012, Knight Capital, one of the largest US stock traders, deployed new trading code to its 8 servers. A technician **missed one server**. The new code reused an old configuration flag that, on the stale server, activated long-dead code called "Power Peg". That server started sending millions of unintended orders into the market.

In about **45 minutes** Knight lost roughly **$440 million**, more than the company was worth, and it had to be rescued and was later acquired. The SEC's report cited the lack of automated, verified deployment procedures and the reuse of an old flag.`,
      takeaway: "Deployments must be automated, identical on every instance, verifiable and reversible. Validate config at startup, never reuse old flags for new meanings, and make rollback easy.",
    },
  },

  websockets: {
    lesson: `
## When request/response isn't enough

HTTP is **client-initiated**: the server can only answer. But some features need the **server to push** updates the moment they happen:
- order tracking ("your driver is 2 minutes away")
- chat and notifications
- live dashboards, multiplayer games, collaborative editing

## Options for real-time

| Technique | How | Good for |
|---|---|---|
| **Polling** | client asks every N seconds | simple, low-frequency updates |
| **Long polling** | server holds the request until there's news | legacy fallback |
| **Server-Sent Events (SSE)** | one-way stream from server over HTTP | notifications, live feeds, AI token streaming |
| **WebSockets** | persistent **two-way** connection | chat, games, collaboration |

A WebSocket starts as an HTTP request with \`Upgrade: websocket\`. The server replies \`101 Switching Protocols\`, and then both sides can send messages at any time over the same TCP connection.

## Socket.IO

The raw \`ws\` library is minimal. **Socket.IO** adds automatic reconnection, **rooms**, acknowledgements, broadcasting and fallbacks, so it's the most common choice with Express:

~~~js
import { createServer } from "node:http";
import { Server } from "socket.io";

const httpServer = createServer(app);          // share the port with Express
const io = new Server(httpServer, { cors: { origin: ["https://shop.com"] } });

io.on("connection", (socket) => {
  console.log("connected", socket.id);
  socket.on("chat:message", (msg, ack) => {
    io.emit("chat:message", msg);              // broadcast to everyone
    ack?.({ ok: true });
  });
  socket.on("disconnect", (reason) => console.log("left", reason));
});

httpServer.listen(3000);
~~~

Client:
~~~js
const socket = io("https://api.shop.com", { auth: { token: accessToken } });
socket.on("order:status", (update) => render(update));
~~~

## Rooms: send updates only to the right people

~~~js
socket.join(\`order:\${orderId}\`);                          // subscribe
io.to(\`order:\${orderId}\`).emit("order:status", { status: "shipped" });  // targeted push
~~~

## Authentication and authorization

WebSockets **don't automatically get your Authorization header**. Authenticate during the handshake with middleware:

~~~js
io.use((socket, next) => {
  try {
    const payload = jwt.verify(socket.handshake.auth.token, process.env.JWT_ACCESS_SECRET);
    socket.data.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new Error("unauthorized"));
  }
});
~~~

And **authorize every subscription**. Otherwise anyone can join \`order:123\` and watch a stranger's delivery address update live (an IDOR again!):

~~~js
socket.on("order:subscribe", async (orderId, ack) => {
  const order = await orders.findById(orderId);
  if (!order || order.userId !== socket.data.user.id) return ack({ error: "not found" });
  socket.join(\`order:\${orderId}\`);
  ack({ ok: true, status: order.status });       // send the current state immediately
});
~~~

Also validate every incoming message payload, just like HTTP bodies.

## Pushing from the rest of your app

Real-time events usually originate elsewhere: a REST call (\`PATCH /orders/:id/status\` by the warehouse) or a background job. Keep a reference to \`io\` (or emit through an event bus) and push after the database update succeeds.

## Scaling across multiple servers

With 3 servers, user A is connected to server 1, but the status update happens on server 2. Server 2's \`io.to(room).emit\` only reaches **its own** sockets!

Fix: the **Redis adapter** (\`@socket.io/redis-adapter\`). Every server publishes room events through Redis **pub/sub**, and every server delivers them to its local sockets. You'll also need **sticky sessions** at the load balancer when Socket.IO uses HTTP long-polling fallback.

## Production concerns

- **Reconnection**: clients will disconnect (tunnels, sleeping laptops). On reconnect, re-subscribe and fetch the current state. Never assume they saw every event.
- **Connection limits**: each socket uses memory, so monitor concurrent connections.
- **Heartbeats** (ping/pong) detect dead connections. Socket.IO does this for you.
- For one-way updates (notifications, progress), consider **SSE**: simpler, plain HTTP, auto-reconnects.
`,
    problem: {
      title: "Live order tracking like a food delivery app",
      scenario: `Your food delivery startup's customers keep refreshing the order page every few seconds to see if the food is on the way. That's **40% of all API traffic**. Product wants a live tracker like Swiggy, Zomato or DoorDash: *Order placed → Preparing → Out for delivery → Delivered*, updating instantly.

The security team has one rule: **a customer must never see someone else's order updates.**`,
      task: `Build an Express + Socket.IO server:

1. Authenticate socket connections in \`io.use()\` using a token from \`socket.handshake.auth\` (a fake token → user map is fine).
2. An \`order:subscribe\` event that **checks ownership** before joining the room \`order:<id>\`, and immediately sends the current status.
3. A REST endpoint \`PATCH /api/orders/:id/status\` (simulating the restaurant or driver app) that updates the order and **emits** \`order:status\` to that order's room only.
4. A tiny HTML or Node client that subscribes and logs updates.
5. Prove that user B **cannot** subscribe to user A's order.
6. Write 3–4 sentences on how you'd scale this to 10 servers (the Redis adapter, sticky sessions) and handle reconnects.`,
    },
    realWorld: {
      company: "Trello",
      title: "How Trello made boards update in real time",
      story: `When Trello launched in 2011, one of its "magic" features was that a card moved by a teammate **appeared on your screen instantly**. In a 2012 post on the Fog Creek blog, the Trello team described their stack: **Node.js**, **Socket.IO** for pushing updates to browsers, **MongoDB**, and **Redis pub/sub** to share events between their server processes, so an update made on one server reached clients connected to any server.

They also wrote about the hard parts you met in this lesson: clients disconnecting and needing to catch up on missed changes, and keeping the number of open connections manageable.`,
      takeaway: "Real-time is a push channel on top of normal APIs. Authenticate the connection, authorize every subscription, broadcast through pub/sub to scale, and design for reconnects.",
    },
  },
};
