# Phase Five — Gemma 3 and submission integrity

Phase Five makes the dynamic recovery workflow credible under judging scrutiny. It uses the locally installed `gemma3:latest` model for bounded diagnosis and action proposals while keeping money, policy, execution, and evaluation deterministic.

## Model configuration

- Model: Gemma 3 4.3B, Q4_K_M, served by Ollama.
- Default endpoint: `http://127.0.0.1:11434`.
- The app overrides the model's sampling default with temperature `0` for repeatable structured decisions.
- Model output is validated against a strict action schema. Confidence values returned as percentages are normalized to basis points.
- Ollama timeout, invalid JSON, or unavailable service produces a recorded deterministic fallback; it never stops the portfolio.
- Override the model with `OLLAMA_MODEL` without changing orchestration.

The 131,072-token model context is more than sufficient, but RecoverAI deliberately sends compact case evidence. A larger prompt would increase latency and expose unnecessary data without improving the bounded task.

## Agent/evaluator separation

Latent scenario labels are no longer part of the agent context. Gemma and the fallback receive only observable case fields, evidence, risk flags, permissions, balances, history, and eligible actions. Ground-truth cause, expected best action, and counterfactual outcomes remain evaluator-only.

The evaluation layer compares the resulting decision with those hidden labels after execution. The UI reports live-Gemma and fallback cohorts separately and displays `hiddenLabelsExposed: false`.

## Execution integrity

A Razorpay test payment link may be attached only when the validated, policy-authorized action is `CREATE_PAYMENT_LINK`. If the model selects another action, supplied payment-link evidence is ignored and the case remains simulated. The portfolio integration badge is derived from actual case execution evidence, not from an attempted adapter call.

The UI distinguishes:

- live Gemma decisions from deterministic fallbacks;
- simulated scenario recoveries from provider-confirmed payments;
- Razorpay test actions from simulations;
- gross recovery from net lift over the fixed baseline.

## Current evidence

A verified local run on the 20-case demo portfolio completed in about 19 seconds with 4 live Gemma decisions and 16 deterministic fallbacks. The live cohort achieved a 75% appropriate-action rate in that run. Gemma did not authorize a payment link, so Razorpay execution was correctly reported as false. This is intentional: the integration is never forced merely to make the demo look active.

Automated coverage verifies hidden-label isolation and rejects mismatched external-tool evidence. The full suite currently contains 20 passing tests, and lint plus the optimized production build pass.

## Remaining production gap

RecoverAI is a competitive test-mode buildathon MVP, not a production collections system. Production deployment would still require live merchant onboarding, broader Razorpay event ingestion, consent and communications integrations, persistent managed infrastructure, security/compliance review, monitoring, and real-world controlled experiments. No production charging or customer messaging exists in this phase.
