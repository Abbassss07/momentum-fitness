import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type RateLimitResult = {
  allowed: boolean;
  state: "allowed" | "rate_limited" | "banned";
  retryAfterSeconds: number;
};

const GENERIC_LIMIT_MESSAGE = "Too many requests. Please try again later.";
const GENERIC_SENT_MESSAGE = "If an account is eligible, a sign-in email has been sent.";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== origin) {
    return Response.json({ error: GENERIC_LIMIT_MESSAGE }, { status: 403 });
  }

  const ip = clientIp(request);
  if (!ip) {
    return Response.json({ error: "Unable to process this request." }, { status: 400 });
  }

  const email = await requestEmail(request);
  if (!email) {
    return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const config = rateLimitConfig();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ?? "https://bfqdlggxzwdjxjqkdulk.supabase.co";
  const serverKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pepper = process.env.LOGIN_RATE_LIMIT_PEPPER;

  if (!serverKey || !pepper) {
    console.error("Login email abuse protection is missing server configuration.");
    return Response.json({ error: "Unable to process this request." }, { status: 503 });
  }

  const emailHash = createHash("sha256")
    .update(`${pepper}:${email}`)
    .digest("hex");
  const admin = createClient(supabaseUrl, serverKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: process.env.SUPABASE_SECRET_KEY
      ? { headers: { "sb-forwarded-for": ip } }
      : undefined,
  });

  const { data: rateLimit, error: rateLimitError } = await admin.rpc(
    "consume_login_email_rate_limit",
    {
      target_ip: ip,
      target_email_hash: emailHash,
      ip_max_requests: config.ipMaxRequests,
      ip_window_seconds: config.ipWindowSeconds,
      email_max_requests: config.emailMaxRequests,
      email_window_seconds: config.emailWindowSeconds,
      ban_threshold: config.banThreshold,
      ban_window_seconds: config.banWindowSeconds,
      ban_duration_seconds: config.banDurationSeconds,
    },
  );

  if (rateLimitError || !rateLimit) {
    console.error("Login email rate-limit check failed.", rateLimitError);
    return Response.json({ error: "Unable to process this request." }, { status: 503 });
  }

  const decision = rateLimit as RateLimitResult;
  if (!decision.allowed) {
    return limitedResponse(
      decision.state === "banned" ? 403 : 429,
      decision.retryAfterSeconds,
    );
  }

  const { error: authError } = await admin.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: origin,
    },
  });

  if (authError) {
    console.error("Supabase login email request failed.", {
      name: authError.name,
      status: authError.status,
    });
    if (authError.status === 429) return limitedResponse(429, 60);
    return Response.json({ error: "Unable to process this request." }, { status: 503 });
  }

  return Response.json({ message: GENERIC_SENT_MESSAGE });
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-vercel-forwarded-for")
    ?? request.headers.get("x-forwarded-for");
  const candidate = forwarded?.split(",")[0]?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

async function requestEmail(request: Request) {
  try {
    const body = await request.json() as { email?: unknown };
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  } catch {
    return null;
  }
}

function rateLimitConfig() {
  return {
    ipMaxRequests: envInteger("LOGIN_EMAIL_IP_MAX_REQUESTS", 5, 1, 100),
    ipWindowSeconds: envInteger("LOGIN_EMAIL_IP_WINDOW_SECONDS", 600, 60, 86400),
    emailMaxRequests: envInteger("LOGIN_EMAIL_MAX_REQUESTS", 3, 1, 100),
    emailWindowSeconds: envInteger("LOGIN_EMAIL_WINDOW_SECONDS", 3600, 60, 86400),
    banThreshold: envInteger("LOGIN_EMAIL_BAN_THRESHOLD", 20, 2, 1000),
    banWindowSeconds: envInteger("LOGIN_EMAIL_BAN_WINDOW_SECONDS", 3600, 60, 86400),
    banDurationSeconds: envInteger("LOGIN_EMAIL_BAN_DURATION_SECONDS", 86400, 300, 604800),
  };
}

function envInteger(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : fallback;
}

function limitedResponse(status: 403 | 429, retryAfterSeconds: number) {
  return Response.json(
    { error: GENERIC_LIMIT_MESSAGE },
    {
      status,
      headers: { "Retry-After": String(Math.max(1, retryAfterSeconds)) },
    },
  );
}

