# Submission deployment on Render Free

This is a shared, password-protected demo with synthetic data and test-only payments. It is not yet a production payment recovery service.

1. Push this project to your GitHub repository. Never commit `.env.local` or SQLite files.
2. In Render, choose New > Blueprint and connect that repository. Render reads `render.yaml` and selects the free Node web service.
3. Set `GOOGLE_API_KEY` to your Google AI Studio key and `DEMO_PASSWORD` to a strong demo password. These are runtime secrets. Do not prefix them with `NEXT_PUBLIC_`.
4. Deploy. Share the resulting HTTPS `onrender.com` URL with the judges, plus username `demo` and the demo password separately.
5. Open the link before presenting, create a run, verify live model decisions, exercise the approval and customer-response flows, and download the evidence export.

For manual service setup, build with `npm ci --include=dev && npm run build`, start with `npm run start -- --hostname 0.0.0.0`, and copy the environment settings from `render.yaml`. Health endpoint: `/api/health`.

Render Free sleeps after 15 minutes without requests. Local SQLite history is disposable and can disappear on restart, sleep, or redeploy. Export evidence before leaving the demo. All visitors share the same workspace; use only synthetic data.

## Gemini

Get a key at https://aistudio.google.com/apikey. Locally, add `GOOGLE_API_KEY` and `AI_PROVIDER=gemini` to `.env.local`. `GEMINI_API_KEY` is also accepted. `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`; set another text model supported by your account that supports structured JSON output. Restart after changing local configuration. Set `AI_PROVIDER=ollama` to return to the local model.

The status badge indicates configuration, not verified API access. A run's live decision count proves accepted model responses; missing keys, quota errors, and invalid output use explicitly recorded deterministic fallbacks. Keys stay on the server. Gemini receives projected case evidence, never evaluator outcome labels. See https://ai.google.dev/api and https://ai.google.dev/gemini-api/docs/structured-output.

## Before real production use

Use durable storage: a paid Render service with a disk and `RECOVERAI_DB` inside its mount path, or migrate to a managed database. Back up and test restoring the database. SQLite deployment must remain single-instance.

Replace the shared demo password with user authentication, roles and tenant isolation. Add durable per-user rate limits, model spending limits, monitoring, retention rules and a scheduled workflow worker. Validate real customer-data handling and complete provider onboarding before designing any live-money path. Current Razorpay integration deliberately accepts test keys only.

Render limits: https://render.com/docs/free


