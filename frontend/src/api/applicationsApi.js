const API_BASE_URL = "http://127.0.0.1:8000";

async function parseResponse(response) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody?.detail || "Application request failed.";
    throw new Error(Array.isArray(message) ? "Application request failed." : message);
  }

  return response.json();
}

export async function getApplications() {
  const response = await fetch(`${API_BASE_URL}/api/applications`);
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
