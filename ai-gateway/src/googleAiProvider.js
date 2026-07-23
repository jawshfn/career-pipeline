import { buildJobBriefMessages } from "./jobBrief.js";

export const GOOGLE_AI_MODELS = Object.freeze({
  GEMMA: "gemma-4-26b-a4b-it",
  FLASH_LITE: "gemini-3.5-flash-lite",
});
export const GOOGLE_AI_MODEL = GOOGLE_AI_MODELS.FLASH_LITE;

export function isAllowedGoogleModel(model) {
  return Object.values(GOOGLE_AI_MODELS).includes(model);
}

function endpointFor(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
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
export async function generateGoogleJobBrief({ env, request, configuration }) {
  const messages = buildJobBriefMessages(request, "2");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), configuration.googleTimeoutMs);
  const generationConfig = configuration.model === GOOGLE_AI_MODELS.GEMMA
    ? {
      temperature: 0.2,
      maxOutputTokens: configuration.maxCompletionTokens,
      thinkingConfig: { thinkingLevel: configuration.googleThinkingLevel },
    }
    : {
      maxOutputTokens: configuration.maxCompletionTokens,
      thinkingConfig: { thinkingLevel: configuration.googleThinkingLevel },
    };
  const body = {
    systemInstruction: { parts: [{ text: messages[0].content }] },
    contents: [{ role: "user", parts: [{ text: messages[1].content }] }],
    generationConfig,
  };
  let response;
  try {
    response = await fetch(endpointFor(configuration.model), {
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
