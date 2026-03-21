# EST Operations Data Blueprint

## What the provided files actually represent

The external files are not one template. They fall into four operational data families:

1. `Proctor master lists`
   - Examples: `Damietta Staff 19-11-2025.xlsx`, `FUE with Insurance Number and full names -2026.xlsx`, `Al Ryada- Jan 2026.xlsx`
   - Purpose: identity, contact, source organization, bank details, preferred city/test center, and sometimes role.

2. `Location and room capacity plans`
   - Examples: `1-AAST-EST-ALEX-Jan2026.docx`, `2-AAST-EST-HELIOPOLIS-Jan-2026(1).docx`, `3-AAST-EST-SAMRT VILLAGE -Jan-2026(1).docx`, `EST - Sadat City -Jan-2026.xlsx`, `Futur_EST_Jan-2026.xlsx`, `Jan-2026_Damitte.xls`
   - Purpose: governorate -> university -> building -> floor -> room, plus class capacity, exam capacity, and EST1/EST2 admitted counts.

3. `Operational staffing rosters`
   - Examples: `UK List.xlsx`, `Damietta Staff 19-11-2025.xlsx` sheet variants
   - Purpose: who will work as `Head`, `Control room assistant`, `Senior`, `Roaming`, `Proctor`, and similar site-level roles.

4. `Final room-role allocations`
   - Example: `Final EST JAN 2026 مؤمن.xlsm`
   - Purpose: complete operational output that links a person to:
     - role
     - center
     - building
     - room for `EST1`
     - room for `EST2`
     - organization/source

## Recurring business entities found across the source files

These map cleanly to the current system:

- `Governorate`
- `University / Test center owner`
- `Building`
- `Floor`
- `Room`
- `Proctor pool member`
- `Operational role`
- `Session`
- `Assignment`

The source files repeatedly express the same hierarchy:

`Governorate -> University/Test Center -> Building -> Floor -> Room`

And the same staffing model:

`Head / Control / Senior / Roaming / Proctor`

## Role mapping to current system

The current logic already supports the core roles. The clean mapping is:

| Source label | Current role key | Current scope |
| --- | --- | --- |
| Head / Head of EST | `building_head` | Building |
| Control room assistant / Control | `control_room` | Building |
| Senior / External Senior | `floor_senior` | Floor |
| Roaming | `roaming_monitor` | Floor |
| Proctor | `room_proctor` | Room |

Operational-only rows such as `Validation`, `In/out`, `Printing`, `Preparing`, and `Service` appear in some source files, but they are not part of the current assignment engine. They should stay outside the main assignment workflow unless a dedicated operational-support role set is added later.

## Recommended unified import model

Instead of forcing every external sheet into one giant file, the best stable model is four canonical templates:

1. `locations-master`
   - One row per room hierarchy path.
   - Used to create or update governorates, universities, buildings, floors, and rooms.

2. `proctors-master`
   - One row per person.
   - Used to import and deduplicate proctors from universities, Sphinx pools, or external lists.

3. `session-room-plan`
   - One row per room per session.
   - Holds room usage for `EST1` / `EST2`, exam capacity, admitted counts, and special flags like paper store rooms.

4. `session-staffing-roster`
   - One row per assigned worker per session/building/floor/room.
   - Used for final import/export between operations and the system.

## Best workflow for the current system

The safest workflow, while preserving the existing business logic, is:

1. Import or manually create the `location hierarchy`.
2. Import or manually add `proctors`.
3. Create the `cycle` and `sessions`.
4. Attach the active `session buildings`.
5. Assign proctors manually or by the current assignment logic.
6. Export the final staffing list for operations review.

This keeps the current system logic intact while letting external Excel/Word files be normalized before entry.

## What is already supported well

- Proctor master import from a canonical file.
- Location hierarchy import from a canonical file.
- Session-level assignment export.
- Attendance and evaluation export.
- Manual assignment to building, floor, or room based on role scope.

## Current gaps between source files and the system

These gaps came directly from the analyzed files:

1. External files are multi-format and inconsistent.
   - `.docx`, `.xlsx`, `.xlsm`, `.xls`
   - Some workbooks have multiple tabs with different purposes.

2. Source columns are not standardized.
   - Same meaning appears under different headers.
   - Some sheets contain identity + bank + role + center in one file.

3. Final staffing files contain roles not yet represented in the assignment engine.
   - `Validation`
   - `In/out`
   - `Service`
   - `Preparing`
   - `Printing`

4. Room planning data is session-specific.
   - The current locations import creates the master hierarchy.
   - It does not yet ingest a session-by-session room-capacity plan.

## Practical implementation plan

### Phase 1: Normalize without changing business logic

- Keep current role keys and assignment workflow.
- Standardize role labels to the terms used in operations files.
- Keep imports canonical even if the original source is messy.
- Use exported assignment files as the official final staffing output.

### Phase 2: Add adapters around the current system

- Build file normalizers for:
  - university staff sheets
  - Sphinx staffing lists
  - room capacity workbooks
  - AAST room-provision documents
- Convert them into canonical templates before import.

### Phase 3: Close the last operational gap

- Add a dedicated `session-room-plan` import.
- Optionally add support roles for:
  - validation
  - in/out
  - service
- Only if operations confirms these belong inside the main assignment engine.

## Recommended data ownership model

- `Locations team` owns hierarchy and room capacity files.
- `Proctor operations team` owns people master files.
- `Distribution team` owns final staffing roster files.
- `System exports` should become the source of truth after assignment lock.

## Why this fits the current app

This plan does not require changing:

- core assignment logic
- APIs
- database structure
- current workflow order

It improves the system by making the incoming real-world data easier to normalize into the entities the app already understands.
