# BarberPro — empacotamento desktop Windows (offline)

O sistema é 100% local: backend FastAPI + banco **SQLite** (`backend/data/barberpro.db`),
sem nuvem, sem APIs externas, sem autenticação online.

## Caminho rápido (recomendado)

No Windows, com **Python 3.11+**, **Node.js 20+** e **Yarn** instalados, execute na raiz do projeto:

```
build_windows.bat
```

O script faz tudo: gera o executável do backend, o build do frontend, instala o Electron e
produz o instalador em `desktop\dist\BarberPro_Setup.exe`.

## Passo a passo manual

1. **Backend em executável**
   ```
   cd backend
   pip install -r requirements.txt pyinstaller
   pyinstaller --onefile --name barberpro-backend --add-data ".env;." server.py
   ```
   Copie `dist/barberpro-backend.exe` para `desktop/backend/`.

2. **Frontend em build estático**
   ```
   cd frontend
   echo REACT_APP_BACKEND_URL=http://127.0.0.1:8001 > .env.production
   yarn build
   ```
   Copie `frontend/build` para `desktop/frontend-build/`.

3. **Instalador**
   ```
   cd desktop
   npm i -D electron electron-builder
   npx electron-builder --win nsis
   ```

## O que o instalador faz
- Instala o programa e cria atalho na **área de trabalho** e no **menu iniciar** (NSIS).
- Na primeira execução, o `main.js` cria as pastas `%APPDATA%\BarberPro\dados` e
  `%APPDATA%\BarberPro\dados\backups`, e o backend cria o banco SQLite automaticamente
  com os dados de demonstração e o usuário **admin / 123456**.
- Abre a janela do BarberPro sem precisar rodar nenhum comando.

Variáveis usadas pelo backend: `BARBERPRO_DATA_DIR`, `BARBERPRO_BACKUP_DIR`, `PORT`.

## Backup
Dentro do app, menu **Backup** → "Fazer backup agora". Aponte a pasta de destino para o
pen drive ou HD externo (ex.: `E:\backups_barberpro`). Os arquivos são gerados como
`backup_18-08-2026_21-30-05.db` e podem ser restaurados pela própria tela de Backup.
