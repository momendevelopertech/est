# Proposed Operations Upgrade Prompt

## Purpose

This prompt is prepared for the next implementation phase if management approves the operational upgrade.

It is intentionally explicit so the work can start with minimal ambiguity.

---

## Prompt

You are a senior product engineer and operations systems architect working on the `ExamOps` dashboard.

Your task is to implement an `Operations Intake and Review Upgrade` for EST workflows.

## Non-negotiable constraints

- Do not break any existing business logic.
- Do not rewrite the assignment engine.
- Do not remove or change the existing workflows for:
  - cycles
  - sessions
  - assignments
  - waiting list
  - attendance
  - evaluations
  - swaps
- Preserve current APIs wherever possible.
- Prefer additive refactoring over replacement.
- Keep compatibility with:
  - React
  - Next.js
  - Tailwind
  - Prisma

## Current system context

The current product already supports:

- location hierarchy
- proctor master data
- cycles and sessions
- operational assignment roles
- assignment exports
- import templates

However, real EST source files come from mixed operational sources and are not standardized.

The analyzed files showed four major source families:

1. `Proctor master lists`
2. `Location and room capacity plans`
3. `Operational staffing sheets`
4. `Final staffing output files`

The current gap is not the core assignment logic.

The current gap is the `operational data intake and review layer`.

## Main objective

Implement a new layer that allows the system to safely ingest messy operational files and convert them into the canonical internal format already expected by the current codebase.

## Phase goals

### Goal 1: File normalization layer

Add a normalization layer that can accept operational source files and classify them into canonical internal import families.

Target canonical families:

- `locations_master`
- `proctors_master`
- `session_room_plan`
- `session_staffing_roster`

Do not directly write raw imported data into the final operational tables before review.

### Goal 2: Column mapping flow

Implement a mapping flow that allows an operator to map incoming columns to canonical system fields.

Requirements:

- support reusable source-to-canonical mapping definitions
- support common header aliases
- show unmapped required fields clearly
- keep the final internal output canonical

### Goal 3: Review-before-import flow

Before import is finalized, show a review screen that clearly separates:

- matched existing records
- new records to create
- conflicts
- invalid rows
- skipped rows
- transformed values

This review layer should exist for both:

- proctors
- locations

and later be extensible to:

- session room plans
- session staffing rosters

### Goal 4: Session room plan workflow

Add a dedicated operational workflow for `session room planning`.

This is not the same as the static location hierarchy.

The new workflow should support:

- session
- exam type
- building
- floor
- room
- class capacity
- exam capacity
- admitted EST1 count
- admitted EST2 count
- special room flags such as:
  - control room
  - paper store
  - inactive for session

Preserve the current location hierarchy model.

Treat this as an operational planning layer on top of the existing location master data.

### Goal 5: Role alias normalization

Add a role alias dictionary so the system can normalize incoming operational labels into existing internal role keys.

Examples of aliases to support:

- `Head`
- `Head of EST`
- `Control room assistant`
- `Control`
- `Senior`
- `External Senior`
- `Senior External`
- `Roaming`
- `Proctor`

Canonical targets:

- `building_head`
- `control_room`
- `floor_senior`
- `roaming_monitor`
- `room_proctor`

Do not invent new assignment logic in this phase.

### Goal 6: Final center bundle export

Add a field-operations export format that groups output in a way similar to the final staffing workbooks used outside the system.

The export should be usable by operations teams and should include, where available:

- cycle
- session
- exam type
- governorate
- university or test center
- building
- floor
- room
- role
- person name
- phone
- source organization
- EST1 room reference
- EST2 room reference

Prefer adding this as a specialized export view rather than changing existing generic exports.

## Required engineering approach

- Inspect and reuse the current service layer.
- Reuse the current role definitions and scoped assignment model.
- Keep current imports working.
- Add new operational intake capability in parallel.
- Prefer modular utilities for:
  - file classification
  - header normalization
  - role alias matching
  - preview generation
  - canonical row transformation

## UI requirements

Build a practical operations-first UI.

The new flow should feel like:

1. upload file
2. detect type
3. map columns
4. preview normalized data
5. confirm import

Do not overcomplicate the UI.

It should be clear enough for data-entry and operations teams.

## Output requirements

Produce:

1. implementation plan
2. schema impact analysis
3. file-by-file code changes
4. verification steps
5. final summary of:
   - what stayed unchanged
   - what was added
   - what business value was unlocked

## Success criteria

The work is successful if:

- existing assignment logic still works
- existing import flows still work
- new operational source files can be normalized safely
- the operator can review data before import
- session room plans can be represented clearly
- final exports are closer to the real files used in the field

---

## Expected implementation mindset

Focus on making the system easier for real operations teams without destabilizing the platform.

Treat the current codebase as a strong foundation.

The mission is to bridge the gap between messy field data and clean internal business logic.
