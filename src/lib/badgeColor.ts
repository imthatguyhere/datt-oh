/**
 * Derives a stable hue (0-359) from a string using an FNV-1a hash, so the same name always gets
 * the same color.
 *
 * @param text - The text to hash (compared case-insensitively).
 * @returns A hue in degrees.
 */
export function hueFromText(text: string): number {
  let hash = 2166136261;
  for (const ch of text.trim().toLowerCase()) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 360;
}

/**
 * Builds inline badge colors for a name: a dark tinted background with a light, same-hue text and
 * border, tuned to read on the dark theme.
 *
 * @param text - The name the color is derived from.
 * @returns CSS properties for `style`.
 */
export function badgeStyle(text: string): { backgroundColor: string; color: string; borderColor: string } {
  const hue = hueFromText(text);
  return {
    backgroundColor: `oklch(36% 0.11 ${hue})`,
    color: `oklch(92% 0.07 ${hue})`,
    borderColor: `oklch(58% 0.14 ${hue})`,
  };
}
