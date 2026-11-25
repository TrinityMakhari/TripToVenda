/* =============================================================================
   Trip To Venda · branded account emails (Netlify Function)
   POST /api/auth-email
     { type: 'verify' }            + header  Authorization: Bearer <Firebase ID token>
     { type: 'reset', email }      (no login needed)
   Makes the secure Firebase link with the Admin SDK and sends our own email
   (logo + button) through Brevo. If the settings below are missing it answers
   503 and the website falls back to Firebase's plain email, so nothing breaks.

   Netlify → Site configuration → Environment variables (keep them secret):
     FIREBASE_SERVICE_ACCOUNT  whole JSON key from Firebase → Project settings → Service accounts (never put it on GitHub)
     BREVO_API_KEY             from Brevo → SMTP & API → API keys
     MAIL_FROM                 the sender address you verified in Brevo
     SITE_URL                  https://trip-to-venda.netlify.app   (optional)
   ============================================================================= */
import crypto from 'node:crypto';

/* No packages needed: plain Google REST calls, signed with the Firebase service account key. */
const SITE = (process.env.SITE_URL || 'https://trip-to-venda.netlify.app').replace(/\/$/, '');
const BREVO_URL = process.env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email';
const WEB_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyC5zxnUk91YUzXeC8vmJObSTBgV__v9688'; // public web key (same as firebase-config.js)
const AUTH = process.env.AUTH_BASE || 'https://identitytoolkit.googleapis.com';   // tests: http://127.0.0.1:9099/identitytoolkit.googleapis.com
const FS = process.env.FS_BASE || 'https://firestore.googleapis.com';             // tests: http://127.0.0.1:8080
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

let SA = null, tok = null;
function account() {
  if (SA) return SA;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try { SA = JSON.parse(raw); } catch { return null; }
  return SA.project_id && SA.client_email && SA.private_key ? SA : null;
}
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
async function token() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN;                  // emulator tests only
  if (tok && tok.exp > Date.now() + 60000) return tok.value;
  const sa = account(), now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const jwt = head + '.' + crypto.sign('RSA-SHA256', Buffer.from(head), sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
  const d = await r.json(); if (!r.ok) throw new Error('token ' + JSON.stringify(d).slice(0, 200));
  tok = { value: d.access_token, exp: Date.now() + d.expires_in * 1000 };
  return tok.value;
}
const project = () => account()?.project_id || process.env.GCLOUD_PROJECT;
async function gapi(method, url, body) {
  const r = await fetch(url, { method, headers: { authorization: 'Bearer ' + await token(), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
}

/* who is calling: Google checks the login token for us */
async function whoIs(idToken) {
  if (!idToken) return null;
  const r = await fetch(`${AUTH}/v1/accounts:lookup?key=${WEB_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken }) });
  if (!r.ok) return null;
  const u = (await r.json()).users?.[0];
  return u ? { uid: u.localId, email: u.email, verified: !!u.emailVerified, disabled: !!u.disabled } : null;
}
/* a secure one-time link, made by Google but NOT emailed by Google */
async function oobLink(requestType, email) {
  const r = await gapi('POST', `${AUTH}/v1/projects/${project()}/accounts:sendOobCode`, { requestType, email, returnOobLink: true, continueUrl: SITE + '/' });
  if (!r.ok) return { error: r.d?.error?.message || 'error ' + r.status };
  return { link: r.d.oobLink };
}

/* ---------- limits, kept in Firestore (closed to the website by the rules) ---------- */
const doc = path => `${FS}/v1/projects/${project()}/databases/(default)/documents/${path}`;
async function allow(key, max, windowMs, gapMs = 0) {
  const g = await gapi('GET', doc('mailLimits/' + key)), now = Date.now();
  const f = g.ok ? g.d.fields || {} : {}, num = k => Number(f[k]?.integerValue || 0);
  let d = { n: num('n'), since: num('since') || now, last: num('last') };
  if (now - d.since > windowMs) d = { n: 0, since: now, last: 0 };
  if (d.n >= max) return { ok: false, wait: Math.ceil((d.since + windowMs - now) / 60000) };
  if (gapMs && now - d.last < gapMs) return { ok: false, wait: 1 };
  await gapi('PATCH', doc('mailLimits/' + key), { fields: { n: { integerValue: String(d.n + 1) }, since: { integerValue: String(d.since) }, last: { integerValue: String(now) } } });
  return { ok: true };
}
const hash = s => crypto.createHash('sha256').update(String(s).toLowerCase().trim()).digest('hex').slice(0, 40);
async function firstName(uid) {
  if (!uid) return '';
  const g = await gapi('GET', doc('contacts/' + uid));
  return ((g.ok && g.d.fields?.name?.stringValue) || '').trim().split(/\s+/)[0] || '';
}

/* our own page handles the link: https://site/?mode=verifyEmail&oobCode=… */
function ourLink(firebaseLink) {
  const u = new URL(firebaseLink), p = new URLSearchParams({ mode: u.searchParams.get('mode'), oobCode: u.searchParams.get('oobCode') });
  return `${SITE}/?${p}`;
}


/* ---------- the email ---------- */
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function emailHTML({ preheader, title, hello, lines, button, url, small }) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f3;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#0c1a13">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f3"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="background:#0a3d27;border-radius:16px 16px 0 0;padding:26px 28px" align="left">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px"><img src="${SITE}/img/email-logo.png" width="52" height="52" alt="Trip To Venda" style="display:block;border-radius:50%;border:2px solid #ffb81c"></td>
        <td style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-.2px">Trip To <span style="color:#ffb81c">Venda</span><div style="font-size:11px;font-weight:600;color:#bfe3cf;letter-spacing:1.6px;text-transform:uppercase;margin-top:3px">Door to door lifts across South Africa</div></td>
      </tr></table>
    </td></tr>
    <tr><td style="background:#ffffff;padding:34px 28px 10px;border-left:1px solid #e5eae6;border-right:1px solid #e5eae6">
      <h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#0c1a13">${esc(title)}</h1>
      <p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#34433b">${esc(hello)}</p>
      ${lines.map(l => `<p style="margin:0 0 14px;font-size:16px;line-height:1.6;color:#34433b">${esc(l)}</p>`).join('')}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 24px"><tr><td align="center" bgcolor="#ffb81c" style="border-radius:999px">
        <a href="${esc(url)}" target="_blank" style="display:inline-block;padding:15px 34px;font-size:16px;font-weight:800;color:#0c1a13;text-decoration:none;border-radius:999px">${esc(button)}</a>
      </td></tr></table>
      <p style="margin:0 0 22px;font-size:13px;line-height:1.6;color:#6b7a72">${esc(small)}</p>
    </td></tr>
    <tr><td style="background:#ffffff;padding:0 28px 28px;border-left:1px solid #e5eae6;border-right:1px solid #e5eae6;border-bottom:1px solid #e5eae6;border-radius:0 0 16px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5eae6"><tr><td style="padding-top:16px;font-size:12px;line-height:1.6;color:#6b7a72">
        Button not working? Copy this link into your browser:<br><a href="${esc(url)}" style="color:#0f5c3a;word-break:break-all">${esc(url)}</a>
      </td></tr></table>
    </td></tr>
    <tr><td align="center" style="padding:20px 12px;font-size:12px;line-height:1.6;color:#6b7a72">
      Trip To Venda · Verified drivers. Verified riders. Fair prices set by drivers.<br>
      We will never ask for your password or PIN by email, SMS or phone.<br>
      <a href="${SITE}" style="color:#0f5c3a;text-decoration:none;font-weight:700">trip-to-venda.netlify.app</a>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}
const textOf = ({ title, hello, lines, button, url, small }) => [title, '', hello, '', ...lines, '', `${button}: ${url}`, '', small, '', 'Trip To Venda'].join('\n');

async function send(to, name, subject, parts) {
  const r = await fetch(BREVO_URL, {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { name: 'Trip To Venda', email: process.env.MAIL_FROM }, to: [{ email: to, ...(name ? { name } : {}) }], subject, htmlContent: emailHTML(parts), textContent: textOf(parts), tags: ['account'] })
  });
  if (!r.ok) throw new Error('mail ' + r.status + ' ' + (await r.text()).slice(0, 200));
}

export default async (req, context) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if ((!account() && !process.env.ADMIN_TOKEN) || !process.env.BREVO_API_KEY || !process.env.MAIL_FROM) return json(503, { error: 'not configured', fallback: true });
  let body; try { body = await req.json(); } catch { return json(400, { error: 'bad request' }); }
  const ip = context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown';

  try {
    if (body.type === 'verify') {
      const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
      const user = await whoIs(token);
      if (!user) return json(401, { error: 'log in first' });
      if (!user.email) return json(400, { error: 'no email' });
      if (user.verified) return json(200, { sent: false, already: true });
      const lim = await allow('v_' + user.uid, 5, 86400000, 60000);
      if (!lim.ok) return json(429, { error: 'wait', wait: lim.wait });
      const o = await oobLink('VERIFY_EMAIL', user.email); if (!o.link) throw new Error(o.error);
      const url = ourLink(o.link), name = await firstName(user.uid);
      await send(user.email, name, 'Confirm your email · Trip To Venda', {
        preheader: 'One tap to confirm your email and start using Trip To Venda.',
        title: 'Confirm your email address', hello: name ? `Hi ${name},` : 'Hi there,',
        lines: ['Welcome to Trip To Venda. Please confirm that this is your email address so you can book lifts, post trips and receive trip updates.', 'This keeps your account safe and helps us make sure every rider and driver is real.'],
        button: 'Verify my account', url,
        small: "This link works once and expires after a while. If you didn't create a Trip To Venda account, you can ignore this email."
      });
      return json(200, { sent: true });
    }

    if (body.type === 'reset') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return json(400, { error: 'email' });
      // same answer whether or not the email has an account (nobody can check who is registered)
      const a = await allow('r_' + hash(email), 3, 3600000, 60000), b = await allow('ip_' + hash(ip), 15, 3600000);
      if (!a.ok || !b.ok) return json(200, { sent: true });
      const o = await oobLink('PASSWORD_RESET', email);
      if (!o.link) return json(200, { sent: true });              // no such account (or disabled): same answer
      const look = await gapi('POST', `${AUTH}/v1/projects/${project()}/accounts:lookup`, { email: [email] });
      const url = ourLink(o.link), name = await firstName(look.d?.users?.[0]?.localId);
      await send(email, name, 'Reset your password · Trip To Venda', {
        preheader: 'Choose a new password for your Trip To Venda account.',
        title: 'Reset your password', hello: name ? `Hi ${name},` : 'Hi there,',
        lines: ['We received a request to reset the password for your Trip To Venda account.', 'Tap the button below to choose a new password.'],
        button: 'Choose a new password', url,
        small: "If you didn't ask for this, ignore this email: your password stays the same and nobody can change it without this link."
      });
      return json(200, { sent: true });
    }
    return json(400, { error: 'unknown type' });
  } catch (e) {
    console.error('auth-email', e.message);
    return json(502, { error: 'send failed', fallback: true });
  }
};

export const config = { path: '/api/auth-email' };
