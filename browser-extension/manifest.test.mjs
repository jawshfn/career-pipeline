import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const extensionDirectory = new URL("./", import.meta.url);

test("manifest uses narrow click-initiated and local-backend permissions", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", extensionDirectory), "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.version, "0.3.0");
  assert.equal(manifest.name, "PursuitHQ Capture");
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
  assert.deepEqual(manifest.host_permissions, ["http://127.0.0.1:8000/*"]);
  assert.equal(manifest.host_permissions.includes("<all_urls>"), false);
  for (const permission of ["tabs", "storage", "clipboardRead", "clipboardWrite", "webRequest", "cookies", "history"]) {
    assert.equal(manifest.permissions.includes(permission), false);
  }
  assert.equal("optional_host_permissions" in manifest, false);
  assert.equal("background" in manifest, false);
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.equal(manifest.action.default_title, "Capture this job in PursuitHQ");
});

test("popup references only local extension assets", async () => {
  const popupHtml = await readFile(new URL("popup.html", extensionDirectory), "utf8");
  const popupModule = await readFile(new URL("popup.mjs", extensionDirectory), "utf8");

  assert.match(popupHtml, /href="popup\.css"/);
  assert.match(popupHtml, /src="popup\.mjs"/);
  assert.match(popupHtml, />PursuitHQ</u);
  assert.match(popupHtml, /<h1>Browser Capture<\/h1>/u);
  assert.doesNotMatch(popupHtml, /https?:\/\//i);
  assert.match(popupModule, /Requires the local PursuitHQ app/u);
  assert.match(popupModule, /Open in PursuitHQ/);
});
