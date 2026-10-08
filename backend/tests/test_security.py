from security import (
    BCRYPT_MAX_PASSWORD_BYTES,
    hash_password,
    hash_token,
    new_session_token,
    verify_password,
)


def test_hash_password_round_trip() -> None:
    password_hash = hash_password("password123")

    assert isinstance(password_hash, str)
    assert password_hash.startswith("$2b$")
    assert password_hash != "password123"
    assert verify_password("password123", password_hash)
    assert not verify_password("wrong-password", password_hash)


def test_hash_password_is_salted() -> None:
    assert hash_password("same") != hash_password("same")


def test_non_ascii_password_round_trip() -> None:
    # Multi-byte UTF-8 characters must survive the str -> bytes -> str conversions.
    password = "pässwörd-密码-🔑"

    password_hash = hash_password(password)

    assert verify_password(password, password_hash)
    assert not verify_password("passwörd-密码-🔑", password_hash)


def test_password_at_byte_limit_is_accepted() -> None:
    # The limit is in UTF-8 bytes, not characters: 24 three-byte chars = 72 bytes.
    password = "密" * 24
    assert len(password.encode("utf-8")) == BCRYPT_MAX_PASSWORD_BYTES

    assert verify_password(password, hash_password(password))


def test_session_tokens_are_unique_and_hashed_deterministically() -> None:
    token = new_session_token()

    assert token != new_session_token()
    assert len(token) >= 43  # 32 random bytes, base64url-encoded
    assert hash_token(token) == hash_token(token)
    assert len(hash_token(token)) == 64  # SHA-256 hex
    assert hash_token(token) != token
