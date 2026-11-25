//=-- Wrapper around the Tauri CLI. Before `dev` / `build` it keeps the app icons in sync with
//=-- resources/logo.webp + resources/logo.ico and clears the stale compiled-icon cache.
//=-- Usage: `npm run tauri dev`, `npm run tauri build`, or `npm run icons` (prepare only).

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

const args = process.argv.slice(2);

if (args[0] === "--prepare-only") {
  syncIcons();
} else {
  if (args[0] === "dev" || args[0] === "build") syncIcons();
  run(process.execPath, [tauriCli, ...args], root);
}
