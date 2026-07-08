import { describe, expect, it } from "vitest";

import {
  normalizeOptionalDate,
  normalizeOptionalId,
  normalizeOptionalJobLink,
  normalizeOptionalNumber,
  normalizeOptionalText,
  normalizeRequiredText,
} from "./applicationPayloads.js";

describe("application payload normalization", () => {
  it("trims required text", () => {
    expect(normalizeRequiredText("  Example Company  ")).toBe("Example Company");
  });

  it("normalizes optional text to trimmed text or null", () => {
    expect(normalizeOptionalText("  Follow up next week  ")).toBe("Follow up next week");
    expect(normalizeOptionalText("")).toBeNull();
    expect(normalizeOptionalText("   ")).toBeNull();
  });

  it("normalizes optional dates to date strings or null", () => {
    expect(normalizeOptionalDate("2026-07-08")).toBe("2026-07-08");
    expect(normalizeOptionalDate("")).toBeNull();
  });

  it("normalizes optional numbers without dropping zero", () => {
    expect(normalizeOptionalNumber("75000")).toBe(75000);
    expect(normalizeOptionalNumber("0")).toBe(0);
    expect(normalizeOptionalNumber(0)).toBe(0);
    expect(normalizeOptionalNumber("")).toBeNull();
  });

  it("normalizes optional IDs to numbers or null", () => {
    expect(normalizeOptionalId("12")).toBe(12);
    expect(normalizeOptionalId("")).toBeNull();
  });

  it("normalizes optional job links while preserving invalid typed text", () => {
    expect(normalizeOptionalJobLink("")).toBeNull();
    expect(normalizeOptionalJobLink("  randomtest.com  ")).toBe("https://randomtest.com");
    expect(normalizeOptionalJobLink("https://linkedin.com/jobs/view/123")).toBe(
      "https://linkedin.com/jobs/view/123",
    );
    expect(normalizeOptionalJobLink("not a link")).toBe("not a link");
  });
});
