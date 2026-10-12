# Kinja

The Operating System for Africa's Agricultural Value Chains.

## Commands

```bash
pnpm install       # install dependencies
pnpm dev           # start the dev server at http://localhost:3000
pnpm test          # run the test suite once (Vitest)
pnpm test:watch    # run tests on every change
pnpm lint          # ESLint
pnpm exec tsc --noEmit   # type-check
pnpm build         # production build
```

## Local setup

1. Copy `.env.example` to `.env.local` and fill in usernames and passwords.
2. Run `pnpm dev` and open http://localhost:3000.
3. On a fresh checkout, demo data loads automatically the first time the login page opens.

## Dev tools

Open http://localhost:3000/dev (development builds only) to:

- load demo data or clear everything,
- sign in as any account without a password (one per role, plus a hub admin whose hub is still pending),
- read the email outbox, where every email Kinja "sends" is recorded (password resets, invites).

Demo accounts use the usernames and passwords in `.env.local`. When a value is unset, the username falls back to the role name (e.g. `cooplead`) and the password to `kinja-dev-password`.

## Data

There is no database yet. The server stores data through the `Repository` interface
(`src/repositories/repository.ts`) using the localStorage adapter on top of a JSON file at
`.data/kinja.json` (git-ignored). To switch to a real database, implement `Repository` and return it
from `getRepository()` in `src/repositories/server.ts`.

## Routes

| Area | Routes |
| --- | --- |
| Auth | `/auth/login`, `/auth/signup`, `/auth/onboarding`, `/auth/pending`, `/auth/invite/[code]`, `/auth/reset-password`, `/auth/logout` |
| Dashboards | `/dashboard/admin`, `/dashboard/hub`, `/dashboard/cooperative`, `/dashboard/manufacturer`, `/dashboard/distributor`, `/dashboard/profile` |
| Kinja Field | `/dashboard/cooperative/farmers`, `/dashboard/cooperative/farmers/new`, `/dashboard/cooperative/deliveries`, `/dashboard/cooperative/deliveries/new` |
| Hub setup | `/admin/setup`, `/admin/crops`, `/admin/team`, `/admin/hubs` |
| Development | `/dev` |
