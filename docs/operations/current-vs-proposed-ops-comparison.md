# Current System vs Proposed Operations Upgrade

## Purpose

This document compares:

- the current system as implemented today
- the current business logic and code behavior
- the proposed operational upgrade after analyzing the real EST source files

The goal is to help management decide whether the next phase should be approved.

## Executive summary

The current system is structurally sound.

It already supports:

- location hierarchy
- proctor master data
- cycles and sessions
- assignment roles and scoped assignment logic
- waiting list, attendance, evaluations, swaps
- import templates
- export flows

However, the real operational files reveal that the business process in the field is broader than the current import layer.

The current system expects `clean canonical CSV input`.

The real operation works with:

- Excel sheets from universities
- Excel sheets from Sphinx and external pools
- multi-tab workbooks
- Word room plans
- final staffing rosters that mix people, rooms, roles, buildings, and EST1/EST2 outputs

So the main gap is not the assignment engine itself.

The main gap is the `operational data intake and review layer`.

## Section 1: Current system

### 1.1 What exists today in the product

The current system already has these major modules:

- `Locations`
- `Proctors`
- `Cycles`
- `Sessions`
- `Assignments`
- `Waiting list`
- `Attendance`
- `Evaluations`
- `Reports`
- `Import templates`

### 1.2 Current business entities

The current codebase models:

- `Governorate`
- `University`
- `Building`
- `Floor`
- `Room`
- `User` as the proctor/staff pool
- `Cycle`
- `Session`
- `SessionBuilding`
- `Assignment`
- `WaitingList`
- `Attendance`
- `Evaluation`
- `AssignmentRoleDefinition`

This is a valid foundation for EST operations.

### 1.3 Current assignment roles in the system

The current logic already supports the most important operational roles:

- `building_head`
- `control_room`
- `floor_senior`
- `roaming_monitor`
- `room_proctor`
- `assn_manual`

These map well to real-life roles found in the files:

- `Head`
- `Control room assistant`
- `Senior`
- `Roaming`
- `Proctor`

### 1.4 Current import behavior

#### Locations import

Current code supports a canonical CSV hierarchy import.

Expected path per row:

- governorate
- university
- building
- floor
- room

Strengths:

- deterministic
- safe
- reusable
- respects hierarchy validation

Limitations:

- CSV only
- no session-specific room plan
- no intake for Word-based room provision files
- no column mapping UI

#### Proctors import

Current code supports a canonical CSV people import.

Matching logic is based mainly on:

- phone
- email
- national ID

Strengths:

- deduplication exists
- bilingual fields exist
- governorate link exists

Limitations:

- CSV only
- no flexible import for university-native Excel files
- no file classification
- no pre-import review workflow

### 1.5 Current export behavior

The system already exports:

- assignments
- attendance
- evaluations

Strengths:

- operational export exists
- CSV / Excel / PDF options already exist in several areas

Limitations:

- exports are system-shaped, not always field-ops-shaped
- no dedicated final `center bundle export` that matches the final staffing files from real operations

### 1.6 Current seed and sample data

Before the recent update, seed data was technically valid but operationally abstract.

After the recent update, seed data is now closer to the real operation:

- AAST Abu Qir
- AAST Sheraton
- AAST Smart Village
- FUE
- HUE
- Al Ryada

This improved understanding and testing, but it is still only representative sample data, not a true ingestion pipeline for the external files.

## Section 2: What the real source files revealed

After analyzing the provided files, the incoming data is not one standard format.

It falls into four different operational families.

### 2.1 Proctor master lists

Examples:

- university staff lists
- Sphinx-owned staffing lists
- external pool lists

These files usually contain:

- Arabic name
- English name
- phone
- email
- national ID
- insurance number
- bank data
- preferred city
- preferred test center
- source organization

### 2.2 Location and room planning files

Examples:

- AAST Word files
- Sadat and Damietta room sheets
- Future University hall plans

These usually contain:

- center or campus
- building
- floor
- room
- class capacity
- exam capacity
- EST1 admitted count
- EST2 admitted count
- special rooms like paper stores or control rooms

### 2.3 Operational staffing sheets

Examples:

- UK marking list
- Damietta staffing variants

These usually contain:

- person
- role
- governorate
- building
- location
- sometimes transfer or banking details

### 2.4 Final staffing output files

Example:

- `Final EST JAN 2026 مؤمن.xlsm`

These files combine:

- person
- role
- center
- building
- EST1 room
- EST2 room
- source organization

This is the clearest signal that the real operation needs a better `reviewable staging layer` before final import or final export.

## Section 3: Comparison table

| Area | Current system | Proposed upgrade |
| --- | --- | --- |
| Core assignment logic | Already exists and works | Keep as is |
| APIs | Stable | Keep as is wherever possible |
| Database model | Strong enough for core EST operations | Keep as is in phase 1 |
| Location import | Canonical CSV only | Add normalization and room-plan intake around it |
| Proctor import | Canonical CSV only | Add normalization and mapping around it |
| Source file support | Clean CSV expected | Real-world Excel/Word adapters |
| File review | Limited | Add normalize -> review -> import flow |
| Role mapping | Fixed internal keys | Add role aliases from real files |
| Session room planning | Not a dedicated workflow yet | Add dedicated session room plan layer |
| Final operations export | Generic system export | Add center/building bundle export |
| Usability for operations team | Medium | High |
| Suitability for mixed source files | Low | High |

## Section 4: What should remain unchanged

The proposed upgrade should not change:

- core business logic of assignments
- current APIs unless absolutely necessary
- current database structure in phase 1
- existing workflows for cycles, sessions, attendance, waiting list, swaps, and evaluations

In other words:

the proposal is an `operational intake and review upgrade`, not a rewrite.

## Section 5: What should be added

### 5.1 Import wizard

Instead of uploading only a strict CSV file, the system should support a guided entry path:

1. upload file
2. detect file type
3. detect likely template family
4. map columns
5. preview normalized rows
6. import approved rows

Why this matters:

because the real source files are inconsistent even when they contain valid operational data.

### 5.2 Column mapper

The same concept appears under different headers across source files.

Examples:

- `Mobile number`
- `Mobile`
- `Phone`

Examples:

- `Preferred test center`
- `Test Center Name`
- `Location`

The system should allow temporary or saved mapping from source headers to canonical system fields.

### 5.3 Session room plan module

This is the biggest business gap.

Today, the system supports:

- master location hierarchy

But the real operation also needs:

- session-by-session room usage
- EST1 / EST2 admitted counts
- room exam capacity
- special room flags

This should be a distinct operational layer because:

- a room can exist permanently
- but its usage and capacity planning changes per session

### 5.4 Role alias dictionary

The real files contain role variations such as:

- `Head`
- `Head of EST`
- `Control room assistant`
- `Senior`
- `External Senior`
- `Senior External`

The system should translate these aliases into the canonical internal role keys.

### 5.5 Review screen before import

Before data is written, the operator should review:

- new people
- matched people
- duplicate conflicts
- unknown locations
- unsupported roles
- rows skipped or transformed

This will reduce data-entry fear and import mistakes.

### 5.6 Final center bundle export

Operations needs a final field-ready export, usually grouped by:

- center
- building
- floor
- room
- role
- person
- phone
- EST1 / EST2 reference

This is closer to the final staffing workbooks used outside the system.

## Section 6: Business logic impact analysis

### 6.1 Risk to existing business logic

Low, if implemented correctly.

Reason:

the proposed work can be added around the current model rather than inside the assignment engine.

### 6.2 Code impact

Mostly additive.

Expected areas:

- import services
- import templates
- operational normalization utilities
- UI review screens
- export formatting layer

Minimal impact areas:

- assignment service
- attendance service
- waiting list service
- evaluation service

### 6.3 Database impact

Phase 1 can avoid schema changes.

If later needed, optional schema additions could include:

- saved import mappings
- session room plans
- import staging batches

But these are not mandatory for the first approved phase.

## Section 7: Implementation recommendation

### Recommended phase order

#### Phase 1

- add detailed operational documentation
- align sample templates and seeds with real operations
- define canonical import families

Status:

already started

#### Phase 2

- build file normalization layer
- build column mapping UI
- build review-before-import flow

#### Phase 3

- add session room plan workflow
- add final center bundle export

#### Phase 4

- optional support for additional operational roles such as:
  - validation
  - in/out
  - service
  - printing
  - preparing

Only if business confirms these should enter the main assignment model.

## Section 8: Management decision framing

### If management approves nothing

The system remains technically solid, but operations will keep doing manual normalization outside the product.

Result:

- more Excel work outside the system
- more dependency on manual cleanup
- less trust in direct imports

### If management approves the proposed upgrade

The system becomes the operational source of truth for:

- people master data
- room planning intake
- staffing distribution review
- final center-level outputs

Result:

- fewer manual transformations
- faster onboarding of new centers
- lower operational friction
- better traceability and auditability

## Final conclusion

The current system is not wrong.

It is already a strong internal operations platform.

What it lacks is the layer that translates messy real-world EST files into the clean internal structure the product already expects.

So the recommendation is not to rebuild the product.

The recommendation is to approve a focused operational upgrade:

- normalize
- review
- import
- export in field-ready format

That path gives the highest business value with the lowest technical risk.
