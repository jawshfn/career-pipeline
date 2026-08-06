export function getDefaultResumeVersionId(resumeVersions = []) {
  const defaultResume = resumeVersions.find((resumeVersion) => resumeVersion.is_active && resumeVersion.is_default);
  return defaultResume ? String(defaultResume.id) : "";
}

export function getDefaultResumeVersion(resumeVersions = []) {
  const id = getDefaultResumeVersionId(resumeVersions);
  return resumeVersions.find((resumeVersion) => String(resumeVersion.id) === id) || null;
}
