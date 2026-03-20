# AI Start Here

Read this file first before continuing any work on ExamOps.

## Purpose

This repository is actively in production implementation.

Do not continue from any old generated markdown dump.

The current source of truth is:

1. `docs/examops-spec-v3.md`
2. `docs/examops-master-plan.md`
3. `docs/backlog.md`
4. `PROJECT_STATUS.md`

If you need the reusable Codex continuation prompt, see:

- `CODEX_PROMPT.md`

## Mandatory System-Wide Rules

- The system must support both Arabic and English
- The system must be responsive on mobile, tablet, laptop, and desktop
- Business-critical behavior must be dynamic and data-driven, not hardcoded
- Auditability matters for sensitive operations
- Excel import/export is a core feature
- Dark, light, and system theme support is required
- Notification design must account for Email, WhatsApp, in-app, and SMS fallback

## Important Execution Rule

If you find old artifacts such as prompt dumps or incomplete generated markdown, do not treat them as implementation truth.

Use them only as loose reference if they still exist.

## Current Project State

- Production-grade Next.js + Prisma codebase is running on Neon
- Phases 0 through 8 are fully complete and verified
- Phase 9 (notifications, preferences, PWA, and production-readiness verification) is fully complete and verified
- Phase 10 (release operations) is in finalization with dry-run, CI gating, monitoring, and release-signoff simulation completed
- Deployment checklist is documented under `docs/deployment-checklist.md`

## Next Recommended Task

Continue with:

1. Perform live release-window provider credential validation in staging/production smoke flow
2. Execute production deployment from `main` using `docs/deployment-checklist.md`
3. Run post-release retrospective and capture follow-up fixes

## Files To Read Next

- `docs/examops-spec-v3.md`
- `docs/examops-master-plan.md`
- `docs/backlog.md`
- `PROJECT_STATUS.md`
