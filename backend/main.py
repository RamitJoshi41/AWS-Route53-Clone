"""FastAPI application entry point. Run with: uv run uvicorn main:app --reload --port 8000"""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings
from routers import auth, health

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


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    """Turn FastAPI's default 422 (a list of error objects) into our standard
    400 {"detail": "<field>: <message>"}, reporting the first problem found."""
    error = exc.errors()[0]
    if error["type"] == "json_invalid":
        field = "body"
    else:
        # loc looks like ("body", "password"); drop the "where" part, keep the field path.
        field = ".".join(str(part) for part in error["loc"][1:]) or str(error["loc"][0])
    message = error["msg"].removeprefix("Value error, ")
    return JSONResponse(status_code=400, content={"detail": f"{field}: {message}"})


app.include_router(health.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
