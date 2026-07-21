// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadBlob } from "./downloadBlob.js";

describe("downloadBlob", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("clicks a temporary anchor and always cleans up", () => {
    const createObjectURL = vi.fn(() => "blob:export");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadBlob(new Blob(["data"]), "export.json");

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:export");
    expect(document.querySelector('a[download="export.json"]')).toBeNull();
    click.mockRestore();
  });

  it("cleans up if clicking fails", () => {
    vi.stubGlobal("URL", { createObjectURL: () => "blob:failure", revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => { throw new Error("blocked"); });

    expect(() => downloadBlob(new Blob(["data"]), "export.csv")).toThrow("blocked");
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:failure");
    expect(document.querySelector('a[download="export.csv"]')).toBeNull();
    click.mockRestore();
  });
});
