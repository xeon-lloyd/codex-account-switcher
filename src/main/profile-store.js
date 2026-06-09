const crypto = require("crypto");
const { spawn } = require("child_process");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");

const PROFILE_NAME_MAX_LENGTH = 48;
const PROFILE_NAME_RE = /^[A-Za-z0-9._-]+$/;
const RESERVED_NAMES = new Set(["_BACKUPS"]);
const WINDOWS_RESERVED_NAMES = new Set([
  "CON",
  "PRN",
  "AUX",
  "NUL",
  "COM1",
  "COM2",
  "COM3",
  "COM4",
  "COM5",
  "COM6",
  "COM7",
  "COM8",
  "COM9",
  "LPT1",
  "LPT2",
  "LPT3",
  "LPT4",
  "LPT5",
  "LPT6",
  "LPT7",
  "LPT8",
  "LPT9",
]);
const CODEX_TARGETS = {
  "darwin-arm64": {
    packageName: "@openai/codex-darwin-arm64",
    targetTriple: "aarch64-apple-darwin",
    executable: "codex",
  },
  "darwin-x64": {
    packageName: "@openai/codex-darwin-x64",
    targetTriple: "x86_64-apple-darwin",
    executable: "codex",
  },
  "linux-arm64": {
    packageName: "@openai/codex-linux-arm64",
    targetTriple: "aarch64-unknown-linux-musl",
    executable: "codex",
  },
  "linux-x64": {
    packageName: "@openai/codex-linux-x64",
    targetTriple: "x86_64-unknown-linux-musl",
    executable: "codex",
  },
  "win32-arm64": {
    packageName: "@openai/codex-win32-arm64",
    targetTriple: "aarch64-pc-windows-msvc",
    executable: "codex.exe",
  },
  "win32-x64": {
    packageName: "@openai/codex-win32-x64",
    targetTriple: "x86_64-pc-windows-msvc",
    executable: "codex.exe",
  },
};

function getDefaultCodexHome() {
  return process.env.CODEX_HOME || path.join(os.homedir(), ".codex");
}

function getDefaultSwitcherHome(codexHome = getDefaultCodexHome()) {
  return path.join(codexHome, "account-switcher");
}

function getDefaultStore(codexHome = getDefaultCodexHome()) {
  return path.join(getDefaultSwitcherHome(codexHome), "profiles");
}

function getDefaultBackupRoot(codexHome = getDefaultCodexHome()) {
  return path.join(getDefaultSwitcherHome(codexHome), "backups");
}

function getDefaultTmpRoot(codexHome = getDefaultCodexHome()) {
  return path.join(getDefaultSwitcherHome(codexHome), "tmp");
}

function getCodexTarget() {
  return CODEX_TARGETS[`${process.platform}-${process.arch}`] || null;
}

function getAsarUnpackedPath(filePath) {
  const marker = `${path.sep}app.asar${path.sep}`;
  if (!filePath.includes(marker)) {
    return filePath;
  }

  return filePath.replace(marker, `${path.sep}app.asar.unpacked${path.sep}`);
}

function findNativeCodexInPackage(packageRoot, target) {
  const executablePath = path.join(
    packageRoot,
    "vendor",
    target.targetTriple,
    "bin",
    target.executable,
  );
  const unpackedPath = getAsarUnpackedPath(executablePath);

  if (fs.existsSync(unpackedPath)) {
    return unpackedPath;
  }

  if (fs.existsSync(executablePath)) {
    return executablePath;
  }

  return null;
}

function resolveBundledCodexCommand() {
  const target = getCodexTarget();
  if (!target) {
    return null;
  }

  const candidateRoots = [];
  try {
    const packageJsonPath = require.resolve(`${target.packageName}/package.json`);
    candidateRoots.push(path.dirname(packageJsonPath));
  } catch {
    // The optional dependency is absent when this package was installed on a
    // different OS/CPU. Fall through to explicit packaged-app locations.
  }

  const packagePathParts = target.packageName.split("/");
  const appRoot = path.resolve(__dirname, "../..");
  candidateRoots.push(path.join(appRoot, "node_modules", ...packagePathParts));

  if (process.resourcesPath) {
    candidateRoots.push(path.join(
      process.resourcesPath,
      "app.asar",
      "node_modules",
      ...packagePathParts,
    ));
    candidateRoots.push(path.join(
      process.resourcesPath,
      "app",
      "node_modules",
      ...packagePathParts,
    ));
  }

  const seen = new Set();
  for (const candidateRoot of candidateRoots) {
    const normalizedRoot = path.normalize(candidateRoot);
    if (seen.has(normalizedRoot)) {
      continue;
    }
    seen.add(normalizedRoot);

    const command = findNativeCodexInPackage(normalizedRoot, target);
    if (command) {
      return command;
    }
  }

  return null;
}

function getDefaultCodexCommand() {
  return process.env.CODEX_BIN || process.env.CODEX_CLI_PATH || resolveBundledCodexCommand() || "codex";
}

function createProfileStore(options = {}) {
  const codexHome = options.codexHome || getDefaultCodexHome();
  const profileRoot = options.profileRoot || getDefaultStore(codexHome);
  const backupRoot = options.backupRoot || getDefaultBackupRoot(codexHome);
  const tmpRoot = options.tmpRoot || getDefaultTmpRoot(codexHome);
  const codexCommand = options.codexCommand || getDefaultCodexCommand();
  let activeLoginChild = null;
  let loginCancelRequested = false;

  function authPath() {
    return path.join(codexHome, "auth.json");
  }

  function profileDir(name) {
    const resolvedProfileRoot = path.resolve(profileRoot);
    const resolvedProfileDir = path.resolve(resolvedProfileRoot, name);
    const relativePath = path.relative(resolvedProfileRoot, resolvedProfileDir);

    if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      throw new Error("Profile name resolves outside the profile store.");
    }

    return resolvedProfileDir;
  }

  function profileAuthPath(name) {
    return path.join(profileDir(name), "auth.json");
  }

  async function exists(filePath) {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async function ensureDir(dirPath) {
    await fsp.mkdir(dirPath, { recursive: true });
  }

  function backupAuthPath(reason) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return path.join(backupRoot, `${stamp}-${reason}.auth.json`);
  }

  function validateProfileName(name) {
    if (!name || typeof name !== "string" || !name.trim()) {
      throw new Error("Profile name is required.");
    }

    const normalized = name.trim();
    if (!PROFILE_NAME_RE.test(normalized)) {
      throw new Error("Use only letters, numbers, dot, underscore, and dash.");
    }

    if (normalized.length > PROFILE_NAME_MAX_LENGTH) {
      throw new Error(`Profile name must be ${PROFILE_NAME_MAX_LENGTH} characters or fewer.`);
    }

    if (normalized === "." || normalized === "..") {
      throw new Error("Profile name is not allowed.");
    }

    if (normalized.startsWith(".") || normalized.endsWith(".")) {
      throw new Error("Profile name cannot start or end with a dot.");
    }

    if (RESERVED_NAMES.has(normalized.toUpperCase())) {
      throw new Error(`'${normalized}' is reserved.`);
    }

    const windowsBaseName = normalized.split(".")[0].toUpperCase();
    if (WINDOWS_RESERVED_NAMES.has(windowsBaseName)) {
      throw new Error(`'${normalized}' is reserved by Windows.`);
    }

    return normalized;
  }

  async function hashFile(filePath) {
    if (!(await exists(filePath))) {
      return null;
    }

    return new Promise((resolve, reject) => {
      const hash = crypto.createHash("sha256");
      const stream = fs.createReadStream(filePath);
      stream.on("error", reject);
      stream.on("data", (chunk) => hash.update(chunk));
      stream.on("end", () => resolve(hash.digest("hex")));
    });
  }

  async function listProfiles() {
    await ensureDir(profileRoot);
    const activeHash = await hashFile(authPath());
    const entries = await fsp.readdir(profileRoot, { withFileTypes: true });
    const profiles = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || RESERVED_NAMES.has(entry.name)) {
        continue;
      }

      const storedAuthPath = profileAuthPath(entry.name);
      if (!(await exists(storedAuthPath))) {
        continue;
      }

      const stat = await fsp.stat(storedAuthPath);
      const profileHash = await hashFile(storedAuthPath);
      profiles.push({
        name: entry.name,
        active: Boolean(activeHash && profileHash === activeHash),
        savedAt: stat.mtime.toISOString(),
      });
    }

    profiles.sort((a, b) => a.name.localeCompare(b.name));
    return profiles;
  }

  async function getCurrent() {
    const activeHash = await hashFile(authPath());
    const profiles = await listProfiles();
    const activeProfile = profiles.find((profile) => profile.active);

    return {
      hasActiveAuth: Boolean(activeHash),
      activeProfile: activeProfile ? activeProfile.name : null,
      codexHome,
      authPath: authPath(),
      profileRoot,
    };
  }

  async function findMatchingProfile(filePath) {
    const candidateHash = await hashFile(filePath);
    if (!candidateHash) {
      return null;
    }

    const profiles = await listProfiles();
    for (const profile of profiles) {
      const profileHash = await hashFile(profileAuthPath(profile.name));
      if (profileHash === candidateHash) {
        return profile.name;
      }
    }

    return null;
  }

  async function findProfileByName(name) {
    const normalizedName = name.toLowerCase();
    const profiles = await listProfiles();
    return profiles.find((profile) => profile.name.toLowerCase() === normalizedName) || null;
  }

  async function backupActiveAuth(reason) {
    const currentAuthPath = authPath();
    if (!(await exists(currentAuthPath))) {
      return null;
    }

    const matchingProfile = await findMatchingProfile(currentAuthPath);
    if (matchingProfile) {
      return { saved: false, profile: matchingProfile, path: null };
    }

    await ensureDir(backupRoot);
    const backupPath = backupAuthPath(reason);
    await fsp.copyFile(currentAuthPath, backupPath);
    return { saved: true, profile: null, path: backupPath };
  }

  async function archivePreviousAuth(tempPath, profileName) {
    const knownProfile = await findMatchingProfile(tempPath);
    if (knownProfile) {
      await fsp.rm(tempPath, { force: true });
      return { saved: false, profile: knownProfile, path: null };
    }

    await ensureDir(backupRoot);
    const backupPath = backupAuthPath(`before-add-${profileName}`);
    await fsp.rename(tempPath, backupPath);
    return { saved: true, profile: null, path: backupPath };
  }

  async function restorePreviousAuthAfterFailedAdd(tempPath, profileName) {
    if (!(await exists(tempPath))) {
      return;
    }

    const currentAuthPath = authPath();
    if (await exists(currentAuthPath)) {
      await ensureDir(backupRoot);
      await fsp.rename(currentAuthPath, backupAuthPath(`failed-add-${profileName}`));
    }

    await fsp.rename(tempPath, currentAuthPath);
  }

  async function switchProfile(name) {
    const profileName = validateProfileName(name);
    const sourcePath = profileAuthPath(profileName);
    if (!(await exists(sourcePath))) {
      throw new Error(`Profile '${profileName}' does not exist.`);
    }

    await ensureDir(codexHome);
    const backup = await backupActiveAuth(`before-switch-${profileName}`);
    await fsp.copyFile(sourcePath, authPath());

    return {
      message: `Switched Codex auth to '${profileName}'. Restart running Codex sessions to pick it up.`,
      backup,
    };
  }

  async function deleteProfile(name) {
    const profileName = validateProfileName(name);
    const profiles = await listProfiles();
    const profile = profiles.find((item) => item.name === profileName);
    if (!profile) {
      throw new Error(`Profile '${profileName}' does not exist.`);
    }

    if (profile.active) {
      throw new Error("Switch to another profile before deleting the active saved profile.");
    }

    await fsp.rm(profileDir(profileName), { recursive: true, force: true });
    return { message: `Deleted profile '${profileName}'.` };
  }

  function runCodexLogin({ deviceAuth, onOutput }) {
    return new Promise((resolve, reject) => {
      if (activeLoginChild) {
        reject(new Error("A Codex login is already in progress."));
        return;
      }

      const args = ["login"];
      if (deviceAuth) {
        args.push("--device-auth");
      }

      let output = "";
      loginCancelRequested = false;

      const child = spawn(codexCommand, args, {
        cwd: os.homedir(),
        env: {
          ...process.env,
          CODEX_HOME: codexHome,
        },
        shell: process.platform === "win32" && !path.isAbsolute(codexCommand),
        windowsHide: false,
      });

      activeLoginChild = child;

      child.stdout.on("data", (chunk) => {
        const text = chunk.toString();
        output += text;
        onOutput?.(text);
      });
      child.stderr.on("data", (chunk) => {
        const text = chunk.toString();
        output += text;
        onOutput?.(text);
      });
      child.on("error", (error) => {
        activeLoginChild = null;
        if (error?.code === "ENOENT") {
          reject(new Error(
            `Codex CLI was not found at '${codexCommand}'. Reinstall the app or set CODEX_BIN to a Codex CLI executable.`,
          ));
          return;
        }

        reject(error);
      });
      child.on("close", (code) => {
        activeLoginChild = null;
        resolve({ exitCode: code ?? 0, output, canceled: loginCancelRequested });
      });
    });
  }

  function cancelLogin() {
    if (!activeLoginChild) {
      return false;
    }

    loginCancelRequested = true;
    const child = activeLoginChild;

    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
        windowsHide: true,
        stdio: "ignore",
      }).on("error", () => {
        child.kill();
      });
    } else {
      child.kill("SIGTERM");
    }

    return true;
  }

  async function addProfile(name, optionsForAdd = {}) {
    const profileName = validateProfileName(name);
    const targetPath = profileAuthPath(profileName);
    if ((await exists(targetPath)) || await findProfileByName(profileName)) {
      throw new Error(`Profile '${profileName}' already exists.`);
    }

    await ensureDir(profileRoot);
    await ensureDir(tmpRoot);
    await ensureDir(codexHome);

    const currentAuthPath = authPath();
    const hadActiveAuth = await exists(currentAuthPath);
    const tempPath = path.join(tmpRoot, `_active-before-add-${crypto.randomUUID()}.auth.json`);
    let movedActiveAuthPath = null;

    if (hadActiveAuth) {
      await fsp.rename(currentAuthPath, tempPath);
      movedActiveAuthPath = tempPath;
    }

    try {
      optionsForAdd.onOutput?.(`Starting Codex ${optionsForAdd.deviceAuth ? "device" : "web"} login for '${profileName}'...\n`);
      const loginResult = await runCodexLogin({
        deviceAuth: Boolean(optionsForAdd.deviceAuth),
        onOutput: optionsForAdd.onOutput,
      });

      const loginExitCode = loginResult.exitCode;
      const loginOutput = loginResult.output || "";

      if (loginResult.canceled) {
        throw new Error("Login canceled.");
      }

      if (!(await exists(currentAuthPath))) {
        if (/429|too many requests/i.test(loginOutput)) {
          throw new Error("Device login is temporarily rate limited. Try again later or use browser login.");
        }

        if (optionsForAdd.deviceAuth) {
          throw new Error("Device login did not complete. Try again or use browser login.");
        }

        throw new Error("Codex login did not complete. Try again.");
      }

      if (loginExitCode !== 0) {
        optionsForAdd.onOutput?.(`codex login returned ${loginExitCode}, but auth.json exists. Continuing.\n`);
      }

      await ensureDir(profileDir(profileName));
      await fsp.copyFile(currentAuthPath, targetPath);

      let previousAuth = null;
      if (movedActiveAuthPath) {
        previousAuth = await archivePreviousAuth(movedActiveAuthPath, profileName);
        movedActiveAuthPath = null;
      }

      return {
        message: `Saved '${profileName}' and made it active.`,
        previousAuth,
      };
    } catch (error) {
      if (movedActiveAuthPath) {
        try {
          await restorePreviousAuthAfterFailedAdd(movedActiveAuthPath, profileName);
        } catch (restoreError) {
          const message = error?.message || String(error);
          const restoreMessage = restoreError?.message || String(restoreError);
          throw new Error(`${message} Also failed to restore previous Codex auth: ${restoreMessage}`);
        }
      }

      throw error;
    }
  }

  return {
    paths: { codexHome, profileRoot, backupRoot, tmpRoot, authPath: authPath(), codexCommand },
    listProfiles,
    getCurrent,
    switchProfile,
    addProfile,
    deleteProfile,
    cancelLogin,
  };
}

module.exports = {
  createProfileStore,
  getDefaultCodexHome,
  getDefaultSwitcherHome,
  getDefaultStore,
  getDefaultBackupRoot,
  getDefaultTmpRoot,
  getDefaultCodexCommand,
};
