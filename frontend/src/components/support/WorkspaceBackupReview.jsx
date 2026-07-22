import { useEffect, useId, useRef, useState } from "react";

import ConfirmationDialog from "../ui/ConfirmationDialog.jsx";

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
      <dt>Resume versions</dt><dd>{summary.resume_versions}</dd><dt>Applications</dt><dd>{summary.applications}</dd><dt>Activities</dt><dd>{summary.application_activities}</dd><dt>Active applications</dt><dd>{summary.active_applications}</dd><dt>Closed applications</dt><dd>{summary.closed_applications}</dd><dt>Legacy archived applications</dt><dd>{summary.legacy_archived_applications}</dd>
    </dl>
  </section>;
}

export default function WorkspaceBackupReview({
  isDemoMode = false,
  onRestoreWorkspaceBackup = async () => {},
  onValidateWorkspaceBackup = async () => {},
  onWorkspaceRestored = async () => true,
}) {
  const [file, setFile] = useState(null);
  const [selectionError, setSelectionError] = useState("");
  const [result, setResult] = useState(null);
  const [reviewError, setReviewError] = useState("");
  const [restoreError, setRestoreError] = useState("");
  const [restoreResult, setRestoreResult] = useState(null);
  const [refreshWarning, setRefreshWarning] = useState("");
  const [isReviewing, setIsReviewing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false);
  const [confirmationPhrase, setConfirmationPhrase] = useState("");
  const reviewInFlightRef = useRef(false);
  const restoreInFlightRef = useRef(false);
  const errorRef = useRef(null);
  const inputRef = useRef(null);
  const confirmationInputId = useId();

  useEffect(() => {
    if (reviewError || restoreError || result?.is_valid === false) errorRef.current?.focus();
  }, [reviewError, restoreError, result]);

  function resetRestoreState() {
    setResult(null);
    setRestoreError("");
    setRestoreResult(null);
    setRefreshWarning("");
    setIsConfirmationOpen(false);
    setConfirmationPhrase("");
  }

  function clearSelection() {
    setFile(null);
    setSelectionError("");
    setReviewError("");
    resetRestoreState();
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFileChange(event) {
    const selected = event.target.files?.[0] || null;
    setReviewError("");
    setSelectionError("");
    setFile(null);
    resetRestoreState();
    if (!selected) return;
    if (selected.size === 0) { setSelectionError("Choose a non-empty JSON backup file."); return; }
    if (selected.size > MAX_BACKUP_BYTES) { setSelectionError("Choose a backup file no larger than 25 MiB."); return; }
    if (!(selected.name.toLowerCase().endsWith(".json") || selected.type === "application/json")) { setSelectionError("Choose a PursuitHQ JSON backup file."); return; }
    setFile(selected);
  }

  async function reviewBackup() {
    if (!file || reviewInFlightRef.current || isRestoring) return;
    reviewInFlightRef.current = true;
    setIsReviewing(true);
    setReviewError("");
    resetRestoreState();
    try {
      const validation = await onValidateWorkspaceBackup(await file.text());
      setResult(validation);
    } catch (error) {
      setReviewError(error?.message || "Could not review the workspace backup.");
    } finally {
      reviewInFlightRef.current = false;
      setIsReviewing(false);
    }
  }

  function closeConfirmation() {
    if (isRestoring) return;
    setIsConfirmationOpen(false);
    setConfirmationPhrase("");
  }

  async function restoreBackup() {
    const authorization = result?.restore_authorization;
    if (!file || !authorization || authorization.mode !== "replace" || confirmationPhrase.trim() !== "RESTORE" || restoreInFlightRef.current) return;
    restoreInFlightRef.current = true;
    setIsRestoring(true);
    setRestoreError("");
    try {
      const restored = await onRestoreWorkspaceBackup(await file.text(), authorization.token);
      setIsConfirmationOpen(false);
      setConfirmationPhrase("");
      setResult(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      setRestoreResult(restored);
      try {
        const refreshed = await onWorkspaceRestored();
        if (refreshed === false) setRefreshWarning("The workspace was restored, but PursuitHQ could not refresh the page data. Reload the app to view the restored workspace.");
      } catch {
        setRefreshWarning("The workspace was restored, but PursuitHQ could not refresh the page data. Reload the app to view the restored workspace.");
      }
    } catch (error) {
      setIsConfirmationOpen(false);
      setConfirmationPhrase("");
      setResult(null);
      setRestoreResult(null);
      setRefreshWarning("");
      setRestoreError(error?.message || "Could not restore the workspace.");
    } finally {
      restoreInFlightRef.current = false;
      setIsRestoring(false);
    }
  }

  if (isDemoMode) return <section className="workspace-backup-review" aria-labelledby="workspace-review-heading"><p className="support-recommended-label">LOCAL APP ONLY</p><h3 id="workspace-review-heading">Workspace restore preview</h3><p>Backup validation and restore are available only in the local PursuitHQ app. The public demo uses fictional data and resets when the page reloads.</p></section>;

  const invalid = reviewError || result?.is_valid === false;
  const authorization = result?.restore_authorization;
  const canRestore = Boolean(file && !isReviewing && !isRestoring && result?.is_valid && result?.eligible_for_restore && authorization?.mode === "replace");
  const needsNewReview = result?.is_valid && (!authorization || authorization.mode !== "replace");

  return <section className="workspace-backup-review" aria-labelledby="workspace-review-heading">
    <p className="support-recommended-label">RESTORE PREVIEW</p><h3 id="workspace-review-heading">Review a workspace backup</h3><p>Choose a PursuitHQ JSON workspace backup to validate its structure and review what it contains. This step does not change your current workspace.</p><p className="workspace-backup-privacy">The selected file is sent only to your local PursuitHQ backend for validation.</p>
    <label className="workspace-backup-file-label">PursuitHQ JSON backup<input ref={inputRef} type="file" accept=".json,application/json" disabled={isReviewing || isRestoring} onChange={handleFileChange} /></label>
    {file ? <p className="workspace-backup-file-name"><strong>{file.name}</strong> <span>{friendlySize(file.size)}</span></p> : null}
    {selectionError ? <p className="workspace-backup-inline-error" role="alert">{selectionError}</p> : null}
    <div className="workspace-backup-controls"><button className="support-action-control support-primary-action" type="button" disabled={!file || isReviewing || isRestoring} onClick={reviewBackup}>{isReviewing ? "Reviewing backup..." : "Review backup"}</button>{file ? <button className="support-action-control secondary-button" type="button" disabled={isReviewing || isRestoring} onClick={clearSelection}>Clear selection</button> : null}</div>
    {restoreError ? <section className="workspace-backup-result workspace-backup-result-error" ref={errorRef} role="alert" tabIndex={-1}><h4>Workspace restore needs attention</h4><p>{restoreError}</p><p className="workspace-backup-supporting-copy">Review the selected backup again before trying to restore it.</p></section> : null}
    {invalid ? <section className="workspace-backup-result workspace-backup-result-error" ref={errorRef} role="alert" tabIndex={-1}><h4>Backup needs attention</h4><p>No data has been changed.</p>{reviewError ? <p>{reviewError}</p> : <ul>{result.errors?.map((issue, index) => <li key={`${issue.code}-${issue.path}-${index}`}>{issue.path ? `${issue.path} — ` : ""}{issue.message}</li>)}</ul>}</section> : null}
    {result?.is_valid && !restoreResult ? <section className="workspace-backup-result" role="status"><h4>Backup is valid</h4><p>The backup has been reviewed. No data has been changed. Restore will replace the complete local workspace, and its authorization is temporary.</p><p><strong>Exported:</strong> {friendlyDate(result.backup_summary.exported_at)} · <strong>Format:</strong> {result.backup_summary.format} · <strong>Version:</strong> {result.backup_summary.version}</p><div className="workspace-backup-summary-grid"><CountList title="Backup contents" summary={result.backup_summary} /><CountList title="Current workspace" summary={result.current_workspace_summary} /></div>{result.warnings?.length ? <section className="workspace-backup-warnings"><h4>Warnings</h4><ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></section> : null}{authorization ? <p className="workspace-backup-authorization">This review authorization expires {friendlyDate(authorization.expires_at)}.</p> : null}{needsNewReview ? <p className="workspace-backup-supporting-copy">Review the backup again before restoring it.</p> : null}{canRestore ? <div className="workspace-backup-restore-action"><p>Replacing the workspace is destructive and cannot be undone without another backup.</p><button className="delete-application-confirm-button" type="button" onClick={() => setIsConfirmationOpen(true)}>Replace current workspace</button></div> : null}</section> : null}
    {restoreResult ? <section className="workspace-backup-result workspace-backup-result-success" role="status"><h4>Workspace restored</h4><p>The local workspace was replaced successfully. The selected backup became the current workspace; these details reflect the server response.</p><p><strong>Backup exported:</strong> {friendlyDate(restoreResult.backup_exported_at)} · <strong>Restored:</strong> {friendlyDate(restoreResult.restored_at)}</p><div className="workspace-backup-summary-grid"><CountList title="Previous workspace" summary={restoreResult.previous_workspace_summary} /><CountList title="Restored workspace" summary={restoreResult.restored_workspace_summary} /></div>{refreshWarning ? <p className="workspace-backup-refresh-warning" role="alert">{refreshWarning}</p> : null}</section> : null}
    <ConfirmationDialog cancelLabel="Keep current workspace" confirmDisabled={confirmationPhrase.trim() !== "RESTORE"} confirmLabel="Replace workspace" confirmTone="danger" description={<div className="workspace-restore-confirmation"><p>Every current resume version, application, and application activity will be replaced. The reviewed backup will become the complete workspace. This is not a merge.</p><p>This cannot be undone unless another workspace backup is available. Download a fresh workspace backup first if you may need the current data later.</p><div className="workspace-backup-summary-grid workspace-restore-comparison"><CountList title="Current workspace" summary={result?.current_workspace_summary || {}} /><CountList title="Reviewed backup" summary={result?.backup_summary || {}} /></div><label className="workspace-restore-phrase" htmlFor={confirmationInputId}>Type RESTORE to confirm<input id={confirmationInputId} value={confirmationPhrase} disabled={isRestoring} onChange={(event) => setConfirmationPhrase(event.target.value)} aria-describedby={`${confirmationInputId}-help`} /></label><p id={`${confirmationInputId}-help`}>This exact, case-sensitive phrase enables workspace replacement.</p></div>} isOpen={isConfirmationOpen} isProcessing={isRestoring} onCancel={closeConfirmation} onConfirm={restoreBackup} processingLabel="Replacing workspace..." title="Replace current workspace?" />
  </section>;
}
