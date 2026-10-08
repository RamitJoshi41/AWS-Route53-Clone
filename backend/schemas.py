"""Pydantic request/response models (the API's JSON contract, separate from the ORM)."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from security import BCRYPT_MAX_PASSWORD_BYTES


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=150)
    password: str = Field(min_length=1)

    @field_validator("password")
    @classmethod
    def password_fits_bcrypt(cls, password: str) -> str:
        # Measured in UTF-8 bytes, not characters: bcrypt's limit is 72 bytes.
        if len(password.encode("utf-8")) > BCRYPT_MAX_PASSWORD_BYTES:
            raise ValueError(f"must be at most {BCRYPT_MAX_PASSWORD_BYTES} bytes")
        return password


class UserOut(BaseModel):
    """Public view of a user; never includes the password hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
