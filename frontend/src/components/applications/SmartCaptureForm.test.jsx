import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SmartCaptureReviewSummary } from "./SmartCaptureForm.jsx";

describe("SmartCaptureReviewSummary", () => {
  it("displays the Google Jobs parser format label", () => {
    const markup = renderToStaticMarkup(
      <SmartCaptureReviewSummary
        reviewData={{
          parser_format: "googlejobs",
          company_name: "Northstar Analytics LLC",
          role_title: "Data Analyst",
        }}
      />,
    );

    expect(markup).toContain("Detected format: Google Jobs");
  });
});
