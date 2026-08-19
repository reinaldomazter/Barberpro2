# BarberPro — Instalação no PC da barbearia (passo a passo)

Este guia leva do zero até o **BarberPro instalado no computador da barbearia**, funcionando
100% offline, com atalho na área de trabalho.

> Você fará isso **uma única vez**, no computador que vai gerar o instalador (pode ser o
> próprio PC da barbearia). Depois, o arquivo `BarberPro_Setup.exe` pode ser copiado para
> um pen drive e instalado em quantos computadores quiser.

---

## PARTE 1 — Baixar o código do projeto

1. Na Emergent, abra o projeto BarberPro **no navegador do computador** (não pelo celular).
2. Clique no botão **Code**, na barra superior. Abre o editor com todos os arquivos.
   - Se você tem plano pago, o caminho mais fácil é **Save → Save to GitHub** e depois
     `git clone <url-do-repositório>` no PC.
3. Garanta que no computador você tenha uma pasta com estas partes do projeto:
   ```
   BarberPro\
     backend\        (server.py, db.py, auth.py, seed.py, requirements.txt, .env)
     frontend\       (src, public, package.json, tailwind.config.js, ...)
     desktop\        (main.js, package.json, README.md)
     build_windows.bat
   ```

---

## PARTE 2 — Instalar os programas necessários (só nesta etapa há internet)

Instale, nesta ordem, aceitando as opções padrão:

1. **Python 3.11 ou superior** — https://www.python.org/downloads/windows/
   - ⚠️ Na primeira tela do instalador, **marque "Add python.exe to PATH"**.
2. **Node.js 20 LTS** — https://nodejs.org
3. **Yarn** — abra o **Prompt de Comando** e rode:
   ```
   npm install -g yarn
   ```

Confira se tudo ficou certo (cada comando deve mostrar uma versão):
```
python --version
node --version
yarn --version
```

---

## PARTE 3 — Gerar o instalador

1. Abra a pasta do projeto (`BarberPro`) no Windows Explorer.
2. Dê **duplo clique** em **`build_windows.bat`**.
   - Uma janela preta vai abrir e executar 4 etapas: backend → frontend → Electron → instalador.
   - Demora entre **5 e 15 minutos** na primeira vez. Não feche a janela.
3. Ao terminar aparece a mensagem:
   ```
   Pronto! Instalador em: desktop\dist\BarberPro_Setup.exe
   ```

Se der erro, a própria janela mostra em qual etapa parou — normalmente é Python ou Node
faltando no PATH (volte à Parte 2).

---

## PARTE 4 — Instalar o BarberPro

1. Vá até a pasta `desktop\dist\` e execute **`BarberPro_Setup.exe`**.
2. Se o Windows exibir "Windows protegeu o seu PC", clique em **Mais informações → Executar
   assim mesmo** (isso acontece porque o instalador não tem assinatura digital paga).
3. Escolha a pasta de instalação e conclua.
4. O instalador cria:
   - atalho na **área de trabalho**;
   - atalho no **menu iniciar**;
   - pasta de dados e de backups em `C:\Users\<seu usuário>\AppData\Roaming\BarberPro\dados`.

---

## PARTE 5 — Primeiro acesso

1. Abra o BarberPro pelo atalho da área de trabalho.
2. Faça login:
   - **Usuário:** `admin`
   - **Senha:** `123456`
3. Vá em **Configurações** e:
   - preencha nome da barbearia, CNPJ, telefone, WhatsApp, endereço e horário;
   - clique em **Alterar minha senha** e troque a senha do admin (importante!);
   - crie o usuário do atendente em **Novo usuário** (perfil "Atendente").
4. Ajuste **Barbeiros**, **Serviços**, **Produtos** e **Pacotes** com os dados reais.
   Os dados de demonstração (João, Carlos, Marcos etc.) podem ser editados ou excluídos.

---

## PARTE 6 — Rotina do dia a dia

1. **Manhã:** menu **Caixa → Abrir caixa** e informe o valor inicial (troco).
2. **Durante o dia:** **Atendimentos → Novo atendimento** →
   cliente → barbeiro → clique no serviço → produtos (se houver) → desconto →
   forma de pagamento → **Finalizar**. Comissão, estoque, caixa, histórico e relatórios
   são atualizados automaticamente.
3. **Agendamentos:** crie pelo calendário (o sistema bloqueia dois clientes no mesmo
   horário do mesmo barbeiro).
4. **Fim do dia:** **Caixa → Fechar caixa**, informe o valor contado e confira a diferença.
5. **Backup (faça todo dia):** menu **Backup** → coloque no campo de pasta o caminho do
   pen drive (ex.: `E:\backups_barberpro`) → **Salvar preferências** → **Fazer backup agora**.
   O arquivo sai como `backup_18-08-2026_21-30-05.db`.

---

## Perguntas rápidas

- **Precisa de internet?** Não. Só nas Partes 1 e 2 (baixar código e instalar programas).
  Depois de instalado, o BarberPro funciona sem nenhuma conexão.
- **Onde ficam os dados?** No arquivo SQLite dentro de
  `AppData\Roaming\BarberPro\dados\barberpro.db`, no próprio computador.
- **Perdi o computador / formatei.** Instale o BarberPro novamente e use
  **Backup → Restaurar** apontando para o arquivo `.db` do pen drive.
- **Posso instalar em outro PC?** Sim, copie o `BarberPro_Setup.exe`. Cada PC terá seu
  próprio banco de dados (o sistema é local, não sincroniza entre máquinas).
- **Antivírus reclamou do .exe?** É comum com executáveis gerados por PyInstaller sem
  assinatura. Libere o arquivo na lista de exceções do antivírus.
