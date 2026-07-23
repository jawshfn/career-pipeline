# PursuitHQ Capture

PursuitHQ Capture is an experimental, locally loaded Chrome companion. A user click inspects a supported active job page and, after confirmation, opens an editable local PursuitHQ review. It is not Chrome Web Store distributed and never saves an application automatically.

## Supported providers and layouts

| Provider | Supported page/layout | Transfer | Important limitation |
| --- | --- | --- | --- |
| Greenhouse | Verified Greenhouse identifiers | Identifier handoff to structured import | Only verified jobs. |
| Indeed | One confidently detected current job | Cleaned text through a one-time local token | Unsupported or ambiguous layouts stop. |
| LinkedIn | Standalone `/jobs/view/{id}` and selected current-job panels | Cleaned text token | One current job only. |
| ZipRecruiter | Signed-in selected-job `/jobs-search` pane | Cleaned text token | No standalone or signed-out layouts. |
| Handshake | Authenticated `/jobs/<id>` and selected `/job-search/<id>` panel | Cleaned text token | Selected panel must be unambiguous. |

## Local setup

1. Start the local FastAPI backend and Vite frontend.
2. Open `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select this `browser-extension` directory, pin **PursuitHQ Capture**, open a supported job, and click the extension.
4. Confirm **Open in PursuitHQ** to open a new local review tab.

The target is `http://localhost:5173/`; the local backend host permission is limited to `http://127.0.0.1:8000/*`.

## Capture flow and permissions

Greenhouse uses verified identifiers with the existing backend importer. Other supported providers transfer the original URL and bounded cleaned visible job text to an in-memory local token that expires after two minutes and is consumed once. No provider data is saved unless the user reviews and explicitly saves it.

Permissions are limited to `activeTab`, `scripting`, and the narrow local backend host permission. The extension makes no job-board network requests, has no persistent extension storage, no telemetry, no clipboard access, and no broad host permissions. It does not read cookies, storage, authentication tokens, or network responses.

Handshake may activate only a bounded job-description **More** control during a user-initiated capture when necessary. It never activates application, save, share, withdrawal, or unrelated controls.

## Testing and removal

```powershell
node --test browser-extension/*.test.mjs
```

Reload the unpacked extension from `chrome://extensions` after extension changes. To remove it, select **Remove** on its extension card.

## Limitations

The local full-stack app must be running. There is no generic page or selected-text capture, no generic scraper, and no automatic application submission. Unsupported, ambiguous, or changed provider layouts are intentionally rejected.
