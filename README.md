# Colony Surf Cleaning — Frontend

A single-page HTML/CSS/JS booking app hosted on **GitHub Pages**.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Full SPA markup, Bootstrap 5, Bootstrap Icons |
| `app.js` | All routing, form logic, localStorage, export |
| `styles.css` | Coastal-themed design system |

---

## Deploying to GitHub Pages

### 1. Create a Repository

```bash
git init
git remote add origin https://github.com/YOUR_USERNAME/colony-surf-frontend.git
```

### 2. Push the `frontend/` files

Push `index.html`, `app.js`, and `styles.css` to the **root** of your repo
(or a `docs/` folder if you prefer).

```bash
cp frontend/* .
git add .
git commit -m "Initial deploy"
git push -u origin main
```

### 3. Enable GitHub Pages

1. Go to your repo → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / `(root)` → **Save**

Your site will be live at:
```
https://YOUR_USERNAME.github.io/colony-surf-frontend/
```

> Copy this URL — you will need it when setting the `ALLOWED_ORIGIN` secret
> on your Cloudflare Worker.

---

## First-Time Setup (in the app)

1. Open the app in your browser.
2. Click **Settings** in the nav.
3. Enter your **Worker Base URL** (e.g. `https://colony-surf.workers.dev`).
4. Enter your **User Token** (the same value as `USER_TOKEN` Worker secret).
5. Click **Save Settings**.
6. Click **Test Connection** — you should see `✅ Connected!`.

---

## How It Works

- All bookings are **saved to `localStorage`** first (works offline).
- On submit, the app also `POST`s to the Cloudflare Worker which forwards
  the booking to Google Sheets via Apps Script.
- If the Worker is unreachable (no internet, not configured), a warning is
  shown but the local save still completes.
- The **All Bookings**, **Schedule**, and **Export** pages all read from `localStorage`.

---

## No Secrets in Frontend

The `USER_TOKEN` is entered by you in the **Settings** page and stored in your
own browser's `localStorage`. It is **never** bundled or hardcoded in the source files.
