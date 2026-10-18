import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractRealIp } from "@/app/api/geo/ip/route";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

/**
 * POST /api/geo/log-ip
 * Body: { userId: string }
 *
 * Captures the real client IP, resolves geo data via ip-api.com,
 * stores it on the user profile, logs it to ip_logs, and triggers
 * an admin alert if the IP country doesn't match the declared country.
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json();
    if (!userId) return NextResponse.json({ ok: false, error: "missing_user_id" }, { status: 400 });

    const ip = extractRealIp(req);

    // Skip logging for private/local IPs (local dev)
    if (ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.")) {
      return NextResponse.json({ ok: true, skipped: true, reason: "private_ip" });
    }

    // Resolve geo data
    let geo: GeoData | null = null;
    try {
      const geoRes = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,regionName,isp,lat,lon,timezone,query`,
        { next: { revalidate: 0 } }
      );
      const raw = await geoRes.json();
      if (raw.status === "success") {
        geo = {
          ip: raw.query || ip,
          country: raw.country,
          countryCode: raw.countryCode,
          city: raw.city,
          region: raw.regionName,
          isp: raw.isp,
          lat: raw.lat,
          lon: raw.lon,
          timezone: raw.timezone,
        };
      }
    } catch {
      // Non-critical — store raw IP even if geo lookup fails
    }

    const now = new Date().toISOString();

    // Update user_profiles with IP data
    await adminClient
      .from("user_profiles")
      .update({
        ip_address: geo?.ip || ip,
        ip_country: geo?.country || null,
        ip_country_code: geo?.countryCode || null,
        ip_city: geo?.city || null,
        ip_isp: geo?.isp || null,
        last_seen_at: now,
        last_ip_logged_at: now,
      })
      .eq("uid", userId);

    // Insert into ip_logs table
    await adminClient.from("ip_logs").insert({
      user_id: userId,
      ip_address: geo?.ip || ip,
      country: geo?.country || null,
      country_code: geo?.countryCode || null,
      city: geo?.city || null,
      isp: geo?.isp || null,
      lat: geo?.lat || null,
      lon: geo?.lon || null,
      timezone: geo?.timezone || null,
      logged_at: now,
    });

    // Check for country mismatch
    if (geo?.country) {
      const { data: profile } = await adminClient
        .from("user_profiles")
        .select("country, full_name, email")
        .eq("uid", userId)
        .single();

      if (profile?.country) {
        const declared = profile.country.toLowerCase().trim();
        const detected = geo.country.toLowerCase().trim();

        if (declared !== detected && !detected.includes(declared) && !declared.includes(detected)) {
          await adminClient.from("admin_notifications").insert({
            type: "ip_mismatch",
            title: "⚠️ IP / Country Mismatch Detected",
            message:
              `User "${profile.full_name || profile.email}" declared country: "${profile.country}" ` +
              `but their IP (${geo.ip}) resolves to: "${geo.country}" (${geo.city || "Unknown City"}). ` +
              `ISP: ${geo.isp || "Unknown"}. Please review this account.`,
            data: {
              user_id: userId,
              declared_country: profile.country,
              ip_country: geo.country,
              ip_country_code: geo.countryCode,
              ip_address: geo.ip,
              city: geo.city,
            },
            is_read: false,
            created_at: now,
          });
        }
      }
    }

    return NextResponse.json({ ok: true, ip: geo?.ip || ip, country: geo?.country || null });
  } catch (err) {
    console.error("[log-ip] Error:", err);
    return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
  }
}

interface GeoData {
  ip: string;
  country: string;
  countryCode: string;
  city: string;
  region: string;
  isp: string;
  lat: number;
  lon: number;
  timezone: string;
}
