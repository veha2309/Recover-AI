# Phase Three — Closed-loop pilot readiness

Phase Three adds an operational control plane while preserving the zero-cost, test-only boundary.

## Delivered

- Durable SQLite approval requests with optimistic concurrency and reviewer evidence.
- Durable promise/reconciliation jobs with idempotent due-job processing.
- Razorpay-compatible HMAC-SHA256 webhook verification.
- Provider event deduplication and replay protection.
- A provider-confirmed ledger that credits revenue only from signed `payment.captured` or `payment_link.paid` events.
- A signed local webhook replay command for offline development.
- An Operations screen for approvals, scheduled work, provider events, and confirmed revenue.
- Offline operation without paid hosting, messaging, databases, or cloud models.

## Local closed-loop demo

```bash
npm run dev
npm run replay:webhook
```

Then open **Operations**. The replay uses a development-only local secret when none is configured. Production builds require `RAZORPAY_WEBHOOK_SECRET` explicitly.

## Security boundaries

- Only `rzp_test_` keys are accepted by the payment-link adapter.
- Webhook signatures are compared in constant time.
- Duplicate provider event and payment IDs cannot create duplicate ledger credits.
- Payment-link creation does not count as recovered revenue.
- High-value and protected cases remain subject to human approval.
- No production charging or real customer messaging path exists.

## Remaining pilot extensions

- Configure the webhook URL in the Razorpay test dashboard or a free local tunnel.
- Correlate additional subscription and invoice event shapes.
- Add role-based operator/approver identities.
- Replace manual scheduler ticks with a local long-running worker.
- Add sandbox email delivery and reply classification.
