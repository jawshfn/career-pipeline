# Spreadsheet Import Manual QA

Use a local workspace unless the case says Demo. Use only the sanitized fixtures in the temporary QA directory.

## 1. File intake

Setup: `standard-headers.csv`. Steps: open Data → Import applications; select it with the picker, then repeat by dragging it onto the drop area. Expected: both paths parse locally and show the table-setup step; no raw-file upload occurs.

## 2. CSV parsing

Setup: `quoted-values.csv` and `custom-headers.csv`. Steps: open each, preview parsed data, select its header row, and inspect mapping suggestions. Expected: quoted commas/line breaks remain cell content; recognizable custom headings can be confirmed or changed.

## 3. XLSX parsing

Setup: `multi-worksheet.xlsx`, `native-dates.xlsx`, and `formulas.xlsx`. Steps: select each workbook, choose the populated worksheet, preview it, and review rows. Expected: worksheet choice is available; native dates and formula results are usable in review.

External-fixture check: the temporary manifest records four exotic cases the current fixture-authoring runtime could not generate faithfully: XLSX 1904 dates, hyperlinks with rich text, formatting-inflated ranges, and merged-cell conflicts. Supply independently created fixtures for those checks; do not mark them complete from this fixture pack.

## 4. Table setup

Setup: `headerless.csv`, `1000-rows.csv`, `1001-rows.csv`. Steps: choose Headerless for the first file; choose a header for the others. Expected: row 1 becomes data for headerless input; formatting-only rows do not count; 1,000 data rows is accepted and 1,001 is blocked.

## 5. Mapping

Setup: `custom-headers.csv`. Steps: map Company and Role, map one normal destination, attempt to map it again, map two columns to Append to Personal Notes, then confirm. Expected: Company/Role are required; a normal destination is single-use; append is repeatable; confirmation is required.

## 6. Shared-value resolution

Setup: `unknown-categories.csv` and `ambiguous-dates.csv`. Steps: confirm mapping and open value resolution. Choose supported categorical values and a date order. Expected: each decision applies to affected included rows; unresolved included rows block import.

## 7. Row review

Setup: `saved-with-date-applied.csv` and `terminal-history.csv`. Steps: review the flagged row, clear Date Applied on Saved, and supply the required terminal-history decision. Expected: row editing is available; unresolved rows must be fixed or excluded before import.

## 8. Duplicate decisions

Setup: first import `standard-headers.csv`; then use `existing-duplicates.csv` and `in-batch-duplicates.csv`. Steps: review duplicate rows. Expected: exact duplicates start skipped; Import as new permits an explicit extra record; possible duplicates require Keep in import or Exclude from import; in-batch comparisons work too.

## 9. Long Job Links

Setup: `long-job-link.csv`. Steps: import the row and open the created application. Expected: the complete fictional 2,048-character `example.com` link is retained.

## 10. Submission and rollback

Setup: a valid two-row file, then a two-row file with one unresolved/invalid row. Steps: import the valid batch; attempt the invalid batch. Expected: success creates the approved rows; a rejected batch creates none.

## 11. Demo mode

Setup: start with `VITE_APP_MODE=demo`. Steps: perform a small valid import and reload. Expected: the same reviewed import flow works with fictional in-memory data; imported data resets on reload and no FastAPI request is required.

## 12. Templates

Setup: Data → Templates. Steps: download Minimal, Common, and a Custom template in CSV and Excel formats. Expected: downloads are generated in the browser and headings match the selected fields.

## 13. Data-tab persistence

Setup: a parsed import with a confirmed mapping. Steps: switch among Data tabs and return. Expected: the active workflow remains available and unsaved-work protection is respected.

## 14. Export → re-import

Setup: a small fictional local workspace. Steps: export CSV and XLSX, then bring each back through Import. Expected: both exports parse; fields can be mapped and reviewed before any new record is created.

## 15. Accessibility

Setup: any parsed fixture. Steps: keyboard through upload, worksheet/table controls, mapping, preview dialog, resolution dialog, review table, and confirmation. Expected: visible focus, named controls, dialog focus, table labels, and keyboard actions are usable.

## 16. Responsive behavior

Setup: any parsed fixture. Steps: test narrow and wide browser widths through mapping, preview, and review. Expected: controls remain reachable, tables scroll horizontally where needed, and actions remain understandable.

## 17. Completion actions

Setup: successful import. Steps: confirm completion, open Applications, then return to Data. Expected: created records are visible; source spreadsheet is unchanged; Export & backup and Restore workspace remain distinct operations.
