"""API errors that carry a machine-readable code next to the message.

Most errors are a plain {"detail": "..."}. A few also send "code", for the frontend
to tell them apart without parsing the message: the console's error banner shows
a specific line for them instead of "Please try again later."
"""

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

# The record set (name + type) already exists. The console says
# "A record with the specified name already exists."
RECORD_SET_ALREADY_EXISTS = "RecordSetAlreadyExists"


class CodedHTTPException(HTTPException):
    def __init__(self, status_code: int, detail: str, code: str) -> None:
        super().__init__(status_code, detail)
        self.code = code


async def coded_http_exception_handler(_request: Request, exc: CodedHTTPException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail, "code": exc.code})
