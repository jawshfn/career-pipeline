const API_BASE_URL = "http://127.0.0.1:8000";

async function parseResponse(response) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody?.detail || "Resume version request failed.";
    throw new Error(Array.isArray(message) ? "Resume version request failed." : message);
  }

  return response.json();
}

export async function getResumeVersions({ includeInactive = false } = {}) {
  const searchParams = new URLSearchParams();

  if (includeInactive) {
    searchParams.set("include_inactive", "true");
  }

  const queryString = searchParams.toString();
  const response = await fetch(`${API_BASE_URL}/api/resume-versions${queryString ? `?${queryString}` : ""}`);
  return parseResponse(response);
}

export async function createResumeVersion(payload) {
  const response = await fetch(`${API_BASE_URL}/api/resume-versions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function updateResumeVersion(resumeVersionId, payload) {
  const response = await fetch(`${API_BASE_URL}/api/resume-versions/${resumeVersionId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}
