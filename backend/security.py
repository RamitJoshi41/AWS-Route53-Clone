"""Password hashing and session-token helpers.

bcrypt works on bytes, while the rest of the app (and the DB) deals in str. All the
encoding/decoding happens here so no other module has to think about it.
"""

import hashlib
import secrets

import bcrypt

# bcrypt only looks at the first 72 bytes of a password, and bcrypt>=5 raises
# ValueError for anything longer. Request schemas enforce this limit up front.
BCRYPT_MAX_PASSWORD_BYTES = 72


def hash_password(password: str) -> str:
    """Return a salted bcrypt hash, as an ASCII str like '$2b$12$...' for the DB."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("ascii")


def verify_password(password: str, password_hash: str) -> bool:
    """Check a plaintext password against a stored bcrypt hash (constant-time compare)."""
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("ascii"))


# Verified against when the username doesn't exist, so a login attempt for an unknown
# user takes as long as one with a wrong password (no timing-based user enumeration).
DUMMY_PASSWORD_HASH = hash_password("dummy-password-for-timing")


def new_session_token() -> str:
    """256 bits of randomness, URL-safe so it can go straight into a cookie."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """SHA-256 hex digest of a session token: the only form stored in the DB.

    A fast hash is fine here (unlike passwords): the token is 256 random bits, so
    there is nothing to brute-force. A leaked DB then yields no usable sessions.
    """
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
