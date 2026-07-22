import { useEffect, useState } from "react";

export function getLocalGreeting(date) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) {
    return "Good morning";
  }

  if (hour >= 12 && hour < 17) {
    return "Good afternoon";
  }

  if (hour >= 17 && hour < 22) {
    return "Good evening";
  }

  return "Welcome back";
}

export function formatLocalClock(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatFullLocalDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatLocalDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function DailyRemindersHeader() {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  useEffect(() => {
    let intervalId;
    const updateCurrentDate = () => setCurrentDate(new Date());
    const millisecondsUntilNextMinute = 60000 - (Date.now() % 60000);
    const timeoutId = window.setTimeout(() => {
      updateCurrentDate();
      intervalId = window.setInterval(updateCurrentDate, 60000);
    }, millisecondsUntilNextMinute);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <header className="command-center-daily-header">
      <div className="command-center-greeting">
        <p className="eyebrow">Reminders</p>
        <h2>{getLocalGreeting(currentDate)}</h2>
        <p>Here’s what needs your attention today.</p>
      </div>
      <div className="command-center-time-panel" aria-label="Current local date and time">
        <p className="command-center-local-time-label">Local time</p>
        <time className="command-center-current-time" dateTime={currentDate.toISOString()}>
          {formatLocalClock(currentDate)}
        </time>
        <time className="command-center-current-date" dateTime={formatLocalDateValue(currentDate)}>
          {formatFullLocalDate(currentDate)}
        </time>
      </div>
    </header>
  );
}
