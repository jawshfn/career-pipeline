import assert from "node:assert/strict";
import test from "node:test";

import { buildIndeedCaptureText, detectIndeedJobPage } from "./indeedDetector.mjs";

const description = "Build reliable reporting tools for fictional teams. ".repeat(4);

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

test("formats supported Indeed remote header regions without changing the job content", () => {
  const cases = [
    ["Massachusettsâ€¢Remote", "Remote in Massachusetts"],
    ["Illinois Â· Remote", "Remote in Illinois"],
    ["Massachusetts - Remote", "Remote in Massachusetts"],
    ["Remote - Illinois", "Remote in Illinois"],
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
    assert.equal(lines[2], expectedLocation || "Job details");
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
