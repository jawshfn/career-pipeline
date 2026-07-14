import assert from "node:assert/strict";
import test from "node:test";

import { detectGreenhousePage } from "./detector.mjs";

const PAGE_URL = "https://careers.fictional.test/openings?gh_jid=123456";

function snapshot(overrides = {}) {
  return {
    pageUrl: PAGE_URL,
    scriptUrls: [],
    iframeUrls: [],
    linkUrls: [],
    formUrls: [],
    dataUrls: [],
    dataTokens: [],
    resourceUrls: [],
    ...overrides,
  };
}

test("detects a custom page from a matching Greenhouse script source", () => {
  const result = detectGreenhousePage(
    snapshot({
      scriptUrls: ["https://boards.greenhouse.io/embed/job_board/js?for=fictional-board"],
    }),
  );

  assert.deepEqual(result, {
    version: 1,
    status: "detected",
    provider: "greenhouse",
    board_token: "fictional-board",
    job_id: 123456,
    evidence_types: ["script-source"],
    evidence_count: 1,
  });
});

test("detects a board using only an already-loaded performance resource", () => {
  const result = detectGreenhousePage(
    snapshot({ resourceUrls: ["https://boards-api.greenhouse.io/v1/boards/fictional-board"] }),
  );

  assert.equal(result.status, "detected");
  assert.equal(result.board_token, "fictional-board");
  assert.deepEqual(result.evidence_types, ["performance-resource"]);
});

test("derives the job and board from a strict hosted Greenhouse page", () => {
  const result = detectGreenhousePage(
    snapshot({ pageUrl: "https://job-boards.greenhouse.io/fictional-board/jobs/654321" }),
  );

  assert.equal(result.status, "detected");
  assert.equal(result.board_token, "fictional-board");
  assert.equal(result.job_id, 654321);
  assert.deepEqual(result.evidence_types, ["page-url"]);
});

test("accepts matching job evidence and rejects a mismatched job ID", () => {
  const matching = detectGreenhousePage(
    snapshot({ linkUrls: ["https://boards.greenhouse.io/fictional-board/jobs/123456"] }),
  );
  const mismatched = detectGreenhousePage(
    snapshot({ linkUrls: ["https://boards.greenhouse.io/fictional-board/jobs/654321"] }),
  );

  assert.equal(matching.status, "detected");
  assert.equal(mismatched.status, "no-verified-board");
});

test("deduplicates repeated evidence for one token", () => {
  const result = detectGreenhousePage(
    snapshot({
      scriptUrls: ["https://boards.greenhouse.io/FICTIONAL-BOARD"],
      iframeUrls: ["https://job-boards.greenhouse.io/fictional-board"],
      resourceUrls: ["https://boards-api.greenhouse.io/v1/boards/fictional-board"],
    }),
  );

  assert.equal(result.status, "detected");
  assert.equal(result.board_token, "fictional-board");
  assert.equal(result.evidence_count, 3);
});

test("returns ambiguity without exposing candidate tokens", () => {
  const result = detectGreenhousePage(
    snapshot({
      scriptUrls: [
        "https://boards.greenhouse.io/fictional-board",
        "https://boards.greenhouse.io/other-fictional-board",
      ],
    }),
  );

  assert.deepEqual(result, { version: 1, status: "ambiguous-board", job_id: 123456 });
  assert.equal("board_token" in result, false);
});

test("requires exactly one unsigned positive 1-18 digit custom job ID", () => {
  const invalidValues = ["", "0", "-1", "+1", "1.5", "abc", "1234567890123456789"];
  assert.equal(
    detectGreenhousePage(snapshot({ pageUrl: "https://careers.fictional.test/openings" })).status,
    "no-supported-job-id",
  );

  for (const value of invalidValues) {
    const pageUrl = `https://careers.fictional.test/openings?gh_jid=${encodeURIComponent(value)}`;
    assert.equal(detectGreenhousePage(snapshot({ pageUrl })).status, "no-supported-job-id");
  }

  const duplicateUrl = "https://careers.fictional.test/openings?gh_jid=123456&gh_jid=654321";
  assert.equal(detectGreenhousePage(snapshot({ pageUrl: duplicateUrl })).status, "no-supported-job-id");
});

test("rejects unsafe and lookalike Greenhouse evidence URLs", () => {
  const evidenceUrls = [
    "https://boards.greenhouse.io.example.test/fictional-board",
    "https://greenhouse.example.test/fictional-board",
    "https://fakegreenhouse.io/fictional-board",
    "http://boards.greenhouse.io/fictional-board",
    "https://user@boards.greenhouse.io/fictional-board",
    "https://boards.greenhouse.io:8443/fictional-board",
  ];

  for (const evidenceUrl of evidenceUrls) {
    const result = detectGreenhousePage(snapshot({ scriptUrls: [evidenceUrl] }));
    assert.equal(result.status, "no-verified-board");
  }
});

test("ignores generic filenames and generic data-board-token attributes", () => {
  const result = detectGreenhousePage(
    snapshot({
      scriptUrls: ["https://careers.fictional.test/assets/Greenhouse.component.js"],
      dataTokens: [{ type: "data-board-token", value: "fictional-board" }],
    }),
  );

  assert.equal(result.status, "no-verified-board");
});

test("accepts dedicated Greenhouse data URL and token attributes", () => {
  const urlResult = detectGreenhousePage(
    snapshot({
      dataUrls: [
        {
          type: "data-greenhouse-api-url",
          value: "https://boards-api.greenhouse.io/v1/boards/fictional-board/jobs/123456",
        },
      ],
    }),
  );
  const tokenResult = detectGreenhousePage(
    snapshot({
      dataTokens: [{ type: "data-greenhouse-board-token", value: "FICTIONAL-BOARD" }],
    }),
  );

  assert.equal(urlResult.status, "detected");
  assert.equal(tokenResult.status, "detected");
  assert.equal(tokenResult.board_token, "fictional-board");
});

test("returns no board for a custom page with a job ID and no evidence", () => {
  const result = detectGreenhousePage(
    snapshot({
      html: "<p>private fictional HTML</p>",
      pageText: "private fictional page text",
      inputValues: ["private fictional input"],
    }),
  );

  assert.equal(result.status, "no-verified-board");
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes("private fictional"), false);
  assert.equal("html" in result, false);
  assert.equal("pageText" in result, false);
});

test("treats ordinary HTTP and HTTPS pages as inspectable no-job pages", () => {
  assert.equal(
    detectGreenhousePage(snapshot({ pageUrl: "https://www.fictional-public.test/about" })).status,
    "no-supported-job-id",
  );
  assert.equal(
    detectGreenhousePage(snapshot({ pageUrl: "http://localhost:5173" })).status,
    "no-supported-job-id",
  );
});

test("returns unsupported-page only for restricted page schemes", () => {
  assert.equal(detectGreenhousePage(snapshot({ pageUrl: "chrome://settings/" })).status, "unsupported-page");
});
