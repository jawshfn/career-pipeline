import { useEffect, useRef, useState } from "react";

const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

function friendlySize(bytes) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(bytes < 1024 ? 0 : 1)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function friendlyDate(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function CountList({ title, summary }) {
  return <section className="workspace-backup-counts" aria-label={title}>
    <h4>{title}</h4><dl>
      <dt>Resume versions</dt><dd>{summary.resume_versions}</dd><dt>Applications</dt><dd>{summary.applications}</dd><dt>Activities</dt><dd>{summary.application_activities}</dd><dt>Active applications</dt><dd>{summary.active_applications}</dd><dt>Closed applications</dt><dd>{summary.closed_applications}</dd><dt>Legacy archived</dt><dd>{summary.legacy_archived_applications}</dd>
    </dl>
  </section>;
}

export default function WorkspaceBackupReview({ isDemoMode = false, onValidateWorkspaceBackup }) {
  const [file, setFile] = useState(null); const [selectionError, setSelectionError] = useState("");
  const [result, setResult] = useState(null); const [error, setError] = useState(""); const [isReviewing, setIsReviewing] = useState(false);
  const inFlightRef = useRef(false); const errorRef = useRef(null); const inputRef = useRef(null);
  useEffect(() => { if (error || result?.is_valid === false) errorRef.current?.focus(); }, [error, result]);
  function clearSelection() { setFile(null); setSelectionError(""); setResult(null); setError(""); if (inputRef.current) inputRef.current.value = ""; }
  function handleFileChange(event) {
    const selected = event.target.files?.[0] || null;
    setResult(null); setError(""); setSelectionError(""); setFile(null);
    if (!selected) return;
    if (selected.size === 0) { setSelectionError("Choose a non-empty JSON backup file."); return; }
    if (selected.size > MAX_BACKUP_BYTES) { setSelectionError("Choose a backup file no larger than 25 MiB."); return; }
    if (!(selected.name.toLowerCase().endsWith(".json") || selected.type === "application/json")) { setSelectionError("Choose a PursuitHQ JSON backup file."); return; }
    setFile(selected);
  }
  async function reviewBackup() {
    if (!file || inFlightRef.current) return;
    inFlightRef.current = true; setIsReviewing(true); setResult(null); setError("");
    try { const validation = await onValidateWorkspaceBackup(await file.text()); setResult(validation); }
    catch (reviewError) { setError(reviewError?.message || "Could not review the workspace backup."); }
    finally { inFlightRef.current = false; setIsReviewing(false); }
  }
  if (isDemoMode) return <section className="workspace-backup-review" aria-labelledby="workspace-review-heading"><p className="support-recommended-label">LOCAL APP ONLY</p><h3 id="workspace-review-heading">Workspace restore preview</h3><p>Backup validation and restore are available only in the local PursuitHQ app. The public demo uses fictional data and resets when the page reloads.</p></section>;
  const invalid = error || result?.is_valid === false;
  return <section className="workspace-backup-review" aria-labelledby="workspace-review-heading">
    <p className="support-recommended-label">RESTORE PREVIEW</p><h3 id="workspace-review-heading">Review a workspace backup</h3><p>Choose a PursuitHQ JSON workspace backup to validate its structure and review what it contains. This step does not change your current workspace.</p><p className="workspace-backup-privacy">The selected file is sent only to your local PursuitHQ backend for validation.</p>
    <label className="workspace-backup-file-label">PursuitHQ JSON backup<input ref={inputRef} type="file" accept=".json,application/json" onChange={handleFileChange} /></label>
    {file ? <p className="workspace-backup-file-name"><strong>{file.name}</strong> <span>{friendlySize(file.size)}</span></p> : null}{selectionError ? <p className="workspace-backup-inline-error" role="alert">{selectionError}</p> : null}
    <div className="workspace-backup-controls"><button className="support-action-control support-primary-action" type="button" disabled={!file || isReviewing} onClick={reviewBackup}>{isReviewing ? "Reviewing backup..." : "Review backup"}</button>{file ? <button className="support-action-control secondary-button" type="button" onClick={clearSelection}>Clear selection</button> : null}</div>
    {invalid ? <section className="workspace-backup-result workspace-backup-result-error" ref={errorRef} role="alert" tabIndex={-1}><h4>Backup needs attention</h4><p>No data has been changed.</p>{error ? <p>{error}</p> : <ul>{result.errors.map((issue, index) => <li key={`${issue.code}-${issue.path}-${index}`}>{issue.path ? `${issue.path} — ` : ""}{issue.message}</li>)}</ul>}</section> : null}
    {result?.is_valid ? <section className="workspace-backup-result" role="status"><h4>Backup is valid</h4><p>No data has been changed. Restore is not available from this preview yet.</p><p><strong>Exported:</strong> {friendlyDate(result.backup_summary.exported_at)} · <strong>Format:</strong> {result.backup_summary.format} · <strong>Version:</strong> {result.backup_summary.version}</p><div className="workspace-backup-summary-grid"><CountList title="Backup contents" summary={result.backup_summary} /><CountList title="Current workspace" summary={result.current_workspace_summary} /></div>{result.warnings?.length ? <section className="workspace-backup-warnings"><h4>Warnings</h4><ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}</section> : null}
  </section>;
}
