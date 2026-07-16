import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "../frontend/node_modules/jsdom/lib/api.js";

import { detectZipRecruiterJobPage } from "./zipRecruiterDetector.mjs";

const longDescription = "Build reliable data tools for fictional operations teams. ".repeat(4);

function withDom(html, url, callback) {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalStyle = globalThis.getComputedStyle;
  const originalTimeout = globalThis.setTimeout;
  const originalNode = globalThis.Node;
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { url });
  try {
    globalThis.document = dom.window.document;
    globalThis.window = dom.window;
    globalThis.Node = dom.window.Node;
    globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
    globalThis.setTimeout = () => 0;
    Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", { configurable: true, get() { return this.textContent; } });
    dom.window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      const left = this.closest("aside") ? 0 : 500;
      return { left, right: left + 400, top: 20, bottom: 300, width: 400, height: 280 };
    };
    return callback(dom);
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
    globalThis.Node = originalNode;
    globalThis.getComputedStyle = originalStyle;
    globalThis.setTimeout = originalTimeout;
  }
}

function fixture({ remote = false, compensation = true } = {}) {
  return `
    <aside><article><h2>Left Result Analyst</h2><a href="/co/left-result">Left Result Company</a><p>Norfolk, VA</p></article></aside>
    <section data-testid="current-job-detail">
      <h2>${remote ? "Python Data Scientist / Data Engineer" : "Supply Chain Data Analyst"}</h2>
      <a href="/co/${remote ? "hrc-global" : "howmet"}">${remote ? "HRC Global Services" : "Howmet Aerospace"}</a>
      <p>${remote ? "Virginia Beach, VA • Remote" : "Hampton, VA"}</p>
      ${compensation ? "<span>$100K - $120K/yr</span>" : ""}
      <span>Full-time</span><span>Posted 7 days ago</span>
      <section data-testid="job-description"><h2>Job description</h2><div><p>${longDescription}</p><p>Company Description</p></div></section>
    </section>
    <article><h2>Recommended Job</h2><a href="/co/recommended">Recommended Company</a></article>`;
}

function ratedFixture() {
  return `
    <aside>
      <article><h2>Left Result Analyst</h2><a href="/co/left">Left Result Company</a></article>
      <article><h2>Other Result Role</h2><a href="/co/other">Other Result Company</a></article>
    </aside>
    <section data-testid="current-job-detail">
      <div class="current-summary">
       <div data-testid="posting-header">
        <img alt="Howmet Aerospace logo" src="fictional-logo.png">
        <h2>Supply Chain Data Analyst</h2>
        <a href="/co/Howmet-Aerospace">Howmet Aerospace</a>
        <p>Hampton, VA</p>
       </div>
       <div data-testid="posting-metadata">
        <div><p>$100K - $120K/yr</p></div><div><p>Full-time</p></div><div><p>Medical, Dental, Vision, Life, Retirement</p></div><div><p>Posted 7 days ago</p></div>
       </div>
      </div>
      <section><h2>Howmet Aerospace rating</h2><p>Powered by real frontline workers on Breakroom</p><p>Based on 158 frontline employees</p><p>45th of 61 rated aerospace companies</p><a href="/rating">View more about working here</a></section>
      <section data-testid="job-description"><h2>Job description</h2><ul><li>${longDescription}</li><li>Analyze fictional supply data.</li></ul><h3>Company Description</h3><p>Fictional employer description.</p></section>
    </section>`;
}

function hourlyFixture() {
  return `
    <aside><article><h2>Left Result Role</h2><a href="/co/left">Left Result Company</a><p>$10/hr</p></article></aside>
    <section data-testid="current-job-detail"><div class="current-summary">
      <div data-testid="posting-header"><h2>Fictional Security Analyst</h2><a href="/co/Fictional-Defense">Fictional Defense</a><p>Portsmouth, VA</p></div>
      <div data-testid="posting-metadata"><p>$62 - $79.75/hr</p><p>Full-time</p><p>Posted 4 days ago</p></div>
    </div><section data-testid="job-description"><h2>Job description</h2><p>${longDescription}</p></section></section>`;
}

function actionBeforeMetadataFixture() {
  return `
    <aside><article><h2>Left Result Role</h2><a href="/co/left">Left Result Company</a><p>$10/hr</p></article></aside>
    <section data-testid="current-job-detail">
      <div class="current-summary">
        <div data-testid="posting-header"><h2>Fictional Data Architect</h2><a href="/co/Fictional-Systems">Fictional Systems</a><p>Portsmouth, VA â€¢ On-site</p></div>
        <div data-testid="apply-actions"><h3 hidden>Share this job</h3><p>1-Click Apply</p></div>
        <div data-testid="posting-metadata"><h3 hidden>Share this job</h3><p>$62 - $79.75/hr</p><p>Estimated pay</p><p>Full-time</p><p>Posted 28 days ago</p></div>
      </div>
      <hr><section data-testid="job-description"><h2>Job description</h2><p>${longDescription}</p></section>
    </section>`;
}

test("captures only the selected ZipRecruiter detail pane", () => {
  withDom(fixture(), "https://www.ziprecruiter.com/jobs-search?lk=fake-selected-key", (dom) => {
    const result = detectZipRecruiterJobPage();
    assert.equal(result.status, "detected");
    assert.equal(result.role_title, "Supply Chain Data Analyst");
    assert.equal(result.company_name, "Howmet Aerospace");
    assert.match(result.raw_text, /Hampton, VA\n\$100K - \$120K\/yr\nFull-time/u);
    assert.match(result.raw_text, /Job description\nBuild reliable/u);
    assert.doesNotMatch(result.raw_text, /Left Result|Recommended/u);
    assert.doesNotMatch(result.raw_text, /<\/?(?:section|div|p)>/iu);
    assert.equal(dom.window.document.querySelectorAll("[data-career-pipeline-ziprecruiter-outline]").length, 1);
  });
});

test("keeps remote metadata and blank compensation without reading description duplicates", () => {
  withDom(fixture({ remote: true, compensation: false }), "https://www.ziprecruiter.com/jobs-search/?lk=another-key", () => {
    const result = detectZipRecruiterJobPage();
    assert.equal(result.status, "detected");
    assert.equal(result.role_title, "Python Data Scientist / Data Engineer");
    assert.equal(result.company_name, "HRC Global Services");
    assert.match(result.raw_text, /Virginia Beach, VA • Remote\nFull-time/u);
    assert.doesNotMatch(result.raw_text, /\$100K/u);
  });
});

test("captures selected jobs from paginated ZipRecruiter search paths", () => {
  withDom(fixture(), "https://www.ziprecruiter.com/jobs-search/2?lk=page-two-key", () => {
    const result = detectZipRecruiterJobPage();
    assert.equal(result.status, "detected");
    assert.equal(result.role_title, "Supply Chain Data Analyst");
    assert.equal(result.company_name, "Howmet Aerospace");
    assert.match(result.raw_text, /Job description\nBuild reliable/u);
  });

  assert.equal(
    detectZipRecruiterJobPage({ pageUrl: "https://www.ziprecruiter.com/jobs-search/25/?lk=later-page-key", candidates: [] }).status,
    "no-current-job",
  );
});

test("associates a rated posting with its compact header and excludes rating or benefits text", () => {
  withDom(ratedFixture(), "https://www.ziprecruiter.com/jobs-search?lk=rated-selected-key", (dom) => {
    const result = detectZipRecruiterJobPage();
    assert.equal(result.status, "detected");
    assert.equal(result.role_title, "Supply Chain Data Analyst");
    assert.equal(result.company_name, "Howmet Aerospace");
    assert.match(result.raw_text, /Hampton, VA\n\$100K - \$120K\/yr\nFull-time/u);
    assert.match(result.raw_text, /Job description\nBuild reliable/u);
    assert.doesNotMatch(result.raw_text, /Left Result|Howmet Aerospace rating|Breakroom|158 frontline|45th of 61|View more|Medical, Dental/u);
    assert.equal(dom.window.document.querySelector('[data-career-pipeline-ziprecruiter-outline]')?.getAttribute("data-testid"), "job-description");
  });
});

test("captures sibling metadata without borrowing it from left results", () => {
  withDom(hourlyFixture(), "https://www.ziprecruiter.com/jobs-search?lk=hourly-selected-key", () => {
    const result = detectZipRecruiterJobPage();
    assert.equal(result.status, "detected");
    assert.equal(result.role_title, "Fictional Security Analyst");
    assert.match(result.raw_text, /Portsmouth, VA\n\$62 - \$79\.75\/hr\nFull-time\nPosted 4 days ago/u);
    assert.doesNotMatch(result.raw_text, /\$10\/hr/u);
  });
});

test("finds content-classified metadata after an action block and ignores hidden headings", () => {
  withDom(actionBeforeMetadataFixture(), "https://www.ziprecruiter.com/jobs-search?lk=metadata-selected-key", () => {
    const result = detectZipRecruiterJobPage();
    assert.equal(result.status, "detected");
    assert.equal(result.role_title, "Fictional Data Architect");
    assert.equal(result.company_name, "Fictional Systems");
    assert.match(result.raw_text, /Portsmouth, VA â€¢ On-site\n\$62 - \$79\.75\/hr\nFull-time\nPosted 28 days ago/u);
    assert.match(result.raw_text, /Job description\nBuild reliable/u);
    assert.doesNotMatch(result.raw_text, /Estimated pay|1-Click Apply|Share this job|\$10\/hr/u);
  });
});

test("rejects invalid selected-job routes and ambiguous or hidden detail panes", () => {
  assert.equal(detectZipRecruiterJobPage({ pageUrl: "https://www.ziprecruiter.com/jobs-search?search=data" }).status, "not-ziprecruiter");
  assert.equal(detectZipRecruiterJobPage({ pageUrl: "https://ziprecruiter.com.evil.test/jobs-search?lk=fake" }).status, "not-ziprecruiter");
  assert.equal(detectZipRecruiterJobPage({ pageUrl: "https://www.ziprecruiter.com/jobs-search?lk=one&lk=two" }).status, "not-ziprecruiter");
  for (const pageUrl of [
    "https://www.ziprecruiter.com/jobs-search/0?lk=fake",
    "https://www.ziprecruiter.com/jobs-search/00?lk=fake",
    "https://www.ziprecruiter.com/jobs-search/page/2?lk=fake",
    "https://www.ziprecruiter.com/jobs-search/2/extra?lk=fake",
  ]) {
    assert.equal(detectZipRecruiterJobPage({ pageUrl }).status, "not-ziprecruiter");
  }
  withDom(`${fixture()}${fixture()}`, "https://www.ziprecruiter.com/jobs-search?lk=fake", () => {
    assert.equal(detectZipRecruiterJobPage().status, "ambiguous-job");
  });
  withDom(fixture().replace('data-testid="current-job-detail"', 'data-testid="current-job-detail" hidden'), "https://www.ziprecruiter.com/jobs-search?lk=fake", () => {
    assert.equal(detectZipRecruiterJobPage().status, "no-current-job");
  });
  withDom(fixture().replace(longDescription, "x".repeat(100_001)), "https://www.ziprecruiter.com/jobs-search?lk=fake", () => {
    assert.equal(detectZipRecruiterJobPage().status, "capture-too-large");
  });
});

test("remains injectable without module scope and returns clone-safe data", () => {
  const isolatedDetector = Function(`"use strict"; return (${detectZipRecruiterJobPage.toString()});`)();
  const result = isolatedDetector({ pageUrl: "https://www.ziprecruiter.com/jobs-search?lk=fake", candidates: [] });
  assert.equal(result.status, "no-current-job");
  assert.doesNotThrow(() => structuredClone(result));
});
