/* =============================================================================
   Trip To Venda · delete a person's login (Netlify Function)
   POST /api/delete-user   { uid }   + header Authorization: Bearer <Firebase ID token of an admin>
   Only an admin (a document in admins/{uid}) can call it. It deletes the login
   (email/password or Google) so the person can't sign in again. The app itself
   removes their private details from Firestore before calling this.
   Needs the same secret as the email function:
     FIREBASE_SERVICE_ACCOUNT  (Netlify → Site configuration → Environment variables)
   Without it the function answers 503 and the app tells the admin to delete the
   login by hand in Firebase → Authentication → Users.
   ============================================================================= */
import crypto from 'node:crypto';

const WEB_KEY = process.env.FIREBASE_WEB_API_KEY || 'AIzaSyC5zxnUk91YUzXeC8vmJObSTBgV__v9688'; // public web key (same as firebase-config.js)
const AUTH = process.env.AUTH_BASE || 'https://identitytoolkit.googleapis.com';
const FS = process.env.FS_BASE || 'https://firestore.googleapis.com';
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

let SA = null, tok = null;
function account() {
  if (SA) return SA;
  try { SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || ''); } catch { return null; }
  return SA?.project_id && SA.client_email && SA.private_key ? SA : null;
}
const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
async function token() {
  if (process.env.ADMIN_TOKEN) return process.env.ADMIN_TOKEN; // emulator tests only
  if (tok && tok.exp > Date.now() + 60000) return tok.value;
  const sa = account(), now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const jwt = head + '.' + crypto.sign('RSA-SHA256', Buffer.from(head), sa.private_key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
  const d = await r.json(); if (!r.ok) throw new Error('token');
  tok = { value: d.access_token, exp: Date.now() + d.expires_in * 1000 };
  return tok.value;
}
const project = () => account()?.project_id || process.env.GCLOUD_PROJECT;
async function gapi(method, url, body) {
  const r = await fetch(url, { method, headers: { authorization: 'Bearer ' + await token(), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { ok: r.ok, status: r.status, d: await r.json().catch(() => ({})) };
}
async function whoIs(idToken) {
  if (!idToken) return null;
  const r = await fetch(`${AUTH}/v1/accounts:lookup?key=${WEB_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken }) });
  if (!r.ok) return null;
  const u = (await r.json()).users?.[0];
  return u ? { uid: u.localId } : null;
}

export default async req => {
  if (req.method !== 'POST') return json(405, { error: 'method' });
  if (!account() && !process.env.ADMIN_TOKEN) return json(503, { error: 'not configured' });
  try {
    const caller = await whoIs((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
    if (!caller) return json(401, { error: 'login' });
    const isAdmin = await gapi('GET', `${FS}/v1/projects/${project()}/databases/(default)/documents/admins/${caller.uid}`);
    if (!isAdmin.ok) return json(403, { error: 'admins only' });
    const body = await req.json().catch(() => ({}));
    const uid = String(body.uid || '');
    if (!/^[A-Za-z0-9_-]{6,128}$/.test(uid)) return json(400, { error: 'uid' });
    if (uid === caller.uid) return json(400, { error: 'you cannot delete your own admin login here' });
    const r = await gapi('POST', `${AUTH}/v1/projects/${project()}/accounts:delete`, { localId: uid });
    if (!r.ok && !/USER_NOT_FOUND/.test(r.d?.error?.message || '')) return json(502, { error: r.d?.error?.message || 'delete failed' });
    return json(200, { deleted: true });
  } catch { return json(500, { error: 'server' }); }
};
export const config = { path: '/api/delete-user' };
