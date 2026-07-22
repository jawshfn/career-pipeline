# PursuitHQ Workers AI Gateway Spike

This isolated Cloudflare Worker is a Phase 25.0 feasibility spike. It is not integrated with the PursuitHQ frontend, FastAPI backend, or persisted product data.

## Endpoints

- `GET /health` is deterministic, invokes no model, and reports whether the server-side AI kill switch is enabled.
- `POST /v1/job-brief` accepts one bounded Job Intelligence Brief request and returns a validated JSON brief.

The POST body accepts exactly `company_name`, `role_title`, and `job_posting_text`, with optional `location`, `compensation`, and `employment_type`. Required strings are trimmed; the posting must be 200-20,000 characters. Complete request bodies are limited to 32 KiB of UTF-8 data. The response is `{ "brief": ..., "meta": ... }`; the model, prompt version, timestamp, and request ID are server-controlled.

The Worker owns the model, prompt, output schema, low randomness, and output limit. Browsers never receive AI credentials. GitHub Actions secrets are deployment-only; runtime inference uses the Worker `AI` binding, not an API token.

## Local use

Use Node 22 (the repository workflow convention), then run:

```sh
npm ci
npm test
npm run deploy:dry-run
npx wrangler login
npm run dev
```

`npm run deploy:dry-run` validates the deployment configuration and does not deploy. `npm run check` runs tests followed by that dry run. A live local model call requires your own Wrangler authentication and Cloudflare account access; this spike does not require interactive login for tests.

Example fictional request (do not use personal data or real job applications during this spike):

```json
{
  "company_name": "Fictional Systems",
  "role_title": "Platform Engineer",
  "job_posting_text": "Fictional Systems seeks a Platform Engineer to build reliable distributed services, improve observability, and work with product partners. Candidates need demonstrated software engineering experience and clear written communication."
}
```

## Deployment and controls

The `Deploy PursuitHQ AI gateway` GitHub Actions workflow is manual-only (`workflow_dispatch`). It installs this project, runs tests and a Wrangler dry run, then deploys using the repository deployment secrets. Deployment can fail until the token has Workers edit permission or the Cloudflare account has completed its initial `workers.dev` subdomain setup; do not add credentials to source to address either condition.

CORS allows only these exact browser origins: `https://jawshfn.github.io`, `http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:4173`, and `http://127.0.0.1:4173`. Requests without `Origin` remain usable for command-line/server smoke tests. CORS is interoperability, not authentication.

Set `AI_ENABLED` to `false` in server configuration to disable generation: health remains available and generation returns `503` without invoking the limiter or model. `AI_MODEL`, `PROMPT_VERSION`, and allowed origins are also server configuration; replacing the provider/model does not require browser changes.

The `AI_RATE_LIMITER` binding permits five valid generation attempts per 60 seconds per bounded client key (a valid `phq_` client ID, otherwise Cloudflare's connecting IP, otherwise `anonymous`). It is best-effort soft abuse protection, not authentication and not a precise global daily quota.

The prompt treats job postings as untrusted evidence and explicitly refuses instructions contained in them. The Worker rejects arbitrary prompts, provider parameters, unknown fields, oversized requests, and malformed model results. It validates structured output again at runtime and returns controlled JSON errors without provider internals.

GPT-OSS requests using messages may return a Chat Completions envelope. The gateway accepts a validated brief only from `choices[0].message.parsed`, or from `choices[0].message.content` when the complete content string is valid JSON. It does not search prose, strip code fences, or repair malformed output. Provider metadata and usage are neither exposed to clients nor written to diagnostics, and strict runtime validation still applies after extraction.

## Privacy-safe diagnostics

Malformed model responses produce one structured Worker warning for operational diagnosis. It contains only a Worker-generated request ID, the configured model, elapsed milliseconds, response-shape metadata, expected-key presence/counts, schema-version state, and a schema-only validation path/code. Provider failures produce one structured error with the same request ID, model, duration, and a sanitized error class. These logs never include job posting text, prompt messages, generated brief text, raw provider responses, provider usage values, exception messages, stacks, causes, credentials, or request headers. Successful responses are not logged.
