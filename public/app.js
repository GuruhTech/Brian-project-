'use strict';

/* ── API base URL ────────────────────────────────────────────────── */
const API = '';   /* Same origin — server.js serves this file */

/* ── Part image map (part name lowercase → image URL) ───────────── */
const PART_IMAGES = {
  'oil filter':              'https://us.123rf.com/450wm/nikkytok/nikkytok1704/nikkytok170400114/76985580-oil-filter-part-for-car-white-background.jpg',
  'brake pads (front)':      'https://thumbs.dreamstime.com/b/car-brake-pads-isolated-white-background-68720101.jpg',
  'brake pads':              'https://thumbs.dreamstime.com/b/car-brake-pads-isolated-white-background-68720101.jpg',
  'air filter':              'https://static.vecteezy.com/system/resources/thumbnails/010/220/912/small/square-car-air-filter-on-a-white-background-photo.jpg',
  'alternator belt':         'https://www.jalopnik.com/img/gallery/should-you-replace-your-cars-serpentine-belt-when-replacing-the-alternator/intro-1765207174.jpg',
  'shock absorber (front)':  'https://static.vecteezy.com/system/resources/thumbnails/050/752/477/small/pair-of-shock-absorbers-isolated-on-white-background-photo.jpg',
  'shock absorber':          'https://static.vecteezy.com/system/resources/thumbnails/050/752/477/small/pair-of-shock-absorbers-isolated-on-white-background-photo.jpg',
  'radiator':                'https://i5.walmartimages.com/seo/ECCPP-Auto-Parts-Plastic-Aluminum-Replacement-Radiator-for-2007-2008-2009-2010-2011-for-Nissan-Versa-hatchback-SL-CU2981_95add1ef-1b1d-4845-8e39-2ea4ff871e17.d09466c1d35174ea459b6477243648c2.jpeg?odnHeight=576&odnWidth=576&odnBg=FFFFFF',
};

/* ── Part category fallback images ──────────────────────────────── */
const PART_CATEGORY_IMAGES = {
  'engine':     'https://static.vecteezy.com/system/resources/thumbnails/006/196/306/small/detailed-car-engine-and-other-parts-video.jpg',
  'brakes':     'https://thumbs.dreamstime.com/b/auto-parts-white-background-brake-pads-filter-bearing-33128160.jpg',
  'electrical': 'https://fargoautoelectricals.com/blog/wp-content/uploads/2023/01/spare-parts-online-300x157.png',
  'suspension': 'https://proleantech.com/wp-content/uploads/2025/01/Car-Suspension-Parts-1024x576.webp',
  'cooling':    'https://littlewolfauto.com/wp-content/uploads/2022/09/little-wolf-waupaca-sept-22-blog-radiator-cooling-system-parts.webp',
};

function getPartImage(name, category) {
  const key = (name || '').toLowerCase();
  const cat = (category || '').toLowerCase();
  return PART_IMAGES[key] || PART_CATEGORY_IMAGES[cat] || null;
}

/* ── Car image map (make + model → image URL) ───────────────────── */
const CAR_IMAGES = {
  'toyota corolla':      'https://w0.peakpx.com/wallpaper/951/766/HD-wallpaper-toyota-corolla-2020-side-view-new-silver-corolla-exterior-sedan-japanese-cars-toyota-thumbnail.jpg',
  'toyota hilux':        'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7f/2021_Toyota_Hilux_Invincible_D-4D_2.8_%28facelift%2C_silver%29%2C_front_8.22.jpg/1280px-2021_Toyota_Hilux_Invincible_D-4D_2.8_%28facelift%2C_silver%29%2C_front_8.22.jpg',
  'mazda cx-5':          'https://hips.hearstapps.com/hmg-prod/images/2026-mazda-cx-5-exterior-pr-101-686d61452f8db.jpg',
  'bmw 3 series':        'https://static.cargurus.com/images/forsale/2026/04/13/22/10/2018_bmw_3_series-pic-6016570562730503913-1024x768.jpeg?io=true&width=640&height=480&fit=bounds&format=jpg&auto=webp',
  'subaru forester':     'https://file.kelleybluebookimages.com/kbb/base/evox/CP/12664/2020-Subaru-Forester-front_12664_032_1849x898_K1X_cropped.png',
  'mercedes c-class':    'https://di-uploads-pod5.dealerinspire.com/mercedesbenzofsugarland/uploads/2019/02/2019-Mercedes-Benz-C-Class-Sedan-white-front-exterior.jpg',
  'honda cr-v':          'https://pictures.dealer.com/h/hondaofforthworth/0206/9a40c63b28132514a91c22eba703f80ax.jpg',
  'nissan x-trail':      'https://www.carscoops.com/wp-content/uploads/2019/11/2021-Nissan-Rogue-X-Trail-Carscoops-1.jpg',
  'land rover discovery':'https://di-shared-assets.dealerinspire.com/legacy/rackspace/ldm-images/2020-Land-Rover-Discovery-Indus-Silver.jpg',
  'kawasaki ninja':      'https://i0.wp.com/audi2021.com/wp-content/uploads/2020/01/2021-Audi-RS5-Exterior.png?resize=700,383&ssl=1',
  'kia sportage':        'https://imgcdn.zigwheels.us/large/gallery/color/3/21/kia-sportage-color-918367.jpg',
  'volkswagen tiguan':   'https://file.kelleybluebookimages.com/kbb/base/evox/CP/14177/2021-Volkswagen-Tiguan-front_14177_032_1831x863_K2K2_cropped.png',
};

function getCarImage(make, model) {
  const key = `${(make || '').toLowerCase()} ${(model || '').toLowerCase()}`;
  return CAR_IMAGES[key] || null;
}

/* ── State ──────────────────────────────────────────────────────── */
let token     = localStorage.getItem('bm_token') || null;
let currentUser = null;
let allCars   = [];
let allParts  = [];
let dashData  = null;
let adminData = null;
let lastClientReport = null;

/* ── Utilities ───────────────────────────────────────────────────── */
function fmtKsh(n) {
  return 'Ksh ' + Number(n).toLocaleString('en-KE', { minimumFractionDigits: 0 });
}
function fmtDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}
function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

let toastTimer;
function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ── Navigation ──────────────────────────────────────────────────── */
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => {
    l.classList.toggle('active', l.dataset.page === name);
  });
  document.getElementById(name + 'Page').classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (name === 'dashboard') {
    if (!token) { openAuth(); return; }
    loadDashboard();
  }
  if (name === 'admin') {
    if (!token || !currentUser || currentUser.role !== 'admin') { toast('Admin access only.', 'error'); showPage('cars'); return; }
    loadAdmin();
  }
  if (name === 'cars')   loadCars();
  if (name === 'parts')  loadParts();
  if (name === 'book')   initBookPage();
}

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => { e.preventDefault(); showPage(link.dataset.page); });
});

function toggleMenu() {
  document.getElementById('mobileMenu').classList.toggle('open');
}

/* ── Auth ────────────────────────────────────────────────────────── */
function openAuth()  { document.getElementById('authOverlay').classList.add('open'); }
function closeAuth() { document.getElementById('authOverlay').classList.remove('open'); }
function openForgot()  { closeAuth(); document.getElementById('forgotOverlay').classList.add('open'); }
function closeForgot() { document.getElementById('forgotOverlay').classList.remove('open'); }

function switchTab(t) {
  document.getElementById('loginForm').style.display    = t === 'login'    ? '' : 'none';
  document.getElementById('registerForm').style.display = t === 'register' ? '' : 'none';
  document.getElementById('loginTabBtn').classList.toggle('active', t === 'login');
  document.getElementById('registerTabBtn').classList.toggle('active', t === 'register');
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginSubmit');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: document.getElementById('loginEmail').value, password: document.getElementById('loginPassword').value }),
    });
    setUser(data.token, data.user);
    closeAuth();
    toast('Welcome back, ' + data.user.name.split(' ')[0] + '!', 'success');
  } catch (err) { toast(err.message, 'error'); }
  btn.disabled = false; btn.textContent = 'Sign In';
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById('regSubmit');
  btn.disabled = true; btn.textContent = 'Creating account…';
  try {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: document.getElementById('regName').value, email: document.getElementById('regEmail').value, phone: document.getElementById('regPhone').value, password: document.getElementById('regPassword').value }),
    });
    setUser(data.token, data.user);
    closeAuth();
    toast('Account created! Welcome, ' + data.user.name.split(' ')[0] + '!', 'success');
  } catch (err) { toast(err.message, 'error'); }
  btn.disabled = false; btn.textContent = 'Create Account';
}

async function handleForgot(e) {
  e.preventDefault();
  try {
    await apiFetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: document.getElementById('forgotEmail').value }) });
    toast('Reset link sent — check the console for now.', 'success');
    closeForgot();
  } catch (err) { toast(err.message, 'error'); }
}

function setUser(tok, user) {
  token = tok; currentUser = user;
  localStorage.setItem('bm_token', tok);
  document.getElementById('loginBtn').style.display  = 'none';
  document.getElementById('userPill').style.display  = 'flex';
  document.getElementById('userName').textContent    = user.name.split(' ')[0];
  document.getElementById('dashNav').style.display   = '';
  document.getElementById('mDashNav').style.display  = '';
  document.getElementById('mLoginLink').style.display = 'none';
  document.getElementById('mLogoutLink').style.display = '';
  const isAdmin = user.role === 'admin';
  document.getElementById('adminNav').style.display  = isAdmin ? '' : 'none';
  document.getElementById('mAdminNav').style.display = isAdmin ? '' : 'none';
}

function logout() {
  token = null; currentUser = null; dashData = null; adminData = null;
  localStorage.removeItem('bm_token');
  document.getElementById('loginBtn').style.display  = '';
  document.getElementById('userPill').style.display  = 'none';
  document.getElementById('dashNav').style.display   = 'none';
  document.getElementById('mDashNav').style.display  = 'none';
  document.getElementById('adminNav').style.display  = 'none';
  document.getElementById('mAdminNav').style.display = 'none';
  document.getElementById('mLoginLink').style.display = '';
  document.getElementById('mLogoutLink').style.display = 'none';
  showPage('cars');
  toast('Signed out.', '');
}

/* Restore session on load */
(async function restoreSession() {
  if (!token) return;
  try {
    const data = await apiFetch('/api/dashboard');
    setUser(token, data.user);
  } catch { token = null; localStorage.removeItem('bm_token'); }
})();

/* ── CARS ────────────────────────────────────────────────────────── */
async function loadCars() {
  if (allCars.length) return renderCars();
  try {
    allCars = await apiFetch('/api/cars');
    renderCars();
  } catch { toast('Could not load cars.', 'error'); }
}

function filterCars() {
  const q    = (document.getElementById('carSearch').value || '').toLowerCase();
  const fuel = (document.getElementById('carFuel').value || '').toLowerCase();
  const body = (document.getElementById('carBody').value || '').toLowerCase();
  const max  = parseFloat(document.getElementById('carMaxPrice').value) || Infinity;
  const filtered = allCars.filter(c =>
    (!q    || (c.make + ' ' + c.model).toLowerCase().includes(q)) &&
    (!fuel || (c.fuel_type || '').toLowerCase().includes(fuel)) &&
    (!body || (c.body || '').toLowerCase().includes(body)) &&
    c.price <= max
  );
  renderCars(filtered);
}

function clearCarFilters() {
  ['carSearch','carMaxPrice'].forEach(id => document.getElementById(id).value = '');
  ['carFuel','carBody'].forEach(id => document.getElementById(id).value = '');
  renderCars();
}

function renderCars(list) {
  const cars = list ?? allCars;
  const grid = document.getElementById('carsGrid');
  if (!cars.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="icon">🚗</div><h3>No cars found</h3><p>Try adjusting your filters.</p></div>`;
    return;
  }
  grid.innerHTML = cars.map(c => {
    const available = c.quantity > 0 && c.status !== 'sold_out';
    const badge     = available ? `<span class="badge badge-green">Available</span>` : `<span class="badge badge-red">Sold Out</span>`;
    const imgUrl    = getCarImage(c.make, c.model);
    const imgHtml   = imgUrl
      ? `<img src="${imgUrl}" alt="${esc(c.make)} ${esc(c.model)}" loading="lazy" onerror="this.parentElement.innerHTML='<span style=\\'font-size:3rem\\'>🚙</span>'" />`
      : `<span style="font-size:3rem">🚙</span>`;
    return `
    <div class="card">
      <div class="card-img">${imgHtml}</div>
      <div class="card-body">
        ${badge}
        <div class="card-title" style="margin-top:.5rem">${esc(c.make)} ${esc(c.model)}</div>
        <div class="card-meta">${c.year} &bull; ${esc(c.fuel_type || '')} &bull; ${esc(c.body || '')} &bull; ${esc(c.drive || '')} &bull; ${c.mileage ? c.mileage.toLocaleString() + ' km' : ''}</div>
        <div class="card-price">${fmtKsh(c.price)}</div>
        ${available
          ? `<button class="btn btn-primary btn-full" onclick="openPayModal('car',${c.id},'${esc(c.make+' '+c.model+' '+c.year)}',${c.price},1)">Buy Now</button>`
          : `<button class="btn btn-full" style="background:#f3f4f6;color:#9ca3af;cursor:default" disabled>Sold Out</button>`}
      </div>
    </div>`;
  }).join('');
}

/* ── PARTS ───────────────────────────────────────────────────────── */
async function loadParts() {
  if (allParts.length) return renderParts();
  try {
    allParts = await apiFetch('/api/parts');
    const cats = [...new Set(allParts.map(p => p.category).filter(Boolean))].sort();
    const sel  = document.getElementById('partCategory');
    cats.forEach(c => { const o = document.createElement('option'); o.textContent = c; sel.appendChild(o); });
    renderParts();
  } catch { toast('Could not load parts.', 'error'); }
}

function filterParts() {
  const q   = (document.getElementById('partSearch').value || '').toLowerCase();
  const cat = document.getElementById('partCategory').value;
  renderParts(allParts.filter(p =>
    (!q   || (p.name + ' ' + (p.description||'')).toLowerCase().includes(q)) &&
    (!cat || p.category === cat)
  ));
}

function renderParts(list) {
  const parts = list ?? allParts;
  const grid  = document.getElementById('partsGrid');
  if (!parts.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="icon">🔧</div><h3>No parts found</h3><p>Try a different search.</p></div>`;
    return;
  }
  grid.innerHTML = parts.map(p => {
    const inStock = (p.stock || 0) > 0;
    const imgUrl  = getPartImage(p.name, p.category);
    const imgHtml = imgUrl
      ? `<img src="${imgUrl}" alt="${esc(p.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='<span style=\\'font-size:2.5rem\\'>🔧</span>'" />`
      : `<span style="font-size:2.5rem">🔧</span>`;
    return `
    <div class="card">
      <div class="card-img" style="height:160px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:#f8f8f8">${imgHtml}</div>
      <div class="card-body">
        <span class="badge ${inStock ? 'badge-green' : 'badge-red'}">${inStock ? p.stock + ' in stock' : 'Out of stock'}</span>
        <div class="card-title" style="margin-top:.5rem">${esc(p.name)}</div>
        <div class="card-meta">${esc(p.category || '')}${p.part_number ? ' &bull; ' + esc(p.part_number) : ''}</div>
        <div class="card-price" style="font-size:1.1rem">${fmtKsh(p.price)}</div>
        ${inStock
          ? `<button class="btn btn-primary btn-full btn-sm" onclick="openQtyModal(${p.id},'${esc(p.name)}',${p.price},${p.stock})">Order Now</button>`
          : `<button class="btn btn-full btn-sm" style="background:#f3f4f6;color:#9ca3af;cursor:default" disabled>Out of Stock</button>`}
      </div>
    </div>`;
  }).join('');
}

function openQtyModal(partId, name, price, stock) {
  if (!token) { openAuth(); return; }
  const modal = document.getElementById('qtyModal');
  document.getElementById('qtyModalContent').innerHTML = `
    <h2 style="font-size:1.15rem;margin-bottom:1rem">Order: ${esc(name)}</h2>
    <label style="margin-bottom:1rem">Quantity (max ${stock})
      <input type="number" id="qtyInput" value="1" min="1" max="${stock}" style="margin-top:.35rem" />
    </label>
    <div id="qtyTotal" style="font-weight:700;font-size:1.1rem;margin-bottom:1.25rem">Total: ${fmtKsh(price)}</div>
    <button class="btn btn-primary btn-full" onclick="confirmQty(${partId},'${esc(name)}',${price},${stock})">Continue to Payment</button>
  `;
  document.getElementById('qtyInput').oninput = () => {
    const q = Math.min(parseInt(document.getElementById('qtyInput').value)||1, stock);
    document.getElementById('qtyTotal').textContent = 'Total: ' + fmtKsh(price * q);
  };
  modal.style.display = 'flex';
}

function confirmQty(partId, name, price, stock) {
  const qty = Math.min(parseInt(document.getElementById('qtyInput').value)||1, stock);
  document.getElementById('qtyModal').style.display = 'none';
  openPayModal('part', partId, name + ' ×' + qty, price * qty, qty);
}

/* ── PAYMENT MODAL ───────────────────────────────────────────────── */
function openPayModal(type, refId, desc, amount, qty) {
  if (!token) { openAuth(); return; }
  const modal   = document.getElementById('payModal');
  const content = document.getElementById('payModalContent');
  content.innerHTML = `
    <div class="pay-summary">
      <h2>Complete Purchase</h2>
      <div class="pay-row"><span>${esc(desc)}</span><span>${fmtKsh(amount)}</span></div>
      <div class="pay-row"><span>Tax (16% VAT)</span><span>${fmtKsh(amount - amount/1.16)}</span></div>
      <div class="pay-row"><span><strong>Total</strong></span><span><strong>${fmtKsh(amount)}</strong></span></div>
    </div>
    <div class="pay-methods">
      <p style="font-size:.85rem;color:#6b7280;margin-bottom:.5rem;font-weight:600">CHOOSE PAYMENT METHOD</p>
      <button class="pay-method-btn" onclick="payWithPaystack('${type}',${refId},${amount},${qty})">
        <span class="ico">💳</span> Pay with Paystack (Card / Mobile Money)
      </button>
      ${type !== 'repair' ? `
      <button class="pay-method-btn" onclick="payManual('${type}',${refId},'cash',${qty})">
        <span class="ico">💵</span> Cash Payment (Pay in person)
      </button>
      <button class="pay-method-btn" onclick="payManual('${type}',${refId},'bank_transfer',${qty})">
        <span class="ico">🏦</span> Bank Transfer
      </button>` : ''}
    </div>
  `;
  modal.classList.add('open');
}

function closePayModal() { document.getElementById('payModal').classList.remove('open'); }

async function payWithPaystack(payType, refId, amount, qty) {
  const type_map = { car: 'car_sale', part: 'part_order', repair: 'repair' };
  try {
    const data = await apiFetch('/api/payments/paystack/initialize', {
      method: 'POST',
      body: JSON.stringify({ payment_type: type_map[payType], reference_id: refId, quantity: qty }),
    });
    /* Redirect to Paystack hosted page */
    window.location.href = data.authorization_url;
  } catch (err) { toast(err.message, 'error'); }
}

async function payManual(payType, refId, method, qty) {
  const endpoint = payType === 'car' ? '/api/payments/car' : payType === 'part' ? '/api/payments/parts' : '/api/payments/repair';
  const body     = payType === 'car'   ? { car_id: refId, method }
                 : payType === 'part'  ? { part_id: refId, quantity: qty, method }
                 : { repair_report_id: refId, method };
  try {
    const data = await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
    closePayModal();
    /* Refresh inventory caches */
    allCars = []; allParts = [];
    toast('Payment recorded! Invoice #' + (data.invoice?.invoice_number || ''), 'success');
    if (currentUser) { dashData = null; }
  } catch (err) { toast(err.message, 'error'); }
}

/* Check for Paystack callback (reference in URL) */
(async function checkPaystackReturn() {
  const params = new URLSearchParams(location.search);
  const ref    = params.get('reference') || params.get('trxref');
  if (!ref || !token) return;
  history.replaceState({}, '', location.pathname);
  try {
    const data = await apiFetch('/api/payments/paystack/verify/' + ref);
    if (data.status === 'completed') {
      allCars = []; allParts = []; dashData = null;
      toast('Payment successful! Invoice #' + (data.invoice?.invoice_number || ''), 'success');
    } else {
      toast('Payment status: ' + data.status + '. Please try again or contact us.', 'error');
    }
  } catch (err) { toast('Could not verify payment: ' + err.message, 'error'); }
})();

/* ── BOOKING ─────────────────────────────────────────────────────── */
function initBookPage() {
  const dateInput = document.getElementById('bDate');
  const today     = new Date().toISOString().slice(0, 10);
  dateInput.min   = today;
}

async function loadSlots() {
  const date = document.getElementById('bDate').value;
  if (!date) return;
  const sel = document.getElementById('bSlot');
  sel.disabled = true; sel.innerHTML = '<option>Loading…</option>';
  try {
    const slots = await apiFetch('/api/appointments/slots?date=' + date);
    sel.innerHTML = '<option value="">Select a time…</option>' + slots.map(s =>
      `<option value="${s.slot}" ${s.available ? '' : 'disabled'}>${s.slot}${s.available ? '' : ' (booked)'}</option>`
    ).join('');
    sel.disabled = false;
  } catch { sel.innerHTML = '<option>Error loading slots</option>'; }
}

async function handleBooking(e) {
  e.preventDefault();
  if (!token) { openAuth(); return; }
  const btn = document.getElementById('bookSubmit');
  btn.disabled = true; btn.textContent = 'Booking…';
  try {
    const body = {
      appointment_date: document.getElementById('bDate').value,
      time_slot:        document.getElementById('bSlot').value,
      service_type:     document.getElementById('bService').value,
      car_make:         document.getElementById('bMake').value,
      car_model:        document.getElementById('bModel').value,
      car_year:         document.getElementById('bYear').value,
      car_plate:        document.getElementById('bPlate').value,
      notes:            document.getElementById('bNotes').value,
    };
    const data = await apiFetch('/api/appointments', { method: 'POST', body: JSON.stringify(body) });
    toast('Appointment booked! We\'ll see you then.', 'success');
    document.getElementById('bookingForm').reset();
    document.getElementById('bSlot').innerHTML = '<option value="">Pick a date first…</option>';
    document.getElementById('bSlot').disabled = true;
    dashData = null;
    if (data.prior_visits > 0) toast(`Welcome back! You've had ${data.prior_visits} previous visit(s) with us.`, '');
  } catch (err) { toast(err.message, 'error'); }
  btn.disabled = false; btn.textContent = 'Book Appointment';
}

/* ── DASHBOARD ───────────────────────────────────────────────────── */
async function loadDashboard() {
  if (!token) return;
  try {
    const data   = await apiFetch('/api/dashboard');
    dashData     = data;
    currentUser  = data.user;
    const s      = data.summary.stats;
    document.getElementById('dashWelcome').textContent  = 'Welcome, ' + data.user.name.split(' ')[0];
    document.getElementById('dashSubtitle').textContent = 'Here\'s your activity at Brisa Motors.';
    document.getElementById('dashStats').innerHTML = `
      <div class="stat-card"><div class="label">Total Visits</div><div class="value">${s.total_visits}</div></div>
      <div class="stat-card"><div class="label">Upcoming</div><div class="value">${s.upcoming_appts}</div><div class="sub">appointments</div></div>
      <div class="stat-card"><div class="label">Total Spent</div><div class="value">${fmtKsh(s.total_spent)}</div></div>
      <div class="stat-card"><div class="label">Invoices</div><div class="value">${s.invoices_count}</div></div>
    `;
    switchDashTab('appointments', document.querySelector('.tab.active'));
  } catch (err) { toast(err.message, 'error'); }
}

function switchDashTab(tab, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (!dashData) return;
  const el = document.getElementById('dashContent');
  const s  = dashData.summary;

  if (tab === 'appointments') {
    if (!s.appointments.length) { el.innerHTML = empty('📅','No appointments yet','Book your first service above.'); return; }
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Time</th><th>Service</th><th>Vehicle</th><th>Status</th><th>Diagnosis</th></tr></thead>
      <tbody>${s.appointments.map(a => `<tr>
        <td>${fmtDate(a.appointment_date)}</td>
        <td>${a.time_slot || '—'}</td>
        <td>${esc(a.service_type)}</td>
        <td>${a.car_make ? esc(a.car_make + ' ' + (a.car_model||'')) : '—'}</td>
        <td><span class="badge ${a.status==='scheduled'?'badge-amber':a.status==='completed'?'badge-green':'badge-gray'}">${a.status}</span></td>
        <td>${a.diagnosis ? esc(a.diagnosis.substring(0,40)) + '…' : '—'}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  if (tab === 'repairs') {
    if (!s.repairs.length) { el.innerHTML = empty('🔧','No repair history','Your repair records will appear here.'); return; }
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Plate</th><th>Diagnosis</th><th>Cost</th><th>Payment</th></tr></thead>
      <tbody>${s.repairs.map(r => `<tr>
        <td>${fmtDate(r.resolved_at)}</td>
        <td>${esc(r.car_plate || '—')}</td>
        <td>${esc((r.diagnosis||'').substring(0,50))}</td>
        <td>${fmtKsh(r.total_cost)}</td>
        <td>
          <span class="badge ${r.payment_status==='paid'?'badge-green':'badge-red'}">${r.payment_status}</span>
          ${r.payment_status !== 'paid' ? `<button class="btn btn-sm btn-primary" style="margin-left:.5rem" onclick="openPayModal('repair',${r.id},'Repair — ${esc(r.diagnosis||'').replace(/'/g,'')}',${r.total_cost},1)">Pay Now</button>` : ''}
        </td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  if (tab === 'invoices') {
    if (!s.invoices.length) { el.innerHTML = empty('🧾','No invoices yet','Invoices are generated after payment.'); return; }
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Invoice #</th><th>Date</th><th>Type</th><th>Amount</th><th>Method</th><th>Ref</th></tr></thead>
      <tbody>${s.invoices.map(inv => `<tr>
        <td><strong>${esc(inv.invoice_number || '#' + inv.id)}</strong></td>
        <td>${fmtDate(inv.issued_at)}</td>
        <td>${esc(inv.invoice_type?.replace('_',' ') || '—')}</td>
        <td>${fmtKsh(inv.total_amount)}</td>
        <td>${esc(inv.method || '—')}</td>
        <td style="font-size:.78rem;color:#6b7280">${esc(inv.paystack_ref || '—')}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  if (tab === 'profile') {
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;max-width:780px">
        <div class="profile-card">
          <h3>Personal Details</h3>
          <form onsubmit="saveProfile(event)">
            <label>Full Name <input id="pName" value="${esc(currentUser.name)}" required /></label>
            <label>Phone <input id="pPhone" value="${esc(currentUser.phone||'')}" /></label>
            <label>Email <input value="${esc(currentUser.email)}" disabled style="background:#f9fafb;color:#6b7280" /></label>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </form>
        </div>
        <div class="profile-card">
          <h3>Change Password</h3>
          <form onsubmit="changePassword(event)">
            <label>Current Password <input type="password" id="cpCurrent" required /></label>
            <label>New Password <input type="password" id="cpNew" required minlength="6" /></label>
            <button type="submit" class="btn btn-primary">Update Password</button>
          </form>
        </div>
      </div>`;
  }
}

function empty(icon, title, sub) {
  return `<div class="empty"><div class="icon">${icon}</div><h3>${title}</h3><p>${sub}</p></div>`;
}

async function saveProfile(e) {
  e.preventDefault();
  try {
    await apiFetch('/api/dashboard/profile', { method: 'PUT', body: JSON.stringify({ name: document.getElementById('pName').value, phone: document.getElementById('pPhone').value }) });
    toast('Profile saved!', 'success');
    dashData = null;
    loadDashboard();
  } catch (err) { toast(err.message, 'error'); }
}

async function changePassword(e) {
  e.preventDefault();
  try {
    await apiFetch('/api/dashboard/change-password', { method: 'PUT', body: JSON.stringify({ current_password: document.getElementById('cpCurrent').value, new_password: document.getElementById('cpNew').value }) });
    toast('Password updated!', 'success');
    document.getElementById('cpCurrent').value = '';
    document.getElementById('cpNew').value = '';
  } catch (err) { toast(err.message, 'error'); }
}

/* ── ADMIN ───────────────────────────────────────────────────────── */
async function loadAdmin() {
  if (!token) return;
  try {
    const [summary, clients, cars, parts] = await Promise.all([
      apiFetch('/api/admin/reports/summary'),
      apiFetch('/api/admin/clients'),
      apiFetch('/api/cars'),
      apiFetch('/api/parts'),
    ]);
    adminData = { summary, clients, cars, parts };
    document.getElementById('adminStats').innerHTML = `
      <div class="stat-card"><div class="label">Clients</div><div class="value">${summary.clients_count}</div></div>
      <div class="stat-card"><div class="label">Cars Listed</div><div class="value">${summary.cars_count}</div><div class="sub">${summary.cars_sold} sold</div></div>
      <div class="stat-card"><div class="label">Appointments</div><div class="value">${summary.appointments_count}</div></div>
      <div class="stat-card"><div class="label">Revenue</div><div class="value">${fmtKsh(summary.revenue)}</div></div>
      <div class="stat-card"><div class="label">Invoices</div><div class="value">${summary.invoices_count}</div></div>
      <div class="stat-card"><div class="label">Unpaid Repairs</div><div class="value">${summary.unpaid_repairs}</div><div class="sub">${summary.paid_repairs} paid</div></div>
    `;
    const tabs = [...document.querySelectorAll('#adminTabs .tab')];
    const activeBtn = tabs.find(t => t.classList.contains('active')) || tabs[0];
    const tabNames = ['overview', 'clients', 'repairs', 'invoices', 'inventory'];
    const tabName = tabNames[tabs.indexOf(activeBtn)] || 'overview';
    switchAdminTab(tabName, activeBtn);
  } catch (err) { toast(err.message, 'error'); }
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll('#adminTabs .tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (!adminData) return;
  const el = document.getElementById('adminContent');
  const s  = adminData.summary;

  if (tab === 'overview') {
    if (!s.monthly_revenue.length) { el.innerHTML = empty('📊', 'No revenue yet', 'Monthly revenue will show up here once payments come in.'); return; }
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Month</th><th>Revenue</th></tr></thead>
      <tbody>${s.monthly_revenue.map(m => `<tr><td>${esc(m.month)}</td><td>${fmtKsh(m.revenue)}</td></tr>`).join('')}</tbody>
    </table></div>`;
  }

  if (tab === 'clients') {
    const clients = adminData.clients.filter(c => c.role === 'client');
    if (!clients.length) { el.innerHTML = empty('👤', 'No clients yet', 'Registered clients will appear here.'); return; }
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th><th></th></tr></thead>
      <tbody>${clients.map(c => `<tr>
        <td>${esc(c.name)}</td>
        <td>${esc(c.email)}</td>
        <td>${esc(c.phone || '—')}</td>
        <td>${fmtDate(c.created_at)}</td>
        <td><button class="btn btn-sm btn-outline dark" onclick="viewClient(${c.id})">View</button></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  if (tab === 'repairs') {
    if (!s.recent_repairs.length) { el.innerHTML = empty('🔧', 'No repairs yet', 'Recent repair records will appear here.'); return; }
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Client</th><th>Plate</th><th>Diagnosis</th><th>Cost</th><th>Payment</th></tr></thead>
      <tbody>${s.recent_repairs.map(r => `<tr>
        <td>${fmtDate(r.resolved_at)}</td>
        <td>${esc(r.client_name || '—')}<br><span style="font-size:.78rem;color:#6b7280">${esc(r.client_email || '')}</span></td>
        <td>${esc(r.car_plate || '—')}</td>
        <td>${esc((r.diagnosis || '').substring(0, 50))}</td>
        <td>${fmtKsh(r.total_cost)}</td>
        <td><span class="badge ${r.payment_status === 'paid' ? 'badge-green' : 'badge-red'}">${r.payment_status}</span></td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  if (tab === 'invoices') {
    if (!s.recent_invoices.length) { el.innerHTML = empty('🧾', 'No invoices yet', 'Recent invoices will appear here.'); return; }
    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Invoice #</th><th>Date</th><th>Type</th><th>Amount</th><th>Method</th><th>Ref</th></tr></thead>
      <tbody>${s.recent_invoices.map(inv => `<tr>
        <td><strong>${esc(inv.invoice_number || '#' + inv.id)}</strong></td>
        <td>${fmtDate(inv.issued_at)}</td>
        <td>${esc((inv.invoice_type || '').replace('_', ' ') || '—')}</td>
        <td>${fmtKsh(inv.total_amount)}</td>
        <td>${esc(inv.method || '—')}</td>
        <td style="font-size:.78rem;color:#6b7280">${esc(inv.paystack_ref || '—')}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  }

  if (tab === 'inventory') {
    const cars  = adminData.cars  || [];
    const parts = adminData.parts || [];
    el.innerHTML = `
      <div class="dash-header" style="margin-top:1rem">
        <h3 style="margin:0">Cars (${cars.length})</h3>
        <button class="btn btn-sm btn-primary" onclick="openStockModal('car')">+ Add Car</button>
      </div>
      ${!cars.length ? empty('🚗', 'No cars listed', 'Add your first car above.') : `<div class="table-wrap"><table>
        <thead><tr><th>Car</th><th>Year</th><th>Price</th><th>Qty</th><th>Status</th><th></th></tr></thead>
        <tbody>${cars.map(c => `<tr>
          <td>${esc(c.make)} ${esc(c.model)}</td>
          <td>${c.year || '—'}</td>
          <td><input type="number" id="carPrice${c.id}" value="${c.price}" style="width:100px" /></td>
          <td><input type="number" id="carQty${c.id}" value="${c.quantity}" style="width:70px" /></td>
          <td><span class="badge ${c.quantity > 0 && c.status !== 'sold_out' ? 'badge-green' : 'badge-red'}">${esc(c.status)}</span></td>
          <td style="white-space:nowrap">
            <button class="btn btn-sm btn-outline dark" onclick="quickUpdateCar(${c.id})">Save</button>
            <button class="btn btn-sm btn-outline dark" onclick="openStockModal('car', ${c.id})">Edit</button>
            <button class="btn btn-sm btn-outline dark" style="color:#dc2626;border-color:#dc2626" onclick="deleteStockItem('car', ${c.id})">Delete</button>
          </td>
        </tr>`).join('')}</tbody>
      </table></div>`}

      <div class="dash-header" style="margin-top:2rem">
        <h3 style="margin:0">Parts (${parts.length})</h3>
        <button class="btn btn-sm btn-primary" onclick="openStockModal('part')">+ Add Part</button>
      </div>
      ${!parts.length ? empty('🔩', 'No parts listed', 'Add your first part above.') : `<div class="table-wrap"><table>
        <thead><tr><th>Part</th><th>Category</th><th>Price</th><th>Stock</th><th></th></tr></thead>
        <tbody>${parts.map(p => `<tr>
          <td>${esc(p.name)}${p.part_number ? `<br><span style="font-size:.75rem;color:#6b7280">${esc(p.part_number)}</span>` : ''}</td>
          <td>${esc(p.category || '—')}</td>
          <td><input type="number" id="partPrice${p.id}" value="${p.price}" style="width:100px" /></td>
          <td>
            <input type="number" id="partStock${p.id}" value="${p.stock}" style="width:70px" />
            ${p.stock <= 5 ? `<span class="badge badge-amber" style="margin-left:.4rem">Low</span>` : ''}
          </td>
          <td style="white-space:nowrap">
            <button class="btn btn-sm btn-outline dark" onclick="quickUpdatePart(${p.id})">Save</button>
            <button class="btn btn-sm btn-outline dark" onclick="openStockModal('part', ${p.id})">Edit</button>
            <button class="btn btn-sm btn-outline dark" style="color:#dc2626;border-color:#dc2626" onclick="deleteStockItem('part', ${p.id})">Delete</button>
          </td>
        </tr>`).join('')}</tbody>
      </table></div>`}
    `;
  }
}

async function viewClient(id) {
  const modal = document.getElementById('clientModal');
  const content = document.getElementById('clientModalContent');
  content.innerHTML = 'Loading…';
  modal.classList.add('open');
  try {
    const { client, summary } = await apiFetch('/api/admin/clients/' + id);
    lastClientReport = { client, summary };
    const s = summary.stats;
    content.innerHTML = `
      <div class="dash-header" style="margin-bottom:0">
        <h2 style="margin-bottom:0">${esc(client.name)}</h2>
        <button class="btn btn-sm btn-outline dark" onclick="printClientReport()">🖨️ Print Report</button>
      </div>
      <p style="color:#6b7280;margin-top:0">${esc(client.email)} ${client.phone ? '&bull; ' + esc(client.phone) : ''} &bull; Joined ${fmtDate(client.created_at)}</p>
      <div class="stats-row" style="margin:1rem 0">
        <div class="stat-card"><div class="label">Total Visits</div><div class="value">${s.total_visits}</div></div>
        <div class="stat-card"><div class="label">Total Spent</div><div class="value">${fmtKsh(s.total_spent)}</div></div>
        <div class="stat-card"><div class="label">Repairs Done</div><div class="value">${s.repairs_done}</div></div>
        <div class="stat-card"><div class="label">Invoices</div><div class="value">${s.invoices_count}</div></div>
      </div>
      <h3>Appointments</h3>
      ${!summary.appointments.length ? `<p style="color:#6b7280">No appointments.</p>` : `<div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Service</th><th>Vehicle</th><th>Status</th></tr></thead>
        <tbody>${summary.appointments.map(a => `<tr>
          <td>${fmtDate(a.appointment_date)}</td>
          <td>${esc(a.service_type)}</td>
          <td>${a.car_make ? esc(a.car_make + ' ' + (a.car_model || '')) : '—'}</td>
          <td><span class="badge ${a.status === 'scheduled' ? 'badge-amber' : a.status === 'completed' ? 'badge-green' : 'badge-gray'}">${a.status}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>`}
      <h3 style="margin-top:1.5rem">Repairs</h3>
      ${!summary.repairs.length ? `<p style="color:#6b7280">No repairs.</p>` : `<div class="table-wrap"><table>
        <thead><tr><th>Date</th><th>Plate</th><th>Diagnosis</th><th>Cost</th><th>Payment</th></tr></thead>
        <tbody>${summary.repairs.map(r => `<tr>
          <td>${fmtDate(r.resolved_at)}</td>
          <td>${esc(r.car_plate || '—')}</td>
          <td>${esc((r.diagnosis || '').substring(0, 50))}</td>
          <td>${fmtKsh(r.total_cost)}</td>
          <td><span class="badge ${r.payment_status === 'paid' ? 'badge-green' : 'badge-red'}">${r.payment_status}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>`}
      <h3 style="margin-top:1.5rem">Invoices</h3>
      ${!summary.invoices.length ? `<p style="color:#6b7280">No invoices.</p>` : `<div class="table-wrap"><table>
        <thead><tr><th>Invoice #</th><th>Date</th><th>Amount</th><th>Method</th></tr></thead>
        <tbody>${summary.invoices.map(inv => `<tr>
          <td><strong>${esc(inv.invoice_number || '#' + inv.id)}</strong></td>
          <td>${fmtDate(inv.issued_at)}</td>
          <td>${fmtKsh(inv.total_amount)}</td>
          <td>${esc(inv.method || '—')}</td>
        </tr>`).join('')}</tbody>
      </table></div>`}
    `;
  } catch (err) {
    content.innerHTML = `<p style="color:#dc2626">${esc(err.message)}</p>`;
  }
}

function closeClientModal() { document.getElementById('clientModal').classList.remove('open'); }

/* ── INVENTORY ───────────────────────────────────────────────────── */
async function quickUpdateCar(id) {
  try {
    const price    = Number(document.getElementById('carPrice' + id).value);
    const quantity = Number(document.getElementById('carQty' + id).value);
    await apiFetch('/api/admin/cars/' + id, { method: 'PUT', body: JSON.stringify({ price, quantity }) });
    toast('Car updated.', 'success');
    allCars = []; // force cars page to refetch fresh data next time it's viewed
    loadAdmin();
  } catch (err) { toast(err.message, 'error'); }
}

async function quickUpdatePart(id) {
  try {
    const price = Number(document.getElementById('partPrice' + id).value);
    const stock = Number(document.getElementById('partStock' + id).value);
    await apiFetch('/api/admin/parts/' + id, { method: 'PUT', body: JSON.stringify({ price, stock }) });
    toast('Part updated.', 'success');
    allParts = [];
    loadAdmin();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteStockItem(type, id) {
  if (!confirm(`Delete this ${type}? This can't be undone.`)) return;
  try {
    await apiFetch(`/api/admin/${type}s/${id}`, { method: 'DELETE' });
    toast(`${type === 'car' ? 'Car' : 'Part'} deleted.`, 'success');
    if (type === 'car') allCars = []; else allParts = [];
    loadAdmin();
  } catch (err) { toast(err.message, 'error'); }
}

function openStockModal(type, id) {
  const modal = document.getElementById('stockModal');
  const content = document.getElementById('stockModalContent');
  const isEdit = id != null;
  const item = isEdit ? (type === 'car' ? adminData.cars : adminData.parts).find(x => x.id === id) : {};

  if (type === 'car') {
    content.innerHTML = `
      <h2>${isEdit ? 'Edit Car' : 'Add New Car'}</h2>
      <form onsubmit="submitStockForm(event,'car',${isEdit ? id : 'null'})">
        <div class="form-grid">
          <label>Make * <input id="sMake" required value="${esc(item.make || '')}" /></label>
          <label>Model * <input id="sModel" required value="${esc(item.model || '')}" /></label>
          <label>Year <input type="number" id="sYear" value="${item.year || ''}" /></label>
          <label>Price (Ksh) * <input type="number" id="sPrice" required value="${item.price || ''}" /></label>
          <label>Quantity <input type="number" id="sQuantity" value="${item.quantity ?? 1}" /></label>
          <label>Mileage (km) <input type="number" id="sMileage" value="${item.mileage || ''}" /></label>
          <label>Fuel Type
            <select id="sFuel">
              <option value="">—</option>
              ${['Petrol','Diesel','Hybrid','Electric'].map(f => `<option ${item.fuel_type===f?'selected':''}>${f}</option>`).join('')}
            </select>
          </label>
          <label>Body Type
            <select id="sBody">
              <option value="">—</option>
              ${['Sedan','SUV','Hatchback','Pickup','Van','Coupe'].map(b => `<option ${item.body===b?'selected':''}>${b}</option>`).join('')}
            </select>
          </label>
          <label>Drive <input id="sDrive" value="${esc(item.drive || '')}" /></label>
          <label>Color <input id="sColor" value="${esc(item.color || '')}" /></label>
          <label class="full-width">Description <textarea id="sDescription" rows="2">${esc(item.description || '')}</textarea></label>
        </div>
        <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Save Changes' : 'Add Car'}</button>
      </form>`;
  } else {
    content.innerHTML = `
      <h2>${isEdit ? 'Edit Part' : 'Add New Part'}</h2>
      <form onsubmit="submitStockForm(event,'part',${isEdit ? id : 'null'})">
        <div class="form-grid">
          <label>Name * <input id="sName" required value="${esc(item.name || '')}" /></label>
          <label>Part Number <input id="sPartNumber" value="${esc(item.part_number || '')}" /></label>
          <label>Category <input id="sCategory" value="${esc(item.category || '')}" /></label>
          <label>Price (Ksh) * <input type="number" id="sPrice" required value="${item.price || ''}" /></label>
          <label>Stock <input type="number" id="sStock" value="${item.stock ?? 0}" /></label>
          <label>Compatible Makes <input id="sCompatible" value="${esc(item.compatible_makes || '')}" /></label>
          <label class="full-width">Description <textarea id="sDescription" rows="2">${esc(item.description || '')}</textarea></label>
        </div>
        <button type="submit" class="btn btn-primary btn-full">${isEdit ? 'Save Changes' : 'Add Part'}</button>
      </form>`;
  }
  modal.classList.add('open');
}

function closeStockModal() { document.getElementById('stockModal').classList.remove('open'); }

async function submitStockForm(e, type, id) {
  e.preventDefault();
  const isEdit = id != null;
  let body;
  if (type === 'car') {
    body = {
      make: document.getElementById('sMake').value,
      model: document.getElementById('sModel').value,
      year: document.getElementById('sYear').value,
      price: document.getElementById('sPrice').value,
      quantity: document.getElementById('sQuantity').value,
      mileage: document.getElementById('sMileage').value,
      fuel_type: document.getElementById('sFuel').value,
      body: document.getElementById('sBody').value,
      drive: document.getElementById('sDrive').value,
      color: document.getElementById('sColor').value,
      description: document.getElementById('sDescription').value,
    };
  } else {
    body = {
      name: document.getElementById('sName').value,
      part_number: document.getElementById('sPartNumber').value,
      category: document.getElementById('sCategory').value,
      price: document.getElementById('sPrice').value,
      stock: document.getElementById('sStock').value,
      compatible_makes: document.getElementById('sCompatible').value,
      description: document.getElementById('sDescription').value,
    };
  }
  try {
    const path = `/api/admin/${type}s` + (isEdit ? '/' + id : '');
    await apiFetch(path, { method: isEdit ? 'PUT' : 'POST', body: JSON.stringify(body) });
    toast(`${type === 'car' ? 'Car' : 'Part'} ${isEdit ? 'updated' : 'added'}!`, 'success');
    closeStockModal();
    if (type === 'car') allCars = []; else allParts = [];
    loadAdmin();
  } catch (err) { toast(err.message, 'error'); }
}

/* ── PRINT REPORTS ───────────────────────────────────────────────── */
function printReport(title, bodyHtml) {
  const win = window.open('', '_blank');
  if (!win) { toast('Please allow pop-ups to print reports.', 'error'); return; }
  win.document.write(`<!DOCTYPE html><html><head><title>${esc(title)}</title><meta charset="UTF-8" />
    <style>
      * { box-sizing: border-box; }
      body { font-family: Inter, Arial, sans-serif; color: #111; padding: 2rem; max-width: 900px; margin: 0 auto; }
      h1 { font-size: 1.5rem; margin: 0 0 .15rem; }
      h2 { font-size: 1rem; margin-top: 1.75rem; border-bottom: 2px solid #111; padding-bottom: .3rem; }
      table { width: 100%; border-collapse: collapse; margin-top: .5rem; font-size: .85rem; }
      th, td { text-align: left; padding: .45rem .6rem; border-bottom: 1px solid #e5e7eb; }
      th { background: #f9fafb; }
      .meta { color: #666; margin-bottom: 1rem; font-size: .9rem; }
      .stats { display: flex; gap: 1rem; flex-wrap: wrap; margin: 1rem 0; }
      .stat { border: 1px solid #e5e7eb; border-radius: 8px; padding: .6rem 1rem; min-width: 130px; }
      .stat .label { font-size: .72rem; color: #666; text-transform: uppercase; letter-spacing: .03em; }
      .stat .value { font-size: 1.25rem; font-weight: 700; }
      @media print { body { padding: 0; } }
    </style>
  </head><body>${bodyHtml}</body></html>`);
  win.document.close();
  win.onload = () => win.print();
  setTimeout(() => { try { win.print(); } catch {} }, 300);
}

function printClientReport() {
  if (!lastClientReport) return;
  const { client, summary } = lastClientReport;
  const s = summary.stats;
  const today = new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  const body = `
    <h1>🚗 Brisa Motors</h1>
    <p class="meta">Customer Report — generated ${today}</p>
    <h2>${esc(client.name)}</h2>
    <p class="meta">${esc(client.email)} ${client.phone ? '&bull; ' + esc(client.phone) : ''} &bull; Client since ${fmtDate(client.created_at)}</p>
    <div class="stats">
      <div class="stat"><div class="label">Total Visits</div><div class="value">${s.total_visits}</div></div>
      <div class="stat"><div class="label">Total Spent</div><div class="value">${fmtKsh(s.total_spent)}</div></div>
      <div class="stat"><div class="label">Repairs Done</div><div class="value">${s.repairs_done}</div></div>
      <div class="stat"><div class="label">Invoices</div><div class="value">${s.invoices_count}</div></div>
    </div>
    <h2>Appointments</h2>
    ${!summary.appointments.length ? '<p>No appointments.</p>' : `<table>
      <thead><tr><th>Date</th><th>Service</th><th>Vehicle</th><th>Status</th></tr></thead>
      <tbody>${summary.appointments.map(a => `<tr><td>${fmtDate(a.appointment_date)}</td><td>${esc(a.service_type)}</td><td>${a.car_make ? esc(a.car_make + ' ' + (a.car_model||'')) : '—'}</td><td>${esc(a.status)}</td></tr>`).join('')}</tbody>
    </table>`}
    <h2>Repairs</h2>
    ${!summary.repairs.length ? '<p>No repairs.</p>' : `<table>
      <thead><tr><th>Date</th><th>Plate</th><th>Diagnosis</th><th>Cost</th><th>Payment</th></tr></thead>
      <tbody>${summary.repairs.map(r => `<tr><td>${fmtDate(r.resolved_at)}</td><td>${esc(r.car_plate||'—')}</td><td>${esc(r.diagnosis||'—')}</td><td>${fmtKsh(r.total_cost)}</td><td>${esc(r.payment_status)}</td></tr>`).join('')}</tbody>
    </table>`}
    <h2>Invoices</h2>
    ${!summary.invoices.length ? '<p>No invoices.</p>' : `<table>
      <thead><tr><th>Invoice #</th><th>Date</th><th>Amount</th><th>Method</th></tr></thead>
      <tbody>${summary.invoices.map(inv => `<tr><td>${esc(inv.invoice_number || '#'+inv.id)}</td><td>${fmtDate(inv.issued_at)}</td><td>${fmtKsh(inv.total_amount)}</td><td>${esc(inv.method||'—')}</td></tr>`).join('')}</tbody>
    </table>`}
  `;
  printReport(`Customer Report — ${client.name}`, body);
}

function printCompanyReport() {
  if (!adminData) return;
  const s = adminData.summary;
  const today = new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  const body = `
    <h1>🚗 Brisa Motors</h1>
    <p class="meta">Company Report — generated ${today}</p>
    <div class="stats">
      <div class="stat"><div class="label">Clients</div><div class="value">${s.clients_count}</div></div>
      <div class="stat"><div class="label">Cars Listed</div><div class="value">${s.cars_count}</div></div>
      <div class="stat"><div class="label">Cars Sold</div><div class="value">${s.cars_sold}</div></div>
      <div class="stat"><div class="label">Appointments</div><div class="value">${s.appointments_count}</div></div>
      <div class="stat"><div class="label">Revenue</div><div class="value">${fmtKsh(s.revenue)}</div></div>
      <div class="stat"><div class="label">Invoices</div><div class="value">${s.invoices_count}</div></div>
      <div class="stat"><div class="label">Unpaid Repairs</div><div class="value">${s.unpaid_repairs}</div></div>
      <div class="stat"><div class="label">Paid Repairs</div><div class="value">${s.paid_repairs}</div></div>
    </div>
    <h2>Monthly Revenue</h2>
    ${!s.monthly_revenue.length ? '<p>No revenue yet.</p>' : `<table>
      <thead><tr><th>Month</th><th>Revenue</th></tr></thead>
      <tbody>${s.monthly_revenue.map(m => `<tr><td>${esc(m.month)}</td><td>${fmtKsh(m.revenue)}</td></tr>`).join('')}</tbody>
    </table>`}
    <h2>Recent Repairs</h2>
    ${!s.recent_repairs.length ? '<p>No repairs yet.</p>' : `<table>
      <thead><tr><th>Date</th><th>Client</th><th>Plate</th><th>Cost</th><th>Payment</th></tr></thead>
      <tbody>${s.recent_repairs.map(r => `<tr><td>${fmtDate(r.resolved_at)}</td><td>${esc(r.client_name||'—')}</td><td>${esc(r.car_plate||'—')}</td><td>${fmtKsh(r.total_cost)}</td><td>${esc(r.payment_status)}</td></tr>`).join('')}</tbody>
    </table>`}
    <h2>Recent Invoices</h2>
    ${!s.recent_invoices.length ? '<p>No invoices yet.</p>' : `<table>
      <thead><tr><th>Invoice #</th><th>Date</th><th>Amount</th><th>Method</th></tr></thead>
      <tbody>${s.recent_invoices.map(inv => `<tr><td>${esc(inv.invoice_number || '#'+inv.id)}</td><td>${fmtDate(inv.issued_at)}</td><td>${fmtKsh(inv.total_amount)}</td><td>${esc(inv.method||'—')}</td></tr>`).join('')}</tbody>
    </table>`}
    <h2>Inventory Snapshot</h2>
    <table>
      <thead><tr><th>Cars in stock</th><th>Parts in stock</th><th>Low-stock parts (≤5)</th></tr></thead>
      <tbody><tr>
        <td>${(adminData.cars||[]).reduce((sum,c)=>sum+(c.quantity||0),0)}</td>
        <td>${(adminData.parts||[]).reduce((sum,p)=>sum+(p.stock||0),0)}</td>
        <td>${(adminData.parts||[]).filter(p=>p.stock<=5).length}</td>
      </tr></tbody>
    </table>
  `;
  printReport('Company Report', body);
}

/* ── Init ────────────────────────────────────────────────────────── */
showPage('cars');
