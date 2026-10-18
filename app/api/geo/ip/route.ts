import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/geo/ip
 * Returns the real client IP and resolved geo-location data.
 * Uses ip-api.com free tier (no API key, up to 1000 req/min).
 */
export async function GET(req: NextRequest) {
  const ip = extractRealIp(req);

  // Skip lookup for local/private IPs
  if (isPrivateIp(ip)) {
    return NextResponse.json(
      { ip, success: false, error: "private_ip", country: null, countryCode: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const geoRes = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName,isp,org,lat,lon,timezone,query`,
      { next: { revalidate: 0 } }
    );
    const geo = await geoRes.json();

    if (geo.status === "success") {
      return NextResponse.json(
        {
          ip: geo.query || ip,
          success: true,
          country: geo.country,
          countryCode: geo.countryCode,
          city: geo.city,
          region: geo.regionName,
          isp: geo.isp,
          lat: geo.lat,
          lon: geo.lon,
          timezone: geo.timezone,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ip, success: false, error: "lookup_failed", country: null, countryCode: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { ip, success: false, error: "network_error", country: null, countryCode: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }
}

// ─── Extract real client IP from request headers ──────────────────────────────
export function extractRealIp(req: NextRequest): string {
  // Priority: Cloudflare > real-ip > forwarded-for chain > fallback
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // May be a comma-separated list — first entry is the real client
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }

  // Vercel-specific header
  const vercelIp = req.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0].trim();

  return "127.0.0.1";
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    ip.startsWith("172.") ||
    ip === "localhost"
  );
}
