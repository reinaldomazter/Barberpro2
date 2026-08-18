// BarberPro — shell Electron para empacotamento Windows (offline).
// Uso: coloque o build do React em ./frontend-build e o backend FastAPI em ./backend
// npm i -D electron electron-builder && npx electron-builder --win
const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const DATA_DIR = path.join(app?.getPath ? app.getPath("userData") : ".", "dados");
const BACKUP_DIR = path.join(DATA_DIR, "backups");
fs.mkdirSync(BACKUP_DIR, { recursive: true });

let backend;

function startBackend() {
  backend = spawn(path.join(__dirname, "backend", "barberpro-backend.exe"), [], {
    env: { ...process.env, BARBERPRO_DATA_DIR: DATA_DIR, BARBERPRO_BACKUP_DIR: BACKUP_DIR, PORT: "8001" },
  });
}

function createWindow() {
  const win = new BrowserWindow({ width: 1440, height: 900, title: "BarberPro", autoHideMenuBar: true });
  win.loadFile(path.join(__dirname, "frontend-build", "index.html"));
}

app.whenReady().then(() => {
  startBackend();
  setTimeout(createWindow, 2000);
});

app.on("window-all-closed", () => {
  if (backend) backend.kill();
  app.quit();
});
