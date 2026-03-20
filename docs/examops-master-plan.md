# ExamOps Master Plan

## Purpose

This file is the normalized implementation reference for ExamOps.

It consolidates:

- the original business prompt
- the detailed v3.0 product specification
- lessons from the generated scaffold artifact
- the decisions we need before writing real source code

When there is a conflict between this file and any legacy generated artifact, this file wins.

When detailed business requirements are needed, consult `docs/examops-spec-v3.md`.

## Product Goal

Build a production-ready web application for managing exam proctoring operations across multiple governorates in Egypt.

The system must replace manual Excel-heavy workflows with a dynamic platform that handles:

- proctor data management
- dynamic locations and room capacities
- cycle/session setup
- auto-assignment
- waiting list and swaps
- attendance
- evaluations and promotions
- block management
- imports/exports
- reports, dashboard, and audit trail

## Non-Negotiable Principles

- No business-critical hardcoding
- All operational thresholds should live in the database or settings
- Soft-delete or deactivation over destructive deletion
- Every important mutation should be audit-logged
- Excel import/export is a first-class feature, not an afterthought
- The product must support future governorates, buildings, roles, and rule changes without schema rewrites
- The entire product must support both Arabic and English
- The entire product must be responsive across mobile, tablet, laptop, and desktop
- Dynamic behavior is a system-wide rule for data, workflows, labels, settings, and operational thresholds

## Canonical Architecture

- Frontend: Next.js App Router + TypeScript
- Styling: Tailwind CSS with RTL-aware layout decisions and responsive-first implementation
- Forms and validation: React Hook Form + Zod
- Data layer: Prisma + PostgreSQL
- Auth: role-based app-user authentication compatible with the chosen Next.js version
- State: server-first fetching, with client caching only where it adds value
- Services: business logic in service modules, not embedded inside route handlers
- Imports/exports: dedicated Excel import/export services
- Audit: one shared activity log pipeline for sensitive actions
- Internationalization: bilingual Arabic/English content architecture from the beginning
- Theme architecture: dark, light, and system preference support from the foundation
- Motion architecture: accessible micro-interactions with reduced-motion support
- Notification architecture: Email-first with WhatsApp, in-app, and SMS fallback support

## Cross-Cutting Product Requirements

### Bilingual Requirement

The system must be designed for both Arabic and English, not patched later.

Requirements:

- all primary UI labels must be translatable
- direction-aware layout support must exist for both RTL and LTR
- content architecture must not assume Arabic-only or English-only labels
- operational entities should support Arabic and English naming fields where it adds product value
- date, number, and table presentation should be locale-aware where practical

### Responsive Requirement

The system must be usable on all major device sizes.

Requirements:

- mobile-first layout discipline
- tablet-friendly operational screens
- desktop-optimized dense workflows
- assignment and dashboard screens must adapt cleanly to narrower widths
- tables and forms must degrade gracefully on smaller screens
- no critical workflow may require desktop-only interaction to remain usable

### Dynamic-By-Default Requirement

Dynamic behavior is a product rule, not a nice-to-have.

This applies to:

- locations
- roles
- room capacities
- algorithm thresholds
- settings
- labels/configurable content where needed
- clone behaviors
- filters, reports, and exports
- theme defaults and language defaults
- notification providers, priorities, and templates

When in doubt, prefer database-driven or settings-driven configuration over code constants.

## Canonical Domain Model

### Location Hierarchy

- governorates
- universities
- buildings
- floors
- rooms

Room requirements:

- `room_type`
- `exam_type` or equivalent compatibility field
- `capacity_min`
- `capacity_max`
- active flag

### People

Two people models exist separately:

- `users`: proctors and operational staff records
- `app_users`: authenticated system users

`users` must support:

- phone as universal unique matching key
- source classification
- organization and branch fields
- governorate linkage where useful
- rating/session history summary fields
- active/block-related operational status

`app_users` must support:

- role-based access
- active state
- optional linkage to a proctor record if needed later

### Operational Entities

- `cycles`
- `sessions`
- `assignments`
- `waiting_list`
- `evaluations`
- `attendance`
- `blocks`
- `activity_log`
- `settings`

### Canonical Relationship Decisions

- A cycle contains sessions
- A session represents a dated exam occurrence, not a building-specific duplicate
- Assignments connect users to a session and operational context
- Assignments carry building context, and room context where applicable
- Head/control can be building-level assignments with nullable room
- ASSN is a manual-only room assignment mode, not a separate session entity

## Core Business Modules

### 1. Locations

Responsibilities:

- CRUD for governorates, universities, buildings, floors, rooms
- hierarchical import from Excel
- room capacity and exam compatibility management

### 2. Proctors

Responsibilities:

- CRUD for users/proctors
- import and export by phone-based matching
- profile/history view
- source classification and block visibility

### 3. Cycles And Sessions

Responsibilities:

- create and manage cycles
- create dated sessions
- track session statuses
- support cloning from prior cycles

### 4. Assignment Engine

Responsibilities:

- auto-assignment per building
- head/senior/roaming/proctor role distribution
- waiting list generation
- validation before lock
- manual overrides and manual ASSN assignment

### 5. Attendance

Responsibilities:

- mark attendance statuses
- suggest replacements from waiting list
- promote waiting-list candidates when needed

### 6. Evaluations And Promotions

Responsibilities:

- evaluator-role constrained submissions
- average rating recalculation
- promotion suggestions
- repeated-poor-performance block suggestions

### 7. Imports, Exports, Reports

Responsibilities:

- import templates and parsing
- row-level error reporting
- assignment exports
- attendance/evaluation/waiting-list/proctor reports
- PDF where valuable later
- bilingual export headers and localized report presentation

### 8. Settings And Audit

Responsibilities:

- dynamic thresholds
- dynamic distribution knobs
- operational toggles
- change logging

### 9. UX And Notification Foundations

Responsibilities:

- bilingual UI system
- RTL/LTR-aware layout behavior
- theme system
- motion system with reduced-motion compliance
- configurable notification channel orchestration

## UI Scope

The following screens are required in the full project:

- login
- dashboard
- cycles list/create/detail/clone
- sessions detail/assign/attendance/evaluations
- proctors list/detail/import/export
- locations tree/import
- reports hub and report detail pages
- settings for users, roles, and runtime settings

The assignment screen is the highest-value operational screen and should receive special design attention.

UI-wide rules:

- bilingual Arabic/English support is mandatory
- responsive behavior is mandatory on all screens
- no screen should hardcode operational values that belong in data or settings
- theme-awareness is mandatory on all screens
- key operational screens must be tablet-usable, not desktop-only

## Delivery Strategy

We will not attempt to build the full application from a single AI dump.

We will build in slices:

### Slice 0: Baseline

- initialize app
- configure tooling
- define schema
- establish auth shell
- define layout/navigation shell
- establish bilingual and responsive foundations early
- establish theme and motion foundations early

### Slice 1: Core Data Foundations

- locations CRUD foundation
- proctors CRUD foundation
- cycles and sessions CRUD foundation
- settings foundation

### Slice 2: Assignment Foundation

- assignment domain model
- validation rules
- auto-assignment first implementation
- manual assignment paths

### Slice 3: Operational Workflows

- waiting list
- swaps
- attendance
- evaluations
- block workflow

### Slice 4: Import/Export And Reporting

- Excel imports
- export flows
- reporting surfaces
- dashboard metrics
- bilingual export formatting
- localized report presentation

### Slice 5: Polish And Delivery

- PWA and responsiveness
- test coverage
- deployment setup
- operational hardening
- accessibility and reduced-motion verification
- notification channel hardening

## Definition Of Done For A Slice

A slice is only "done" when:

- schema and contracts are implemented
- routes and services are wired
- UI is usable
- validation exists
- audit implications are handled
- at least minimal verification is completed
- project status is updated

## What We Will Use Legacy Generated Artifacts For

- naming inspiration
- rough service boundaries
- fast reference for possible file grouping

## What We Will Not Use It For

- final schema decisions
- auth package decisions
- exact route contracts
- final UI coverage
- source-of-truth task planning

## Current Execution Decision

Core product implementation is complete through Phase 9.

Current focus is Phase 10 release operations:

- staging dry-run and deployment checklist execution
- CI quality gates for typecheck/lint/build/integration/audit
- monitoring and alert-threshold readiness
- production release sign-off and post-release follow-up discipline
