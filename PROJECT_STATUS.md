# Project Status

## Current State

- Repository is initialized and connected to GitHub
- Planning baseline docs now exist under `docs/`
- A single AI handoff file will be used as the entry point for future continuation
- Full product specification v3.0 is now captured locally
- Canonical Prisma schema now exists under `prisma/schema.prisma`
- The first Prisma migration has been applied to the configured Neon database
- A real Next.js App Router source tree now exists under `src/`
- TypeScript, Tailwind, ESLint, Prisma runtime wiring, and environment scaffolding are in place
- Protected public and dashboard route groups now exist with a shared app shell
- Seed data now exists for assignment roles, runtime settings, and initial app users
- Database-backed authentication is live with hashed passwords, persisted sessions, login/logout, and role guards
- Locale-aware shell copy, Arabic/English switching, and RTL/LTR rendering are now working
- Dark/light/system theme resolution is now live through database-backed preferences, cookies, and system fallback
- Shared motion utilities now exist with reduced-motion-safe transitions for pages, panels, navigation, and controls
- Database-backed locations CRUD routes now exist for governorates, universities, buildings, floors, and rooms with validation, soft-deactivation, and audit logging

## Canonical Working Documents

- `AI_START_HERE.md`
- `docs/examops-spec-v3.md`
- `docs/examops-master-plan.md`
- `docs/generated-output-review.md`
- `docs/backlog.md`

## Current Decision

We will not build ExamOps by copying the generated markdown artifact into source files.

We will instead:

1. use the normalized planning docs as the project source of truth
2. build the real project in phases
3. track progress in this file and in `docs/backlog.md`

## Milestone Snapshot

| Milestone | Status | Notes |
|---|---|---|
| Repo setup | done | Git initialized and remote configured |
| Legacy AI scaffold review | done | Old generated artifact reviewed and retired from active workflow |
| Full product specification v3.0 | done | Detailed requirements captured in docs |
| Master implementation plan | done | Normalized reference created |
| AI handoff entrypoint | done | `AI_START_HERE.md` is now the first file for any continuation |
| Prisma schema finalization | done | Canonical schema created and validated with Prisma CLI |
| Prisma migration and seed data | done | Initial migration applied to Neon and deterministic seed data now populates roles, settings, and app users |
| Real app bootstrap | done | Next.js App Router scaffold verified with lint, typecheck, Prisma, and production build |
| App shell and shared UI | done | Protected shell, route groups, and reusable primitives now power public and dashboard routes |
| Auth shell | done | Database-backed auth now uses seeded app users, hashed passwords, persisted sessions, and role guards |
| Bilingual shell foundation | done | Arabic/English copy, cookie-based language switching, and RTL/LTR direction are active |
| Theme and motion foundation | done | Dark/light/system theme resolution, top-bar preference controls, and reduced-motion-safe utilities are active |
| Locations CRUD routes | done | API handlers, service layer, validation, and audit logging now exist for the full location hierarchy |
| Locations UI tree/list screens | todo | Depends on the new CRUD routes |
| Proctors module | todo | Depends on schema/bootstrap |

## Immediate Next Focus

- Build the companion locations UI tree/list screens on top of the new locations routes
- Add location import flow and hierarchy validations
- Continue preserving UX and notification-system requirements from v3.0

## Update Log

### 2026-03-18

- Initialized the repository and connected it to GitHub
- Audited the generated artifact and converted planning into canonical docs
- Added normalized planning docs and backlog tracking
- Added `AI_START_HERE.md` as the single entrypoint for any future AI continuation
- Added the detailed `docs/examops-spec-v3.md` product specification
- Added the canonical `prisma/schema.prisma` for the full approved ExamOps domain
- Modeled bilingual naming, preferred language/theme persistence, settings, blocks, attendance, evaluations, and audit support
- Added a session-building join model plus data-driven assignment role definitions to avoid hardcoded operational roles
- Validated the Prisma schema successfully with `prisma validate`
- Bootstrapped the real Next.js application structure with App Router under `src/`
- Added package/tooling configuration for Next.js, TypeScript, Tailwind, ESLint, Prisma, and environment setup
- Added the first runtime helpers for Prisma client bootstrapping and environment validation
- Added an initial responsive landing page that reflects the current ExamOps implementation state
- Verified the bootstrap with `npm run lint`, `npm run typecheck`, `npm run db:generate`, `npm run db:validate`, and `npm run build`
- Pinned the bootstrap to Next.js `14.2.x` because the current workspace Node version is `19.6.0`, while the latest Next.js `16.x` line requires Node `20.9.0` or newer
- Added protected public/dashboard route groups plus a shared responsive app shell
- Added reusable UI primitives for buttons, cards, badges, and inputs
- Added environment-backed bootstrap authentication with signed-cookie sessions, login/logout routes, and role guards
- Added centralized Arabic/English shell copy with cookie-based language switching and RTL/LTR rendering
- Verified the milestone with `npm run lint`, `npm run typecheck`, `npm run build`, and a real browser smoke test covering login, protected dashboard access, logout, and Arabic language switching
- Applied the first Prisma migration to the configured Neon PostgreSQL database
- Added a deterministic Prisma seed script for assignment role definitions, initial settings, and baseline app users
- Replaced bootstrap environment-based auth with database-backed app-user authentication using hashed passwords and persisted `app_sessions`
- Updated locale preference persistence so account language can be stored in the database and mirrored into the locale cookie
- Verified the database-backed milestone with `npm run db:generate`, `npm run db:migrate -- --name initial_database_setup`, `npm run db:seed`, `npm run db:validate`, `npm run lint`, `npm run typecheck`, `npm run build`, and a browser smoke test covering seeded login, dashboard access, locale switching, and logout
- Added a real dark/light/system theme foundation using class-based theme resolution from `app_users.preferred_theme`, `settings.system.default_theme`, cookies, and system fallback
- Added top-bar language and theme controls that persist preferences without full page reloads
- Added reduced-motion-safe motion utilities for page transitions, panels, buttons, and navigation interactions
- Verified the theme/motion milestone with `npm run lint`, `npm run typecheck`, `npm run build`, and a browser smoke test covering theme switching, locale switching, logout, and database-backed preference persistence
- Resolved a documentation conflict by following the newer execution state in `docs/backlog.md` and `PROJECT_STATUS.md` instead of the outdated pre-implementation note in `AI_START_HERE.md`
- Added a locations service layer with Prisma-backed CRUD operations for governorates, universities, buildings, floors, and rooms
- Added authenticated locations API routes with role checks for super admins, coordinators, and data entry users
- Added Zod validation, soft-deactivation via `isActive`, and activity-log entries for location mutations
- Verified the locations CRUD routes milestone with `npm run typecheck`, `npm run lint`, and `npm run build`
