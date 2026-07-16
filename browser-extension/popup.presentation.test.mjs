import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readPopupAsset = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("popup presentation identifies PursuitHQ and Browser Capture without prototype copy", async () => {
  const html = await readPopupAsset("popup.html");

  assert.match(html, />PursuitHQ</u);
  assert.match(html, /<h1>Browser Capture<\/h1>/u);
  assert.match(html, /class="local-badge"/u);
  assert.doesNotMatch(html, /EXPERIMENTAL LOCAL HELPER/ui);
});

test("popup presentation includes review-first capture hierarchy and indigo controls", async () => {
  const [popup, css] = await Promise.all([readPopupAsset("popup.mjs"), readPopupAsset("popup.css")]);

  assert.match(popup, /Ready to review/u);
  assert.match(popup, /Description captured \\u00b7/u);
  assert.match(popup, /Requires the local PursuitHQ app/u);
  assert.match(popup, /One-time local transfer/u);
  assert.match(popup, /Open in PursuitHQ/u);
  assert.doesNotMatch(popup, /PursuitHQ must be running locally at http:\/\/localhost:5173/u);
  assert.match(css, /--color-primary: #4557d8/u);
  assert.match(css, /\.primary-button:focus-visible/u);
  assert.match(css, /\.result-panel\.is-(ready|warning|error)/u);
});

test("no-detection fallback uses source-neutral guidance and natural neutral-panel height", async () => {
  const [popup, css] = await Promise.all([readPopupAsset("popup.mjs"), readPopupAsset("popup.css")]);

  assert.match(popup, /Capture unavailable on this page/u);
  assert.match(popup, /could not find a supported job posting on the current page/u);
  assert.match(popup, /Open the full job description and try again/u);
  assert.match(popup, /Paste Job Text or Manual Entry in PursuitHQ/u);
  assert.doesNotMatch(popup, /This page does not expose one supported Greenhouse job ID/u);
  assert.match(css, /\.result-panel\.is-neutral\s*\{\s*min-height: 0;/u);
});
