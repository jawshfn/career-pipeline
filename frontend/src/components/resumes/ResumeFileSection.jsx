import React, { useEffect, useRef, useState } from "react";

import ConfirmationDialog from "../ui/ConfirmationDialog.jsx";
import ErrorMessage from "../ui/ErrorMessage.jsx";
import { downloadBlob } from "../../utils/downloadBlob.js";

const MAX_PDF_SIZE_BYTES = 5 * 1024 * 1024;

export function formatResumeFileSize(sizeBytes) {
  const size = Number(sizeBytes);
  if (!Number.isFinite(size) || size < 0) return "Size unavailable";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

export function formatResumeFileDate(value) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function validationError(file) {
  if (!file.name.toLocaleLowerCase().endsWith(".pdf")) return "Choose a PDF file.";
  if (file.size > MAX_PDF_SIZE_BYTES) return "PDF files must be 5 MiB or smaller.";
  return "";
}

export default function ResumeFileSection({ disabled = false, isDemoMode, isManagePdfOpen = false, onDeleteFile, onGetFileContent, onManagePdfEscape, onManagePdfOpenChange, onUploadFile, resumeVersion, usageCount }) {
  const inputRef = useRef(null);
  const previewUrlRef = useRef(null);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pendingReplacement, setPendingReplacement] = useState(null);
  const [isRemoveOpen, setIsRemoveOpen] = useState(false);
  const [preview, setPreview] = useState(null);

  function clearPreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreview(null);
  }

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function openPicker() {
    if (operation || disabled) return;
    setError("");
    setMessage("");
    inputRef.current?.click();
  }

  async function upload(file, replacing) {
    setError("");
    setMessage("");
    setOperation(replacing ? "replacing" : "attaching");
    try {
      const updated = await onUploadFile(resumeVersion.id, file);
      setMessage(`${replacing ? "PDF replaced" : "PDF attached"} for "${updated.name}".`);
      return updated;
    } catch (uploadError) {
      setError(uploadError.message || "Could not attach the PDF.");
      return null;
    } finally {
      setOperation("");
    }
  }

  async function handleFileSelection(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const fileError = validationError(file);
    if (fileError) return setError(fileError);
    if (resumeVersion.file && usageCount > 0) {
      setPendingReplacement(file);
      return;
    }
    await upload(file, Boolean(resumeVersion.file));
  }

  async function handlePreview() {
    setError("");
    setMessage("");
    setOperation("previewing");
    try {
      const blob = await onGetFileContent(resumeVersion.id);
      clearPreview();
      const url = URL.createObjectURL(blob);
      previewUrlRef.current = url;
      setPreview({ blob, url });
    } catch (previewError) {
      setError(previewError.message || "Could not load the PDF preview.");
    } finally {
      setOperation("");
    }
  }

  async function handleDownload() {
    setError("");
    setMessage("");
    setOperation("downloading");
    try {
      const blob = await onGetFileContent(resumeVersion.id);
      downloadBlob(blob, resumeVersion.file.original_filename);
    } catch (downloadError) {
      setError(downloadError.message || "Could not download the PDF.");
    } finally {
      setOperation("");
    }
  }

  async function confirmReplacement() {
    const file = pendingReplacement;
    if (!file || operation) return;
    const updated = await upload(file, true);
    if (updated) setPendingReplacement(null);
  }

  async function confirmRemoval() {
    if (operation) return;
    setError("");
    setMessage("");
    setOperation("removing");
    try {
      await onDeleteFile(resumeVersion.id);
      setMessage(`PDF removed from "${resumeVersion.name}".`);
      setIsRemoveOpen(false);
    } catch (removeError) {
      setError(removeError.message || "Could not remove the PDF.");
    } finally {
      setOperation("");
    }
  }

  const file = resumeVersion.file;
  const busy = Boolean(operation) || disabled;
  return (
    <section className="resume-file-section" aria-label={`Resume file for ${resumeVersion.name}`}>
      <h4>Resume file</h4>
      {isDemoMode ? <p className="resume-file-demo-note">Demo PDF changes stay in this browser session and reset when the page reloads.</p> : null}
      <input accept=".pdf,application/pdf" aria-label={`Choose a PDF for ${resumeVersion.name}`} className="resume-file-input" disabled={disabled} ref={inputRef} type="file" onChange={handleFileSelection} />
      {!file ? <><p>No PDF attached</p><button className="secondary-button" type="button" disabled={busy} onClick={openPicker}>{operation === "attaching" ? "Attaching..." : "Attach PDF"}</button></> : <>
        <p className="resume-file-name">{file.original_filename}</p>
        <p className="resume-file-meta">{formatResumeFileSize(file.size_bytes)} · <time dateTime={file.updated_at || file.created_at}>{`Added ${formatResumeFileDate(file.updated_at || file.created_at)}`}</time></p>
        <div className="resume-file-actions">
          <button className="secondary-button" disabled={busy} type="button" onClick={handlePreview}>{operation === "previewing" ? "Loading preview..." : "Preview"}</button>
          <button className="secondary-button" disabled={busy} type="button" onClick={handleDownload}>{operation === "downloading" ? "Downloading..." : "Download"}</button>
          <details className="manage-pdf-disclosure" open={isManagePdfOpen} onKeyDown={onManagePdfEscape}>
            <summary aria-label={`Manage PDF for ${resumeVersion.name}`} onClick={(event) => { event.preventDefault(); onManagePdfOpenChange?.(!isManagePdfOpen); }}>Manage PDF</summary>
            <div className="manage-pdf-panel">
              <button className="secondary-button" disabled={busy} type="button" onClick={() => { onManagePdfOpenChange?.(false); openPicker(); }}>{operation === "replacing" ? "Replacing..." : "Replace PDF"}</button>
              <button className="quiet-danger-button" disabled={busy} type="button" onClick={() => { onManagePdfOpenChange?.(false); setError(""); setMessage(""); setIsRemoveOpen(true); }}>{operation === "removing" ? "Removing..." : "Remove PDF"}</button>
            </div>
          </details>
        </div>
      </>}
      {error ? <ErrorMessage message={error} /> : null}
      {message ? <p className="message message-success" role="status">{message}</p> : null}
      <ConfirmationDialog cancelLabel="Keep current PDF" confirmLabel="Replace PDF" description={`This resume version is used by ${usageCount} application${usageCount === 1 ? "" : "s"}. Replacing the PDF keeps those assignments connected to this version. Use a new resume version for material content changes.`} isOpen={Boolean(pendingReplacement)} isProcessing={operation === "replacing"} onCancel={() => !operation && setPendingReplacement(null)} onConfirm={confirmReplacement} processingLabel="Replacing..." title="Replace this resume PDF?" />
      <ConfirmationDialog cancelLabel="Keep PDF" confirmLabel="Remove PDF" confirmTone="danger" description={`The PDF will be removed from "${resumeVersion.name}". The resume version and all application assignments will remain.`} errorMessage={isRemoveOpen ? error : ""} isOpen={isRemoveOpen} isProcessing={operation === "removing"} onCancel={() => !operation && setIsRemoveOpen(false)} onConfirm={confirmRemoval} processingLabel="Removing..." title="Remove this resume PDF?" />
      <ConfirmationDialog cancelLabel="Close" description={<div className="resume-pdf-preview"><p><strong>{resumeVersion.name}</strong><br />{file?.original_filename}</p><iframe title={`${resumeVersion.name} PDF preview`} src={preview?.url} /><p>PDF preview availability depends on your browser. Open the file in a new tab or download it when the embedded preview is unavailable.</p><div className="resume-file-actions"><button className="secondary-button" type="button" onClick={() => window.open(preview?.url, "_blank", "noopener,noreferrer")}>Open in new tab</button><button className="secondary-button" type="button" onClick={() => preview && downloadBlob(preview.blob, file.original_filename)}>Download</button></div></div>} hideConfirm isOpen={Boolean(preview)} onCancel={clearPreview} showCloseIcon size="wide" title="PDF preview" />
    </section>
  );
}
