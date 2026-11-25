//=-- Wrapper around the Tauri CLI. Before `dev` / `build` it (1) writes the version from
//=-- src-tauri/Cargo.toml (the source of truth) into package.json / package-lock.json, and
//=-- (2) keeps the app icons in sync with resources/logo.webp + resources/logo.ico and clears
//=-- the stale compiled-icon cache.
//=-- Usage: `npm run tauri dev`, `npm run tauri build`, or `npm run sync` (prepare only).

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tauriDir = join(root, "src-tauri");
const logoWebp = join(root, "resources", "logo.webp");
const logoIco = join(root, "resources", "logo.ico");
const iconsDir = join(tauriDir, "icons");
const hashFile = join(tauriDir, "target", ".logo-hash");
const tauriCli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");
const crateName = "datt-oh";
const cargoToml = join(tauriDir, "Cargo.toml");
const packageJson = join(root, "package.json");
const packageLock = join(root, "package-lock.json");

/**
 * Runs a command and exits the process with its status if it fails.
 * @param {string} cmd Executable to run.
 * @param {string[]} args Arguments for the executable.
 * @param {string} cwd Working directory.
 */
function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit" });
  if (res.error) {
    console.error(`[datt-oh] Failed to run ${cmd}: ${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0) process.exit(res.status ?? 1);
}

/**
 * Hashes the logo sources so changes can be detected between runs.
 * @returns {string} Hex SHA-256 over both logo files.
 */
function logoHash() {
  const hash = createHash("sha256");
  hash.update(readFileSync(logoWebp));
  hash.update(readFileSync(logoIco));
  return hash.digest("hex");
}

/**
 * Regenerates icons and clears the app crate's build cache when the logo changed.
 * Cargo does not notice icon-only changes (they are embedded by a proc macro), so the
 * crate is cleaned to force the new icon to be compiled in.
 */
function syncIcons() {
  if (!existsSync(logoWebp) || !existsSync(logoIco)) {
    console.error("[datt-oh] resources/logo.webp and resources/logo.ico are required.");
    process.exit(1);
  }

  const current = logoHash();
  const previous = existsSync(hashFile) ? readFileSync(hashFile, "utf8").trim() : "";
  if (current === previous && existsSync(join(iconsDir, "icon.ico"))) {
    console.log("[datt-oh] Icons are up to date.");
    return;
  }

  console.log("[datt-oh] Logo changed — regenerating icons...");
  run(process.execPath, [tauriCli, "icon", logoWebp], root);
  copyFileSync(logoIco, join(iconsDir, "icon.ico"));

  console.log("[datt-oh] Clearing cached app build so the new icon is embedded...");
  run("cargo", ["clean", "-p", crateName], tauriDir);

  mkdirSync(dirname(hashFile), { recursive: true });
  writeFileSync(hashFile, current);
}

/**
 * Reads `package.version` from src-tauri/Cargo.toml.
 * @returns {string} The crate version, e.g. "1.0.0".
 */
function readCargoVersion() {
  const toml = readFileSync(cargoToml, "utf8");
  const pkg = toml.match(/^\[package\]([\s\S]*?)(?=^\[|$(?![\s\S]))/m);
  const ver = pkg?.[1].match(/^version\s*=\s*"([^"]+)"/m);
  if (!ver) {
    console.error("[datt-oh] Could not find package.version in src-tauri/Cargo.toml.");
    process.exit(1);
  }
  return ver[1];
}

/**
 * Replaces the first `count` `"version": "..."` values in a file with `version`.
 * Targeted text replacement so the file's formatting and line endings are preserved.
 * @param {string} file File to update.
 * @param {string} version New version string.
 * @param {number} count How many leading occurrences to replace.
 */
function writeVersion(file, version, count) {
  if (!existsSync(file)) return;
  let seen = 0;
  const text = readFileSync(file, "utf8");
  const next = text.replace(/("version"\s*:\s*")[^"]*(")/g, (match, a, b) =>
    ++seen <= count ? `${a}${version}${b}` : match,
  );
  if (next !== text) {
    writeFileSync(file, next);
    console.log(`[datt-oh] Set version ${version} in ${file.slice(root.length + 1)}`);
  }
}

/**
 * Copies the Cargo.toml version into package.json and the two root entries of package-lock.json.
 */
function syncVersion() {
  const version = readCargoVersion();
  writeVersion(packageJson, version, 1);
  writeVersion(packageLock, version, 2);
}

const args = process.argv.slice(2);

if (args[0] === "--prepare-only") {
  syncVersion();
  syncIcons();
} else {
  if (args[0] === "dev" || args[0] === "build") {
    syncVersion();
    syncIcons();
  }
  run(process.execPath, [tauriCli, ...args], root);
}
