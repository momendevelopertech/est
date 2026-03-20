# ExamOps Staging Dry-Run Report (2026-03-20)

## Scope

- Phase 10 Step 1 (staging dry-run simulation)
- Production-like execution on built app (`next build` + `next start`)
- Notification providers validated with configuration-compatible simulation tokens

## Environment & Configuration Shape

- App environment contract validated from `.env`:
  - `DATABASE_URL`
  - `AUTH_SECRET`
  - optional `DIRECT_DATABASE_URL`
- Notification settings shape validated in DB:
  - email keys (`email_enabled`)
  - WhatsApp keys (`whatsapp_enabled`, `whatsapp_provider`, `whatsapp_api_key`, `whatsapp_sender_id`, `whatsapp_account_sid`)
  - SMS keys (`sms_enabled`, `sms_provider`, `sms_api_key`, `sms_sender_id`, `sms_account_sid`)
- Provider connectivity simulation used:
  - WhatsApp `meta_whatsapp_cloud` with `simulate_success` / `simulate_failure`
  - SMS fallback verifier coverage already exercises provider-failure and config-missing paths

## Commands Executed

```bash
npm run db:validate
npm run build
npm run test:integration
node tmp/verify-phase9-step4.mjs
node tmp/verify-production-audit.mjs
```

## Results

- App boot and production build:
  - `npm run build` passed
  - App started and served routes in `next start` mode during suites
- API flow coverage:
  - Assignment integration suite passed (`auto-assign`, `swap`, `waiting-list promotion`)
  - Reporting integration suite passed (`exports`, `metrics`)
  - Notification integration suite passed (`triggers`, `fallback`, `preferences`)
- Notification channel behavior:
  - WhatsApp integration verifier passed (`tmp/verify-phase9-step4.mjs`)
  - SMS fallback verifier passed (inside `npm run test:integration`)
  - Preference enforcement and fallback behavior passed
- Dashboard/reports/UI and quality checks:
  - Production audit passed (`tmp/verify-production-audit.mjs`)
  - Locale parity, PWA endpoints/assets, RTL/LTR rendering, responsive/theme/a11y checks passed
  - Error-leak checks passed

## Notes

- `tmp/verify-phase9-step4.mjs` was aligned with current delivery order so WhatsApp verification runs with email disabled for that scenario.
- Dry-run used provider-compatible mock tokens for safe validation. Real external provider credential validation remains required in staging before live release.
