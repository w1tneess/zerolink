export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "login",
  "logout",
  "report",
  "health",
  "inspect",
  "unlock",
  "_next",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
]);

const CUSTOM_SLUG_REGEX = /^[a-zA-Z0-9_-]{2,64}$/;

export interface SlugValidationResult {
  valid: boolean;
  slug?: string;
  error?: string;
}

export function validateCustomSlug(rawSlug: string): SlugValidationResult {
  const slug = rawSlug.trim();
  if (!slug) {
    return { valid: false, error: "Slug cannot be empty." };
  }
  if (slug.endsWith("+")) {
    return {
      valid: false,
      error: "Slug cannot end with '+' (reserved for link preview mode).",
    };
  }
  if (!CUSTOM_SLUG_REGEX.test(slug)) {
    return {
      valid: false,
      error:
        "Slug must be 2–64 characters using only letters, numbers, '-' or '_'.",
    };
  }
  if (RESERVED_SLUGS.has(slug.toLowerCase())) {
    return {
      valid: false,
      error: `Slug "${slug}" is reserved for system routes.`,
    };
  }
  return { valid: true, slug };
}
