"""BarberPro backend integration tests via public URL."""
import csv
import io
import os
import time
import uuid
from datetime import datetime, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL") or open("/app/frontend/.env").read().split("REACT_APP_BACKEND_URL=")[1].split("\n")[0].strip()
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"usuario": "admin", "senha": "123456"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="session")
def atendente_token():
    r = requests.post(f"{API}/auth/login", json={"usuario": "atendente", "senha": "123456"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def atendente_h(atendente_token):
    return {"Authorization": f"Bearer {atendente_token}"}


# ---------------- AUTH ----------------
class TestAuth:
    def test_login_admin_ok(self):
        r = requests.post(f"{API}/auth/login", json={"usuario": "admin", "senha": "123456"})
        assert r.status_code == 200
        d = r.json()
        assert d["user"]["perfil"] == "admin"
        assert d["token"]

    def test_login_bad_password(self):
        r = requests.post(f"{API}/auth/login", json={"usuario": "admin", "senha": "wrong"})
        assert r.status_code == 401
        assert "inv" in r.json()["detail"].lower() or "senha" in r.json()["detail"].lower()

    def test_login_atendente_ok(self):
        r = requests.post(f"{API}/auth/login", json={"usuario": "atendente", "senha": "123456"})
        assert r.status_code == 200
        assert r.json()["user"]["perfil"] == "atendente"

    def test_me(self, admin_h):
        r = requests.get(f"{API}/auth/me", headers=admin_h)
        assert r.status_code == 200
        assert r.json()["usuario"] == "admin"

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------------- RBAC ----------------
class TestRBAC:
    def test_atendente_cannot_list_usuarios(self, atendente_h):
        r = requests.get(f"{API}/usuarios", headers=atendente_h)
        assert r.status_code == 403

    def test_atendente_cannot_put_config(self, atendente_h):
        r = requests.put(f"{API}/configuracoes", headers=atendente_h, json={"foo": "bar"})
        assert r.status_code == 403

    def test_atendente_cannot_backup(self, atendente_h):
        r = requests.post(f"{API}/backup", headers=atendente_h, json={})
        assert r.status_code == 403

    def test_admin_can_list_usuarios(self, admin_h):
        r = requests.get(f"{API}/usuarios", headers=admin_h)
        assert r.status_code == 200
        assert any(u["usuario"] == "admin" for u in r.json())


# ---------------- CLIENTES CRUD + search ----------------
class TestClientesCrud:
    def test_create_search_delete(self, admin_h):
        suffix = uuid.uuid4().hex[:6]
        payload = {"nome": f"TEST_Cli_{suffix}", "telefone": f"9{suffix}", "cpf": "", "whatsapp": "", "nascimento": "", "endereco": "", "observacoes": ""}
        r = requests.post(f"{API}/clientes", headers=admin_h, json=payload)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        # Search by name
        r = requests.get(f"{API}/clientes?q=TEST_Cli_{suffix}", headers=admin_h)
        assert r.status_code == 200
        assert any(c["id"] == cid for c in r.json())
        # Search by telefone
        r = requests.get(f"{API}/clientes?q=9{suffix}", headers=admin_h)
        assert any(c["id"] == cid for c in r.json())
        # Delete
        r = requests.delete(f"{API}/clientes/{cid}", headers=admin_h)
        assert r.status_code == 200


# ---------------- BARBEIROS + SERVICOS ----------------
class TestBarbeirosServicos:
    def test_barbeiro_edit_delete(self, admin_h):
        s = uuid.uuid4().hex[:6]
        r = requests.post(f"{API}/barbeiros", headers=admin_h, json={"nome": f"TEST_Barb_{s}", "comissao": 50, "status": "Ativo"})
        assert r.status_code == 200
        bid = r.json()["id"]
        r = requests.put(f"{API}/barbeiros/{bid}", headers=admin_h, json={"nome": f"TEST_Barb_{s}", "comissao": 60, "status": "Ativo"})
        assert r.status_code == 200
        r = requests.delete(f"{API}/barbeiros/{bid}", headers=admin_h)
        assert r.status_code == 200

    def test_servico_crud(self, admin_h):
        s = uuid.uuid4().hex[:6]
        r = requests.post(f"{API}/servicos", headers=admin_h, json={"nome": f"TEST_Sv_{s}", "preco": 40, "duracao": 30, "status": "Ativo"})
        assert r.status_code == 200
        sid = r.json()["id"]
        r = requests.delete(f"{API}/servicos/{sid}", headers=admin_h)
        assert r.status_code == 200


# ---------------- AGENDAMENTOS (conflict) ----------------
class TestAgendamentos:
    @pytest.fixture
    def setup(self, admin_h):
        s = uuid.uuid4().hex[:6]
        c = requests.post(f"{API}/clientes", headers=admin_h, json={"nome": f"TEST_C_{s}", "telefone": "111"}).json()["id"]
        b = requests.post(f"{API}/barbeiros", headers=admin_h, json={"nome": f"TEST_B_{s}", "comissao": 50, "status": "Ativo"}).json()["id"]
        sv = requests.post(f"{API}/servicos", headers=admin_h, json={"nome": f"TEST_S_{s}", "preco": 40, "duracao": 30, "status": "Ativo"}).json()["id"]
        return {"c": c, "b": b, "s": sv}

    def test_create_and_conflict(self, admin_h, setup):
        data = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        body = {"cliente_id": setup["c"], "barbeiro_id": setup["b"], "servico_id": setup["s"], "data": data, "hora": "10:00"}
        r = requests.post(f"{API}/agendamentos", headers=admin_h, json=body)
        assert r.status_code == 200, r.text
        aid = r.json()["id"]
        # Conflict
        r2 = requests.post(f"{API}/agendamentos", headers=admin_h, json=body)
        assert r2.status_code == 400
        assert "conflit" in r2.json()["detail"].lower() or "horário" in r2.json()["detail"].lower() or "horario" in r2.json()["detail"].lower() or "já" in r2.json()["detail"].lower()
        # Status update
        r3 = requests.patch(f"{API}/agendamentos/{aid}/status", headers=admin_h, json={"status": "Confirmado"})
        assert r3.status_code == 200
        # Cleanup
        requests.delete(f"{API}/agendamentos/{aid}", headers=admin_h)


# ---------------- ATENDIMENTO POS ----------------
class TestAtendimento:
    def test_full_pos_flow(self, admin_h):
        s = uuid.uuid4().hex[:6]
        c = requests.post(f"{API}/clientes", headers=admin_h, json={"nome": f"TEST_Cli_{s}", "telefone": "222"}).json()["id"]
        b = requests.post(f"{API}/barbeiros", headers=admin_h, json={"nome": f"TEST_B_{s}", "comissao": 50, "status": "Ativo"}).json()["id"]
        sv = requests.post(f"{API}/servicos", headers=admin_h, json={"nome": f"TEST_Sv_{s}", "preco": 40, "duracao": 30, "status": "Ativo"}).json()["id"]
        # Produto with stock
        prod = requests.post(f"{API}/produtos", headers=admin_h, json={"nome": f"TEST_P_{s}", "preco": 10, "custo": 5, "estoque": 5, "estoque_minimo": 1, "status": "Ativo"}).json()["id"]

        body = {
            "cliente_id": c, "barbeiro_id": b,
            "itens": [
                {"tipo": "servico", "servico_id": sv, "descricao": "Corte", "quantidade": 1, "preco_unitario": 40},
                {"tipo": "produto", "produto_id": prod, "descricao": "Prod", "quantidade": 1, "preco_unitario": 10},
            ],
            "pagamentos": [{"forma": "Dinheiro", "valor": 45}],
            "desconto": 5,
        }
        r = requests.post(f"{API}/atendimentos", headers=admin_h, json=body)
        assert r.status_code == 200, r.text
        d = r.json()
        # Total = (40+10) - 5 = 45
        assert d["total"] == 45
        # Comissão = 40 * 50% = 20 (service only)
        assert d["comissao"] == 20.0
        # Stock reduced
        prods = requests.get(f"{API}/produtos?q=TEST_P_{s}", headers=admin_h).json()
        assert prods[0]["estoque"] == 4
        # Historico shows atendimento
        h = requests.get(f"{API}/clientes/{c}/historico", headers=admin_h).json()
        assert h["qtd"] >= 1


# ---------------- PACOTES ----------------
class TestPacotes:
    def test_pacote_use(self, admin_h):
        s = uuid.uuid4().hex[:6]
        c = requests.post(f"{API}/clientes", headers=admin_h, json={"nome": f"TEST_PC_{s}", "telefone": "333"}).json()["id"]
        b = requests.post(f"{API}/barbeiros", headers=admin_h, json={"nome": f"TEST_PB_{s}", "comissao": 50, "status": "Ativo"}).json()["id"]
        sv1 = requests.post(f"{API}/servicos", headers=admin_h, json={"nome": f"TEST_PS1_{s}", "preco": 30, "duracao": 30, "status": "Ativo"}).json()["id"]
        sv2 = requests.post(f"{API}/servicos", headers=admin_h, json={"nome": f"TEST_PS2_{s}", "preco": 25, "duracao": 30, "status": "Ativo"}).json()["id"]
        pkg = requests.post(f"{API}/pacotes", headers=admin_h, json={"nome": f"TEST_Pk_{s}", "valor": 100, "validade_dias": 30, "status": "Ativo",
                                                                    "itens": [{"servico_id": sv1, "quantidade": 3}, {"servico_id": sv2, "quantidade": 2}]})
        assert pkg.status_code == 200, pkg.text
        pid = pkg.json()["id"]
        # Contratar
        r = requests.post(f"{API}/clientes-pacotes", headers=admin_h, json={"cliente_id": c, "pacote_id": pid})
        assert r.status_code == 200
        # Consume 1 of sv1 via atendimento with usou_pacote
        body = {"cliente_id": c, "barbeiro_id": b, "itens": [
            {"tipo": "servico", "servico_id": sv1, "descricao": "P", "quantidade": 1, "preco_unitario": 30, "usou_pacote": 1}
        ], "pagamentos": []}
        r = requests.post(f"{API}/atendimentos", headers=admin_h, json=body)
        assert r.status_code == 200, r.text
        assert r.json()["total"] == 0
        # Saldo
        cp = requests.get(f"{API}/clientes-pacotes?cliente_id={c}", headers=admin_h).json()
        saldos = cp[0]["saldos"]
        s1 = next(x for x in saldos if x["servico_id"] == sv1)
        assert s1["utilizados"] == 1


# ---------------- CAIXA ----------------
class TestCaixa:
    def test_caixa_flow(self, admin_h):
        # If a caixa is already open, close it first
        atual = requests.get(f"{API}/caixa/atual", headers=admin_h).json()
        if atual.get("caixa"):
            requests.post(f"{API}/caixa/fechar", headers=admin_h, json={"total_informado": 0})
        r = requests.post(f"{API}/caixa/abrir", headers=admin_h, json={"valor_inicial": 100})
        assert r.status_code == 200
        # Movs
        for tipo in ["Sangria", "Reforço"]:
            r = requests.post(f"{API}/caixa/movimentacao", headers=admin_h, json={"tipo": tipo, "valor": 20, "descricao": "t"})
            assert r.status_code == 200
        atual = requests.get(f"{API}/caixa/atual", headers=admin_h).json()
        assert atual["caixa"]["status"] == "Aberto"
        # Fechar
        r = requests.post(f"{API}/caixa/fechar", headers=admin_h, json={"total_informado": atual["total_esperado"]})
        assert r.status_code == 200
        assert r.json()["diferenca"] == 0
        # Now movimentacao must fail
        r = requests.post(f"{API}/caixa/movimentacao", headers=admin_h, json={"tipo": "Reforço", "valor": 10})
        assert r.status_code == 400
        assert "aberto" in r.json()["detail"].lower()


# ---------------- ESTOQUE ----------------
class TestEstoque:
    def test_movs(self, admin_h):
        s = uuid.uuid4().hex[:6]
        pid = requests.post(f"{API}/produtos", headers=admin_h, json={"nome": f"TEST_EP_{s}", "preco": 10, "custo": 5, "estoque": 10, "estoque_minimo": 2, "status": "Ativo"}).json()["id"]
        for tipo, q in [("Entrada", 5), ("Saída", 3), ("Ajuste", 8)]:
            r = requests.post(f"{API}/estoque/movimentacoes", headers=admin_h, json={"produto_id": pid, "tipo": tipo, "quantidade": q, "motivo": "t"})
            assert r.status_code == 200
        # After: Entrada +5 (=15), Saída -3 (=12), Ajuste sets 8
        p = [x for x in requests.get(f"{API}/produtos?q=TEST_EP_{s}", headers=admin_h).json() if x["id"] == pid][0]
        assert p["estoque"] == 8
        movs = requests.get(f"{API}/estoque/movimentacoes", headers=admin_h).json()
        assert sum(1 for m in movs if m["produto_id"] == pid) >= 3


# ---------------- DESPESAS + Dashboard ----------------
class TestDespesasDashboard:
    def test_despesa_and_dashboard(self, admin_h):
        today = datetime.now().strftime("%Y-%m-%d")
        s = uuid.uuid4().hex[:6]
        r = requests.post(f"{API}/despesas", headers=admin_h, json={"descricao": f"TEST_D_{s}", "categoria": "Aluguel", "valor": 50, "data": today, "forma_pagamento": "Dinheiro"})
        assert r.status_code == 200
        d = requests.get(f"{API}/dashboard", headers=admin_h).json()
        assert d["despesas_dia"] >= 50


# ---------------- RELATORIOS ----------------
class TestRelatorios:
    @pytest.mark.parametrize("tipo", ["financeiro", "barbeiros", "clientes", "servicos", "produtos"])
    def test_relatorio_json(self, admin_h, tipo):
        inicio = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        fim = datetime.now().strftime("%Y-%m-%d")
        r = requests.get(f"{API}/relatorios/{tipo}?inicio={inicio}&fim={fim}", headers=admin_h)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), dict)

    def test_relatorio_csv(self, admin_h):
        inicio = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        fim = datetime.now().strftime("%Y-%m-%d")
        r = requests.get(f"{API}/relatorios/financeiro/csv?inicio={inicio}&fim={fim}&secao=diario", headers=admin_h)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/csv")


# ---------------- BACKUP ----------------
class TestBackup:
    def test_backup_list_create(self, admin_h):
        r = requests.post(f"{API}/backup", headers=admin_h, json={})
        assert r.status_code == 200, r.text
        arq = r.json()["arquivo"]
        assert arq.endswith(".db")
        r = requests.get(f"{API}/backup", headers=admin_h).json()
        assert any(b["arquivo"] == arq for b in r["backups"])


# ---------------- Change Password ----------------
class TestChangePwd:
    def test_change_and_restore(self, admin_h):
        r = requests.post(f"{API}/auth/change-password", headers=admin_h, json={"senha_atual": "123456", "nova_senha": "novasenha"})
        assert r.status_code == 200
        # Old should fail
        r = requests.post(f"{API}/auth/login", json={"usuario": "admin", "senha": "123456"})
        assert r.status_code == 401
        # New should work
        r = requests.post(f"{API}/auth/login", json={"usuario": "admin", "senha": "novasenha"})
        assert r.status_code == 200
        new_tok = r.json()["token"]
        # Restore
        r = requests.post(f"{API}/auth/change-password", headers={"Authorization": f"Bearer {new_tok}"}, json={"senha_atual": "novasenha", "nova_senha": "123456"})
        assert r.status_code == 200
        r = requests.post(f"{API}/auth/login", json={"usuario": "admin", "senha": "123456"})
        assert r.status_code == 200
