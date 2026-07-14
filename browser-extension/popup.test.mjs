import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyInspectionError,
  inspectActivePage,
  unwrapInjectionResult,
} from "./popup.mjs";

test("unwraps a successful injected detector result", () => {
  const detectorResult = { status: "no-supported-job-id", version: 1 };
  assert.equal(unwrapInjectionResult([{ result: detectorResult }]), detectorResult);
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
