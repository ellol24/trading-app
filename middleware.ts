import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

// Simple in-memory rate limiter optimized for Vercel Edge Runtime.
// This state is maintained per Vercel Edge isolate instance, which provides
// a highly effective baseline defense against DDoS and brute-force bot attacks 
// without requiring an external Redis database.
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

// Configuration: Max 10 requests per minute per IP for sensitive routes
const RATE_LIMIT_SENSITIVE = 10; 
// Configuration: Max 30 requests per minute per IP for general API routes
const RATE_LIMIT_API = 30;
const WINDOW_MS = 60 * 1000; // 1 minute window

export async function middleware(request: NextRequest) {
  const ip = request.ip ?? request.headers.get("x-forwarded-for") ?? "127.0.0.1";
  const path = request.nextUrl.pathname;

  // 1. DYNAMIC RATE LIMITING FIREWALL
  const isSensitiveRoute = path.startsWith("/auth/login") || path.startsWith("/auth/register");
  const isApiRoute = path.startsWith("/api/");

  if (isSensitiveRoute || isApiRoute) {
    const now = Date.now();
    const windowStart = now - WINDOW_MS;

    const record = rateLimitMap.get(ip) || { count: 0, lastReset: now };

    // Reset window if exactly 1 minute has passed
    if (record.lastReset < windowStart) {
      record.count = 1;
      record.lastReset = now;
    } else {
      record.count++;
    }

    rateLimitMap.set(ip, record);

    const limit = isSensitiveRoute ? RATE_LIMIT_SENSITIVE : RATE_LIMIT_API;

    if (record.count > limit) {
      // If requests are HTML navigation, redirect or show error UI.
      // If API requests, return JSON.
      if (request.headers.get("accept")?.includes("application/json") || isApiRoute) {
        return new NextResponse(
          JSON.stringify({ error: "Too many requests. Protective firewall triggered. Please try again later." }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        return new NextResponse(
          "<html><body><h1>429 - Too Many Requests</h1><p>Our security firewall has temporarily blocked your IP due to suspicious traffic volume. Please try again in 1 minute.</p></body></html>",
          { status: 429, headers: { 'Content-Type': 'text/html' } }
        );
      }
    }
  }

  // 2. SUPABASE SESSION PROTECTION
  // Pass the request to the existing Supabase session refresher
  try {
    return await updateSession(request);
  } catch (error) {
    console.error("Middleware Session Error:", error);
    return NextResponse.next();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to add more static assets as needed.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
