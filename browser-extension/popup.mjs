import { detectGreenhousePage } from "./detector.mjs";
import { buildCareerPipelineCaptureUrl } from "./capturePayload.mjs";
import { detectIndeedJobPage } from "./indeedDetector.mjs";
import { detectLinkedInJobPage } from "./linkedinDetector.mjs";
import { detectZipRecruiterJobPage } from "./zipRecruiterDetector.mjs";
import { buildBrowserTextCaptureUrl, createBrowserTextCapture } from "./textCaptureApi.mjs";

const resultPanel = typeof document === "undefined" ? null : document.querySelector("#result");
const transferNote = typeof document === "undefined" ? null : document.querySelector("#transfer-note");

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

function appendElement(tagName, className, text) {
  if (!resultPanel) {
    return null;
  }
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  resultPanel.append(element);
  return element;
}

function appendCaptureIdentity(providerLabel, statusText) {
  if (!resultPanel) {
    return;
  }
  const identity = document.createElement("div");
  identity.className = "capture-identity";
  const source = document.createElement("span");
  source.className = "source-badge";
  source.textContent = providerLabel;
  const status = document.createElement("span");
  status.className = "capture-status";
  status.textContent = statusText;
  identity.append(source, status);
  resultPanel.append(identity);
}

function showTransferNote() {
  if (!transferNote) {
    return;
  }
  transferNote.replaceChildren();
  const heading = document.createElement("p");
  heading.className = "transfer-note-heading";
  heading.textContent = "One-time local transfer";
  const detail = document.createElement("p");
  detail.className = "transfer-note-detail";
  detail.textContent = "The captured job is sent only after you continue. You will review it before anything is saved.";
  transferNote.append(heading, detail);
  transferNote.hidden = false;
}

function resetPresentation(state = "neutral") {
  if (resultPanel) {
    resultPanel.className = `result-panel is-${state}`;
  }
  if (transferNote) {
    transferNote.hidden = true;
    transferNote.replaceChildren();
  }
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

export function isIndeedHostname(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password &&
      (hostname === "indeed.com" || hostname.endsWith(".indeed.com"));
  } catch {
    return false;
  }
}

export function isLinkedInHostname(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password &&
      (url.port === "" || url.port === "80" || url.port === "443") &&
      (hostname === "linkedin.com" || hostname.endsWith(".linkedin.com")) && /^\/jobs(?:\/|$)/u.test(url.pathname);
  } catch { return false; }
}

export function isZipRecruiterJobUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.toLowerCase();
    const selectedJobKeys = url.searchParams.getAll("lk");
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password &&
      (url.port === "" || url.port === "80" || url.port === "443") &&
      (hostname === "ziprecruiter.com" || hostname.endsWith(".ziprecruiter.com")) &&
      /^\/jobs-search(?:\/[1-9]\d*)?\/?$/u.test(url.pathname) && selectedJobKeys.length === 1 && Boolean(selectedJobKeys[0].trim());
  } catch { return false; }
}

export async function openIndeedCareerPipeline(detectionResult, chromeApi = globalThis.chrome, fetchImpl = fetch) {
  return openBrowserTextCareerPipeline(detectionResult, chromeApi, fetchImpl);
}

export async function openBrowserTextCareerPipeline(detectionResult, chromeApi = globalThis.chrome, fetchImpl = fetch) {
  const token = await createBrowserTextCapture(detectionResult, fetchImpl);
  await chromeApi.tabs.create({ url: buildBrowserTextCaptureUrl(token) });
}

function renderResult(result) {
  if (!resultPanel) {
    return;
  }
  resultPanel.replaceChildren();
  resetPresentation();

  if (result?.status === "detected" && (result.provider === "indeed" || result.provider === "linkedin" || result.provider === "ziprecruiter")) {
    const providerLabel = result.provider === "linkedin" ? "LinkedIn" : result.provider === "ziprecruiter" ? "ZipRecruiter" : "Indeed";
    resetPresentation("ready");
    appendCaptureIdentity(providerLabel, "Ready to review");
    appendElement("h2", "opportunity-title", result.role_title);
    if (result.company_name) appendText("company-name", result.company_name);
    appendText("description-metadata", `Description captured \u00b7 ${result.description_character_count.toLocaleString()} characters`);
    appendText("local-capture-guidance", "Requires the local PursuitHQ app");
    appendButton("Open in PursuitHQ", async () => {
      try {
        await openBrowserTextCareerPipeline(result);
        window.close();
      } catch {
        appendText("action-error", "PursuitHQ could not receive this job. Confirm the local backend is running.");
      }
    });
    showTransferNote();
    return;
  }

  if (result?.status === "detected") {
    resetPresentation("ready");
    appendCaptureIdentity("Greenhouse", "Ready to review");
    appendElement("h2", "opportunity-title", "Greenhouse job detected");
    appendText("result-detail", `Board: ${result.board_token}`);
    appendText("result-detail", `Job ID: ${result.job_id}`);
    const evidence = result.evidence_types.map((type) => evidenceLabels[type] || "Greenhouse configuration");
    appendText("result-detail", `Evidence: ${evidence.join(", ")}`);
    if (canOpenCareerPipeline(result)) {
      appendText("local-capture-guidance", "Requires the local PursuitHQ app");
      appendButton("Open in PursuitHQ", async () => {
        try {
          await openCareerPipeline(result);
          window.close();
        } catch (error) {
          console.error("PursuitHQ Greenhouse Detector handoff error", error);
          appendText("action-error", "PursuitHQ could not be opened. Confirm the local app is running.");
        }
      });
      showTransferNote();
    }
    return;
  }

  const messages = {
    "not-indeed": "This page is not a supported Indeed job page.",
    "not-linkedin": "This page is not a supported LinkedIn job page.",
    "not-ziprecruiter": "This page is not a supported ZipRecruiter selected job.",
    "no-current-job": "PursuitHQ could not confidently identify the current Indeed job. Copy the job posting and use Paste Job Text.",
    "ambiguous-job": "PursuitHQ could not confidently identify the current Indeed job. Copy the job posting and use Paste Job Text.",
    "capture-too-large": "This Indeed job is too large to capture. Copy the job posting and use Paste Job Text.",
    "no-verified-board": "No verified Greenhouse board was detected on this page.",
    "ambiguous-board": "Multiple Greenhouse boards were detected, so no result was selected.",
    "unsupported-page": "Chrome cannot inspect this protected browser page.",
    "extension-error": result?.error_code === "indeed-injection-failed"
      ? "PursuitHQ could not inspect this Indeed page. Reload the extension and try again."
      : result?.error_code === "linkedin-injection-failed"
      ? "PursuitHQ could not inspect this LinkedIn page. Reload the extension and try again."
      : result?.error_code === "ziprecruiter-injection-failed"
      ? "PursuitHQ could not inspect this ZipRecruiter page. Reload the extension and try again."
      : "The detector encountered an unexpected error. Check the extension error details.",
  };
  if (result?.status === "no-supported-job-id") {
    resetPresentation("neutral");
    appendElement("h2", "status-title", "Capture unavailable on this page");
    appendText("state-detail", "Browser Capture could not find a supported job posting on the current page.");
    appendText("state-detail", "Open the full job description and try again, or use Paste Job Text or Manual Entry in PursuitHQ.");
    return;
  }
  const providerLabel = result?.provider === "linkedin" ? "LinkedIn" : result?.provider === "indeed" ? "Indeed" : result?.provider === "ziprecruiter" ? "ZipRecruiter" : "";
  if (["no-current-job", "ambiguous-job", "capture-too-large", "not-linkedin", "not-indeed", "not-ziprecruiter"].includes(result?.status) && providerLabel) {
    resetPresentation(result.status === "ambiguous-job" ? "warning" : "neutral");
    const action = result.status === "capture-too-large" ? "is too large to capture" : "could not confidently identify the current job";
    appendText("status-title", `${providerLabel} ${action}. Copy the job posting and use Paste Job Text.`);
    return;
  }
  resetPresentation(result?.status === "extension-error" ? "error" : "neutral");
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

  let activeTab;
  try {
    [activeTab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.id) {
      return { status: "unsupported-page" };
    }

    const provider = isLinkedInHostname(activeTab.url) ? "linkedin" : isIndeedHostname(activeTab.url) ? "indeed" : isZipRecruiterJobUrl(activeTab.url) ? "ziprecruiter" : "greenhouse";
    const injectionResults = await chromeApi.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: provider === "linkedin" ? detectLinkedInJobPage : provider === "indeed" ? detectIndeedJobPage : provider === "ziprecruiter" ? detectZipRecruiterJobPage : detectGreenhousePage,
    });
    const detectionResult = unwrapInjectionResult(injectionResults);
    if (detectionResult.status === "detected") {
      return { ...detectionResult, original_job_link: activeTab.url };
    }
    return provider === "linkedin" || provider === "indeed" || provider === "ziprecruiter" ? { ...detectionResult, provider } : detectionResult;
  } catch (error) {
    console.error("PursuitHQ Greenhouse Detector inspection error", error);
    const classification = classifyInspectionError(error);
    return providerForUrl(activeTab?.url) && classification.status === "extension-error"
      ? { ...classification, error_code: `${providerForUrl(activeTab.url)}-injection-failed` }
      : classification;
  }
}

function providerForUrl(url) {
  if (isLinkedInHostname(url)) return "linkedin";
  if (isIndeedHostname(url)) return "indeed";
  if (isZipRecruiterJobUrl(url)) return "ziprecruiter";
  return "";
}

if (resultPanel) {
  inspectActivePage().then(renderResult);
}
