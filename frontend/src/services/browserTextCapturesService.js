import { consumeBrowserTextCapture } from "../api/browserTextCapturesApi.js";

const consumptionPromises = new Map();

export function consumeBrowserTextCaptureOnce(captureToken) {
  if (consumptionPromises.has(captureToken)) {
    return consumptionPromises.get(captureToken);
  }

  const promise = consumeBrowserTextCapture(captureToken);
  consumptionPromises.set(captureToken, promise);
  return promise;
}

export function resetBrowserTextCaptureConsumptionCacheForTests() {
  consumptionPromises.clear();
}
