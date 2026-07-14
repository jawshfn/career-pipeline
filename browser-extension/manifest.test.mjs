import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const extensionDirectory = new URL("./", import.meta.url);

test("manifest uses narrow click-initiated and local-backend permissions", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", extensionDirectory), "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
  assert.deepEqual(manifest.host_permissions, ["http://127.0.0.1:8000/*"]);
  assert.equal(manifest.host_permissions.includes("<all_urls>"), false);
  for (const permission of ["tabs", "storage", "clipboardRead", "clipboardWrite", "webRequest", "cookies", "history"]) {
    assert.equal(manifest.permissions.includes(permission), false);
  }
  assert.equal("optional_host_permissions" in manifest, false);
  assert.equal("background" in manifest, false);
  assert.equal(manifest.action.default_popup, "popup.html");
});

test("popup references only local extension assets", async () => {
  const popupHtml = await readFile(new URL("popup.html", extensionDirectory), "utf8");

  assert.match(popupHtml, /href="popup\.css"/);
  assert.match(popupHtml, /src="popup\.mjs"/);
  assert.doesNotMatch(popupHtml, /https?:\/\//i);
});
