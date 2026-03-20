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
- Seed data now includes a release-validation fixture with active multi-building locations, linked app users, multi-building sessions, active/cancelled assignments, waiting-list states, attendance states, evaluations, blocks, notification preferences, and notification templates
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
- Import template handling is now implemented with protected `GET /api/import/templates` and `GET /api/import/templates/[templateKey]/download`, activity-log-backed template downloads, and a responsive bilingual `/settings/import-templates` screen
- Export generators v1 are now implemented with protected `GET /api/export/assignments` and `GET /api/export/attendance`, CSV downloads, duplicate-row prevention, and export activity logging
- Dashboard metrics endpoints are now implemented with protected `GET /api/metrics/sessions`, `GET /api/metrics/assignments`, and `GET /api/metrics/attendance`, filter validation, and metrics access logging
- Reports hub and report pages are now implemented with protected report summary APIs, responsive bilingual `/reports` pages for assignments/attendance/evaluations, and report view logging
- PDF export support is now implemented for assignments, attendance, and evaluations through `/api/export/*?format=pdf`, with locale-aware rendering, transactional export logging, and audit metadata
- Bilingual Excel export headers are now implemented across session exports and proctors export with row 1 Arabic headers, row 2 English headers, and data rows from row 3 onward
- Premium dashboard and localized report views are now live with responsive layouts, report export format options (CSV/Excel/PDF), and direct metrics/report navigation wiring
- Notification email template layer is now implemented with DB-backed bilingual templates, safe placeholder preview rendering, duplicate-key protection, and activity logging for create/update/preview actions
- Notification trigger system is now implemented with centralized event resolution, template-based payload preparation, cross-workflow service integration, and trigger execution logging
- In-app notification system is now implemented with trigger-driven creation, user-scoped read APIs, top-bar bell + notifications page UI, bilingual content support, and notification activity logging
- WhatsApp integration layer is now implemented with provider adapters, DB-driven runtime settings, trigger-side non-blocking failure handling, protected test API, and delivery activity logging
- SMS fallback support is now implemented with provider abstraction, DB settings integration, safe fallback-only trigger behavior, protected test API, and `sms_sent` / `sms_failed` activity logging
- User notification preferences and channel control are now implemented with user-scoped APIs, responsive settings UI, default auto-creation, and preference-aware trigger enforcement across email/WhatsApp/SMS/in-app
- PWA support is now implemented with manifest, service worker, install prompt UX, offline fallback page, and safe network-first handling for critical app navigation/API traffic
- Integration coverage is now organized under `tmp/tests/` and validates assignment workflows, notification trigger/channel behavior, and reporting APIs end-to-end
- Production audit verification is now automated via `tmp/verify-production-audit.mjs` for locale parity, responsive/theme/accessibility guardrails, PWA availability, and non-leaky error responses
- Deployment checklist guidance is now documented in `docs/deployment-checklist.md`
- Phase 10 release-operations hardening is now implemented: staging simulation dry-run, CI gating, monitoring hooks/thresholds, and release sign-off simulation are complete
- Prisma/database alignment now includes the missing `evaluations.assignment_id` migration so the deployed schema matches the current application contracts and seed logic
- Final release-validation gates now pass after CI stabilization: `db:validate`, `typecheck`, `lint`, `build`, `test:integration`, and `tmp/verify-production-audit.mjs`

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
| Import template handling | done | `/api/import/templates` plus `/settings/import-templates` now provide downloadable CSV templates/sample files with bilingual metadata and download activity logging |
| Export generators (Step 2) | done | `/api/export/assignments` and `/api/export/attendance` now generate bilingual CSV exports with session validation, dedupe safety, and audit logging |
| Dashboard metrics endpoints (Step 3) | done | `/api/metrics/sessions`, `/api/metrics/assignments`, and `/api/metrics/attendance` now provide validated filtered aggregates and activity logging |
| Reports hub and report pages (Step 4) | done | `/reports` plus report detail pages now consume report APIs with responsive bilingual UI and integrated export/report logging |
| PDF export (Step 5) | done | `/api/export/assignments`, `/api/export/attendance`, and `/api/export/evaluations` now support `format=pdf` with locale-aware generation and export audit logging |
| Bilingual Excel headers (Step 6) | done | Session exports and proctors export now emit Arabic header row + English header row in Excel outputs before data rows |
| Premium dashboard and localized report views (Step 7) | done | `/dashboard` and `/reports/*` now provide upgraded responsive UI, locale-aware copy, theme-safe styling, and multi-format report exports |
| Notification email template layer (Phase 9 Step 1) | done | Added `src/lib/notifications/email` plus `/api/notifications/email/templates` and `/api/notifications/email/preview` with template persistence, placeholder-safe rendering, and activity logs |
| Notification trigger system (Phase 9 Step 2) | done | Added `src/lib/notifications/triggers`, integrated assignment/swap/attendance/waiting-list/block events, and prepared-render payload logging without sending |
| In-app notifications (Phase 9 Step 3) | done | Added Prisma in-app notification persistence, `src/lib/notifications/in-app`, trigger-side in-app creation, `/api/notifications/in-app*` routes, and responsive localized `/notifications` + header bell UX |
| WhatsApp integration layer (Phase 9 Step 4) | done | Added `src/lib/notifications/whatsapp` with adapter abstraction + Twilio adapter, settings-driven enable/provider/token/sender resolution, trigger integration, `/api/notifications/whatsapp/test`, and `whatsapp_sent`/`whatsapp_failed` audit logs |
| SMS fallback support (Phase 9 Step 5) | done | Added `src/lib/notifications/sms`, fallback-only trigger integration, `/api/notifications/sms/test`, and delivery logging with provider metadata |
| Notification preferences + channel control (Phase 9 Step 6) | done | Added `NotificationPreference` persistence, `/api/notifications/preferences`, responsive `/settings/notifications`, and per-user channel enforcement |
| PWA support | done | Added manifest, service worker, install prompt, offline fallback, and app-shell registration for installability |
| Integration test coverage hardening | done | Added `tmp/tests/run-all.mjs` plus assignment/notifications/reporting integration suites and fixed legacy verifiers for shared base URL execution |
| Production readiness audit + checklist | done | Added `tmp/verify-production-audit.mjs`, resolved metadata warnings, and documented release runbook in `docs/deployment-checklist.md` |
| Proctors import/export/profile history | done | Implemented in Phase 4 via `/api/proctors/import`, `/api/proctors/export`, and `/proctors/[proctorId]` profile history views |
| Release validation + CI stabilization | done | Added a stronger multi-building seed baseline, fixed the evaluation assignment-link migration gap, and re-verified the full main quality gate on 2026-03-20 |

## Immediate Next Focus

- Publish verified Phase 10 changes to `origin/main`
- Execute live release-window staging/production provider credential validation
- Run post-release retrospective and capture follow-up fixes

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
- Added Phase 8 Step 1 import template handling module (`src/lib/import/templates`) with contracts, validation, DTO, HTTP helpers, transactional activity logging, and protected template-list/download APIs
- Added responsive bilingual import-template workspace at `/settings/import-templates` and linked it from settings
- Verified Phase 8 Step 1 end-to-end on real Neon DB through authenticated API scenarios:
  - template list retrieval in English and Arabic
  - unique-key enforcement in API output (no duplicate template keys)
  - successful blank and sample CSV downloads with expected filenames/content structure
  - invalid template-key rejection with `validation_error`
  - rollback safety check (invalid requests do not create activity logs)
  - download activity-log persistence for successful template downloads
- Added Phase 8 Step 2 export module (`src/lib/export`) with contracts, validation, DTO, HTTP helpers, and service-level CSV generators for assignments and attendance exports
- Added protected export APIs:
  - `GET /api/export/assignments?sessionId=...`
  - `GET /api/export/attendance?sessionId=...`
- Reused assignment and attendance service-layer retrieval flows for export data assembly and added dedupe guards to prevent duplicate rows in export outputs
- Added transactional export activity logging (`action: export_generate`, `entityType: export`) with export type, session ID, row count, and duplicate-removal metadata
- Verified Phase 8 Step 2 end-to-end on real Neon DB through authenticated API scenarios:
  - valid assignments and attendance export downloads
  - invalid session rejection with `session_not_found`
  - empty-session export behavior (header-only CSV)
  - bilingual CSV structure validation
  - duplicate-row prevention checks
  - export activity-log persistence checks
- Added Phase 8 Step 3 metrics module (`src/lib/metrics`) with contracts, validation, DTO, HTTP helpers, and service logic for sessions, assignments, and attendance aggregates
- Added protected metrics APIs:
  - `GET /api/metrics/sessions`
  - `GET /api/metrics/assignments`
  - `GET /api/metrics/attendance`
- Added metrics access logging (`action: metrics_view`, `entityType: metrics`) with filter and totals metadata
- Added Phase 8 Step 4 reports module (`src/lib/reports`) with contracts, validation, DTO, HTTP helpers, and report-summary services
- Added protected report summary APIs:
  - `GET /api/reports/assignments`
  - `GET /api/reports/attendance`
  - `GET /api/reports/evaluations`
- Added responsive bilingual reports UI:
  - `/reports`
  - `/reports/assignments`
  - `/reports/attendance`
  - `/reports/evaluations`
- Added report view logging (`action: report_view`, `entityType: report`) and wired report export actions through existing export APIs
- Added locale coverage for reports navigation and report-page copy in both English and Arabic locale files
- Hardened evaluation report aggregation to run against current Neon schema using session-scoped raw aggregation queries (avoids dependency on a missing `evaluations.assignment_id` column while preserving filter behavior)
- Verified Phase 8 Step 3 end-to-end on real Neon DB through authenticated API scenarios in `tmp/verify-phase8-step3.mjs`:
  - valid metrics queries
  - invalid-query rejection
  - empty-data handling
  - aggregation correctness
  - metrics activity-log persistence
- Verified Phase 8 Step 4 end-to-end on real Neon DB through authenticated API scenarios in `tmp/verify-phase8-step4.mjs`:
  - assignments/attendance/evaluations report correctness
  - invalid-query rejection
  - empty-data handling
  - report/export activity-log persistence
  - report UI rendering checks for English and Arabic routes
- Extended the export module to support `format=csv|excel|pdf` and added a new evaluations export endpoint:
  - `GET /api/export/assignments`
  - `GET /api/export/attendance`
  - `GET /api/export/evaluations`
- Added PDF generation for assignments, attendance, and evaluations exports using `pdf-lib` with an embedded Cairo font for AR/EN coverage, plus transactional `export_generate` activity logging metadata for PDF/Excel/CSV formats
- Added bilingual Excel header rows (Arabic row 1 + English row 2) for:
  - session export endpoints (`assignments`, `attendance`, `evaluations`)
  - proctors Excel export endpoint (`GET /api/proctors/export?format=excel`)
- Updated reports service output to include structured export options (`csv`, `excel`, `pdf`) and propagated export-format metadata into `report_view` activity logs
- Replaced the basic dashboard with a premium metrics-driven workspace at `/dashboard`:
  - live metrics cards and status distributions from `/api/metrics/*`
  - localized quick actions linking dashboard/report flows
  - responsive, theme-token-based layout for mobile/tablet/desktop
- Upgraded localized report views at `/reports/*` with:
  - premium filter/export workspace layout
  - multi-format export actions (CSV/Excel/PDF)
  - localized active-filter and generated-at display
  - visual breakdown bars and improved responsive composition
- Added locale coverage updates in `src/locales/en.json` and `src/locales/ar.json` for new dashboard/report workspace copy
- Added and executed new Neon-backed verification scripts:
  - `tmp/verify-phase8-step5.mjs` (PDF export + report PDF links + export logs)
  - `tmp/verify-phase8-step6.mjs` (bilingual Excel headers + Excel export logs)
  - `tmp/verify-phase8-step7.mjs` (premium dashboard/report localization, theme render, metrics/report wiring)
- Verified quality gates successfully after Step 5-7 implementation:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Added Prisma `EmailTemplate` model and migration (`20260320130000_phase9_email_templates`) and applied it to Neon with `npm run db:deploy`
- Added Phase 9 Step 1 module at `src/lib/notifications/email` with:
  - contracts, validation, DTO, HTTP helpers, and service-layer implementation
  - DB-backed bilingual template persistence (AR/EN subject + body)
  - placeholder validation and declared-variable enforcement
  - safe preview rendering with missing-variable capture (no crashes)
  - template key duplicate prevention and update path in the same POST contract
- Added protected notification template APIs:
  - `GET /api/notifications/email/templates`
  - `POST /api/notifications/email/templates`
  - `POST /api/notifications/email/preview`
- Added email-template activity logging:
  - `create_template` / `update_template` for template mutations
  - `preview_template` for preview usage with missing/unexpected variable metadata
- Added and executed Neon-backed verification script `tmp/verify-phase9-step1.mjs` covering:
  - template creation
  - duplicate prevention
  - update behavior + logging
  - rendering correctness
  - missing-variable handling
  - bilingual preview rendering
  - activity-log persistence
- Re-ran quality gates after Phase 9 Step 1:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Added Phase 9 Step 2 module at `src/lib/notifications/triggers` with:
  - contracts, validation, DTO, HTTP helpers, and service-layer trigger orchestration
  - event-driven trigger inputs for:
    - assignment created
    - assignment swapped
    - attendance marked (`CONFIRMED` / `ABSENT` / `DECLINED`)
    - waiting-list promotion
    - user blocked/unblocked
  - template-key resolution, recipient resolution, locale-aware variable preparation, and DB-template rendering through the email template service
  - safe fallback behavior when templates are missing (no mutation crash; trigger logs capture `template_missing`)
  - recipient eligibility checks (active user, valid email, blocked-state filtering where required)
- Integrated trigger execution at mutation points in:
  - `src/lib/assignments/service.ts` (assignment created)
  - `src/lib/swaps/service.ts` (assignment swapped)
  - `src/lib/attendance/service.ts` (attendance marked)
  - `src/lib/waiting-list/service.ts` (waiting-list promotion)
  - `src/lib/blocks/service.ts` (blocked/unblocked)
- Added trigger execution activity logging (`action: notification_trigger_execute`, `entityType: notification_trigger`) with event type, template key, target count, prepared count, and skipped count metadata
- Extended email template service with reusable render helper for non-sending payload preparation:
  - `renderNotificationEmailTemplate(...)`
- Added and executed Neon-backed verification script `tmp/verify-phase9-step2.mjs` covering:
  - assignment trigger
  - attendance trigger
  - swap trigger
  - template resolution correctness
  - rendered payload correctness
  - trigger logging correctness
- Fixed a transaction-timeout regression discovered during verification by aligning `createAssignment` transaction options with the 30s timeout convention used across operational workflows
- Re-ran quality gates after Phase 9 Step 2:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Added Prisma `InAppNotification` model and migration (`20260320183000_phase9_in_app_notifications`) with user-scoped indexing and Neon deployment via `npm run db:deploy`
- Added Phase 9 Step 3 module at `src/lib/notifications/in-app` with:
  - contracts, validation, DTO, HTTP helpers, and service-layer implementation
  - create/list/mark-read/mark-all-read workflows
  - user-linked app-session resolution for API scoping
  - activity logging for `notification_created` and `notification_read`
- Added protected in-app notification APIs:
  - `GET /api/notifications/in-app`
  - `POST /api/notifications/in-app/read`
  - `POST /api/notifications/in-app/read-all`
- Integrated trigger execution with in-app notification persistence after email rendering, including safe fallback behavior so in-app failures do not break assignment/swap/attendance/waiting-list/block mutations
- Added responsive in-app notification UX:
  - top-bar notification bell dropdown with unread indicator and read actions
  - full notifications workspace at `/notifications` with filters, pagination, and bulk read action
  - navigation wiring for all roles
- Added localization coverage for notifications in `src/locales/en.json` and `src/locales/ar.json`
- Added and executed Neon-backed verification script `tmp/verify-phase9-step3.mjs` covering:
  - trigger-created notifications
  - notifications list API access
  - mark-as-read and mark-all-as-read flows
  - bilingual content rendering
  - non-crashing trigger behavior when in-app creation fails for one recipient
  - notification activity-log persistence
- Re-ran quality gates after Phase 9 Step 3:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
- Added Phase 9 Step 4 module at `src/lib/notifications/whatsapp` with:
  - contracts, validation, DTO, HTTP helpers, and service-layer implementation
  - adapter pattern provider abstraction (`whatsappProvider.ts`) with Twilio provider implementation (`twilioProvider.ts`) and Meta Cloud design-ready adapter stub
  - DB settings integration for `whatsapp_enabled`, `whatsapp_provider`, `whatsapp_api_key/token`, `whatsapp_sender_id`, and optional `whatsapp_account_sid`
  - safe AR/EN message formatting with shared template variable substitution support
  - delivery activity logging for `whatsapp_sent` and `whatsapp_failed` including provider/status/error metadata
- Extended notification trigger execution to attempt WhatsApp delivery after template rendering/in-app creation, while preserving non-crashing behavior when provider calls fail
- Added protected WhatsApp test endpoint:
  - `POST /api/notifications/whatsapp/test`
- Added and executed Neon-backed verification script `tmp/verify-phase9-step4.mjs` covering:
  - trigger-driven WhatsApp send attempts
  - disabled-config safe skip behavior
  - invalid-config safe handling
  - no-crash behavior on provider failure
  - WhatsApp logging correctness
- Re-ran quality gates after Phase 9 Step 4:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

### 2026-03-20 (continued)

- Added Phase 9 Step 5 module at `src/lib/notifications/sms` with:
  - contracts, validation, DTO, HTTP helpers, provider abstraction, and Twilio-ready provider implementation
  - DB settings integration for `sms_enabled`, `sms_provider`, `sms_api_key/token`, `sms_sender_id`, and optional account SID
  - fallback-only trigger integration with safe non-breaking behavior and structured `sms_sent` / `sms_failed` activity logging
- Added protected SMS test endpoint:
  - `POST /api/notifications/sms/test`
- Added and executed Neon-backed verification script `tmp/verify-phase9-step5.mjs` covering fallback-only behavior, disabled/invalid-config handling, logging correctness, and non-crashing failures
- Added Phase 9 Step 6 notification preferences with:
  - Prisma `NotificationPreference` persistence and migration (`20260320220000_phase9_notification_preferences`)
  - `src/lib/notifications/preferences` module (contracts, validation, DTO, HTTP, service)
  - protected `GET/POST /api/notifications/preferences`
  - responsive localized `/settings/notifications` channel-control UI
  - trigger-path enforcement for user-level email/WhatsApp/SMS/in-app toggles and preference update logging
- Added and executed Neon-backed verification script `tmp/verify-phase9-step6.mjs` covering channel toggles, fallback preference behavior, missing-preference auto-create defaults, API correctness, and UI render checks
- Added production-readiness integration suites under `tmp/tests/`:
  - assignment coverage (`auto-assign`, `swap`, `waiting-list promotion`)
  - notifications coverage (`trigger execution`, `channel selection`, `preference enforcement`, `fallback behavior`)
  - reporting coverage (`metrics`, `export` endpoints)
  - orchestrated by `npm run test:integration`
- Added PWA support artifacts and wiring:
  - `public/manifest.webmanifest`, `public/sw.js`, `public/offline.html`, icon set
  - install prompt UI (`src/components/pwa/install-prompt.tsx`)
  - service worker registration (`src/components/providers/pwa-registration.tsx`)
  - app-shell integration and metadata/viewport updates in `src/app/layout.tsx`
- Added automated production audit verification script `tmp/verify-production-audit.mjs` covering:
  - locale parity (`en`/`ar`)
  - PWA asset and endpoint availability
  - RTL/LTR render checks on core protected routes
  - responsive/theme/reduced-motion guardrails
  - non-leaky client-error response checks
- Added release runbook documentation at `docs/deployment-checklist.md`
- Re-ran final quality and readiness gates:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm run test:integration`
  - `node tmp/verify-production-audit.mjs`

### 2026-03-20 (release preflight)

- Reconciled documentation drift so source-of-truth files reflect current implementation phase:
  - updated `AI_START_HERE.md` to Phase 10 status
  - aligned notification channel priority wording in `docs/examops-spec-v3.md` and `docs/examops-master-plan.md` with implemented Email → WhatsApp → In-app → SMS fallback behavior
- Verified branch/upstream context:
  - current branch: `main`
  - upstream: `origin/main`
  - local worktree still contains uncommitted/unpublished production changes
- Executed release safety checks:
  - `npm run db:validate`
  - `prisma migrate status` (database schema up to date)
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm run test:integration`
  - `node tmp/verify-production-audit.mjs`
- Verified deploy/runtime constraints:
  - no `export const runtime = "edge"` declarations in app routes
  - no local filesystem writes in export/report/notification runtime paths
  - export APIs return in-memory response bodies (CSV/Excel/PDF) with no disk writes
- Marked Phase 10 first task as `in_progress` in `docs/backlog.md` because staging dry-run with real provider credentials remains pending

### 2026-03-20 (phase 10 release operations)

- Completed staging dry-run simulation with production build/start mode, integration coverage, WhatsApp validation script, and production audit checks
- Added CI gating workflow at `.github/workflows/main-quality-gate.yml` for:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm run test:integration`
  - `node tmp/verify-production-audit.mjs`
- Added monitoring readiness implementation:
  - shared monitoring service (`src/lib/monitoring/service.ts`)
  - API error capture hooks across route error handlers
  - notification failure monitoring hooks for email/whatsapp/sms paths
  - DB-driven alert threshold settings via seed data
- Added release-operations documentation:
  - `docs/staging-dry-run-report-2026-03-20.md`
  - `docs/monitoring-readiness.md`
  - `docs/release-signoff-2026-03-20.md`
- Published release-operations changes to `origin/main` at commit `5a8986f`

### 2026-03-20 (CI stabilization)

- Identified the failing CI root cause in `tmp/verify-auto-assignment-v1.mjs`: clean CI databases only had roles/settings/app users, so overlap verification could not find two active buildings
- Expanded `prisma/seed.ts` into an idempotent release-validation dataset that now seeds:
  - active governorates, universities, buildings, floors, and rooms
  - varied proctor users plus linked app users
  - multi-building sessions
  - active, manual, ASSN, and cancelled assignments
  - waiting-list, attendance, evaluation, block, notification-preference, and email-template fixtures
- Added migration `20260320233000_add_evaluation_assignment_link` so the live database now includes `evaluations.assignment_id` as expected by the Prisma schema
- Applied `npm run db:deploy` and `npm run db:seed` successfully against the configured Neon database
- Re-ran and passed the release gates:
  - `npm run db:validate`
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm run test:integration`
  - `node tmp/verify-production-audit.mjs`

## Post-release Notes

- Phase 10 release operations now include deterministic local/staging simulation scripts and a CI gate that blocks non-compliant pushes to `main`.
- Monitoring events are now structured for direct forwarding into external observability stacks without changing runtime business logic.
- Release sign-off evidence is now captured as dated artifacts to support audits and operational handoff.

## Known Limitations

- Provider-level external delivery confirmation still depends on real staging/production credentials and cannot be guaranteed by local simulation tokens alone.
- `monitoring_alert` suppression currently deduplicates alerts within a time window by alert type; high-volume incidents may still emit repeated alerts across rolling windows by design.
- Full production deployment smoke checks must still run during the live deploy window after rollout.

## Future Improvements

- Add dashboard surfaces for monitoring events and alert trend visualization.
- Add channel-specific threshold settings and escalation tiers (warning/critical) for notification failures.
- Add automated release-note generation from CI artifacts and deployment metadata.
