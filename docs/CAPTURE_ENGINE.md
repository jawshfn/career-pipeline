# Capture Engine

## Purpose

Career Pipeline's capture flow should support multiple ways to create an editable application draft without creating a different review shape for every source. The Capture Engine provides one frontend contract that capture methods can return, then converts that contract into the current Add Job review state.

The current UI still shows the same Add Job modes and editable review fields. Capture metadata is not displayed to users yet and is not persisted to the database.

## Current Methods

Implemented now:

- `deterministic-text` - wraps the existing deterministic Paste Job Text parser in `frontend/src/utils/jobTextExtraction.js`.
- `greenhouse-api` - imports structured published job data from hosted Greenhouse job-board links through the Career Pipeline backend.

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

Transport:

- Local mode: Career Pipeline frontend -> Career Pipeline backend -> Greenhouse Job Board API.
- Demo mode: one fictional in-memory Greenhouse fixture.

Only hosted Greenhouse links are supported:

- `https://boards.greenhouse.io/{board_token}/jobs/{job_id}`
- `https://job-boards.greenhouse.io/{board_token}/jobs/{job_id}`

Custom employer domains are not supported yet because they do not reliably expose the Greenhouse board token required by the public API.

## Planned Methods

These are future options, not implemented features:

- `lever-api`
- `ashby-api`
- `jobposting-jsonld`
- `ai-assisted-text`
- `browser-companion`

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
- Career Pipeline does not submit applications to Greenhouse.
- Greenhouse URL import uses the documented Greenhouse Job Board API through an allowlisted backend endpoint; it does not scrape pages or use browser automation.
- Field values must not be invented.
- Evidence must be truthful; unknown evidence remains `null`.
- Unsupported optional fields do not block saving.
- Restricted job boards are not scraped.
- Future network adapters must use documented or permitted access methods.
- Capture metadata is not yet persisted to the database.
