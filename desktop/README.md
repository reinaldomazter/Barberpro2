# BarberPro — empacotamento desktop Windows (offline)

O sistema já é 100% local: backend FastAPI + banco **SQLite** (`backend/data/barberpro.db`),
sem nuvem, sem APIs externas. Para gerar `BarberPro_Setup.exe`:

1. **Backend em executável**
   ```
   pip install pyinstaller
   cd backend
   pyinstaller --onefile --name barberpro-backend --add-data ".env;." server.py
   ```
   Copie `dist/barberpro-backend.exe` para `desktop/backend/`.

2. **Frontend em build estático**
   ```
   cd frontend && yarn build
   ```
   Copie `frontend/build` para `desktop/frontend-build/`.
   Antes do build, defina `REACT_APP_BACKEND_URL=http://127.0.0.1:8001`.

3. **Instalador**
   ```
   cd desktop
   npm i -D electron electron-builder
   npx electron-builder --win nsis
   ```
   O NSIS cria atalhos na área de trabalho e no menu iniciar, e o `main.js`
   cria automaticamente as pastas de dados e de backups em `%APPDATA%/BarberPro/dados`.

Variáveis usadas pelo backend: `BARBERPRO_DATA_DIR`, `BARBERPRO_BACKUP_DIR`.
