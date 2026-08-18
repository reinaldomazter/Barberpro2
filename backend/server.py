from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import csv
import io
import os
import shutil
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from starlette.middleware.cors import CORSMiddleware

from auth import (create_access_token, get_current_user, hash_password, require_admin,
                  seed_admin, verify_password)
from db import (BACKUP_DIR, DB_PATH, get_conn, init_db, log, now_iso, today_str)
from seed import seed_demo

app = FastAPI(title="BarberPro")
api = APIRouter(prefix="/api")

FORMAS = ["Dinheiro", "PIX", "Cartão de Débito", "Cartão de Crédito", "Outros"]


def rows(cur):
    return [dict(r) for r in cur.fetchall()]


def one(cur):
    r = cur.fetchone()
    return dict(r) if r else None


# ---------------- AUTH ----------------
class LoginIn(BaseModel):
    usuario: str
    senha: str


@api.post("/auth/login")
def login(body: LoginIn):
    conn = get_conn()
    u = one(conn.execute("SELECT * FROM usuarios WHERE usuario=?", (body.usuario.strip().lower(),)))
    if not u or not verify_password(body.senha, u["senha_hash"]):
        conn.close()
        raise HTTPException(status_code=401, detail="Usuário ou senha inválidos")
    if not u["ativo"]:
        conn.close()
        raise HTTPException(status_code=403, detail="Usuário inativo")
    log(conn, u["usuario"], "login", "")
    conn.commit()
    conn.close()
    token = create_access_token(u["id"], u["usuario"], u["perfil"])
    return {"token": token, "user": {"id": u["id"], "usuario": u["usuario"], "nome": u["nome"], "perfil": u["perfil"]}}


@api.get("/auth/me")
def me(user=Depends(get_current_user)):
    return user


class ChangePwd(BaseModel):
    senha_atual: str
    nova_senha: str


@api.post("/auth/change-password")
def change_password(body: ChangePwd, user=Depends(get_current_user)):
    conn = get_conn()
    u = one(conn.execute("SELECT * FROM usuarios WHERE id=?", (user["id"],)))
    if not verify_password(body.senha_atual, u["senha_hash"]):
        conn.close()
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    if len(body.nova_senha) < 4:
        conn.close()
        raise HTTPException(status_code=400, detail="Nova senha muito curta")
    conn.execute("UPDATE usuarios SET senha_hash=? WHERE id=?", (hash_password(body.nova_senha), user["id"]))
    log(conn, user["usuario"], "alterar_senha", "")
    conn.commit()
    conn.close()
    return {"ok": True}


class UsuarioIn(BaseModel):
    usuario: str
    nome: str
    senha: Optional[str] = None
    perfil: str = "atendente"
    ativo: int = 1


@api.get("/usuarios")
def list_usuarios(user=Depends(require_admin)):
    conn = get_conn()
    data = rows(conn.execute("SELECT id, usuario, nome, perfil, ativo, criado_em FROM usuarios ORDER BY id"))
    conn.close()
    return data


@api.post("/usuarios")
def create_usuario(body: UsuarioIn, user=Depends(require_admin)):
    conn = get_conn()
    if one(conn.execute("SELECT id FROM usuarios WHERE usuario=?", (body.usuario.strip().lower(),))):
        conn.close()
        raise HTTPException(status_code=400, detail="Usuário já existe")
    cur = conn.execute(
        "INSERT INTO usuarios (usuario, nome, senha_hash, perfil, ativo, criado_em) VALUES (?,?,?,?,?,?)",
        (body.usuario.strip().lower(), body.nome, hash_password(body.senha or "123456"), body.perfil, body.ativo, now_iso()),
    )
    conn.commit()
    uid = cur.lastrowid
    conn.close()
    return {"id": uid}


@api.put("/usuarios/{uid}")
def update_usuario(uid: int, body: UsuarioIn, user=Depends(require_admin)):
    conn = get_conn()
    conn.execute("UPDATE usuarios SET nome=?, perfil=?, ativo=? WHERE id=?", (body.nome, body.perfil, body.ativo, uid))
    if body.senha:
        conn.execute("UPDATE usuarios SET senha_hash=? WHERE id=?", (hash_password(body.senha), uid))
    conn.commit()
    conn.close()
    return {"ok": True}


@api.delete("/usuarios/{uid}")
def delete_usuario(uid: int, user=Depends(require_admin)):
    if uid == user["id"]:
        raise HTTPException(status_code=400, detail="Não é possível excluir o próprio usuário")
    conn = get_conn()
    conn.execute("DELETE FROM usuarios WHERE id=?", (uid,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ---------------- GENERIC CRUD ----------------
CRUD = {
    "barbeiros": ["nome", "cpf", "telefone", "nascimento", "endereco", "comissao", "status", "observacoes"],
    "servicos": ["nome", "descricao", "preco", "comissao", "duracao", "status"],
    "clientes": ["nome", "cpf", "telefone", "whatsapp", "nascimento", "endereco", "observacoes"],
    "produtos": ["nome", "categoria", "preco", "custo", "estoque", "estoque_minimo", "status"],
    "despesas": ["descricao", "categoria", "valor", "data", "forma_pagamento", "observacao"],
}


def crud_endpoints(table: str, fields: List[str]):
    @api.get(f"/{table}", name=f"list_{table}")
    def _list(q: Optional[str] = None, user=Depends(get_current_user)):
        conn = get_conn()
        sql = f"SELECT * FROM {table}"
        params = []
        if q:
            col = "descricao" if table == "despesas" else "nome"
            sql += f" WHERE {col} LIKE ?"
            params.append(f"%{q}%")
            if table == "clientes":
                sql += " OR telefone LIKE ?"
                params.append(f"%{q}%")
        sql += " ORDER BY id DESC" if table == "despesas" else " ORDER BY nome"
        data = rows(conn.execute(sql, params))
        conn.close()
        return data

    @api.post(f"/{table}", name=f"create_{table}")
    def _create(body: dict, user=Depends(get_current_user)):
        vals = [body.get(f) for f in fields]
        conn = get_conn()
        cols = ", ".join(fields) + ", criado_em"
        ph = ", ".join(["?"] * len(fields)) + ", ?"
        cur = conn.execute(f"INSERT INTO {table} ({cols}) VALUES ({ph})", vals + [now_iso()])
        log(conn, user["usuario"], f"criar_{table}", str(body.get("nome") or body.get("descricao")))
        conn.commit()
        new_id = cur.lastrowid
        conn.close()
        return {"id": new_id}

    @api.put(f"/{table}/{{item_id}}", name=f"update_{table}")
    def _update(item_id: int, body: dict, user=Depends(get_current_user)):
        conn = get_conn()
        sets = ", ".join([f"{f}=?" for f in fields])
        conn.execute(f"UPDATE {table} SET {sets} WHERE id=?", [body.get(f) for f in fields] + [item_id])
        log(conn, user["usuario"], f"editar_{table}", str(item_id))
        conn.commit()
        conn.close()
        return {"ok": True}

    @api.delete(f"/{table}/{{item_id}}", name=f"delete_{table}")
    def _delete(item_id: int, user=Depends(get_current_user)):
        conn = get_conn()
        try:
            conn.execute(f"DELETE FROM {table} WHERE id=?", (item_id,))
            conn.commit()
        except Exception:
            conn.close()
            raise HTTPException(status_code=400, detail="Registro possui vínculos e não pode ser excluído")
        conn.close()
        return {"ok": True}


for t, f in CRUD.items():
    crud_endpoints(t, f)


@api.get("/clientes/{cid}/historico")
def cliente_historico(cid: int, user=Depends(get_current_user)):
    conn = get_conn()
    atend = rows(conn.execute(
        """SELECT a.*, b.nome AS barbeiro FROM atendimentos a
           LEFT JOIN barbeiros b ON b.id=a.barbeiro_id WHERE a.cliente_id=? ORDER BY a.data DESC""", (cid,)))
    for a in atend:
        a["itens"] = rows(conn.execute("SELECT * FROM itens_atendimento WHERE atendimento_id=?", (a["id"],)))
        a["pagamentos"] = rows(conn.execute("SELECT * FROM pagamentos WHERE atendimento_id=?", (a["id"],)))
    pacotes = rows(conn.execute(
        """SELECT cp.*, p.nome FROM clientes_pacotes cp JOIN pacotes p ON p.id=cp.pacote_id
           WHERE cp.cliente_id=? ORDER BY cp.id DESC""", (cid,)))
    for p in pacotes:
        p["saldos"] = rows(conn.execute(
            """SELECT s.*, sv.nome AS servico FROM clientes_pacotes_saldo s JOIN servicos sv ON sv.id=s.servico_id
               WHERE s.cliente_pacote_id=?""", (p["id"],)))
    total = sum(a["total"] for a in atend)
    conn.close()
    return {"atendimentos": atend, "pacotes": pacotes, "total_gasto": total, "qtd": len(atend)}


# ---------------- PACOTES ----------------
@api.get("/pacotes")
def list_pacotes(user=Depends(get_current_user)):
    conn = get_conn()
    data = rows(conn.execute("SELECT * FROM pacotes ORDER BY nome"))
    for p in data:
        p["itens"] = rows(conn.execute(
            """SELECT i.*, s.nome AS servico FROM pacote_itens i JOIN servicos s ON s.id=i.servico_id
               WHERE i.pacote_id=?""", (p["id"],)))
    conn.close()
    return data


class PacoteIn(BaseModel):
    nome: str
    valor: float = 0
    validade_dias: int = 30
    status: str = "Ativo"
    itens: List[dict] = []


@api.post("/pacotes")
def create_pacote(body: PacoteIn, user=Depends(require_admin)):
    conn = get_conn()
    cur = conn.execute("INSERT INTO pacotes (nome, valor, validade_dias, status, criado_em) VALUES (?,?,?,?,?)",
                       (body.nome, body.valor, body.validade_dias, body.status, now_iso()))
    pid = cur.lastrowid
    for it in body.itens:
        conn.execute("INSERT INTO pacote_itens (pacote_id, servico_id, quantidade) VALUES (?,?,?)",
                     (pid, int(it["servico_id"]), int(it.get("quantidade", 1))))
    conn.commit()
    conn.close()
    return {"id": pid}


@api.put("/pacotes/{pid}")
def update_pacote(pid: int, body: PacoteIn, user=Depends(require_admin)):
    conn = get_conn()
    conn.execute("UPDATE pacotes SET nome=?, valor=?, validade_dias=?, status=? WHERE id=?",
                 (body.nome, body.valor, body.validade_dias, body.status, pid))
    conn.execute("DELETE FROM pacote_itens WHERE pacote_id=?", (pid,))
    for it in body.itens:
        conn.execute("INSERT INTO pacote_itens (pacote_id, servico_id, quantidade) VALUES (?,?,?)",
                     (pid, int(it["servico_id"]), int(it.get("quantidade", 1))))
    conn.commit()
    conn.close()
    return {"ok": True}


@api.delete("/pacotes/{pid}")
def delete_pacote(pid: int, user=Depends(require_admin)):
    conn = get_conn()
    if one(conn.execute("SELECT id FROM clientes_pacotes WHERE pacote_id=?", (pid,))):
        conn.close()
        raise HTTPException(status_code=400, detail="Pacote já contratado por clientes")
    conn.execute("DELETE FROM pacote_itens WHERE pacote_id=?", (pid,))
    conn.execute("DELETE FROM pacotes WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    return {"ok": True}


class ContratarIn(BaseModel):
    cliente_id: int
    pacote_id: int


@api.post("/clientes-pacotes")
def contratar_pacote(body: ContratarIn, user=Depends(get_current_user)):
    conn = get_conn()
    p = one(conn.execute("SELECT * FROM pacotes WHERE id=?", (body.pacote_id,)))
    if not p:
        conn.close()
        raise HTTPException(status_code=404, detail="Pacote não encontrado")
    venc = (datetime.now() + timedelta(days=int(p["validade_dias"]))).strftime("%Y-%m-%d")
    cur = conn.execute(
        """INSERT INTO clientes_pacotes (cliente_id, pacote_id, data_contratacao, data_vencimento, valor, status)
           VALUES (?,?,?,?,?, 'Ativo')""", (body.cliente_id, body.pacote_id, today_str(), venc, p["valor"]))
    cpid = cur.lastrowid
    for it in rows(conn.execute("SELECT * FROM pacote_itens WHERE pacote_id=?", (body.pacote_id,))):
        conn.execute("INSERT INTO clientes_pacotes_saldo (cliente_pacote_id, servico_id, total, utilizados) VALUES (?,?,?,0)",
                     (cpid, it["servico_id"], it["quantidade"]))
    log(conn, user["usuario"], "contratar_pacote", f"cliente {body.cliente_id} pacote {p['nome']}")
    conn.commit()
    conn.close()
    return {"id": cpid}


@api.get("/clientes-pacotes")
def list_clientes_pacotes(cliente_id: Optional[int] = None, user=Depends(get_current_user)):
    conn = get_conn()
    sql = """SELECT cp.*, p.nome AS pacote, c.nome AS cliente FROM clientes_pacotes cp
             JOIN pacotes p ON p.id=cp.pacote_id JOIN clientes c ON c.id=cp.cliente_id"""
    params = []
    if cliente_id:
        sql += " WHERE cp.cliente_id=?"
        params.append(cliente_id)
    data = rows(conn.execute(sql + " ORDER BY cp.id DESC", params))
    for p in data:
        p["saldos"] = rows(conn.execute(
            """SELECT s.*, sv.nome AS servico FROM clientes_pacotes_saldo s JOIN servicos sv ON sv.id=s.servico_id
               WHERE s.cliente_pacote_id=?""", (p["id"],)))
    conn.close()
    return data


# ---------------- AGENDAMENTOS ----------------
class AgIn(BaseModel):
    cliente_id: int
    barbeiro_id: int
    servico_id: int
    data: str
    hora: str
    observacoes: Optional[str] = None
    status: str = "Agendado"


@api.get("/agendamentos")
def list_ag(inicio: Optional[str] = None, fim: Optional[str] = None, user=Depends(get_current_user)):
    conn = get_conn()
    sql = """SELECT a.*, c.nome AS cliente, c.telefone, b.nome AS barbeiro, s.nome AS servico, s.preco, s.duracao
             FROM agendamentos a JOIN clientes c ON c.id=a.cliente_id JOIN barbeiros b ON b.id=a.barbeiro_id
             JOIN servicos s ON s.id=a.servico_id"""
    params = []
    if inicio and fim:
        sql += " WHERE a.data BETWEEN ? AND ?"
        params = [inicio, fim]
    data = rows(conn.execute(sql + " ORDER BY a.data, a.hora", params))
    conn.close()
    return data


@api.post("/agendamentos")
def create_ag(body: AgIn, user=Depends(get_current_user)):
    conn = get_conn()
    conflito = one(conn.execute(
        """SELECT id FROM agendamentos WHERE barbeiro_id=? AND data=? AND hora=? AND status NOT IN ('Cancelado','Faltou')""",
        (body.barbeiro_id, body.data, body.hora)))
    if conflito:
        conn.close()
        raise HTTPException(status_code=400, detail="Este barbeiro já possui agendamento neste horário")
    cur = conn.execute(
        """INSERT INTO agendamentos (cliente_id, barbeiro_id, servico_id, data, hora, observacoes, status, criado_em)
           VALUES (?,?,?,?,?,?,?,?)""",
        (body.cliente_id, body.barbeiro_id, body.servico_id, body.data, body.hora, body.observacoes, body.status, now_iso()))
    conn.commit()
    aid = cur.lastrowid
    conn.close()
    return {"id": aid}


@api.put("/agendamentos/{aid}")
def update_ag(aid: int, body: AgIn, user=Depends(get_current_user)):
    conn = get_conn()
    conflito = one(conn.execute(
        """SELECT id FROM agendamentos WHERE barbeiro_id=? AND data=? AND hora=? AND id<>?
           AND status NOT IN ('Cancelado','Faltou')""", (body.barbeiro_id, body.data, body.hora, aid)))
    if conflito:
        conn.close()
        raise HTTPException(status_code=400, detail="Este barbeiro já possui agendamento neste horário")
    conn.execute("""UPDATE agendamentos SET cliente_id=?, barbeiro_id=?, servico_id=?, data=?, hora=?,
                    observacoes=?, status=? WHERE id=?""",
                 (body.cliente_id, body.barbeiro_id, body.servico_id, body.data, body.hora,
                  body.observacoes, body.status, aid))
    conn.commit()
    conn.close()
    return {"ok": True}


@api.patch("/agendamentos/{aid}/status")
def status_ag(aid: int, body: dict, user=Depends(get_current_user)):
    conn = get_conn()
    conn.execute("UPDATE agendamentos SET status=? WHERE id=?", (body.get("status"), aid))
    conn.commit()
    conn.close()
    return {"ok": True}


@api.delete("/agendamentos/{aid}")
def delete_ag(aid: int, user=Depends(get_current_user)):
    conn = get_conn()
    conn.execute("DELETE FROM agendamentos WHERE id=?", (aid,))
    conn.commit()
    conn.close()
    return {"ok": True}


# ---------------- CAIXA ----------------
def caixa_aberto(conn):
    return one(conn.execute("SELECT * FROM caixa WHERE status='Aberto' ORDER BY id DESC LIMIT 1"))


@api.get("/caixa/atual")
def caixa_atual(user=Depends(get_current_user)):
    conn = get_conn()
    c = caixa_aberto(conn)
    if not c:
        conn.close()
        return {"caixa": None}
    movs = rows(conn.execute("SELECT * FROM movimentacoes_caixa WHERE caixa_id=? ORDER BY id DESC", (c["id"],)))
    at = rows(conn.execute("SELECT * FROM atendimentos WHERE caixa_id=?", (c["id"],)))
    pagamentos = rows(conn.execute(
        """SELECT p.* FROM pagamentos p JOIN atendimentos a ON a.id=p.atendimento_id WHERE a.caixa_id=?""", (c["id"],)))
    por_forma = {f: 0.0 for f in FORMAS}
    for p in pagamentos:
        por_forma[p["forma"]] = por_forma.get(p["forma"], 0) + p["valor"]
    for m in movs:
        if m["tipo"] in ("Entrada", "Reforço"):
            por_forma["Dinheiro"] = por_forma.get("Dinheiro", 0) + m["valor"]
        elif m["tipo"] in ("Saída", "Sangria"):
            por_forma["Dinheiro"] = por_forma.get("Dinheiro", 0) - m["valor"]
    total_vendido = sum(a["total"] for a in at)
    comissoes = sum(a["comissao"] for a in at)
    despesas = sum(m["valor"] for m in movs if m["tipo"] in ("Saída", "Sangria"))
    conn.close()
    return {"caixa": c, "movimentacoes": movs, "por_forma": por_forma, "total_vendido": total_vendido,
            "comissoes": comissoes, "despesas": despesas,
            "saldo_dinheiro": c["valor_inicial"] + por_forma.get("Dinheiro", 0),
            "total_esperado": c["valor_inicial"] + sum(por_forma.values())}


@api.get("/caixa")
def list_caixa(user=Depends(get_current_user)):
    conn = get_conn()
    data = rows(conn.execute("SELECT * FROM caixa ORDER BY id DESC LIMIT 50"))
    conn.close()
    return data


@api.post("/caixa/abrir")
def abrir_caixa(body: dict, user=Depends(get_current_user)):
    conn = get_conn()
    if caixa_aberto(conn):
        conn.close()
        raise HTTPException(status_code=400, detail="Já existe um caixa aberto")
    cur = conn.execute("INSERT INTO caixa (data_abertura, valor_inicial, usuario_abertura, status) VALUES (?,?,?, 'Aberto')",
                       (now_iso(), float(body.get("valor_inicial", 0)), user["nome"]))
    log(conn, user["usuario"], "abrir_caixa", str(body.get("valor_inicial")))
    conn.commit()
    cid = cur.lastrowid
    conn.close()
    return {"id": cid}


@api.post("/caixa/movimentacao")
def mov_caixa(body: dict, user=Depends(get_current_user)):
    conn = get_conn()
    c = caixa_aberto(conn)
    if not c:
        conn.close()
        raise HTTPException(status_code=400, detail="Nenhum caixa aberto")
    conn.execute("""INSERT INTO movimentacoes_caixa (caixa_id, tipo, descricao, valor, forma, data, usuario_id)
                    VALUES (?,?,?,?,?,?,?)""",
                 (c["id"], body["tipo"], body.get("descricao"), float(body["valor"]),
                  body.get("forma", "Dinheiro"), now_iso(), user["id"]))
    conn.commit()
    conn.close()
    return {"ok": True}


@api.post("/caixa/fechar")
def fechar_caixa(body: dict, user=Depends(get_current_user)):
    resumo = caixa_atual(user)
    if not resumo["caixa"]:
        raise HTTPException(status_code=400, detail="Nenhum caixa aberto")
    informado = float(body.get("total_informado", 0))
    esperado = resumo["total_esperado"]
    conn = get_conn()
    import json
    conn.execute("""UPDATE caixa SET status='Fechado', data_fechamento=?, total_informado=?, total_esperado=?,
                    diferenca=?, fechamento_json=?, usuario_fechamento=? WHERE id=?""",
                 (now_iso(), informado, esperado, informado - esperado,
                  json.dumps(resumo["por_forma"]), user["nome"], resumo["caixa"]["id"]))
    log(conn, user["usuario"], "fechar_caixa", f"esperado {esperado} informado {informado}")
    conn.commit()
    conn.close()
    return {"ok": True, "esperado": esperado, "informado": informado, "diferenca": informado - esperado}


# ---------------- ATENDIMENTOS ----------------
class ItemIn(BaseModel):
    tipo: str
    servico_id: Optional[int] = None
    produto_id: Optional[int] = None
    descricao: str
    quantidade: float = 1
    preco_unitario: float = 0
    usou_pacote: int = 0


class PagIn(BaseModel):
    forma: str
    valor: float


class AtendIn(BaseModel):
    cliente_id: Optional[int] = None
    barbeiro_id: int
    agendamento_id: Optional[int] = None
    itens: List[ItemIn]
    pagamentos: List[PagIn] = []
    desconto: float = 0
    observacoes: Optional[str] = None


@api.get("/atendimentos")
def list_atend(inicio: Optional[str] = None, fim: Optional[str] = None, user=Depends(get_current_user)):
    conn = get_conn()
    sql = """SELECT a.*, c.nome AS cliente, b.nome AS barbeiro FROM atendimentos a
             LEFT JOIN clientes c ON c.id=a.cliente_id LEFT JOIN barbeiros b ON b.id=a.barbeiro_id"""
    params = []
    if inicio and fim:
        sql += " WHERE date(a.data) BETWEEN ? AND ?"
        params = [inicio, fim]
    data = rows(conn.execute(sql + " ORDER BY a.id DESC LIMIT 300", params))
    for a in data:
        a["itens"] = rows(conn.execute("SELECT * FROM itens_atendimento WHERE atendimento_id=?", (a["id"],)))
        a["pagamentos"] = rows(conn.execute("SELECT * FROM pagamentos WHERE atendimento_id=?", (a["id"],)))
    conn.close()
    return data


@api.post("/atendimentos")
def create_atend(body: AtendIn, user=Depends(get_current_user)):
    conn = get_conn()
    barbeiro = one(conn.execute("SELECT * FROM barbeiros WHERE id=?", (body.barbeiro_id,)))
    if not barbeiro:
        conn.close()
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado")
    caixa = caixa_aberto(conn)
    subtotal = 0.0
    base_comissao = 0.0
    for it in body.itens:
        total_item = 0 if it.usou_pacote else it.quantidade * it.preco_unitario
        subtotal += total_item
        if it.tipo == "servico":
            sv = one(conn.execute("SELECT * FROM servicos WHERE id=?", (it.servico_id,))) if it.servico_id else None
            perc = sv["comissao"] if sv and sv["comissao"] not in (None, "") else barbeiro["comissao"]
            base_comissao += (total_item if not it.usou_pacote else it.quantidade * it.preco_unitario) * float(perc) / 100.0
    total = max(subtotal - (body.desconto or 0), 0)
    comissao = round(base_comissao, 2)
    data = now_iso()
    cur = conn.execute("""INSERT INTO atendimentos (cliente_id, barbeiro_id, agendamento_id, data, subtotal, desconto,
                          total, comissao, observacoes, usuario_id, caixa_id, criado_em)
                          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
                       (body.cliente_id, body.barbeiro_id, body.agendamento_id, data, subtotal, body.desconto or 0,
                        total, comissao, body.observacoes, user["id"], caixa["id"] if caixa else None, data))
    aid = cur.lastrowid
    for it in body.itens:
        total_item = 0 if it.usou_pacote else it.quantidade * it.preco_unitario
        conn.execute("""INSERT INTO itens_atendimento (atendimento_id, tipo, servico_id, produto_id, descricao,
                        quantidade, preco_unitario, total, usou_pacote) VALUES (?,?,?,?,?,?,?,?,?)""",
                     (aid, it.tipo, it.servico_id, it.produto_id, it.descricao, it.quantidade,
                      it.preco_unitario, total_item, it.usou_pacote))
        if it.tipo == "produto" and it.produto_id:
            conn.execute("UPDATE produtos SET estoque = estoque - ? WHERE id=?", (it.quantidade, it.produto_id))
            conn.execute("""INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, motivo, usuario_id, data)
                            VALUES (?,'Saída',?,?,?,?)""",
                         (it.produto_id, it.quantidade, f"Venda atendimento #{aid}", user["id"], data))
        if it.usou_pacote and it.servico_id and body.cliente_id:
            saldo = one(conn.execute(
                """SELECT s.* FROM clientes_pacotes_saldo s JOIN clientes_pacotes cp ON cp.id=s.cliente_pacote_id
                   WHERE cp.cliente_id=? AND cp.status='Ativo' AND s.servico_id=? AND s.utilizados < s.total
                   ORDER BY cp.data_vencimento LIMIT 1""", (body.cliente_id, it.servico_id)))
            if not saldo:
                conn.close()
                raise HTTPException(status_code=400, detail="Cliente não possui saldo de pacote para este serviço")
            conn.execute("UPDATE clientes_pacotes_saldo SET utilizados = utilizados + 1 WHERE id=?", (saldo["id"],))
    for p in body.pagamentos:
        conn.execute("INSERT INTO pagamentos (atendimento_id, forma, valor, data) VALUES (?,?,?,?)",
                     (aid, p.forma, p.valor, data))
    if comissao > 0:
        conn.execute("""INSERT INTO comissoes (barbeiro_id, atendimento_id, percentual, base, valor, data)
                        VALUES (?,?,?,?,?,?)""",
                     (body.barbeiro_id, aid, barbeiro["comissao"], subtotal, comissao, data))
    if body.cliente_id:
        conn.execute("UPDATE clientes SET ultimo_atendimento=? WHERE id=?", (data, body.cliente_id))
    if body.agendamento_id:
        conn.execute("UPDATE agendamentos SET status='Concluído' WHERE id=?", (body.agendamento_id,))
    log(conn, user["usuario"], "finalizar_atendimento", f"#{aid} total {total}")
    conn.commit()
    conn.close()
    return {"id": aid, "total": total, "comissao": comissao}


# ---------------- ESTOQUE ----------------
@api.get("/estoque/movimentacoes")
def list_movs(user=Depends(get_current_user)):
    conn = get_conn()
    data = rows(conn.execute("""SELECT m.*, p.nome AS produto FROM movimentacoes_estoque m
                                JOIN produtos p ON p.id=m.produto_id ORDER BY m.id DESC LIMIT 200"""))
    conn.close()
    return data


@api.post("/estoque/movimentacoes")
def create_mov(body: dict, user=Depends(get_current_user)):
    tipo = body["tipo"]
    qtd = float(body["quantidade"])
    pid = int(body["produto_id"])
    conn = get_conn()
    if tipo == "Entrada":
        conn.execute("UPDATE produtos SET estoque = estoque + ? WHERE id=?", (qtd, pid))
    elif tipo == "Saída":
        conn.execute("UPDATE produtos SET estoque = estoque - ? WHERE id=?", (qtd, pid))
    else:
        conn.execute("UPDATE produtos SET estoque = ? WHERE id=?", (qtd, pid))
    conn.execute("""INSERT INTO movimentacoes_estoque (produto_id, tipo, quantidade, motivo, usuario_id, data)
                    VALUES (?,?,?,?,?,?)""", (pid, tipo, qtd, body.get("motivo"), user["id"], now_iso()))
    conn.commit()
    conn.close()
    return {"ok": True}


# ---------------- DASHBOARD ----------------
@api.get("/dashboard")
def dashboard(user=Depends(get_current_user)):
    conn = get_conn()
    hoje = today_str()
    mes = hoje[:7]

    def pagamentos_por_forma(where, params):
        res = {f: 0.0 for f in FORMAS}
        for r in rows(conn.execute(f"SELECT forma, SUM(valor) v FROM pagamentos WHERE {where} GROUP BY forma", params)):
            res[r["forma"]] = r["v"] or 0
        return res

    fat_dia = one(conn.execute("SELECT COALESCE(SUM(total),0) t, COUNT(*) c FROM atendimentos WHERE date(data)=?", (hoje,)))
    fat_mes = one(conn.execute("SELECT COALESCE(SUM(total),0) t, COUNT(*) c FROM atendimentos WHERE substr(data,1,7)=?", (mes,)))
    formas = pagamentos_por_forma("date(data)=?", (hoje,))
    comissoes = one(conn.execute("SELECT COALESCE(SUM(valor),0) t FROM comissoes WHERE date(data)=?", (hoje,)))["t"]
    despesas = one(conn.execute("SELECT COALESCE(SUM(valor),0) t FROM despesas WHERE data=?", (hoje,)))["t"]
    clientes = one(conn.execute("SELECT COUNT(*) c FROM clientes"))["c"]
    proximos = rows(conn.execute(
        """SELECT a.*, c.nome AS cliente, b.nome AS barbeiro, s.nome AS servico FROM agendamentos a
           JOIN clientes c ON c.id=a.cliente_id JOIN barbeiros b ON b.id=a.barbeiro_id JOIN servicos s ON s.id=a.servico_id
           WHERE a.data >= ? AND a.status IN ('Agendado','Confirmado','Em atendimento')
           ORDER BY a.data, a.hora LIMIT 8""", (hoje,)))
    fat_diario = rows(conn.execute(
        """SELECT date(data) dia, SUM(total) total FROM atendimentos
           WHERE date(data) >= date('now','-13 days') GROUP BY dia ORDER BY dia"""))
    fat_mensal = rows(conn.execute(
        """SELECT substr(data,1,7) mes, SUM(total) total FROM atendimentos GROUP BY mes ORDER BY mes DESC LIMIT 6"""))
    top_servicos = rows(conn.execute(
        """SELECT descricao nome, COUNT(*) qtd, SUM(total) total FROM itens_atendimento
           WHERE tipo='servico' GROUP BY descricao ORDER BY qtd DESC LIMIT 6"""))
    barbeiros = rows(conn.execute(
        """SELECT b.nome, COUNT(a.id) atendimentos, COALESCE(SUM(a.total),0) faturamento,
                  COALESCE(SUM(a.comissao),0) comissao FROM barbeiros b
           LEFT JOIN atendimentos a ON a.barbeiro_id=b.id AND substr(a.data,1,7)=?
           GROUP BY b.id ORDER BY faturamento DESC""", (mes,)))
    alertas = rows(conn.execute("SELECT nome, estoque, estoque_minimo FROM produtos WHERE estoque <= estoque_minimo"))
    conn.close()
    return {
        "faturamento_dia": fat_dia["t"], "atendimentos_dia": fat_dia["c"],
        "faturamento_mes": fat_mes["t"], "atendimentos_mes": fat_mes["c"],
        "clientes": clientes, "formas": formas, "comissoes_dia": comissoes, "despesas_dia": despesas,
        "lucro_estimado": fat_dia["t"] - comissoes - despesas,
        "proximos": proximos, "fat_diario": fat_diario, "fat_mensal": list(reversed(fat_mensal)),
        "top_servicos": top_servicos, "barbeiros": barbeiros, "alertas_estoque": alertas,
    }


# ---------------- RELATORIOS ----------------
def relatorio_data(tipo: str, inicio: str, fim: str):
    conn = get_conn()
    r = {}
    if tipo == "financeiro":
        r["diario"] = rows(conn.execute(
            """SELECT date(data) periodo, COUNT(*) atendimentos, SUM(total) faturamento FROM atendimentos
               WHERE date(data) BETWEEN ? AND ? GROUP BY periodo ORDER BY periodo""", (inicio, fim)))
        r["mensal"] = rows(conn.execute(
            """SELECT substr(data,1,7) periodo, COUNT(*) atendimentos, SUM(total) faturamento FROM atendimentos
               WHERE date(data) BETWEEN ? AND ? GROUP BY periodo ORDER BY periodo""", (inicio, fim)))
        r["despesas"] = rows(conn.execute(
            """SELECT categoria, SUM(valor) valor FROM despesas WHERE data BETWEEN ? AND ?
               GROUP BY categoria ORDER BY valor DESC""", (inicio, fim)))
        fat = one(conn.execute("SELECT COALESCE(SUM(total),0) t FROM atendimentos WHERE date(data) BETWEEN ? AND ?", (inicio, fim)))["t"]
        desp = one(conn.execute("SELECT COALESCE(SUM(valor),0) t FROM despesas WHERE data BETWEEN ? AND ?", (inicio, fim)))["t"]
        com = one(conn.execute("SELECT COALESCE(SUM(valor),0) t FROM comissoes WHERE date(data) BETWEEN ? AND ?", (inicio, fim)))["t"]
        r["resumo"] = {"faturamento": fat, "despesas": desp, "comissoes": com, "lucro": fat - desp - com}
    elif tipo == "barbeiros":
        r["barbeiros"] = rows(conn.execute(
            """SELECT b.nome, COUNT(a.id) atendimentos, COALESCE(SUM(a.total),0) faturamento,
                      COALESCE(SUM(a.comissao),0) comissao FROM barbeiros b
               LEFT JOIN atendimentos a ON a.barbeiro_id=b.id AND date(a.data) BETWEEN ? AND ?
               GROUP BY b.id ORDER BY faturamento DESC""", (inicio, fim)))
    elif tipo == "clientes":
        r["cadastrados"] = rows(conn.execute(
            "SELECT nome, telefone, date(criado_em) cadastro FROM clientes WHERE date(criado_em) BETWEEN ? AND ?", (inicio, fim)))
        r["mais_gastam"] = rows(conn.execute(
            """SELECT c.nome, COUNT(a.id) atendimentos, COALESCE(SUM(a.total),0) total FROM clientes c
               JOIN atendimentos a ON a.cliente_id=c.id WHERE date(a.data) BETWEEN ? AND ?
               GROUP BY c.id ORDER BY total DESC LIMIT 20""", (inicio, fim)))
        r["inativos"] = rows(conn.execute(
            """SELECT nome, telefone, ultimo_atendimento FROM clientes
               WHERE ultimo_atendimento IS NULL OR date(ultimo_atendimento) < date('now','-30 days')"""))
    elif tipo == "servicos":
        r["servicos"] = rows(conn.execute(
            """SELECT i.descricao nome, COUNT(*) quantidade, SUM(i.total) faturamento
               FROM itens_atendimento i JOIN atendimentos a ON a.id=i.atendimento_id
               WHERE i.tipo='servico' AND date(a.data) BETWEEN ? AND ?
               GROUP BY i.descricao ORDER BY quantidade DESC""", (inicio, fim)))
    elif tipo == "produtos":
        r["vendidos"] = rows(conn.execute(
            """SELECT i.descricao nome, SUM(i.quantidade) quantidade, SUM(i.total) faturamento
               FROM itens_atendimento i JOIN atendimentos a ON a.id=i.atendimento_id
               WHERE i.tipo='produto' AND date(a.data) BETWEEN ? AND ?
               GROUP BY i.descricao ORDER BY quantidade DESC""", (inicio, fim)))
        r["estoque"] = rows(conn.execute("SELECT nome, categoria, estoque, estoque_minimo, preco FROM produtos ORDER BY nome"))
        r["abaixo_minimo"] = rows(conn.execute("SELECT nome, estoque, estoque_minimo FROM produtos WHERE estoque <= estoque_minimo"))
    else:
        conn.close()
        raise HTTPException(status_code=400, detail="Relatório inválido")
    conn.close()
    return r


@api.get("/relatorios/{tipo}")
def get_relatorio(tipo: str, inicio: str, fim: str, user=Depends(get_current_user)):
    return relatorio_data(tipo, inicio, fim)


@api.get("/relatorios/{tipo}/csv")
def get_relatorio_csv(tipo: str, inicio: str, fim: str, secao: Optional[str] = None, user=Depends(get_current_user)):
    data = relatorio_data(tipo, inicio, fim)
    key = secao if secao and secao in data else next(k for k in data if isinstance(data[k], list))
    lista = data[key]
    buf = io.StringIO()
    if lista:
        w = csv.DictWriter(buf, fieldnames=list(lista[0].keys()), delimiter=";")
        w.writeheader()
        w.writerows(lista)
    return StreamingResponse(io.BytesIO(buf.getvalue().encode("utf-8-sig")), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{tipo}_{key}_{inicio}_{fim}.csv"'})


# ---------------- CONFIGURACOES ----------------
@api.get("/configuracoes")
def get_config(user=Depends(get_current_user)):
    conn = get_conn()
    data = {r["chave"]: r["valor"] for r in conn.execute("SELECT * FROM configuracoes")}
    conn.close()
    return data


@api.put("/configuracoes")
def put_config(body: dict, user=Depends(require_admin)):
    conn = get_conn()
    for k, v in body.items():
        conn.execute("INSERT INTO configuracoes (chave, valor) VALUES (?,?) ON CONFLICT(chave) DO UPDATE SET valor=?",
                     (k, str(v), str(v)))
    log(conn, user["usuario"], "atualizar_configuracoes", "")
    conn.commit()
    conn.close()
    return {"ok": True}


# ---------------- BACKUP ----------------
@api.get("/backup")
def list_backups(user=Depends(require_admin)):
    conn = get_conn()
    data = rows(conn.execute("SELECT * FROM backups ORDER BY id DESC LIMIT 50"))
    conf = {r["chave"]: r["valor"] for r in conn.execute("SELECT * FROM configuracoes")}
    conn.close()
    return {"backups": data, "pasta": conf.get("backup_pasta", str(BACKUP_DIR)),
            "automatico": conf.get("backup_automatico", "0"), "banco": str(DB_PATH)}


@api.post("/backup")
def do_backup(body: dict = {}, user=Depends(require_admin)):
    pasta = Path(body.get("pasta") or str(BACKUP_DIR))
    pasta.mkdir(parents=True, exist_ok=True)
    nome = "backup_" + datetime.now().strftime("%d-%m-%Y_%H-%M-%S") + ".db"
    destino = pasta / nome
    conn = get_conn()
    dest_conn = __import__("sqlite3").connect(str(destino))
    with dest_conn:
        conn.backup(dest_conn)
    dest_conn.close()
    conn.execute("INSERT INTO backups (arquivo, caminho, tamanho, tipo, data) VALUES (?,?,?,?,?)",
                 (nome, str(destino), destino.stat().st_size, body.get("tipo", "manual"), now_iso()))
    log(conn, user["usuario"], "backup", nome)
    conn.commit()
    conn.close()
    return {"arquivo": nome, "caminho": str(destino)}


@api.post("/backup/restaurar")
def restaurar(body: dict, user=Depends(require_admin)):
    caminho = Path(body["caminho"])
    if not caminho.exists():
        raise HTTPException(status_code=404, detail="Arquivo de backup não encontrado")
    seguranca = BACKUP_DIR / ("pre_restauracao_" + datetime.now().strftime("%d-%m-%Y_%H-%M-%S") + ".db")
    shutil.copy(str(DB_PATH), str(seguranca))
    shutil.copy(str(caminho), str(DB_PATH))
    conn = get_conn()
    log(conn, user["usuario"], "restaurar_backup", str(caminho))
    conn.commit()
    conn.close()
    return {"ok": True, "backup_seguranca": str(seguranca)}


@api.get("/logs")
def list_logs(user=Depends(require_admin)):
    conn = get_conn()
    data = rows(conn.execute("SELECT * FROM logs ORDER BY id DESC LIMIT 200"))
    conn.close()
    return data


@api.get("/")
def root():
    return {"app": "BarberPro", "offline": True, "db": str(DB_PATH)}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    init_db()
    seed_admin()
    seed_demo()
