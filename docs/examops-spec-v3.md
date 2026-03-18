# ExamOps Specification v3.0

## Purpose

This document is the full product specification for ExamOps.

Use it for:

- business requirements
- UX and UI expectations
- data model requirements
- workflow rules
- reporting and notification requirements

This file complements `docs/examops-master-plan.md`.

- `examops-spec-v3.md` defines what the product must do
- `examops-master-plan.md` defines how we will implement it in a controlled way

## Table Of Contents

1. Project Overview
2. Core Principles
3. UI/UX System
4. System Architecture
5. Database Design
6. Business Logic
7. Excel Import / Export
8. User Roles & Permissions
9. UI Pages & Screens
10. Clone System
11. Waiting List Logic
12. Swap System
13. Evaluation System
14. Attendance System
15. Notification System
16. Dashboard & Reports
17. Tech Stack
18. Development Phases
19. Dynamic System Rules

## 1. Project Overview

ExamOps is a fully dynamic bilingual web application and PWA for managing exam proctoring across multiple governorates in Egypt.

### Problem Statement

- Manual assignment using Excel takes hours every cycle
- Historical performance tracking is weak or missing
- Block and penalty management is inconsistent
- Every new cycle risks restarting from scratch

### Product Goals

- smart auto-distribution based on ratings and experience
- full proctor history and performance tracking
- configurable roles, capacities, and structures without hardcoding
- cycle cloning with multiple modes
- Excel import and export across all major workflows
- Arabic and English support with instant switching
- dark, light, and system theme support

### Scope

| Item | Details |
|---|---|
| Governorates | Cairo, Giza, Alexandria, Damietta, Minya |
| Exam Types | EST1, EST2, EST ASSN |
| Cycle Frequency | about 5 cycles per year, usually 2 days each |
| Data Sources | Sphinx staff, university staff, external proctors |

## 2. Core Principles

Everything can change. No hardcoding.

| Principle | Meaning |
|---|---|
| Dynamic roles | Roles are configurable and not fixed in code where configuration is appropriate |
| Dynamic locations | Governorates, universities, buildings, floors, and rooms are CRUD-managed |
| Dynamic capacities | Room capacities are editable and session-aware where needed |
| Dynamic rules | Thresholds and workflow knobs live in settings |
| Audit trail | Every sensitive operation is logged |
| Excel-first operations | Import/export is a first-class capability |
| Soft delete | Prefer deactivation over destructive deletion |
| Bilingual | All user-facing product content supports Arabic and English |
| Theme aware | UI must support dark/light/system consistently |

## 3. UI/UX System

The product must feel like a polished 2026 operations platform, not a generic CRUD dashboard.

### 3.1 Design Language

- visual style: modern glassmorphism plus bento-grid influenced dashboard layout
- rounded corners: large, soft, consistent
- subtle layered shadows
- low-noise borders
- consistent 8-point spacing rhythm
- purposeful motion, not decorative over-animation
- Lucide iconography
- bilingual typography strategy:
  - English: Inter
  - Arabic: Cairo or Noto Kufi Arabic

### 3.2 Color System

Use CSS custom properties for theming. Avoid hardcoded component colors.

Light-mode semantic tokens:

- `background`
- `surface`
- `surface-elevated`
- `border`
- `text-primary`
- `text-secondary`
- `text-muted`
- `accent`
- `accent-hover`
- `success`
- `warning`
- `danger`
- `info`

Dark mode must define equivalent tokens and all colors must meet WCAG AA contrast minimums.

Reference token example:

```css
/* Light */
--background: #f8fafc;
--surface: #ffffff;
--surface-elevated: #f1f5f9;
--border: #e2e8f0;
--text-primary: #0f172a;
--text-secondary: #64748b;
--text-muted: #94a3b8;
--accent: #6366f1;
--accent-hover: #4f46e5;
--success: #10b981;
--warning: #f59e0b;
--danger: #ef4444;
--info: #3b82f6;

/* Dark */
--background: #0a0f1e;
--surface: #111827;
--surface-elevated: #1f2937;
--border: #1f2937;
--text-primary: #f8fafc;
--text-secondary: #94a3b8;
--text-muted: #64748b;
--accent: #818cf8;
--accent-hover: #6366f1;
```

### 3.3 Bilingual System

Language support is mandatory from day one.

Requirements:

- top-bar language toggle always visible
- instant switch without full page reload
- default locale based on browser/system preference
- RTL for Arabic and LTR for English
- translation files stored centrally, for example:
  - `locales/ar.json`
  - `locales/en.json`

Every user-facing string must exist in both languages:

- page titles
- labels
- table headers
- validation messages
- toasts
- modals
- email and WhatsApp content
- Excel headers

Data rendering rule:

- UI renders Arabic fields in Arabic mode and English fields in English mode where bilingual entity names exist
- browser locale may choose initial language, but user preference must win after selection

### 3.4 Dark / Light / System Theme

Requirements:

- top-bar theme toggle
- persisted preference
- `system` follows operating system preference
- Tailwind class strategy on root html element
- theme-aware custom components only use semantic design tokens
- no component may assume one theme only

### 3.5 Layout System

Application shell requirements:

- top bar with logo, navigation context, language switcher, theme switcher, user menu
- sidebar that collapses explicitly on user action
- mobile sidebar becomes a drawer or sheet
- Arabic mode places sidebar on the right
- main content area must remain scroll-friendly and uncluttered

Dashboard requirements:

- bento-grid layout
- varied card sizes with intentional hierarchy
- activity feed, alerts, quick actions, and progress widgets

### 3.6 Motion System

Required interaction patterns:

- page transitions
- card hover elevation
- button press feedback
- sidebar expand/collapse animation
- toast entrance and dismissal
- modal entrance
- dropdown animation
- status transition animation
- animated counters and progress bars where valuable

Accessibility rule:

- all motion must respect `prefers-reduced-motion`

Suggested motion timing targets:

| Interaction | Target |
|---|---|
| Page transition | 150ms ease-out |
| Card hover | 200ms |
| Button press | 100ms |
| Sidebar toggle | 250ms |
| Toast enter/exit | 200ms |
| Modal enter | 200ms |
| Dropdown enter | 150ms |
| Status change | 300ms |

### 3.7 Component Standards

Status badges must have consistent semantic treatment.

Examples:

- `draft` neutral
- `active` accent
- `pending` warning
- `confirmed` success
- `absent` danger
- `archived` muted

Table requirements:

- sticky headers
- sorting indicators
- row hover states
- pagination
- bulk selection when useful
- empty states
- skeleton loading states

Form requirements:

- strong focus states
- inline validation
- clear error messaging
- visible success/loading feedback
- floating labels where appropriate
- use skeletons instead of generic spinners for dense table loading states

## 4. System Architecture

- Next.js App Router for UI and server routes
- Prisma as ORM
- PostgreSQL as primary database
- SheetJS for Excel processing
- role-based authentication system for app users
- next-intl for i18n and locale-aware rendering
- next-themes for theme management
- service-layer business logic separate from routes
- deployable to Vercel-compatible infrastructure

## 5. Database Design

### 5.1 Core Entity Overview

- governorates
- universities
- buildings
- floors
- rooms
- users
- app_users
- cycles
- sessions
- assignments
- waiting_list
- evaluations
- attendance
- blocks
- activity_log
- settings

### 5.2 Bilingual Naming Rules

All user-facing core location and cycle/session naming entities must support both Arabic and English naming fields where relevant.

Examples:

- `name`
- `name_en`

At minimum this applies to:

- governorates
- universities
- buildings
- floors
- cycles
- sessions
- settings labels

Storage convention:

- `name` may be used as Arabic-first primary label
- `name_en` stores English equivalent
- settings support both `label` and `label_en`

### 5.3 Important Table Requirements

#### users

Must support:

- phone as universal unique identifier
- optional unique national ID
- source: sphinx / university / external
- organization
- branch
- governorate link
- average rating
- total sessions
- block status
- active state
- preferred language
- notes

#### app_users

Must support:

- role
- optional linked user record
- preferred language
- preferred theme
- active state
- last login

Preferred theme values:

- `light`
- `dark`
- `system`

#### rooms

Must support:

- room type
- exam compatibility
- capacity min/max
- active state

#### assignments

Must support:

- session
- user
- room
- building
- role
- status
- assigned by auto/manual
- override note
- uniqueness on `(session_id, user_id)`

#### waiting_list

Must support:

- session
- cycle
- user
- priority
- reason
- status

#### settings

Must support:

- key
- value
- type
- Arabic label
- English label
- group

### 5.4 Additional Persistence Requirements

- soft delete via `is_active` where applicable
- audit log with before/after payload support where useful
- user language preference storage
- app-user theme preference storage
- notification provider and template settings

## 6. Business Logic

### 6.1 Auto-Assignment

The assignment engine must:

- run per building
- filter blocked and disqualified users
- sort by rating, experience, and tie-breakers
- assign head first
- keep control assignment manual
- assign seniors and roaming staff per floor
- distribute proctors by room capacity
- keep ASSN rooms manual only
- move surplus candidates to waiting list

### 6.2 Late Import Re-Ranking

If new proctors are imported after auto-assignment:

- detect newly available unassigned candidates
- notify coordinator
- allow:
  - full re-run of auto-assignment
  - manual insertion to waiting list
  - ignore

If re-run happens:

- manual overrides must be preserved
- only auto-generated draft assignments may be reset

### 6.3 Rating And Promotion Logic

- recalculate average ratings after evaluations
- update total sessions from attendance/assignment outcomes
- identify senior and roaming promotion candidates using settings-driven rules

### 6.4 Block Logic

- support manual blocks
- support temporary and permanent blocks
- support block suggestions after repeated poor performance
- block lifecycle changes must be auditable

### 6.5 Lock Validation

Before session lock, validate:

- no duplicate assignment in same session
- all active rooms satisfy `capacity_min`
- each floor has required senior coverage
- each floor has required roaming coverage
- each building has a head
- no blocked user remains assigned
- ASSN assignments are manual-only

## 7. Excel Import / Export

Every major entity and workflow should support import and/or export as appropriate.

### Import Types

- proctors
- locations
- cycle proctors
- Sphinx staff

### Import Rules

- validate structure before processing
- normalize phone numbers
- row-level processing with partial success support
- detailed error reporting
- update existing records by phone where relevant

### Export Rules

- all major reports should be exportable
- exported Excel headers must be bilingual
- row 1 Arabic headers
- row 2 English headers
- data from row 3 onward

Export categories should include:

- building assignment sheets
- cycle reports
- attendance reports
- evaluation reports
- waiting-list reports
- proctor exports

## 8. User Roles & Permissions

App roles:

- super_admin
- coordinator
- data_entry
- senior
- viewer

Permissions must cover:

- user management
- location management
- imports/exports
- cycle creation
- auto-assign and manual assign
- lock session
- blocks
- evaluations
- attendance
- reports and dashboard visibility

Reference permission matrix:

| Feature | super_admin | coordinator | data_entry | senior | viewer |
|---|---|---|---|---|---|
| Manage app users | Yes | No | No | No | No |
| Manage locations | Yes | Yes | Yes | No | No |
| Manage proctors | Yes | Yes | Yes | No | No |
| Import Excel | Yes | Yes | Yes | No | No |
| Export Excel | Yes | Yes | Yes | No | Yes |
| Create cycles | Yes | Yes | No | No | No |
| Run auto-assign | Yes | Yes | No | No | No |
| Manual assign | Yes | Yes | No | No | No |
| Lock session | Yes | Yes | No | No | No |
| Add block | Yes | Yes | No | No | No |
| Submit evaluation | Yes | Yes | No | Yes | No |
| Update attendance | Yes | Yes | No | Yes | No |
| View dashboard | Yes | Yes | Yes | Yes | Yes |
| View reports | Yes | Yes | Yes | Yes | Yes |

## 9. UI Pages & Screens

Core routes include:

- login
- dashboard
- cycles list/create/detail/clone
- sessions detail/assign/attendance/evaluations
- proctors list/detail/import/export
- locations tree/import
- reports hub
- settings pages

Additional settings routes should include:

- appearance settings
- i18n/translation management

Top-bar requirements on every major screen:

- language toggle
- theme toggle
- user menu
- responsive behavior and correct RTL/LTR placement

### Assignment Screen

This is the most important operational screen.

It must support:

- building navigation
- floor and room breakdown
- visual completion state
- manual assignment controls
- drag-and-drop swap flows
- ASSN manual-only treatment
- conflict warnings
- bilingual and responsive behavior
- completion indicators per building/floor
- tablet-friendly layout and acceptable mobile fallback

## 10. Clone System

Supported clone modes:

- structure only
- structure plus management roles
- full clone

The clone flow must support:

- choosing prior cycle
- selecting clone mode
- preview
- new dates

## 11. Waiting List Logic

Requirements:

- ranked by average rating
- statuses: waiting / promoted / removed
- support promotion after absence
- support ASSN manual filling
- support late-import re-ranking scenario

## 12. Swap System

Swap flow must support:

- replace by search
- replace from waiting list
- swap between assigned users

Validation must prevent:

- duplicate assignment in same session
- use of blocked users
- invalid capacity outcomes

## 13. Evaluation System

Rules:

- seniors evaluate proctors on their floor
- heads evaluate seniors in their building
- coordinators can evaluate broadly
- no self-evaluation
- one evaluation per evaluator/user/session
- editable until archival policy cutoff

## 14. Attendance System

Statuses:

- pending
- confirmed
- absent
- declined

Attendance flow must support:

- role-appropriate updates
- replacement suggestions from waiting list
- automatic promotion workflow when replacement is selected

## 15. Notification System

### Channels

Priority order:

1. WhatsApp
2. Email
3. In-app notifications
4. SMS fallback

Channel rationale:

- WhatsApp is primary because it is more realistic for proctor communication than email in this operating context

### Message Localization

Notifications must use each recipient's preferred language where available.

### WhatsApp Requirements

Support provider-based integration such as Twilio or equivalent, with configurable template names stored in settings.

Expected template categories:

- assignment notification
- evaluation reminder
- absence replacement

Each should exist in Arabic and English.

Reference template keys:

- `assignment_notification_ar`
- `assignment_notification_en`
- `evaluation_reminder_ar`
- `evaluation_reminder_en`
- `absent_replacement_ar`
- `absent_replacement_en`

## 16. Dashboard & Reports

Dashboard requirements:

- active cycle snapshot
- total proctors
- assignment progress
- pending evaluations
- building-level progress
- recent activity
- alerts and quick actions

Report types include:

- cycle summary
- building assignment
- attendance
- evaluation summary
- proctor performance
- waiting list
- block history
- activity log

All reports and exports should support bilingual presentation.

## 17. Tech Stack

### Frontend

- Next.js 14+ App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- next-intl
- next-themes
- TanStack Query
- React Hook Form
- Zod
- Framer Motion
- SheetJS
- next-pwa
- dnd-kit

### Backend

- Next.js route handlers / server actions where appropriate
- Prisma
- PostgreSQL
- role-based authentication compatible with Next.js version
- pdf-lib
- nodemailer
- bcryptjs
- Twilio or equivalent WhatsApp provider integration

### Infrastructure

- PostgreSQL hosting such as Neon
- Vercel deployment
- object/file storage for imports if needed
- transactional email provider
- WhatsApp provider integration such as Twilio or equivalent

## 18. Development Phases

### Phase 1 - Foundation

- app setup
- auth shell
- schema and migrations
- theme system
- i18n system
- app shell with sidebar/topbar/toggles
- bilingual locations foundation
- target duration: about 2 weeks

### Phase 2 - Proctors And Data

- proctor CRUD
- imports and exports
- profile/history
- block management
- target duration: about 2 weeks

### Phase 3 - Cycles And Assignment

- cycles and sessions
- auto-assignment
- assignment UI
- ASSN flow
- validation
- waiting list
- late-import re-ranking
- target duration: about 3 weeks

### Phase 4 - Clone System

- clone modes
- preview and date adjustments
- target duration: about 1 week

### Phase 5 - Evaluations And Attendance

- attendance workflows
- evaluation flows
- promotion suggestions
- block suggestion triggers
- target duration: about 1.5 weeks

### Phase 6 - Notification System

- bilingual email templates
- WhatsApp integration
- SMS fallback
- in-app notifications
- target duration: about 1.5 weeks

### Phase 7 - Reports And Dashboard

- dashboard widgets
- bilingual export headers
- Excel/PDF reporting
- activity log viewer
- target duration: about 1.5 weeks

### Phase 8 - PWA And Polish

- offline-friendly assignment viewing
- responsiveness audit
- accessibility audit
- reduced-motion support
- performance optimization
- end-to-end testing
- production deployment
- target duration: about 1 week

Total estimated duration: roughly 14 weeks.

## 19. Dynamic System Rules

Everything below should be configurable where appropriate:

- rating thresholds
- block trigger counts
- room capacity defaults
- language defaults
- theme defaults
- notification channel priority
- WhatsApp provider and templates
- sender identity and notification preferences

### Settings Examples

- `system.default_language`
- `system.default_theme`
- `distribution.min_rating_threshold`
- `distribution.bad_sessions_for_block`
- `notifications.primary_channel`
- `notifications.fallback_channel`
- `notifications.whatsapp_provider`

### No-Hardcode Checklist

- Does the value belong in DB/settings instead of code?
- Does the string exist in both Arabic and English?
- Does the UI work in both RTL and LTR?
- Does the component render correctly in dark and light modes?
- Does motion respect reduced-motion preferences?

## Working Note

This v3.0 spec should remain the detailed product reference until implementation begins to replace sections with verified code-backed reality.
