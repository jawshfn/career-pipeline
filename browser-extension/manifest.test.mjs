import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const extensionDirectory = new URL("./", import.meta.url);

test("manifest uses only the two click-initiated permissions", async () => {
  const manifest = JSON.parse(await readFile(new URL("manifest.json", extensionDirectory), "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "scripting"]);
  assert.equal("host_permissions" in manifest, false);
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
