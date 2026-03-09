/* ============================================================
   Colony Surf Cleaning — app.js
   All frontend logic: routing, form, localStorage, export
   ============================================================ */

'use strict';

// ── Constants ────────────────────────────────────────────────
const PRICING = {
  'RV / tiny cabin':       { low: 90,  high: 120 },
  'Small cabin / 1–2 bed': { low: 130, high: 180 },
  'Medium home / 3 bed':   { low: 180, high: 240 },
  'Large home':            { low: 240, high: 320 },
};

const LS_BOOKINGS = 'csc_bookings';
const LS_SETTINGS = 'csc_settings';

// ── Routing ──────────────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + name);
  if (page) page.classList.add('active');

  // update nav links
  document.querySelectorAll('[data-page]').forEach(a => {
    a.classList.toggle('active', a.dataset.page === name);
  });

  // lifecycle hooks
  if (name === 'all-bookings') renderBookings();
  if (name === 'schedule')     renderSchedule();
  if (name === 'export')       updateExportCount();
  if (name === 'settings')     loadSettings();
}

// ── Quote Calculator ─────────────────────────────────────────
function updateQuote() {
  const cat = document.getElementById('property_size_category').value;
  const box = document.getElementById('quote-box');
  const disp = document.getElementById('quote-display');

  if (!cat || !PRICING[cat]) {
    box.classList.add('d-none');
    return;
  }
  const { low, high } = PRICING[cat];
  disp.textContent = `$${low} – $${high}`;
  box.classList.remove('d-none');
}

// ── LocalStorage helpers ─────────────────────────────────────
function getBookings() {
  try { return JSON.parse(localStorage.getItem(LS_BOOKINGS)) || []; }
  catch { return []; }
}

function saveBookingLocal(booking) {
  const list = getBookings();
  list.push(booking);
  localStorage.setItem(LS_BOOKINGS, JSON.stringify(list));
}

function deleteBookingLocal(id) {
  const list = getBookings().filter(b => b._id !== id);
  localStorage.setItem(LS_BOOKINGS, JSON.stringify(list));
}

function getSettings() {
  try { return JSON.parse(localStorage.getItem(LS_SETTINGS)) || {}; }
  catch { return {}; }
}

function saveSettingsLocal(settings) {
  localStorage.setItem(LS_SETTINGS, JSON.stringify(settings));
}

// ── Form Submission ──────────────────────────────────────────
document.getElementById('booking-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  if (!form.checkValidity()) {
    form.classList.add('was-validated');
    return;
  }

  const cat = form.property_size_category.value;
  const { low, high } = PRICING[cat] || { low: 0, high: 0 };

  const payload = {
    _id:           crypto.randomUUID(),
    _created_at:   new Date().toISOString(),
    client_name:              form.client_name.value.trim(),
    phone:                    form.phone.value.trim(),
    address:                  form.address.value.trim(),
    beds_baths:               form.beds_baths.value,
    property_type:            form.property_type.value,
    approx_sq_ft:             form.approx_sq_ft.value,
    property_size_category:   cat,
    service_type:             form.service_type.value,
    access:                   form.access.value,
    pets:                     form.pets.value,
    notes:                    form.notes.value.trim(),
    service_date:             form.service_date.value,
    arrival_time:             form.arrival_time.value,
    suggested_price_low:      low,
    suggested_price_high:     high,
  };

  // Save locally first
  saveBookingLocal(payload);

  // Try to send to Worker
  const settings = getSettings();
  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving…';

  let remoteOk = false;
  let remoteMsg = '';

  if (settings.workerUrl && settings.userToken) {
    try {
      const res = await fetch(`${settings.workerUrl}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${settings.userToken}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        remoteOk = true;
      } else {
        remoteMsg = json.error || `HTTP ${res.status}`;
      }
    } catch (err) {
      remoteMsg = err.message;
    }
  } else {
    remoteMsg = 'No Worker URL / token configured (see Settings). Saved locally only.';
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-send-fill me-2"></i>Save Booking';
  form.classList.remove('was-validated');

  if (remoteOk) {
    showAlert('success', '✅ Booking saved locally and sent to Google Sheets!');
    showToast('Booking saved!', 'success');
    resetForm();
  } else if (remoteMsg) {
    showAlert('warning', `⚠️ Saved locally. Remote sync failed: ${remoteMsg}`);
    showToast('Saved locally only', 'warning');
    resetForm();
  } else {
    showAlert('success', '✅ Booking saved locally.');
    showToast('Saved!', 'success');
    resetForm();
  }
});

function resetForm() {
  const form = document.getElementById('booking-form');
  form.reset();
  form.classList.remove('was-validated');
  document.getElementById('quote-box').classList.add('d-none');
}

// ── Alert helper ─────────────────────────────────────────────
function showAlert(type, message) {
  const el = document.getElementById('form-alert');
  el.innerHTML = `
    <div class="alert alert-${type} alert-dismissible fade show" role="alert">
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ── Toast helper ──────────────────────────────────────────────
function showToast(message, type = 'success') {
  const toastEl = document.getElementById('app-toast');
  const toastBody = document.getElementById('toast-body');
  toastEl.className = `toast align-items-center border-0 text-bg-${type === 'warning' ? 'warning' : 'success'}`;
  toastBody.textContent = message;
  const t = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 3000 });
  t.show();
}

// ── All Bookings Page ─────────────────────────────────────────
function renderBookings() {
  const wrap = document.getElementById('bookings-table-wrap');
  let bookings = getBookings();

  // Search
  const q = (document.getElementById('search-input')?.value || '').toLowerCase();
  if (q) {
    bookings = bookings.filter(b =>
      (b.client_name || '').toLowerCase().includes(q) ||
      (b.phone || '').toLowerCase().includes(q) ||
      (b.address || '').toLowerCase().includes(q)
    );
  }

  // Sort
  const sort = document.getElementById('sort-select')?.value || 'date-asc';
  bookings.sort((a, b) => {
    if (sort === 'date-asc')  return (a.service_date || '') < (b.service_date || '') ? -1 : 1;
    if (sort === 'date-desc') return (a.service_date || '') > (b.service_date || '') ? -1 : 1;
    if (sort === 'name-asc')  return (a.client_name || '').localeCompare(b.client_name || '');
    return 0;
  });

  if (!bookings.length) {
    wrap.innerHTML = '<p class="text-muted">No bookings found.</p>';
    return;
  }

  const rows = bookings.map(b => `
    <tr>
      <td>${esc(b.service_date || '—')}</td>
      <td><strong>${esc(b.client_name || '—')}</strong></td>
      <td>${esc(b.phone || '—')}</td>
      <td class="d-none d-md-table-cell">${esc(b.address || '—')}</td>
      <td class="d-none d-lg-table-cell">${b.service_type ? `<span class="badge-service">${esc(b.service_type)}</span>` : '—'}</td>
      <td class="d-none d-lg-table-cell">${esc(b.property_size_category || '—')}</td>
      <td class="price-cell">${b.suggested_price_low ? `$${b.suggested_price_low}–$${b.suggested_price_high}` : '—'}</td>
      <td><button class="btn-delete" onclick="deleteEntry('${esc(b._id)}')"><i class="bi bi-trash3"></i></button></td>
    </tr>`).join('');

  wrap.innerHTML = `
    <div class="bookings-table-wrapper">
      <table class="bookings-table">
        <thead>
          <tr>
            <th>Date</th><th>Client</th><th>Phone</th>
            <th class="d-none d-md-table-cell">Address</th>
            <th class="d-none d-lg-table-cell">Service</th>
            <th class="d-none d-lg-table-cell">Size</th>
            <th>Quote</th><th></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function deleteEntry(id) {
  if (!confirm('Delete this booking?')) return;
  deleteBookingLocal(id);
  renderBookings();
}

// ── Schedule Page ─────────────────────────────────────────────
function renderSchedule() {
  const container = document.getElementById('schedule-list');
  const today = new Date().toISOString().slice(0, 10);
  const bookings = getBookings()
    .filter(b => b.service_date && b.service_date >= today)
    .sort((a, b) => (a.service_date + (a.arrival_time || '')) < (b.service_date + (b.arrival_time || '')) ? -1 : 1);

  if (!bookings.length) {
    container.innerHTML = '<p class="text-muted">No upcoming bookings.</p>';
    return;
  }

  // Group by date
  const groups = {};
  bookings.forEach(b => {
    groups[b.service_date] = groups[b.service_date] || [];
    groups[b.service_date].push(b);
  });

  container.innerHTML = Object.entries(groups).map(([date, items]) => {
    const cards = items.map(b => `
      <div class="schedule-card">
        <div class="schedule-time">${b.arrival_time ? fmtTime(b.arrival_time) : 'TBD'}</div>
        <div class="schedule-info">
          <div class="client-name">${esc(b.client_name || '—')}</div>
          <div class="client-addr">${esc(b.address || '')} &bull; ${esc(b.service_type || '')} &bull; ${esc(b.property_size_category || '')}</div>
        </div>
        <div class="schedule-price">${b.suggested_price_low ? `$${b.suggested_price_low}–$${b.suggested_price_high}` : ''}</div>
      </div>`).join('');

    return `
      <div class="schedule-date-group">
        <div class="schedule-date-label">${fmtDate(date)}</div>
        ${cards}
      </div>`;
  }).join('');
}

// ── Export Page ───────────────────────────────────────────────
function updateExportCount() {
  const n = getBookings().length;
  document.getElementById('export-count').textContent =
    n ? `${n} booking${n > 1 ? 's' : ''} in local storage` : 'No bookings yet.';
}

function exportCSV() {
  const bookings = getBookings();
  if (!bookings.length) { alert('No bookings to export.'); return; }

  const fields = [
    '_id','_created_at','client_name','phone','address',
    'beds_baths','property_type','approx_sq_ft','property_size_category',
    'service_type','access','pets','notes','service_date','arrival_time',
    'suggested_price_low','suggested_price_high'
  ];

  const escape = v => {
    const s = String(v === null || v === undefined ? '' : v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };

  const csv = [
    fields.join(','),
    ...bookings.map(b => fields.map(f => escape(b[f])).join(','))
  ].join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `colony-surf-bookings-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Settings Page ─────────────────────────────────────────────
function loadSettings() {
  const s = getSettings();
  document.getElementById('setting-url').value   = s.workerUrl   || '';
  document.getElementById('setting-token').value = s.userToken   || '';
}

function saveSettings() {
  const url   = document.getElementById('setting-url').value.trim().replace(/\/$/, '');
  const token = document.getElementById('setting-token').value.trim();
  saveSettingsLocal({ workerUrl: url, userToken: token });
  showToast('Settings saved!');
}

function toggleTokenVisibility() {
  const input = document.getElementById('setting-token');
  const icon  = document.getElementById('token-eye');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'bi bi-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'bi bi-eye';
  }
}

async function testConnection() {
  // Always read from localStorage — input fields may not be populated yet
  const saved = getSettings();
  const url   = (saved.workerUrl  || '').replace(/\/$/, '');
  const token =  saved.userToken  || '';
  const result = document.getElementById('ping-result');

  if (!url || !token) {
    result.innerHTML = '<div class="alert alert-warning">Please fill in Worker URL and Token first.</div>';
    return;
  }

  result.innerHTML = '<div class="alert alert-secondary"><span class="spinner-border spinner-border-sm me-2"></span>Testing…</div>';

  try {
    const res = await fetch(`${url}/api/ping`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const json = await res.json();
    if (res.ok && json.ok) {
      result.innerHTML = '<div class="alert alert-success">✅ Connected! Worker responded with <code>ok: true</code>.</div>';
    } else {
      result.innerHTML = `<div class="alert alert-danger">❌ Worker returned HTTP ${res.status}: ${JSON.stringify(json)}</div>`;
    }
  } catch (err) {
    result.innerHTML = `<div class="alert alert-danger">❌ Connection failed: ${err.message}</div>`;
  }
}

function clearAllBookings() {
  if (!confirm('Delete ALL local bookings? This cannot be undone.')) return;
  localStorage.removeItem(LS_BOOKINGS);
  showToast('All bookings cleared.', 'warning');
}

// ── Utility ───────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`;
}

function fmtTime(t) {
  if (!t) return 'TBD';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}

// ── Init ──────────────────────────────────────────────────────
showPage('new-booking');
loadSettings(); // pre-populate settings fields on first load
