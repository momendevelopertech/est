# ExamOps Deployment Checklist

Use this checklist before every production release.

## 1. Pre-Deployment Gates

- [ ] Working branch is up to date with mainline and review is complete
- [ ] Database migrations are reviewed and reversible
- [ ] Required environment variables are defined for target environment
- [ ] Notification provider settings are present in DB (`email`, `whatsapp`, `sms`)
- [ ] Locale files are synchronized (`src/locales/en.json`, `src/locales/ar.json`)
- [ ] PWA assets are present (`manifest`, `sw.js`, icons, offline page)
- [ ] No unresolved TODOs for the release scope

## 2. Required Verification Commands

Run from repository root:

```bash
npm run typecheck
npm run lint
npm run build
npm run test:integration
node tmp/verify-production-audit.mjs
```

Release is blocked if any command fails.

## 3. Database & Seed Checks

- [ ] `npm run db:validate` passes
- [ ] `npm run db:deploy` applied successfully in staging
- [ ] Seeded app users can authenticate in staging
- [ ] New schema changes are backward compatible with current app version during rollout window

## 4. Staging Sign-Off

- [ ] Login/logout works for at least `super_admin` and `viewer`
- [ ] Dashboard, sessions, reports, notifications routes render in `en` and `ar`
- [ ] Theme modes (`light`, `dark`, `system`) are functional
- [ ] Notification trigger smoke checks pass:
  - [ ] Email path
  - [ ] WhatsApp path
  - [ ] SMS fallback path
  - [ ] User preference enforcement path
- [ ] Export endpoints return valid CSV/Excel/PDF artifacts
- [ ] PWA install prompt appears on supported browsers
- [ ] Service worker registration succeeds without blocking critical API reads

## 5. Production Rollout

- [ ] Create release tag and deployment record (commit SHA + migration IDs)
- [ ] Deploy application with zero-downtime strategy
- [ ] Apply production migrations using `npm run db:deploy`
- [ ] Run post-deploy smoke checks (below) within 15 minutes

## 6. Post-Deploy Smoke Checks

- [ ] `GET /login` returns 200
- [ ] Authenticated access to `/dashboard`, `/sessions`, `/reports`, `/notifications`
- [ ] `GET /manifest.webmanifest` and `GET /sw.js` return 200
- [ ] One controlled notification trigger recorded in activity log
- [ ] One controlled export action recorded in activity log
- [ ] Error-rate and latency dashboards are within normal range

## 7. Rollback Plan

- [ ] Previous stable artifact is available for immediate rollback
- [ ] Rollback migration strategy is reviewed (or safe forward-fix plan documented)
- [ ] Team owner for rollback decision is assigned for release window
- [ ] Communication channel for release incident is active

## 8. Release Record Template

Fill and store with release notes:

- Release version:
- Commit SHA:
- Migration IDs:
- Deploy start/end time:
- Verifier commands + results:
- Post-deploy smoke status:
- Rollback needed: yes/no
- Owner sign-off:
