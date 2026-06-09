import dns from "node:dns/promises";
import net from "node:net";

/** Thrown when a user-supplied URL targets a non-public / unsafe destination. */
export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return true; // malformed → treat as unsafe
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 10) return true; // 10.0.0.0/8 private
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (lower.startsWith("fe80")) return true; // link-local fe80::/10
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local fc00::/7
  const mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return isPrivateIPv4(mapped[1]); // IPv4-mapped IPv6
  return false;
}

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // unknown format → unsafe
}

/**
 * Validate that a user-supplied URL is an http(s) URL pointing at a public
 * host, to mitigate SSRF (cloud metadata endpoints, loopback, RFC1918 ranges,
 * etc.). The hostname is resolved and the request is rejected if any resolved
 * address falls in a private/reserved range.
 *
 * Note: this validates the *initial* target only. Callers that let `fetch`
 * follow redirects retain some residual SSRF surface on redirect hops; keep
 * such fetches limited to trusted (e.g. admin) callers.
 */
export async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("URL invalida");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeUrlError("Solo URLs http/https");
  }

  const host = parsed.hostname.replace(/^\[/, "").replace(/\]$/, "");
  if (!host) throw new UnsafeUrlError("Destino no permitido");

  // Literal IP host — validate directly without DNS.
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError("Destino no permitido");
    return parsed;
  }

  // Hostname — resolve and ensure every resolved address is public.
  let addresses: string[];
  try {
    const results = await dns.lookup(host, { all: true });
    addresses = results.map((r) => r.address);
  } catch {
    throw new UnsafeUrlError("No se pudo resolver el host");
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a))) {
    throw new UnsafeUrlError("Destino no permitido");
  }

  return parsed;
}
