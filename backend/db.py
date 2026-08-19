import os
import sqlite3
import sys
from pathlib import Path
from datetime import datetime, timezone


def _default_data_dir() -> Path:
    # Quando empacotado (PyInstaller), __file__ aponta para uma pasta temporária:
    # os dados precisam ir para uma pasta permanente do usuário.
    if getattr(sys, "frozen", False):
        base = os.environ.get("APPDATA") or os.environ.get("LOCALAPPDATA") or str(Path.home())
        return Path(base) / "BarberPro" / "dados"
    return Path(__file__).parent / "data"


DATA_DIR = Path(os.environ.get("BARBERPRO_DATA_DIR") or _default_data_dir())
BACKUP_DIR = Path(os.environ.get("BARBERPRO_BACKUP_DIR") or str(DATA_DIR / "backups"))
DB_PATH = DATA_DIR / "barberpro.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def today_str():
    return datetime.now().strftime("%Y-%m-%d")


def get_conn():
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


SCHEMA = """
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL DEFAULT 'atendente',
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS barbeiros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL, cpf TEXT, telefone TEXT, nascimento TEXT, endereco TEXT,
  comissao REAL NOT NULL DEFAULT 50, status TEXT NOT NULL DEFAULT 'Ativo',
  observacoes TEXT, criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS servicos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL, descricao TEXT, preco REAL NOT NULL DEFAULT 0,
  comissao REAL, duracao INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'Ativo', criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL, cpf TEXT, telefone TEXT, whatsapp TEXT, nascimento TEXT,
  endereco TEXT, observacoes TEXT, ultimo_atendimento TEXT, criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL, categoria TEXT, preco REAL NOT NULL DEFAULT 0, custo REAL DEFAULT 0,
  estoque REAL NOT NULL DEFAULT 0, estoque_minimo REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Ativo', criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  produto_id INTEGER NOT NULL REFERENCES produtos(id),
  tipo TEXT NOT NULL, quantidade REAL NOT NULL, motivo TEXT,
  usuario_id INTEGER, data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pacotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL, valor REAL NOT NULL DEFAULT 0, validade_dias INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'Ativo', criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pacote_itens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pacote_id INTEGER NOT NULL REFERENCES pacotes(id) ON DELETE CASCADE,
  servico_id INTEGER NOT NULL REFERENCES servicos(id),
  quantidade INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS clientes_pacotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  pacote_id INTEGER NOT NULL REFERENCES pacotes(id),
  data_contratacao TEXT NOT NULL, data_vencimento TEXT NOT NULL,
  valor REAL NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'Ativo'
);
CREATE TABLE IF NOT EXISTS clientes_pacotes_saldo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_pacote_id INTEGER NOT NULL REFERENCES clientes_pacotes(id) ON DELETE CASCADE,
  servico_id INTEGER NOT NULL REFERENCES servicos(id),
  total INTEGER NOT NULL DEFAULT 0, utilizados INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS agendamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  barbeiro_id INTEGER NOT NULL REFERENCES barbeiros(id),
  servico_id INTEGER NOT NULL REFERENCES servicos(id),
  data TEXT NOT NULL, hora TEXT NOT NULL, observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'Agendado', criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS atendimentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id INTEGER REFERENCES clientes(id),
  barbeiro_id INTEGER NOT NULL REFERENCES barbeiros(id),
  agendamento_id INTEGER,
  data TEXT NOT NULL, subtotal REAL NOT NULL DEFAULT 0, desconto REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0, comissao REAL NOT NULL DEFAULT 0,
  observacoes TEXT, usuario_id INTEGER, caixa_id INTEGER, criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS itens_atendimento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atendimento_id INTEGER NOT NULL REFERENCES atendimentos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, servico_id INTEGER, produto_id INTEGER,
  descricao TEXT NOT NULL, quantidade REAL NOT NULL DEFAULT 1,
  preco_unitario REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0,
  usou_pacote INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS pagamentos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  atendimento_id INTEGER REFERENCES atendimentos(id) ON DELETE CASCADE,
  forma TEXT NOT NULL, valor REAL NOT NULL, data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS comissoes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  barbeiro_id INTEGER NOT NULL REFERENCES barbeiros(id),
  atendimento_id INTEGER REFERENCES atendimentos(id) ON DELETE CASCADE,
  percentual REAL NOT NULL, base REAL NOT NULL, valor REAL NOT NULL, data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS caixa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_abertura TEXT NOT NULL, valor_inicial REAL NOT NULL DEFAULT 0,
  usuario_abertura TEXT, status TEXT NOT NULL DEFAULT 'Aberto',
  data_fechamento TEXT, total_informado REAL, total_esperado REAL, diferenca REAL,
  fechamento_json TEXT, usuario_fechamento TEXT
);
CREATE TABLE IF NOT EXISTS movimentacoes_caixa (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caixa_id INTEGER NOT NULL REFERENCES caixa(id),
  tipo TEXT NOT NULL, descricao TEXT, valor REAL NOT NULL,
  forma TEXT DEFAULT 'Dinheiro', data TEXT NOT NULL, usuario_id INTEGER
);
CREATE TABLE IF NOT EXISTS despesas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  descricao TEXT NOT NULL, categoria TEXT NOT NULL, valor REAL NOT NULL,
  data TEXT NOT NULL, forma_pagamento TEXT, observacao TEXT, criado_em TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY, valor TEXT
);
CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  arquivo TEXT NOT NULL, caminho TEXT NOT NULL, tamanho INTEGER, tipo TEXT, data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario TEXT, acao TEXT NOT NULL, detalhe TEXT, data TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_backup_automatico_dia
  ON backups(tipo, date(data)) WHERE tipo='automatico';
"""

DEFAULT_CONFIG = {
    "nome_barbearia": "Barbearia Corte Certo",
    "cnpj": "",
    "telefone": "",
    "whatsapp": "",
    "endereco": "",
    "logo": "",
    "horario_funcionamento": "09:00 - 20:00",
    "formas_pagamento": "Dinheiro,PIX,Cartão de Débito,Cartão de Crédito,Outros",
    "comissao_padrao": "50",
    "impressora": "",
    "backup_automatico": "0",
    "backup_pasta": str(BACKUP_DIR),
}


def init_db():
    conn = get_conn()
    conn.executescript(SCHEMA)
    for k, v in DEFAULT_CONFIG.items():
        conn.execute("INSERT OR IGNORE INTO configuracoes (chave, valor) VALUES (?,?)", (k, v))
    conn.commit()
    conn.close()


def log(conn, usuario, acao, detalhe=""):
    conn.execute(
        "INSERT INTO logs (usuario, acao, detalhe, data) VALUES (?,?,?,?)",
        (usuario, acao, detalhe, now_iso()),
    )
