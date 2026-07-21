import assert from "node:assert/strict";
import test from "node:test";

import { createBrowserTextCapture } from "./textCaptureApi.mjs";

test("accepts only matching supported browser text-capture provider and source pairs", async () => {
  const calls = [];
  const fetchImpl = async (_url, options) => { calls.push(options); return { ok: true, json: async () => ({ version: 1, capture_token: "a".repeat(43) }) }; };
  await createBrowserTextCapture({ status: "detected", provider: "linkedin", source: "LinkedIn", original_job_link: "https://www.linkedin.com/jobs/view/123", raw_text: "Fictional text" }, fetchImpl);
  assert.equal(JSON.parse(calls[0].body).provider, "linkedin");
  await createBrowserTextCapture({ status: "detected", provider: "ziprecruiter", source: "ZipRecruiter", original_job_link: "https://www.ziprecruiter.com/jobs-search?lk=fake", raw_text: "Fictional text" }, fetchImpl);
  assert.equal(JSON.parse(calls[1].body).source, "ZipRecruiter");
  await createBrowserTextCapture({ status: "detected", provider: "handshake", source: "Handshake", original_job_link: "https://app.joinhandshake.com/jobs/123", raw_text: "Fictional text" }, fetchImpl);
  assert.equal(JSON.parse(calls[2].body).source, "Handshake");
  await assert.rejects(() => createBrowserTextCapture({ status: "detected", provider: "linkedin", source: "Indeed" }, fetchImpl));
  await assert.rejects(() => createBrowserTextCapture({ status: "detected", provider: "other", source: "Other" }, fetchImpl));
});
