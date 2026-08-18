@echo off
REM ============================================================
REM  BarberPro - gera o instalador BarberPro_Setup.exe (Windows)
REM  Execute este arquivo na raiz do projeto, dentro do Windows.
REM  Pre-requisitos: Python 3.11+, Node.js 20+, Yarn
REM ============================================================
setlocal

echo [1/4] Backend -> executavel
cd backend
python -m pip install -r requirements.txt || goto :erro
python -m pip install pyinstaller || goto :erro
pyinstaller --noconfirm --onefile --name barberpro-backend --add-data ".env;." server.py || goto :erro
if not exist "..\desktop\backend" mkdir "..\desktop\backend"
copy /Y dist\barberpro-backend.exe ..\desktop\backend\ || goto :erro
cd ..

echo [2/4] Frontend -> build estatico
cd frontend
echo REACT_APP_BACKEND_URL=http://127.0.0.1:8001> .env.production
call yarn install || goto :erro
call yarn build || goto :erro
if exist "..\desktop\frontend-build" rmdir /S /Q "..\desktop\frontend-build"
xcopy /E /I /Y build ..\desktop\frontend-build || goto :erro
cd ..

echo [3/4] Electron
cd desktop
call npm install --save-dev electron electron-builder || goto :erro

echo [4/4] Instalador NSIS
call npx electron-builder --win nsis || goto :erro
cd ..

echo.
echo ================================================================
echo  Pronto! Instalador em: desktop\dist\BarberPro_Setup.exe
echo  Ao instalar, sao criados atalhos na area de trabalho e no menu
echo  iniciar, e as pastas de dados/backups em %%APPDATA%%\BarberPro.
echo ================================================================
goto :fim

:erro
echo.
echo *** Falha na etapa acima. Verifique a mensagem de erro. ***

:fim
pause
endlocal
