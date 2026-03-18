# Codex Prompt

Use this file when you want Codex to continue the ExamOps repository consistently across sessions.

## Full Prompt

```text
You are continuing a real repository for a product called ExamOps.

This repository already has planning and tracking documents. Your job is to inspect the current state, understand what has already been done, and continue the project professionally without breaking the existing direction.

Before doing anything else, read these files in this exact order:
1. AI_START_HERE.md
2. docs/examops-spec-v3.md
3. docs/examops-master-plan.md
4. docs/backlog.md
5. PROJECT_STATUS.md
6. docs/generated-output-review.md

These files are the source of truth.
Do not rely on any legacy generated artifacts, old prompt dumps, or assumptions that conflict with these docs.

Core system-wide rules:
- The system must support both Arabic and English.
- The system must be responsive on mobile, tablet, laptop, and desktop.
- Business-critical behavior must be dynamic and data-driven, not hardcoded.
- The system must support dark, light, and system theme modes.
- Notifications must account for WhatsApp, email, in-app, and SMS fallback.
- Build professionally for production, not as a prototype or demo.
- Keep architecture maintainable and scalable.

Your workflow every time:
1. Inspect the repository and read the docs.
2. Determine the current state of the project from code + docs.
3. Identify what has already been completed.
4. Identify the exact next task from docs/backlog.md and PROJECT_STATUS.md.
5. If code and docs disagree, follow the docs and mention the conflict.
6. Implement the next task end-to-end in the repository.
7. Keep schema, services, routes, validations, locales, theme system, and UI aligned.
8. After finishing, update:
   - PROJECT_STATUS.md
   - docs/backlog.md
   if progress changed.
9. End with a concise progress report.

Important execution behavior:
- If the project has not started yet, begin with the first implementation task in Slice 0.
- If the project is already in progress, do not restart or re-scaffold blindly. First inspect what exists, then continue from the current state.
- Reuse and extend the existing structure instead of replacing it unnecessarily.
- Do not hardcode business values that belong in the database, settings, or translation files.
- Add real code, not pseudo-code.
- Prefer clean separation of concerns:
  - Prisma/schema for data model
  - service layer for business logic
  - route handlers for transport
  - reusable UI/components for presentation
  - locale files for user-facing strings
  - theme/design tokens for visual system

Implementation priorities:
- Respect docs/examops-spec-v3.md for detailed product requirements.
- Respect docs/examops-master-plan.md for implementation direction.
- Respect docs/backlog.md for sequencing.
- Respect PROJECT_STATUS.md for current progress and recent decisions.

Definition of success for each run:
- You correctly understand current progress
- You continue from the right next step
- You implement meaningful, real progress
- You preserve bilingual, responsive, theme-aware, and dynamic-system rules
- You update the tracking docs so the next run can continue cleanly

At the start of your response:
- briefly summarize the current repo state
- say what exact task you will implement now

At the end of your response:
1. what you changed
2. what you verified
3. what remains next
4. any assumptions or blockers
```

## Short Prompt

```text
Continue the ExamOps repository from its current state.

Read first, in order:
1. AI_START_HERE.md
2. docs/examops-spec-v3.md
3. docs/examops-master-plan.md
4. docs/backlog.md
5. PROJECT_STATUS.md
6. docs/generated-output-review.md

Then:
- inspect the repo and determine current progress
- identify the next pending task
- continue implementation from there
- do not restart work already done
- preserve bilingual, responsive, theme-aware, and dynamic-system requirements
- update PROJECT_STATUS.md and docs/backlog.md when progress changes
- finish with a concise status summary
```

## Recommended Usage

- Use the full prompt for the first run in a session or after a long gap.
- Use the short prompt for normal day-to-day continuation.
