import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "../frontend/node_modules/jsdom/lib/api.js";

import { detectZipRecruiterJobPage } from "./zipRecruiterDetector.mjs";

const longDescription = "Build reliable data tools for fictional operations teams. ".repeat(4);
const shareToken = "A".repeat(42) + "==";
const unpaddedShareToken = "B".repeat(43);
const singlePaddedShareToken = "C".repeat(43) + "=";

function shareLinks(token = shareToken) {
  const target = `https://www.ziprecruiter.com/job-redirect/share?match_token=${encodeURIComponent(token)}&tsid=fictional`;
  return `<div aria-label="Share this job"><a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(target)}">Facebook</a><a hidden href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(target.replace("fictional", "linkedin"))}">LinkedIn</a></div>`;
}

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
      ${shareLinks()}
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
      ${shareLinks()}
    </section>`;
}

function hourlyFixture() {
  return `
    <aside><article><h2>Left Result Role</h2><a href="/co/left">Left Result Company</a><p>$10/hr</p></article></aside>
    <section data-testid="current-job-detail"><div class="current-summary">
      <div data-testid="posting-header"><h2>Fictional Security Analyst</h2><a href="/co/Fictional-Defense">Fictional Defense</a><p>Portsmouth, VA</p></div>
      <div data-testid="posting-metadata"><p>$62 - $79.75/hr</p><p>Full-time</p><p>Posted 4 days ago</p></div>
    </div>${shareLinks()}<section data-testid="job-description"><h2>Job description</h2><p>${longDescription}</p></section></section>`;
}

function actionBeforeMetadataFixture() {
  return `
    <aside><article><h2>Left Result Role</h2><a href="/co/left">Left Result Company</a><p>$10/hr</p></article></aside>
    <section data-testid="current-job-detail">
      <div class="current-summary">
        <div data-testid="posting-header"><h2>Fictional Data Architect</h2><a href="/co/Fictional-Systems">Fictional Systems</a><p>Portsmouth, VA â€¢ On-site</p></div>
        <div data-testid="apply-actions"><h3 hidden>Share this job</h3><p>1-Click Apply</p></div>
        <div data-testid="posting-metadata"><h3 hidden>Share this job</h3><p>$62 - $79.75/hr</p><p>Estimated pay</p><p>Full-time</p><p>Posted 28 days ago</p></div>
        ${shareLinks()}
      </div>
      <hr><section data-testid="job-description"><h2>Job description</h2><p>${longDescription}</p></section>
    </section>`;
}

function standaloneFixture({ hidden = false, description = longDescription, role = "Junior Project Manager", employer = true, includeCompanyDescription = true } = {}) {
  return `
    <article><h2>Background Recommendation</h2><a href="/co/background">Background Company</a><p>Remote</p></article>
    <div role="dialog" aria-modal="true" ${hidden ? "hidden" : ""} data-zds-component="modal">
      <div data-testid="right-pane"><main data-testid="job-details-scroll-container">
        <header><h2>${role}</h2>${employer ? '<a href="/co/chesapeake-controls">Chesapeake Controls</a>' : ""}<p>Chesapeake, VA â€¢ On-site</p></header>
        <div><p>$60K - $85K/yr</p><p>Full-time</p><p>Benefits</p><p>Medical and dental coverage</p><p>Posted <span>yesterday</span></p></div>
        <p>Be Seen First</p><p>New</p><button>1-Click Apply</button>
        ${shareLinks()}
        <section data-testid="job-description"><h2>Job description</h2><p>${description}</p>${includeCompanyDescription ? "<h3>Company Description</h3><p>Chesapeake Controls builds fictional industrial systems for regional customers.</p>" : ""}</section>
        <section><h2>About Chesapeake Controls</h2><p>Industry</p><p>Company size</p><p>Headquarters</p><a href="/co/chesapeake-controls/jobs">View All Chesapeake Controls Jobs</a><button>Report</button></section>
      </main></div>
    </div>
  `;
}

test("captures only the selected ZipRecruiter detail pane", () => {
  withDom(fixture(), "https://www.ziprecruiter.com/jobs-search?lk=fake-selected-key", (dom) => {
    const result = detectZipRecruiterJobPage();
    assert.equal(result.status, "detected");
    assert.equal(result.role_title, "Supply Chain Data Analyst");
    assert.equal(result.company_name, "Howmet Aerospace");
    assert.equal(result.canonical_job_link, `https://www.ziprecruiter.com/job-redirect/share?match_token=${encodeURIComponent(shareToken)}`);
    assert.doesNotMatch(result.canonical_job_link, /tsid|jobs-search|lk=|facebook|linkedin/iu);
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

test("captures only the bounded standalone ZipRecruiter modal", () => {
  const url = "https://www.ziprecruiter.com/jobseeker/home?jk=standalone-selected-job-key";
  withDom(standaloneFixture(), url, (dom) => {
    const result = detectZipRecruiterJobPage();
    assert.equal(result.status, "detected");
    assert.equal(result.provider, "ziprecruiter");
    assert.equal(result.original_job_link, url);
    assert.equal(result.canonical_job_link, `https://www.ziprecruiter.com/job-redirect/share?match_token=${encodeURIComponent(shareToken)}`);
    assert.equal(result.role_title, "Junior Project Manager");
    assert.equal(result.company_name, "Chesapeake Controls");
    assert.match(result.raw_text, /Chesapeake, VA â€¢ On-site\n\$60K - \$85K\/yr\nFull-time\nPosted yesterday/u);
    assert.match(result.raw_text, /Company Description/u);
    assert.doesNotMatch(result.raw_text, /Background|1-Click Apply|Benefits|Medical and dental|Be Seen First|\bNew\b|Report|About Chesapeake|Industry|Company size|Headquarters|View All|<\/?/iu);
    assert.equal(dom.window.document.querySelectorAll("[data-career-pipeline-ziprecruiter-outline]").length, 1);
  });
});

test("requires a verified share redirect for search captures and verifies portal candidates against lk", () => {
  withDom(fixture().replace(shareLinks(), ""), "https://www.ziprecruiter.com/jobs-search?lk=fake-selected-key", () => {
    assert.equal(detectZipRecruiterJobPage().status, "canonical-link-unavailable");
  });
  const portalToken = Buffer.from("payload fake-selected-key payload", "utf8").toString("base64");
  withDom(`${fixture().replace(shareLinks(), "")}<div id="portal">${shareLinks(portalToken)}</div>`, "https://www.ziprecruiter.com/jobs-search?lk=fake-selected-key", () => {
    assert.equal(detectZipRecruiterJobPage().canonical_job_link, `https://www.ziprecruiter.com/job-redirect/share?match_token=${encodeURIComponent(portalToken)}`);
  });
  withDom(`${fixture().replace(shareLinks(), "")}<div id="portal">${shareLinks(shareToken)}</div>`, "https://www.ziprecruiter.com/jobs-search?lk=fake-selected-key", () => {
    assert.equal(detectZipRecruiterJobPage().status, "canonical-link-unavailable");
  });
});

test("rejects unsafe share wrappers and ambiguous selected tokens", () => {
  const bad = `<a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://evil.test/job-redirect/share?match_token=" + shareToken)}">Bad</a>`;
  withDom(fixture().replace(shareLinks(), bad), "https://www.ziprecruiter.com/jobs-search?lk=fake", () => assert.equal(detectZipRecruiterJobPage().status, "canonical-link-unavailable"));
  const alternate = Buffer.from("alternate selected token", "utf8").toString("base64");
  withDom(fixture().replace(shareLinks(), `${shareLinks()}${shareLinks(alternate)}`), "https://www.ziprecruiter.com/jobs-search?lk=fake", () => assert.equal(detectZipRecruiterJobPage().status, "ambiguous-job"));
});

test("accepts valid Base64 padding and rejects embedded or excessive padding", () => {
  for (const token of [unpaddedShareToken, singlePaddedShareToken, shareToken]) {
    withDom(fixture().replace(shareLinks(), shareLinks(token)), "https://www.ziprecruiter.com/jobs-search?lk=fake", () => {
      const result = detectZipRecruiterJobPage();
      assert.equal(result.status, "detected");
      assert.equal(result.canonical_job_link, `https://www.ziprecruiter.com/job-redirect/share?match_token=${encodeURIComponent(token)}`);
      assert.doesNotMatch(result.canonical_job_link, /tsid/u);
    });
  }
  for (const token of ["D".repeat(40) + "=DEF", "E".repeat(40) + "==="]) {
    withDom(fixture().replace(shareLinks(), shareLinks(token)), "https://www.ziprecruiter.com/jobs-search?lk=fake", () => {
      assert.equal(detectZipRecruiterJobPage().status, "canonical-link-unavailable");
    });
  }
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
  for (const pageUrl of [
    "https://www.ziprecruiter.com/jobseeker/home",
    "https://www.ziprecruiter.com/jobseeker/home?jk=",
    "https://www.ziprecruiter.com/jobseeker/home?jk=one&jk=two",
    "https://www.ziprecruiter.com/jobseeker/home?lk=only-search-key",
    "https://www.ziprecruiter.com/jobs-search?jk=only-home-key",
    "https://www.ziprecruiter.com/jobseeker/home/extra?jk=fake",
    "https://ziprecruiter.com.evil.test/jobseeker/home?jk=fake",
    "https://www.ziprecruiter.com:8443/jobseeker/home?jk=fake",
  ]) assert.equal(detectZipRecruiterJobPage({ pageUrl }).status, "not-ziprecruiter");
  assert.equal(detectZipRecruiterJobPage({ pageUrl: "https://www.ziprecruiter.com/jobseeker/home/?jk=standalone-selected-job-key&source=home", candidates: [] }).status, "no-current-job");
  withDom(standaloneFixture({ hidden: true }), "https://www.ziprecruiter.com/jobseeker/home?jk=fake", () => assert.equal(detectZipRecruiterJobPage().status, "no-current-job"));
  withDom(`${standaloneFixture()}${standaloneFixture()}`, "https://www.ziprecruiter.com/jobseeker/home?jk=fake", () => assert.equal(detectZipRecruiterJobPage().status, "ambiguous-job"));
  withDom(standaloneFixture({ description: "too short", includeCompanyDescription: false }), "https://www.ziprecruiter.com/jobseeker/home?jk=fake", () => assert.equal(detectZipRecruiterJobPage().status, "no-current-job"));
  withDom(standaloneFixture({ description: "x".repeat(100_001) }), "https://www.ziprecruiter.com/jobseeker/home?jk=fake", () => assert.equal(detectZipRecruiterJobPage().status, "capture-too-large"));
  withDom(standaloneFixture({ role: "" }), "https://www.ziprecruiter.com/jobseeker/home?jk=fake", () => assert.equal(detectZipRecruiterJobPage().status, "no-current-job"));
  withDom(standaloneFixture({ employer: false }), "https://www.ziprecruiter.com/jobseeker/home?jk=fake", () => assert.equal(detectZipRecruiterJobPage().status, "no-current-job"));
});

test("remains injectable without module scope and returns clone-safe data", () => {
  const isolatedDetector = Function(`"use strict"; return (${detectZipRecruiterJobPage.toString()});`)();
  const result = isolatedDetector({ pageUrl: "https://www.ziprecruiter.com/jobs-search?lk=fake", candidates: [] });
  assert.equal(result.status, "no-current-job");
  assert.doesNotThrow(() => structuredClone(result));
});
