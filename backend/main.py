"""FastAPI application entry point. Run with: uv run uvicorn main:app --reload --port 8000"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routers import health

settings = get_settings()

app = FastAPI(title=settings.app_name, version=settings.app_version)

# Explicit allowlist (never "*") because the session cookie requires allow_credentials.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
