# Phase Two — Operational recovery

Phase Two turns the simulator into demonstrably real, bounded execution without enabling production money movement.

## Implemented

- One live local-model decision for each revenue motion, with schema validation, bounded repair, timeouts, and per-case fallback.
- Visible live-versus-fallback counts; evaluation never disguises fallback decisions as model output.
- A genuine Razorpay test-mode payment link for the hero checkout case when `rzp_test_` credentials are configured.
- Sanitized Razorpay action ID, URL, execution mode, and policy evidence in the hash-linked audit stream.
- A five-minute-safe inference budget: four representative live decisions and deterministic handling for the remainder.

## Next operational increments

- Human approval queue for high-value and disputed cases.
- Webhook-backed Razorpay test payment status reconciliation.
- Resumable scheduled jobs and promise-due monitors.
- Run history and cohort comparison across held-out seeds.
- Template-level outreach experiments with contact-frequency controls.

Production charging and real customer outreach remain explicitly out of scope.
