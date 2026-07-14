import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import JobLinkCaptureForm, {
  getLinkFallbackMessage,
  getTextCaptureFallbackValues,
  initialJobLinkCaptureState,
  isJobLinkCaptureDirty,
  JOB_LINK_CAPTURE_STATES,
} from "./JobLinkCaptureForm.jsx";
import { JOB_LINK_KINDS } from "../../capture/jobLinkRouter.js";
import { getParserFormatLabel } from "./CaptureReviewForm.jsx";

describe("JobLinkCaptureForm", () => {
  it("renders provider-neutral link capture controls", () => {
    const markup = renderToStaticMarkup(
      <JobLinkCaptureForm
        existingApplications={[]}
        onCreateApplication={() => Promise.resolve({})}
        onUnsavedChangesChange={() => {}}
        resumeVersions={[]}
      />,
    );

    expect(markup).toContain("Paste Job Link");
    expect(markup).toContain("help you continue with the link");
    expect(markup).toContain("Continue");
    expect(markup).toContain("Company Website");
  });

  it("tracks URL, fallback, and review dirty state", () => {
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
    expect(
      isJobLinkCaptureDirty(initialJobLinkCaptureState, null, JOB_LINK_CAPTURE_STATES.UNSUPPORTED),
    ).toBe(true);
    expect(
      isJobLinkCaptureDirty(initialJobLinkCaptureState, null, JOB_LINK_CAPTURE_STATES.IMPORT_ERROR),
    ).toBe(true);
  });

  it("preserves the entered link and selected source for text-capture fallback", () => {
    expect(
      getTextCaptureFallbackValues({
        jobLink: "https://boards.greenhouse.io/example/jobs/123456?gh_src=test",
        source: "Referral",
      }),
    ).toEqual({
      jobLink: "https://boards.greenhouse.io/example/jobs/123456?gh_src=test",
      source: "Referral",
    });
  });

  it("uses specific informational fallback copy without treating unsupported providers as invalid", () => {
    expect(
      getLinkFallbackMessage(
        { link_kind: JOB_LINK_KINDS.GREENHOUSE_CUSTOM_CANDIDATE },
        JOB_LINK_CAPTURE_STATES.UNSUPPORTED,
      ),
    ).toContain("may use Greenhouse");
    expect(
      getLinkFallbackMessage({ link_kind: JOB_LINK_KINDS.LINKEDIN }, JOB_LINK_CAPTURE_STATES.UNSUPPORTED),
    ).toContain("Automatic LinkedIn link import is not available");
    expect(getLinkFallbackMessage(null, JOB_LINK_CAPTURE_STATES.IMPORT_ERROR)).toContain(
      "could not be imported",
    );
  });

  it("labels link-only reviews as Job Link", () => {
    expect(getParserFormatLabel("joblink")).toBe("Job Link");
  });
});
