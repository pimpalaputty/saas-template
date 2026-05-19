# CLAUDE.md — Agentic Working Agreement for This Repo

Rules and conventions for any AI agent (Claude Code or otherwise) working in this codebase. **Read this file in full before making changes.** Cross-reference [`DESIGN.md`](./DESIGN.md) for the canonical UI token system.

---

## 0. Prime Directives (non-negotiable)

1. **Never bypass Row Level Security.** Do not use `SUPABASE_SERVICE_ROLE_KEY` in any request-handling code path (Server Components, Server Actions, Route Handlers, proxy.ts). It is reserved for one-off scripts in `supabase/scripts/` and CI. If you find yourself reaching for it, you are solving the wrong problem.
2. **Tenant identity comes from the URL host, never from a JWT claim.** Derive the active tenant slug from the subdomain in `proxy.ts` / `app/s/[subdomain]/layout.tsx`, then authorize via `is_member_of(tenant_id)`.
3. **The middleware file is `proxy.ts`, not `middleware.ts`** (this is the Next.js 16 rename). Never recreate `middleware.ts`; never link to docs that say "middleware.ts" without checking that they apply to Next.js 16.
4. **DESIGN.md is canonical for UI tokens.** Do not introduce ad-hoc Tailwind color values; consume `DESIGN.md`'s palette and typography. If a new token is genuinely needed, propose an addition to DESIGN.md first.
5. **Decisions live in this file (§13), not in scattered notes.** When you make a non-obvious architectural choice — anything a future agent could reasonably second-guess — record it under §13 with the reasoning. Code documents *what*; §13 documents *why*.

---

## 1. Stack & Versions

| | |
|---|---|
| Framework | Next.js **16** (App Router) — `proxy.ts` replaces `middleware.ts` |
| UI runtime | React **19** (Server Components, Server Actions, `useActionState`) — **no `forwardRef`** |
| Hosting | Vercel (Fluid Compute is default — Node.js runtime, not Edge) |
| Auth | Supabase Auth (Magic Links) via `@supabase/ssr` |
| DB | Supabase Postgres (cloud free tier) with Row Level Security |
| Styling | Tailwind v4 + shadcn/ui (`new-york`, base `zinc`, CSS variables) |
| Icons | `lucide-react` |
| PM | `pnpm` (11+) |

Run scripts: `pnpm dev`, `pnpm build`, `pnpm start`. Add packages with `pnpm add <pkg>` (allowed without prompt per `.claude/settings.local.json`).

---

## 2. Repository Skills (required reading before applicable work)

The following skills are pinned in `skills-lock.json` and live under `.agents/skills/` and `.claude/skills/`. Consult them when their domain comes up. They are **rules, not suggestions.**

| Skill | When to consult | Key rules to enforce |
|---|---|---|
| `supabase-postgres-best-practices` | Any DB change. | Lowercase identifiers; every FK column gets an index; ENUMs for fixed sets; `security definer` helpers to avoid RLS recursion; prefer covering indexes for hot RLS lookups. |
| `vercel-react-best-practices`      | Any React/Next.js code change. | `server-auth-actions`, `server-cache-react`, `async-suspense-boundaries`, `rerender-derived-state-no-effect`, `server-no-shared-module-state`. |
| `vercel-composition-patterns`      | Any new component or refactor with >2 boolean props. | `architecture-avoid-boolean-props`, `architecture-compound-components`, `react19-no-forwardref`, `state-context-interface`, `patterns-explicit-variants`. |
| `frontend-design`                  | Landing page, dashboard polish, anything visual. | Use it alongside `DESIGN.md`; tokens win when in conflict. |

If your work is non-trivial in one of these domains and you have **not** read the relevant skill, stop and read it first.

---

## 3. Routing Conventions

### 3.1 Where each route lives

| Host | Path | Lives in |
|---|---|---|
| `domain.com` | `/`, `/login`, `/signup`, `/auth/callback`, `/choose-tenant`, `/invite/[token]`, `/no-access` | `app/(marketing)/`, `app/login/`, etc. |
| `domain.com` | `/admin` (superadmin console) | `app/admin/` |
| `acme.domain.com` | `/`, `/settings`, `/settings/members` | `app/s/[subdomain]/` (rewritten by proxy) |
| Vercel previews | `acme---branch.vercel.app` is treated as subdomain `acme` | handled in `proxy.ts:extractSubdomain` |

### 3.2 proxy.ts rules
- Two responsibilities and only two: (a) extract the subdomain, (b) coarse auth gate (redirect to `/login` if no session, redirect to `/no-access` if not a member).
- **Do not refresh the Supabase session inside proxy.ts.** Cookie writes in middleware are racy with Server Components reading the same cookie. Refresh happens in Server Components / Route Handlers via `supabase.auth.getUser()`.
- The matcher excludes `/api`, `/_next`, and static files. Do not loosen it without thinking about the cookie/cost implications.

### 3.3 Reserved subdomains
Maintained in `lib/tenants/reserved.ts`. When adding a new apex-only path (e.g., `domain.com/status`), also add `status` to the reserved list and ship a migration to backfill the `CHECK` constraint on `tenants.slug` if necessary.

---

## 4. Database & Multi-Tenancy Rules

### 4.1 Migrations
- All schema changes go through numbered SQL files in `supabase/migrations/NNNN_short_name.sql`.
- Never edit a migration after it has been applied to any non-local environment. Author a new one.
- Migrations must be idempotent where reasonable (`create table if not exists`, `do $$ ... if not exists ... end $$;`).

### 4.2 Tenant-scoped tables
Any table that holds tenant-owned data **must**:
1. Have a `tenant_id uuid not null references public.tenants(id) on delete cascade`.
2. Have an index on `tenant_id` (or rely on a composite unique constraint whose leftmost column is `tenant_id` — don't duplicate it; see §4.4).
3. Have RLS enabled.
4. Have policies that use `public.is_member_of(tenant_id)` for reads and `public.is_admin_of(tenant_id)` (or stricter) for writes — never raw `auth.uid()` comparisons against a `created_by` column when the resource is shared across the tenant.
5. **Index every foreign key column.** Postgres does not auto-index FKs; without an index, every `on delete` cascade does a sequential scan, and joins against the referenced table fall back to seq scan too. We learned this the hard way on `invitations.invited_by` (see 0005 migration).

### 4.3 RLS gotchas to avoid
- **Recursion:** if a policy on table `X` queries table `Y`, and `Y`'s policy queries `X`, you will deadlock the planner. The `is_member_of` / `is_admin_of` helpers are `security definer` precisely to short-circuit this.
- **Performance:** RLS predicates run per row. Make sure every column referenced in a policy is indexed. See `supabase-postgres-best-practices/security-rls-performance`.
- **Wrap `auth.uid()` in `(select ...)` in every policy and helper.** A bare `auth.uid()` is re-evaluated for every row; `(select auth.uid())` is treated as an initplan and computed once per statement. This is the single highest-leverage RLS optimization — 100×+ on large tables. The helpers in `0002_rls.sql` and the policies in `0005_rls_performance.sql` follow this; any new policy or helper must too.
- **Service role:** any code path using the service role key silently bypasses **all** RLS. Audit every call site; it must be unreachable from a request. The escape hatch for anon-callable narrow reads is a `security definer` SQL function — see §4.5.

### 4.4 Querying patterns

```ts
// CORRECT — tenant-scoped read, RLS does the filtering
const supabase = await createServerClient();
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .eq('tenant_id', activeTenant.id);   // belt-and-suspenders; RLS would also enforce

// WRONG — never do this in a request path
const admin = createAdminClient(serviceRoleKey);  // ❌
const { data } = await admin.from('projects').select('*');  // bypasses RLS
```

#### Index hygiene
- Don't create a single-column index when the composite unique constraint already covers it as a leftmost prefix. Example: `unique (tenant_id, user_id)` already indexes lookups by `tenant_id` alone — a separate `(tenant_id)` index is pure overhead.
- Use partial indexes for hot filter patterns that always include the same predicate. The Members page always queries `where accepted_at is null`; the matching index `(tenant_id, created_at desc) where accepted_at is null` is dramatically smaller and faster than indexing the whole table.

### 4.5 Anon-callable reads — `security definer` SQL functions
Some flows need a tiny read for an unauthenticated user. The signup form, for example, has to answer "is this slug taken?" before the user has a session, but the anon role can't see `tenants` (RLS hides it).

**The pattern is a narrow `security definer` SQL function that returns only the answer, not the row.**

```sql
create or replace function public.is_slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.tenants where slug = p_slug);
$$;

grant execute on function public.is_slug_available(text) to anon, authenticated;
```

Then call it from the action with the anon client — no service-role key in sight:

```ts
const supabase = await createClient();  // anon-keyed server client
const { data } = await supabase.rpc('is_slug_available', { p_slug: slug });
```

Rules for these helpers:
- Always set `search_path` explicitly to avoid search-path injection.
- Return the narrowest possible shape — a boolean, a count, a single non-sensitive column — not full rows.
- Grant `execute` only to the roles that genuinely need it (`anon` only when an unauthenticated flow uses it).
- One function per question. Don't build a "generic" helper that takes a table name; that's a service-role key with extra steps.

The `get_invitation_by_hash` and `accept_invitation` functions in `0004_invitations.sql` are the same pattern for the invitation-acceptance flow.

---

## 5. Authentication Rules

- Magic links only in v0.1. To add a provider (e.g., Google), extend `lib/auth/methods.ts` — do not bypass it.
- The auth cookie must be set with `Domain=.<apex>` (leading dot) whenever the apex is a real domain, so subdomains share the session. Use `lib/supabase/cookies.ts`; do not hand-roll cookie options elsewhere.
- **Local development must use `lvh.me`** (`NEXT_PUBLIC_ROOT_DOMAIN=lvh.me:3000`), not `localhost`. Plain `localhost` cookies are host-only and won't transfer to `acme.localhost`; lvh.me has wildcard DNS pointing to 127.0.0.1 and honors `Domain=.lvh.me`. No `/etc/hosts` edits.
- The `next` parameter on `/login` and `/auth/callback` must be validated against the apex (`<root>` or `*.<root>`) before any redirect. **Never** redirect to an arbitrary URL — that is an open-redirect vulnerability.
- The first superadmin is bootstrapped via SQL only; never expose a "grant superadmin" button to the application.

---

## 6. Authorization Pattern (RBAC)

Every Server Action that mutates tenant data starts with one of:

```ts
const user   = await requireUser();                    // throws 401 if unauthenticated
const tenant = await requireTenantFromHost();          // throws 404 if subdomain unknown
await requireRole(tenant.id, 'admin');                 // throws 403 if not admin
```

These helpers live in `lib/auth/rbac.ts` and `lib/auth/session.ts`. **Do not inline these checks.** Adding a new role requires a coordinated change across:
1. The Postgres `tenant_role` ENUM.
2. The `is_*_of` helper(s).
3. RLS policies that reference the new role.
4. `lib/auth/rbac.ts`.
5. The role matrix in §12.

If any of those five are missing, the role is not real.

### 6.1 Server Action implementation patterns

These are conventions every Server Action in `app/**/actions.ts` should follow.

**Authenticate inside the action — middleware is not a substitute.** Server Actions are public RPC endpoints; the body of the action is the only thing that runs when an attacker calls it directly. Start every mutating action with `requireUser` / `requireRole` / `requireSuperadmin` (see §6). Per `vercel-react-best-practices/server-auth-actions`.

**Return the user from your access-check helper.** Server Action files commonly need both a tenant guard and the caller's user ID (for `created_by`, `invited_by`, audit columns, etc.). Build one helper that returns both so you don't pay for a second `auth.getUser()` round-trip:

```ts
// app/s/[subdomain]/settings/members/actions.ts
async function loadTenant(subdomain: string) {
  const tenant = await getTenantBySlug(subdomain);
  if (!tenant) throw new Error('Workspace not found');
  const { user } = await requireRole(tenant.id, 'admin');
  return { tenant, user };
}

// Use both — no extra auth.getUser() call needed.
const { tenant, user } = await loadTenant(subdomain);
```

**Parallelize independent queries with `Promise.all`.** Server Actions are on the request critical path; two sequential awaits to Supabase add up fast. Per `vercel-react-best-practices/async-parallel`:

```ts
// ✅ Both checks run concurrently — one RTT instead of two.
const [{ count: memberCount }, { count: inviteCount }] = await Promise.all([
  supabase.from('memberships').select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id).eq('profiles.email', email),
  supabase.from('invitations').select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenant.id).eq('email', email).is('accepted_at', null),
]);
```

**Hoist Server Action dependencies to module-level static imports.** When you define an inline action inside a Server Component (e.g., a logout button in a layout), don't `await import(...)` inside the action body — that defers module resolution to invocation time. Pull the import to the top of the file and define the action as a named function:

```tsx
// ✅
import { signOut } from '@/lib/auth/methods';

async function signOutAction() {
  'use server';
  await signOut();
  redirect(`${protocol}://${rootDomain}/login`);
}

// Then in JSX:
<form action={signOutAction}>...</form>
```

Per `vercel-react-best-practices/server-hoist-static-io`.

**Place each Server Action file next to the page that uses it**, not in a global `lib/actions/`. Co-location keeps the action's authorization checks visible alongside the UI that calls it.

---

## 7. UI / Component Rules

### 7.1 Tokens come from DESIGN.md
- Colors: use the named palette from `DESIGN.md` (`colors.primary` = `#ff385c`, etc.) via Tailwind v4 CSS variables in `app/globals.css`. Do not inline arbitrary hex values.
- Type: the type ramp in `DESIGN.md` is authoritative. Component-level overrides are only legitimate when the design doc explicitly allows them.
- Radii: `rounded.sm` (8 px), `rounded.md` (14 px), `rounded.lg` (20 px), `rounded.full`. Cards default to `rounded.md`; buttons to `rounded.sm`; pills to `rounded.full`.
- Spacing: the named spacing scale in `DESIGN.md`. Avoid `space-x-3.5`-style off-scale values.

### 7.2 shadcn/ui
- Components are added with `pnpm dlx shadcn@latest add <name>`. The base config is in `components.json` (`style: new-york`, `baseColor: zinc`, `iconLibrary: lucide`). Do not change those without a design-doc update.
- Customize generated primitives in place at `components/ui/`. Do **not** copy a primitive into `components/<feature>/` just to tweak it — extend via variants instead.

### 7.3 Composition (per `vercel-composition-patterns`)
- **No `forwardRef`** — React 19 passes `ref` as a regular prop. Type it as `ref?: Ref<HTMLXxx>`.
- **Explicit variants beat boolean props.** A `<Button intent="primary" size="md">` is preferred over `<Button primary large>`. Once a component has more than 2 boolean props, refactor.
- **Compound components** for any UI that has internal state or multiple coordinated parts (members table, settings tabs). Pattern: `<Members><Members.Header/><Members.List/></Members>`.
- **Context, not prop drilling**, when ≥ 3 levels deep. Define a `<Provider value>` and a `useX()` hook that throws if used outside the provider.

### 7.4 Server vs Client components
- Default to Server Components. Mark with `'use client'` only when you need: interactivity (`onClick`, `useState`), browser APIs, or a third-party library that requires it.
- Server Actions live next to the page that uses them (`app/s/[subdomain]/settings/members/actions.ts`), not in a global `lib/actions/`.

### 7.5 Derived state in client components
- **Compute derived state during render, not in `useEffect`.** Per `vercel-react-best-practices/rerender-derived-state-no-effect`. An effect that does `setX(deriveFrom(y))` after `y` changes always renders twice — once with the stale derived value, then again after the effect fires.
- **If the source value only changes via a single event handler, derive the value in that handler.** This is what the signup form does for slug-from-name: the slug is computed inside the name input's `onChange` rather than in a `useEffect([name])`. Per `vercel-react-best-practices/rerender-move-effect-to-event`.
- Effects are still the right place for genuinely asynchronous work (debounced network calls, subscriptions). The slug-availability check in `signup-form.tsx` lives in an effect for that reason.

---

## 8. Frequent Pitfalls (read before debugging "weird" issues)

1. **"Logged in on apex but not on subdomain"** — Cookie domain is not `.domain.com`. Check `lib/supabase/cookies.ts`. Locally on `localhost`, cookies share automatically; in prod the leading-dot domain is mandatory.
2. **"User can see another tenant's data in dev tools"** — A query in a Server Action is using the service-role client. Grep for `createAdminClient` / `service_role` in any path reachable from a route.
3. **"RLS policy is infinite-looping"** — A policy queries a table whose policy queries the first table. Move the cross-table check into a `security definer` helper.
4. **"`acme.localhost:3000` redirects to login forever"** — Cookies set on `localhost` are host-only and never reach `acme.localhost`. Switch local dev to `lvh.me:3000` (see §5). If you must stay on `localhost`, accept that you re-auth per subdomain in dev.
4b. **"HTTP 431 on `xxx.lvh.me:3000` or `xxx.localhost:3000`"** — Node's default `--max-http-header-size` (16 KB) was exceeded by accumulated cookies. The `dev` script in `package.json` already bumps this to 64 KB via `NODE_OPTIONS`. If you still hit it, clear cookies for the apex in your browser.
5. **"Magic link 404s on callback"** — `emailRedirectTo` is missing the apex domain or includes a subdomain. It must always be `https://domain.com/auth/callback?next=...`.
6. **"Server Action throws Cookie modification not allowed"** — You called `cookies().set(...)` from a Server Component. Move the call to a Server Action or Route Handler.
7. **"RLS query is suddenly slow on a workspace with thousands of rows"** — A policy or helper is calling `auth.uid()` un-wrapped. Wrap it in `(select auth.uid())` — see §4.3. Run `explain analyze` and look for "Function Scan on auth.uid" repeated per row.
8. **"I need an unauthenticated read but RLS hides the table"** — Don't reach for the service-role key. Write a `security definer` SQL function that returns only the narrow answer (boolean, count, slug). See §4.5.

---

## 9. File Layout

```
app/
├── (marketing)/page.tsx           # Apex landing
├── login/                         # Magic-link sign-in
├── signup/                        # Workspace creation
├── auth/callback/route.ts         # PKCE exchange + safe next redirect
├── auth/finalize-signup/route.ts  # Reads pending-signup cookie, inserts tenant
├── choose-tenant/page.tsx         # Workspace picker after apex login
├── invite/[token]/                # Invitation acceptance
├── admin/page.tsx                 # Superadmin console (apex only)
├── no-access/page.tsx             # 403
└── s/[subdomain]/                 # Tenant scope (rewritten by proxy.ts)
    ├── layout.tsx                 # Membership guard, header, nav
    ├── page.tsx                   # Dashboard
    └── settings/
        ├── page.tsx + actions.ts
        └── members/page.tsx + actions.ts + invite-form.tsx

lib/
├── supabase/   server.ts, middleware.ts, client.ts, cookies.ts
├── auth/       session.ts, methods.ts, rbac.ts
├── tenants/    queries.ts, slug.ts, reserved.ts
├── invitations/ tokens.ts
└── utils.ts    cn, protocol, rootDomain

supabase/migrations/  0001_init → 0005_rls_performance
components/ui/        shadcn primitives
proxy.ts              Subdomain extraction + auth gate
```

Keep this layout intact; if you need a new top-level folder, add a one-line rationale to this section.

---

## 10. When in Doubt

1. Re-read the matching skill in `.agents/skills/` (`supabase-postgres-best-practices`, `vercel-react-best-practices`, `vercel-composition-patterns`, `frontend-design`).
2. Check §13 for a prior resolved decision.
3. If neither resolves it, **ask the human** — do not invent a convention. Once decided, record it under §13.

---

## 12. Role Matrix

| Capability                                       | superadmin | tenant admin | tenant member |
|--------------------------------------------------|:----------:|:------------:|:-------------:|
| Sign in via magic link                           |     ✓      |      ✓       |       ✓       |
| Create a new tenant                              |     ✓      |      ✓¹      |      ✓¹       |
| View any tenant's data                           |     ✓      |              |               |
| View own tenants' welcome dashboard              |     ✓      |      ✓       |       ✓       |
| Edit tenant settings (`name`, `plan`)            |     ✓      |      ✓       |               |
| Invite members                                   |     ✓      |      ✓       |               |
| Remove members (incl. demote other admins)       |     ✓      |      ✓²      |               |
| Delete the tenant                                |     ✓      |      ✓       |               |
| Access `domain.com/admin` (system console)       |     ✓      |              |               |

¹ Any authenticated user may create a tenant; they become its first `admin`.
² An admin cannot remove or demote themselves if they are the sole admin (see D3 in §13). Enforced in `app/s/[subdomain]/settings/members/actions.ts:enforceSoleAdminRule`.

**Enforcement layers (defense in depth):**
1. **UI** — buttons hidden / disabled when user lacks the role. Pure UX, never authoritative.
2. **Server Actions** — every mutation begins with `requireRole(tenantId, 'admin')` which queries `memberships` and throws on mismatch.
3. **RLS** — the policies in `0002_rls.sql` + `0005_rls_performance.sql` are the last line. Even if a Server Action is buggy, RLS prevents writes/reads that violate the role contract.
4. **proxy.ts** — coarse guard ("you are a member of this subdomain"), not role-aware.

---

## 13. Resolved Decisions

These are non-obvious architectural choices. Don't reopen them without consensus; if you do, update this table.

| # | Decision | Resolution |
|---|---|---|
| D1 | Signup form fields. | Require `name`; auto-suggest `slug` from name on the fly; slug is editable by the user. The `slugDirty` ref stops auto-derivation as soon as the user edits the slug field — see `app/signup/signup-form.tsx`. |
| D2 | Can one user belong to multiple tenants? | **Yes** — a user may be `admin` of N tenants and `member` of M. Tenant identity is derived from the URL host, never from a JWT claim. After login on apex with no `next` param, the user is sent to `/choose-tenant`. |
| D3 | Admin self-demotion rules. | A user cannot remove or demote themselves if they are the sole admin of the tenant. Enforced in `removeMemberAction` and `changeRoleAction`. Rationale: prevent orphan workspaces with zero admins. |
| D4 | Invitation acceptance — email must match. | The authenticated user's email must equal the invitation's email (case-insensitive). Mismatch returns `email_mismatch` from `accept_invitation()` and does not consume the token. Rationale: prevent invite hijack via forwarded links. |
| D5 | Supabase hosting. | Supabase Cloud free tier. Project provisioning is a manual one-time step; env keys go into Vercel via `vercel env`. |
| D6 | Pending signups storage. | Stored in a short-lived signed cookie (`pending-signup`, 15 min), not in Postgres. Rationale: avoid leaking unverified emails into the DB and avoid slug-squatting races before email confirmation. |
| D7 | Invitation tokens hashed in DB. | The raw token is sent only by email; SHA-256 hash is stored in `invitations.token_hash`. Rationale: a DB compromise does not expose pending invite URLs. |
| D8 | Magic-link only in v0.1; OAuth deferred. | All providers go through `lib/auth/methods.ts:signInWithEmail`/`signInWithProvider`. To add Google/GitHub, implement the provider stub — do not bypass the abstraction. |
| D9 | Local dev domain is `lvh.me`, not `localhost`. | Plain `localhost` cookies are host-only and never reach `acme.localhost`. `lvh.me` has public wildcard DNS to `127.0.0.1` and honors `Domain=.lvh.me`. No `/etc/hosts` edits. |
| D10 | Anon-readable narrow reads via `security definer` SQL functions. | Never reach for the service-role key in request paths. See §4.5 — `is_slug_available()` and `get_invitation_by_hash()` are the established examples. |
| D11 | First superadmin bootstrapped via SQL only. | No UI to grant superadmin. Rationale: avoid accidental elevation in v0.1. |

---

## 14. Revision Log
- **v0.1 (2026-05-17):** Initial.
- **v0.2 (2026-05-19):** Performance + security pass.
  - §4.2: foreign-key index requirement promoted to a rule.
  - §4.3: `(select auth.uid())` wrapping rule added.
  - §4.4: index hygiene (no redundant indexes, partial indexes for hot filters).
  - §4.5 added: `security definer` SQL functions as the only sanctioned escape hatch for anon-callable narrow reads (replacing service-role usage in `checkSlugAvailableAction`).
  - §6.1 added: Server Action patterns — `loadTenant` returning user, `Promise.all` for independent queries, static imports over `await import()`.
  - §7.5 added: derive state in render or event handlers, not effects.
  - §8 #7–#8 added: RLS perf and anon-read pitfalls.
  - Companion migration: `supabase/migrations/0005_rls_performance.sql`.
- **v0.3 (2026-05-19):** Absorbed SPECIFICATION.md.
  - §9 file layout inlined (was "see SPECIFICATION.md §10").
  - §12 Role Matrix inlined from SPECIFICATION.md §7.
  - §13 Resolved Decisions inlined and extended (D1–D7 from SPECIFICATION.md §14, plus D8–D11 covering decisions previously scattered across §5–§8 of this file).
  - SPECIFICATION.md deleted — code + migrations + this file are now the single source of truth.
