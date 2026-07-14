# Greenhouse Detector And Local Capture Bridge

This experimental, locally loaded Chrome extension detects one verified Greenhouse board and job ID from the page you click, then can open an editable Career Pipeline review in the local full-stack app. Phase 15.4a established that browser-side Greenhouse discovery is feasible for career sites where server-side discovery cannot observe the needed configuration.

It is not a Chrome Web Store feature. It makes no network request, sends no telemetry, stores no data, and does not modify the employer page. Its only permissions are `activeTab` and `scripting`, which provide temporary access after you click the toolbar action.

## Load locally

1. Open `chrome://extensions` in Chrome.
2. Turn on Developer mode.
3. Select **Load unpacked**.
4. Choose this `browser-extension` directory.
5. Pin **Career Pipeline Greenhouse Detector** from the Extensions menu.
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

The popup reports whether one verified Greenhouse board and one supported job ID were detected. On a successful detection, select **Open in Career Pipeline**. The extension opens only `http://localhost:5173/` with a small versioned URL-fragment payload containing the provider, board token, job ID, and original job URL. Career Pipeline removes the fragment immediately, validates the data again, and calls its existing backend integration with the official Greenhouse Job Board API.

The app opens **Add Job** -> **Paste Job Link**, starts an import into the existing editable review, preserves the original employer URL as Job Link, and defaults Source to Company Website. Source remains editable, and no application is saved automatically.

The GitHub Pages demo does not support browser-assisted imports. Run the local full-stack version instead.

## Run tests

From the repository root:

```powershell
node --test browser-extension/*.test.mjs
```

No install step or extension-specific dependency is required. After changing extension files, return to `chrome://extensions` and select **Reload** on the unpacked extension card.

## Current Limitations

- The local full-stack app must be running; the target is fixed to `http://localhost:5173/`.
- Each handoff intentionally opens a new local Career Pipeline tab so existing unsaved work is not replaced.
- The extension does not request the broader `tabs` or host permissions needed to search for and reuse arbitrary tabs.
- Only verified Greenhouse jobs are supported.
- The helper is experimental and is not distributed through the Chrome Web Store.

## Remove afterward

Return to `chrome://extensions` and select **Remove** on the detector card.

## Privacy boundary

The capture payload never contains page HTML, page text, form values, resource lists, cookies, headers, screenshots, browsing history, or storage data. Greenhouse evidence remains in the popup only and is not transferred to Career Pipeline. The extension has no host permissions, background script, content script, storage, or network activity.
