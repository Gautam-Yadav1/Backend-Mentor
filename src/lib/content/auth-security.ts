import type { TopicContent } from "./types";

export const authSecurity: Record<string, TopicContent> = {
  authentication: {
    lesson: `
## Authentication vs authorization

- **Authentication (AuthN)**: *who are you?* (login)
- **Authorization (AuthZ)**: *what are you allowed to do?* (next topic)

## Storing passwords: never, ever in plain text

If your database leaks (and many do), plain-text passwords give attackers access to your users' email, bank and every other site where they reused the password.

**Hashing** is a one-way function: you can turn a password into a hash, but not back. At login you hash the attempt and compare.

But not just any hash:
- ❌ **MD5 / SHA-1 / SHA-256** are designed to be *fast*. GPUs can try billions of guesses per second.
- ❌ **Unsalted hashes**: identical passwords give identical hashes, so one precomputed "rainbow table" cracks millions of them.
- ✅ **bcrypt, scrypt, argon2** are deliberately **slow** (tunable "cost") and automatically **salted** (random data mixed into each hash).

~~~js
import bcrypt from "bcrypt";

const hash = await bcrypt.hash(password, 12);          // cost 12 ≈ 250ms, async = doesn't block
const ok = await bcrypt.compare(attempt, user.passwordHash);
~~~

## Login without leaking information

~~~js
const user = await users.findByEmail(email);
const ok = user && (await bcrypt.compare(password, user.passwordHash));
if (!ok) throw new UnauthorizedError("Invalid email or password");   // same message either way
~~~

Saying "no account with that email" lets attackers **enumerate** which emails are registered. Also rate-limit login (you'll do that in the API security topic).

## Staying logged in: sessions vs tokens

HTTP is stateless, so after login the client must prove who it is on **every** request.

### Option A: server-side sessions
1. On login, the server creates a session \`{ userId }\` in a store (Redis/DB) with a random id.
2. It sends the id in a cookie: \`Set-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax\`.
3. On each request, it looks up the session by id.

✅ Instant logout and revocation, and the cookie holds no data. ❌ Needs a lookup on every request in a shared store.

### Option B: JWT (JSON Web Token)
A JWT is a signed, base64-encoded JSON payload: \`header.payload.signature\`.

~~~js
import jwt from "jsonwebtoken";

const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "15m" });
const payload = jwt.verify(token, process.env.JWT_SECRET);   // throws if tampered or expired
~~~

✅ Stateless: any server can verify it without a DB lookup. ❌ **You can't revoke it** before it expires. ❌ The payload is only *encoded*, not encrypted. Anyone can read it, so never put secrets in it.

### The production pattern: access + refresh tokens

- **Access token**: a short-lived JWT (5–15 min), sent as \`Authorization: Bearer <token>\`. If stolen, it's useful for minutes.
- **Refresh token**: a long-lived (days), random token stored **in the DB** and sent as an **\`HttpOnly; Secure; SameSite\`** cookie. JavaScript can't read it, which protects it from XSS. It's used only on \`POST /auth/refresh\` to get a new access token.
- **Rotation**: every refresh issues a new refresh token and invalidates the old one. If an old one is reused, assume theft and revoke the whole session family.
- **Logout** = delete the refresh token from the DB.

## Auth middleware

~~~js
export function authenticate(req, res, next) {
  const header = req.get("Authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return next(new UnauthorizedError("Missing token"));
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
}
~~~

Pin the \`algorithms\` option. Old JWT libraries were tricked by tokens with \`alg: "none"\`.

## Secrets and checklist

- Secrets (\`JWT_SECRET\`, DB passwords) come from **environment variables** or a secrets manager. **Never commit them to git.** Bots scan GitHub for leaked keys within minutes.
- Use long random secrets: \`node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"\`
- HTTPS everywhere, or tokens travel in plain text.
- Consider not building auth yourself in production: providers like Auth0, Clerk, Supabase Auth and Cognito exist. But understanding how they work is essential.
`,
    problem: {
      title: "Build secure signup, login and token refresh",
      scenario: `Your company's first app stored passwords in plain text "temporarily". It's now 2 years later. Security has made fixing auth the top priority before an upcoming SOC 2 audit. Requirements from the security team:

- passwords hashed with a slow algorithm
- login must not reveal whether an email exists
- short-lived access tokens, and refresh tokens that JavaScript can't read
- no hardcoded secrets`,
      task: `Build an Express auth module (in-memory or a real DB):

1. \`POST /auth/register\` hashes the password with bcrypt/argon2 and returns \`201\` (never the hash).
2. \`POST /auth/login\`
   - generic \`401 "Invalid email or password"\` on any failure
   - returns a **15-minute access JWT** in the JSON body
   - sets a **refresh token** in an \`HttpOnly\`, \`Secure\`, \`SameSite=Strict\` cookie, and stores it server-side
3. \`POST /auth/refresh\` validates the refresh cookie, **rotates** it (old one invalidated), and returns a new access token.
4. \`POST /auth/logout\` revokes the refresh token and clears the cookie.
5. An \`authenticate\` middleware protects \`GET /me\`.
6. All secrets come from \`process.env\`, and the app refuses to start without them.`,
    },
    realWorld: {
      company: "LinkedIn",
      title: "117 million LinkedIn passwords cracked (2012/2016)",
      story: `In 2012, about 6.5 million LinkedIn password hashes were posted on a Russian forum. LinkedIn had hashed passwords with **SHA-1 without a salt**, so attackers cracked most of them within days using precomputed tables and GPUs. In 2016 it turned out the breach was far bigger: **117 million** credentials were offered for sale.

Because people reuse passwords, the leak was used for **credential stuffing** attacks on other sites for years. (Mark Zuckerberg's Twitter and Pinterest accounts were briefly taken over with his reused LinkedIn password.) A slow, salted algorithm like bcrypt would have made mass cracking enormously more expensive.`,
      takeaway: "Use bcrypt/argon2, never fast or unsalted hashes. Assume your database will leak one day and design so a leak does as little damage as possible.",
    },
  },

  authorization: {
    lesson: `
## Logged in ≠ allowed

Authentication tells you **who** the user is. Authorization decides **what they can do**. Most real data breaches in APIs aren't about cracked passwords. They're about logged-in users accessing things that aren't theirs.

## IDOR: the #1 API vulnerability

~~~js
// ❌ Any logged-in user can read ANY order by changing the id in the URL
app.get("/api/orders/:id", authenticate, async (req, res) => {
  const order = await orders.findById(req.params.id);
  res.json(order);
});
~~~

User 7 requests \`/api/orders/1001\`, then \`/1002\`, \`/1003\`... and downloads everyone's orders, addresses and phone numbers. This is **IDOR** (Insecure Direct Object Reference), now called **BOLA** (Broken Object Level Authorization). It's **#1 on the OWASP API Security Top 10**.

### Fix: always check ownership

~~~js
app.get("/api/orders/:id", authenticate, async (req, res) => {
  const order = await orders.findById(req.params.id);
  const canSee = order && (order.userId === req.user.id || req.user.role === "admin");
  if (!canSee) throw new NotFoundError("Order");   // 404, not 403: don't confirm it exists
  res.json(order);
});

// Even better: scope the query itself, so the bug can't happen
const order = await orders.findOne({ id: req.params.id, userId: req.user.id });
~~~

Random UUIDs instead of sequential ids make guessing harder, but **they are not authorization**. Ids leak through URLs, logs and emails.

## 401 vs 403 vs 404

| Status | Meaning | Example |
|---|---|---|
| \`401 Unauthorized\` | not authenticated: missing or invalid token | no \`Authorization\` header |
| \`403 Forbidden\` | authenticated but not allowed | a customer calls an admin-only endpoint |
| \`404 Not Found\` | for **other users' resources**, hide that they exist | user 7 asks for user 9's order |

## RBAC: role-based access control

Give users **roles**, and give roles **permissions**:

~~~js
const permissions = {
  customer: ["order:read:own", "order:create"],
  support:  ["order:read:any", "order:refund"],
  admin:    ["order:read:any", "order:refund", "product:write", "user:manage"],
};

const can = (user, permission) => permissions[user.role]?.includes(permission) ?? false;

// middleware factory
const requirePermission = (permission) => (req, res, next) =>
  can(req.user, permission) ? next() : next(new ForbiddenError());

app.post("/api/orders/:id/refund", authenticate, requirePermission("order:refund"), refundOrder);
~~~

Check **permissions** in code, not roles (\`if (role === "admin")\` everywhere). Then adding a new "warehouse" role means editing one map, not 50 files.

## Two layers of checks

1. **Route level** (middleware): "Can this kind of user call this endpoint at all?" → RBAC
2. **Object level** (service/query): "Can *this* user touch *this specific* record?" → ownership

You almost always need both. RBAC alone doesn't stop customer A from reading customer B's order.

## Watch out for these too

- **Function-level**: hidden admin endpoints with no check ("nobody knows the URL"). Attackers read your frontend JS bundle and find them.
- **Field-level / mass assignment**: a user PATCHing their profile with \`{"role":"admin"}\`.
- **Multi-tenant SaaS**: every query must be scoped by \`tenantId\` / \`organizationId\`. Leaking one company's data to another is a company-ending event.
- **Enforce on the server.** Hiding a button in the UI is not authorization.

## Beyond RBAC

- **ABAC** (attribute-based): rules like "managers can approve expenses under $5,000 in their own department".
- **ReBAC** (relationship-based): Google Docs-style sharing ("viewer of folder → viewer of file"). Google's internal **Zanzibar** system powers this, and open-source versions include OpenFGA and SpiceDB.
`,
    problem: {
      title: "Lock down the orders API (fix the IDOR)",
      scenario: `A security researcher just emailed your company through the bug bounty program: *"While logged in as a normal customer, I changed /api/orders/50213 to /api/orders/50214 and saw another customer's name, address and order. I could do this for all orders."*

Legal says this may need to be reported as a data breach. You need to fix it today, and also support the new **customer support** team, who must be able to view (but not delete) any order.`,
      task: `Build an Express API with a fake \`authenticate\` middleware (it can read \`X-User-Id\` and \`X-User-Role\` headers for testing) and in-memory orders owned by different users:

1. A \`requireRole(...roles)\` (or \`requirePermission\`) **middleware factory**.
2. \`GET /api/orders\` → customers see **only their own** orders, support/admin see all.
3. \`GET /api/orders/:id\` → owner, support or admin. Anyone else gets **404** (explain why not 403).
4. \`DELETE /api/orders/:id\` → **admin only** (403 for others).
5. A missing or invalid user → **401**.
6. Write down 4 curl test cases that prove the IDOR is fixed.`,
    },
    realWorld: {
      company: "First American Financial",
      title: "885 million records exposed by changing a number in a URL (2019)",
      story: `In May 2019, security journalist Brian Krebs reported that First American Financial, a US title insurance giant, exposed about **885 million** sensitive documents dating back to 2003: bank account numbers, Social Security numbers, mortgage and tax records, and driver's license images.

The flaw was a textbook IDOR. Documents were served from URLs with **sequential ids**, and there was **no check that the viewer was allowed to see the document**. Anyone with one link could change the number and read someone else's records, with no login required. The company was later fined by regulators.`,
      takeaway: "Every request for a specific record must verify that this user may access this record. Scope queries by owner or tenant, and never rely on ids being hard to guess.",
    },
  },

  "api-security": {
    lesson: `
## Think like an attacker

Your API is on the public internet. Within minutes of deploying, bots will start probing it: scanning for \`/admin\`, \`.env\` files and known vulnerabilities, stuffing credentials, and injecting SQL. Security isn't one feature. It's **layers of defense**, so that when one fails, another catches the attack.

The **OWASP API Security Top 10** is the industry checklist. The biggest items: broken object-level authorization (IDOR), broken authentication, broken property-level authorization (mass assignment), unrestricted resource consumption (no rate limits), and security misconfiguration.

## 1. Injection

Never build queries or shell commands by concatenating strings:

~~~js
// ❌ SQL injection
db.query(\`SELECT * FROM users WHERE email = '\${req.body.email}'\`);
// ✅ parameterized
db.query("SELECT * FROM users WHERE email = $1", [req.body.email]);

// ❌ command injection: filename = "x.png; rm -rf /"
exec(\`convert \${filename} out.jpg\`);
// ✅ no shell, arguments passed as an array
execFile("convert", [filename, "out.jpg"]);
~~~

## 2. Security headers with helmet

~~~js
import helmet from "helmet";
app.use(helmet());
~~~

This sets \`Strict-Transport-Security\` (HTTPS only), \`X-Content-Type-Options: nosniff\`, \`Content-Security-Policy\`, framing protections and more. It also removes \`X-Powered-By: Express\`, which advertises your stack to attackers. One line, big win.

## 3. CORS done right

CORS controls which **websites** may call your API from a browser.

~~~js
import cors from "cors";
app.use(cors({
  origin: ["https://shop.com", "https://admin.shop.com"],   // explicit allowlist
  credentials: true,
}));
~~~

❌ Never reflect any origin while also allowing credentials. That lets any malicious site make authenticated requests as your logged-in users. Note: CORS protects browsers only. It is **not** authentication, because curl ignores it completely.

## 4. Rate limiting and resource limits

~~~js
import rateLimit from "express-rate-limit";
app.use("/api", rateLimit({ windowMs: 60_000, limit: 100 }));
app.use("/auth/login", rateLimit({ windowMs: 15 * 60_000, limit: 5 }));  // brute-force protection
app.use(express.json({ limit: "100kb" }));
~~~

Also cap pagination limits, upload sizes, query complexity and request timeouts.

## 5. Secrets management

- Use environment variables or a secrets manager (AWS Secrets Manager, Vault, Doppler). Never hardcode them.
- Add \`.env\` to \`.gitignore\`. Commit a \`.env.example\` with placeholder values.
- If a secret is ever committed, **rotate it immediately**. Deleting the commit isn't enough, because git history and forks keep it.
- Use \`gitleaks\` or GitHub secret scanning in CI.

## 6. Don't leak information

- No stack traces or SQL errors in responses (your centralized error handler).
- Generic auth errors.
- Don't return more fields than needed (\`passwordHash\`, internal flags).

## 7. Dependencies are attack surface

Your app has hundreds of transitive npm packages. Run \`npm audit\`, enable Dependabot/Renovate, pin versions with the lockfile, and **patch quickly**. The Equifax breach below came from a known vulnerability that had a patch available for two months.

## 8. Other essentials

- **HTTPS everywhere** (TLS terminates at your load balancer or CDN).
- **Validate all input** (the validation topic) and **check authorization on every object** (the authorization topic).
- **SSRF**: if your API fetches user-provided URLs (webhooks, image imports), block internal addresses like \`169.254.169.254\` (the cloud metadata endpoint) and \`localhost\`.
- **Log security events** (failed logins, permission denials) and alert on spikes.
- Run the app as a **non-root** user with least-privilege database credentials.
`,
    problem: {
      title: "Harden a vulnerable API before the security audit",
      scenario: `Your company is about to sign its first enterprise customer, and they require a security review. A quick scan of the internal API found several serious issues. Here's a condensed version of the code:`,
      starterCode: `const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));

const pool = new Pool({ connectionString: "postgres://admin:SuperSecret123@prod-db:5432/shop" });
const JWT_SECRET = "secret";

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query(
    "SELECT * FROM users WHERE email = '" + email + "' AND password = '" + password + "'"
  );
  if (result.rows.length === 0) return res.status(401).json({ error: "No user with email " + email });
  res.json({ token: require("jsonwebtoken").sign({ id: result.rows[0].id }, JWT_SECRET) });
});

app.get("/api/users/search", async (req, res) => {
  const result = await pool.query("SELECT * FROM users WHERE name LIKE '%" + req.query.q + "%'");
  res.json(result.rows);
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message, stack: err.stack });
});

app.listen(3000);`,
      task: `Find and fix **every** security problem. There are at least 8. For each one, write a one-line explanation of the attack it enables. Your fixed version must:

1. Use parameterized queries everywhere (both SQL injections).
2. Compare passwords with bcrypt against a stored hash (not plain-text passwords in SQL).
3. Move all secrets to environment variables, with a strong JWT secret and a token expiry.
4. Add \`helmet()\`, a restrictive CORS allowlist and a sensible body limit.
5. Add strict rate limiting on \`/auth/login\`.
6. Return a generic login error (no email enumeration).
7. Stop returning \`SELECT *\` user rows (password hashes!) from search, and require authentication for it.
8. Stop leaking stack traces.`,
    },
    realWorld: {
      company: "Equifax",
      title: "One unpatched dependency exposed 147 million people (2017)",
      story: `In March 2017, a critical vulnerability (CVE-2017-5638) was disclosed in **Apache Struts**, a web framework, and a patch was released the same week. Equifax, one of the three US credit bureaus, **didn't apply it** to an online dispute portal. Attackers exploited it starting in May and went unnoticed for about **76 days**. During that time they found **plain-text credentials** that let them move to other databases.

They stole the personal data (including Social Security numbers) of about **147 million people**. Equifax's settlement with US regulators was up to **$700 million**, and the CEO, CIO and CSO left the company.`,
      takeaway: "Security fails in layers: an unpatched dependency, then exposed secrets, then weak monitoring. Patch dependencies quickly, never store credentials in plain text, and log and alert on suspicious activity.",
    },
  },
};
