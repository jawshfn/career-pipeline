import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import JobLinkCaptureForm, {
  initialJobLinkCaptureState,
  isJobLinkCaptureDirty,
} from "./JobLinkCaptureForm.jsx";

describe("JobLinkCaptureForm", () => {
  it("renders the Greenhouse import controls", () => {
    const markup = renderToStaticMarkup(
      <JobLinkCaptureForm
        existingApplications={[]}
        onCreateApplication={() => Promise.resolve({})}
        onUnsavedChangesChange={() => {}}
        resumeVersions={[]}
      />,
    );

    expect(markup).toContain("Paste Job Link");
    expect(markup).toContain("Import job");
    expect(markup).toContain("Company Website");
  });

  it("tracks URL and imported-review dirty state", () => {
    expect(isJobLinkCaptureDirty(initialJobLinkCaptureState, null)).toBe(false);
    expect(
      isJobLinkCaptureDirty(
        {
          ...initialJobLinkCaptureState,
          jobLink: "https://boards.greenhouse.io/example/jobs/123456",
        },
        null,
      ),
    ).toBe(true);
    expect(isJobLinkCaptureDirty(initialJobLinkCaptureState, { company_name: "Example" })).toBe(true);
  });
});
