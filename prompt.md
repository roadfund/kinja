You are SENIOR FULLSTACK engineer with many years of experience building production, industry software, products and solutions for global markets. 

You will be building Kinja - The Operating System for Africa's Agricultural Value Chains

Read CLAUDE.md fully before doing anything; it is the spec. Write clean, simple, scalable, maintainable code. Prioritize clarity over unnecessary abstraction. z

Think like a senior Fullstack engineer.

Do not introduce new mahor libraries unless there is a strong reason. 

Build feature by feature. For every feature:
1. read this file first
2. keep implementation simple 
3. Avoid overengineering 
4. Prefere redeadbale cover over clever code 
5. Refactor only when repetition appeats 

If something is unclear or could be improved, suggest a bette approach. If, for example, a libray would significantly help, recommend it, explain why, and ask before adding it. 

## Secrets 
- Never expose secret keys in the client code 
- User server routes tokens, and any external API access. Let me know 

Colors:
Primary: #344E41

The build happens in phases. Using TDD.

**Phase 1: Foundation and auth**

1. Scaffold the project using the stack in CLAUDE.md (Next.js App Router, TypeScript strict, Tailwind, shadcn/ui, Zod, Vitest), set up as a PWA with a service worker. No Prisma, ORM or database client: the database will be chosen later.
2. Define the MVP data model from CLAUDE.md as TypeScript types and Zod schemas, the repository interfaces, and the localStorage adapter (namespaced, versioned keys, migrations, quota handling). Cover: join tables, Membership and Invite, audit fields, enums (roles, organization types, hub status, invite status, crop status, payout status, transfer status, invoice status, payment method), integer minor units for money, and IDs that can be generated on the device (UUIDv7).
3. Build all auth routes under `/auth/`: `/auth/login` (single split-screen login for every role), `/auth/signup`, `/auth/onboarding`, `/auth/invite/[code]`, `/auth/pending`, `/auth/reset-password`, `/auth/logout`. Username and password login, hashed passwords, rate limiting, PBKDF2 password hashing via Web Crypto, and a dev outbox screen that shows every "sent" email.
4. Build the Start a hub onboarding with all the business details in CLAUDE.md, creating the hub as `PENDING_VERIFICATION`.
5. Build the invite acceptance flow at `/auth/invite/[code]`: validate the invite on the server, show who invited the user and to what role, send them to sign up or log in, then create their membership. The Team section for creating invites comes in Phase 2.
6. Build role routing: after login, send each role to its dashboard, and hub admins of unverified hubs to `/auth/pending`. Dashboards can be placeholders showing the user's name, role, organization, hub and country.
7. Build the shared authorization helpers (`requireRole()`, `getScope()`) that enforce hub isolation, org scoping, membership status and unverified-hub restrictions on the server.
8. Set up country configuration and translation files (English only for now, structured for more languages).
9. Build the dev tools panel (development builds only): seed loader, reset, account switcher for every role, and the email outbox.
10. Write tests proving the localStorage adapter round-trips and rejects invalid data, hub isolation, that each role reaches only its own dashboard, and that expired, revoked, used-up or wrong-hub invites are rejected.
11. Fill in the Commands section of CLAUDE.md with the real commands.

**Before you write any code:** give me a short plan covering the folder structure, the main schema decisions (especially traceability links, offline-safe IDs, payout states, and invites and memberships), how the repository layer will be swapped for a real database later,, and anything in CLAUDE.md you think is unclear or missing. Wait for my approval.

**Phase 2:**

- Phase 2: Hub setup and team: tech admin hub verification; hub admin crops, grades and prices; Team section for hub admins and cooperative leads (email invites, shareable codes and links, multi-use codes, revoke, remove members).
- Phase 3: Kinja Field: farmers, top 3 crops, multiple plots, deliveries, coop dashboard, then offline mode with sync.
- Phase 4: Kinja Pay: amounts owed, approvals, provider adapter interface with a mock adapter (MTN MoMo and Orange Money adapters once a backend exists), callbacks, reconciliation, cash payments.
- Phase 5: Kinja Manufacture: transfers with receipt confirmation, batches, finished goods.
- Phase 6: Kinja Market: customer import and management, sales, invoices, collections.
- Phase 7: Kinja Ops: dashboards, discrepancy flags, moderation, impact reporting, monthly reports, CSV and PDF exports.