import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "../frontend/node_modules/jsdom/lib/api.js";

import { detectHandshakeJobPage } from "./handshakeDetector.mjs";

const completeDescription = [
  "SUMMARY",
  "We are looking for graduates with a background in analytics to support reliable operations and reporting for growing international teams.",
  "Responsibilities:",
  "Build clear reports, collaborate with business partners, and document insights that improve operational decisions across the company.",
  "Core Required Skills and Competencies:",
  "Strong communication, careful analysis, and the ability to work independently in a thoughtful and inclusive environment.",
].join("\n\n");

const beaconPreview = "BeaconFire is based in Central NJ and builds practical software for modern teams.\n\nJob Responsibilities";
const beaconExpanded = [
  beaconPreview,
  "Full Stack Development",
  "Build reliable services and interfaces that support high-impact client work.",
  "AI Integration",
  "Develop thoughtful AI-assisted workflows with strong engineering fundamentals.",
  "Requirement",
  "Bachelor's degree in computer science or a closely related field.",
  "Preferred Qualifications",
  "Experience with Java, React, and collaborative product delivery.",
  "Compensation: $65,000.00 to $80,000.00 /year",
  "BeaconFire is an E-verified company and provides equal employment opportunities.",
].join("\n\n");

async function withDom(html, url, callback) {
  const saved = [globalThis.document, globalThis.window, globalThis.Node, globalThis.NodeFilter, globalThis.getComputedStyle];
  const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { url });
  try {
    globalThis.document = dom.window.document;
    globalThis.window = dom.window;
    globalThis.Node = dom.window.Node;
    globalThis.NodeFilter = dom.window.NodeFilter;
    globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
    Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", { configurable: true, get() { return this.textContent; } });
    dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({ width: 500, height: 300 });
    return await callback(dom);
  } finally {
    [globalThis.document, globalThis.window, globalThis.Node, globalThis.NodeFilter, globalThis.getComputedStyle] = saved;
  }
}

function completeFixture({ company = "Ocean Network Express", role = "Analyst" } = {}) {
  return `<main data-hook="job-details-page">
    <header><img alt="${company} logo"><p>${company}</p><p>Transportation & Logistics</p><h1>${role}</h1><button>Quick apply</button><button>Save</button><button>Share</button><button>Withdraw application</button><button>More</button></header>
    <section><h2>At a glance</h2><p>Compensation</p><p>$50-60/hr</p><p>Location</p><p>Onsite, based in Richmond, VA</p><button>+6</button><p>Employment type</p><p>Full-time</p><button>More</button></section>
    <section><h2>Job description</h2><div>${completeDescription.split("\n\n").map((line) => `<p>${line}</p>`).join("")}</div></section>
    <section><h2>What your school says</h2><button>More</button><p>View all collections</p></section>
  </main>`;
}

function beaconFixture({ expansionButton = '<button type="button" aria-label="Show more (What does a Java Software Engineer do at BeaconFire?)">More</button>' } = {}) {
  return `<main data-hook="job-details-page">
    <header><img alt="BeaconFire logo"><p>BeaconFire</p><p>Information Technology</p><h1>Java Software Engineer</h1><button>Quick apply</button><button>Save</button><button>Share</button><button>Withdraw application</button><button>More</button></header>
    <section><h2>At a glance</h2><p>Compensation</p><p>$65-80K/yr</p><p>Location</p><p>Remote or onsite, based in New York City, NY, San Francisco, CA, +6</p><button>+6</button><p>Employment type</p><p>Full-time</p><button>More</button></section>
    <section data-description-region><h2>Job description</h2><div data-description-body>${beaconPreview.split("\n\n").map((line) => `<p>${line}</p>`).join("")}${expansionButton}</div></section>
    <section><h2>What your school says</h2><button>More</button><p>View all collections</p></section>
  </main>`;
}

function sidePanelFixture({ jobId = "11204180", href = `https://app.joinhandshake.com/jobs/${jobId}?source=search`, collapsed = false } = {}) {
  const body = collapsed ? beaconPreview : completeDescription;
  const button = collapsed ? '<button type="button" aria-label="Show more (What does a QA Engineer do at Perrone)">More</button>' : "";
  return `<aside><h1>Decoy left-list job</h1><p>Wrong Company</p><button>Quick apply</button><button>Save</button><button>Share</button><button>Withdraw application</button><button>More</button><button>+6</button></aside>
  <main data-hook="right-content"><header><img alt="Perrone Robotics logo"><p>Perrone Robotics</p><p>Internet & Software</p><a href="${href}"><h1>QA Engineer</h1></a></header>
    <section><h2>At a glance</h2><p>$65-80K/yr</p><p>Onsite, based in Charlottesville, VA</p><p>Full-time</p></section>
    <section data-description-region><h2>Job description</h2><div data-description-body>${body.split("\n\n").map((line) => `<p>${line}</p>`).join("")}${button}</div></section>
    <section><h2>What your school says</h2><p>Decoy school content</p></section></main>`;
}

test("captures an already-complete standalone Handshake description without clicking controls", async () => {
  await withDom(completeFixture(), "https://app.joinhandshake.com/jobs/11206968?searchId=example", async () => {
    const clicks = new Map();
    document.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => clicks.set(button.textContent, (clicks.get(button.textContent) || 0) + 1)));
    const result = await detectHandshakeJobPage();
    assert.equal(result.status, "detected");
    assert.equal(result.provider, "handshake");
    assert.equal(result.role_title, "Analyst");
    assert.equal(result.company_name, "Ocean Network Express");
    assert.match(result.raw_text, /Core Required Skills and Competencies:/u);
    assert.doesNotMatch(result.raw_text, /Transportation|More|Less|school says|collections|Quick apply|Save|Share|Withdraw|\+6/u);
    assert.equal([...clicks.values()].reduce((sum, count) => sum + count, 0), 0);
  });
});

test("expands only the scoped BeaconFire description and captures newly mounted content", async () => {
  await withDom(beaconFixture(), "https://app.joinhandshake.com/jobs/9988/", async (dom) => {
    const clicks = new Map();
    document.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => clicks.set(button, (clicks.get(button) || 0) + 1)));
    const expansionButton = document.querySelector("[data-description-region] button");
    expansionButton.addEventListener("click", () => {
      dom.window.setTimeout(() => {
        document.querySelector("[data-description-body]").innerHTML = `${beaconExpanded.split("\n\n").map((line) => `<p>${line}</p>`).join("")}<button type="button" aria-label="Show less (What does a Java Software Engineer do at BeaconFire?)">Less</button>`;
      }, 10);
    });
    const result = await detectHandshakeJobPage();
    assert.equal(result.status, "detected");
    for (const expected of ["Full Stack Development", "AI Integration", "Requirement", "Preferred Qualifications", "Compensation: $65,000.00 to $80,000.00 /year", "BeaconFire is an E-verified company", "equal employment opportunities"]) assert.match(result.raw_text, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
    assert.equal(result.raw_text.match(/BeaconFire is based in Central NJ/gu)?.length, 1);
    assert.doesNotMatch(result.raw_text, /More|Less/u);
    assert.equal(result.description_character_count, result.raw_text.split("Job description\n")[1].length);
    assert.ok(result.description_character_count > beaconPreview.length);
    assert.equal(clicks.get(expansionButton), 1);
    assert.equal([...clicks.entries()].filter(([button]) => button !== expansionButton).reduce((sum, [, count]) => sum + count, 0), 0);
    assert.doesNotThrow(() => structuredClone(result));
  });
});

test("rejects ambiguous, invalid, and unresponsive description expansion controls without returning a preview", async () => {
  await withDom(beaconFixture({ expansionButton: '<button aria-label="Show more one">More</button><button aria-label="Show more two">More</button>' }), "https://app.joinhandshake.com/jobs/1", async () => {
    const buttons = [...document.querySelectorAll("[data-description-region] button")];
    const clicks = [0, 0];
    buttons.forEach((button, index) => button.addEventListener("click", () => { clicks[index] += 1; }));
    const result = await detectHandshakeJobPage({ expandTimeoutMs: 50 });
    assert.equal(result.status, "description-expand-failed");
    assert.deepEqual(clicks, [0, 0]);
  });
  await withDom(beaconFixture(), "https://app.joinhandshake.com/jobs/1", async () => {
    const expansionButton = document.querySelector("[data-description-region] button");
    let clicks = 0;
    expansionButton.addEventListener("click", () => { clicks += 1; });
    const result = await detectHandshakeJobPage({ expandTimeoutMs: 50 });
    assert.equal(result.status, "description-expand-failed");
    assert.equal(clicks, 1);
  });
  await withDom(completeFixture().replace("</div></section>\n    <section><h2>What your school says", '<button aria-label="Learn more">More</button></div></section>\n    <section><h2>What your school says'), "https://app.joinhandshake.com/jobs/1", async () => {
    const invalidButton = document.querySelector('[aria-label="Learn more"]');
    let clicks = 0;
    invalidButton.addEventListener("click", () => { clicks += 1; });
    const result = await detectHandshakeJobPage();
    assert.equal(result.status, "detected");
    assert.equal(clicks, 0);
  });
});

test("rejects unsupported URLs and conservative root or content failures", async () => {
  for (const url of [
    "https://app.joinhandshake.com/jobs", "https://app.joinhandshake.com/jobs/0", "https://app.joinhandshake.com/jobs/00",
    "https://app.joinhandshake.com/jobs/example", "https://app.joinhandshake.com/jobs/112/extra", "https://app.joinhandshake.com/emp/jobs/112",
    "https://joinhandshake.com/jobs/112", "https://app.joinhandshake.com.evil.test/jobs/112", "https://user:pass@app.joinhandshake.com/jobs/112", "https://app.joinhandshake.com:8443/jobs/112",
  ]) assert.equal((await detectHandshakeJobPage({ pageUrl: url })).status, "not-handshake");
  await withDom("<main data-hook=\"job-details-page\"></main>", "https://app.joinhandshake.com/jobs/1", async () => assert.equal((await detectHandshakeJobPage()).status, "no-current-job"));
  await withDom(`${completeFixture()}${completeFixture()}`, "https://app.joinhandshake.com/jobs/1", async () => assert.equal((await detectHandshakeJobPage()).status, "ambiguous-job"));
  await withDom(completeFixture().replace("<h1>Analyst</h1>", ""), "https://app.joinhandshake.com/jobs/1", async () => assert.equal((await detectHandshakeJobPage()).status, "no-current-job"));
  await withDom(completeFixture({ company: "" }), "https://app.joinhandshake.com/jobs/1", async () => assert.equal((await detectHandshakeJobPage()).status, "no-current-job"));
  await withDom(completeFixture(), "https://app.joinhandshake.com/jobs/1", async () => {
    document.querySelectorAll("section")[1].querySelector("div").textContent = "Short description.";
    assert.equal((await detectHandshakeJobPage()).status, "no-current-job");
  });
});

test("is injectable without module scope and returns clone-safe data", async () => {
  const isolated = Function(`"use strict"; return (${detectHandshakeJobPage.toString()});`)();
  const result = await isolated({ pageUrl: "https://app.joinhandshake.com/jobs/1" });
  assert.equal(result.status, "no-current-job");
  assert.doesNotThrow(() => structuredClone(result));
});

test("captures only the selected Handshake search side panel and preserves its canonical title link", async () => {
  await withDom(sidePanelFixture(), "https://app.joinhandshake.com/job-search/11204180?searchId=fixture", async () => {
    const clicks = new Map();
    document.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => clicks.set(button.textContent, (clicks.get(button.textContent) || 0) + 1)));
    const result = await detectHandshakeJobPage();
    assert.equal(result.status, "detected");
    assert.equal(result.company_name, "Perrone Robotics");
    assert.equal(result.role_title, "QA Engineer");
    assert.equal(result.canonical_job_link, "https://app.joinhandshake.com/jobs/11204180?source=search");
    assert.doesNotMatch(result.raw_text, /Decoy|Wrong Company|Internet & Software|school content/u);
    assert.equal([...clicks.values()].reduce((sum, count) => sum + count, 0), 0);
    assert.doesNotThrow(() => structuredClone(result));
  });
});

test("rejects stale, untrusted, ambiguous, and changing Handshake side panels", async () => {
  for (const href of ["https://app.joinhandshake.com/jobs/99", "https://evil.test/jobs/11204180", "https://user:pass@app.joinhandshake.com/jobs/11204180"]) {
    await withDom(sidePanelFixture({ href }), "https://app.joinhandshake.com/job-search/11204180", async () => assert.notEqual((await detectHandshakeJobPage()).status, "detected"));
  }
  await withDom(`${sidePanelFixture()}${sidePanelFixture()}`, "https://app.joinhandshake.com/job-search/11204180", async () => assert.equal((await detectHandshakeJobPage()).status, "ambiguous-job"));
  await withDom(sidePanelFixture().replace('<a href="https://app.joinhandshake.com/jobs/11204180?source=search"><h1>QA Engineer</h1></a>', '<h1><a href="https://app.joinhandshake.com/jobs/11204180">QA Engineer</a><a href="https://app.joinhandshake.com/jobs/11204180?alternate=1">QA Engineer</a></h1>'), "https://app.joinhandshake.com/job-search/11204180", async () => assert.equal((await detectHandshakeJobPage()).status, "ambiguous-job"));
  await withDom(sidePanelFixture().replace("</header>", "<h1>Second visible title</h1></header>"), "https://app.joinhandshake.com/job-search/11204180", async () => assert.equal((await detectHandshakeJobPage()).status, "ambiguous-job"));
  await withDom(sidePanelFixture({ collapsed: true }), "https://app.joinhandshake.com/job-search/11204180", async (dom) => {
    const expansion = document.querySelector("[data-description-region] button"); let clicks = 0;
    expansion.addEventListener("click", () => { clicks += 1; dom.window.setTimeout(() => dom.reconfigure({ url: "https://app.joinhandshake.com/job-search/9" }), 10); });
    const result = await detectHandshakeJobPage();
    assert.equal(result.status, "description-expand-failed"); assert.equal(clicks, 1);
  });
});

test("expands only the scoped selected side-panel description", async () => {
  await withDom(sidePanelFixture({ collapsed: true }), "https://app.joinhandshake.com/job-search/11204180", async (dom) => {
    const expansion = document.querySelector("[data-description-region] button"); let scopedClicks = 0; let otherClicks = 0;
    document.querySelectorAll("button").forEach((button) => button.addEventListener("click", () => { if (button === expansion) scopedClicks += 1; else otherClicks += 1; }));
    expansion.addEventListener("click", () => dom.window.setTimeout(() => { document.querySelector("[data-description-body]").innerHTML = `${beaconExpanded.split("\n\n").map((line) => `<p>${line}</p>`).join("")}<button aria-label="Show less">Less</button>`; }, 10));
    const result = await detectHandshakeJobPage();
    assert.equal(result.status, "detected"); assert.match(result.raw_text, /Full Stack Development|Preferred Qualifications|equal employment opportunities/u);
    assert.doesNotMatch(result.raw_text, /More|Less/u); assert.equal(scopedClicks, 1); assert.equal(otherClicks, 0);
  });
});
