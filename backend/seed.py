from datetime import datetime, timedelta

from db import get_conn, now_iso, today_str

BARBEIROS = [("João Silva", 50), ("Carlos Souza", 45), ("Marcos Lima", 55)]
SERVICOS = [("Corte masculino", 40, 30), ("Barba", 30, 20), ("Corte + Barba", 60, 50),
            ("Sobrancelha", 15, 10), ("Pigmentação", 70, 40), ("Platinado", 150, 90)]
CLIENTES = [("Rafael Alves", "11988880001"), ("Bruno Costa", "11988880002"),
            ("Diego Martins", "11988880003"), ("Felipe Rocha", "11988880004")]
PRODUTOS = [("Água", "Bebidas", 3, 1.2, 24, 6), ("Refrigerante", "Bebidas", 6, 2.5, 18, 6),
            ("Café", "Bebidas", 4, 1, 30, 10), ("Energético", "Bebidas", 10, 5, 12, 4),
            ("Pomada Modeladora", "Cosméticos", 35, 18, 8, 3), ("Shampoo", "Cosméticos", 45, 22, 5, 3)]


def seed_demo():
    conn = get_conn()
    if conn.execute("SELECT COUNT(*) c FROM barbeiros").fetchone()["c"] > 0:
        conn.close()
        return
    for nome, com in BARBEIROS:
        conn.execute("""INSERT INTO barbeiros (nome, cpf, telefone, comissao, status, criado_em)
                        VALUES (?,?,?,?, 'Ativo', ?)""", (nome, "", "1199999" + str(com), com, now_iso()))
    for nome, preco, dur in SERVICOS:
        conn.execute("""INSERT INTO servicos (nome, descricao, preco, duracao, status, criado_em)
                        VALUES (?,?,?,?, 'Ativo', ?)""", (nome, nome, preco, dur, now_iso()))
    for nome, tel in CLIENTES:
        conn.execute("""INSERT INTO clientes (nome, telefone, whatsapp, criado_em) VALUES (?,?,?,?)""",
                     (nome, tel, tel, now_iso()))
    for p in PRODUTOS:
        conn.execute("""INSERT INTO produtos (nome, categoria, preco, custo, estoque, estoque_minimo, status, criado_em)
                        VALUES (?,?,?,?,?,?, 'Ativo', ?)""", p + (now_iso(),))
    # pacotes
    conn.execute("INSERT INTO pacotes (nome, valor, validade_dias, status, criado_em) VALUES (?,?,?, 'Ativo', ?)",
                 ("Pacote Corte Mensal", 100, 30, now_iso()))
    conn.execute("INSERT INTO pacote_itens (pacote_id, servico_id, quantidade) VALUES (1, 1, 4)")
    conn.execute("INSERT INTO pacotes (nome, valor, validade_dias, status, criado_em) VALUES (?,?,?, 'Ativo', ?)",
                 ("Pacote Corte + Barba", 180, 30, now_iso()))
    conn.execute("INSERT INTO pacote_itens (pacote_id, servico_id, quantidade) VALUES (2, 1, 4)")
    conn.execute("INSERT INTO pacote_itens (pacote_id, servico_id, quantidade) VALUES (2, 2, 4)")
    # agendamentos demo
    hoje = datetime.now()
    horas = ["09:00", "10:00", "11:00", "14:00", "15:30"]
    for i, h in enumerate(horas):
        d = (hoje + timedelta(days=i % 3)).strftime("%Y-%m-%d")
        conn.execute("""INSERT INTO agendamentos (cliente_id, barbeiro_id, servico_id, data, hora, status, criado_em)
                        VALUES (?,?,?,?,?,?,?)""",
                     ((i % 4) + 1, (i % 3) + 1, (i % 4) + 1, d, h, "Agendado" if i % 2 else "Confirmado", now_iso()))
    conn.commit()
    conn.close()
