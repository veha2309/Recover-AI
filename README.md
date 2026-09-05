# RecoverAI

RecoverAI is a bounded, auditable revenue-recovery agent built for Razorpay AI Buildathon 2026, Track 03. It runs a paired experiment over failed payments, checkout abandonment, failed subscriptions, and overdue receivables, then measures net money recovered against a fixed retry-and-remind baseline.

## Run locally

## Live submission demo and Gemini

Render Free deployment settings are in `render.yaml`. Follow [the deployment guide](docs/DEPLOYMENT.md) to connect your repository, configure your server-only Google API key, and obtain your live URL. Free hosting uses disposable SQLite history. Real production use still requires durable storage and the controls listed in the guide.

Set `AI_PROVIDER=gemini`, `GOOGLE_API_KEY`, and optionally `GEMINI_MODEL` in `.env.local` (default: `gemini-2.5-flash`). Set `DEMO_PASSWORD` for production startup; browser login is `demo` with that password. Never commit actual keys. The configured model now handles all AI proposal routes, with audited deterministic fallback on failure.

### Local setup

Use Node 20, 22, or 24 LTS.

```bash
npm install
copy .env.example .env.local
npm run generate:data
npm run dev
```

Open `http://localhost:3000`. Ollama is expected at `http://127.0.0.1:11434` with `gemma3:latest`; the app falls back deterministically if it is unavailable. Razorpay requires `rzp_test_` credentials and otherwise uses simulation.

## Safety model

- The model proposes only schema-validated actions from a closed allow-list.
- Deterministic policy owns authorization, state transitions, money, action budgets, and outcomes.
- Disputes, fraud signals, opt-outs, manual holds, ambiguous evidence, and high-value payment actions stop or escalate.
- Every event is append-only, idempotent, versioned, and hash-linked.
- All money uses integer minor units. No production action path exists.

## Verification

```bash
npm run lint
npm test
npm run build
```

Datasets are generated under `data/generated`: 20 demo, 80 development, and 40 held-out cases. See `docs/DEMO.md` for the five-minute presentation flow.

Phase Two uses four genuine local-model decisions per run—one per revenue motion—and records the remaining deterministic fallbacks honestly. With configured test credentials it also creates one real Razorpay test payment link. See `docs/PHASE_TWO.md`.

Phase Three adds signed Razorpay webhook ingestion, duplicate-safe provider reconciliation, a human approval queue, durable workflow jobs, and a provider-confirmed recovery ledger. It remains fully local and test-only. See `docs/PHASE_THREE.md`.

Phase Four adds a live priority queue, runtime case generation, bounded on-demand local AI, an interactive simulated clock, and a customer-response sandbox with incremental state transitions. See `docs/PHASE_FOUR.md`.

Phase Five switches the default local model to Gemma 3, isolates evaluator-only ground truth from agent inputs, separates live-AI and fallback cohorts, and enforces action-to-Razorpay evidence consistency. See `docs/PHASE_FIVE.md`.
