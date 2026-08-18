from __future__ import annotations

import datetime as dt

import pytest
from jose import jwt, JWTError

from app.auth.security import (
    ALGORITHM,
    SECRET_KEY,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_password_returns_different_value_than_input(self):
        hashed = hash_password("my-secret-password")
        assert hashed != "my-secret-password"

    def test_verify_password_accepts_correct_password(self):
        hashed = hash_password("my-secret-password")
        assert verify_password("my-secret-password", hashed) is True

    def test_verify_password_rejects_wrong_password(self):
        hashed = hash_password("my-secret-password")
        assert verify_password("not-the-password", hashed) is False

    def test_hash_password_is_salted(self):
        hashed_a = hash_password("same-password")
        hashed_b = hash_password("same-password")
        assert hashed_a != hashed_b
        assert verify_password("same-password", hashed_a) is True
        assert verify_password("same-password", hashed_b) is True


class TestAccessToken:
    def test_create_access_token_encodes_expected_claims(self):
        token, exp = create_access_token(subject="user-123")

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "user-123"
        assert payload["type"] == "access"
        assert payload["exp"] == int(exp.timestamp())

    def test_create_access_token_includes_jti_when_given(self):
        token, _ = create_access_token(subject="user-123", jti="token-id-1")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["jti"] == "token-id-1"

    def test_create_access_token_omits_jti_when_not_given(self):
        token, _ = create_access_token(subject="user-123")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "jti" not in payload


class TestRefreshToken:
    def test_create_refresh_token_encodes_expected_claims(self):
        token, exp = create_refresh_token(subject="user-123")

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "user-123"
        assert payload["type"] == "refresh"
        assert payload["exp"] == int(exp.timestamp())

    def test_refresh_token_expires_further_in_the_future_than_access_token(self):
        _, access_exp = create_access_token(subject="user-123")
        _, refresh_exp = create_refresh_token(subject="user-123")
        assert refresh_exp > access_exp


class TestDecodeToken:
    def test_decode_token_round_trips_a_valid_token(self):
        token, _ = create_access_token(subject="user-123")
        payload = decode_token(token)
        assert payload["sub"] == "user-123"

    def test_decode_token_rejects_expired_token(self):
        now = dt.datetime.now(dt.timezone.utc)
        expired_payload = {
            "sub": "user-123",
            "type": "access",
            "iat": int((now - dt.timedelta(minutes=10)).timestamp()),
            "exp": int((now - dt.timedelta(minutes=5)).timestamp()),
        }
        expired_token = jwt.encode(expired_payload, SECRET_KEY, algorithm=ALGORITHM)

        with pytest.raises(JWTError):
            decode_token(expired_token)

    def test_decode_token_rejects_token_signed_with_wrong_key(self):
        token = jwt.encode({"sub": "user-123"}, "a-different-secret", algorithm=ALGORITHM)

        with pytest.raises(JWTError):
            decode_token(token)
