const SEEDED_FILE = {
  id: 1,
  resume_version_id: 1,
  original_filename: "fictional-software-engineering-resume.pdf",
  media_type: "application/pdf",
  size_bytes: 1054,
  sha256: "45f0f4f8e0b87211184aedff4e580bd506a8bd3f9922bb3cd3ea9600c2aa2f10",
  created_at: "2026-07-01T14:30:00.000Z",
  updated_at: "2026-07-01T14:30:00.000Z",
  seeded_asset: "demo/fictional-software-engineering-resume.pdf",
};

let contents = new Map();

export const SEEDED_DEMO_RESUME_FILE = Object.freeze({ ...SEEDED_FILE });

export function resetDemoResumeFileContents() {
  contents = new Map();
}

export function deleteDemoResumeFileContent(fileId) {
  contents.delete(Number(fileId));
}

export function setDemoResumeFileContent(fileId, content) {
  contents.set(Number(fileId), content);
}

export async function getDemoResumeFileContent(record) {
  const cached = contents.get(Number(record.id));
  if (cached) return cached;
  if (!record.seeded_asset) throw new Error("Resume PDF content is unavailable.");

  let response;
  try {
    response = await fetch(`${import.meta.env.BASE_URL}${record.seeded_asset}`);
  } catch {
    throw new Error("Could not load the fictional demo PDF.");
  }
  if (!response.ok) throw new Error("Could not load the fictional demo PDF.");
  const blob = new Blob([await response.arrayBuffer()], { type: "application/pdf" });
  contents.set(Number(record.id), blob);
  return blob;
}
