'use strict';

const { Resend } = require('resend');

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || '';
const FROM_EMAIL     = process.env.FROM_EMAIL     || 'Brisa Motors <noreply@brisamotors.co.ke>';
const APP_URL        = process.env.APP_URL        || 'https://brisa-motors.gurutech.top';

let _resend = null;
function getResend() {
  if (_resend) return _resend;
  if (!RESEND_API_KEY) {
    console.warn('⚠️  Email: RESEND_API_KEY not set — emails will be skipped.');
    return null;
  }
  _resend = new Resend(RESEND_API_KEY);
  return _resend;
}

async function sendMail({ to, subject, html }) {
  const r = getResend();
  if (!r) return;
  try {
    const { error } = await r.emails.send({ from: FROM_EMAIL, to, subject, html });
    if (error) console.error('📧  Resend error:', error.message);
  } catch (err) {
    console.error('📧  Email send failed:', err.message);
  }
}

/* ── Shared layout ───────────────────────────────────────── */
function wrap(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Brisa Motors</title>
<style>
  body{margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;color:#333}
  .wrapper{max-width:600px;margin:30px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1)}
  .header{background:#1a1a2e;padding:24px 32px;text-align:center}
  .header h1{margin:0;color:#e8c96d;font-size:22px;letter-spacing:1px}
  .body{padding:28px 32px}
  .body h2{margin-top:0;color:#1a1a2e;font-size:18px}
  .body p{line-height:1.6;margin:8px 0}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:bold}
  .badge-green{background:#d4edda;color:#155724}
  table.info{width:100%;border-collapse:collapse;margin:16px 0}
  table.info td{padding:8px 12px;border-bottom:1px solid #eee;font-size:14px}
  table.info td:first-child{font-weight:bold;color:#555;width:40%}
  .btn{display:inline-block;margin:20px 0 8px;padding:12px 28px;background:#e8c96d;color:#1a1a2e;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px}
  .footer{background:#f8f8f8;padding:16px 32px;text-align:center;font-size:12px;color:#888;border-top:1px solid #eee}
  .footer a{color:#e8c96d;text-decoration:none}
  .divider{border:none;border-top:1px solid #eee;margin:20px 0}
</style>
</head>
<body>
<div class="wrapper">
  <div class="header"><h1>🚗 Brisa Motors</h1></div>
  <div class="body">${body}</div>
  <div class="footer">
    Brisa Motors &bull; Nairobi, Kenya<br/>
    <a href="${APP_URL}">${APP_URL}</a><br/>
    Questions? <a href="mailto:${ADMIN_EMAIL}">${ADMIN_EMAIL}</a>
  </div>
</div>
</body></html>`;
}

/* ═══════════════════════════════════════════
   USER EMAILS
   ═══════════════════════════════════════════ */

async function sendWelcomeEmail({ name, email }) {
  const html = wrap(`
    <h2>Welcome to Brisa Motors, ${name.split(' ')[0]}! 🎉</h2>
    <p>Your account has been created successfully. Here's what you can do:</p>
    <ul>
      <li>📅 Book service appointments</li>
      <li>🚗 Browse our car inventory</li>
      <li>🔧 View repair history &amp; reports</li>
      <li>💳 Make secure payments via M-Pesa or Card</li>
    </ul>
    <a href="${APP_URL}" class="btn">Go to Dashboard</a>
    <hr class="divider"/>
    <p style="font-size:13px;color:#666;">If you didn't create this account, contact us at <a href="mailto:${ADMIN_EMAIL}">${ADMIN_EMAIL}</a>.</p>
  `);
  await sendMail({ to: email, subject: '🚗 Welcome to Brisa Motors!', html });
}

async function sendAppointmentConfirmEmail({ name, email, date, timeSlot, serviceType, carPlate }) {
  const html = wrap(`
    <h2>Appointment Confirmed ✅</h2>
    <p>Hi ${name.split(' ')[0]}, your appointment has been booked.</p>
    <table class="info">
      <tr><td>Date</td><td>${date}</td></tr>
      <tr><td>Time</td><td>${timeSlot}</td></tr>
      <tr><td>Service</td><td>${serviceType}</td></tr>
      ${carPlate ? `<tr><td>Vehicle Plate</td><td>${carPlate}</td></tr>` : ''}
    </table>
    <p>Please arrive 10 minutes early. For changes or cancellations, contact us.</p>
    <a href="${APP_URL}" class="btn">View My Appointments</a>
  `);
  await sendMail({ to: email, subject: '✅ Appointment Booked – Brisa Motors', html });
}

async function sendPaymentReceiptEmail({ name, email, amount, method, paymentType, description, invoiceNumber }) {
  const typeLabel = { car_sale: 'Car Purchase', part_order: 'Parts Order', repair: 'Repair Payment' }[paymentType] || paymentType;
  const html = wrap(`
    <h2>Payment Received 💳</h2>
    <p>Hi ${name.split(' ')[0]}, your payment was processed successfully.</p>
    <table class="info">
      <tr><td>Type</td><td><span class="badge badge-green">${typeLabel}</span></td></tr>
      <tr><td>Description</td><td>${description}</td></tr>
      <tr><td>Amount</td><td><strong>Ksh ${Number(amount).toLocaleString('en-KE')}</strong></td></tr>
      <tr><td>Method</td><td>${method}</td></tr>
      ${invoiceNumber ? `<tr><td>Invoice #</td><td>${invoiceNumber}</td></tr>` : ''}
    </table>
    <a href="${APP_URL}" class="btn">View My Invoices</a>
  `);
  await sendMail({ to: email, subject: '💳 Payment Confirmed – Brisa Motors', html });
}

async function sendPasswordResetEmail({ email, resetUrl }) {
  const html = wrap(`
    <h2>Password Reset Request 🔑</h2>
    <p>We received a request to reset your password. Click the button below to set a new one.</p>
    <a href="${resetUrl}" class="btn">Reset My Password</a>
    <p style="font-size:13px;color:#666;margin-top:16px;">This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email.</p>
    <p style="font-size:13px;color:#666;">Or copy this URL:<br/><code style="word-break:break-all;">${resetUrl}</code></p>
  `);
  await sendMail({ to: email, subject: '🔑 Reset Your Brisa Motors Password', html });
}

async function sendContactAckEmail({ name, email, subject, message }) {
  const html = wrap(`
    <h2>We Got Your Message ✉️</h2>
    <p>Hi ${name.split(' ')[0]}, thanks for reaching out. We'll get back to you as soon as possible.</p>
    <table class="info">
      <tr><td>Subject</td><td>${subject}</td></tr>
      <tr><td>Message</td><td>${message}</td></tr>
    </table>
    <p style="font-size:13px;color:#666;">Urgent? Reach us at <a href="mailto:${ADMIN_EMAIL}">${ADMIN_EMAIL}</a>.</p>
  `);
  await sendMail({ to: email, subject: '✉️ We received your message – Brisa Motors', html });
}

/* ═══════════════════════════════════════════
   ADMIN EMAILS
   ═══════════════════════════════════════════ */

async function notifyAdmin({ subject, html }) {
  if (!ADMIN_EMAIL) return;
  await sendMail({ to: ADMIN_EMAIL, subject, html });
}

async function adminNewUser({ name, email, phone }) {
  const html = wrap(`
    <h2>🆕 New User Registered</h2>
    <table class="info">
      <tr><td>Name</td><td>${name}</td></tr>
      <tr><td>Email</td><td>${email}</td></tr>
      <tr><td>Phone</td><td>${phone || '—'}</td></tr>
      <tr><td>Time</td><td>${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}</td></tr>
    </table>
  `);
  await notifyAdmin({ subject: `🆕 New User: ${name} (${email})`, html });
}

async function adminNewAppointment({ clientName, clientEmail, date, timeSlot, serviceType, carPlate, carMake, carModel }) {
  const html = wrap(`
    <h2>📅 New Appointment Booked</h2>
    <table class="info">
      <tr><td>Client</td><td>${clientName}</td></tr>
      <tr><td>Email</td><td>${clientEmail}</td></tr>
      <tr><td>Date</td><td>${date}</td></tr>
      <tr><td>Time</td><td>${timeSlot}</td></tr>
      <tr><td>Service</td><td>${serviceType}</td></tr>
      ${carPlate ? `<tr><td>Plate</td><td>${carPlate}</td></tr>` : ''}
      ${carMake ? `<tr><td>Vehicle</td><td>${carMake} ${carModel || ''}</td></tr>` : ''}
    </table>
    <a href="${APP_URL}/admin" class="btn">View in Admin</a>
  `);
  await notifyAdmin({ subject: `📅 New Appointment: ${clientName} – ${date} ${timeSlot}`, html });
}

async function adminPaymentReceived({ clientName, clientEmail, amount, method, paymentType, description, invoiceNumber }) {
  const typeLabel = { car_sale: 'Car Purchase', part_order: 'Parts Order', repair: 'Repair Payment' }[paymentType] || paymentType;
  const html = wrap(`
    <h2>💰 Payment Received</h2>
    <table class="info">
      <tr><td>Client</td><td>${clientName}</td></tr>
      <tr><td>Email</td><td>${clientEmail}</td></tr>
      <tr><td>Type</td><td><span class="badge badge-green">${typeLabel}</span></td></tr>
      <tr><td>Description</td><td>${description}</td></tr>
      <tr><td>Amount</td><td><strong>Ksh ${Number(amount).toLocaleString('en-KE')}</strong></td></tr>
      <tr><td>Method</td><td>${method}</td></tr>
      ${invoiceNumber ? `<tr><td>Invoice #</td><td>${invoiceNumber}</td></tr>` : ''}
      <tr><td>Time</td><td>${new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' })}</td></tr>
    </table>
    <a href="${APP_URL}/admin" class="btn">View in Admin</a>
  `);
  await notifyAdmin({ subject: `💰 Payment: Ksh ${Number(amount).toLocaleString('en-KE')} from ${clientName}`, html });
}

async function adminContactMessage({ name, email, phone, subject, message }) {
  const html = wrap(`
    <h2>✉️ New Contact / Support Message</h2>
    <table class="info">
      <tr><td>Name</td><td>${name}</td></tr>
      <tr><td>Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
      <tr><td>Phone</td><td>${phone || '—'}</td></tr>
      <tr><td>Subject</td><td>${subject}</td></tr>
    </table>
    <p><strong>Message:</strong></p>
    <p style="background:#f8f8f8;padding:12px;border-left:4px solid #e8c96d;border-radius:4px;">${message.replace(/\n/g, '<br/>')}</p>
    <a href="mailto:${email}?subject=Re: ${encodeURIComponent(subject)}" class="btn">Reply to ${name.split(' ')[0]}</a>
  `);
  await notifyAdmin({ subject: `✉️ Support: ${subject} – ${name}`, html });
}

async function adminRepairReport({ clientName, clientEmail, diagnosis, totalCost, carPlate }) {
  const html = wrap(`
    <h2>🔧 Repair Report Created</h2>
    <table class="info">
      <tr><td>Client</td><td>${clientName}</td></tr>
      <tr><td>Email</td><td>${clientEmail}</td></tr>
      ${carPlate ? `<tr><td>Plate</td><td>${carPlate}</td></tr>` : ''}
      <tr><td>Diagnosis</td><td>${diagnosis}</td></tr>
      <tr><td>Total Cost</td><td><strong>Ksh ${Number(totalCost).toLocaleString('en-KE')}</strong></td></tr>
    </table>
    <a href="${APP_URL}/admin" class="btn">View in Admin</a>
  `);
  await notifyAdmin({ subject: `🔧 Repair Report – ${clientName} | Ksh ${Number(totalCost).toLocaleString('en-KE')}`, html });
}

module.exports = {
  sendWelcomeEmail,
  sendAppointmentConfirmEmail,
  sendPaymentReceiptEmail,
  sendPasswordResetEmail,
  sendContactAckEmail,
  adminNewUser,
  adminNewAppointment,
  adminPaymentReceived,
  adminContactMessage,
  adminRepairReport,
};
