import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "../frontend/node_modules/jsdom/lib/api.js";

import { buildIndeedCaptureText, detectIndeedJobPage } from "./indeedDetector.mjs";

const description = "Build reliable reporting tools for fictional teams. ".repeat(4);

function detectDom(html, url) {
  const dom = new JSDOM(html, { url });
  const previous = Object.fromEntries(["window", "document", "Node", "getComputedStyle", "setTimeout"].map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    Node: dom.window.Node,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    setTimeout: () => 0,
  });
  try {
    const result = detectIndeedJobPage();
    return { result, outlined: dom.window.document.querySelectorAll('[data-career-pipeline-indeed-outline]').length };
  } finally { Object.assign(globalThis, previous); dom.window.close(); }
}

function snapshot(overrides = {}) {
  return {
    pageUrl: "https://www.indeed.com/viewjob?jk=fictional123",
    descriptions: [
      {
        title: "Platform Systems Analyst",
        company: "Fictional Systems",
        location: "Richmond, VA",
        metadata: "$25 - $30 an hour\nFull-time\nFull-time",
        description,
      },
    ],
    ...overrides,
  };
}

test("detects a specific fictional Indeed job and builds parser-friendly text", () => {
  const result = detectIndeedJobPage(snapshot());

  assert.equal(result.status, "detected");
  assert.equal(result.provider, "indeed");
  assert.equal(result.source, "Indeed");
  assert.equal(result.role_title, "Platform Systems Analyst");
  assert.equal(result.company_name, "Fictional Systems");
  assert.match(result.raw_text, /^Platform Systems Analyst - job post\nFictional Systems\nRichmond, VA\nJob details/m);
  assert.match(result.raw_text, /\$25 - \$30 an hour\nFull-time\nFull job description/);
  assert.equal((result.raw_text.match(/Full-time/g) || []).length, 1);
  assert.match(result.raw_text, /Build reliable reporting tools/);
  assert.doesNotThrow(() => structuredClone(result));
});

test("normalizes responsive side-panel headers onto one line before adding the job-post suffix", () => {
  const titleValues = [
    "  Fictional Systems Technician - West Point Branch\n",
    "Fictional   Systems Technician - West Point Branch",
    "Fictional Systems Technician - West Point Branch\n- job post",
    "Fictional Systems Technician - West Point Branch - job post",
  ];

  for (const title of titleValues) {
    const result = detectIndeedJobPage(snapshot({
      descriptions: [{
        title,
        company: "  Northstar\nCommunity Credit Union  ",
        location: " West Point,\nVA 23181 ",
        metadata: "$20 - $25 an hour\n  Full-time  ",
        description: "First paragraph stays readable.\n\nSecond paragraph remains separate. ".repeat(3),
      }],
    }));
    const lines = result.raw_text.split("\n");
    assert.equal(lines[0], "Fictional Systems Technician - West Point Branch - job post");
    assert.equal(lines[1], "Northstar Community Credit Union");
    assert.equal(lines[2], "West Point, VA 23181");
    assert.equal(lines.includes("job post"), false);
    assert.equal(lines.includes("- job post"), false);
    assert.equal(lines.includes("$20 - $25 an hour"), true);
    assert.equal(lines.includes("Full-time"), true);
    assert.match(result.raw_text, /First paragraph stays readable\.\n\nSecond paragraph remains separate\./);
    assert.doesNotThrow(() => structuredClone(result));
  }
});

test("keeps a single-line Indeed header location even when the description mentions remote access", () => {
  const result = detectIndeedJobPage(snapshot({
    descriptions: [{
      title: "Fictional Technician",
      company: "Northstar Systems",
      location: "West Point, VA 23181",
      metadata: "Full-time",
      description: "This fictional role provides remote access support for local users. ".repeat(3),
    }],
  }));
  assert.match(result.raw_text, /Northstar Systems\nWest Point, VA 23181\nJob details/);
});

test("normalizes Indeed location separators without rewriting displayed order", () => {
  const cases = [
    ["Massachusettsâ€¢Remote", "Remote in Massachusetts"],
    ["Illinois Â· Remote", "Remote in Illinois"],
    ["Massachusetts - Remote", "Massachusetts - Remote"],
    ["Remote - Illinois", "Remote - Illinois"],
    ["Remote in Massachusetts", "Remote in Massachusetts"],
    ["Cleveland, OH 44101â€¢Remote", "Remote in Cleveland, OH 44101"],
    ["Remote", "Remote"],
    ["West Point, VA 23181", "West Point, VA 23181"],
    ["Information desk - Remote", "Information desk - Remote"],
    ["", ""],
  ];

  for (const [location, expectedLocation] of cases) {
    const originalDescription = "First paragraph is unchanged.\n\nSecond paragraph is unchanged. ".repeat(2);
    const result = detectIndeedJobPage(snapshot({
      descriptions: [{
        title: "Fictional Field Coordinator",
        company: "Northstar Services",
        location,
        metadata: "Full-time",
        description: originalDescription,
      }],
    }));

    const lines = result.raw_text.split("\n");
    assert.equal(lines[0], "Fictional Field Coordinator - job post");
    assert.equal(lines[1], "Northstar Services");
    const displayedExpected = /^remote\s+in\s+/iu.test(location)
      ? expectedLocation
      : expectedLocation.replace(/^Remote in (.+)$/u, "$1 - Remote");
    assert.equal(lines[2], displayedExpected || "Job details");
    assert.doesNotMatch(result.raw_text, /(?:â€¢|Â·)/u);
    assert.match(result.raw_text, /First paragraph is unchanged\.\n\nSecond paragraph is unchanged\./);
    assert.doesNotThrow(() => structuredClone(result));
  }
});

test("runs after source reconstruction without a module closure and returns plain data", () => {
  const isolatedDetector = Function(`"use strict"; return (${detectIndeedJobPage.toString()});`)();
  const result = isolatedDetector(snapshot());
  assert.equal(result.status, "detected");
  assert.equal(result.role_title, "Platform Systems Analyst");
  assert.doesNotThrow(() => structuredClone(result));
  assert.equal(isolatedDetector({ pageUrl: "https://fictional.test", descriptions: [] }).status, "not-indeed");
});

test("accepts Indeed hostname variants and rejects lookalikes or credentials", () => {
  for (const pageUrl of [
    "https://indeed.com/viewjob?jk=fake",
    "https://jobs.indeed.com/viewjob?jk=fake",
  ]) {
    assert.equal(detectIndeedJobPage(snapshot({ pageUrl })).status, "detected");
  }
  assert.equal(detectIndeedJobPage(snapshot({ pageUrl: "https://indeed.com.evil.test/viewjob" })).status, "not-indeed");
  assert.equal(detectIndeedJobPage(snapshot({ pageUrl: "https://user:pass@www.indeed.com/viewjob" })).status, "not-indeed");
});

test("requires one title-backed, substantial description and keeps optional fields optional", () => {
  assert.equal(detectIndeedJobPage(snapshot({ descriptions: [] })).status, "no-current-job");
  assert.equal(detectIndeedJobPage(snapshot({ descriptions: [{ title: "Role", description: "short" }] })).status, "no-current-job");
  assert.equal(detectIndeedJobPage(snapshot({ descriptions: [{ title: "", description }] })).status, "no-current-job");
  assert.equal(detectIndeedJobPage(snapshot({ descriptions: [snapshot().descriptions[0], snapshot().descriptions[0]] })).status, "ambiguous-job");
  const optional = detectIndeedJobPage(snapshot({ descriptions: [{ title: "Role", description }] }));
  assert.equal(optional.status, "detected");
  assert.doesNotMatch(optional.raw_text, /Fictional Systems|Richmond/);
});

test("bounds descriptions and final text without reading whole-page content", () => {
  assert.equal(detectIndeedJobPage(snapshot({ descriptions: [{ title: "Role", description: "x".repeat(80_001) }] })).status, "capture-too-large");
  assert.equal(buildIndeedCaptureText({ title: "Role", description: "Description" }), "Role - job post\nJob details\nFull job description\nDescription");
});

test("captures one selected Indeed sidebar job through visible semantic DOM evidence", () => {
  const selectedDescription = "Design dependable fictional fulfillment workflows, collaborate with partners, and document measurable improvements for every release. ".repeat(2);
  const { result } = detectDom(`
    <main><aside><h2>Background Card Role</h2><a>Background Company</a><h2>Another Background Role</h2></aside>
    <section role="region" aria-label="Selected job details"><h3>Fictional Operations Specialist</h3><a data-company-name="true">Northstar Logistics</a><div data-testid="jobsearch-JobInfoHeader-companyLocation">Remote - Virginia</div><div id="salaryInfoAndJobType">$72,000 - $84,000 a year\nFull-time</div><h4>Job details</h4><p>Schedule: Monday to Friday</p><h4>Match overview</h4><p>Qualification match controls</p><h3>Full job description</h3><div>${selectedDescription}</div><h3>Company and salary information</h3><p>Do not include this</p></section>
    <section hidden><h2>Fictional Operations Specialist</h2><h3>Full job description</h3><p>${selectedDescription}</p></section></main>`,
  "https://www.indeed.com/?vjk=selected-fictional-job-key");
  assert.equal(result.status, "detected");
  assert.equal(result.provider, "indeed");
  assert.equal(result.role_title, "Fictional Operations Specialist");
  assert.equal(result.company_name, "Northstar Logistics");
  assert.equal(result.original_job_link, "https://www.indeed.com/?vjk=selected-fictional-job-key");
  assert.equal(result.description_character_count, selectedDescription.trim().length);
  assert.match(result.raw_text, /Remote - Virginia\nJob details\n\$72,000 - \$84,000 a year\nFull-time/);
  assert.match(result.raw_text, /Full job description\nDesign dependable fictional fulfillment workflows/);
  assert.doesNotMatch(result.raw_text, /Background Card|Background Company|Match overview|Qualification match|Company and salary|Do not include/u);
});

test("captures one standalone Indeed job through a lower-level semantic heading", () => {
  const selectedDescription = "Lead fictional data quality reviews, translate findings into practical process changes, and communicate clear outcomes to cross-functional teams. ".repeat(2);
  const { result } = detectDom(`
    <main><section role="region"><h5>Fictional Data Quality Lead</h5><a data-company-name="true">Cedar Peak Analytics</a><div data-testid="jobsearch-JobInfoHeader-companyLocation">Albany, NY</div><div id="salaryInfoAndJobType">$90,000 a year\nFull-time</div><button>Apply now</button><button>Save</button><h4>Job details</h4><p>Employment type: Full-time</p><h4>Benefits</h4><p>Benefits summary must not be captured</p><h3>Full job description</h3><div>${selectedDescription}</div><h3>Similar jobs</h3><p>Similar fictional role</p><h3>Report job</h3><footer>Footer navigation</footer></section></main>`,
  "https://www.indeed.com/viewjob?jk=standalone-fictional-job-key");
  assert.equal(result.status, "detected");
  assert.equal(result.role_title, "Fictional Data Quality Lead");
  assert.equal(result.company_name, "Cedar Peak Analytics");
  assert.equal(result.description_character_count, selectedDescription.trim().length);
  assert.match(result.raw_text, /^Fictional Data Quality Lead - job post\nCedar Peak Analytics\nAlbany, NY/m);
  assert.doesNotMatch(result.raw_text, /Apply now|Benefits summary|Similar fictional|Report job|Footer navigation|<div>/u);
});

function currentIndeedComponent(selectedDescription) {
  return `<section id="selected-job-panel"><div data-testid="desktop-job-header"><h5 role="heading" aria-level="5" data-testid="vj-job-title">Fictional Systems Engineer</h5><a href="https://www.indeed.com/cmp/Fictional-Systems" aria-label="Fictional Systems (opens in a new tab)">Fictional Systems</a><div>Richmond, VA 23220</div><div aria-label="$70,000 - $75,000 a year"><div aria-hidden="true">$70,000 - $75,000 a year</div></div></div><div aria-hidden="true"><div data-testid="desktop-embedded-compact-header"><h4 data-testid="vj-job-title-compact">Fictional Systems Engineer</h4></div></div><section><h4 role="heading">Job details</h4><div>$70,000 - $75,000 a year</div><div>Benefits summary must not become core metadata</div><div>Monday to Friday</div></section><section><h4 data-testid="vj-match-overview-heading">Match overview</h4><p>Profile link and qualifications: 2 of 15</p><button>Confirm qualification</button><button>Reject qualification</button></section><section><h4 role="heading" aria-level="4" data-testid="vj-job-description-heading">Full job description</h4><div class="react-native-html-content simple-job-description-html">${selectedDescription}<button>Apply on company site</button></div></section></section>`;
}

test("captures the current Indeed vj component in selected-panel and standalone layouts", () => {
  const selectedDescription = "Build fictional systems with reliable engineering practices, communicate tradeoffs clearly, and improve service outcomes for customers. ".repeat(2);
  for (const [url, wrapper] of [
    ["https://www.indeed.com/?vjk=selected-fictional-key", (component) => `<aside><article><h2>Background Operations Role</h2><a href="/cmp/background-company">Background Company</a></article></aside>${component}`],
    ["https://www.indeed.com/viewjob?jk=standalone-fictional-key", (component) => `<nav>Search jobs</nav><main>${component}</main><button>Save job</button><button>Share job</button><section>Company information</section><section>Similar jobs</section><footer>Footer content</footer>`],
  ]) {
    const { result, outlined } = detectDom(`<body>${wrapper(currentIndeedComponent(selectedDescription))}</body>`, url);
    assert.equal(result.status, "detected");
    assert.equal(result.provider, "indeed");
    assert.equal(result.source, "Indeed");
    assert.equal(result.role_title, "Fictional Systems Engineer");
    assert.equal(result.company_name, "Fictional Systems");
    assert.equal(result.original_job_link, url);
    assert.equal(result.description_character_count, selectedDescription.trim().length);
    assert.match(result.raw_text, /Richmond, VA 23220\nJob details\n\$70,000 - \$75,000 a year/);
    assert.doesNotMatch(result.raw_text, /Background|compact|Benefits summary|Match overview|Profile link|Qualifications|qualification|Apply on company|Save job|Share job|Company information|Similar jobs|Footer|<div>/iu);
    assert.equal(outlined, 1);
    assert.doesNotThrow(() => structuredClone(result));
  }
});

test("collects bounded current-header location leaves in display order", () => {
  const selectedDescription = "Build and support fictional systems with clear documentation and measurable outcomes for the team. ".repeat(2);
  const cases = [
    ["Remote Electrical Engineer", "<div>Remote</div>", "Remote"],
    ["Fictional Engineer", "<div>Kentucky</div><span>â€¢</span><div>Remote</div>", "Kentucky - Remote"],
    ["Fictional Engineer", "<div>Pittsburgh, PA</div><span>â€¢</span><div>Remote</div>", "Pittsburgh, PA - Remote"],
    ["Fictional Engineer", "<div>Norfolk, VA 23510</div><span>â€¢</span><div>Hybrid work</div>", "Norfolk, VA 23510 - Hybrid work"],
    ["Fictional Engineer", "<div>440 Monticello Avenue, Norfolk, VA 23510</div>", "440 Monticello Avenue, Norfolk, VA 23510"],
  ];
  for (const [title, locationLeaves, expected] of cases) {
    const { result } = detectDom(`<section><div data-testid="desktop-job-header"><h5 data-testid="vj-job-title">${title}</h5><a href="/cmp/fictional">Fictional Fabrication</a><div>3.3</div>${locationLeaves}<button>Apply now</button><div>Full-time</div><div aria-label="$80,000 a year">$80,000 a year</div></div><h4 data-testid="vj-job-description-heading">Full job description</h4><div>${selectedDescription}</div></section>`, "https://www.indeed.com/?vjk=leaf-fixture");
    assert.equal(result.status, "detected");
    assert.match(result.raw_text, new RegExp(`Fictional Fabrication\\n${expected.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\nJob details`));
    assert.doesNotMatch(result.raw_text, /3\.3|Apply now|Full-time/u);
  }
});

test("fails safely for incomplete, hidden, ambiguous, or oversized current Indeed components", () => {
  const substantial = "A fictional description with enough specific responsibilities to clear the minimum capture requirement safely. ".repeat(2);
  const url = "https://www.indeed.com/?vjk=selected-fictional-key";
  for (const html of [
    currentIndeedComponent(substantial).replace('data-testid="vj-job-title"', 'data-testid="missing-title"'),
    currentIndeedComponent(substantial).replace('data-testid="vj-job-title"', 'aria-hidden="true" data-testid="vj-job-title"'),
    currentIndeedComponent(substantial).replace('data-testid="vj-job-description-heading"', 'data-testid="missing-description"'),
    currentIndeedComponent(substantial).replace(/<div class="react-native-html-content simple-job-description-html">[\s\S]*?<\/div><\/section>/u, "</section>"),
    currentIndeedComponent("short"),
  ]) assert.equal(detectDom(html, url).result.status, "no-current-job");
  assert.equal(detectDom(`${currentIndeedComponent(substantial)}${currentIndeedComponent(substantial)}`, url).result.status, "ambiguous-job");
  assert.equal(detectDom(currentIndeedComponent("x".repeat(80_001)), url).result.status, "capture-too-large");
});
