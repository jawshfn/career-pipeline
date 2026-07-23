import { buildJobBriefMessages } from "./jobBrief.js";

export const GEMINI_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_THINKING_LEVEL = "minimal";

function endpointFor() {
  return `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
}

export class GoogleProviderError extends Error {
  constructor(kind, status) {
    super(kind);
    this.name = "GoogleProviderError";
    this.kind = kind;
    if (status !== undefined) this.status = status;
  }
}

/** Makes one direct, abortable Gemini generateContent request without exposing provider data. */
export async function generateGoogleJobBrief({ env, request, timeoutMs, maxCompletionTokens }) {
  const messages = buildJobBriefMessages(request);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const body = {
    systemInstruction: { parts: [{ text: messages[0].content }] },
    contents: [{ role: "user", parts: [{ text: messages[1].content }] }],
    generationConfig: { maxOutputTokens: maxCompletionTokens, thinkingConfig: { thinkingLevel: GEMINI_THINKING_LEVEL } },
  };
  let response;
  try {
    response = await fetch(endpointFor(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) throw new GoogleProviderError("generation_failed");
    throw new GoogleProviderError("generation_failed");
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 429) throw new GoogleProviderError("rate_limited", 429);
  if (!response.ok) {
    if (response.status >= 500) throw new GoogleProviderError("generation_failed", response.status);
    throw new GoogleProviderError("ai_misconfigured", response.status);
  }
  try {
    return { payload: await response.json(), status: response.status };
  } catch {
    return { payload: null, status: response.status };
  }
}
