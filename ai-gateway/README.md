# PursuitHQ AI Gateway

This Cloudflare Worker gateway powers PursuitHQ's session-only Job Intelligence Brief. It sends validated job details to the Google Gemini API using the fixed production model `gemini-3.5-flash-lite`, schema version 2, and prompt version `job-brief-v5`.

`GET /health` is deterministic and reports the AI kill switch. `POST /v1/job-brief` accepts exactly `company_name`, `role_title`, and `job_posting_text`, plus optional `location`, `compensation`, and `employment_type`. The Worker validates and bounds input, rate-limits valid requests, and returns a validated `{ "brief": ..., "meta": ... }` response. The model, schema, prompt version, and timestamp are server-controlled.

Set `GEMINI_API_KEY` as a Cloudflare Worker secret; never add it to source control or Wrangler configuration. For local development, use ignored `ai-gateway/.dev.vars`. The remaining operational variables are `AI_ENABLED`, `GOOGLE_AI_TIMEOUT_MS` (default `15000`), `AI_MAX_COMPLETION_TOKENS` (default `4096`), and `ALLOWED_ORIGINS`. `AI_RATE_LIMITER` is the required Worker rate-limit binding.

The gateway makes one abortable Google request using the API key only in the `x-goog-api-key` header, `systemInstruction`, one user message, `maxOutputTokens`, and `thinkingLevel: minimal`. It does not use retries, tools, grounding, a Google SDK, sampling fields, or provider-enforced response schemas. Google failures and malformed responses return controlled errors.

Google receives only the current company, role, optional job details, and Job Posting Snapshot. It never receives resumes, personal employment history, notes, contacts, application activity, red flags, or follow-up information. On the current free Google API tier, submitted content and generated responses may be used to improve Google services and processed by human reviewers; do not submit personal, confidential, or sensitive information.

The `Deploy PursuitHQ AI gateway` GitHub Actions workflow runs gateway checks and deploys the Worker. CORS permits only committed browser origins; rate limiting permits two valid generation attempts per minute per bounded client key. Run `npm run check` for tests and a Wrangler deployment dry run.
