import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import JobIntelligenceBriefTab from "./JobIntelligenceBriefTab.jsx";

const brief = {
  role_summary: "Own planning for product initiatives.",
  responsibilities: [{ statement: "Lead planning", evidence: "Planning is named." }],
  required_qualifications: [{ statement: "Product experience", evidence: "Experience is required." }],
  preferred_qualifications: [],
  skills_and_keywords: [{ skill: "React", evidence: "React is named." }],
  interview_topics: [{ topic: "Planning", reason: "It is central to the role.", evidence: "The posting emphasizes planning." }],
  research_tasks: [], concerns_and_unknowns: [],
  suggested_next_action: { action: "Prepare a planning example.", reason: "Planning is central." },
  limitations: ["The posting may not include every team detail."],
};
const v2Brief = {
  schema_version: "2", role_summary: "Own platform reliability. Partner with product teams.",
  responsibility_themes: ["Build reliable services"], formal_requirements: ["Engineering experience"], preferred_qualifications: [], important_conditions: [], skills_and_tools: ["Observability"],
  interview_preparation: [{ topic: "Reliability", preparation: "Prepare a reliability improvement example." }], research_questions: ["Which systems would this role support first?"], unknowns: ["The reporting structure is not specified."], next_action: { action: "Prepare reliability examples.", reason: "Reliability is central." }, limitations: ["Based only on the supplied posting."],
};

describe("JobIntelligenceBriefTab", () => {
  it("renders the structured response, accessible evidence, neutral empty states, and timestamp", () => {
    const markup = renderToStaticMarkup(
      <JobIntelligenceBriefTab brief={brief} eligibility={{ isEligible: true, reason: "" }} error="" isGenerating={false} isStale={false} meta={{ generated_at: "2026-07-22T19:14:00.000Z" }} onGenerate={() => {}} />,
    );
    expect(markup).toContain("Role summary");
    expect(markup).toContain("Evidence:");
    expect(markup).toContain("Interview preparation themes");
    expect(markup).toContain("Suggested next preparation step");
    expect(markup).toContain("Analysis limitations");
    expect(markup.match(/None identified from the supplied posting\./g)).toHaveLength(3);
    expect(markup).toContain("Generated July 22, 2026");
    expect(markup).toContain("Google Gemini");
    expect(markup).toContain("human reviewers may process them");
    expect(markup).toContain("Do not include personal, confidential, or sensitive information.");
  });

  it("keeps an ineligible generation action disabled with the specific explanation", () => {
    const markup = renderToStaticMarkup(
      <JobIntelligenceBriefTab brief={null} eligibility={{ isEligible: false, reason: "Add a company name before generating a brief." }} error="" isGenerating={false} isStale={false} meta={null} onGenerate={() => {}} />,
    );
    expect(markup).toContain("disabled");
    expect(markup).toContain("Add a company name before generating a brief.");
    expect(markup).toContain('type="button"');
  });

  it("renders v2 plain-language sections without v1 evidence labels", () => {
    const markup = renderToStaticMarkup(<JobIntelligenceBriefTab brief={v2Brief} eligibility={{ isEligible: true, reason: "" }} error="" isGenerating={false} isStale={false} meta={null} onGenerate={() => {}} />);
    expect(markup).toContain("Responsibility themes");
    expect(markup).not.toContain("Preferred or plus qualifications");
    expect(markup).toContain("Interview preparation");
    expect(markup).toContain("Prepare a reliability improvement example.");
    expect(markup).not.toContain("Evidence:");
  });
});
