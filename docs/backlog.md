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
- `todo` Add app shell, layout, and route groups
- `todo` Add authentication shell and role guard strategy
- `todo` Add shared UI primitives
- `todo` Add bilingual i18n-ready foundation for Arabic and English
- `todo` Add RTL/LTR layout support strategy
- `todo` Add responsive layout baseline for mobile, tablet, and desktop
- `todo` Add dark/light/system theme foundation
- `todo` Add design tokens and semantic color system
- `todo` Add motion utilities with reduced-motion compliance
- `todo` Add top-bar language toggle and theme toggle foundation

## Phase 2 - Data Model

- `done` Finalize location models
- `done` Finalize user/proctor model
- `done` Finalize app user model
- `done` Finalize cycles and sessions
- `done` Finalize assignments and waiting list
- `done` Finalize attendance, evaluations, blocks, audit, and settings
- `todo` Create first migration and seed data
- `done` Add bilingual name fields where required
- `done` Add preferred language and preferred theme persistence
- `done` Add notification provider/template settings

## Phase 3 - Locations Module

- `todo` Build locations CRUD routes
- `todo` Build locations UI tree/list screens
- `todo` Build locations import flow
- `todo` Add hierarchy validations
- `todo` Ensure location labels and views support Arabic and English fields where needed

## Phase 4 - Proctors Module

- `todo` Build proctors CRUD routes
- `todo` Build proctors list/detail UI
- `todo` Build proctors import flow
- `todo` Build proctors export flow
- `todo` Add profile history aggregation
- `todo` Ensure proctor-facing admin screens are responsive and locale-ready

## Phase 5 - Cycles And Sessions

- `todo` Build cycles CRUD routes
- `todo` Build sessions CRUD routes
- `todo` Add session status flow
- `todo` Build cycle/session UI
- `todo` Add clone workflow foundation
- `todo` Support bilingual cycle and session naming

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

1. Add app shell, layout, and route groups
2. Add authentication shell and role guard strategy
3. Add shared UI primitives
4. Add bilingual i18n-ready foundation for Arabic and English
5. Add RTL/LTR layout support strategy
