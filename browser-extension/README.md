# PursuitHQ Capture

This experimental, locally loaded Chrome extension supports verified Greenhouse identifier capture and click-initiated Indeed, LinkedIn, ZipRecruiter, and standalone Handshake text capture into an editable local PursuitHQ review. Handshake support is limited to authenticated `https://app.joinhandshake.com/jobs/<positive numeric job ID>` pages, with optional query parameters; Handshake search-result side panels are not yet supported.

It is not a Chrome Web Store feature. It makes no request to the employer page or a remote PursuitHQ service, sends no telemetry, and stores no persistent data. Most captures only read the active page. On some standalone Handshake postings, the complete description is not mounted until its bounded job-description `More` control is activated; during an explicitly user-initiated capture, PursuitHQ may activate only that control. It does not activate Quick apply, Save, Share, Withdraw application, location expansion, or unrelated controls, and it never submits or saves anything on Handshake. It does not read cookies, storage, authentication tokens, or network responses. Its permissions are `activeTab`, `scripting`, and a narrow local-backend host permission for `http://127.0.0.1:8000/*`.

## Load locally

1. Open `chrome://extensions` in Chrome.
2. Turn on Developer mode.
3. Select **Load unpacked**.
4. Choose this `browser-extension` directory.
5. Pin **PursuitHQ Capture** from the Extensions menu.
6. Start the local app in two terminals:

   ```powershell
   cd backend
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
   ```

   ```powershell
   cd frontend
   npm run dev
   ```

7. Open a job page, wait for it to finish loading, and click the extension once.

The popup reports whether one verified Greenhouse board and one supported job ID were detected. On a successful detection, select **Open in PursuitHQ**. The extension opens only `http://localhost:5173/` with a small versioned URL-fragment payload containing the provider, board token, job ID, and original job URL. PursuitHQ removes the fragment immediately, validates the data again, and calls its existing backend integration with the official Greenhouse Job Board API.

The app opens **Add Job** -> **Paste Job Link**, starts an import into the existing editable review, preserves the original employer URL as Job Link, and defaults Source to Company Website. Source remains editable, and no application is saved automatically.

For Indeed, LinkedIn, ZipRecruiter, and Handshake, the helper reads only the current job after the user clicks the extension. It sends bounded cleaned text only after **Open in PursuitHQ** is selected. The local backend keeps that text in memory for at most two minutes and consumes it once into **Add Job** -> **Paste Job Text**. LinkedIn supports search-results current-job side panels and standalone `/jobs/view/{id}` pages. ZipRecruiter targets signed-in `/jobs-search` pages with exactly one `lk` selected-job key. Handshake supports standalone authenticated `/jobs/<positive numeric ID>` pages, preserves the original Handshake job link, sets Source to Handshake, and opens editable review; it does not infer PursuitHQ status from an “Applied” banner. The extension makes no request to job boards and has no job-board host permissions. Captures are not written to SQLite unless the user reviews and explicitly saves.

The GitHub Pages demo does not support browser-assisted imports. Run the local full-stack version instead.

## Run tests

From the repository root:

```powershell
node --test browser-extension/*.test.mjs
```

No install step or extension-specific dependency is required. After changing extension files, return to `chrome://extensions` and select **Reload** on the unpacked extension card.

## Current Limitations

- The local full-stack app must be running; the target is fixed to `http://localhost:5173/`.
- Each handoff intentionally opens a new local PursuitHQ tab so existing unsaved work is not replaced.
- The extension does not request the broader `tabs` or host permissions needed to search for and reuse arbitrary tabs.
- Indeed and LinkedIn capture each support one confidently detected current job only. LinkedIn supports search-results current-job side panels and standalone `/jobs/view/{id}` pages. ZipRecruiter support is limited to the signed-in selected-job `/jobs-search` detail pane; standalone and signed-out ZipRecruiter layouts are not supported. Handshake supports standalone authenticated `/jobs/<positive numeric ID>` pages only; search-result side panels, employer administration routes, and other Handshake layouts are unsupported. Generic pages and selected text are not supported.
- Greenhouse capture remains limited to verified Greenhouse jobs.
- The helper is experimental and is not distributed through the Chrome Web Store.

## Remove afterward

Return to `chrome://extensions` and select **Remove** on the detector card.

## Privacy boundary

Greenhouse evidence remains in the popup only and is not transferred to PursuitHQ. Indeed, LinkedIn, ZipRecruiter, and Handshake transfer contains only the original job URL and cleaned visible job text; it never contains HTML, form values, cookies, headers, screenshots, browsing history, or storage data. A user-initiated Handshake capture may use the narrow job-description expansion exception described above when needed. The extension has no background script, persistent content script, storage, clipboard access, broad host permissions, or employer-page network activity.
