import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "../frontend/node_modules/jsdom/lib/api.js";

import { detectLinkedInJobPage } from "./linkedinDetector.mjs";

const description = "Build reliable systems for fictional customer teams. ".repeat(4);
const base = (overrides = {}) => ({
  pageUrl: "https://www.linkedin.com/jobs/view/123456789",
  descriptions: [{ title: "Fictional Operations Analyst", company: "Northstar Labs", location: "Richmond, VA", work_arrangement: "Hybrid", employment_type: "Full-time", description }],
  ...overrides,
});

test("builds parser-friendly LinkedIn text for one current job", () => {
  const result = detectLinkedInJobPage(base());
  assert.equal(result.status, "detected");
  assert.equal(result.provider, "linkedin");
  assert.equal(result.source, "LinkedIn");
  assert.match(result.raw_text, /^Company logo for, Northstar Labs\.\nNorthstar Labs\nFictional Operations Analyst\nRichmond, VA\nHybrid\nFull-time\nAbout the job/m);
  assert.doesNotMatch(result.raw_text, /Recommended role|People you can reach out to/u);
  assert.doesNotThrow(() => structuredClone(result));
});

test("keeps current side-panel fields associated and supports work arrangements", () => {
  for (const [workArrangement, expected] of [["Remote", "Remote"], ["Hybrid", "Hybrid"], ["On-site", "On-site"]]) {
    const result = detectLinkedInJobPage(base({ descriptions: [{ title: "Fictional Coordinator", company: "Summit Data", location: "Cleveland, OH", work_arrangement: workArrangement, employment_type: "", description }] }));
    assert.equal(result.role_title, "Fictional Coordinator");
    assert.equal(result.company_name, "Summit Data");
    assert.equal(result.raw_text.split("\n")[4], expected);
  }
});

test("rejects missing identity, short, ambiguous, and oversized captures", () => {
  assert.equal(detectLinkedInJobPage(base({ descriptions: [{ title: "", company: "Northstar", description }] })).status, "no-current-job");
  assert.equal(detectLinkedInJobPage(base({ descriptions: [{ title: "Role", company: "", description }] })).status, "no-current-job");
  assert.equal(detectLinkedInJobPage(base({ descriptions: [{ title: "Role", company: "Northstar", description: "short" }] })).status, "no-current-job");
  assert.equal(detectLinkedInJobPage(base({ descriptions: [base().descriptions[0], base().descriptions[0]] })).status, "ambiguous-job");
  assert.equal(detectLinkedInJobPage(base({ descriptions: [{ title: "Role", company: "Northstar", description: "x".repeat(80_001) }] })).status, "capture-too-large");
});

test("accepts supported LinkedIn job URLs and rejects lookalikes or credentials", () => {
  for (const pageUrl of ["https://linkedin.com/jobs/view/123", "https://www.linkedin.com/jobs/search/?keywords=test"]) assert.equal(detectLinkedInJobPage(base({ pageUrl })).status, "detected");
  assert.equal(detectLinkedInJobPage(base({ pageUrl: "https://linkedin.com.evil.test/jobs/view/123" })).status, "not-linkedin");
  assert.equal(detectLinkedInJobPage(base({ pageUrl: "https://user:pass@www.linkedin.com/jobs/view/123" })).status, "not-linkedin");
  assert.equal(detectLinkedInJobPage(base({ pageUrl: "https://www.linkedin.com:8443/jobs/view/123" })).status, "not-linkedin");
});

test("runs after source reconstruction without module scope and returns plain data", () => {
  const isolatedDetector = Function(`"use strict"; return (${detectLinkedInJobPage.toString()});`)();
  const result = isolatedDetector(base());
  assert.equal(result.status, "detected");
  assert.equal(result.company_name, "Northstar Labs");
  assert.doesNotThrow(() => structuredClone(result));
});

test("associates separate header and About-the-job cards within the current detail pane", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalSetTimeout = globalThis.setTimeout;
  const dom = new JSDOM(`<!doctype html><body>
    <aside><article><h1>Left Result Role</h1><a href="/company/left-result">Left Result Company</a></article></aside>
    <main role="main">
      <article data-view-name="job-header"><a href="/company/current">Northstar Current</a><p>Fictional Current Analyst <a href="#"><span role="img" aria-label="Verified job"></span></a></p><span data-test-id="job-details-location">Richmond, VA</span><span data-test-id="job-details-workplace-type">Hybrid</span><span data-test-id="job-details-job-type">Full-time</span></article>
      <article><h2>Your profile and resume match</h2><p>Unrelated card</p></article>
      <article><h2>People you can reach out to</h2><p>Unrelated card</p></article>
      <article data-testid="job-details"><h2>About the job</h2><div data-live-test-job-description>${description}</div></article>
      <article><h2>Recommended job</h2><h1>Recommended Role</h1><a href="/company/recommended">Recommended Company</a></article>
    </main></body>`, { url: "https://www.linkedin.com/jobs/view/123456789" });
  try {
    globalThis.document = dom.window.document;
    globalThis.window = dom.window;
    globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
    globalThis.setTimeout = () => 0;
    Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", { configurable: true, get() { return this.textContent; } });
    dom.window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      const left = this.closest("aside") ? 0 : 500;
      const top = /Recommended Role/u.test(this.textContent) ? 450 : this.tagName === "H1" ? 20 : 200;
      return { left, right: left + 400, top, width: 400, height: 100 };
    };
    const result = detectLinkedInJobPage();
    assert.equal(result.status, "detected");
    assert.equal(result.role_title, "Fictional Current Analyst");
    assert.equal(result.company_name, "Northstar Current");
    assert.match(result.raw_text, /Fictional Current Analyst\nRichmond, VA\nHybrid\nFull-time\nAbout the job/u);
    assert.doesNotMatch(result.raw_text, /Verified job/u);
    assert.match(result.raw_text, /^Company logo for, Northstar Current\.$/mu);
    assert.doesNotMatch(result.raw_text, /Left Result|Recommended/u);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.getComputedStyle = originalGetComputedStyle;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("uses currentJobId and matching semantic side-panel evidence before generic fallback", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalSetTimeout = globalThis.setTimeout;
  const dom = new JSDOM(`<!doctype html><body>
    <aside><a href="/jobs/view/111111">Left result role</a></aside>
    <section data-testid="lazy-column" data-component-type="LazyColumn">
      <div data-view-name="job-header"><div><div><span aria-label="Company, Northstar Selected."></span></div><p><a href="/jobs/view/222222">Fictional Selected Role</a></p></div><p>Richmond, VA · 1 week ago · 18 applicants</p><div><span>Remote</span><span>Full-time</span></div></div>
      <article componentkey="JobMatchRef_222222">Profile match</article>
      <article componentkey="JobDetailsPeopleWhoCanHelpSlot_222222">People you can reach out to</article>
      <article componentkey="JobDetails_AboutTheJob_222222"><div data-sdui-component="aboutTheJob"><h2>About the job</h2><div data-testid="expandable-text-box">${description}</div></div></article>
    </section></body>`, { url: "https://www.linkedin.com/jobs/search/?currentJobId=222222" });
  try {
    globalThis.document = dom.window.document;
    globalThis.window = dom.window;
    globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
    globalThis.setTimeout = () => 0;
    Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", { configurable: true, get() { return this.textContent; } });
    dom.window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.getAttribute("data-testid") === "expandable-text-box") return { left: 500, right: 900, top: 700, bottom: 1700, width: 400, height: 1000 };
      return { left: 500, right: 900, top: 100, bottom: 200, width: 400, height: 100 };
    };
    const result = detectLinkedInJobPage();
    assert.equal(result.status, "detected");
    assert.equal(result.role_title, "Fictional Selected Role");
    assert.equal(result.company_name, "Northstar Selected");
    assert.match(result.raw_text, /Fictional Selected Role\nRichmond, VA\nRemote\nFull-time\nAbout the job/u);
    assert.doesNotMatch(result.raw_text, /Left result|Profile match|People you can reach out to/u);
    assert.equal(dom.window.document.querySelectorAll('[data-career-pipeline-linkedin-outline]').length, 1);
    assert.equal(dom.window.document.querySelector('[data-career-pipeline-linkedin-outline]')?.getAttribute("data-testid"), "expandable-text-box");
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.getComputedStyle = originalGetComputedStyle;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("discovers a standalone expandable description despite side-panel markers", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalSetTimeout = globalThis.setTimeout;
  const dom = new JSDOM(`<!doctype html><body><main id="workspace" role="main"><section data-testid="lazy-column" data-component-type="LazyColumn">
    <div><div><span aria-label="Company, Northstar Learning."></span><p>Fictional Graduate Software Engineer <a href="#"><span role="img" aria-label="Verified job"></span></a></p><p>United States · 1 day ago · Over 100 applicants</p><p>Promoted by hirer · Actively reviewing applicants</p></div><div><a href="/jobs/view/444444/">$50K/yr</a><a href="/jobs/view/444444/">Remote</a><a href="/jobs/view/444444/">Full-time</a></div><button>Apply</button><button>Save</button></div>
    <div><h2>Your profile and resume match</h2><p>Unrelated AI profile card</p></div>
    <div><h2>People you can reach out to</h2><p>Unrelated people card</p></div>
    <div><h2>Premium</h2><p>Unrelated premium card</p></div>
    <div componentkey="JobDetails_AboutTheJob_444444"><div data-sdui-component="aboutTheJob"><div><h2>About the job</h2><div data-testid="expandable-text-box">${description}</div></div></div></div>
    <div><h2>Recommended job</h2><p>Unrelated recommended role</p></div>
  </section></main></body>`, { url: "https://www.linkedin.com/jobs/view/444444/" });
  try {
    globalThis.document = dom.window.document;
    globalThis.window = dom.window;
    globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
    globalThis.setTimeout = () => 0;
    Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", { configurable: true, get() { return this.textContent; } });
    dom.window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      const top = this.closest('[data-testid="job-details"]') ? 600 : 100;
      return { left: 400, right: 900, top, bottom: top + 100, width: 500, height: 100 };
    };
    const result = detectLinkedInJobPage();
    assert.equal(result.status, "detected");
    assert.equal(result.role_title, "Fictional Graduate Software Engineer");
    assert.notEqual(result.role_title, "$50K/yr");
    assert.notEqual(result.role_title, "Remote");
    assert.notEqual(result.role_title, "Full-time");
    assert.equal(result.company_name, "Northstar Learning");
    assert.equal(dom.window.location.pathname, "/jobs/view/444444/");
    const verifiedIcons = Array.from(dom.window.document.querySelectorAll('[role="img"][aria-label="Verified job"]'));
    assert.equal(verifiedIcons.length, 1);
    const verifiedAnchor = verifiedIcons[0]?.closest("a");
    assert.equal(verifiedAnchor?.getAttribute("href"), "#");
    assert.equal(verifiedAnchor?.href, "https://www.linkedin.com/jobs/view/444444/#");
    const jobLinks = Array.from(dom.window.document.querySelectorAll('a[href*="/jobs/view/"]'));
    assert.equal(jobLinks.length, 3);
    assert.equal(jobLinks.includes(verifiedAnchor), false);
    assert.equal(verifiedAnchor?.innerText, "");
    assert.equal(jobLinks[0]?.innerText, "$50K/yr");
    assert.equal(jobLinks[1]?.innerText, "Remote");
    assert.equal(jobLinks[2]?.innerText, "Full-time");
    assert.match(result.raw_text, /Fictional Graduate Software Engineer\nLocation: United States\nRemote\nFull-time\nAbout the job/u);
    assert.doesNotMatch(result.raw_text, /Promoted by hirer|Actively reviewing applicants/u);
    assert.equal((result.raw_text.match(/\bRemote\b/gu) || []).length, 1);
    assert.equal((result.raw_text.match(/\bFull-time\b/gu) || []).length, 1);
    assert.match(result.raw_text, new RegExp(description.slice(0, 40), "u"));
    assert.doesNotMatch(result.raw_text, /Verified job|Unrelated|Apply|Save/u);
    assert.match(result.raw_text, /^Company logo for, Northstar Learning\.$/mu);
    assert.equal(dom.window.document.querySelectorAll('[data-career-pipeline-linkedin-outline]').length, 1);
    assert.equal(dom.window.document.querySelector('[data-career-pipeline-linkedin-outline]')?.getAttribute("data-testid"), "expandable-text-box");
    assert.doesNotThrow(() => structuredClone(result));
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.getComputedStyle = originalGetComputedStyle;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("finds a standalone expandable description through its bounded About heading", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const originalSetTimeout = globalThis.setTimeout;
  const dom = new JSDOM(`<!doctype html><body><main id="workspace" role="main">
    <div><span aria-label="Company, Fictional Vertex."></span><p>Fictional Platform Engineer <a href="#"><span role="img" aria-label="Verified job"></span></a></p><p>United States · Reposted 2 weeks ago · Over 100 people clicked apply</p><p>Promoted by hirer · Responses managed off LinkedIn</p><div><a href="/jobs/view/555555/">Remote</a><a href="/jobs/view/555555/">Full-time</a></div></div>
    <div><h2>About the job</h2><div data-testid="expandable-text-box">${description}</div></div>
  </main></body>`, { url: "https://www.linkedin.com/jobs/view/555555/" });
  try {
    globalThis.document = dom.window.document;
    globalThis.window = dom.window;
    globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
    globalThis.setTimeout = () => 0;
    Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", { configurable: true, get() { return this.textContent; } });
    dom.window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      const top = this.getAttribute("data-testid") === "expandable-text-box" ? 600 : 100;
      return { left: 400, right: 900, top, bottom: top + 100, width: 500, height: 100 };
    };
    const result = detectLinkedInJobPage();
    assert.equal(result.status, "detected");
    assert.equal(result.role_title, "Fictional Platform Engineer");
    assert.equal(result.company_name, "Fictional Vertex");
    assert.match(result.raw_text, /Fictional Platform Engineer\nLocation: United States\nRemote\nFull-time\nAbout the job/u);
    assert.doesNotMatch(result.raw_text, /Promoted by hirer|Responses managed/u);
    assert.equal(dom.window.document.querySelector('[data-career-pipeline-linkedin-outline]')?.getAttribute("data-testid"), "expandable-text-box");
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.getComputedStyle = originalGetComputedStyle;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test("rejects a matching side-panel description when it is fully offscreen", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalGetComputedStyle = globalThis.getComputedStyle;
  const dom = new JSDOM(`<!doctype html><body><section data-testid="lazy-column" data-component-type="LazyColumn"><article><a href="/jobs/view/333333">Fictional Offscreen Role</a><span aria-label="Company, Northstar Offscreen"></span></article><article componentkey="JobDetails_AboutTheJob_333333"><div data-sdui-component="aboutTheJob"><div data-testid="expandable-text-box">${description}</div></div></article></section></body>`, { url: "https://www.linkedin.com/jobs/search/?currentJobId=333333" });
  try {
    globalThis.document = dom.window.document;
    globalThis.window = dom.window;
    globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
    Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", { configurable: true, get() { return this.textContent; } });
    dom.window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.getAttribute("data-testid") === "expandable-text-box") return { left: 500, right: 900, top: 900, bottom: 1200, width: 400, height: 300 };
      return { left: 500, right: 900, top: 100, bottom: 200, width: 400, height: 100 };
    };
    assert.equal(detectLinkedInJobPage().status, "no-current-job");
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.getComputedStyle = originalGetComputedStyle;
  }
});
