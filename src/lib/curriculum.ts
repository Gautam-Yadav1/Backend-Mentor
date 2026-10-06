export type QuizQuestion = {
  question: string;
  options: string[];
  /** index into options */
  answer: number;
  explanation: string;
};

export type Topic = {
  slug: string;
  title: string;
  summary: string;
  minutes: number;
  /** progressively revealed hints for the practice problem */
  hints: string[];
  /** what a passing solution must do — used by the AI reviewer and the self-check list */
  criteria: string[];
  quiz: QuizQuestion[];
};

export type Module = {
  id: string;
  title: string;
  description: string;
  topics: Topic[];
};

export const modules: Module[] = [
  {
    id: "foundations",
    title: "Foundations",
    description: "How the web works, and how Node.js runs your JavaScript on a server.",
    topics: [
      {
        slug: "how-the-web-works",
        title: "How the Web Works: HTTP",
        summary: "Clients, servers, requests, responses, methods, headers and status codes.",
        minutes: 35,
        hints: [
          "Start by listing the resources (nouns) the page needs: an order, its items, its shipment.",
          "Pick status codes deliberately: what should happen when the order id doesn't exist? When it belongs to someone else?",
          "Use Node's built-in http module: http.createServer((req, res) => {...}). Check req.method and req.url, then set res.statusCode and the Content-Type header.",
        ],
        criteria: [
          "Server handles GET /orders/:id and returns JSON with Content-Type: application/json",
          "Returns 200 for an existing order, 404 for an unknown order id",
          "Returns 405 (or 404) for unsupported methods/paths instead of hanging",
          "Response body has a clear, consistent shape (e.g. status, items, estimatedDelivery)",
        ],
        quiz: [
          {
            question: "A client requests an order that does not exist. Which status code is most appropriate?",
            options: ["200 OK with an empty body", "400 Bad Request", "404 Not Found", "500 Internal Server Error"],
            answer: 2,
            explanation: "404 tells the client the resource doesn't exist. 500 means the server broke, and 400 means the request itself was malformed.",
          },
          {
            question: "Which HTTP method is meant to be safe (no side effects) and cacheable?",
            options: ["GET", "POST", "PATCH", "DELETE"],
            answer: 0,
            explanation: "GET should only read data. That is why browsers, CDNs and proxies are allowed to cache and retry it.",
          },
          {
            question: "What does the Content-Type response header tell the client?",
            options: ["How long to cache the response", "The format of the body, e.g. application/json", "Which server produced the response", "The user's language"],
            answer: 1,
            explanation: "Content-Type describes the media type of the body so the client knows how to parse it.",
          },
        ],
      },
      {
        slug: "node-fundamentals",
        title: "Node.js Fundamentals & the Event Loop",
        summary: "The runtime, the event loop, modules, npm and why Node is great at I/O.",
        minutes: 40,
        hints: [
          "Read the file with fs.promises.readFile or, better for huge files, readline + fs.createReadStream.",
          "Each log line can be split by spaces. Find the status code field and count it in an object or Map.",
          "Use process.argv[2] to read the file path from the command line.",
        ],
        criteria: [
          "Reads a log file path from the command line (process.argv)",
          "Processes the file line by line (stream/readline) instead of loading it all at once, or justifies why not",
          "Counts requests per status code and prints a readable summary",
          "Handles a missing file gracefully with a clear error message and non-zero exit code",
        ],
        quiz: [
          {
            question: "Why can a single Node.js process handle thousands of concurrent connections?",
            options: ["It creates one thread per request", "It uses non-blocking I/O and an event loop", "It compiles JavaScript to C", "It caches every response"],
            answer: 1,
            explanation: "While waiting on I/O (database, network, disk), Node doesn't block. The event loop runs other callbacks in the meantime.",
          },
          {
            question: "What happens if you run a CPU-heavy loop for 5 seconds inside a request handler?",
            options: ["Only that request is slowed down", "Node automatically moves it to another thread", "Every other request waits, because the event loop is blocked", "Nothing, Node is multi-threaded"],
            answer: 2,
            explanation: "Your JavaScript runs on one main thread. Blocking it freezes the whole server. Use worker threads or a job queue for heavy CPU work.",
          },
          {
            question: "What is package-lock.json for?",
            options: ["Storing environment variables", "Locking the exact dependency tree so installs are reproducible", "Preventing others from editing package.json", "Listing npm scripts"],
            answer: 1,
            explanation: "The lockfile pins exact versions of every dependency, so your laptop, CI and production install the same code.",
          },
        ],
      },
      {
        slug: "async-javascript",
        title: "Async JavaScript: Promises & async/await",
        summary: "Callbacks, promises, async/await, parallelism, timeouts and error handling.",
        minutes: 45,
        hints: [
          "The three calls don't depend on each other, so run them at the same time with Promise.all or Promise.allSettled.",
          "Build a withTimeout(promise, ms) helper with Promise.race and a setTimeout that rejects.",
          "Reviews and recommendations are optional, but product details are required. Decide what to do when each one fails.",
        ],
        criteria: [
          "Fetches product, reviews and recommendations in parallel, not sequentially",
          "Applies a timeout to slow dependencies",
          "Fails the whole request only if the critical dependency (product) fails; degrades gracefully for optional ones",
          "Uses try/catch (or .catch) so no promise rejection goes unhandled",
        ],
        quiz: [
          {
            question: "Three independent API calls take 100ms, 200ms and 300ms. Roughly how long does awaiting Promise.all take?",
            options: ["100ms", "300ms", "600ms", "It depends on the order"],
            answer: 1,
            explanation: "They run concurrently, so total time is about the slowest one (300ms). Awaiting them one after another would take about 600ms.",
          },
          {
            question: "What is the key difference between Promise.all and Promise.allSettled?",
            options: ["allSettled is faster", "Promise.all rejects as soon as one promise rejects; allSettled waits and reports every result", "Promise.all only accepts two promises", "There is no difference"],
            answer: 1,
            explanation: "allSettled is ideal when some failures are acceptable, for example optional page widgets.",
          },
          {
            question: "What happens to an error thrown inside an async function that nobody awaits or catches?",
            options: ["It is silently ignored forever", "It becomes an unhandled promise rejection, which crashes modern Node by default", "It is logged to the database", "It retries automatically"],
            answer: 1,
            explanation: "Since Node 15, unhandled rejections crash the process. Always await or attach .catch.",
          },
        ],
      },
      {
        slug: "node-http-module",
        title: "Building a Server with Node's http Module",
        summary: "What Express does for you under the hood: routing, bodies, streams.",
        minutes: 35,
        hints: [
          "The request body arrives in chunks: listen to req.on('data') and req.on('end'), then JSON.parse the result.",
          "Wrap JSON.parse in try/catch and return 400 for invalid JSON.",
          "Track a running total of the body size and stop with 413 if it exceeds your limit.",
        ],
        criteria: [
          "GET /health returns 200 with a JSON status payload",
          "POST /echo collects the streamed body and returns it parsed as JSON",
          "Invalid JSON returns 400 with a helpful error message",
          "Rejects bodies over a size limit (e.g. 1MB) with 413",
        ],
        quiz: [
          {
            question: "In Node's raw http module, why can't you just read req.body?",
            options: ["Because GET requests have no body", "The body is a stream that arrives in chunks and must be collected", "It is encrypted", "It only works in Express 5"],
            answer: 1,
            explanation: "req is a readable stream. Express body parsers collect the chunks and set req.body for you.",
          },
          {
            question: "Why should a server enforce a maximum request body size?",
            options: ["To make responses faster", "To stop attackers from exhausting memory with huge payloads", "Because HTTP forbids large bodies", "To support caching"],
            answer: 1,
            explanation: "Without a limit, someone can send gigabytes and crash your process. express.json() has a 100kb default limit for this reason.",
          },
          {
            question: "What must every request handler eventually do?",
            options: ["Call process.exit()", "End the response (res.end / res.json), or the client hangs until it times out", "Write to a log file", "Close the server"],
            answer: 1,
            explanation: "A forgotten res.end() leaves the connection open until it times out. This is a classic beginner bug.",
          },
        ],
      },
    ],
  },
  {
    id: "express-core",
    title: "Express Core",
    description: "Routing, middleware, REST design, validation and error handling: the daily bread of backend work.",
    topics: [
      {
        slug: "express-routing",
        title: "Express Basics & Routing",
        summary: "Apps, routers, route params, query strings and organizing routes by feature.",
        minutes: 40,
        hints: [
          "Create an express.Router() for products and mount it with app.use('/api/products', router).",
          "Query values are always strings: convert minPrice and maxPrice with Number() and check for NaN.",
          "For GET /:id, return 404 when the product isn't found.",
        ],
        criteria: [
          "Uses express.Router() to group product routes and mounts them under a prefix",
          "GET /api/products supports filtering by category and min/max price via query string",
          "GET /api/products/:id returns 200 or 404 appropriately",
          "Converts and validates query/params types (strings to numbers) instead of trusting them",
        ],
        quiz: [
          {
            question: "For the URL /products/42?sort=price, where do you read 42 and 'price'?",
            options: ["req.body.id and req.body.sort", "req.params.id and req.query.sort", "req.query.id and req.params.sort", "req.headers"],
            answer: 1,
            explanation: "Path segments defined with :id go to req.params. Everything after ? goes to req.query.",
          },
          {
            question: "What type is req.query.limit when the URL contains ?limit=10?",
            options: ["number", "string", "boolean", "undefined"],
            answer: 1,
            explanation: "Query values are strings (or arrays of strings). Always convert and validate them.",
          },
          {
            question: "Why split routes into multiple Router files?",
            options: ["Express requires it", "It keeps features isolated and maintainable as the codebase grows", "Routers are faster", "To avoid using middleware"],
            answer: 1,
            explanation: "Feature-based routers (users, orders, products) make large codebases easier to navigate and let teams own separate areas.",
          },
        ],
      },
      {
        slug: "middleware",
        title: "Middleware: The Request Pipeline",
        summary: "How req → middleware → handler → res works, ordering, and writing your own.",
        minutes: 40,
        hints: [
          "Use crypto.randomUUID() to generate ids. Reuse an incoming X-Request-Id header if the client sent one.",
          "Record process.hrtime.bigint() at the start and compute duration in res.on('finish').",
          "Register the middleware with app.use before your routes. Order matters!",
        ],
        criteria: [
          "Middleware attaches a request id to req and returns it in an X-Request-Id response header",
          "Reuses a valid incoming X-Request-Id instead of always generating a new one",
          "Logs method, path, status code and duration after the response finishes",
          "Calls next() correctly and is registered before the routes",
        ],
        quiz: [
          {
            question: "What happens if a middleware neither calls next() nor sends a response?",
            options: ["Express calls next automatically", "The request hangs until it times out", "Express returns 404", "The server crashes"],
            answer: 1,
            explanation: "The pipeline stops at that middleware. Each middleware must either pass control on or end the response.",
          },
          {
            question: "Why is res.on('finish') used for logging response time?",
            options: ["It runs before the handler", "It fires once the response has been fully sent, so the status code and duration are known", "It's required by Express", "It catches errors"],
            answer: 1,
            explanation: "The status code is only final once the response is sent, so 'finish' is the right place to log it.",
          },
          {
            question: "How does Express recognize error-handling middleware?",
            options: ["It's named errorHandler", "It has exactly four parameters: (err, req, res, next)", "It's registered with app.error()", "It must be async"],
            answer: 1,
            explanation: "Express checks the function's arity. Four parameters make it an error handler.",
          },
        ],
      },
      {
        slug: "rest-api-design",
        title: "REST API Design & Pagination",
        summary: "Resource naming, verbs, status codes, pagination, filtering and versioning like the pros.",
        minutes: 50,
        hints: [
          "A cursor can simply be the id (or createdAt + id) of the last item returned, base64-encoded.",
          "Fetch limit + 1 items: if you get the extra one, there's a next page.",
          "Cap the limit (e.g. max 100) so nobody can request a million rows.",
        ],
        criteria: [
          "GET /api/v1/orders returns items plus pagination metadata (nextCursor / hasMore)",
          "Implements cursor-based pagination that stays stable when new orders are inserted",
          "Validates and caps the limit parameter",
          "Uses plural resource nouns, correct verbs and correct status codes (201 on create, 204 on delete)",
        ],
        quiz: [
          {
            question: "Which endpoint follows REST conventions for creating an order?",
            options: ["GET /createOrder", "POST /orders", "POST /order/create", "PUT /orders/new"],
            answer: 1,
            explanation: "Use plural nouns for resources and let the HTTP verb express the action.",
          },
          {
            question: "Why do large APIs (Stripe, Slack, Twitter) prefer cursor pagination over offset pagination?",
            options: ["Cursors are easier to implement", "Offsets get slow on deep pages and skip or duplicate items when data changes", "Offsets are not supported by SQL", "Cursors allow random page jumps"],
            answer: 1,
            explanation: "OFFSET 1000000 still scans a million rows, and inserts shift pages. A cursor seeks directly from the last seen item.",
          },
          {
            question: "What status code should a successful DELETE with no response body return?",
            options: ["200", "201", "204", "404"],
            answer: 2,
            explanation: "204 No Content means it succeeded and there is nothing to return.",
          },
        ],
      },
      {
        slug: "validation",
        title: "Input Validation",
        summary: "Never trust the client: schema validation with Zod and consistent 400 responses.",
        minutes: 35,
        hints: [
          "Define the schema once with z.object({...}) and reuse it via a validate(schema) middleware.",
          "Use safeParse so you can turn errors into a clean 400 response instead of throwing.",
          "Normalize data: trim strings and lowercase emails before saving.",
        ],
        criteria: [
          "Defines a schema for the signup body (email, password rules, optional name)",
          "Implements a reusable validate(schema) middleware",
          "Returns 400 with a field-level list of errors on invalid input",
          "Only passes validated/sanitized data to the handler (unknown fields stripped)",
        ],
        quiz: [
          {
            question: "Your frontend already validates the form. Do you still need backend validation?",
            options: ["No, it would be duplicated work", "Yes. Anyone can call your API directly with curl or Postman, bypassing the frontend", "Only for admin endpoints", "Only in production"],
            answer: 1,
            explanation: "Frontend validation is for user experience. Backend validation is for security and data integrity.",
          },
          {
            question: "What is 'mass assignment'?",
            options: ["Assigning many users to a group", "Blindly saving req.body, so attackers can set fields like isAdmin: true", "Bulk inserting rows", "A Zod feature"],
            answer: 1,
            explanation: "Whitelist the fields you accept. Never do db.save(req.body). GitHub had a famous mass-assignment bug in 2012.",
          },
          {
            question: "Which status code best fits a request whose body fails validation?",
            options: ["400 Bad Request (or 422)", "401 Unauthorized", "404 Not Found", "500 Internal Server Error"],
            answer: 0,
            explanation: "The client sent bad data, so it's a 4xx. 400 is most common. Some APIs use 422 Unprocessable Content.",
          },
        ],
      },
      {
        slug: "error-handling",
        title: "Centralized Error Handling",
        summary: "AppError classes, async error propagation, and never leaking stack traces.",
        minutes: 40,
        hints: [
          "Create class AppError extends Error with statusCode and code fields, plus subclasses like NotFoundError.",
          "In Express 5, a rejected promise in an async handler goes to the error middleware automatically. In Express 4 you need an asyncHandler wrapper.",
          "Unknown (non-AppError) errors should be logged in full and returned as a generic 500 message.",
        ],
        criteria: [
          "Defines a custom error class hierarchy with status codes (e.g. AppError, NotFoundError, ValidationError)",
          "Has one centralized error-handling middleware registered after all routes",
          "Async route errors reach the handler (Express 5 behavior or an asyncHandler wrapper)",
          "Hides internal details/stack traces from clients in production while logging them server-side",
          "Includes a 404 handler for unknown routes",
        ],
        quiz: [
          {
            question: "Why not send err.stack to the client?",
            options: ["It's too long", "It leaks internal details such as file paths and libraries that help attackers", "JSON can't encode it", "Browsers block it"],
            answer: 1,
            explanation: "Log stack traces server-side. Clients should get a safe message and maybe a request id for support.",
          },
          {
            question: "What is the difference between operational and programmer errors?",
            options: ["There is none", "Operational errors are expected runtime problems (invalid input, timeouts); programmer errors are bugs (undefined is not a function)", "Programmer errors come from users", "Operational errors only happen in dev"],
            answer: 1,
            explanation: "Handle operational errors gracefully. Programmer errors mean the code is wrong: log, alert and fix them.",
          },
          {
            question: "Where must the error-handling middleware be registered?",
            options: ["Before all routes", "After all routes and other middleware", "Anywhere", "Inside each route"],
            answer: 1,
            explanation: "Express runs middleware in order. The error handler must come last to catch errors from everything above it.",
          },
        ],
      },
    ],
  },
  {
    id: "databases",
    title: "Databases",
    description: "Modeling data, SQL vs NoSQL, ORMs, indexes and transactions: where most backend bugs and slowdowns live.",
    topics: [
      {
        slug: "sql-postgres",
        title: "SQL & PostgreSQL Data Modeling",
        summary: "Tables, relations, joins, constraints, indexes, and querying safely from Node.",
        minutes: 55,
        hints: [
          "You need at least users, products, orders and order_items tables. order_items connects orders and products.",
          "Store the price on order_items at purchase time. Product prices change later!",
          "Think about which columns you filter by (user_id, created_at) and add indexes for them.",
        ],
        criteria: [
          "Schema includes users, products, orders and order_items with primary and foreign keys",
          "Uses constraints (NOT NULL, CHECK quantity > 0, UNIQUE email) to protect data integrity",
          "Stores the unit price on order_items at purchase time",
          "Adds an index that supports 'list a user's orders, newest first'",
          "Node code uses parameterized queries ($1, $2), never string concatenation",
        ],
        quiz: [
          {
            question: "Why use parameterized queries ($1) instead of building SQL with template strings?",
            options: ["They're shorter", "They prevent SQL injection by sending values separately from the SQL text", "They're required by Postgres", "They auto-create indexes"],
            answer: 1,
            explanation: "With string concatenation, input like ' OR 1=1 -- becomes SQL code. Parameters are always treated as data.",
          },
          {
            question: "What does an index on orders(user_id, created_at) speed up?",
            options: ["Inserting orders", "Finding a user's orders sorted by date", "Deleting all orders", "Counting all users"],
            answer: 1,
            explanation: "Indexes make lookups fast at a small cost to writes. Composite index column order matters.",
          },
          {
            question: "Why copy the product price onto the order_items row?",
            options: ["To save storage", "Because product prices change later, and the order must record what was actually charged", "SQL requires it", "For indexing"],
            answer: 1,
            explanation: "Orders are historical records. A later price change must not rewrite past invoices.",
          },
        ],
      },
      {
        slug: "orm-prisma",
        title: "ORMs with Prisma & the N+1 Problem",
        summary: "Schemas, migrations, relations, and avoiding the most common ORM performance bug.",
        minutes: 45,
        hints: [
          "The slow code runs one query for posts, then one more per post for its author. That's N+1.",
          "Prisma's include: { author: true } (or select) loads related rows efficiently.",
          "Only select the fields the response actually needs. Never return password hashes!",
        ],
        criteria: [
          "Identifies the N+1 query pattern in the given code and explains why it's slow",
          "Rewrites it using include/select (or a join) so the query count is constant",
          "Selects only the needed fields and excludes sensitive data such as passwordHash",
          "Adds pagination (take/cursor) to the list query",
        ],
        quiz: [
          {
            question: "Loading 100 posts and then querying each post's author separately makes how many queries?",
            options: ["1", "2", "101", "200"],
            answer: 2,
            explanation: "1 query for posts + 100 for authors = 101. That's the N+1 problem. Use a join/include to make it 1 or 2.",
          },
          {
            question: "What is a database migration?",
            options: ["Moving to a new cloud provider", "A versioned, repeatable script that changes the schema", "A backup", "A query cache"],
            answer: 1,
            explanation: "Migrations are committed to git so every environment applies the same schema changes in the same order.",
          },
          {
            question: "What is a real downside of ORMs?",
            options: ["They can't do relations", "They can hide expensive queries, so you must still understand the SQL they generate", "They don't support Postgres", "They're insecure by default"],
            answer: 1,
            explanation: "ORMs are productive, but you should log and inspect generated queries when performance matters.",
          },
        ],
      },
      {
        slug: "mongodb",
        title: "MongoDB & Document Modeling",
        summary: "When documents beat tables, embedding vs referencing, and Mongoose schemas.",
        minutes: 45,
        hints: [
          "Different product types have different attributes. A flexible 'attributes' sub-document fits this well.",
          "Embed data that is always read together and bounded in size. Reference data that grows without limit (like reviews).",
          "Add an index for the most common query: category + price.",
        ],
        criteria: [
          "Mongoose schema supports products with varying attributes (e.g. laptop specs vs t-shirt sizes)",
          "Makes and explains an embed vs reference decision (e.g. variants embedded, reviews referenced)",
          "Defines indexes for common queries",
          "Implements a query endpoint filtering by category and an attribute",
        ],
        quiz: [
          {
            question: "When is embedding a sub-document usually the right choice?",
            options: ["When the data grows without bound", "When it is always read with the parent and has a bounded size", "Never", "When many documents share it"],
            answer: 1,
            explanation: "Embedding gives one read for the whole object. Unbounded arrays (like millions of reviews) hit the 16MB document limit.",
          },
          {
            question: "Which use case fits MongoDB's document model well?",
            options: ["Double-entry banking ledger", "Product catalog with very different attributes per category", "Highly relational data with many joins", "Strict multi-table transactions everywhere"],
            answer: 1,
            explanation: "Flexible schemas shine when entities vary in shape. Ledgers and heavily relational data usually fit SQL better.",
          },
          {
            question: "Does 'schemaless' mean you don't need to think about schema?",
            options: ["Yes", "No. The schema moves into your application code (e.g. Mongoose), and you still need to design for your queries", "Only in development", "Only for small apps"],
            answer: 1,
            explanation: "In MongoDB you design for your access patterns. A poorly designed document model is as painful as a bad SQL schema.",
          },
        ],
      },
      {
        slug: "transactions",
        title: "Transactions & Race Conditions",
        summary: "ACID, isolation, row locking and atomic updates: never oversell inventory.",
        minutes: 50,
        hints: [
          "The bug: two requests both read stock = 1, both see 'enough', and both decrement. Read-then-write is racy.",
          "Fix 1: an atomic conditional update: UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1. Check rowCount.",
          "Wrap the stock update and order creation in one transaction (BEGIN/COMMIT/ROLLBACK) so you never get half an order.",
        ],
        criteria: [
          "Explains the race condition in the read-then-write checkout code",
          "Prevents overselling via an atomic conditional update or SELECT ... FOR UPDATE",
          "Creates the order and decrements stock inside a single transaction with ROLLBACK on failure",
          "Returns a clear 409 (or similar) response when stock is insufficient",
          "Always releases the DB client (finally block)",
        ],
        quiz: [
          {
            question: "What does the 'A' in ACID guarantee?",
            options: ["Availability", "Atomicity: all operations in the transaction happen, or none do", "Authentication", "Asynchrony"],
            answer: 1,
            explanation: "If the order insert fails after the stock decrement, atomicity rolls back the decrement too.",
          },
          {
            question: "Two checkout requests read stock=1 at the same time and both succeed. What is this bug called?",
            options: ["Memory leak", "Race condition (lost update)", "N+1 query", "Deadlock"],
            answer: 1,
            explanation: "Concurrent read-modify-write without locking or atomic updates causes lost updates and overselling.",
          },
          {
            question: "Why put client.release() in a finally block?",
            options: ["It's faster", "So the connection returns to the pool even if an error is thrown; otherwise the pool runs out and the app hangs", "Postgres requires it", "To commit the transaction"],
            answer: 1,
            explanation: "Leaked connections are a classic production outage: everything works until the pool is exhausted.",
          },
        ],
      },
    ],
  },
  {
    id: "auth-security",
    title: "Auth & Security",
    description: "Authentication, authorization and defending your API against real attacks.",
    topics: [
      {
        slug: "authentication",
        title: "Authentication: Passwords, Sessions & JWT",
        summary: "Hashing with bcrypt, sessions vs JWTs, access + refresh tokens done right.",
        minutes: 55,
        hints: [
          "Hash with bcrypt.hash(password, 12). Compare with bcrypt.compare. Never store plain text.",
          "Return the same error for 'unknown email' and 'wrong password' so attackers can't discover which emails exist.",
          "Short-lived access token (~15m) in memory or the Authorization header. Long-lived refresh token in an httpOnly, secure cookie.",
        ],
        criteria: [
          "Register hashes passwords with bcrypt/argon2 (never stores plain text)",
          "Login returns a generic error that doesn't reveal whether the email exists",
          "Issues a short-lived access token and a longer-lived refresh token (httpOnly cookie)",
          "Has an auth middleware that verifies the token and attaches the user to req",
          "Secrets come from environment variables, not hardcoded",
        ],
        quiz: [
          {
            question: "Why use bcrypt instead of SHA-256 for passwords?",
            options: ["SHA-256 is insecure for everything", "bcrypt is deliberately slow and salted, which makes brute-forcing leaked hashes very expensive", "bcrypt is reversible", "bcrypt is shorter"],
            answer: 1,
            explanation: "Fast hashes let attackers try billions of guesses per second. Slow, salted hashes make that impractical.",
          },
          {
            question: "Are JWT payloads encrypted?",
            options: ["Yes, always", "No. They are signed (tamper-proof) but anyone can base64-decode and read them", "Only in production", "Only the header"],
            answer: 1,
            explanation: "Never put secrets or sensitive personal data in a JWT payload.",
          },
          {
            question: "Why store the refresh token in an httpOnly cookie?",
            options: ["Cookies are faster", "JavaScript can't read httpOnly cookies, so XSS attacks can't steal the token", "It's required by JWT", "To share it across sites"],
            answer: 1,
            explanation: "Add Secure and SameSite flags too. localStorage is readable by any script that runs on your page.",
          },
        ],
      },
      {
        slug: "authorization",
        title: "Authorization: RBAC & Ownership",
        summary: "Who can do what: roles, permissions, and the IDOR bug that leaks millions of records.",
        minutes: 40,
        hints: [
          "Write requireRole('admin') as a middleware factory: a function that returns middleware.",
          "Being logged in isn't enough. Check that order.userId === req.user.id, or that the user is an admin.",
          "Return 404 instead of 403 for other users' resources so attackers can't confirm they exist.",
        ],
        criteria: [
          "Implements a requireRole/permission middleware factory",
          "Enforces ownership: users can only read/modify their own orders",
          "Admins/support can access any order (role-based exception)",
          "Distinguishes 401 (not authenticated) from 403/404 (not allowed)",
        ],
        quiz: [
          {
            question: "User A requests GET /orders/123, which belongs to user B, and gets it. What is this vulnerability?",
            options: ["XSS", "IDOR / broken object-level authorization", "CSRF", "SQL injection"],
            answer: 1,
            explanation: "IDOR is #1 on the OWASP API Security Top 10. Always check ownership, not just login.",
          },
          {
            question: "What does 401 mean compared to 403?",
            options: ["They're identical", "401: we don't know who you are. 403: we know who you are, but you're not allowed", "401 is for admins", "403 means not found"],
            answer: 1,
            explanation: "401 = authentication problem. 403 = authorization problem.",
          },
          {
            question: "Where should authorization checks live?",
            options: ["Only in the frontend (hide buttons)", "On the server, for every protected operation", "In the database only", "In the JWT"],
            answer: 1,
            explanation: "Hiding a button is UX, not security. Attackers call your API directly.",
          },
        ],
      },
      {
        slug: "api-security",
        title: "API Security Hardening (OWASP)",
        summary: "Helmet, CORS, rate limits, injection, secrets and the OWASP API Top 10.",
        minutes: 45,
        hints: [
          "helmet() sets safe headers. cors({ origin: [...allowlist] }) instead of origin: '*' with credentials.",
          "Apply a strict rate limit to /auth/login specifically, not just a global one.",
          "Look for the hardcoded secret, the string-built SQL query and the stack trace leaking in the starter code.",
        ],
        criteria: [
          "Adds security headers (helmet) and a restrictive CORS allowlist",
          "Fixes the SQL injection with parameterized queries",
          "Moves hardcoded secrets to environment variables",
          "Adds stricter rate limiting on login and a body size limit",
          "Stops leaking stack traces/internal errors to clients",
        ],
        quiz: [
          {
            question: "What does CORS actually protect?",
            options: ["Your server from all attackers", "Browsers from letting malicious websites read responses from your API using a user's credentials", "Against SQL injection", "Against DDoS"],
            answer: 1,
            explanation: "CORS is browser-enforced. curl ignores it, so it doesn't replace authentication.",
          },
          {
            question: "The 2017 Equifax breach (147M people) happened mainly because of…",
            options: ["A weak password", "An unpatched known vulnerability in a web framework dependency (Apache Struts)", "A phishing email", "A DDoS attack"],
            answer: 1,
            explanation: "Keep dependencies patched: npm audit, Dependabot, Renovate.",
          },
          {
            question: "Where should API keys and DB passwords live?",
            options: ["Hardcoded in source", "In environment variables / a secrets manager, never committed to git", "In the frontend bundle", "In a README"],
            answer: 1,
            explanation: "Bots scan GitHub for leaked keys within minutes of a push.",
          },
        ],
      },
    ],
  },
  {
    id: "performance-scaling",
    title: "Performance & Scaling",
    description: "Caching, rate limiting, background jobs and files: the patterns behind every big website.",
    topics: [
      {
        slug: "caching-redis",
        title: "Caching with Redis",
        summary: "Cache-aside, TTLs, invalidation and cache stampedes.",
        minutes: 50,
        hints: [
          "Cache-aside: try redis.get(key). On a miss, load from the DB, then redis.set(key, value, { EX: ttl }).",
          "When a product is updated, delete (invalidate) its cache key.",
          "Stampede protection: hold a short lock (SET key NX EX 5) so only one request rebuilds the cache.",
        ],
        criteria: [
          "Implements cache-aside for GET /products/:id with a TTL",
          "Invalidates (or updates) the cache when the product changes",
          "Uses consistent, namespaced cache keys (e.g. product:v1:123)",
          "Handles Redis being down by falling back to the DB instead of failing the request",
          "Mentions or implements protection against cache stampede",
        ],
        quiz: [
          {
            question: "In the cache-aside pattern, who populates the cache?",
            options: ["The database automatically", "The application, after a cache miss", "The CDN", "Redis itself"],
            answer: 1,
            explanation: "The app checks the cache, falls back to the DB on a miss, and writes the result back to the cache.",
          },
          {
            question: "What is a cache stampede?",
            options: ["Too many keys in Redis", "A popular key expires and thousands of requests hit the DB at the same moment to rebuild it", "Redis crashing", "Slow network"],
            answer: 1,
            explanation: "Mitigations: locks, request coalescing, staggered TTLs, or serving stale data while refreshing.",
          },
          {
            question: "Why does every cached key need a TTL?",
            options: ["Redis requires it", "It limits how stale data can get and stops memory growing forever", "It makes reads faster", "For security"],
            answer: 1,
            explanation: "Even with invalidation, a TTL is your safety net against bugs that forget to invalidate.",
          },
        ],
      },
      {
        slug: "rate-limiting",
        title: "Rate Limiting Algorithms",
        summary: "Fixed window, sliding window and token bucket, and 429 with Retry-After.",
        minutes: 45,
        hints: [
          "Token bucket: each client has tokens. Refill at R tokens/second up to capacity C. Each request costs 1 token.",
          "You don't need a timer: compute the refill lazily from the time elapsed since the last request.",
          "On rejection send 429 with Retry-After plus X-RateLimit-Limit and X-RateLimit-Remaining headers.",
        ],
        criteria: [
          "Implements a token bucket (or sliding window) limiter as Express middleware",
          "Identifies clients by API key or user id, falling back to IP",
          "Returns 429 with Retry-After and rate-limit headers",
          "Explains why in-memory state breaks with multiple server instances and how Redis fixes it",
        ],
        quiz: [
          {
            question: "What problem does a fixed-window limiter (100 req/minute) have?",
            options: ["It's too slow", "Bursts at window edges: 100 requests at 0:59 and 100 at 1:00 means 200 in 2 seconds", "It can't count", "It needs a database"],
            answer: 1,
            explanation: "Sliding windows and token buckets smooth this out.",
          },
          {
            question: "Which status code signals 'too many requests'?",
            options: ["403", "429", "503", "418"],
            answer: 1,
            explanation: "429 Too Many Requests, ideally with a Retry-After header.",
          },
          {
            question: "Why doesn't an in-memory limiter work with 5 server instances behind a load balancer?",
            options: ["Memory is too small", "Each instance counts separately, so a client effectively gets 5x the limit", "Load balancers block it", "It works fine"],
            answer: 1,
            explanation: "Use shared storage (Redis) so all instances see the same counters.",
          },
        ],
      },
      {
        slug: "background-jobs",
        title: "Background Jobs & Queues",
        summary: "Moving slow work out of the request: BullMQ, retries, backoff and idempotency.",
        minutes: 50,
        hints: [
          "The API should only add a job (queue.add) and respond immediately with 202 Accepted.",
          "Configure attempts: 5 and backoff: { type: 'exponential', delay: 1000 }.",
          "Use the orderId as the jobId so the same email is never queued twice (idempotency).",
        ],
        criteria: [
          "API enqueues the work and responds quickly instead of doing slow work inline",
          "A separate worker processes jobs",
          "Configures retries with exponential backoff",
          "Makes the job idempotent (e.g. jobId = orderId or a 'sent' check) so retries don't double-send",
          "Handles permanently failed jobs (logging / dead-letter)",
        ],
        quiz: [
          {
            question: "Why move 'send confirmation email' out of the checkout request?",
            options: ["Emails are illegal in requests", "The email provider may be slow or down; the user shouldn't wait or see checkout fail because of it", "Queues are cheaper", "To use more servers"],
            answer: 1,
            explanation: "Keep request paths fast and resilient. Do slow, failure-prone side effects asynchronously.",
          },
          {
            question: "What does 'idempotent job' mean?",
            options: ["It runs only once a day", "Running it multiple times has the same effect as running it once", "It never fails", "It has no inputs"],
            answer: 1,
            explanation: "Queues deliver at-least-once, so retries happen. Idempotency stops customers getting 3 copies of the same email.",
          },
          {
            question: "Why exponential backoff instead of retrying immediately?",
            options: ["It's easier", "It gives a struggling dependency time to recover instead of hammering it", "Queues require it", "It's faster"],
            answer: 1,
            explanation: "Immediate retries can turn a small outage into a big one. Adding jitter helps too.",
          },
        ],
      },
      {
        slug: "file-uploads",
        title: "File Uploads & Object Storage",
        summary: "Multer, streaming, validation, and S3 presigned URLs for scale.",
        minutes: 40,
        hints: [
          "Use multer with limits: { fileSize: 5 * 1024 * 1024 } and a fileFilter checking the mimetype.",
          "Don't trust the original filename. Generate your own with crypto.randomUUID().",
          "For scale, let the client upload directly to S3 using a presigned URL your API generates.",
        ],
        criteria: [
          "Accepts an image upload with a file size limit",
          "Validates file type with an allowlist (and ideally checks magic bytes)",
          "Generates safe server-side file names (no user-controlled paths)",
          "Explains or implements the presigned URL flow for direct-to-storage uploads",
        ],
        quiz: [
          {
            question: "Why not save uploaded files with the user-provided filename?",
            options: ["Filenames are too long", "Names like ../../etc/passwd cause path traversal, and duplicate names overwrite files", "It's slower", "Windows doesn't allow it"],
            answer: 1,
            explanation: "Always generate your own name and store the original only as metadata.",
          },
          {
            question: "What is the benefit of S3 presigned upload URLs?",
            options: ["Files are encrypted twice", "Clients upload directly to storage, so your API servers don't carry gigabytes of traffic", "They're free", "They skip validation"],
            answer: 1,
            explanation: "Your API just signs a short-lived URL. S3 does the heavy lifting.",
          },
          {
            question: "Is checking the file extension enough to validate an image?",
            options: ["Yes", "No. Extensions and Content-Type are client-controlled; inspect the file's magic bytes", "Only for PNG", "Only on Linux"],
            answer: 1,
            explanation: "Anyone can rename malware.exe to cat.png.",
          },
        ],
      },
    ],
  },
  {
    id: "production",
    title: "Production Readiness",
    description: "Testing, observability, deployment and real-time features: shipping code that survives real traffic.",
    topics: [
      {
        slug: "testing",
        title: "Testing APIs: Unit & Integration",
        summary: "Vitest/Jest + Supertest, test structure, mocking, and what to test.",
        minutes: 45,
        hints: [
          "Export the Express app separately from app.listen() so Supertest can import it without opening a port.",
          "Test the happy path AND the failure paths: 400 validation, 401 no token, 404 not found.",
          "Use beforeEach to reset in-memory data so tests don't depend on each other.",
        ],
        criteria: [
          "App is exported separately from the server listen call for testability",
          "Integration tests with Supertest cover success and error status codes",
          "At least one pure unit test for business logic (e.g. price calculation)",
          "Tests are isolated (state reset between tests) and have descriptive names",
        ],
        quiz: [
          {
            question: "What does an integration test with Supertest verify?",
            options: ["A single function in isolation", "The whole HTTP pipeline (routing, middleware, validation, handler, response) working together", "The UI", "Database performance"],
            answer: 1,
            explanation: "Unit tests check logic. Integration tests check that the pieces connect correctly.",
          },
          {
            question: "Why separate app.js (the app) from server.js (app.listen)?",
            options: ["Express requires it", "Tests can import the app without starting a real server on a port", "It's faster in production", "For TypeScript"],
            answer: 1,
            explanation: "This also helps with graceful shutdown and serverless deployments.",
          },
          {
            question: "Should tests share mutable state?",
            options: ["Yes, it's faster", "No. Shared state makes tests order-dependent and flaky", "Only in CI", "Only for databases"],
            answer: 1,
            explanation: "Each test should set up what it needs. Flaky tests destroy trust in the test suite.",
          },
        ],
      },
      {
        slug: "logging-monitoring",
        title: "Logging, Metrics & Health Checks",
        summary: "Structured logs with pino, metrics, liveness/readiness, and debugging production.",
        minutes: 40,
        hints: [
          "pino outputs JSON logs. Use a child logger per request: req.log = logger.child({ requestId }).",
          "Liveness: is the process alive? Readiness: can it serve traffic right now (DB reachable)?",
          "Redact sensitive fields: pino's redact: ['req.headers.authorization', '*.password'].",
        ],
        criteria: [
          "Uses structured (JSON) logging with levels instead of console.log",
          "Includes a request id in every log line for that request",
          "Redacts secrets/PII (passwords, auth headers) from logs",
          "Implements /health/live and /health/ready (ready checks dependencies)",
        ],
        quiz: [
          {
            question: "Why structured JSON logs instead of console.log('user ' + id + ' failed')?",
            options: ["JSON is smaller", "Log tools (Datadog, ELK, CloudWatch) can search, filter and aggregate fields like userId or status", "console.log is deprecated", "For security"],
            answer: 1,
            explanation: "When there are millions of lines, you need queries like status>=500 AND route='/checkout'.",
          },
          {
            question: "What is the difference between liveness and readiness probes?",
            options: ["None", "Liveness: should the process be restarted? Readiness: should it receive traffic right now?", "Readiness is for databases only", "Liveness checks the DB"],
            answer: 1,
            explanation: "If the DB is briefly down, the app isn't ready, but restarting it won't help, so liveness stays OK.",
          },
          {
            question: "Which should NEVER be logged?",
            options: ["Request ids", "Status codes", "Passwords and full auth tokens", "Response times"],
            answer: 2,
            explanation: "Logs are widely accessible and kept for a long time. Twitter (2018) and GitHub (2018) both had to reset passwords after accidentally logging them.",
          },
        ],
      },
      {
        slug: "deployment",
        title: "Config, Docker & Graceful Shutdown",
        summary: "12-factor config, containerizing Node apps, clustering and zero-downtime deploys.",
        minutes: 45,
        hints: [
          "Listen for SIGTERM. Call server.close() to stop accepting new connections and let in-flight requests finish.",
          "After the server closes, close DB pools/Redis, then process.exit(0). Add a force-exit timeout of about 10s.",
          "Validate required env vars at startup and crash early if something is missing.",
        ],
        criteria: [
          "Loads and validates configuration from environment variables at startup (fail fast)",
          "Handles SIGTERM/SIGINT with graceful shutdown (stop accepting, finish in-flight requests)",
          "Closes resources (DB/Redis) and has a forced-exit timeout",
          "Provides a production Dockerfile (small base image, non-root user, npm ci --omit=dev)",
        ],
        quiz: [
          {
            question: "During a deploy, Kubernetes sends your pod SIGTERM. What should the app do?",
            options: ["Exit immediately", "Stop accepting new requests, finish in-flight ones, close connections, then exit", "Ignore it", "Restart itself"],
            answer: 1,
            explanation: "Without graceful shutdown, every deploy kills in-flight requests and users see errors.",
          },
          {
            question: "Why should configuration come from environment variables?",
            options: ["They're faster", "The same build can run in dev, staging and prod with different config, and no secrets live in code", "Docker requires it", "They're encrypted"],
            answer: 1,
            explanation: "This is factor III of the Twelve-Factor App: store config in the environment.",
          },
          {
            question: "How can a single Node app use all 8 CPU cores?",
            options: ["It does automatically", "Run multiple processes (cluster module, PM2, or multiple containers)", "Increase the heap size", "Use async/await"],
            answer: 1,
            explanation: "One Node process runs your JS on one core. Scale out with more processes.",
          },
        ],
      },
      {
        slug: "websockets",
        title: "Real-time with WebSockets",
        summary: "Socket.IO, rooms, auth on connect, and scaling real-time across servers.",
        minutes: 45,
        hints: [
          "Each order gets a room: socket.join(`order:${orderId}`). Emit updates only to that room.",
          "Authenticate in io.use((socket, next) => ...) using the token from socket.handshake.auth.",
          "Check that the user owns the order before letting them join its room. Authorization again!",
        ],
        criteria: [
          "Authenticates socket connections during the handshake",
          "Uses rooms so clients only receive updates for orders they're allowed to see",
          "Emits status updates when the order changes (e.g. from a REST endpoint or job)",
          "Explains how to scale across multiple servers (Redis adapter / pub-sub)",
        ],
        quiz: [
          {
            question: "Why use WebSockets instead of polling GET /orders/1 every second?",
            options: ["WebSockets are more secure", "The server pushes updates instantly over one connection, avoiding thousands of wasteful requests", "Polling is not allowed", "WebSockets use less code"],
            answer: 1,
            explanation: "Polling wastes resources and adds latency. Server-Sent Events are a simpler alternative for one-way updates.",
          },
          {
            question: "With 3 Socket.IO servers, a user on server A must get an event emitted on server B. What is needed?",
            options: ["Nothing", "A shared pub/sub layer such as the Redis adapter to broadcast between servers", "Sticky sessions only", "A bigger server"],
            answer: 1,
            explanation: "Each server only knows its own sockets. Pub/sub fans events out to all of them.",
          },
          {
            question: "Where should you authenticate a WebSocket connection?",
            options: ["On every message only", "During the connection handshake (middleware), then authorize per room/action", "Never, sockets are private", "In the frontend"],
            answer: 1,
            explanation: "Reject unauthenticated connections early and still check permissions for sensitive actions.",
          },
        ],
      },
    ],
  },
  {
    id: "architecture",
    title: "Architecture & System Design",
    description: "Thinking like a senior engineer: structure, services, events and designing for failure.",
    topics: [
      {
        slug: "project-architecture",
        title: "Layered Architecture: Controllers, Services, Repositories",
        summary: "Structuring a real Express codebase so it stays maintainable at 100k lines.",
        minutes: 45,
        hints: [
          "Controllers deal only with HTTP (req/res). Services contain business rules. Repositories talk to the DB.",
          "The service must not import express or touch req/res, so you can reuse it from a job or a CLI.",
          "Inject the repository into the service (a constructor parameter) so tests can pass a fake.",
        ],
        criteria: [
          "Splits the fat route handler into controller, service and repository layers",
          "Business rules (discount, stock check) live in the service, with no req/res there",
          "Data access is isolated in a repository",
          "Uses dependency injection so the service can be unit tested with a fake repository",
        ],
        quiz: [
          {
            question: "Where should the rule 'orders over $100 get free shipping' live?",
            options: ["In the route handler", "In the service (business logic) layer", "In the database", "In middleware"],
            answer: 1,
            explanation: "Business rules belong in services so they are reusable and testable without HTTP.",
          },
          {
            question: "What is the main benefit of a repository layer?",
            options: ["Faster queries", "It isolates data access, so you can change the DB/ORM or fake it in tests without touching business logic", "It's required by Express", "Security"],
            answer: 1,
            explanation: "Separation of concerns: each layer has one reason to change.",
          },
          {
            question: "Why should services not depend on req/res?",
            options: ["Express forbids it", "So the same logic works from HTTP, queue workers, CLIs and tests", "Performance", "TypeScript requires it"],
            answer: 1,
            explanation: "Coupling business logic to HTTP is a common reason codebases become hard to change.",
          },
        ],
      },
      {
        slug: "system-design",
        title: "Microservices, Events & System Design (Capstone)",
        summary: "Monolith vs microservices, event-driven design, idempotency keys and sagas.",
        minutes: 60,
        hints: [
          "Accept an Idempotency-Key header on POST /payments. Store key → response, and replay it on retry.",
          "Publish an OrderPlaced event. Inventory, email and analytics subscribe independently.",
          "If payment fails after stock was reserved, run a compensating action (release stock). That's a saga.",
        ],
        criteria: [
          "Implements Idempotency-Key handling so retried payment requests don't double-charge",
          "Uses an event (e.g. OrderPlaced) with separate subscribers instead of one giant synchronous function",
          "Handles failure with a compensating action (saga) or explains the outbox pattern",
          "Includes a short written design: components, data flow, and failure scenarios",
        ],
        quiz: [
          {
            question: "A mobile client times out on POST /payments and retries. How do you avoid charging twice?",
            options: ["Tell users not to retry", "Idempotency keys: the server stores the result per key and returns it again for retries", "Use GET instead", "Add a captcha"],
            answer: 1,
            explanation: "Stripe popularized this pattern. Every payment API needs it.",
          },
          {
            question: "When should a startup choose microservices over a monolith?",
            options: ["Always, from day one", "Usually only when team size and scaling needs justify the operational cost; a well-structured monolith is a great start", "Never", "When using Node.js"],
            answer: 1,
            explanation: "Shopify still runs a huge modular monolith. Microservices solve organizational scaling but add network and ops complexity.",
          },
          {
            question: "What is a saga?",
            options: ["A long log file", "A sequence of local transactions across services with compensating actions if a step fails", "A database type", "A JavaScript framework"],
            answer: 1,
            explanation: "Distributed transactions are hard. Sagas give eventual consistency with explicit undo steps.",
          },
        ],
      },
    ],
  },
];

export type FlatTopic = Topic & {
  index: number;
  moduleId: string;
  moduleTitle: string;
};

export const allTopics: FlatTopic[] = modules.flatMap((m) =>
  m.topics.map((t) => ({ ...t, moduleId: m.id, moduleTitle: m.title, index: 0 })),
).map((t, index) => ({ ...t, index }));

export function getTopic(slug: string): FlatTopic | undefined {
  return allTopics.find((t) => t.slug === slug);
}

export function getNeighbors(slug: string) {
  const t = getTopic(slug);
  if (!t) return { prev: undefined, next: undefined };
  return { prev: allTopics[t.index - 1], next: allTopics[t.index + 1] };
}
