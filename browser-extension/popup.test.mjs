import assert from "node:assert/strict";
import test from "node:test";

import {
  canOpenCareerPipeline,
  classifyInspectionError,
  inspectActivePage,
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

test("allows only a valid detected result to open Career Pipeline", async () => {
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
