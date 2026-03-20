# ExamOps Backlog

Status legend:

- `todo`
- `in_progress`
- `blocked`
- `done`

## Phase 0 - Planning Baseline

- `done` Audit the AI-generated scaffold artifact
- `done` Normalize the implementation plan
- `done` Create shared status tracking
- `done` Lock the canonical Prisma schema before coding

## Phase 1 - Foundation

- `done` Initialize the real Next.js project structure
- `done` Add TypeScript, Tailwind, linting, and base config
- `done` Add Prisma and database connection setup
- `done` Define environment variable strategy
- `done` Add app shell, layout, and route groups
- `done` Add authentication shell and role guard strategy
- `done` Add shared UI primitives
- `done` Add bilingual i18n-ready foundation for Arabic and English
- `done` Add RTL/LTR layout support strategy
- `done` Add responsive layout baseline for mobile, tablet, and desktop
- `done` Add dark/light/system theme foundation
- `done` Add design tokens and semantic color system
- `done` Add motion utilities with reduced-motion compliance
- `done` Add top-bar language toggle and theme toggle foundation

## Phase 2 - Data Model

- `done` Finalize location models
- `done` Finalize user/proctor model
- `done` Finalize app user model
- `done` Finalize cycles and sessions
- `done` Finalize assignments and waiting list
- `done` Finalize attendance, evaluations, blocks, audit, and settings
- `done` Create first migration and seed data
- `done` Transition auth/session from bootstrap env credentials to database-backed users and persisted sessions
- `done` Add bilingual name fields where required
- `done` Add preferred language and preferred theme persistence
- `done` Add notification provider/template settings

## Phase 3 - Locations Module

- `done` Build locations CRUD routes
- `done` Build locations UI tree/list screens
- `done` Build locations import flow
- `done` Add hierarchy validations
- `done` Ensure location labels and views support Arabic and English fields where needed

## Phase 4 - Proctors Module

- `done` Build proctors CRUD routes
- `done` Build proctors list/detail UI
- `done` Build proctors import flow
- `done` Build proctors export flow
- `done` Add profile history aggregation
- `done` Ensure proctor-facing admin screens are responsive and locale-ready

## Phase 5 - Cycles And Sessions

- `done` Build cycles CRUD routes
- `done` Build sessions CRUD routes
- `done` Add session status flow
- `done` Build cycle/session UI
- `done` Add clone workflow foundation
- `done` Support bilingual cycle and session naming

## Phase 6 - Assignment Engine

- `done` Implement assignment service contracts
- `done` Implement auto-assignment algorithm v1
- `done` Implement pre-lock validation
- `done` Implement manual assignment paths
- `done` Implement ASSN manual-only logic
- `done` Build assignment UI foundation
- `done` Make assignment UI responsive across tablet and desktop with acceptable mobile fallback
- `done` Add late-import re-ranking flow with manual override preservation

## Phase 7 - Operational Workflows

- `done` Build waiting-list logic and screens
- `done` Build swap workflow
- `done` Build attendance workflow
- `done` Build evaluation workflow
- `done` Build promotion suggestion logic
- `done` Build block workflow

## Phase 8 - Reporting And Excel

- `done` Build import template handling
- `done` Build export generators
- `done` Build dashboard metrics endpoints
- `done` Build reports hub and report pages
- `done` Add PDF export where needed
- `done` Add bilingual Excel export headers
- `done` Build premium dashboard layout and localized report views

## Phase 9 - Notification And Delivery

- `done` Add email template layer
- `done` Add notification triggers
- `done` Add in-app notifications
- `done` Localize notifications by user preferred language
- `done` Add WhatsApp integration layer
- `done` Add SMS fallback support
- `done` Add PWA support
- `done` Add test coverage
- `done` Add deployment checklist
- `done` Validate bilingual and responsive quality before production release
- `done` Validate dark/light/system theme quality before production release
- `done` Validate accessibility contrast and reduced-motion support before production release

## Phase 10 - Release Operations

- `done` Dry-run deployment checklist in staging simulation with production build/start flow and provider-compatible config structure (real external credential validation remains a release-window check)
- `done` Add CI gating for `typecheck`, `lint`, `build`, integration suites, and production audit script
- `done` Configure production monitoring and alert thresholds for API errors and notification delivery failures
- `done` Execute production release sign-off simulation using `docs/deployment-checklist.md`
- `done` Fix CI seed coverage for auto-assignment overlap verification and align the evaluation assignment-link migration with the live schema
- `todo` Run post-release retrospective and capture follow-up fixes

## Recommended Next Tasks

These are the next tasks to execute in order:

1. Perform live release-window provider credential validation in staging/production smoke flow
2. Run post-release retrospective and capture follow-up fixes
