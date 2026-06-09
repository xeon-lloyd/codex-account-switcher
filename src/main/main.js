const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("fs");
const path = require("path");
const { createProfileStore } = require("./profile-store");

app.disableHardwareAcceleration();
Menu.setApplicationMenu(null);

let mainWindow;
let lastLoggedUpdateProgress = -1;
const profileStore = createProfileStore();

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
}

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

function getAppIconPath() {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "../../build/icon.png");

  return fs.existsSync(iconPath) ? iconPath : undefined;
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    focusMainWindow();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 420,
    height: 430,
    minWidth: 390,
    minHeight: 360,
    resizable: true,
    frame: false,
    autoHideMenuBar: true,
    show: true,
    backgroundColor: "#0d0d0c",
    title: "Codex Account Switcher",
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"))
    .catch((error) => {
      console.error(error);
      app.exit(1);
    });
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (app.isReady()) {
      createWindow();
    }
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  mainWindow.focus();
}

function sendUpdateStatus(status, detail = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send("updates:status", {
    status,
    ...detail,
  });
}

function configureAutoUpdater() {
  if (!app.isPackaged) {
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("Checking for updates");
  });

  autoUpdater.on("update-available", (info) => {
    lastLoggedUpdateProgress = -1;
    console.log(`Update available: ${info.version}`);
    sendUpdateStatus("available", { version: info.version });
  });

  autoUpdater.on("update-not-available", (info) => {
    console.log(`No update available: ${info.version}`);
  });

  autoUpdater.on("download-progress", (progress) => {
    const percent = Math.round(progress.percent || 0);
    if (percent >= 100 || percent >= lastLoggedUpdateProgress + 10) {
      lastLoggedUpdateProgress = percent;
      console.log(`Update download progress: ${percent}%`);
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log(`Update downloaded: ${info.version}`);
    sendUpdateStatus("downloaded", { version: info.version });
  });

  autoUpdater.on("error", (error) => {
    console.error("Auto update error:", error);
    sendUpdateStatus("error", {
      message: error?.message || String(error),
    });
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.error("Auto update check failed:", error);
      sendUpdateStatus("error", {
        message: error?.message || String(error),
      });
    });
  }, 5000);
}

function registerIpc() {
  async function profileResult(work) {
    try {
      const result = await work();
      return {
        ok: true,
        result,
        current: await profileStore.getCurrent(),
        profiles: await profileStore.listProfiles(),
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          message: error?.message || String(error),
        },
      };
    }
  }

  ipcMain.handle("profiles:getState", async () => ({
    current: await profileStore.getCurrent(),
    profiles: await profileStore.listProfiles(),
  }));

  ipcMain.handle("profiles:switch", async (_event, payload) => profileResult(
    () => profileStore.switchProfile(payload.name),
  ));

  ipcMain.handle("profiles:delete", async (_event, payload) => profileResult(
    () => profileStore.deleteProfile(payload.name),
  ));

  ipcMain.handle("profiles:add", async (event, payload) => profileResult(
    () => profileStore.addProfile(payload.name, {
      deviceAuth: Boolean(payload.deviceAuth),
      onOutput: (text) => event.sender.send("login:output", text),
    }),
  ));

  ipcMain.handle("profiles:cancelLogin", async () => ({
    canceled: profileStore.cancelLogin(),
  }));

  ipcMain.handle("app:getVersion", async () => app.getVersion());

  ipcMain.handle("app:close", async () => {
    app.quit();
    return true;
  });
}

if (hasSingleInstanceLock) {
  app.on("second-instance", () => {
    focusMainWindow();
  });

  app.whenReady().then(() => {
    registerIpc();
    createWindow();
    configureAutoUpdater();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
