"""Repro deterministica do vazamento de conexao SQLite (lock permanente) em do_backup().

Cenario: POST /api/backup com {"tipo":"automatico"} quando ja existe um backup automatico hoje
-> UNIQUE index backups(tipo, date(data)) -> sqlite3.IntegrityError -> 500.
A conexao de origem (get_conn) nunca e fechada e fica com transacao de escrita aberta,
deixando o banco travado: TODA escrita seguinte (inclusive log() do login) retorna 500.
"""
import os

import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env["REACT_APP_BACKEND_URL"]).rstrip("/") + "/api"


def _headers():
    r = requests.post(f"{BASE}/auth/login", json={"usuario": "admin", "senha": "123456"}, timeout=30)
    assert r.status_code == 200, f"login {r.status_code} {r.text[:200]}"
    return {"Authorization": f"Bearer {r.json()['token']}"}


def test_backup_duplicado_nao_deve_travar_o_banco():
    h = _headers()
    # garante um backup automatico de hoje
    requests.post(f"{BASE}/backup/auto", headers=h, timeout=90)
    dup = requests.post(f"{BASE}/backup", json={"tipo": "automatico"}, headers=h, timeout=90)
    print("POST /backup tipo=automatico duplicado ->", dup.status_code, dup.text[:120])

    # apos o erro, escritas normais devem continuar funcionando
    login = requests.post(f"{BASE}/auth/login", json={"usuario": "admin", "senha": "123456"}, timeout=30)
    print("login apos erro ->", login.status_code)
    cli = requests.post(f"{BASE}/clientes", json={"nome": "TEST_it3 lock", "telefone": "11900000000"},
                        headers=h, timeout=30)
    print("POST /clientes apos erro ->", cli.status_code, cli.text[:120])
    if cli.status_code in (200, 201):
        requests.delete(f"{BASE}/clientes/{cli.json()['id']}", headers=h, timeout=30)

    assert login.status_code == 200, "login quebrou apos IntegrityError no backup (database is locked)"
    assert cli.status_code in (200, 201), "escrita quebrou apos IntegrityError no backup (database is locked)"
    assert dup.status_code in (200, 400, 409), f"esperado erro tratado, veio {dup.status_code}"
