import { detectGreenhousePage } from "./detector.mjs";
import { buildCareerPipelineCaptureUrl } from "./capturePayload.mjs";

const resultPanel = typeof document === "undefined" ? null : document.querySelector("#result");

const evidenceLabels = {
  "page-url": "Hosted Greenhouse page",
  "script-source": "Greenhouse script",
  "iframe-source": "Greenhouse frame",
  "job-link": "Greenhouse job link",
  "form-action": "Greenhouse application form",
  "performance-resource": "Loaded Greenhouse resource",
  "data-greenhouse-url": "Greenhouse data attribute",
  "data-greenhouse-board-url": "Greenhouse board attribute",
  "data-greenhouse-api-url": "Greenhouse API attribute",
  "data-greenhouse-board": "Greenhouse board token attribute",
  "data-greenhouse-board-token": "Greenhouse board token attribute",
};

function appendText(className, text) {
  if (!resultPanel) {
    return;
  }
  const paragraph = document.createElement("p");
  paragraph.className = className;
  paragraph.textContent = text;
  resultPanel.append(paragraph);
}

function appendButton(text, onClick) {
  if (!resultPanel) {
    return;
  }

  const button = document.createElement("button");
  button.className = "primary-button";
  button.type = "button";
  button.textContent = text;
  button.addEventListener("click", onClick);
  resultPanel.append(button);
}

export function canOpenCareerPipeline(result) {
  try {
    buildCareerPipelineCaptureUrl(result);
    return true;
  } catch {
    return false;
  }
}

export async function openCareerPipeline(detectionResult, chromeApi = globalThis.chrome) {
  const url = buildCareerPipelineCaptureUrl(detectionResult);
  await chromeApi.tabs.create({ url });
}

function renderResult(result) {
  if (!resultPanel) {
    return;
  }
  resultPanel.replaceChildren();

  if (result?.status === "detected") {
    appendText("status-title", "Greenhouse detected");
    appendText("result-detail", `Board: ${result.board_token}`);
    appendText("result-detail", `Job ID: ${result.job_id}`);
    const evidence = result.evidence_types.map((type) => evidenceLabels[type] || "Greenhouse configuration");
    appendText("result-detail", `Evidence: ${evidence.join(", ")}`);
    if (canOpenCareerPipeline(result)) {
      appendText("local-capture-guidance", "Career Pipeline must be running locally at http://localhost:5173.");
      appendButton("Open in Career Pipeline", async () => {
        try {
          await openCareerPipeline(result);
          window.close();
        } catch (error) {
          console.error("Career Pipeline Greenhouse Detector handoff error", error);
          appendText("result-detail", "Career Pipeline could not be opened. Confirm the local app is running.");
        }
      });
    }
    return;
  }

  const messages = {
    "no-supported-job-id": "This page does not expose one supported Greenhouse job ID.",
    "no-verified-board": "No verified Greenhouse board was detected on this page.",
    "ambiguous-board": "Multiple Greenhouse boards were detected, so no result was selected.",
    "unsupported-page": "Chrome cannot inspect this protected browser page.",
    "extension-error": "The detector encountered an unexpected error. Check the extension error details.",
  };
  appendText("status-title", messages[result?.status] || messages["extension-error"]);
}

export function unwrapInjectionResult(injectionResults) {
  return injectionResults?.[0]?.result || { status: "extension-error" };
}

export function classifyInspectionError(error) {
  const message = String(error?.message || "").toLowerCase();
  const restrictedPageError = [
    "cannot access contents of url",
    "cannot be scripted",
    "extensions gallery",
    "chrome://",
    "edge://",
    "about:",
  ].some((phrase) => message.includes(phrase));

  return { status: restrictedPageError ? "unsupported-page" : "extension-error" };
}

export async function inspectActivePage(chromeApi = globalThis.chrome) {
  if (!chromeApi?.tabs || !chromeApi?.scripting) {
    return { status: "extension-error" };
  }

  try {
    const [activeTab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      return { status: "unsupported-page" };
    }

    const injectionResults = await chromeApi.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: detectGreenhousePage,
    });
    const detectionResult = unwrapInjectionResult(injectionResults);
    return detectionResult.status === "detected"
      ? { ...detectionResult, original_job_link: activeTab.url }
      : detectionResult;
  } catch (error) {
    console.error("Career Pipeline Greenhouse Detector inspection error", error);
    return classifyInspectionError(error);
  }
}

if (resultPanel) {
  inspectActivePage().then(renderResult);
}
