const API_BASE_URL = "http://127.0.0.1:8000";

async function parseResponse(response) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody?.detail || "Application activity request failed.";
    throw new Error(Array.isArray(message) ? "Application activity request failed." : message);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export async function getApplicationActivities(applicationId) {
  const response = await fetch(`${API_BASE_URL}/api/applications/${applicationId}/activities`);
  return parseResponse(response);
}

export async function createApplicationActivity(applicationId, payload) {
  const response = await fetch(`${API_BASE_URL}/api/applications/${applicationId}/activities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function updateApplicationActivity(applicationId, activityId, payload) {
  const response = await fetch(`${API_BASE_URL}/api/applications/${applicationId}/activities/${activityId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return parseResponse(response);
}

export async function deleteApplicationActivity(applicationId, activityId) {
  const response = await fetch(`${API_BASE_URL}/api/applications/${applicationId}/activities/${activityId}`, {
    method: "DELETE",
  });

  return parseResponse(response);
}
