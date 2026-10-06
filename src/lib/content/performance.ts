import type { TopicContent } from "./types";

export const performance: Record<string, TopicContent> = {
  "caching-redis": {
    lesson: `
## Why cache?

A database query might take 5–50ms. Reading from memory takes well under 1ms. If 10,000 people view the same product page per minute, querying the database 10,000 times for **identical data** is wasteful, and at some point the database simply can't keep up.

A **cache** stores the result of expensive work so the next request can reuse it.

## Where caching happens

~~~
Browser cache → CDN (Cloudflare/CloudFront) → API server memory → Redis → Database
~~~

- **HTTP caching** (\`Cache-Control\`, \`ETag\`) lets browsers and CDNs avoid hitting you at all.
- **In-process cache** (a \`Map\` in Node) is fastest, but each server has its own copy, it's lost on restart, and it can be inconsistent across instances.
- **Redis** is a shared, in-memory data store used by all your servers. It's the industry standard.

## Redis in 60 seconds

Redis is a key-value store that lives in RAM. Values can be strings, hashes, lists, sets and sorted sets. Every operation is **atomic** and typically takes sub-millisecond time.

~~~js
import { createClient } from "redis";
const redis = createClient({ url: process.env.REDIS_URL });
await redis.connect();

await redis.set("product:v1:42", JSON.stringify(product), { EX: 300 });  // expires in 300s
const cached = await redis.get("product:v1:42");
await redis.del("product:v1:42");
~~~

## Cache-aside (lazy loading): the pattern you'll use 90% of the time

~~~js
async function getProduct(id) {
  const key = \`product:v1:\${id}\`;

  // 1. try the cache
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);               // cache HIT

  // 2. miss → load from the source of truth
  const product = await db.products.findById(id);
  if (!product) return null;

  // 3. store it for next time, with a TTL
  await redis.set(key, JSON.stringify(product), { EX: 300 });
  return product;
}
~~~

## The hardest part: invalidation

> "There are only two hard things in Computer Science: cache invalidation and naming things." (Phil Karlton)

When the data changes, the cache is **stale**. Strategies:
1. **TTL (time to live)**: data expires automatically. Simple, but users can see stale data for up to TTL seconds.
2. **Delete on write**: when a product is updated, \`redis.del(key)\`. The next read repopulates it.
3. **Write-through**: update the DB and the cache together.

Use **TTL + delete-on-write** together, so even if a delete is missed, data eventually refreshes. Delete (rather than update) the cache on writes to avoid races between two concurrent writers.

## Key naming

Use namespaced, versioned keys: \`product:v1:42\`, \`user:7:cart\`. Bumping \`v1\` → \`v2\` when the cached shape changes instantly "invalidates" all old entries.

## Cache stampede (thundering herd)

A popular key expires, and 5,000 concurrent requests all miss at the same moment and **all hit the database** to rebuild the same value. The database falls over, and so does everything else.

Defenses:
- **Lock / single-flight**: only one request rebuilds, and the others wait or serve stale data:
  ~~~js
  const gotLock = await redis.set(\`lock:\${key}\`, "1", { NX: true, EX: 5 });
  ~~~
- **TTL jitter**: \`EX: 300 + Math.floor(Math.random() * 60)\` so keys don't all expire together.
- **Stale-while-revalidate**: serve the old value while refreshing it in the background.

## When Redis is down

The cache is an **optimization, not the source of truth**. If Redis fails, log it and fall back to the database. Don't fail the request:

~~~js
let cached = null;
try { cached = await redis.get(key); } catch (err) { logger.warn({ err }, "redis unavailable"); }
~~~

## What to cache (and what not to)

✅ Read-heavy, rarely changing data: product details, configs, rendered pages, expensive aggregations
❌ Data that must be exact right now: account balances, stock levels at checkout (always check the DB inside the transaction)

Measure your **hit rate**. A cache with a 5% hit rate is just extra latency and complexity.
`,
    problem: {
      title: "Cache the product API before the big sale",
      scenario: `Marketing is launching a TV ad tomorrow night that will send ~50,000 users to a handful of product pages within minutes. Load tests show the database maxing out at ~800 product reads per second. The product data rarely changes (a few edits a day), but when an admin fixes a price, customers must see it quickly.

The team also remembers when the old Redis server crashed and took the whole site down with it.`,
      task: `Add Redis caching to an Express product API (use \`docker run -p 6379:6379 redis\`, and simulate the DB with a 200ms delay):

1. \`GET /products/:id\` uses **cache-aside** with a TTL (add random jitter).
2. Use namespaced keys like \`product:v1:<id>\`.
3. \`PATCH /products/:id\` updates the "DB" and **invalidates** the cache key.
4. If Redis is unreachable, the API still works from the DB, and logs a warning.
5. Add an \`X-Cache: HIT | MISS\` response header so you can see it working.
6. Implement or clearly describe **stampede protection** (a lock with \`SET NX EX\`, or single-flight in process).

Show timings: first request ~200ms, second request a few ms.`,
    },
    realWorld: {
      company: "Facebook",
      title: "Facebook's 2.5-hour outage from a cache feedback loop (2010)",
      story: `On September 23, 2010, Facebook was down for about **2.5 hours**, their worst outage in over four years at the time. An automated system that verified configuration values found a value it considered invalid and tried to "fix" it by **querying the database**. But the bad value was in the persistent store, so every client saw it as invalid and **every client queried the database at the same time**, hundreds of thousands of queries per second. The database cluster was overwhelmed, errors caused more retries, and the only fix was to turn off traffic to the cluster.

Facebook later published research on their memcache architecture describing **"leases"**, a mechanism that lets only one client rebuild a missing cache value while the others wait. That's exactly the stampede protection in this lesson.`,
      takeaway: "Caches protect your database, until they all miss at once. Add TTL jitter, single-flight or lock rebuilds, and make sure failures don't trigger a flood of retries against the source of truth.",
    },
  },

  "rate-limiting": {
    lesson: `
## Why rate limit?

Without limits, a single client can:
- brute-force passwords (millions of login attempts)
- scrape your entire catalog
- accidentally DDoS you (a buggy mobile app retrying in a tight loop)
- run up your bills (every request to an AI or SMS API costs money)

Rate limiting caps **how many requests a client can make in a period of time**. When the cap is exceeded, you respond with **\`429 Too Many Requests\`**.

## Identifying the client

- **API key** or **user id** for authenticated traffic (the most accurate)
- **IP address** as a fallback for anonymous traffic. Many users can share an IP (offices, mobile carriers), and attackers rotate IPs. Behind a proxy, configure \`app.set("trust proxy", 1)\` so \`req.ip\` is the real client IP.

## Algorithm 1: fixed window

Count requests per client per minute: \`key = ip:2025-03-12T10:15\`. Reset each minute.
- ✅ Dead simple: \`INCR\` + \`EXPIRE\` in Redis
- ❌ **Boundary burst**: 100 requests at 10:15:59 + 100 at 10:16:00 = 200 in 2 seconds

## Algorithm 2: sliding window

Keep timestamps of recent requests (e.g. a Redis sorted set) and count those in the last 60s. Or approximate it by weighting the previous window's count.
- ✅ Smooth, no boundary bursts
- ❌ More memory per client

## Algorithm 3: token bucket (the industry favorite)

Each client has a **bucket** that holds up to **C** tokens and refills at **R** tokens per second. Each request removes one token. An empty bucket means 429.

- ✅ Allows short **bursts** (up to C) while enforcing an average rate (R)
- ✅ O(1) memory: just \`tokens\` and \`lastRefill\`

The trick is that **you don't need a timer**. You compute the refill lazily when a request arrives:

~~~js
const buckets = new Map();
const CAPACITY = 10;
const REFILL_PER_SEC = 1;

function takeToken(clientId) {
  const now = Date.now();
  const b = buckets.get(clientId) ?? { tokens: CAPACITY, last: now };
  const elapsedSec = (now - b.last) / 1000;
  b.tokens = Math.min(CAPACITY, b.tokens + elapsedSec * REFILL_PER_SEC);
  b.last = now;

  const allowed = b.tokens >= 1;
  if (allowed) b.tokens -= 1;
  buckets.set(clientId, b);

  const retryAfterSec = allowed ? 0 : Math.ceil((1 - b.tokens) / REFILL_PER_SEC);
  return { allowed, remaining: Math.floor(b.tokens), retryAfterSec };
}
~~~

(**Leaky bucket** is a close cousin: requests queue up and are processed at a constant rate.)

## Tell clients what's happening

~~~http
HTTP/1.1 429 Too Many Requests
Retry-After: 3
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
~~~

Well-behaved clients read \`Retry-After\` and back off. An IETF draft standardizes \`RateLimit-*\` headers too.

## The multi-server problem

The \`Map\` above lives in **one process**. With 4 servers behind a load balancer, each has its own counters, so a client effectively gets **4× the limit**. Counters are also lost on every deploy.

Fix: store counters in **Redis**, shared by all servers. To avoid race conditions between "read tokens" and "write tokens", do the update atomically: \`INCR\` for fixed windows, or a small **Lua script** for a token bucket (Redis runs Lua scripts atomically).

## Layers of rate limiting in production

1. **Edge/CDN** (Cloudflare, AWS WAF): blocks floods before they reach you
2. **API gateway** (Kong, nginx \`limit_req\`): per-key quotas
3. **Application**: business-aware limits (5 login attempts per account per 15 minutes, 3 password resets per hour)

Different endpoints deserve different limits. Login and signup should be strict, and reading a public catalog can be generous.
`,
    problem: {
      title: "Build a token-bucket rate limiter for a public API",
      scenario: `Your company just launched a **public developer API** (think a weather or payments API). In the first week:
- one customer's buggy script sent 40,000 requests per minute and slowed the API for everyone
- the login endpoint saw 2 million password guesses from a botnet

Leadership wants fair usage: **bursts are fine, sustained abuse is not**. Paid customers should get higher limits than free ones.`,
      task: `Write a rate-limiting **Express middleware factory** \`rateLimit({ capacity, refillPerSec, keyFn })\` using the **token bucket** algorithm (no rate-limit library):

1. Identify clients by API key (\`X-API-Key\` header), falling back to \`req.ip\`.
2. Refill tokens lazily from elapsed time (no \`setInterval\`).
3. On rejection: \`429\` with \`Retry-After\`, \`X-RateLimit-Limit\` and \`X-RateLimit-Remaining\`. Set the limit headers on successful responses too.
4. Use different limits for \`/api/*\` (e.g. 20 burst, 5/sec) and \`/auth/login\` (e.g. 5 burst, 1 per 10s).
5. Write a short explanation: **why does an in-memory limiter break with 3 server instances, and how would Redis (plus a Lua script or atomic operations) fix it?**

**Stretch:** give paid API keys a bigger bucket.`,
    },
    realWorld: {
      company: "Stripe",
      title: "How Stripe rate-limits millions of API requests",
      story: `Stripe's engineering blog post "Scaling your API with rate limiters" explains that they use the **token bucket** algorithm, implemented in **Redis**, as their main request rate limiter. On top of it they run a **concurrent requests limiter** (capping how many requests a user has in flight at once) and **load shedders** that drop low-priority traffic first when the system is under stress, so critical requests like charges keep working.

They also mention that a limiter should **fail open**: if Redis has a problem, it's better to let requests through than to block all API traffic.`,
      takeaway: "Rate limiting is about fairness and survival. Token buckets allow bursts while capping the average, shared state in Redis makes limits correct across servers, and good headers let clients behave.",
    },
  },

  "background-jobs": {
    lesson: `
## Don't make the user wait for slow work

~~~js
// ❌ The user stares at a spinner for 6 seconds
app.post("/orders", async (req, res) => {
  const order = await createOrder(req.body);       // 50ms
  await sendConfirmationEmail(order);              // 1.5s (and sometimes fails!)
  await generateInvoicePdf(order);                 // 3s
  await notifyWarehouse(order);                    // 1s
  res.status(201).json(order);
});
~~~

Problems:
1. **Slow**: the user waits for work they don't need to wait for.
2. **Fragile**: if the email provider is down, does the order fail? It shouldn't!
3. **No retries**: a temporary failure means the email is lost forever.
4. **Timeouts**: load balancers usually cut requests after about 30–60s.

## The solution: a job queue

~~~
API ──add job──► Queue (Redis) ──► Worker process(es) ──► email / PDF / warehouse
 │
 └─► responds immediately (201 or 202 Accepted)
~~~

- The **producer** (your API) adds a job describing the work: \`{ type: "send-email", orderId: 42 }\`.
- The **queue** stores jobs durably (Redis, RabbitMQ, SQS, Kafka).
- **Workers** are separate processes that pull jobs and do the work. You can run 1 or 100 of them and scale them independently from the API.

## BullMQ (the standard Node.js choice)

~~~js
// queue.js (shared)
import { Queue } from "bullmq";
export const emailQueue = new Queue("emails", { connection: { host: "localhost", port: 6379 } });

// in the API: enqueue and respond
await emailQueue.add(
  "order-confirmation",
  { orderId: order.id },
  {
    jobId: \`order-confirmation:\${order.id}\`,     // idempotency: the same job is never added twice
    attempts: 5,
    backoff: { type: "exponential", delay: 1000 }, // 1s, 2s, 4s, 8s, 16s
    removeOnComplete: 1000,
  },
);
res.status(201).json(order);

// worker.js (a separate process: node worker.js)
import { Worker } from "bullmq";
const worker = new Worker("emails", async (job) => {
  const order = await db.orders.findById(job.data.orderId);   // fetch fresh data
  await emailProvider.send({ to: order.email, template: "confirmation", data: order });
}, { connection: { host: "localhost", port: 6379 }, concurrency: 10 });

worker.on("failed", (job, err) => {
  if (job.attemptsMade >= job.opts.attempts) logger.error({ jobId: job.id, err }, "job permanently failed");
});
~~~

Pass **ids, not whole objects** in job data. The data might change before the job runs, and big payloads bloat the queue.

## Retries with exponential backoff

Temporary failures (network blips, rate limits, a provider outage) are normal. Retrying **immediately** just hammers a struggling service. Instead, wait longer each time: 1s, 2s, 4s, 8s... Adding **jitter** (randomness) stops thousands of jobs from retrying in lockstep.

## Idempotency: the golden rule of jobs

Queues usually guarantee **at-least-once** delivery. A job can run **twice**: a worker might crash right after sending the email but before marking the job done. So jobs must be **idempotent**, meaning running them twice has the same effect as once:

- Use a deterministic \`jobId\` (\`order-confirmation:42\`) so duplicates aren't enqueued.
- Inside the job, check-and-set: \`if (order.confirmationSentAt) return;\` then send, then mark it sent.
- Pass an idempotency key to the external provider (Stripe, many email APIs support this).

## Dead-letter queues

After N failed attempts, move the job to a **dead-letter queue** (BullMQ keeps failed jobs in a failed set), alert someone, and allow a manual retry once the bug is fixed. Never silently drop failures.

## What belongs in background jobs?

✅ Emails, SMS, push notifications · PDF/image/video processing · webhooks to third parties · data exports and reports · syncing to search indexes or analytics · scheduled tasks (nightly cleanups, using BullMQ's repeatable jobs)

❌ Things the user needs **in the response**. Validation and payment authorization still happen inside the request.

## 202 Accepted

For long operations the user *does* care about (e.g. "export my data"), return \`202 Accepted\` with a job id, and let the client poll \`GET /exports/:jobId\` or get notified by WebSocket or email.
`,
    problem: {
      title: "Move order emails and invoices to a background queue",
      scenario: `Your checkout endpoint sends the confirmation email and generates the invoice PDF **inside the request**. Last Tuesday the email provider had a 20-minute outage: **checkouts failed** (lost revenue!), and when the provider recovered, some customers received **3 duplicate emails** because the frontend retried.

Average checkout time is 4.2 seconds. The product team wants it under 300ms.`,
      task: `Using BullMQ + Redis (or another queue):

1. \`POST /orders\` creates the order (in memory is fine), **enqueues** a job, and responds \`201\` immediately.
2. A **separate worker process** handles the \`order-confirmation\` job: send a fake email (log it, wait 1s, and randomly fail 30% of the time).
3. Configure **5 attempts with exponential backoff**.
4. Make it **idempotent**: \`jobId\` based on the order id, *and* an "already sent" check in the worker so a retried job never double-sends.
5. Log permanently failed jobs clearly (dead-letter handling).
6. Show logs proving that a failed job was retried and eventually succeeded, and that the API responded fast.

**Stretch:** add a second job type (\`generate-invoice\`) on its own queue and explain why separate queues are useful.`,
    },
    realWorld: {
      company: "GitHub",
      title: "GitHub built Resque to move work out of requests",
      story: `In 2009, GitHub had a growing pile of slow work happening during web requests and in an overloaded job system: updating search indexes, sending emails, generating archives, and running repository operations. Their engineers built **Resque**, a Redis-backed job queue, and open-sourced it. GitHub's blog post introducing Resque described running a huge variety of background jobs through it, which kept web requests fast while workers processed the slow tasks.

Resque inspired a whole generation of Redis-backed queues, including Sidekiq for Ruby and Bull/BullMQ for Node.js.`,
      takeaway: "Keep requests fast and reliable by doing only essential work in the request. Everything else goes to a queue, with retries, backoff and idempotent jobs.",
    },
  },

  "file-uploads": {
    lesson: `
## Uploads are dangerous

File uploads are one of the riskiest features you can build:
- **Huge files** can fill your disk or memory
- **Malicious files**: an "image" that's actually an HTML page with JavaScript (stored XSS), a script, or a file crafted to exploit image libraries
- **Path traversal**: a filename like \`../../etc/passwd\` or \`../app.js\`
- **Cost**: storing and serving terabytes

## How uploads arrive

Browsers send files as \`multipart/form-data\`. \`express.json()\` can't parse that, so you need **multer** (or busboy).

~~~js
import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";

const ALLOWED = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + ALLOWED[file.mimetype]),  // never use the user's name
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },     // 5MB, 1 file
  fileFilter: (req, file, cb) => {
    if (ALLOWED[file.mimetype]) cb(null, true);
    else cb(new ValidationError("Only JPEG, PNG or WebP images are allowed"));
  },
});

app.post("/api/avatar", authenticate, upload.single("avatar"), (req, res) => {
  res.status(201).json({ url: \`/uploads/\${req.file.filename}\` });
});
~~~

## Validate the content, not just the label

\`file.mimetype\` comes from the **client**, so it can be faked. Rename \`evil.html\` to \`cat.png\`, send \`Content-Type: image/png\`, and it passes. Check the **magic bytes** (the first bytes of the file):

| Type | Starts with |
|---|---|
| PNG | \`89 50 4E 47\` |
| JPEG | \`FF D8 FF\` |
| PDF | \`25 50 44 46\` (\`%PDF\`) |

Libraries like \`file-type\` do this for you. Even better, **re-encode images** with \`sharp\` (resize and convert to WebP). That strips hidden payloads and metadata (including GPS location from phone photos!) and saves bandwidth.

## Never store files on your API server's disk in production

- Servers are ephemeral (containers restart, autoscaling adds and removes machines), so files disappear.
- With 3 servers, a file uploaded to server A doesn't exist on B.
- Disks fill up.

Use **object storage**: AWS S3, Google Cloud Storage, Cloudflare R2, Azure Blob. Effectively unlimited, durable and cheap, and you can put a CDN in front of it.

## Presigned URLs: uploads that bypass your server

Streaming every 2GB video through your Node server wastes bandwidth and CPU. Instead:

~~~
1. Client → API:  "I want to upload avatar.png (image/png, 1.2MB)"
2. API checks auth + type + size, then creates a PRESIGNED URL (valid 5 min, for one specific key)
3. Client → S3:   PUT the file directly to that URL
4. Client → API:  "Upload done" (or S3 sends an event) → API verifies + processes
~~~

~~~js
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const key = \`avatars/\${req.user.id}/\${crypto.randomUUID()}.png\`;
const url = await getSignedUrl(
  s3,
  new PutObjectCommand({ Bucket: process.env.BUCKET, Key: key, ContentType: "image/png" }),
  { expiresIn: 300 },
);
res.json({ uploadUrl: url, key });
~~~

The bucket stays **private**. Serve files through a CDN or with short-lived presigned GET URLs. Misconfigured public buckets have caused many large data leaks.

## Processing pipeline

Uploads usually trigger **background jobs** (the previous topic): generate thumbnails, scan for malware, transcode video, extract text from PDFs. The upload request returns quickly, and processing happens asynchronously.

## Checklist

- Size limits (in multer and at the proxy: nginx \`client_max_body_size\`)
- Allowlist types plus a magic byte check
- Server-generated filenames, and never use user input in paths
- Store in object storage with private buckets
- Re-encode images and strip metadata
- Serve user files from a separate domain or with \`Content-Disposition: attachment\` so they can't run scripts on your main domain
`,
    problem: {
      title: "Secure profile picture uploads",
      scenario: `Your social app is adding **profile pictures**. In the first prototype, a QA engineer uploaded:
1. a 900MB video, which crashed the server
2. \`shell.php\` renamed to \`avatar.png\`, which was accepted
3. a file named \`../../server.js\`, which overwrote a source file on disk 😱

The app runs on 4 auto-scaling containers, so files saved to local disk randomly "disappear".`,
      task: `Build \`POST /api/me/avatar\` with Express + multer:

1. Accept a single image up to **5MB** (anything larger gets \`413\`).
2. Allowlist JPEG/PNG/WebP, and verify the **magic bytes** (e.g. with \`file-type\`, or by reading the first bytes yourself).
3. Generate **server-side filenames** (UUIDs). The user's filename never touches the filesystem path.
4. Return clear \`400\` errors for invalid files (through your error handler).
5. **Design** the production version: write the presigned-URL flow (step by step, plus the endpoint that generates the URL) for uploading directly to S3 (or R2/GCS), and explain why it scales better.

**Stretch:** resize the image to 256×256 WebP with \`sharp\` and strip metadata.`,
    },
    realWorld: {
      company: "ImageTragick",
      title: "Uploaded images that took over servers (2016)",
      story: `In May 2016, researchers disclosed **ImageTragick** (CVE-2016-3714), a set of vulnerabilities in **ImageMagick**, the library that countless websites used to resize uploaded images. A specially crafted file uploaded as an "image" could make ImageMagick **execute shell commands on the server**. Any site that accepted image uploads and processed them with ImageMagick could be completely taken over.

The recommended mitigations were to **verify magic bytes** before processing (instead of trusting file extensions), restrict which file formats the library would handle, and keep image processing isolated from the main application.`,
      takeaway: "Treat every uploaded file as hostile. Validate real content, use your own filenames, limit size, process in isolation, and store in private object storage.",
    },
  },
};
