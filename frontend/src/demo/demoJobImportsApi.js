const DEMO_GREENHOUSE_LINK = "https://boards.greenhouse.io/northstaranalytics/jobs/123456";
const DEMO_LEVER_LINK = "https://jobs.lever.co/northstar-platform/11111111-2222-3333-4444-555555555555";

const DEMO_GREENHOUSE_JOB = {
  provider: "greenhouse",
  job_id: 123456,
  title: "Operations Data Analyst",
  company_name: "Northstar Analytics",
  location: "Richmond, VA",
  description_text: [
    "Northstar Analytics is a fictional analytics team used for the PursuitHQ demo.",
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

const DEMO_LEVER_JOB = {
  provider: "lever",
  posting_id: "11111111-2222-3333-4444-555555555555",
  title: "Platform Systems Analyst",
  location: "Richmond, VA",
  all_locations: ["Richmond, VA"],
  commitment: "Full-time",
  team: "Platform Engineering",
  department: "Operations Technology",
  workplace_type: "Hybrid",
  description_text: [
    "Northstar Platform is a fictional employer used for the PursuitHQ demo.",
    "This role supports internal systems, reporting workflows, and cross-functional operations.",
  ].join("\n\n"),
  hosted_url: DEMO_LEVER_LINK,
  apply_url: `${DEMO_LEVER_LINK}/apply`,
  salary_range: { currency: "USD", interval: "year", min: 78000, max: 96000 },
  salary_description: "$78,000 - $96,000 USD annually",
};

export function getDemoGreenhouseLink() {
  return DEMO_GREENHOUSE_LINK;
}

export function getDemoLeverLink() {
  return DEMO_LEVER_LINK;
}

export function importGreenhouseJob({ normalizedJobLink }) {
  if (normalizedJobLink === DEMO_GREENHOUSE_LINK) {
    return Promise.resolve(DEMO_GREENHOUSE_JOB);
  }

  return Promise.reject(
    new Error("Live Greenhouse imports are available in the local full-stack version. Use the demo link or paste the job text."),
  );
}

export function importCustomGreenhouseJob() {
  return Promise.reject(
    new Error(
      "Custom Greenhouse discovery is available in the local full-stack version. Continue with the link or paste the job text.",
    ),
  );
}

export function importLeverJob({ instance, site, postingId }) {
  if (
    instance === "global" &&
    site === "northstar-platform" &&
    postingId === "11111111-2222-3333-4444-555555555555"
  ) {
    return Promise.resolve(DEMO_LEVER_JOB);
  }

  return Promise.reject(
    new Error("Live Lever imports are available in the local full-stack version. Use the demo link or paste the job text."),
  );
}
