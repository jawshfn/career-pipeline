// @vitest-environment jsdom

import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import PipelinePage from "./PipelinePage.jsx";

const applications = [
  { company_name: "Northstar Analytics", id: 1, role_title: "Platform Engineer", status: "Applied" },
  { company_name: "Cedar Labs", id: 2, role_title: "Product Designer", status: "Interview" },
];

function deferred() {
  let reject;
  let resolve;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, reject, resolve };
}

function findMenuButton(container, label) {
  return [...container.querySelectorAll(".pipeline-status-menu button")]
    .find((button) => button.textContent === label);
}

describe("PipelinePage status updates", () => {
  let container;
  let root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("keeps concurrent card updates and their feedback scoped to each application", async () => {
    const firstUpdate = deferred();
    const secondUpdate = deferred();
    const onTransitionApplicationStatus = vi.fn((application) => (
      application.id === 1 ? firstUpdate.promise : secondUpdate.promise
    ));

    await act(async () => {
      root.render(
        <PipelinePage
          applications={applications}
          error=""
          isLoading={false}
          onOpenDetails={vi.fn()}
          onTransitionApplicationStatus={onTransitionApplicationStatus}
        />,
      );
    });

    const triggers = [...container.querySelectorAll(".pipeline-status-trigger")];
    await act(async () => triggers[0].click());
    await act(async () => findMenuButton(container, "Assessment").click());

    await act(async () => triggers[1].click());
    await act(async () => findMenuButton(container, "Offer").click());

    expect(onTransitionApplicationStatus).toHaveBeenNthCalledWith(1, applications[0], { status: "Assessment" });
    expect(onTransitionApplicationStatus).toHaveBeenNthCalledWith(2, applications[1], { status: "Offer" });
    expect(triggers[0].disabled).toBe(true);
    expect(triggers[1].disabled).toBe(true);
    expect(container.textContent).toContain("Saving...");

    await act(async () => firstUpdate.reject(new Error("Northstar status update failed.")));

    const northstarCard = [...container.querySelectorAll(".pipeline-card")]
      .find((card) => card.textContent.includes("Northstar Analytics"));
    const cedarCard = [...container.querySelectorAll(".pipeline-card")]
      .find((card) => card.textContent.includes("Cedar Labs"));
    expect(northstarCard.querySelector('[role="alert"]').textContent).toContain("Northstar status update failed.");
    expect(cedarCard.querySelector('[role="alert"]')).toBeNull();
    expect(triggers[0].disabled).toBe(false);
    expect(triggers[1].disabled).toBe(true);

    await act(async () => secondUpdate.resolve({ ...applications[1], status: "Offer" }));

    expect(triggers[1].disabled).toBe(false);
    expect(northstarCard.querySelector('[role="alert"]').textContent).toContain("Northstar status update failed.");
  });
});
