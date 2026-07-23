# Capture Engine

PursuitHQ captures an opportunity into an editable review; no capture method automatically saves an application.

## Shared contract

Every capture produces reviewable fields with provenance and confidence where available. Users retain control of Source and Job Link, correct the draft, and explicitly save. Job Posting Snapshot is stored separately from Personal Notes.

## Capture methods

| Method | Current support | Result |
| --- | --- | --- |
| Structured link import | Hosted Greenhouse; best-effort custom Greenhouse discovery; canonical global/EU Lever | Provider-derived structured draft. |
| Browser Capture | Greenhouse, Indeed, LinkedIn, ZipRecruiter, Handshake | Local, user-initiated handoff to editable review. |
| Paste Job Text | Common copied posting formats | Deterministic field extraction and posting snapshot. |
| Link-only fallback | Unsupported links | Preserves the link for manual completion or pasted text. |

## Parser and provider boundaries

Paste Job Text is deterministic parsing of user-supplied text. Structured imports use bounded provider-specific contracts. Browser Capture reads only the supported active-page layout after user action and transfers bounded data to the local app. These are distinct mechanisms, even when they end in the same review form.

## Browser Capture transport

Greenhouse transfers verified identifiers for the existing structured import. Indeed, LinkedIn, ZipRecruiter, and Handshake transfer bounded cleaned text through a one-time local backend token. The token is in memory, expires quickly, and never creates an application. See [the Browser Capture guide](../browser-extension/README.md) for supported layouts and permissions.

## Safety boundaries

- No generic scraper, crawling, arbitrary page fetch, or automatic save.
- No capture of generic selected text.
- Provider imports use narrow validation and controlled failures.
- A user reviews all fields before persistence.

## AI boundary

Capture stays deterministic or structured-provider based. Job Intelligence Brief is a separate, post-capture analysis feature: it never creates or silently overwrites captured fields and is not part of this contract.
