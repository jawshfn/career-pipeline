import { isArchivedApplication } from "../../utils/applicationReviewRows.js";

export const ONBOARDING_VERSION = "v1";
export const ONBOARDING_DISMISSED_VALUE = "dismissed";

export function getOnboardingStorageKey(isDemoMode) {
  return `pursuithq:onboarding:${isDemoMode ? "demo" : "local"}:${ONBOARDING_VERSION}`;
}

export function getStoredOnboardingDismissal(isDemoMode, storage = typeof window === "undefined" ? null : window.localStorage) {
  try {
    return storage?.getItem(getOnboardingStorageKey(isDemoMode)) === ONBOARDING_DISMISSED_VALUE;
  } catch {
    return false;
  }
}

export function storeOnboardingDismissal(isDemoMode, storage = typeof window === "undefined" ? null : window.localStorage) {
  try {
    storage?.setItem(getOnboardingStorageKey(isDemoMode), ONBOARDING_DISMISSED_VALUE);
  } catch {
    // Local storage is optional: the panel remains usable when it is unavailable.
  }
}

export function getOnboardingState({ applications = [], isDemoMode = false, isDismissed = false } = {}) {
  if (isDismissed) return "dismissed";
  if (isDemoMode) return "getting-started";

  const activeApplications = applications.filter((application) => !isArchivedApplication(application));
  if (applications.length === 0) return "empty";
  if (activeApplications.length !== applications.length || activeApplications.length !== 1) return "established";

  const [application] = activeApplications;
  const hasFollowThrough = Boolean(
    application.next_action?.trim()
    || application.follow_up_date
    || application.resume_version_id,
  );
  return hasFollowThrough ? "established" : "getting-started";
}
