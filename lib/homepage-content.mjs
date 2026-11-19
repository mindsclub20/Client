const FIRST_COFOUNDER_PATTERN = /<b>[^<]*<\/b>\s*<span>Co-founder<\/span>/i;
const VERIFIED_COFOUNDER_NAME = "B.V. Shyam Sundar";

/**
 * Replaces the first source co-founder label with the already-configured
 * MAXWEB founder identity. This prevents an obsolete placeholder in the
 * embedded static homepage from reaching the rendered page.
 */
export function normalizeFirstCofounderCard(source) {
  return source.replace(
    FIRST_COFOUNDER_PATTERN,
    `<b>${VERIFIED_COFOUNDER_NAME}</b><span>Co-founder</span>`
  );
}
