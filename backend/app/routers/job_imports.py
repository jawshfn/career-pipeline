from dataclasses import asdict

from fastapi import APIRouter, HTTPException

from ..schemas import (
    CustomGreenhouseImportRequest,
    GreenhouseImportRequest,
    GreenhouseJobImportRead,
    LeverImportRequest,
    LeverJobImportRead,
)
from ..services.greenhouse import GreenhouseImportError, fetch_greenhouse_job
from ..services.greenhouse_discovery import GreenhouseDiscoveryError, discover_and_fetch_custom_greenhouse_job
from ..services.lever import LeverImportError, fetch_lever_job

router = APIRouter(prefix="/api/job-imports", tags=["job imports"])


@router.post("/greenhouse", response_model=GreenhouseJobImportRead)
async def import_greenhouse_job(payload: GreenhouseImportRequest) -> dict:
    try:
        imported_job = await fetch_greenhouse_job(payload.board_token, payload.job_id)
    except GreenhouseImportError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from error

    return asdict(imported_job)


@router.post("/greenhouse/custom", response_model=GreenhouseJobImportRead)
async def import_custom_greenhouse_job(payload: CustomGreenhouseImportRequest) -> dict:
    try:
        imported_job = await discover_and_fetch_custom_greenhouse_job(payload.job_url)
    except GreenhouseDiscoveryError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from None
    except GreenhouseImportError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from None

    return asdict(imported_job)


@router.post("/lever", response_model=LeverJobImportRead)
async def import_lever_job(payload: LeverImportRequest) -> dict:
    try:
        imported_job = await fetch_lever_job(payload.instance, payload.site, payload.posting_id)
    except LeverImportError as error:
        raise HTTPException(status_code=error.status_code, detail=error.message) from None

    return asdict(imported_job)
