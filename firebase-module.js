import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc, getDocs, updateDoc, addDoc, serverTimestamp, getDoc, writeBatch, query, orderBy, limit, startAfter } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBd8xA9EpA7JRJv-YcOxMWfunef1d4t6yc",
  authDomain: "tire-warehouse-ce0e4.firebaseapp.com",
  projectId: "tire-warehouse-ce0e4",
  storageBucket: "tire-warehouse-ce0e4.firebasestorage.app",
  messagingSenderId: "1046546431349",
  appId: "1:1046546431349:web:98b2bceb5e3ad6c28a273c"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);
const itemsCol = collection(db, 'tires');
const invCol = collection(db, 'inventory');
// מלאי מ-Excel — נטען פעם אחת בעת הצורך
let _invData = null; // map: itemCode → {caesareaQty, itemDescription}
let _invBrandIdx = null; // token → [{code, qty, descNorm}]
function _buildInvBrandIdx(){
  _invBrandIdx={};
  for(const [code,d] of Object.entries(_invData||{})){
    const desc=(d.itemDescription||'').toUpperCase();
    const descNorm=desc.replace(/[^A-Z0-9]/g,'');
    // אנדקס כל טוקן (3+ תווים) בתיאור — כולל עברית ומספרים
    const tokens=[...new Set((desc.match(/\S{3,}/g)||[]).map(t=>t.replace(/[^A-Z0-9א-ת]/g,'')).filter(t=>t.length>=3))];
    for(const token of tokens){
      if(!_invBrandIdx[token]) _invBrandIdx[token]=[];
      _invBrandIdx[token].push({code,qty:d.caesareaQty,descNorm});
    }
  }
}
async function _loadInvData(){
  if(_invData) return _invData;
  await new Promise(resolve => onAuthReady(resolve));
  const snap = await getDocs(invCol);
  _invData = {};
  snap.docs.forEach(d=>{ _invData[d.id]=d.data(); });
  _buildInvBrandIdx();
  return _invData;
}
window._loadInvData=_loadInvData;
window._getInvQty=function(code,it){
  // 1. exact itemCode
  if(_invData&&code&&_invData[code]) return _invData[code].caesareaQty;
  // 2. token scoring — כל טוקן ממותג+דגם מול תיאורי פריט
  if(!it||!_invBrandIdx) return null;
  const tireText=((it.brand||'')+' '+(it.model||'')).toUpperCase().replace(/[^A-Z0-9א-ת\s]/g,' ');
  const tokens=[...new Set((tireText.match(/\S{3,}/g)||[]))];
  if(!tokens.length) return null;
  const scores={};
  for(const token of tokens){
    for(const c of (_invBrandIdx[token]||[])){
      if(!scores[c.code]) scores[c.code]={qty:c.qty,score:0};
      scores[c.code].score++;
    }
  }
  let best=null,bestScore=0;
  for(const s of Object.values(scores)){if(s.score>bestScore){bestScore=s.score;best=s;}}
  return best&&bestScore>=1?best.qty:null;
};
// ── הצפנת localStorage עם AES-GCM, מפתח ב-IndexedDB ──
const _enc = (() => {
  let _key = null;
  const DB_NAME = 'tirewms_keystore', STORE = 'keys', KEY_ID = 'main';

  function _openDB() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
      r.onsuccess = e => res(e.target.result);
      r.onerror = rej;
    });
  }

  async function init() {
    try {
      const db = await _openDB();
      const get = () => new Promise(r => { const q = db.transaction(STORE).objectStore(STORE).get(KEY_ID); q.onsuccess = () => r(q.result); });
      const put = raw => new Promise(r => { const tx = db.transaction(STORE,'readwrite'); tx.objectStore(STORE).put(raw, KEY_ID); tx.oncomplete = r; });
      const existing = await get();
      if (existing) {
        _key = await crypto.subtle.importKey('raw', existing, {name:'AES-GCM'}, false, ['encrypt','decrypt']);
      } else {
        _key = await crypto.subtle.generateKey({name:'AES-GCM',length:256}, true, ['encrypt','decrypt']);
        await put(await crypto.subtle.exportKey('raw', _key));
      }
    } catch(e) { console.warn('_enc init failed, localStorage stays plaintext:', e); }
  }

  async function set(lsKey, value) {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    if (!_key) { localStorage.setItem(lsKey, str); return; }
    try {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const enc = await crypto.subtle.encrypt({name:'AES-GCM',iv}, _key, new TextEncoder().encode(str));
      localStorage.setItem(lsKey, JSON.stringify({
        iv: btoa(String.fromCharCode(...iv)),
        d:  btoa(String.fromCharCode(...new Uint8Array(enc)))
      }));
    } catch(e) { localStorage.setItem(lsKey, str); }
  }

  async function get(lsKey) {
    const raw = localStorage.getItem(lsKey);
    if (!raw || !_key) return raw;
    try {
      const p = JSON.parse(raw);
      if (!p.iv || !p.d) return raw;
      const iv  = Uint8Array.from(atob(p.iv), c => c.charCodeAt(0));
      const buf = Uint8Array.from(atob(p.d),  c => c.charCodeAt(0));
      const dec = await crypto.subtle.decrypt({name:'AES-GCM',iv}, _key, buf);
      return new TextDecoder().decode(dec);
    } catch(e) { return raw; }
  }

  return { init, set, get };
})();
window._enc = _enc;

// עובדים נשמרים כמסמך מיוחד בתוך אוסף tires (שיש לו הרשאות)
const WORKERS_DOC_ID = 'workers-config';
const workersDocRef = doc(db, 'tires', WORKERS_DOC_ID);

// ── רשימת עובדים (מסונכרנת מ-Firebase) ──
let _workers = [];
let _currentWorkerId = null;   // מזהה העובד המחובר כעת (null = בעלים)
let _currentWorkerName = null; // שם העובד המחובר כעת

function _genWorkerId() { return 'w_' + Date.now() + '_' + Math.random().toString(36).slice(2,7); }

async function _saveWorkersDoc() {
  await new Promise(resolve => onAuthReady(resolve));
  await setDoc(workersDocRef, { _type: 'workers', list: _workers });
}
window._saveWorkersDoc = _saveWorkersDoc;

function loadWorkers() {
  onAuthReady(() => {
    onSnapshot(workersDocRef, snap => {
      if (snap.exists() && snap.data().list) {
        _workers = snap.data().list;
      }
      // טעינת hash סיסמת בעלים מ-Firestore (migration אוטומטי בפעם הראשונה)
      if (snap.exists() && snap.data().ownerTotpSecret) {
        _ownerTotpSecret = snap.data().ownerTotpSecret;
      } else {
        _ownerTotpSecret = null;
      }
      if (snap.exists() && snap.data().ownerPassHash) {
        window._ownerPassHash = snap.data().ownerPassHash;
      } else if (!window._ownerPassHash) {
        // migration: העתק את ה-hash הקשוע לקוד אל Firestore פעם אחת
        const legacy = '61270cb789566f5b26c4e12e11bb7a0d9e3e1b1922ef31b7e014b015c5214e3d';
        window._ownerPassHash = legacy;
        const existingData = snap.exists() ? snap.data() : {};
        setDoc(workersDocRef, { ...existingData, ownerPassHash: legacy });
      }
      const panel = document.getElementById('workerMgmtPanel');
      if (panel && panel.style.display !== 'none') _renderWorkerMgmtList();
    });
  });
}

// ── TOTP / Google Authenticator — MFA לבעלים ──
let _ownerTotpSecret = null; // נטען מ-Firestore בעת טעינת workers-config

function _b32decode(s) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, val = 0, out = [];
  for (const c of s.toUpperCase().replace(/=+$/, '')) {
    val = (val << 5) | a.indexOf(c); bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return new Uint8Array(out);
}

function _b32encode(buf) {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, val = 0, out = '';
  for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += a[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits > 0) out += a[(val << (5 - bits)) & 31];
  return out;
}

async function _calcTOTP(secret, ts) {
  const counter = Math.floor((ts || Date.now() / 1000) / 30);
  const key = await crypto.subtle.importKey('raw', _b32decode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const buf = new ArrayBuffer(8);
  new DataView(buf).setUint32(4, counter, false);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf));
  const off = sig[19] & 0xf;
  const code = ((sig[off] & 0x7f) << 24 | sig[off+1] << 16 | sig[off+2] << 8 | sig[off+3]) % 1000000;
  return String(code).padStart(6, '0');
}

window._verifyTOTP = async function(code) {
  if (!_ownerTotpSecret) return false;
  const now = Date.now() / 1000;
  for (const delta of [0, -30, 30]) {
    if (await _calcTOTP(_ownerTotpSecret, now + delta) === String(code).trim()) return true;
  }
  return false;
};

window._setupTOTP = async function() {
  const raw = crypto.getRandomValues(new Uint8Array(20));
  const secret = _b32encode(raw);
  await new Promise(resolve => onAuthReady(resolve));
  const snap = await getDoc(workersDocRef);
  const existing = snap.exists() ? snap.data() : {};
  await setDoc(workersDocRef, { ...existing, ownerTotpSecret: secret });
  _ownerTotpSecret = secret;
  return { secret, url: `otpauth://totp/TireWMS%3A%D7%91%D7%A2%D7%9C%D7%99%D7%9D?secret=${secret}&issuer=TireWMS` };
};

window._disableTOTP = async function() {
  await new Promise(resolve => onAuthReady(resolve));
  const snap = await getDoc(workersDocRef);
  const existing = snap.exists() ? snap.data() : {};
  delete existing.ownerTotpSecret;
  await setDoc(workersDocRef, existing);
  _ownerTotpSecret = null;
};

// ── אימות אנונימי — חוסם גישה ישירה ל-Firestore מחוץ לאפליקציה ──
// מחכה לאימות לפני הפעלת Firestore (מונע race condition)
let _authReady = false;
const _authReadyCallbacks = [];
function onAuthReady(cb) {
  if (_authReady) { cb(); } else { _authReadyCallbacks.push(cb); }
}
_enc.init(); // אתחל מפתח הצפנה לפני כל שימוש ב-localStorage
signInAnonymously(auth)
  .then(() => {
    _authReady = true;
    _authReadyCallbacks.forEach(cb => cb());
  })
  .catch(e => {
    console.warn('Auth error:', e);
    // גם אם האימות נכשל — ממשיך (עבור Firestore rules פתוחות)
    _authReady = true;
    _authReadyCallbacks.forEach(cb => cb());
  });

// ── אבטחה: isAdminMode קריאה בלבד — לא ניתן לשינוי מ-DevTools ──
const ADMIN_PASS_HASH = '61270cb789566f5b26c4e12e11bb7a0d9e3e1b1922ef31b7e014b015c5214e3d';
const SESSION_SALT = 'tirewms_sess_v2_2024';

let _isAdmin = false;
let _isOwner = false; // רק כניסה עם סיסמת בעלים — מאפשר ניהול עובדים
Object.defineProperty(window, 'isAdminMode', {
  get: () => _isAdmin,
  set: () => { /* חסום — לא ניתן לשינוי ידני */ },
  configurable: false,
  enumerable: false
});
Object.defineProperty(window, 'isOwnerMode', {
  get: () => _isOwner,
  set: () => { /* חסום */ },
  configurable: false,
  enumerable: false
});
Object.defineProperty(window, 'currentWorkerName', {
  get: () => _currentWorkerName,
  set: () => { /* חסום */ },
  configurable: false,
  enumerable: false
});

function hashPass(p) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(p))
    .then(b => Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join(''));
}

// ── Session חתום — מונע זיוף ב-localStorage ──
async function genToken(admin) {
  const day = Math.floor(Date.now() / 86400000);
  const passRef = window._ownerPassHash || ADMIN_PASS_HASH;
  const raw = SESSION_SALT + passRef + String(admin) + String(day);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2,'0')).join('');
}

async function saveSession(admin, workerId=null, workerName=null) {
  const token = await genToken(admin);
  await _enc.set('tirewms_session', JSON.stringify({admin, workerId, workerName, ts: Date.now(), token}));
  const role = _isOwner ? 'owner' : (admin ? 'admin' : 'worker');
  if (window._saveSessionRole) window._saveSessionRole(role);
}

async function loadSession() {
  try {
    const raw = await _enc.get('tirewms_session');
    const s = JSON.parse(raw || 'null');
    if (!s || !s.token) return null;
    if (Date.now() - s.ts > 30*24*60*60*1000) { localStorage.removeItem('tirewms_session'); return null; }
    const expected = await genToken(s.admin);
    if (s.token !== expected) { localStorage.removeItem('tirewms_session'); return null; }
    // אם מדובר בעובד — בדוק שעדיין קיים ב-Firebase ושהרשאותיו לא השתנו
    if (s.workerId) {
      await new Promise(resolve => onAuthReady(resolve));
      const worker = _workers.find(w => w.id === s.workerId);
      if (!worker) { localStorage.removeItem('tirewms_session'); return null; }
      s.admin = !!worker.isAdmin; // רענן הרשאה מ-Firebase
      s.workerName = worker.name;
    }
    return s;
  } catch(e) { return null; }
}

function clearSession() { localStorage.removeItem('tirewms_session'); }

function setStatus(s) {
  const el = document.getElementById('syncStatus');
  if (el) el.textContent = s;
}
window.setStatus = setStatus;

// ── מסך כניסה ──
async function buildLoginScreen() {
  const session = await loadSession();
  if (session) {
    _isAdmin = session.admin;
    _isOwner = !session.workerId; // בעלים אם אין workerId
    _currentWorkerId = session.workerId || null;
    const role = _isOwner ? 'owner' : (session.admin ? 'admin' : 'worker');
    if (window._saveSessionRole) window._saveSessionRole(role);
    enterApp(session.admin, session.workerName || null);
    return;
  }

  const ls = document.createElement('div');
  ls.id = 'loginScreen';
  ls.style.cssText = 'position:fixed;inset:0;background:#0c0e14;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;z-index:9999;font-family:Heebo,sans-serif;direction:rtl;padding:24px;overflow-y:auto;';

  ls.innerHTML = `
    <div style="font-size:52px;">🛞</div>
    <div style="font-size:22px;font-weight:900;color:#eef0f6;">TireWMS</div>
    <div style="font-size:13px;color:#7a8299;text-align:center;">מחסן ניהול צמיגים</div>

    <div style="width:100%;max-width:300px;background:#191d28;border:1px solid #2a3045;border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:10px;">
      <div style="font-size:13px;color:#7a8299;font-weight:700;">👤 כניסת עובד</div>
      <input id="workerNameInput" type="text" placeholder="הקלד שם עובד..." autocomplete="off" list="workersList"
        style="background:#0c0e14;border:1px solid #2a3045;border-radius:8px;color:#eef0f6;font-family:Heebo,sans-serif;font-size:15px;padding:11px 12px;width:100%;outline:none;box-sizing:border-box;"/>
      <datalist id="workersList"></datalist>
      <input id="workerPinInput" type="password" inputmode="numeric" maxlength="6" placeholder="קוד PIN"
        style="background:#0c0e14;border:1px solid #2a3045;border-radius:8px;color:#eef0f6;font-family:Heebo,sans-serif;font-size:18px;padding:10px;width:100%;outline:none;text-align:center;letter-spacing:4px;" autocomplete="current-password" autocorrect="off" spellcheck="false"/>
      <button id="btnWorkerLogin" style="background:#3b82f6;border:none;color:#fff;padding:12px;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">כניסה</button>
      <div id="workerErr" style="color:#e85d3f;font-size:12px;text-align:center;display:none;">PIN שגוי</div>
    </div>

    <button id="btnOwnerToggle" style="background:none;border:none;color:#7a8299;font-size:12px;cursor:pointer;font-family:Heebo,sans-serif;text-decoration:underline;">👑 כניסה כבעלים</button>

    <div id="adminPassWrap" style="display:none;width:100%;max-width:300px;flex-direction:column;gap:8px;">
      <!-- שלב 1: סיסמה -->
      <div id="ownerPassStep" style="display:flex;flex-direction:column;gap:8px;">
        <input id="adminPassInput" type="password" placeholder="סיסמת בעלים"
          style="background:#191d28;border:1px solid #2a3045;border-radius:9px;color:#eef0f6;font-family:Heebo,sans-serif;font-size:15px;padding:12px;width:100%;outline:none;text-align:center;" autocomplete="current-password" autocorrect="off" spellcheck="false"/>
        <button id="btnPassOk" style="background:#f5a623;border:none;color:#111;padding:12px;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;width:100%;">כניסה כבעלים</button>
        <label style="display:flex;align-items:center;gap:8px;font-size:12px;color:#7a8299;cursor:pointer;">
          <input type="checkbox" id="rememberMe" style="width:16px;height:16px;cursor:pointer;"/> זכור אותי (30 יום)
        </label>
        <div id="passErr" style="color:#e85d3f;font-size:12px;text-align:center;display:none;">סיסמא שגויה</div>
      </div>
      <!-- שלב 2: קוד Google Authenticator (מוצג רק אם MFA פעיל) -->
      <div id="ownerTotpStep" style="display:none;flex-direction:column;gap:8px;">
        <div style="text-align:center;font-size:13px;color:#7a8299;">🔐 הכנס קוד מ-Google Authenticator</div>
        <input id="totpInput" type="text" inputmode="numeric" placeholder="000000" maxlength="6"
          style="background:#191d28;border:1px solid #2a3045;border-radius:9px;color:#eef0f6;font-family:monospace;font-size:22px;padding:12px;width:100%;outline:none;text-align:center;letter-spacing:3px;" autocomplete="off" autocorrect="off" spellcheck="false"/>
        <button data-action="checkTOTP" style="background:#f5a623;border:none;color:#111;padding:12px;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;width:100%;">אמת קוד</button>
        <div id="totpErr" style="color:#e85d3f;font-size:12px;text-align:center;display:none;"></div>
      </div>
    </div>
  `;

  document.body.appendChild(ls);

  document.getElementById('btnWorkerLogin').addEventListener('click', () => _doWorkerLogin());
  document.getElementById('workerPinInput').addEventListener('keydown', e => { if(e.key==='Enter') _doWorkerLogin(); });
  document.getElementById('btnOwnerToggle').addEventListener('click', () => {
    document.getElementById('adminPassWrap').style.display = 'flex';
    setTimeout(() => document.getElementById('adminPassInput').focus(), 50);
  });
  document.getElementById('btnPassOk').addEventListener('click', checkPass);
  document.getElementById('adminPassInput').addEventListener('keydown', e => { if(e.key==='Enter') checkPass(); });
  document.getElementById('totpInput').addEventListener('keydown', e => { if(e.key==='Enter') checkTOTP(); });

  // עדכן רשימת עובדים ברקע כשהחיבור מוכן
  onAuthReady(() => {
    onSnapshot(workersDocRef, snap => {
      if (snap.exists() && snap.data().list) {
        _workers = snap.data().list;
      }
      const dl = document.getElementById('workersList');
      if (dl) dl.innerHTML = _workers.map(w => `<option value="${escHTML(w.name)}"></option>`).join('');
      const panel = document.getElementById('workerMgmtPanel');
      if (panel && panel.style.display !== 'none') _renderWorkerMgmtList();
    });
  });
}

async function _doWorkerLogin() {
  const nameEl = document.getElementById('workerNameInput');
  const pinEl  = document.getElementById('workerPinInput');
  const errEl  = document.getElementById('workerErr');
  const typedName = nameEl ? nameEl.value.trim() : '';
  const pin = pinEl ? pinEl.value : '';
  if (!typedName) { if(errEl){ errEl.textContent='הכנס שם עובד'; errEl.style.display='block'; } return; }
  if (!pin) { if(errEl){ errEl.textContent='הכנס קוד PIN'; errEl.style.display='block'; } return; }
  const worker = _workers.find(w => w.name.trim().toLowerCase() === typedName.toLowerCase());
  if (!worker) { if(errEl){ errEl.textContent='עובד לא נמצא'; errEl.style.display='block'; } return; }
  const h = await hashPass(pin);
  if (h !== worker.pinHash) {
    if(errEl){ errEl.textContent='PIN שגוי'; errEl.style.display='block'; }
    if(pinEl) pinEl.value = '';
    return;
  }
  _isAdmin = !!worker.isAdmin;
  _isOwner = false;
  _currentWorkerId = worker.id;
  _currentWorkerName = worker.name;
  await saveSession(_isAdmin, worker.id, worker.name);
  enterApp(_isAdmin, worker.name);
}

async function _doOwnerEnter(remember) {
  if (remember) await saveSession(true, null, 'בעלים');
  _isAdmin = true; _isOwner = true;
  _currentWorkerId = null; _currentWorkerName = 'בעלים';
  enterApp(true, 'בעלים');
}

async function checkTOTP() {
  const code = (document.getElementById('totpInput')?.value || '').trim();
  const err  = document.getElementById('totpErr');
  if (!code) return;
  const ok = await window._verifyTOTP(code);
  if (ok) {
    const remember = document.getElementById('rememberMe');
    await _doOwnerEnter(remember && remember.checked);
  } else {
    if (err) { err.textContent = '❌ קוד שגוי — נסה שוב'; err.style.display = 'block'; }
    if (document.getElementById('totpInput')) document.getElementById('totpInput').value = '';
  }
}
window.checkTOTP = checkTOTP;

function _showTotpStep() {
  const passStep = document.getElementById('ownerPassStep');
  const totpStep = document.getElementById('ownerTotpStep');
  if (passStep) passStep.style.display = 'none';
  if (totpStep) { totpStep.style.display = ''; document.getElementById('totpInput')?.focus(); }
}

function checkPass() {
  const val = document.getElementById('adminPassInput').value;
  if (!val) return;
  hashPass(val).then(async h => {
    if (h === (window._ownerPassHash || ADMIN_PASS_HASH)) {
      if (_ownerTotpSecret) {
        _showTotpStep();
        return;
      }
      const remember = document.getElementById('rememberMe');
      await _doOwnerEnter(remember && remember.checked);
    } else {
      document.getElementById('passErr').style.display = 'block';
      document.getElementById('passErr').textContent = 'סיסמא שגויה';
      document.getElementById('adminPassInput').value = '';
    }
  });
}

function enterApp(admin, workerName) {
  const ls = document.getElementById('loginScreen');
  if (ls) ls.style.display = 'none';
  document.querySelector('.app').style.display = '';

  // הגדר מחלקות הרשאה על ה-body
  document.body.classList.remove('is-owner','is-admin-worker');
  if (_isOwner) {
    document.body.classList.add('is-owner');
  } else if (_isAdmin) {
    document.body.classList.add('is-admin-worker');
  }


  if (!admin) {
    // עובד רגיל — view only
    document.querySelectorAll('.btn-add').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
  } else if (!_isOwner) {
    // עובד מנהל — ניהול מיקומים בלבד
    document.querySelectorAll('.btn-add').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  } else {
    // בעלים — גישה מלאה
    document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');
  }

  // טען עובדים לפאנל הניהול
  loadWorkers();
  // הפעל גיבוי אוטומטי ל-Drive בכניסת בעלים
  if (_isOwner && typeof _gdStartAutoBackup === 'function') _gdStartAutoBackup();

  let ub = document.getElementById('userBar');
  if (!ub) {
    ub = document.createElement('div');
    ub.id = 'userBar';
    document.querySelector('.topbar').appendChild(ub);
  }
  const displayName = workerName || (admin ? 'מנהל' : 'עובד');
  const roleIcon = admin ? '👑' : '👁️';
  ub.innerHTML = `
    <span style="font-size:11px;color:${admin ? '#f5a623' : '#7a8299'};font-weight:700;white-space:nowrap;">${roleIcon} ${escHTML(displayName)}</span>
    ${_isOwner ? `<button id="btnWorkerMgmt" data-action="openWorkerMgmt" style="background:none;border:1px solid #252b3b;border-radius:6px;color:#7a8299;font-size:12px;padding:5px 9px;cursor:pointer;font-family:inherit;white-space:nowrap;">👥 עובדים</button>` : ''}
    ${_isOwner ? `<button data-action="openChangePass" style="background:none;border:1px solid #252b3b;border-radius:6px;color:#7a8299;font-size:12px;padding:5px 9px;cursor:pointer;font-family:inherit;white-space:nowrap;">🔑 סיסמה</button>` : ''}
    ${_isOwner ? `<button data-action="openMfaSetup" style="background:none;border:1px solid ${_ownerTotpSecret ? '#3ecf8e' : '#252b3b'};border-radius:6px;color:${_ownerTotpSecret ? '#3ecf8e' : '#7a8299'};font-size:12px;padding:5px 9px;cursor:pointer;font-family:inherit;white-space:nowrap;">🔐 MFA${_ownerTotpSecret ? ' ✓' : ''}</button>` : ''}
    <button id="logoutBtn" style="background:none;border:1px solid #252b3b;border-radius:6px;color:#7a8299;font-size:12px;padding:5px 9px;cursor:pointer;font-family:inherit;white-space:nowrap;">🚪 יציאה</button>
  `;
  document.getElementById('logoutBtn').addEventListener('click', _logout);
  setStatus(admin ? `🟢 ${escHTML(displayName)}` : `🟢 ${escHTML(displayName)}`);
}

async function openMfaSetup() {
  if (!_isOwner) return;
  const overlay = document.createElement('div');
  overlay.id = 'mfaSetupOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(12,14,20,.9);z-index:9500;display:flex;align-items:center;justify-content:center;font-family:Heebo,sans-serif;direction:rtl;';

  if (_ownerTotpSecret) {
    overlay.innerHTML = `
      <div style="background:#191d28;border-radius:12px;padding:24px;width:320px;display:flex;flex-direction:column;gap:14px;align-items:center;">
        <div style="font-size:16px;font-weight:700;color:#3ecf8e;">🔐 אימות דו-שלבי פעיל</div>
        <div style="font-size:13px;color:#7a8299;text-align:center;">Google Authenticator מוגדר ופעיל על החשבון שלך.</div>
        <button data-action="confirmDisableMfa" style="width:100%;padding:10px;background:rgba(232,93,63,.15);border:1px solid #e85d3f;border-radius:7px;color:#e85d3f;font-weight:700;cursor:pointer;font-family:inherit;">❌ בטל אימות דו-שלבי</button>
        <button data-remove="mfaSetupOverlay" style="width:100%;padding:10px;background:#252b3b;border:none;border-radius:7px;color:#eef0f6;cursor:pointer;font-family:inherit;">סגור</button>
      </div>`;
  } else {
    const { url } = await window._setupTOTP();
    const qrUrl = `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(url)}`;
    overlay.innerHTML = `
      <div style="background:#191d28;border-radius:12px;padding:24px;width:320px;display:flex;flex-direction:column;gap:14px;align-items:center;">
        <div style="font-size:16px;font-weight:700;color:#eef0f6;">🔐 הגדרת Google Authenticator</div>
        <div style="font-size:12px;color:#7a8299;text-align:center;">1. הורד Google Authenticator מהחנות<br>2. לחץ "+" ← "סרוק QR"<br>3. סרוק את הקוד למטה</div>
        <img src="${qrUrl}" style="width:180px;height:180px;border-radius:8px;background:#fff;padding:4px;" alt="QR Code"/>
        <div style="font-size:12px;color:#7a8299;text-align:center;">לאחר הסריקה הכנס קוד לאישור:</div>
        <input id="mfaConfirmCode" type="number" inputmode="numeric" placeholder="000000" maxlength="6"
          style="background:#0c0e14;border:1px solid #252b3b;border-radius:7px;color:#eef0f6;font-size:22px;padding:10px;width:100%;text-align:center;letter-spacing:6px;font-family:inherit;"/>
        <div id="mfaConfirmErr" style="color:#e85d3f;font-size:12px;display:none;"></div>
        <button data-action="confirmMfaSetup" style="width:100%;padding:10px;background:#f5a623;border:none;border-radius:7px;color:#111;font-weight:700;cursor:pointer;font-family:inherit;">אשר והפעל</button>
        <button data-action="cancelMfaSetup" style="width:100%;padding:10px;background:#252b3b;border:none;border-radius:7px;color:#eef0f6;cursor:pointer;font-family:inherit;">ביטול</button>
      </div>`;
  }
  document.body.appendChild(overlay);
}
window.openMfaSetup = openMfaSetup;

async function confirmMfaSetup() {
  const code = (document.getElementById('mfaConfirmCode')?.value || '').trim();
  const err  = document.getElementById('mfaConfirmErr');
  const ok   = await window._verifyTOTP(code);
  if (ok) {
    document.getElementById('mfaSetupOverlay').remove();
    if (window._toast) window._toast('✅ Google Authenticator הופעל בהצלחה!');
    enterApp(true, 'בעלים'); // רענן סרגל כדי להציג MFA ✓
  } else {
    if (err) { err.textContent='❌ קוד שגוי — נסה שוב'; err.style.display='block'; }
  }
}
window.confirmMfaSetup = confirmMfaSetup;

async function cancelMfaSetup() {
  await window._disableTOTP();
  document.getElementById('mfaSetupOverlay')?.remove();
}
window.cancelMfaSetup = cancelMfaSetup;

async function confirmDisableMfa() {
  if (!confirm('לבטל את אימות דו-שלבי? חשבון הבעלים יהיה מוגן בסיסמה בלבד.')) return;
  await window._disableTOTP();
  document.getElementById('mfaSetupOverlay')?.remove();
  if (window._toast) window._toast('⚠️ אימות דו-שלבי בוטל');
  enterApp(true, 'בעלים');
}
window.confirmDisableMfa = confirmDisableMfa;

function openChangePass() {
  if (!_isOwner) return;
  const overlay = document.createElement('div');
  overlay.id = 'changePassOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(12,14,20,.85);z-index:9500;display:flex;align-items:center;justify-content:center;font-family:Heebo,sans-serif;direction:rtl;';
  overlay.innerHTML = `
    <div style="background:#191d28;border-radius:12px;padding:24px;width:300px;display:flex;flex-direction:column;gap:12px;">
      <div style="font-size:16px;font-weight:700;color:#eef0f6;">🔑 שינוי סיסמת בעלים</div>
      <input id="cpCurrent" type="password" placeholder="סיסמה נוכחית" style="padding:10px;border-radius:7px;border:1px solid #252b3b;background:#0c0e14;color:#eef0f6;font-family:inherit;font-size:14px;"/>
      <input id="cpNew" type="password" placeholder="סיסמה חדשה" style="padding:10px;border-radius:7px;border:1px solid #252b3b;background:#0c0e14;color:#eef0f6;font-family:inherit;font-size:14px;"/>
      <input id="cpConfirm" type="password" placeholder="אשר סיסמה חדשה" style="padding:10px;border-radius:7px;border:1px solid #252b3b;background:#0c0e14;color:#eef0f6;font-family:inherit;font-size:14px;"/>
      <div id="cpErr" style="color:#e85d3f;font-size:12px;display:none;"></div>
      <div style="display:flex;gap:8px;">
        <button data-action="doChangePass" style="flex:1;padding:10px;background:#f5a623;color:#0c0e14;border:none;border-radius:7px;font-weight:700;cursor:pointer;font-family:inherit;">שמור</button>
        <button data-remove="changePassOverlay" style="flex:1;padding:10px;background:#252b3b;color:#eef0f6;border:none;border-radius:7px;cursor:pointer;font-family:inherit;">ביטול</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}
window.openChangePass = openChangePass;

async function doChangePass() {
  const curr = document.getElementById('cpCurrent').value;
  const nw   = document.getElementById('cpNew').value;
  const conf = document.getElementById('cpConfirm').value;
  const err  = document.getElementById('cpErr');
  err.style.display = 'none';
  if (!curr || !nw || !conf) { err.textContent='יש למלא את כל השדות'; err.style.display='block'; return; }
  if (nw !== conf)           { err.textContent='הסיסמאות החדשות אינן תואמות'; err.style.display='block'; return; }
  if (nw.length < 6)         { err.textContent='סיסמה חייבת להכיל לפחות 6 תווים'; err.style.display='block'; return; }
  const currHash = await hashPass(curr);
  if (currHash !== (window._ownerPassHash || ADMIN_PASS_HASH)) {
    err.textContent='הסיסמה הנוכחית שגויה'; err.style.display='block'; return;
  }
  const newHash = await hashPass(nw);
  const ok = await window._changeOwnerPass(newHash);
  if (ok) {
    document.getElementById('changePassOverlay').remove();
    if (window._toast) window._toast('✅ הסיסמה שונתה בהצלחה');
  } else {
    err.textContent='שגיאה בשמירה — נסה שוב'; err.style.display='block';
  }
}
window.doChangePass = doChangePass;

function _logout() {
  if (window._clearSessionRole) window._clearSessionRole();
  clearSession();
  _isAdmin = false;
  _isOwner = false;
  _currentWorkerName = null;
  document.body.classList.remove('is-owner','is-admin-worker');
  document.querySelector('.app').style.display = 'none';
  const ls = document.getElementById('loginScreen');
  if (ls) ls.remove();
  buildLoginScreen();
}
window._logout = _logout;

// ══ ניהול עובדים ══
function openWorkerMgmt() {
  if (!_isOwner) { toast('❌ גישה לבעלים בלבד'); return; }
  let panel = document.getElementById('workerMgmtPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'workerMgmtPanel';
    panel.style.cssText = 'position:fixed;inset:0;background:rgba(12,14,20,0.92);z-index:8000;display:flex;align-items:flex-end;justify-content:center;font-family:Heebo,sans-serif;direction:rtl;';
    panel.innerHTML = `
      <div style="background:var(--surface,#141720);border-radius:18px 18px 0 0;width:100%;max-width:480px;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid var(--border,#252b3b);">
          <div style="font-size:15px;font-weight:800;color:var(--text,#eef0f6);">👥 ניהול עובדים</div>
          <button data-action="closeWorkerMgmt" style="background:var(--card,#191d28);border:1px solid var(--border,#252b3b);border-radius:7px;width:30px;height:30px;cursor:pointer;color:var(--muted,#7a8299);font-size:16px;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
        <div style="flex:1;overflow-y:auto;padding:14px 18px;" id="workerMgmtList"></div>
        <div style="padding:14px 18px;border-top:1px solid var(--border,#252b3b);background:var(--bg,#0c0e14);">
          <div style="font-size:12px;color:var(--muted,#7a8299);font-weight:700;margin-bottom:8px;">הוסף עובד חדש</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <input id="newWorkerName" type="text" placeholder="שם העובד" maxlength="40"
              style="background:var(--card,#191d28);border:1px solid var(--border,#252b3b);border-radius:8px;color:var(--text,#eef0f6);font-family:Heebo,sans-serif;font-size:14px;padding:9px 12px;width:100%;outline:none;box-sizing:border-box;"/>
            <div style="display:flex;gap:8px;">
              <input id="newWorkerPin" type="password" inputmode="numeric" maxlength="6" placeholder="קוד PIN (ספרות)"
                style="background:var(--card,#191d28);border:1px solid var(--border,#252b3b);border-radius:8px;color:var(--text,#eef0f6);font-family:Heebo,sans-serif;font-size:14px;padding:9px 12px;flex:1;outline:none;text-align:center;letter-spacing:4px;"/>
              <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted,#7a8299);cursor:pointer;white-space:nowrap;">
                <input type="checkbox" id="newWorkerAdmin" style="width:15px;height:15px;cursor:pointer;"/> מנהל
              </label>
            </div>
            <button data-action="addWorker" style="background:var(--accent,#f5a623);border:none;color:#111;border-radius:9px;padding:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">➕ הוסף עובד</button>
            <div id="newWorkerErr" style="color:#e85d3f;font-size:12px;text-align:center;display:none;"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.addEventListener('click', e => { if(e.target===panel) closeWorkerMgmt(); });
  }
  panel.style.display = 'flex';
  _renderWorkerMgmtList();
}

function closeWorkerMgmt() {
  const p = document.getElementById('workerMgmtPanel');
  if (p) p.style.display = 'none';
}

function _renderWorkerMgmtList() {
  const el = document.getElementById('workerMgmtList');
  if (!el) return;
  if (_workers.length === 0) {
    el.innerHTML = '<div style="color:var(--muted,#7a8299);font-size:13px;text-align:center;padding:20px 0;">אין עובדים עדיין</div>';
    return;
  }
  el.innerHTML = _workers.map(w => `
    <div style="border-bottom:1px solid var(--border,#252b3b);padding:10px 0;">
      <div style="display:flex;align-items:center;gap:8px;" id="wrow-${escHTML(w.id)}">
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:700;color:var(--text,#eef0f6);">${escHTML(w.name)}</div>
          <div style="font-size:11px;color:${w.isAdmin ? '#f5a623' : '#7a8299'};">${w.isAdmin ? '👑 מנהל' : '👁️ עובד בלבד'}</div>
        </div>
        <button data-action="openEditWorker" data-args="${escHTML(w.id)}"
          style="background:var(--card,#191d28);border:1px solid var(--border,#252b3b);color:var(--muted,#7a8299);border-radius:7px;padding:5px 8px;font-size:11px;cursor:pointer;">
          ✏️
        </button>
        <button data-action="toggleWorkerAdmin" data-args="${escHTML(w.id)}|${!w.isAdmin}"
          style="background:${w.isAdmin ? 'var(--red-dim,#2a1515)' : 'rgba(245,166,35,0.15)'};border:1px solid ${w.isAdmin ? 'var(--red,#e85d3f)' : '#f5a623'};color:${w.isAdmin ? 'var(--red,#e85d3f)' : '#f5a623'};border-radius:7px;padding:5px 9px;font-size:11px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;white-space:nowrap;">
          ${w.isAdmin ? '🔒 בטל' : '🔓 מנהל'}
        </button>
        <button data-action="deleteWorker" data-args="${escHTML(w.id)}|${escHTML(w.name)}"
          style="background:var(--red-dim,#2a1515);border:1px solid var(--red,#e85d3f);color:var(--red,#e85d3f);border-radius:7px;padding:5px 8px;font-size:11px;cursor:pointer;">
          🗑️
        </button>
      </div>
      <div id="wedit-${escHTML(w.id)}" style="display:none;flex-direction:column;gap:6px;margin-top:8px;">
        <input id="wedit-name-${escHTML(w.id)}" type="text" value="${escHTML(w.name)}" maxlength="40"
          style="background:var(--bg,#0c0e14);border:1px solid var(--accent,#f5a623);border-radius:7px;color:var(--text,#eef0f6);font-family:Heebo,sans-serif;font-size:13px;padding:7px 10px;outline:none;width:100%;box-sizing:border-box;"/>
        <input id="wedit-pin-${escHTML(w.id)}" type="password" inputmode="numeric" maxlength="6" placeholder="קוד PIN חדש (השאר ריק לאין שינוי)"
          style="background:var(--bg,#0c0e14);border:1px solid var(--border,#252b3b);border-radius:7px;color:var(--text,#eef0f6);font-family:Heebo,sans-serif;font-size:13px;padding:7px 10px;outline:none;width:100%;box-sizing:border-box;text-align:center;letter-spacing:4px;"/>
        <div style="display:flex;gap:6px;">
          <button data-action="saveEditWorker" data-args="${escHTML(w.id)}"
            style="flex:1;background:var(--accent,#f5a623);border:none;color:#111;border-radius:7px;padding:7px;font-size:12px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">שמור</button>
          <button data-action="closeEditWorker" data-args="${escHTML(w.id)}"
            style="background:var(--card,#191d28);border:1px solid var(--border,#252b3b);color:var(--muted,#7a8299);border-radius:7px;padding:7px 12px;font-size:12px;cursor:pointer;">ביטול</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function addWorker() {
  const nameEl = document.getElementById('newWorkerName');
  const pinEl = document.getElementById('newWorkerPin');
  const adminEl = document.getElementById('newWorkerAdmin');
  const errEl = document.getElementById('newWorkerErr');
  const name = nameEl ? nameEl.value.trim() : '';
  const pin = pinEl ? pinEl.value.trim() : '';
  if (!name) { if(errEl){errEl.textContent='הכנס שם עובד';errEl.style.display='block';} return; }
  if (!pin || !/^\d{4,6}$/.test(pin)) { if(errEl){errEl.textContent='קוד PIN חייב להיות 4-6 ספרות';errEl.style.display='block';} return; }
  if (_workers.some(w => w.name.trim().toLowerCase() === name.toLowerCase())) {
    if(errEl){errEl.textContent='עובד עם שם זה כבר קיים';errEl.style.display='block';} return;
  }
  if(errEl) errEl.style.display='none';
  const pinHash = await hashPass(pin);
  try {
    _workers.push({ id: _genWorkerId(), name, pinHash, isAdmin: !!(adminEl && adminEl.checked), createdAt: new Date().toISOString() });
    await _saveWorkersDoc();
    if(nameEl) nameEl.value='';
    if(pinEl) pinEl.value='';
    if(adminEl) adminEl.checked=false;
    toast('✅ עובד נוסף');
  } catch(e) { console.error('addWorker error:', e); if(errEl){errEl.textContent='שגיאה: '+e.message;errEl.style.display='block';} }
}

async function toggleWorkerAdmin(wid, newVal) {
  try {
    const w = _workers.find(x => x.id === wid);
    if (w) { w.isAdmin = newVal; await _saveWorkersDoc(); }
    toast(newVal ? '👑 הרשאת מנהל הופעלה' : '🔒 הרשאת מנהל בוטלה');
  } catch(e) { console.error('toggleWorkerAdmin error:', e); toast('❌ שגיאה: '+e.message); }
}

async function deleteWorker(wid, wname) {
  if (!confirm(`למחוק את העובד "${wname}"?`)) return;
  try {
    _workers = _workers.filter(x => x.id !== wid);
    await _saveWorkersDoc();
    toast('🗑️ עובד נמחק');
  } catch(e) { console.error('deleteWorker error:', e); toast('❌ שגיאה: '+e.message); }
}

function openEditWorker(wid) {
  document.getElementById('wedit-'+wid).style.display = 'flex';
}
function closeEditWorker(wid) {
  document.getElementById('wedit-'+wid).style.display = 'none';
}
async function saveEditWorker(wid) {
  const nameEl = document.getElementById('wedit-name-'+wid);
  const pinEl  = document.getElementById('wedit-pin-'+wid);
  const name = nameEl ? nameEl.value.trim() : '';
  const pin  = pinEl  ? pinEl.value.trim()  : '';
  if (!name) { toast('❌ שם לא יכול להיות ריק'); return; }
  if (pin && !/^\d{4,6}$/.test(pin)) { toast('❌ PIN חייב להיות 4-6 ספרות'); return; }
  try {
    const w = _workers.find(x => x.id === wid);
    if (!w) { toast('❌ עובד לא נמצא'); return; }
    w.name = name;
    if (pin) w.pinHash = await hashPass(pin);
    await _saveWorkersDoc();
    toast('✅ פרטי עובד עודכנו');
    closeEditWorker(wid);
  } catch(e) { console.error('saveEditWorker error:', e); toast('❌ שגיאה: '+e.message); }
}

// ══ ייבוא מלאי מ-Excel ══
function openInventoryImport() {
  if (!_isOwner && !_isAdmin) { toast('❌ גישה למנהל ובעלים בלבד'); return; }
  let panel = document.getElementById('inventoryImportPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'inventoryImportPanel';
    panel.style.cssText = 'position:fixed;inset:0;background:rgba(12,14,20,0.92);z-index:8000;display:flex;align-items:flex-end;justify-content:center;font-family:Heebo,sans-serif;direction:rtl;';
    panel.innerHTML = `
      <div style="background:var(--surface,#141720);border-radius:18px 18px 0 0;width:100%;max-width:480px;padding:20px 18px 28px;display:flex;flex-direction:column;gap:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:15px;font-weight:800;color:var(--text,#eef0f6);">📥 ייבוא מלאי מ-Excel</div>
          <button data-action="closeInventoryImport" style="background:var(--card,#191d28);border:1px solid var(--border,#252b3b);border-radius:7px;width:30px;height:30px;cursor:pointer;color:var(--muted,#7a8299);font-size:16px;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
        <div style="font-size:12px;color:var(--muted,#7a8299);line-height:1.6;">
          הקובץ חייב לכלול את העמודות:<br>
          <strong style="color:var(--text,#eef0f6);">קוד פריט · תיאור פריט · קיסריה 01</strong><br>
          תיאור פריט נשמר פעם אחת ולא מתעדכן. קיסריה 01 מתעדכן בכל ייבוא.
        </div>
        <label style="display:flex;flex-direction:column;gap:8px;">
          <input type="file" id="inventoryFileInput" accept=".xlsx,.xls"
            style="background:var(--card,#191d28);border:1px solid var(--border,#252b3b);border-radius:8px;color:var(--text,#eef0f6);font-size:13px;padding:10px;cursor:pointer;"/>
        </label>
        <button data-action="runInventoryImport" style="background:var(--accent,#f5a623);border:none;color:#111;border-radius:9px;padding:11px;font-size:14px;font-weight:700;cursor:pointer;font-family:Heebo,sans-serif;">📥 ייבא</button>
        <div id="inventoryImportResult" style="display:none;background:var(--card,#191d28);border:1px solid var(--border,#252b3b);border-radius:8px;padding:12px;font-size:13px;color:var(--text,#eef0f6);text-align:center;"></div>
      </div>
    `;
    document.body.appendChild(panel);
    panel.addEventListener('click', e => { if(e.target===panel) closeInventoryImport(); });
  }
  document.getElementById('inventoryImportResult').style.display = 'none';
  panel.style.display = 'flex';
}

function closeInventoryImport() {
  const p = document.getElementById('inventoryImportPanel');
  if (p) p.style.display = 'none';
}

async function runInventoryImport() {
  const fileInput = document.getElementById('inventoryFileInput');
  const resultEl = document.getElementById('inventoryImportResult');
  if (!fileInput || !fileInput.files[0]) { toast('❌ בחר קובץ Excel'); return; }
  const file = fileInput.files[0];
  resultEl.style.display = 'block';
  resultEl.textContent = '⏳ קורא קובץ...';

  function doImport() {
    const reader = new FileReader();
    reader.onerror = () => { resultEl.textContent = '❌ שגיאה בקריאת הקובץ — נסה שוב'; };
    reader.onload = async function(e) {
      const showProgress = (pct, msg) => {
        resultEl.innerHTML = `<div style="font-size:13px;margin-bottom:6px;">${msg}</div>
          <div style="background:var(--border,#ddd);border-radius:6px;height:10px;overflow:hidden;">
            <div style="background:var(--accent,#e85d3f);height:100%;width:${Math.min(pct,100)}%;transition:width .3s;border-radius:6px;"></div>
          </div>
          <div style="font-size:11px;color:var(--muted,#888);margin-top:4px;">${Math.round(pct)}%</div>`;
      };
      try {
        showProgress(2, '⏳ מפרסר Excel — עלול לקחת עד דקה לקבצים גדולים...');
        // Parse Excel in a Web Worker so the UI thread stays responsive
        const rows = await new Promise((resolve, reject) => {
          const workerSrc = `self.onmessage=function(e){try{importScripts(e.data.u);var wb=XLSX.read(new Uint8Array(e.data.b),{type:'array',dense:true});var ws=wb.Sheets[wb.SheetNames[0]];var rows=XLSX.utils.sheet_to_json(ws,{defval:''});self.postMessage({ok:true,rows:rows});}catch(err){self.postMessage({ok:false,error:err.message});}};`;
          const blobUrl = URL.createObjectURL(new Blob([workerSrc], {type:'text/javascript'}));
          const w = new Worker(blobUrl);
          w.onmessage = function(msg) {
            w.terminate(); URL.revokeObjectURL(blobUrl);
            if(msg.data.ok) resolve(msg.data.rows); else reject(new Error(msg.data.error));
          };
          w.onerror = function(err) { w.terminate(); URL.revokeObjectURL(blobUrl); reject(err); };
          w.postMessage({b: e.target.result, u:'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'}, [e.target.result]);
        });
        showProgress(5, `⏳ מתחבר לענן... (${rows.length} שורות)`);
        await new Promise(resolve => onAuthReady(resolve));
        let added = 0, updated = 0, skipped = 0;
        const invCol = collection(db, 'inventory');
        const existingSnap = await getDocs(invCol);
        const existingCodes = new Set(existingSnap.docs.map(d => d.id));
        showProgress(15, `⏳ עיבוד ${rows.length} שורות...`);
        let batch = writeBatch(db);
        let batchCount = 0, processed = 0;
        const CHUNK = 100;
        const flush = async () => {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
          await new Promise(r => setTimeout(r, 0)); // yield ל-UI thread
        };
        const now = serverTimestamp();
        for (const row of rows) {
          const code = String(row['קוד פריט'] || '').trim();
          const desc = String(row['תיאור פריט'] || '').trim();
          const qty  = Number(row['קיסריה 01']) || 0;
          processed++;
          if (!code) { skipped++; continue; }
          const ref = doc(db, 'inventory', code);
          if (!existingCodes.has(code)) {
            batch.set(ref, { itemCode: code, itemDescription: desc, caesareaQty: qty, createdAt: now, lastUpdated: now });
            added++;
          } else {
            batch.update(ref, { caesareaQty: qty, lastUpdated: now });
            updated++;
          }
          batchCount++;
          if (batchCount >= 499) {
            const pct = 15 + (processed / rows.length) * 80;
            showProgress(pct, `⏳ מעלה לענן... ${processed}/${rows.length}`);
            await flush();
          } else if (processed % CHUNK === 0) {
            const pct = 15 + (processed / rows.length) * 80;
            showProgress(pct, `⏳ מעבד שורה ${processed} מתוך ${rows.length}...`);
            await new Promise(r => setTimeout(r, 0)); // yield ל-UI thread
          }
        }
        if (batchCount > 0) {
          showProgress(95, '⏳ שומר נתונים...');
          await flush();
        }
        showProgress(100, '✅ הושלם!');
        await new Promise(r => setTimeout(r, 300));
        resultEl.innerHTML = `✅ <strong>ייבוא הושלם</strong><br>${added} פריטים חדשים נוספו · ${updated} עודכנו · ${skipped} דולגו`;
        if(fileInput) fileInput.value = '';
        window._invData = null; // אפס cache של מלאי כדי שייטען מחדש
      } catch(err) {
        console.error('inventory import error:', err);
        if(err.code==='permission-denied'||String(err.message).includes('Missing or insufficient')){
          resultEl.innerHTML = '❌ <strong>שגיאת הרשאות Firestore</strong><br>יש לפתוח Firebase Console ← Firestore ← Rules ולהוסיף:<br><code style="font-size:11px;direction:ltr;display:block;margin-top:6px;">match /inventory/{d}{allow read,write:if request.auth!=null;}</code>';
        } else {
          resultEl.textContent = '❌ שגיאה: ' + err.message;
        }
      }
    };
    reader.readAsArrayBuffer(file);
  }

  if (typeof XLSX !== 'undefined') { doImport(); return; }
  resultEl.textContent = '⏳ טוען ספריית Excel...';
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  script.integrity = 'sha384-rRoXxn2yHlrZYB587Ki9RO1tONhLdM6XfORg7Rw4uwH4/Fh/5nP7IUX91bkaKUgs';
  script.crossOrigin = 'anonymous';
  script.onload = doImport;
  script.onerror = () => { resultEl.textContent = '❌ לא ניתן לטעון ספריית Excel — בדוק חיבור אינטרנט'; };
  document.head.appendChild(script);
}

window.openWorkerMgmt = openWorkerMgmt;
window.closeWorkerMgmt = closeWorkerMgmt;
window.addWorker = addWorker;
window.toggleWorkerAdmin = toggleWorkerAdmin;
window.openEditWorker = openEditWorker;
window.closeEditWorker = closeEditWorker;
window.saveEditWorker = saveEditWorker;
window.deleteWorker = deleteWorker;
window.openInventoryImport = openInventoryImport;
window.closeInventoryImport = closeInventoryImport;

// ══ עדכון דוח מלאי אוטומטי (כפתור 📋) ══
async function autoUpdateInventory(input) {
  const file = input.files[0];
  input.value = '';
  if (!file) return;
  if (!_isOwner && !_isAdmin) { toast('❌ גישה למנהל ובעלים בלבד'); return; }

  toast('⏳ קורא דוח מלאי...');

  const arrayBuffer = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = () => reject(new Error('שגיאה בקריאת קובץ'));
    r.readAsArrayBuffer(file);
  });

  toast('⏳ מפרסר Excel...');
  let rows;
  try {
    rows = await new Promise((resolve, reject) => {
      const ws = `self.onmessage=function(e){try{importScripts(e.data.u);var wb=XLSX.read(new Uint8Array(e.data.b),{type:'array',dense:true});var ws=wb.Sheets[wb.SheetNames[0]];var rows=XLSX.utils.sheet_to_json(ws,{defval:''});self.postMessage({ok:true,rows:rows});}catch(err){self.postMessage({ok:false,error:err.message});}};`;
      const url = URL.createObjectURL(new Blob([ws], {type:'text/javascript'}));
      const w = new Worker(url);
      w.onmessage = m => { w.terminate(); URL.revokeObjectURL(url); m.data.ok ? resolve(m.data.rows) : reject(new Error(m.data.error)); };
      w.onerror = err => { w.terminate(); URL.revokeObjectURL(url); reject(err); };
      w.postMessage({b: arrayBuffer, u:'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'}, [arrayBuffer]);
    });
  } catch(e) { toast('❌ שגיאה בקריאת הקובץ'); return; }

  if (!rows || !rows.length) { toast('❌ הגיליון ריק'); return; }

  // זיהוי אוטומטי של עמודות
  const headers = Object.keys(rows[0]);
  const findCol = keys => { const lh = headers.map(h => h.toLowerCase().trim()); for(const k of keys){ const i = lh.findIndex(h => h.includes(k.toLowerCase())); if(i>=0) return headers[i]; } return null; };
  const codeCol = findCol(['קוד פריט','item code','part number','sku','קוד','מקט']);
  const descCol = findCol(['תיאור פריט','item description','תאור פריט','description','תיאור','דגם']);
  const caesareaCol = findCol(['קיסריה 01','caesarea 01','קיסריה','caesarea','יתרה']);

  if (!codeCol || !caesareaCol) {
    toast(`❌ לא נמצאו עמודות קוד פריט / קיסריה 01`);
    return;
  }

  toast(`⏳ מעדכן ${rows.length} שורות...`);
  try {
    await new Promise(resolve => onAuthReady(resolve));
    const invColRef = collection(db, 'inventory');
    // טען קודים קיימים
    const snap = await getDocs(invColRef);
    const existing = new Set(snap.docs.map(d => d.id));
    const now = serverTimestamp();
    let batch = writeBatch(db);
    let cnt = 0, added = 0, updated = 0;
    for (const row of rows) {
      const code = String(row[codeCol]||'').trim();
      if (!code) continue;
      const qty = Number(row[caesareaCol]) || 0;
      const ref = doc(db, 'inventory', code);
      if (!existing.has(code)) {
        const desc = descCol ? String(row[descCol]||'').trim() : '';
        batch.set(ref, {itemCode:code, itemDescription:desc, caesareaQty:qty, createdAt:now, lastUpdated:now});
        added++;
      } else {
        const desc = descCol ? String(row[descCol]||'').trim() : '';
        const upd = {caesareaQty:qty, lastUpdated:now};
        if(desc) upd.itemDescription = desc;
        batch.update(ref, upd);
        updated++;
      }
      cnt++;
      if (cnt >= 499) { await batch.commit(); batch = writeBatch(db); cnt = 0; }
    }
    if (cnt > 0) await batch.commit();
    // בנה _invData ישירות מהאקסל (לא מ-Firestore) — מבטיח תיאורים נכונים
    _invData = {};
    for (const row of rows) {
      const code = String(row[codeCol]||'').trim();
      if (!code) continue;
      const qty = Number(row[caesareaCol]) || 0;
      const desc = descCol ? String(row[descCol]||'').trim() : '';
      _invData[code] = {itemCode:code, itemDescription:desc, caesareaQty:qty};
    }
    _invBrandIdx = null;
    _buildInvBrandIdx();
    // קישור אוטומטי של itemCode לצמיגים ללא קוד
    const untagged=(window.items||[]).filter(t=>!t.itemCode);
    if(untagged.length&&_invBrandIdx){
      let b2=writeBatch(db);let c2=0,tagged=0;
      for(const tire of untagged){
        const bKey=(tire.brand||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,5);
        const cands=_invBrandIdx[bKey]||[];
        let match=null;
        if(cands.length===1){match=cands[0];}
        else if(cands.length>1){
          const mKey=(tire.model||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,5);
          match=mKey?cands.find(c=>c.descNorm.includes(mKey)):null;
          if(!match)match=cands[0];
        }
        if(!match)continue;
        tire.itemCode=match.code;
        b2.update(doc(db,'tires',String(tire.id)),{itemCode:match.code});
        c2++;tagged++;
        if(c2>=499){await b2.commit();b2=writeBatch(db);c2=0;}
      }
      if(c2>0)await b2.commit();
      if(tagged>0)toast(`🔗 ${tagged} צמיגים קושרו לקוד פריט`);
    }
    renderTable();
    toast(`✅ מלאי עודכן — ${updated} עודכנו · ${added} חדשים נוספו`);
  } catch(e) {
    if (e.code==='permission-denied'||String(e.message).includes('Missing or insufficient')) {
      toast('❌ שגיאת הרשאות — עדכן חוקי Firestore');
    } else {
      toast('❌ שגיאה: ' + e.message);
    }
  }
}
window.autoUpdateInventory = autoUpdateInventory;

let _clearInvPending = false;
async function clearAllInventory() {
  if (!_isOwner) { toast('❌ גישה לבעלים בלבד'); return; }
  if (!_clearInvPending) {
    _clearInvPending = true;
    toast('⚠️ לחץ שוב תוך 3 שניות לאישור מחיקת כל המלאי');
    setTimeout(() => { _clearInvPending = false; }, 3000);
    return;
  }
  _clearInvPending = false;
  toast('⏳ מוחק מלאי...');
  try {
    await new Promise(resolve => onAuthReady(resolve));
    const snap = await getDocs(invCol);
    if (!snap.docs.length) { toast('המלאי כבר ריק'); return; }
    let batch = writeBatch(db);
    let cnt = 0;
    for (const d of snap.docs) {
      batch.delete(d.ref);
      cnt++;
      if (cnt >= 499) { await batch.commit(); batch = writeBatch(db); cnt = 0; }
    }
    if (cnt > 0) await batch.commit();
    _invData = null; _invBrandIdx = null;
    renderTable();
    toast(`✅ המלאי נמחק — ${snap.docs.length} פריטים`);
  } catch(e) { toast('❌ שגיאה: ' + e.message); }
}
window.clearAllInventory = clearAllInventory;
window.runInventoryImport = runInventoryImport;


// ── תור אופליין ──
async function getOfflineQueue() { try { return JSON.parse(await _enc.get('tirewms_offline') || '[]'); } catch(e) { return []; } }
async function saveOfflineQueue(q) { await _enc.set('tirewms_offline', JSON.stringify(q)); }

async function processOfflineQueue() {
  const q = await getOfflineQueue();
  if (!q.length) return;
  const done = [];
  for (const op of q) {
    try {
      if (op.type === 'set') await setDoc(doc(db, 'tires', String(op.id)), op.data);
      if (op.type === 'del') await deleteDoc(doc(db, 'tires', String(op.id)));
      done.push(op);
    } catch(e) { break; }
  }
  if (done.length) {
    saveOfflineQueue(q.filter(op => !done.some(d => d.type === op.type && d.id === op.id)));
    window._toast && window._toast(`✅ סונכרנו ${done.length} פריטים מאופליין`);
  }
}

navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', e => {
  if (e.data && e.data.type === 'SYNC_NOW') processOfflineQueue();
});

window.addEventListener('online', () => {
  window._toast && window._toast('🌐 חזר אינטרנט — מסנכרן...');
  processOfflineQueue();
  setStatus('🟢 מחובר');
});
window.addEventListener('offline', () => { setStatus('📵 אופליין'); });

window._saveItem = async function(it) {
  if (!navigator.onLine) {
    const q = await getOfflineQueue();
    q.push({type: 'set', id: it.id, data: it});
    await saveOfflineQueue(q);
    window._toast && window._toast('📵 נשמר מקומית — יסונכרן כשיחזור אינטרנט');
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(sw => sw.sync.register('sync-tires')).catch(() => {});
    }
    return;
  }
  await new Promise(resolve => onAuthReady(resolve));
  try { await setDoc(doc(db, 'tires', String(it.id)), it); }
  catch(e) {
    const q = await getOfflineQueue();
    q.push({type: 'set', id: it.id, data: it});
    await saveOfflineQueue(q);
    window._toast && window._toast('⚠️ שמירה נכשלה — נשמר מקומית ויסונכרן כשיחזור חיבור');
  }
};

window._deleteItem = async function(id) {
  if (!navigator.onLine) {
    const q = await getOfflineQueue();
    q.push({type: 'del', id});
    await saveOfflineQueue(q);
    window._toast && window._toast('📵 מחיקה תסונכרן כשיחזור אינטרנט');
    return;
  }
  await new Promise(resolve => onAuthReady(resolve));
  try { await deleteDoc(doc(db, 'tires', String(id))); }
  catch(e) {
    const q = await getOfflineQueue();
    q.push({type: 'del', id});
    await saveOfflineQueue(q);
    window._toast && window._toast('⚠️ מחיקה נכשלה — תסונכרן כשיחזור חיבור');
  }
};

// ══ AUDIT LOG — Firestore ══
const auditCol = collection(db, 'audit_log');
let _auditLastDoc = null;
let _auditLoading = false;
const AUDIT_PAGE = 50;

window._logAudit = async function(payload) {
  // best-effort: skip silently if offline
  if (!navigator.onLine) return;
  try {
    await new Promise(resolve => onAuthReady(resolve));
    await addDoc(auditCol, {
      ...payload,
      ts: serverTimestamp(),
      tsLocal: new Date().toISOString(),
      workerName: _currentWorkerName || 'לא מזוהה',
      workerId: _currentWorkerId || null,
      isOwner: _isOwner,
    });
  } catch(e) {
    console.warn('audit log failed:', e);
  }
};

window.openAuditPanel = async function() {
  if (!_isOwner) { window._toast && window._toast('❌ גישה לבעלים בלבד'); return; }
  const panel = document.getElementById('auditPanel');
  const list  = document.getElementById('auditList');
  panel.classList.add('open');
  panel.onclick = e => { if (e.target === panel) window.closeAuditPanel(); };
  list.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px;">⏳ טוען...</div>';
  _auditLastDoc = null;
  await window._loadAuditPage(true);
};

window.closeAuditPanel = function() {
  document.getElementById('auditPanel').classList.remove('open');
};

window.loadMoreAudit = async function() {
  await window._loadAuditPage(false);
};

window._loadAuditPage = async function(reset) {
  if (_auditLoading) return;
  _auditLoading = true;
  const list = document.getElementById('auditList');
  const moreBtn = document.getElementById('auditLoadMore');
  try {
    await new Promise(resolve => onAuthReady(resolve));
    let q;
    if (reset || !_auditLastDoc) {
      q = query(auditCol, orderBy('ts', 'desc'), limit(AUDIT_PAGE));
    } else {
      q = query(auditCol, orderBy('ts', 'desc'), startAfter(_auditLastDoc), limit(AUDIT_PAGE));
    }
    const snap = await getDocs(q);
    if (snap.docs.length) _auditLastDoc = snap.docs[snap.docs.length - 1];
    if (reset) list.innerHTML = '';
    if (snap.empty && reset) {
      list.innerHTML = '<div style="color:var(--muted);text-align:center;padding:20px;">אין רשומות עדיין</div>';
      if (moreBtn) moreBtn.style.display = 'none';
      return;
    }
    snap.docs.forEach(d => {
      list.insertAdjacentHTML('beforeend', _renderAuditEntry(d.data()));
    });
    if (moreBtn) moreBtn.style.display = snap.docs.length >= AUDIT_PAGE ? 'block' : 'none';
  } catch(err) {
    list.innerHTML = '<div style="color:var(--red,#e85d3f);text-align:center;padding:20px;">❌ שגיאה בטעינה</div>';
    console.error('audit load error:', err);
  } finally {
    _auditLoading = false;
  }
};

function _renderAuditEntry(e) {
  const LABELS = {add:'הוספה', edit:'עריכה', delete:'מחיקה', move:'העברה', status:'סטטוס'};
  const ICONS  = {add:'✅', edit:'✏️', delete:'🗑️', move:'📍', status:'⏳'};
  const dt = e.ts?.toDate ? e.ts.toDate().toLocaleString('he-IL') : (e.tsLocal||'').slice(0,16).replace('T',' ') || '—';
  let detail = '';
  if (e.action === 'move' && e.before && e.after)
    detail = `<span style="color:var(--muted);">עמ׳ ${escHTML(String(e.before.col||''))} קומה ${escHTML(String(e.before.floor||''))} ← עמ׳ ${escHTML(String(e.after.col||''))} קומה ${escHTML(String(e.after.floor||''))}</span>`;
  else if (e.action === 'edit' && e.before && e.after) {
    const diffs = Object.keys(e.after).filter(k => e.before[k] !== e.after[k]);
    if (diffs.length) detail = `<span style="color:var(--muted);">שונו: ${diffs.map(escHTML).join(', ')}</span>`;
  }
  const who = e.isOwner ? '👑 בעלים' : `👤 ${escHTML(e.workerName||'?')}`;
  return `<div class="audit-entry audit-action-${escHTML(e.action||'')}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
      <span style="font-weight:700;">${ICONS[e.action]||''} ${LABELS[e.action]||escHTML(e.action)} — ${escHTML(e.itemLabel||'')} (#${e.itemId})</span>
      <span style="color:var(--muted);font-size:10px;flex-shrink:0;">${who}</span>
    </div>
    ${detail?'<div>'+detail+'</div>':''}
    <div style="color:var(--muted);font-size:10px;">${dt}</div>
  </div>`;
}

window._importItems = async function(data) {
  await new Promise(resolve => onAuthReady(resolve));
  const BATCH = 400;
  for(let i=0;i<data.length;i+=BATCH){
    let b = writeBatch(db);
    for(const it of data.slice(i, i+BATCH)) b.set(doc(db,'tires',String(it.id)), it);
    await b.commit();
  }
};

function exportJSON(){
  if(!window.isOwnerMode){toast('❌ גישה לבעלים בלבד');return;}
  const data = JSON.stringify({v:2,ts:Date.now(),items:window.items||[]},null,2);
  const a = Object.assign(document.createElement('a'),{
    href: URL.createObjectURL(new Blob([data],{type:'application/json'})),
    download: `tirewms_backup_${new Date().toISOString().slice(0,10)}.json`
  });
  a.click(); URL.revokeObjectURL(a.href);
  toast(`✅ גובה ${(window.items||[]).length} פריטים`);
}
window.exportJSON = exportJSON;

function importJSON(input){
  if(!window.isOwnerMode){toast('❌ גישה לבעלים בלבד');return;}
  const file = input.files[0]; input.value='';
  if(!file) return;
  const r = new FileReader();
  r.onload = async e => {
    try{
      const d = JSON.parse(e.target.result);
      const arr = Array.isArray(d) ? d : (d.items||[]);
      if(!arr.length){toast('❌ קובץ ריק');return;}
      if(!confirm(`ייבוא ${arr.length} פריטים? (הוספה בלבד)`)) return;
      toast('⏳ מייבא...');
      await window._importItems(arr);
      toast(`✅ יובאו ${arr.length} פריטים`);
    }catch(err){toast('❌ '+err.message);}
  };
  r.readAsText(file,'UTF-8');
}
window.importJSON = importJSON;

async function clearAllData(){
  if(!window.isOwnerMode){toast('❌ גישה לבעלים בלבד');return;}
  if(!confirm('⚠️ מחיקת כל הצמיגים לצמיתות?\nפעולה בלתי הפיכה!')) return;
  if(!confirm('⚠️ אישור שני — בטוח?')) return;
  toast('⏳ מוחק...');
  try{
    await new Promise(r=>onAuthReady(r));
    const snap = await getDocs(itemsCol);
    let b=writeBatch(db),cnt=0;
    for(const d of snap.docs){b.delete(d.ref);cnt++;if(cnt>=499){await b.commit();b=writeBatch(db);cnt=0;}}
    if(cnt>0) await b.commit();
    toast(`🗑️ ${snap.docs.length} פריטים נמחקו`);
  }catch(e){toast('❌ '+e.message);}
}
window.clearAllData = clearAllData;

async function restoreFromAutoBackup(){
  if(!window.isOwnerMode){toast('❌ גישה לבעלים בלבד');return;}
  try{
    const raw = window._enc ? await window._enc.get('tirewms_autobk') : localStorage.getItem('tirewms_autobk');
    const bk = JSON.parse(raw||'null');
    if(!bk||!bk.items?.length){toast('❌ אין גיבוי אוטומטי');return;}
    const d = new Date(bk.ts).toLocaleString('he-IL');
    if(!confirm(`שחזר ${bk.items.length} פריטים מגיבוי ${d}?`)) return;
    toast('⏳ משחזר...');
    window._importItems(bk.items).then(()=>toast(`✅ שוחזרו ${bk.items.length} פריטים`)).catch(e=>toast('❌ '+e.message));
  }catch(e){toast('❌ '+e.message);}
}
window.restoreFromAutoBackup = restoreFromAutoBackup;

// ── הצג מסך כניסה ──
try { document.querySelector('.app').style.display = 'none'; } catch(e) {}
buildLoginScreen();

// ── Firestore sync — מתחיל רק אחרי שהאימות מוכן ──
setTimeout(processOfflineQueue, 3000);
setStatus('🔄 מתחבר...');
onAuthReady(() => {
  onSnapshot(itemsCol, snapshot => {
    const newItems = snapshot.docs.filter(d => d.id !== 'workers-config').map(d => d.data());
    const newNextId = newItems.length > 0 ? Math.max(...newItems.map(i => i.id)) + 1 : 1;
    if (window._updateItems) {
      window._updateItems(newItems, newNextId);
    } else {
      window.items = newItems;
      window.nextId = newNextId;
    }
    const ss = document.getElementById('syncStatus');
    if (ss && ss.textContent.includes('מתחבר')) {
      setStatus(_isAdmin ? '🟢 מנהל' : '🟢 מחובר');
    }
  }, err => {
    setStatus('🔴 אין חיבור');
    window._toast && window._toast('🔴 אין חיבור לענן — הנתונים עלולים להיות לא מעודכנים');
    console.error('Firebase error:', err);
  });
});

// ── שינוי סיסמת בעלים — שומר ב-Firestore בלבד ──
window._changeOwnerPass = async function(newHash) {
  try {
    await new Promise(resolve => onAuthReady(resolve));
    const snap = await getDoc(workersDocRef);
    const existing = snap.exists() ? snap.data() : {};
    await setDoc(workersDocRef, { ...existing, ownerPassHash: newHash });
    window._ownerPassHash = newHash;
    return true;
  } catch(e) { console.error('changeOwnerPass failed:', e); return false; }
};

// ── Session role ב-Firestore (לאכיפת Security Rules) ──
window._saveSessionRole = async function(role) {
  try {
    await new Promise(resolve => onAuthReady(resolve));
    if (!auth.currentUser) return;
    await setDoc(doc(db, 'sessions', auth.currentUser.uid), { role, ts: Date.now() });
  } catch(e) { console.warn('saveSessionRole failed:', e); }
};

window._clearSessionRole = async function() {
  try {
    if (!auth.currentUser) return;
    await deleteDoc(doc(db, 'sessions', auth.currentUser.uid));
  } catch(e) { console.warn('clearSessionRole failed:', e); }
};

window.buildLoginScreen = buildLoginScreen;
