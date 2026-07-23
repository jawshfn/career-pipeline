# PursuitHQ AI Gateway

The AI gateway is a Cloudflare Worker that creates session-only Job Intelligence Briefs. It validates requests, calls Google Gemini with the fixed production model `gemini-3.5-flash-lite`, validates schema version `2`, and returns a structured response. It does not persist workspace data.

## Requirements and local setup

Node.js 22 or later is required.

```powershell
cd ai-gateway
npm install
# Create ignored .dev.vars with: GEMINI_API_KEY=your-local-key
npm run dev
```

Never commit `.dev.vars` or a real key. Configure `GEMINI_API_KEY` as a Cloudflare Worker secret for deployment.

## Commands

```powershell
npm test
npm run deploy:dry-run
npm run check
npm run deploy
```

The repository’s manually dispatched AI gateway workflow runs tests, a dry run, and deployment. Local `npm run deploy` requires configured Cloudflare credentials.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Deterministic service health and AI kill-switch state. |
| POST | `/v1/job-brief` | Generate one validated Job Intelligence Brief. |

The POST request accepts only `company_name`, `role_title`, `job_posting_text`, `location`, `compensation`, and `employment_type`. Company, role, and a 200–20,000 character posting are required. Successful responses use `{ "brief": { ... }, "meta": { ... } }`; metadata includes the server-controlled model, prompt version, schema version, timestamp, and request ID.

## Configuration and operations

- `GEMINI_API_KEY`: required Worker secret.
- `AI_ENABLED`: generation kill switch.
- `GOOGLE_AI_TIMEOUT_MS`: bounded provider timeout.
- `AI_MAX_COMPLETION_TOKENS`: bounded output setting.
- `ALLOWED_ORIGINS`: comma-separated CORS allowlist.
- `AI_RATE_LIMITER`: Worker binding for the rate limiter.

Valid generation requests are limited to two attempts per minute per bounded client key. CORS accepts only configured browser origins. The Worker makes one abortable provider request and uses no retries, tools, grounding, Google SDK, provider fallback, or provider-enforced response schema.

## Privacy and logging

Only current company, role, optional job details, and Job Posting Snapshot are sent to Google. Resume data, notes, contacts, status, red flags, follow-ups, and activity history are excluded. The gateway logs operational diagnostic metadata rather than submitted content. AI output requires review; do not submit personal, confidential, or sensitive information.
