/* =============================================================================
   Trip To Venda · real time cloud (Firebase)
   Loaded after lib/firebase.js and firebase-config.js, before app.js.
   With no config in firebase-config.js the app runs on this phone only.

   How it works
   - Everyone sees changes live: Firestore listeners rebuild the app's data.
   - save() compares the data with the last copy from the server and writes
     only what this person changed. Google's security rules decide what is
     allowed (see firebase/firestore.rules), so a changed app cannot cheat.
   - Passwords are handled only by Firebase Authentication (never stored here).
   - 5 wrong passwords lock this phone for 15 minutes, and Firebase also
     blocks repeated attempts on its servers.
   ============================================================================= */
(function () {
  const cfg = window.TTV_FIREBASE || {};
  const S = window.FB;
  const Cloud = window.Cloud = { on: !!(cfg.apiKey && cfg.projectId && S), user: null, admin: false, cfg };
  if (!Cloud.on) return;

  const app = S.initializeApp(cfg);
  if (cfg.appCheckSiteKey && !cfg.emulator) {
    try { S.initializeAppCheck(app, { provider: new S.ReCaptchaV3Provider(cfg.appCheckSiteKey), isTokenAutoRefreshEnabled: true }); } catch (e) { console.warn('App Check', e); }
  }
  const auth = S.getAuth(app);
  // memory cache only: nothing private is left on a shared phone after logout (POPIA)
  const fs = S.initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: S.memoryLocalCache() });
  if (cfg.emulator) { S.connectAuthEmulator(auth, 'http://' + cfg.emulator + ':9099', { disableWarnings: true }); S.connectFirestoreEmulator(fs, cfg.emulator, 8080); }

  /* ---------------- helpers ---------------- */
  const sortKeys = v => Array.isArray(v) ? v.map(sortKeys) : (v && typeof v === 'object') ? Object.keys(v).sort().reduce((o, k) => (v[k] !== undefined && (o[k] = sortKeys(v[k])), o), {}) : v;
  const stable = o => JSON.stringify(sortKeys(o));
  const clone = o => JSON.parse(JSON.stringify(o));
  const ACTIVE = ['requested', 'confirmed', 'picked'];
  const PROFILE_KEYS = ['role', 'name', 'status', 'pro', 'created', 'phoneVerified', 'vehicle', 'bio', 'langs', 'photo', 'since', 'pastTrips', 'proRequested', 'rejectReason'];
  const ORDER = ['profiles', 'private', 'contacts', 'docs', 'faces', 'trips', 'bookings', 'messages', 'reviews', 'notes', 'requests', 'alerts', 'topups', 'ledger'];
  const COLS = [...ORDER, 'pins'];
  const short = u => { const p = (u?.name || '').trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : (p[0] || 'Member'); };

  /* ---------------- listeners -> cache ---------------- */
  const sources = {};       // key -> { col, map, un }
  const C = {};             // col -> Map(id -> data)
  COLS.forEach(c => C[c] = new Map());
  let shadow = new Map();   // path -> stable JSON of the data as last built
  const pinMemo = {};       // bookingId -> { pin, code } created on this phone
  const done = new Set();   // one-off writes already sent (pins, tracks, links)
  const retryAt = {}, retryN = {};

  function listen(key, col, ref, isDoc) {
    if (sources[key]) return;
    const src = sources[key] = { col, map: new Map(), un: null };
    src.un = S.onSnapshot(ref, snap => {
      src.map = new Map();
      if (isDoc) { if (snap.exists()) src.map.set(snap.id, snap.data()); }
      else snap.forEach(d => src.map.set(d.id, d.data()));
      src.ready = true; schedule();
    }, err => {
      // not allowed (yet): e.g. a contact card before the other person shares it
      if (err.code !== 'permission-denied') console.warn('listen', key, err.code);
      src.un = null; delete sources[key];
      if (key.startsWith('trk_')) { Cloud['_trkMissing' + key.slice(4)] = true; return schedule(); } // sharing switched off
      const n = retryN[key] = (retryN[key] || 0) + 1, wait = Math.min(60000, 3000 * n);
      retryAt[key] = Date.now() + wait; setTimeout(schedule, wait + 50);
    });
  }
  function stop(filter) { Object.keys(sources).forEach(k => { if (filter(k)) { sources[k].un?.(); delete sources[k]; } }); }
  function mergeCache() {
    COLS.forEach(c => C[c] = new Map());
    Object.values(sources).forEach(s => s.map.forEach((v, id) => C[s.col].set(id, v)));
  }

  /* ---------------- cache -> app data ---------------- */
  function userFrom(id) {
    const p = C.profiles.get(id), pr = C.private.get(id), c = C.contacts.get(id), d = C.docs.get(id), f = C.faces.get(id);
    if (!p && !pr) return null;
    const u = Object.assign({ id, phone: '' }, clone(pr || {}), clone(p || {}));
    if (c) { u.name = c.name || u.name; u.phone = c.phone || ''; }
    if (u.vehicle) u.vehicle.reg = c?.reg || '';
    u.docs = Object.assign({}, d ? clone(d) : {}, f?.selfie ? { selfie: f.selfie } : {});
    return u;
  }
  function wallets(users, bookings, trips) {
    users.filter(u => u.role === 'driver').forEach(d => {
      const L = [...C.ledger.values()].filter(x => x.driverId === d.id).map(x => ({ at: x.at, text: x.text, amount: x.amount }));
      bookings.filter(b => b.driverId === d.id && b.status === 'completed' && b.pay === 'cash').forEach(b => {
        const t = trips.find(x => x.id === b.tripId);
        L.push({ at: b.doneAt || b.created, text: `Cash trip fee · ${t ? t.fromTown.split(',')[0] + ' → ' + t.toTown.split(',')[0] : 'trip'}`, amount: -((b.commission || 0) + (b.riderFee || 0)) });
      });
      L.sort((a, b) => a.at - b.at);
      d.wallet = { balance: L.reduce((a, x) => a + x.amount, 0), ledger: L };
    });
  }
  function build() {
    mergeCache();
    const uidMe = Cloud.user?.uid;
    const ids = new Set([...C.profiles.keys(), ...C.private.keys(), ...C.contacts.keys()]);
    const users = [];
    ids.forEach(id => { const u = userFrom(id); if (u) users.push(u); });
    if (uidMe && Cloud.pending?.id === uidMe && !users.some(u => u.id === uidMe)) users.push(Cloud.pending);
    if (Cloud.admin) users.unshift({ id: uidMe, role: 'admin', name: Cloud.adminName || 'Control room', email: Cloud.user.email, status: 'verified', phoneVerified: true, docs: {} });
    const arr = (c, f) => [...C[c].entries()].map(([id, v]) => Object.assign(clone(v), { id }, f ? f(id, v) : {}));
    const trips = arr('trips').sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const bookings = arr('bookings', id => { const p = C.pins.get(id) || pinMemo[id]; return p ? { pin: p.pin, deliveryCode: p.code || '' } : {}; }).sort((a, b) => (a.created || 0) - (b.created || 0));
    wallets(users, bookings, trips);
    const me0 = users.find(u => u.id === uidMe);
    if (me0 && me0.role !== 'admin') me0.email = me0.email || Cloud.user.email;
    const by = k => (a, b) => (a[k] || 0) - (b[k] || 0);
    db = {
      users, trips, bookings,
      messages: arr('messages').sort(by('at')), reviews: arr('reviews').sort(by('at')), notes: arr('notes').sort(by('at')),
      requests: arr('requests').sort(by('at')), alerts: arr('alerts').sort(by('at')), topups: arr('topups').sort(by('at')), ledger: arr('ledger').sort(by('at')),
      tour: (typeof db === 'object' && db?.tour) || {}
    };
    me = me0 || null;
    shadow = toDocs();
    syncTaken();
    attachDynamic();
  }

  /* ---------------- app data -> documents ---------------- */
  function toDocs() {
    const out = new Map(), put = (p, o) => { if (o && Object.keys(o).length) out.set(p, stable(o)); };
    const strip = (o, ...ks) => { const x = {}; Object.keys(o).forEach(k => { if (k[0] !== '_' && !['id', ...ks].includes(k)) x[k] = o[k]; }); return x; };
    db.users.forEach(u => {
      if (u.role === 'admin') return;
      const prof = {}, priv = {};
      Object.keys(u).forEach(k => {
        if (k[0] === '_' || ['id', 'docs', 'wallet', 'pw', 'phone', 'name', 'vehicle'].includes(k)) return;
        (PROFILE_KEYS.includes(k) ? prof : priv)[k] = u[k];
      });
      prof.name = short(u); prof.pro = !!u.pro;
      if (u.vehicle) { const { reg, ...v } = u.vehicle; prof.vehicle = v; }
      put('profiles/' + u.id, prof);
      put('private/' + u.id, priv);
      if (u.phone) put('contacts/' + u.id, Object.assign({ name: u.name, phone: u.phone }, u.vehicle?.reg ? { reg: u.vehicle.reg } : {}));
      const { selfie, ...docs } = u.docs || {};
      put('docs/' + u.id, docs);
      if (selfie) put('faces/' + u.id, { selfie });
    });
    db.trips.forEach(t => put('trips/' + t.id, strip(t)));
    db.bookings.forEach(b => put('bookings/' + b.id, strip(b, 'pin', 'deliveryCode')));
    db.messages.forEach(m => { const b = db.bookings.find(x => x.id === m.bookingId); put('messages/' + m.id, Object.assign(strip(m), b ? { participants: [b.riderId, b.driverId] } : {})); });
    db.reviews.forEach(r => put('reviews/' + r.bookingId + '_' + r.from, strip(r)));
    ['notes', 'requests', 'alerts', 'topups', 'ledger'].forEach(c => (db[c] || []).forEach(x => { if (!x.id) x.id = uid(c[0]); put(c + '/' + x.id, strip(x)); }));
    return out;
  }

  let failToast = 0;
  function write(path, data, old) {
    if (old) Object.keys(JSON.parse(old)).forEach(k => { if (!(k in data)) data[k] = S.deleteField(); });
    S.setDoc(S.doc(fs, path), data, { merge: true }).catch(e => {
      console.warn('write', path, e.code);
      if (e.code === 'permission-denied' && Date.now() > failToast) { failToast = Date.now() + 5000; toast('That change was not allowed', 'err'); }
      schedule();
    });
  }
  Cloud.save = () => {
    if (!db) return true;
    if (!Cloud.user) { // visitors (family tracking page) can only raise a concern
      (db.alerts || []).filter(a => a.kind === 'concern' && !a.id).forEach(a => { a.id = uid('a'); write('alerts/' + a.id, strip0(a)); });
      return true;
    }
    if (Cloud.user && !me && !Cloud.admin) return true;
    const out = toDocs(), writes = [];
    out.forEach((s, path) => { const old = shadow.get(path); if (s !== old) writes.push([path, JSON.parse(s), old]); });
    writes.sort((a, b) => ORDER.indexOf(a[0].split('/')[0]) - ORDER.indexOf(b[0].split('/')[0]));
    writes.forEach(([p, d, old]) => { shadow.set(p, stable(d)); write(p, d, old); });
    ensure();
    return true;
  };
  const strip0 = o => { const x = { ...o }; delete x.id; return x; };

  /* one-off documents: secret PIN, family tracking pointer, contact sharing */
  function ensure() {
    const myId = Cloud.user?.uid; if (!myId || Cloud.admin) return;
    const once = (key, path, data) => { if (done.has(key)) return; done.add(key); S.setDoc(S.doc(fs, path), data).catch(e => { done.delete(key); console.warn('write', path, e.code); }); };
    db.bookings.forEach(b => {
      if (b.riderId === myId && b.pin && !C.pins.has(b.id)) { pinMemo[b.id] = { pin: b.pin, code: b.deliveryCode || '' }; once('pin' + b.id, 'pins/' + b.id, pinMemo[b.id]); }
      if (b.riderId === myId && b.share?.code) once('trk' + b.share.code, 'tracks/' + b.share.code, { bookingId: b.id });
      if (!ACTIVE.includes(b.status)) return;
      const t = db.trips.find(x => x.id === b.tripId), dep = t ? new Date(t.date + 'T' + (t.time || '12:00')).getTime() : Date.now();
      const until = Math.min(dep + 2 * 86400000, Date.now() + 29 * 86400000);
      // the rider shares their contact card with the driver when booking; the driver shares theirs when accepting
      if (b.riderId === myId) once(`lnk${b.driverId}_${myId}`, `links/${b.driverId}_${myId}`, { until });
      if (b.driverId === myId && b.status !== 'requested') once(`lnk${b.riderId}_${myId}`, `links/${b.riderId}_${myId}`, { until });
    });
  }

  /* drivers keep a public "seats taken" count on their trips, because riders can't see other riders' bookings */
  let takenTimer;
  function syncTaken() {
    if (!me || me.role !== 'driver') return;
    let changed = false;
    db.trips.filter(t => t.driverId === me.id && t.status === 'open').forEach(t => {
      const n = db.bookings.filter(b => b.tripId === t.id && ACTIVE.includes(b.status) && b.type === 'seat').reduce((a, b) => a + b.seats, 0);
      if ((t.taken || 0) !== n) { t.taken = n; changed = true; }
    });
    if (changed) { clearTimeout(takenTimer); takenTimer = setTimeout(() => Cloud.save(), 50); }
  }

  /* per person / per booking listeners */
  function attachDynamic() {
    const myId = Cloud.user?.uid; if (!myId || Cloud.admin) return;
    const want = new Set();
    db.bookings.forEach(b => {
      if (b.riderId === myId) want.add('pin_' + b.id);
      if (ACTIVE.includes(b.status) || b.status === 'completed') { const o = b.riderId === myId ? b.driverId : b.riderId; if (o && o !== myId) { want.add('ct_' + o); want.add('fc_' + o); } }
    });
    want.forEach(k => {
      if (sources[k] || (retryAt[k] && retryAt[k] > Date.now())) return;
      const [kind, id] = [k.slice(0, k.indexOf('_')), k.slice(k.indexOf('_') + 1)];
      if (kind === 'pin') listen(k, 'pins', S.doc(fs, 'pins', id), true);
      if (kind === 'ct') listen(k, 'contacts', S.doc(fs, 'contacts', id), true);
      if (kind === 'fc') listen(k, 'faces', S.doc(fs, 'faces', id), true);
    });
  }

  /* ---------------- rebuild + render (never while someone is typing) ---------------- */
  let timer, waiting = false;
  const typing = () => { const a = document.activeElement; return a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.type !== 'checkbox' && a.type !== 'radio' && a.type !== 'file'; };
  function schedule() { clearTimeout(timer); timer = setTimeout(flush, 40); }
  function flush() {
    build();
    Cloud._firstData?.();
    if (!Cloud.booted) return;
    if (typing() || !document.getElementById('modal')?.classList.contains('hidden')) { waiting = true; return; }
    waiting = false; render();
  }
  document.addEventListener('focusout', () => setTimeout(() => { if (waiting && !typing() && document.getElementById('modal')?.classList.contains('hidden')) { waiting = false; render(); } }, 200));
  const mo = new MutationObserver(() => { if (waiting && document.getElementById('modal')?.classList.contains('hidden') && !typing()) { waiting = false; render(); } });
  window.addEventListener('DOMContentLoaded', () => { const m = document.getElementById('modal'); if (m) mo.observe(m, { attributes: true, attributeFilter: ['class'] }); });

  /* ---------------- sign in state ---------------- */
  const q = (c, ...w) => S.query(S.collection(fs, c), ...w);
  function startPublic() {
    listen('trips', 'trips', S.collection(fs, 'trips'));
    listen('profiles', 'profiles', S.collection(fs, 'profiles'));
    listen('reviews', 'reviews', S.collection(fs, 'reviews'));
  }
  function startPrivate(uid, admin) {
    listen('requests', 'requests', S.collection(fs, 'requests'));
    listen('notes', 'notes', q('notes', S.where('to', '==', uid)));
    if (admin) {
      ['private', 'contacts', 'docs', 'faces', 'bookings', 'messages', 'alerts', 'topups', 'ledger'].forEach(c => listen('a_' + c, c, S.collection(fs, c)));
      listen('notesA', 'notes', q('notes', S.where('to', '==', 'admins')));
      return;
    }
    ['private', 'contacts', 'docs', 'faces'].forEach(c => listen('me_' + c, c, S.doc(fs, c, uid), true));
    listen('bkR', 'bookings', q('bookings', S.where('riderId', '==', uid)));
    listen('bkD', 'bookings', q('bookings', S.where('driverId', '==', uid)));
    listen('msg', 'messages', q('messages', S.where('participants', 'array-contains', uid)));
    listen('alerts', 'alerts', q('alerts', S.where('userId', '==', uid)));
    listen('topups', 'topups', q('topups', S.where('driverId', '==', uid)));
    listen('ledger', 'ledger', q('ledger', S.where('driverId', '==', uid)));
  }
  const PUBLIC = ['trips', 'profiles', 'reviews'];

  let authKnown, authReady = new Promise(r => authKnown = r);
  S.onAuthStateChanged(auth, async u => {
    stop(k => !PUBLIC.includes(k) && !k.startsWith('trk'));
    Object.keys(pinMemo).forEach(k => delete pinMemo[k]); done.clear();
    Cloud.user = u; Cloud.admin = false; Cloud.adminName = '';
    if (u) {
      try { const a = await S.getDoc(S.doc(fs, 'admins', u.uid)); if (a.exists()) { Cloud.admin = true; Cloud.adminName = a.data().name || 'Control room'; } } catch { }
      startPrivate(u.uid, Cloud.admin);
    }
    schedule(); authKnown();
  });

  /* family tracking page: no account needed, only the shared trip is readable */
  Cloud.loadTrack = async code => {
    if (sources['trk_' + code] || Cloud['_trk' + code]) return; Cloud['_trk' + code] = true;
    try {
      const t = await S.getDoc(S.doc(fs, 'tracks', code));
      if (!t.exists()) { Cloud['_trkMissing' + code] = true; return render(); }
      listen('trk_' + code, 'bookings', S.doc(fs, 'bookings', t.data().bookingId), true);
    } catch { Cloud['_trkMissing' + code] = true; render(); }
  };
  Cloud.trackMissing = code => !!Cloud['_trkMissing' + code];

  /* live position (separate small document, so the map moves without redrawing the page) */
  Cloud.watchLive = (bookingId, cb) => S.onSnapshot(S.doc(fs, 'live', bookingId), s => cb(s.exists() ? s.data() : null), () => cb(null));
  let lastPos = 0;
  Cloud.sendPos = (bookingId, lat, lng) => {
    if (!Cloud.user || Date.now() - lastPos < 15000) return; lastPos = Date.now();
    S.setDoc(S.doc(fs, 'live', bookingId), { lat, lng, at: Date.now(), by: Cloud.user.uid }).catch(e => console.warn('live', e.code));
  };

  /* PIN / delivery code: checked by the security rules, the driver never sees it */
  Cloud.tryCode = async (b, value, kind, finish) => {
    const tk = kind === 'pin' ? 'pinTries' : 'codeTries', vk = kind === 'pin' ? 'pinTry' : 'codeTry', used = b[tk] || 0;
    if (used >= 5) return { ok: false, msg: 'Too many wrong tries. Call the Control room.' };
    const ref = S.doc(fs, 'bookings', b.id);
    try { await S.updateDoc(ref, { [vk]: value, [tk]: used + 1 }); } catch { return { ok: false, msg: 'Could not check the code, try again' }; }
    try { await S.updateDoc(ref, finish); return { ok: true }; }
    catch { const left = 4 - used; return { ok: false, msg: left > 0 ? `Wrong ${kind === 'pin' ? 'PIN' : 'code'}. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Wrong code. No tries left, call the Control room.' }; }
  };

  /* ---------------- accounts ---------------- */
  const LOCK = 'ttv_lock', MAX_TRIES = 5, LOCK_MIN = 15;
  const lockState = () => { try { return JSON.parse(localStorage.getItem(LOCK)) || { n: 0, until: 0 }; } catch { return { n: 0, until: 0 }; } };
  Cloud.lockedFor = () => Math.max(0, Math.ceil((lockState().until - Date.now()) / 60000));
  Cloud.login = async (email, pw) => {
    const s = lockState();
    if (s.until > Date.now()) throw { code: 'ttv/locked' };
    try { await S.signInWithEmailAndPassword(auth, email, pw); localStorage.removeItem(LOCK); }
    catch (e) {
      if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email', 'auth/invalid-login-credentials'].includes(e.code)) {
        s.n = (s.n || 0) + 1; if (s.n >= MAX_TRIES) { s.until = Date.now() + LOCK_MIN * 60000; s.n = 0; }
        localStorage.setItem(LOCK, JSON.stringify(s)); e.left = s.until > Date.now() ? 0 : MAX_TRIES - s.n;
      }
      throw e;
    }
  };
  Cloud.signup = async (email, pw) => {
    try { const c = await S.createUserWithEmailAndPassword(auth, email, pw); S.sendEmailVerification(c.user).catch(() => { }); return c.user.uid; }
    catch (e) {
      // account made but profile never saved (e.g. lost signal): finish it with the same password
      if (e.code === 'auth/email-already-in-use') {
        try { const c = await S.signInWithEmailAndPassword(auth, email, pw); const p = await S.getDoc(S.doc(fs, 'profiles', c.user.uid)); if (!p.exists()) return c.user.uid; await S.signOut(auth); } catch { }
      }
      throw e;
    }
  };
  Cloud.logout = () => S.signOut(auth);
  Cloud.reset = email => S.sendPasswordResetEmail(auth, email);
  Cloud.emailVerified = () => !!auth.currentUser?.emailVerified;
  Cloud.resendVerify = () => auth.currentUser && S.sendEmailVerification(auth.currentUser);
  Cloud.refreshVerify = async () => { if (!auth.currentUser) return false; await S.reload(auth.currentUser); await auth.currentUser.getIdToken(true); Cloud.user = auth.currentUser; return auth.currentUser.emailVerified; };
  Cloud.changePassword = async (oldPw, newPw) => { const u = auth.currentUser; await S.reauthenticateWithCredential(u, S.EmailAuthProvider.credential(u.email, oldPw)); await S.updatePassword(u, newPw); };
  Cloud.whenMe = (ms = 8000) => new Promise(res => { const t0 = Date.now(); (function w() { if (me || Cloud.admin && db?.users?.length || Date.now() - t0 > ms) return res(me); setTimeout(w, 120); })(); });
  Cloud.err = e => ({
    'ttv/locked': `Too many wrong passwords. Try again in ${Cloud.lockedFor()} min, or reset your password.`,
    'auth/invalid-credential': 'Wrong email or password', 'auth/invalid-login-credentials': 'Wrong email or password', 'auth/wrong-password': 'Wrong email or password', 'auth/user-not-found': 'Wrong email or password',
    'auth/too-many-requests': 'Too many attempts. This account is paused for a while, try later or reset your password.',
    'auth/email-already-in-use': 'That email already has an account. Log in instead.',
    'auth/weak-password': 'Choose a stronger password', 'auth/password-does-not-meet-requirements': 'Password needs 8+ characters with upper and lower case letters and a number',
    'auth/invalid-email': 'Enter a valid email address', 'auth/network-request-failed': 'No internet connection',
    'auth/user-disabled': 'This account has been switched off. Contact Trip To Venda.'
  }[e?.code] || 'Something went wrong, please try again') + (e?.left > 0 && e.left < MAX_TRIES ? ` · ${e.left} ${e.left === 1 ? 'try' : 'tries'} left` : '');

  /* ---------------- start ---------------- */
  Cloud.boot = async () => {
    db = { users: [], trips: [], bookings: [], messages: [], reviews: [], notes: [], requests: [], alerts: [], topups: [], ledger: [], tour: {} };
    startPublic();
    const first = new Promise(r => Cloud._firstData = r);
    await Promise.race([Promise.all([authReady, first]), new Promise(r => setTimeout(r, 6000))]);
    await new Promise(r => setTimeout(r, 120)); // let the sign in listeners deliver
    build(); Cloud.booted = true;
  };
})();
