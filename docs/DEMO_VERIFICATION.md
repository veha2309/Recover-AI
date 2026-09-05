# Live demo verification — 5 September 2026

URL: https://recover-ai-pvjh.onrender.com

Verified in the authenticated live browser after deploying the batched request implementation:

- Model: `gemini-3.5-flash-lite`.
- 4 validated live decisions; 16 explicitly recorded deterministic fallbacks.
- 20 cases, four recovery motions, simulation payment mode.
- Audit integrity passed: 268 hash-linked events and 40 paired traces.
- Unsafe executions: 0. Ledger violations: 0.
- Scenario net recovery: INR 64,857.70; fixed baseline: INR 49,766.25. These are simulated values, not real recovered revenue.

During workflow rehearsal, the dynamic portfolio generated five cases and a customer dispute escalated automatically. The Evaluation and Operations screens loaded successfully. No Razorpay provider-confirmed payment was verified.

The initially configured `gemini-2.5-flash` returned HTTP 404. `gemini-3.5-flash` produced one valid decision but subsequent attempts encountered timeouts, HTTP 429 and HTTP 503. The successful verification above used Flash Lite and one four-case request. Future responses still depend on provider availability and quota.

Use RECORDING.md for the video flow. Export the successful run manually before restarting the free service; browser automation could not complete the attachment download. This record is a verification summary, not a replacement for the full audit export.
