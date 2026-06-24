const API_BASE_URL = "http://127.0.0.1:8000";

async function parseResponse(response) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody?.detail || "Application request failed.";
    throw new Error(Array.isArray(message) ? "Application request failed." : message);
  }

  return response.json();
}

export async function getApplications(options = {}) {
  const searchParams = new URLSearchParams();

  if (options.includeArchived) {
    searchParams.set("include_archived", "true");
  }

  const queryString = searchParams.toString();
  const response = await fetch(`${API_BASE_URL}/api/applications${queryString ? `?${queryString}` : ""}`);
  return parseResponse(response);
}

export async function createApplication(applicationData) {
  const response = await fetch(`${API_BASE_URL}/api/applications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(applicationData),
  });

  return parseResponse(response);
}

export async function updateApplication(applicationId, applicationData) {
  const response = await fetch(`${API_BASE_URL}/api/applications/${applicationId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(applicationData),
  });

  return parseResponse(response);
}

export async function getApplicationActionItems() {
  const response = await fetch(`${API_BASE_URL}/api/applications/action-items`);
  return parseResponse(response);
}
