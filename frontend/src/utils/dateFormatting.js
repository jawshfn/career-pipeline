export function parseLocalDateValue(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = String(value).split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function formatDisplayDate(value, fallback = "-") {
  const date = parseLocalDateValue(value);

  if (!date) {
    return fallback;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
