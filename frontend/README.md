# Career Pipeline Frontend

This is the React frontend for Career Pipeline. It includes the Applications page, quick-add application flow, applications table, and Pipeline page for viewing applications by status and updating status.

Dashboard metrics, red flags, follow-up queue, authentication, deployment, and browser extension features are not part of this phase yet.

## Setup

From the repository root:

```powershell
cd frontend
npm install
```

## Run the Dev Server

Start the FastAPI backend first:

```powershell
cd backend
python -m uvicorn app.main:app --reload
```

Then start the frontend:

```powershell
cd frontend
npm run dev
```

The frontend API layer expects the backend at:

```text
http://127.0.0.1:8000
```

## Build

```powershell
cd frontend
npm run build
```

The build does not require the backend server to be running.
