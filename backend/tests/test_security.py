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


class TestHashDeSenha:
    def test_hash_de_senha_retorna_valor_diferente_do_original(self):
        hash_gerado = hash_password("minha-senha-secreta")
        assert hash_gerado != "minha-senha-secreta"

    def test_verificar_senha_aceita_senha_correta(self):
        hash_gerado = hash_password("minha-senha-secreta")
        assert verify_password("minha-senha-secreta", hash_gerado) is True

    def test_verificar_senha_rejeita_senha_errada(self):
        hash_gerado = hash_password("minha-senha-secreta")
        assert verify_password("nao-e-a-senha", hash_gerado) is False

    def test_hash_de_senha_usa_salt(self):
        hash_a = hash_password("mesma-senha")
        hash_b = hash_password("mesma-senha")
        assert hash_a != hash_b
        assert verify_password("mesma-senha", hash_a) is True
        assert verify_password("mesma-senha", hash_b) is True


class TestTokenDeAcesso:
    def test_criar_token_de_acesso_codifica_claims_esperadas(self):
        token, expiracao = create_access_token(subject="usuario-123")

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "usuario-123"
        assert payload["type"] == "access"
        assert payload["exp"] == int(expiracao.timestamp())

    def test_criar_token_de_acesso_inclui_jti_quando_informado(self):
        token, _ = create_access_token(subject="usuario-123", jti="id-do-token-1")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["jti"] == "id-do-token-1"

    def test_criar_token_de_acesso_omite_jti_quando_nao_informado(self):
        token, _ = create_access_token(subject="usuario-123")
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "jti" not in payload


class TestTokenDeRenovacao:
    def test_criar_token_de_renovacao_codifica_claims_esperadas(self):
        token, expiracao = create_refresh_token(subject="usuario-123")

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["sub"] == "usuario-123"
        assert payload["type"] == "refresh"
        assert payload["exp"] == int(expiracao.timestamp())

    def test_token_de_renovacao_expira_mais_no_futuro_que_token_de_acesso(self):
        _, expiracao_acesso = create_access_token(subject="usuario-123")
        _, expiracao_renovacao = create_refresh_token(subject="usuario-123")
        assert expiracao_renovacao > expiracao_acesso


class TestDecodificarToken:
    def test_decodificar_token_valido_retorna_o_payload_original(self):
        token, _ = create_access_token(subject="usuario-123")
        payload = decode_token(token)
        assert payload["sub"] == "usuario-123"

    def test_decodificar_token_rejeita_token_expirado(self):
        agora = dt.datetime.now(dt.timezone.utc)
        payload_expirado = {
            "sub": "usuario-123",
            "type": "access",
            "iat": int((agora - dt.timedelta(minutes=10)).timestamp()),
            "exp": int((agora - dt.timedelta(minutes=5)).timestamp()),
        }
        token_expirado = jwt.encode(payload_expirado, SECRET_KEY, algorithm=ALGORITHM)

        with pytest.raises(JWTError):
            decode_token(token_expirado)

    def test_decodificar_token_rejeita_token_assinado_com_chave_errada(self):
        token = jwt.encode({"sub": "usuario-123"}, "uma-chave-diferente", algorithm=ALGORITHM)

        with pytest.raises(JWTError):
            decode_token(token)
