# Namkeen Wholesale

A modern full-stack wholesale namkeen (Indian snacks) management web app for a distributor that supplies retail shops at customer-specific prices.

## Demo Logins
- Admin: `admin` / `admin`
- Shop owner (sample): `demo` / `demo`

## Audiences
1. Public visitors — landing page with catalog and inquiry form.
2. Shop owners (customer role) — see personalized prices, place orders, view past orders, send bill via WhatsApp.
3. Admin — manage products, customers, custom pricing, orders, stock ledger, dashboard with charts.

## Architecture
- Monorepo (pnpm workspaces, TypeScript project references).
- API: Express + Drizzle ORM + PostgreSQL, session-based auth via express-session and bcryptjs.
- Frontend: React + Vite + wouter routing + TanStack Query + shadcn/ui + Recharts.
- Shared OpenAPI spec at `lib/api-spec/openapi.yaml`; orval generates the React Query client into `lib/api-client-react`.
- DB schema in `lib/db/src/schema/*` (admins, customers, products, customerPricing, orders, orderItems, inquiries, stockEntries).

## Key Files
- `lib/api-spec/openapi.yaml` — single source of API truth.
- `artifacts/api-server/src/routes/*` — Express routes (auth, products, customers, orders, inquiries, stock, dashboard).
- `artifacts/api-server/src/lib/session.ts` — session typing and `requireAdmin` / `requireCustomer` / `requireAuth` middleware.
- `artifacts/namkeen/src/pages/*` — public, shop, and admin pages.
- `scripts/src/seed.ts` — `pnpm --filter @workspace/scripts seed` to reseed demo data.

## Auth Model
- Sessions are cookie-based via express-session. The fetch client sends `credentials: 'include'`.
- Two user tables: `admins` and `customers`. Login endpoint tries admin first, then customer.
- `GET /api/auth/me` returns `{ authenticated, role: 'admin'|'customer'|'guest', userId, name, shopName }`.
