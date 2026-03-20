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
- Locations API hardening now enforces active-parent linking, detail-route inactive filtering, structured activity metadata, and a hierarchy tree endpoint for UI consumption
- Protected `/locations` tree/list screens now exist with responsive expand/collapse behavior, live API loading states, empty states, and locale-aware labels
- Locations CSV import now supports row-by-row hierarchy resolution, partial success handling, structured summaries, and import activity logging
- Locations hierarchy validations now block parent deactivation when active children exist, enforce case-insensitive scoped uniqueness, standardize typed validation errors, and harden room/import integrity rules
- Locations bilingual views now use a shared localized-name helper, support Arabic/English search in the tree UI, and accept English-only import rows through fallback-safe parsing
- Database-backed proctors CRUD routes now exist for `users` with bilingual fields, governorate integrity checks, duplicate detection, soft-deactivation, and activity logging
- Protected `/proctors` list/detail UI now exists with live API loading, bilingual search, source/block filters, detail inspection, and typed error handling
- Assignment service contracts are now implemented with validated create/list/detail/cancel flows and typed assignment-domain error handling
- Auto-assignment algorithm v1 is now implemented with dry-run support, overlap exclusion, manual-role skipping, idempotent reruns, activity logging, and Neon-backed verification coverage
- Manual assignment paths are now live through protected assignment create/list/detail/cancel APIs with placement and scope validation
- ASSN manual-only behavior is now enforced by role-definition policy (`manualOnly`) and blocked from non-manual assignment methods
- Session pre-lock validation is now implemented with role/scope coverage checks, blocked-user checks, duplicate/room-capacity checks, and lock enforcement through `session_lock_validation_failed`
- Late-import re-ranking is now implemented with dry-run/execute modes, transactional reset of AUTO+DRAFT assignments, and manual override preservation
- A responsive assignment workspace is now live at `/sessions/[sessionId]/assignments` with manual assignment forms, auto/rerank controls, and lock-validation visibility
- Waiting-list workflow is now implemented with ranked entries, promote/remove lifecycle actions, assignment integration, activity logging, and a responsive `/sessions/[sessionId]/waiting-list` screen
- Swap workflow is now implemented with direct assignment swaps, waiting-list replacements, manual replacement flow, transactional safety, activity logging, and a responsive `/sessions/[sessionId]/swaps` screen
- Attendance workflow is now implemented with status updates, waiting-list replacement suggestions, transactional absence replacement promotion, activity logging, and a responsive `/sessions/[sessionId]/attendance` screen
- Evaluation workflow is now implemented with assignment-linked scoring, duplicate prevention, cancelled-assignment guards, session-state validation, average-rating recalculation, activity logging, and a responsive `/sessions/[sessionId]/evaluations` screen
- Promotion suggestion logic is now implemented with settings-driven thresholds, ranked scoring breakdowns, blocked/inactive filtering, and protected `GET /api/promotion/suggestions`
- Block workflow is now implemented with protected `POST /api/blocks` and `POST /api/blocks/unblock` routes, transactional block lifecycle updates, and activity logging

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
| Locations UI tree/list screens | done | Protected `/locations` now renders the live hierarchy with responsive tree/list behavior and state handling |
| Locations import flow | done | `/api/locations/import` plus `/locations` upload UI now support CSV imports with row-level error handling |
| Locations hierarchy validations | done | Delete/update/import flows now enforce child guards, scoped uniqueness, room capacity rules, and typed validation errors |
| Locations bilingual labels/views | done | Shared name localization, bilingual tree search, and English-only import fallback now complete the locations UX slice |
| Proctors CRUD routes | done | `/api/proctors` now manages `users` records with validation, role protection, soft delete, and audit logging |
| Proctors list/detail UI | done | Protected `/proctors` now renders live proctor list/detail states with bilingual search and responsive filters |
| Assignment service contracts | done | Assignment API/service contracts and validation are now production-validated on Neon |
| Auto-assignment algorithm v1 | done | `/api/assignments/auto` now supports dry-run, execute, rerun idempotency, overlap blocking, manual-role skip, and audit logging |
| Manual assignment paths | done | `/api/assignments` create/list/detail/cancel flows are implemented and validated end-to-end |
| ASSN manual-only logic | done | `manualOnly` role policy is enforced in assignment creation and excluded from auto-assignment |
| Pre-lock validation | done | `validateSessionPreLock` plus `/api/sessions/[sessionId]/lock-validation` now gate locking and expose actionable validation issues |
| Assignment UI foundation | done | `/sessions/[sessionId]/assignments` workspace now provides assignment operations and validation visibility |
| Assignment UI responsiveness | done | Assignment workspace supports responsive layouts for tablet/desktop with mobile fallback patterns |
| Late-import re-ranking flow | done | `/api/assignments/rerank` now preserves manual assignments while re-running auto planning safely |
| Waiting-list logic and screens | done | `/api/waiting-list` plus `/sessions/[sessionId]/waiting-list` now support ranked create/list/promote/remove workflows |
| Swap workflow | done | `/api/swaps` plus `/sessions/[sessionId]/swaps` now support direct swap, waiting-list replacement, manual replacement, and transactional rollback safety |
| Attendance workflow | done | `/api/attendance` plus `/sessions/[sessionId]/attendance` now support attendance status updates, replacement suggestions, and absent-replacement promotion flow |
| Evaluation workflow | done | `/api/evaluations` plus `/sessions/[sessionId]/evaluations` now support validated create/list flows, assignment/session/user linkage checks, duplicate prevention, and audit logging |
| Promotion suggestion logic | done | `/api/promotion/suggestions` now returns ranked candidates with score breakdowns from evaluations, attendance ratios, and completed sessions using settings thresholds |
| Block workflow | done | `/api/blocks` and `/api/blocks/unblock` now manage temporary/permanent blocks, prevent duplicate active blocks, and integrate blocking across assignment, waiting-list, swap, and promotion flows |
| Proctors import/export/profile history | todo | Depends on CRUD slice |

## Immediate Next Focus

- Continue preserving UX and notification-system requirements from v3.0
- Start Phase 8 with import template handling and export generator implementation

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
- Hardened the locations backend so inactive records stay hidden by default across list and detail reads unless `includeInactive=true` is requested
- Added structured `activity_log.metadata` payloads for location create, update, and soft-delete operations
- Added a protected `/api/locations` hierarchy endpoint for UI consumption and a protected `/locations` page with responsive tree/list rendering, expand/collapse behavior, loading states, and empty/error handling
- Verified the locations hardening and UI milestone with `npm run typecheck`, `npm run lint`, and `npm run build`
- Added a CSV locations import service with row-by-row transactions, duplicate reuse, parent-chain validation, partial success reporting, and import activity logging
- Added `/api/locations/import` plus `/locations` import UI with upload, sample format guidance, progress state, and result/error summaries
- Verified the locations import milestone with `npm run typecheck`, `npm run lint`, and `npm run build`
- Hardened locations system integrity with active-child delete guards, scoped duplicate protection, room capacity/exam-type validation, and typed import validation errors
- Verified the hierarchy validation milestone with `npm run build`, `npm run lint`, `npm run typecheck`, and targeted mocked service scenarios for delete/update/create validation behavior
- Fixed the locations import API to avoid runtime `File` constructor assumptions and to accept English-only bilingual rows with safe fallback persistence
- Added a shared localized location-name helper plus bilingual search/filter behavior in the `/locations` tree UI and surfaced typed import error codes in the results panel
- Verified the bilingual locations milestone with real Neon-backed Prisma checks, real authenticated API calls on Node `19.6.0`, and locale cookie checks for `lang`/`dir` switching
- Audited the proctor domain and confirmed the existing `User` model is the production source of truth for proctor records, including bilingual names, source, block status, governorate linkage, and operational stats
- Added a proctors service layer with Prisma-backed CRUD operations, governorate integrity checks, duplicate detection across phone/email/national ID, typed error handling, and `activity_log` entries for create/update/delete mutations
- Added authenticated `/api/proctors` routes with role checks for super admins, coordinators, and data entry users, plus UUID param validation and inactive-aware detail retrieval
- Added a protected `/proctors` page with responsive list/detail behavior, bilingual search, source/block filters, locale-aware labels, and live API-backed detail states
- Verified the proctors milestone with real Neon-backed Prisma queries, real authenticated CRUD API calls on Node `19.6.0`, and production build validation for `/api/proctors` plus `/proctors`

### 2026-03-19

- Added assignment auto-run request contracts, validation schema, and a protected `POST /api/assignments/auto` route
- Implemented auto-assignment algorithm v1 with settings-driven rating threshold resolution, role-scope slot generation, overlap-aware candidate filtering, dry-run planning, and transactional creation
- Hardened candidate de-duplication so users with historical cancelled assignments in the same session are excluded from auto-assignment user pools, preventing unique-key failures
- Confirmed manual assignment coverage and ASSN manual-only enforcement are implemented in code and synced tracking status accordingly
- Added session pre-lock validation contracts/service logic plus `GET /api/sessions/[sessionId]/lock-validation` and lock-gating in session status transitions
- Added late-import re-rank contracts/service/validation plus `POST /api/assignments/rerank` with manual-override-safe reset behavior
- Added assignment role-definition listing endpoint and a responsive `/sessions/[sessionId]/assignments` workspace for auto/manual/rerank operations
- Added waiting-list contracts, validation, DTO, HTTP helpers, and service-layer workflows for ranked create/list/detail/promote/remove behavior
- Added protected waiting-list API routes under `/api/waiting-list` including lifecycle actions for promote and remove
- Added responsive session waiting-list workspace UI at `/sessions/[sessionId]/waiting-list` and linked it from session details
- Verified Phase 6 end-to-end on real Neon DB in production mode with:
  - assignment contracts checks (create/list/detail/duplicate/orphan/cancel flows)
  - auto-assignment v1 dry-run + execute + rerun idempotency
  - overlap exclusion correctness
  - cancelled-assignment duplicate guard behavior
  - manual-role skip enforcement
  - activity-log increment and payload integrity checks
  - pre-lock validation failure/success behavior, rerank dry-run/execute behavior, and EST_ASSN room-role auto exclusion
- Verified waiting-list Step 1 end-to-end on real Neon DB in production mode with:
  - ranked waiting-list ordering by rating
  - duplicate waiting-list guard
  - assignment conflict guard
  - promote lifecycle creating assignment + status transition
  - remove lifecycle and priority compaction
  - waiting-list activity-log increment validation

### 2026-03-20

- Added swap contracts, validation, HTTP layer, and protected `POST /api/swaps` route with role guards
- Implemented swap workflow service with three operations:
  - direct assignment-to-assignment placement swap
  - assignment replacement from waiting list
  - manual assignment replacement by proctor search
- Reused assignment session-assignability and overlap checks through exported assignment service helpers
- Reused waiting-list ranking flow through exported transactional re-rank helper to keep waiting priorities consistent
- Added responsive swap workspace UI at `/sessions/[sessionId]/swaps` and linked it from session details
- Added bilingual locale entries for swap UI and fixed Arabic waiting-list locale block corruption
- Verified swap Step 2 end-to-end on real Neon DB through authenticated API scenarios:
  - successful direct swap between two assignments
  - successful replacement from waiting list with optional demotion to waiting list
  - invalid swap rejection when manual override is not provided for incompatible roles
  - duplicate prevention for replacement users already assigned in the same session
  - rollback safety on failure (no partial assignment/waiting-list mutation persisted)
- Added attendance contracts, validation, HTTP layer, and protected attendance API routes:
  - `GET/POST /api/attendance`
  - `GET /api/attendance/replacements`
- Implemented attendance service workflows for:
  - status updates (`PENDING`, `CONFIRMED`, `ABSENT`, `DECLINED`) with transactional upsert
  - replacement suggestions ranked from waiting list with compatibility flags
  - automatic replacement promotion for absent/declined assignments, including original-assignment cancellation in the same transaction
- Reused waiting-list promotion logic inside transactions via `promoteWaitingListEntryInTransaction` to avoid duplicated assignment/waiting-list logic
- Added responsive attendance workspace UI at `/sessions/[sessionId]/attendance` and linked it from session details with role-aware access
- Verified attendance Step 3 end-to-end on real Neon DB through authenticated API scenarios:
  - successful attendance confirmation updates
  - successful replacement suggestion retrieval
  - successful absent + replacement promotion flow
  - invalid replacement-status validation rejection
  - rollback safety when replacement promotion fails (no partial attendance or assignment mutation)
  - activity-log persistence for attendance updates and waiting-list promotions
- Added evaluation contracts, validation, DTO, HTTP layer, and protected `GET/POST /api/evaluations` routes with role guards
- Implemented evaluation service workflows for:
  - assignment-linked evaluation creation with strict session/assignment/user consistency checks
  - duplicate-per-assignment prevention with optional same-evaluator update support
  - cancelled-assignment rejection and active-session operational gating
  - transactional user average-rating recalculation after evaluation mutations
  - activity logging for evaluation create/update actions
- Added responsive evaluation workspace UI at `/sessions/[sessionId]/evaluations` and linked it from session details
- Verified evaluation Step 4 end-to-end on real Neon DB through authenticated API scenarios:
  - successful evaluation creation
  - duplicate evaluation rejection
  - invalid rating validation rejection
  - cancelled-assignment evaluation rejection
  - assignment/session/user linking correctness in API + DB
  - activity-log persistence for evaluation creation
- Added promotion suggestion contracts, validation, HTTP layer, service, and protected `GET /api/promotion/suggestions` route
- Implemented promotion suggestion ranking using settings thresholds (`min_rating_threshold`, `min_sessions_required`, `min_attendance_ratio`) with weighted score breakdowns from evaluations, attendance ratios, and completed sessions
- Excluded blocked and inactive users from promotion candidates and hardened aggregation to avoid division-by-zero edge cases
- Verified promotion Step 5 end-to-end on real Neon DB through authenticated API scenarios:
  - ranking correctness
  - threshold filtering
  - blocked-user exclusion
- Added block workflow contracts, validation, DTO, HTTP layer, state helpers, service, and protected block APIs:
  - `POST /api/blocks`
  - `POST /api/blocks/unblock`
- Implemented transactional block lifecycle behavior for temporary/permanent blocks, duplicate active-block prevention, stale temporary-block expiry normalization, and unblock lifting
- Integrated shared blocked-user state checks across manual assignment, auto-assignment candidate filtering, waiting-list admission, swap replacements, and promotion suggestion filtering
- Verified block Step 6 end-to-end on real Neon DB through authenticated API scenarios:
  - blocked user assignment rejection
  - unblock restoring assignment eligibility
  - temporary block expiry restoring eligibility
  - auto-assignment exclusion for blocked users
  - block create/unblock activity-log persistence
