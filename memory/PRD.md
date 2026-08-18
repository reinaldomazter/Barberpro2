# BarberPro — Sistema de Gestão (Barbearia Corte Certo)

## Problema original
Sistema completo de gestão para barbearia, uso em **um único computador**, **100% offline**,
banco **SQLite local**, sem nuvem/Firebase/Supabase, sem SaaS, com possibilidade de empacotar
depois como app desktop Windows (Electron).

## Arquitetura
- Backend FastAPI + SQLite (`/app/backend/data/barberpro.db`), pastas de dados/backups configuráveis
  por `BARBERPRO_DATA_DIR` / `BARBERPRO_BACKUP_DIR`.
- Auth JWT Bearer (bcrypt), perfis `admin` e `atendente`, log de ações na tabela `logs`.
- Frontend React (CRA) tema escuro "Barbershop Noir" (obsidiana + dourado), pt-BR, recharts, shadcn/ui.
- Scaffold Electron em `/app/desktop` (main.js + electron-builder NSIS → `BarberPro_Setup.exe`).

## Usuários
- admin / 123456 (administrador) · atendente / 123456 (atendente)

## Implementado (18/06/2026)
- Login, troca de senha, gestão de usuários, RBAC (atendente sem Relatórios/Configurações/Backup)
- Dashboard: 12 KPIs + gráficos (faturamento diário/mensal, serviços mais vendidos, desempenho barbeiros), próximos agendamentos, alerta de estoque
- Barbeiros (comissão individual), Serviços, Clientes (busca, histórico, pacotes), Produtos
- Agendamentos com views dia/semana/mês, status, bloqueio de conflito por barbeiro/horário
- Atendimento rápido (POS): serviços/produtos em grid, desconto, forma de pagamento, comissão automática, baixa de estoque, consumo de saldo de pacote, vínculo com caixa e histórico do cliente
- Pacotes/assinaturas com serviços+quantidade+validade e saldo por cliente
- Estoque (entrada/saída/ajuste + histórico + alerta de mínimo)
- Caixa (abertura, movimentações Entrada/Saída/Sangria/Reforço, fechamento com esperado/informado/diferença, bloqueio após fechar)
- Despesas por categoria
- Relatórios (financeiro, barbeiros, clientes, serviços, produtos) com filtro de período, impressão e export CSV
- Backup: gerar (`backup_DD-MM-AAAA_HH-MM-SS.db`), restaurar com confirmação e cópia de segurança prévia, pasta de destino, flag de automático
- Configurações da barbearia + usuários + senhas
- Dados de demonstração (3 barbeiros, 6 serviços, 4 clientes, 6 produtos, 2 pacotes, agendamentos)

## Testes
Iteration 1: 44/44 checks (26 pytest backend + 18 Playwright) — 100% backend e frontend.

## Backlog
- P1: geração real do `BarberPro_Setup.exe` (PyInstaller + electron-builder em máquina Windows)
- P1: export PDF dos relatórios (hoje apenas CSV + impressão)
- P2: backup automático agendado (hoje apenas preferência salva)
- P2: impressão de comprovante do atendimento; split de pagamento em múltiplas formas
- P2: dividir `server.py` em routers
