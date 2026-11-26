/**
 * Sites generator: pulls every site from the Datto RMM API and writes them to `sites.json`
 * in the shape of the `sites` array in `config.json`.
 *
 * Run with `npm run sites` (or `npm run configurator`). This is a developer tool and is not
 * part of the app. It needs Node 22.18+ (runs TypeScript directly) and read access to the API.
 *
 * Settings (CLI flag > environment > `.env` > `config.json`):
 * - `DATTO_API_KEY` / `DATTO_API_SECRET` (required): the account's API keys. Create them in
 *   Datto RMM under Setup > Users > (your user) > API Access.
 * - `--platform` / `PLATFORM`: platform subdomain, e.g. `vidal` (falls back to
 *   `installer.platform` in `config.json`). The API lives at `https://<platform>-api.centrastage.net`.
 * - `--out` / `SITES_OUT`: output file (default `sites.json` in the repo root).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** A site as returned by the Datto RMM API (only the fields used here). */
interface DattoSite {
  id: number;
  uid: string;
  name?: string | null;
}

/** One page of `GET /api/v2/account/sites`. */
interface DattoSitesPage {
  pageDetails?: { nextPageUrl?: string | null };
  sites?: DattoSite[];
}

/** A site in the shape the app's `config.json` expects. */
interface SiteConfig {
  id: string;
  shortName: string;
  displayName: string;
  siteUid: string;
}

/** Repo root (the folder above `scripts/`). */
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Names of built-in Datto sites that are not customer sites and are skipped. */
const SYSTEM_SITES = new Set(["deleted devices"]);

/**
 * Reads a `--name value` or `--name=value` CLI flag.
 *
 * @param name - Flag name without the leading dashes.
 * @returns The value, or `undefined` when the flag is absent.
 */
function flag(name: string): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === `--${name}`) return args[i + 1];
    if (arg.startsWith(`--${name}=`)) return arg.slice(name.length + 3);
  }
  return undefined;
}

/**
 * Returns the first non-blank string.
 *
 * @param values - Candidates in priority order.
 * @returns The first candidate with content, trimmed, or `undefined`.
 */
function firstNonBlank(...values: (string | undefined)[]): string | undefined {
  return values.map((v) => v?.trim()).find((v) => v);
}

/**
 * Splits a Datto site name into a short name and a display name.
 *
 * The name is split at the first delimiter: a spaced dash (` - `, ` – `, ` — `), or a colon or
 * semicolon (spaces optional). `77FORT - Fortress Security` and `77FORT: Fortress Security` both
 * give `77FORT` and `Fortress Security`. An unspaced hyphen (`Coca-Cola`) is not a delimiter. A
 * name with no delimiter is used as both the short name and the display name.
 *
 * @param name - The Datto site name.
 * @returns The short and display names.
 */
function splitName(name: string): { shortName: string; displayName: string } {
  const match = name.match(/^(.+?)(?:\s+[-–—]\s+|\s*[:;]\s*)(.+)$/);
  if (match) return { shortName: match[1].trim(), displayName: match[2].trim() };
  return { shortName: name.trim(), displayName: name.trim() };
}

/**
 * Converts Datto sites to config sites: splits names, builds unique case-insensitive ids from
 * the short name (a numeric suffix is added on collision), and sorts by short name.
 *
 * @param sites - Sites from the API.
 * @returns Sites ready for `config.json`.
 */
function toConfigSites(sites: DattoSite[]): SiteConfig[] {
  const used = new Set<string>();
  const out: SiteConfig[] = [];

  for (const site of sites) {
    const name = site.name?.trim() ?? "";
    if (SYSTEM_SITES.has(name.toLowerCase())) continue;

    //=-- A site with no name falls back to its UID so it is still selectable and unique.
    const { shortName, displayName } = splitName(name || `Site ${site.uid.slice(0, 8)}`);

    const base = shortName.replace(/[^A-Za-z0-9-]+/g, "").toUpperCase() || "SITE";
    let id = base;
    for (let n = 2; used.has(id.toLowerCase()); n++) id = `${base}-${n}`;
    used.add(id.toLowerCase());

    out.push({ id, shortName, displayName, siteUid: site.uid });
  }

  return out.sort((a, b) =>
    a.shortName.localeCompare(b.shortName, undefined, { sensitivity: "base", numeric: true }),
  );
}

/**
 * Requests an OAuth access token from the Datto RMM API.
 *
 * @param apiUrl - API base URL.
 * @param key - API key.
 * @param secret - API secret.
 * @returns The bearer token.
 */
async function getToken(apiUrl: string, key: string, secret: string): Promise<string> {
  //=-- Datto's documented public OAuth client; the account's own key/secret go in the form body.
  const res = await fetch(`${apiUrl}/auth/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from("public-client:public").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "password", username: key, password: secret }),
  });
  if (!res.ok) {
    throw new Error(`Authentication failed (HTTP ${res.status}). Check the API key, secret and platform.`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) throw new Error("Authentication response had no access_token.");
  return body.access_token;
}

/**
 * Fetches every site, following the API's pagination.
 *
 * @param apiUrl - API base URL.
 * @param token - Bearer token.
 * @returns All sites on the account.
 */
async function fetchSites(apiUrl: string, token: string): Promise<DattoSite[]> {
  const sites: DattoSite[] = [];
  let url: string | null = `${apiUrl}/api/v2/account/sites?page=0&max=250`;

  while (url) {
    const res: Response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Fetching sites failed (HTTP ${res.status}) from ${url}`);
    const page = (await res.json()) as DattoSitesPage;
    sites.push(...(page.sites ?? []));
    url = page.pageDetails?.nextPageUrl ?? null;
  }
  return sites;
}

/** Entry point: resolves settings, fetches the sites, and writes the output file. */
async function main(): Promise<void> {
  const envFile = resolve(ROOT, ".env");
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  let configPlatform: string | undefined;
  const configFile = resolve(ROOT, "config.json");
  if (existsSync(configFile)) {
    configPlatform = (JSON.parse(readFileSync(configFile, "utf8")) as { installer?: { platform?: string } })
      .installer?.platform;
  }

  const platform = firstNonBlank(flag("platform"), process.env.PLATFORM, configPlatform);
  const key = firstNonBlank(process.env.DATTO_API_KEY);
  const secret = firstNonBlank(process.env.DATTO_API_SECRET);
  const out = resolve(ROOT, firstNonBlank(flag("out"), process.env.SITES_OUT) ?? "sites.json");

  if (!platform) throw new Error("No platform. Use --platform, PLATFORM, or installer.platform in config.json.");
  if (!key || !secret) throw new Error("Set DATTO_API_KEY and DATTO_API_SECRET (in the environment or .env).");

  const apiUrl = `https://${platform}-api.centrastage.net`;
  console.log(`Authenticating with ${apiUrl} ...`);
  const token = await getToken(apiUrl, key, secret);

  console.log("Fetching sites ...");
  const sites = toConfigSites(await fetchSites(apiUrl, token));

  writeFileSync(out, JSON.stringify({ sites }, null, 2) + "\n", "utf8");
  console.log(`Wrote ${sites.length} site(s) to ${out}`);
}

main().catch((e: unknown) => {
  console.error(`Error: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
