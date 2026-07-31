import React, { useMemo, useRef, useState } from "react";

import { IMPORT_FIELD_DEFINITIONS, IMPORT_FIELD_BY_KEY, IMPORT_TEMPLATE_PRESETS, getImportFieldsByKeys } from "../import/importFieldDefinitions.js";
import { createCsvTemplateBlob, createExcelTemplateBlob, createTabSeparatedHeader, IMPORT_TEMPLATE_CSV_FILENAME, IMPORT_TEMPLATE_XLSX_FILENAME } from "../import/importTemplate.js";
import { downloadBlob } from "../utils/downloadBlob.js";

const PRESET_OPTIONS = [
  { key: "minimal", label: "Minimal", description: "Company and Role" },
  { key: "common", label: "Common", description: "Common tracking columns" },
  { key: "custom", label: "Custom", description: "Choose and arrange columns" },
];

export async function copyImportHeaderToClipboard(header) {
  if (!globalThis.navigator?.clipboard?.writeText) {
    return { copied: false, message: "Could not copy automatically. Select and copy the header row below." };
  }
  try {
    await globalThis.navigator.clipboard.writeText(header);
    return { copied: true, message: "Header row copied." };
  } catch {
    return { copied: false, message: "Could not copy automatically. Select and copy the header row below." };
  }
}

export default function SpreadsheetImportPage({
  onNavigate = () => {},
  embedded = false,
  createCsvTemplate = createCsvTemplateBlob,
  createExcelTemplate = createExcelTemplateBlob,
  download = downloadBlob,
}) {
  const [selectedKeys, setSelectedKeys] = useState(() => [...IMPORT_TEMPLATE_PRESETS.minimal]);
  const [activePreset, setActivePreset] = useState("minimal");
  const [copyMessage, setCopyMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [activeDownload, setActiveDownload] = useState("");
  const downloadInFlightRef = useRef(false);
  const selectedFields = useMemo(() => getImportFieldsByKeys(selectedKeys), [selectedKeys]);
  const headerRow = useMemo(() => createTabSeparatedHeader(selectedKeys), [selectedKeys]);

  function selectPreset(preset) {
    setSelectedKeys([...IMPORT_TEMPLATE_PRESETS[preset]]);
    setActivePreset(preset);
    setCopyMessage("");
    setActionError("");
  }

  function updateSelection(key, isSelected) {
    const field = IMPORT_FIELD_BY_KEY.get(key);
    if (!field || field.required) return;
    setSelectedKeys((current) => isSelected ? [...current, key] : current.filter((selectedKey) => selectedKey !== key));
    setActivePreset("custom");
    setCopyMessage("");
    setActionError("");
  }

  function moveField(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= selectedKeys.length) return;
    setSelectedKeys((current) => {
      const next = [...current];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setActivePreset("custom");
  }

  function removeField(key) {
    if (IMPORT_FIELD_BY_KEY.get(key)?.required) return;
    updateSelection(key, false);
  }

  async function handleCopy() {
    setActionError("");
    const result = await copyImportHeaderToClipboard(headerRow);
    setCopyMessage(result.message);
  }

  async function handleDownload(kind) {
    if (downloadInFlightRef.current) return;
    downloadInFlightRef.current = true;
    setActiveDownload(kind);
    setActionError("");
    try {
      const blob = kind === "csv" ? await createCsvTemplate(selectedKeys) : await createExcelTemplate(selectedKeys);
      download(blob, kind === "csv" ? IMPORT_TEMPLATE_CSV_FILENAME : IMPORT_TEMPLATE_XLSX_FILENAME);
    } catch {
      setActionError(kind === "csv" ? "Could not download the CSV template." : "Could not download the Excel template.");
    } finally {
      downloadInFlightRef.current = false;
      setActiveDownload("");
    }
  }

  return (
    <div className="spreadsheet-import-page">
      {!embedded ? <header className="page-header spreadsheet-import-header">
        <div>
          <p className="eyebrow">Spreadsheet import</p>
          <h2>Prepare your spreadsheet</h2>
          <p>Build a header row that matches the columns you already track. Company and Role are required; all other columns are optional.</p>
        </div>
      </header> : null}

      <section className="panel spreadsheet-import-privacy" aria-label="Local privacy">
        <strong>Template generation stays in your browser.</strong>
        <span>No spreadsheet or application data is uploaded from this page.</span>
      </section>

      <section className="panel spreadsheet-import-builder" aria-labelledby="template-builder-heading">
        <div className="section-heading"><h3 id="template-builder-heading">Build your template</h3><p>Pick a starting point, then choose and order the spreadsheet columns.</p></div>
        <fieldset className="spreadsheet-import-presets">
          <legend>Template preset</legend>
          <div className="spreadsheet-import-preset-options">
            {PRESET_OPTIONS.map((preset) => <button key={preset.key} className={`spreadsheet-import-preset ${activePreset === preset.key ? "is-active" : ""}`} type="button" aria-pressed={activePreset === preset.key} onClick={() => selectPreset(preset.key)}><span>{preset.label}</span><small>{preset.description}</small></button>)}
          </div>
        </fieldset>

        <div className="spreadsheet-import-columns">
          <section className="spreadsheet-import-available" aria-labelledby="available-import-fields-heading">
            <h3 id="available-import-fields-heading">Available fields</h3>
            <p>Add the optional fields that appear in your spreadsheet.</p>
            <div className="spreadsheet-import-field-options">
              {IMPORT_FIELD_DEFINITIONS.filter((field) => !field.required).map((field) => <label key={field.key} className="spreadsheet-import-field-option"><input checked={selectedKeys.includes(field.key)} type="checkbox" onChange={(event) => updateSelection(field.key, event.target.checked)} /><span><strong>{field.label}</strong>{field.description ? <small>{field.description}</small> : null}</span></label>)}
            </div>
          </section>

          <section className="spreadsheet-import-selected" aria-labelledby="selected-import-columns-heading">
            <h3 id="selected-import-columns-heading">Selected columns</h3>
            <ol>
              {selectedFields.map((field, index) => <li key={field.key}><div><strong>{field.label}</strong>{field.required ? <span className="spreadsheet-import-required">Required</span> : null}</div><div className="spreadsheet-import-column-actions"><button type="button" className="quiet-button" aria-label={`Move ${field.label} up`} disabled={index === 0} onClick={() => moveField(index, -1)}>Move up</button><button type="button" className="quiet-button" aria-label={`Move ${field.label} down`} disabled={index === selectedFields.length - 1} onClick={() => moveField(index, 1)}>Move down</button>{!field.required ? <button type="button" className="quiet-danger-button" aria-label={`Remove ${field.label}`} onClick={() => removeField(field.key)}>Remove</button> : null}</div></li>)}
            </ol>
          </section>
        </div>
      </section>

      <section className="panel spreadsheet-import-preview" aria-labelledby="header-preview-heading">
        <div className="section-heading"><h3 id="header-preview-heading">Header preview</h3><p>Copy this tab-separated row into Excel or Google Sheets, or download an empty template.</p></div>
        <textarea aria-label="Tab-separated header preview" readOnly rows={Math.max(2, Math.ceil(headerRow.length / 70))} value={headerRow} />
        {copyMessage ? <p className="spreadsheet-import-message" role="status">{copyMessage}</p> : null}
        {actionError ? <p className="spreadsheet-import-error" role="alert">{actionError}</p> : null}
        <div className="form-actions spreadsheet-import-actions"><button type="button" onClick={handleCopy}>Copy header row</button><button className="secondary-button" type="button" disabled={Boolean(activeDownload)} onClick={() => handleDownload("csv")}>{activeDownload === "csv" ? "Preparing CSV..." : "Download CSV template"}</button><button className="secondary-button" type="button" disabled={Boolean(activeDownload)} onClick={() => handleDownload("xlsx")}>{activeDownload === "xlsx" ? "Preparing Excel..." : "Download Excel template"}</button></div>
      </section>

      {!embedded ? <div className="spreadsheet-import-back"><button className="secondary-button" type="button" onClick={() => onNavigate("support")}>Back to Help</button></div> : null}
    </div>
  );
}
