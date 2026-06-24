<p align="center">
  <img src="logo.png" alt="Codex Account Switcher logo" width="160">
</p>

<h1 align="center">Codex Account Switcher</h1>

<p align="center">
  複数のCodexアカウントを、サインアウトせずに切り替えるための小さなデスクトップアプリです。
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
  <img src="img/app_main.png" alt="Codex Account Switcher main window" width="520">
</p>

<p align="center">
  <sub>保存したアカウントを選び、新しいアカウントを追加し、ワンクリックで現在のCodexアカウントを切り替えます。</sub>
</p>

## このアプリについて

Codex Account Switcherは、Codex CLIまたはCodexアプリで複数のアカウントを使う人のためのアカウント切り替えツールです。

通常、Codexは現在サインインしている1つのアカウントを使います。別のアカウントを使うには、サインアウトしてから再度サインインする必要があり、何度も行うと手間がかかります。このアプリは、それぞれのCodexログイン情報を名前付きのプロファイルとして保存し、ワンクリックで現在使うアカウントを選べるようにします。

たとえば、次のようなプロファイルを作れます。

- `personal`: 個人用アカウント
- `work`: 仕事用アカウント
- `client-a`: 特定プロジェクト用のアカウント

## ダウンロードとインストール

最新版はGitHub Releasesからダウンロードできます。

👉 [最新リリースをダウンロード](https://github.com/xeon-lloyd/codex-account-switcher/releases/latest)

### Windows

1. Releasesページで `Codex-Account-Switcher-...-win-x64.exe` をダウンロードします。
2. ダウンロードしたインストーラーを実行します。
3. Windows SmartScreenの警告が表示された場合は、アプリ名と配布元を確認して続行します。
4. インストール後、**Codex Account Switcher** を開きます。

### macOS

1. Releasesページで、Apple Silicon Macは `Codex-Account-Switcher-...mac-arm64.dmg`、Intel Macは `Codex-Account-Switcher-...mac-x64.dmg` をダウンロードします。
2. DMGを開き、アプリをApplicationsフォルダに移動します。
3. アプリを開きます。
4. macOSで未確認の開発元に関する警告が表示された場合は、**Privacy & Security** で許可するか、アプリを右クリックして **Open** を選びます。

> macOSビルドは、現時点では署名や公証がされていない場合があります。リリース手順が改善されるまでは、Gatekeeperの警告が表示されることがあります。

## 初回セットアップ

### 1. アカウントを追加する

アプリを開き、**Add another account** をクリックします。

<p align="center">
  <img src="img/new_account.png" alt="Add account dialog" width="460">
</p>

アカウント名を入力します。あとで見分けやすい名前を付けてください。

例:

- `personal`
- `work`
- `team-main`

名前を入力したら **Add** をクリックします。Codexのサインインが始まります。ブラウザが開いたら、使いたいOpenAIまたはChatGPTアカウントでサインインしてください。サインインが完了すると、そのアカウントがプロファイルとして保存され、現在のアクティブなアカウントになります。

### 2. 別のアカウントを追加する

もう一度 **Add another account** をクリックし、同じ手順で追加のアカウントを登録します。

ブラウザが同じChatGPTアカウントを選び続ける場合は、次の方法を試してください。

- アプリで **Use device auth** をチェックし、デバイス認証でサインインする。
- 別のブラウザプロファイルを使う。
- ブラウザ上で既存のChatGPT/OpenAIアカウントからサインアウトしてから、もう一度試す。

### 3. アカウントを切り替える

保存済みアカウントの一覧から、使いたいアカウントをクリックします。

<p align="center">
  <img src="img/switch_account.png" alt="Account switched notice" width="460">
</p>

切り替え後も、すでに実行中のCodexセッションは古いログイン情報を保持している場合があります。アカウントを切り替えた後は、Codex CLIのセッションまたはCodexアプリを完全に終了してから、もう一度開いてください。

### 4. アカウントを削除する

削除したいアカウントにマウスを重ね、`x` ボタンをクリックすると保存済みプロファイルを削除できます。

現在アクティブなアカウントは削除できません。先に別のアカウントへ切り替えてから削除してください。

## 知っておくとよいこと

- このアプリはローカルのデスクトップユーティリティです。
- OpenAI APIを直接呼び出しません。
- Codexログインファイルの内容を画面に表示しません。
- 保存済みプロファイルは認証情報です。他人と共有したり、GitHubにアップロードしたりしないでください。
- アカウントを切り替えた後は、変更を反映するためにCodex CLIまたはCodexアプリを再起動してください。
- パッケージ版アプリは起動時にGitHub Releasesでアップデートを確認します。アップデートがダウンロードされると、アプリ終了後にインストールされます。

## FAQ

### 既存のCodexログインは消えますか?

通常の切り替え処理では、既存の認証ファイルと保存済みプロファイルを比較します。どの保存済みプロファイルとも一致しない認証ファイルは、`~/.codex/account-switcher/backups` にバックアップされます。

それでも、認証ファイルはアカウントアクセスに関わる機密ファイルです。重要な環境で使う場合は、このアプリを使う前に `~/.codex` フォルダをバックアップしておくことをおすすめします。

### アカウントを切り替えたのに、Codexが前のアカウントのままです。

すでに実行中のCodexセッションが、古い認証情報を保持している可能性があります。Codex CLIのセッションを終了して起動し直すか、Codexアプリを完全に終了してから再度開いてください。

### ブラウザのサインインで別のアカウントが選ばれてしまいます。

ブラウザにすでにサインインしているChatGPT/OpenAIアカウントが自動的に選ばれている可能性があります。**Use device auth** をチェックする、別のブラウザプロファイルを使う、またはブラウザ上で既存アカウントからサインアウトして試してください。

### 保存したアカウントを別のPCにコピーしてもいいですか?

おすすめしません。`auth.json` は認証情報であり、パスワードのように扱うべきです。別のPCでは、アプリをインストールして各アカウントに再度サインインしてください。

### アプリをアンインストールすると、保存済みアカウントも削除されますか?

アプリをアンインストールしても、`~/.codex/account-switcher` フォルダは自動で削除されない場合があります。保存済みプロファイルも削除したい場合は、そのフォルダを手動で削除してください。

## 仕組み

Codexは通常、ログイン情報を次のファイルに保存します。

- Windows: `%USERPROFILE%\.codex\auth.json`
- macOS: `~/.codex/auth.json`

Codex Account Switcherは、このファイルの内容を読み取ったり画面に表示したりしません。代わりに、サインイン済みの `auth.json` ファイルをアカウントごとのプロファイルフォルダにコピーします。アカウントを選ぶと、そのプロファイルのファイルをCodexの標準認証場所にコピーし直します。

プロファイルは次の場所に保存されます。

```text
~/.codex/account-switcher/
├─ profiles/
│  ├─ personal/auth.json
│  └─ work/auth.json
└─ backups/
```

既存のCodexログインファイルがどの保存済みプロファイルとも一致しない場合、アプリは置き換える前に `backups` にバックアップします。

## 開発者向け

一般ユーザーはこのセクションを読む必要はありません。ソースから実行したい場合や、リリースをビルドしたい場合にだけ必要です。

### 要件

- Node.js 20以上
- Windows 10/11またはmacOS

パッケージ版には `@openai/codex` と、プラットフォーム別のCodex実行ファイルが含まれます。開発中に別のCodex実行ファイルを使いたい場合は、`CODEX_BIN` 環境変数にその実行ファイルのフルパスを指定できます。Codex管理環境から起動された場合は、`CODEX_CLI_PATH` があれば自動的に使われます。

### ローカルで実行

```bash
npm install
npm start
```

### パッケージ化

Windows:

```powershell
npm run build:win
```

macOS:

```bash
npm run build:mac
```

## セキュリティメモ

保存済みプロファイルはCodex認証ファイルのコピーです。`~/.codex/account-switcher` を共有したり、リポジトリにコミットしたりしないでください。

## ライセンス

このプロジェクトはAGPL-3.0ライセンスです。詳細は [LICENSE](../LICENSE) を確認してください。
