import * as realApplicationActivitiesApi from "../api/applicationActivitiesApi.js";
import * as demoApplicationActivitiesApi from "../demo/demoApplicationActivitiesApi.js";
import { isDemoMode } from "../config/runtimeMode.js";

const applicationActivitiesApi = isDemoMode()
  ? demoApplicationActivitiesApi
  : realApplicationActivitiesApi;

export const {
  createApplicationActivity,
  deleteApplicationActivity,
  getApplicationActivities,
  updateApplicationActivity,
} = applicationActivitiesApi;
