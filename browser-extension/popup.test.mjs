import assert from "node:assert/strict";
import test from "node:test";

import {
  canOpenCareerPipeline,
  classifyInspectionError,
  inspectActivePage,
  isIndeedHostname,
  isLinkedInHostname,
  isZipRecruiterJobUrl,
  openBrowserTextCareerPipeline,
  openIndeedCareerPipeline,
  openCareerPipeline,
  unwrapInjectionResult,
} from "./popup.mjs";

const detectedResult = {
  status: "detected",
  provider: "greenhouse",
  board_token: "fictional-board",
  job_id: 123456,
  original_job_link: "https://careers.fictional.test/openings/role?gh_jid=123456",
  evidence_types: ["script-source"],
};

test("unwraps a successful injected detector result", () => {
  const detectorResult = { status: "no-supported-job-id", version: 1 };
  assert.equal(unwrapInjectionResult([{ result: detectorResult }]), detectorResult);
});

test("adds the active employer URL only to a successful browser handoff", async () => {
  const result = await inspectActivePage({
    tabs: {
      query: async () => [{ id: 9, url: detectedResult.original_job_link }],
    },
    scripting: {
      executeScript: async () => [{ result: { ...detectedResult } }],
    },
  });

  assert.deepEqual(result, detectedResult);
});

test("allows only a valid detected result to open PursuitHQ", async () => {
  const create = async (details) => {
    create.calls.push(details);
  };
  create.calls = [];

  assert.equal(canOpenCareerPipeline(detectedResult), true);
  assert.equal(canOpenCareerPipeline({ status: "no-verified-board" }), false);
  await openCareerPipeline(detectedResult, { tabs: { create } });

  assert.equal(create.calls.length, 1);
  assert.match(create.calls[0].url, /^http:\/\/localhost:5173\/#career-pipeline-capture=/u);
});

test("classifies a protected-page executeScript rejection as unsupported", async () => {
  const chromeApi = {
    tabs: { query: async () => [{ id: 7 }] },
    scripting: {
      executeScript: async () => {
        throw new Error("Cannot access contents of url chrome://settings/");
      },
    },
  };

  assert.deepEqual(await inspectActivePage(chromeApi), { status: "unsupported-page" });
});

test("returns extension-error for unexpected executeScript failures", async () => {
  const chromeApi = {
    tabs: { query: async () => [{ id: 8 }] },
    scripting: {
      executeScript: async () => {
        throw new Error("Unexpected extension execution failure");
      },
    },
  };

  assert.deepEqual(await inspectActivePage(chromeApi), { status: "extension-error" });
  assert.deepEqual(classifyInspectionError(new Error("Unexpected extension execution failure")), {
    status: "extension-error",
  });
});

test("routes an active Indeed page to the focused detector", async () => {
  const result = await inspectActivePage({
    tabs: { query: async () => [{ id: 12, url: "https://www.indeed.com/viewjob?jk=fake" }] },
    scripting: {
      executeScript: async (details) => {
        assert.equal(typeof details.func, "function");
        return [{ result: { status: "no-current-job", version: 1 } }];
      },
    },
  });
  assert.equal(result.status, "no-current-job");
  assert.equal(isIndeedHostname("https://indeed.com/viewjob?jk=fake"), true);
  assert.equal(isIndeedHostname("https://indeed.com.evil.test/viewjob"), false);
});

test("routes an active LinkedIn page to the focused detector", async () => {
  const result = await inspectActivePage({
    tabs: { query: async () => [{ id: 13, url: "https://www.linkedin.com/jobs/view/123456" }] },
    scripting: { executeScript: async (details) => { assert.equal(typeof details.func, "function"); return [{ result: { status: "no-current-job", version: 1 } }]; } },
  });
  assert.equal(result.status, "no-current-job");
  assert.equal(isLinkedInHostname("https://www.linkedin.com/jobs/view/123456"), true);
  assert.equal(isLinkedInHostname("https://linkedin.com.evil.test/jobs/view/123456"), false);
});

test("routes only a selected ZipRecruiter search detail to the focused detector", async () => {
  const result = await inspectActivePage({
    tabs: { query: async () => [{ id: 16, url: "https://www.ziprecruiter.com/jobs-search?lk=selected-key" }] },
    scripting: { executeScript: async (details) => { assert.equal(typeof details.func, "function"); return [{ result: { status: "no-current-job", version: 1 } }]; } },
  });
  assert.equal(result.status, "no-current-job");
  assert.equal(result.provider, "ziprecruiter");
  assert.equal(isZipRecruiterJobUrl("https://www.ziprecruiter.com/jobs-search?lk=selected-key"), true);
  assert.equal(isZipRecruiterJobUrl("https://www.ziprecruiter.com/jobs-search?search=data"), false);
  assert.equal(isZipRecruiterJobUrl("https://ziprecruiter.com.evil.test/jobs-search?lk=selected-key"), false);
});

test("marks an actual Indeed injection failure without exposing page data", async () => {
  const result = await inspectActivePage({
    tabs: { query: async () => [{ id: 14, url: "https://www.indeed.com/viewjob?jk=fake" }] },
    scripting: { executeScript: async () => { throw new Error("Injected function failed"); } },
  });
  assert.deepEqual(result, { status: "extension-error", error_code: "indeed-injection-failed" });
});

test("marks an actual LinkedIn injection failure without exposing page data", async () => {
  const result = await inspectActivePage({
    tabs: { query: async () => [{ id: 15, url: "https://www.linkedin.com/jobs/view/123456" }] },
    scripting: { executeScript: async () => { throw new Error("Injected function failed"); } },
  });
  assert.deepEqual(result, { status: "extension-error", error_code: "linkedin-injection-failed" });
});

test("posts an Indeed capture only to the local backend before opening a token URL", async () => {
  const calls = [];
  const create = async (details) => calls.push(details);
  const fetchCalls = [];
  const fetchImpl = async (url, options) => {
    fetchCalls.push({ url, options });
    return { ok: true, json: async () => ({ version: 1, capture_token: "a".repeat(43) }) };
  };
  await openIndeedCareerPipeline(
    {
      status: "detected",
      provider: "indeed",
      source: "Indeed",
      original_job_link: "https://www.indeed.com/viewjob?jk=fake",
      raw_text: "Fictional Role - job post\nFull job description\n" + "Helpful text ".repeat(10),
    },
    { tabs: { create } },
    fetchImpl,
  );
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "http://127.0.0.1:8000/api/browser-text-captures");
  assert.equal(fetchCalls[0].options.credentials, "omit");
  assert.match(calls[0].url, /^http:\/\/localhost:5173\/#career-pipeline-text-capture=/);
});

test("posts a LinkedIn capture only after the open action using its matching provider and source", async () => {
  const calls = [];
  const fetchCalls = [];
  await openBrowserTextCareerPipeline(
    { status: "detected", provider: "linkedin", source: "LinkedIn", original_job_link: "https://www.linkedin.com/jobs/view/123456", raw_text: "Company logo for, Fictional Labs.\nFictional Labs\nRole\nAbout the job\n" + "Helpful text ".repeat(10) },
    { tabs: { create: async (details) => calls.push(details) } },
    async (url, options) => { fetchCalls.push({ url, options }); return { ok: true, json: async () => ({ version: 1, capture_token: "b".repeat(43) }) }; },
  );
  assert.equal(fetchCalls.length, 1);
  assert.equal(fetchCalls[0].url, "http://127.0.0.1:8000/api/browser-text-captures");
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body).provider, "linkedin");
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body).source, "LinkedIn");
  assert.match(calls[0].url, /^http:\/\/localhost:5173\/#career-pipeline-text-capture=/);
});

test("posts a ZipRecruiter capture only after the open action with a token-only URL", async () => {
  const calls = [];
  const fetchCalls = [];
  await openBrowserTextCareerPipeline(
    { status: "detected", provider: "ziprecruiter", source: "ZipRecruiter", original_job_link: "https://www.ziprecruiter.com/jobs-search?lk=fake", raw_text: "Fictional Analyst\nFictional Company\nJob description\n" + "Helpful text ".repeat(10) },
    { tabs: { create: async (details) => calls.push(details) } },
    async (url, options) => { fetchCalls.push({ url, options }); return { ok: true, json: async () => ({ version: 1, capture_token: "c".repeat(43) }) }; },
  );
  assert.equal(fetchCalls.length, 1);
  assert.equal(JSON.parse(fetchCalls[0].options.body).provider, "ziprecruiter");
  assert.equal(JSON.parse(fetchCalls[0].options.body).source, "ZipRecruiter");
  assert.match(calls[0].url, /^http:\/\/localhost:5173\/#career-pipeline-text-capture=/);
  assert.doesNotMatch(calls[0].url, /Fictional Analyst/u);
});
