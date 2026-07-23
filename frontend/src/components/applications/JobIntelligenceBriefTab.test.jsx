import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import JobIntelligenceBriefTab from "./JobIntelligenceBriefTab.jsx";

const brief = { schema_version: "2", role_summary: "Own platform reliability. Partner with product teams.", responsibility_themes: ["Build reliable services"], formal_requirements: ["Engineering experience"], preferred_qualifications: [], important_conditions: [], skills_and_tools: ["Observability"], interview_preparation: [{ topic: "Reliability", preparation: "Prepare a reliability example." }], research_questions: ["Which systems come first?"], unknowns: ["The reporting structure is not specified."], next_action: { action: "Prepare examples.", reason: "Reliability is central." }, limitations: ["Based only on the supplied posting."] };
const eligible = { isEligible: true, reason: "" };
const generatedMeta = { generated_at: "2026-07-22T19:14:00.000Z" };
const renderBrief = (props = {}) => renderToStaticMarkup(<JobIntelligenceBriefTab brief={null} eligibility={eligible} error="" hasUnsavedAiSourceChanges={false} isGenerating={false} isPersistedBriefStale={false} meta={null} onGenerate={() => {}} onRemove={() => {}} {...props} />);

describe("JobIntelligenceBriefTab", () => {
  it("renders the eligible empty state with one consolidated privacy panel", () => {
    const markup = renderBrief();
    expect(markup).toContain("AI-assisted analysis");
    expect(markup).toContain("Google Gemini");
    expect(markup).toContain("human reviewers may process");
    expect(markup.match(/ai-brief-information-group/g)).toHaveLength(3);
    expect(markup).toContain("Generate AI brief");
    expect(markup).not.toContain("Generated brief");
  });

  it("keeps the ineligible reason near a disabled initial action", () => {
    const markup = renderBrief({ eligibility: { isEligible: false, reason: "Add a company name." } });
    expect(markup).toContain("Add a company name.");
    expect(markup).toContain("disabled");
  });

  it("renders one visible initial loading label with a spinner and live announcement", () => {
    const markup = renderBrief({ isGenerating: true });
    expect(markup.match(/Generating brief\u2026/g)).toHaveLength(1);
    expect(markup).toContain("ai-brief-spinner");
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("Generating AI brief.");
  });

  it("places save-first guidance outside the introduction panel and hides the initial action", () => {
    const markup = renderBrief({ hasUnsavedAiSourceChanges: true });
    expect(markup).toContain("Save changes before using AI Brief");
    expect(markup).not.toContain("Generate AI brief");
    expect(markup).toContain('</section><div class="message message-warning ai-brief-report-message" role="status">Save changes before using AI Brief</div>');
  });

  it("places metadata in the generated report header without an action for a current brief", () => {
    const markup = renderBrief({ brief, meta: generatedMeta });
    expect(markup).toContain("Generated brief");
    expect(markup).toContain("Generated July 22, 2026");
    expect(markup).not.toContain("Regenerate brief");
    expect(markup).not.toContain("Refresh brief");
    expect(markup).toContain("Remove brief");
    expect(markup).toContain("ai-brief-remove-action");
    expect(markup).toContain("Responsibility themes");
    expect(markup).toContain("Suggested next preparation step");
  });

  it("keeps a report visible while refreshing a saved-stale brief and places status before it", () => {
    const markup = renderBrief({ brief, meta: generatedMeta, isGenerating: true, isPersistedBriefStale: true, error: "Unavailable" });
    expect(markup.match(/Refreshing brief\u2026/g)).toHaveLength(1);
    expect(markup).toContain("Refreshing AI brief.");
    expect(markup).toContain("Unavailable");
    expect(markup).not.toContain("Regenerating brief");
    expect(markup).toContain("Saved job details changed. Refresh this brief.");
    expect(markup).not.toContain("The company, role, job details, or Job Posting Snapshot changed after this brief was generated.");
    expect(markup.indexOf("Saved job details changed. Refresh this brief.")).toBeLessThan(markup.indexOf("Own platform reliability."));
  });

  it("shows save-first guidance and hides Refresh when AI source fields have unsaved edits", () => {
    const markup = renderBrief({ brief, meta: generatedMeta, hasUnsavedAiSourceChanges: true, isPersistedBriefStale: true });
    expect(markup).toContain("Save changes before using AI Brief");
    expect(markup.match(/Save changes before using AI Brief/g)).toHaveLength(1);
    expect(markup).not.toContain("Save the application before refreshing the analysis.");
    expect(markup).not.toContain("Saved job details changed. Refresh this brief.");
    expect(markup).not.toContain("Refresh brief");
    expect(markup).toContain("Remove brief");
  });
});
