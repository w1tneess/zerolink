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

export function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function validateCustomSlug(rawSlug: string): SlugValidationResult {
  const slug = rawSlug.trim();
  if (!slug) {
    return { valid: false, error: "Custom ending cannot be empty." };
  }
  if (slug.endsWith("+")) {
    return {
      valid: false,
      error: "Custom endings can't end with '+' because '+' is used to preview links.",
    };
  }
  if (!CUSTOM_SLUG_REGEX.test(slug)) {
    return {
      valid: false,
      error:
        "Use 2 to 64 characters with only letters, numbers, '-' or '_'.",
    };
  }
  if (RESERVED_SLUGS.has(slug.toLowerCase())) {
    return {
      valid: false,
      error: `"${slug}" is reserved for a built-in page. Please pick another ending.`,
    };
  }
  return { valid: true, slug };
}
