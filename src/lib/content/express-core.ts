import type { TopicContent } from "./types";

export const expressCore: Record<string, TopicContent> = {
  "express-routing": {
    lesson: `
## Express in one sentence

Express is a thin layer on top of \`node:http\` that gives you **routing**, a **middleware pipeline** and **response helpers**. It's the most widely used Node web framework, and its ideas carry over to Fastify, Koa and NestJS.

~~~bash
npm init -y
npm install express
~~~

~~~js
import express from "express";

const app = express();
app.use(express.json());               // parse JSON bodies

app.get("/health", (req, res) => {
  res.json({ status: "ok" });          // sets Content-Type + status 200
});

app.listen(3000, () => console.log("API on :3000"));
~~~

> This course uses **Express 5**, the current major version. Its biggest improvement is that errors thrown in \`async\` handlers are passed to your error middleware automatically.

## Routes = method + path + handler

~~~js
app.get("/products", listProducts);
app.post("/products", createProduct);
app.get("/products/:id", getProduct);
app.patch("/products/:id", updateProduct);
app.delete("/products/:id", deleteProduct);
~~~

## The three ways a client sends you data

| Where | Example | Read with |
|---|---|---|
| Route params | \`/products/42\` | \`req.params.id\` → \`"42"\` |
| Query string | \`/products?category=books&maxPrice=20\` | \`req.query.category\` |
| Body | JSON in a POST | \`req.body\` (needs \`express.json()\`) |

⚠️ **Params and query values are always strings (or missing).** \`req.query.maxPrice\` is \`"20"\`, not \`20\`. Comparing \`"100" < "20"\` gives \`true\`, because strings compare alphabetically! Always convert and validate:

~~~js
const maxPrice = req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : undefined;
if (maxPrice !== undefined && Number.isNaN(maxPrice)) {
  return res.status(400).json({ error: "maxPrice must be a number" });
}
~~~

## Response helpers

~~~js
res.status(201).json(product);   // status + JSON
res.sendStatus(204);             // empty body
res.set("X-Total-Count", "42");  // header
res.redirect(301, "/new-path");
~~~

Call exactly **one** response method per request. Calling \`res.json\` twice throws *"Cannot set headers after they are sent"*. Use \`return res.status(404).json(...)\` to stop execution.

## Organizing routes with Router

In real codebases, you never put 200 routes in one file. Group them by **feature**:

~~~js
// routes/products.js
import { Router } from "express";
const router = Router();

router.get("/", (req, res) => { /* list */ });
router.get("/:id", (req, res) => { /* get one */ });

export default router;

// app.js
import productsRouter from "./routes/products.js";
app.use("/api/products", productsRouter);   // GET /api/products/:id
~~~

A common production folder structure:

~~~
src/
  app.js           ← creates and configures the express app
  server.js        ← calls app.listen (kept separate for testing)
  routes/
    products.routes.js
    orders.routes.js
  controllers/  services/  repositories/   ← you'll learn these layers later
~~~

## Route order matters

Express checks routes **top to bottom** and uses the first match:

~~~js
app.get("/products/:id", getProduct);
app.get("/products/featured", getFeatured);  // ❌ never reached: "featured" matches :id
~~~

Put specific routes before parameterized ones.

## Tools for testing your API

- \`curl -i\` from the terminal
- **Postman**, **Insomnia**, or the VS Code **REST Client** extension
- \`node --watch server.js\` restarts on file changes (built into Node 18+)
`,
    problem: {
      title: "Product catalog API with search filters",
      scenario: `You're building the catalog backend for a small online store. The frontend shows a product grid with filters in the sidebar: **category** and a **price range**, just like the filters on Amazon's search results.

The mobile team will also use this API, so it needs to be well organized and predictable.`,
      task: `Build an Express app with an in-memory array of at least 8 products (\`id\`, \`name\`, \`category\`, \`price\`, \`inStock\`).

1. Put product routes in their own \`express.Router()\` and mount it at \`/api/products\`.
2. \`GET /api/products\` supports optional filters:
   - \`?category=electronics\`
   - \`?minPrice=10&maxPrice=100\`
   - filters can be combined
3. Invalid numbers (\`?minPrice=abc\`) return \`400\` with a helpful message.
4. \`GET /api/products/:id\` returns \`200\` with the product, or \`404\`.
5. Return \`{ data: [...], count: n }\` from the list endpoint.

**Stretch:** add \`?sort=price_asc|price_desc\`, and reject unknown sort values with 400.`,
    },
    realWorld: {
      company: "Amazon",
      title: "Amazon's search URL is a REST query string",
      story: `Search for "laptop" on Amazon and click a few filters, and the URL turns into something like \`/s?k=laptop&rh=n:565108,p_36:50000-100000&s=price-asc-rank&page=2\`.

Every filter, the sort order and the page number are encoded in the **query string**. Because of that, the results page is **bookmarkable, shareable and cacheable**: the same URL always means the same search. The backend has to parse and validate every one of those values, because users (and bots) can type anything into a URL.`,
      takeaway: "Use the query string for filtering, sorting and pagination, and validate every value. URLs are user input.",
    },
  },

  middleware: {
    lesson: `
## The pipeline mental model

Express is a **pipeline** of functions. A request flows through each middleware in the order you registered them, until one of them sends a response:

~~~
request → [json parser] → [request id] → [logger] → [auth] → [route handler] → response
                                                       ↓ (on error)
                                                 [error handler]
~~~

A middleware is just a function with three arguments:

~~~js
function myMiddleware(req, res, next) {
  // 1. do something with req/res
  // 2. then EITHER call next() to pass control on...
  next();
  // ...OR end the response: res.status(401).json(...)
}
~~~

Forgetting to call \`next()\` (or send a response) makes the request **hang forever**. This is one of the most common Express bugs.

## Ways to register middleware

~~~js
app.use(express.json());                  // every request
app.use("/api", apiLimiter);              // paths starting with /api
app.get("/admin", requireAdmin, handler); // only this route
router.use(authenticate);                 // everything in this router
~~~

## Order is everything

~~~js
app.get("/users", listUsers);   // ❌ registered BEFORE the logger: never logged
app.use(logger);
~~~

A typical production order:

1. Request id / tracing
2. Security headers (\`helmet\`), CORS
3. Body parsing (\`express.json({ limit: "1mb" })\`)
4. Logging
5. Rate limiting
6. Routes (with per-route auth)
7. 404 handler
8. Error handler (**always last**, and it has 4 arguments)

## Writing useful middleware

**Attach data to \`req\`** for later handlers:

~~~js
function requestId(req, res, next) {
  req.id = req.get("X-Request-Id") ?? crypto.randomUUID();
  res.set("X-Request-Id", req.id);
  next();
}
~~~

**Run code after the response is sent** using the \`finish\` event:

~~~js
function timing(req, res, next) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(\`\${req.method} \${req.originalUrl} \${res.statusCode} \${ms.toFixed(1)}ms\`);
  });
  next();
}
~~~

**Middleware factories** are functions that *return* middleware, so you can configure them:

~~~js
const requireRole = (role) => (req, res, next) =>
  req.user?.role === role ? next() : res.status(403).json({ error: "Forbidden" });

app.delete("/products/:id", authenticate, requireRole("admin"), deleteProduct);
~~~

## Error-handling middleware

If a function has **four** parameters, Express treats it as an error handler. It runs when someone calls \`next(err)\` or an async handler throws (Express 5):

~~~js
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status ?? 500).json({ error: "Something went wrong" });
});
~~~

You'll build a full error-handling system two topics from now.

## Popular third-party middleware

| Package | Purpose |
|---|---|
| \`helmet\` | security headers |
| \`cors\` | cross-origin rules |
| \`express-rate-limit\` | rate limiting |
| \`pino-http\` / \`morgan\` | request logging |
| \`compression\` | gzip responses |
| \`cookie-parser\` | parse cookies |

## Why a request ID matters

When a user reports "checkout failed at 10:42", you need to find **their** request among millions of log lines. If every log line, and every call to other services, carries the same \`X-Request-Id\`, you can trace one request end to end. Load balancers and API gateways usually generate this id for you, so your middleware should **reuse the incoming one** if it's present.
`,
    problem: {
      title: "Request ID and access-log middleware for production debugging",
      scenario: `A customer emailed support: *"My checkout failed at 10:42 this morning."* The on-call engineer searched the logs, but the logs are random \`console.log\` lines with no way to connect them to one request. It took 3 hours to find the problem.

Your tech lead wants every request to be **traceable** from now on. The load balancer already sets an \`X-Request-Id\` header on most requests.`,
      task: `Write two middlewares and apply them to an Express app with a couple of routes (one should be slow, e.g. \`await\` a 300ms timeout):

1. **requestId**
   - reuses the incoming \`X-Request-Id\` if it looks valid (e.g. 1–100 chars, no spaces), otherwise generates one with \`crypto.randomUUID()\`
   - stores it on \`req.id\` and returns it in the \`X-Request-Id\` response header
2. **accessLog**
   - after the response **finishes**, logs one line as JSON:
     \`{ "requestId", "method", "path", "status", "durationMs" }\`
3. Register them in the right order, before the routes.
4. Show that a handler can use \`req.id\` in its own logs.

**Stretch:** add a middleware that logs a warning for any request slower than 1 second.`,
    },
    realWorld: {
      company: "Heroku & AWS",
      title: "Request IDs at every major cloud provider",
      story: `Heroku's router adds an **\`X-Request-ID\`** header to every incoming request, and AWS's Application Load Balancer adds **\`X-Amzn-Trace-Id\`**. Both exist for the same reason: in a system where one click passes through a load balancer, an API, three microservices and a database, you need one id to stitch the logs together.

Modern observability tools (OpenTelemetry, Datadog, Honeycomb) build on the same idea with **trace ids** that flow through every service. All of them hook into your app as **middleware**.`,
      takeaway: "Cross-cutting concerns (ids, logging, auth, security headers) belong in middleware, written once and applied everywhere in the right order.",
    },
  },

  "rest-api-design": {
    lesson: `
## What REST really means (in practice)

REST is a style of designing APIs around **resources** (nouns) and **HTTP methods** (verbs). A well-designed API is predictable: a developer who has seen one endpoint can guess the others.

## Resource naming rules

| ✅ Do | ❌ Don't |
|---|---|
| \`GET /orders\` | \`GET /getAllOrders\` |
| \`POST /orders\` | \`POST /createOrder\` |
| \`GET /orders/42\` | \`GET /order?id=42\` |
| \`GET /users/7/orders\` | \`GET /getOrdersForUser/7\` |
| \`POST /orders/42/cancel\` (an action) | \`GET /cancelOrder/42\` |

- Use **plural nouns** and lowercase-with-hyphens (\`/order-items\`).
- Nest at most one level deep (\`/users/7/orders\`, not \`/users/7/orders/42/items/3/reviews\`).
- When an action doesn't fit CRUD, a sub-resource like \`POST /orders/42/cancel\` is acceptable.

## Methods + status codes

| Operation | Request | Success response |
|---|---|---|
| List | \`GET /orders\` | \`200\` + array |
| Read | \`GET /orders/42\` | \`200\` or \`404\` |
| Create | \`POST /orders\` | **\`201\`** + created resource + \`Location: /orders/42\` |
| Replace | \`PUT /orders/42\` | \`200\` |
| Update | \`PATCH /orders/42\` | \`200\` |
| Delete | \`DELETE /orders/42\` | **\`204\`** (no body) |

## Consistent response shapes

Pick one envelope and use it everywhere:

~~~json
{ "data": [ ... ], "pagination": { "nextCursor": "eyJpZCI6NDJ9", "hasMore": true } }
~~~

~~~json
{ "error": { "code": "ORDER_NOT_FOUND", "message": "Order 42 was not found" } }
~~~

Machine-readable \`code\` values let frontends react to specific errors without parsing English sentences.

## Pagination: offset vs cursor

**Offset pagination**, \`?page=3&limit=20\` → \`LIMIT 20 OFFSET 40\`:
- ✅ simple, lets you jump to page N
- ❌ **slow on big tables**: the database still reads and throws away all the skipped rows (OFFSET 1,000,000 is painful)
- ❌ **unstable**: if new rows are inserted while a user pages, they see duplicates or miss items

**Cursor pagination**, \`?limit=20&cursor=<opaque>\`:
~~~sql
SELECT * FROM orders
WHERE (created_at, id) < ($cursorCreatedAt, $cursorId)
ORDER BY created_at DESC, id DESC
LIMIT 21;   -- fetch one extra to know if there's a next page
~~~
- ✅ fast at any depth (uses an index)
- ✅ stable under inserts
- ❌ no "jump to page 50" (infinite scroll doesn't need it anyway)

The cursor is usually the sort key of the last item, **base64-encoded** so clients treat it as opaque:

~~~js
const encodeCursor = (o) => Buffer.from(JSON.stringify({ c: o.createdAt, id: o.id })).toString("base64url");
const decodeCursor = (s) => JSON.parse(Buffer.from(s, "base64url").toString());
~~~

Include a unique tie-breaker (\`id\`) in the sort, or rows with the same timestamp get skipped.

## Always cap limits

~~~js
const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
~~~

Otherwise someone will request \`?limit=10000000\` and take down your database.

## Filtering, sorting, field selection

~~~
GET /orders?status=shipped&sort=-createdAt&fields=id,total
~~~

## Versioning

Once mobile apps are in users' pockets, **you can't change your API's shape**: old app versions will break. Options:
- URL versioning: \`/api/v1/orders\` (most common, very explicit)
- Header versioning: \`Accept: application/vnd.shop.v2+json\`, or Stripe's dated \`Stripe-Version: 2024-06-20\`

**Additive changes** (new optional fields) are safe. **Removing or renaming** fields requires a new version.
`,
    problem: {
      title: "Order history API with infinite scroll",
      scenario: `The mobile team is building an **infinite-scroll "Your Orders" screen**. Power users have thousands of orders. The first version used \`?page=N\`, and users reported **seeing the same order twice** while scrolling right after they placed a new order. The database team also complained about slow \`OFFSET\` queries.

You're asked to design the v1 Orders API properly.`,
      task: `Build an Express API (in-memory data is fine; generate ~200 orders with \`id\`, \`userId\`, \`total\`, \`status\`, \`createdAt\`):

1. \`GET /api/v1/orders?limit=20&cursor=...\`
   - newest first
   - **cursor-based** pagination with an opaque base64 cursor
   - response: \`{ data: [...], pagination: { nextCursor, hasMore } }\`
   - \`limit\` defaults to 20, capped at 100, and \`400\` if it's invalid
2. \`POST /api/v1/orders\` → \`201\` + created order + \`Location\` header
3. \`DELETE /api/v1/orders/:id\` → \`204\`, or \`404\` if missing
4. Errors use one consistent shape: \`{ error: { code, message } }\`

**Prove it works:** fetch page 1, create a new order, fetch page 2 with the cursor, and show that there are no duplicates.`,
    },
    realWorld: {
      company: "Slack & Stripe",
      title: "Why Slack and Stripe moved to cursor pagination",
      story: `Slack's engineering blog ("Evolving API Pagination at Slack") describes moving their Web API from offset pagination to **cursor-based pagination**. At their scale, offsets became slow on large datasets and gave inconsistent results when new messages and channels were created mid-pagination. Cursors fixed both problems.

**Stripe** uses cursors too (\`starting_after=obj_123\`). Stripe is also famous for API versioning: every account is pinned to a dated API version, so Stripe can evolve the API without breaking integrations that were written years ago.`,
      takeaway: "Design APIs for the scale you'll have. Cursor pagination and explicit versioning are cheap to add on day one and very expensive to retrofit.",
    },
  },

  validation: {
    lesson: `
## Rule #1 of backend: never trust the client

Your frontend validates the form, so why validate again on the server? Because **anyone can call your API directly**, with curl, Postman or a script, and skip your frontend entirely. Client-side validation is for user experience. **Server-side validation is for security and data integrity.**

Without validation:
- \`{ "quantity": -5 }\` turns into a refund
- \`{ "email": 12345 }\` crashes \`email.toLowerCase()\` and causes a 500
- \`{ "role": "admin" }\` sneaks into your \`users\` table (mass assignment)
- a 5MB "name" string bloats your database

## What to validate

1. **Types**: is \`price\` actually a number?
2. **Required fields**: is \`email\` present?
3. **Formats**: email, UUID, ISO date, URL
4. **Ranges and lengths**: \`quantity\` between 1 and 100, \`name\` ≤ 100 chars
5. **Allowed values**: \`status\` must be one of \`"pending" | "shipped"\`
6. **Unknown fields**: strip them, or reject them

## Schema validation with Zod

Writing \`if\` statements for every field gets unmanageable. Use a **schema library**. Zod is the most popular in the TypeScript and Node world (alternatives: Joi, Yup, Valibot, AJV).

~~~bash
npm install zod
~~~

~~~js
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[0-9]/, "Password must contain a number"),
  name: z.string().trim().min(1).max(100).optional(),
});
// z.object() strips unknown keys by default. Use .strict() to reject them instead.

const result = signupSchema.safeParse(req.body);
if (!result.success) {
  // result.error.issues → [{ path: ["email"], message: "Invalid email" }, ...]
}
const data = result.data; // ✅ typed, trimmed, lowercased, unknown fields removed
~~~

\`parse()\` throws on invalid input. \`safeParse()\` returns \`{ success, data | error }\`, which is easier to turn into a 400.

## A reusable validation middleware

~~~js
const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      },
    });
  }
  req.validated = result.data;   // handlers use THIS, never raw req.body
  next();
};

app.post("/signup", validate(signupSchema), signupHandler);
~~~

Validate \`req.query\` and \`req.params\` the same way. \`z.coerce.number()\` is handy for turning query strings into numbers.

## Validation vs business rules

- **Validation** = "is this well-formed?" (an email format, a positive quantity). Done at the edge, returns **400**.
- **Business rules** = "is this allowed right now?" (email already registered → **409**; not enough stock → **409**). Done in the service layer, often needs the database.

## Error responses that help

Return **field-level** errors so the frontend can highlight the exact input:

~~~json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "details": [
      { "field": "email", "message": "Invalid email" },
      { "field": "password", "message": "Password must contain a number" }
    ]
  }
}
~~~

## Bonus: one schema, many uses

With TypeScript, \`z.infer<typeof signupSchema>\` gives you the type for free. Teams share schemas between frontend and backend, and tools can generate OpenAPI docs from them.
`,
    problem: {
      title: "Bulletproof signup endpoint",
      scenario: `Your startup's signup endpoint currently does \`db.users.insert(req.body)\`. In one week:
- a bot created 4,000 accounts with emails like \`"   ADMIN@x.com "\` and \`"aaaa"\`
- one user had \`"role": "admin"\` in their row. Someone added it to the request body!
- a 2MB "name" broke the profile page

You're asked to lock it down.`,
      task: `Build \`POST /api/signup\` in Express with Zod (or Joi):

1. Schema:
   - \`email\`: required, trimmed, lowercased, valid email
   - \`password\`: 8–72 chars, at least one letter and one number
   - \`name\`: optional, trimmed, 1–100 chars
2. A reusable \`validate(schema)\` middleware that returns \`400\` with field-level errors.
3. **Unknown fields like \`role\` must never reach the handler.** Strip them (or reject with 400), and explain your choice.
4. The handler saves to an in-memory array and returns \`201\` with the user, **without the password**.
5. Return \`409\` if the email is already registered (a business rule, not validation).

Test with a valid body, a body with 3 errors at once, and a body containing \`"role":"admin"\`.`,
    },
    realWorld: {
      company: "GitHub",
      title: "The mass-assignment hack on GitHub (2012)",
      story: `In March 2012, developer Egor Homakov exploited a **mass assignment** vulnerability on GitHub. The app passed request parameters straight into a database update without restricting which fields could be set. By adding an extra field to a form submission, he attached his own SSH key to the **Ruby on Rails organization** and pushed a commit to the Rails repository to prove it.

GitHub patched it within hours, and the incident led Rails to adopt "strong parameters", an explicit allowlist of fields. Your Zod schema with unknown keys stripped is the exact same idea.`,
      takeaway: "Never pass raw req.body into your database. Allowlist the fields you accept, validate their shape, and treat everything else as hostile.",
    },
  },

  "error-handling": {
    lesson: `
## Two kinds of errors

1. **Operational errors**: expected things that go wrong at runtime. User not found, invalid input, payment declined, database timeout. You **handle** these and return a proper status code.
2. **Programmer errors**: bugs. \`undefined is not a function\`, a typo, a wrong assumption. You can't "handle" a bug. **Log it with full details, return a generic 500**, and fix the code.

Good error handling treats these two differently.

## The problem with ad-hoc error handling

~~~js
app.get("/orders/:id", async (req, res) => {
  try {
    const order = await db.findOrder(req.params.id);
    if (!order) return res.status(404).json({ msg: "not found" });
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: e.message, stack: e.stack }); // ❌ leaks internals
  }
});
~~~

Across 200 routes this means: inconsistent shapes (\`msg\` vs \`error\` vs \`message\`), duplicated try/catch everywhere, and leaked stack traces that show attackers your file paths, library versions and SQL.

## Step 1: a custom error hierarchy

~~~js
export class AppError extends Error {
  constructor(message, { statusCode = 500, code = "INTERNAL_ERROR", details } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}
export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(\`\${resource} not found\`, { statusCode: 404, code: "NOT_FOUND" });
  }
}
export class ValidationError extends AppError {
  constructor(details) {
    super("Invalid request", { statusCode: 400, code: "VALIDATION_ERROR", details });
  }
}
export class ConflictError extends AppError {
  constructor(message) {
    super(message, { statusCode: 409, code: "CONFLICT" });
  }
}
~~~

Now business code just **throws** meaningful errors:

~~~js
const order = await orders.findById(id);
if (!order) throw new NotFoundError("Order");
~~~

## Step 2: async errors must reach Express

- **Express 5**: a rejected promise or a \`throw\` inside an \`async\` handler is automatically passed to \`next(err)\`. ✅
- **Express 4**: it is NOT. The request hangs, or you get an unhandled rejection. You need a wrapper:

~~~js
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
app.get("/orders/:id", asyncHandler(async (req, res) => { ... }));
~~~

## Step 3: one centralized error handler (registered last)

~~~js
// 404 for unknown routes, after all routes
app.use((req, res, next) => next(new NotFoundError("Route")));

// Error handler: 4 args, registered LAST
app.use((err, req, res, next) => {
  const isOperational = err instanceof AppError;
  const status = isOperational ? err.statusCode : 500;

  // Always log the full error server-side, with the request id
  req.log?.error({ err, requestId: req.id }) ?? console.error(err);

  res.status(status).json({
    error: {
      code: isOperational ? err.code : "INTERNAL_ERROR",
      message: isOperational ? err.message : "Something went wrong",
      ...(isOperational && err.details ? { details: err.details } : {}),
      requestId: req.id,
      ...(process.env.NODE_ENV !== "production" ? { stack: err.stack } : {}),
    },
  });
});
~~~

Returning \`requestId\` to the client is a pro move. Support can ask the user for it and find the exact log line.

## Step 4: process-level safety nets

~~~js
process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "unhandled rejection");
  process.exit(1);   // crash and let the process manager restart a clean instance
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "uncaught exception");
  process.exit(1);
});
~~~

Why crash? After an unknown error, your process may be in a corrupted state (half-open connections, broken invariants). Restarting is safer than limping on. Docker, Kubernetes or PM2 will restart it automatically.

## Translating low-level errors

Don't let database errors leak upward. Translate them where they happen:

~~~js
try {
  await db.query("INSERT INTO users ...");
} catch (e) {
  if (e.code === "23505") throw new ConflictError("Email already registered"); // Postgres unique violation
  throw e;
}
~~~
`,
    problem: {
      title: "Replace scattered try/catch with a real error-handling system",
      scenario: `You inherited an Express API where every route has its own try/catch. Some return \`{ msg }\`, others \`{ error }\`, others \`{ message }\`. Last week a pentest report flagged that **500 responses include full stack traces with server file paths and SQL queries**. The mobile team also complained they can't tell "not found" from "server down" because both return HTML.`,
      task: `Build (or refactor into) an Express app with a small orders API that has:

1. An error class hierarchy: \`AppError\` → \`NotFoundError\`, \`ValidationError\`, \`ConflictError\` (and any others you need), each with \`statusCode\` and a machine-readable \`code\`.
2. Route handlers that **throw** these errors instead of formatting responses themselves. Include at least one \`async\` handler.
3. A 404 handler for unknown routes.
4. **One** centralized error middleware that:
   - returns \`{ error: { code, message, requestId } }\`
   - hides messages and stack traces of unknown errors in production (\`NODE_ENV=production\`)
   - logs full details server-side
5. A route that deliberately has a bug (e.g. calls \`undefined.foo\`) to prove unknown errors become a safe 500.

**Stretch:** add \`unhandledRejection\` / \`uncaughtException\` handlers and explain why they exit the process.`,
    },
    realWorld: {
      company: "Stripe",
      title: "How Stripe's error responses became the industry standard",
      story: `Stripe's API is widely considered the gold standard for developer experience, and a big part of that is its errors. Every error has the same shape: a \`type\` (e.g. \`card_error\`, \`invalid_request_error\`, \`api_error\`), a machine-readable \`code\` (e.g. \`card_declined\`, \`resource_missing\`), a human \`message\`, the \`param\` that caused it, and a \`request_id\` (also sent as the \`Request-Id\` header) for support.

Because of this, developers can write \`if (err.code === "card_declined")\` instead of parsing English, and Stripe support can find any failed request instantly. Internal details never leak, but debugging is still easy.`,
      takeaway: "Consistent, machine-readable errors with a request id make an API easy to integrate and easy to debug, while keeping internals private.",
    },
  },
};
