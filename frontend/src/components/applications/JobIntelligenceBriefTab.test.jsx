// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import JobIntelligenceBriefTab, { copyTextToClipboard, formatGeneratedAt, formatJobBriefForClipboard } from "./JobIntelligenceBriefTab.jsx";

const brief = { schema_version: "2", role_summary: "Own platform reliability. Partner with product teams.", responsibility_themes: ["Build reliable services"], formal_requirements: ["Engineering experience"], preferred_qualifications: [], important_conditions: [], skills_and_tools: ["Observability"], interview_preparation: [{ topic: "Reliability", preparation: "Prepare a reliability example." }], research_questions: ["Which systems come first?"], unknowns: ["The reporting structure is not specified."], next_action: { action: "Prepare examples.", reason: "Reliability is central." }, limitations: ["Based only on the supplied posting."] };
const eligible = { isEligible: true, reason: "" };
const generatedMeta = { generated_at: "2026-07-22T19:14:00.000Z" };
const renderBrief = (props = {}) => renderToStaticMarkup(<JobIntelligenceBriefTab brief={null} eligibility={eligible} error="" hasUnsavedAiSourceChanges={false} isGenerating={false} isPersistedBriefStale={false} meta={null} onGenerate={() => {}} onRemove={() => {}} {...props} />);

describe("JobIntelligenceBriefTab", () => {
  it("formats generated timestamps in the browser timezone after normalizing UTC", () => {
    expect(formatGeneratedAt("2026-07-24T03:36:00")).toBe(
      formatGeneratedAt("2026-07-24T03:36:00Z")
    );
    expect(formatGeneratedAt("2026-07-24T03:36:00-04:00")).toBe(
      formatGeneratedAt("2026-07-24T07:36:00Z")
    );
    expect(formatGeneratedAt("2026-07-24T03:36:00.255243")).toBe(
      formatGeneratedAt("2026-07-24T03:36:00.255243Z")
    );
    expect(formatGeneratedAt()).toBe("");
    expect(formatGeneratedAt("not a timestamp")).toBe("");
  });

  it("renders the eligible empty state with one consolidated privacy panel", () => {
    const markup = renderBrief();
    expect(markup).toContain("AI-assisted analysis");
    expect(markup).toContain("Google Gemini");
    expect(markup).toContain("human reviewers may process");
    expect(markup.match(/ai-brief-information-group/g)).toHaveLength(3);
    expect(markup).toContain("Generate AI brief");
    expect(markup).not.toContain("Generated brief");
    expect(markup).not.toContain("Copy brief");
    expect(markup).not.toContain("AI-generated");
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
    expect(markup).toContain("AI-generated");
    expect(markup).toContain("Generated from the saved Job Posting Snapshot");
    expect(markup).toContain("Review recommendations against the original posting.");
    expect(markup).not.toContain("Generated brief");
    expect(markup).toContain("July 22, 2026");
    expect(markup).not.toContain("Regenerate brief");
    expect(markup).not.toContain("Refresh brief");
    expect(markup).toContain("Remove brief");
    expect(markup).toContain("ai-brief-remove-action");
    expect(markup).toContain("Responsibility themes");
    expect(markup).toContain("AI role summary");
    expect(markup).toContain("Suggested next preparation step");
    expect(markup).not.toContain("Role overview");
    expect(markup).not.toContain("At a glance");
    expect(markup.indexOf("AI role summary")).toBeLessThan(markup.indexOf("Job posting signals"));
    expect(markup).toContain("ai-brief-role-analysis-grid");
    expect(markup).toContain("ai-brief-skill-list");
    expect(markup.indexOf("Skills and tools")).toBeLessThan(markup.indexOf("Job posting signals"));
    expect(markup).toContain("AI interview preparation");
    expect(markup).toContain("AI recommendation");
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain("Expand all");
    expect(markup).toContain('<ol class="ai-brief-interview-list">');
    expect(markup).toContain('class="ai-brief-interview-number" aria-hidden="true">01</span>');
  });

  it("uses a semantic condition list and omits empty report groups", () => {
    const populatedConditions = { ...brief, important_conditions: ["Hybrid role with travel expected."] };
    const markup = renderBrief({ brief: populatedConditions, meta: generatedMeta });
    expect(markup).toContain('<ul class="ai-brief-condition-list"><li>Hybrid role with travel expected.</li></ul>');
    expect(markup.match(/Important conditions/g)).toHaveLength(1);
    expect(markup.indexOf("Important conditions")).toBeLessThan(markup.indexOf("Job posting signals"));
    expect(markup).not.toContain("Preferred or plus qualifications");

    const sparseBrief = { ...brief, important_conditions: [], research_questions: [], unknowns: [], limitations: [], interview_preparation: [] };
    const sparseMarkup = renderBrief({ brief: sparseBrief, meta: generatedMeta });
    expect(sparseMarkup).not.toContain("Important conditions");
    expect(sparseMarkup).not.toContain("Supporting analysis");
    expect(sparseMarkup).not.toContain("Interview preparation");
  });

  it("keeps preferred qualifications out of the primary grid and uses one report shell", () => {
    const populatedBrief = { ...brief, preferred_qualifications: ["Experience with finance systems"] };
    const markup = renderBrief({ brief: populatedBrief, meta: generatedMeta });
    expect(markup).toContain("ai-brief-preferred-qualifications");
    expect(markup).toContain("Experience with finance systems");
    expect(markup.match(/ai-brief-report-header/g)).toHaveLength(1);
    expect(markup.match(/ai-brief-report-body/g)).toHaveLength(1);
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

describe("JobIntelligenceBriefTab supporting analysis", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function render(props = {}) {
    await act(async () => root.render(<JobIntelligenceBriefTab brief={brief} eligibility={eligible} error="" hasUnsavedAiSourceChanges={false} isGenerating={false} isPersistedBriefStale={false} meta={generatedMeta} onGenerate={() => {}} onRemove={() => {}} {...props} />));
  }

  function disclosureButton(heading) {
    return [...container.querySelectorAll(".ai-brief-disclosure-button")].find((button) => button.textContent.includes(heading));
  }

  it("uses a compact visible AI-generated heading with accessible context", async () => {
    await render();

    const heading = container.querySelector(".ai-brief-report-heading");
    const sparkle = heading.querySelector(".ai-brief-title-sparkle");
    const badge = heading.querySelector(".ai-brief-generated-badge");
    const suffix = heading.querySelector(".visually-hidden");

    expect(heading.tagName).toBe("H3");
    expect(sparkle.getAttribute("aria-hidden")).toBe("true");
    expect(sparkle.nextElementSibling).toBe(badge);
    expect(badge.textContent).toBe("AI-generated");
    expect(badge.getAttribute("aria-hidden")).toBeNull();
    expect(suffix.textContent).toBe(" Job Intelligence Brief");
    expect(`${badge.textContent}${suffix.textContent}`).toBe("AI-generated Job Intelligence Brief");
    expect(container.querySelectorAll(".ai-brief-report-header h3")).toHaveLength(1);
    expect(container.querySelectorAll(".ai-brief-generated-badge")).toHaveLength(1);
    expect(container.querySelector(".ai-brief-generated-at").textContent).toContain(
      "Generated from the saved Job Posting Snapshot"
    );
    expect(container.querySelector(".ai-brief-review-reminder").textContent).toBe(
      "Review recommendations against the original posting."
    );
  });

  it("opens individual disclosures, expands all groups, and resets for a replacement brief", async () => {
    await render();
    const research = disclosureButton("Details to research");
    const unknowns = disclosureButton("Unknowns to clarify");
    const researchRegion = document.getElementById(research.getAttribute("aria-controls"));
    expect(research.getAttribute("aria-expanded")).toBe("false");
    expect(research.closest(".ai-brief-disclosure-list")).toBeTruthy();
    expect(research.querySelector(".ai-brief-disclosure-count").textContent).toBe("1");
    expect(researchRegion.hidden).toBe(true);
    expect(container.querySelector(".ai-brief-expand-all").textContent).toBe("Expand all");

    await act(async () => research.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(research.getAttribute("aria-expanded")).toBe("true");
    expect(unknowns.getAttribute("aria-expanded")).toBe("false");
    expect(researchRegion.hidden).toBe(false);

    await act(async () => container.querySelector(".ai-brief-expand-all").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect([...container.querySelectorAll(".ai-brief-disclosure-button")].every((button) => button.getAttribute("aria-expanded") === "true")).toBe(true);
    expect(container.querySelector(".ai-brief-expand-all").textContent).toBe("Collapse all");

    await act(async () => container.querySelector(".ai-brief-expand-all").dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect([...container.querySelectorAll(".ai-brief-disclosure-button")].every((button) => button.getAttribute("aria-expanded") === "false")).toBe(true);

    await act(async () => research.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await render({ meta: { generated_at: "2026-07-23T19:14:00.000Z" } });
    expect(disclosureButton("Details to research").getAttribute("aria-expanded")).toBe("false");
  });

  it("does not render the group control when only one supporting group is populated", async () => {
    await render({ brief: { ...brief, unknowns: [], limitations: [] } });
    expect(disclosureButton("Details to research")).toBeTruthy();
    expect(container.querySelector(".ai-brief-expand-all")).toBeNull();
  });
});

describe("JobIntelligenceBriefTab copy brief", () => {
  let container;
  let root;
  let originalClipboard;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    if (originalClipboard) Object.defineProperty(navigator, "clipboard", originalClipboard);
    else delete navigator.clipboard;
    vi.useRealTimers();
  });

  async function render(props = {}) {
    await act(async () => root.render(<JobIntelligenceBriefTab brief={brief} eligibility={eligible} error="" hasUnsavedAiSourceChanges={false} isGenerating={false} isPersistedBriefStale={false} meta={generatedMeta} onGenerate={() => {}} onRemove={() => {}} {...props} />));
  }

  it("formats populated and sparse briefs in a stable, safe order", () => {
    const text = formatJobBriefForClipboard({ brief: { ...brief, important_conditions: ["Hybrid"], preferred_qualifications: ["Finance"] }, generatedAt: "Generated July 22, 2026 at 3:14 PM", isPersistedBriefStale: true });
    expect(text).toContain("AI-generated from the saved Job Posting Snapshot");
    expect(text).toContain("Status: Saved job details changed; refresh recommended.");
    expect(text.indexOf("AI role summary")).toBeLessThan(text.indexOf("Important conditions"));
    expect(text.indexOf("Important conditions")).toBeLessThan(text.indexOf("Job posting signals"));
    expect(text).toContain("1. Reliability\n   Prepare a reliability example.");
    expect(text).not.toContain("undefined");
    expect(text).not.toContain("null");
    expect(text).not.toMatch(/\n{3,}/);

    const sparse = formatJobBriefForClipboard({ brief: { ...brief, important_conditions: [], skills_and_tools: [], responsibility_themes: [], formal_requirements: [], preferred_qualifications: [], interview_preparation: [], research_questions: [], unknowns: [], limitations: [] }, generatedAt: "Generated July 22, 2026 at 3:14 PM", isPersistedBriefStale: false });
    expect(sparse).not.toContain("Important conditions");
    expect(sparse).not.toContain("Supporting analysis");
    expect(sparse).not.toContain("Status: Saved job details changed");
  });

  it("copies the visible brief, announces success, and restores the action label", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await render();
    const copy = [...container.querySelectorAll("button")].find((button) => button.textContent === "Copy brief");

    await act(async () => copy.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("AI Job Intelligence Brief"));
    expect(copy.textContent).toBe("Copied");
    expect(container.textContent).toContain("AI brief copied.");

    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(copy.textContent).toBe("Copy brief");
  });

  it("keeps lifecycle errors and clears a copy failure after a later success", async () => {
    const writeText = vi.fn().mockRejectedValueOnce(new Error("Denied")).mockResolvedValueOnce(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await render({ error: "Refresh unavailable", isPersistedBriefStale: true, isGenerating: true });
    const copy = [...container.querySelectorAll("button")].find((button) => button.textContent === "Copy brief");

    await act(async () => copy.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.textContent).toContain("Could not copy the AI brief. Try again.");
    expect(container.textContent).toContain("Refresh unavailable");

    await act(async () => copy.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(container.textContent).not.toContain("Could not copy the AI brief. Try again.");
  });

  it("uses the textarea fallback when the Clipboard API is unavailable", async () => {
    delete navigator.clipboard;
    document.execCommand = vi.fn(() => true);
    await copyTextToClipboard("Plain text brief");
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });
});
