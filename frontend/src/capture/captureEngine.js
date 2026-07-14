import {
  createCaptureResultFromReviewState,
} from "./captureContract.js";
import { buildSmartCaptureReviewState } from "../utils/jobTextExtraction.js";

export function buildCaptureResult(captureData) {
  return createCaptureResultFromReviewState(buildSmartCaptureReviewState(captureData));
}

export { captureResultToReviewState } from "./captureContract.js";
