from dataclasses import asdict

from fastapi import APIRouter, HTTPException

from ..schemas import GreenhouseImportRequest, GreenhouseJobImportRead
from ..services.greenhouse import GreenhouseImportError, fetch_greenhouse_job

router = APIRouter(prefix="/api/job-imports", tags=["job imports"])


@router.post("/greenhouse", response_model=GreenhouseJobImportRead)
async def import_greenhouse_job(payload: GreenhouseImportRequest) -> dict:
    try:
        imported_job = await fetch_greenhouse_job(payload.board_token, payload.job_id)
    except GreenhouseImportError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error

    return asdict(imported_job)
