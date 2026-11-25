import net from "node:net";
import { domainToASCII } from "node:url";
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

function parseIpv6ToBytes(ip: string): Uint8Array | null {
  const doubleColonParts = ip.split("::");
  if (doubleColonParts.length > 2) return null;

  const parseSide = (side: string): number[] | null => {
    if (!side) return [];
    const tokens = side.split(":");
    const hextets: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token) return null;
      if (token.includes(".")) {
        if (i !== tokens.length - 1) return null;
        const v4 = parseIpv4ToUint32(token);
        if (v4 === null) return null;
        hextets.push((v4 >>> 16) & 0xffff, v4 & 0xffff);
      } else if (/^[0-9a-f]{1,4}$/i.test(token)) {
        hextets.push(Number.parseInt(token, 16));
      } else {
        return null;
      }
    }
    return hextets;
  };

  let hextets: number[];
  if (doubleColonParts.length === 2) {
    const left = parseSide(doubleColonParts[0]);
    const right = parseSide(doubleColonParts[1]);
    if (!left || !right) return null;
    const missing = 8 - (left.length + right.length);
    if (missing < 1) return null;
    hextets = [...left, ...Array<number>(missing).fill(0), ...right];
  } else {
    const parsed = parseSide(ip);
    if (!parsed || parsed.length !== 8) return null;
    hextets = parsed;
  }

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    bytes[i * 2] = (hextets[i] >>> 8) & 0xff;
    bytes[i * 2 + 1] = hextets[i] & 0xff;
  }
  return bytes;
}

function bytesToIpv4Int(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  );
}

function isBlockedIpv6(hostname: string): boolean {
  const clean = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (net.isIPv6(clean) === false) return false;

  const bytes = parseIpv6ToBytes(clean);
  if (!bytes) return true;

  const allZeroFirst12 = bytes.slice(0, 12).every((b) => b === 0);

  // :: (unspecified), ::1 (loopback), and ::/96 (IPv4-compatible IPv6, e.g. ::127.0.0.1)
  if (allZeroFirst12) {
    const tailInt = bytesToIpv4Int(bytes, 12);
    if (tailInt === 0 || tailInt === 1) return true;
    return isBlockedIpv4Int(tailInt);
  }

  // ::ffff:0:0/96 (IPv4-mapped IPv6)
  if (
    bytes.slice(0, 10).every((b) => b === 0) &&
    bytes[10] === 0xff &&
    bytes[11] === 0xff
  ) {
    return isBlockedIpv4Int(bytesToIpv4Int(bytes, 12));
  }

  // ::ffff:0:0:0/96 (IPv4-translated IPv6)
  if (
    bytes.slice(0, 8).every((b) => b === 0) &&
    bytes[8] === 0xff &&
    bytes[9] === 0xff &&
    bytes[10] === 0 &&
    bytes[11] === 0
  ) {
    return isBlockedIpv4Int(bytesToIpv4Int(bytes, 12));
  }

  // 64:ff9b::/96 (NAT64 embedding IPv4)
  if (
    bytes[0] === 0x00 &&
    bytes[1] === 0x64 &&
    bytes[2] === 0xff &&
    bytes[3] === 0x9b &&
    bytes.slice(4, 12).every((b) => b === 0)
  ) {
    return isBlockedIpv4Int(bytesToIpv4Int(bytes, 12));
  }

  // 100::/64 (Discard-Only)
  if (
    bytes[0] === 0x01 &&
    bytes[1] === 0x00 &&
    bytes.slice(2, 8).every((b) => b === 0)
  ) {
    return true;
  }

  // fc00::/7 (Unique Local Addresses)
  if ((bytes[0] & 0xfe) === 0xfc) {
    return true;
  }

  // fe80::/10 (Link-local)
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) === 0x80) {
    return true;
  }

  // ff00::/8 (Multicast)
  if (bytes[0] === 0xff) {
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
  const cleanHost = (domainToASCII(hostname) || hostname)
    .toLowerCase()
    .replace(/\.+$/, "");
  for (const blocked of blockedList) {
    const trimmed = blocked.toLowerCase().trim().replace(/\.+$/, "");
    const cleanBlocked = (domainToASCII(trimmed) || trimmed).toLowerCase();
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
    return { valid: false, error: "Please paste a web link first." };
  }
  if (trimmed.length > MAX_URL_LENGTH) {
    return {
      valid: false,
      error: `That link is too long (maximum ${MAX_URL_LENGTH} characters).`,
    };
  }
  if (CONTROL_CHAR_REGEX.test(trimmed)) {
    return { valid: false, error: "That link contains unsupported characters." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      valid: false,
      error: "Please enter a valid web link starting with https:// or http://.",
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      valid: false,
      error: "Only standard web links (https:// or http://) are supported.",
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: "Links with an embedded username or password aren't allowed.",
    };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  if (!hostname) {
    return {
      valid: false,
      error: "Please enter a full website address (for example, example.com).",
    };
  }

  if (!options.allowPrivateHosts && isPrivateOrReservedHost(hostname)) {
    return {
      valid: false,
      error: "Local or private network addresses can't be shortened.",
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
    try {
      const reqUrl = new URL(`http://${reqHost}`);
      if (reqUrl.hostname) {
        selfHosts.add(reqUrl.hostname.toLowerCase());
      }
    } catch {
      const reqHostnameOnly = reqHost.split(":")[0];
      if (reqHostnameOnly) {
        selfHosts.add(reqHostnameOnly);
      }
    }
  }

  const targetHostWithPort = parsed.host.toLowerCase();
  if (selfHosts.has(targetHostWithPort) || selfHosts.has(hostname)) {
    return {
      valid: false,
      error: "You can't shorten a link that already points to this site.",
    };
  }

  if (
    options.blockedDomains &&
    matchesDomainBlocklist(hostname, options.blockedDomains)
  ) {
    return {
      valid: false,
      error: "This website isn't allowed on this link shortener.",
    };
  }

  // Return the exact trimmed string so query params, encoding, and #fragments stay 100% verbatim
  return {
    valid: true,
    url: trimmed,
    hostname,
  };
}
