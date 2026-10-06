import type { TopicContent } from "./types";

export const foundations: Record<string, TopicContent> = {
  "how-the-web-works": {
    lesson: `
## The big picture

Every backend you will ever build answers one question: **"A client sent me a request. What response do I send back?"**

- The **client** is whatever starts the conversation: a browser, a mobile app, another server, or \`curl\` in your terminal.
- The **server** is a program that listens on a **port** (e.g. 3000) and answers requests.
- They talk using **HTTP** (HyperText Transfer Protocol), a plain-text protocol on top of TCP. With HTTPS, the same text is encrypted with TLS.

When you type \`https://amazon.com/orders/123\` into a browser:

1. **DNS** turns \`amazon.com\` into an IP address.
2. The browser opens a **TCP connection** to that IP on port 443 and performs a **TLS handshake**.
3. It sends an **HTTP request**.
4. The server runs code (your backend!) and sends an **HTTP response**.

## Anatomy of a request

~~~http
GET /orders/123?include=items HTTP/1.1
Host: api.shop.com
Accept: application/json
Authorization: Bearer eyJhbGciOi...
~~~

| Part | Example | Meaning |
|---|---|---|
| Method | \`GET\` | What you want to do |
| Path | \`/orders/123\` | Which resource |
| Query string | \`?include=items\` | Extra options (filters, pagination) |
| Headers | \`Accept\`, \`Authorization\` | Metadata about the request |
| Body | (none for GET) | Data you send, usually JSON for POST/PUT/PATCH |

## Anatomy of a response

~~~http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: private, max-age=0

{"id":"123","status":"shipped","items":[...]}
~~~

## HTTP methods (verbs)

| Method | Use it to | Safe? | Idempotent? |
|---|---|---|---|
| GET | Read a resource | ✅ | ✅ |
| POST | Create something / trigger an action | ❌ | ❌ |
| PUT | Replace a resource completely | ❌ | ✅ |
| PATCH | Update part of a resource | ❌ | usually ❌ |
| DELETE | Remove a resource | ❌ | ✅ |

- **Safe** means there are no side effects. Proxies may prefetch or cache it.
- **Idempotent** means doing it 2 times has the same effect as doing it once. This matters hugely when networks retry requests: retrying a \`DELETE /orders/5\` is harmless, but retrying a \`POST /payments\` might charge someone twice. You'll solve that in the capstone with idempotency keys.

## Status codes: your API's body language

- **2xx Success**: \`200 OK\`, \`201 Created\` (include the new resource or a \`Location\` header), \`204 No Content\`.
- **3xx Redirection**: \`301\` moved permanently, \`304 Not Modified\` (cache is still valid).
- **4xx Client error**, meaning *the caller did something wrong*:
  - \`400\` malformed/invalid input
  - \`401\` not authenticated ("who are you?")
  - \`403\` authenticated but not allowed
  - \`404\` doesn't exist
  - \`405\` method not allowed
  - \`409\` conflict (e.g. out of stock, duplicate email)
  - \`413\` body too large
  - \`422\` semantically invalid
  - \`429\` too many requests
- **5xx Server error**, meaning *we broke*: \`500\` bug, \`502/504\` upstream failure or timeout, \`503\` temporarily unavailable.

> **Production rule:** a 4xx says "fix your request", a 5xx says "page the on-call engineer". If you return 500 for bad user input, you'll trigger alerts at 3am for nothing. If you return 200 with \`{"error": ...}\`, monitoring tools will think everything is fine while users suffer.

## Headers you'll use constantly

- \`Content-Type\`: the format of the body (\`application/json\`).
- \`Accept\`: the format the client wants back.
- \`Authorization\`: credentials (\`Bearer <token>\`).
- \`Cache-Control\`, \`ETag\`: caching.
- \`Set-Cookie\` / \`Cookie\`: sessions.
- \`X-Request-Id\`: tracing a request across services.

## HTTP is stateless

Every request stands alone. The server doesn't "remember" you between requests. That's why we send a token or cookie with *every* request, and it's also what makes scaling easy: any of 100 identical servers can answer any request.

## Try it yourself

~~~bash
curl -i https://api.github.com/users/octocat     # -i shows status + headers
curl -i -X POST https://httpbin.org/post -H "Content-Type: application/json" -d '{"hello":"world"}'
~~~

## Common beginner mistakes

1. Returning \`200\` for everything and putting errors in the body.
2. Using GET for actions that change data (\`GET /deleteUser?id=5\`). Crawlers and prefetchers will happily call it!
3. Forgetting \`Content-Type: application/json\`, so clients can't parse the response.
4. Never ending the response, so the request hangs until the client times out.
`,
    problem: {
      title: "Build the \"Track your order\" endpoint",
      scenario: `You've just joined the backend team at an e-commerce startup. Customers keep contacting support asking "where is my order?". The product team wants a **Track Order** page like Amazon's "Your Orders → Track package". The frontend team needs an API from you, and they're blocked until it exists.

You're asked to build a tiny prototype **without any framework**, so you understand exactly what an HTTP server does.`,
      task: `Using only Node's built-in \`http\` module, build a server with:

1. An in-memory "database": an object with 2–3 orders, each with \`id\`, \`status\` (\`"processing" | "shipped" | "delivered"\`), \`items\` and \`estimatedDelivery\`.
2. \`GET /orders/:id\`
   - returns \`200\` + the order as JSON when it exists
   - returns \`404\` + \`{ "error": "Order not found" }\` when it doesn't
3. Any other method or path returns a proper \`404\` or \`405\` JSON response. The request must **never hang**.
4. Always set \`Content-Type: application/json\`.

**Test it** with \`curl -i http://localhost:3000/orders/1\` and \`curl -i -X DELETE http://localhost:3000/orders/1\`.

**Stretch:** write down which status code you'd return if the order exists but belongs to another customer, and why.`,
    },
    realWorld: {
      company: "Amazon",
      title: "Every 100ms of latency cost 1% of sales",
      story: `Former Amazon engineer Greg Linden shared an early Amazon experiment: when they deliberately added delays to pages in A/B tests, **every 100 milliseconds of extra latency cost about 1% in sales**. Google reported a similar finding: an extra half-second on search results dropped traffic by roughly 20%.

That's why big companies obsess over the request/response cycle you just learned: fewer round trips, smaller responses, correct caching headers (\`Cache-Control\`, \`ETag\`, \`304 Not Modified\`), and fast status codes for errors instead of slow timeouts.`,
      takeaway: "HTTP details aren't trivia. Status codes, headers and response size directly affect revenue at scale. A request that hangs is worse than a fast, honest error.",
    },
  },

  "node-fundamentals": {
    lesson: `
## What Node.js actually is

JavaScript was born in the browser. **Node.js** takes Chrome's **V8** engine out of the browser and adds the things a server needs: access to files, network sockets, processes and environment variables. It does this through a C library called **libuv**.

~~~
Your JS code
   │
   ▼
 V8 (runs JS)  ─────  Node APIs (fs, http, crypto, ...)
                             │
                             ▼
                      libuv (event loop + thread pool + OS async I/O)
~~~

## Single-threaded, yet handles thousands of users?

Your JavaScript runs on **one main thread**. Node is still fast for web servers because most backend work is **waiting**: for the database, for another API, for the disk. Node never sits idle while waiting. It hands the I/O off to the operating system (or libuv's thread pool) and moves on to the next request.

Think of a waiter in a restaurant. A *thread-per-request* server hires one waiter per table, and each waiter stands in the kitchen waiting for the food. Node has **one very fast waiter** who takes an order, gives it to the kitchen, and serves other tables until the kitchen rings the bell (a **callback** or **promise resolution**).

## The event loop, step by step

The event loop keeps checking queues of work and runs the callbacks that are ready:

1. **Timers**: \`setTimeout\` / \`setInterval\` callbacks whose time has come.
2. **Pending callbacks**: some system-level callbacks.
3. **Poll**: get new I/O events (incoming requests, finished file reads) and run their callbacks.
4. **Check**: \`setImmediate\` callbacks.
5. **Close callbacks**: e.g. \`socket.on('close')\`.

Between every phase, Node drains the **microtask queues**: \`process.nextTick\` callbacks first, then **promise** callbacks (\`.then\`, code after \`await\`).

~~~js
console.log("1: sync");
setTimeout(() => console.log("4: timeout"), 0);
Promise.resolve().then(() => console.log("3: promise (microtask)"));
process.nextTick(() => console.log("2: nextTick"));
// prints 1, 2, 3, 4
~~~

## The #1 rule: don't block the event loop

Because there's one thread, **CPU-heavy synchronous code freezes every user at once**:

~~~js
app.get("/report", (req, res) => {
  // ❌ 2 seconds of pure CPU. Every other request waits 2 seconds!
  let total = 0;
  for (let i = 0; i < 5e9; i++) total += i;
  res.json({ total });
});
~~~

Common blockers in real code: \`JSON.parse\` on huge payloads, \`fs.readFileSync\` inside request handlers, synchronous crypto (\`bcrypt.hashSync\`), and catastrophic regular expressions. Fixes: use async APIs, stream big data, move CPU work to **worker threads** or a background job.

## Modules

Node supports two module systems:

~~~js
// CommonJS (older, still everywhere)
const fs = require("fs");
module.exports = { add };

// ES Modules (modern; use "type": "module" in package.json or .mjs files)
import fs from "node:fs";
export function add(a, b) { return a + b; }
~~~

Prefer the \`node:\` prefix (\`node:fs\`, \`node:http\`) so it's obvious you're using a built-in module.

## npm and package.json

- \`npm init -y\` creates \`package.json\`, your project's manifest.
- \`dependencies\` are needed at runtime. \`devDependencies\` are only for development (tests, linters).
- \`package-lock.json\` pins exact versions. **Commit it.** In CI and production use \`npm ci\` for reproducible installs.
- Semver \`^1.4.2\` means "any 1.x.x ≥ 1.4.2". Major versions can break things.

## Streams: handling data bigger than memory

Reading a 5GB log file with \`readFile\` loads 5GB into RAM. **Streams** process data chunk by chunk:

~~~js
import { createReadStream } from "node:fs";
import readline from "node:readline";

const rl = readline.createInterface({ input: createReadStream("access.log") });
for await (const line of rl) {
  // handle one line at a time, using constant memory
}
~~~

Streams are everywhere in Node: HTTP requests and responses are streams, and so are file reads, uploads and compression.

## process: talking to the outside world

- \`process.argv\` holds command-line arguments.
- \`process.env\` holds environment variables (configuration and secrets).
- \`process.exit(code)\` exits. \`0\` means success, anything else means failure (CI pipelines rely on this!).
- \`process.on("SIGTERM", ...)\` handles shutdown signals (more in the deployment topic).
`,
    problem: {
      title: "Log analyzer CLI for an outage investigation",
      scenario: `It's Monday morning. Over the weekend, customers complained the checkout page was "randomly failing". Your tech lead hands you a **2GB nginx access log** and asks: *"How many requests failed, and with which status codes?"*

Opening the file in an editor crashes your laptop. You need a tool.`,
      task: `Write a Node.js CLI script \`analyze.js\`:

~~~bash
node analyze.js ./access.log
~~~

Each log line looks like:
~~~
127.0.0.1 - - [12/Mar/2025:10:15:32 +0000] "POST /api/checkout HTTP/1.1" 502 173 "-" "Mozilla/5.0"
~~~

1. Read the file path from \`process.argv\`.
2. Process the file **line by line with a stream** (it must work on files bigger than your RAM).
3. Count requests per status code and print a summary like:
   ~~~
   Total requests: 120,394
   200: 110,233 (91.6%)
   502: 8,012 (6.7%)
   ...
   ~~~
4. If the file doesn't exist, print a clear error and exit with code \`1\`.

**Stretch:** also print the top 5 paths that returned 5xx errors. That's the real answer your lead wants.`,
    },
    realWorld: {
      company: "PayPal",
      title: "PayPal's move from Java to Node.js",
      story: `In 2013, PayPal rebuilt its account overview page in Node.js and ran it side by side with the existing Java version. According to PayPal's engineering blog, the Node app was **built almost twice as fast with fewer people**, written in **33% fewer lines of code**, handled **double the requests per second**, and had a **35% faster average response time**.

The reason was the event loop: a page like "account overview" mostly *waits* on many backend services. Node's non-blocking I/O handled that waiting far more efficiently than a thread per request.`,
      takeaway: "Node shines for I/O-heavy work (APIs that call databases and other services). Keep CPU-heavy work off the main thread, or you lose that advantage.",
    },
  },

  "async-javascript": {
    lesson: `
## Why async exists

Talking to a database or another API takes milliseconds to seconds. In Node, we never *wait* for it. We say "call me back when it's done". There are three styles of doing this, and you'll meet all three in real codebases.

## 1. Callbacks (old style)

~~~js
fs.readFile("config.json", "utf8", (err, data) => {
  if (err) return console.error(err);   // error-first convention
  console.log(data);
});
~~~

Nesting many callbacks leads to **callback hell**: deeply indented code where error handling is easy to forget.

## 2. Promises

A **Promise** is an object representing a value that will exist later. It's always in one of three states: *pending*, *fulfilled* or *rejected*.

~~~js
fetch("https://api.example.com/user/1")
  .then((res) => res.json())
  .then((user) => console.log(user))
  .catch((err) => console.error("failed", err));
~~~

## 3. async / await (what you'll write daily)

\`async\`/\`await\` is syntax sugar over promises that reads like synchronous code:

~~~js
async function getUser(id) {
  try {
    const res = await fetch(\`https://api.example.com/user/\${id}\`);
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
    return await res.json();
  } catch (err) {
    console.error("getUser failed", err);
    throw err; // let the caller decide what to do
  }
}
~~~

An \`async\` function **always returns a promise**. \`await\` pauses *that function only*, not the whole server.

## Sequential vs parallel: the most common performance bug

~~~js
// ❌ Sequential: 300ms + 300ms + 300ms = ~900ms
const product = await getProduct(id);
const reviews = await getReviews(id);
const recs = await getRecommendations(id);

// ✅ Parallel: ~300ms total, because they don't depend on each other
const [product, reviews, recs] = await Promise.all([
  getProduct(id),
  getReviews(id),
  getRecommendations(id),
]);
~~~

Only go sequential when step 2 **needs the result** of step 1.

## The Promise combinators

| Combinator | Resolves when | Rejects when | Use it for |
|---|---|---|---|
| \`Promise.all\` | all succeed | **any** fails (fail-fast) | everything is required |
| \`Promise.allSettled\` | all finish | never | some parts are optional |
| \`Promise.race\` | first one settles | first one rejects | timeouts |
| \`Promise.any\` | first success | all fail | redundant sources/mirrors |

~~~js
const results = await Promise.allSettled([getReviews(id), getRecs(id)]);
// [{ status: "fulfilled", value: ... }, { status: "rejected", reason: Error }]
~~~

## Timeouts: never wait forever

A slow dependency is often worse than a dead one, because it ties up your resources. Always put a timeout on network calls:

~~~js
function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(\`Timed out after \${ms}ms\`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Modern alternative for fetch:
await fetch(url, { signal: AbortSignal.timeout(500) });
~~~

## Error handling rules

1. Every promise needs a \`.catch\` or must be \`await\`ed inside a \`try/catch\`. An **unhandled rejection crashes Node** (since Node 15).
2. \`forEach\` doesn't wait for async callbacks. Use \`for...of\` for sequential work or \`Promise.all(items.map(...))\` for parallel work.
3. Don't swallow errors (\`catch {}\` with nothing inside). At minimum, log them.

~~~js
// ❌ Runs all requests at once and doesn't wait for them
items.forEach(async (item) => await save(item));

// ✅ Parallel, and waits for all
await Promise.all(items.map((item) => save(item)));
~~~

## Graceful degradation

On a product page, the **product details are critical**. Without them there's no page. **Reviews and recommendations are optional**: if they fail, show the page without them. This mindset (decide what's critical vs optional, then fail gracefully) is exactly how large sites stay up when one of their hundreds of services is down.
`,
    problem: {
      title: "Product page aggregator that survives failing services",
      scenario: `Your company's product page calls three internal services:

| Service | Typical latency | Critical? |
|---|---|---|
| Product service | 100ms | **Yes**. No product, no page. |
| Reviews service | 300ms (sometimes 5s!) | No |
| Recommendations service | 400ms, fails ~10% of the time | No |

The current code calls them **one after another**, so the page takes 800ms+ and goes down entirely whenever recommendations fail. Black Friday is in two weeks.`,
      task: `Simulate the three services with functions that return promises (use \`setTimeout\`, randomly reject some calls, and sometimes delay 5s). Then write \`getProductPage(id)\` which:

1. Calls all three services **in parallel**.
2. Applies a **timeout** (e.g. 500ms) to reviews and recommendations.
3. If **product** fails, throws an error. The page can't be rendered.
4. If reviews/recommendations fail or time out, returns the page with \`reviews: []\` / \`recommendations: []\` plus a \`degraded: ["reviews"]\` field so the frontend knows.
5. Logs every failure, and leaves no unhandled rejections.

Print the total time taken to prove it's parallel.`,
    },
    realWorld: {
      company: "Netflix",
      title: "Netflix designs every page to survive failing dependencies",
      story: `Netflix runs hundreds of microservices. In the early 2010s they built **Hystrix**, a library that wraps every call to another service with a **timeout**, a **fallback**, and a **circuit breaker** (stop calling a service that keeps failing).

If the personalized recommendations service is slow or down, Netflix doesn't show an error page. It falls back to a generic, non-personalized list, and most users never notice. Netflix even runs **Chaos Monkey**, which randomly kills production servers to prove the system degrades gracefully.`,
      takeaway: "Decide for every dependency: is it critical or optional? Put a timeout on everything, run independent calls in parallel, and have a fallback for the optional ones.",
    },
  },

  "node-http-module": {
    lesson: `
## Why learn the raw http module?

Express, Fastify, NestJS and Next.js API routes are all built on Node's \`http\` module. Once you've built a server by hand, framework "magic" stops being magic, and you'll be able to debug it when it breaks.

## The smallest server

~~~js
import http from "node:http";

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ message: "hello" }));
});

server.listen(3000, () => console.log("listening on :3000"));
~~~

- \`req\` is an \`IncomingMessage\`: method, url, headers, and the body as a **readable stream**.
- \`res\` is a \`ServerResponse\`: status, headers, and the body as a **writable stream**.
- You **must** call \`res.end()\`, or the client waits until it times out.

## Routing by hand

~~~js
const server = http.createServer((req, res) => {
  const url = new URL(req.url, \`http://\${req.headers.host}\`);

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, { status: "ok" });
  }
  const match = url.pathname.match(/^\\/users\\/(\\d+)$/);
  if (req.method === "GET" && match) {
    return sendJson(res, 200, { id: Number(match[1]) });
  }
  sendJson(res, 404, { error: "Not found" });
});

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}
~~~

Notice how quickly this gets messy. That's exactly the problem Express's router solves.

## Reading the request body (it's a stream!)

The body doesn't arrive all at once. It comes in **chunks** (Buffers):

~~~js
function readJsonBody(req, limitBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(Object.assign(new Error("Payload too large"), { status: 413 }));
        req.destroy();            // stop reading
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("Invalid JSON"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}
~~~

Why the size limit? Without it, an attacker can send a 10GB body and your server buffers it all into memory until it crashes. This is why Express's \`express.json()\` has a default \`limit\` of 100kb.

## Streaming responses

Since \`res\` is a writable stream, you can send huge files without loading them into memory:

~~~js
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

res.setHeader("Content-Type", "text/csv");
await pipeline(createReadStream("big-export.csv"), res);
~~~

\`pipeline\` also handles **backpressure**: if the client downloads slowly, it pauses reading the file instead of filling up RAM.

## What Express adds on top

| You wrote by hand | Express gives you |
|---|---|
| \`if (req.method === ... && url.match(...))\` | \`app.get("/users/:id", ...)\` |
| \`readJsonBody(req)\` with limits | \`express.json({ limit: "1mb" })\` |
| \`sendJson(res, 200, data)\` | \`res.status(200).json(data)\` |
| Manual try/catch everywhere | Error-handling middleware |
| Nothing | A middleware pipeline (logging, auth, CORS...) |

## Server timeouts

Node's http server has protections you should know about: \`server.headersTimeout\`, \`server.requestTimeout\` and \`server.keepAliveTimeout\`. They stop slow or malicious clients from holding connections open forever.
`,
    problem: {
      title: "A health-check and echo service with production safety limits",
      scenario: `Your platform team runs everything behind a load balancer. The load balancer needs a **health check endpoint** to know if your service is alive, and the mobile team wants a debug **echo endpoint** to verify what their app actually sends.

A security review also flagged that a similar internal service crashed when someone accidentally POSTed a 2GB file to it.`,
      task: `Using only \`node:http\` (no Express), build:

1. \`GET /health\` → \`200 { "status": "ok", "uptime": <seconds> }\`
2. \`POST /echo\` → reads the JSON body **from the stream** and returns \`200 { "received": <body> }\`
3. Invalid JSON → \`400 { "error": "Invalid JSON" }\`
4. Bodies larger than **1MB** → \`413 { "error": "Payload too large" }\`, and stop reading the stream
5. Unknown routes → \`404\` JSON

Test with:
~~~bash
curl -i -X POST localhost:3000/echo -H "Content-Type: application/json" -d '{"a":1}'
curl -i -X POST localhost:3000/echo -d 'not json'
~~~

**Stretch:** set \`server.requestTimeout\` and explain in a comment what attack it mitigates.`,
    },
    realWorld: {
      company: "Slowloris attack",
      title: "How a tiny script took down big web servers",
      story: `In 2009, security researcher Robert "RSnake" Hansen released **Slowloris**, a tool that could take down an Apache web server from a single laptop. It opened many connections and sent HTTP headers **extremely slowly**, one byte every few seconds. Each connection tied up a server thread that waited patiently for the request to finish, and soon there were no threads left for real users.

Defenses against this class of attack are the timeouts and size limits you met in this lesson: Node's \`headersTimeout\` and \`requestTimeout\`, body size limits like \`express.json({ limit })\`, and reverse proxies (nginx, Cloudflare) that buffer requests before they reach your app.`,
      takeaway: "Never trust a client to be fast or small. Every server needs limits on body size, header time and total request time.",
    },
  },
};
