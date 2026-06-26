const fs = require("fs");
const path = require("path");

const distDir = process.argv[2] || "dist";
const inputNames = ["latest-mac-x64.yml", "latest-mac-arm64.yml"];

function readValue(value) {
  return value == null ? "" : value.trim();
}

function parseLatestMacYml(filePath) {
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const result = {
    version: null,
    releaseDate: null,
    files: [],
  };
  let currentFile = null;

  for (const line of lines) {
    let match = line.match(/^version:\s*(.+)$/);
    if (match) {
      result.version = readValue(match[1]);
      continue;
    }

    match = line.match(/^releaseDate:\s*(.+)$/);
    if (match) {
      result.releaseDate = readValue(match[1]);
      continue;
    }

    match = line.match(/^\s*-\s+url:\s*(.+)$/);
    if (match) {
      currentFile = { url: readValue(match[1]) };
      result.files.push(currentFile);
      continue;
    }

    match = line.match(/^\s+(sha512|size|blockMapSize):\s*(.+)$/);
    if (match && currentFile) {
      currentFile[match[1]] = readValue(match[2]);
    }
  }

  if (!result.version || result.files.length === 0) {
    throw new Error(`Could not parse update metadata: ${filePath}`);
  }

  return result;
}

function yamlScalar(value) {
  return String(value);
}

function renderLatestMacYml(metadata) {
  const zipFile = metadata.files.find((file) => file.url.endsWith(".zip")) || metadata.files[0];
  const lines = [
    `version: ${yamlScalar(metadata.version)}`,
    "files:",
  ];

  for (const file of metadata.files) {
    lines.push(`  - url: ${yamlScalar(file.url)}`);
    if (file.sha512) {
      lines.push(`    sha512: ${yamlScalar(file.sha512)}`);
    }
    if (file.size) {
      lines.push(`    size: ${yamlScalar(file.size)}`);
    }
    if (file.blockMapSize) {
      lines.push(`    blockMapSize: ${yamlScalar(file.blockMapSize)}`);
    }
  }

  lines.push(`path: ${yamlScalar(zipFile.url)}`);
  if (zipFile.sha512) {
    lines.push(`sha512: ${yamlScalar(zipFile.sha512)}`);
  }
  if (metadata.releaseDate) {
    lines.push(`releaseDate: ${yamlScalar(metadata.releaseDate)}`);
  }

  return `${lines.join("\n")}\n`;
}

const inputPaths = inputNames.map((name) => path.join(distDir, name));
for (const inputPath of inputPaths) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Missing macOS update metadata: ${inputPath}`);
  }
}

const parsedFiles = inputPaths.map(parseLatestMacYml);
const [first] = parsedFiles;
const files = parsedFiles.flatMap((item) => item.files);

const merged = {
  version: first.version,
  releaseDate: first.releaseDate,
  files,
};

fs.writeFileSync(path.join(distDir, "latest-mac.yml"), renderLatestMacYml(merged));
for (const inputPath of inputPaths) {
  fs.unlinkSync(inputPath);
}
