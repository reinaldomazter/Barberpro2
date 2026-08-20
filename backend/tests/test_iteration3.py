"""Iteration 3: code-quality fixes regression.
Focus: POST /backup with/without body (Optional[dict]=None), /backup/auto states + no duplication,
/backup list + restaurar, /sistema/limpar-dados body handling, dashboard, admin/atendente RBAC.
NOTE: limpar-dados is only exercised for its ERROR paths (never actually clears data).
"""
import concurrent.futures
import os
import sqlite3
from datetime import datetime
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE = base_url.rstrip("/") + "/api"
DB_PATH = Path("/app/backend/data/barberpro.db")


def _login(usuario, senha):
    s = requests.Session()
    r = s.post(f"{BASE}/auth/login", json={"usuario": usuario, "senha": senha}, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"login {usuario} failed {r.status_code}: {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="session")
def admin():
    creds = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    assert "admin" in creds
    return _login("admin", "123456")


@pytest.fixture(scope="session")
def atendente():
    return _login("atendente", "123456")


# ---------- POST /api/backup : assinatura body Optional[dict] = None ----------
class TestBackupBody:
    def test_backup_com_corpo_vazio(self, admin):
        r = admin.post(f"{BASE}/backup", json={}, timeout=90)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["arquivo"].startswith("backup_") and d["arquivo"].endswith(".db"), d
        assert d["caminho"].endswith(d["arquivo"]), d

    def test_backup_com_pasta(self, admin, tmp_path):
        pasta = "/app/backend/data/backups/TEST_it3"
        r = admin.post(f"{BASE}/backup", json={"pasta": pasta}, timeout=90)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert d["caminho"].startswith(pasta), d
        assert Path(d["caminho"]).exists() and Path(d["caminho"]).stat().st_size > 0

    def test_backup_sem_corpo(self, admin):
        # nenhum body enviado -> Optional[dict]=None deve aceitar
        r = admin.post(f"{BASE}/backup", timeout=90)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"
        assert "arquivo" in r.json() and "caminho" in r.json()

    def test_backup_body_null_explicito(self, admin):
        r = admin.post(f"{BASE}/backup", data="null",
                       headers={"Content-Type": "application/json"}, timeout=90)
        assert r.status_code == 200, f"{r.status_code} {r.text[:300]}"

    def test_backup_lista_contem_criados(self, admin):
        r = admin.get(f"{BASE}/backup", timeout=30)
        assert r.status_code == 200, r.text[:200]
        payload = r.json()
        lst = payload["backups"]
        assert isinstance(lst, list) and lst
        assert "pasta" in payload and "banco" in payload
        for b in lst[:5]:
            for k in ("arquivo", "caminho", "tamanho", "tipo", "data"):
                assert k in b, b
            assert "_id" not in b
        assert any(b["tipo"] == "manual" for b in lst)

    def test_backup_403_atendente(self, atendente):
        assert atendente.post(f"{BASE}/backup", json={}, timeout=60).status_code == 403
        assert atendente.get(f"{BASE}/backup", timeout=30).status_code == 403

    def test_restaurar_backup_recem_criado(self, admin):
        cri = admin.post(f"{BASE}/backup", json={}, timeout=90)
        assert cri.status_code == 200, cri.text[:200]
        caminho = cri.json()["caminho"]
        r = admin.post(f"{BASE}/backup/restaurar", json={"caminho": caminho}, timeout=120)
        assert r.status_code == 200, r.text[:300]
        assert r.json().get("ok") is True
        assert Path(r.json()["backup_seguranca"]).exists()
        # app continua utilizavel apos restauracao
        assert admin.get(f"{BASE}/dashboard", timeout=60).status_code == 200

    def test_restaurar_arquivo_inexistente(self, admin):
        r = admin.post(f"{BASE}/backup/restaurar",
                       json={"caminho": "/app/backend/data/backups/nao_existe.db"}, timeout=60)
        assert r.status_code == 404, r.status_code


# ---------- POST /api/backup/auto : 3 estados + idempotencia ----------
class TestBackupAuto:
    @staticmethod
    def _set_conf(admin, chave, valor):
        r = admin.put(f"{BASE}/configuracoes", json={chave: valor}, timeout=30)
        assert r.status_code == 200, r.text[:200]

    @staticmethod
    def _del_auto_hoje():
        conn = sqlite3.connect(str(DB_PATH))
        conn.execute("DELETE FROM backups WHERE tipo='automatico' AND date(data)=date('now','localtime')")
        conn.commit()
        conn.close()

    def test_desativado(self, admin):
        self._set_conf(admin, "backup_automatico", "0")
        r = admin.post(f"{BASE}/backup/auto", timeout=60)
        assert r.status_code == 200, r.text[:200]
        assert r.json() == {"criado": False, "motivo": "desativado"}, r.json()

    def test_criado_e_ja_realizado_hoje(self, admin):
        self._set_conf(admin, "backup_automatico", "1")
        self._del_auto_hoje()
        r1 = admin.post(f"{BASE}/backup/auto", timeout=90)
        assert r1.status_code == 200, r1.text[:200]
        assert r1.json().get("criado") is True, r1.json()
        arquivo = r1.json()["arquivo"]
        r2 = admin.post(f"{BASE}/backup/auto", timeout=90)
        assert r2.json() == {"criado": False, "motivo": "ja_realizado_hoje"}, r2.json()
        lst = admin.get(f"{BASE}/backup", timeout=30).json()["backups"]
        autos_hoje = [b for b in lst if b["tipo"] == "automatico"
                      and b["data"][:10] == datetime.now().date().isoformat()]
        assert len(autos_hoje) == 1, autos_hoje
        assert autos_hoje[0]["arquivo"] == arquivo

    def test_chamadas_simultaneas_nao_duplicam(self, admin):
        self._set_conf(admin, "backup_automatico", "1")
        self._del_auto_hoje()
        token = admin.headers["Authorization"]

        def call():
            return requests.post(f"{BASE}/backup/auto", headers={"Authorization": token}, timeout=90)

        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:
            res = [f.result() for f in [ex.submit(call) for _ in range(3)]]
        assert all(x.status_code == 200 for x in res), [x.status_code for x in res]
        criados = [x.json() for x in res if x.json().get("criado")]
        lst = admin.get(f"{BASE}/backup", timeout=30).json()["backups"]
        autos_hoje = [b for b in lst if b["tipo"] == "automatico"
                      and b["data"][:10] == datetime.now().date().isoformat()]
        assert len(autos_hoje) == 1, f"duplicou backup automatico: {autos_hoje} / criados={criados}"

    def test_requer_auth(self):
        assert requests.post(f"{BASE}/backup/auto", timeout=30).status_code in (401, 403)

    def test_estado_final_ativado(self, admin):
        self._set_conf(admin, "backup_automatico", "1")
        conf = admin.get(f"{BASE}/configuracoes", timeout=30).json()
        assert conf.get("backup_automatico") == "1"


# ---------- POST /api/sistema/limpar-dados : apenas caminhos de erro ----------
class TestLimparDados:
    def test_sem_corpo_400(self, admin):
        r = admin.post(f"{BASE}/sistema/limpar-dados", timeout=60)
        assert r.status_code == 400, f"{r.status_code} {r.text[:300]}"
        assert "Confirma" in r.json().get("detail", ""), r.json()

    def test_corpo_vazio_400(self, admin):
        r = admin.post(f"{BASE}/sistema/limpar-dados", json={}, timeout=60)
        assert r.status_code == 400, f"{r.status_code} {r.text[:300]}"
        assert "Confirma" in r.json().get("detail", ""), r.json()

    def test_confirmacao_errada_400(self, admin):
        r = admin.post(f"{BASE}/sistema/limpar-dados", json={"confirmacao": "limpar"}, timeout=60)
        assert r.status_code == 400, r.status_code

    def test_403_atendente(self, atendente):
        r = atendente.post(f"{BASE}/sistema/limpar-dados", json={"confirmacao": "LIMPAR"}, timeout=60)
        assert r.status_code == 403, f"{r.status_code} {r.text[:200]}"


# ---------- GET /api/dashboard ----------
class TestDashboard:
    def test_dashboard_estrutura(self, admin):
        r = admin.get(f"{BASE}/dashboard", timeout=60)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        for k in ("faturamento_dia", "atendimentos_dia", "faturamento_mes", "atendimentos_mes",
                  "clientes", "formas", "comissoes_dia", "despesas_dia", "lucro_estimado",
                  "proximos", "fat_diario", "fat_mensal", "top_servicos", "barbeiros",
                  "alertas_estoque", "aniversariantes"):
            assert k in d, f"falta {k}: {list(d)}"
        assert isinstance(d["top_servicos"], list)
        nomes = [s["nome"] for s in d["top_servicos"]]
        assert len(nomes) == len(set(nomes)), f"nomes duplicados quebram key do <Cell>: {nomes}"
        for s in d["top_servicos"]:
            assert isinstance(s["nome"], str) and s["nome"]
            assert isinstance(s["qtd"], (int, float))
        for a in d["aniversariantes"]:
            for k in ("nome", "telefone", "em_dias", "idade"):
                assert k in a, a

    def test_dashboard_atendente_permitido(self, atendente):
        assert atendente.get(f"{BASE}/dashboard", timeout=60).status_code == 200


# ---------- RBAC regressao ----------
class TestRBAC:
    HOJE = datetime.now().date().isoformat()

    @pytest.mark.parametrize("path", ["/relatorios/financeiro", "/relatorios/financeiro/csv",
                                      "/relatorios/financeiro/pdf", "/relatorios/barbeiros",
                                      "/relatorios/barbeiros/pdf"])
    def test_atendente_403_relatorios(self, atendente, path):
        r = atendente.get(f"{BASE}{path}", params={"inicio": self.HOJE, "fim": self.HOJE}, timeout=60)
        assert r.status_code == 403, f"{path} -> {r.status_code}"

    def test_atendente_403_usuarios_e_config(self, atendente):
        assert atendente.get(f"{BASE}/usuarios", timeout=30).status_code == 403
        assert atendente.put(f"{BASE}/configuracoes", json={"nome_barbearia": "X"}, timeout=30).status_code == 403
        assert atendente.get(f"{BASE}/logs", timeout=30).status_code == 403

    @pytest.mark.parametrize("path", ["/relatorios/financeiro", "/relatorios/financeiro/csv",
                                      "/relatorios/financeiro/pdf", "/relatorios/barbeiros/pdf",
                                      "/relatorios/servicos/pdf", "/relatorios/produtos/pdf",
                                      "/relatorios/clientes/pdf"])
    def test_admin_200_relatorios(self, admin, path):
        r = admin.get(f"{BASE}{path}", params={"inicio": self.HOJE, "fim": self.HOJE}, timeout=90)
        assert r.status_code == 200, f"{path} -> {r.status_code} {r.text[:200]}"
        if path.endswith("pdf"):
            assert r.content[:4] == b"%PDF", r.content[:20]

    def test_pdf_sem_logo_configurada(self, admin):
        conf = admin.get(f"{BASE}/configuracoes", timeout=30).json()
        logo = conf.get("logo") or ""
        try:
            assert admin.put(f"{BASE}/configuracoes", json={"logo": ""}, timeout=30).status_code == 200
            r = admin.get(f"{BASE}/relatorios/financeiro/pdf",
                          params={"inicio": self.HOJE, "fim": self.HOJE}, timeout=90)
            assert r.status_code == 200 and r.content[:4] == b"%PDF", r.status_code
        finally:
            admin.put(f"{BASE}/configuracoes", json={"logo": logo}, timeout=60)
        assert (admin.get(f"{BASE}/configuracoes", timeout=30).json().get("logo") or "") == logo


# ---------- CRUD + regras de negocio ----------
class TestCrudRegressao:
    def test_cliente_crud(self, admin):
        r = admin.post(f"{BASE}/clientes", json={"nome": "TEST_it3 Cliente", "telefone": "11999990003",
                                                 "nascimento": "1990-05-05", "observacoes": "it3"}, timeout=30)
        assert r.status_code in (200, 201), r.text[:200]
        cid = r.json()["id"]
        try:
            u = admin.put(f"{BASE}/clientes/{cid}", json={"nome": "TEST_it3 Editado",
                                                          "telefone": "11999990004"}, timeout=30)
            assert u.status_code == 200, u.text[:200]
            got = [c for c in admin.get(f"{BASE}/clientes", timeout=30).json() if c["id"] == cid]
            assert got and got[0]["nome"] == "TEST_it3 Editado" and got[0]["telefone"] == "11999990004"
        finally:
            dl = admin.delete(f"{BASE}/clientes/{cid}", timeout=30)
            assert dl.status_code in (200, 204), dl.status_code
        assert not [c for c in admin.get(f"{BASE}/clientes", timeout=30).json() if c["id"] == cid]

    def test_servico_e_barbeiro_crud(self, admin):
        s = admin.post(f"{BASE}/servicos", json={"nome": "TEST_it3 Servico", "preco": 40.0,
                                                 "duracao": 30, "comissao": 50, "status": "Ativo"}, timeout=30)
        assert s.status_code in (200, 201), s.text[:200]
        sid = s.json()["id"]
        b = admin.post(f"{BASE}/barbeiros", json={"nome": "TEST_it3 Barbeiro", "telefone": "11888880001",
                                                  "comissao": 40, "status": "Ativo"}, timeout=30)
        assert b.status_code in (200, 201), b.text[:200]
        bid = b.json()["id"]
        try:
            assert admin.put(f"{BASE}/servicos/{sid}", json={"nome": "TEST_it3 Servico2", "preco": 45.0,
                                                             "duracao": 30, "comissao": 50,
                                                             "status": "Ativo"}, timeout=30).status_code == 200
            got = [x for x in admin.get(f"{BASE}/servicos", timeout=30).json() if x["id"] == sid]
            assert got and got[0]["preco"] == 45.0
        finally:
            assert admin.delete(f"{BASE}/servicos/{sid}", timeout=30).status_code in (200, 204)
            assert admin.delete(f"{BASE}/barbeiros/{bid}", timeout=30).status_code in (200, 204)

    def test_agendamento_conflito(self, admin):
        barbeiros = [x for x in admin.get(f"{BASE}/barbeiros", timeout=30).json() if x["status"] == "Ativo"]
        servicos = [x for x in admin.get(f"{BASE}/servicos", timeout=30).json() if x["status"] == "Ativo"]
        assert barbeiros and servicos
        data = (datetime.now().date().replace(day=28)).isoformat()
        clientes = admin.get(f"{BASE}/clientes", timeout=30).json()
        assert clientes
        payload = {"cliente_id": clientes[0]["id"], "barbeiro_id": barbeiros[0]["id"],
                   "servico_id": servicos[0]["id"], "data": data, "hora": "23:15",
                   "status": "Agendado", "observacoes": "TEST_it3"}
        a1 = admin.post(f"{BASE}/agendamentos", json=payload, timeout=30)
        assert a1.status_code in (200, 201), a1.text[:300]
        aid = a1.json()["id"]
        try:
            a2 = admin.post(f"{BASE}/agendamentos", json=payload, timeout=30)
            assert a2.status_code == 400, f"conflito nao bloqueado: {a2.status_code} {a2.text[:200]}"
        finally:
            assert admin.delete(f"{BASE}/agendamentos/{aid}", timeout=30).status_code in (200, 204)

    def test_estoque_entrada_saida_ajuste(self, admin):
        p = admin.post(f"{BASE}/produtos", json={"nome": "TEST_it3 Produto", "preco": 10.0, "custo": 5.0,
                                                 "estoque": 10, "estoque_minimo": 5,
                                                 "status": "Ativo"}, timeout=30)
        assert p.status_code in (200, 201), p.text[:200]
        pid = p.json()["id"]
        try:
            for tipo, qtd in (("Entrada", 5), ("Saída", 3), ("Ajuste", 4)):
                r = admin.post(f"{BASE}/estoque/movimentacoes",
                               json={"produto_id": pid, "tipo": tipo, "quantidade": qtd,
                                     "motivo": "TEST_it3"}, timeout=30)
                assert r.status_code in (200, 201), f"{tipo}: {r.status_code} {r.text[:200]}"
            prod = [x for x in admin.get(f"{BASE}/produtos", timeout=30).json() if x["id"] == pid][0]
            assert prod["estoque"] == 4, prod
            # abaixo do minimo -> aparece no dashboard
            d = admin.get(f"{BASE}/dashboard", timeout=60).json()
            assert any(x["nome"] == "TEST_it3 Produto" for x in d["alertas_estoque"]), d["alertas_estoque"]
        finally:
            # produto com movimentacoes nao pode ser excluido via API (400 esperado, FK); limpeza direta
            dl = admin.delete(f"{BASE}/produtos/{pid}", timeout=30)
            assert dl.status_code in (200, 204, 400), dl.status_code
            if dl.status_code == 400:
                assert "vínculos" in dl.json().get("detail", ""), dl.text[:200]
                conn = sqlite3.connect(str(DB_PATH))
                conn.execute("DELETE FROM movimentacoes_estoque WHERE produto_id=?", (pid,))
                conn.execute("DELETE FROM produtos WHERE id=?", (pid,))
                conn.commit()
                conn.close()
        assert not [x for x in admin.get(f"{BASE}/produtos", timeout=30).json() if x["id"] == pid]

    def test_despesa_crud(self, admin):
        r = admin.post(f"{BASE}/despesas", json={"descricao": "TEST_it3 Despesa", "categoria": "Outros",
                                                 "valor": 12.5,
                                                 "data": datetime.now().date().isoformat()}, timeout=30)
        assert r.status_code in (200, 201), r.text[:200]
        did = r.json()["id"]
        got = [x for x in admin.get(f"{BASE}/despesas", timeout=30).json() if x["id"] == did]
        assert got and got[0]["valor"] == 12.5
        assert admin.delete(f"{BASE}/despesas/{did}", timeout=30).status_code in (200, 204)

    def test_atendimento_comissao(self, admin):
        barbeiros = [x for x in admin.get(f"{BASE}/barbeiros", timeout=30).json() if x["status"] == "Ativo"]
        servicos = [x for x in admin.get(f"{BASE}/servicos", timeout=30).json() if x["status"] == "Ativo"]
        b, s = barbeiros[0], servicos[0]
        payload = {"cliente_id": None, "barbeiro_id": b["id"],
                   "itens": [{"tipo": "servico", "servico_id": s["id"], "descricao": s["nome"],
                              "quantidade": 1, "preco_unitario": s["preco"], "usou_pacote": 0}],
                   "pagamentos": [{"forma": "Dinheiro", "valor": s["preco"] - 2}],
                   "desconto": 2.0, "observacoes": "TEST_it3"}
        r = admin.post(f"{BASE}/atendimentos", json=payload, timeout=60)
        assert r.status_code in (200, 201), r.text[:300]
        d = r.json()
        assert round(d["total"], 2) == round(s["preco"] - 2, 2), d
        perc = s.get("comissao") or b["comissao"]
        assert round(d["comissao"], 2) == round(s["preco"] * perc / 100, 2), d
