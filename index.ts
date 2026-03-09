/**
 * Colony Surf Cleaning — Cloudflare Worker
 *
 * Endpoints:
 *   GET  /api/ping     → { ok: true }
 *   POST /api/bookings → validate auth + body → forward to Apps Script
 *
 * Environment secrets (set via wrangler secret):
 *   USER_TOKEN        – Bearer token the frontend sends
 *   WORKER_KEY        – Key sent to Apps Script in X-WORKER-KEY header
 *   APPS_SCRIPT_URL   – Full URL of your deployed Apps Script web app
 *   ALLOWED_ORIGIN    – e.g. https://yourgithubuser.github.io
 */

export interface Env {
  USER_TOKEN:      string;
  WORKER_KEY:      string;
  APPS_SCRIPT_URL: string;
  ALLOWED_ORIGIN:  string;
}

// ── In-memory rate limit store ────────────────────────────────
// Best-effort: resets when the isolate recycles.
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX     = 30;
const RATE_LIMIT_WINDOW  = 10 * 60 * 1000; // 10 minutes in ms

function checkRateLimit(ip: string): boolean {
  const now  = Date.now();
  const rec  = rateLimitMap.get(ip);

  if (!rec || now - rec.windowStart > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return true; // allowed
  }

  rec.count++;
  if (rec.count > RATE_LIMIT_MAX) return false; // blocked
  return true; // allowed
}

// ── CORS helpers ───────────────────────────────────────────────
function corsHeaders(origin: string, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin':  allowed === '*' || origin === allowed ? origin : '',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age':       '86400',
  };
}

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

// ── Main handler ───────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url    = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const cors   = corsHeaders(origin, env);

    // ── OPTIONS preflight ──────────────────────────────────────
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    // ── GET /api/ping ──────────────────────────────────────────
    if (request.method === 'GET' && url.pathname === '/api/ping') {
      // Ping still requires auth so it doubles as a token validator
      const authHeader = request.headers.get('Authorization') || '';
      const token      = authHeader.replace(/^Bearer\s+/i, '');

      if (!env.USER_TOKEN || token !== env.USER_TOKEN) {
        return jsonResponse({ ok: false, error: 'Unauthorized' }, 401, cors);
      }
      return jsonResponse({ ok: true }, 200, cors);
    }

    // ── POST /api/bookings ─────────────────────────────────────
    if (request.method === 'POST' && url.pathname === '/api/bookings') {

      // 1. Auth check
      const authHeader = request.headers.get('Authorization') || '';
      const token      = authHeader.replace(/^Bearer\s+/i, '');
      if (!env.USER_TOKEN || token !== env.USER_TOKEN) {
        return jsonResponse({ ok: false, error: 'Unauthorized' }, 401, cors);
      }

      // 2. Content-Type check
      const ct = request.headers.get('Content-Type') || '';
      if (!ct.includes('application/json')) {
        return jsonResponse({ ok: false, error: 'Content-Type must be application/json' }, 415, cors);
      }

      // 3. Size check (20 KB limit)
      const raw = await request.text();
      if (raw.length > 20 * 1024) {
        return jsonResponse({ ok: false, error: 'Payload too large (max 20 KB)' }, 413, cors);
      }

      // 4. Rate limit
      const ip = request.headers.get('CF-Connecting-IP') ||
                 request.headers.get('X-Forwarded-For')   ||
                 'unknown';
      if (!checkRateLimit(ip)) {
        return jsonResponse({ ok: false, error: 'Rate limit exceeded. Try again in 10 minutes.' }, 429, cors);
      }

      // 5. Parse JSON
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        return jsonResponse({ ok: false, error: 'Invalid JSON' }, 400, cors);
      }

      // 6. Required field validation
      const body = payload as Record<string, unknown>;
      const required = ['client_name', 'phone', 'address', 'property_size_category', 'service_date'];
      for (const field of required) {
        if (!body[field]) {
          return jsonResponse({ ok: false, error: `Missing required field: ${field}` }, 400, cors);
        }
      }

      // 7. Forward to Apps Script
      if (!env.APPS_SCRIPT_URL) {
        return jsonResponse({ ok: false, error: 'APPS_SCRIPT_URL not configured' }, 500, cors);
      }

      let scriptRes: Response;
      try {
        scriptRes = await fetch(env.APPS_SCRIPT_URL, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-WORKER-KEY':  env.WORKER_KEY || '',
          },
          body: JSON.stringify(payload),
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return jsonResponse({ ok: false, error: `Failed to reach Apps Script: ${msg}` }, 502, cors);
      }

      let scriptBody: Record<string, unknown>;
      try {
        scriptBody = await scriptRes.json() as Record<string, unknown>;
      } catch {
        return jsonResponse({ ok: false, error: 'Apps Script returned non-JSON response' }, 502, cors);
      }

      if (!scriptBody.ok) {
        return jsonResponse({ ok: false, error: scriptBody.error || 'Apps Script returned ok:false' }, 502, cors);
      }

      return jsonResponse({ ok: true, message: 'Booking saved to Google Sheet.' }, 200, cors);
    }

    // ── 404 fallback ───────────────────────────────────────────
    return jsonResponse({ ok: false, error: 'Not found' }, 404, cors);
  },
};
