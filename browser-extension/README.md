# Greenhouse Detector Feasibility Spike

This is an experimental local Chrome extension for testing whether a one-click browser snapshot can identify Greenhouse configuration that is unavailable to Career Pipeline's server-side discovery.

It is not connected to Career Pipeline and is not a finished product feature. It makes no Career Pipeline API request, sends no data, stores no data, and does not modify the page. Its only permissions are `activeTab` and `scripting`, which provide temporary access after you click the toolbar action.

## Load locally

1. Open `chrome://extensions` in Chrome.
2. Turn on Developer mode.
3. Select **Load unpacked**.
4. Choose this `browser-extension` directory.
5. Pin **Career Pipeline Greenhouse Detector** from the Extensions menu.
6. Open a job page, wait for it to finish loading, and click the extension once.

The popup reports whether one verified Greenhouse board and one supported job ID were detected. It inspects only the current page URL, specific structural attributes, and resource names already visible to the page at click time.

## Run tests

From the repository root:

```powershell
node --test browser-extension/detector.test.mjs browser-extension/manifest.test.mjs
```

No install step or extension-specific dependency is required.

## Remove afterward

Return to `chrome://extensions` and select **Remove** on the detector card.

## Decision gate

Continue to Phase 15.4b only if the existing server-supported QA page and at least two of the three previously unsupported QA pages are detected using this click-time snapshot. If fewer than two previously unsupported pages are detected, stop extension development rather than expanding permissions or collecting more page data.
