import type { AppConfig, SiteConfig } from "./types";

/**
 * Case-insensitive site lookup by id.
 *
 * @param config - The loaded config.
 * @param siteId - The id to find.
 * @returns The matching site, or `undefined`.
 */
export function findSite(
  config: AppConfig,
  siteId: string,
): SiteConfig | undefined {
  const needle = siteId.trim().toLowerCase();
  return config.sites.find((loc) => loc.id.trim().toLowerCase() === needle);
}

/**
 * Validates the config structure (non-empty sites, unique ids, required fields).
 *
 * @param config - The loaded config.
 * @returns Human-readable validation errors; empty when valid.
 */
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
