import net from "node:net";
import { getEnv } from "@/lib/env";

const MAX_URL_LENGTH = 4096;
const CONTROL_CHAR_REGEX = /[\x00-\x1f\x7f]/;

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
]);

function isBlockedIpv4Int(num: number): boolean {
  const a = (num >>> 24) & 0xff;
  const b = (num >>> 16) & 0xff;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private)
  if (a === 10) return true;
  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local / cloud metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 & 192.0.2.0/24 (IETF / TEST-NET)
  if (a === 192 && b === 0) return true;
  // 192.168.0.0/16 (Private)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved / Broadcast)
  if (a >= 224) return true;

  return false;
}

/**
 * Attempts to parse dotted, decimal integer, octal, or hex IPv4 representations.
 * Browsers and URL parsers normalize forms like `0x7f000001` or `2130706433` or `127.1`.
 */
function parseIpv4ToUint32(hostname: string): number | null {
  if (/^\d+$/.test(hostname)) {
    const val = Number(hostname);
    if (Number.isInteger(val) && val >= 0 && val <= 0xffffffff) {
      return val >>> 0;
    }
    return null;
  }

  if (/^0x[0-9a-f]+$/i.test(hostname)) {
    const val = Number.parseInt(hostname, 16);
    if (Number.isInteger(val) && val >= 0 && val <= 0xffffffff) {
      return val >>> 0;
    }
    return null;
  }

  const parts = hostname.split(".");
  if (parts.length < 2 || parts.length > 4) return null;

  const nums: number[] = [];
  for (const part of parts) {
    if (!part) return null;
    let parsed: number;
    if (/^0x[0-9a-f]+$/i.test(part)) {
      parsed = Number.parseInt(part, 16);
    } else if (/^0[0-7]+$/.test(part)) {
      parsed = Number.parseInt(part, 8);
    } else if (/^\d+$/.test(part)) {
      parsed = Number.parseInt(part, 10);
    } else {
      return null;
    }
    if (!Number.isInteger(parsed) || parsed < 0) return null;
    nums.push(parsed);
  }

  // Handle shorthand (e.g. 127.1 -> 127.0.0.1)
  if (nums.length === 2) {
    if (nums[0] > 255 || nums[1] > 0xffffff) return null;
    return ((nums[0] << 24) | nums[1]) >>> 0;
  }
  if (nums.length === 3) {
    if (nums[0] > 255 || nums[1] > 255 || nums[2] > 0xffff) return null;
    return ((nums[0] << 24) | (nums[1] << 16) | nums[2]) >>> 0;
  }
  if (nums.some((n) => n > 255)) return null;
  return (
    ((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0
  );
}

function isBlockedIpv6(hostname: string): boolean {
  const clean = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (net.isIPv6(clean) === false) return false;

  // :: or ::1
  if (clean === "::" || clean === "::1" || /^0+(:0+)*:0*1$/.test(clean)) {
    return true;
  }

  // IPv4-mapped IPv6 e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1
  if (clean.startsWith("::ffff:")) {
    const tail = clean.slice(7);
    const v4 = parseIpv4ToUint32(tail);
    if (v4 !== null) {
      return isBlockedIpv4Int(v4);
    }
    const hexParts = tail.split(":");
    if (hexParts.length === 2) {
      const hi = Number.parseInt(hexParts[0], 16);
      const lo = Number.parseInt(hexParts[1], 16);
      if (!Number.isNaN(hi) && !Number.isNaN(lo)) {
        const combined = ((hi << 16) | lo) >>> 0;
        return isBlockedIpv4Int(combined);
      }
    }
    return true;
  }

  // Unique local addresses fc00::/7 (fc.. or fd..)
  if (/^f[cd][0-9a-f]{2}:/.test(clean) || clean === "fc00::" || clean === "fd00::") {
    return true;
  }

  // Link-local fe80::/10 (fe80..febf)
  if (/^fe[89ab][0-9a-f]:/.test(clean)) {
    return true;
  }

  // Multicast ff00::/8
  if (/^ff[0-9a-f]{2}:/.test(clean)) {
    return true;
  }

  return false;
}

export function isPrivateOrReservedHost(rawHostname: string): boolean {
  const host = rawHostname.toLowerCase().replace(/\.+$/, "").replace(/^\[|\]$/g, "");
  if (!host) return true;

  if (
    BLOCKED_HOSTNAMES.has(host) ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }

  const ipv4Int = parseIpv4ToUint32(host);
  if (ipv4Int !== null) {
    return isBlockedIpv4Int(ipv4Int);
  }

  if (isBlockedIpv6(host)) {
    return true;
  }

  return false;
}

export function matchesDomainBlocklist(
  hostname: string,
  blockedList: string[]
): boolean {
  const cleanHost = hostname.toLowerCase().replace(/\.+$/, "");
  for (const blocked of blockedList) {
    const cleanBlocked = blocked.toLowerCase().trim().replace(/\.+$/, "");
    if (!cleanBlocked) continue;
    if (
      cleanHost === cleanBlocked ||
      cleanHost.endsWith(`.${cleanBlocked}`)
    ) {
      return true;
    }
  }
  return false;
}

export interface UrlValidationOptions {
  requestHost?: string | null;
  blockedDomains?: string[];
  allowPrivateHosts?: boolean;
}

export interface UrlValidationResult {
  valid: boolean;
  /** Exact verbatim URL provided by the user (only leading/trailing whitespace trimmed) */
  url?: string;
  hostname?: string;
  error?: string;
}

/**
 * Strictly validates a destination URL without mutating or stripping
 * query parameters, URL-encoded sequences, or #fragments.
 */
export function validateDestinationUrl(
  rawInput: string,
  options: UrlValidationOptions = {}
): UrlValidationResult {
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return { valid: false, error: "Destination URL is required." };
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    return {
      valid: false,
      error: `URL exceeds maximum length of ${MAX_URL_LENGTH} characters.`,
    };
  }
  if (CONTROL_CHAR_REGEX.test(trimmed)) {
    return { valid: false, error: "URL contains invalid control characters." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: "Please enter a valid URL starting with http:// or https://.",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: `Protocol "${parsed.protocol}" is not permitted. Only http:// and https:// are allowed.`,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: "URLs containing embedded username or password credentials are not allowed.",
    };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  if (!hostname) {
    return { valid: false, error: "URL must include a valid hostname." };
  }

  if (!options.allowPrivateHosts && isPrivateOrReservedHost(hostname)) {
    return {
      valid: false,
      error:
        "Private, loopback, link-local, and internal network addresses are blocked.",
    };
  }

  // Self-referential loop check against APP_BASE_URL and incoming Host header
  const selfHosts = new Set<string>();
  try {
    const base = new URL(getEnv().APP_BASE_URL);
    selfHosts.add(base.host.toLowerCase());
    selfHosts.add(base.hostname.toLowerCase());
  } catch {
    // ignore invalid APP_BASE_URL fallback
  }

  if (options.requestHost) {
    const reqHost = options.requestHost.trim().toLowerCase();
    selfHosts.add(reqHost);
    const reqHostnameOnly = reqHost.split(":")[0];
    if (reqHostnameOnly) {
      selfHosts.add(reqHostnameOnly);
    }
  }

  const targetHostWithPort = parsed.host.toLowerCase();
  if (selfHosts.has(targetHostWithPort) || selfHosts.has(hostname)) {
    return {
      valid: false,
      error: "Self-referential URLs pointing to this shortener are not allowed.",
    };
  }

  if (
    options.blockedDomains &&
    matchesDomainBlocklist(hostname, options.blockedDomains)
  ) {
    return {
      valid: false,
      error: "This destination domain is on the administrator blocklist.",
    };
  }

  // Return the exact trimmed string so query params, encoding, and #fragments stay 100% verbatim
  return {
    valid: true,
    url: trimmed,
    hostname,
  };
}
