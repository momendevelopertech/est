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
- `todo` Lock the canonical Prisma schema before coding

## Phase 1 - Foundation

- `todo` Initialize the real Next.js project structure
- `todo` Add TypeScript, Tailwind, linting, and base config
- `todo` Add Prisma and database connection setup
- `todo` Define environment variable strategy
- `todo` Add app shell, layout, and route groups
- `todo` Add authentication shell and role guard strategy
- `todo` Add shared UI primitives
- `todo` Add bilingual i18n-ready foundation for Arabic and English
- `todo` Add RTL/LTR layout support strategy
- `todo` Add responsive layout baseline for mobile, tablet, and desktop

## Phase 2 - Data Model

- `todo` Finalize location models
- `todo` Finalize user/proctor model
- `todo` Finalize app user model
- `todo` Finalize cycles and sessions
- `todo` Finalize assignments and waiting list
- `todo` Finalize attendance, evaluations, blocks, audit, and settings
- `todo` Create first migration and seed data

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

## Phase 6 - Assignment Engine

- `todo` Implement assignment service contracts
- `todo` Implement auto-assignment algorithm v1
- `todo` Implement pre-lock validation
- `todo` Implement manual assignment paths
- `todo` Implement ASSN manual-only logic
- `todo` Build assignment UI foundation
- `todo` Make assignment UI responsive across tablet and desktop with acceptable mobile fallback

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

## Phase 9 - Notification And Delivery

- `todo` Add email template layer
- `todo` Add notification triggers
- `todo` Add PWA support
- `todo` Add test coverage
- `todo` Add deployment checklist
- `todo` Validate bilingual and responsive quality before production release

## Recommended Next Tasks

These are the next five tasks to execute in order:

1. Finalize the canonical Prisma schema
2. Scaffold the real Next.js app structure
3. Add bilingual and responsive app shell foundations
4. Add auth shell and protected route layout
5. Build locations foundation
