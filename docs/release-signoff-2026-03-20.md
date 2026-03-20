# ExamOps Release Sign-Off (Simulation) - 2026-03-20

Based on `docs/deployment-checklist.md`.

## 1. Pre-Deployment Gates

- [x] Working branch aligned with `main` workflow
- [x] Database migrations reviewed and deployable
- [x] Required environment variables validated for app startup
- [x] Notification provider setting keys present in DB
- [x] Locale files synchronized (`en`/`ar`)
- [x] PWA assets present
- [x] No unresolved implementation TODO in Phases 0-9

## 2. Required Verification Commands

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm run test:integration`
- [x] `node tmp/verify-production-audit.mjs`

## 3. Database & Seed Checks

- [x] `npm run db:validate`
- [x] Migrations status up-to-date (`prisma migrate status`)
- [x] Seeded app users authenticate in integration/audit scripts
- [x] Seed data includes notification and monitoring runtime keys

## 4. Staging Sign-Off (Simulation)

- [x] Login/logout flow validated by integration and audit scripts
- [x] Dashboard/sessions/reports/notifications routes render in `en` and `ar`
- [x] Theme modes and reduced-motion checks passed
- [x] Notification trigger smoke checks passed:
  - [x] Email path
  - [x] WhatsApp path
  - [x] SMS fallback path
  - [x] User preference enforcement
- [x] Export endpoints validated (CSV/Excel/PDF)
- [x] PWA install/service-worker assets and runtime checks passed

## 5. Production Rollout (Simulation)

- [x] Release record template prepared
- [x] Zero-downtime + migration sequence validated as runbook steps
- [x] Post-deploy smoke steps mapped to existing verification scripts

## 6. Post-Deploy Smoke Checks (Simulated via local production run)

- [x] `/login` reachable
- [x] Authenticated access to dashboard/sessions/reports/notifications
- [x] PWA endpoints reachable (`/manifest.webmanifest`, `/sw.js`)
- [x] Notification trigger activity logs produced during integration suites
- [x] Export activity logs produced during reporting suites
- [x] API error/non-leaky error checks passed

## 7. Rollback Plan

- [x] Rollback checklist documented
- [x] Migration rollback/forward-fix decision point documented
- [x] Release owner + communication channel explicitly required by checklist

## 8. Release Record (To be finalized at push time)

- Release version: `v0.1.0` (candidate)
- Commit SHA: `5a8986f`
- Migration IDs:
  - `20260320130000_phase9_email_templates`
  - `20260320183000_phase9_in_app_notifications`
  - `20260320220000_phase9_notification_preferences`
- Deploy start/end time: `TO_BE_FILLED_AT_DEPLOY_TIME`
- Verifier commands + results: `all passing in simulation`
- Post-deploy smoke status: `simulated pass; production run pending deploy window`
- Rollback needed: `no`
- Owner sign-off: `release-ops pending`
