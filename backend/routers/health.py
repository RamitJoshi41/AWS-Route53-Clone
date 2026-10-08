"""Health-check endpoint used by the frontend (and humans) to verify the API and DB are up."""

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from config import get_settings
from database import get_db

router = APIRouter(tags=["health"])


# Plain `def` (not async): sync SQLAlchemy would block the event loop, so FastAPI
# runs this in its threadpool instead.
@router.get("/health")
def health(db: Session = Depends(get_db)) -> JSONResponse:
    version = get_settings().app_version
    try:
        db.execute(text("SELECT 1"))
    except SQLAlchemyError:
        return JSONResponse(
            status_code=503,
            content={"status": "error", "database": "error", "version": version},
        )
    return JSONResponse(content={"status": "ok", "database": "ok", "version": version})
