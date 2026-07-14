import assert from "node:assert/strict";
import test from "node:test";

import {
  CAREER_PIPELINE_LOCAL_URL,
  CAPTURE_HASH_KEY,
  buildCapturePayload,
  buildCareerPipelineCaptureUrl,
  encodeCapturePayload,
} from "./capturePayload.mjs";

const detectedResult = {
  status: "detected",
  provider: "greenhouse",
  board_token: "fictional-board",
  job_id: 123456,
  original_job_link: "https://careers.fictional.test/openings/role?gh_jid=123456",
};

test("builds a versioned Greenhouse payload with a string job ID", () => {
  assert.deepEqual(buildCapturePayload(detectedResult), {
    version: 1,
    provider: "greenhouse",
    board_token: "fictional-board",
    job_id: "123456",
    original_job_link: "https://careers.fictional.test/openings/role?gh_jid=123456",
  });
});

test("builds a local Career Pipeline fragment URL", () => {
  const url = new URL(buildCareerPipelineCaptureUrl(detectedResult));
  assert.equal(`${url.origin}${url.pathname}`, CAREER_PIPELINE_LOCAL_URL);
  assert.match(url.hash, new RegExp(`^#${CAPTURE_HASH_KEY}=[A-Za-z0-9_-]+$`));
});

test("rejects invalid detected payload values", () => {
  assert.throws(() => buildCapturePayload({ ...detectedResult, board_token: "bad token" }));
  assert.throws(() => buildCapturePayload({ ...detectedResult, board_token: 123 }));
  assert.throws(() => buildCapturePayload({ ...detectedResult, job_id: "1.5" }));
  assert.throws(() => buildCapturePayload({ ...detectedResult, job_id: 9007199254740992 }));
  assert.throws(() => buildCapturePayload({ ...detectedResult, original_job_link: "https://user:pass@fictional.test" }));
  assert.throws(() => buildCapturePayload({ ...detectedResult, status: "no-verified-board" }));
});

test("rejects oversized encoded payloads", () => {
  assert.throws(() =>
    encodeCapturePayload({
      ...buildCapturePayload(detectedResult),
      padding: "x".repeat(5000),
    }),
  );
});
