# CLAUDE.md — Agentic Working Agreement for This Repo

Rules and conventions for any AI agent (Claude Code or otherwise) working in this codebase. **Read this file in full before making changes.** Cross-reference [`SPECIFICATION.md`](./SPECIFICATION.md) for architectural detail and [`DESIGN.md`](./DESIGN.md) for the canonical UI token system.

---

## 0. Prime Directives (non-negotiable)

1. **Never bypass Row Level Security.** Do not use `SUPABASE_SERVICE_ROLE_KEY` in any request-handling code path (Server Components, Server Actions, Route Handlers, proxy.ts). It is reserved for one-off scripts in `supabase/scripts/` and CI. If you find yourself reaching for it, you are solving the wrong problem.
2. **Tenant identity comes from the URL host, never from a JWT claim.** Derive the active tenant slug from the subdomain in `proxy.ts` / `app/s/[subdomain]/layout.tsx`, then authorize via `is_member_of(tenant_id)`.
3. **The middleware file is `proxy.ts`, not `middleware.ts`** (this is the Next.js 16 rename). Never recreate `middleware.ts`; never link to docs that say "middleware.ts" without checking that they apply to Next.js 16.
4. **DESIGN.md is canonical for UI tokens.** Do not introduce ad-hoc Tailwind color values; consume `DESIGN.md`'s palette and typography. If a new token is genuinely needed, propose an addition to DESIGN.md first.
5. **Do not write code in Phase 1 of a new feature.** Match the working style of the repo: spec first (`SPECIFICATION.md` update or a new design doc), then implementation, then verification.

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
2. Have an index on `tenant_id`.
3. Have RLS enabled.
4. Have policies that use `public.is_member_of(tenant_id)` for reads and `public.is_admin_of(tenant_id)` (or stricter) for writes — never raw `auth.uid()` comparisons against a `created_by` column when the resource is shared across the tenant.

### 4.3 RLS gotchas to avoid
- **Recursion:** if a policy on table `X` queries table `Y`, and `Y`'s policy queries `X`, you will deadlock the planner. The `is_member_of` / `is_admin_of` helpers are `security definer` precisely to short-circuit this.
- **Performance:** RLS predicates run per row. Make sure every column referenced in a policy is indexed. See `supabase-postgres-best-practices/security-rls-performance`.
- **Service role:** any code path using the service role key silently bypasses **all** RLS. Audit every call site; it must be unreachable from a request.

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

---

## 5. Authentication Rules

- Magic links only in v0.1. To add a provider (e.g., Google), extend `lib/auth/methods.ts` — do not bypass it.
- The auth cookie must be set with `Domain=.<root domain>` in production so subdomains share the session. Use `lib/supabase/cookies.ts`; do not hand-roll cookie options elsewhere.
- The `next` parameter on `/login` and `/auth/callback` must be validated against `*.domain.com` before any redirect. **Never** redirect to an arbitrary URL — that is an open-redirect vulnerability.
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
5. The role matrix in `SPECIFICATION.md` §7.1.

If any of those five are missing, the role is not real.

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

---

## 8. Frequent Pitfalls (read before debugging "weird" issues)

1. **"Logged in on apex but not on subdomain"** — Cookie domain is not `.domain.com`. Check `lib/supabase/cookies.ts`. Locally on `localhost`, cookies share automatically; in prod the leading-dot domain is mandatory.
2. **"User can see another tenant's data in dev tools"** — A query in a Server Action is using the service-role client. Grep for `createAdminClient` / `service_role` in any path reachable from a route.
3. **"RLS policy is infinite-looping"** — A policy queries a table whose policy queries the first table. Move the cross-table check into a `security definer` helper.
4. **"`acme.localhost:3000` redirects to login forever"** — Cookies set on `localhost` may not be visible on `acme.localhost` if cookie options include `domain: 'localhost'`. Leave `domain` undefined locally.
5. **"Magic link 404s on callback"** — `emailRedirectTo` is missing the apex domain or includes a subdomain. It must always be `https://domain.com/auth/callback?next=...`.
6. **"Server Action throws Cookie modification not allowed"** — You called `cookies().set(...)` from a Server Component. Move the call to a Server Action or Route Handler.

---

## 9. File Layout (target — partially in place)

See `SPECIFICATION.md` §10 for the full tree. Keep this layout intact; if you need a new top-level folder, add a one-line rationale here in CLAUDE.md.

---

## 10. When in Doubt

1. Re-read the relevant section of `SPECIFICATION.md`.
2. Read the matching skill in `.agents/skills/`.
3. If neither resolves it, **ask the human** — do not invent a convention. Once decided, write the decision into `SPECIFICATION.md` (Resolved Decisions) and/or this file.

---

## 11. Revision Log
- **v0.1 (2026-05-17):** Initial. Created alongside SPECIFICATION.md v0.2.
