import { detectGreenhousePage } from "./detector.mjs";
import { buildCareerPipelineCaptureUrl } from "./capturePayload.mjs";
import { detectIndeedJobPage } from "./indeedDetector.mjs";
import { detectLinkedInJobPage } from "./linkedinDetector.mjs";
import { detectZipRecruiterJobPage } from "./zipRecruiterDetector.mjs";
import { buildBrowserTextCaptureUrl, createBrowserTextCapture } from "./textCaptureApi.mjs";

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
      /^\/jobs-search\/?$/u.test(url.pathname) && selectedJobKeys.length === 1 && Boolean(selectedJobKeys[0].trim());
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

  if (result?.status === "detected" && (result.provider === "indeed" || result.provider === "linkedin" || result.provider === "ziprecruiter")) {
    const providerLabel = result.provider === "linkedin" ? "LinkedIn" : result.provider === "ziprecruiter" ? "ZipRecruiter" : "Indeed";
    appendText("status-title", `${providerLabel} job detected`);
    appendText("result-detail", result.role_title);
    if (result.company_name) appendText("result-detail", result.company_name);
    appendText("result-detail", `${result.description_character_count.toLocaleString()} characters captured`);
    appendText("local-capture-guidance", "Career Pipeline must be running locally at http://localhost:5173.");
    appendButton("Open in Career Pipeline", async () => {
      try {
        await openBrowserTextCareerPipeline(result);
        window.close();
      } catch {
        appendText("result-detail", "Career Pipeline could not receive this job. Confirm the local backend is running.");
      }
    });
    return;
  }

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
    "not-indeed": "This page is not a supported Indeed job page.",
    "not-linkedin": "This page is not a supported LinkedIn job page.",
    "not-ziprecruiter": "This page is not a supported ZipRecruiter selected job.",
    "no-current-job": "Career Pipeline could not confidently identify the current Indeed job. Copy the job posting and use Paste Job Text.",
    "ambiguous-job": "Career Pipeline could not confidently identify the current Indeed job. Copy the job posting and use Paste Job Text.",
    "capture-too-large": "This Indeed job is too large to capture. Copy the job posting and use Paste Job Text.",
    "no-supported-job-id": "This page does not expose one supported Greenhouse job ID.",
    "no-verified-board": "No verified Greenhouse board was detected on this page.",
    "ambiguous-board": "Multiple Greenhouse boards were detected, so no result was selected.",
    "unsupported-page": "Chrome cannot inspect this protected browser page.",
    "extension-error": result?.error_code === "indeed-injection-failed"
      ? "Career Pipeline could not inspect this Indeed page. Reload the extension and try again."
      : result?.error_code === "linkedin-injection-failed"
      ? "Career Pipeline could not inspect this LinkedIn page. Reload the extension and try again."
      : result?.error_code === "ziprecruiter-injection-failed"
      ? "Career Pipeline could not inspect this ZipRecruiter page. Reload the extension and try again."
      : "The detector encountered an unexpected error. Check the extension error details.",
  };
  const providerLabel = result?.provider === "linkedin" ? "LinkedIn" : result?.provider === "indeed" ? "Indeed" : result?.provider === "ziprecruiter" ? "ZipRecruiter" : "";
  if (["no-current-job", "ambiguous-job", "capture-too-large", "not-linkedin", "not-indeed", "not-ziprecruiter"].includes(result?.status) && providerLabel) {
    const action = result.status === "capture-too-large" ? "is too large to capture" : "could not confidently identify the current job";
    appendText("status-title", `${providerLabel} ${action}. Copy the job posting and use Paste Job Text.`);
    return;
  }
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
    console.error("Career Pipeline Greenhouse Detector inspection error", error);
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
