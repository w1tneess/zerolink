import { describe, expect, it } from "vitest";
import { validateDestinationUrl } from "@/lib/security/url-validator";
import { validateCustomSlug } from "@/lib/security/slug-validator";

describe("URL Validator & Fidelity", () => {
  it("preserves complex query params, encoded characters, and #fragments verbatim", () => {
    const complexUrl =
      "https://docs.example.org/v2/search?q=zero%20telemetry&a=1&b=2%2F3&filter=a+b#section-4.2";
    const res = validateDestinationUrl(complexUrl, {
      requestHost: "short.example.com",
    });

    expect(res.valid).toBe(true);
    expect(res.url).toBe(complexUrl);
  });

  it("rejects dangerous and non-HTTP schemes", () => {
    const badSchemes = [
      "javascript:alert(1)",
      "JAVASCRIPT:alert(document.cookie)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "blob:https://example.com/1234",
      "ftp://example.com/file.zip",
      "not-a-valid-url",
    ];

    for (const candidate of badSchemes) {
      const res = validateDestinationUrl(candidate);
      expect(res.valid).toBe(false);
    }
  });

  it("rejects embedded credentials", () => {
    const res = validateDestinationUrl("https://admin:secret@example.com/login");
    expect(res.valid).toBe(false);
  });

  it("blocks loopback, private, link-local, and obfuscated IPs", () => {
    const privateTargets = [
      "http://127.0.0.1:8080/admin",
      "http://localhost:3000/secret",
      "http://sub.localhost/test",
      "http://10.0.0.5/internal",
      "http://172.16.42.10/api",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data/",
      "http://[::1]:3000/",
      "http://[::ffff:127.0.0.1]/",
      "http://2130706433/", // decimal 127.0.0.1
      "http://0x7f000001/", // hex 127.0.0.1
      "http://0177.0.0.1/", // octal 127.0.0.1
      "http://127.1/", // shorthand 127.0.0.1
    ];

    for (const target of privateTargets) {
      const res = validateDestinationUrl(target);
      expect(res.valid).toBe(false);
    }
  });

  it("blocks self-referential loops", () => {
    const res = validateDestinationUrl("https://myshort.example/abc123", {
      requestHost: "myshort.example",
    });
    expect(res.valid).toBe(false);
  });

  it("blocks domains and subdomains on the admin blocklist", () => {
    const blocklist = ["phish.example", "malware.org"];
    expect(
      validateDestinationUrl("https://phish.example/login", {
        blockedDomains: blocklist,
      }).valid
    ).toBe(false);

    expect(
      validateDestinationUrl("https://login.phish.example/step1", {
        blockedDomains: blocklist,
      }).valid
    ).toBe(false);

    expect(
      validateDestinationUrl("https://safe-example.org/docs", {
        blockedDomains: blocklist,
      }).valid
    ).toBe(true);
  });
});

describe("Slug Validator", () => {
  it("rejects reserved system routes and trailing '+'", () => {
    for (const reserved of [
      "admin",
      "ADMIN",
      "api",
      "login",
      "logout",
      "report",
      "health",
      "_next",
      "github+",
    ]) {
      expect(validateCustomSlug(reserved).valid).toBe(false);
    }
  });

  it("accepts clean vanity slugs", () => {
    expect(validateCustomSlug("github").valid).toBe(true);
    expect(validateCustomSlug("my-resume_2026").valid).toBe(true);
  });
});
