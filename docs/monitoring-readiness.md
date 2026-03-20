# Monitoring Readiness (Phase 10 Step 3)

## Purpose

Define production-ready monitoring signals without requiring an external monitoring vendor at implementation time.

## Structured Runtime Signals

- `monitoring_api_error`
  - emitted for unexpected API errors captured by route error handlers
  - includes scope, code/status (if present), message, stack snippet, timestamp
- `monitoring_notification_failure`
  - emitted for notification delivery failures across:
    - email
    - WhatsApp
    - SMS
  - includes channel, reason, provider, status code, recipient/source metadata
- `monitoring_alert`
  - emitted when failure/error counts cross configured thresholds in a rolling window
  - currently supports:
    - `api_error_rate`
    - `notification_failure_rate`

## Database Activity Log Signals

- `api_error` (`entityType: api_error`)
- `notification_delivery_failed` (`entityType: notification_delivery`)
- `monitoring_alert` (`entityType: monitoring`)
- Existing channel-specific signals remain in place:
  - `whatsapp_failed`
  - `sms_failed`

## Alert Threshold Settings (DB-Driven)

Configured through `settings`:

- `monitoring.api_error_alert_threshold` (default `5`)
- `monitoring.api_error_alert_window_minutes` (default `5`)
- `monitoring.notification_failure_alert_threshold` (default `5`)
- `monitoring.notification_failure_alert_window_minutes` (default `10`)

These thresholds are read dynamically at runtime by `src/lib/monitoring/service.ts`.

## Recommended External Alert Wiring

Forward the structured logs to your observability stack (Datadog, Grafana, CloudWatch, etc.) and alert on:

1. Any `monitoring_alert` event (high priority).
2. Bursts of `monitoring_api_error` by scope.
3. Bursts of `monitoring_notification_failure` by channel/provider.

## Verification Script

Run:

```bash
node tmp/verify-phase10-step3.mjs
```

This verifies:

- monitoring module presence
- API error hook wiring
- notification failure hook wiring
- monitoring threshold settings availability in DB
