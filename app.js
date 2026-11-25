/* ===========================================================
   Trip To Venda: web app + installable PWA (v5)
   All data lives in the browser (localStorage) so every flow
   works without a server. See README for going live.
   =========================================================== */
'use strict';
const EMBED = (() => { try { return window.self !== window.top; } catch { return true; } })(); // running inside a preview frame
const DEMO = false;        // staff only test panel (account switcher + guided tour). Keep false in production.
const TEST_MODE = !window.Cloud?.on; // local preview only. With Firebase connected: no on screen codes, no replay controls.    // true until the SMS, ID check and payment providers are connected: codes are shown on screen and no money moves.
const SAMPLE_DATA = false; // live: only real sign ups, real trips and real numbers  // true = start with sample drivers/trips so the app can be reviewed. Set false at launch: only real sign ups appear.
const SPLASH_MS = 4000;    // branded loading screen length
const store = (() => { let ok = true, mem = {}; try { localStorage.setItem('ttv_t', '1'); localStorage.removeItem('ttv_t'); } catch { ok = false; }
  return { ok, get: k => { try { return ok ? localStorage.getItem(k) : (mem[k] ?? null); } catch { return mem[k] ?? null; } },
    set: (k, v) => { try { if (ok) localStorage.setItem(k, v); else mem[k] = v; return true; } catch { return false; } },
    del: k => { try { ok ? localStorage.removeItem(k) : delete mem[k]; } catch {} } }; })();

/* ---------------- Places (with GPS coordinates) ---------------- */
const niceD = d => d ? new Date(d + 'T00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : 'not given';
const VENDA = 'Venda (Limpopo)';
const PLACES = {
  [VENDA]: { 'Thohoyandou':[-22.948,30.484],'Sibasa':[-22.938,30.468],'Makwarela':[-22.928,30.452],'Shayandima':[-22.990,30.420],'Tshakhuma':[-23.020,30.310],'Makhado (Louis Trichardt)':[-23.044,29.904],'Musina':[-22.352,30.041],'Malamulele':[-23.003,30.700],'Mutale':[-22.620,30.670],'Vuwani':[-23.150,30.420],'Elim':[-23.150,30.060],'Siloam':[-22.900,30.200],'Dzanani':[-22.880,30.070],'Mbilwi':[-22.940,30.500],'Lwamondo':[-23.040,30.390],'Nzhelele':[-22.820,30.100],'Tshitereke':[-22.800,30.400] },
  'Gauteng': { 'Johannesburg CBD':[-26.204,28.047],'Pretoria CBD':[-25.747,28.188],'Soweto':[-26.266,27.866],'Sandton':[-26.107,28.057],'Midrand':[-25.989,28.128],'Centurion':[-25.860,28.189],'Tembisa':[-25.996,28.227],'Kempton Park':[-26.100,28.233],'Randburg':[-26.094,28.006],'Roodepoort':[-26.162,27.873],'Germiston':[-26.218,28.167],'Boksburg':[-26.212,28.262],'Benoni':[-26.188,28.320],'Alexandra':[-26.103,28.097],'Diepsloot':[-25.933,28.012],'Mamelodi':[-25.720,28.396],'Soshanguve':[-25.520,28.100],'Atteridgeville':[-25.773,28.073],'Vereeniging':[-26.673,27.926],'Vanderbijlpark':[-26.711,27.837],'OR Tambo Airport':[-26.139,28.246] },
  'Limpopo (other)': { 'Polokwane':[-23.904,29.469],'Tzaneen':[-23.833,30.163],'Mokopane':[-24.194,29.009],'Lephalale':[-23.680,27.700],'Giyani':[-23.302,30.718],'Bela Bela':[-24.885,28.293],'Modimolle':[-24.700,28.405],'Burgersfort':[-24.668,30.326] },
  'Mpumalanga': { 'Mbombela (Nelspruit)':[-25.474,30.970],'eMalahleni (Witbank)':[-25.871,29.233],'Middelburg':[-25.775,29.464],'Secunda':[-26.516,29.170],'Bushbuckridge':[-24.840,31.070],'Hazyview':[-25.045,31.130] },
  'North West': { 'Rustenburg':[-25.667,27.242],'Mahikeng':[-25.865,25.644],'Brits':[-25.635,27.780],'Klerksdorp':[-26.852,26.667],'Potchefstroom':[-26.716,27.103] },
  'Free State': { 'Bloemfontein':[-29.085,26.159],'Welkom':[-27.977,26.735],'Bethlehem':[-28.230,28.307],'Kroonstad':[-27.650,27.234],'Sasolburg':[-26.814,27.817] },
  'KwaZulu Natal': { 'Durban':[-29.858,31.022],'Pietermaritzburg':[-29.601,30.379],'Richards Bay':[-28.783,32.038],'Newcastle':[-27.758,29.932],'Ladysmith':[-28.558,29.781] },
  'Eastern Cape': { 'Gqeberha':[-33.961,25.602],'East London':[-33.015,27.912],'Mthatha':[-31.588,28.784],'Komani':[-31.898,26.875] },
  'Western Cape': { 'Cape Town':[-33.925,18.424],'Stellenbosch':[-33.932,18.861],'Paarl':[-33.734,18.962],'George':[-33.963,22.462],'Bellville':[-33.900,18.630] },
  'Northern Cape': { 'Kimberley':[-28.738,24.763],'Upington':[-28.448,21.256] }
};
const PROVS = Object.keys(PLACES);
const towns = p => Object.keys(PLACES[p] || {});
const coord = (p, t) => PLACES[p]?.[t] || Object.values(PLACES[p] || PLACES[VENDA])[0];
const EMERGENCY = [['SAPS Police', '10111'], ['Emergency (any cellphone)', '112'], ['Ambulance & fire', '10177']];

/* ---------------- Platform fees (see business model document) ---------------- */
const FEES = { seat: 15, parcel: 10, commission: 0.10, parcelCommission: 0.15, pro: 0.05, proMonthly: 199 };
function feesOf(fare, type, seats, pro) {
  const riderFee = type === 'parcel' ? FEES.parcel : FEES.seat * Math.max(1, seats);
  const rate = type === 'parcel' ? FEES.parcelCommission : pro ? FEES.pro : FEES.commission;
  const commission = Math.round(fare * rate);
  return { fare, riderFee, total: fare + riderFee, commission, driverNet: fare - commission, rate };
}

/* ---------------- Identity, licence & number plate checks ---------------- */
function luhnDigit(s12) { let sum = 0; for (let i = 0; i < 12; i++) { let d = +s12[11 - i]; if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; } sum += d; } return (10 - sum % 10) % 10; }
function checkSAID(raw) {
  const id = String(raw || '').replace(/\s/g, '');
  if (!/^\d{13}$/.test(id)) return { ok: false, msg: 'An SA ID number has 13 digits' };
  const yy = +id.slice(0, 2), mm = +id.slice(2, 4), dd = +id.slice(4, 6), now = new Date();
  let yr = 2000 + yy; if (yr > now.getFullYear()) yr -= 100;
  const dob = new Date(yr, mm - 1, dd);
  if (dob.getMonth() !== mm - 1 || dob.getDate() !== dd) return { ok: false, msg: 'The date of birth inside this ID number is not valid' };
  if (luhnDigit(id.slice(0, 12)) !== +id[12]) return { ok: false, msg: 'ID check digit is wrong, please check for typos' };
  const age = Math.floor((now - dob) / 31557600000);
  return { ok: true, age, dob: iso(dob), gender: +id.slice(6, 10) >= 5000 ? 'Male' : 'Female', citizen: id[10] === '0' ? 'SA citizen' : 'Permanent resident' };
}
const plateOK = p => { p = String(p || '').toUpperCase().trim(); return /^[A-Z0-9][A-Z0-9 \-]{2,11}$/.test(p) && /[A-Z]/.test(p) && /\d/.test(p); };
const licenceOK = n => /^[A-Z0-9]{8,14}$/i.test(String(n || '').replace(/\s/g, ''));
const future = d => !!d && d > today();
function makeID(dob, male, rnd) { const g = String(male ? 5000 + Math.floor(rnd() * 4999) : Math.floor(rnd() * 4999)).padStart(4, '0'); const b = dob.slice(2, 4) + dob.slice(5, 7) + dob.slice(8, 10) + g + '08'; return b + luhnDigit(b); }
function rng(seed) { let x = seed >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }

/* ---------------- Icons (Lucide style, MIT) ---------------- */
const ICONS = {
  home:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  car:'<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  user:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  pin:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  bag:'<path d="M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2"/><path d="M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14M10 20h4"/><circle cx="16" cy="20" r="2"/><circle cx="8" cy="20" r="2"/>',
  pkg:'<path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  star:'<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  msg:'<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/>',
  lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  eye:'<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:'<path d="M3 3l18 18"/><path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.8-1.3"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  flip:'<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><path d="M3 21v-5h5"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  check:'<path d="M20 6 9 17l-5-5"/>', x:'<path d="M18 6 6 18M6 6l12 12"/>',
  right:'<path d="m9 18 6-6-6-6"/>', left:'<path d="m15 18-6-6 6-6"/>', plus:'<path d="M12 5v14M5 12h14"/>',
  wallet:'<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  nav:'<polygon points="3 11 22 2 13 21 11 13 3 11"/>', swap:'<path d="m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16"/>',
  id:'<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 10h4M14 14h4M5.5 16a3 3 0 0 1 5 0"/>',
  route:'<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  venus:'<circle cx="12" cy="9" r="6"/><path d="M12 15v7M9 19h6"/>', info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  ticket:'<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  door:'<path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14M2 20h20M14 12v.01"/>',
  bolt:'<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>', sliders:'<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  send:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>', eye:'<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'
};
const F = {}; // form handlers, filled in below
const ic = (n, c = '') => `<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------------- Helpers ---------------- */
const $ = s => document.querySelector(s);
const rndInt = n => crypto.getRandomValues(new Uint32Array(1))[0] % n;
const uid = p => p + [...crypto.getRandomValues(new Uint8Array(10))].map(x => (x % 36).toString(36)).join('');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const R = n => { const v = Math.round(Number(n || 0)); return v < 0 ? 'R' + Math.abs(v).toLocaleString('en-ZA') + ' owed' : 'R' + v.toLocaleString('en-ZA'); };
const iso = d => { const x = new Date(d); x.setMinutes(x.getMinutes() - x.getTimezoneOffset()); return x.toISOString().slice(0, 10); };
const today = () => iso(new Date());
const addDays = n => { const x = new Date(); x.setDate(x.getDate() + n); return iso(x); };
const fmtDate = d => new Date(d + 'T00:00').toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric', month: 'short' });
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + ' h ago' : Math.round(m / 1440) + ' d ago'; };
const first = n => (n || '').split(' ')[0];
const short = s => String(s || '').replace(/ \(.+\)/, '');
const initials = n => (n || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
const waNum = p => { let d = String(p || '').replace(/\D/g, ''); if (d.startsWith('0')) d = '27' + d.slice(1); return d; };
const isSAphone = p => /^(\+27|0)[6-8]\d{8}$/.test(String(p).replace(/\s/g, ''));
const hashStr = s => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const GRADS = [['#0f5c3a','#21a366'],['#7c3aed','#c084fc'],['#c2410c','#fb923c'],['#0e7490','#22d3ee'],['#be185d','#f472b6'],['#1d4ed8','#60a5fa'],['#a16207','#facc15'],['#334155','#94a3b8']];
const fmtDur = m => { m = Math.round(m); const h = Math.floor(m / 60); return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m} min`; };
const addTime = (hhmm, mins) => { const [h, m] = hhmm.split(':').map(Number); const t = ((h * 60 + m + Math.round(mins)) % 1440 + 1440) % 1440; return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };

async function hash(s) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ttv:' + s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch { let h = 5381; for (const c of 'ttv:' + s) h = (h * 33) ^ c.charCodeAt(0); return 'f' + (h >>> 0).toString(16); }
}
/* ---------------- photos: camera, gallery, quality ---------------- */
const PHOTOS = {};            // field name -> processed photo (data URL), survives re-renders
let photoRoute = '';
function canvasJpeg(src, max, q = .74) {
  const w0 = src.videoWidth || src.width, h0 = src.videoHeight || src.height, k = Math.min(1, max / Math.max(w0, h0));
  const c = document.createElement('canvas'); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
  return { canvas: c, url: c.toDataURL('image/jpeg', q) };
}
async function decodeImg(file) {
  if (!file) return null;
  if (file.size > 30 * 1024 * 1024) throw new Error('big');
  if (file.type && !file.type.startsWith('image/')) throw new Error('type');
  if (window.createImageBitmap) { try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { } }
  return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('decode')); }; im.src = u; });
}
async function readImg(file, max = 1000) {
  if (!file) return null;
  const im = await decodeImg(file);
  const out = canvasJpeg(im, max).url; im.close?.(); return out;
}
const photoErr = e => ({ big: 'That photo is too big (over 30 MB). Take a new one.', type: "That file isn't a photo." }[e?.message] || "This photo type can't be opened here (e.g. HEIC). Take a new photo, or choose a JPG or PNG.");
/* quick checks on the phone: too dark, too bright, glare, blur */
function photoQuality(img, kind) {
  const w = 200, h0 = img.videoHeight || img.height, w0 = img.videoWidth || img.width, h = Math.max(1, Math.round(h0 * w / w0));
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data, L = new Float32Array(w * h); let sum = 0, hot = 0;
  for (let i = 0, j = 0; i < d.length; i += 4, j++) { const l = .299 * d[i] + .587 * d[i + 1] + .114 * d[i + 2]; L[j] = l; sum += l; if (l > 248) hot++; }
  const mean = sum / (w * h); let lap = 0, n = 0;
  for (let y = 1; y < h - 1; y++) for (let xx = 1; xx < w - 1; xx++) { const i = y * w + xx, v = 4 * L[i] - L[i - 1] - L[i + 1] - L[i - w] - L[i + w]; lap += v * v; n++; }
  const sharp = lap / Math.max(1, n), issues = [];
  if (mean < 45) issues.push('Too dark: move to better light or switch on the flash');
  else if (mean > 225) issues.push('Too bright: move out of direct sun');
  if (kind === 'card' && hot / (w * h) > .05) issues.push('Glare on the card: tilt it away from the light');
  if (sharp < (kind === 'card' ? 250 : 60)) issues.push(kind === 'card' ? 'Blurry: hold still, the text must be readable' : 'A bit blurry: hold still and try again');
  return { ok: !issues.length, issues, mean: Math.round(mean), sharp: Math.round(sharp) };
}
const photoKind = name => name === 'selfie' ? 'face' : ['idPhoto', 'licence', 'prdp', 'disc'].includes(name) ? 'card' : 'free';
const photoMax = name => photoKind(name) === 'card' ? 1100 : name === 'selfie' ? 800 : 1000;
function setPhoto(name, url, q) {
  PHOTOS[name] = url;
  const img = $('#p_' + name); if (img) { img.src = url; img.classList.remove('hidden'); }
  const box = document.querySelector(`[data-up="${name}"]`);
  if (box) { box.classList.add('done'); box.querySelector('.u-ic').innerHTML = ic('check'); const cb = box.querySelector('[data-act="camOpen"]'); if (cb) cb.innerHTML = `${ic('camera', 'sm')} Retake`; }
  const qm = $('#q_' + name); if (qm) qm.innerHTML = !q ? '' : q.ok ? `<span class="okc">${ic('check', 'sm')} Clear photo</span>` : `<span class="warnc">${ic('alert', 'sm')} ${esc(q.issues[0])}</span>`;
}

/* in-app camera: live preview, guide frame, flash, front/back, retake */
const Cam = { stream: null, name: '', kind: 'free', facing: 'environment', torch: false, shot: null,
  stop() { this.stream?.getTracks().forEach(t => t.stop()); this.stream = null; this.torch = false; } };
const camOK = () => !!(navigator.mediaDevices?.getUserMedia && window.isSecureContext);
const CAM_TIPS = { card: 'Fit all 4 corners inside the frame · no glare · text sharp', face: 'Face inside the oval · good light · no cap or sunglasses', free: 'Show everything clearly in good light' };
function camLayer() { let l = $('#camLayer'); if (!l) { l = document.createElement('div'); l.id = 'camLayer'; l.className = 'cam-layer hidden'; l.setAttribute('role', 'dialog'); l.setAttribute('aria-modal', 'true'); document.body.appendChild(l); } return l; }
function nativeCamera(name, facing) { // fallback: the phone's own camera app
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.setAttribute('capture', facing === 'user' ? 'user' : 'environment');
  inp.onchange = () => usePhotoFile(name, inp.files[0]); inp.click();
}
async function usePhotoFile(name, file) {
  if (!file) return;
  const tile = document.querySelector(`[data-up="${name}"]`); tile?.classList.add('busy');
  try { const im = await decodeImg(file); const q = photoQuality(im, photoKind(name)); const url = canvasJpeg(im, photoMax(name)).url; im.close?.(); setPhoto(name, url, q); if (!q.ok) toast(q.issues[0], 'err'); }
  catch (e) { toast(photoErr(e), 'err'); }
  finally { tile?.classList.remove('busy'); }
}
function camOpen(name, title) {
  Cam.name = name; Cam.kind = photoKind(name); Cam.facing = Cam.kind === 'face' ? 'user' : 'environment';
  if (!camOK()) return nativeCamera(name, Cam.facing);
  const l = camLayer();
  l.innerHTML = `<div class="cam-top"><b>${esc(title)}</b><button class="cam-x" data-act="camClose" aria-label="Close camera">${ic('close')}</button></div>
    <div class="cam-view"><video id="camVideo" class="hidden" playsinline muted autoplay></video><canvas id="camShot" class="hidden"></canvas>
      <div class="cam-guide g-${Cam.kind}"><span></span></div><div class="cam-msg" id="camMsg">Starting camera…</div></div>
    <div class="cam-tip" id="camTip">${CAM_TIPS[Cam.kind]}</div>
    <div class="cam-bar" id="camBar"><button class="cam-sm hidden" id="camTorch" data-act="camTorch" aria-label="Flash">${ic('bolt')}</button><button class="cam-shut" id="camShut" data-act="camShoot" aria-label="Take photo" disabled></button><button class="cam-sm hidden" id="camFlip" data-act="camFlip" aria-label="Switch camera">${ic('flip')}</button></div>
    <div class="cam-bar hidden" id="camAfter"><button class="btn btn-ghost-light" data-act="camRetake">${ic('camera', 'sm')} Retake</button><button class="btn btn-accent" data-act="camUse">${ic('check', 'sm')} Use photo</button></div>`;
  l.classList.remove('hidden'); document.body.classList.add('cam-open');
  camStart();
}
async function camStart() {
  Cam.stop(); Cam.shot = null;
  const v = $('#camVideo'), msg = $('#camMsg'); if (!v) return;
  document.querySelector('.cam-guide')?.classList.remove('hidden');
  $('#camShot').classList.add('hidden'); v.classList.add('hidden'); msg.textContent = 'Starting camera…'; $('#camShut').disabled = true; $('#camBar').classList.remove('hidden'); $('#camAfter').classList.add('hidden'); $('#camTip').textContent = CAM_TIPS[Cam.kind];
  const big = Cam.kind !== 'face';
  try {
    Cam.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: Cam.facing }, width: { ideal: big ? 2560 : 1280 }, height: { ideal: big ? 1440 : 720 } } });
  } catch (e) {
    const m = { NotAllowedError: 'Camera blocked. Allow the camera for this site (tap the lock or ⓘ next to the address), or use your phone camera below.', NotFoundError: 'No camera found on this device.', NotReadableError: 'The camera is busy in another app. Close it and try again.', OverconstrainedError: 'This camera mode is not available.', SecurityError: 'Camera needs a secure (https) page.', NotSupportedError: "This browser can't open the camera inside the page.", AbortError: 'The camera stopped. Try again.' }[e.name] || 'Could not start the camera.';
    document.querySelector('.cam-guide')?.classList.add('hidden');
    msg.innerHTML = `${esc(m)}<div class="btns" style="justify-content:center;margin-top:12px"><button class="btn btn-accent btn-sm" data-act="camNative">${ic('camera', 'sm')} Use phone camera</button><button class="btn btn-ghost-light btn-sm" data-act="camGallery">${ic('image', 'sm')} Choose a photo</button></div>`;
    return;
  }
  if (!document.body.classList.contains('cam-open')) return Cam.stop(); // closed while starting
  v.srcObject = Cam.stream; v.classList.toggle('mirror', Cam.facing === 'user');
  try { await v.play(); } catch { }
  await new Promise(r => v.videoWidth ? r() : (v.onloadedmetadata = r));
  msg.textContent = ''; v.classList.remove('hidden'); $('#camShut').disabled = false;
  const track = Cam.stream.getVideoTracks()[0], caps = track.getCapabilities?.() || {};
  $('#camTorch').classList.toggle('hidden', !caps.torch);
  try { const cams = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); $('#camFlip').classList.toggle('hidden', cams.length < 2); } catch { }
  if (caps.focusMode?.includes?.('continuous')) track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => { });
}
function camShoot() {
  const v = $('#camVideo'); if (!v?.videoWidth) return;
  const vw = v.videoWidth, vh = v.videoHeight; let sx = 0, sy = 0, sw = vw, sh = vh;
  if (Cam.kind !== 'free') { // crop to the guide frame (+ a little margin), matching what is on screen (object-fit: cover)
    const r = v.getBoundingClientRect(), g = document.querySelector('.cam-guide span').getBoundingClientRect(), s = Math.max(r.width / vw, r.height / vh);
    const ox = (r.width - vw * s) / 2, oy = (r.height - vh * s) / 2, m = Cam.kind === 'card' ? .07 : .12;
    let gx = g.left - r.left, gy = g.top - r.top, gw = g.width, gh = g.height;
    gx -= gw * m; gy -= gh * m; gw *= 1 + 2 * m; gh *= 1 + 2 * m;
    sx = Math.max(0, (gx - ox) / s); sy = Math.max(0, (gy - oy) / s); sw = Math.min(vw - sx, gw / s); sh = Math.min(vh - sy, gh / s);
    if (Cam.facing === 'user') sx = vw - sx - sw; // preview is mirrored
  }
  const c = $('#camShot'); c.width = Math.round(sw); c.height = Math.round(sh);
  c.getContext('2d').drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
  Cam.stop();
  const q = photoQuality(c, Cam.kind); Cam.shot = { url: canvasJpeg(c, photoMax(Cam.name)).url, q };
  v.classList.add('hidden'); c.classList.remove('hidden');
  $('#camBar').classList.add('hidden'); $('#camAfter').classList.remove('hidden');
  $('#camTip').innerHTML = q.ok ? `<span class="okc">${ic('check', 'sm')} Looks good. Check the details are readable, then use it.</span>` : `<span class="warnc">${ic('alert', 'sm')} ${esc(q.issues.join(' · '))}</span>`;
}
function camClose() { Cam.stop(); const l = $('#camLayer'); if (l) { l.classList.add('hidden'); l.innerHTML = ''; } document.body.classList.remove('cam-open'); }
const CAM_ACTIONS = {
  camOpen: el => camOpen(el.dataset.name, el.dataset.title || 'Take a photo'),
  camClose, camShoot, camRetake: () => camStart(),
  camUse: () => { if (Cam.shot) setPhoto(Cam.name, Cam.shot.url, Cam.shot.q); camClose(); },
  camFlip: () => { Cam.facing = Cam.facing === 'user' ? 'environment' : 'user'; camStart(); },
  camTorch: async () => { const t = Cam.stream?.getVideoTracks()[0]; if (!t) return; Cam.torch = !Cam.torch; try { await t.applyConstraints({ advanced: [{ torch: Cam.torch }] }); $('#camTorch').classList.toggle('on', Cam.torch); } catch { toast('Flash not available on this camera', 'err'); } },
  camNative: () => { const n = Cam.name, f = Cam.facing; camClose(); nativeCamera(n, f); },
  camGallery: () => { const n = Cam.name; camClose(); document.querySelector(`[data-up="${n}"] input[type=file]`)?.click(); },
  pwToggle: el => { const i = el.parentElement.querySelector('input'); const show = i.type === 'password'; i.type = show ? 'text' : 'password'; el.innerHTML = ic(show ? 'eyeOff' : 'eye'); el.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); el.setAttribute('aria-pressed', show); i.focus({ preventScroll: true }); }
};
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.classList.contains('cam-open')) camClose(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && Cam.stream) Cam.stop(); else if (!document.hidden && document.body.classList.contains('cam-open') && !Cam.shot) camStart(); });
const pwField = (attrs) => `<div class="pw-wrap"><input type="password" ${attrs}><button type="button" class="pw-eye" data-act="pwToggle" aria-label="Show password" aria-pressed="false">${ic('eye')}</button></div>`;

function toast(msg, type = '') { const t = $('#toast'); t.innerHTML = ic(type === 'err' ? 'alert' : 'check') + `<span>${esc(msg)}</span>`; t.className = 'toast show ' + type; clearTimeout(t._h); t._h = setTimeout(() => t.className = 'toast', 3400); }
function modal(html) { $('#sheet').innerHTML = html; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); $('#sheet').innerHTML = ''; }
const sheetHead = (title, sub = '') => `<div class="sheet-head"><div><h3>${title}</h3>${sub ? `<div class="small muted">${sub}</div>` : ''}</div><button class="x" data-act="close" aria-label="Close">${ic('x')}</button></div>`;

/* ---------------- Distances & real road routes ---------------- */
function haversine(a, b) { const r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLng = (b[1] - a[1]) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLng / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); }
const RKEY = 'ttv_routes_v1';
let routeCache = {}; try { routeCache = JSON.parse(store.get(RKEY)) || {}; } catch {}
const rkey = (a, b) => a.join(',') + '|' + b.join(',');
function estimate(a, b) { const km = haversine(a, b) * 1.28; return { km, min: km / 88 * 60 + Math.floor(km / 220) * 15, line: [a, b], est: true }; }
const BUNDLED = window.TTV_ROUTES || {};
function cached(a, b) {
  const f = BUNDLED[rkey(a, b)] || routeCache[rkey(a, b)]; if (f) return f;
  const r = BUNDLED[rkey(b, a)] || routeCache[rkey(b, a)]; return r ? { ...r, line: r.line.slice().reverse() } : null;
}
const routeSync = (a, b) => cached(a, b) || estimate(a, b);
async function getRoute(a, b) {
  const k = rkey(a, b), c = cached(a, b); if (c) return c;
  try {
    const ctl = new AbortController(); setTimeout(() => ctl.abort(), 7000);
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=simplified&geometries=geojson`, { signal: ctl.signal });
    const rt = (await r.json()).routes[0];
    const out = { km: rt.distance / 1000, min: rt.duration / 60 * 1.12 + Math.floor(rt.distance / 220000) * 15, line: rt.geometry.coordinates.map(c => [c[1], c[0]]) };
    routeCache[k] = out; store.set(RKEY, JSON.stringify(routeCache));
    return out;
  } catch { return estimate(a, b); }
}
const tripA = t => coord(t.fromProv, t.fromTown), tripB = t => coord(t.toProv, t.toTown);
const tripRoute = t => routeSync(tripA(t), tripB(t));
const arrival = t => t.arrive || addTime(t.time, tripRoute(t).min);
const suggestPrice = km => Math.max(60, Math.round(km * .78 / 10) * 10);

/* ---------------- Database ---------------- */
const DB_KEY = 'ttv_db_v7'; // v7 = fresh start, no sample data
/* Vehicles allowed on Trip To Venda */
/* Card / Instant EFT payments need a payment provider (e.g. PayFast). Until one is connected, live trips are cash only. */
const PAY_ONLINE = !window.Cloud?.on || !!window.Cloud?.cfg?.onlinePayments;
/* ---------------- Rules & policies ---------------- */
const POLICY_V = '1.0 · 25 November 2026';
// pickups and drop offs are door to door: never at taxi ranks, bus terminals or taxi stops
const RANK_RE = /\b(taxi\s*rank|rank|taxi\s*stop|taxi\s*stand|bus\s*terminus|bus\s*terminal|terminus|park\s*station|bosman\s*station)\b/i;
const rankMsg = 'Trip To Venda is door to door. Use a home, work or business address, not a taxi rank, taxi stop or bus terminal.';
const VTYPES = { car: { label: 'Private car', max: 4, eg: 'e.g. Toyota Corolla, VW Polo', hint: 'Sedan or hatchback, up to 4 passengers' }, seven: { label: '7 seater', max: 6, eg: 'e.g. Toyota Avanza, Suzuki Ertiga, Toyota Innova', hint: '7 seats including the driver, up to 6 passengers' } };
const vType = v => VTYPES[v?.type] ? v.type : ((v?.seats || 4) > 4 ? 'seven' : 'car');
const vLabel = v => VTYPES[vType(v)].label;
let db, me = null;
function save() { if (window.Cloud?.on) return Cloud.save(); if (!store.set(DB_KEY, JSON.stringify(db))) toast('Phone storage is full, try smaller photos', 'err'); }
async function load() {
  try { db = JSON.parse(store.get(DB_KEY)); } catch { db = null; }
  if (!db) { db = await seed(); save(); }
  me = db.users.find(u => u.id === store.get('ttv_session')) || null;
}
const user = id => db.users.find(u => u.id === id);
const tripById = id => db.trips.find(t => t.id === id);
const bookingById = id => db.bookings.find(b => b.id === id);
const ACTIVE = ['requested', 'confirmed', 'picked'];
const seatsTaken = t => Math.max(t.taken || 0, db.bookings.filter(b => b.tripId === t.id && ACTIVE.includes(b.status) && b.type === 'seat').reduce((a, b) => a + b.seats, 0));
const seatsLeft = t => t.seats - seatsTaken(t);
function rating(uid) { const r = db.reviews.filter(x => x.to === uid); return r.length ? { avg: (r.reduce((a, b) => a + b.stars, 0) / r.length).toFixed(1), n: r.length } : null; }
const tripsDone = uid => { const u = user(uid), done = db.bookings.filter(b => b.status === 'completed'); return (u?.pastTrips || 0) + (u?.role === 'driver' ? new Set(done.filter(b => tripById(b.tripId)?.driverId === uid).map(b => b.tripId)).size : done.filter(b => b.riderId === uid).length); };
function notify(to, text, link = '#/dashboard') { db.notes.push({ id: uid('n'), to, from: me?.id || null, text, link, at: Date.now(), read: false }); }
const notifyAdmins = (text, link = '#/admin') => window.Cloud?.on ? notify('admins', text, link) : db.users.filter(u => u.role === 'admin').forEach(a => notify(a.id, text, link));
const myNote = n => n.to === me?.id || (me?.role === 'admin' && n.to === 'admins');

function sampleDocs(driver) {
  const card = (title, c1, c2, extra = '') => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="320" height="200" rx="14" fill="url(#g)"/><rect x="18" y="46" width="70" height="88" rx="8" fill="#fff" opacity=".55"/><circle cx="53" cy="78" r="16" fill="#fff" opacity=".8"/><rect x="34" y="100" width="38" height="22" rx="10" fill="#fff" opacity=".8"/><text x="18" y="30" font-family="Arial" font-size="16" font-weight="700" fill="#fff">${title}</text>${[0, 1, 2, 3].map(i => `<rect x="104" y="${54 + i * 20}" width="${170 - i * 22}" height="9" rx="4" fill="#fff" opacity=".6"/>`).join('')}${extra}<text x="160" y="186" text-anchor="middle" font-family="Arial" font-size="13" font-weight="700" fill="#fff" opacity=".9">SAMPLE · NOT A REAL DOCUMENT</text></svg>`);
  const selfie = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#d9e4dd"/><circle cx="100" cy="80" r="38" fill="#8a9a90"/><rect x="45" y="128" width="110" height="80" rx="40" fill="#8a9a90"/><text x="100" y="190" text-anchor="middle" font-family="Arial" font-size="13" font-weight="700" fill="#3c4a42">SAMPLE SELFIE</text></svg>');
  const d = { idPhoto: card('SA ID CARD', '#3f7f63', '#1f5b44'), selfie };
  if (driver) Object.assign(d, { licence: card("DRIVER'S LICENCE", '#d97d2b', '#b25a14'), prdp: card('PrDP · CATEGORY P', '#4b6cb7', '#2c4a8a'), disc: card('LICENCE DISC', '#2f8f4e', '#1b6a35', '<circle cx="250" cy="40" r="22" fill="#fff" opacity=".6"/>'), carPhoto: card('CAR + NUMBER PLATE', '#5c6670', '#343b42', '<rect x="200" y="140" width="96" height="24" rx="4" fill="#ffd34d"/>') });
  return d;
}
async function seed() {
  if (!SAMPLE_DATA) return { users: [], trips: [], bookings: [], messages: [], reviews: [], notes: [], requests: [], alerts: [], seededAt: Date.now(), tour: {} };
  const pw = await hash('demo1234'), rnd = rng(20261113), pick = a => a[Math.floor(rnd() * a.length)];
  const base = (id, role, name, gender, phone, dob, extra = {}) => ({ id, role, name, gender, phone, email: id + '@demo.co.za', pw, status: 'verified', phoneVerified: true, emergencyName: 'Family', emergencyPhone: '0820000000', docs: {}, created: Date.now() - (role === 'driver' ? 420 : 160 + Math.floor(rnd() * 200)) * 864e5, idType: 'SA ID', idNumber: makeID(dob, gender === 'Male', rnd), ...extra });
  const D = (id, name, gender, phone, dob, car, extra = {}) => base(id, 'driver', name, gender, phone, dob, { licenceNo: String(Math.floor(rnd() * 1e10)).padStart(10, '0') + 'BX', licenceCode: car.seats > 8 ? 'C1' : 'B', licenceExpiry: addDays(300 + Math.floor(rnd() * 900)), prdpNo: 'PRDP' + String(Math.floor(rnd() * 1e7)).padStart(7, '0'), prdpExpiry: addDays(150 + Math.floor(rnd() * 600)), vehicle: { ...car, discExpiry: addDays(40 + Math.floor(rnd() * 300)) }, acceptsCash: true, wallet: { balance: 0, ledger: [] }, ...extra });
  const users = [
    { id: 'admin', role: 'admin', name: 'Safety Desk', email: 'admin@triptovenda.co.za', pw: await hash('admin123'), status: 'verified', phoneVerified: true, docs: {} },
    D('drv_tshilidzi', 'Tshilidzi Mudau', 'Male', '0721234567', '1986-04-12', { type: 'seven', make: 'Toyota Innova', colour: 'White', reg: 'HXK 482 L', seats: 6, year: 2019 }, { pastTrips: 170, since: '2023', pro: true, bio: 'Full time long distance driver. Thohoyandou ⇄ Joburg every week since 2019.', langs: 'Tshivenda, English, Sepedi' }),
    D('drv_rendani', 'Rendani Netshitenzhe', 'Female', '0739876543', '1991-09-03', { type: 'car', make: 'Toyota Corolla Cross', colour: 'Silver', reg: 'JTN 115 L', seats: 4, year: 2023 }, { pastTrips: 74, since: '2024', bio: 'Nurse in Pretoria, I drive home twice a month. Ladies only trips available.', langs: 'Tshivenda, English' }),
    D('drv_mpho', 'Mpho Ramabulana', 'Male', '0645551234', '1994-02-20', { type: 'car', make: 'VW Polo Vivo', colour: 'Red', reg: 'DL 72 MP GP', seats: 4, year: 2021 }, { pastTrips: 31, since: '2025', bio: 'Engineer in Midrand. Going home most month ends.', langs: 'Tshivenda, English, isiZulu', acceptsCash: false }),
    D('drv_khathu', 'Khathutshelo Ravele', 'Male', '0827770011', '1979-11-30', { type: 'seven', make: 'Toyota Avanza', colour: 'Grey', reg: 'KRV 908 L', seats: 6, year: 2018 }, { pastTrips: 138, since: '2023', bio: 'Family business. Spacious H1 with a big boot, parcels welcome.', langs: 'Tshivenda, Xitsonga, English' }),
    D('drv_ndivhuwo', 'Ndivhuwo Tshikovhi', 'Female', '0761239876', '1990-06-14', { type: 'seven', make: 'Suzuki Ertiga', colour: 'Blue', reg: 'NDV 220 L', seats: 6, year: 2022 }, { pastTrips: 52, since: '2024', bio: 'Teacher in Soweto. Safe, calm driving. No loud music after 9pm.', langs: 'Tshivenda, English' }),
    D('drv_lufuno', 'Lufuno Munyai', 'Male', '0718884455', '2001-01-08', { type: 'car', make: 'Toyota Corolla Quest', colour: 'Black', reg: 'LFM 777 L', seats: 4, year: 2017 }, { pastTrips: 20, since: '2025', bio: 'Student at UJ. Affordable lifts home.', langs: 'Tshivenda, English' }),
    base('rdr_demo', 'rider', 'Mulalo Nemakonde', 'Female', '0790001111', '2002-03-15', { email: 'rider@demo.co.za', emergencyName: 'Mom', emergencyPhone: '0829990000', homeAddress: 'Block G, Thohoyandou' }),
    ...[['rdr_a', 'Fhatuwani Sikhwari', 'Male', '1998-07-21'], ['rdr_b', 'Ronewa Mashau', 'Female', '2000-12-02'], ['rdr_c', 'Thendo Nemudzivhadi', 'Male', '1996-05-09'], ['rdr_d', 'Azwi Mukhuba', 'Female', '2003-08-30'], ['rdr_e', 'Tshimangadzo Ramavhoya', 'Female', '1993-01-17'], ['rdr_f', 'Livhuwani Nethengwe', 'Male', '1989-10-05'], ['rdr_g', 'Khodani Mudau', 'Female', '2001-04-26'], ['rdr_h', 'Takalani Netshiongolwe', 'Male', '1997-09-11'], ['rdr_i', 'Nyiko Maluleke', 'Female', '1999-02-14'], ['rdr_j', 'Rotondwa Ravhura', 'Female', '2004-06-03'], ['rdr_k', 'Unarine Madzhie', 'Male', '2002-11-19'], ['rdr_l', 'Dakalo Mphaphuli', 'Male', '1995-03-28'], ['rdr_m', 'Vhuhwavho Ndou', 'Female', '1998-12-24']]
      .map(([id, n, g, dob], i) => base(id, 'rider', n, g, '07' + String(90002222 + i * 1111).slice(0, 8), dob)),
    // waiting for the safety team (sample applicants)
    D('drv_new_azwi', 'Azwindini Ramaano', 'Male', '0765550101', '1989-02-17', { type: 'seven', make: 'Toyota Avanza', colour: 'Silver', reg: 'KMN 204 L', seats: 6, year: 2020 }, { status: 'pending', pastTrips: 0, since: '2026', created: Date.now() - 5 * 36e5, docs: sampleDocs(true), wallet: { balance: 0, ledger: [] } }),
    D('drv_new_lindiwe', 'Lindiwe Mabasa', 'Female', '0715550202', '1994-11-08', { type: 'car', make: 'VW Polo', colour: 'White', reg: 'FV 33 KT GP', seats: 4, year: 2022 }, { status: 'pending', pastTrips: 0, since: '2026', created: Date.now() - 26 * 36e5, docs: sampleDocs(true), wallet: { balance: 0, ledger: [] } }),
    base('rdr_new_tshepo', 'rider', 'Tshepo Netshiavha', 'Male', '0825550303', '2003-06-30', { status: 'pending', created: Date.now() - 2 * 36e5, docs: sampleDocs(false), homeAddress: 'Tshilidzini, Thohoyandou' }),
    base('rdr_new_mpho', 'rider', 'Mpho Ravele', 'Female', '0605550404', '1999-01-22', { status: 'pending', created: Date.now() - 9 * 36e5, docs: sampleDocs(false), homeAddress: 'Soshanguve Block L' }),
  ];
  const U = id => users.find(u => u.id === id);
  const lines = ['Very punctual, picked me up right at my gate at 4am.', 'Car was clean and we stopped at Polokwane for food. Will book again.', 'Felt safe the whole way. Drives within the speed limit.', "Helped with my heavy bags. Dropped me exactly at my sister's house in Soweto.", 'Good music, good conversation, arrived early!', 'Price was fair and the aircon worked 😄', 'Called the night before to confirm. Very professional.', 'Smooth trip, recommended for students.', "Parcel arrived safely at my mom's place in Sibasa.", 'Bit of a delay leaving but kept us updated in the chat.'];
  const reviews = []; let n = 0;
  users.filter(u => u.role === 'driver').forEach((d, i) => { for (let k = 0; k < 4 + (i % 3); k++) reviews.push({ id: 'rv' + n, from: ['rdr_a', 'rdr_b', 'rdr_c', 'rdr_d', 'rdr_e'][n % 5], to: d.id, stars: (n % 7 === 3) ? 4 : 5, text: lines[n++ % lines.length], at: Date.now() - (k + 1) * 6 * 864e5 }); });
  users.filter(u => u.role === 'rider').forEach((r, i) => reviews.push({ id: 'rr' + i, from: 'drv_tshilidzi', to: r.id, stars: i % 6 === 2 ? 4 : 5, text: 'Ready on time, respectful.', at: Date.now() - 20 * 864e5 }));

  /* --- travel history: ~45 days of completed trips --- */
  const G = 'Gauteng', jit = (c, r = .018) => [+(c[0] + (rnd() - .5) * r).toFixed(5), +(c[1] + (rnd() - .5) * r).toFixed(5)];
  const streets = ['Mphephu St', 'Thavhani Rd', 'Makwarela Rd', 'Block F', 'Block J', 'Mvudi Park', 'Univen Rd', 'Riverside', 'Shayandima Ext 1', 'Sibasa Main Rd'];
  const gstreets = ['Bree St', 'Vilakazi St', 'Commissioner St', 'Rivonia Rd', 'Church St', 'Lilian Ngoyi St', 'Old Pretoria Rd', 'Main Reef Rd', 'Andrew Mapheto Dr'];
  const DR = {
    drv_tshilidzi: [[VENDA, 'Thohoyandou', G, 'Johannesburg CBD', 380], [G, 'Johannesburg CBD', VENDA, 'Thohoyandou', 380], [VENDA, 'Thohoyandou', 'Limpopo (other)', 'Polokwane', 150]],
    drv_rendani: [[VENDA, 'Sibasa', G, 'Pretoria CBD', 420], [G, 'Centurion', VENDA, 'Sibasa', 420]],
    drv_mpho: [[VENDA, 'Thohoyandou', G, 'Midrand', 400], [G, 'Midrand', VENDA, 'Thohoyandou', 400]],
    drv_khathu: [[VENDA, 'Musina', G, 'Pretoria CBD', 450], [G, 'Soweto', VENDA, 'Malamulele', 410], [VENDA, 'Thohoyandou', 'Western Cape', 'Cape Town', 1350]],
    drv_ndivhuwo: [[VENDA, 'Thohoyandou', G, 'Soweto', 390], [G, 'Soweto', VENDA, 'Thohoyandou', 390], [VENDA, 'Makhado (Louis Trichardt)', 'KwaZulu Natal', 'Durban', 780]],
    drv_lufuno: [[VENDA, 'Makhado (Louis Trichardt)', G, 'Johannesburg CBD', 340], [G, 'Randburg', VENDA, 'Makhado (Louis Trichardt)', 340]]
  };
  const riderIds = users.filter(u => u.role === 'rider' && u.id !== 'rdr_demo').map(u => u.id);
  const femaleRiders = users.filter(u => u.role === 'rider' && u.gender === 'Female' && u.id !== 'rdr_demo').map(u => u.id);
  const trips = [], bookings = [], ledger = {}; let hi = 0, bi = 0;
  const mkBooking = (t, riderId, type, seats, status, when, extra = {}) => {
    const d = U(t.driverId), fare = type === 'parcel' ? t.parcelPrice : seats * t.price, f = feesOf(fare, type, seats, d.pro), pay = (d.acceptsCash && rnd() < .55) ? 'cash' : 'online';
    const a = tripA(t), b = tripB(t), inV = t.fromProv === VENDA;
    return { id: 'hb' + (bi++), tripId: t.id, riderId, type, seats: type === 'parcel' ? 0 : seats, pickup: `${Math.floor(rnd() * 900) + 10} ${pick(inV ? streets : gstreets)}, ${t.fromTown}`, dropoff: `${Math.floor(rnd() * 900) + 10} ${pick(inV ? gstreets : streets)}, ${t.toTown}`,
      pickupPin: jit(a), dropPin: jit(b), bags: type === 'parcel' ? 0 : 1 + Math.floor(rnd() * 2), bigBags: rnd() < .2 ? 1 : 0, luggageDesc: type === 'parcel' ? pick(['Groceries box', 'Clothes bag', 'Small fridge', 'School books']) : '', luggagePhoto: null, note: '',
      recvName: type === 'parcel' ? pick(['Mma Nemakonde', 'Vho Mudau', 'Sis Ronewa', 'Baba Ndou']) : '', recvPhone: type === 'parcel' ? '0821234567' : '', ...f, pin: String(Math.floor(1000 + rnd() * 9000)), deliveryCode: type === 'parcel' ? String(Math.floor(100000 + rnd() * 899999)) : '',
      status, pay, payMethod: pay === 'online' ? pick(['Card', 'Instant EFT', 'Capitec Pay']) : 'Cash', payStatus: status === 'completed' ? (pay === 'online' ? 'released' : 'paid-cash') : status === 'cancelled' ? (pay === 'online' ? 'refunded' : 'none') : pay === 'online' ? 'held' : 'due',
      created: when - (1 + Math.floor(rnd() * 5)) * 864e5, ...extra };
  };
  for (const [did, routes] of Object.entries(DR)) {
    const d = U(did); let day = 2 + Math.floor(rnd() * 3), k = 0;
    while (day < 46) {
      const r = routes[k++ % routes.length], date = addDays(-day), time = pick(['04:30', '05:00', '06:00', '13:00', '15:00']);
      const seats = d.vehicle.seats;
      const t = { id: 'h' + (hi++), driverId: did, fromProv: r[0], fromTown: r[1], toProv: r[2], toTown: r[3], date, time, arrive: '', seats, price: r[4], bagFee: 40, parcelPrice: did === 'drv_lufuno' ? 0 : 130, maxBags: 2, pickupArea: '', dropArea: '', womenOnly: did === 'drv_rendani', acceptsCash: d.acceptsCash, rules: ['No smoking', 'Seatbelts on'], notes: '', status: 'open', created: Date.now() - (day + 4) * 864e5 };
      trips.push(t);
      const dd = +date.slice(8, 10), monthEnd = dd >= 24 || dd <= 2;
      let sold = Math.min(seats, Math.max(1, Math.round(seats * (monthEnd ? .75 + rnd() * .25 : .3 + rnd() * .5))));
      const pool = (t.womenOnly ? femaleRiders : riderIds).slice().sort(() => rnd() - .5);
      const start = new Date(date + 'T' + time).getTime(), dur = routeSync(tripA(t), tripB(t)).min * 60000;
      for (const rid of pool) {
        if (sold <= 0) break;
        const s = sold >= 2 && rnd() < .12 ? 2 : 1; sold -= s;
        const cancelled = rnd() < .05;
        bookings.push(mkBooking(t, rid, 'seat', s, cancelled ? 'cancelled' : 'completed', start, cancelled ? {} : { pickedAt: start + rnd() * 3e6, doneAt: start + dur, payout: null }));
      }
      if (t.parcelPrice && rnd() < .45) bookings.push(mkBooking(t, pick(riderIds), 'parcel', 0, 'completed', start, { pickedAt: start, doneAt: start + dur }));
      day += 3 + Math.floor(rnd() * 5);
    }
  }
  bookings.forEach(b => { if (b.status === 'completed' && b.pay === 'online') b.payout = Date.now() - b.doneAt > 7 * 864e5 ? 'paid' : 'pending'; });
  /* driver wallets: cash trips charge commission + booking fee to the wallet; drivers top up */
  users.filter(u => u.role === 'driver').forEach(d => {
    const ch = bookings.filter(b => b.status === 'completed' && b.pay === 'cash' && trips.find(t => t.id === b.tripId).driverId === d.id).sort((a, b) => a.doneAt - b.doneAt);
    let bal = 0; const L = [{ at: Date.now() - 50 * 864e5, text: 'Wallet top up (Instant EFT)', amount: 300 }]; bal = 300;
    ch.forEach(b => { const fee = b.commission + b.riderFee; if (bal - fee < 40) { L.push({ at: b.doneAt - 36e5, text: 'Wallet top up (Instant EFT)', amount: 300 }); bal += 300; } bal -= fee; const t = trips.find(x => x.id === b.tripId); L.push({ at: b.doneAt, text: `Cash trip fee · ${short(t.fromTown)} → ${short(t.toTown)} (${U(b.riderId).name.split(' ')[0]})`, amount: -fee }); });
    if (d.id === 'drv_lufuno') { L.push({ at: Date.now() - 2 * 864e5, text: 'Cash trip fee · adjustment', amount: -(bal + 35) }); bal = -35; }
    d.wallet = { balance: bal, ledger: L };
  });
  /* upcoming trips */
  const T = (driverId, fp, ft, tp, tt, day, time, seats, price, extra = {}) => ({ id: 't' + hashStr(driverId + ft + tt + day).toString(36), driverId, fromProv: fp, fromTown: ft, toProv: tp, toTown: tt, date: addDays(day), time, arrive: '', seats: Math.min(seats, users.find(u => u.id === driverId)?.vehicle?.seats || seats), price, bagFee: 50, parcelPrice: 150, maxBags: 2, pickupArea: '', dropArea: '', womenOnly: false, acceptsCash: U(driverId).acceptsCash, rules: ['No smoking', 'Seatbelts on'], notes: '', status: 'open', created: Date.now() - 864e5, ...extra });
  const up = [
    T('drv_tshilidzi', VENDA, 'Thohoyandou', G, 'Johannesburg CBD', 1, '04:30', 14, 380, { pickupArea: 'Thohoyandou, Sibasa, Shayandima, Mbilwi', dropArea: 'Joburg CBD, Soweto, Alexandra', bagFee: 40, rules: ['No smoking', 'Seatbelts on', 'Stop at Polokwane'] }),
    T('drv_rendani', VENDA, 'Sibasa', G, 'Pretoria CBD', 2, '06:00', 3, 420, { pickupArea: 'Sibasa, Makwarela, Mbilwi', dropArea: 'Pretoria CBD, Centurion, Midrand', womenOnly: true, rules: ['No smoking', 'Aircon', 'Charging ports'], notes: 'Ladies only trip. Comfortable SUV, one stop at Mokopane.' }),
    T('drv_mpho', G, 'Midrand', VENDA, 'Thohoyandou', 3, '15:00', 4, 400, { pickupArea: 'Midrand, Tembisa, Kempton Park', dropArea: 'Thohoyandou & surrounds', parcelPrice: 120 }),
    T('drv_khathu', G, 'Soweto', VENDA, 'Malamulele', 2, '14:00', 8, 410, { pickupArea: 'Soweto, Roodepoort, Joburg CBD', dropArea: 'Malamulele, Thohoyandou, Vuwani', parcelPrice: 100, bagFee: 30, maxBags: 3, rules: ['No smoking', 'Big boot', 'Aircon'], notes: 'Lots of space for luggage and groceries.' }),
    T('drv_ndivhuwo', VENDA, 'Thohoyandou', G, 'Soweto', 4, '05:00', 6, 390, { pickupArea: 'Thohoyandou, Tshakhuma, Lwamondo', dropArea: 'Soweto, Roodepoort, Randburg' }),
    T('drv_tshilidzi', G, 'Johannesburg CBD', VENDA, 'Thohoyandou', 4, '13:00', 14, 380, { pickupArea: 'Joburg CBD, Soweto, Randburg', dropArea: 'Thohoyandou, Sibasa, Tshakhuma', bagFee: 40 }),
    T('drv_lufuno', VENDA, 'Makhado (Louis Trichardt)', G, 'Johannesburg CBD', 5, '07:00', 3, 340, { pickupArea: 'Makhado, Elim, Dzanani', dropArea: 'Auckland Park (UJ), Braamfontein, CBD', parcelPrice: 0 }),
    T('drv_mpho', VENDA, 'Thohoyandou', G, 'Midrand', 6, '13:00', 4, 400, { pickupArea: 'Thohoyandou & Sibasa', dropArea: 'Midrand, Tembisa, Sandton' }),
    T('drv_khathu', VENDA, 'Musina', G, 'Pretoria CBD', 7, '05:30', 8, 450, { pickupArea: 'Musina, Nancefield', dropArea: 'Pretoria, Soshanguve, Mamelodi', parcelPrice: 120 }),
    T('drv_rendani', G, 'Centurion', VENDA, 'Sibasa', 8, '16:00', 3, 420, { pickupArea: 'Centurion, Pretoria CBD', dropArea: 'Sibasa & Makwarela', womenOnly: true }),
    T('drv_tshilidzi', VENDA, 'Thohoyandou', 'Limpopo (other)', 'Polokwane', 2, '07:30', 14, 150, { pickupArea: 'Thohoyandou', dropArea: 'Polokwane CBD, Mall of the North' }),
    T('drv_ndivhuwo', VENDA, 'Makhado (Louis Trichardt)', 'KwaZulu Natal', 'Durban', 9, '04:00', 5, 780, { pickupArea: 'Makhado & Elim', dropArea: 'Durban CBD, Umlazi, Pinetown', rules: ['No smoking', 'Seatbelts on', 'Stops every 2 hours'] }),
    T('drv_lufuno', G, 'Randburg', VENDA, 'Makhado (Louis Trichardt)', 9, '15:30', 3, 340, { parcelPrice: 0 }),
    T('drv_khathu', VENDA, 'Thohoyandou', 'Western Cape', 'Cape Town', 10, '03:00', 6, 1350, { pickupArea: 'Thohoyandou, Sibasa', dropArea: 'Cape Town, Bellville, Khayelitsha', rules: ['Overnight stop in Bloemfontein', 'No smoking'], notes: 'Two day trip with an overnight in Bloemfontein (own cost).' })
  ];
  trips.push(...up);
  const soon = new Date(up[0].date + 'T' + up[0].time).getTime();
  ['rdr_c', 'rdr_f', 'rdr_h'].forEach(r => bookings.push(mkBooking(up[0], r, 'seat', 1, 'confirmed', soon)));
  bookings.push(mkBooking(up[3], 'rdr_k', 'seat', 2, 'confirmed', soon));
  bookings.push(mkBooking(up[3], 'rdr_e', 'parcel', 0, 'confirmed', soon));
  bookings.push(mkBooking(up[1], 'rdr_b', 'seat', 1, 'requested', soon));
  return { users, trips, bookings, messages: [], reviews, notes: [], requests: [{ id: 'q1', riderId: 'rdr_b', fp: VENDA, ft: 'Mutale', tp: 'Gauteng', tt: 'Tembisa', date: addDays(5), seats: 2, at: Date.now() }], alerts: [], seededAt: Date.now(), tour: {} };
}

/* ---------------- UI pieces ---------------- */
function avatar(u, size = '') {
  const g = GRADS[hashStr(u?.name || '?') % GRADS.length];
  return `<div class="av ${size}" style="background:linear-gradient(135deg,${g[0]},${g[1]})">${u?.docs?.selfie ? `<img src="${u.docs.selfie}" alt="">` : initials(u?.name)}${u?.status === 'verified' && u.role !== 'admin' ? `<span class="vb">${ic('check')}</span>` : ''}</div>`;
}
function verifiedBadge(u) {
  if (!u) return '';
  if (u.status === 'verified') return `<span class="badge">${ic('shield')}ID verified</span>`;
  if (u.status === 'pending') return `<span class="badge b-accent">${ic('clock')}Pending check</span>`;
  return `<span class="badge b-danger">${ic('alert')}Not verified</span>`;
}
const rateHTML = id => { const r = rating(id); return r ? `<span class="rate">${ic('star', 'fill')}${r.avg}<span class="muted" style="font-weight:500">&nbsp;(${r.n})</span></span>` : `<span class="badge b-grey">New</span>`; };
const statusBadge = s => ({ requested: `<span class="badge b-accent">${ic('clock')}Awaiting driver</span>`, confirmed: `<span class="badge">${ic('check')}Confirmed</span>`, picked: `<span class="badge b-blue">${ic('nav')}On the road</span>`, completed: `<span class="badge b-dark">${ic('check')}Completed</span>`, declined: `<span class="badge b-grey">Declined</span>`, cancelled: `<span class="badge b-grey">Cancelled</span>` }[s] || s);
const CARCOL = { white: '#f3f4f6', silver: '#c5cbd1', grey: '#8a9199', gray: '#8a9199', black: '#2a2e33', red: '#d23b3b', blue: '#2f62c4', green: '#1f8a54', yellow: '#f2c230', orange: '#ec7a2c', maroon: '#7d2230', gold: '#c9a54a', brown: '#7a5034', beige: '#d9c7a3' };
function carSVG(v = {}, style = '') {
  const c = CARCOL[(v.colour || '').toLowerCase().split(' ')[0]] || '#9aa3ab', van = vType(v) === 'seven';
  const body = van
    ? `<path d="M14 70 V36 Q14 22 30 20 L150 18 Q170 18 182 34 L196 52 Q206 54 206 64 V70 Z" fill="${c}" stroke="#1b2620" stroke-width="2.5"/><path d="M30 28 H62 V48 H24 V36 Q24 29 30 28Z M70 28 H104 V48 H70Z M112 28 H146 V48 H112Z" fill="#cfe3f0" stroke="#1b2620" stroke-width="2"/><path d="M154 28 Q166 28 174 40 L180 48 H154Z" fill="#cfe3f0" stroke="#1b2620" stroke-width="2"/>`
    : `<path d="M10 70 V56 Q10 46 22 45 L52 42 L76 24 Q82 20 92 20 H138 Q148 20 156 28 L174 44 Q200 46 204 56 V70 Z" fill="${c}" stroke="#1b2620" stroke-width="2.5"/><path d="M60 43 L80 28 Q84 26 90 26 H112 V43Z M118 26 H136 Q144 26 150 32 L162 43 H118Z" fill="#cfe3f0" stroke="#1b2620" stroke-width="2"/>`;
  return `<svg class="carpic" style="${style}" viewBox="0 0 216 92" aria-label="${esc(v.colour)} ${esc(v.make)}"><ellipse cx="108" cy="84" rx="96" ry="5" fill="rgba(0,0,0,.12)"/>${body}<rect x="190" y="56" width="12" height="6" rx="2" fill="#ffd36b"/><rect x="12" y="56" width="8" height="6" rx="2" fill="#e5484d"/><circle cx="52" cy="72" r="13" fill="#1b2620"/><circle cx="52" cy="72" r="5.5" fill="#c5cbd1"/><circle cx="164" cy="72" r="13" fill="#1b2620"/><circle cx="164" cy="72" r="5.5" fill="#c5cbd1"/></svg>`;
}
const selectOpts = (list, sel, any) => (any ? `<option value="">${any}</option>` : '') + list.map(x => `<option ${x === sel ? 'selected' : ''}>${esc(x)}</option>`).join('');

function tripCard(t, mode) {
  const d = user(t.driverId), left = seatsLeft(t), r = tripRoute(t);
  return `<a class="card trip" href="#/trip/${t.id}${mode === 'parcel' ? '?type=parcel' : ''}">
    <div class="trip-body">
      <div class="row between top"><span class="badge b-grey">${ic('cal')}${fmtDate(t.date)}</span><div class="price">${R(mode === 'parcel' ? t.parcelPrice : t.price)}<small>${mode === 'parcel' ? 'per parcel' : 'per seat'}</small></div></div>
      <div class="times" style="margin-top:12px">
        <span class="t">${esc(t.time)}</span><div class="line">${fmtDur(r.min)}</div><span class="t">${esc(arrival(t))}</span>
        <span class="p">${esc(short(t.fromTown))}</span><span></span><span class="p" style="text-align:right">${esc(short(t.toTown))}</span>
        <span class="s">${esc(short(t.fromProv))}</span><span></span><span class="s" style="text-align:right">${esc(t.toProv)}</span>
      </div>
      <div class="meta">
        <span class="badge ${left ? '' : 'b-danger'}">${ic('users')}${left ? left + ' seat' + (left > 1 ? 's' : '') + ' left' : 'Full'}</span>
        <span class="badge b-accent">${ic('door')}Door to door</span>
        ${t.parcelPrice ? `<span class="badge b-grey">${ic('pkg')}Parcels</span>` : ''}
        ${t.womenOnly ? `<span class="badge b-pink">${ic('venus')}Women only</span>` : ''}
      </div>
    </div>
    <div class="trip-foot">${avatar(d, 'sm')}<div style="min-width:0"><b class="small">${esc(d?.name)}</b><div class="xs muted">${esc(d?.vehicle?.colour)} ${esc(d?.vehicle?.make)} · ${vLabel(d?.vehicle)}</div></div><div class="ml-auto">${rateHTML(d?.id)}</div></div>
  </a>`;
}

function searchForm(q = {}, compact) {
  const fp = q.fp || VENDA, tp = q.tp || 'Gauteng';
  return `<form id="searchForm" class="search">
    ${compact ? '' : `<h3>${ic('search')} Where are you going?</h3>`}
    <div class="loc-box">
      <div class="loc from"><span class="dotc"></span><select name="fromProv" data-prov="from" aria-label="From province">${selectOpts(PROVS, fp)}</select><select name="fromTown" data-town="from" aria-label="From town">${selectOpts(towns(fp), q.ft, 'Any town')}</select></div>
      <div class="loc to"><span class="dotc"></span><select name="toProv" data-prov="to" aria-label="To province">${selectOpts(PROVS, tp)}</select><select name="toTown" data-town="to" aria-label="To town">${selectOpts(towns(tp), q.tt, 'Any town')}</select></div>
      <button type="button" class="swap-btn" data-act="swap" aria-label="Swap">${ic('swap', 'sm')}</button>
    </div>
    <div class="grid2">
      <div><label>Date</label><input type="date" name="date" min="${today()}" value="${esc(q.date || '')}"></div>
      <div><label>Passengers</label><select name="seats">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}" ${+q.seats === n ? 'selected' : ''}>${n} ${n > 1 ? 'people' : 'person'}</option>`).join('')}</select></div>
    </div>
    ${q.mode ? `<input type="hidden" name="mode" value="${esc(q.mode)}">` : ''}<button class="btn btn-accent btn-block btn-lg">${ic(q.mode === 'parcel' ? 'pkg' : 'search')} ${q.mode === 'parcel' ? 'Find parcel trips' : 'Find a lift'}</button>
  </form>`;
}
function placePicker(prefix, label, prov, town) {
  return `<div class="grid g2"><div class="field"><label>${label} province</label><select name="${prefix}Prov" data-prov="${prefix}" required>${selectOpts(PROVS, prov)}</select></div>
  <div class="field"><label>Town</label><select name="${prefix}Town" data-town="${prefix}" required>${selectOpts(towns(prov), town)}</select></div></div>`;
}
function upload(name, title, hint, src) {
  src = PHOTOS[name] || src;
  return `<div class="upload ${src ? 'done' : ''}" data-up="${name}"><div class="u-ic">${ic(src ? 'check' : 'camera')}</div><b>${title}</b><span class="hint">${hint}</span>
    <img id="p_${name}" class="${src ? '' : 'hidden'}" src="${src || ''}" alt="${esc(title)}" data-act="img">
    <div class="u-btns"><button type="button" class="btn btn-sm" data-act="camOpen" data-name="${name}" data-title="${esc(title)}">${ic('camera', 'sm')} ${src ? 'Retake' : 'Take photo'}</button>
    <label class="btn btn-sm btn-ghost">${ic('image', 'sm')} Gallery<input type="file" accept="image/*" data-photo="${name}" class="u-file"></label></div>
    <div class="u-q small" id="q_${name}"></div></div>`;
}
const HILLS = `<svg class="hills" viewBox="0 0 1440 140" preserveAspectRatio="none"><path d="M0 90 C120 50 220 40 330 70 C430 96 520 30 640 40 C760 50 820 100 960 80 C1080 62 1160 20 1290 46 C1360 60 1410 70 1440 66 V140 H0Z" fill="#0d5236" opacity=".55"/><path d="M0 110 C160 80 260 96 400 104 C560 114 640 70 800 84 C950 98 1060 120 1200 100 C1320 84 1390 92 1440 98 V140 H0Z" fill="#f4f6f3"/></svg>`;
const empty = (icon, title, text, action = '') => `<div class="card empty" style="grid-column:1/-1"><div class="ic">${ic(icon, 'lg')}</div><h3>${title}</h3><p>${text}</p>${action}</div>`;

/* ---------------- Photos (Unsplash License, bundled in img/) ---------------- */
const PHOTO = { venda: 'img/thohoyandou.jpg', gauteng: 'img/gauteng.jpg', pretoria: 'img/pretoria.jpg', durban: 'img/durban.jpg', capetown: 'img/capetown.jpg', n1: 'img/n1.jpg', drive: 'img/drive.jpg', hero: 'img/hero.jpg', traveller: 'img/traveller.jpg', parcel: 'img/parcel.jpg' };
function placePhoto(prov, town = '', card = false) {
  if (prov === VENDA) return PHOTO.venda;
  if (prov === 'Gauteng') return card || /Pretoria|Centurion/.test(town) ? PHOTO.pretoria : PHOTO.gauteng;
  return { 'KwaZulu Natal': PHOTO.durban, 'Western Cape': PHOTO.capetown, 'Eastern Cape': PHOTO.capetown }[prov] || PHOTO.n1;
}

/* ---------------- Views ---------------- */
const V = {};
let afterRender = [];

const step = (s, i) => `<div class="step-i"><span class="n">${i + 1}</span><div><b>${s[0]}</b><p>${s[1]}</p></div></div>`;
V.home = () => {
  const up = db.trips.filter(t => t.status === 'open' && t.date >= today()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const drivers = db.users.filter(u => u.role === 'driver' && u.status === 'verified');
  const ROUTES = [[VENDA, 'Thohoyandou', 'Gauteng', 'Johannesburg CBD'], ['Gauteng', 'Pretoria CBD', VENDA, 'Sibasa'], [VENDA, 'Musina', 'Gauteng', 'Midrand'], [VENDA, 'Malamulele', 'Gauteng', 'Soweto'], ['Gauteng', 'Johannesburg CBD', VENDA, 'Makhado (Louis Trichardt)'], [VENDA, 'Thohoyandou', 'Limpopo (other)', 'Polokwane'], [VENDA, 'Thohoyandou', 'KwaZulu Natal', 'Durban'], [VENDA, 'Sibasa', 'Western Cape', 'Cape Town']];
  const role = me?.role, nm = me ? esc(first(me.name)) : '', female = me?.gender === 'Female';
  const heroCls = role === 'driver' ? 'hero-driver' : role === 'rider' ? (female ? 'hero-rider-f' : 'hero-rider-m') : '';
  const looking = (db.requests || []).filter(r => !r.date || r.date >= today()).length;
  const week = up.filter(t => t.date <= addDays(7)).length, weekTxt = week ? `${week} trip${week === 1 ? '' : 's'} leaving this week` : 'New trips are posted daily';
  const rv = db.reviews.filter(r => user(r.to)?.role === 'driver'), avg = rv.length ? (rv.reduce((a, r) => a + r.stars, 0) / rv.length).toFixed(1) : null;
  const heroTxt = role === 'driver' ? `
        <span class="role-tag driver">${ic('car', 'sm')} Driver section</span>
        <a class="live-pill" href="#/dashboard?tab=req" style="color:inherit"><i></i>${looking ? `${looking} rider${looking === 1 ? ' is' : 's are'} looking for a lift · see them` : 'No riders waiting right now'}</a>
        <h1>Driving home, ${nm}?<br>Fill your <em>empty seats.</em></h1>
        <p class="lead">Post your trip, set your own price and collect verified riders at their door. Your earnings, trips and wallet are on your dashboard.</p>
        <div class="btns"><a class="btn btn-accent btn-lg" href="#/post">${ic('plus')} Post a trip</a><a class="btn btn-glass btn-lg" href="#/dashboard?tab=earn">${ic('wallet')} My earnings</a><a class="btn btn-glass btn-lg" href="#/search">${ic('search')} Find a ride</a></div>`
    : role === 'rider' ? `
        <span class="role-tag rider">${ic('user', 'sm')} Rider section</span>
        <span class="live-pill"><i></i>${weekTxt}</span>
        <h1>Going home, ${nm}?<br>Get a lift <em>to your door.</em></h1>
        <p class="lead">Verified drivers travelling between Venda, Gauteng and every province. Picked up at your gate, dropped at theirs. Drivers set fair prices.</p>
        <div class="btns"><a class="btn btn-accent btn-lg" href="#/search">Find a lift ${ic('right')}</a>${female ? `<a class="btn btn-glass btn-lg" href="#/search?wo=1">${ic('venus')} Women only rides</a>` : `<a class="btn btn-glass btn-lg" href="#/board">${ic('clock')} Leaving soon</a>`}<a class="btn btn-glass btn-lg" href="#/parcel">${ic('pkg')} Send a parcel</a></div>`
    : `
        <span class="live-pill"><i></i>${weekTxt}</span>
        <h1>Going home?<br>Get a lift <em>to your door.</em></h1>
        <p class="lead">Trip To Venda connects you with verified drivers travelling between Venda, Gauteng and every province. Picked up at your gate, dropped at theirs. Drivers set fair prices.</p>
        <div class="btns"><a class="btn btn-accent btn-lg" href="#/search">Find a lift ${ic('right')}</a><a class="btn btn-glass btn-lg" href="#/parcel">${ic('pkg')} Send a parcel</a><a class="btn btn-glass btn-lg" href="#/signup?role=driver">${ic('car')} Offer a lift</a></div>`;
  return `
  <section class="hero ${heroCls}">
    <div class="wrap">
      <div>${heroTxt}
        <div class="hero-links"><a href="#/how">${ic('bolt', 'sm')} How it works</a><a href="#/safety">${ic('shield', 'sm')} Safety</a></div>
        <div class="trust"><div class="faces">${drivers.slice(0, 4).map(d => avatar(d)).join('')}</div><div><b>${drivers.length} verified driver${drivers.length === 1 ? '' : 's'}</b><small>${avg ? `${ic('star', 'fill sm')} ${avg} average rating · ` : ''}ID & licence checked</small></div></div>
      </div>
      ${searchForm()}
    </div>
    ${HILLS}
  </section>

  <div class="wrap stats-bar"><div class="stats-in">
    <div><b>${up.length}</b><span>Upcoming trips</span></div>
    <div><b>${new Set(db.bookings.filter(b => b.status === 'completed').map(b => b.tripId)).size}</b><span>Trips completed</span></div>
    <div><b>${drivers.length}</b><span>Verified drivers</span></div>
    <div><b>${(db.requests || []).filter(r => !r.date || r.date >= today()).length}</b><span>Riders looking</span></div>
  </div></div>

  <section class="section wrap">
    <div class="sec-head"><div><span class="eyebrow">${ic('clock', 'sm')} Leaving soon</span><h2>${me?.role === 'driver' ? 'Trips leaving soon (book one if you need a ride)' : 'Book a seat on the next trip'}</h2>${SAMPLE_DATA ? '<p class="xs muted" style="margin-top:6px">Sample listings shown while our first drivers are onboarded.</p>' : ''}</div><a href="#/board" class="btn btn-ghost">${ic('clock', 'sm')} Departures board ${ic('right', 'sm')}</a></div>
    ${up.length ? `<div class="scroller">${up.slice(0, 6).map(tripCard).join('')}</div>` : `<div class="card pad-lg" style="text-align:center">${ic('clock')}<h3 style="margin:8px 0 4px">No trips posted yet</h3><p class="muted small">${me?.role === 'driver' ? 'Be the first: post your trip and riders will see it straight away.' : 'Tell drivers where you are going and we will let you know when a trip is posted.'}</p><div class="btns" style="justify-content:center;margin-top:12px">${me?.role === 'driver' ? `<a class="btn" href="#/post">${ic('plus', 'sm')} Post a trip</a>` : `<a class="btn" href="#/search">${ic('search', 'sm')} Find or request a lift</a>`}</div></div>`}
  </section>

  <section class="wrap" style="padding-bottom:20px">
    <div class="sec-head"><div><span class="eyebrow">${ic('route', 'sm')} Popular routes</span><h2>Where Venda travels</h2></div></div>
    <div class="routes">${ROUTES.map(r => { const rt = routeSync(coord(r[0], r[1]), coord(r[2], r[3])); return `<a class="route-tile photo" href="#/search?fp=${encodeURIComponent(r[0])}&ft=${encodeURIComponent(r[1])}&tp=${encodeURIComponent(r[2])}&tt=${encodeURIComponent(r[3])}"><img src="${placePhoto(r[2], r[3], true)}" alt="" loading="lazy" decoding="async"><span class="rt-body"><b>${esc(short(r[1]))} → ${esc(short(r[3]))}</b><small>${ic('route', 'sm')} ${Math.round(rt.km)} km · ${fmtDur(rt.min)}</small></span><span class="from"><small>from</small>${R(suggestPrice(rt.km) - 30)}</span></a>`; }).join('')}</div>
  </section>

  <section class="story">
    <div class="wrap story-in">
      <div>
        <span class="eyebrow" style="color:var(--accent)">${ic('pin', 'sm')} From the Soutpansberg to the city</span>
        <h2>Home is 500 km away.<br>Your lift starts at the gate.</h2>
        <p>No taxi rank at 3 a.m., no carrying bags across town. Your driver collects you at home in Thohoyandou, Sibasa or Malamulele and drops you at the door in Joburg, Pretoria, or anywhere in the country.</p>
        <div class="btns" style="margin-top:22px"><a class="btn btn-accent" href="#/search">Find a lift ${ic('right', 'sm')}</a><a class="btn btn-glass" href="#/board">${ic('clock', 'sm')} Leaving soon</a></div>
      </div>
      <div class="story-pics">
        <figure><img src="${PHOTO.venda}" alt="The pot monument at the Thohoyandou roundabout at sunset" loading="lazy"><figcaption>Thohoyandou</figcaption></figure>
        <figure><img src="${PHOTO.gauteng}" alt="Welcome to Gauteng road sign in front of the city" loading="lazy"><figcaption>Gauteng</figcaption></figure>
      </div>
    </div>
  </section>

  <section class="wrap" style="padding-bottom:30px"><div class="cta">
    <div><span class="eyebrow" style="color:var(--accent)">${ic('car', 'sm')} For drivers</span><h2>Driving home anyway?<br>Fill your empty seats.</h2><p>Month end, long weekends, December, thousands travel the N1 between Venda and Gauteng. Post your trip in 2 minutes and travel with verified riders.</p>
    <div class="btns" style="margin-top:20px"><a href="#/signup?role=driver" class="btn btn-accent btn-lg">Register as a driver</a></div></div>
    <ul><li>${ic('wallet')}You set the price, keep 100% of fares</li><li>${ic('pkg')}Earn extra carrying parcels</li><li>${ic('shield')}Every rider is ID verified</li><li>${ic('star')}Build your reputation with reviews</li></ul>
  </div></section>`;
};

V.search = q => {
  const seats = +q.seats || 1, sort = q.sort || 'time';
  const list = db.trips.filter(t => t.status === 'open' && t.date >= today()
    && (!q.fp || t.fromProv === q.fp) && (!q.ft || t.fromTown === q.ft) && (!q.tp || t.toProv === q.tp) && (!q.tt || t.toTown === q.tt)
    && (!q.date || t.date === q.date) && seatsLeft(t) >= seats && (!q.wo || t.womenOnly) && (!q.pc || t.parcelPrice) && (!q.vt || vType(user(t.driverId)?.vehicle) === q.vt)
    && (!t.womenOnly || !me || me.role !== 'rider' || me.gender === 'Female'));
  list.sort(sort === 'price' ? (a, b) => a.price - b.price : sort === 'rating' ? (a, b) => (rating(b.driverId)?.avg || 0) - (rating(a.driverId)?.avg || 0) : (a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const link = ch => '#/search?' + new URLSearchParams(Object.fromEntries(Object.entries({ ...q, ...ch }).filter(([, v]) => v !== '' && v != null)));
  const days = Array.from({ length: 8 }, (_, i) => addDays(i));
  const title = q.fp ? `${short(q.ft || q.fp)} → ${short(q.tt || q.tp)}` : 'All upcoming trips';
  return `<div class="wrap page">
    <div class="page-head"><h2>${esc(title)}</h2><p>${list.length} trip${list.length === 1 ? '' : 's'} available${q.date ? ' on ' + fmtDate(q.date) : ''}</p></div>
    <div class="layout">
      <div class="sticky">${searchForm(q, true)}</div>
      <div>
        <div class="days"><a href="${link({ date: '' })}" class="${q.date ? '' : 'on'}"><small>All</small>dates</a>${days.map(d => { const x = new Date(d + 'T00:00'); return `<a href="${link({ date: d })}" class="${q.date === d ? 'on' : ''}"><small>${x.toLocaleDateString('en-ZA', { weekday: 'short' })}</small>${x.getDate()}</a>`; }).join('')}</div>
        <div class="filters">${ic('sliders', 'sm')}
          <a class="chip ${sort === 'time' ? 'on' : ''}" href="${link({ sort: 'time' })}">Earliest</a><a class="chip ${sort === 'price' ? 'on' : ''}" href="${link({ sort: 'price' })}">Cheapest</a><a class="chip ${sort === 'rating' ? 'on' : ''}" href="${link({ sort: 'rating' })}">Top rated</a>
          <a class="chip ${q.wo ? 'on' : ''}" href="${link({ wo: q.wo ? '' : 1 })}">${ic('venus', 'sm')}Women only</a><a class="chip ${q.pc ? 'on' : ''}" href="${link({ pc: q.pc ? '' : 1 })}">${ic('pkg', 'sm')}Takes parcels</a>${Object.entries(VTYPES).map(([k, x]) => `<a class="chip ${q.vt === k ? 'on' : ''}" href="${link({ vt: q.vt === k ? '' : k })}">${ic('car', 'sm')}${x.label}s</a>`).join('')}
        </div>
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(290px,100%),1fr))">${list.map(tripCard).join('') || empty('route', 'No trips on this route yet', 'Post a lift request, drivers on this route get notified and can post a trip for you.', `<button class="btn" data-act="request" data-q='${esc(JSON.stringify(q))}'>${ic('bell')} Request a lift</button>`)}</div>
      </div>
    </div>
  </div>`;
};

V.trip = (id, q = {}) => {
  const t = tripById(id); if (!t) return `<div class="wrap page">${empty('info', 'Trip not found', 'It may have been removed.', '<a class="btn" href="#/search">Browse trips</a>')}</div>`;
  const d = user(t.driverId), left = seatsLeft(t), r = tripRoute(t), rv = db.reviews.filter(x => x.to === d.id).slice(-4).reverse();
  const mine = me && me.id === t.driverId;
  const ex = me && db.bookings.find(b => b.tripId === t.id && b.riderId === me.id && ACTIVE.includes(b.status));
  let side;
  if (t.status !== 'open') side = `<div class="banner bad">${ic('x')}This trip was cancelled by the driver.</div>`;
  else if (mine) side = `<div class="banner info">${ic('info')}This is your trip.<a class="btn btn-sm" href="#/dashboard">Manage</a></div>`;
  else if (!me) side = `<div class="card pad-lg"><h3>Book this trip</h3><p class="muted" style="margin:6px 0 16px">Create a free account to book. Riders are verified too, it keeps drivers safe.</p><div class="btns"><a class="btn" href="#/signup?role=rider&next=${encodeURIComponent('#/trip/' + t.id)}">Sign up</a><a class="btn btn-ghost" href="#/login?next=${encodeURIComponent('#/trip/' + t.id)}">Log in</a></div></div>`;
  else if (me.role !== 'rider') side = `<div class="banner info">${ic('info')}Log in with a rider account to book.</div>`;
  else if (ex) side = `<div class="banner ok">${ic('check')}You're booked on this trip.<a class="btn btn-sm" href="#/dashboard">View booking</a></div>`;
  else if (t.womenOnly && me.gender !== 'Female') side = `<div class="banner warn">${ic('venus')}This trip is for women riders only.</div>`;
  else if (!me.phoneVerified || !['pending', 'verified'].includes(me.status)) side = `<div class="banner warn">${ic('id')}Verify your cellphone and ID before booking.<a class="btn btn-sm" href="#/verify">Verify now</a></div>`;
  else side = bookForm(t, left, q.type);
  afterRender.push(() => mountRouteMap('tripMap', t));
  return `<div class="wrap page">
    <a href="#" data-act="back" class="back">${ic('left', 'sm')} Back</a>
    <div class="trip-banner"><img src="${placePhoto(t.toProv, t.toTown)}" alt="" decoding="async"><div class="tb-in"><span class="badge b-dark">${ic('clock', 'sm')}${fmtDate(t.date)} · ${esc(t.time)}</span><h1>${esc(short(t.fromTown))} <span>→</span> ${esc(short(t.toTown))}</h1><p>${Math.round(r.km)} km door to door · ${R(t.price)} per seat · ${left} seat${left === 1 ? '' : 's'} left</p></div></div>
    <div class="layout rev">
      <div class="stack">
        <div class="card" style="padding:12px">
          <div id="tripMap" class="map"></div>
          <div class="map-stats"><div><small>Distance</small><b id="mKm">${Math.round(r.km)} km</b></div><div><small>Drive time</small><b id="mMin">${fmtDur(r.min)}</b></div><div><small>Departs</small><b>${fmtDate(t.date).split(' ').slice(1).join(' ')}, ${esc(t.time)}</b></div><div><small>Arrives ±</small><b id="mArr">${esc(arrival(t))}</b></div></div>
        </div>
        <div class="card pad-lg">
          <div class="row between"><h3>Trip details</h3><div class="price">${R(t.price)}<small>per seat</small></div></div>
          <div class="timeline" style="margin:18px 0">
            <div class="tl"><b>${esc(t.time)} · ${esc(t.fromTown)}</b><span>Picks up: ${esc(t.pickupArea || 'door to door in ' + t.fromTown)}</span></div>
            <div class="tl end"><b>±${esc(arrival(t))} · ${esc(t.toTown)}</b><span>Drops off: ${esc(t.dropArea || 'door to door in ' + t.toTown)}</span></div>
          </div>
          <dl class="kv">
            <dt>Seats</dt><dd>${left} of ${t.seats} available</dd>
            <dt>Luggage</dt><dd>${t.maxBags} bags per rider${t.bagFee ? ` · ${R(t.bagFee)} per extra large bag` : ''}</dd>
            <dt>Parcels</dt><dd>${t.parcelPrice ? R(t.parcelPrice) + ' per parcel' : 'Not accepted'}</dd>
            <dt>Payment</dt><dd>Pay in the app (held until drop off)${t.acceptsCash ? ' or cash to the driver' : ''}</dd>
          </dl>
          <div class="meta">${(t.rules || []).map(x => `<span class="badge b-grey">${esc(x)}</span>`).join('')}${t.womenOnly ? `<span class="badge b-pink">${ic('venus')}Women only</span>` : ''}</div>
          ${t.notes ? `<div class="note" style="margin-top:14px">${ic('msg')}<span>${esc(t.notes)}</span></div>` : ''}
        </div>
        <div class="card pad-lg">
          <div class="row top wrapx" style="gap:16px">${avatar(d, 'lg')}<div style="flex:1;min-width:180px"><h3>${esc(d.name)}</h3><div class="row wrapx" style="gap:8px;margin-top:4px">${rateHTML(d.id)}<span class="muted small">· ${tripsDone(d.id)} trips · since ${esc(d.since || new Date(d.created).getFullYear())}</span></div><div class="meta" style="margin-top:8px">${verifiedBadge(d)}<span class="badge">${ic('id')}Licence & PrDP</span>${d.gender === 'Female' ? `<span class="badge b-pink">${ic('venus')}Female driver</span>` : ''}</div></div>
          <div style="text-align:center">${carSVG(d.vehicle)}<div class="small b">${esc(d.vehicle?.colour)} ${esc(d.vehicle?.make)}</div><span class="badge b-grey" style="margin:4px 0">${ic('car')}${vLabel(d.vehicle)} · ${d.vehicle?.seats} passenger seats</span><br><span class="plate">${ex && ex.status !== 'requested' ? esc(d.vehicle?.reg) : '••• ' + esc((d.vehicle?.reg || '').slice(-5))}</span></div></div>
          ${d.bio ? `<p style="margin-top:14px">${esc(d.bio)}</p>` : ''}${d.langs ? `<p class="small muted" style="margin-top:6px">Speaks ${esc(d.langs)}</p>` : ''}
          <div style="margin-top:14px">${rv.map(x => `<div class="review"><div class="row">${avatar(user(x.from), 'sm')}<b class="small">${esc(first(user(x.from)?.name))}</b><span class="rate ml-auto">${ic('star', 'fill')}${x.stars}</span></div><p class="small" style="margin-top:6px">${esc(x.text)}</p><span class="xs muted">${ago(x.at)}</span></div>`).join('')}</div>
        </div>
      </div>
      <div class="sticky" id="bookSide">${side}</div>
    </div>
    ${t.status === 'open' && !mine && !ex && left > 0 ? `<div class="mob-book"><div><b>${R(t.price)}</b><small>per seat · ${left} left</small></div><button class="btn btn-accent" data-act="toBook">${me ? 'Book now' : 'Book a seat'} ${ic('right', 'sm')}</button></div><div class="mob-book-sp"></div>` : ''}
  </div>`;
};

function bookForm(t, left, preType) {
  const counter = (name, val, min, max) => `<div class="counter"><button type="button" data-act="cnt" data-d="-1" aria-label="Less">−</button><b>${val}</b><button type="button" data-act="cnt" data-d="1" aria-label="More">+</button><input name="${name}" value="${val}" data-min="${min}" data-max="${max}"></div>`;
  const parcel = preType === 'parcel' && t.parcelPrice;
  const pinBox = (k, label) => `<div class="pinbox"><div class="row between wrapx" style="margin-bottom:8px"><label style="margin:0">${label}</label><button type="button" class="btn btn-soft btn-sm" data-act="detect" data-k="${k}">${ic('nav', 'sm')} Detect my location</button></div><div id="map_${k}" class="map pinmap"></div><div class="hint" id="pinlbl_${k}">${ic('pin', 'sm')} Tap the map to drop a pin on the exact gate, or tap “Detect my location”.</div></div>`;
  return `<form id="bookForm" class="card pad-lg" data-trip="${t.id}" data-step="1" novalidate>
    <div class="row between"><h3>${parcel ? 'Send a parcel' : 'Book your spot'}</h3><span class="step-label" id="stepLbl">Step 1 of 4</span></div>
    <div class="stepper" style="margin-top:12px"><span class="on"></span><span></span><span></span><span></span></div>
    <div class="fstep on" data-s="1">
      <div class="seg"><label><input type="radio" name="type" value="seat" ${parcel ? '' : 'checked'}>${ic('user', 'sm')} Seat for me</label>${t.parcelPrice ? `<label><input type="radio" name="type" value="parcel" ${parcel ? 'checked' : ''}>${ic('pkg', 'sm')} Send a parcel</label>` : ''}</div>
      <div data-show="seat" class="${parcel ? 'hidden' : ''}"><div class="field"><label>Seats</label>${left ? counter('seats', 1, 1, left) : '<div class="banner bad">Trip is full, you can still send a parcel.</div><input type="hidden" name="seats" value="0">'}</div></div>
      <div data-show="parcel" class="${parcel ? '' : 'hidden'}"><div class="note" style="margin-bottom:14px">${ic('info')}<span>Send groceries, clothes or goods without travelling. The receiver gets a <b>6 digit delivery code</b>, the driver only hands over the parcel when the code matches.</span></div>
        <div class="grid g2"><div class="field"><label>Receiver's name</label><input name="recvName"></div><div class="field"><label>Receiver's cellphone</label><input name="recvPhone" type="tel" placeholder="e.g. 071 234 5678"></div></div></div>
    </div>
    <div class="fstep" data-s="2">
      <div class="field"><label>${ic('pin', 'sm')} Pickup address (your door)</label><textarea name="pickup" required placeholder="House no., street or village, section, nearest landmark">${esc(me.homeAddress || '')}</textarea><div class="hint">Driver covers: ${esc(t.pickupArea || t.fromTown)}</div></div>
      ${pinBox('pickup', 'Pin your pickup gate')}
      <div class="field" style="margin-top:16px"><label>${ic('pin', 'sm')} Drop off address</label><textarea name="dropoff" required placeholder="Full address where you're going"></textarea><div class="hint">Driver covers: ${esc(t.dropArea || t.toTown)}</div></div>
      ${pinBox('dropoff', 'Pin your drop off gate')}
    </div>
    <div class="fstep" data-s="3">
      <div class="grid g2"><div class="field"><label>Normal bags</label>${counter('bags', parcel ? 0 : 1, 0, 4)}</div><div class="field"><label>Extra large bags / boxes</label>${counter('bigBags', 0, 0, 3)}<div class="hint">${t.bagFee ? R(t.bagFee) + ' each' : 'No extra fee'}</div></div></div>
      <div class="field">${upload('luggagePhoto', 'Add a photo of your luggage / parcel', 'Required for bags and parcels, helps the driver plan space and protects you.', '')}</div>
      <div class="field"><label>What's in it?</label><input name="luggageDesc" placeholder="e.g. black suitcase, blue Shoprite bag, 20L bucket"></div>
    </div>
    <div class="fstep" data-s="4">
      <div id="summary"></div>
      <div class="step-label" style="margin:16px 0 8px">How will you pay?</div>
      ${PAY_ONLINE ? '' : `<label class="paycard"><input type="radio" name="pay" value="cash" checked><span><b>${ic('wallet', 'sm')} Cash to the driver at pickup</b><small>Pay the full amount in the car. Have the exact amount ready. Card payments are coming soon.</small></span></label>`}${!PAY_ONLINE ? '' : `<label class="paycard"><input type="radio" name="pay" value="online" checked><span><b>${ic('lock', 'sm')} Pay now: card, Instant EFT or Capitec Pay</b><small>Held safely by Trip To Venda and released to the driver only after drop off. Full refund if the driver declines or cancels.</small></span></label>`}
      ${!PAY_ONLINE ? '' : t.acceptsCash ? `<label class="paycard"><input type="radio" name="pay" value="cash"><span><b>${ic('wallet', 'sm')} Cash to the driver at pickup</b><small>Pay the full amount in the car. Have the exact amount ready.</small></span></label>` : `<p class="xs muted">This driver only accepts in app payments.</p>`}
      <div class="field" style="margin-top:12px"><label>Note to driver (optional)</label><input name="note" placeholder="e.g. I'll wait at the Spar gate"></div>
      <label class="check"><input type="checkbox" name="agree"> My luggage has no illegal or dangerous items, and I'll follow the driver's trip rules.</label>
    </div>
    <div class="total"><div><span>Total incl. booking fee</span><div class="xs" style="opacity:.7" id="feeLine">${R(t.price)} fare + ${R(FEES.seat)} booking fee</div></div><b id="bookTotal">${R(t.price + FEES.seat)}</b></div>
    <div class="row"><button type="button" class="btn btn-ghost hidden" data-act="stepBack">${ic('left', 'sm')} Back</button><button type="button" class="btn" data-act="stepNext" style="flex:1">Continue ${ic('right', 'sm')}</button></div>
  </form>`;
}
function priceFor(t, type, seats, big) { const fare = (type === 'parcel' ? t.parcelPrice : seats * t.price) + (big || 0) * (t.bagFee || 0); return feesOf(fare, type, seats, user(t.driverId)?.pro); }
function formPrice(f) { const t = tripById(f.dataset.trip); return priceFor(t, f.type.value, +f.seats.value || 1, +f.bigBags.value || 0); }
function calcTotal(t, f) { return formPrice(f).total; }
function updateTotal(f) { const p = formPrice(f); $('#bookTotal').textContent = R(p.total); $('#feeLine').textContent = `${R(p.fare)} fare + ${R(p.riderFee)} booking fee`; }

/* --- map pins: tap to pin, drag to adjust, or detect automatically --- */
function mountPinMaps(f) {
  const t = tripById(f.dataset.trip);
  [['pickup', tripA(t)], ['dropoff', tripB(t)]].forEach(([k, c]) => {
    const el = document.getElementById('map_' + k); if (!el) return;
    if (el._m) { el._m.invalidateSize(); return; }
    const m = baseMap('map_' + k, { scrollWheelZoom: true }); if (!m) return;
    el._m = m; m.setView(c, 13);
    L.circle(c, { radius: 4000, color: '#13784b', weight: 1.5, fillColor: '#13784b', fillOpacity: .05, dashArray: '5 5', interactive: false }).addTo(m);
    m.on('click', e => setPin(f, k, [e.latlng.lat, e.latlng.lng]));
    if (f._pins?.[k]) setPin(f, k, f._pins[k], true);
  });
}
function setPin(f, k, ll, quiet) {
  f._pins = f._pins || {}; f._pins[k] = [+(+ll[0]).toFixed(5), +(+ll[1]).toFixed(5)];
  const m = document.getElementById('map_' + k)?._m;
  if (m) {
    if (m._pin) m._pin.setLatLng(f._pins[k]);
    else { m._pin = L.marker(f._pins[k], { draggable: true, icon: L.divIcon({ className: '', html: `<div class="pin-drop ${k}">${ic('pin')}</div>`, iconSize: [36, 44], iconAnchor: [18, 42] }) }).addTo(m); m._pin.on('dragend', e => { const p = e.target.getLatLng(); setPin(f, k, [p.lat, p.lng], true); }); }
    if (!quiet) m.panTo(f._pins[k]);
  }
  const lbl = document.getElementById('pinlbl_' + k);
  if (lbl) { lbl.innerHTML = `${ic('check', 'sm')} <b>Pinned</b> · ${near(f._pins[k])} <span class="muted">(${f._pins[k].join(', ')})</span> · drag the pin to adjust`; lbl.classList.add('ok'); }
}
function near(ll) {
  let best = null, bc = null, bd = 1e9;
  for (const p of PROVS) for (const [t, c] of Object.entries(PLACES[p])) { const d = haversine(ll, c); if (d < bd) { bd = d; best = t; bc = c; } }
  if (bd < .35) return `in central ${short(best)}`;
  const dy = ll[0] - bc[0], dx = (ll[1] - bc[1]) * Math.cos(bc[0] * Math.PI / 180), ang = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
  return `≈ ${bd < 10 ? bd.toFixed(1) : Math.round(bd)} km ${['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(ang / 45) % 8]} of ${short(best)}`;
}
const gmaps = ll => `https://www.google.com/maps/dir/?api=1&destination=${ll[0]},${ll[1]}`;
const getLocLL = () => new Promise(res => { if (!navigator.geolocation) return res(null); try { navigator.geolocation.getCurrentPosition(p => res([p.coords.latitude, p.coords.longitude]), () => res(null), { timeout: 9000, enableHighAccuracy: true }); } catch { res(null); } });

/* --- payment (checkout) & creating the booking --- */
let pendingBookForm = null;
function openCheckout(f) {
  pendingBookForm = f; const p = formPrice(f), t = tripById(f.dataset.trip);
  modal(`${sheetHead('Secure payment', `${esc(short(t.fromTown))} → ${esc(short(t.toTown))} · ${fmtDate(t.date)}`)}
    <div class="sum-row"><span>${f.type.value === 'parcel' ? 'Parcel delivery' : f.seats.value + ' × seat'}${+f.bigBags.value ? ' + bags' : ''}</span><b>${R(p.fare)}</b></div>
    <div class="sum-row"><span>Booking fee</span><b>${R(p.riderFee)}</b></div>
    <div class="total" style="margin:12px 0"><span>You pay now</span><b>${R(p.total)}</b></div>
    <div class="step-label" style="margin-bottom:8px">Pay with</div>
    <div class="togs" style="margin-bottom:14px">${['Card', 'Instant EFT', 'Capitec Pay', 'SnapScan'].map((x, i) => `<label class="tog"><input type="radio" name="pm" value="${x}" ${i ? '' : 'checked'}><span>${x}</span></label>`).join('')}</div>
    <div class="note" style="margin-bottom:14px">${ic('lock')}<span class="small">In the live app this opens the payment provider's secure page (e.g. PayFast or Yoco), Trip To Venda never sees your card number. Money is held until the driver confirms drop off with your PIN. ${TEST_MODE ? '<b>Test mode: no real money moves yet.</b>' : ''}</span></div>
    <button class="btn btn-accent btn-block btn-lg" data-act="payNow">${ic('lock', 'sm')} Pay ${R(p.total)}</button>`);
}
async function submitBooking(f, payMethod) {
  const t = tripById(f.dataset.trip), type = f.type.value, seats = type === 'seat' ? +f.seats.value : 0;
  if (type === 'seat' && seatsLeft(t) < seats) return toast('Not enough seats left', 'err');
  const p = formPrice(f), online = f.pay.value === 'online';
  const b = { id: uid('b'), tripId: t.id, riderId: me.id, driverId: t.driverId, type, seats, pickup: f.pickup.value.trim(), dropoff: f.dropoff.value.trim(), pickupPin: f._pins?.pickup || null, dropPin: f._pins?.dropoff || null,
    bags: +f.bags.value, bigBags: +f.bigBags.value, luggageDesc: f.luggageDesc.value.trim(), luggagePhoto: PHOTOS.luggagePhoto || '', note: f.note.value.trim(), recvName: f.recvName.value.trim(), recvPhone: f.recvPhone.value.trim(),
    ...p, pin: String(1000 + rndInt(9000)), deliveryCode: type === 'parcel' ? String(100000 + rndInt(900000)) : '',
    status: 'requested', pay: online ? 'online' : 'cash', payMethod: online ? payMethod : 'Cash', payStatus: online ? 'held' : 'due', created: Date.now() };
  db.bookings.push(b);
  notify(t.driverId, `New ${type === 'parcel' ? 'parcel' : 'seat'} request from ${me.name} for ${t.fromTown} → ${t.toTown} on ${fmtDate(t.date)} (${online ? 'paid online' : 'cash'}).`);
  save(); closeModal(); toast(online ? `Paid ${R(p.total)} ✔ Held safely until drop off` : 'Request sent! The driver will confirm soon.'); go('#/dashboard');
}
function stepValid(f, s) {
  const t = tripById(f.dataset.trip), fail = m => (toast(m, 'err'), false);
  if (s === 1) { if (f.type.value === 'seat' && !(+f.seats.value)) return fail('This trip is full, choose “Send a parcel”'); if (f.type.value === 'parcel' && (!f.recvName.value.trim() || !isSAphone(f.recvPhone.value))) return fail("Add the receiver's name and a valid cellphone"); }
  if (s === 2 && (f.pickup.value.trim().length < 6 || f.dropoff.value.trim().length < 6)) return fail('Please add full pickup and drop off addresses');
  if (s === 2 && (RANK_RE.test(f.pickup.value) || RANK_RE.test(f.dropoff.value))) return fail(rankMsg);
  if (s === 3) { const n = +f.bags.value + +f.bigBags.value; if ((n > 0 || f.type.value === 'parcel') && !PHOTOS.luggagePhoto) return fail('Please add a photo of your luggage / parcel'); if (f.type.value === 'seat' && n > t.maxBags + 1) return fail(`This driver allows about ${t.maxBags} bags, chat to them first`); }
  if (s === 4 && !f.agree.checked) return fail('Please tick the luggage confirmation');
  return true;
}
function showStep(f, s) {
  f.dataset.step = s;
  f.querySelectorAll('.fstep').forEach(x => x.classList.toggle('on', +x.dataset.s === s));
  f.querySelectorAll('.stepper span').forEach((x, i) => x.classList.toggle('on', i < s));
  $('#stepLbl').textContent = `Step ${s} of 4`;
  f.querySelector('[data-act=stepBack]').classList.toggle('hidden', s === 1);
  f.querySelector('[data-act=stepNext]').innerHTML = s === 4 ? `${ic('check', 'sm')} Confirm & pay` : `Continue ${ic('right', 'sm')}`;
  if (s === 2) setTimeout(() => mountPinMaps(f), 30);
  if (s === 4) {
    const t = tripById(f.dataset.trip), seat = f.type.value === 'seat', big = +f.bigBags.value, p = formPrice(f), pins = f._pins || {};
    $('#summary').innerHTML = `<div class="sum-row"><span>${seat ? f.seats.value + ' × seat × ' + R(t.price) : 'Parcel delivery'}</span><b>${R(seat ? f.seats.value * t.price : t.parcelPrice)}</b></div>${big ? `<div class="sum-row"><span>${big} × extra large bag</span><b>${R(big * t.bagFee)}</b></div>` : ''}<div class="sum-row"><span>Booking fee</span><b>${R(p.riderFee)}</b></div><div class="sum-row"><span>Pickup</span><b style="text-align:right;max-width:62%">${esc(f.pickup.value)}${pins.pickup ? `<br><span class="xs muted">📍 ${near(pins.pickup)}</span>` : '<br><span class="xs" style="color:#8a5a00">No pin, driver will call you</span>'}</b></div><div class="sum-row"><span>Drop off</span><b style="text-align:right;max-width:62%">${esc(f.dropoff.value)}${pins.dropoff ? `<br><span class="xs muted">📍 ${near(pins.dropoff)}</span>` : ''}</b></div><div class="sum-row"><span>Luggage</span><b>${f.bags.value} bag(s) + ${big} XL</b></div>`;
  }
  if (f.getBoundingClientRect().top < 60) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function authShell(title, sub, form) {
  return `<div class="auth"><div class="auth-side" style="--img:url(${PHOTO.traveller})"><span class="eyebrow" style="color:var(--accent)">${ic('shield', 'sm')} Verified community</span><h2>Every rider and driver is ID checked.</h2><p>Your documents are only seen by the Trip To Venda safety team and are protected under POPIA.</p>
  <div class="faces" style="margin-top:26px">${db.users.filter(u => u.role === 'driver').slice(0, 5).map(d => avatar(d)).join('')}</div></div>
  <div class="auth-main">${form.replace('<!--head-->', `<h2>${title}</h2><p class="muted" style="margin:6px 0 22px">${sub}</p>`)}</div></div>`;
}
V.signup = q => {
  if (me) return V.dashboard({});
  const role = q.role === 'driver' ? 'driver' : 'rider';
  return authShell('Create your account', 'One account for the website and the app.', `<form id="signupForm" data-next="${esc(q.next || '')}"><!--head-->
    <div class="seg"><label><input type="radio" name="role" value="rider" ${role === 'rider' ? 'checked' : ''}>${ic('user', 'sm')} I need lifts</label><label><input type="radio" name="role" value="driver" ${role === 'driver' ? 'checked' : ''}>${ic('car', 'sm')} I'm a driver</label></div>
    <div class="field"><label>Full name (as on your ID)</label><input name="name" required autocomplete="name"></div>
    <div class="grid g2"><div class="field"><label>Cellphone</label><input name="phone" type="tel" required placeholder="e.g. 071 234 5678" autocomplete="tel"></div><div class="field"><label>Gender</label><select name="gender" required><option value="">Select</option><option>Female</option><option>Male</option><option>Prefer not to say</option></select></div></div>
    <div class="field"><label>Email</label><input name="email" type="email" required autocomplete="email"></div>
    <div class="field"><label>Password</label>${pwField('name="password" minlength="8" required autocomplete="new-password"')}<div class="hint">At least 8 characters, with upper and lower case letters and a number.</div></div>
    <div class="card" style="background:#fafcfb;margin-bottom:14px"><div class="card-title">${ic('alert', 'sm')}<b class="small">Emergency contact</b></div><div class="grid g2"><div class="field" style="margin:0"><label>Name</label><input name="emergencyName" required placeholder="e.g. Mom"></div><div class="field" style="margin:0"><label>Cellphone</label><input name="emergencyPhone" type="tel" required placeholder="e.g. 071 234 5678"></div></div></div>
    <label class="check"><input type="checkbox" name="agree" required> I agree to the <a href="#/rules?tab=terms" target="_blank">Terms of use</a>, <a href="#/rules?tab=community" target="_blank">Community rules</a> and <a href="#/rules?tab=privacy" target="_blank">Privacy policy</a>, and consent to my ID being checked for everyone's safety (POPIA).</label><br>
    <button class="btn btn-block btn-lg">Create account</button>
    <p class="small muted" style="text-align:center;margin-top:14px">Already have an account? <a href="#/login" class="b">Log in</a></p>
  </form>`);
};
V.login = q => authShell('Welcome back', 'Log in to book, track and manage your trips.', `<form id="loginForm" data-next="${esc(q.next || '')}"><!--head-->
    <div class="field"><label>${window.Cloud?.on ? 'Email' : 'Email or cellphone'}</label><input name="login" ${window.Cloud?.on ? 'type="email"' : ''} required autocomplete="username"></div>
    <div class="field"><label>Password</label>${pwField('name="password" required autocomplete="current-password"')}</div>
    <button class="btn btn-block btn-lg">Log in</button>
    <p class="small muted" style="text-align:center;margin-top:14px">New here? <a href="#/signup" class="b">Create an account</a></p>
    <p class="small muted" style="text-align:center;margin-top:8px"><a href="#" data-act="forgot">Forgot your password?</a></p>
  </form>`);

V.verify = () => {
  if (!me) return V.login({ next: '#/verify' });
  const drv = me.role === 'driver', docs = me.docs || {}, v = me.vehicle || {}, locked = me.status === 'verified';
  const banner = me.status === 'verified' ? `<div class="banner ok">${ic('shield')}You're verified, you can ${drv ? 'post trips' : 'book trips'}.</div>`
    : me.status === 'pending' ? `<div class="banner warn">${ic('clock')}We're checking your documents, usually within 24 hours.</div>`
    : me.status === 'rejected' ? `<div class="banner bad">${ic('x')}Verification declined: ${esc(me.rejectReason || 'documents unclear')}. Please fix and resubmit.</div>`
    : `<div class="banner info">${ic('info')}${drv ? 'Drivers must verify their ID, driver\'s licence, PrDP and number plate before posting trips.' : 'Riders must verify their cellphone and ID before booking.'} This keeps both riders and drivers safe.</div>`;
  const idc = me.idNumber && me.idType !== 'Passport' ? checkSAID(me.idNumber) : null;
  return `<div class="wrap page" style="max-width:780px">
    <div class="page-head"><h2>${locked ? 'Profile & documents' : 'Get verified'}</h2><p>${drv ? 'ID, driver\'s licence, PrDP, licence disc and number plate.' : 'Cellphone, ID document and a selfie.'}</p></div>
    ${banner}
    <div class="vsteps">${[['phone', 'Cellphone', me.phoneVerified], ['id', 'Identity', !!me.idNumber], ...(drv ? [['file', 'Licence & PrDP', !!me.licenceNo], ['car', 'Vehicle & plate', !!v.reg]] : []), ['shield', 'Safety review', me.status === 'verified']].map(([i, l, d]) => `<span class="${d ? 'done' : ''}">${ic(d ? 'check' : i, 'sm')} ${l}</span>`).join('')}</div>
    ${window.Cloud?.on ? `<div class="card pad-lg" style="margin-bottom:14px"><div class="row between"><div class="card-title" style="margin:0">${ic('info')}<h3>1 · Email</h3></div>${Cloud.emailVerified() ? `<span class="badge">${ic('check')}Confirmed</span>` : ''}</div>
      ${Cloud.emailVerified() ? `<p class="muted small" style="margin-top:6px">${esc(me.email || '')} · your cellphone ${esc(me.phone)} is checked by our team when they review your documents.</p>` : `<p class="muted small" style="margin:6px 0 12px">Open the link we emailed to <b>${esc(me.email || '')}</b>, then tap the button.</p><div class="row" style="gap:8px"><button class="btn" data-act="emailDone">I've confirmed</button><button class="btn btn-ghost" data-act="emailResend">Send again</button></div>`}
    </div>` : `<div class="card pad-lg" style="margin-bottom:14px"><div class="row between"><div class="card-title" style="margin:0">${ic('phone')}<h3>1 · Cellphone</h3></div>${me.phoneVerified ? `<span class="badge">${ic('check')}Verified</span>` : ''}</div>
      ${me.phoneVerified ? `<p class="muted small" style="margin-top:6px">${esc(me.phone)}</p>` : `<p class="muted small" style="margin:6px 0 12px">We'll SMS a one time code to ${esc(me.phone)}.</p><div class="chat-form"><input id="otpIn" placeholder="4 digit code" inputmode="numeric" maxlength="4"><button class="btn btn-ghost" data-act="sendOtp">Send code</button><button class="btn" data-act="checkOtp">Verify</button></div>`}
    </div>`}
    <form id="verifyForm" class="card pad-lg" ${locked ? 'data-locked="1"' : ''}>
      <div class="card-title">${ic('id')}<h3>2 · Identity ${drv ? '(driver)' : '(rider)'}</h3></div>
      <div class="grid g2">
        <div class="field"><label>Document type</label><select name="idType"><option ${me.idType !== 'Passport' ? 'selected' : ''}>SA ID</option><option ${me.idType === 'Passport' ? 'selected' : ''}>Passport</option></select></div>
        <div class="field"><label>ID / passport number</label><input name="idNumber" required value="${esc(me.idNumber || '')}" inputmode="numeric" autocomplete="off"><div class="hint" id="idCheck">${idc ? (idc.ok ? `<span class="okc">${ic('check', 'sm')} Valid SA ID · born ${niceD(idc.dob)} · age ${idc.age}</span>` : `<span class="bad">${idc.msg}</span>`) : 'Never shown to other users.'}</div></div>
      </div>
      <div class="grid g2" style="margin-bottom:14px">${upload('idPhoto', 'Photo of ID / passport', 'All 4 corners, no glare, details readable', docs.idPhoto)}${upload('selfie', 'Take a selfie', 'We compare it with your ID photo, it becomes your profile photo', docs.selfie)}</div>
      <div class="field"><label>Home address</label><input name="homeAddress" value="${esc(me.homeAddress || '')}" placeholder="Used to fill in your pickups"></div>
      ${drv ? `<div class="card-title" style="margin-top:22px">${ic('file')}<h3>3 · Driver's licence & PrDP</h3></div>
      <div class="note" style="margin-bottom:14px">${ic('info')}<span class="small">South African law requires a <b>Professional Driving Permit (PrDP, category P)</b> to carry passengers for payment. Drivers must be 21 or older.</span></div>
      <div class="grid g3">
        <div class="field"><label>Licence number</label><input name="licenceNo" required value="${esc(me.licenceNo || '')}" placeholder="As on the card" style="text-transform:uppercase"></div>
        <div class="field"><label>Licence code</label><select name="licenceCode">${['B', 'EB', 'C1', 'EC1', 'C', 'EC'].map(c => `<option ${me.licenceCode === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Licence expiry date</label><input type="date" name="licenceExpiry" required value="${esc(me.licenceExpiry || '')}"></div>
        <div class="field"><label>PrDP number</label><input name="prdpNo" required value="${esc(me.prdpNo || '')}" style="text-transform:uppercase"></div>
        <div class="field"><label>PrDP expiry date</label><input type="date" name="prdpExpiry" required value="${esc(me.prdpExpiry || '')}"></div>
      </div>
      <div class="grid g2" style="margin-bottom:14px">${upload('licence', "Driver's licence card (front)", 'Must match the number and expiry above', docs.licence)}${upload('prdp', 'PrDP card / certificate', 'Category P for passengers', docs.prdp)}</div>
      <div class="card-title" style="margin-top:22px">${ic('car')}<h3>4 · Vehicle & number plate</h3></div>
      <div class="grid g3">
      </div>
      <div class="vtypes">${Object.entries(VTYPES).map(([k, x]) => `<label class="paycard"><input type="radio" name="vtype" value="${k}" ${vType(v) === k ? 'checked' : ''} required><span><b>${ic('car', 'sm')} ${x.label}</b><small>${x.hint}. ${x.eg}.</small></span></label>`).join('')}</div>
      <p class="xs muted" style="margin:6px 0 12px">Trip To Venda allows private cars and 7 seaters only. Minibuses and taxis can't be listed.</p>
      <div class="grid g3">
        <div class="field"><label>Make & model</label><input name="make" required value="${esc(v.make || '')}" placeholder="${VTYPES[vType(v)].eg}"></div>
        <div class="field"><label>Year</label><input name="year" type="number" min="1995" max="${new Date().getFullYear() + 1}" required value="${esc(v.year || '')}"></div>
        <div class="field"><label>Colour</label><input name="colour" required value="${esc(v.colour || '')}" placeholder="e.g. White"></div>
        <div class="field"><label>Number plate</label><input name="reg" required value="${esc(v.reg || '')}" placeholder="e.g. HXK 482 L" style="text-transform:uppercase"><div class="hint" id="plateCheck"></div></div>
        <div class="field"><label>Passenger seats (not counting you)</label><input name="vseats" type="number" min="1" max="${VTYPES[vType(v)].max}" required value="${esc(v.seats || 4)}"><div class="hint" id="seatHint">${VTYPES[vType(v)].label}: up to ${VTYPES[vType(v)].max} passengers</div></div>
        <div class="field"><label>Licence disc expiry</label><input type="date" name="discExpiry" required value="${esc(v.discExpiry || '')}"></div>
      </div>
      <div class="grid g2" style="margin-bottom:14px">${upload('disc', 'Vehicle licence disc', 'Photo of the disc on the windscreen', docs.disc)}${upload('carPhoto', 'Car photo with number plate', 'Plate must be readable, riders check it before getting in', docs.carPhoto)}</div>` : ''}
      ${drv ? `<div class="field" style="margin-top:6px"><label>Operating licence or permit number <span class="xs muted">(if you have one)</span></label><input name="opLicence" value="${esc(me.opLicence || '')}" placeholder="As issued by the regulatory entity" style="text-transform:uppercase"></div>
      <div class="decl"><div class="card-title" style="margin-bottom:8px">${ic('shield')}<h3>4 · Driver declaration</h3></div>
        <label class="check"><input type="checkbox" name="d1" required ${me.driverDecl ? 'checked' : ''}> I only offer seats on trips I am making myself, booked in advance through Trip To Venda. I don't roam, stand for hire, or pick up anyone who did not book.</label>
        <label class="check"><input type="checkbox" name="d2" required ${me.driverDecl ? 'checked' : ''}> I never load or offload at taxi ranks, taxi stops or bus terminals, I never tout for passengers, and my car has no taxi signs, roof light or meter.</label>
        <label class="check"><input type="checkbox" name="d3" required ${me.driverDecl ? 'checked' : ''}> I hold every licence and permit the law requires to carry passengers for payment (including my PrDP and any operating licence), my car is roadworthy and insured, and I am responsible for any fines.</label>
        <p class="xs muted" style="margin:6px 0 0">Read the <a href="#/rules?tab=drivers" target="_blank">Driver rules</a> and <a href="#/rules?tab=position" target="_blank">our position on the taxi industry</a>.</p></div>` : ''}
      <button class="btn btn-block btn-lg" ${locked ? 'disabled' : ''}>${me.status === 'pending' ? 'Update & resubmit' : locked ? 'Verified ✓' : 'Submit for safety review'}</button>
    </form>
  </div>`;
};
F.verifyForm = async f => {
  if (f.dataset.locked) return;
  const drv = me.role === 'driver', fields = drv ? ['idPhoto', 'selfie', 'licence', 'prdp', 'disc', 'carPhoto'] : ['idPhoto', 'selfie'];
  const btn = f.querySelector('button.btn-block'), fail = m => { btn.disabled = false; btn.textContent = 'Submit for safety review'; toast(m, 'err'); };
  if (!me.phoneVerified) return fail('Verify your cellphone first (step 1)');
  const idType = f.idType.value, idNumber = f.idNumber.value.replace(/\s/g, '');
  if (idType === 'SA ID') { const c = checkSAID(idNumber); if (!c.ok) return fail(c.msg); if (c.age < (drv ? 21 : 18)) return fail(drv ? 'Drivers must be 21 or older (PrDP rule)' : 'Riders must be 18 or older'); }
  else if (!/^[A-Z0-9]{6,12}$/i.test(idNumber)) return fail('Enter a valid passport number');
  if (drv) {
    if (!licenceOK(f.licenceNo.value)) return fail("Enter your driver's licence number as shown on the card");
    if (!future(f.licenceExpiry.value)) return fail("Your driver's licence is expired or the date is missing");
    if (!f.prdpNo.value.trim()) return fail('A PrDP is required to carry paying passengers');
    if (!future(f.prdpExpiry.value)) return fail('Your PrDP is expired or the date is missing');
    if (!plateOK(f.reg.value)) return fail('Enter a valid number plate, e.g. HXK 482 L');
    if (!future(f.discExpiry.value)) return fail('Your licence disc is expired, renew it first');
    const vt = VTYPES[f.vtype?.value]; if (!vt) return fail('Choose your vehicle type: private car or 7 seater');
    const vs = +f.vseats.value; if (!(vs >= 1 && vs <= vt.max)) return fail(`A ${vt.label.toLowerCase()} can take 1 to ${vt.max} passengers`);
  }
  btn.disabled = true; btn.textContent = 'Uploading…';
  const imgs = {}; fields.forEach(k => { if (PHOTOS[k]) imgs[k] = PHOTOS[k]; });
  let docs = Object.assign({}, me.docs, imgs);
  for (const [max, q] of [[1000, .7], [900, .64], [800, .58]]) { // shrink if the set is too big to store
    const size = Object.entries(docs).filter(([k]) => k !== 'selfie').reduce((a, [, v]) => a + (v?.length || 0), 0);
    if (size < 880000) break;
    for (const k of Object.keys(docs)) if (k !== 'selfie' && docs[k]) { const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = docs[k]; }); if (im) docs[k] = canvasJpeg(im, max, q).url; }
  }
  me.docs = docs;
  const names = { idPhoto: 'ID photo', selfie: 'selfie', licence: 'licence card', prdp: 'PrDP', disc: 'licence disc', carPhoto: 'car photo with plate' };
  const missing = fields.filter(k => !me.docs[k]);
  if (missing.length) return fail('Please add: ' + missing.map(k => names[k]).join(', '));
  Object.assign(me, { idType, idNumber, homeAddress: f.homeAddress.value.trim() });
  if (drv) Object.assign(me, { licenceNo: f.licenceNo.value.trim().toUpperCase(), licenceCode: f.licenceCode.value, licenceExpiry: f.licenceExpiry.value, prdpNo: f.prdpNo.value.trim().toUpperCase(), prdpExpiry: f.prdpExpiry.value, vehicle: { type: f.vtype.value, make: f.make.value.trim(), year: +f.year.value, colour: f.colour.value.trim(), reg: f.reg.value.trim().toUpperCase(), seats: +f.vseats.value, discExpiry: f.discExpiry.value }, wallet: me.wallet || { balance: 0, ledger: [] }, acceptsCash: me.acceptsCash ?? true });
  if (drv) { if (!(f.d1?.checked && f.d2?.checked && f.d3?.checked)) return fail('Please tick all three driver declarations'); me.driverDecl = { v: POLICY_V, at: Date.now() }; me.opLicence = (f.opLicence?.value || '').trim().toUpperCase(); }
  me.status = 'pending';
  notifyAdmins(`${me.name} (${me.role}) submitted documents for verification.`, '#/admin?tab=verify');
  save(); toast("Submitted ✔ Our safety team will review your documents"); go('#/dashboard');
};

const emailBanner = () => window.Cloud?.on && me && me.role !== 'admin' && !Cloud.emailVerified() ? `<div class="banner warn">${ic('mail')}<span>Confirm your email: we sent a link to <b>${esc(me.email || '')}</b>. You can book and post trips once it's confirmed.</span><button class="btn btn-sm" data-act="emailDone">I've confirmed</button><button class="btn btn-sm btn-ghost" data-act="emailResend">Send again</button></div>` : '';
V.authAction = () => {
  const a = actionParams();
  const shell = inner => `<div class="wrap page"><div class="aa-card card pad-lg"><div class="aa-head"><img src="img/emblem.webp" alt=""><div>Trip To <b>Venda</b><small>Door to door lifts</small></div></div><div id="aaBody">${inner}</div></div></div>`;
  if (!window.Cloud?.on || !a) return shell(`<h2>Link not available</h2><p class="muted">Open the newest email we sent you, or log in to ask for a new link.</p><a class="btn btn-block" href="#/login">Log in</a>`);
  if (a.mode === 'verifyEmail') return shell(`<div class="aa-ic">${ic('mail')}</div><h2>Confirm your email</h2><p class="muted">One tap and your Trip To Venda account is verified. You can then book lifts, post trips and get trip updates.</p>
    <button class="btn btn-accent btn-lg btn-block" data-act="aaVerify">${ic('check')} Verify my account</button>`);
  if (a.mode === 'resetPassword') { afterRender.push(async () => { try { const em = await Cloud.checkReset(a.code); $('#aaFor').innerHTML = `For <b>${esc(em)}</b>`; } catch (e) { $('#aaBody').innerHTML = aaFail(e); } });
    return shell(`<div class="aa-ic">${ic('lock')}</div><h2>Choose a new password</h2><p class="muted" id="aaFor">Checking your link…</p>
    <form id="resetPwForm"><div class="field"><label>New password</label>${pwField('name="pw" required minlength="8" autocomplete="new-password"')}<div class="hint">At least 8 characters, with upper and lower case letters and a number.</div></div>
    <div class="field"><label>Type it again</label>${pwField('name="pw2" required minlength="8" autocomplete="new-password"')}</div>
    <button class="btn btn-accent btn-lg btn-block">${ic('check')} Save new password</button></form>`); }
  return shell(`<h2>Nothing to do here</h2><p class="muted">This link isn't used by Trip To Venda.</p><button class="btn btn-block" data-act="aaHome">Go to Trip To Venda</button>`);
};
const aaFail = e => `<div class="aa-ic bad">${ic('info')}</div><h2>This link can't be used</h2><p class="muted">${esc(Cloud.err(e))}</p>${me ? `<button class="btn btn-block" data-act="emailResend">Send me a new link</button>` : `<a class="btn btn-block" href="#/login">Log in</a>`}<button class="btn btn-ghost btn-block" style="margin-top:8px" data-act="aaHome">Go to Trip To Venda</button>`;
const aaDone = (title, text, btn, hash) => `<div class="aa-ic ok">${ic('check')}</div><h2>${title}</h2><p class="muted">${text}</p><button class="btn btn-accent btn-lg btn-block" data-act="aaLeave" data-to="${hash}">${btn}</button>`;
F.resetPwForm = async f => {
  const a = actionParams(), pw = f.pw.value;
  if (pw !== f.pw2.value) return toast("The two passwords don't match", 'err');
  if (pw.length < 8 || !/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return toast('Password needs 8+ characters with upper and lower case letters and a number', 'err');
  const b = f.querySelector('button:not([type=button])'); b.disabled = true;
  try { await Cloud.doReset(a.code, pw); try { localStorage.removeItem('ttv_lock'); } catch { } $('#aaBody').innerHTML = aaDone('Password changed ✔', 'You can now log in with your new password.', 'Log in', '#/login'); }
  catch (e) { b.disabled = false; $('#aaBody').innerHTML = aaFail(e); }
};
const AA_ACTIONS = {
  aaVerify: async el => { el.disabled = true; el.innerHTML = 'Verifying…';
    try { await Cloud.applyVerify(actionParams().code); if (me && me.role !== 'admin') { me.phoneVerified = true; save(); }
      $('#aaBody').innerHTML = aaDone('Your email is confirmed ✔', me ? 'Thank you. Next, add your documents so we can verify you.' : 'Thank you. Log in to carry on.', me ? (me.role === 'admin' ? 'Open the Control room' : 'Continue') : 'Log in', me ? (me.role === 'admin' ? '#/admin' : '#/verify') : '#/login'); }
    catch (e) { $('#aaBody').innerHTML = aaFail(e); } },
  aaLeave: el => leaveAction(el.dataset.to),
  aaHome: () => leaveAction('#/')
};
V.dashboard = q => {
  if (!me) return V.login({ next: '#/dashboard' });
  if (me.role === 'admin') return V.admin(q);
  const vb = me.status === 'verified' ? '' : me.status === 'pending' ? `<div class="banner warn">${ic('clock')}Verification pending, we're checking your documents.</div>`
    : `<div class="banner warn">${ic('id')}${me.status === 'rejected' ? 'Verification declined. ' : ''}Verify your account to ${me.role === 'driver' ? 'post trips' : 'book trips'}.<a class="btn btn-sm" href="#/verify">Verify now</a></div>`;
  return `<div class="wrap page">${emailBanner()}
    <div class="dash-head">${avatar(me, 'lg')}<div><h2 style="margin:0">Hi ${esc(first(me.name))} 👋</h2><div class="row wrapx" style="gap:8px;margin-top:4px">${verifiedBadge(me)}${rateHTML(me.id)}<span class="badge b-grey">${me.role === 'driver' ? ic('car') + 'Driver' : ic('user') + 'Rider'}</span>${me.pro ? '<span class="badge b-dark">PRO</span>' : ''}</div></div>
    <div class="btns ml-auto">${me.role === 'driver' ? `<a class="btn btn-accent" href="#/post">${ic('plus')} Post a trip</a>` : `<a class="btn btn-accent" href="#/search">${ic('search')} Find a trip</a><a class="btn btn-ghost" href="#/parcel">${ic('pkg', 'sm')} Send parcel</a>`}<a class="btn btn-ghost" href="#/verify">${ic('user', 'sm')} Profile</a></div></div>
    ${vb}${me.role === 'driver' ? driverDash(q) : riderDash(q)}</div>`;
};
const tabsHTML = (cur, list) => `<div class="tabs">${list.map(([k, l]) => `<button class="${cur === k ? 'on' : ''}" data-act="tab" data-t="${k}">${l}</button>`).join('')}</div>`;
const payBadge = b => b.pay === 'online' ? ({ held: `<span class="badge">${ic('lock')}Paid · held safely</span>`, released: `<span class="badge b-grey">${ic('check')}Paid</span>`, refunded: `<span class="badge b-blue">Refunded</span>` }[b.payStatus] || '') : ({ due: `<span class="badge b-accent">${ic('wallet')}Cash at pickup</span>`, 'paid-cash': `<span class="badge b-grey">${ic('check')}Paid cash</span>` }[b.payStatus] || '');

function riderDash(q) {
  const tab = q.tab || 'up';
  const all = db.bookings.filter(b => b.riderId === me.id).sort((a, b) => b.created - a.created);
  const upc = all.filter(b => ACTIVE.includes(b.status)), past = all.filter(b => !ACTIVE.includes(b.status));
  const reqs = db.requests.filter(r => r.riderId === me.id && (!r.date || r.date >= today()));
  const list = tab === 'up' ? upc : tab === 'past' ? past : null;
  return `<div class="kpis"><div class="kpi dark"><span class="ic">${ic('ticket')}</span><b>${upc.length}</b><span>Upcoming trips</span></div><div class="kpi"><span class="ic">${ic('route')}</span><b>${tripsDone(me.id)}</b><span>Trips completed</span></div><div class="kpi"><span class="ic">${ic('pkg')}</span><b>${all.filter(b => b.type === 'parcel').length}</b><span>Parcels sent</span></div><div class="kpi"><span class="ic">${ic('wallet')}</span><b>${R(past.filter(b => b.status === 'completed').reduce((a, b) => a + b.total, 0))}</b><span>Spent on trips</span></div></div>
  ${tabsHTML(tab, [['up', `Upcoming (${upc.length})`], ['past', 'Past'], ['req', `Lift requests (${reqs.length})`]])}
  ${list ? `<div class="grid g3">${list.map(riderBooking).join('') || empty('bag', tab === 'up' ? 'No upcoming trips' : 'No past trips yet', 'Find a verified driver going your way, or send a parcel home.', '<div class="btns" style="justify-content:center"><a class="btn" href="#/search">Find a trip</a><a class="btn btn-ghost" href="#/parcel">Send a parcel</a></div>')}</div>`
  : `<div class="grid g3">${reqs.map(r => `<div class="card"><b>${esc(short(r.ft || r.fp))} → ${esc(short(r.tt || r.tp))}</b><p class="muted small" style="margin:4px 0 12px">${r.date ? fmtDate(r.date) : 'Flexible date'} · ${r.seats} seat(s) · visible to all drivers</p><button class="btn btn-sm btn-ghost" data-act="delReq" data-id="${r.id}">Remove</button></div>`).join('') || empty('bell', 'No lift requests', 'Search a route with no trips and tap “Request a lift”.')}</div>`}`;
}

function riderBooking(b) {
  const t = tripById(b.tripId), d = user(t?.driverId); if (!t) return '';
  const rated = db.reviews.some(r => r.bookingId === b.id && r.from === me.id);
  const unread = db.messages.filter(m => m.bookingId === b.id && m.from !== me.id && !(m.readBy || []).includes(me.id)).length;
  const live = ['confirmed', 'picked'].includes(b.status), parcel = b.type === 'parcel';
  return `<div class="card bk"><div class="bk-status ${b.status}"></div>
    <div class="bk-top"><div><b>${esc(short(t.fromTown))} → ${esc(short(t.toTown))}</b><div class="small muted">${fmtDate(t.date)} · ${esc(t.time)} · ${parcel ? 'Parcel to ' + esc(first(b.recvName)) : b.seats + ' seat' + (b.seats > 1 ? 's' : '')}</div></div>${statusBadge(b.status)}</div>
    <div class="bk-mid">
      ${b.timeChanged && ['requested', 'confirmed'].includes(b.status) ? `<div class="note new" style="margin-bottom:12px">${ic('clock')}<span class="small"><b>Time changed by the driver</b><br>Was ${esc(b.timeChanged.from)}, now <b>${esc(b.timeChanged.to)}</b>. Can't make it? Cancel for a full refund.</span></div>` : ''}
      <div class="row">${avatar(d, 'sm')}<div><b class="small">${esc(d.name)}</b><div class="xs muted">${esc(d.vehicle.colour)} ${esc(d.vehicle.make)}</div></div><div class="ml-auto" style="text-align:right"><b>${R(b.total)}</b><div>${payBadge(b)}</div></div></div>
      ${live ? `<div class="row between" style="margin-top:12px"><span class="plate">${esc(d.vehicle.reg)}</span><a class="btn btn-soft btn-sm" href="tel:${esc(d.phone)}">${ic('phone', 'sm')} ${esc(d.phone)}</a></div>` : ''}
      ${b.status === 'confirmed' ? `<div class="ticket"><div><div class="xs b muted">${parcel ? 'COLLECTION PIN' : 'YOUR PICKUP PIN'}</div><div class="xs muted">Give only to the driver of ${esc(d.vehicle.reg)}</div></div><div class="pin">${b.pin}</div></div>` : ''}
      ${parcel && ACTIVE.includes(b.status) ? `<div class="ticket"><div><div class="xs b muted">DELIVERY CODE</div><div class="xs muted">Send it to ${esc(b.recvName)}, the driver needs it to hand over</div></div><div class="pin" style="font-size:1.4rem;letter-spacing:.18em">${b.deliveryCode}</div></div>` : ''}
      ${b.share?.active ? `<div class="note new" style="margin-top:10px">${ic('nav', 'sm')}<span class="small">Sharing live location with <b>${esc(b.share.name)}</b></span></div>` : ''}
      ${b.status === 'requested' ? `<p class="xs muted" style="margin-top:10px">Sent ${ago(b.created)}, drivers usually reply within a few hours.${b.pay === 'online' ? ' Your payment is held and fully refunded if the driver declines.' : ''}</p>` : ''}
    </div>
    <div class="bk-act">
      ${b.status === 'picked' ? `<a class="btn btn-sm" href="#/live/${b.id}">${ic('nav', 'sm')} Track live</a>` : ''}
      ${live ? `<button class="btn btn-sm ${b.share?.active ? 'btn-ghost' : 'btn-accent'}" data-act="share" data-id="${b.id}">${ic('share', 'sm')} ${b.share?.active ? 'Sharing' : 'Share live location'}</button>` : ''}
      ${ACTIVE.includes(b.status) ? `<button class="btn btn-sm btn-ghost" data-act="chat" data-id="${b.id}">${ic('msg', 'sm')} Chat${unread ? ` · ${unread}` : ''}</button>` : ''}
      ${['requested', 'confirmed'].includes(b.status) ? `<button class="btn btn-sm btn-ghost" data-act="cancelB" data-id="${b.id}">Cancel</button>` : ''}
      ${b.status === 'completed' && !rated ? `<button class="btn btn-sm btn-accent" data-act="rate" data-id="${b.id}">${ic('star', 'sm')} Rate driver</button>` : ''}
      <a class="btn btn-sm btn-ghost" href="#/trip/${t.id}">Details</a>
    </div></div>`;
}

/* place picker with every town grouped by province (value "Province|Town") */
const placeOptions = sel => PROVS.map(p => `<optgroup label="${esc(p)}">${towns(p).map(t => `<option value="${esc(p + '|' + t)}" ${sel === p + '|' + t ? 'selected' : ''}>${esc(short(t))}</option>`).join('')}</optgroup>`).join('');
function quickPost() {
  const last = db.trips.filter(t => t.driverId === me.id).sort((a, b) => b.created - a.created)[0];
  const from = last ? last.toProv + '|' + last.toTown : VENDA + '|Thohoyandou', to = last ? last.fromProv + '|' + last.fromTown : 'Gauteng|Johannesburg CBD';
  const [fp, ft] = from.split('|'), [tp, tt] = to.split('|'), r = routeSync(coord(fp, ft), coord(tp, tt)), v = me.vehicle || {};
  const days = Array.from({ length: 7 }, (_, i) => addDays(i));
  return `<form id="quickForm" class="card pad-lg qpost">
    <div class="row between wrapx"><div><span class="eyebrow">${ic('bolt', 'sm')} Quick post</span><h3>I'm leaving…</h3></div><a href="#/post" class="small b">More options →</a></div>
    <div class="qp">
      <div class="field"><label>From</label><select name="from">${placeOptions(from)}</select></div>
      <div class="field"><label>To</label><select name="to">${placeOptions(to)}</select></div>
      <div class="field"><label>Day</label><select name="date">${days.map((d, i) => `<option value="${d}" ${i === 1 ? 'selected' : ''}>${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtDate(d)}</option>`).join('')}</select></div>
      <div class="field"><label>Leaving at</label><input type="time" name="time" value="05:00" required></div>
      <div class="field"><label>Price / seat (R)</label><input type="number" name="price" min="50" max="3000" step="10" value="${suggestPrice(r.km)}" required></div>
      <div class="field"><label>Seats</label><input type="number" name="seats" min="1" max="${v.seats || 4}" value="${Math.min(4, v.seats || 4)}" required></div>
    </div>
    <div class="row wrapx between"><span class="xs muted" id="qpInfo">${Math.round(r.km)} km · ${fmtDur(r.min)} · suggested ${R(suggestPrice(r.km))}/seat · you keep ${Math.round((1 - (me.pro ? FEES.pro : FEES.commission)) * 100)}%</span><button class="btn btn-accent">${ic('send', 'sm')} Post it</button></div>
  </form>`;
}

function driverDash(q) {
  const tab = q.tab || 'trips';
  const trips = db.trips.filter(t => t.driverId === me.id).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const all = db.bookings.filter(b => trips.some(t => t.id === b.tripId));
  const earned = all.filter(b => b.status === 'completed').reduce((a, b) => a + b.driverNet, 0);
  const expected = all.filter(b => ['confirmed', 'picked'].includes(b.status)).reduce((a, b) => a + b.driverNet, 0);
  const pending = all.filter(b => b.status === 'requested').length;
  const reqs = db.requests.filter(r => !r.date || r.date >= today());
  const upcoming = trips.filter(t => t.date >= today() && t.status === 'open'), past = trips.filter(t => !(t.date >= today() && t.status === 'open')).reverse();
  const w = me.wallet || { balance: 0, ledger: [] };
  const tripBlock = t => {
    const bs = db.bookings.filter(b => b.tripId === t.id).sort((a, b) => a.created - b.created), pins = bs.filter(b => ACTIVE.includes(b.status) && b.pickupPin).length;
    return `<div class="card pad-lg" style="margin-bottom:14px">
      <div class="row between top wrapx"><div><h3>${esc(short(t.fromTown))} → ${esc(short(t.toTown))}</h3><div class="small muted">${fmtDate(t.date)} · ${esc(t.time)} · ${R(t.price)}/seat · ${seatsLeft(t)} of ${t.seats} seats left</div></div>
      <div class="btns">${pins ? `<button class="btn btn-sm btn-soft" data-act="pickupMap" data-id="${t.id}">${ic('pin', 'sm')} Pickup map (${pins})</button>` : ''}<button class="btn btn-sm btn-ghost" data-act="postShare" data-id="${t.id}">${ic('share', 'sm')} Share post</button><a class="btn btn-sm btn-ghost" href="#/trip/${t.id}">${ic('eye', 'sm')} View</a>${canEditTrip(t) ? `<button class="btn btn-sm" data-act="editTrip" data-id="${t.id}">${ic('file', 'sm')} Edit trip & prices</button>` : ''}${t.status === 'open' && t.date >= today() ? `<button class="btn btn-sm btn-ghost" data-act="cancelTrip" data-id="${t.id}">Cancel</button>` : `<span class="badge b-grey">${t.status === 'open' ? 'Past' : 'Cancelled'}</span>`}</div></div>
      <div class="prog" style="margin:14px 0 4px"><i style="width:${Math.round(seatsTaken(t) / t.seats * 100)}%"></i></div><div class="xs muted">${seatsTaken(t)} of ${t.seats} seats booked${bs.some(b => b.type === 'parcel' && b.status !== 'cancelled') ? ' · ' + bs.filter(b => b.type === 'parcel' && b.status !== 'cancelled').length + ' parcel(s)' : ''}</div>
      <div class="grid g2" style="margin-top:14px">${bs.map(driverBooking).join('') || `<div class="note">${ic('share')}<span>No bookings yet. Tap “Share post” to put it on WhatsApp & Facebook.</span></div>`}</div>
    </div>`;
  };
  const wallet = `<div class="grid g2" style="align-items:start">
    <div class="card pad-lg"><div class="card-title">${ic('wallet')}<h3>Trip To Venda wallet</h3></div>
      <div class="wallet ${w.balance < 0 ? 'neg' : ''}"><span>Balance</span><b>${R(w.balance)}</b></div>
      <p class="small muted" style="margin:10px 0 14px">Cash trips: you collect the full fare from the rider, and the platform fee (${Math.round((me.pro ? FEES.pro : FEES.commission) * 100)}% + booking fee) comes off this wallet. ${w.balance < 0 ? '<b style="color:var(--danger)">Your balance is negative, top up to post new trips.</b>' : 'Keep it above R0 to keep posting trips.'}</p>
      <div class="btns"><button class="btn btn-accent" data-act="topUp" data-x="200">${ic('plus', 'sm')} Top up R200</button><button class="btn btn-ghost" data-act="topUp" data-x="500">Top up R500</button></div>
      ${(db.topups || []).filter(x => x.driverId === me.id && x.status === 'requested').map(x => `<div class="sum-row"><span>${R(x.amount)} top up · ref <b>${esc(x.ref)}</b><br><span class="xs">Waiting for the Control room to confirm</span></span><span class="badge b-grey">Pending</span></div>`).join('')}
      <div class="step-label" style="margin:18px 0 6px">Recent activity</div>
      ${(w.ledger || []).slice().sort((a, b) => b.at - a.at).slice(0, 8).map(l => `<div class="sum-row"><span>${esc(l.text)}<br><span class="xs">${new Date(l.at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span></span><b style="color:${l.amount < 0 ? 'var(--danger)' : 'var(--brand)'}">${l.amount < 0 ? '' : '+'}${R(Math.abs(l.amount))}</b></div>`).join('') || '<p class="muted small">No activity yet.</p>'}
    </div>
    <div class="stack">
      <div class="card pad-lg"><div class="card-title">${ic('ticket')}<h3>Online payouts</h3></div>
        <p class="small muted">Riders who pay in the app: money is held until drop off, then paid to your bank every Tuesday.</p>
        <div class="sum-row"><span>Waiting for next payout</span><b>${R(all.filter(b => b.payout === 'pending').reduce((a, b) => a + b.driverNet, 0))}</b></div>
        <div class="sum-row"><span>Paid out (last 45 days)</span><b>${R(all.filter(b => b.payout === 'paid').reduce((a, b) => a + b.driverNet, 0))}</b></div>
        <div class="sum-row"><span>Held for upcoming trips</span><b>${R(all.filter(b => b.payStatus === 'held').reduce((a, b) => a + b.driverNet, 0))}</b></div>
      </div>
      <div class="card pad-lg pro ${me.pro ? 'on' : ''}"><div class="row between"><div class="card-title" style="margin:0">${ic('star')}<h3>Trip To Venda Pro</h3></div>${me.pro ? '<span class="badge b-dark">ACTIVE</span>' : ''}</div>
        <p class="small" style="margin:8px 0 12px">${R(FEES.proMonthly)}/month · pay <b>${FEES.pro * 100}%</b> instead of ${FEES.commission * 100}% · featured on the departures board. Worth it if you earn more than ${R(FEES.proMonthly / (FEES.commission - FEES.pro))} a month.</p>
        <button class="btn btn-sm ${me.pro ? 'btn-ghost' : ''}" data-act="togglePro">${window.Cloud?.on && me.proRequested ? 'Withdraw request' : me.pro ? 'Cancel Pro' : 'Go Pro'}</button></div>
    </div></div>`;
  return `<div class="kpis">
    <a class="kpi dark" href="#/dashboard?tab=earn" style="color:#fff"><span class="ic">${ic('wallet')}</span><b>${R(earned)}</b><span>Earned, all time · see earnings ›</span></a>
    <div class="kpi"><span class="ic">${ic('ticket')}</span><b>${R(expected)}</b><span>Confirmed, coming</span></div>
    <div class="kpi"><span class="ic" style="background:var(--accent-50);color:#8a5a00">${ic('bell')}</span><b>${pending}</b><span>Requests waiting</span></div>
    <div class="kpi ${w.balance < 0 ? 'neg' : ''}"><span class="ic">${ic('wallet')}</span><b>${R(w.balance)}</b><span>Wallet balance</span></div>
  </div>
  ${tab === 'trips' && me.status === 'verified' ? (w.balance < 0 ? `<div class="banner bad">${ic('wallet')}You owe ${R(-w.balance)} in fees. Top up to post new trips.<button class="btn btn-sm" data-act="tab" data-t="wallet">Open wallet</button></div>` : quickPost()) : ''}
  ${tabsHTML(tab, [['earn', 'Earnings'], ['trips', `Upcoming (${upcoming.length})`], ['past', 'Past'], ['req', `Riders looking (${reqs.length})`], ['wallet', 'Wallet & payouts']])}
  ${tab === 'earn' ? earningsView(q) : tab === 'wallet' ? wallet : tab === 'req' ? reqGroupsHTML(reqs)
  : (tab === 'past' ? past : upcoming).map(tripBlock).join('') || empty('car', tab === 'past' ? 'No past trips' : 'No upcoming trips', me.status === 'verified' ? 'Going home soon? Use “I\'m leaving…” above.' : 'Get verified first, then post trips.')}`;
}

/* ---------- Driver earnings dashboard ---------- */
const EARN_PERIODS = [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['month', 'This month'], ['all', 'All time']];
function earnStart(p) { if (p === 'all') return 0; if (p === 'month') { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); } return Date.now() - Number(p) * 864e5; }
function driverEarnRows(driverId, since = 0) {
  const tripsById = Object.fromEntries(db.trips.filter(t => t.driverId === driverId).map(t => [t.id, t]));
  return db.bookings.filter(b => tripsById[b.tripId] && b.status === 'completed' && (b.doneAt || 0) >= since).map(b => ({ b, t: tripsById[b.tripId] }));
}
function earningsView(q) {
  const p = EARN_PERIODS.some(x => x[0] === q.p) ? q.p : '30', since = earnStart(p), rows = driverEarnRows(me.id, since);
  const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
  const net = sum(rows, x => x.b.driverNet), gross = sum(rows, x => x.b.fare), fees = sum(rows, x => x.b.commission);
  const byTrip = {}; rows.forEach(x => { const k = x.t.id; (byTrip[k] = byTrip[k] || { t: x.t, seats: 0, riders: 0, parcels: 0, gross: 0, fees: 0, net: 0, cash: 0, done: 0 }); const r = byTrip[k]; if (x.b.type === 'parcel') r.parcels++; else { r.riders++; r.seats += x.b.seats; } r.gross += x.b.fare; r.fees += x.b.commission; r.net += x.b.driverNet; if (x.b.pay === 'cash') r.cash += x.b.fare; r.done = Math.max(r.done, x.b.doneAt || 0); });
  const trips = Object.values(byTrip).sort((a, b) => b.done - a.done);
  const pax = sum(trips, r => r.seats), parcels = sum(trips, r => r.parcels), avg = trips.length ? net / trips.length : 0;
  const cash = sum(rows.filter(x => x.b.pay === 'cash'), x => x.b.fare), online = rows.filter(x => x.b.pay === 'online');
  const paid = sum(online.filter(x => x.b.payout === 'paid'), x => x.b.driverNet), waiting = sum(online.filter(x => x.b.payout !== 'paid'), x => x.b.driverNet);
  const km = sum(trips, r => routeSync(coord(r.t.fromProv, r.t.fromTown), coord(r.t.toProv, r.t.toTown)).km);
  // last 8 weeks chart (seats vs parcels, what the driver kept)
  const all8 = driverEarnRows(me.id, Date.now() - 56 * 864e5);
  const weeks = Array.from({ length: 8 }, (_, i) => { const end = Date.now() - (7 - i) * 7 * 864e5, st = end - 7 * 864e5, bs = all8.filter(x => x.b.doneAt > st && x.b.doneAt <= end); const lab = new Date(st + 864e5).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }); return { l: 'Week of ' + lab, s: lab, a: sum(bs.filter(x => x.b.type !== 'parcel'), x => x.b.driverNet), b: sum(bs.filter(x => x.b.type === 'parcel'), x => x.b.driverNet) }; });
  const thisWeek = weeks[7].a + weeks[7].b, lastWeek = weeks[6].a + weeks[6].b;
  const trend = lastWeek ? Math.round((thisWeek - lastWeek) / lastWeek * 100) : null;
  const routes = {}; trips.forEach(r => { const k = short(r.t.fromTown) + ' → ' + short(r.t.toTown); routes[k] = (routes[k] || 0) + r.net; });
  const topRoutes = Object.entries(routes).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([l, v]) => ({ l, v }));
  const coming = db.bookings.filter(b => db.trips.some(t => t.id === b.tripId && t.driverId === me.id) && ['confirmed', 'picked'].includes(b.status));
  const comingNet = sum(coming, b => b.driverNet), comingTrips = new Set(coming.map(b => b.tripId)).size;
  const label = EARN_PERIODS.find(x => x[0] === p)[1].toLowerCase();
  return `<div class="earn">
    <div class="row between wrapx" style="gap:10px;margin-bottom:14px">
      <div class="filters" style="margin:0">${EARN_PERIODS.map(([k, l]) => `<a class="chip ${k === p ? 'on' : ''}" href="#/dashboard?tab=earn&p=${k}">${l}</a>`).join('')}</div>
      <button class="btn btn-sm btn-ghost" data-act="earnCsv" data-p="${p}">${ic('download', 'sm')} Statement (CSV)</button>
    </div>
    <div class="earn-hero">
      <div><span class="eyebrow" style="color:var(--accent)">${ic('wallet', 'sm')} You made, ${label}</span><b class="earn-big">${R(net)}</b><p>From ${trips.length} trip${trips.length === 1 ? '' : 's'} · ${pax} passenger${pax === 1 ? '' : 's'} · ${parcels} parcel${parcels === 1 ? '' : 's'}</p></div>
      <div class="earn-split"><div><small>Riders paid</small><b>${R(gross)}</b></div><div><small>Trip To Venda fees</small><b>${R(fees)}</b></div><div><small>You kept</small><b style="color:var(--accent)">${R(net)}</b></div></div>
    </div>
    <div class="kpis k8" style="margin-top:14px">
      <div class="kpi"><span class="ic">${ic('route')}</span><b>${trips.length}</b><span>Trips completed</span></div>
      <div class="kpi"><span class="ic">${ic('user')}</span><b>${pax}</b><span>Passengers carried</span></div>
      <div class="kpi"><span class="ic">${ic('pkg')}</span><b>${parcels}</b><span>Parcels delivered</span></div>
      <div class="kpi"><span class="ic">${ic('wallet')}</span><b>${R(avg)}</b><span>Average per trip</span></div>
      <div class="kpi"><span class="ic">${ic('car')}</span><b>${Math.round(km).toLocaleString('en-ZA')} km</b><span>Driven with riders</span></div>
      <div class="kpi"><span class="ic">${ic('star')}</span><b>${rating(me.id)?.avg || 'New'}</b><span>Your rating</span></div>
      <div class="kpi"><span class="ic">${ic('clock')}</span><b>${R(thisWeek)}</b><span>This week${trend === null ? '' : `<em class="trend ${trend >= 0 ? 'up' : 'down'}">${trend >= 0 ? '▲' : '▼'} ${Math.abs(trend)}% vs last week</em>`}</span></div>
      <div class="kpi"><span class="ic">${ic('ticket')}</span><b>${R(comingNet)}</b><span>Coming from ${comingTrips} booked trip${comingTrips === 1 ? '' : 's'}</span></div>
    </div>
    <div class="grid g2" style="margin-top:14px">
      <div class="card pad-lg"><div class="card-title">${ic('wallet')}<h3>What you kept per week</h3></div><div class="legend"><span><i style="background:#13784b"></i>Passengers</span><span><i style="background:#e09a00"></i>Parcels</span></div>${barSVG(weeks, { series: ['Passengers', 'Parcels'], fmt: v => v >= 1000 ? 'R' + (Math.round(v / 100) / 10) + 'k' : R(v) })}</div>
      <div class="card pad-lg"><div class="card-title">${ic('route')}<h3>Your best routes</h3><span class="xs muted ml-auto">${label}</span></div>${topRoutes.length ? hbars(topRoutes, v => R(v)) : '<p class="muted small">No completed trips in this period yet.</p>'}
        <div style="margin-top:18px"><div class="sum-row"><span>Cash you collected</span><b>${R(cash)}</b></div><div class="sum-row"><span>In app, already paid to your bank</span><b>${R(paid)}</b></div><div class="sum-row"><span>In app, waiting for Tuesday payout</span><b>${R(waiting)}</b></div></div></div>
    </div>
    <div class="card pad-lg" style="margin-top:14px"><div class="card-title">${ic('ticket')}<h3>Trip by trip</h3><span class="xs muted ml-auto">${trips.length} trip${trips.length === 1 ? '' : 's'}</span></div>
      ${trips.length ? `<div class="table-wrap"><table><thead><tr><th>Trip</th><th>Date</th><th>Passengers</th><th>Parcels</th><th>Riders paid</th><th>Fees</th><th>You kept</th></tr></thead><tbody>${trips.map(r => `<tr data-act="goto" data-h="#/trip/${r.t.id}"><td><b>${esc(short(r.t.fromTown))} → ${esc(short(r.t.toTown))}</b></td><td>${fmtDate(r.t.date)}</td><td>${r.seats}</td><td>${r.parcels}</td><td>${R(r.gross)}</td><td>${R(r.fees)}</td><td><b>${R(r.net)}</b></td></tr>`).join('')}</tbody></table></div>` : empty('car', 'No completed trips yet', 'Your money from each trip shows here once riders are dropped off.')}
    </div>
  </div>`;
}

/* ---------- Editing a posted trip ---------- */
const canEditTrip = t => t.status === 'open' && t.date >= today() && !db.bookings.some(b => b.tripId === t.id && ['picked', 'completed'].includes(b.status));
function editTripSheet(t) {
  const v = me.vehicle || {}, booked = seatsTaken(t), active = db.bookings.filter(b => b.tripId === t.id && ['requested', 'confirmed'].includes(b.status));
  const r = routeSync(coord(t.fromProv, t.fromTown), coord(t.toProv, t.toTown));
  modal(`${sheetHead('Edit trip', `${esc(short(t.fromTown))} → ${esc(short(t.toTown))}`)}
  ${active.length ? `<div class="note new" style="margin-bottom:14px">${ic('info')}<span class="small"><b>${active.length} rider${active.length === 1 ? '' : 's'} already booked.</b> They keep the price they agreed to. If you change the day or time, they get a message and can cancel for a full refund.</span></div>` : ''}
  <form id="editTripForm" data-id="${t.id}">
    <div class="grid g2"><div class="field"><label>Date</label><input type="date" name="date" min="${today()}" value="${esc(t.date)}" required></div><div class="field"><label>Departure</label><input type="time" name="time" value="${esc(t.time)}" required></div></div>
    <div class="grid g2"><div class="field"><label>Arrival (optional)</label><input type="time" name="arrive" value="${esc(t.arrive || '')}"></div><div class="field"><label>Seats to sell</label><input type="number" name="seats" min="${Math.max(1, booked)}" max="${v.seats || 4}" value="${t.seats}" required><div class="hint">${booked} booked · your ${vLabel(v).toLowerCase()} takes up to ${v.seats || 4}</div></div></div>
    <div class="grid g3"><div class="field"><label>Price per seat (R)</label><input type="number" name="price" min="50" max="3000" value="${t.price}" required></div><div class="field"><label>Extra large bag (R)</label><input type="number" name="bagFee" min="0" max="500" value="${t.bagFee || 0}"></div><div class="field"><label>Parcel price (R), 0 for none</label><input type="number" name="parcelPrice" min="0" max="1000" value="${t.parcelPrice || 0}"></div></div>
    <p class="xs muted" style="margin:-4px 0 12px">${Math.round(r.km)} km · suggested R${suggestPrice(r.km) - 30} to R${suggestPrice(r.km) + 40} per seat. A new price applies to new bookings only.</p>
    <div class="field"><label>Areas you'll pick up from</label><input name="pickupArea" value="${esc(t.pickupArea || '')}"></div>
    <div class="field"><label>Areas you'll drop off in</label><input name="dropArea" value="${esc(t.dropArea || '')}"></div>
    <div class="field"><label>Notes for riders</label><textarea name="notes">${esc(t.notes || '')}</textarea></div>
    <label class="check" style="margin-bottom:16px"><input type="checkbox" name="acceptsCash" ${t.acceptsCash ? 'checked' : ''}> Also accept cash at pickup</label>
    <button class="btn btn-block btn-lg">Save changes</button>
  </form>`);
}

/* ---------- Rider information for drivers (POPIA) ----------
   Drivers only see what they need to do the trip, only while the booking is active:
   first name + surname initial on lists; full name, photo, phone and exact addresses only from
   acceptance until 24 hours after drop off. Never ID numbers, documents, home address or emergency contacts. */
const RIDER_INFO_HOURS = 24;
const shortName = u => { const p = (u?.name || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : (p[0] || 'Rider'); };
function riderInfoOpen(b) { if (b.status === 'requested') return 'request'; if (['confirmed', 'picked'].includes(b.status)) return 'open'; if (b.status === 'completed' && Date.now() - (b.doneAt || 0) < RIDER_INFO_HOURS * 36e5) return 'open'; return 'closed'; }
function riderSheet(b) {
  const r = user(b.riderId), t = tripById(b.tripId), st = riderInfoOpen(b), parcel = b.type === 'parcel';
  b.viewLog = b.viewLog || []; b.viewLog.push({ by: me.id, at: Date.now() }); save();
  const hidden = txt => `<span class="muted">${ic('lock', 'sm')} ${txt}</span>`;
  modal(`${sheetHead(parcel ? 'Parcel sender' : 'Rider details', `${esc(short(t.fromTown))} → ${esc(short(t.toTown))} · ${fmtDate(t.date)} ${esc(t.time)}`)}
  <div class="row" style="gap:14px;margin-bottom:14px">${st === 'open' && r.docs?.selfie ? `<img src="${r.docs.selfie}" alt="Rider photo" class="rider-face" data-act="img">` : avatar(r, 'lg')}<div><b style="font-size:1.1rem">${esc(st === 'open' ? r.name : shortName(r))}</b><div class="row wrapx" style="gap:6px;margin-top:4px">${verifiedBadge(r)}${rateHTML(r.id)}</div>${st === 'open' ? '<div class="xs muted" style="margin-top:4px">Check this face at pickup</div>' : ''}</div></div>
  <dl class="kv" style="font-size:.9rem">
    <dt>Booking</dt><dd>${parcel ? 'Parcel' : b.seats + ' seat(s)'} · ${b.bags} bag(s) + ${b.bigBags} extra large</dd>
    <dt>Phone</dt><dd>${st === 'open' ? `<a href="tel:${esc(r.phone)}"><b>${esc(r.phone)}</b></a>` : hidden(st === 'request' ? 'Shown once you accept' : 'Removed after the trip')}</dd>
    <dt>Pickup</dt><dd>${st === 'open' ? esc(b.pickup) + (b.pickupPin ? `<br><a class="xs b" target="_blank" rel="noopener" href="${gmaps(b.pickupPin)}">${ic('nav', 'sm')} Navigate to pin</a>` : '') : `${esc(short(t.fromTown))} area · ` + hidden(st === 'request' ? 'exact address once you accept' : 'removed after the trip')}</dd>
    <dt>Drop off</dt><dd>${st === 'open' ? esc(b.dropoff) + (b.dropPin ? `<br><a class="xs b" target="_blank" rel="noopener" href="${gmaps(b.dropPin)}">${ic('nav', 'sm')} Navigate</a>` : '') : `${esc(short(t.toTown))} area · ` + hidden(st === 'request' ? 'exact address once you accept' : 'removed after the trip')}</dd>
    ${parcel ? `<dt>Receiver</dt><dd>${st === 'open' ? `${esc(b.recvName)} · <a href="tel:${esc(b.recvPhone)}">${esc(b.recvPhone)}</a>` : hidden('Shown while the parcel is active')}</dd>` : ''}
    ${b.luggageDesc ? `<dt>Luggage</dt><dd>${esc(b.luggageDesc)}</dd>` : ''}
    ${b.note ? `<dt>Note</dt><dd>${esc(b.note)}</dd>` : ''}
    <dt>Payment</dt><dd>${b.pay === 'online' ? 'Paid in the app' : 'Cash at pickup'} · fare ${R(b.fare)}</dd>
  </dl>
  ${b.luggagePhoto ? `<div class="thumbs" style="margin-top:12px"><figure><img class="thumb" src="${b.luggagePhoto}" data-act="img" alt="Luggage"><figcaption>${parcel ? 'Parcel' : 'Luggage'} photo</figcaption></figure></div>` : ''}
  <div class="popia"><b>${ic('shield', 'sm')} POPIA: protect your rider's information</b><ul><li>Use it only to do this trip.</li><li>Don't save their number, screenshot, share or post it.</li><li>Phone and exact addresses disappear ${RIDER_INFO_HOURS} hours after drop off.</li><li>Their ID number, documents, home address and emergency contact are never shown to drivers.</li></ul><span class="xs muted">Each time you open this page it is recorded for the safety team.</span></div>`);
}

function driverBooking(b) {
  const r = user(b.riderId), rated = db.reviews.some(x => x.bookingId === b.id && x.from === me.id), parcel = b.type === 'parcel';
  const unread = db.messages.filter(m => m.bookingId === b.id && m.from !== me.id && !(m.readBy || []).includes(me.id)).length;
  const money = b.pay === 'online' ? `Paid online · <b>${R(b.driverNet)}</b> to you after drop off` : `Collect <b>${R(b.total)}</b> cash · ${R(b.commission + b.riderFee)} from wallet`;
  return `<div class="card bk" style="box-shadow:none"><div class="bk-status ${b.status}"></div>
    <div class="bk-top"><div class="row">${avatar(r)}<div><b class="small">${esc(riderInfoOpen(b) === 'open' ? r.name : shortName(r))}</b><div class="row wrapx" style="gap:6px">${rateHTML(r.id)}${verifiedBadge(r)}</div></div></div>${statusBadge(b.status)}</div>
    <div class="bk-mid">
      <dl class="kv" style="font-size:.84rem">
        <dt>Booking</dt><dd>${parcel ? 'Parcel' : b.seats + ' seat(s)'} · fare ${R(b.fare)}</dd>
        <dt>Payment</dt><dd>${money}</dd>
        <dt>Pickup</dt><dd>${riderInfoOpen(b) !== 'open' ? `${esc(short(tripById(b.tripId).fromTown))} area <span class="xs muted">${ic('lock', 'sm')} ${b.status === 'requested' ? 'exact address once you accept' : 'hidden after the trip (POPIA)'}</span>` : esc(b.pickup) + (b.pickupPin ? `<br><a class="xs b" target="_blank" rel="noopener" href="${gmaps(b.pickupPin)}">${ic('nav', 'sm')} Navigate to pin (${near(b.pickupPin)})</a>` : '<br><span class="xs muted">No map pin, call the rider</span>')}</dd>
        <dt>Drop off</dt><dd>${riderInfoOpen(b) !== 'open' ? `${esc(short(tripById(b.tripId).toTown))} area` : esc(b.dropoff) + (b.dropPin ? `<br><a class="xs b" target="_blank" rel="noopener" href="${gmaps(b.dropPin)}">${ic('nav', 'sm')} Navigate (${near(b.dropPin)})</a>` : '')}</dd>
        ${parcel ? `<dt>Receiver</dt><dd>${riderInfoOpen(b) === 'open' ? esc(b.recvName) + ' · ' + esc(b.recvPhone) : `<span class="xs muted">${ic('lock', 'sm')} hidden</span>`}</dd>` : ''}
        <dt>Luggage</dt><dd>${b.bags} bag(s) + ${b.bigBags} XL${b.luggageDesc ? ' · ' + esc(b.luggageDesc) : ''}</dd>
        ${b.note ? `<dt>Note</dt><dd>${esc(b.note)}</dd>` : ''}
        ${riderInfoOpen(b) === 'open' ? `<dt>Phone</dt><dd><a href="tel:${esc(r.phone)}">${esc(r.phone)}</a></dd>` : ''}
      </dl>
      ${b.luggagePhoto ? `<div class="thumbs" style="margin-top:10px"><figure><img class="thumb" src="${b.luggagePhoto}" data-act="img" alt="Luggage"><figcaption>Luggage</figcaption></figure></div>` : ''}
    </div>
    <div class="bk-act">
      <button class="btn btn-sm btn-soft" data-act="riderInfo" data-id="${b.id}">${ic('id', 'sm')} ${parcel ? 'Sender' : 'Rider'} details</button>
      ${b.status === 'requested' ? `<button class="btn btn-sm" data-act="accept" data-id="${b.id}">${ic('check', 'sm')} Accept</button><button class="btn btn-sm btn-ghost" data-act="decline" data-id="${b.id}">Decline</button>` : ''}
      ${b.status === 'confirmed' ? `<button class="btn btn-sm btn-accent" data-act="pickup" data-id="${b.id}">${ic('lock', 'sm')} ${parcel ? 'Collected parcel' : 'Start: enter PIN'}</button>` : ''}
      ${b.status === 'picked' ? `<a class="btn btn-sm btn-ghost" href="#/live/${b.id}">${ic('nav', 'sm')} Live</a><button class="btn btn-sm" data-act="dropoff" data-id="${b.id}">${ic('pin', 'sm')} ${parcel ? 'Deliver: enter code' : 'Dropped off'}</button>` : ''}
      ${ACTIVE.includes(b.status) ? `<button class="btn btn-sm btn-ghost" data-act="chat" data-id="${b.id}">${ic('msg', 'sm')} Chat${unread ? ' · ' + unread : ''}</button>` : ''}
      ${b.status === 'completed' && !rated && !parcel ? `<button class="btn btn-sm btn-accent" data-act="rate" data-id="${b.id}">${ic('star', 'sm')} Rate rider</button>` : ''}
    </div></div>`;
}

/* riders looking for a lift, grouped by route and day, so one trip can collect everyone in the same area */
function reqGroups(reqs) {
  const g = {};
  reqs.forEach(r => { const k = [r.fp, r.tp, r.date || ''].join('|'); (g[k] = g[k] || { fp: r.fp, tp: r.tp, date: r.date || '', list: [] }).list.push(r); });
  return Object.values(g).sort((a, b) => b.list.length - a.list.length || (a.date || '9').localeCompare(b.date || '9'));
}
function reqGroupsHTML(reqs) {
  const gs = reqGroups(reqs);
  if (!gs.length) return `<div class="card pad-lg" style="text-align:center">${ic('users')}<h3 style="margin:8px 0 4px">No riders waiting right now</h3><p class="muted small">When a rider asks for a lift you get a notification, and they show up here.</p></div>`;
  return `<p class="muted small" style="margin-bottom:12px">Riders asking for a lift. Post one trip for a route and every rider on it is told straight away, plus anyone else who searches that route.</p><div class="grid g3">${gs.map(g => {
    const towns = [...new Set(g.list.map(r => r.ft).filter(Boolean))], drops = [...new Set(g.list.map(r => r.tt).filter(Boolean))], seats = g.list.reduce((a, r) => a + (r.seats || 1), 0);
    const link = `#/post?fp=${encodeURIComponent(g.fp)}&ft=${encodeURIComponent(towns[0] || '')}&tp=${encodeURIComponent(g.tp)}&tt=${encodeURIComponent(drops[0] || '')}&date=${g.date}&from=req`;
    return `<div class="card"><div class="row" style="gap:6px"><div class="faces">${g.list.slice(0, 4).map(r => avatar(user(r.riderId), 'sm')).join('')}</div><b class="small">${g.list.length} rider${g.list.length === 1 ? '' : 's'} · ${seats} seat${seats === 1 ? '' : 's'}</b></div>
      <h3 style="margin:12px 0 2px">${esc(short(towns[0] || g.fp))} → ${esc(short(drops[0] || g.tp))}</h3>
      <p class="muted small">${g.date ? fmtDate(g.date) : 'Flexible date'}${towns.length > 1 ? `<br>Pick up: ${esc(towns.map(short).join(', '))}` : ''}${drops.length > 1 ? `<br>Drop off: ${esc(drops.map(short).join(', '))}` : ''}</p>
      <a class="btn btn-sm btn-accent" style="margin-top:12px" href="${link}">${ic('plus', 'sm')} Post this trip</a></div>`;
  }).join('')}</div>`;
}
V.post = q => {
  if (!me) return V.login({ next: '#/post' });
  if (me.role !== 'driver') return `<div class="wrap page"><div class="banner info">${ic('info')}Only driver accounts can post trips.<a class="btn btn-sm" href="#/signup?role=driver">Register as a driver</a></div></div>`;
  if (me.status !== 'verified') return `<div class="wrap page"><div class="page-head"><h2>Post a trip</h2></div><div class="banner warn">${ic('id')}Your driver account must be verified before you can post trips.<a class="btn btn-sm" href="#/verify">Go to verification</a></div></div>`;
  const v = me.vehicle || {}, fp = q.fp || VENDA, tp = q.tp || 'Gauteng';
  const ft = q.ft || towns(fp)[0], tt = q.tt || towns(tp)[0], r = routeSync(coord(fp, ft), coord(tp, tt));
  const waiting = (db.requests || []).filter(x => x.fp === fp && x.tp === tp && (!x.date || !q.date || x.date === q.date) && (!x.date || x.date >= today()));
  const wTowns = [...new Set(waiting.map(x => x.ft).filter(Boolean).map(short))], wDrops = [...new Set(waiting.map(x => x.tt).filter(Boolean).map(short))];
  return `<div class="wrap page" style="max-width:820px">
    <div class="page-head"><h2>Post a trip</h2><p>You set the price. Trips must start or end in Venda.</p></div>
    ${waiting.length ? `<div class="banner info" style="margin-bottom:14px">${ic('users')}<span><b>${waiting.length} rider${waiting.length === 1 ? ' is' : 's are'} waiting</b> for a lift on this route${q.date ? ' that day' : ''}. They'll be told the moment you post.</span></div>` : ''}
    <form id="postForm" class="card pad-lg">
      <div class="card-title">${ic('route')}<h3>Route</h3></div>
      ${placePicker('from', 'From', fp, ft)}
      <div class="field"><label>Areas you'll pick up from</label><input name="pickupArea" placeholder="e.g. Thohoyandou, Sibasa, Shayandima, door to door" value="${wTowns.length ? esc(wTowns.join(', ') + ', door to door') : ''}"></div>
      ${placePicker('to', 'To', tp, tt)}
      <div class="field"><label>Areas you'll drop off in</label><input name="dropArea" placeholder="e.g. Joburg CBD, Soweto, Midrand, door to door" value="${wDrops.length ? esc(wDrops.join(', ') + ', door to door') : ''}"></div>
      <div class="note" id="routeInfo">${ic('route')}<span>About <b>${Math.round(r.km)} km</b> · <b>${fmtDur(r.min)}</b> driving. Suggested price: <b>${R(suggestPrice(r.km) - 30)} to ${R(suggestPrice(r.km) + 40)}</b> per seat.</span></div>
      <div class="card-title" style="margin-top:22px">${ic('cal')}<h3>When</h3></div>
      <div class="grid g4"><div class="field"><label>Date</label><input type="date" name="date" min="${today()}" value="${esc(q.date || '')}" required></div><div class="field"><label>Departure</label><input type="time" name="time" required></div><div class="field"><label>Arrival (optional)</label><input type="time" name="arrive"><div class="hint">We estimate it if blank</div></div><div class="field"><label>Seats to sell</label><input type="number" name="seats" min="1" max="${v.seats || 4}" value="${Math.min(4, v.seats || 4)}" required></div></div>
      <div class="card-title" style="margin-top:12px">${ic('wallet')}<h3>Your prices</h3></div>
      <div class="grid g3"><div class="field"><label>Price per seat (R)</label><input type="number" name="price" min="50" max="3000" step="10" required value="${suggestPrice(r.km)}"></div><div class="field"><label>Extra large bag fee (R)</label><input type="number" name="bagFee" min="0" step="10" value="50"></div><div class="field"><label>Parcel price (R), 0 for none</label><input type="number" name="parcelPrice" min="0" step="10" value="150"></div></div>
      <div class="grid g2"><div class="field"><label>Bags allowed per rider</label><select name="maxBags">${[1, 2, 3, 4].map(n => `<option ${n === 2 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Payments</label><label class="check" style="margin-top:8px"><input type="checkbox" name="acceptsCash" ${me.acceptsCash !== false ? 'checked' : ''}> Also accept cash at pickup <span class="xs muted">(fee comes off your wallet)</span></label><div class="hint">In app payments are always on, held until drop off, paid out every Tuesday.</div></div></div>
      <div class="card-title" style="margin-top:8px">${ic('sliders')}<h3>Trip rules & comfort</h3></div>
      <div class="togs">${['No smoking', 'No alcohol', 'Seatbelts on', 'Stops every 2 hours', 'Aircon', 'Charging ports', 'Big boot', 'Pets allowed'].map((x, i) => `<label class="tog"><input type="checkbox" name="rules" value="${x}" ${i < 3 ? 'checked' : ''}><span>${x}</span></label>`).join('')}</div>
      ${me.gender === 'Female' ? `<label class="check" style="margin-top:14px"><input type="checkbox" name="womenOnly"> Women only trip (only female riders can book)</label>` : ''}
      <div class="field" style="margin-top:16px"><label>Notes for riders</label><textarea name="notes" placeholder="e.g. We stop at Polokwane Engen for 15 min."></textarea></div>
      <div class="row" style="margin-bottom:16px;background:#fafcfb;border-radius:14px;padding:10px 14px">${carSVG(v, 'max-width:110px')}<div><b class="small">${esc(v.colour)} ${esc(v.make)}</b><div><span class="plate">${esc(v.reg)}</span></div></div></div>
      <button class="btn btn-accent btn-block btn-lg">Publish trip</button>
    </form>
  </div>`;
};

V.live = id => {
  const b = bookingById(id);
  if (!b || !me || (me.id !== b.riderId && me.id !== tripById(b.tripId)?.driverId)) return `<div class="wrap page">${empty('lock', 'Trip not available', 'Log in with the rider or driver account for this trip.', '<a class="btn" href="#/dashboard">My trips</a>')}</div>`;
  const t = tripById(b.tripId), d = user(t.driverId), r = user(b.riderId), other = me.id === d.id ? r : d;
  afterRender.push(() => mountLive(b));
  return `<div class="live"><div id="liveMap" class="map tall"></div>
    <div class="live-sheet">
      <div class="row between"><div><span class="step-label">${b.status === 'picked' ? 'On the road' : 'Trip'}</span><h3>Heading to ${esc(short(t.toTown))}</h3></div>${statusBadge(b.status)}</div>
      <div class="small muted" id="lvEta" style="margin:4px 0 12px">Calculating route…</div>
      <div class="prog"><i id="lvProg" style="width:0%"></i></div>
      <div class="row" style="margin-top:16px">${avatar(other)}<div><b class="small">${esc(other.name)}</b><div class="xs muted">${me.id === d.id ? 'Your rider' : esc(d.vehicle.colour + ' ' + d.vehicle.make)}</div></div><span class="plate ml-auto">${esc(d.vehicle.reg)}</span></div>
      <div class="note" style="margin-top:12px">${ic('pin')}<span class="small">Drop off: ${esc(b.dropoff)}</span></div>
      <div class="row" style="margin-top:14px;gap:8px">
        <a class="btn btn-soft btn-sm" style="flex:1" href="tel:${esc(other.phone)}">${ic('phone', 'sm')} Call</a>
        <button class="btn btn-soft btn-sm" style="flex:1" data-act="chat" data-id="${b.id}">${ic('msg', 'sm')} Chat</button>
        ${me.id === b.riderId ? `<button class="btn btn-soft btn-sm" style="flex:1" data-act="share" data-id="${b.id}">${ic('share', 'sm')} Share</button>` : (b.status === 'picked' ? `<button class="btn btn-sm" style="flex:1" data-act="dropoff" data-id="${b.id}">${ic('check', 'sm')} Done</button>` : '')}
      </div>
      <button class="btn btn-danger btn-block" style="margin-top:8px" data-act="sos">${ic('alert', 'sm')} SOS emergency</button>
      ${TEST_MODE ? `<div class="row" style="justify-content:center;margin-top:10px;gap:6px"><span class="xs muted">Test mode · replay speed:</span>${[1, 10, 60].map(x => `<button class="chip ${liveSpeed === x ? 'on' : ''}" data-act="speed" data-x="${x}" style="padding:4px 10px">${x === 1 ? '1 s = 1 min' : x + '×'}</button>`).join('')}</div>` : ''}
    </div></div>`;
};

/* ---------------- Admin dashboard ---------------- */
const roundTop = (x, y, w, h, r) => { r = Math.min(r, w / 2, h); return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`; };
function barSVG(rows, { h = 210, fmt = v => v, series = null, every = 1 } = {}) {
  const W = 640, P = { l: 44, r: 8, t: 10, b: 26 }, iw = W - P.l - P.r, ih = h - P.t - P.b;
  const tot = r => series ? r.a + r.b : r.v, max = Math.max(1, ...rows.map(tot)), step = Math.pow(10, Math.floor(Math.log10(max))), nice = Math.ceil(max / step) * step || 1;
  const bw = iw / rows.length, w = Math.max(3, Math.min(28, bw - 3)), y = v => P.t + ih - v / nice * ih;
  let s = `<svg viewBox="0 0 ${W} ${h}" class="chart" role="img">`;
  for (let i = 0; i <= 4; i++) { const v = nice * i / 4, yy = y(v); s += `<line x1="${P.l}" x2="${W - P.r}" y1="${yy}" y2="${yy}" stroke="#e5eae6" stroke-width="1"/><text x="${P.l - 8}" y="${yy + 4}" text-anchor="end" class="ax">${fmt(v)}</text>`; }
  rows.forEach((r, i) => {
    const x = P.l + i * bw + (bw - w) / 2, tip = series ? `${r.l} · ${series[0]} ${fmt(r.a)} · ${series[1]} ${fmt(r.b)} · total ${fmt(r.a + r.b)}` : `${r.l} · ${fmt(r.v)}`;
    if (series) { const ya = y(r.a), yb = y(r.a + r.b); if (r.a) s += `<path d="${roundTop(x, ya, w, P.t + ih - ya, r.b ? 0 : 4)}" fill="#13784b"/>`; if (r.b) s += `<path d="${roundTop(x, yb, w, Math.max(0, ya - yb - 2), 4)}" fill="#e09a00"/>`; }
    else if (r.v) s += `<path d="${roundTop(x, y(r.v), w, P.t + ih - y(r.v), 4)}" fill="#13784b"/>`;
    s += `<rect x="${P.l + i * bw}" y="${P.t}" width="${bw}" height="${ih}" fill="transparent" data-tip="${esc(tip)}"/>`;
    if (i % every === 0) s += `<text x="${x + w / 2}" y="${h - 8}" text-anchor="middle" class="ax">${esc(r.s || r.l)}</text>`;
  });
  return s + `<line x1="${P.l}" x2="${W - P.r}" y1="${P.t + ih}" y2="${P.t + ih}" stroke="#c8d2cb"/></svg>`;
}
const hbars = (rows, fmt = v => v) => { const max = Math.max(1, ...rows.map(r => r.v)); return `<div class="hbars">${rows.map(r => `<div class="hb" data-tip="${esc(r.l)} · ${fmt(r.v)}"><span class="hb-l">${esc(r.l)}</span><span class="hb-t"><i style="width:${r.v / max * 100}%"></i></span><b>${fmt(r.v)}</b></div>`).join('')}</div>`; };
const dirOf = t => t.fromProv === VENDA ? 'from' : t.toProv === VENDA ? 'to' : 'other';
function adminStats() {
  const done = db.bookings.filter(b => b.status === 'completed'), T = b => tripById(b.tripId);
  const rev = b => b.riderFee + b.commission;
  const byDriver = {}, byRider = {}, byRoute = {};
  done.forEach(b => {
    const t = T(b), d = t.driverId, rk = short(t.fromTown) + ' → ' + short(t.toTown);
    const D = byDriver[d] = byDriver[d] || { id: d, trips: new Set(), pax: 0, parcels: 0, net: 0, fees: 0 }; D.trips.add(t.id); b.type === 'parcel' ? D.parcels++ : D.pax += b.seats; D.net += b.driverNet; D.fees += rev(b);
    const Rr = byRider[b.riderId] = byRider[b.riderId] || { id: b.riderId, trips: 0, spent: 0, last: null, dest: {} }; Rr.trips++; Rr.spent += b.total; if (!Rr.last || b.doneAt > Rr.last.doneAt) Rr.last = b; Rr.dest[short(t.toTown)] = (Rr.dest[short(t.toTown)] || 0) + 1;
    const RT = byRoute[rk] = byRoute[rk] || { l: rk, v: 0, a: tripA(t), b: tripB(t), gmv: 0 }; RT.v += b.type === 'parcel' ? 0 : b.seats; RT.gmv += b.fare;
  });
  return { done, rev, byDriver: Object.values(byDriver), byRider: Object.values(byRider), byRoute: Object.values(byRoute).sort((a, b) => b.v - a.v) };
}
let logF = { q: '', status: 'all', type: 'all', dir: 'all', period: '30' };
function logRows() {
  const since = logF.period === 'all' ? 0 : Date.now() - +logF.period * 864e5, q = logF.q.trim().toLowerCase();
  return db.bookings.map(b => ({ b, t: tripById(b.tripId) })).filter(({ b, t }) => t && (logF.status === 'all' || (logF.status === 'active' ? ACTIVE.includes(b.status) : b.status === logF.status)) && (logF.type === 'all' || b.type === logF.type) && (logF.dir === 'all' || dirOf(t) === logF.dir)
    && (!q || [user(b.riderId)?.name, user(t.driverId)?.name, t.fromTown, t.toTown, b.id, user(t.driverId)?.vehicle?.reg].join(' ').toLowerCase().includes(q)) && (logF.period === 'all' || depTime(t) >= since || ACTIVE.includes(b.status)))
    .sort((x, y) => depTime(y.t) - depTime(x.t));
}
function logBody() {
  const rows = logRows();
  return [rows.length, rows.slice(0, 200).map(({ b, t }) => { const r = user(b.riderId), d = user(t.driverId); return `<tr data-act="bk" data-id="${b.id}"><td><b>${fmtDate(t.date)}</b><br><span class="xs muted">${esc(t.time)}</span></td><td><div class="row">${avatar(r, 'sm')}<span>${esc(r.name)}</span></div></td><td><span>${esc(d.name)}</span><br><span class="xs muted">${esc(d.vehicle.reg)}</span></td><td><b>${esc(short(t.fromTown))} → ${esc(short(t.toTown))}</b></td><td>${b.type === 'parcel' ? '📦 Parcel' : b.seats + ' seat' + (b.seats > 1 ? 's' : '')}</td><td><b>${R(b.total)}</b><br><span class="xs muted">${b.pay === 'online' ? b.payMethod : 'Cash'}</span></td><td>${statusBadge(b.status)}</td></tr>`; }).join('') || `<tr><td colspan="7" class="muted" style="text-align:center;padding:30px">No trips match these filters.</td></tr>`];
}
V.admin = q => {
  if (me?.role !== 'admin') return `<div class="wrap page"><div class="banner bad">Admins only.</div></div>`;
  const tab = q.tab || 'overview', S = adminStats(), pending = db.users.filter(u => u.status === 'pending');
  const openSOS = db.alerts.filter(a => !a.resolved), shares = db.bookings.filter(b => b.share?.active);
  const tabs = tabsHTML(tab, [['overview', 'Overview'], ['trips', 'Trips log'], ['verify', `Verification${pending.length ? ' · ' + pending.length : ''}`], ['users', 'Users'], ['safety', `Safety${openSOS.length ? ' · ' + openSOS.length : ''}`], ['money', 'Money']]);
  let body = '';
  if (tab === 'overview') {
    const trips = new Set(S.done.map(b => b.tripId)), pax = S.done.reduce((a, b) => a + b.seats, 0), parcels = S.done.filter(b => b.type === 'parcel').length, gmv = S.done.reduce((a, b) => a + b.fare, 0), rev = S.done.reduce((a, b) => a + S.rev(b), 0);
    const days = Array.from({ length: 30 }, (_, i) => addDays(i - 29)).map(d => ({ l: fmtDate(d), s: d.slice(8), v: S.done.filter(b => iso(b.doneAt) === d).reduce((a, b) => a + (b.type === 'parcel' ? 1 : b.seats), 0) }));
    const weeks = Array.from({ length: 7 }, (_, i) => { const end = Date.now() - (6 - i) * 7 * 864e5, st = end - 7 * 864e5, bs = S.done.filter(b => b.doneAt > st && b.doneAt <= end); return { l: 'Week of ' + new Date(st + 864e5).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }), s: new Date(st + 864e5).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }), a: bs.reduce((x, b) => x + b.riderFee, 0), b: bs.reduce((x, b) => x + b.commission, 0) }; });
    afterRender.push(() => mountRouteVolume(S.byRoute));
    const drivers = S.byDriver.sort((a, b) => b.pax - a.pax), riders = S.byRider.sort((a, b) => b.trips - a.trips).slice(0, 10);
    body = `${approvalsPanel(pending)}<div class="kpis k8">
      <div class="kpi dark"><span class="ic">${ic('route')}</span><b>${trips.size}</b><span>Trips completed (45 days)</span></div>
      <div class="kpi"><span class="ic">${ic('users')}</span><b>${pax}</b><span>Passengers carried</span></div>
      <div class="kpi"><span class="ic">${ic('pkg')}</span><b>${parcels}</b><span>Parcels delivered</span></div>
      <div class="kpi"><span class="ic">${ic('wallet')}</span><b>${R(gmv)}</b><span>Fares paid to drivers</span></div>
      <div class="kpi"><span class="ic" style="background:var(--accent-50);color:#8a5a00">${ic('bolt')}</span><b>${R(rev)}</b><span>Platform revenue</span></div>
      <div class="kpi"><span class="ic">${ic('car')}</span><b>${db.users.filter(u => u.role === 'driver' && u.status === 'verified').length}</b><span>Verified drivers</span></div>
      <div class="kpi"><span class="ic">${ic('user')}</span><b>${db.users.filter(u => u.role === 'rider').length}</b><span>Riders</span></div>
      <div class="kpi ${openSOS.length ? 'neg' : ''}"><span class="ic" style="background:var(--danger-50);color:var(--danger)">${ic('alert')}</span><b>${openSOS.length}</b><span>Open SOS alerts</span></div>
    </div>
    <div class="admin-grid">
      <div class="card pad-lg"><div class="card-title">${ic('cal')}<h3>Passengers & parcels delivered per day</h3><span class="xs muted ml-auto">last 30 days</span></div>${barSVG(days, { every: 5 })}</div>
      <div class="card pad-lg"><div class="card-title">${ic('wallet')}<h3>Platform revenue per week</h3></div><div class="legend"><span><i style="background:#13784b"></i>Booking fees (riders)</span><span><i style="background:#e09a00"></i>Commission (drivers)</span></div>${barSVG(weeks, { series: ['Booking fees', 'Commission'], fmt: v => R(v) })}</div>
    </div>
    <div class="admin-grid">
      <div class="card pad-lg"><div class="card-title">${ic('route')}<h3>Where people travel</h3><span class="xs muted ml-auto">line thickness = passengers</span></div><div id="volMap" class="map" style="height:340px"></div></div>
      <div class="card pad-lg"><div class="card-title">${ic('route')}<h3>Top routes by passengers</h3></div>${hbars(S.byRoute.slice(0, 9))}</div>
    </div>
    <div class="admin-grid">
      <div class="card"><div class="card-title" style="padding:16px 16px 0">${ic('car')}<h3>Drivers: trips taken</h3></div><div class="table-wrap"><table><tr><th>Driver</th><th>Trips</th><th>Passengers</th><th>Parcels</th><th>Driver earned</th><th>Platform</th></tr>${drivers.map(x => { const d = user(x.id); return `<tr data-act="userSheet" data-id="${x.id}"><td><div class="row">${avatar(d, 'sm')}<span>${esc(d.name)}<br><span class="xs muted">${esc(d.vehicle.reg)}</span></span></div></td><td>${x.trips.size}</td><td>${x.pax}</td><td>${x.parcels}</td><td>${R(x.net)}</td><td>${R(x.fees)}</td></tr>`; }).join('')}</table></div></div>
      <div class="card"><div class="card-title" style="padding:16px 16px 0">${ic('users')}<h3>Who travelled where</h3></div><div class="table-wrap"><table><tr><th>Rider</th><th>Trips</th><th>Last trip</th><th>Goes to most</th><th>Spent</th></tr>${riders.map(x => { const r = user(x.id), lt = tripById(x.last.tripId), top = Object.entries(x.dest).sort((a, b) => b[1] - a[1])[0]; return `<tr data-act="userSheet" data-id="${x.id}"><td><div class="row">${avatar(r, 'sm')}<span>${esc(r.name)}</span></div></td><td>${x.trips}</td><td>${esc(short(lt.fromTown))} → ${esc(short(lt.toTown))}<br><span class="xs muted">${fmtDate(lt.date)}</span></td><td>${esc(top[0])} (${top[1]}×)</td><td>${R(x.spent)}</td></tr>`; }).join('')}</table></div></div>
    </div>`;
  }
  if (tab === 'trips') {
    const [n, rows] = logBody(), sel = (k, opts) => `<select data-lf="${k}">${opts.map(([v, l]) => `<option value="${v}" ${logF[k] === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
    body = `<div class="card" style="padding:14px"><div class="logf"><input data-lf="q" placeholder="Search rider, driver, town, plate…" value="${esc(logF.q)}">${sel('status', [['all', 'All statuses'], ['active', 'Active now'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['declined', 'Declined']])}${sel('type', [['all', 'Seats & parcels'], ['seat', 'Seats only'], ['parcel', 'Parcels only']])}${sel('dir', [['all', 'All directions'], ['from', 'Leaving Venda'], ['to', 'Going to Venda'], ['other', 'Other']])}${sel('period', [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['all', 'All time']])}<button class="btn btn-ghost btn-sm" data-act="logCsv">${ic('file', 'sm')} Copy CSV</button></div>
      <div class="xs muted" style="margin:10px 2px"><b id="logCount">${n}</b> bookings · tap a row for full details</div>
      <div class="table-wrap" style="padding:0"><table class="log"><thead><tr><th>Date</th><th>Rider</th><th>Driver</th><th>Route</th><th>What</th><th>Paid</th><th>Status</th></tr></thead><tbody id="logBody">${rows}</tbody></table></div></div>`;
  }
  if (tab === 'verify') {
    const chk = (ok, l) => `<li class="${ok ? 'ok' : 'bad'}">${ic(ok ? 'check' : 'x', 'sm')} ${l}</li>`;
    const soon = d => d && d <= addDays(60);
    const expiring = db.users.filter(u => u.role === 'driver' && u.status === 'verified' && (soon(u.licenceExpiry) || soon(u.prdpExpiry) || soon(u.vehicle?.discExpiry)));
    body = `<h3 style="margin:4px 0 12px">Waiting for review (${pending.length})</h3><div class="grid g2">${pending.map(vcardHTML).join('') || empty('check', 'All caught up', 'No documents waiting for review.')}</div>
      <h3 style="margin:26px 0 12px">Documents expiring within 60 days</h3>
      <div class="card table-wrap"><table><tr><th>Driver</th><th>Licence</th><th>PrDP</th><th>Licence disc</th></tr>${expiring.map(u => `<tr data-act="userSheet" data-id="${u.id}"><td>${esc(u.name)}</td>${[u.licenceExpiry, u.prdpExpiry, u.vehicle?.discExpiry].map(d => `<td>${soon(d) ? `<span class="badge b-accent">${esc(d)}</span>` : esc(d)}</td>`).join('')}</tr>`).join('') || '<tr><td colspan="4" class="muted">Nothing expiring soon.</td></tr>'}</table></div>`;
  }
  if (tab === 'users') {
    const role = q.role || 'all', list = db.users.filter(u => u.role !== 'admin' && (role === 'all' || u.role === role));
    const last = u => db.bookings.filter(b => b.status === 'completed' && (b.riderId === u.id || tripById(b.tripId)?.driverId === u.id)).sort((a, b) => b.doneAt - a.doneAt)[0];
    body = `<div class="filters">${[['all', 'Everyone'], ['rider', 'Riders'], ['driver', 'Drivers']].map(([k, l]) => `<a class="chip ${role === k ? 'on' : ''}" href="#/admin?tab=users&role=${k}">${l}</a>`).join('')}</div>
    <div class="card table-wrap"><table><tr><th>Name</th><th>Role</th><th>Status</th><th>Trips</th><th>Last trip</th><th>Rating</th></tr>${list.map(u => { const l = last(u), lt = l && tripById(l.tripId); return `<tr data-act="userSheet" data-id="${u.id}"><td><div class="row">${avatar(u, 'sm')}<span>${esc(u.name)}<br><span class="xs muted">${esc(u.phone)}</span></span></div></td><td>${u.role}</td><td>${verifiedBadge(u)}</td><td>${tripsDone(u.id)}</td><td>${lt ? `${esc(short(lt.fromTown))} → ${esc(short(lt.toTown))}<br><span class="xs muted">${fmtDate(lt.date)}</span>` : '<span class="muted">None</span>'}</td><td>${rateHTML(u.id)}</td></tr>`; }).join('')}</table></div>`;
  }
  if (tab === 'safety') {
    body = `<div class="grid g2" style="align-items:start">
      <div class="card pad-lg"><div class="card-title" style="color:var(--danger)">${ic('alert')}<h3>SOS alerts & concerns</h3></div>${db.alerts.slice().reverse().map((a, i) => `<div class="note ${a.resolved ? '' : 'new'}" style="flex-wrap:wrap"><span style="flex:1;min-width:200px"><b>${a.kind === 'concern' ? 'Concern' : 'SOS'} · ${esc(user(a.userId)?.name || a.by || 'Loved one')}</b> · ${esc(a.trip)}<br><span class="xs muted">${ago(a.at)}${a.loc ? ` · <a target="_blank" rel="noopener" href="https://maps.google.com/?q=${a.loc}">location</a>` : ''}${a.bookingId ? ` · <a href="#" data-act="bk" data-id="${a.bookingId}">trip details</a>` : ''}</span></span>${a.resolved ? '<span class="badge b-grey">Resolved</span>' : `<button class="btn btn-sm" data-act="resolve" data-i="${db.alerts.length - 1 - i}">Mark resolved</button>`}</div>`).join('') || '<p class="muted">No alerts. 🎉</p>'}</div>
      <div class="card pad-lg"><div class="card-title">${ic('nav')}<h3>Live location shares (${shares.length})</h3></div>${shares.map(b => { const t = tripById(b.tripId); return `<div class="sum-row"><span><b>${esc(user(b.riderId).name)}</b> → ${esc(b.share.name)}<br><span class="xs">${esc(short(t.fromTown))} → ${esc(short(t.toTown))} · ${b.status}</span></span><a class="btn btn-sm btn-soft" href="#/track/${b.share.code}">View</a></div>`; }).join('') || '<p class="muted small">Nobody is sharing right now.</p>'}</div>
    </div>`;
  }
  if (tab === 'money') {
    const done = S.done, on = done.filter(b => b.pay === 'online'), cash = done.filter(b => b.pay === 'cash');
    const sum = (a, k) => a.reduce((x, b) => x + (typeof k === 'function' ? k(b) : b[k]), 0), psp = Math.round(sum(on, b => b.total * .026 + 2));
    const gross = sum(done, 'riderFee') + sum(done, 'commission');
    const drivers = db.users.filter(u => u.role === 'driver'), pend = drivers.map(d => ({ d, v: db.bookings.filter(b => b.payout === 'pending' && tripById(b.tripId).driverId === d.id).reduce((a, b) => a + b.driverNet, 0) })).filter(x => x.v);
    const tops = (db.topups || []).filter(x => x.status === 'requested'), proReq = drivers.filter(d => d.proRequested);
    body = `${tops.length || proReq.length ? `<div class="grid g2" style="align-items:start;margin-bottom:16px">
      <div class="card pad-lg"><div class="card-title">${ic('wallet')}<h3>Top ups waiting (${tops.length})</h3></div>${tops.map(x => `<div class="sum-row"><span>${esc(user(x.driverId)?.name || 'Driver')} · <b>${R(x.amount)}</b><br><span class="xs">ref ${esc(x.ref)} · ${ago(x.at)}</span></span><button class="btn btn-sm" data-act="topupOk" data-id="${x.id}">Money received</button></div>`).join('') || '<p class="small muted">None</p>'}</div>
      <div class="card pad-lg"><div class="card-title">${ic('star')}<h3>Pro requests (${proReq.length})</h3></div>${proReq.map(d => `<div class="sum-row"><span>${esc(d.name)}<br><span class="xs">${d.pro ? 'Wants to cancel' : 'Wants Pro'} · wallet ${R(d.wallet?.balance || 0)}</span></span><button class="btn btn-sm" data-act="setPro" data-id="${d.id}" data-on="${d.pro ? 0 : 1}">${d.pro ? 'Switch off' : 'Switch on'}</button></div>`).join('') || '<p class="small muted">None</p>'}</div></div>` : ''}<div class="grid g2" style="align-items:start">
      <div class="card pad-lg"><div class="card-title">${ic('wallet')}<h3>Revenue (last 45 days)</h3></div>
        <div class="sum-row"><span>Booking fees paid by riders</span><b>${R(sum(done, 'riderFee'))}</b></div>
        <div class="sum-row"><span>Commission: online trips</span><b>${R(sum(on, 'commission'))}</b></div>
        <div class="sum-row"><span>Commission: cash trips (from wallets)</span><b>${R(sum(cash, 'commission'))}</b></div>
        <div class="sum-row"><span><b>Gross platform revenue</b></span><b>${R(gross)}</b></div>
        <div class="sum-row"><span>Payment provider fees (est. 2.6% + R2 per online payment)</span><b style="color:var(--danger)">${R(psp)}</b></div>
        <div class="total" style="margin-top:12px"><span>Net revenue</span><b>${R(gross - psp)}</b></div>
        <p class="xs muted">Fares: ${R(sum(done, 'fare'))} · Online ${Math.round(on.length / Math.max(1, done.length) * 100)}% / cash ${Math.round(cash.length / Math.max(1, done.length) * 100)}% of bookings · take rate ${(gross / Math.max(1, sum(done, 'total')) * 100).toFixed(1)}%</p></div>
      <div class="stack">
        <div class="card pad-lg"><div class="card-title">${ic('ticket')}<h3>Driver payouts due Tuesday</h3></div>${pend.map(x => `<div class="sum-row"><span>${esc(x.d.name)}</span><b>${R(x.v)}</b></div>`).join('') || '<p class="muted small">Nothing pending.</p>'}${pend.length ? `<button class="btn btn-block" style="margin-top:12px" data-act="runPayout">Run payout (${R(pend.reduce((a, x) => a + x.v, 0))})</button>` : ''}</div>
        <div class="card pad-lg"><div class="card-title">${ic('wallet')}<h3>Driver wallets</h3></div>${drivers.map(d => `<div class="sum-row"><span>${esc(d.name)} ${d.pro ? '<span class="badge b-dark">PRO</span>' : ''}</span><b style="color:${(d.wallet?.balance || 0) < 0 ? 'var(--danger)' : 'inherit'}">${R(d.wallet?.balance || 0)}${(d.wallet?.balance || 0) < 0 ? ' · blocked' : ''}</b></div>`).join('')}</div>
      </div></div>`;
  }
  return `<div class="wrap page">
    <div class="dash-head"><div><span class="eyebrow">${ic('shield', 'sm')} Trip To Venda team</span><h2 style="margin:0">Control room</h2><p class="muted small">Every trip, who took it, where to, the money and safety, in one place.</p></div></div>
    ${tabs}${body}</div>`;
};
function mountRouteVolume(routes) {
  const m = baseMap('volMap', { scrollWheelZoom: false }); if (!m) return;
  const max = Math.max(1, ...routes.map(r => r.v)), all = [];
  routes.forEach(r => { const line = routeSync(r.a, r.b).line; all.push(...line); L.polyline(line, { color: '#13784b', weight: 2 + r.v / max * 10, opacity: .55, lineCap: 'round' }).bindTooltip(`${r.l}: ${r.v} passengers`, { sticky: true }).addTo(m); });
  if (all.length) m.fitBounds(all, { padding: [20, 20], animate: false });
}
function vcardHTML(u) {
    const chk = (ok, l) => `<li class="${ok ? 'ok' : 'bad'}">${ic(ok ? 'check' : 'x', 'sm')} ${l}</li>`;
      const idc = u.idType === 'Passport' ? { ok: /^[A-Z0-9]{6,12}$/i.test(u.idNumber || ''), msg: 'Passport' } : checkSAID(u.idNumber), drv = u.role === 'driver', v = u.vehicle || {};
      const img = (src, l) => src ? `<figure><img class="thumb" src="${src}" data-act="img" alt="${l}"><figcaption>${l}</figcaption></figure>` : `<figure><div class="thumb ph">None</div><figcaption>${l}</figcaption></figure>`;
      const manual = ['Selfie matches the ID photo', 'Name on ID matches the account name', ...(drv ? ['Licence photo matches number & expiry', 'PrDP is category P and readable', 'Car on the photo is a ' + vLabel(v).toLowerCase() + ' (no minibuses or taxis)', 'Number plate on car photo matches ' + (v.reg || ''), 'Disc photo matches the vehicle'] : [])];
      return `<div class="card pad-lg vcard">
        <div class="row">${avatar(u)}<div><b>${esc(u.name)}</b> <span class="badge ${drv ? 'b-blue' : ''}">${u.role}</span><div class="xs muted">${esc(u.phone)} · ${esc(u.email)}</div></div></div>
        <div class="step-label" style="margin:14px 0 6px">Automatic checks</div>
        <ul class="checks">${chk(u.phoneVerified, window.Cloud?.on ? 'Email confirmed' : 'Cellphone verified by SMS')}${u.role === 'driver' ? chk(!!u.driverDecl, u.driverDecl ? `Driver declaration signed (no ranks, no touting, own licences) · ${new Date(u.driverDecl.at).toLocaleDateString('en-ZA')}` : 'Driver declaration not signed') + (u.opLicence ? chk(true, 'Operating licence / permit: ' + esc(u.opLicence)) : '') : ''}${''}${chk(idc.ok, idc.ok ? `${esc(u.idType)} valid${idc.age ? ` · born ${niceD(idc.dob)} · age ${idc.age}` : ''}` : 'ID number invalid')}${idc.age != null ? chk(idc.age >= (drv ? 21 : 18), `Age ${drv ? '21+ (PrDP rule)' : '18+'}`) : ''}${idc.gender ? chk(idc.gender === u.gender || u.gender === 'Prefer not to say', `Gender in ID (${idc.gender}) matches profile`) : ''}
          ${drv ? chk(licenceOK(u.licenceNo), `Licence ${esc(u.licenceNo || 'not given')} · code ${esc(u.licenceCode || 'not given')}`) + chk(future(u.licenceExpiry), `Licence expires ${niceD(u.licenceExpiry)}`) + chk(!!u.prdpNo && future(u.prdpExpiry), `PrDP ${esc(u.prdpNo || 'not given')} · expires ${niceD(u.prdpExpiry)}`) + chk(plateOK(v.reg), `Number plate ${esc(v.reg || 'not given')}`) + chk(future(v.discExpiry), `Licence disc expires ${niceD(v.discExpiry)}`) : ''}</ul>
        ${drv ? `<p class="small" style="margin-top:8px">🚗 ${esc(v.year || '')} ${esc(v.colour)} ${esc(v.make)} · ${esc(v.seats)} seats</p>` : ''}
        <div class="thumbs" style="margin-top:12px">${img(u.docs.idPhoto, 'ID')}${img(u.docs.selfie, 'Selfie')}${drv ? img(u.docs.licence, 'Licence') + img(u.docs.prdp, 'PrDP') + img(u.docs.disc, 'Disc') + img(u.docs.carPhoto, 'Car + plate') : ''}</div>
        <div class="step-label" style="margin:14px 0 6px">Your checks (tick all to approve)</div>
        <div class="manual">${manual.map(m => `<label class="check"><input type="checkbox" class="mchk"> ${esc(m)}</label>`).join('')}</div>
        <div class="btns" style="margin-top:14px"><button class="btn btn-sm" data-act="approve" data-id="${u.id}">${ic('check', 'sm')} Approve</button><button class="btn btn-sm btn-ghost" data-act="reject" data-id="${u.id}">Reject with reason</button></div>
      </div>`; }
function approvalsPanel(pending) {
  const drv = pending.filter(u => u.role === 'driver'), rid = pending.filter(u => u.role === 'rider');
  const row = u => { const [ok, all] = autoChecks(u), good = ok === all; return `<div class="ap-row">${avatar(u)}<div class="ap-who"><b>${esc(u.name)}</b><div class="row wrapx" style="gap:6px;margin-top:2px"><span class="badge ${u.role === 'driver' ? 'b-blue' : ''}">${u.role === 'driver' ? ic('car') + vLabel(u.vehicle) : ic('user') + 'Rider'}</span><span class="xs muted">sent ${ago(u.created || Date.now())}</span></div></div><span class="ap-auto ${good ? 'ok' : 'bad'}">${ic(good ? 'check' : 'alert', 'sm')} ${ok}/${all} auto checks</span><button class="btn btn-sm" data-act="reviewUser" data-id="${u.id}">Review</button></div>`; };
  return `<div class="card pad-lg approvals"><div class="ap-head"><div class="card-title" style="margin:0">${ic('shield')}<h3>Waiting for approval</h3></div><div class="row wrapx" style="gap:8px"><span class="badge b-blue">${ic('car')}${drv.length} driver${drv.length === 1 ? '' : 's'}</span><span class="badge">${ic('user')}${rid.length} rider${rid.length === 1 ? '' : 's'}</span><a class="btn btn-sm btn-ghost" href="#/admin?tab=verify">Open Verification ›</a></div></div>
    ${pending.length ? `<div class="ap-cols">${[['Drivers', drv, 'car'], ['Riders', rid, 'user']].map(([l, list, icn]) => `<div><div class="step-label" style="margin:14px 0 8px">${l} (${list.length})</div>${list.map(row).join('') || `<p class="small muted">No ${l.toLowerCase()} waiting.</p>`}</div>`).join('')}</div>` : `<div class="note" style="margin-top:12px">${ic('check')}<span class="small"><b>All caught up.</b> Nobody is waiting for approval.</span></div>`}
  </div>`;
}
function autoChecks(u) {
  const drv = u.role === 'driver', idc = u.idType === 'Passport' ? { ok: /^[A-Z0-9]{6,12}$/i.test(u.idNumber || '') } : checkSAID(u.idNumber), d = u.docs || {}, v = u.vehicle || {};
  const list = [u.phoneVerified, idc.ok, idc.age == null || idc.age >= (drv ? 21 : 18), !!d.idPhoto && !!d.selfie];
  if (drv) list.push(licenceOK(u.licenceNo), future(u.licenceExpiry), !!u.prdpNo && future(u.prdpExpiry), plateOK(v.reg || ''), future(v.discExpiry), !!(d.licence && d.prdp && d.disc && d.carPhoto), (v.seats || 0) <= (VTYPES[vType(v)]?.max || 4));
  return [list.filter(Boolean).length, list.length];
}
function bkSheet(id) {
  const b = bookingById(id), t = tripById(b.tripId), r = user(b.riderId), d = user(t.driverId);
  const tl = [['Booked', b.created], ['Picked up', b.pickedAt], ['Arrived', b.doneAt]].filter(x => x[1]);
  modal(`${sheetHead(`${esc(short(t.fromTown))} → ${esc(short(t.toTown))}`, `${fmtDate(t.date)} · ${esc(t.time)} · ref ${b.id.toUpperCase()}`)}
    <div class="row between" style="margin-bottom:12px">${statusBadge(b.status)}${payBadge(b)}</div>
    <div class="grid g2" style="margin-bottom:12px"><div class="note">${avatar(r, 'sm')}<span class="small"><b>Rider</b><br>${esc(r.name)}<br>${esc(r.phone)}</span></div><div class="note">${avatar(d, 'sm')}<span class="small"><b>Driver</b><br>${esc(d.name)}<br><span class="plate" style="font-size:.7rem">${esc(d.vehicle.reg)}</span></span></div></div>
    <dl class="kv small"><dt>What</dt><dd>${b.type === 'parcel' ? `Parcel to ${esc(b.recvName)} (${esc(b.recvPhone)})` : b.seats + ' seat(s)'}</dd><dt>Pickup</dt><dd>${esc(b.pickup)}${b.pickupPin ? ` · ${near(b.pickupPin)}` : ''}</dd><dt>Drop off</dt><dd>${esc(b.dropoff)}${b.dropPin ? ` · ${near(b.dropPin)}` : ''}</dd><dt>Fare</dt><dd>${R(b.fare)}</dd><dt>Booking fee</dt><dd>${R(b.riderFee)}</dd><dt>Commission</dt><dd>${R(b.commission)} (${Math.round(b.rate * 100)}%)</dd><dt>Driver gets</dt><dd>${R(b.driverNet)}</dd><dt>Payment</dt><dd>${b.pay === 'online' ? esc(b.payMethod) + ' · ' + b.payStatus + (b.payout ? ' · payout ' + b.payout : '') : 'Cash · ' + b.payStatus}</dd>${b.share ? `<dt>Live share</dt><dd>${esc(b.share.name)} · ${b.share.active ? 'active' : 'ended'}</dd>` : ''}</dl>
    <div class="step-label" style="margin:14px 0 6px">Timeline</div>${tl.map(([l, at]) => `<div class="sum-row"><span>${l}</span><b>${new Date(at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b></div>`).join('')}
    <div class="step-label" style="margin:14px 0 6px">Privacy (POPIA)</div><div class="sum-row"><span>Driver opened the rider's details</span><b>${(b.viewLog || []).length ? (b.viewLog.length + ' time(s), last ' + new Date(b.viewLog[b.viewLog.length - 1].at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })) : 'never'}</b></div>
    ${(tripById(b.tripId).edits || []).length ? `<div class="sum-row"><span>Trip edited by the driver</span><b>${tripById(b.tripId).edits.length} time(s)</b></div>` : ''}
    ${b.luggagePhoto ? `<img src="${b.luggagePhoto}" style="width:100%;border-radius:14px;margin-top:12px" alt="Luggage">` : ''}`);
}
function userSheet(id) {
  const u = user(id), hist = db.bookings.filter(b => b.status === 'completed' && (b.riderId === id || tripById(b.tripId)?.driverId === id)).sort((a, b) => b.doneAt - a.doneAt), idc = u.idType !== 'Passport' ? checkSAID(u.idNumber) : null;
  modal(`${sheetHead(esc(u.name), `${u.role} · ${esc(u.phone)} · joined ${new Date(u.created).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}`)}
    <div class="row wrapx" style="gap:8px;margin-bottom:12px">${verifiedBadge(u)}${rateHTML(u.id)}${idc?.ok ? `<span class="badge b-grey">Age ${idc.age}</span>` : ''}${u.vehicle ? `<span class="plate">${esc(u.vehicle.reg)}</span>` : ''}</div>
    ${u.role === 'driver' ? `<p class="small muted" style="margin-bottom:10px">${esc(u.vehicle.colour)} ${esc(u.vehicle.make)} (${vLabel(u.vehicle)}) · licence exp. ${niceD(u.licenceExpiry)} · PrDP exp. ${niceD(u.prdpExpiry)} · wallet ${R(u.wallet?.balance || 0)}</p>` : ''}
    <div class="step-label" style="margin-bottom:6px">Trip history (${hist.length})</div>
    <div style="max-height:46vh;overflow:auto">${hist.map(b => { const t = tripById(b.tripId); return `<div class="sum-row" data-act="bk" data-id="${b.id}" style="cursor:pointer"><span><b>${esc(short(t.fromTown))} → ${esc(short(t.toTown))}</b><br><span class="xs">${fmtDate(t.date)} · ${u.role === 'driver' ? esc(user(b.riderId).name) : 'with ' + esc(user(t.driverId).name)} · ${b.type === 'parcel' ? 'parcel' : b.seats + ' seat(s)'}</span></span><b>${R(u.role === 'driver' ? b.driverNet : b.total)}</b></div>`; }).join('') || '<p class="muted small">No completed trips yet.</p>'}</div>`);
}

/* ---------------- Departures board: drivers' "I'm leaving" posts ---------------- */
const depTime = t => new Date(t.date + 'T' + t.time).getTime();
function leavesIn(t) { const m = Math.round((depTime(t) - Date.now()) / 60000); if (m <= 0) return 'leaving now'; if (m < 60) return `leaves in ${m} min`; if (m < 1440) return `leaves in ${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`; const d = Math.round(m / 1440); return `leaves in ${d} day${d > 1 ? 's' : ''}`; }
function tripLink(t) { return EMBED ? 'triptovenda.co.za/trip/' + t.id : location.href.split('#')[0] + '#/trip/' + t.id; }
function postText(t) {
  const d = user(t.driverId);
  return `🚗 LEAVING ${t.fromTown.toUpperCase()} ➜ ${t.toTown.toUpperCase()}\n📅 ${fmtDate(t.date)} · ${t.time} (arrive ±${arrival(t)})\n💺 ${seatsLeft(t)} seats · ${R(t.price)} per seat${t.parcelPrice ? `\n📦 Parcels ${R(t.parcelPrice)}` : ''}\n🚪 Door to door: ${t.pickupArea || t.fromTown}\n✅ ID verified driver · ${d.vehicle.colour} ${d.vehicle.make} (${vLabel(d.vehicle).toLowerCase()})\nBook on Trip To Venda 👉 ${tripLink(t)}`;
}
let boardTimer;
V.board = q => {
  const f = q.f || 'all', now = Date.now(), t0 = today(), t1 = addDays(1);
  const list = db.trips.filter(t => t.status === 'open' && depTime(t) > now - 30 * 60000 && seatsLeft(t) > 0
    && (f === 'all' || (f === 'from' && t.fromProv === VENDA) || (f === 'to' && t.toProv === VENDA) || (f === 'today' && t.date === t0) || (f === 'tomorrow' && t.date === t1) || (f === 'parcels' && t.parcelPrice)))
    .sort((a, b) => depTime(a) - depTime(b));
  const chips = [['all', 'All departures'], ['from', 'Leaving Venda'], ['to', 'Going to Venda'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['parcels', 'Takes parcels']];
  clearInterval(boardTimer); boardTimer = setInterval(() => document.querySelectorAll('[data-leaves]').forEach(el => { const t = tripById(el.dataset.leaves); if (t) el.textContent = leavesIn(t); }), 30000);
  return `<div class="wrap page">
    <div class="page-head row between wrapx"><div><span class="eyebrow">${ic('clock', 'sm')} Live departures</span><h2>Who's leaving soon</h2><p>Drivers post when they're leaving, what time and the price. Grab a seat before it's gone.</p></div>${me?.role === 'driver' ? `<a class="btn btn-accent" href="#/dashboard">${ic('send', 'sm')} Post “I'm leaving”</a>` : ''}</div>
    <div class="filters">${chips.map(([k, l]) => `<a class="chip ${f === k ? 'on' : ''}" href="#/board?f=${k}">${l}</a>`).join('')}</div>
    <div class="board">${list.map(t => { const d = user(t.driverId), left = seatsLeft(t); return `<article class="post">
      <div class="row">${avatar(d)}<div style="min-width:0"><b>${esc(d.name)}</b> <span class="muted small">is leaving</span>${d.pro ? ' <span class="badge b-dark">PRO</span>' : ''}<div class="xs muted">${rateHTML(d.id)} · posted ${ago(t.created)}</div></div><span class="leave ml-auto" data-leaves="${t.id}">${leavesIn(t)}</span></div>
      <a class="post-route" href="#/trip/${t.id}"><div><small>${esc(short(t.fromProv))}</small><b>${esc(short(t.fromTown))}</b></div><span>${ic('right')}</span><div><small>${esc(t.toProv)}</small><b>${esc(short(t.toTown))}</b></div></a>
      <div class="post-facts"><div><small>When</small><b>${t.date === t0 ? 'Today' : t.date === t1 ? 'Tomorrow' : fmtDate(t.date)} · ${esc(t.time)}</b></div><div><small>Price</small><b>${R(t.price)}<span class="xs muted">/seat</span></b></div><div><small>Seats</small><b>${left} left</b></div></div>
      <div class="meta" style="margin-top:0">${t.parcelPrice ? `<span class="badge b-grey">${ic('pkg')}Parcels ${R(t.parcelPrice)}</span>` : ''}${t.womenOnly ? `<span class="badge b-pink">${ic('venus')}Women only</span>` : ''}${t.acceptsCash ? `<span class="badge b-grey">${ic('wallet')}Cash OK</span>` : ''}<span class="badge b-grey">${esc(d.vehicle.colour)} ${esc(d.vehicle.make)} · ${vLabel(d.vehicle)}</span></div>
      <div class="row" style="gap:8px"><a class="btn btn-sm" style="flex:1" href="#/trip/${t.id}">Book a seat</a>${t.parcelPrice ? `<a class="btn btn-sm btn-ghost" href="#/trip/${t.id}?type=parcel">${ic('pkg', 'sm')} Parcel</a>` : ''}<button class="btn btn-sm btn-ghost" data-act="postShare" data-id="${t.id}" aria-label="Share">${ic('share', 'sm')}</button></div>
    </article>`; }).join('') || empty('clock', 'No departures for this filter', 'Try another filter, or request a lift and drivers will be notified.', '<a class="btn" href="#/search">Search all trips</a>')}</div>
  </div>`;
};
function openPostShare(id) {
  const t = tripById(id), text = postText(t);
  modal(`${sheetHead('Share your departure', 'Post it on WhatsApp status, groups or Facebook')}
    <div class="note" style="white-space:pre-wrap;margin-bottom:14px;font-size:.86rem">${esc(text)}</div>
    <div class="stack"><a class="btn btn-block" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(text)}">${ic('send', 'sm')} Share on WhatsApp</a>
    <a class="btn btn-ghost btn-block" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(text)}&u=${encodeURIComponent(EMBED ? 'https://triptovenda.co.za' : location.href.split('#')[0])}">Share on Facebook</a>
    <button class="btn btn-ghost btn-block" data-act="copy" data-text="${esc(text)}">${ic('file', 'sm')} Copy post text</button>
    <a class="btn btn-ghost btn-block" href="#/board" data-act="go">${ic('clock', 'sm')} See it on the departures board</a></div>`);
}

/* ---------------- Send a parcel ---------------- */
V.parcel = q => {
  const has = !!q.fp;
  const list = db.trips.filter(t => t.status === 'open' && t.date >= today() && t.parcelPrice && (!q.fp || t.fromProv === q.fp) && (!q.ft || t.fromTown === q.ft) && (!q.tp || t.toProv === q.tp) && (!q.tt || t.toTown === q.tt) && (!q.date || t.date === q.date))
    .sort((a, b) => depTime(a) - depTime(b));
  return `<div class="wrap page">
    <div class="parcel-hero"><div><span class="eyebrow" style="color:var(--accent)">${ic('pkg', 'sm')} Parcels</span><h2>Send a parcel home, door to door</h2><p>Groceries for Gogo, school things, clothes, documents. A verified driver who is already making the trip carries it, and the receiver gets a delivery code.</p></div>
      <ol class="mini-steps"><li><b>Choose a trip</b> that takes parcels</li><li><b>Pin the pickup & drop off</b> and add a photo</li><li><b>Pay safely</b>, held until delivered</li><li><b>Receiver gives the code</b>, then the driver hands over</li></ol></div>
    <div class="layout">
      <div class="sticky">${searchForm({ ...q, mode: 'parcel' }, true)}</div>
      <div><div class="page-head" style="margin:0 0 14px"><h3>${has ? `${esc(short(q.ft || q.fp))} → ${esc(short(q.tt || q.tp))}` : 'Drivers taking parcels soon'}</h3><p class="small">${list.length} trip${list.length === 1 ? '' : 's'} accept parcels</p></div>
        <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(290px,100%),1fr))">${list.map(t => tripCard(t, 'parcel')).join('') || empty('pkg', 'No parcel trips on this route yet', 'Request a lift and drivers will be notified, many accept parcels too.', `<button class="btn" data-act="request" data-q='${esc(JSON.stringify(q))}'>${ic('bell')} Request a driver</button>`)}</div></div>
    </div></div>`;
};

/* ---------------- Live location sharing with a loved one ---------------- */
function trackLink(code) { return EMBED ? 'triptovenda.co.za/t/' + code : location.href.split('#')[0] + '#/track/' + code; }
function openShare(id) {
  const b = bookingById(id), t = tripById(b.tripId), d = user(t.driverId), parcel = b.type === 'parcel';
  if (b.share?.active) {
    const text = shareText(b);
    return modal(`${sheetHead('Live location is on', `Shared with ${esc(b.share.name)} · since ${new Date(b.share.at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}`)}
      <div class="sharecard"><div class="row">${ic('nav')}<div><b>${esc(b.share.name)}</b> can see the car moving, the driver, number plate and ETA until you arrive.</div></div><div class="linkbox">${esc(trackLink(b.share.code))}</div></div>
      <div class="stack"><a class="btn btn-block" target="_blank" rel="noopener" href="https://wa.me/${waNum(b.share.phone)}?text=${encodeURIComponent(text)}">${ic('send', 'sm')} Send the link again on WhatsApp</a>
      <button class="btn btn-ghost btn-block" data-act="copy" data-text="${esc(text)}">${ic('file', 'sm')} Copy message</button>
      <a class="btn btn-ghost btn-block" href="#/track/${b.share.code}" data-act="go">${ic('eye', 'sm')} See what ${esc(first(b.share.name))} sees</a>
      <button class="btn btn-danger btn-block" data-act="stopShare" data-id="${id}">Stop sharing</button></div>`);
  }
  modal(`${sheetHead('Share live location', parcel ? 'Let the receiver follow the parcel' : 'Let a loved one follow your trip live')}
    <form id="shareForm" data-id="${id}">
      <div class="grid g2"><div class="field"><label>Name</label><input name="name" required value="${esc(parcel ? b.recvName : me.emergencyName || '')}"></div><div class="field"><label>Cellphone</label><input name="phone" type="tel" required value="${esc(parcel ? b.recvPhone : me.emergencyPhone || '')}"></div></div>
      <div class="note" style="margin-bottom:14px">${ic('shield')}<span class="small">They get a private link, no app or login needed. They'll see the car on the map, <b>${esc(d.name)}</b>, the plate <b>${esc(d.vehicle.reg)}</b>, and the ETA. Sharing stops automatically when you arrive.</span></div>
      <button class="btn btn-accent btn-block btn-lg">${ic('nav', 'sm')} Start sharing</button></form>`);
}
function shareText(b) {
  const t = tripById(b.tripId), d = user(t.driverId);
  return `📍 Follow my trip live on Trip To Venda:\n${b.share ? trackLink(b.share.code) : ''}\n\n${b.type === 'parcel' ? 'Parcel' : 'Trip'}: ${t.fromTown} → ${t.toTown}\nDeparts: ${fmtDate(t.date)} at ${t.time} (arrives ±${arrival(t)})\nDriver: ${d.name} (ID verified) · ${d.phone}\nCar: ${d.vehicle.colour} ${d.vehicle.make}, plate ${d.vehicle.reg}\nRef: ${b.id.toUpperCase()}`;
}
V.track = code => {
  const b = db.bookings.find(x => x.share?.code === code);
  if (window.Cloud?.on && (!b || !tripById(b.tripId)) && !Cloud.trackMissing(code)) { Cloud.loadTrack(code); return `<div class="wrap page">${empty('nav', 'Opening the live trip…', 'One moment, connecting.', '')}</div>`; }
  if (!b || !b.share.active) return `<div class="wrap page">${empty('lock', 'This trip is no longer being shared', b?.status === 'completed' ? 'They arrived safely ✔, sharing switched off automatically.' : 'The traveller stopped sharing, or the link is wrong.', '<a class="btn" href="#/">Trip To Venda home</a>')}</div>`;
  const t = tripById(b.tripId);
  let d = user(t.driverId), r = user(b.riderId);
  if (window.Cloud?.on) { r = { ...(r || { name: b.share.name ? 'Your traveller' : 'Traveller' }), phone: b.share.riderPhone || r?.phone || '' }; d = { ...d, vehicle: { ...(d?.vehicle || {}), reg: b.share.plate || d?.vehicle?.reg || '' } }; }
  else { db.tour = db.tour || {}; db.tour.track = true; save(); }
  afterRender.push(() => mountLive(b, true));
  return `<div class="live"><div id="liveMap" class="map tall"></div>
    <div class="live-sheet">
      <div class="track-top">${ic('nav', 'sm')} <b>${esc(first(r.name))}</b>&nbsp;is sharing ${b.type === 'parcel' ? 'a parcel' : 'their trip'} with you</div>
      <div class="row between" style="margin-top:12px"><div><span class="step-label">${{ confirmed: 'Waiting for pickup', picked: 'On the road' }[b.status] || 'Trip'}</span><h3>${esc(short(t.fromTown))} → ${esc(short(t.toTown))}</h3></div>${statusBadge(b.status)}</div>
      <div class="small muted" id="lvEta" style="margin:4px 0 12px">Calculating…</div>
      <div class="prog"><i id="lvProg" style="width:0%"></i></div>
      <div class="row" style="margin-top:14px">${avatar(d)}<div><b class="small">${esc(d.name)}</b><div class="xs muted">${verifiedBadge(d)} ${esc(d.vehicle.colour)} ${esc(d.vehicle.make)}</div></div><span class="plate ml-auto">${esc(d.vehicle.reg)}</span></div>
      <div class="note" style="margin-top:12px">${ic('info')}<span class="small">Worried? Call ${esc(first(r.name))} on <b>${esc(r.phone)}</b>. Emergency: <b>SAPS 10111</b> or <b>112</b>.</span></div>
      <div class="row" style="margin-top:12px;gap:8px"><a class="btn btn-soft btn-sm" style="flex:1" href="tel:${esc(r.phone)}">${ic('phone', 'sm')} Call ${esc(first(r.name))}</a><button class="btn btn-ghost btn-sm" style="flex:1" data-act="concern" data-id="${b.id}">${ic('alert', 'sm')} Report concern</button></div>
      ${TEST_MODE ? `<div class="row" style="justify-content:center;margin-top:10px;gap:6px"><span class="xs muted">Test mode · replay speed:</span>${[1, 10, 60].map(x => `<button class="chip ${liveSpeed === x ? 'on' : ''}" data-act="speed" data-x="${x}" style="padding:4px 10px">${x === 1 ? '1 s = 1 min' : x + '×'}</button>`).join('')}</div>` : ''}
    </div></div>`;
};
function openPickupMap(id) {
  const t = tripById(id), bs = db.bookings.filter(b => b.tripId === id && ACTIVE.includes(b.status) && b.pickupPin);
  modal(`${sheetHead('Pickup map', `${bs.length} pinned gate${bs.length > 1 ? 's' : ''} · ${esc(short(t.fromTown))}`)}<div id="pmap" class="map" style="height:320px"></div>
    <div style="margin-top:12px">${bs.map((b, i) => `<div class="sum-row"><span><b>${i + 1}. ${esc(user(b.riderId).name)}</b><br><span class="xs">${esc(b.pickup)}</span></span><a class="btn btn-sm btn-soft" target="_blank" rel="noopener" href="${gmaps(b.pickupPin)}">${ic('nav', 'sm')} Go</a></div>`).join('')}</div>`);
  setTimeout(() => { const m = baseMap('pmap', { scrollWheelZoom: true }); if (!m) return; const pts = bs.map(b => b.pickupPin); bs.forEach((b, i) => L.marker(b.pickupPin, { icon: L.divIcon({ className: '', html: `<div class="num-pin">${i + 1}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] }) }).addTo(m)); if (pts.length > 1) { L.polyline(pts, { color: '#13784b', weight: 3, dashArray: '6 6' }).addTo(m); m.fitBounds(pts, { padding: [40, 40] }); } else m.setView(pts[0] || tripA(t), 13); }, 60);
}

V.how = () => `<div class="wrap page">
  <div class="page-head"><span class="eyebrow">${ic('bolt', 'sm')} How it works</span><h2>How Trip To Venda works</h2><p>Door to door lifts between Venda and the rest of South Africa, step by step, for riders and drivers.</p></div>
  <section class="how" style="padding-top:8px">
    <div>
      <h3 style="font-size:1.35rem">A lift, made into a proper service</h3>
      <p class="muted" style="margin:10px 0 18px;max-width:480px">No more WhatsApp group guessing. Everyone is verified, prices are clear upfront, and your family can follow your trip.</p>
      <div class="tabs" id="howTabs"><button class="on" data-act="howTab" data-t="r">I need a lift</button><button data-act="howTab" data-t="d">I'm a driver</button></div>
      <div class="steps" id="how-r">${[['Sign up & verify', 'Cellphone, ID and a selfie, about 3 minutes.'], ['Pick your trip', 'Compare times, prices, cars and real reviews.'], ['Add your door & bags', 'Your pickup and drop off address, plus a photo of your luggage.'], ['Show your PIN, ride home', 'The driver starts the trip only with your secret 4 digit PIN.']].map(step).join('')}</div>
      <div class="steps hidden" id="how-d">${[['Register & get checked', 'ID, licence, PrDP, licence disc and car photos reviewed by our team.'], ['Post your trip', 'Set your price per seat, bag fee and parcel price.'], ['Choose your riders', "See each rider's ID check, rating and luggage photo before you accept."], ['Get paid directly', 'Cash, EFT or card machine, straight to you. Fill every empty seat.']].map(step).join('')}</div>
    </div>
    <div class="phone"><div class="scr">
      <div class="map-mock"></div>
      <div class="sheetm"><div class="grab"></div>
        <div class="row between"><b>Arriving in Soweto</b><span class="badge b-blue">${ic('nav')}Live</span></div>
        <div class="xs muted" style="margin:2px 0 10px">ETA 10:52 · 128 km to go</div>
        <div class="prog"><i style="width:72%"></i></div>
        <div class="row" style="margin-top:14px">${avatar(user('drv_tshilidzi'), 'sm')}<div><b class="small">Tshilidzi M.</b><div class="xs muted">White Toyota Innova · 7 seater</div></div><span class="plate ml-auto" style="font-size:.7rem">HXK 482 L</span></div>
        <div class="row" style="margin-top:12px;gap:6px"><span class="btn btn-soft btn-sm" style="flex:1">${ic('share', 'sm')}Share</span><span class="btn btn-danger btn-sm" style="flex:1">${ic('alert', 'sm')}SOS</span></div>
      </div>
    </div></div>
  </section>

  <div class="grid g3" style="margin-top:28px">
    <div class="card pad-lg faq-c"><div class="card-title">${ic('wallet')}<h3>Who sets the price?</h3></div><p>Drivers set the price per seat, bag fee and parcel price. You see the full total before you book.</p></div>
    <div class="card pad-lg faq-c"><div class="card-title">${ic('lock')}<h3>How do I pay?</h3></div><p>Pay in the app (held safely until drop off) or cash to the driver at pickup, if the driver accepts cash.</p></div>
    <div class="card pad-lg faq-c"><div class="card-title">${ic('pkg')}<h3>Can I send a parcel?</h3></div><p>Yes. Pick a trip that takes parcels, add a photo and the receiver's details. The receiver gets a delivery code.</p></div>
  </div>
  <div class="btns" style="margin:26px 0 10px;justify-content:center"><a class="btn btn-accent btn-lg" href="#/search">${ic('search', 'sm')} Find a lift</a><a class="btn btn-ghost btn-lg" href="#/signup?role=driver">${ic('car', 'sm')} Drive with us</a><a class="btn btn-ghost btn-lg" href="#/safety">${ic('shield', 'sm')} Safety</a></div>
</div>`;

V.rules = q => {
  const tab = q.tab || 'position';
  const T = [['position', 'Our position'], ['community', 'Community rules'], ['drivers', 'Driver rules'], ['terms', 'Terms of use'], ['privacy', 'Privacy (POPIA)']];
  const li = a => `<ul class="pol-list">${a.map(x => `<li>${x}</li>`).join('')}</ul>`;
  const sec = (h, body) => `<div class="pol-sec"><h3>${h}</h3>${body}</div>`;
  const P = {
    position: `<div class="pol-lead">${ic('shield')}<p><b>Trip To Venda is not a taxi service and does not compete for taxi passengers.</b> We are a booking platform that lets people who are already travelling long distance between Venda and the rest of South Africa share their empty seats with verified riders, booked in advance, door to door.</p></div>
      ${sec('What we are', li(['A technology platform that connects verified riders with verified drivers who have <b>already planned their own trip</b>.', 'Every seat is <b>booked and confirmed in the app before the trip</b>. There is no street hailing, no roaming for passengers and no walk up service.', 'Pickups and drop offs are <b>at homes, workplaces and businesses</b> that the rider enters when booking.']))}
      ${sec('What we are not', li(['We do <b>not</b> own vehicles, employ drivers, run routes, ranks, stops or a fleet.', 'We do <b>not</b> load or offload at taxi ranks, taxi stops, bus terminals or holding areas, and we do not allow drivers to do so.', 'We do <b>not</b> allow touting, calling for passengers, hooting for passengers, roof signs, taxi branding or meters on vehicles used through Trip To Venda.', 'We are <b>not</b> a metered taxi, minibus taxi, bus or e-hailing operator, and we do not set routes or timetables. Drivers choose their own trip, date and price.']))}
      ${sec('Respect for the taxi industry', `<p>The taxi industry moves millions of South Africans every day and we respect it. Trip To Venda serves a different need: pre-booked, long distance, door to door travel with people who are going anyway. We welcome conversation with taxi associations, and <b>licensed taxi operators are welcome to join as drivers</b> under the same rules as everyone else.</p>`)}
      ${sec('The law', `<p>Every driver must hold the licences and permits the law requires to carry passengers for payment, including a valid driving licence and <b>Professional Driving Permit (PrDP)</b>, and any <b>operating licence or permit required under the National Land Transport Act</b>. Drivers confirm this when they register, and they alone are responsible for complying with it. If a driver is stopped by an authorised officer, they must cooperate fully.</p>`)}
      ${sec('If there is tension on the road or at pickup', li(['Stay calm. <b>Never argue, threaten or fight</b>, and never block anyone.', 'If you feel unsafe, leave the area, cancel the pickup if needed, and meet at a safer address.', 'Use the <b>SOS</b> button or call SAPS 10111 / 112 in an emergency, then report it to the Control room in the app.', 'Do not post about incidents on social media while they are happening. Our team will help.']))}
      <p class="xs muted">Version ${POLICY_V}. These policies are written in plain language. They are not legal advice and they do not replace the law.</p>`,
    community: `${sec('For everyone', li(['Treat everyone with respect. No discrimination because of race, gender, religion, nationality, disability, sexual orientation or language.', 'Zero tolerance for violence, threats, harassment, sexual misconduct, weapons, or anyone under the influence of alcohol or drugs.', 'Use your real name, real photo and real documents. One person, one account.', 'Book, chat and pay through Trip To Venda. Never give your PIN to anyone except your driver at pickup.', 'Respect privacy: do not share, screenshot or post other people’s details, photos or trip information.', 'Reviews must be honest and about the trip.']))}
      ${sec('For riders', li(['Be ready at your pickup address on time. Use a home, work or business address, not a taxi rank or bus terminal.', 'Photograph your luggage truthfully. No illegal, stolen, dangerous or prohibited items, in bags or in parcels.', 'Wear your seatbelt and follow the driver’s trip rules (for example no smoking).', 'Cancel in the app as early as possible if your plans change.']))}
      ${sec('Women only trips', `<p>Female drivers may offer trips that only female riders can book. Gender is taken from the registration details and checked against ID.</p>`)}
      ${sec('What happens if rules are broken', li(['A warning, a temporary suspension, or a permanent ban, depending on how serious it is.', 'Serious matters (violence, theft, fraud, sexual misconduct) are reported to SAPS, and we cooperate with lawful requests from the police.']))}`,
    drivers: `${sec('Only trips you are making yourself', li(['Only post trips <b>you are actually making</b>, on a date and time <b>you choose</b>. Trip To Venda never assigns trips, routes or shifts.', 'All passengers must be <b>booked through the app before the trip</b>. Do not pick up anyone who did not book.', 'Do not roam, cruise or wait for passengers. Do not stand for hire.']))}
      ${sec('No ranks, no touting', li(['Never load or offload at taxi ranks, taxi stops, bus terminals or holding areas, or anywhere a rider asks you to that is one.', 'Never tout, call or hoot for passengers on taxi routes or anywhere else.', 'No roof signs, taxi branding, stickers that say taxi, or meters on your vehicle.']))}
      ${sec('Licences, vehicle and insurance', li(['Valid driver’s licence and <b>PrDP (category P)</b> at all times. Drivers must be 21 or older.', 'Any operating licence or permit the law requires for carrying passengers for payment is <b>your responsibility</b>.', 'Your vehicle must be roadworthy, licensed (valid disc) and insured. Passenger liability cover is strongly recommended.', 'Never carry more passengers than your vehicle is licensed for: up to 4 in a private car, up to 6 in a 7 seater.']))}
      ${sec('Prices and money', li(['You set your own seat, bag and parcel prices. Keep them fair and as shown in the app.', 'Collect only the amount shown in the app. No extra charges on the road.', 'Fines, tolls, fuel, impoundment costs and penalties are your responsibility.']))}
      ${sec('Safety at pickup', li(['Check the rider’s face against their photo and ask for the PIN. Wrong PIN, don’t start.', 'Follow the road rules, keep to speed limits, and never drive tired, distracted or under the influence.']))}`,
    terms: `${sec('1. Who we are and what we do', `<p>Trip To Venda ("we") runs a website and app that let riders find and book seats, and send parcels, on trips that independent drivers plan and offer. We provide the platform, verification, booking, messaging, tracking and safety tools. <b>We do not provide transport.</b> The agreement to travel is between the rider and the driver.</p>`)}
      ${sec('2. Accounts', li(['You must be 18 or older, give true details and keep your password secret.', 'We may check your ID and documents, and we may decline, suspend or close accounts that break these terms, the community rules or the law.']))}
      ${sec('3. Drivers are independent', li(['Drivers are not our employees, agents or contractors. They decide whether, when, where and at what price to travel.', 'Drivers confirm that they hold every licence, permit, insurance and roadworthy certificate the law requires, and they accept full responsibility for complying with transport, traffic and tax laws.', 'Drivers indemnify Trip To Venda against claims, fines and costs caused by their own failure to comply.']))}
      ${sec('4. Fees and payments', li([`Riders pay the driver's price plus a booking fee of ${R(FEES.seat)} per seat (${R(FEES.parcel)} per parcel), shown before booking.`, `Drivers pay a platform fee of ${FEES.commission * 100}% per seat booking (${FEES.pro * 100}% with Pro, ${FEES.parcelCommission * 100}% for parcels). For cash trips the fee comes off the driver's wallet.`, 'Prices include everything shown at booking. No one may charge more on the road.']))}
      ${sec('5. Cancellations', li(['Riders and drivers can cancel in the app. Please cancel as early as possible.', 'Repeated late cancellations or no shows may lead to suspension.']))}
      ${sec('6. Parcels', `<p>Senders must describe parcels truthfully. No illegal, dangerous, perishable without notice, or prohibited goods. Drivers may refuse a parcel that does not match its description or photo.</p>`)}
      ${sec('7. Our responsibility', `<p>We work hard to verify people and keep the platform safe, but we cannot control what happens on the road. To the extent the law allows, we are not liable for loss or damage caused by a driver, rider or third party. Nothing in these terms limits rights you have under the Consumer Protection Act or other South African law.</p>`)}
      ${sec('8. Changes and law', `<p>We may update these terms and will show the new version in the app. South African law applies.</p>`)}
      <p class="xs muted">Version ${POLICY_V}.</p>`,
    privacy: `${sec('What we collect and why', li(['<b>Account:</b> name, email, cellphone, gender, emergency contact, to run your account and keep trips safe.', '<b>Verification:</b> ID number and photo, selfie, and for drivers licence, PrDP, disc and car photos, to confirm who you are.', '<b>Trips:</b> bookings, pickup and drop off addresses, luggage photos, messages and live location during a trip, to deliver the service and help in an emergency.']))}
      ${sec('Who can see it', li(['<b>Public:</b> your first name and initial, photo, rating and (for drivers) car make and colour.', '<b>The other person on your booking</b>: your full name, cellphone and (for drivers) number plate, only around the trip.', '<b>Our Control room</b>: verification documents and trip records, only for safety and support.', 'Family you share a trip with see the live trip until it ends. We never sell your information.']))}
      ${sec('Your rights', li(['Ask to see, correct or delete your information, or object to how it is used, through Help in the app.', 'We keep trip and verification records only as long as needed for safety, disputes and the law, then delete them.', 'You may complain to the Information Regulator of South Africa.']))}
      <p class="xs muted">Version ${POLICY_V}. Processed under the Protection of Personal Information Act (POPIA).</p>`
  };
  return `<div class="wrap page"><div class="page-head"><span class="eyebrow">${ic('file', 'sm')} Rules & policies</span><h2>How Trip To Venda works, and the rules everyone follows</h2><p>Plain language. Please read them before you book or drive.</p></div>
    <div class="tabbar-wrap">${tabsHTML(tab, T)}</div>
    <div class="card pad-lg pol">${P[tab] || P.position}</div></div>`;
};
V.safety = () => {
  const steps = list => `<div class="steps">${list.map((s, i) => `<div class="step-i"><span class="n">${i + 1}</span><p style="color:var(--ink-2)">${s}</p></div>`).join('')}</div>`;
  return `<div class="wrap page">
  <div class="page-head"><span class="eyebrow">${ic('shield', 'sm')} Safety centre</span><h2>Travel safe, every trip</h2><p>How Trip To Venda protects riders and drivers.</p></div>
  <section style="margin-bottom:28px">
    <div class="sec-head"><div><h3 style="font-size:1.35rem">Safe for riders. Safe for drivers.</h3><p>Verification goes both ways, drivers know who they're picking up, riders know who's driving.</p></div></div>
    <div class="bento">
      <div class="card pad-lg feat"><span class="ic">${ic('lock', 'lg')}</span><h3>Secret pickup PIN</h3><p>Every booking gets a 4 digit PIN. The trip can't start until the rider gives it to the right driver.</p><div class="pin-demo"><span>4</span><span>8</span><span>1</span><span>7</span></div></div>
      <div class="card pad-lg"><span class="ic">${ic('id', 'lg')}</span><h3>Everyone is ID checked</h3><p>Riders: ID, selfie and cellphone. Drivers: ID, licence, PrDP, licence disc and car photos, reviewed by a person.</p></div>
      <div class="card pad-lg"><span class="ic">${ic('nav', 'lg')}</span><h3>Live trip & share</h3><p>Family follows your trip with the driver's name, car, number plate and live location, sent in one tap on WhatsApp.</p></div>
      <div class="card pad-lg"><span class="ic" style="background:var(--danger-50);color:var(--danger)">${ic('alert', 'lg')}</span><h3>SOS button</h3><p>During a trip, call SAPS 10111 / 112 and alert your emergency contact with your location instantly.</p></div>
      <div class="card pad-lg"><span class="ic">${ic('camera', 'lg')}</span><h3>Luggage photos</h3><p>Riders photograph bags and parcels when booking, drivers plan space, and everyone has proof.</p></div>
      <div class="card pad-lg"><span class="ic" style="background:var(--pink-50);color:var(--pink)">${ic('venus', 'lg')}</span><h3>Women only trips</h3><p>Female drivers can offer trips that only women riders can book.</p></div>
    </div>
  </section>


  <div class="grid g2" style="align-items:start">
    <div class="card pad-lg"><div class="card-title" style="color:var(--danger)">${ic('alert')}<h3>Emergency numbers</h3></div>${EMERGENCY.map(e => `<a class="sos-num" href="tel:${e[1]}"><span>${e[0]}</span><b>${e[1]}</b></a>`).join('')}</div>
    <div class="card pad-lg"><div class="card-title">${ic('user')}<h3>For riders</h3></div>${steps(['Only book and pay for trips listed on Trip To Venda.', "Check the driver's photo, name, car and number plate before you get in.", 'Give your PIN only to the right driver, never send it in chat.', 'Tap “Share trip” so family can follow you live.', "Keep your luggage photo, it's your proof if something goes missing."])}</div>
    <div class="card pad-lg"><div class="card-title">${ic('car')}<h3>For drivers</h3></div>${steps(['Every rider uploads ID and a selfie. Check their face at pickup.', "Ask for the PIN, wrong PIN means wrong person. Don't start.", 'Check luggage photos before accepting. You can decline parcels.', 'Keep licence, PrDP and roadworthy valid, expired documents pause your account.'])}</div>
    <div class="card pad-lg"><div class="card-title">${ic('info')}<h3>Questions</h3></div>
      ${[['Is Trip To Venda a taxi?', 'No. We are a booking platform for people already travelling long distance who share their empty seats, booked in advance and door to door. No ranks, no touting, no hailing. <a href="#/rules">Read our position</a>.'], ['Who sets the price?', 'Drivers. You see the full price, bag fees and parcel prices before you book.'], ['How do I pay?', 'Directly to the driver, cash, EFT or card machine, as shown on the trip.'], ['What is a parcel booking?', 'Send groceries, clothes or goods home without travelling. Add the receiver and a photo.'], ['Can I cancel?', 'Yes, before pickup. Please cancel early so someone else gets the seat.'], ['Are my documents safe?', "Only our safety team sees them. They're never shown to other users (POPIA)."]].map(f => `<div class="review"><b>${f[0]}</b><p class="small muted" style="margin-top:4px">${f[1]}</p></div>`).join('')}</div>
  </div></div>`;
};

/* ---------------- Maps ---------------- */
const CITIES = [['Thohoyandou',-22.948,30.484,0],['Makhado',-23.044,29.904,1],['Musina',-22.352,30.041,1],['Malamulele',-23.003,30.700,2],['Giyani',-23.302,30.718,2],['Polokwane',-23.904,29.469,1],['Tzaneen',-23.833,30.163,2],['Mokopane',-24.194,29.009,2],['Bela Bela',-24.885,28.293,2],['Lephalale',-23.680,27.700,2],['Pretoria',-25.747,28.188,1],['Johannesburg',-26.204,28.047,1],['Soweto',-26.266,27.866,2],['Mbombela',-25.474,30.970,1],['eMalahleni',-25.871,29.233,2],['Rustenburg',-25.667,27.242,1],['Mahikeng',-25.865,25.644,2],['Bloemfontein',-29.085,26.159,1],['Kimberley',-28.738,24.763,1],['Upington',-28.448,21.256,2],['Durban',-29.858,31.022,1],['Pietermaritzburg',-29.601,30.379,2],['Newcastle',-27.758,29.932,2],['Gqeberha',-33.961,25.602,1],['East London',-33.015,27.912,1],['George',-33.963,22.462,2],['Cape Town',-33.925,18.424,1]];
const REGIONS = [['LIMPOPO',-23.75,28.6],['MPUMALANGA',-25.9,30.3],['NORTH WEST',-26.5,25.4],['FREE STATE',-28.7,26.7],['KWAZULU NATAL',-28.4,30.9],['NORTHERN CAPE',-29.6,21.7],['EASTERN CAPE',-32.2,25.6],['WESTERN CAPE',-33.0,20.6],['BOTSWANA',-22.6,24.4],['ZIMBABWE',-19.6,29.9],['MOZAMBIQUE',-21.0,33.9],['NAMIBIA',-22.5,17.4],['LESOTHO',-29.55,28.25],['ESWATINI',-26.5,31.5]];
function vectorBase(m) {
  const B = window.TTV_BASEMAP; if (!B) return;
  m.getContainer().classList.add('vmap');
  L.geoJSON(B.neighbours, { style: { color: '#c3cec6', weight: 1, fillColor: '#e6eae3', fillOpacity: 1 }, interactive: false }).addTo(m);
  L.geoJSON(B.provinces, { style: f => ({ color: '#ffffff', weight: 1.6, fillColor: f.properties.name === 'Lesotho' ? '#e6eae3' : f.properties.name === 'Limpopo' ? '#e2efdf' : f.properties.name === 'Gauteng' ? '#f6efdc' : '#f2f4ef', fillOpacity: 1 }), interactive: false }).addTo(m);
  REGIONS.forEach(r => L.marker([r[1], r[2]], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'region', html: r[0], iconSize: [140, 14], iconAnchor: [70, 7] }) }).addTo(m));
  CITIES.forEach(c => L.marker([c[1], c[2]], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'city r' + c[3], html: `<i></i><span>${c[0]}</span>`, iconSize: [10, 10], iconAnchor: [5, 5] }) }).addTo(m));
  const z = () => { const c = m.getContainer(), zm = m.getZoom(); c.classList.toggle('zlo', zm < 6); c.classList.toggle('zmid', zm < 7.5); };
  m.on('zoomend', z); m.whenReady(z);
  m.attributionControl.addAttribution('Outlines © amCharts · Routes © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');
}
let maps = [], liveTimer, liveSpeed = 1;
function clearMaps() { maps.forEach(m => { try { m.remove(); } catch {} }); maps = []; clearInterval(liveTimer); }
function baseMap(elId, opts = {}) {
  if (!window.L || !document.getElementById(elId)) return null;
  const m = L.map(elId, { scrollWheelZoom: false, zoomControl: false, ...opts }); L.control.zoom({ position: 'topright' }).addTo(m);
  m.setView([-25.2, 28.8], 6);
  vectorBase(m);
  if (!EMBED) L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(m);
  maps.push(m); return m;
}
const mkIcon = cls => L.divIcon({ className: '', html: `<div class="mk ${cls}"></div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
async function drawRoute(m, a, b) {
  L.marker(a, { icon: mkIcon('') }).addTo(m); L.marker(b, { icon: mkIcon('end') }).addTo(m);
  m.fitBounds([a, b], { padding: [40, 40], animate: false });
  const r = await getRoute(a, b);
  if (!maps.includes(m)) return r;
  L.polyline(r.line, { color: '#0a3d27', weight: 8, opacity: .2 }).addTo(m);
  L.polyline(r.line, { color: '#13784b', weight: 4.5, dashArray: r.est ? '8 8' : null }).addTo(m);
  m.fitBounds(L.latLngBounds(r.line), { padding: [40, 40], animate: false });
  return r;
}
async function mountRouteMap(id, t) {
  const m = baseMap(id); if (!m) return;
  const r = await drawRoute(m, tripA(t), tripB(t));
  if ($('#mKm')) { $('#mKm').textContent = Math.round(r.km) + ' km'; $('#mMin').textContent = fmtDur(r.min); if (!t.arrive) $('#mArr').textContent = addTime(t.time, r.min); }
}
function pointAt(line, f) {
  const seg = []; let tot = 0;
  for (let i = 1; i < line.length; i++) { const d = haversine(line[i - 1], line[i]); seg.push(d); tot += d; }
  let target = tot * f;
  for (let i = 0; i < seg.length; i++) { if (target <= seg[i]) { const k = seg[i] ? target / seg[i] : 0; return [line[i][0] + (line[i + 1][0] - line[i][0]) * k, line[i][1] + (line[i + 1][1] - line[i][1]) * k]; } target -= seg[i]; }
  return line[line.length - 1];
}
async function mountLive(b, readonly) {
  const t = tripById(b.tripId), m = baseMap('liveMap', { scrollWheelZoom: true }); if (!m) return;
  const r = await drawRoute(m, tripA(t), tripB(t));
  if (!document.body.contains(m.getContainer())) return; // page was redrawn while the route loaded
  const car = L.marker(r.line[0], { icon: L.divIcon({ className: '', html: `<div class="car-marker">${ic('car')}</div>`, iconSize: [44, 44], iconAnchor: [22, 22] }), zIndexOffset: 1000 }).addTo(m);
  if (!readonly && !window.Cloud?.on) { db.tour = db.tour || {}; db.tour.live = true; save(); }
  // real GPS: the phone in the car shares its position; family and the other person see it move
  let live = null, unLive = null, geo = null;
  if (window.Cloud?.on) {
    unLive = Cloud.watchLive(b.id, p => live = p);
    if (!readonly && b.status === 'picked' && navigator.geolocation) geo = navigator.geolocation.watchPosition(p => Cloud.sendPos(b.id, p.coords.latitude, p.coords.longitude), () => { }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 });
  }
  const nearest = (lat, lng) => { let bi = 0, bd = 1e18; r.line.forEach((p, i) => { const dd = (p[0] - lat) ** 2 + (p[1] - lng) ** 2; if (dd < bd) { bd = dd; bi = i; } }); return bi / Math.max(1, r.line.length - 1); };
  let elapsed = b.status === 'completed' ? r.min : b.status === 'picked' ? (Date.now() - (b.pickedAt || Date.now())) / 1000 : 0, last = Date.now();
  const tick = () => {
    if (!document.getElementById('liveMap') || !$('#lvProg')) { unLive?.(); if (geo != null) navigator.geolocation.clearWatch(geo); return clearInterval(liveTimer); }
    b = bookingById(b.id) || b;
    const now = Date.now(); if (b.status === 'picked') elapsed += (now - last) / 1000 * liveSpeed; last = now;
    const gps = live && now - live.at < 180000 && b.status === 'picked';
    const f = gps ? nearest(live.lat, live.lng) : Math.min(1, elapsed / r.min), left = r.min * (1 - f);
    car.setLatLng(gps ? [live.lat, live.lng] : pointAt(r.line, f));
    $('#lvProg').style.width = (f * 100).toFixed(1) + '%';
    $('#lvEta').innerHTML = b.status === 'confirmed' ? `Waiting for pickup · departs <b>${fmtDate(t.date)} at ${t.time}</b> · ${Math.round(r.km)} km trip`
      : b.status === 'completed' ? '<b>Arrived safely ✔</b>'
      : f >= 1 ? '<b>Arrived</b>, waiting for the driver to confirm drop off'
      : `ETA <b>${addTime(new Date().toTimeString().slice(0, 5), left)}</b> · ${Math.round(r.km * (1 - f))} km to go · ${fmtDur(left)}`;
  };
  tick(); clearInterval(liveTimer); liveTimer = setInterval(tick, 1000);
}

/* ---------------- Router ---------------- */
let cur = (!EMBED && /^#\//.test(location.hash)) ? location.hash : '#/';
const hist = [];
function go(h) {
  if (h === cur) return render();
  hist.push(cur); cur = h;
  if (!EMBED) { try { history.pushState(null, '', h); } catch {} }
  closeModal(); render();
}
function back() {
  if (!EMBED && hist.length) { history.back(); return; }
  cur = hist.pop() || '#/'; closeModal(); render();
}
function parse() {
  const [path, qs] = cur.replace(/^#\/?/, '').split('?');
  const [name, ...args] = path.split('/');
  return { name: name || 'home', args, q: Object.fromEntries(new URLSearchParams(qs || '')) };
}
/* links from our account emails land here: /?mode=verifyEmail|resetPassword&oobCode=… */
function actionParams() {
  const p = new URLSearchParams(location.search);
  if (!p.get('oobCode') || !p.get('mode')) return null;
  if (location.hash && location.hash !== '#/' && location.hash !== '#') { history.replaceState(null, '', location.pathname + location.hash); return null; } // moved on
  return { mode: p.get('mode'), code: p.get('oobCode') };
}
const leaveAction = hash => { history.replaceState(null, '', location.pathname + hash); render(); };
function render() {
  const act = actionParams();
  const { name, args, q } = act ? { name: 'authAction', args: [], q: {} } : parse();
  const pr = name + '/' + args.join('/'); if (pr !== photoRoute) { Object.keys(PHOTOS).forEach(k => delete PHOTOS[k]); photoRoute = pr; if (document.body.classList.contains('cam-open')) camClose(); }
  clearMaps(); afterRender = [];
  const fn = V[name] || V.home;
  if (name !== 'board') clearInterval(boardTimer);
  $('#app').innerHTML = ['trip', 'live', 'track'].includes(name) ? fn(args[0], q) : fn(q);
  $('#topbar').classList.toggle('dark', name === 'home' || !V[name]);
  document.querySelector('.footer').classList.toggle('hidden', name === 'live' || name === 'track');
  updateNav(name);
  db.tour = db.tour || {};
  const mark = k => { if (!db.tour[k]) { db.tour[k] = true; save(); } };
  if (name === 'home') mark('visit'); if (name === 'board') mark('board'); if (me?.role === 'admin' && ['admin', 'dashboard'].includes(name) && (!q.tab || q.tab === 'overview')) mark('admin');
  if (name === 'dashboard' && me?.id === 'rdr_demo' && db.bookings.some(b => b.riderId === me.id && b.status === 'confirmed')) { db.tour = db.tour || {}; db.tour.pin = true; save(); }
  window.scrollTo(0, 0);
  afterRender.forEach(f => f());
  // phones: tables turn into labelled cards (see .stack-m in styles.css)
  document.querySelectorAll('#app table').forEach(tb => { const rows = [...tb.rows], hr = rows.find(r => r.cells.length && [...r.cells].every(c => c.tagName === 'TH')); if (!hr) return; const h = [...hr.cells].map(x => x.textContent.trim()); tb.classList.add('stack-m'); hr.classList.add('th-row'); rows.forEach(tr => { if (tr !== hr) [...tr.cells].forEach((td, i) => { if (!td.dataset.label && td.colSpan < 2) td.dataset.label = h[i] || ''; }); }); });
}
const roleChip = () => { const r = me.role, lbl = r === 'driver' ? 'Driver' : r === 'admin' ? 'Control room' : 'Rider';
  return `<a href="${r === 'admin' ? '#/admin' : '#/dashboard'}" class="role-chip ${r}" title="You are logged in as a ${lbl.toLowerCase()}">${avatar(me, 'sm')}<span><b>${esc(first(me.name))}</b><small>${ic(r === 'driver' ? 'car' : r === 'admin' ? 'shield' : 'user', 'sm')}${lbl}${r === 'admin' ? '' : ' section'}</small></span></a>`; };
function updateNav(cur) {
  const I = { home: ['#/', 'home', 'Home'], search: ['#/search', 'search', 'Trips'], board: ['#/board', 'clock', 'Leaving soon'], parcel: ['#/parcel', 'pkg', 'Parcels'], dashboard: ['#/dashboard', 'ticket', 'My trips'], admin: ['#/admin', 'users', 'Control room'], post: ['#/post', 'plus', 'Post'], how: ['#/how', 'bolt', 'How it works'], safety: ['#/safety', 'shield', 'Safety'], login: ['#/login', 'user', 'Log in'] };
  const role = me?.role || 'visitor';
  const desk = { visitor: ['home', 'search', 'board', 'parcel', 'how', 'safety'], rider: ['home', 'search', 'board', 'parcel', 'dashboard', 'how', 'safety'], driver: ['home', 'board', 'search', 'dashboard', 'post', 'safety'], admin: ['home', 'admin', 'board', 'search', 'safety'] }[role];
  const tabs = { visitor: ['home', 'search', 'board', 'parcel', 'login'], rider: ['home', 'search', 'board', 'parcel', 'dashboard'], driver: ['home', 'board', 'post', 'dashboard', 'safety'], admin: ['home', 'admin', 'board', 'search', 'safety'] }[role];
  const isCur = k => cur === k || (k === 'admin' && cur === 'dashboard' && role === 'admin') || (k === 'dashboard' && cur === 'dashboard' && role !== 'admin');
  const unread = me ? db.notes.filter(n => myNote(n) && !n.read).length : 0;
  $('#topbar').classList.toggle('signed', !!me);
  $('#nav').innerHTML = desk.map(k => `<a href="${I[k][0]}" class="${isCur(k) ? 'active' : ''}">${I[k][2]}</a>`).join('');
  $('#topActions').innerHTML = (deferredInstall ? `<button class="btn btn-sm btn-accent" data-act="install">${ic('download', 'sm')} Install app</button>` : '')
    + (me ? `${roleChip()}<button class="icon-btn" data-act="notes" aria-label="Notifications">${ic('bell')}${unread ? `<span class="dot">${unread}</span>` : ''}</button><button class="icon-btn" data-act="logout" aria-label="Log out" title="Log out">${ic('out')}</button>`
      : `<a href="#/login" class="btn btn-sm ${cur === 'home' ? 'btn-glass' : 'btn-ghost'}">Log in</a><a href="#/signup" class="btn btn-sm btn-accent">Sign up</a>`);
  $('#tabbar').innerHTML = tabs.map(k => `<a href="${I[k][0]}" class="${isCur(k) ? 'active' : ''} ${k === 'post' ? 'fab' : ''} ${k === 'admin' ? 'long' : ''}">${ic(I[k][1])}${k === 'board' ? 'Leaving' : k === 'admin' ? 'Control room' : I[k][2]}</a>`).join('');
  const onTrip = me && db.bookings.some(b => b.status === 'picked' && (b.riderId === me.id || tripById(b.tripId)?.driverId === me.id));
  $('#sosBtn').classList.toggle('hidden', !onTrip || cur === 'live');
}

/* ---------------- Form handlers ---------------- */
F.editTripForm = f => {
  const t = tripById(f.dataset.id); if (!t || t.driverId !== me.id || !canEditTrip(t)) return toast('This trip can no longer be edited', 'err');
  const booked = seatsTaken(t), max = me.vehicle?.seats || 4, seats = +f.seats.value, price = +f.price.value;
  if (f.date.value < today()) return toast('Pick today or a later date', 'err');
  if (seats < Math.max(1, booked)) return toast(`${booked} seat(s) are already booked, you can't go lower than that`, 'err');
  if (seats > max) return toast(`Your ${vLabel(me.vehicle).toLowerCase()} can take up to ${max} passengers`, 'err');
  if (!(price >= 50 && price <= 3000)) return toast('Price per seat must be between R50 and R3 000', 'err');
  if (RANK_RE.test(f.pickupArea?.value || '') || RANK_RE.test(f.dropArea?.value || '')) return toast(rankMsg, 'err');
  const before = { date: t.date, time: t.time, price: t.price, seats: t.seats, parcelPrice: t.parcelPrice };
  Object.assign(t, { date: f.date.value, time: f.time.value, arrive: f.arrive.value, seats, price, bagFee: +f.bagFee.value || 0, parcelPrice: +f.parcelPrice.value || 0, pickupArea: f.pickupArea.value.trim(), dropArea: f.dropArea.value.trim(), notes: f.notes.value.trim(), acceptsCash: !!f.acceptsCash.checked });
  const changed = Object.keys(before).filter(k => before[k] !== t[k]);
  t.edits = t.edits || []; t.edits.push({ at: Date.now(), changed, before });
  const when = before.date !== t.date || before.time !== t.time;
  if (when) db.bookings.filter(b => b.tripId === t.id && ['requested', 'confirmed'].includes(b.status)).forEach(b => { b.timeChanged = { from: `${fmtDate(before.date)} ${before.time}`, to: `${fmtDate(t.date)} ${t.time}` }; notify(b.riderId, `Your driver changed the trip ${short(t.fromTown)} → ${short(t.toTown)} to ${fmtDate(t.date)} at ${t.time}. If that doesn't work for you, cancel for a full refund.`, '#/dashboard'); });
  save(); closeModal(); render();
  toast(changed.length ? 'Trip updated ✔' + (when ? ' Booked riders were told about the new time.' : '') : 'Saved, nothing changed');
};
F.forgotForm = async f => {
  if (window.Cloud?.on) { try { await Cloud.reset(f.login.value.trim().toLowerCase()); } catch (e) { if (e.code === 'auth/invalid-email') return toast('Enter a valid email address', 'err'); } closeModal(); return toast('If that email has an account, a reset link is on its way ✔'); }
  closeModal(); toast(TEST_MODE ? 'Test mode: reset links are sent once SMS is connected' : 'Reset link sent ✔');
};
F.searchForm = f => { go((f.mode?.value === 'parcel' ? '#/parcel?' : '#/search?') + new URLSearchParams(Object.fromEntries(Object.entries({ fp: f.fromProv.value, ft: f.fromTown.value, tp: f.toProv.value, tt: f.toTown.value, date: f.date.value, seats: f.seats.value }).filter(([, v]) => v)))); };
F.signupForm = async f => {
  const email = f.email.value.trim().toLowerCase(), phone = f.phone.value.replace(/\s/g, '');
  if (!isSAphone(phone)) return toast('Enter a valid SA cellphone number', 'err');
  if (!isSAphone(f.emergencyPhone.value)) return toast('Enter a valid emergency contact number', 'err');
  const pw = f.password.value;
  if (window.Cloud?.on) {
    if (pw.length < 8 || !/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) return toast('Password needs 8+ characters with upper and lower case letters and a number', 'err');
    const btn = f.querySelector('button[type=submit],button:not([type])'); if (btn) btn.disabled = true;
    const u = { id: '', role: f.role.value, name: f.name.value.trim(), gender: f.gender.value, phone, email, emergencyName: f.emergencyName.value.trim(), emergencyPhone: f.emergencyPhone.value.replace(/\s/g, ''), status: 'new', pro: false, phoneVerified: false, docs: {}, created: Date.now(), agreed: { v: POLICY_V, at: Date.now() } };
    Cloud.pending = u;
    try { u.id = await Cloud.signup(email, pw); } catch (e) { Cloud.pending = null; if (btn) btn.disabled = false; return toast(Cloud.err(e), 'err'); }
    if (!db.users.some(x => x.id === u.id)) db.users.push(u);
    me = db.users.find(x => x.id === u.id);
    notify(u.id, `Welcome to Trip To Venda, ${first(u.name)}! Check your email for the verification link, then add your documents.`, '#/verify');
    save(); toast('Account created 🎉 Check your email'); return go('#/verify');
  }
  if (db.users.some(u => u.email === email || u.phone === phone)) return toast('That email or cellphone already has an account', 'err');
  const u = { id: uid('u'), role: f.role.value, name: f.name.value.trim(), gender: f.gender.value, phone, email, pw: await hash(pw), emergencyName: f.emergencyName.value.trim(), emergencyPhone: f.emergencyPhone.value.replace(/\s/g, ''), status: 'new', phoneVerified: false, docs: {}, created: Date.now() };
  db.users.push(u); me = u; store.set('ttv_session', u.id);
  notify(u.id, `Welcome to Trip To Venda, ${first(u.name)}! Verify your account to get started.`, '#/verify');
  save(); toast('Account created 🎉'); go('#/verify');
};
F.loginForm = async f => {
  if (window.Cloud?.on) {
    const btn = f.querySelector('button:not([type=button])'); if (btn) btn.disabled = true;
    try { await Cloud.login(f.login.value.trim().toLowerCase(), f.password.value); }
    catch (e) { if (btn) btn.disabled = false; f.password.value = ''; return toast(Cloud.err(e), 'err'); }
    await Cloud.whenMe();
    if (!me) { if (btn) btn.disabled = false; return toast('Signed in, but no profile was found. Contact Trip To Venda.', 'err'); }
    toast('Welcome back, ' + first(me.name)); return go(f.dataset.next || '#/dashboard');
  }
  const id = f.login.value.trim().toLowerCase().replace(/\s/g, ''), pw = await hash(f.password.value);
  const u = db.users.find(x => (x.email === id || x.phone === id) && x.pw === pw);
  if (!u) return toast('Wrong email/cellphone or password', 'err');
  me = u; store.set('ttv_session', u.id); toast('Welcome back, ' + first(u.name));
  const next = f.dataset.next || '#/dashboard';
  go(next);
};
F.postForm = f => {
  const fp = f.fromProv.value, tp = f.toProv.value;
  if (fp !== VENDA && tp !== VENDA) return toast('Trip To Venda trips must start or end in Venda', 'err');
  if (fp === tp && f.fromTown.value === f.toTown.value) return toast('Pick two different places', 'err');
  if (RANK_RE.test(f.pickupArea.value) || RANK_RE.test(f.dropArea.value)) return toast(rankMsg, 'err');
  if ((me.wallet?.balance || 0) < 0) return toast('Your wallet is negative, top up first', 'err');
  if (+f.seats.value > (me.vehicle?.seats || 4)) return toast(`Your ${vLabel(me.vehicle).toLowerCase()} can take up to ${me.vehicle?.seats || 4} passengers`, 'err');
  const pick = n => [...f.querySelectorAll(`[name=${n}]:checked`)].map(x => x.value);
  const t = { id: uid('t'), driverId: me.id, fromProv: fp, fromTown: f.fromTown.value, toProv: tp, toTown: f.toTown.value, pickupArea: f.pickupArea.value.trim(), dropArea: f.dropArea.value.trim(), date: f.date.value, time: f.time.value, arrive: f.arrive.value, seats: +f.seats.value, price: +f.price.value, bagFee: +f.bagFee.value || 0, parcelPrice: +f.parcelPrice.value || 0, maxBags: +f.maxBags.value, acceptsCash: !PAY_ONLINE || !!f.acceptsCash?.checked, rules: pick('rules'), womenOnly: !!f.womenOnly?.checked, notes: f.notes.value.trim(), status: 'open', created: Date.now() };
  db.trips.push(t);
  const told = db.requests.filter(r => r.fp === fp && r.tp === tp && (!r.date || r.date === t.date) && (!r.date || r.date >= today()));
  told.forEach(r => notify(r.riderId, `A driver just posted ${t.fromTown} → ${t.toTown} on ${fmtDate(t.date)}, matches your lift request!`, '#/trip/' + t.id));
  save(); toast(told.length ? `Trip published 🚗 ${told.length} waiting rider${told.length === 1 ? '' : 's'} told` : 'Trip published 🚗'); go('#/trip/' + t.id);
};
F.chatForm = f => sendMsg(f.dataset.id, f.msg.value.trim());
function sendMsg(id, text) {
  if (!text) return;
  const b = bookingById(id), t = tripById(b.tripId);
  db.messages.push({ id: uid('m'), bookingId: b.id, from: me.id, text, at: Date.now(), readBy: [me.id] });
  notify(me.id === b.riderId ? t.driverId : b.riderId, `${first(me.name)}: “${text.slice(0, 60)}”`);
  save(); openChat(b.id);
}
F.rateForm = f => {
  const b = bookingById(f.dataset.id), t = tripById(b.tripId), to = me.id === b.riderId ? t.driverId : b.riderId;
  if (!f.stars.value) return toast('Tap a star rating', 'err');
  db.reviews.push({ id: uid('r'), bookingId: b.id, from: me.id, to, stars: +f.stars.value, text: f.text.value.trim(), at: Date.now() });
  save(); closeModal(); toast('Thanks for rating!'); render();
};
F.pinForm = async f => {
  const b = bookingById(f.dataset.id);
  if (window.Cloud?.on) {
    const r = await Cloud.tryCode(b, f.pin.value.trim(), 'pin', { status: 'picked', pickedAt: Date.now() });
    if (!r.ok) return toast(r.msg + ' Do not start, check you have the right rider.', 'err');
  } else {
    if (f.pin.value.trim() !== b.pin) return toast('Wrong PIN, do not start. Check you have the right rider.', 'err');
    b.status = 'picked'; b.pickedAt = Date.now();
  }
  notify(b.riderId, 'Your trip has started. Track it live and share it with family. Safe travels!', '#/live/' + b.id);
  save(); closeModal(); toast('PIN correct ✔ Trip started'); go('#/live/' + b.id);
};

/* ---------------- Sheets ---------------- */
function openChat(id) {
  const b = bookingById(id), t = tripById(b.tripId), other = user(me.id === b.riderId ? t.driverId : b.riderId);
  const msgs = db.messages.filter(m => m.bookingId === id);
  msgs.forEach(m => { m.readBy = m.readBy || []; if (!m.readBy.includes(me.id)) m.readBy.push(me.id); }); save();
  const quick = me.id === b.riderId ? ["I'm ready at the gate", 'Running 5 min late', 'Can I bring one more bag?', 'Where are you now?'] : ["I'm 10 minutes away", "I'm outside", 'Please be ready by departure time', 'Can you confirm your pickup address?'];
  modal(`<div class="sheet-head"><div class="row">${avatar(other)}<div><b>${esc(other.name)}</b><div class="xs muted">${esc(short(t.fromTown))} → ${esc(short(t.toTown))} · ${fmtDate(t.date)}</div></div></div><div class="row"><a class="x" href="tel:${esc(other.phone)}" aria-label="Call">${ic('phone', 'sm')}</a><button class="x" data-act="close" aria-label="Close">${ic('x')}</button></div></div>
    <div class="chat" id="chatBox">${msgs.map(m => `<div class="msg ${m.from === me.id ? 'me' : ''}">${esc(m.text)}<small>${ago(m.at)}</small></div>`).join('') || `<p class="xs muted" style="text-align:center;margin:auto">Keep chats on Trip To Venda for your safety. Never share your PIN here.</p>`}</div>
    <div class="quick">${quick.map(qk => `<button data-act="quick" data-id="${id}" data-t="${esc(qk)}">${esc(qk)}</button>`).join('')}</div>
    <form id="chatForm" class="chat-form" data-id="${id}"><input name="msg" placeholder="Message…" autocomplete="off" required><button class="btn" aria-label="Send">${ic('send', 'sm')}</button></form>`);
  const c = $('#chatBox'); c.scrollTop = c.scrollHeight;
}
function openSOS() {
  const b = db.bookings.find(x => x.status === 'picked' && (x.riderId === me?.id || tripById(x.tripId)?.driverId === me?.id));
  modal(`${sheetHead('<span style="color:var(--danger)">Emergency help</span>', 'Tap a number to call immediately')}
    ${EMERGENCY.map(e => `<a class="sos-num" href="tel:${e[1]}"><span>${e[0]}</span><b>${e[1]}</b></a>`).join('')}
    <button class="btn btn-danger btn-block btn-lg" data-act="sosAlert" data-id="${b?.id || ''}" style="margin-top:8px">${ic('alert')} Alert ${esc(me?.emergencyName || 'my contact')} + Trip To Venda</button>
    <p class="hint" style="text-align:center">Sends your location, the driver/rider details and number plate. Our safety team is notified too.</p>`);
}
function openRate(id) {
  const b = bookingById(id), t = tripById(b.tripId), other = user(me.id === b.riderId ? t.driverId : b.riderId);
  modal(`${sheetHead('Rate ' + esc(first(other.name)), esc(short(t.fromTown)) + ' → ' + esc(short(t.toTown)))}
    <form id="rateForm" data-id="${id}"><div style="display:flex;justify-content:center;margin-bottom:14px">${avatar(other, 'xl')}</div>
      <div class="seg">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="stars" value="${n}">${n}${ic('star', 'fill sm')}</label>`).join('')}</div>
      <div class="field"><label>Comment (optional)</label><textarea name="text" placeholder="${me.role === 'driver' ? 'Was the rider on time and respectful?' : 'How was the driving, the car and the service?'}"></textarea></div>
      <button class="btn btn-block btn-lg">Submit rating</button></form>`);
}
function openNotes() {
  const notes = db.notes.filter(myNote).slice(-15).reverse();
  modal(`${sheetHead('Notifications')}${notes.map(n => `<a href="${n.link}" class="note ${n.read ? '' : 'new'}" style="color:inherit" data-act="go">${ic('bell', 'sm')}<span><span class="small">${esc(n.text)}</span><br><span class="xs muted">${ago(n.at)}</span></span></a>`).join('') || `<div class="empty"><div class="ic">${ic('bell', 'lg')}</div><p>You're all caught up.</p></div>`}`);
  notes.forEach(n => n.read = true); save(); updateNav(parse().name);
}
async function copyText(t, msg) { try { await navigator.clipboard.writeText(t); toast(msg); } catch { toast('Copy not allowed here, select and copy the text', 'err'); } }
const getLoc = () => new Promise(res => { if (!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition(p => res(p.coords.latitude.toFixed(5) + ',' + p.coords.longitude.toFixed(5)), () => res(null), { timeout: 8000, enableHighAccuracy: true }); });

let pendingConfirm = null;
function askConfirm(title, text, yes, fn) { pendingConfirm = fn; modal(`${sheetHead(title)}<p class="muted" style="margin-bottom:18px">${text}</p><div class="row"><button class="btn btn-ghost" data-act="close" style="flex:1">Keep it</button><button class="btn btn-danger" data-act="confirmYes" style="flex:1">${yes}</button></div>`); }
F.rejectForm = f => { const u = user(f.dataset.id), reason = f.reason.value; u.status = 'rejected'; u.rejectReason = reason; notify(u.id, `Verification declined: ${reason}. Please upload again.`, '#/verify'); save(); closeModal(); toast(first(u.name) + ' notified'); render(); };
function waSheet(title, text, num, label) { modal(`${sheetHead(title)}<div class="note" style="white-space:pre-wrap;margin-bottom:14px">${esc(text)}</div><a class="btn btn-block" target="_blank" rel="noopener" href="https://wa.me/${waNum(num)}?text=${encodeURIComponent(text)}">${ic('send', 'sm')} ${label}</a><button class="btn btn-ghost btn-block" style="margin-top:8px" data-act="copy" data-text="${esc(text)}">Copy text</button>`); }

/* ---------------- Click actions ---------------- */
const A = {
  close: closeModal,
  go: el => { closeModal(); go(el.getAttribute('href')); },
  back: () => back(),
  speed: el => { liveSpeed = +el.dataset.x; document.querySelectorAll('[data-act=speed]').forEach(b => b.classList.toggle('on', b === el)); },
  tab: el => { const p = parse(); go('#/' + p.name + '?tab=' + el.dataset.t); },
  logout: () => { if (window.Cloud?.on) Cloud.logout(); me = null; store.del('ttv_session'); toast('Logged out'); go('#/'); render(); },
  notes: openNotes,
  install: async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; updateNav(parse().name); },
  toBook: () => { const el = $('#bookSide'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 76, behavior: 'smooth' }); },
  forgot: () => modal(`${sheetHead('Reset your password', window.Cloud?.on ? "We'll email you a secure reset link" : "We'll send a reset link to your cellphone")}<form id="forgotForm"><div class="field"><label>${window.Cloud?.on ? 'Email' : 'Cellphone or email'}</label><input name="login" ${window.Cloud?.on ? 'type="email"' : ''} required></div><button class="btn btn-block btn-lg">Send reset link</button></form>`),
  demoLogin: el => { const f = $('#loginForm'); f.login.value = el.dataset.u; f.password.value = el.dataset.p; f.requestSubmit(); },
  howTab: el => { $('#howTabs').querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); $('#how-r').classList.toggle('hidden', el.dataset.t !== 'r'); $('#how-d').classList.toggle('hidden', el.dataset.t !== 'd'); },
  swap: el => { const f = el.closest('form'); const [fp, ft, tp, tt] = [f.fromProv.value, f.fromTown.value, f.toProv.value, f.toTown.value]; f.fromProv.value = tp; f.fromTown.innerHTML = selectOpts(towns(tp), tt, 'Any town'); f.toProv.value = fp; f.toTown.innerHTML = selectOpts(towns(fp), ft, 'Any town'); },
  cnt: el => { const box = el.closest('.counter'), inp = box.querySelector('input'); const v = Math.max(+inp.dataset.min, Math.min(+inp.dataset.max, +inp.value + +el.dataset.d)); inp.value = v; box.querySelector('b').textContent = v; const f = el.closest('form'); if (f?.id === 'bookForm') $('#bookTotal').textContent = R(calcTotal(tripById(f.dataset.trip), f)); },
  stepNext: el => { const f = el.closest('form'), s = +f.dataset.step; if (!stepValid(f, s)) return; s < 4 ? showStep(f, s + 1) : submitBooking(f); },
  stepBack: el => { const f = el.closest('form'); showStep(f, +f.dataset.step - 1); },
  useLoc: async () => { toast('Getting your location…'); const loc = await getLoc(); if (!loc) return toast('Turn on location to use this', 'err'); const f = $('#bookForm'); f.pickup.value = (f.pickup.value ? f.pickup.value + '\n' : '') + 'GPS pin: https://maps.google.com/?q=' + loc; toast('Location added ✔'); },
  request: el => {
    if (!me) return go('#/signup?role=rider');
    const q = JSON.parse(el.dataset.q);
    db.requests.push({ id: uid('q'), riderId: me.id, fp: q.fp || VENDA, ft: q.ft || '', tp: q.tp || 'Gauteng', tt: q.tt || '', date: q.date || '', seats: +q.seats || 1, at: Date.now() });
    db.users.filter(u => u.role === 'driver' && u.status === 'verified').forEach(d => notify(d.id, `A rider needs a lift: ${q.ft || q.fp} → ${q.tt || q.tp}${q.date ? ' on ' + fmtDate(q.date) : ''}.`, '#/dashboard?tab=req'));
    save(); toast("Lift request posted, we'll notify you when a driver posts this route"); go('#/dashboard?tab=req');
  },
  delReq: el => { db.requests = db.requests.filter(r => r.id !== el.dataset.id); save(); render(); },
  sendOtp: () => { me._otp = String(Math.floor(1000 + Math.random() * 9000)); toast(TEST_MODE ? `Test mode: your SMS code is ${me._otp}` : `Code sent to ${me.phone}`); },
  checkOtp: () => { if (!me._otp) return toast('Tap “Send code” first', 'err'); if ($('#otpIn').value.trim() !== me._otp) return toast('Wrong code', 'err'); me.phoneVerified = true; delete me._otp; save(); toast('Cellphone verified ✔'); render(); },
  chat: el => openChat(el.dataset.id),
  quick: el => sendMsg(el.dataset.id, el.dataset.t),
  share: el => openShare(el.dataset.id),
  shareTrip: el => { const t = tripById(el.dataset.id), url = location.href.split('#')[0] + '#/trip/' + t.id, text = `🚗 Trip To Venda: ${t.fromTown} → ${t.toTown}, ${fmtDate(t.date)} at ${t.time}. ${R(t.price)} per seat, door to door. ${seatsLeft(t)} seats left. Book: ${url}`; if (navigator.share && !EMBED) navigator.share({ text }).catch(() => {}); else copyText(text, 'Trip link copied, paste it on WhatsApp or Facebook'); },
  nativeShare: el => navigator.share({ text: el.dataset.text }).catch(() => {}),
  copy: el => copyText(el.dataset.text, 'Copied'),
  shareLoc: async () => { toast('Getting your location…'); const loc = await getLoc(); if (!loc) return toast(EMBED ? 'Location is off in this preview, works on your phone' : 'Turn on location to share it', 'err'); waSheet('Send live location', '📍 My live location (Trip To Venda): https://maps.google.com/?q=' + loc, me.emergencyPhone, 'Send on WhatsApp'); },
  sos: openSOS,
  sosAlert: async el => {
    const b = bookingById(el.dataset.id), loc = await getLoc(), t = b && tripById(b.tripId);
    const text = `🆘 EMERGENCY: ${me.name} needs help on a Trip To Venda trip.\n${b ? shareText(b) : ''}${loc ? '\nLocation: https://maps.google.com/?q=' + loc : ''}`;
    db.alerts.push({ userId: me.id, bookingId: b?.id, trip: t ? t.fromTown + ' → ' + t.toTown : 'none', loc, at: Date.now() });
    notifyAdmins(`🆘 SOS from ${me.name}`, '#/admin?tab=safety');
    save(); waSheet('🆘 Alert logged. Now send it', text, me.emergencyPhone, `Send to ${esc(me.emergencyName || 'emergency contact')} on WhatsApp`);
    toast('Safety team alerted. If you are in danger, call 10111 or 112 now.');
  },
  cancelB: el => askConfirm('Cancel this booking?', 'The driver will be notified and your seat released.', 'Cancel booking', () => { const b = bookingById(el.dataset.id), t = tripById(b.tripId); b.status = 'cancelled'; notify(t.driverId, `${me.name} cancelled their booking for ${t.fromTown} → ${t.toTown} on ${fmtDate(t.date)}.`); save(); toast('Booking cancelled'); render(); }),
  cancelTrip: el => askConfirm('Cancel this whole trip?', 'All riders on this trip will be notified.', 'Cancel trip', () => { const t = tripById(el.dataset.id); t.status = 'cancelled'; db.bookings.filter(b => b.tripId === t.id && ACTIVE.includes(b.status)).forEach(b => { b.status = 'cancelled'; notify(b.riderId, `Sorry, the driver cancelled ${t.fromTown} → ${t.toTown} on ${fmtDate(t.date)}. Find another trip.`, '#/search'); }); save(); toast('Trip cancelled'); render(); }),
  accept: el => { const b = bookingById(el.dataset.id), t = tripById(b.tripId); if (b.type === 'seat' && seatsTaken(t) > t.seats) return toast('Not enough seats', 'err'); b.status = 'confirmed'; notify(b.riderId, `✔ ${me.name} confirmed your trip ${t.fromTown} → ${t.toTown} on ${fmtDate(t.date)}. Your pickup PIN is in My trips.`); save(); toast('Booking confirmed'); render(); },
  decline: el => { const b = bookingById(el.dataset.id), t = tripById(b.tripId); b.status = 'declined'; notify(b.riderId, `The driver couldn't take your booking for ${t.fromTown} → ${t.toTown}. Try another trip.`, '#/search'); save(); render(); },
  pickup: el => modal(`${sheetHead("Enter the rider's PIN", 'Only start if the PIN matches')}${TEST_MODE ? `<div class="note new" style="margin-bottom:12px">${ic('info')}<span class="small"><b>Test mode:</b> the rider's PIN is <b>${bookingById(el.dataset.id).pin}</b>. In real life the rider tells you at the car.</span></div>` : ''}<form id="pinForm" data-id="${el.dataset.id}"><input name="pin" inputmode="numeric" maxlength="4" placeholder="• • • •" style="font-size:2.2rem;text-align:center;letter-spacing:.5em;font-weight:800;padding:16px" required autofocus><br><br><button class="btn btn-block btn-lg">${ic('lock', 'sm')} Start trip</button></form>`),
  dropoff: el => { const b = bookingById(el.dataset.id), t = tripById(b.tripId); b.status = 'completed'; b.doneAt = Date.now(); notify(b.riderId, `You've arrived in ${t.toTown}. Please rate your driver ⭐`); save(); toast('Drop off done ✔ Remember to rate your rider'); go('#/dashboard'); },
  rate: el => openRate(el.dataset.id),
  img: el => modal(`${sheetHead('Photo')}<img src="${el.src}" style="width:100%;border-radius:16px" alt="">`),
  approve: el => { const u = user(el.dataset.id); u.status = 'verified'; notify(u.id, `✔ You're verified! ${u.role === 'driver' ? 'You can now post trips.' : 'You can now book trips.'}`); save(); toast(u.name + ' approved'); render(); },
  reject: el => modal(`${sheetHead('Reject verification', 'The user sees this reason')}<form id="rejectForm" data-id="${el.dataset.id}"><div class="field"><label>Reason</label><select name="reason"><option>Photo of ID is unclear</option><option>Selfie doesn't match ID photo</option><option>Licence expired</option><option>PrDP missing</option><option>Number plate not visible on car photo</option></select></div><button class="btn btn-danger btn-block">Reject & notify user</button></form>`),
  confirmYes: () => { const fn = pendingConfirm; pendingConfirm = null; closeModal(); fn && fn(); }
};

/* ---------------- Global events ---------------- */
document.addEventListener('submit', e => { const h = F[e.target.id]; if (h) { e.preventDefault(); h(e.target); } });
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (a) { if (a.tagName !== 'INPUT') e.preventDefault(); return A[a.dataset.act]?.(a); }
  const l = e.target.closest('a[href^="#/"], a[href="#"]');
  if (l) { e.preventDefault(); if (l.getAttribute('href') !== '#') go(l.getAttribute('href')); return; }
  if (e.target.id === 'modal') closeModal();
});
document.addEventListener('change', async e => {
  const el = e.target, f = el.form;
  if (el.dataset.prov && f) f.querySelector(`[data-town="${el.dataset.prov}"]`).innerHTML = selectOpts(towns(el.value), '', f.id === 'searchForm' ? 'Any town' : '');
  if (f?.id === 'postForm' && /Prov|Town/.test(el.name)) {
    const r = await getRoute(coord(f.fromProv.value, f.fromTown.value), coord(f.toProv.value, f.toTown.value));
    $('#routeInfo span').innerHTML = `About <b>${Math.round(r.km)} km</b> · <b>${fmtDur(r.min)}</b> driving. Suggested price: <b>${R(suggestPrice(r.km) - 30)} to ${R(suggestPrice(r.km) + 40)}</b> per seat.`;
    f.price.value = suggestPrice(r.km);
  }
  if (el.dataset.photo && el.files[0]) { await usePhotoFile(el.dataset.photo, el.files[0]); el.value = ''; }
  if (el.name === 'type' && f?.id === 'bookForm') f.querySelectorAll('[data-show]').forEach(x => x.classList.toggle('hidden', x.dataset.show !== el.value));
  if (f?.id === 'bookForm') updateTotal(f);
});
$('#sosBtn').addEventListener('click', openSOS);
window.addEventListener('popstate', () => { if (EMBED) return; cur = /^#\//.test(location.hash) ? location.hash : '#/'; hist.pop(); closeModal(); render(); });
window.addEventListener('hashchange', () => { if (EMBED || location.hash === cur || !/^#\//.test(location.hash)) return; cur = location.hash; closeModal(); render(); });
window.addEventListener('storage', e => { if (e.key === DB_KEY && e.newValue) { db = JSON.parse(e.newValue); me = db.users.find(u => u.id === me?.id) || null; if (parse().name !== 'live') render(); } });


/* ---------------- Demo panel: account switcher + guided tour ---------------- */
const SEED_IDS = new Set(['admin', 'drv_tshilidzi', 'drv_rendani', 'drv_mpho', 'drv_khathu', 'drv_ndivhuwo', 'drv_lufuno', 'rdr_demo', 'rdr_a', 'rdr_b', 'rdr_c', 'rdr_d']);
function tourSteps() {
  db.tour = db.tour || {};
  const mine = db.bookings.filter(x => x.riderId === 'rdr_demo'), b = mine.filter(x => x.type === 'seat').slice(-1)[0];
  const drv = b && tripById(b.tripId)?.driverId, st = b?.status, order = ['confirmed', 'picked', 'completed'], past = s => !!b && order.indexOf(st) >= order.indexOf(s);
  const nd = db.users.filter(u => !SEED_IDS.has(u.id) && u.role === 'driver').slice(-1)[0];
  const t0 = db.trips.find(t => t.driverId === 'drv_tshilidzi' && t.toProv === 'Gauteng' && t.status === 'open' && t.date >= today());
  return [
    { t: 'Look around as a visitor', d: 'Home page, popular routes, how it works, safety features.', as: '', go: '#/', done: !!db.tour.visit },
    { t: 'Book a seat: pin your gate & pay', d: 'Mulalo books Thohoyandou → Joburg: pins her gate on the map, adds a luggage photo and pays (held until drop off).', as: 'rdr_demo', go: t0 ? '#/trip/' + t0.id : '#/search', done: !!b },
    { t: 'Accept the booking (driver)', d: "The driver sees the rider's ID check, rating, pinned gate and luggage photo, then accepts.", as: drv, go: '#/dashboard', done: past('confirmed'), need: !b },
    { t: 'Share live location with Mom (rider)', d: 'From the confirmed booking, share the trip, Mom gets a private tracking link.', as: 'rdr_demo', go: '#/dashboard', done: !!b?.share, need: !past('confirmed') },
    { t: "Open Mom's tracking link", d: 'See exactly what the loved one sees, no app or login needed.', as: 'rdr_demo', go: b?.share ? '#/track/' + b.share.code : '#/dashboard', done: !!db.tour.track, need: !b?.share },
    { t: 'Start the trip with the PIN (driver)', d: "Driver enters the rider's PIN, wrong PIN, no trip.", as: drv, go: '#/dashboard', done: past('picked'), need: !past('confirmed') },
    { t: 'Live tracking & SOS (rider)', d: 'Watch the car move on the real road route. Try the SOS sheet.', as: 'rdr_demo', go: b ? '#/live/' + b.id : '#/dashboard', done: !!db.tour.live, need: !past('picked') },
    { t: 'Drop off, payment released, ratings', d: 'Driver confirms drop off, the held payment is released and both sides rate each other.', as: drv, go: '#/dashboard', done: st === 'completed', need: !past('picked') },
    { t: 'Send a parcel home (rider)', d: 'Pick a trip that takes parcels and add the receiver, they get a delivery code.', as: 'rdr_demo', go: '#/parcel', done: mine.some(x => x.type === 'parcel') },
    { t: "Post “I'm leaving” (driver)", d: 'Tshilidzi posts from, to, when and the price in 10 seconds, then shares it to WhatsApp/Facebook.', as: 'drv_tshilidzi', go: '#/dashboard', done: db.trips.some(t => t.quick && t.driverId === 'drv_tshilidzi') },
    { t: 'See the departures board', d: 'Everyone leaving soon, with live countdowns and prices.', as: '', go: '#/board', done: !!db.tour.board },
    { t: 'Register a new driver', d: 'SA ID check, licence + PrDP with expiry dates, number plate and car photos.', as: '', go: '#/signup?role=driver', done: !!nd && nd.status !== 'new' },
    { t: 'Approve with the safety checklist (admin)', d: 'Automatic checks + the admin ticks each document before approving.', as: 'admin', go: '#/admin?tab=verify', done: nd?.status === 'verified', need: !nd || nd.status === 'new' },
    { t: 'Admin: who travelled where & revenue', d: 'Charts, route map, full trip log, wallets and payouts.', as: 'admin', go: '#/admin', done: !!db.tour.admin }
  ];
}
function openDemo() {
  const steps = tourSteps(), n = steps.filter(x => x.done).length;
  const acc = [['', 'Visitor', 'Not logged in'], ['rdr_demo', 'Mulalo', 'Rider'], ['drv_tshilidzi', 'Tshilidzi', 'Driver'], ['drv_rendani', 'Rendani', 'Female driver'], ['admin', 'Safety desk', 'Control room']];
  modal(`${sheetHead('Demo panel', 'Try every part of Trip To Venda')}
    <div class="step-label" style="margin-bottom:8px">Switch account</div>
    <div class="togs" style="margin-bottom:18px">${acc.map(a => `<button class="chip ${(me?.id || '') === a[0] ? 'on' : ''}" data-act="asUser" data-id="${a[0]}">${a[1]} <span class="xs muted">· ${a[2]}</span></button>`).join('')}</div>
    <div class="row between" style="margin-bottom:8px"><span class="step-label">Guided tour</span><span class="xs b">${n} / ${steps.length} done</span></div>
    <div class="prog" style="margin-bottom:12px"><i style="width:${n / steps.length * 100}%"></i></div>
    ${steps.map((x, i) => `<div class="tour ${x.done ? 'done' : ''}"><span class="n">${x.done ? ic('check', 'sm') : i + 1}</span><div style="flex:1;min-width:0"><b class="small">${x.t}</b><div class="xs muted">${x.d}</div></div>${x.need ? '<span class="xs muted" style="white-space:nowrap">do earlier step</span>' : `<button class="btn btn-sm ${x.done ? 'btn-ghost' : ''}" data-act="tourGo" data-i="${i}">${x.done ? 'Again' : 'Go'}</button>`}</div>`).join('')}
    <button class="btn btn-ghost btn-block" style="margin-top:14px" data-act="resetDemo">Reset demo data</button>`);
}
function setUser(id) { me = id ? user(id) : null; if (me) store.set('ttv_session', me.id); else store.del('ttv_session'); }
Object.assign(A, {
  demo: openDemo,
  asUser: el => { setUser(el.dataset.id); closeModal(); toast(me ? 'Now using: ' + me.name : 'Logged out, browsing as visitor'); go(me ? '#/dashboard' : '#/'); },
  tourGo: el => { const x = tourSteps()[+el.dataset.i]; setUser(x.as); closeModal(); if (x.go === '#/') { db.tour.visit = true; save(); } go(x.go); toast(me ? 'Using: ' + me.name : 'Browsing as visitor'); },
  resetDemo: () => askConfirm('Reset the demo?', 'All bookings, new accounts and chats are cleared and the demo trips come back.', 'Reset', async () => { db = await seed(); save(); setUser(''); go('#/'); toast('Demo reset'); })
});


/* ---------------- Money & status changes ---------------- */
function refund(b) { if (b.pay === 'online' && b.payStatus === 'held') { b.payStatus = 'refunded'; return ` Your ${R(b.total)} was refunded in full.`; } return ''; }
function completeBooking(b) {
  const t = tripById(b.tripId), d = user(t.driverId);
  b.status = 'completed'; b.doneAt = Date.now();
  if (b.pay === 'online') { b.payStatus = 'released'; b.payout = 'pending'; }
  else if (window.Cloud?.on) b.payStatus = 'paid-cash';
  else { b.payStatus = 'paid-cash'; d.wallet = d.wallet || { balance: 0, ledger: [] }; const fee = b.commission + b.riderFee; d.wallet.balance -= fee; d.wallet.ledger.push({ at: Date.now(), text: `Cash trip fee · ${short(t.fromTown)} → ${short(t.toTown)} (${first(user(b.riderId).name)})`, amount: -fee }); }
  if (b.share) b.share.active = false;
  notify(b.riderId, b.type === 'parcel' ? `Your parcel was delivered to ${b.recvName} ✔` : `You've arrived in ${t.toTown}. Please rate your driver ⭐`);
  save();
}
const notifyRequests = t => db.requests.filter(r => r.fp === t.fromProv && r.tp === t.toProv && (!r.date || r.date === t.date)).forEach(r => notify(r.riderId, `A driver just posted ${t.fromTown} → ${t.toTown} on ${fmtDate(t.date)}, matches your lift request!`, '#/trip/' + t.id));

F.quickForm = f => {
  const [fp, ft] = f.from.value.split('|'), [tp, tt] = f.to.value.split('|');
  if (fp !== VENDA && tp !== VENDA) return toast('Trip To Venda trips must start or end in Venda', 'err');
  if (f.from.value === f.to.value) return toast('Pick two different places', 'err');
  if ((me.wallet?.balance || 0) < 0) return toast('Top up your wallet first', 'err');
  if (new Date(f.date.value + 'T' + f.time.value).getTime() < Date.now()) return toast('That time has already passed, pick a later time', 'err');
  const t = { id: uid('t'), driverId: me.id, fromProv: fp, fromTown: ft, toProv: tp, toTown: tt, pickupArea: short(ft) + ' & surrounds, door to door', dropArea: short(tt) + ' & surrounds, door to door', date: f.date.value, time: f.time.value, arrive: '', seats: +f.seats.value, price: +f.price.value, bagFee: 50, parcelPrice: 150, maxBags: 2, acceptsCash: !PAY_ONLINE || (me.acceptsCash ?? true), rules: ['No smoking', 'Seatbelts on'], womenOnly: false, notes: '', status: 'open', created: Date.now(), quick: true };
  db.trips.push(t); notifyRequests(t); save(); render(); toast("Posted ✔ You're on the departures board"); openPostShare(t.id);
};
F.shareForm = f => {
  const b = bookingById(f.dataset.id);
  if (!f.name.value.trim() || !isSAphone(f.phone.value)) return toast('Add a name and a valid cellphone', 'err');
  { const d = user(b.driverId || tripById(b.tripId)?.driverId); b.share = { code: uid('').slice(0, 10).toUpperCase(), name: f.name.value.trim(), phone: f.phone.value.replace(/\s/g, ''), at: Date.now(), active: true, riderPhone: me.phone || '', plate: d?.vehicle?.reg || '' }; }
  notify(tripById(b.tripId).driverId, `${first(me.name)} is sharing this trip's live location with family.`);
  save(); toast('Live location shared with ' + b.share.name); render(); openShare(b.id);
};
F.deliverForm = async f => {
  const b = bookingById(f.dataset.id);
  if (window.Cloud?.on) {
    const fin = { status: 'completed', doneAt: Date.now(), payStatus: b.pay === 'online' ? 'released' : 'paid-cash', ...(b.pay === 'online' ? { payout: 'pending' } : {}), ...(b.share ? { 'share.active': false } : {}) };
    const r = await Cloud.tryCode(b, f.code.value.trim(), 'code', fin);
    if (!r.ok) return toast(r.msg + " Don't hand over the parcel.", 'err');
    notify(b.riderId, `Your parcel was delivered to ${b.recvName} ✔`); save();
    closeModal(); toast('Parcel delivered ✔'); return go('#/dashboard');
  }
  if (f.code.value.trim() !== b.deliveryCode) return toast("Wrong delivery code, don't hand over the parcel", 'err');
  completeBooking(b); closeModal(); toast('Parcel delivered ✔ Payment released'); go('#/dashboard');
};

Object.assign(A, {
  stepNext: el => { const f = el.closest('form'), s = +f.dataset.step; if (!stepValid(f, s)) return; if (s < 4) return showStep(f, s + 1); f.pay.value === 'online' ? openCheckout(f) : submitBooking(f); },
  payNow: el => { const m = document.querySelector('[name=pm]:checked')?.value || 'Card'; el.disabled = true; el.innerHTML = 'Processing payment…'; setTimeout(() => pendingBookForm && submitBooking(pendingBookForm, m), 1100); },
  cnt: el => { const box = el.closest('.counter'), inp = box.querySelector('input'); const v = Math.max(+inp.dataset.min, Math.min(+inp.dataset.max, +inp.value + +el.dataset.d)); inp.value = v; box.querySelector('b').textContent = v; const f = el.closest('form'); if (f?.id === 'bookForm') updateTotal(f); },
  detect: async el => { const f = el.closest('form'); toast('Detecting your location…'); const ll = await getLocLL(); if (!ll) return toast(EMBED ? 'Auto detect works in the installed app on your phone, tap the map to pin instead' : 'Location is off, allow location access, or tap the map', 'err'); setPin(f, el.dataset.k, ll); toast('Location detected ✔ Drag the pin if needed'); },
  share: el => openShare(el.dataset.id),
  stopShare: el => { const b = bookingById(el.dataset.id); b.share.active = false; save(); closeModal(); toast('Stopped sharing'); render(); },
  postShare: el => openPostShare(el.dataset.id),
  pickupMap: el => openPickupMap(el.dataset.id),
  concern: el => { const b = bookingById(el.dataset.id), t = tripById(b.tripId); db.alerts.push({ kind: 'concern', by: b.share?.name || 'Loved one', userId: null, bookingId: b.id, trip: short(t.fromTown) + ' → ' + short(t.toTown), at: Date.now() }); db.users.filter(u => u.role === 'admin').forEach(a => notify(a.id, `⚠ Concern raised by ${b.share?.name || 'a loved one'} on a live trip`, '#/admin?tab=safety')); save(); toast('Our safety team has been alerted and will call the traveller. In danger? Call 10111 or 112.'); },
  decline: el => { const b = bookingById(el.dataset.id), t = tripById(b.tripId); b.status = 'declined'; const rf = refund(b); notify(b.riderId, `The driver couldn't take your booking for ${t.fromTown} → ${t.toTown}.${rf} Try another trip.`, '#/search'); save(); toast('Declined' + (rf ? ' · rider refunded' : '')); render(); },
  cancelB: el => askConfirm('Cancel this booking?', 'The driver is notified and your seat is released. In app payments are refunded in full.', 'Cancel booking', () => { const b = bookingById(el.dataset.id), t = tripById(b.tripId); b.status = 'cancelled'; const rf = refund(b); if (b.share) b.share.active = false; notify(t.driverId, `${me.name} cancelled their booking for ${t.fromTown} → ${t.toTown} on ${fmtDate(t.date)}.`); save(); toast('Booking cancelled.' + rf); render(); }),
  cancelTrip: el => askConfirm('Cancel this whole trip?', 'All riders are notified and every in app payment is refunded in full.', 'Cancel trip', () => { const t = tripById(el.dataset.id); t.status = 'cancelled'; db.bookings.filter(b => b.tripId === t.id && ACTIVE.includes(b.status)).forEach(b => { b.status = 'cancelled'; const rf = refund(b); if (b.share) b.share.active = false; notify(b.riderId, `Sorry, the driver cancelled ${t.fromTown} → ${t.toTown} on ${fmtDate(t.date)}.${rf}`, '#/search'); }); save(); toast('Trip cancelled · riders refunded'); render(); }),
  dropoff: el => { const b = bookingById(el.dataset.id); if (b.type === 'parcel') return modal(`${sheetHead('Enter the delivery code', `Ask ${esc(b.recvName)} for the 6 digit code`)}${TEST_MODE ? `<div class="note new" style="margin-bottom:12px">${ic('info')}<span class="small"><b>Test mode:</b> the code is <b>${b.deliveryCode}</b>. In real life the receiver reads it from the SMS.</span></div>` : ''}<form id="deliverForm" data-id="${b.id}"><input name="code" inputmode="numeric" maxlength="6" placeholder="••••••" style="font-size:2rem;text-align:center;letter-spacing:.4em;font-weight:800;padding:14px" required><br><br><button class="btn btn-block btn-lg">${ic('check', 'sm')} Hand over parcel</button></form>`); completeBooking(b); toast(b.pay === 'online' ? `Drop off done ✔ ${R(b.driverNet)} released to your next payout` : `Drop off done ✔ ${R(b.commission + b.riderFee)} fee taken from your wallet`); go('#/dashboard'); },
  approve: el => { if (el.closest('#sheet') && ![...el.closest('#sheet').querySelectorAll('.mchk')].some(c => !c.checked)) closeModal(); const card = el.closest('.vcard'); if (card && [...card.querySelectorAll('.mchk')].some(c => !c.checked)) return toast('Tick every manual check first, confirm you looked at each document', 'err'); const u = user(el.dataset.id); u.status = 'verified'; notify(u.id, `✔ You're verified! ${u.role === 'driver' ? 'You can now post trips.' : 'You can now book trips.'}`); save(); toast(u.name + ' approved'); render(); },
  emailResend: async () => { try { await Cloud.resendVerify(); toast('Sent ✔ Check your inbox and spam folder'); } catch (e) { toast(Cloud.err(e), 'err'); } },
  emailDone: async () => { const ok = await Cloud.refreshVerify().catch(() => false); if (ok) { me.phoneVerified = true; save(); } toast(ok ? 'Email confirmed ✔' : 'Not confirmed yet. Open the link in the email first.', ok ? '' : 'err'); render(); },
  topUp: el => { const x = +el.dataset.x;
    if (window.Cloud?.on) {
      const id = uid('x'), ref = 'TTV' + id.slice(1, 7).toUpperCase(), bank = Cloud.cfg.bank;
      db.topups.push({ id, driverId: me.id, amount: x, status: 'requested', ref, at: Date.now() }); notifyAdmins(`${me.name} is topping up ${R(x)} (ref ${ref}).`, '#/admin?tab=money'); save();
      return modal(`${sheetHead('Top up ' + R(x), 'Your wallet updates when we see the money')}<div class="note new">${ic('info')}<span class="small">Pay <b>${R(x)}</b> by EFT or Capitec Pay with reference <b>${ref}</b>.${bank ? `<br>${esc(bank)}` : ''}<br>The Control room adds it to your wallet as soon as it shows in our account.</span></div><button class="btn btn-block" style="margin-top:14px" data-act="close">Done</button>`);
    }
    me.wallet = me.wallet || { balance: 0, ledger: [] }; me.wallet.balance += x; me.wallet = me.wallet || { balance: 0, ledger: [] }; me.wallet.balance += x; me.wallet.ledger.push({ at: Date.now(), text: 'Wallet top up (Instant EFT)', amount: x }); save(); toast(`Wallet topped up ${R(x)} ✔`); render(); },
  topupOk: el => { const x = db.topups.find(t => t.id === el.dataset.id); if (!x || me?.role !== 'admin') return; x.status = 'received'; x.doneAt = Date.now(); db.ledger.push({ id: uid('l'), driverId: x.driverId, amount: x.amount, text: `Wallet top up (EFT ${x.ref})`, at: Date.now() }); notify(x.driverId, `${R(x.amount)} added to your wallet ✔`, '#/dashboard?tab=wallet'); save(); toast('Wallet updated ✔'); render(); },
  setPro: el => { const u = user(el.dataset.id); if (!u || me?.role !== 'admin') return; const on = el.dataset.on === '1'; u.pro = on; u.proRequested = false; if (on) db.ledger.push({ id: uid('l'), driverId: u.id, amount: -FEES.proMonthly, text: 'Trip To Venda Pro, monthly', at: Date.now() }); notify(u.id, on ? `Pro is active ✔ You now pay ${FEES.pro * 100}% commission` : 'Pro has been switched off', '#/dashboard?tab=wallet'); save(); toast(on ? 'Pro switched on' : 'Pro switched off'); render(); },
  togglePro: () => { if (window.Cloud?.on) { me.proRequested = !me.proRequested; notifyAdmins(`${me.name} ${me.proRequested ? (me.pro ? 'wants to cancel Pro' : 'wants Trip To Venda Pro') : 'withdrew a Pro request'}.`, '#/admin?tab=money'); save(); toast(me.proRequested ? 'Request sent ✔ The Control room will confirm' : 'Request withdrawn'); return render(); }
    me.wallet = me.wallet || { balance: 0, ledger: [] }; me.pro = !me.pro; if (me.pro) { me.wallet.balance -= FEES.proMonthly; me.wallet.ledger.push({ at: Date.now(), text: 'Trip To Venda Pro, monthly', amount: -FEES.proMonthly }); } save(); toast(me.pro ? `Pro active, you now pay ${FEES.pro * 100}% commission` : 'Pro cancelled'); render(); },
  runPayout: () => { let n = 0, s = 0; db.bookings.filter(b => b.payout === 'pending').forEach(b => { b.payout = 'paid'; n++; s += b.driverNet; }); save(); toast(`Paid ${R(s)} to drivers (${n} trips) ✔`); render(); },
  resolve: el => { db.alerts[+el.dataset.i].resolved = true; save(); render(); },
  bk: el => bkSheet(el.dataset.id),
  userSheet: el => userSheet(el.dataset.id),
  goto: el => go(el.dataset.h),
  reviewUser: el => { const u = user(el.dataset.id); if (!u || me?.role !== 'admin') return; modal(`${sheetHead('Review ' + esc(first(u.name)), u.role === 'driver' ? 'Driver application' : 'Rider verification')}${vcardHTML(u)}`); },
  editTrip: el => { const t = tripById(el.dataset.id); if (!t || t.driverId !== me?.id) return; if (!canEditTrip(t)) return toast('This trip has started or passed, it can no longer be edited', 'err'); editTripSheet(t); },
  riderInfo: el => { const b = bookingById(el.dataset.id); if (!b || tripById(b.tripId)?.driverId !== me?.id) return; riderSheet(b); },
  earnCsv: el => { const rows = driverEarnRows(me.id, earnStart(el.dataset.p)); copyText(['Date,Time,From,To,Type,Seats,Payment,RidersPaid,TripToVendaFee,YouKept'].concat(rows.map(({ b, t }) => [t.date, t.time, t.fromTown, t.toTown, b.type, b.seats, b.pay, b.fare, b.commission, b.driverNet].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))).join('\n'), 'Earnings statement copied. Paste it into Excel or Google Sheets.'); },
  logCsv: () => copyText(['Date,Time,Rider,Driver,Plate,From,To,Type,Seats,Fare,BookingFee,Commission,Total,Payment,Status'].concat(logRows().map(({ b, t }) => [t.date, t.time, user(b.riderId).name, user(t.driverId).name, user(t.driverId).vehicle.reg, t.fromTown, t.toTown, b.type, b.seats, b.fare, b.riderFee, b.commission, b.total, b.pay, b.status].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))).join('\n'), 'Trip log copied as CSV, paste into Excel or Google Sheets')
});

/* live checks while typing */
document.addEventListener('change', e => {
  if (e.target.name !== 'vtype') return;
  const f = e.target.form, vt = VTYPES[e.target.value]; if (!f || !vt) return;
  f.vseats.max = vt.max; if (+f.vseats.value > vt.max) f.vseats.value = vt.max; f.make.placeholder = vt.eg;
  const h = $('#seatHint'); if (h) h.textContent = `${vt.label}: up to ${vt.max} passengers`;
});
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.lf) { logF[el.dataset.lf] = el.value; const [n, rows] = logBody(); $('#logBody').innerHTML = rows; $('#logCount').textContent = n; }
  if (el.form?.id === 'verifyForm' && el.name === 'idNumber' && el.form.idType.value === 'SA ID') { const c = checkSAID(el.value); $('#idCheck').innerHTML = el.value.length < 13 ? 'Never shown to other users.' : c.ok ? `<span class="okc">${ic('check', 'sm')} Valid SA ID · born ${niceD(c.dob)} · age ${c.age} · ${c.citizen}</span>` : `<span class="bad">${c.msg}</span>`; }
  if (el.form?.id === 'verifyForm' && el.name === 'reg') $('#plateCheck').innerHTML = !el.value ? '' : plateOK(el.value) ? `<span class="okc">${ic('check', 'sm')} Plate format OK</span>` : '<span class="bad">Check the plate, e.g. HXK 482 L</span>';
});
document.addEventListener('change', async e => {
  const f = e.target.form;
  if (f?.id === 'quickForm' && /^(from|to)$/.test(e.target.name)) { const [fp, ft] = f.from.value.split('|'), [tp, tt] = f.to.value.split('|'), r = await getRoute(coord(fp, ft), coord(tp, tt)); f.price.value = suggestPrice(r.km); $('#qpInfo').textContent = `${Math.round(r.km)} km · ${fmtDur(r.min)} · suggested ${R(suggestPrice(r.km))}/seat · you keep ${Math.round((1 - (me.pro ? FEES.pro : FEES.commission)) * 100)}%`; }
});
/* chart & map tooltips */
const vtip = document.createElement('div'); vtip.className = 'vtip'; document.body.appendChild(vtip);
document.addEventListener('mousemove', e => { const t = e.target.closest?.('[data-tip]'); if (!t) { vtip.style.opacity = 0; return; } vtip.textContent = t.dataset.tip; vtip.style.opacity = 1; const x = Math.min(e.clientX + 14, innerWidth - vtip.offsetWidth - 8); vtip.style.transform = `translate(${x}px,${e.clientY - 40}px)`; });

/* ---------------- Install as app (PWA) ---------------- */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; updateNav(parse().name); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ---------------- Start ---------------- */
$('#yr').textContent = new Date().getFullYear();
if (DEMO) { const d = document.createElement('button'); d.id = 'demoBtn'; d.className = 'demo-btn'; d.dataset.act = 'demo'; d.innerHTML = ic('bolt', 'sm') + ' Demo'; document.body.appendChild(d); }
Object.assign(A, AA_ACTIONS, CAM_ACTIONS);
(window.Cloud?.on ? Cloud.boot() : load()).then(render);

/* ---------------- Branded loading screen (SPLASH_MS) ---------------- */
(function splash() {
  const s = document.getElementById('splash'); if (!s) return;
  const msgs = ['Finding verified drivers…', 'Loading routes & maps…', "Checking today's departures…", 'Almost there…'];
  const left = Math.max(0, SPLASH_MS - performance.now()), m = s.querySelector('#splashMsg');
  let i = Math.min(msgs.length - 1, Math.floor(performance.now() / (SPLASH_MS / msgs.length)));
  if (m) m.textContent = msgs[i];
  const iv = setInterval(() => { i = Math.min(i + 1, msgs.length - 1); if (m) m.textContent = msgs[i]; }, SPLASH_MS / msgs.length);
  setTimeout(() => { clearInterval(iv); s.classList.add('out'); setTimeout(() => s.remove(), 650); }, left);
})();
