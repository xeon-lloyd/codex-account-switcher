<p align="center">
  <img src="readme/logo.png" alt="Codex Account Switcher logo" width="160">
</p>

<h1 align="center">Codex Account Switcher</h1>

<p align="center">
  A small desktop app for switching between multiple Codex accounts without signing out.
</p>

<p align="center">
  <a href="readme/README.ko.md">한국어</a> |
  <a href="readme/README.ja.md">日本語</a>
</p>

<p align="center">
  <a href="https://github.com/xeon-lloyd/codex-account-switcher/releases/latest">
    <img alt="Download latest release" src="https://img.shields.io/badge/Download-GitHub%20Release-2ea44f?style=for-the-badge">
  </a>
</p>

<p align="center">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey">
  <img alt="License" src="https://img.shields.io/badge/license-AGPL--3.0-blue">
</p>

<p align="center">
  <img src="readme/img/app_main.png" alt="Codex Account Switcher main window" width="520">
</p>

<p align="center">
  <sub>Pick a saved account, add a new one, and switch the active Codex account with one click.</sub>
</p>

## What is this app?

Codex Account Switcher is an account-switching tool for people who use Codex CLI or the Codex app with multiple accounts.

Codex normally uses one currently signed-in account. If you want to use another account, you need to sign out and sign back in, which gets repetitive. This app saves each Codex login as a named profile and lets you choose the active account with one click.

For example, you can use profiles like these:

- `personal`: your personal account
- `work`: your work account
- `client-a`: an account for a specific project

## Download and install

You can download the latest version from GitHub Releases.

👉 [Download the latest release](https://github.com/xeon-lloyd/codex-account-switcher/releases/latest)

### Windows

1. On the Releases page, download `Codex-Account-Switcher-...-win-x64.exe`.
2. Run the downloaded installer.
3. If Windows SmartScreen appears, check the app name and source, then continue.
4. After installation, open **Codex Account Switcher**.

### macOS

1. On the Releases page, download `Codex-Account-Switcher-...mac-arm64.dmg` for Apple Silicon Macs, or `Codex-Account-Switcher-...mac-x64.dmg` for Intel Macs.
2. Open the DMG and move the app into the Applications folder.
3. Open the app.
4. If macOS shows an unidentified developer warning, allow it in **Privacy & Security**, or right-click the app and choose **Open**.

> macOS builds may currently be unsigned and not notarized. Gatekeeper warnings may appear until the release process is improved.

## First-time setup

### 1. Add an account

Open the app and click **Add another account**.

<p align="center">
  <img src="readme/img/new_account.png" alt="Add account dialog" width="460">
</p>

Enter an account name. Choose a name that will be easy to recognize later.

Examples:

- `personal`
- `work`
- `team-main`

After entering a name, click **Add**. Codex sign-in will start. When the browser opens, sign in with the OpenAI or ChatGPT account you want to use. After sign-in finishes, the account is saved as a profile and becomes the current active account.

### 2. Add another account

Click **Add another account** again and repeat the same process for any additional accounts.

If the browser keeps selecting the same ChatGPT account, try one of these:

- Check **Use device auth** in the app and sign in with device authentication.
- Use a separate browser profile.
- Sign out of the existing ChatGPT/OpenAI account in your browser, then try again.

### 3. Switch accounts

Click the account you want to use from the saved account list.

<p align="center">
  <img src="readme/img/switch_account.png" alt="Account switched notice" width="460">
</p>

After switching, any Codex session that is already running may still keep the old login information. Fully quit and reopen your Codex CLI session or the Codex app after switching accounts.

### 4. Delete an account

Hover over the account you want to remove and click the `x` button to delete the saved profile.

You cannot delete the account that is currently active. Switch to another account first, then delete it.

## Good to know

- This is a local desktop utility.
- It does not call the OpenAI API directly.
- It does not display the contents of Codex login files.
- Saved profiles are authentication data. Do not share them or upload them to GitHub.
- After switching accounts, restart Codex CLI or the Codex app so the change is applied.
- Packaged builds check GitHub Releases for updates on startup. When an update is downloaded, it installs after you quit the app.

## FAQ

### Will my existing Codex login disappear?

During normal switching, the app compares your existing auth file with saved profiles. Unknown auth files are backed up under `~/.codex/account-switcher/backups`.

Still, auth files are sensitive account-access files. If you are using Codex in an important environment, it is a good idea to back up your `~/.codex` folder before using the app.

### I switched accounts, but Codex still shows the previous account.

A Codex session that was already running may still be holding the old auth information. Exit the Codex CLI session and start it again, or fully quit and reopen the Codex app.

### Browser sign-in keeps using the wrong account.

Your browser may automatically select the ChatGPT/OpenAI account that is already signed in. Try checking **Use device auth**, using a separate browser profile, or signing out of the existing account in your browser.

### Can I copy saved accounts to another computer?

This is not recommended. `auth.json` is authentication data and should be treated like a password. On another computer, install the app and sign in to each account again.

### If I uninstall the app, are saved accounts deleted too?

Uninstalling the app may not automatically remove `~/.codex/account-switcher`. If you also want to delete saved profiles, remove that folder manually.

## How it works

Codex usually stores login information in this file:

- Windows: `%USERPROFILE%\.codex\auth.json`
- macOS: `~/.codex/auth.json`

Codex Account Switcher does not read or display the contents of this file. Instead, it copies the signed-in `auth.json` file into a profile folder for each account. When you choose an account, it copies that profile's file back to Codex's default auth location.

Profiles are stored here:

```text
~/.codex/account-switcher/
├─ profiles/
│  ├─ personal/auth.json
│  └─ work/auth.json
└─ backups/
```

If an existing Codex login file does not match any saved profile, the app backs it up under `backups` before replacing it.

## For developers

Regular users do not need this section. It is only needed if you want to run the app from source or build a release.

### Requirements

- Node.js 20 or newer
- Windows 10/11 or macOS

Packaged builds include `@openai/codex` and the platform-specific Codex executable. During development, you can set the `CODEX_BIN` environment variable to the full path of another Codex executable. When launched from a Codex-managed environment, `CODEX_CLI_PATH` is used automatically if available.

### Run locally

```bash
npm install
npm start
```

### Package

Windows:

```powershell
npm run build:win
```

macOS:

```bash
npm run build:mac
```

## Security note

Saved profiles are copies of Codex authentication files. Do not share `~/.codex/account-switcher` or commit it to a repository.

## License

This project is licensed under AGPL-3.0. See [LICENSE](LICENSE) for details.
