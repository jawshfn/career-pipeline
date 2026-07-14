const DEMO_GREENHOUSE_LINK = "https://boards.greenhouse.io/northstaranalytics/jobs/123456";

const DEMO_GREENHOUSE_JOB = {
  provider: "greenhouse",
  job_id: 123456,
  title: "Operations Data Analyst",
  company_name: "Northstar Analytics",
  location: "Richmond, VA",
  description_text: [
    "Northstar Analytics is a fictional analytics team used for the Career Pipeline demo.",
    "",
    "This role supports operations reporting, data quality checks, and dashboard maintenance for regional teams.",
  ].join("\n"),
  absolute_url: DEMO_GREENHOUSE_LINK,
  pay_ranges: [
    {
      title: "",
      currency_type: "USD",
      min_cents: 7200000,
      max_cents: 8800000,
    },
  ],
};

export function getDemoGreenhouseLink() {
  return DEMO_GREENHOUSE_LINK;
}

export function importGreenhouseJob({ normalizedJobLink }) {
  if (normalizedJobLink === DEMO_GREENHOUSE_LINK) {
    return Promise.resolve(DEMO_GREENHOUSE_JOB);
  }

  return Promise.reject(
    new Error("Live Greenhouse imports are available in the local full-stack version. Use the demo link or paste the job text."),
  );
}
