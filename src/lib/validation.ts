import type { AppConfig, SiteConfig } from "./types";

//=-- Case-insensitive site lookup by id.
export function findSite(
  config: AppConfig,
  siteId: string,
): SiteConfig | undefined {
  const needle = siteId.trim().toLowerCase();
  return config.sites.find((loc) => loc.id.trim().toLowerCase() === needle);
}

//=-- Returns a list of human-readable validation errors (empty when valid).
export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];

  if (!Array.isArray(config.sites) || config.sites.length === 0) {
    errors.push("Config must contain a non-empty 'sites' array.");
    return errors;
  }

  const seen = new Set<string>();
  for (const loc of config.sites) {
    if (!loc.id || loc.id.trim() === "") {
      errors.push("A site is missing its 'id'.");
      continue;
    }

    const key = loc.id.trim().toLowerCase();
    if (seen.has(key)) {
      errors.push(`Duplicate site id: ${loc.id}`);
    }
    seen.add(key);

    if (!loc.shortName || loc.shortName.trim() === "") {
      errors.push(`Site '${loc.id}' is missing 'shortName'.`);
    }
    if (!loc.displayName || loc.displayName.trim() === "") {
      errors.push(`Site '${loc.id}' is missing 'displayName'.`);
    }
    if (!loc.siteUid || loc.siteUid.trim() === "") {
      errors.push(`Site '${loc.id}' has an empty 'siteUid'.`);
    }
  }

  return errors;
}
