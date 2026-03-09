# Colony Surf Cleaning — Google Apps Script

This script receives booking data from your Cloudflare Worker and appends rows to a Google Sheet.

---

## Deployment Steps

### 1. Create Your Google Sheet

1. Go to [Google Sheets](https://sheets.google.com) → **Blank spreadsheet**.
2. Name it "Colony Surf Cleaning".
3. Copy the **Sheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
   ```

### 2. Open Apps Script

1. In your Sheet, click **Extensions** → **Apps Script**.
   *(Or go directly to [script.google.com](https://script.google.com))*

### 3. Paste the Code

1. Delete the default `function myFunction() {}` code.
2. Paste the entire contents of `AppsScript.js`.

### 4. Update Configuration

At the top of the script, update two values:

```javascript
var WORKER_KEY = 'REPLACE_WITH_YOUR_WORKER_KEY';
//                ↑ Must match WORKER_KEY secret in your Cloudflare Worker

var SHEET_ID = 'REPLACE_WITH_YOUR_SHEET_ID';
//              ↑ From your Google Sheet URL
```

### 5. Save the Script

Click **File** → **Save** (or `Ctrl+S`). Name the project "Colony Surf Booking Script".

### 6. Deploy as Web App

1. Click **Deploy** → **New deployment**.
2. Click the gear icon ⚙ next to **Type** → Select **Web app**.
3. Configure:
   - **Description**: `Colony Surf v1`
   - **Execute as**: `Me` (your Google account)
   - **Who has access**: `Anyone`
4. Click **Deploy**.
5. Click **Authorize access** and follow the OAuth prompts.
6. Copy the **Web app URL** — it looks like:
   ```
   https://script.google.com/macros/s/AKfycbxXXXXXXXX/exec
   ```

### 7. Store URL in Cloudflare Worker

```bash
wrangler secret put APPS_SCRIPT_URL
# Paste the Web app URL above
```

---

## How the Security Works

The Apps Script is deployed with **Anyone** access, meaning anyone who knows the URL can POST to it. However:

- Every request must include `__workerKey` in the JSON body matching the `WORKER_KEY` constant.
- Requests with the wrong key receive `{ ok: false, error: "Forbidden" }`.
- The Cloudflare Worker sends this key — the frontend never sees it.

---

## Updating the Script

If you change the code, you must **create a new deployment** (not edit the existing one):

1. Click **Deploy** → **Manage deployments**.
2. Click **Edit** (pencil icon) on your deployment.
3. Under **Version**, select **New version**.
4. Click **Deploy**.

> ⚠️ The URL does **not** change when you create a new version within the same deployment.

---

## Sheet Structure

The script auto-creates a header row on first run. Columns:

| Column | Field |
|--------|-------|
| A | `_id` |
| B | `_created_at` |
| C | `client_name` |
| D | `phone` |
| E | `address` |
| F | `beds_baths` |
| G | `property_type` |
| H | `approx_sq_ft` |
| I | `property_size_category` |
| J | `service_type` |
| K | `access` |
| L | `pets` |
| M | `notes` |
| N | `service_date` |
| O | `arrival_time` |
| P | `suggested_price_low` |
| Q | `suggested_price_high` |
