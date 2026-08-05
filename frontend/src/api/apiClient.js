const API_BASE_URL = "http://127.0.0.1:8000";

async function parseResponse(response, fallbackErrorMessage) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody?.detail || fallbackErrorMessage;
    const error = new Error(typeof message === "string" ? message : fallbackErrorMessage);
    if (message && typeof message === "object") error.detail = message;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function parseDownloadResponse(response, fallbackErrorMessage) {
  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = errorBody?.detail || fallbackErrorMessage;
    const error = new Error(typeof message === "string" ? message : fallbackErrorMessage);
    if (message && typeof message === "object") error.detail = message;
    throw error;
  }

  return response.blob();
}

async function apiRequest(path, { body, fallbackErrorMessage = "Request failed.", method = "GET" } = {}) {
  const requestOptions = { method };

  if (body !== undefined) {
    requestOptions.headers = {
      "Content-Type": "application/json",
    };
    requestOptions.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, requestOptions);
  return parseResponse(response, fallbackErrorMessage);
}

export function apiGet(path, fallbackErrorMessage) {
  return apiRequest(path, { fallbackErrorMessage });
}

export function apiPost(path, payload, fallbackErrorMessage) {
  return apiRequest(path, { body: payload, fallbackErrorMessage, method: "POST" });
}

export async function apiPostRawJson(path, jsonText, fallbackErrorMessage, additionalHeaders = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...additionalHeaders },
    body: jsonText,
  });
  return parseResponse(response, fallbackErrorMessage);
}

export function apiPatch(path, payload, fallbackErrorMessage) {
  return apiRequest(path, { body: payload, fallbackErrorMessage, method: "PATCH" });
}

export function apiPut(path, payload, fallbackErrorMessage) {
  return apiRequest(path, { body: payload, fallbackErrorMessage, method: "PUT" });
}

export async function apiPutFormData(path, formData, fallbackErrorMessage) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    body: formData,
  });
  return parseResponse(response, fallbackErrorMessage);
}

export function apiDelete(path, fallbackErrorMessage) {
  return apiRequest(path, { fallbackErrorMessage, method: "DELETE" });
}

export async function apiDownload(path, fallbackErrorMessage) {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: "GET" });
  return parseDownloadResponse(response, fallbackErrorMessage);
}
