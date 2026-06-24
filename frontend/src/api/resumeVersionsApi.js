const API_BASE_URL = "http://127.0.0.1:8000";

async function parseResponse(response) {
  if (!response.ok) {
    throw new Error("Resume version request failed.");
  }

  return response.json();
}

export async function getResumeVersions() {
  const response = await fetch(`${API_BASE_URL}/api/resume-versions`);
  return parseResponse(response);
}
