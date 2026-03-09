# Colony Surf Cleaning — Cloudflare Worker

A Cloudflare Worker that:
- Validates Bearer token auth
- Enforces rate limiting (30 req / 10 min per IP)
- Rejects large payloads and wrong Content-Type
- Forwards valid bookings to your Google Apps Script Web App
- Returns CORS headers for your GitHub Pages frontend

---

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/ping` | Required | Connectivity test |
| `POST` | `/api/bookings` | Required | Submit a booking |
| `OPTIONS` | `*` | None | CORS preflight |

---

## Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

```bash
npm install -g wrangler
wrangler login
```

---

## First Deploy

```bash
cd worker
wrangler deploy
```

Wrangler will output your Worker URL, e.g.:
```
https://colony-surf-worker.YOUR_SUBDOMAIN.workers.dev
```

---

## Setting Secrets

All sensitive values are stored as **Cloudflare Worker secrets** — never in `wrangler.toml`.

```bash
# The token the frontend sends in Authorization: Bearer <token>
wrangler secret put USER_TOKEN

# A secret key the Worker includes when calling Apps Script
wrangler secret put WORKER_KEY

# The full URL of your deployed Apps Script Web App
wrangler secret put APPS_SCRIPT_URL

# The GitHub Pages origin (e.g. https://yourusername.github.io)
wrangler secret put ALLOWED_ORIGIN
```

When prompted, paste the value and press Enter.

### Example values

| Secret | Example value |
|--------|--------------|
| `USER_TOKEN` | `mysupersecrettoken123` (make it long & random) |
| `WORKER_KEY` | `anotherrandombytes456` (different from USER_TOKEN) |
| `APPS_SCRIPT_URL` | `https://script.google.com/macros/s/AKfy.../exec` |
| `ALLOWED_ORIGIN` | `https://yourusername.github.io` |

---

## Local Development

```bash
cd worker
wrangler dev
```

The Worker runs at `http://localhost:8787`. You can test with curl:

```bash
# Ping
curl -H "Authorization: Bearer mysupersecrettoken123" \
     http://localhost:8787/api/ping

# Post a booking (replace token)
curl -X POST http://localhost:8787/api/bookings \
  -H "Authorization: Bearer mysupersecrettoken123" \
  -H "Content-Type: application/json" \
  -d '{
    "client_name": "Jane Doe",
    "phone": "808-555-0100",
    "address": "123 Surf Ln",
    "property_size_category": "Small cabin / 1–2 bed",
    "service_date": "2025-08-01"
  }'
```

For local dev with secrets, create a `.dev.vars` file:

```ini
USER_TOKEN=mysupersecrettoken123
WORKER_KEY=anotherrandombytes456
APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
ALLOWED_ORIGIN=http://localhost:3000
```

> ⚠️ Never commit `.dev.vars` — add it to `.gitignore`.

---

## Security Details

| Check | Behavior |
|-------|---------|
| Missing/wrong Bearer token | `401 Unauthorized` |
| Content-Type ≠ application/json | `415 Unsupported Media Type` |
| Body > 20 KB | `413 Payload Too Large` |
| > 30 requests per IP in 10 min | `429 Too Many Requests` |
| Missing required fields | `400 Bad Request` |
| Apps Script returns `ok: false` | `502 Bad Gateway` |

---

## Re-deploy After Changes

```bash
cd worker
wrangler deploy
```
