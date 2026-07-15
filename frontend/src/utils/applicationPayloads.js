import { normalizeExplicitJobLink } from "./jobLinks.js";

export function normalizeRequiredText(value) {
  return String(value || "").trim();
}

export function normalizeOptionalText(value) {
  const trimmedValue = String(value || "").trim();

  return trimmedValue || null;
}

export function normalizeOptionalDate(value) {
  return String(value || "").trim() || null;
}

export function normalizeOptionalId(value) {
  const trimmedValue = String(value ?? "").trim();

  return trimmedValue === "" ? null : Number(trimmedValue);
}

export function normalizeOptionalJobLink(value) {
  return normalizeExplicitJobLink(value) || null;
}
