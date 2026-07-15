# Capture Engine

## Purpose

Career Pipeline's capture flow should support multiple ways to create an editable application draft without creating a different review shape for every source. The Capture Engine provides one frontend contract that capture methods can return, then converts that contract into the current Add Job review state.

The three user-facing Add Job modes are Manual Entry, Paste Job Link, and Paste Job Text. Browser Capture is the preferred local transport when a supported job is already open; it feeds the same editable review contract. Capture metadata is not displayed to users yet and is not persisted to the database.

## Current Methods

Implemented now:

- `deterministic-text` - wraps the existing deterministic Paste Job Text parser in `frontend/src/utils/jobTextExtraction.js`.
- `greenhouse-api` - imports structured published job data from hosted or verified custom Greenhouse job links through the Career Pipeline backend.
- `lever-api` - imports a canonical hosted Lever posting through Lever's documented public Postings API.
- `link-only` - creates an editable review from a valid user-entered job link without inferring job fields.

The deterministic parser remains the extraction implementation. The Capture Engine only normalizes the result into a stable contract and converts it back to the current flat review state.

Recognized deterministic parser formats are:

- `generic`
- `googlejobs`
- `indeed`
- `linkedin`
- `ziprecruiter`

Parser format remains separate from capture method. For example, Google Jobs text uses `capture_method: "deterministic-text"` with `detected_format: "googlejobs"`.

Greenhouse URL import uses:

- `capture_method: "greenhouse-api"`
- `detected_format: "greenhouse"`
- structured fields with `provenance: "greenhouse-api"` and `confidence: "high"`

Lever URL import uses `capture_method: "lever-api"`, `detected_format: "lever"`, and `provenance: "lever-api"` for structured fields. Lever company name remains blank and requires review because the provider response does not expose a dependable display name.

Transport:

- Local mode: Career Pipeline frontend -> Career Pipeline backend -> Greenhouse Job Board API or Lever Postings API.
- Demo mode: fictional in-memory Greenhouse and Lever fixtures.

The experimental locally loaded Greenhouse detector is a transport bridge rather than a separate capture method. It can hand a successful browser detection to a new local app tab at `http://localhost:5173/`, where the normal `greenhouse-api` capture method runs. The bridge uses a short versioned fragment payload with only the provider, verified board token, verified job ID, and original employer job URL. The frontend clears the fragment immediately, validates it again, preserves the original employer URL as Job Link, defaults Source to Company Website, and opens the normal editable review. The extension itself makes no network request, does not search existing tabs, and does not require broad tab or host permissions. No application is saved automatically. Static demo mode does not perform browser-assisted imports.

The same local helper can capture a confidently detected Indeed or LinkedIn description after the user clicks it. The extension formats a bounded text package, then transfers it only to the local FastAPI backend through a random one-time token. The token is consumed into the existing deterministic Paste Job Text review with the matching Source and original Job Link preserved. LinkedIn supports search-results current-job panels and standalone job pages. The text remains in process memory for at most two minutes, is never put in the URL or SQLite before save, and no Career Pipeline request is made to either job board.

Multiple transports feed the same editable review contract:

- Structured link imports
- Browser-assisted Greenhouse handoff, which feeds `greenhouse-api`
- Browser-assisted Indeed text capture, which feeds `deterministic-text`
- Browser-assisted LinkedIn text capture, which feeds `deterministic-text`
- Deterministic pasted-text fallback
- Link-only review

Browser capture is a transport into existing capture methods, not a separate database persistence model. Missing information remains blank, capture metadata is not persisted, and user review is always required before save.

Hosted Greenhouse links are imported directly:

- `https://boards.greenhouse.io/{board_token}/jobs/{job_id}`
- `https://job-boards.greenhouse.io/{board_token}/jobs/{job_id}`

Custom employer career links can be imported only when they contain one explicit positive `gh_jid` and their safely fetched HTML exposes exactly one board token through strong Greenhouse embed or configuration evidence. The discovered token and explicit job ID are then sent to the official Greenhouse Job Board API. Tokens are never guessed from employer names, domains, or URL slugs.

Job Link routing is local and deterministic:

- Hosted Greenhouse links use the Greenhouse API import.
- Canonical global and EU hosted Lever posting links use the Lever Postings API import.
- Other valid public job links can continue as a link-only review or transfer to Paste Job Text.
- A custom employer link with one positive `gh_jid` uses best-effort Greenhouse discovery from strong configuration evidence present in the original public HTML. Failed or ambiguous discovery returns to the same link-only and Paste Job Text fallbacks.

There is no arbitrary public-fetch endpoint or generic employer-page parser. Custom discovery uses the isolated safe HTML service only for Greenhouse configuration evidence and never returns fetched HTML. Some custom career sites expose that configuration only after browser JavaScript runs; Career Pipeline does not execute page JavaScript or fetch arbitrary subresources, so those sites fall back to link-only capture or Paste Job Text. A `gh_jid` alone never identifies a board token. Demo mode performs no custom employer-page fetch. Link-only capture preserves the explicit Job Link and user-selected Source, leaves company and role blank for review, and never invents job fields.

## Planned Methods

These are future options, not implemented features:

- `ashby-api`
- `jobposting-jsonld`
- `ai-assisted-text`

## Planned Adapter Order

1. User-entered values are never overwritten.
2. Official documented ATS data is preferred when available.
3. `JobPosting` structured data is preferred for generic employer pages.
4. Deterministic text extraction remains available.
5. AI-assisted text extraction may be used as a controlled fallback.
6. Missing information remains blank rather than being invented.

## Contract Summary

Capture results are plain serializable JavaScript objects:

```js
{
  contract_version: 1,
  capture_method: "deterministic-text",
  detected_format: "indeed",
  fields: {
    company_name: {
      value: "Example Company",
      provenance: "deterministic-text",
      confidence: "medium",
      evidence: null
    }
  },
  needs_review: [],
  warnings: []
}
```

Every supported review field is present in `fields`, even when its value is blank.

## Provenance And Confidence

- Posting-text fields such as company, role, location, compensation, employment type, and notes use `deterministic-text` with `medium` confidence when present.
- Missing extracted values use `missing` provenance and `missing` confidence.
- Job Link uses `user-input` and `confirmed` only when the user explicitly entered it.
- Source uses `user-selection` and `confirmed`.
- Tracking defaults such as status, resume version, follow-up date, and next action use `system-default` and `not-applicable`.
- Evidence is `null` for the deterministic parser because exact source ranges are not retained yet.

## Review Requirements

Only `company_name` and `role_title` are required review fields. Missing optional fields such as compensation, location, and employment type do not block capture and do not automatically appear in `needs_review`.

## Safety Principles

- Job Link is never inferred from pasted text.
- Source remains user-selected.
- Greenhouse URL import still requires user review before saving.
- Lever URL import still requires user review before saving and does not submit applications.
- Career Pipeline does not submit applications to Greenhouse.
- Greenhouse URL import uses the documented Greenhouse Job Board API. Custom discovery retrieves one bounded public HTML page through the SSRF-protected fetch service only to verify board configuration; it does not execute JavaScript, fetch subresources, crawl pages, or use browser automation.
- Field values must not be invented.
- Evidence must be truthful; unknown evidence remains `null`.
- Unsupported optional fields do not block saving.
- Restricted job boards are not scraped.
- Future network adapters must use documented or permitted access methods.
- Capture metadata is not yet persisted to the database.
