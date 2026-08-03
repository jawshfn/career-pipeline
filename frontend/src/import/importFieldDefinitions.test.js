import { describe, expect, it } from "vitest";

import {
  IMPORT_FIELD_DEFINITIONS,
  IMPORT_FIELD_BY_KEY,
  IMPORT_TEMPLATE_PRESETS,
  getImportFieldsByKeys,
  normalizeImportHeader,
} from "./importFieldDefinitions.js";

describe("spreadsheet import field contract", () => {
  it("uses unique destination keys and friendly labels", () => {
    expect(new Set(IMPORT_FIELD_DEFINITIONS.map((field) => field.key)).size).toBe(IMPORT_FIELD_DEFINITIONS.length);
    expect(new Set(IMPORT_FIELD_DEFINITIONS.map((field) => field.label)).size).toBe(IMPORT_FIELD_DEFINITIONS.length);
  });

  it("keeps Company and Role required", () => {
    expect(IMPORT_FIELD_BY_KEY.get("company_name").required).toBe(true);
    expect(IMPORT_FIELD_BY_KEY.get("role_title").required).toBe(true);
  });

  it("defines approved Minimal and Common preset orders", () => {
    expect(IMPORT_TEMPLATE_PRESETS.minimal).toEqual(["company_name", "role_title"]);
    expect(IMPORT_TEMPLATE_PRESETS.common).toEqual([
      "company_name", "role_title", "status", "source", "job_link", "location", "date_applied",
      "follow_up_date", "next_action", "resume_version_name", "notes",
    ]);
  });

  it("resolves every preset key to a supported definition", () => {
    Object.values(IMPORT_TEMPLATE_PRESETS).flat().forEach((key) => expect(IMPORT_FIELD_BY_KEY.has(key)).toBe(true));
  });

  it("has normalized aliases without accidental ambiguity", () => {
    const aliases = new Map();
    IMPORT_FIELD_DEFINITIONS.forEach((field) => {
      expect(field.aliases.length).toBeGreaterThan(0);
      field.aliases.forEach((alias) => {
        const normalized = normalizeImportHeader(alias);
        expect(normalized).not.toBe("");
        expect(aliases.get(normalized)).toBeUndefined();
        aliases.set(normalized, field.key);
      });
    });
  });

  it("keeps resume version as an import-stage name and historical stage as an import-only destination", () => {
    expect(IMPORT_FIELD_BY_KEY.get("resume_version_name")).toMatchObject({ valueKind: "name" });
    expect(IMPORT_FIELD_BY_KEY.get("highest_confirmed_stage")).toMatchObject({ label: "Highest Stage Reached" });
  });

  it("rejects empty, unknown, duplicate, and incomplete selections", () => {
    expect(() => getImportFieldsByKeys([])).toThrow();
    expect(() => getImportFieldsByKeys(["company_name", "role_title", "missing"])).toThrow();
    expect(() => getImportFieldsByKeys(["company_name", "role_title", "role_title"])).toThrow();
    expect(() => getImportFieldsByKeys(["company_name"])).toThrow();
  });
});
