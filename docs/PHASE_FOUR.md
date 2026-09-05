# Phase Four — Dynamic Recovery Lab

Phase Four makes RecoverAI event-driven and interactive while retaining deterministic authority and the zero-cost test boundary.

## Delivered

- Add five new mixed revenue cases while the application is running.
- Continuously ordered priority queue based on exposure, urgency, and risk.
- Persistent simulated clock with one-hour and one-day controls.
- Incremental `NEW → ACTION_SCHEDULED → WAITING_FOR_OUTCOME → RECOVERED/ESCALATED` progression.
- Local-AI inference budget with explicit Ollama-versus-fallback decision evidence.
- Customer response sandbox with promise, dispute, opt-out, expired-card, and unverified-payment handling.
- Promise deadlines and broken-promise escalation driven by the simulated clock.
- Two-second UI polling for cross-tab and external-event updates without page reload.
- Append-only, hash-linked dynamic case events.

## Demo sequence

1. Open **Dynamic lab** and choose **Generate 5 cases**.
2. Select the highest-priority case and choose **Plan bounded recovery**.
3. Select another case, use the Promise preset, and submit it as untrusted evidence.
4. Advance the clock by one hour or one day.
5. Show states changing independently and the event stream growing.
6. Use Dispute or Opt out to demonstrate immediate stopping behavior.

## Dynamic safety rules

- The model can propose only within the existing action schema.
- Deterministic policy can redirect or stop every model proposal.
- Customer replies are classified as evidence and never interpreted as tool instructions.
- “Already paid” waits for provider confirmation and does not credit revenue.
- Optimistic case versions reject stale reply mutations.
- The AI inference budget prevents unbounded local-model work.
- Dynamic state and clock data survive application restart in SQLite.

## API surface

- `GET/POST /api/dynamic` — read the live portfolio or generate cases.
- `POST /api/dynamic/cases/:id/plan` — request bounded local-AI planning.
- `POST /api/dynamic/cases/:id/reply` — append a customer response.
- `POST /api/dynamic/clock` — advance simulated time and process due transitions.
