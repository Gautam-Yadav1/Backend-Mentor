import type { TopicContent } from "./types";

export const databases: Record<string, TopicContent> = {
  "sql-postgres": {
    lesson: `
## Why relational databases still run the world

Banks, Amazon orders, Shopify stores and GitHub all keep their most important data in **relational databases** (PostgreSQL, MySQL). They give you:
- **Structure**: tables with typed columns
- **Relationships**: foreign keys between tables
- **Integrity**: constraints the database enforces even if your code has bugs
- **Transactions**: all-or-nothing changes (next-next topic)
- **SQL**: a powerful query language that has outlived dozens of trends

PostgreSQL is the default choice for new backends today.

## Core concepts

- **Table** = a collection of rows with the same columns (\`users\`, \`orders\`)
- **Primary key** = the unique id of a row
- **Foreign key** = a column pointing to another table's primary key
- **Constraint** = a rule the database enforces (\`NOT NULL\`, \`UNIQUE\`, \`CHECK\`)
- **Index** = a data structure (usually a B-tree) that makes lookups fast

## Modeling an e-commerce schema

~~~sql
CREATE TABLE users (
  id          BIGSERIAL PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id           BIGSERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
  stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0)
);

CREATE TABLE orders (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','paid','shipped','delivered','cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- many-to-many: an order has many products, a product is in many orders
CREATE TABLE order_items (
  order_id          BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id        BIGINT NOT NULL REFERENCES products(id),
  quantity          INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents  INTEGER NOT NULL,   -- price AT PURCHASE TIME
  PRIMARY KEY (order_id, product_id)
);

CREATE INDEX idx_orders_user_created ON orders (user_id, created_at DESC);
~~~

Key decisions:
- **Money as integer cents**, never floats. \`0.1 + 0.2 = 0.30000000000000004\`.
- **\`unit_price_cents\` is copied into order_items.** If the product's price changes tomorrow, last month's order must still show what the customer actually paid.
- **\`TIMESTAMPTZ\`**: always store timestamps with a time zone (as UTC).
- **\`CHECK\` constraints** are a last line of defense against bugs.

## Relationships

| Type | Example | How |
|---|---|---|
| One-to-many | user → orders | \`orders.user_id\` foreign key |
| Many-to-many | orders ↔ products | join table \`order_items\` |
| One-to-one | user → profile | foreign key + \`UNIQUE\` |

## Essential queries

~~~sql
-- a user's last 10 orders with total price
SELECT o.id, o.status, o.created_at,
       SUM(oi.quantity * oi.unit_price_cents) AS total_cents
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.user_id = $1
GROUP BY o.id
ORDER BY o.created_at DESC
LIMIT 10;
~~~

- \`JOIN\` (inner) returns only matching rows. \`LEFT JOIN\` keeps left rows even without matches.
- \`GROUP BY\` + aggregates (\`SUM\`, \`COUNT\`, \`AVG\`) power reports.

## Indexes: the #1 performance lever

Without an index, \`WHERE user_id = 42\` scans **every row** (a "Seq Scan"). With an index, it's a fast tree lookup. Index the columns you **filter, join and sort** by. A composite index \`(user_id, created_at DESC)\` serves "this user's orders, newest first" perfectly.

Use \`EXPLAIN ANALYZE <query>\` to see what the database actually does.

Indexes aren't free: they slow down writes and use disk space. Don't index everything.

## Querying from Node safely

~~~js
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// ✅ Parameterized: the value is sent separately, so it can never become SQL
const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

// ❌ SQL INJECTION: email = "' OR 1=1 --" dumps the whole table
await pool.query(\`SELECT * FROM users WHERE email = '\${email}'\`);
~~~

Use a **Pool**, not a single client. Opening a connection is expensive, and a pool reuses a fixed number of them.

## Migrations

Never change production schemas by hand. Use migration files that are versioned in git and applied in order (\`node-pg-migrate\`, Prisma Migrate, Knex, Drizzle Kit). Every environment then gets exactly the same schema.
`,
    problem: {
      title: "Design the database for an online store",
      scenario: `You're the first backend engineer at a startup building an online store. The founders currently track orders in a Google Sheet, and it's breaking: prices changed and old orders now show the wrong totals, someone typed quantity "-2", and two customers share the same email.

You need to design the real database before launch.`,
      task: `1. Write SQL (PostgreSQL) for \`users\`, \`products\`, \`orders\` and \`order_items\`:
   - primary keys and foreign keys
   - constraints: unique email, positive quantity, non-negative prices, an allowed set of order statuses
   - money stored safely (integer cents or \`NUMERIC\`)
   - the price at purchase time stored on \`order_items\`
2. Add an index that makes "list a user's orders, newest first" fast, and explain why it works.
3. Write the SQL query for "a user's 10 most recent orders with their totals".
4. Write a Node function \`getUserOrders(userId)\` using \`pg\` with a **parameterized query**.

**Stretch:** write the query for "top 5 best-selling products last month".`,
    },
    realWorld: {
      company: "Instagram",
      title: "Instagram scaled to millions of users on PostgreSQL",
      story: `When Facebook acquired Instagram in 2012, Instagram had over 30 million users and a tiny engineering team, and its core data lived in **PostgreSQL**. Instagram's engineering blog described how they later **sharded** Postgres across many machines and generated unique ids that encode the creation time, so data could be sorted without extra lookups.

They didn't need an exotic database to reach massive scale. They needed a well-designed schema, the right indexes and solid SQL fundamentals.`,
      takeaway: "A good relational schema with proper constraints and indexes takes you remarkably far. Learn SQL deeply. It's the most durable skill in backend development.",
    },
  },

  "orm-prisma": {
    lesson: `
## What an ORM does

An **ORM** (Object-Relational Mapper) lets you work with database rows as objects in your language instead of writing raw SQL strings:

~~~js
// raw SQL
const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
// Prisma
const user = await prisma.user.findUnique({ where: { id } });
~~~

Popular Node ORMs and query builders: **Prisma**, **Drizzle**, **TypeORM**, **Sequelize**, **Knex** (a query builder).

**Pros:** type safety and autocompletion, less boilerplate, migrations included, safe parameterization by default.
**Cons:** it hides the SQL, so it's easy to write accidentally slow code. That's what this topic is about.

## Prisma basics

~~~prisma
// prisma/schema.prisma
model User {
  id           Int     @id @default(autoincrement())
  email        String  @unique
  name         String?
  passwordHash String
  posts        Post[]
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  createdAt DateTime @default(now())
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int

  @@index([authorId])
}
~~~

~~~bash
npx prisma migrate dev --name init   # creates the SQL migration + applies it
npx prisma generate                  # generates the typed client
~~~

~~~js
await prisma.post.create({ data: { title: "Hello", authorId: 1 } });
await prisma.post.findMany({ where: { authorId: 1 }, orderBy: { createdAt: "desc" }, take: 20 });
await prisma.post.update({ where: { id: 5 }, data: { title: "New" } });
await prisma.post.delete({ where: { id: 5 } });
~~~

## The N+1 query problem

The most common ORM performance bug in the world:

~~~js
const posts = await prisma.post.findMany({ take: 50 });          // 1 query
for (const post of posts) {
  post.author = await prisma.user.findUnique({                   // +50 queries!
    where: { id: post.authorId },
  });
}
~~~

**1 query for the list + N queries for each item = N+1.** With 50 posts that's 51 database round trips. At ~2ms each that's 100ms+ of pure waiting, and it grows with every item. On a feed with 1,000 items it's a disaster. It's also invisible in development, where you have 3 rows.

### The fix: load relations in bulk

~~~js
const posts = await prisma.post.findMany({
  take: 50,
  include: { author: true },   // Prisma fetches all authors in one extra query
});
~~~

Even better, **select only what you need**:

~~~js
const posts = await prisma.post.findMany({
  take: 50,
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    title: true,
    createdAt: true,
    author: { select: { id: true, name: true } },   // NOT passwordHash or email!
  },
});
~~~

\`select\` makes the query faster and **prevents leaking sensitive fields**. Returning \`include: { author: true }\` would send every user's \`passwordHash\` to the browser.

### Spotting N+1

- Turn on query logging: \`new PrismaClient({ log: ["query"] })\` and watch for repeated near-identical queries.
- APM tools (Datadog, New Relic, Sentry) flag "N+1 detected".
- Rule of thumb: **an \`await\` on the database inside a loop is a red flag.**

The same problem exists in GraphQL resolvers, where the standard fix is **DataLoader**, which batches many \`load(id)\` calls into one \`WHERE id IN (...)\` query.

## Pagination with Prisma

~~~js
await prisma.post.findMany({
  take: 20,
  skip: cursor ? 1 : 0,                 // skip the cursor row itself
  ...(cursor && { cursor: { id: cursor } }),
  orderBy: { id: "desc" },
});
~~~

## When to drop to raw SQL

Complex reports, window functions and bulk updates are often clearer and faster in SQL. Prisma has \`prisma.$queryRaw\` (it's parameterized when you use the tagged template). A good engineer uses the ORM for 90% of the work and SQL for the other 10%.
`,
    problem: {
      title: "Fix the slow blog feed (N+1)",
      scenario: `The \`GET /api/feed\` endpoint of your company's community blog takes **2.8 seconds**. The database team sees thousands of nearly identical queries per minute: \`SELECT * FROM "User" WHERE id = $1\`. A security engineer also noticed that the feed response contains every author's \`passwordHash\` and \`email\`.

Here's the current code:`,
      starterCode: `// GET /api/feed
app.get("/api/feed", async (req, res) => {
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
  });

  const result = [];
  for (const post of posts) {
    const author = await prisma.user.findUnique({ where: { id: post.authorId } });
    const commentCount = await prisma.comment.count({ where: { postId: post.id } });
    result.push({ ...post, author, commentCount });
  }

  res.json(result);
});`,
      task: `1. Explain **why** this is slow. How many queries run for 500 posts?
2. Rewrite it so the number of queries is **constant** regardless of the number of posts. Use \`include\`/\`select\`, and \`_count\` for comments.
3. Return only the fields the feed needs: post \`id\`, \`title\`, \`createdAt\`, author \`id\` + \`name\`, and \`commentCount\`. **No \`passwordHash\` or \`email\`.**
4. Add cursor pagination (\`take\` + \`cursor\`), 20 per page.
5. Include the Prisma schema you're assuming (User, Post, Comment) with sensible indexes.`,
    },
    realWorld: {
      company: "Shopify",
      title: "Shopify built tools to kill N+1 queries",
      story: `Shopify runs one of the world's largest Ruby on Rails applications, and N+1 queries were a constant performance threat. When they adopted GraphQL, where nested fields make N+1 queries especially easy to write, they open-sourced **graphql-batch**, a library that collects all the ids requested during a query and loads them in a single batched query. Facebook released **DataLoader** for JavaScript to solve the same problem.

The pattern is the same as Prisma's \`include\`: never fetch related data one row at a time inside a loop.`,
      takeaway: "ORMs make N+1 easy to write and hard to see. Log your queries, never await the DB inside a loop, and select only the fields you need.",
    },
  },

  mongodb: {
    lesson: `
## Documents instead of rows

**MongoDB** stores data as **documents**: JSON-like objects (BSON internally) grouped into **collections**. A document can contain nested objects and arrays:

~~~json
{
  "_id": "665f1c...",
  "name": "MacBook Air 13",
  "category": "laptops",
  "price": 99900,
  "attributes": { "ram": "16GB", "storage": "512GB", "chip": "M3" },
  "variants": [
    { "sku": "MBA-SLV-16", "color": "silver", "stock": 12 },
    { "sku": "MBA-GRY-16", "color": "space gray", "stock": 0 }
  ]
}
~~~

There's no fixed schema at the database level, so different documents in the same collection can have different fields.

## SQL vs MongoDB: when to use which

| Choose PostgreSQL when... | Choose MongoDB when... |
|---|---|
| Data is highly relational (orders ↔ users ↔ products) | Data is naturally document-shaped (a product with nested specs) |
| You need complex joins and reports | You mostly read/write whole documents by id |
| Strong consistency and multi-table transactions matter (money!) | Each record has a different shape (catalogs, CMS content, events) |
| The schema is stable | The schema evolves fast |

Many companies use **both**. And Postgres's \`JSONB\` columns give you document-style flexibility inside SQL.

## The most important decision: embed or reference?

**Embed** (nest data inside the parent document) when:
- it's **always read together** with the parent
- it's **bounded** in size (a product has ~10 variants, not 1 million)
- it belongs to the parent and isn't shared

**Reference** (store an id, like a foreign key) when:
- it **grows without limit** (reviews, comments, log events)
- it's shared by many parents
- it's often queried on its own

~~~js
// product: variants are EMBEDDED (bounded, always shown with the product)
// reviews: REFERENCED in their own collection (unbounded, paginated separately)
{ _id: "r1", productId: "665f1c...", rating: 5, text: "Great!", userId: "u9" }
~~~

MongoDB documents have a **16MB limit**. Embedding unbounded arrays (every review ever written) eventually breaks your app, and it gets slow long before that.

## Mongoose: schemas in your app

MongoDB doesn't enforce a schema, so you enforce one in code with **Mongoose**:

~~~js
import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
  { sku: { type: String, required: true }, color: String, size: String, stock: { type: Number, min: 0, default: 0 } },
  { _id: false },
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, index: true },
    price: { type: Number, required: true, min: 0 },     // cents
    attributes: { type: Map, of: String },               // flexible specs
    variants: [variantSchema],
  },
  { timestamps: true },
);

productSchema.index({ category: 1, price: 1 });          // compound index
export const Product = mongoose.model("Product", productSchema);
~~~

## Querying

~~~js
await Product.find({ category: "laptops", price: { $lte: 100000 } })
  .sort({ price: 1 })
  .limit(20)
  .select("name price attributes")
  .lean();                     // returns plain objects, which is faster for reads

await Product.find({ "attributes.ram": "16GB" });       // query nested fields
await Product.updateOne({ _id: id, "variants.sku": sku }, { $inc: { "variants.$.stock": -1 } });
~~~

Operators to know: \`$eq $gt $gte $lt $lte $in $and $or $inc $set $push $pull\`.

## Indexes matter just as much

Without an index, MongoDB scans every document (\`COLLSCAN\`). Use \`.explain("executionStats")\` to check. The **ESR rule** for compound indexes: fields you match on with **E**quality first, then **S**ort fields, then **R**ange fields.

## Watch out for injection

\`User.find({ email: req.body.email })\` looks safe, but if the body is \`{ "email": { "$ne": null } }\` it matches **every user**! Validate that inputs are strings (with Zod) before they reach a query. This is called **NoSQL injection**.
`,
    problem: {
      title: "Model a product catalog with wildly different products",
      scenario: `Your marketplace sells **laptops** (RAM, CPU, screen size), **t-shirts** (sizes S–XL, colors, material) and **books** (author, ISBN, pages). In SQL, the team ended up with a \`products\` table with 60 mostly-NULL columns, and every new category needs a migration.

Product leadership wants new categories to launch **without database migrations**. You've been asked to prototype the catalog in MongoDB.`,
      task: `Using Mongoose:

1. Design a \`Product\` schema that supports different attributes per category (e.g. a flexible \`attributes\` map) plus **variants** (size/color/stock).
2. Decide what to **embed** and what to **reference** for: variants, reviews, seller info. Write a short justification for each.
3. Define indexes for the most common query: "category X, sorted by price".
4. Build \`GET /api/products?category=laptops&attr.ram=16GB&maxPrice=1500\` in Express that filters by category, any attribute and price.
5. Validate query inputs to prevent NoSQL injection (e.g. \`?category[$ne]=x\`).

Seed at least one product from each of the three categories.`,
    },
    realWorld: {
      company: "Craigslist",
      title: "Craigslist moved billions of archived posts to MongoDB",
      story: `Craigslist stored its archive of old postings in MySQL. Because the archive held **billions of rows**, every schema change (like adding a column) required a migration that could take **months** to run across the archive. In 2011 they moved the archive to MongoDB, where documents don't need a fixed schema, so new fields could be added without rewriting old records.

They kept the live, highly transactional site on MySQL. They chose the database that fit each workload, instead of one database for everything.`,
      takeaway: "Pick the data model that matches your access patterns. Documents suit flexible, self-contained records. Relational suits connected, transactional data. Using both is normal.",
    },
  },

  transactions: {
    lesson: `
## The bug that costs real money

~~~js
// ❌ checkout: read, check, write
const product = await db.query("SELECT stock FROM products WHERE id = $1", [id]);
if (product.rows[0].stock < qty) throw new ConflictError("Out of stock");
await db.query("UPDATE products SET stock = stock - $1 WHERE id = $2", [qty, id]);
await db.query("INSERT INTO orders ...");
~~~

Looks fine. Now imagine **one item left** and two customers clicking "Buy" at the same millisecond:

| Time | Request A | Request B |
|---|---|---|
| t1 | reads stock = 1 | |
| t2 | | reads stock = 1 |
| t3 | 1 ≥ 1 ✅ | 1 ≥ 1 ✅ |
| t4 | stock → 0, order created | |
| t5 | | stock → -1, order created 💥 |

You just sold an item you don't have. This is a **race condition**: the result depends on timing. It never shows up when you test alone, and always shows up on Black Friday.

## ACID transactions

A **transaction** groups operations so they behave as one unit:
- **A**tomicity: all or nothing. If anything fails, everything is rolled back.
- **C**onsistency: constraints hold before and after.
- **I**solation: concurrent transactions don't see each other's half-done work.
- **D**urability: once committed, it survives a crash.

~~~js
const client = await pool.connect();      // a transaction must use ONE connection
try {
  await client.query("BEGIN");
  // ... several queries ...
  await client.query("COMMIT");
} catch (err) {
  await client.query("ROLLBACK");
  throw err;
} finally {
  client.release();                       // ALWAYS give the connection back to the pool
}
~~~

Forgetting \`release()\` leaks connections. After 10 leaks your pool is empty and the whole API hangs.

⚠️ **A transaction alone does NOT fix the race above.** Under Postgres's default isolation level (Read Committed), both transactions can still read \`stock = 1\`. You need one of these fixes:

## Fix 1: atomic conditional update (simplest, best)

Let the database do check-and-decrement in **one statement**:

~~~sql
UPDATE products
SET stock = stock - $1
WHERE id = $2 AND stock >= $1
RETURNING stock;
~~~

If \`rowCount === 0\`, there wasn't enough stock and you return 409. The database row lock makes concurrent updates queue up, so the second request sees \`stock = 0\` and updates nothing.

## Fix 2: pessimistic locking (SELECT ... FOR UPDATE)

~~~sql
BEGIN;
SELECT stock FROM products WHERE id = $1 FOR UPDATE;  -- locks the row until COMMIT
-- other transactions trying to lock this row WAIT here
UPDATE products SET stock = stock - $2 WHERE id = $1;
COMMIT;
~~~

Use this when you need to read, run complex logic in code, and then write. Keep these transactions **short**, because everyone else is waiting. Always lock rows in a consistent order to avoid **deadlocks**.

## Fix 3: optimistic locking (version column)

~~~sql
UPDATE products SET stock = $1, version = version + 1
WHERE id = $2 AND version = $3;   -- 0 rows updated = someone else changed it → retry
~~~

Great when conflicts are rare (editing a document, updating a profile).

## Complete checkout = atomic update + transaction

~~~js
await client.query("BEGIN");
const res = await client.query(
  "UPDATE products SET stock = stock - $1 WHERE id = $2 AND stock >= $1",
  [qty, productId],
);
if (res.rowCount === 0) {
  await client.query("ROLLBACK");
  throw new ConflictError("Not enough stock");
}
const order = await client.query("INSERT INTO orders (user_id) VALUES ($1) RETURNING id", [userId]);
await client.query(
  "INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES ($1,$2,$3,$4)",
  [order.rows[0].id, productId, qty, price],
);
await client.query("COMMIT");
~~~

The stock decrement and the order rows now succeed or fail **together**. There's never stock taken without an order, or an order without stock.

## Isolation levels (just know they exist)

Read Committed (Postgres default) → Repeatable Read → Serializable (the strongest; transactions can fail with serialization errors that you then retry). Stronger isolation prevents more anomalies but costs throughput.

## Other places race conditions hide

- Double-clicked "Pay" buttons, which create two charges
- Coupon codes "valid for one use" redeemed twice in parallel
- Bank-style balance updates: \`balance = balance - x\` must be atomic, and never computed in JavaScript and written back
`,
    problem: {
      title: "Stop overselling during a flash sale",
      scenario: `During yesterday's flash sale for a limited sneaker drop (**100 pairs**), your store sold **137 pairs**. Customer support now has to email 37 angry people. The stock column even went negative. A post-mortem traced it to the checkout code:`,
      starterCode: `app.post("/api/checkout", async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.user.id;

  const { rows } = await pool.query(
    "SELECT stock, price_cents FROM products WHERE id = $1",
    [productId],
  );
  const product = rows[0];
  if (!product || product.stock < quantity) {
    return res.status(409).json({ error: "Out of stock" });
  }

  await pool.query("UPDATE products SET stock = $1 WHERE id = $2", [
    product.stock - quantity,
    productId,
  ]);

  const order = await pool.query(
    "INSERT INTO orders (user_id) VALUES ($1) RETURNING id",
    [userId],
  );
  await pool.query(
    "INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents) VALUES ($1, $2, $3, $4)",
    [order.rows[0].id, productId, quantity, product.price_cents],
  );

  res.status(201).json({ orderId: order.rows[0].id });
});`,
      task: `1. Explain step by step how this code oversells under concurrent requests. Also point out what happens if the server crashes between the UPDATE and the INSERT.
2. Rewrite the handler so that:
   - overselling is **impossible** (atomic conditional update or \`SELECT ... FOR UPDATE\`)
   - the stock decrement and the order + order_items inserts happen in **one transaction**, with \`ROLLBACK\` on any failure
   - it returns \`409\` when stock is insufficient
   - the pool client is **always released** (\`finally\`)
3. Add a \`CHECK (stock >= 0)\` constraint as a safety net, and explain why it's not enough by itself.

**Stretch:** describe how you'd load-test this (e.g. 200 parallel requests with \`autocannon\`) to prove the fix.`,
    },
    realWorld: {
      company: "Flexcoin",
      title: "A race condition bankrupted a Bitcoin bank (2014)",
      story: `In March 2014, Flexcoin, a Bitcoin "bank", announced it was **shutting down** after attackers stole about **896 BTC** (worth over $500,000 at the time). The attacker found that withdrawals and transfers used a **read-check-write** flow on account balances: read the balance, check it's sufficient, write the new balance.

By sending **many transfer requests simultaneously**, the attacker got several requests to pass the balance check before any of them updated the balance, moving the same coins multiple times. Around the same time, the Poloniex exchange reported losses from a similar race condition in its withdrawal code.`,
      takeaway: "Any read-then-write on shared state (stock, balances, coupons) is a race condition waiting to happen. Make the check and the write one atomic operation, and wrap related writes in a transaction.",
    },
  },
};
