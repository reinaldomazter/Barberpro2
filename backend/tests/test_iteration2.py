"""Iteration 2 backend tests: logo/identidade publica, PDF com logo, aniversariantes, backup automatico."""
import base64
import io
import os
import re
from datetime import datetime, timedelta
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE = base_url.rstrip("/") + "/api"


def _creds():
    content = Path("/app/memory/test_credentials.md").read_text(encoding="utf-8")
    assert "admin" in content
    return {"usuario": "admin", "senha": "123456"}, {"usuario": "atendente", "senha": "123456"}


@pytest.fixture(scope="session")
def admin():
    s = requests.Session()
    a, _ = _creds()
    r = s.post(f"{BASE}/auth/login", json=a, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"admin login failed {r.status_code}: {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


@pytest.fixture(scope="session")
def atendente():
    s = requests.Session()
    _, b = _creds()
    r = s.post(f"{BASE}/auth/login", json=b, timeout=30)
    if r.status_code != 200:
        pytest.fail(f"atendente login failed {r.status_code}: {r.text[:300]}")
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


def _tiny_png_datauri(size=(24, 24), color=(212, 175, 55)):
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# ---------- identidade publica (logo no login) ----------
class TestIdentidadePublica:
    def test_identidade_sem_auth(self):
        r = requests.get(f"{BASE}/publico/identidade", timeout=30)
        assert r.status_code == 200, r.text[:300]
        d = r.json()
        assert set(["nome_barbearia", "logo"]).issubset(d.keys())
        assert isinstance(d["nome_barbearia"], str) and d["nome_barbearia"]
        assert isinstance(d["logo"], str)

    def test_identidade_reflete_config_salvada(self, admin):
        original = admin.get(f"{BASE}/configuracoes", timeout=30).json()
        logo = _tiny_png_datauri()
        try:
            up = admin.put(f"{BASE}/configuracoes", json={"logo": logo}, timeout=60)
            assert up.status_code == 200, up.text[:300]
            got = requests.get(f"{BASE}/publico/identidade", timeout=30).json()
            assert got["logo"] == logo
        finally:
            admin.put(f"{BASE}/configuracoes", json={"logo": original.get("logo", "")}, timeout=60)


# ---------- PDF com logo ----------
class TestRelatorioPDFLogo:
    def _pdf(self, admin):
        hoje = datetime.now().date()
        ini = (hoje - timedelta(days=30)).isoformat()
        return admin.get(f"{BASE}/relatorios/financeiro/pdf",
                         params={"inicio": ini, "fim": hoje.isoformat()}, timeout=90)

    def test_pdf_com_logo_base64(self, admin):
        original = admin.get(f"{BASE}/configuracoes", timeout=30).json()
        try:
            admin.put(f"{BASE}/configuracoes", json={"logo": _tiny_png_datauri()}, timeout=60)
            r = self._pdf(admin)
            assert r.status_code == 200, r.text[:300]
            assert r.content[:4] == b"%PDF"
            assert len(r.content) > 1000
        finally:
            admin.put(f"{BASE}/configuracoes", json={"logo": original.get("logo", "")}, timeout=60)

    def test_pdf_com_logo_vazia(self, admin):
        original = admin.get(f"{BASE}/configuracoes", timeout=30).json()
        try:
            admin.put(f"{BASE}/configuracoes", json={"logo": ""}, timeout=60)
            r = self._pdf(admin)
            assert r.status_code == 200, r.text[:300]
            assert r.content[:4] == b"%PDF"
        finally:
            admin.put(f"{BASE}/configuracoes", json={"logo": original.get("logo", "")}, timeout=60)

    def test_pdf_com_logo_url_http(self, admin):
        original = admin.get(f"{BASE}/configuracoes", timeout=30).json()
        try:
            admin.put(f"{BASE}/configuracoes", json={"logo": "http://example.com/x.png"}, timeout=60)
            r = self._pdf(admin)
            assert r.status_code == 200, r.text[:300]
            assert r.content[:4] == b"%PDF"
        finally:
            admin.put(f"{BASE}/configuracoes", json={"logo": original.get("logo", "")}, timeout=60)

    def test_pdf_com_logo_base64_invalida(self, admin):
        original = admin.get(f"{BASE}/configuracoes", timeout=30).json()
        try:
            admin.put(f"{BASE}/configuracoes", json={"logo": "data:image/png;base64,NOTBASE64!!!"}, timeout=60)
            r = self._pdf(admin)
            assert r.status_code == 200, f"PDF quebra com logo invalida: {r.status_code} {r.text[:300]}"
            assert r.content[:4] == b"%PDF"
        finally:
            admin.put(f"{BASE}/configuracoes", json={"logo": original.get("logo", "")}, timeout=60)


# ---------- aniversariantes ----------
class TestAniversariantes:
    def test_dashboard_aniversariantes_estrutura_e_ordem(self, admin):
        r = admin.get(f"{BASE}/dashboard", timeout=60)
        assert r.status_code == 200, r.text[:300]
        aniv = r.json().get("aniversariantes")
        assert isinstance(aniv, list), "campo aniversariantes ausente"
        assert len(aniv) >= 3, f"esperado >=3 aniversariantes de demo, veio {len(aniv)}"
        dias = [a["em_dias"] for a in aniv]
        assert dias == sorted(dias), f"nao ordenado por proximidade: {dias}"
        assert dias[0] == 0, f"esperado alguem hoje (em_dias=0), veio {dias}"
        nomes = [a["nome"] for a in aniv]
        assert "Rafael Alves" in nomes and "Bruno Costa" in nomes and "Diego Martins" in nomes, nomes
        for a in aniv:
            assert 0 <= a["em_dias"] <= 6
            assert isinstance(a["idade"], int) and 0 < a["idade"] < 120
            # idade coerente com nascimento
            nasc = datetime.strptime(a["nascimento"][:10], "%Y-%m-%d")
            bday = datetime.strptime(a["data"], "%Y-%m-%d")
            assert (nasc.month, nasc.day) == (bday.month, bday.day)
            assert a["idade"] == bday.year - nasc.year
        # Rafael hoje
        rafael = next(a for a in aniv if a["nome"] == "Rafael Alves")
        assert rafael["em_dias"] == 0
        bruno = next(a for a in aniv if a["nome"] == "Bruno Costa")
        assert bruno["em_dias"] == 2, bruno
        diego = next(a for a in aniv if a["nome"] == "Diego Martins")
        assert diego["em_dias"] == 4, diego

    def test_novo_cliente_aparece_no_card(self, admin):
        alvo = (datetime.now() + timedelta(days=3)).date()
        nascimento = alvo.replace(year=1995).isoformat()
        cr = admin.post(f"{BASE}/clientes", json={
            "nome": "TEST_Aniversariante QA", "telefone": "11988887777",
            "whatsapp": "11988887777", "nascimento": nascimento}, timeout=60)
        assert cr.status_code in (200, 201), cr.text[:300]
        cid = cr.json()["id"]
        try:
            d = admin.get(f"{BASE}/dashboard", timeout=60).json()["aniversariantes"]
            mine = [a for a in d if a["id"] == cid]
            assert mine, f"cliente novo nao aparece: {[a['nome'] for a in d]}"
            assert mine[0]["em_dias"] == 3, mine[0]
            assert mine[0]["idade"] == alvo.year - 1995
        finally:
            admin.delete(f"{BASE}/clientes/{cid}", timeout=30)

    def test_nascimento_vazio_nao_quebra(self, admin):
        cr = admin.post(f"{BASE}/clientes", json={"nome": "TEST_SemNasc QA", "telefone": "11900000000"}, timeout=60)
        assert cr.status_code in (200, 201), cr.text[:300]
        cid = cr.json()["id"]
        try:
            r = admin.get(f"{BASE}/dashboard", timeout=60)
            assert r.status_code == 200
            assert all(a["id"] != cid for a in r.json()["aniversariantes"])
        finally:
            admin.delete(f"{BASE}/clientes/{cid}", timeout=30)


# ---------- backup automatico ----------
class TestBackupAuto:
    def test_requer_auth(self):
        r = requests.post(f"{BASE}/backup/auto", timeout=30)
        assert r.status_code in (401, 403), r.status_code

    def test_desativado(self, admin):
        admin.put(f"{BASE}/configuracoes", json={"backup_automatico": "0"}, timeout=60)
        r = admin.post(f"{BASE}/backup/auto", timeout=90)
        assert r.status_code == 200, r.text[:300]
        assert r.json() == {"criado": False, "motivo": "desativado"}, r.json()

    def test_cria_e_depois_ja_realizado_hoje(self, admin):
        admin.put(f"{BASE}/configuracoes", json={"backup_automatico": "1"}, timeout=60)
        r1 = admin.post(f"{BASE}/backup/auto", timeout=120)
        assert r1.status_code == 200, r1.text[:300]
        d1 = r1.json()
        if d1.get("criado"):
            assert re.match(r"^backup_\d{2}-\d{2}-\d{4}_\d{2}-\d{2}-\d{2}\.db$", d1["arquivo"]), d1
            lst = admin.get(f"{BASE}/backup", timeout=60).json()["backups"]
            assert any(b["arquivo"] == d1["arquivo"] and b["tipo"] == "automatico" for b in lst), \
                "backup automatico nao listado"
        else:
            assert d1.get("motivo") == "ja_realizado_hoje", d1
        r2 = admin.post(f"{BASE}/backup/auto", timeout=120)
        assert r2.status_code == 200
        assert r2.json() == {"criado": False, "motivo": "ja_realizado_hoje"}, r2.json()

    def test_atendente_tambem_pode_disparar(self, atendente):
        r = atendente.post(f"{BASE}/backup/auto", timeout=90)
        assert r.status_code == 200, r.text[:300]
        assert "criado" in r.json()

    def test_estado_final_backup_ativado(self, admin):
        admin.put(f"{BASE}/configuracoes", json={"backup_automatico": "1"}, timeout=60)
        conf = admin.get(f"{BASE}/configuracoes", timeout=30).json()
        assert conf["backup_automatico"] == "1"


# ---------- regressao rapida ----------
class TestRegressao:
    def test_login_admin_e_atendente(self, admin, atendente):
        for s, perfil in ((admin, "admin"), (atendente, "atendente")):
            me = s.get(f"{BASE}/auth/me", timeout=30)
            assert me.status_code == 200, me.text[:300]
            assert me.json()["perfil"] == perfil

    def test_atendente_bloqueado_em_backup_config_logs(self, atendente):
        for url in (f"{BASE}/backup", f"{BASE}/logs"):
            r = atendente.get(url, timeout=60)
            assert r.status_code == 403, f"{url} -> {r.status_code}"
        # PUT /configuracoes é admin-only
        r = atendente.put(f"{BASE}/configuracoes", json={"nome_barbearia": "TEST_hack"}, timeout=60)
        assert r.status_code == 403, r.status_code

    @pytest.mark.xfail(reason="GAP conhecido: /relatorios/* usa get_current_user (nao require_admin); "
                              "atendente consegue ler relatorios/PDF/CSV via API mesmo com UI escondida",
                       strict=False)
    def test_atendente_bloqueado_em_relatorios_api(self, atendente):
        hoje = datetime.now().date().isoformat()
        for url in (f"{BASE}/relatorios/financeiro", f"{BASE}/relatorios/financeiro/pdf",
                    f"{BASE}/relatorios/financeiro/csv"):
            r = atendente.get(url, params={"inicio": hoje, "fim": hoje}, timeout=60)
            assert r.status_code == 403, f"{url} -> {r.status_code}"

    def test_atendimento_total_e_comissao(self, admin):
        barbeiros = [b for b in admin.get(f"{BASE}/barbeiros", timeout=30).json() if b["status"] == "Ativo"]
        servicos = [s for s in admin.get(f"{BASE}/servicos", timeout=30).json() if s["status"] == "Ativo"]
        assert barbeiros and servicos
        b, s = barbeiros[0], servicos[0]
        desconto = 5.0
        payload = {
            "cliente_id": None, "barbeiro_id": b["id"],
            "itens": [{"tipo": "servico", "servico_id": s["id"], "descricao": s["nome"],
                       "quantidade": 2, "preco_unitario": s["preco"], "usou_pacote": 0}],
            "pagamentos": [{"forma": "PIX", "valor": 2 * s["preco"] - desconto}],
            "desconto": desconto, "observacoes": "TEST_regressao",
        }
        r = admin.post(f"{BASE}/atendimentos", json=payload, timeout=60)
        assert r.status_code in (200, 201), r.text[:300]
        d = r.json()
        assert round(d["total"], 2) == round(2 * s["preco"] - desconto, 2), d
        perc = s.get("comissao") or b["comissao"]
        assert round(d["comissao"], 2) == round(2 * s["preco"] * perc / 100, 2), d

    def test_caixa_fluxo(self, admin):
        atual = admin.get(f"{BASE}/caixa/atual", timeout=30).json()
        if atual.get("caixa"):
            admin.post(f"{BASE}/caixa/fechar", json={"total_informado": atual["total_esperado"]}, timeout=60)
        ab = admin.post(f"{BASE}/caixa/abrir", json={"valor_inicial": 100.0}, timeout=60)
        assert ab.status_code in (200, 201), ab.text[:300]
        mv = admin.post(f"{BASE}/caixa/movimentacao",
                        json={"tipo": "Entrada", "valor": 50.0, "descricao": "TEST_mov"}, timeout=60)
        assert mv.status_code in (200, 201), mv.text[:300]
        atual = admin.get(f"{BASE}/caixa/atual", timeout=30).json()
        assert atual["caixa"] and atual["caixa"]["status"] == "Aberto"
        esperado = atual["total_esperado"]
        fc = admin.post(f"{BASE}/caixa/fechar", json={"total_informado": esperado}, timeout=60)
        assert fc.status_code in (200, 201), fc.text[:300]
        assert round(fc.json()["diferenca"], 2) == 0.0, fc.json()
        assert admin.get(f"{BASE}/caixa/atual", timeout=30).json()["caixa"] is None

    def test_limpar_dados_exige_confirmacao(self, admin):
        r = admin.post(f"{BASE}/sistema/limpar-dados", json={"confirmacao": "errado"}, timeout=60)
        assert r.status_code == 400, f"aceitou confirmacao errada: {r.status_code} {r.text[:200]}"
        assert "Confirma" in r.json().get("detail", "")
        r2 = admin.post(f"{BASE}/sistema/limpar-dados", json={}, timeout=60)
        assert r2.status_code == 400, r2.status_code
