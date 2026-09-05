# Five-minute submission video

Live demo: https://recover-ai-pvjh.onrender.com

## Before recording

Open the site a few minutes early and sign in with username `demo` and your demo password. Keep Render's environment page and Google AI Studio's key page out of the recording. Run recovery once and wait for completion; avoid repeatedly clicking it because Google enforces model quotas. Check the displayed live-decision count. The intended sample is four Gemini decisions, one per recovery motion, with the other 16 explicitly labeled deterministic fallbacks. If an API warning appears, resolve it or disclose it; do not claim a fallback is live AI.

## Script

| Time | Screen and action | Narration |
| --- | --- | --- |
| 0:00–0:30 | Command center; show the HTTPS URL and simulation banner | “RecoverAI is a bounded revenue recovery agent covering failed payments, abandoned checkouts, failed subscriptions and overdue receivables. This demo uses synthetic cases and simulated financial outcomes.” |
| 0:30–1:10 | Show the completed run and live/fallback counts | “Gemini proposes a diagnosis and an eligible action from case evidence. Deterministic policy decides whether the action can proceed.” Read the actual live and fallback counts. |
| 1:10–2:00 | Cases; inspect Maya Studio, then Kite Commerce or River Education | “Here is an eligible payment-link proposal. Here is a protected case where policy escalates or abstains. The model cannot override these controls.” Show the actual rationale and policy outcome. |
| 2:00–2:40 | Operations | “High-value and protected cases go to human approval. Creating a payment link is not recovery: the provider-confirmed ledger needs a verified paid webhook.” If it is zero, say no provider-confirmed payment has been demonstrated. |
| 2:40–3:30 | Dynamic lab; generate five cases and select one | “New cases enter a prioritized queue during the session. Customer replies and the simulated clock drive state changes.” Optionally plan one case if quota is available; show whether it is live or fallback. |
| 3:30–4:15 | Evaluation | “Both strategies use the same cases and simulated outcome table. The measured lift is a scenario result, not a production recovery claim.” Distinguish the live-AI and fallback cohorts. |
| 4:15–5:00 | Audit; show Evidence chain verified and Export JSON | “Every action has an evidence trail. This export includes the run inputs, decisions and audit records. Production would need durable storage, tenant access controls and live provider validation.” |

## Submission fields

- Demo URL: https://recover-ai-pvjh.onrender.com
- Source: https://github.com/veha2309/Recover-AI
- Login: username `demo`; give the chosen password privately in the access instructions.
- Video: upload the recording and test viewer access in a signed-out window.
- Evidence: export the run shown in the recording before the free service restarts.
- Description: “A bounded revenue recovery demo using Gemini proposals, deterministic safety policy, human approvals, simulated customer responses, paired evaluation and hash-linked audit records.”

Render Free may sleep and discard SQLite history. Keep the audit export. Do not describe this deployment as production-ready or simulated amounts as real money recovered. Check the competition's actual submission requirements separately; this script does not establish compliance with rules that have not been supplied.
