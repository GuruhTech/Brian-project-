'use strict';

const dotenv  = require('dotenv');
const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const https   = require('https');
const path    = require('path');
const fs      = require('fs');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const PORT               = parseInt(process.env.PORT || '5000', 10);
const JWT_SECRET         = process.env.JWT_SECRET || 'brisa_motors_secret_v3';
const SUPABASE_URL       = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const MPESA_ENV          = process.env.MPESA_ENV || 'sandbox';
const MPESA_SHORTCODE    = process.env.MPESA_SHORTCODE || '174379';
const MPESA_PASSKEY      = process.env.MPESA_PASSKEY || '';
const MPESA_CONSUMER_KEY    = process.env.MPESA_CONSUMER_KEY || '';
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || '';
const MPESA_CALLBACK_URL    = process.env.MPESA_CALLBACK_URL || null;
const MPESA_BASE         = MPESA_ENV === 'live' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
const MPESA_OAUTH_PATH   = '/oauth/v1/generate?grant_type=client_credentials';
const MPESA_STK_PUSH_PATH = '/mpesa/stkpush/v1/processrequest';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables.');
}
if (!MPESA_PASSKEY || !MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
  console.warn('⚠️  M-Pesa config is incomplete. Set MPESA_PASSKEY, MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET.');
}

/* ── Supabase client (lazy) ──────────────────────────────────────── */
let _supabase = null;
function getSupabase() {
  if (!_supabase) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are not set.');
    _supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  }
  return _supabase;
}
/* Proxy so existing code can call `supabase.from(...)` unchanged */
const supabase = new Proxy({}, {
  get(_, prop) { return (...args) => getSupabase()[prop](...args); },
});

/* Helper: throw on Supabase error */
function sb(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

/* ── M-Pesa helpers ─────────────────────────────────────────────── */
let mpesaTokenCache = { token: null, expiresAt: 0 };

function darajaRequest(method, reqPath, body = null, authHeader = null) {
  return new Promise((resolve, reject) => {
    const baseUrl = new URL(MPESA_BASE);
    const data    = body ? JSON.stringify(body) : null;
    const options = {
      hostname: baseUrl.hostname,
      path: reqPath,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, res => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try { resolve(raw ? JSON.parse(raw) : {}); }
        catch (e) { reject(new Error(`Daraja parse error: ${e.message} | ${raw}`)); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function getMpesaAccessToken() {
  if (mpesaTokenCache.token && Date.now() < mpesaTokenCache.expiresAt - 60000) return mpesaTokenCache.token;
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) throw new Error('M-Pesa credentials not configured.');
  const auth   = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const result = await darajaRequest('GET', MPESA_OAUTH_PATH, null, `Basic ${auth}`);
  if (!result.access_token) throw new Error(`M-Pesa auth failed: ${JSON.stringify(result)}`);
  mpesaTokenCache.token     = result.access_token;
  mpesaTokenCache.expiresAt = Date.now() + ((result.expires_in || 3600) * 1000);
  return result.access_token;
}

function formatMpesaPhone(phone) {
  let raw = String(phone || '').trim().replace(/[\s\-\(\)]/g, '');
  if (raw.startsWith('+')) raw = raw.slice(1);
  if (raw.startsWith('0')) raw = '254' + raw.slice(1);
  if (!raw.startsWith('254')) raw = '254' + raw;
  return raw;
}

/* ── Express app ────────────────────────────────────────────────── */
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

/* ── Helpers ────────────────────────────────────────────────────── */
const fmtKsh = n => 'Ksh ' + Number(n).toLocaleString('en-KE', { minimumFractionDigits: 0 });

function makeToken(u) {
  return jwt.sign({ id: u.id, email: u.email, role: u.role, name: u.name }, JWT_SECRET, { expiresIn: '7d' });
}

function nowISO() { return new Date().toISOString(); }

async function getUserSummary(clientId) {
  const [apptRes, repairRes, payRes, invRes] = await Promise.all([
    supabase.from('appointments').select('*').eq('client_id', clientId),
    supabase.from('repairs').select('*').eq('client_id', clientId),
    supabase.from('payments').select('*').eq('client_id', clientId),
    supabase.from('invoices').select('*').eq('client_id', clientId),
  ]);
  const appointments = (apptRes.data || []).sort((a, b) => (b.appointment_date || '').localeCompare(a.appointment_date || ''));
  const repairs      = (repairRes.data || []).sort((a, b) => (b.resolved_at || '').localeCompare(a.resolved_at || ''));
  const payments     = (payRes.data || []).sort((a, b) => (b.paid_at || '').localeCompare(a.paid_at || ''));
  const invoices     = (invRes.data || []).sort((a, b) => (b.issued_at || '').localeCompare(a.issued_at || ''));

  const enrichedAppts = appointments.map(a => {
    const r = repairs.find(r => r.appointment_id === a.id);
    return { ...a, report_id: r?.id || null, diagnosis: r?.diagnosis || null, total_cost: r?.total_cost || null, payment_status: r?.payment_status || null };
  });

  const today      = new Date().toISOString().slice(0, 10);
  const upcoming   = enrichedAppts.filter(a => a.status === 'scheduled' && a.appointment_date >= today);
  const totalSpent = payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  return {
    stats: {
      total_visits:    appointments.length,
      upcoming_appts:  upcoming.length,
      total_spent:     totalSpent,
      total_spent_fmt: fmtKsh(totalSpent),
      cars_bought:     payments.filter(p => p.payment_type === 'car_sale').length,
      parts_bought:    payments.filter(p => p.payment_type === 'part_order').length,
      repairs_done:    repairs.length,
      invoices_count:  invoices.length,
    },
    appointments: enrichedAppts, repairs, payments, invoices, upcoming,
  };
}

async function createInvoice(clientId, paymentId, type, refId, lineItems, amount) {
  const sub    = amount / 1.16;
  const tax    = amount - sub;
  const clientRes = await supabase.from('clients').select('name,email,phone').eq('id', clientId).single();
  const client = clientRes.data || {};
  const month  = new Date().toISOString().slice(0, 7).replace('-', '');
  const invRes = await supabase.from('invoices').insert({
    client_id: clientId, payment_id: paymentId, invoice_type: type, reference_id: refId,
    line_items: lineItems, subtotal: sub.toFixed(2), tax_rate: 16, tax_amount: tax.toFixed(2),
    total_amount: amount.toFixed(2), status: 'paid', issued_at: nowISO(),
  }).select().single();
  if (invRes.error) throw new Error(invRes.error.message);
  const inv    = invRes.data;
  const invNum = `INV-${month}-${String(inv.id).padStart(6, '0')}`;
  await supabase.from('invoices').update({ invoice_number: invNum }).eq('id', inv.id);
  return {
    id: inv.id, invoice_number: invNum,
    client: { name: client.name, email: client.email, phone: client.phone },
    line_items: lineItems, subtotal: sub.toFixed(2), tax_amount: tax.toFixed(2),
    total_amount: amount.toFixed(2), issued_at: inv.issued_at,
  };
}

async function formatInvoice(invoice) {
  const [payRes, clientRes] = await Promise.all([
    supabase.from('payments').select('method,status,mpesa_code').eq('id', invoice.payment_id).single(),
    supabase.from('clients').select('name,email,phone').eq('id', invoice.client_id).single(),
  ]);
  const payment = payRes.data || {};
  const client  = clientRes.data || {};
  return {
    id: invoice.id, invoice_number: invoice.invoice_number, invoice_type: invoice.invoice_type,
    reference_id: invoice.reference_id, line_items: invoice.line_items, subtotal: invoice.subtotal,
    tax_rate: invoice.tax_rate, tax_amount: invoice.tax_amount, total_amount: invoice.total_amount,
    status: invoice.status, issued_at: invoice.issued_at,
    method: payment.method || null, payment_status: payment.status || null,
    mpesa_code: payment.mpesa_code || null,
    client_name: client.name || null, client_email: client.email || null, client_phone: client.phone || null,
  };
}

/* ── Middleware ─────────────────────────────────────────────────── */
const auth = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Please sign in to continue.' });
  try { req.user = jwt.verify(h.split(' ')[1], JWT_SECRET); next(); }
  catch (e) { res.status(401).json({ error: e.name === 'TokenExpiredError' ? 'Session expired. Please sign in again.' : 'Invalid session.' }); }
};
const adminOnly = (req, res, next) => req.user?.role === 'admin' ? next() : res.status(403).json({ error: 'Admin only.' });
const go = fn => async (req, res, next) => {
  try { await fn(req, res, next); }
  catch (e) { console.error(`[${req.method} ${req.path}]`, e.message); if (!res.headersSent) res.status(500).json({ error: e.message || 'Server error.' }); }
};

/* ── Routes ─────────────────────────────────────────────────────── */

app.get('/api/status', go(async (req, res) => {
  const { count } = await supabase.from('clients').select('*', { count: 'exact', head: true });
  res.json({ server: 'online', db: 'supabase', version: '3.0.0', clients: count || 0 });
}));

/* Auth */
app.post('/api/auth/check-email', go(async (req, res) => {
  const email = (req.body?.email || '').toLowerCase().trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  const { data } = await supabase.from('clients').select('name').eq('email', email).single();
  if (data) return res.json({ exists: true, name: data.name, message: `Welcome back, ${data.name.split(' ')[0]}!` });
  res.json({ exists: false, message: 'No account found. Create one to get started.' });
}));

app.post('/api/auth/register', go(async (req, res) => {
  const { name, email: rawEmail, password, phone } = req.body || {};
  const email = (rawEmail || '').toLowerCase().trim();
  if (!name?.trim())  return res.status(400).json({ error: 'Full name is required.' });
  if (!email)         return res.status(400).json({ error: 'Email is required.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Invalid email address.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const existing = await supabase.from('clients').select('id').eq('email', email).single();
  if (existing.data) return res.status(409).json({ error: 'An account with that email already exists.', exists: true });
  const hash   = await bcrypt.hash(password, 10);
  const result = await supabase.from('clients').insert({ name: name.trim(), email, password: hash, phone: phone || null, role: 'client', created_at: nowISO() }).select().single();
  if (result.error) throw new Error(result.error.message);
  const client  = result.data;
  const summary = await getUserSummary(client.id);
  res.status(201).json({ token: makeToken(client), user: { id: client.id, name: client.name, email, phone: client.phone, role: 'client', created_at: client.created_at }, summary });
}));

app.post('/api/auth/login', go(async (req, res) => {
  const email = (req.body?.email || '').toLowerCase().trim();
  const pass  = req.body?.password || '';
  if (!email || !pass) return res.status(400).json({ error: 'Email and password are required.' });
  const { data: client } = await supabase.from('clients').select('*').eq('email', email).single();
  if (!client) return res.status(401).json({ error: 'No account found with that email.', no_account: true });
  if (!await bcrypt.compare(pass, client.password)) return res.status(401).json({ error: 'Incorrect password. Please try again.' });
  const summary = await getUserSummary(client.id);
  res.json({ token: makeToken(client), user: { id: client.id, name: client.name, email: client.email, phone: client.phone, role: client.role, created_at: client.created_at }, summary });
}));

app.get('/api/dashboard', auth, go(async (req, res) => {
  const { data: client } = await supabase.from('clients').select('*').eq('id', req.user.id).single();
  if (!client) return res.status(404).json({ error: 'Account not found.' });
  const summary = await getUserSummary(client.id);
  res.json({ user: { id: client.id, name: client.name, email: client.email, phone: client.phone, role: client.role, created_at: client.created_at }, summary });
}));

app.put('/api/dashboard/profile', auth, go(async (req, res) => {
  const { name, phone } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required.' });
  sb(await supabase.from('clients').update({ name: name.trim(), phone: phone || null }).eq('id', req.user.id));
  res.json({ message: 'Profile updated.', name: name.trim(), phone: phone || null });
}));

app.put('/api/dashboard/change-password', auth, go(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both passwords required.' });
  if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  const { data: c } = await supabase.from('clients').select('password').eq('id', req.user.id).single();
  if (!await bcrypt.compare(current_password, c.password)) return res.status(401).json({ error: 'Current password is incorrect.' });
  sb(await supabase.from('clients').update({ password: await bcrypt.hash(new_password, 10) }).eq('id', req.user.id));
  res.json({ message: 'Password changed successfully.' });
}));

app.post('/api/auth/forgot-password', go(async (req, res) => {
  const email = (req.body?.email || '').toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'Email is required.' });
  const { data: client } = await supabase.from('clients').select('id').eq('email', email).single();
  if (!client) return res.json({ message: 'If that email is registered, a reset link has been sent.' });
  const token   = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 3600000).toISOString();
  await supabase.from('resets').delete().eq('email', email);
  await supabase.from('resets').insert({ email, token, expires, used: false });
  const resetUrl = `${process.env.APP_URL || 'http://localhost:' + PORT}/reset-password.html?token=${token}`;
  console.log(`\n📧  Password reset for ${email}:\n   ${resetUrl}\n`);
  res.json({ message: 'Reset link sent (check server console).', dev_reset_url: resetUrl });
}));

app.post('/api/auth/reset-password', go(async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) return res.status(400).json({ error: 'Token and new password are required.' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  const { data: reset } = await supabase.from('resets').select('*').eq('token', token).eq('used', false).single();
  if (!reset || new Date(reset.expires) <= new Date()) return res.status(400).json({ error: 'Reset link is invalid or has expired.' });
  await supabase.from('clients').update({ password: await bcrypt.hash(password, 10) }).eq('email', reset.email);
  await supabase.from('resets').update({ used: true }).eq('token', token);
  res.json({ message: 'Password updated. You can now sign in.' });
}));

app.get('/api/auth/verify-reset-token', go(async (req, res) => {
  const { data: reset } = await supabase.from('resets').select('email').eq('token', req.query.token).eq('used', false).single();
  if (!reset) return res.status(400).json({ valid: false, error: 'Token is invalid or expired.' });
  if (new Date(reset.expires) <= new Date()) return res.status(400).json({ valid: false, error: 'Token is invalid or expired.' });
  res.json({ valid: true, email: reset.email });
}));

/* Cars */
app.get('/api/cars', go(async (req, res) => {
  let query = supabase.from('cars').select('*');
  const { make, model, min_price, max_price, year, fuel, body, drive } = req.query;
  if (make)      query = query.ilike('make', `%${make}%`);
  if (model)     query = query.ilike('model', `%${model}%`);
  if (fuel)      query = query.ilike('fuel_type', `%${fuel}%`);
  if (body)      query = query.ilike('body', `%${body}%`);
  if (drive)     query = query.ilike('drive', `%${drive}%`);
  if (year)      query = query.eq('year', Number(year));
  if (min_price) query = query.gte('price', parseFloat(min_price));
  if (max_price) query = query.lte('price', parseFloat(max_price));
  const { data: cars, error } = await query;
  if (error) throw new Error(error.message);
  cars.sort((a, b) => a.status.localeCompare(b.status) || a.id - b.id);
  res.json(cars);
}));

/* Parts */
app.get('/api/parts', go(async (req, res) => {
  const { data: parts, error } = await supabase.from('parts').select('*');
  if (error) throw new Error(error.message);
  parts.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  res.json(parts);
}));

/* Appointments */
app.get('/api/appointments/slots', go(async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Date is required.' });
  const all = ['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'];
  const { data: taken } = await supabase.from('appointments').select('time_slot').eq('appointment_date', date).neq('status', 'cancelled');
  const takenSlots = (taken || []).map(a => a.time_slot);
  res.json(all.map(s => ({ slot: s, available: !takenSlots.includes(s) })));
}));

app.post('/api/appointments', auth, go(async (req, res) => {
  const { appointment_date, time_slot, service_type, car_make, car_model, car_year, car_plate, notes } = req.body || {};
  if (!appointment_date || !time_slot || !service_type) return res.status(400).json({ error: 'Date, time and service type are required.' });
  const plate = (car_plate || '').trim().toUpperCase();
  const { data: conflict } = await supabase.from('appointments').select('id').eq('appointment_date', appointment_date).eq('time_slot', time_slot).neq('status', 'cancelled').single();
  if (conflict) return res.status(409).json({ error: 'That time slot is already booked. Choose another.' });
  const { data: priorRepairs } = plate ? await supabase.from('repairs').select('*').eq('car_plate', plate) : { data: [] };
  const result = await supabase.from('appointments').insert({ client_id: req.user.id, appointment_date, time_slot, service_type, car_make: car_make || null, car_model: car_model || null, car_year: car_year || null, car_plate: plate || null, notes: notes || null, status: 'scheduled', created_at: nowISO() }).select().single();
  if (result.error) throw new Error(result.error.message);
  res.status(201).json({ id: result.data.id, message: 'Appointment booked.', prior_visits: (priorRepairs || []).length, repair_history: priorRepairs || [] });
}));

app.get('/api/appointments/my', auth, go(async (req, res) => {
  const [apptRes, repairRes] = await Promise.all([
    supabase.from('appointments').select('*').eq('client_id', req.user.id),
    supabase.from('repairs').select('*').eq('client_id', req.user.id),
  ]);
  const appts   = (apptRes.data || []).sort((a, b) => (b.appointment_date || '').localeCompare(a.appointment_date || ''));
  const repairs = repairRes.data || [];
  res.json(appts.map(a => {
    const r = repairs.find(r => r.appointment_id === a.id);
    return { ...a, report_id: r?.id || null, diagnosis: r?.diagnosis || null, total_cost: r?.total_cost || null, payment_status: r?.payment_status || null };
  }));
}));

/* Repairs */
app.get('/api/repairs/history', auth, go(async (req, res) => {
  const [repairRes, apptRes] = await Promise.all([
    supabase.from('repairs').select('*').eq('client_id', req.user.id),
    supabase.from('appointments').select('*').eq('client_id', req.user.id),
  ]);
  const repairs = (repairRes.data || []).sort((a, b) => (b.resolved_at || '').localeCompare(a.resolved_at || ''));
  const appts   = apptRes.data || [];
  res.json(repairs.map(r => {
    const a = appts.find(a => a.id === r.appointment_id) || {};
    return { ...r, appointment_date: a.appointment_date || null, service_type: a.service_type || null, car_make: a.car_make || null, car_model: a.car_model || null, car_plate: a.car_plate || null };
  }));
}));

app.get('/api/repairs/plate/:plate', auth, go(async (req, res) => {
  const plate = req.params.plate.toUpperCase();
  const { data: history } = await supabase.from('repairs').select('*').eq('car_plate', plate);
  (history || []).sort((a, b) => (b.resolved_at || '').localeCompare(a.resolved_at || ''));
  res.json({ plate, count: (history || []).length, history: history || [] });
}));

app.post('/api/repairs/report', auth, adminOnly, go(async (req, res) => {
  const { appointment_id, diagnosis, parts_used, labor_hours, total_cost, mechanic_notes } = req.body || {};
  if (!diagnosis || !total_cost) return res.status(400).json({ error: 'Diagnosis and cost are required.' });
  let client_id = req.user.id, car_plate = null;
  if (appointment_id) {
    const { data: a } = await supabase.from('appointments').select('*').eq('id', Number(appointment_id)).single();
    if (a) {
      client_id = a.client_id; car_plate = a.car_plate;
      await supabase.from('appointments').update({ status: 'completed' }).eq('id', a.id);
    }
  }
  const result = await supabase.from('repairs').insert({ appointment_id: appointment_id || null, client_id, car_plate: car_plate || null, diagnosis, parts_used: parts_used || [], labor_hours: labor_hours || 0, total_cost, mechanic_notes: mechanic_notes || null, payment_status: 'unpaid', resolved_at: nowISO() }).select().single();
  if (result.error) throw new Error(result.error.message);
  res.status(201).json({ id: result.data.id, message: 'Report created.' });
}));

/* Payments */
app.post('/api/payments/car', auth, go(async (req, res) => {
  const { car_id, method, mpesa_code } = req.body || {};
  if (!car_id || !method) return res.status(400).json({ error: 'Car ID and payment method are required.' });
  if (method === 'mpesa' && !mpesa_code) return res.status(400).json({ error: 'M-Pesa code is required.' });
  const { data: car } = await supabase.from('cars').select('*').eq('id', Number(car_id)).single();
  if (!car) return res.status(404).json({ error: 'Car not found.' });
  if (car.quantity < 1 || car.status === 'sold_out') return res.status(400).json({ error: 'This car is no longer available.' });
  const amount  = parseFloat(car.price);
  const payRes  = await supabase.from('payments').insert({ client_id: req.user.id, payment_type: 'car_sale', reference_id: car.id, amount, method, mpesa_code: mpesa_code || null, status: 'completed', paid_at: nowISO() }).select().single();
  if (payRes.error) throw new Error(payRes.error.message);
  const newQty = car.quantity - 1;
  await supabase.from('cars').update({ quantity: newQty, status: newQty <= 0 ? 'sold_out' : car.status }).eq('id', car.id);
  const items   = [{ description: `${car.make} ${car.model} ${car.year}${car.color ? ` (${car.color})` : ''}`, qty: 1, unit_price: (amount / 1.16).toFixed(2), total: (amount / 1.16).toFixed(2) }];
  const invoice = await createInvoice(req.user.id, payRes.data.id, 'car_sale', car.id, items, amount);
  res.status(201).json({ payment_id: payRes.data.id, amount, method, invoice, inventory: { remaining: newQty } });
}));

app.post('/api/payments/mpesa/initiate', auth, go(async (req, res) => {
  const { payment_type, reference_id, quantity, phone } = req.body || {};
  if (!payment_type || !reference_id) return res.status(400).json({ error: 'Payment type and reference ID are required.' });
  if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET || !MPESA_PASSKEY)
    return res.status(500).json({ error: 'M-Pesa credentials are not configured.' });
  const { data: client } = await supabase.from('clients').select('*').eq('id', req.user.id).single();
  if (!client) return res.status(404).json({ error: 'Client not found.' });
  const customerPhone = formatMpesaPhone(phone || client.phone || '');
  if (!/^2547\d{8}$/.test(customerPhone)) return res.status(400).json({ error: 'A valid Kenyan phone number is required for M-Pesa.' });

  let amount, description, accountReference, itemCount = 1;
  if (payment_type === 'car_sale') {
    const { data: car } = await supabase.from('cars').select('*').eq('id', Number(reference_id)).single();
    if (!car) return res.status(404).json({ error: 'Car not found.' });
    if (car.quantity < 1 || car.status === 'sold_out') return res.status(400).json({ error: 'This car is no longer available.' });
    amount = parseFloat(car.price); description = `Car purchase: ${car.make} ${car.model}`; accountReference = `CAR${car.id}`;
  } else if (payment_type === 'part_order') {
    const { data: part } = await supabase.from('parts').select('*').eq('id', Number(reference_id)).single();
    if (!part) return res.status(404).json({ error: 'Part not found.' });
    const qty = parseInt(quantity) || 1;
    if (part.stock < qty) return res.status(400).json({ error: `Only ${part.stock} units are available.` });
    amount = Number(part.price) * qty; description = `Part purchase: ${part.name} ×${qty}`; accountReference = `PART${part.id}`; itemCount = qty;
  } else if (payment_type === 'repair') {
    const { data: report } = await supabase.from('repairs').select('*').eq('id', Number(reference_id)).eq('client_id', req.user.id).single();
    if (!report) return res.status(404).json({ error: 'Repair report not found.' });
    if (report.payment_status === 'paid') return res.status(400).json({ error: 'Repair is already paid.' });
    amount = parseFloat(report.total_cost); description = `Repair payment: ${report.diagnosis}`; accountReference = `REPAIR${report.id}`;
  } else {
    return res.status(400).json({ error: 'Invalid payment type.' });
  }

  const timestamp   = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const password    = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');
  const token       = await getMpesaAccessToken();
  const callbackUrl = MPESA_CALLBACK_URL || `${req.protocol}://${req.get('host')}/api/payments/mpesa/callback`;
  const payload     = { BusinessShortCode: MPESA_SHORTCODE, Password: password, Timestamp: timestamp, TransactionType: 'CustomerPayBillOnline', Amount: Math.round(amount), PartyA: customerPhone, PartyB: MPESA_SHORTCODE, PhoneNumber: customerPhone, CallBackURL: callbackUrl, AccountReference: accountReference, TransactionDesc: description };
  const result      = await darajaRequest('POST', MPESA_STK_PUSH_PATH, payload, `Bearer ${token}`);
  if (!result.CheckoutRequestID || result.ResponseCode !== '0') {
    const errorMsg = result?.errorMessage || result?.ResponseDescription || result?.message || 'M-Pesa STK Push failed.';
    return res.status(500).json({ error: `M-Pesa STK Push failed: ${errorMsg}`, details: result });
  }
  const payRes = await supabase.from('payments').insert({ client_id: req.user.id, payment_type, reference_id: Number(reference_id), quantity: itemCount, amount, method: 'mpesa', status: 'pending', mpesa_phone: customerPhone, merchant_request_id: result.MerchantRequestID, checkout_request_id: result.CheckoutRequestID, created_at: nowISO(), stk_message: result.CustomerMessage || null }).select().single();
  if (payRes.error) throw new Error(payRes.error.message);
  res.json({ message: 'STK Push sent. Complete payment on your phone.', checkout_request_id: result.CheckoutRequestID, merchant_request_id: result.MerchantRequestID, customer_message: result.CustomerMessage, payment_id: payRes.data.id });
}));

app.post('/api/payments/mpesa/callback', go(async (req, res) => {
  const stk = req.body?.Body?.stkCallback;
  if (!stk) return res.status(400).json({ error: 'Invalid M-Pesa callback payload.' });
  const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stk;
  const { data: record } = await supabase.from('payments').select('*').or(`checkout_request_id.eq.${CheckoutRequestID},merchant_request_id.eq.${MerchantRequestID}`).single();
  if (!record) return res.status(404).json({ error: 'Pending M-Pesa payment not found.' });
  if (ResultCode !== 0) {
    await supabase.from('payments').update({ status: 'failed', result_code: ResultCode, result_desc: ResultDesc, callback_payload: req.body }).eq('id', record.id);
    return res.json({ status: 'failed', detail: ResultDesc });
  }
  const metadata = Array.isArray(CallbackMetadata?.Item) ? CallbackMetadata.Item : [];
  const receipt  = metadata.find(i => i.Name === 'MpesaReceiptNumber')?.Value || null;
  const amount   = parseFloat(metadata.find(i => i.Name === 'Amount')?.Value || record.amount || 0);
  const phone    = metadata.find(i => i.Name === 'PhoneNumber')?.Value || record.mpesa_phone;
  await supabase.from('payments').update({ status: 'completed', paid_at: nowISO(), mpesa_code: receipt, mpesa_phone: phone, result_code: ResultCode, result_desc: ResultDesc, callback_payload: req.body }).eq('id', record.id);
  if (record.payment_type === 'car_sale') {
    const { data: car } = await supabase.from('cars').select('*').eq('id', record.reference_id).single();
    if (car) { const q = Math.max(0, car.quantity - 1); await supabase.from('cars').update({ quantity: q, status: q === 0 ? 'sold_out' : car.status }).eq('id', car.id); }
  }
  if (record.payment_type === 'part_order') {
    const { data: part } = await supabase.from('parts').select('*').eq('id', record.reference_id).single();
    if (part) { await supabase.from('parts').update({ stock: Math.max(0, part.stock - (record.quantity || 1)) }).eq('id', part.id); }
  }
  if (record.payment_type === 'repair') {
    await supabase.from('repairs').update({ payment_status: 'paid' }).eq('id', record.reference_id);
  }
  const invoiceItems = [];
  if (record.payment_type === 'car_sale') {
    const { data: car } = await supabase.from('cars').select('*').eq('id', record.reference_id).single() || {};
    invoiceItems.push({ description: `${car?.make || 'Vehicle'} ${car?.model || ''} ${car?.year || ''}`.trim(), qty: 1, unit_price: (amount / 1.16).toFixed(2), total: (amount / 1.16).toFixed(2) });
  } else if (record.payment_type === 'part_order') {
    const { data: part } = await supabase.from('parts').select('*').eq('id', record.reference_id).single() || {};
    const qty = record.quantity || 1;
    invoiceItems.push({ description: `${part?.name || 'Part'} ×${qty}`, qty, unit_price: (parseFloat(part?.price) || 0).toFixed(2), total: ((parseFloat(part?.price) || 0) * qty).toFixed(2) });
  } else if (record.payment_type === 'repair') {
    const { data: report } = await supabase.from('repairs').select('*').eq('id', record.reference_id).single() || {};
    invoiceItems.push({ description: `Repair — ${report?.diagnosis || 'Service'}`, qty: 1, unit_price: (amount / 1.16).toFixed(2), total: (amount / 1.16).toFixed(2) });
  }
  const invoice = await createInvoice(record.client_id, record.id, record.payment_type, record.reference_id, invoiceItems, amount);
  await supabase.from('payments').update({ invoice_id: invoice.id, invoice_number: invoice.invoice_number }).eq('id', record.id);
  res.json({ status: 'completed', invoice_number: invoice.invoice_number });
}));

app.get('/api/payments/mpesa/status/:id', auth, go(async (req, res) => {
  const { data: payment } = await supabase.from('payments').select('*').or(`checkout_request_id.eq.${req.params.id},id.eq.${Number(req.params.id) || 0}`).single();
  if (!payment) return res.status(404).json({ error: 'Payment request not found.' });
  const invoice = payment.invoice_id ? (await supabase.from('invoices').select('*').eq('id', payment.invoice_id).single()).data : null;
  res.json({ status: payment.status, checkout_request_id: payment.checkout_request_id, merchant_request_id: payment.merchant_request_id, mpesa_code: payment.mpesa_code, paid_at: payment.paid_at, result_desc: payment.result_desc, invoice: invoice ? await formatInvoice(invoice) : null });
}));

app.post('/api/payments/parts', auth, go(async (req, res) => {
  const { part_id, quantity, method, mpesa_code } = req.body || {};
  if (!part_id || !method) return res.status(400).json({ error: 'Part ID and payment method are required.' });
  if (method === 'mpesa' && !mpesa_code) return res.status(400).json({ error: 'M-Pesa code is required.' });
  const qty = parseInt(quantity) || 1;
  const { data: part } = await supabase.from('parts').select('*').eq('id', Number(part_id)).single();
  if (!part)            return res.status(404).json({ error: 'Part not found.' });
  if (part.stock < qty) return res.status(400).json({ error: `Only ${part.stock} in stock.` });
  const amount = parseFloat(part.price) * qty;
  const payRes = await supabase.from('payments').insert({ client_id: req.user.id, payment_type: 'part_order', reference_id: part.id, quantity: qty, amount, method, mpesa_code: mpesa_code || null, status: 'completed', paid_at: nowISO() }).select().single();
  if (payRes.error) throw new Error(payRes.error.message);
  await supabase.from('parts').update({ stock: part.stock - qty }).eq('id', part.id);
  const items   = [{ description: `${part.name} ×${qty}`, qty, unit_price: part.price, total: amount }];
  const invoice = await createInvoice(req.user.id, payRes.data.id, 'part_order', part.id, items, amount);
  res.status(201).json({ payment_id: payRes.data.id, amount, method, invoice, inventory: { remaining: part.stock - qty } });
}));

app.post('/api/payments/repair', auth, go(async (req, res) => {
  const { repair_report_id, method, mpesa_code } = req.body || {};
  if (!repair_report_id || !method) return res.status(400).json({ error: 'Repair ID and method are required.' });
  if (method === 'mpesa' && !mpesa_code) return res.status(400).json({ error: 'M-Pesa code is required.' });
  const { data: report } = await supabase.from('repairs').select('*').eq('id', Number(repair_report_id)).eq('client_id', req.user.id).single();
  if (!report) return res.status(404).json({ error: 'Repair report not found.' });
  if (report.payment_status === 'paid') return res.status(400).json({ error: 'Already paid.' });
  const amount = parseFloat(report.total_cost);
  const payRes = await supabase.from('payments').insert({ client_id: req.user.id, payment_type: 'repair', reference_id: report.id, amount, method, mpesa_code: mpesa_code || null, status: 'completed', paid_at: nowISO() }).select().single();
  if (payRes.error) throw new Error(payRes.error.message);
  await supabase.from('repairs').update({ payment_status: 'paid' }).eq('id', report.id);
  const items   = [{ description: `Repair — ${report.diagnosis}`, qty: 1, unit_price: (amount / 1.16).toFixed(2), total: (amount / 1.16).toFixed(2) }];
  const invoice = await createInvoice(req.user.id, payRes.data.id, 'repair', report.id, items, amount);
  res.status(201).json({ payment_id: payRes.data.id, amount, method, invoice });
}));

/* Invoices */
app.get('/api/invoices/my', auth, go(async (req, res) => {
  const { data: invoices } = await supabase.from('invoices').select('*').eq('client_id', req.user.id).order('issued_at', { ascending: false });
  res.json(await Promise.all((invoices || []).map(formatInvoice)));
}));

app.get('/api/invoices/:id', auth, go(async (req, res) => {
  const { data: invoice } = await supabase.from('invoices').select('*').eq('id', Number(req.params.id)).single();
  if (!invoice || invoice.client_id !== req.user.id) return res.status(404).json({ error: 'Invoice not found.' });
  res.json(await formatInvoice(invoice));
}));

app.get('/api/repairs/report/:id', auth, go(async (req, res) => {
  const { data: report } = await supabase.from('repairs').select('*').eq('id', Number(req.params.id)).single();
  if (!report) return res.status(404).json({ error: 'Report not found.' });
  if (report.client_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied.' });
  const { data: appt } = await supabase.from('appointments').select('*').eq('id', report.appointment_id).single();
  res.json({ ...report, appointment_date: appt?.appointment_date || null, service_type: appt?.service_type || null, car_make: appt?.car_make || null, car_model: appt?.car_model || null });
}));

/* Admin */
app.get('/api/admin/stats', auth, adminOnly, go(async (req, res) => {
  const [clientCount, carCount, soldCount, apptCount, payRes, unpaidRes] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('role', 'client'),
    supabase.from('cars').select('*', { count: 'exact', head: true }),
    supabase.from('cars').select('*', { count: 'exact', head: true }).eq('status', 'sold_out'),
    supabase.from('appointments').select('*', { count: 'exact', head: true }),
    supabase.from('payments').select('amount'),
    supabase.from('repairs').select('*', { count: 'exact', head: true }).eq('payment_status', 'unpaid'),
  ]);
  const revenue = (payRes.data || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  res.json({ clients: clientCount.count, cars: carCount.count, cars_sold: soldCount.count, appointments: apptCount.count, revenue, unpaid: unpaidRes.count });
}));

app.get('/api/admin/reports/summary', auth, adminOnly, go(async (req, res) => {
  const [invRes, repairRes, payRes, apptRes, clientRes] = await Promise.all([
    supabase.from('invoices').select('*').order('issued_at', { ascending: false }),
    supabase.from('repairs').select('*').order('resolved_at', { ascending: false }),
    supabase.from('payments').select('*'),
    supabase.from('appointments').select('*'),
    supabase.from('clients').select('*'),
  ]);
  const allInvoices = invRes.data || [];
  const allRepairs  = repairRes.data || [];
  const allPayments = payRes.data || [];
  const allAppts    = apptRes.data || [];
  const allClients  = clientRes.data || [];

  const invoices = await Promise.all(allInvoices.slice(0, 12).map(formatInvoice));
  const repairs  = allRepairs.slice(0, 12).map(r => {
    const a = allAppts.find(a => a.id === r.appointment_id) || {};
    const c = allClients.find(c => c.id === r.client_id) || {};
    return { id: r.id, appointment_id: r.appointment_id, appointment_date: a.appointment_date || null, service_type: a.service_type || null, car_plate: r.car_plate || a.car_plate || null, car_make: a.car_make || null, car_model: a.car_model || null, diagnosis: r.diagnosis, total_cost: r.total_cost, payment_status: r.payment_status, client_name: c.name || null, client_email: c.email || null, client_phone: c.phone || null, resolved_at: r.resolved_at };
  });
  const monthlyRevenue = Object.entries(allPayments.reduce((acc, p) => {
    const month = p.paid_at ? p.paid_at.slice(0, 7) : 'unknown';
    acc[month] = (acc[month] || 0) + parseFloat(p.amount || 0);
    return acc;
  }, {})).sort(([a], [b]) => b.localeCompare(a)).slice(0, 6).map(([month, revenue]) => ({ month, revenue }));

  res.json({
    clients_count:      allClients.filter(c => c.role === 'client').length,
    cars_count:         (await supabase.from('cars').select('*', { count: 'exact', head: true })).count,
    cars_sold:          (await supabase.from('cars').select('*', { count: 'exact', head: true }).eq('status', 'sold_out')).count,
    appointments_count: (await supabase.from('appointments').select('*', { count: 'exact', head: true })).count,
    revenue:            allPayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0),
    unpaid_repairs:     allRepairs.filter(r => r.payment_status === 'unpaid').length,
    paid_repairs:       allRepairs.filter(r => r.payment_status === 'paid').length,
    invoices_count:     allInvoices.length,
    recent_invoices:    invoices,
    recent_repairs:     repairs,
    monthly_revenue:    monthlyRevenue,
  });
}));

app.get('/api/admin/clients', auth, adminOnly, go(async (req, res) => {
  const { data: clients } = await supabase.from('clients').select('id,name,email,phone,role,created_at');
  res.json(clients || []);
}));

/* 404 & SPA fallback */
app.use('/api/*', (req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));
app.get('*', (req, res) => {
  const index = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(index)) return res.sendFile(index);
  res.json({ server: 'online', message: 'Brisa Motors API v3 (Supabase) — no frontend in /public' });
});
app.use((err, req, res, _n) => { if (!res.headersSent) res.status(500).json({ error: err.message }); });

/* Start */
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚗  Brisa Motors v3 (Supabase)`);
    console.log(`   URL:    http://localhost:${PORT}`);
    console.log(`   Admin:  admin@brisamotors.co.ke  /  Admin@1234\n`);
  });
}

module.exports = app;
