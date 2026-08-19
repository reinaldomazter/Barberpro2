import os
import secrets
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import HTTPException, Request

from db import get_conn, now_iso

JWT_ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def get_jwt_secret() -> str:
    secret = os.environ.get("JWT_SECRET")
    if secret:
        return secret
    # Instalação desktop offline sem .env: gera e guarda um segredo local uma única vez.
    conn = get_conn()
    row = conn.execute("SELECT valor FROM configuracoes WHERE chave='jwt_secret'").fetchone()
    if row and row["valor"]:
        conn.close()
        return row["valor"]
    secret = secrets.token_hex(32)
    conn.execute("INSERT OR REPLACE INTO configuracoes (chave, valor) VALUES ('jwt_secret', ?)", (secret,))
    conn.commit()
    conn.close()
    return secret


def create_access_token(user_id: int, usuario: str, perfil: str) -> str:
    payload = {
        "sub": str(user_id),
        "usuario": usuario,
        "perfil": perfil,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")
    conn = get_conn()
    row = conn.execute(
        "SELECT id, usuario, nome, perfil, ativo FROM usuarios WHERE id=?", (int(payload["sub"]),)
    ).fetchone()
    conn.close()
    if not row or not row["ativo"]:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")
    return dict(row)


def require_admin(request: Request) -> dict:
    user = get_current_user(request)
    if user["perfil"] != "admin":
        raise HTTPException(status_code=403, detail="Acesso restrito ao administrador")
    return user


def seed_admin():
    usuario = os.environ.get("ADMIN_USER", "admin")
    senha = os.environ.get("ADMIN_PASSWORD", "123456")
    conn = get_conn()
    existing = conn.execute("SELECT * FROM usuarios WHERE usuario=?", (usuario,)).fetchone()
    if existing is None:
        conn.execute(
            "INSERT INTO usuarios (usuario, nome, senha_hash, perfil, ativo, criado_em) VALUES (?,?,?,?,1,?)",
            (usuario, "Administrador", hash_password(senha), "admin", now_iso()),
        )
    att = conn.execute("SELECT * FROM usuarios WHERE usuario=?", ("atendente",)).fetchone()
    if att is None:
        conn.execute(
            "INSERT INTO usuarios (usuario, nome, senha_hash, perfil, ativo, criado_em) VALUES (?,?,?,?,1,?)",
            ("atendente", "Atendente", hash_password("123456"), "atendente", now_iso()),
        )
    conn.commit()
    conn.close()
