import { isArchivedApplication } from "./applicationReviewRows.js";

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

function isValidDateKey(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = dateFromKey(value);
  return localDateKey(date) === value;
}

export function buildApplicationActivitySummary(applications = [], referenceDate = new Date()) {
  const reference = referenceDate instanceof Date && !Number.isNaN(referenceDate.getTime()) ? referenceDate : new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate() - 6 + index, 12);
    return { count: 0, date, dateKey: localDateKey(date), isToday: index === 6 };
  });
  const daysByKey = new Map(days.map((day) => [day.dateKey, day]));

  applications.forEach((application) => {
    const dateKey = typeof application?.date_applied === "string" ? application.date_applied.trim() : "";
    if (!application || isArchivedApplication(application) || !isValidDateKey(dateKey)) return;
    const day = daysByKey.get(dateKey);
    if (day) day.count += 1;
  });

  return {
    days,
    lastSevenDaysCount: days.reduce((total, day) => total + day.count, 0),
    todayCount: days[6].count,
    todayKey: days[6].dateKey,
  };
}
