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
    vi.useRealTimers();
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

  it("shows a fixed confirmation for a successful direct status update and not for a failed update", async () => {
    const onTransitionApplicationStatus = vi.fn()
      .mockResolvedValueOnce({ ...applications[0], status: "Assessment" })
      .mockRejectedValueOnce(new Error("Could not update Cedar."));
    await act(async () => root.render(<PipelinePage applications={applications} error="" isLoading={false} onOpenDetails={vi.fn()} onTransitionApplicationStatus={onTransitionApplicationStatus} />));
    const triggers = [...container.querySelectorAll(".pipeline-status-trigger")];
    await act(async () => triggers[0].click());
    await act(async () => findMenuButton(container, "Assessment").click());
    expect(document.body.querySelector('[role="status"]').textContent).toBe("Northstar Analytics moved to Assessment.");
    await act(async () => triggers[1].click());
    await act(async () => findMenuButton(container, "Offer").click());
    expect(container.textContent).not.toContain("Cedar Labs moved to Offer.");
  });

  it("replaces confirmation text and protects the newer message from an old dismissal timer", async () => {
    vi.useFakeTimers();
    const onTransitionApplicationStatus = vi.fn().mockResolvedValue({});
    await act(async () => root.render(<PipelinePage applications={applications} error="" isLoading={false} onOpenDetails={vi.fn()} onTransitionApplicationStatus={onTransitionApplicationStatus} />));
    const triggers = [...container.querySelectorAll(".pipeline-status-trigger")];
    await act(async () => triggers[0].click());
    await act(async () => findMenuButton(container, "Assessment").click());
    await act(async () => vi.advanceTimersByTime(2000));
    await act(async () => triggers[1].click());
    await act(async () => findMenuButton(container, "Offer").click());
    expect(document.body.textContent).toContain("Cedar Labs moved to Offer.");
    await act(async () => vi.advanceTimersByTime(2500));
    expect(document.body.textContent).toContain("Cedar Labs moved to Offer.");
    await act(async () => vi.advanceTimersByTime(2000));
    expect(document.body.querySelector(".viewport-notification")).toBeNull();
  });

  it("keeps confirmation-required backward transitions intact", async () => {
    const onTransitionApplicationStatus = vi.fn().mockResolvedValue({});
    const applicationsWithHistory = [applications[0], { ...applications[1], furthest_stage: "Interview" }];
    await act(async () => root.render(<PipelinePage applications={applicationsWithHistory} error="" isLoading={false} onOpenDetails={vi.fn()} onTransitionApplicationStatus={onTransitionApplicationStatus} />));
    const interviewTrigger = [...container.querySelectorAll(".pipeline-card")]
      .find((card) => card.textContent.includes("Cedar Labs"))
      .querySelector(".pipeline-status-trigger");
    await act(async () => interviewTrigger.click());
    await act(async () => findMenuButton(container, "Applied").click());
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain("Move back to Applied?");
    const confirmButton = [...dialog.querySelectorAll("button")].find((button) => button.textContent === "Move back to Applied");
    await act(async () => confirmButton.click());
    expect(onTransitionApplicationStatus).toHaveBeenCalledWith(applicationsWithHistory[1], expect.objectContaining({ status: "Applied" }));
    expect(document.body.textContent).toContain("Cedar Labs moved to Applied.");
  });
});
