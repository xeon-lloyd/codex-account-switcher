const elements = {
  profileList: document.querySelector("#profileList"),
  interactionBlocker: document.querySelector("#interactionBlocker"),
  statusToast: document.querySelector("#statusToast"),
  appVersion: document.querySelector("#appVersion"),
  closeButton: document.querySelector("#closeButton"),
  addAccountButton: document.querySelector("#addAccountButton"),
  dialog: document.querySelector("#profileDialog"),
  profileForm: document.querySelector("#profileForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  profileName: document.querySelector("#profileName"),
  deviceAuthRow: document.querySelector("#deviceAuthRow"),
  deviceAuth: document.querySelector("#deviceAuth"),
  loginDialog: document.querySelector("#loginDialog"),
  loginDialogTitle: document.querySelector("#loginDialogTitle"),
  browserLoginPanel: document.querySelector("#browserLoginPanel"),
  deviceCodePanel: document.querySelector("#deviceCodePanel"),
  deviceCode: document.querySelector("#deviceCode"),
  loginOutput: document.querySelector("#loginOutput"),
  copyLoginOutputButton: document.querySelector("#copyLoginOutputButton"),
  closeLoginDialogButton: document.querySelector("#closeLoginDialogButton"),
  cancelDialogButton: document.querySelector("#cancelDialogButton"),
  confirmDialogButton: document.querySelector("#confirmDialogButton"),
};

let state = {
  current: null,
  profiles: [],
  busy: false,
  mainBlocked: false,
  dialogMode: null,
  loginOutput: "",
  loginDeviceAuth: false,
  loginInProgress: false,
  loginCode: "",
};

const toast = window.createToast(elements.statusToast);
const DEFAULT_TOAST_MS = 2600;
const ACCOUNT_CHANGED_NOTICE = "Restart all Codex sessions or fully quit the Codex app";
const ACCOUNT_NAME_MAX_LENGTH = 48;
const ACCOUNT_NAME_RE = /^[A-Za-z0-9._-]+$/;
const RESERVED_ACCOUNT_NAMES = new Set(["_BACKUPS"]);
const WINDOWS_RESERVED_ACCOUNT_NAMES = new Set([
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

function setBusy(busy, blockMain = true) {
  state.busy = busy;
  setMainBlocked(busy && blockMain);
}

function setMainBlocked(blocked) {
  state.mainBlocked = blocked;
  elements.interactionBlocker.hidden = !state.mainBlocked;
}

function showToast(text, durationMs = DEFAULT_TOAST_MS) {
  toast.show(text, { durationMs });
}

function showAccountChangedNotice() {
  showToast(ACCOUNT_CHANGED_NOTICE);
}

function getUserErrorMessage(error) {
  const rawMessage = error?.message || String(error);
  const message = rawMessage
    .replace(/^Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "");

  if (/already exists/i.test(message)) {
    return "Account name already exists. Choose another name.";
  }

  if (/profile name is required/i.test(message)) {
    return "Enter an account name.";
  }

  if (/letters, numbers, dot, underscore, and dash/i.test(message)) {
    return "Use letters, numbers, dots, underscores, or dashes.";
  }

  if (/characters or fewer/i.test(message)) {
    return `Use ${ACCOUNT_NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (/not allowed/i.test(message)) {
    return "That account name is not allowed.";
  }

  if (/cannot start or end with a dot/i.test(message)) {
    return "Account name cannot start or end with a dot.";
  }

  if (/reserved/i.test(message)) {
    return "That account name is reserved. Choose another name.";
  }

  if (/rate limited|too many requests/i.test(message)) {
    return "Device login is temporarily rate limited. Try again later or use browser login.";
  }

  return message;
}

function validateProfileNameInput(name) {
  if (!name) {
    return "Enter an account name.";
  }

  if (!ACCOUNT_NAME_RE.test(name)) {
    return "Use letters, numbers, dots, underscores, or dashes.";
  }

  if (name.length > ACCOUNT_NAME_MAX_LENGTH) {
    return `Use ${ACCOUNT_NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (name === "." || name === "..") {
    return "That account name is not allowed.";
  }

  if (name.startsWith(".") || name.endsWith(".")) {
    return "Account name cannot start or end with a dot.";
  }

  if (RESERVED_ACCOUNT_NAMES.has(name.toUpperCase())) {
    return "That account name is reserved. Choose another name.";
  }

  const windowsBaseName = name.split(".")[0].toUpperCase();
  if (WINDOWS_RESERVED_ACCOUNT_NAMES.has(windowsBaseName)) {
    return "That account name is reserved by Windows.";
  }

  const duplicateProfile = state.profiles.some((profile) => (
    profile.name.toLowerCase() === name.toLowerCase()
  ));

  if (duplicateProfile) {
    return "Account name already exists. Choose another name.";
  }

  return "";
}

function extractDeviceCode(output) {
  const cleanOutput = output
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    .replace(/\r/g, "\n");
  const blockedWords = new Set([
    "ACCOUNT",
    "AUTHORIZATION",
    "AUTHORIZE",
    "BROWSER",
    "CHALLENGE",
    "CLIENT",
    "COMPLETE",
    "CONTINUE",
    "CODE",
    "DEVICE",
    "ERROR",
    "FAILED",
    "HTTPS",
    "LOGIN",
    "OAUTH",
    "OPENAI",
    "REDIRECT",
    "REQUEST",
    "RESPONSE",
    "SCOPE",
    "STATUS",
    "SUCCESS",
    "TOKEN",
    "USER",
    "VERIFICATION",
    "WINDOW",
  ]);

  function normalizeCandidate(value) {
    const candidate = value
      .trim()
      .replace(/^[^\w]+/g, "")
      .replace(/[.,;:)\]}]+$/g, "")
      .replace(/\s+/g, "-")
      .toUpperCase();
    const compact = candidate.replace(/-/g, "");

    if (compact.length < 5 || compact.length > 18) {
      return "";
    }

    if (blockedWords.has(compact)) {
      return "";
    }

    if (!/^[A-Z0-9-]+$/.test(candidate)) {
      return "";
    }

    return candidate;
  }

  function fromLineWithKeyword() {
    const lines = cleanOutput.split("\n");
    const tokenPattern = /\b[A-Z0-9][A-Z0-9-]{4,24}\b/gi;

    for (const line of lines) {
      if (!/(code|device|verification|user_code|activate|auth\.openai\.com|login\.openai\.com)/i.test(line)) {
        continue;
      }

      const matches = line.match(tokenPattern) || [];
      for (const match of matches) {
        const code = normalizeCandidate(match);
        if (!code) {
          continue;
        }

        const compact = code.replace(/-/g, "");
        const hasCodeShape = code.includes("-") || /\d/.test(compact) || compact.length <= 10;
        if (hasCodeShape) {
          return code;
        }
      }
    }

    return "";
  }

  const patterns = [
    /["']user_code["']\s*:\s*["']([A-Z0-9][A-Z0-9-\s]{4,24})["']/i,
    /[?&]user_code=([A-Z0-9][A-Z0-9-]{4,24})/i,
    /\b(?:verification|device|user)\s+code\s*(?:is|=|:|：|-)\s*([A-Z0-9][A-Z0-9-\s]{4,24})/i,
    /\b(?:copy|paste|use)\s+(?:this\s+)?code\s*(?:is|=|:|：|-)?\s*([A-Z0-9][A-Z0-9-\s]{4,24})/i,
    /\benter\s+(?:the\s+)?code\s*(?:is|=|:|：|-)?\s*([A-Z0-9][A-Z0-9-\s]{4,24})/i,
    /\b([A-Z0-9]{4,6}-[A-Z0-9]{4,6}(?:-[A-Z0-9]{4,6})?)\b/i,
  ];

  for (const pattern of patterns) {
    const match = cleanOutput.match(pattern);
    if (match?.[1]) {
      const code = normalizeCandidate(match[1]);
      if (code) {
        return code;
      }
    }
  }

  return fromLineWithKeyword();
}

function openLoginDialog(deviceAuth) {
  state.loginOutput = "";
  state.loginDeviceAuth = deviceAuth;
  state.loginInProgress = true;
  state.loginCode = "";

  elements.loginDialogTitle.textContent = deviceAuth ? "Device auth" : "Codex sign in";
  elements.browserLoginPanel.hidden = deviceAuth;
  elements.deviceCodePanel.hidden = !deviceAuth;
  elements.loginOutput.hidden = true;
  elements.deviceCode.textContent = "Waiting...";
  elements.loginOutput.textContent = "";
  elements.copyLoginOutputButton.hidden = !deviceAuth;
  elements.copyLoginOutputButton.textContent = deviceAuth ? "Copy code" : "Copy";
  elements.closeLoginDialogButton.textContent = "Cancel";
  elements.loginDialog.showModal();
}

function appendLoginOutput(text) {
  state.loginOutput += text;

  if (state.loginDeviceAuth) {
    const code = extractDeviceCode(state.loginOutput);
    if (code) {
      state.loginCode = code;
      elements.deviceCode.textContent = code;
    }
    return;
  }

  elements.loginOutput.textContent = state.loginOutput.trim() || "Waiting for Codex output...";
  elements.loginOutput.scrollTop = elements.loginOutput.scrollHeight;
}

function closeLoginDialog() {
  state.loginInProgress = false;
  if (elements.loginDialog.open) {
    elements.loginDialog.close();
  }
}

function getInitials(name) {
  return (name || "?")
    .split(/[._-\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
}

function formatSavedAt(value) {
  if (!value) {
    return "Saved profile";
  }

  return `Saved ${new Date(value).toLocaleDateString()}`;
}

function applyState(nextState) {
  state.current = nextState.current;
  state.profiles = nextState.profiles;

  renderProfiles();
}

function renderProfiles() {
  elements.profileList.replaceChildren();

  if (state.profiles.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No saved accounts";
    elements.profileList.append(empty);
    return;
  }

  for (const profile of state.profiles) {
    const row = document.createElement("button");
    row.className = "account-row";
    if (profile.active) {
      row.classList.add("active");
      row.setAttribute("aria-current", "true");
    }
    row.type = "button";

    const avatar = document.createElement("span");
    avatar.className = `avatar${profile.active ? "" : " idle"}`;
    avatar.textContent = getInitials(profile.name);

    const meta = document.createElement("span");
    meta.className = "account-meta";

    const name = document.createElement("span");
    name.className = "account-name";
    name.textContent = profile.name;

    const subtitle = document.createElement("span");
    subtitle.className = "account-subtitle";
    subtitle.textContent = profile.active ? "Current account" : formatSavedAt(profile.savedAt);

    meta.append(name, subtitle);
    row.append(avatar, meta);

    if (!profile.active) {
      const remove = document.createElement("button");
      remove.className = "delete-button";
      remove.type = "button";
      remove.title = `Delete ${profile.name}`;
      remove.setAttribute("aria-label", `Delete ${profile.name}`);
      remove.textContent = "×";
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        deleteProfile(profile.name);
      });
      row.append(remove);
    }

    row.addEventListener("click", () => {
      if (!profile.active) {
        switchProfile(profile.name);
      }
    });

    elements.profileList.append(row);
  }
}

async function refresh() {
  const nextState = await window.codexAccounts.getState();
  applyState(nextState);
}

async function hydrateAppVersion() {
  const version = await window.codexAccounts.getAppVersion();
  if (version) {
    elements.appVersion.textContent = `v${version}`;
  }
}

async function runAction(label, action, options = {}) {
  const blockMain = options.blockMain !== false;

  try {
    setBusy(true, blockMain);
    showToast(`${label}...`);
    const response = await action();
    if (response?.ok === false) {
      throw new Error(response.error?.message || "Action failed.");
    }

    applyState(response);
    if (options.showSuccessToast !== false) {
      showToast(response.result?.message || "Done");
    }
    return response;
  } catch (error) {
    showToast(getUserErrorMessage(error));
    return null;
  } finally {
    setBusy(false);
  }
}

function openProfileDialog() {
  if (state.busy) {
    return;
  }

  state.dialogMode = "add";
  elements.profileForm.reset();

  elements.dialogTitle.textContent = "Add account";
  elements.confirmDialogButton.textContent = "Add";
  elements.deviceAuthRow.hidden = false;

  elements.dialog.showModal();
  elements.profileName.focus();
}

function closeProfileDialog() {
  elements.dialog.close();
  state.dialogMode = null;
}

async function switchProfile(name) {
  if (state.busy) {
    return;
  }

  const response = await runAction(
    "Switching",
    () => window.codexAccounts.switchProfile({ name }),
    { showSuccessToast: false },
  );
  if (!response) {
    return;
  }

  showAccountChangedNotice();
}

function deleteProfile(name) {
  if (state.busy) {
    return;
  }

  if (!window.confirm(`Delete '${name}'?`)) {
    return;
  }

  runAction("Deleting", () => window.codexAccounts.deleteProfile({ name }));
}

elements.addAccountButton.addEventListener("click", openProfileDialog);
elements.closeButton.addEventListener("click", () => window.codexAccounts.closeApp());
elements.cancelDialogButton.addEventListener("click", closeProfileDialog);
elements.closeLoginDialogButton.addEventListener("click", async () => {
  if (!state.loginInProgress) {
    closeLoginDialog();
    return;
  }

  showToast("Canceling login...");
  await window.codexAccounts.cancelLogin();
  closeLoginDialog();
});
elements.copyLoginOutputButton.addEventListener("click", async () => {
  const copyText = state.loginDeviceAuth ? state.loginCode : state.loginOutput;
  if (!copyText) {
    showToast(state.loginDeviceAuth ? "No code yet" : "Nothing to copy");
    return;
  }

  try {
    await navigator.clipboard.writeText(copyText);
    showToast(state.loginDeviceAuth ? "Copied code" : "Copied login output");
  } catch {
    showToast(state.loginDeviceAuth ? "Could not copy code" : "Could not copy login output");
  }
});

window.addEventListener("focus", () => {
  refresh().catch((error) => showToast(getUserErrorMessage(error)));
});

elements.profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = elements.profileName.value.trim();
  const deviceAuth = elements.deviceAuth.checked;

  const validationError = validateProfileNameInput(name);
  if (validationError) {
    showToast(validationError);
    return;
  }

  closeProfileDialog();
  openLoginDialog(deviceAuth);

  const response = await runAction(
    "Adding account",
    () => window.codexAccounts.addProfile({
      name,
      deviceAuth,
    }),
    { showSuccessToast: false, blockMain: false },
  );

  closeLoginDialog();

  if (response) {
    showAccountChangedNotice();
  }
});

window.codexAccounts.onLoginOutput((text) => {
  if (state.loginDeviceAuth) {
    appendLoginOutput(text);
  }

  const lower = text.toLowerCase();
  if (lower.includes("successfully logged in")) {
    showToast("Login completed");
  }
});

window.codexAccounts.onUpdateStatus?.((update) => {
  if (update.status === "available") {
    showToast(`Downloading v${update.version}...`, 5000);
    return;
  }

  if (update.status === "downloaded") {
    showToast(`v${update.version} will install when you quit the app.`, 7000);
    return;
  }

  if (update.status === "error") {
    showToast("Update check failed. See app logs.", 6000);
  }
});

hydrateAppVersion().catch(() => {
  elements.appVersion.hidden = true;
});

refresh().catch((error) => {
  showToast(getUserErrorMessage(error));
});
