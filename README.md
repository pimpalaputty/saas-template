# Multi-Tenant SaaS Template

A production-ready foundation for B2B SaaS products where each customer gets their own subdomain workspace (`acme.yourdomain.com`). Tenant isolation is enforced at the database layer via Postgres Row-Level Security — not just application code.

## What's included

**Authentication**
- Passwordless magic-link sign-in and sign-up (Supabase Auth OTP)
- Single session cookie scoped to `Domain=.<apex>` — one login works across all subdomains
- Invitation flow: admin invites by email → token hashed in DB → invitee must authenticate with the invited email

**Multi-tenant routing**
- Subdomain → tenant mapping handled in `proxy.ts` (Next.js 16 middleware)
- Auth guard: unauthenticated requests redirect to `/login?next=<original-url>`
- Membership guard: authenticated users without access redirect to `/no-access`
- Vercel preview deployments supported (`acme---branch.vercel.app` treated as subdomain `acme`)
- Reserved subdomains enforced at signup (`www`, `admin`, `api`, `auth`, etc.)

**Workspace management**
- Self-service workspace creation with slug validation and live availability check
- Workspace settings: rename, delete (admin only)
- Member management: invite, list, change role, remove
- Role model: `superadmin` (system-wide), tenant `admin`, tenant `member`

**Superadmin console**
- `/admin` lists all workspaces with member counts, plans, and creation dates

**Database**
- 4 tables: `profiles`, `tenants`, `memberships`, `invitations`
- Full RLS: every query is scoped to the requesting user's memberships
- `is_member_of` / `is_admin_of` helper functions (`SECURITY DEFINER`) to avoid policy recursion
- Triggers: auto-create profile on auth signup, auto-assign creator as first admin

## Tech stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, `proxy.ts` replaces `middleware.ts`) |
| UI | React 19, Tailwind v4, shadcn/ui (`new-york`, `zinc`) |
| Auth | Supabase Auth (magic links) via `@supabase/ssr` |
| Database | Supabase Postgres with Row-Level Security |
| Icons | `lucide-react` |
| Hosting | Vercel (Fluid Compute — Node.js runtime) |
| Package manager | pnpm 11+ |

## Starting a new SaaS project

### 1. Clone and install

```bash
git clone <repo-url> my-saas
cd my-saas
pnpm install
```

### 2. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a new project, then copy the credentials from **Project Settings → API**.

### 3. Apply database migrations

```bash
pnpm supabase db push
```

Or run the four migration files manually in the Supabase SQL editor (`supabase/migrations/0001` through `0004`).

### 4. Set environment variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_ROOT_DOMAIN=lvh.me:3000
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

> **Local development:** Use `lvh.me:3000` as the root domain, not `localhost`. `lvh.me` is a public wildcard DNS that points to `127.0.0.1`, so `acme.lvh.me:3000` routes to your local server. Plain `localhost` cookies are host-only and won't transfer to `acme.localhost`.

### 5. Start the dev server

```bash
pnpm dev
```

| URL | What you see |
|-----|-------------|
| `http://lvh.me:3000` | Landing page |
| `http://lvh.me:3000/signup` | Create a workspace |
| `http://lvh.me:3000/login` | Sign in |
| `http://acme.lvh.me:3000` | Workspace (after creating one named "acme") |
| `http://lvh.me:3000/admin` | Superadmin console (after seeding superadmin) |

### 6. Seed the first superadmin

After signing up for an account, run this in the Supabase SQL editor:

```sql
UPDATE public.profiles
SET is_superadmin = true
WHERE email = 'you@example.com';
```

This is intentionally manual — there is no UI to grant superadmin access.

### 7. Deploy to Vercel

```bash
vercel link
vercel env pull .env.local   # optional: sync env vars
vercel deploy --prod
```

Then configure DNS:
- Point `yourdomain.com` → Vercel
- Point `*.yourdomain.com` → Vercel (wildcard A/CNAME record)

Update your production environment variable:

```env
NEXT_PUBLIC_ROOT_DOMAIN=yourdomain.com
```

### 8. Customize for your product

All tenant-scoped pages live under `app/s/[subdomain]/`. Add new routes there — RLS automatically restricts every query to the active tenant.

```
app/s/[subdomain]/
├── page.tsx           # Dashboard
├── settings/          # Workspace settings + member management
└── your-feature/      # Add new pages here
```

Key files to understand before extending:

| File | Purpose |
|------|---------|
| `proxy.ts` | Subdomain extraction and auth/membership guard |
| `lib/auth/rbac.ts` | `requireUser()`, `requireRole()`, `requireSuperadmin()` |
| `lib/tenants/queries.ts` | `getTenantBySlug()` with `React.cache` deduplication |
| `lib/supabase/cookies.ts` | Cross-subdomain cookie configuration |
| `supabase/migrations/` | Full schema with RLS policies and triggers |

## Architecture decisions

**Tenant identity comes from the URL, not the JWT.** A user can belong to many tenants and holds one session. The active tenant is derived from the subdomain in `proxy.ts`, then authorized via `is_member_of(tenant_id)`.

**RLS is the isolation boundary, not application code.** Even if a bug in a Server Action omits a `.eq('tenant_id', ...)` filter, the database policy blocks the query. Application-level checks are an additional guard rail.

**Pending signups live in a signed cookie, not the database.** This avoids leaking unverified email addresses into Postgres and eliminates slug-squatting races before email confirmation.

**Invitation tokens are hashed before storage.** The raw token is only sent by email. A database compromise does not expose pending invitations.

## What's not included (v0.1)

- Billing / Stripe integration (the `plan` column is a placeholder enum)
- OAuth providers (stub is in `lib/auth/methods.ts`; implementation is config-only)
- Tenant-owned custom domains (`acme.com` → tenant)
- Audit logs, SAML, SOC 2 controls
- Real-time features (Supabase Realtime is available but not wired up)

## Documentation

- [`CLAUDE.md`](./CLAUDE.md) — Conventions, architecture rules, role matrix, resolved decisions (required reading for AI agents)
- [`DESIGN.md`](./DESIGN.md) — Design system: color palette, typography, spacing, component tokens
