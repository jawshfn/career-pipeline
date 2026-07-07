const API_BASE_URL = "http://127.0.0.1:8000";

async function parseResponse(response) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody?.detail || "Dashboard request failed.";
    throw new Error(Array.isArray(message) ? "Dashboard request failed." : message);
  }

  return response.json();
}

export async function getDashboardSummary() {
  const response = await fetch(`${API_BASE_URL}/api/dashboard/summary`);
  return parseResponse(response);
}
