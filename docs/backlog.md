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

- `todo` Implement assignment service contracts
- `todo` Implement auto-assignment algorithm v1
- `todo` Implement pre-lock validation
- `todo` Implement manual assignment paths
- `todo` Implement ASSN manual-only logic
- `todo` Build assignment UI foundation
- `todo` Make assignment UI responsive across tablet and desktop with acceptable mobile fallback
- `todo` Add late-import re-ranking flow with manual override preservation

## Phase 7 - Operational Workflows

- `todo` Build waiting-list logic and screens
- `todo` Build swap workflow
- `todo` Build attendance workflow
- `todo` Build evaluation workflow
- `todo` Build promotion suggestion logic
- `todo` Build block workflow

## Phase 8 - Reporting And Excel

- `todo` Build import template handling
- `todo` Build export generators
- `todo` Build dashboard metrics endpoints
- `todo` Build reports hub and report pages
- `todo` Add PDF export where needed
- `todo` Add bilingual Excel export headers
- `todo` Build premium dashboard layout and localized report views

## Phase 9 - Notification And Delivery

- `todo` Add email template layer
- `todo` Add notification triggers
- `todo` Add WhatsApp integration layer
- `todo` Add SMS fallback support
- `todo` Add in-app notifications
- `todo` Localize notifications by user preferred language
- `todo` Add PWA support
- `todo` Add test coverage
- `todo` Add deployment checklist
- `todo` Validate bilingual and responsive quality before production release
- `todo` Validate dark/light/system theme quality before production release
- `todo` Validate accessibility contrast and reduced-motion support before production release

## Recommended Next Tasks

These are the next five tasks to execute in order:

1. Build cycle/session UI
2. Add clone workflow foundation
3. Support bilingual cycle and session naming
4. Implement assignment service contracts
5. Implement auto-assignment algorithm v1
