# PursuitHQ Frontend

The React/Vite frontend provides the local workspace and the static GitHub Pages demo.

## Pages

- Reminders
- Dashboard
- Add Job
- Applications
- Status Board
- Resumes
- Help

Application Detail includes Overview, Follow-up, Job Details, Job Posting, AI Brief, Resume & Prep, Red Flags, and Activity.

## Runtime modes

### Local mode

Local mode talks to FastAPI, uses persisted local workspace data, and supports Browser Capture and workspace restore. It includes Job Intelligence Brief access by default through the deployed PursuitHQ AI gateway; users do not run the gateway locally or configure Gemini, Cloudflare, Wrangler, or an AI URL.

### Demo mode

Demo mode uses fictional in-memory data, resets on reload, and does not call FastAPI. Browser Capture and restore are unavailable. It also uses the deployed AI gateway, includes five AI-ready fictional applications, and never generates a brief automatically.

## Environment

- `VITE_APP_MODE=demo` enables demo mode; the default is local mode.
- `VITE_BASE_PATH` configures the Vite deployment base path.
- `VITE_AI_GATEWAY_URL` is an optional contributor/operator override for a different gateway; leave it unset for the committed deployed PursuitHQ gateway used by both runtime modes.

## Scripts

```powershell
cd frontend
npm install
npm run dev
npm test
npm run build
npm run preview
```
