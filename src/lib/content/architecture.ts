import type { TopicContent } from "./types";

export const architecture: Record<string, TopicContent> = {
  "project-architecture": {
    lesson: `
## The fat route handler problem

Every Express project starts like this:

~~~js
app.post("/orders", async (req, res) => {
  // validation, auth checks, 3 SQL queries, discount math, stock checks,
  // sending an email, formatting the response... 150 lines
});
~~~

At 10 routes it's fine. At 300 routes and 8 engineers: business rules are duplicated and inconsistent, nothing can be unit tested without spinning up HTTP and a database, and a "simple" change touches 12 files in unpredictable ways.

## Layered architecture

Split responsibilities into layers. **Each layer only talks to the one below it**:

~~~
HTTP request
   │
   ▼
Routes        → map URL + method to a controller (plus middleware: auth, validation)
   │
Controller    → HTTP only: read req, call the service, send res. No business logic.
   │
Service       → BUSINESS RULES: discounts, stock checks, permissions. No req/res!
   │
Repository    → DATA ACCESS: SQL/ORM queries. No business rules.
   │
Database
~~~

### Controller: thin, HTTP-aware

~~~js
export const createOrderController = (orderService) => async (req, res) => {
  const order = await orderService.placeOrder(req.user.id, req.validated);
  res.status(201).location(\`/orders/\${order.id}\`).json(order);
};
~~~

### Service: framework-agnostic business logic

~~~js
export class OrderService {
  constructor({ orderRepo, productRepo, emailQueue }) {   // dependencies are injected
    this.orderRepo = orderRepo;
    this.productRepo = productRepo;
    this.emailQueue = emailQueue;
  }

  async placeOrder(userId, { items, couponCode }) {
    const products = await this.productRepo.findByIds(items.map((i) => i.productId));
    for (const item of items) {
      const p = products.find((x) => x.id === item.productId);
      if (!p) throw new NotFoundError(\`Product \${item.productId}\`);
      if (p.stock < item.quantity) throw new ConflictError(\`\${p.name} is out of stock\`);
    }
    const total = applyDiscount(calculateTotal(items, products), couponCode);   // pure functions
    const order = await this.orderRepo.create({ userId, items, total });
    await this.emailQueue.add("order-confirmation", { orderId: order.id });
    return order;
  }
}
~~~

No \`req\`, no \`res\`, no Express import. So the same service can be called from a REST route, a GraphQL resolver, a CLI script, a queue worker or a test.

### Repository: the only place that knows about the database

~~~js
export class OrderRepository {
  constructor(db) { this.db = db; }
  async create({ userId, items, total }) { /* INSERT ... */ }
  async findById(id) { /* SELECT ... */ }
}
~~~

Swapping Postgres for another store, or adding caching, means changing **one** layer.

## Dependency injection (DI)

Instead of \`import db from "./db"\` deep inside the service, **pass dependencies in** through the constructor. Wire everything together in one place, the **composition root**:

~~~js
// container.js
const db = new pg.Pool({ connectionString: config.DATABASE_URL });
const orderRepo = new OrderRepository(db);
const productRepo = new ProductRepository(db);
export const orderService = new OrderService({ orderRepo, productRepo, emailQueue });
~~~

The payoff is in **tests**: you can pass fakes, with no database needed:

~~~js
const fakeProductRepo = { findByIds: async () => [{ id: 1, name: "Mug", stock: 0, priceCents: 1000 }] };
const service = new OrderService({ orderRepo: {}, productRepo: fakeProductRepo, emailQueue: { add: vi.fn() } });
await expect(service.placeOrder(7, { items: [{ productId: 1, quantity: 1 }] })).rejects.toThrow("out of stock");
~~~

## Folder structure: by feature, not by type

~~~
src/
  modules/
    orders/
      orders.routes.js
      orders.controller.js
      orders.service.js
      orders.repository.js
      orders.schemas.js      ← zod schemas
      orders.service.test.js
    products/
    users/
  shared/
    errors.js  logger.js  middleware/
  config.js
  app.js
  server.js
~~~

Feature folders keep related code together, and they make it easy to extract a module into its own service later.

## Don't overdo it

Layers are a tool, not a religion. A 5-endpoint internal tool doesn't need 4 layers per feature. Introduce structure when the pain appears. But **business rules out of controllers** is worth doing from day one.

## Related ideas you'll hear about

- **Clean / Hexagonal architecture**: the business core doesn't depend on frameworks. Adapters plug in from the outside.
- **Domain-Driven Design (DDD)**: model code around business concepts and boundaries.
- **NestJS**: a Node framework that builds this structure in (modules, controllers, providers, DI).
`,
    problem: {
      title: "Refactor a 120-line route handler into layers",
      scenario: `This is the checkout route of a real-looking codebase. The team wants to add a **"reorder" button** (place the same order again) and a **nightly job** that auto-places subscription orders. Both need the same discount and stock rules, but they're trapped inside this Express handler:`,
      starterCode: `app.post("/api/orders", async (req, res) => {
  try {
    if (!req.headers.authorization) return res.status(401).json({ error: "no auth" });
    const user = jwt.verify(req.headers.authorization.split(" ")[1], "secret");
    const { items, coupon } = req.body;
    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "items required" });

    let total = 0;
    for (const item of items) {
      const { rows } = await pool.query("SELECT * FROM products WHERE id = $1", [item.productId]);
      const product = rows[0];
      if (!product) return res.status(404).json({ error: "product not found" });
      if (product.stock < item.quantity) return res.status(409).json({ error: product.name + " out of stock" });
      total += product.price_cents * item.quantity;
    }

    if (coupon === "SAVE10") total = Math.round(total * 0.9);
    if (coupon === "FREESHIP" && total < 5000) total += 0; else if (total < 5000) total += 499;

    const { rows } = await pool.query(
      "INSERT INTO orders (user_id, total_cents) VALUES ($1, $2) RETURNING *",
      [user.id, total]
    );
    for (const item of items) {
      await pool.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [item.quantity, item.productId]);
    }
    await sendEmail(user.email, "Order confirmed", "Total: " + total);
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});`,
      task: `Refactor into a layered structure (you can use an in-memory DB to keep it runnable):

1. **Routes + middleware**: auth and validation move to middleware.
2. **Controller**: only reads the request and sends the response.
3. **OrderService.placeOrder(userId, { items, coupon })**: all business rules (stock check, totals, coupons, shipping fee). **No req/res, no Express import.**
4. **Repositories** for products and orders: all data access.
5. Pure functions for pricing (\`calculateSubtotal\`, \`applyCoupon\`, \`shippingFee\`).
6. **Dependency injection**: wire everything in one composition root.
7. Write 2–3 **unit tests** for the service using **fake repositories** (e.g. out of stock throws, SAVE10 applies).
8. Briefly show how a \`reorder\` feature or a nightly job would reuse \`OrderService\`.

Note the hidden bugs (the race condition, no transaction, the hardcoded secret). Fix them or list them.`,
    },
    realWorld: {
      company: "Shopify",
      title: "Shopify chose a modular monolith over microservices",
      story: `Shopify's core application is one of the largest Ruby on Rails monoliths in the world, with millions of lines of code and thousands of developers. Instead of splitting it into hundreds of microservices, Shopify's engineering blog ("Deconstructing the Monolith", 2019) describes turning it into a **modular monolith**: code organized into **components** with clear boundaries and public interfaces (checkout, orders, billing...), with tooling that flags code that reaches into another component's internals.

They got most of the benefits of separation (ownership, independent reasoning, testability) without the network calls, distributed transactions and operational overhead of microservices.`,
      takeaway: "Good architecture is about boundaries: HTTP separate from business rules, business rules separate from data access, features separate from each other. You can get there long before you need microservices.",
    },
  },

  "system-design": {
    lesson: `
## Thinking like a senior engineer

Juniors ask "how do I build this endpoint?". Seniors ask "**what happens when things fail, at 100× the traffic?**" System design is about the trade-offs between simplicity, scale, consistency, cost and reliability.

## Monolith vs microservices

| | Monolith (modular) | Microservices |
|---|---|---|
| Deploy | one unit | many independent units |
| Calls | in-process function calls (fast, reliable) | network calls (slow, can fail) |
| Data | one database, real transactions | a database per service, **no cross-service transactions** |
| Team fit | ~1–50 engineers | many teams that need independence |
| Ops cost | low | high (service discovery, tracing, versioning...) |

**Start with a well-structured monolith.** Extract a service when there's a concrete reason: a team needs independent deploys, a component has very different scaling needs, or isolation for reliability or security.

## The network is not reliable

Once you call other services (including Stripe, email providers and your own microservices), every call can **succeed, fail, or time out with an unknown result**. That third case is the dangerous one: *did the payment go through or not?* The client retries, and now you may have charged twice.

## Idempotency keys

The client generates a unique key for each **logical** operation and sends it with every retry:

~~~http
POST /payments
Idempotency-Key: 6f1c2b8e-5d4a-4c1e-9a3b-0e7d1f2a9c44
~~~

Server logic:
1. Look up the key. If there's a **completed** response, **replay it** (same status and body). Don't charge again.
2. If it's **in progress**, return \`409\` (a concurrent duplicate).
3. Otherwise, atomically record the key as in-progress (a unique constraint or \`SET NX\`), do the work, and store the response.
4. Expire keys after ~24h. Reject a reused key with a *different* body (\`422\`).

This is exactly how Stripe makes payment retries safe.

## Event-driven architecture

Instead of one function that does everything synchronously:

~~~js
// ❌ checkout knows about every other concern; if analytics is down, checkout fails
await reserveStock(); await chargeCard(); await sendEmail(); await updateAnalytics(); await notifyWarehouse();
~~~

…the order service **publishes an event**, and other parts **subscribe**:

~~~
OrderPlaced ──► Inventory service (reserve stock)
           ├──► Email service (send confirmation)
           ├──► Analytics (record sale)
           └──► Warehouse (start picking)
~~~

- ✅ Loose coupling: adding a "loyalty points" feature means adding a subscriber, without touching checkout.
- ✅ Resilience: if email is down, events wait in the broker (Kafka, RabbitMQ, SQS/SNS, Redis Streams).
- ❌ **Eventual consistency**: things happen *soon*, not instantly. Harder debugging, so you need tracing.

## Distributed transactions: sagas

With a database per service you can't \`BEGIN ... COMMIT\` across inventory, payments and shipping. A **saga** is a sequence of local transactions, where each step has a **compensating action** that undoes it:

~~~
1. Reserve stock          ↔ compensate: release stock
2. Charge payment         ↔ compensate: refund
3. Create shipment        ↔ compensate: cancel shipment

Payment fails at step 2 → run compensations in reverse → release stock → order = "cancelled"
~~~

## The dual-write problem and the outbox pattern

~~~js
await db.orders.insert(order);              // ✅ committed
await broker.publish("OrderPlaced", order); // 💥 crash here → event lost forever
~~~

**Transactional outbox**: write the event into an \`outbox\` table **in the same DB transaction** as the order. A separate relay process reads the outbox and publishes to the broker, retrying until it succeeds. Consumers must be **idempotent**, because events can arrive more than once.

## A system design checklist

1. **Requirements**: functional (what it does), plus non-functional (requests/sec, latency targets, availability, data size).
2. **API design**: endpoints, payloads, idempotency.
3. **Data model**: SQL vs NoSQL, indexes, what's the source of truth.
4. **High-level components**: load balancer, stateless API servers, DB (+ read replicas), cache, queue, workers, object storage, CDN.
5. **Scaling**: caching, sharding, async processing.
6. **Failure modes**: what if each component is slow or down? Timeouts, retries with backoff, circuit breakers, fallbacks.
7. **Observability and security**.

## Back-of-the-envelope math

1M daily orders ≈ 12 orders/sec on average, with peaks maybe 10× that = 120/sec. Postgres handles that on one machine. Knowing these numbers stops you from over-engineering.
`,
    problem: {
      title: "Capstone: design and build a reliable checkout system",
      scenario: `You're the lead backend engineer for a growing e-commerce company. Last quarter's incidents:
- **Double charges**: mobile apps on flaky networks retried \`POST /payments\` and customers were charged twice
- **Checkout outages**: when the email or analytics service was down, checkout failed entirely
- **Ghost reservations**: stock was reserved, payment failed, and the stock was never released

The CTO asks you to design and prototype a checkout flow that fixes all three.`,
      task: `Build a prototype (in memory is fine, but structure it like production) and write a short design doc:

1. **\`POST /payments\` with \`Idempotency-Key\`**: retries with the same key return the original response and never charge twice. Handle concurrent duplicates (in-progress → 409) and key reuse with a different body (422).
2. **Event-driven checkout**: \`placeOrder\` publishes \`OrderPlaced\`. Separate subscribers (email, analytics, inventory) handle it independently. A failing subscriber must not fail checkout. (An \`EventEmitter\` or a simple in-memory bus is OK.)
3. **Saga with compensation**: reserve stock → charge payment (simulate random failures) → on failure, **release stock** and mark the order cancelled.
4. **Design doc** (in comments or markdown): components, data flow diagram (ASCII is fine), what happens when each component fails, and how the **outbox pattern** would prevent lost events in production.

This is your final project. Make it something you'd proudly show in an interview.`,
    },
    realWorld: {
      company: "Stripe & Amazon Prime Video",
      title: "Idempotency keys, and the team that went back to a monolith",
      story: `**Stripe** popularized idempotency keys for APIs: every POST accepts an \`Idempotency-Key\` header, and Stripe stores the first response for 24 hours so a retry can never create a second charge. Brandur Leach's widely-read post on Stripe's blog, "Designing robust and predictable APIs with idempotency", explains how retries plus idempotency make distributed systems safe.

In 2023, the **Amazon Prime Video** team published a blog post describing how they moved a video-quality monitoring service **from a distributed microservices and serverless design back to a single process** (a monolith), which cut its infrastructure cost by about **90%**. The lesson wasn't "microservices bad". It was that architecture should follow the actual workload.`,
      takeaway: "Design for failure (retries, idempotency, compensation, outbox) and choose architecture from real requirements, not hype. Senior engineers can explain the trade-offs of both.",
    },
  },
};
