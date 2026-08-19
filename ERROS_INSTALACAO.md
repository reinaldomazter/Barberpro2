# BarberPro — Erros possíveis na instalação offline e como resolver

## A) Erros ao gerar o instalador (`build_windows.bat`)

| Erro na tela | Causa | Solução |
|---|---|---|
| `'python' não é reconhecido como comando` | Python não foi adicionado ao PATH | Reinstale o Python marcando **"Add python.exe to PATH"** e reabra o Prompt |
| `'node' / 'yarn' não é reconhecido` | Node.js não instalado ou Yarn ausente | Instale o Node.js 20 LTS e rode `npm install -g yarn` |
| `pip` falha ao instalar pacotes | Sem internet nesta etapa | As Partes 1 e 2 do guia **precisam de internet**; só depois o app fica offline |
| `Microsoft Visual C++ 14.0 is required` | Falta compilador para alguma lib Python | Instale "Microsoft C++ Build Tools" (Visual Studio Build Tools) |
| PyInstaller conclui, mas o `.exe` fecha sozinho | Falta de dependência oculta (bcrypt/jwt/reportlab) | O `build_windows.bat` já inclui `--hidden-import` e `--collect-all reportlab`; rode o `.exe` pelo Prompt para ver a mensagem de erro |
| `electron-builder` falha baixando o Electron | Rede/proxy bloqueando | Rode em rede liberada; o download é feito só nesta etapa |
| Build do frontend com `JavaScript heap out of memory` | Pouca memória | Rode `set NODE_OPTIONS=--max-old-space-size=4096` antes do `yarn build` |

## B) Erros ao instalar o `BarberPro_Setup.exe`

| Sintoma | Causa | Solução |
|---|---|---|
| "O Windows protegeu o seu PC" (SmartScreen) | Instalador sem assinatura digital paga | **Mais informações → Executar assim mesmo** |
| Antivírus apaga ou bloqueia o arquivo | Falso positivo comum em executáveis PyInstaller | Adicione a pasta do BarberPro às exceções do antivírus |
| "Acesso negado" durante a instalação | Sem permissão de administrador | Clique com o botão direito → **Executar como administrador** |
| Instalação trava/incompleta | Instalação anterior em uso | Feche o BarberPro, reinicie o PC e instale novamente |

## C) Erros ao abrir o programa

| Sintoma | Causa | Solução |
|---|---|---|
| Janela abre em branco | Frontend abriu antes do backend subir | Feche e abra novamente; o `main.js` aguarda 2s — em PCs lentos aumente esse tempo |
| "Não autenticado" / não consegue logar | Backend não iniciou (porta 8001 ocupada por outro programa) | Feche o que usa a porta 8001 ou defina a variável `PORT` e rebuild do frontend com o mesmo valor |
| Firewall do Windows pede permissão | Serviço local subindo | Pode **cancelar**: o app usa somente `127.0.0.1`, não precisa de rede |
| Usuário/senha inválidos no primeiro acesso | Banco criado em outra pasta | Use `admin` / `123456`; se persistir, apague `AppData\Roaming\BarberPro\dados\barberpro.db` e reabra (recria com dados de demonstração) |
| Dados desaparecem ao fechar o programa | Banco gravado em pasta temporária | Já corrigido: quando empacotado, os dados vão para `%APPDATA%\BarberPro\dados`. Confirme que essa pasta existe |
| Erro de token/sessão após atualizar o app | Segredo de sessão trocado | Basta fazer login novamente; o segredo é gerado e guardado localmente uma única vez |

## D) Erros no uso diário

| Sintoma | Causa | Solução |
|---|---|---|
| "Nenhum caixa aberto" ao registrar movimentação | Caixa fechado | Menu **Caixa → Abrir caixa** |
| "Já existe um caixa aberto" | Caixa do dia anterior não foi fechado | Feche o caixa anterior antes de abrir outro |
| "Este barbeiro já possui agendamento neste horário" | Proteção contra conflito | Escolha outro horário ou outro barbeiro |
| "Cliente não possui saldo de pacote para este serviço" | Pacote vencido ou esgotado | Contrate/renove o pacote na tela **Clientes → Pacote** |
| "Registro possui vínculos e não pode ser excluído" | Barbeiro/serviço já usado em atendimentos | Marque como **Inativo** em vez de excluir (preserva o histórico) |
| Relatório PDF sem logo | Logo é uma URL da internet ou caminho inexistente | Em **Configurações**, informe o caminho de um arquivo local, ex.: `C:\BarberPro\logo.png` |
| Backup falha ao salvar no pen drive | Pen drive desconectado ou letra da unidade mudou | Confira o caminho (ex.: `E:\backups_barberpro`) e salve as preferências novamente |
| Perdi os dados / PC formatado | — | Reinstale e use **Backup → Restaurar** com o `.db` do pen drive (uma cópia de segurança dos dados atuais é criada antes) |

## E) Checklist rápido antes de entregar o PC para a barbearia
- [ ] Login do admin com senha trocada
- [ ] Usuário do atendente criado (perfil Atendente)
- [ ] Dados da barbearia preenchidos em Configurações
- [ ] Barbeiros, serviços, produtos e pacotes reais cadastrados
- [ ] Pasta de backup apontando para o pen drive e um backup de teste feito
- [ ] Teste completo: abrir caixa → registrar 1 atendimento → fechar caixa
- [ ] Atalho na área de trabalho abrindo o programa sem internet (teste desligando o Wi-Fi)
