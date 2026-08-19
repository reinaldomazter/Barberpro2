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

## Implementado (18/06/2026 → 19/08/2026)
- Login, troca de senha, gestão de usuários, RBAC (atendente sem Relatórios/Configurações/Backup)
- Dashboard: 12 KPIs + gráficos (faturamento diário/mensal, serviços mais vendidos, desempenho barbeiros), próximos agendamentos, alerta de estoque
- Barbeiros (comissão individual), Serviços, Clientes (busca, histórico, pacotes), Produtos
- Agendamentos com views dia/semana/mês, status, bloqueio de conflito por barbeiro/horário
- Atendimento rápido (POS): serviços/produtos em grid, desconto, forma de pagamento, comissão automática, baixa de estoque, consumo de saldo de pacote, vínculo com caixa e histórico do cliente
- Pacotes/assinaturas com serviços+quantidade+validade e saldo por cliente
- Estoque (entrada/saída/ajuste + histórico + alerta de mínimo)
- Caixa (abertura, movimentações Entrada/Saída/Sangria/Reforço, fechamento com esperado/informado/diferença, bloqueio após fechar)
- Despesas por categoria
- Relatórios (financeiro, barbeiros, clientes, serviços, produtos) com filtro de período, impressão, export CSV e **export PDF** (cabeçalho com nome/CNPJ/telefone/endereço e logo da barbearia; PDF completo ou por seção)
- Backup: gerar (`backup_DD-MM-AAAA_HH-MM-SS.db`), restaurar com confirmação e cópia de segurança prévia, pasta de destino, flag de automático
- Logo da barbearia enviada por arquivo (guardada em base64 no banco local) exibida no menu lateral, na tela de login e no cabeçalho dos relatórios PDF
- Aniversariantes da semana no painel, com link direto de WhatsApp e mensagem pronta
- Backup automático diário: ao abrir o painel, se ativado e ainda não houver backup do dia, gera na pasta escolhida e avisa por notificação
- Comprovante do atendimento: recibo na tela ao finalizar + impressão em formato de cupom (78 mm) com logo, dados da barbearia, itens, descontos, total, forma de pagamento e barbeiro
- Configurações da barbearia + usuários + senhas + **limpar dados de demonstração** (backup automático antes, confirmação digitando LIMPAR, opção de apagar também os cadastros fictícios)
- Dados de demonstração (3 barbeiros, 6 serviços, 4 clientes, 6 produtos, 2 pacotes, agendamentos)

## Testes
Iteration 1: 44/44 checks. Iteration 2 (4 features novas): 19/20 pytest + Playwright ok;
corrigidos depois: duplicidade do backup automático (índice único + guard no Dashboard) e
`/api/relatorios/*` agora exigem perfil admin.

## Backlog
- P1: rodar `build_windows.bat` numa máquina Windows para gerar o `BarberPro_Setup.exe` (script e scaffold Electron prontos)
- P2: backup automático agendado (hoje apenas preferência salva)
- P2: impressão de comprovante do atendimento; split de pagamento em múltiplas formas
- P2: dividir `server.py` em routers
