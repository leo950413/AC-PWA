/* ══════════════════════════════════════════════════════════════════
   AC Control PWA – app.js
   Session-based auth, API calls, scheduling, and all UI state.
══════════════════════════════════════════════════════════════════ */
'use strict';

/* ── Configuration ── */
const API_BASE      = 'https://iot-ac.c024.click';
const SESSION_KEY   = 'ac_session';
const USER_KEY      = 'ac_user';
const TOAST_TIMEOUT = 3800;

/* ══════════════════════════════════════════════════════════════════
   INTERNATIONALISATION
══════════════════════════════════════════════════════════════════ */
const LANG_KEY = 'ac_lang';

const i18n = {
  en: {
    appSubtitle:     'IoT Air Conditioner Remote',
    labelUser:       'Username',
    labelPass:       'Password',
    btnSignIn:       'Sign In',
    btnLogout:       'Logout',
    controlSubtitle: 'Select an action below',
    btnPowerOn:      'Power On',
    btnPowerOff:     'Power Off',
    btnRefresh:      'Refresh Status',
    statLabelPower:  'Power',
    statLabelMode:   'Mode',
    statLabelTemp:   'Temp',
    statLabelFan:    'Fan',
    statValOn:       'ON',
    statValOff:      'OFF',
    statusReady:     'Ready',
    statusRunning:   'Running',
    statusStandby:   'Standby',
    statusError:     'Error',
    errBothFields:   'Please enter both username and password.',
    errWrongCreds:   'Invalid credentials.',
    errNoNetwork:    'Cannot reach the device. Check your network.',
    errLoginFail:    'Login failed. Please try again.',
    toastSignedIn:   u => `Signed in as ${u}.`,
    toastSessionExp: 'Session expired – please sign in again.',
    toastACOn:       'Air conditioner turned ON.',
    toastACOff:      'Air conditioner turned OFF.',
    toastCmdNetwork: 'Cannot reach the device. Are you on the correct network?',
    toastSignedOut:  'Signed out.',
    toastHwError:    'Unable to reach AC hardware.',
    schedTitle:      'Schedule',
    schedOptOn:      'Turn On',
    schedOptOff:     'Turn Off',
    schedDelayUnit:  'min',
    schedBtn:        'Schedule',
    schedEmpty:      'No active schedules',
    schedCancelled:  'Schedule cancelled.',
    schedCreateFail: 'Failed to create schedule.',
    schedCancelFail: 'Failed to cancel schedule.',
    schedCancel:     'Cancel',
    schedIn:         m => m >= 60 ? `in ${Math.floor(m / 60)}h ${m % 60}m` : `in ${m} min`,
    schedPast:       'executing…',
  },
  zh: {
    appSubtitle:     '物聯網冷氣遙控',
    labelUser:       '帳號',
    labelPass:       '密碼',
    btnSignIn:       '登入',
    btnLogout:       '登出',
    controlSubtitle: '請選擇操作',
    btnPowerOn:      '開機',
    btnPowerOff:     '關機',
    btnRefresh:      '更新狀態',
    statLabelPower:  '電源',
    statLabelMode:   '模式',
    statLabelTemp:   '溫度',
    statLabelFan:    '風扇',
    statValOn:       '開',
    statValOff:      '關',
    statusReady:     '就緒',
    statusRunning:   '運作中',
    statusStandby:   '待機',
    statusError:     '錯誤',
    errBothFields:   '請輸入帳號與密碼。',
    errWrongCreds:   '帳號或密碼錯誤。',
    errNoNetwork:    '無法連線至裝置，請確認網路。',
    errLoginFail:    '登入失敗，請再試一次。',
    toastSignedIn:   u => `已以 ${u} 身份登入。`,
    toastSessionExp: '工作階段已過期，請重新登入。',
    toastACOn:       '冷氣已開啟。',
    toastACOff:      '冷氣已關閉。',
    toastCmdNetwork: '無法連線至裝置，請確認網路。',
    toastSignedOut:  '已登出。',
    toastHwError:    '無法連線至冷氣硬體。',
    schedTitle:      '排程',
    schedOptOn:      '開機',
    schedOptOff:     '關機',
    schedDelayUnit:  '分鐘',
    schedBtn:        '排程',
    schedEmpty:      '目前無排程',
    schedCancelled:  '排程已取消。',
    schedCreateFail: '排程建立失敗。',
    schedCancelFail: '排程取消失敗。',
    schedCancel:     '取消',
    schedIn:         m => m >= 60 ? `${Math.floor(m / 60)} 小時 ${m % 60} 分鐘後` : `${m} 分鐘後`,
    schedPast:       '執行中…',
  },
};

function currentLang() {
  return localStorage.getItem(LANG_KEY) === 'zh' ? 'zh' : 'en';
}

function t(key, ...args) {
  const val = i18n[currentLang()][key];
  return typeof val === 'function' ? val(...args) : (val ?? key);
}

/* ══════════════════════════════════════════════════════════════════
   DEBUG LOGGER
══════════════════════════════════════════════════════════════════ */
const DEBUG_KEY = 'ac_debug';

const dbg = (() => {
  const STYLES = {
    auth:    'color:#38bdf8;font-weight:700',
    api:     'color:#a78bfa;font-weight:700',
    session: 'color:#f59e0b;font-weight:700',
    sw:      'color:#34d399;font-weight:700',
    error:   'color:#f87171;font-weight:700',
    info:    'color:#94a3b8;font-weight:700',
  };
  const isEnabled = () => localStorage.getItem(DEBUG_KEY) === '1';
  const log = (cat, ...args) => {
    if (!isEnabled()) return;
    const ts = new Date().toISOString().slice(11, 23);
    console.log(`%c[AC:${cat}]`, STYLES[cat] ?? STYLES.info, `(${ts})`, ...args);
  };
  return {
    auth:    (...a) => log('auth',    ...a),
    api:     (...a) => log('api',     ...a),
    session: (...a) => log('session', ...a),
    sw:      (...a) => log('sw',      ...a),
    error:   (...a) => log('error',   ...a),
    info:    (...a) => log('info',    ...a),
  };
})();

/* ── DOM references ── */
const el = id => document.getElementById(id);

const screenLogin    = el('screen-login');
const screenControl  = el('screen-control');
const formLogin      = el('form-login');
const inpUser        = el('inp-user');
const inpPass        = el('inp-pass');
const loginError     = el('login-error');
const headerUser     = el('header-user');
const btnLogout      = el('btn-logout');
const btnOn          = el('btn-on');
const btnOff         = el('btn-off');
const statusDot      = el('status-dot');
const statusLabel    = el('status-label');
const toastContainer = el('toast-container');
const loadingOverlay = el('loading-overlay');
const airflow        = el('airflow');
const svgPowerRing   = el('svg-power-ring');

/* ══════════════════════════════════════════════════════════════════
   AUTH (Session-based)
   POST /api/login → { status:1, sessionId:"uuid" }
   Subsequent requests: x-session-id header
══════════════════════════════════════════════════════════════════ */

function saveSession(sessionId, username) {
  localStorage.setItem(SESSION_KEY, sessionId);
  localStorage.setItem(USER_KEY, username);
  dbg.auth('session saved → user:', username);
}

function loadSession() {
  return localStorage.getItem(SESSION_KEY);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(USER_KEY);
  dbg.auth('session cleared');
}

function storedUsername() {
  return localStorage.getItem(USER_KEY) || '';
}

function sessionHeaders() {
  const sid = loadSession();
  return sid ? { 'x-session-id': sid } : {};
}

/* ══════════════════════════════════════════════════════════════════
   SCREEN TRANSITIONS
══════════════════════════════════════════════════════════════════ */

function showLoginScreen() {
  screenControl.classList.add('hidden');
  screenLogin.classList.remove('hidden');
  inpUser.value = '';
  inpPass.value = '';
  loginError.classList.add('hidden');
  loginError.textContent = '';
  inpUser.focus();
  stopScheduleRefresh();
}

function showControlScreen() {
  screenLogin.classList.add('hidden');
  screenControl.classList.remove('hidden');
  if (headerUser) headerUser.textContent = storedUsername();
  setACState('idle');
}

/* ══════════════════════════════════════════════════════════════════
   AC STATE / UI
══════════════════════════════════════════════════════════════════ */

let _acState = 'idle';

function setACState(state) {
  _acState = state;
  const ring = svgPowerRing;

  btnOn.classList.remove('active');
  btnOff.classList.remove('active');

  switch (state) {
    case 'on':
      ring && ring.setAttribute('stroke', '#22c55e');
      airflow && airflow.classList.remove('hidden');
      btnOn.classList.add('active');
      setStatus('on', t('statusRunning'));
      setThemeColor('#052e16');
      break;
    case 'off':
      ring && ring.setAttribute('stroke', '#ef4444');
      airflow && airflow.classList.add('hidden');
      btnOff.classList.add('active');
      setStatus('off', t('statusStandby'));
      setThemeColor('#0f172a');
      break;
    case 'error':
      ring && ring.setAttribute('stroke', '#ef4444');
      airflow && airflow.classList.add('hidden');
      setStatus('error', t('statusError'));
      setThemeColor('#0f172a');
      break;
    default:
      ring && ring.setAttribute('stroke', '#334155');
      airflow && airflow.classList.add('hidden');
      setStatus('idle', t('statusReady'));
      setThemeColor('#0f172a');
  }
}

function setStatus(type, label) {
  statusDot.className    = `status-dot status-${type}`;
  statusLabel.textContent = label;
}

function setThemeColor(color) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', color);
}

/* ══════════════════════════════════════════════════════════════════
   LANGUAGE
══════════════════════════════════════════════════════════════════ */

function applyLang(lang) {
  localStorage.setItem(LANG_KEY, lang);
  document.documentElement.lang = lang === 'zh' ? 'zh-TW' : 'en';

  const setText = (id, txt) => { const n = el(id); if (n) n.textContent = txt; };
  const T = i18n[lang];

  // Login
  setText('brand-subtitle',    T.appSubtitle);
  setText('label-user',        T.labelUser);
  setText('label-pass',        T.labelPass);
  const btnLabel = document.querySelector('#btn-login-submit .btn-label');
  if (btnLabel) btnLabel.textContent = T.btnSignIn;

  // Control
  setText('logout-label',      T.btnLogout);
  setText('control-subtitle',  T.controlSubtitle);
  setText('btn-on-label',      T.btnPowerOn);
  setText('btn-off-label',     T.btnPowerOff);
  setText('btn-refresh-label', T.btnRefresh);
  setText('stat-label-power',  T.statLabelPower);
  setText('stat-label-mode',   T.statLabelMode);
  setText('stat-label-temp',   T.statLabelTemp);
  setText('stat-label-fan',    T.statLabelFan);

  // Schedule
  setText('schedule-title',    T.schedTitle);
  setText('sched-opt-on',      T.schedOptOn);
  setText('sched-opt-off',     T.schedOptOff);
  setText('sched-delay-unit',  T.schedDelayUnit);
  setText('btn-schedule-label', T.schedBtn);

  // Re-translate dynamic values
  const statPower = el('stat-power');
  if (statPower && statPower.dataset.state) {
    statPower.textContent = statPower.dataset.state === 'on' ? T.statValOn : T.statValOff;
  }

  setACState(_acState);
  renderSchedules(_lastSchedules);

  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });

  dbg.info('language applied →', lang);
}

/* ══════════════════════════════════════════════════════════════════
   LOADING STATE
══════════════════════════════════════════════════════════════════ */

function setLoading(active) {
  loadingOverlay.classList.toggle('hidden', !active);
  btnOn.disabled  = active;
  btnOff.disabled = active;
}

/* ══════════════════════════════════════════════════════════════════
   TOAST NOTIFICATIONS
══════════════════════════════════════════════════════════════════ */

const TOAST_ICONS = { success: '✓', error: '✕', info: 'ℹ' };

function showToast(message, type = 'info', duration = TOAST_TIMEOUT) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${TOAST_ICONS[type] ?? TOAST_ICONS.info}</span>
    <span class="toast-msg">${message}</span>
  `;
  toastContainer.prepend(toast);

  const dismiss = () => {
    if (!toast.isConnected) return;
    toast.classList.add('toast-dismiss');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  const timer = setTimeout(dismiss, duration);
  toast.addEventListener('click', () => { clearTimeout(timer); dismiss(); });
}

/* ══════════════════════════════════════════════════════════════════
   AC STATUS
   GET /api/status (no auth)
   Response: { power:"on"|"off", temperature:24, mode:"cool", fan:"auto" }
══════════════════════════════════════════════════════════════════ */

const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : '—';

function renderACStatus(data) {
  if (!data || typeof data !== 'object') return;

  const statPower = el('stat-power');
  const statMode  = el('stat-mode');
  const statTemp  = el('stat-temp');
  const statFan   = el('stat-fan');
  const grid      = el('ac-status-grid');

  if (statPower && data.power != null) {
    const on = data.power === 'on';
    statPower.textContent   = on ? t('statValOn') : t('statValOff');
    statPower.dataset.state = on ? 'on' : 'off';
  }
  if (statMode && data.mode != null)        statMode.textContent = cap(data.mode);
  if (statTemp && data.temperature != null) statTemp.textContent = `${Number(data.temperature).toFixed(1)}°C`;
  if (statFan  && data.fan != null)         statFan.textContent  = cap(data.fan);

  if (grid) grid.classList.remove('hidden');

  if (data.power !== undefined) setACState(data.power === 'on' ? 'on' : 'off');

  dbg.session('AC status rendered →', data);
}

async function fetchStatus() {
  dbg.api('fetching status → GET /api/status');
  try {
    const t0 = performance.now();
    const response = await fetch(`${API_BASE}/api/status`);
    const ms = (performance.now() - t0).toFixed(0);
    dbg.api(`status response → HTTP ${response.status} (${ms} ms)`);

    if (response.status === 502) {
      dbg.error('hardware unreachable (502)');
      setACState('error');
      return;
    }
    if (!response.ok) return;

    const data = await response.json();
    dbg.session('status data →', data);
    renderACStatus(data);
  } catch (err) {
    dbg.error('fetchStatus threw →', err.name, err.message);
  }
}

/* ══════════════════════════════════════════════════════════════════
   AC COMMANDS
   POST /api/on   |  POST /api/off
   Auth: x-session-id header
══════════════════════════════════════════════════════════════════ */

async function acCommand(command) {
  const cmdURL = `${API_BASE}/api/${command}`;
  dbg.api('command →', 'POST', cmdURL);
  setLoading(true);

  try {
    const t0 = performance.now();
    const response = await fetch(cmdURL, {
      method: 'POST',
      headers: sessionHeaders(),
    });
    const ms = (performance.now() - t0).toFixed(0);
    dbg.api(`response → HTTP ${response.status} (${ms} ms)`);

    if (response.status === 401) {
      clearSession();
      showLoginScreen();
      showToast(t('toastSessionExp'), 'error');
      return;
    }

    if (response.status === 502) {
      showToast(t('toastHwError'), 'error');
      setACState('error');
      return;
    }

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    dbg.api('command result →', data);

    if (data.status === 1) {
      showToast(t(command === 'on' ? 'toastACOn' : 'toastACOff'), 'success');
      fetchStatus();
    } else {
      showToast(data.message || 'Command failed', 'error');
    }
  } catch (err) {
    dbg.error('command threw →', err.name, err.message);
    showToast(err instanceof TypeError ? t('toastCmdNetwork') : err.message, 'error');
    setACState('error');
  } finally {
    setLoading(false);
  }
}

/* ══════════════════════════════════════════════════════════════════
   SCHEDULING
   POST   /api/schedule        – create
   GET    /api/schedule        – list
   DELETE /api/schedule/:id    – cancel
   Auth: x-session-id header
══════════════════════════════════════════════════════════════════ */

let _lastSchedules   = [];
let _schedRefreshTmr = null;

async function createSchedule(action, delayMinutes) {
  dbg.api('createSchedule →', action, delayMinutes, 'min');
  try {
    const response = await fetch(`${API_BASE}/api/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
      body: JSON.stringify({ action, delayMinutes }),
    });

    if (response.status === 401) {
      clearSession(); showLoginScreen();
      showToast(t('toastSessionExp'), 'error');
      return false;
    }

    const data = await response.json();
    if (data.status === 1) {
      showToast(data.message, 'success');
      fetchSchedules();
      return true;
    }
    showToast(data.message || t('schedCreateFail'), 'error');
    return false;
  } catch (err) {
    dbg.error('createSchedule threw →', err.name, err.message);
    showToast(t('schedCreateFail'), 'error');
    return false;
  }
}

async function fetchSchedules() {
  dbg.api('fetching schedules → GET /api/schedule');
  try {
    const response = await fetch(`${API_BASE}/api/schedule`, {
      headers: sessionHeaders(),
    });

    if (response.status === 401) return;
    if (!response.ok) return;

    const data = await response.json();
    if (data.status === 1) {
      renderSchedules(data.schedules || []);
    }
  } catch (err) {
    dbg.error('fetchSchedules threw →', err.name, err.message);
  }
}

async function cancelSchedule(id) {
  dbg.api('cancelSchedule →', id);
  try {
    const response = await fetch(`${API_BASE}/api/schedule/${id}`, {
      method: 'DELETE',
      headers: sessionHeaders(),
    });

    if (response.status === 401) {
      clearSession(); showLoginScreen();
      showToast(t('toastSessionExp'), 'error');
      return;
    }

    const data = await response.json();
    if (data.status === 1) {
      showToast(t('schedCancelled'), 'success');
      fetchSchedules();
    } else {
      showToast(data.message || t('schedCancelFail'), 'error');
    }
  } catch (err) {
    dbg.error('cancelSchedule threw →', err.name, err.message);
    showToast(t('schedCancelFail'), 'error');
  }
}

function renderSchedules(schedules) {
  _lastSchedules = schedules;
  const list = el('schedule-list');
  if (!list) return;

  if (!schedules.length) {
    list.innerHTML = `<li class="sched-empty">${t('schedEmpty')}</li>`;
    return;
  }

  list.innerHTML = schedules.map(s => {
    const isOn     = s.action === 'on';
    const execAt   = new Date(s.executeAt);
    const minsLeft = Math.max(0, Math.round((execAt - Date.now()) / 60000));
    const countdown = minsLeft > 0 ? t('schedIn', minsLeft) : t('schedPast');
    const label     = isOn ? t('schedOptOn') : t('schedOptOff');
    const cls       = isOn ? 'sched-action-on' : 'sched-action-off';

    return `<li class="sched-item" data-id="${s.id}">
      <div class="sched-info">
        <span class="sched-action ${cls}">${label}</span>
        <span class="sched-countdown">${countdown}</span>
      </div>
      <button class="sched-cancel">${t('schedCancel')}</button>
    </li>`;
  }).join('');
}

/** Delegate clicks on cancel buttons inside the schedule list. */
el('schedule-list').addEventListener('click', e => {
  const btn = e.target.closest('.sched-cancel');
  if (!btn) return;
  const item = btn.closest('.sched-item');
  if (item) cancelSchedule(item.dataset.id);
});

function startScheduleRefresh() {
  stopScheduleRefresh();
  // Refresh every 30 s to update countdowns and detect completed schedules
  _schedRefreshTmr = setInterval(() => {
    fetchSchedules();
    fetchStatus();
  }, 30000);
}

function stopScheduleRefresh() {
  if (_schedRefreshTmr) {
    clearInterval(_schedRefreshTmr);
    _schedRefreshTmr = null;
  }
}

/* ══════════════════════════════════════════════════════════════════
   LOGIN FORM
   POST /api/login  { username, password }
   → { status:1, message:"Login successful", sessionId:"uuid" }
══════════════════════════════════════════════════════════════════ */

const btnLoginSubmit = el('btn-login-submit');

function setLoginLoading(active) {
  btnLoginSubmit.disabled = active;
  btnLoginSubmit.querySelector('.btn-label').classList.toggle('hidden', active);
  btnLoginSubmit.querySelector('.btn-spinner').classList.toggle('hidden', !active);
}

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}

formLogin.addEventListener('submit', async e => {
  e.preventDefault();
  loginError.classList.add('hidden');

  const user = inpUser.value.trim();
  const pass = inpPass.value;

  if (!user || !pass) {
    showLoginError(t('errBothFields'));
    return;
  }

  setLoginLoading(true);
  dbg.auth('login → POST /api/login | user:', user);

  try {
    const t0 = performance.now();
    const response = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: user, password: pass }),
    });
    dbg.auth(`response → HTTP ${response.status} (${(performance.now() - t0).toFixed(0)} ms)`);

    const data = await response.json();

    if (data.status !== 1) {
      dbg.error('login rejected →', data.message);
      showLoginError(data.message || t('errWrongCreds'));
      return;
    }

    // Success — save session, transition to control screen
    saveSession(data.sessionId, user);
    showControlScreen();
    fetchStatus();
    fetchSchedules();
    startScheduleRefresh();
    showToast(t('toastSignedIn', user), 'info');

  } catch (err) {
    dbg.error('login threw →', err.name, err.message);
    showLoginError(err instanceof TypeError ? t('errNoNetwork') : t('errLoginFail'));
  } finally {
    setLoginLoading(false);
  }
});

/* ══════════════════════════════════════════════════════════════════
   CONTROL BUTTONS
══════════════════════════════════════════════════════════════════ */

btnOn.addEventListener('click',  () => acCommand('on'));
btnOff.addEventListener('click', () => acCommand('off'));

const btnRefresh  = el('btn-refresh');
const refreshIcon = el('refresh-icon');

btnRefresh.addEventListener('click', async () => {
  btnRefresh.disabled = true;
  refreshIcon.classList.add('spin');
  await Promise.all([fetchStatus(), fetchSchedules()]);
  refreshIcon.classList.remove('spin');
  btnRefresh.disabled = false;
});

/* ── Language switcher ── */
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang));
});

/* ── Schedule form ── */
const btnSchedule = el('btn-schedule');
const schedAction = el('sched-action');
const schedDelay  = el('sched-delay');

btnSchedule.addEventListener('click', async () => {
  const action = schedAction.value;
  const delay  = parseInt(schedDelay.value, 10);

  if (!delay || delay < 1) return;

  btnSchedule.disabled = true;
  await createSchedule(action, delay);
  btnSchedule.disabled = false;
});

/* ── Logout ── */
btnLogout.addEventListener('click', () => {
  dbg.session('logout requested by user');
  clearSession();
  setACState('idle');
  showLoginScreen();
  showToast(t('toastSignedOut'), 'info', 2500);
});

/* ══════════════════════════════════════════════════════════════════
   SERVICE WORKER REGISTRATION
══════════════════════════════════════════════════════════════════ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(reg => dbg.sw('registered → scope:', reg.scope))
      .catch(err => {
        dbg.sw('registration failed →', err.message);
        console.warn('[SW] Registration failed:', err);
      });
  });
}

/* ══════════════════════════════════════════════════════════════════
   STARTUP
══════════════════════════════════════════════════════════════════ */

applyLang(currentLang());

const _hasSession = loadSession();
dbg.session('startup → stored session:', _hasSession ? `user="${storedUsername()}"` : 'none');
if (_hasSession) {
  showControlScreen();
  fetchStatus();
  fetchSchedules();
  startScheduleRefresh();
} else {
  showLoginScreen();
}

/* ══════════════════════════════════════════════════════════════════
   CONSOLE DEBUG HELPER  –  window.__acDebug
══════════════════════════════════════════════════════════════════ */
window.__acDebug = {
  enable()  { localStorage.setItem(DEBUG_KEY, '1'); console.log('%c[AC] Debug logging ENABLED',  'color:#38bdf8;font-weight:700'); },
  disable() { localStorage.removeItem(DEBUG_KEY);   console.log('%c[AC] Debug logging DISABLED', 'color:#94a3b8;font-weight:700'); },
  toggle()  { localStorage.getItem(DEBUG_KEY) === '1' ? this.disable() : this.enable(); },

  session() {
    const table = {
      'Debug logging': localStorage.getItem(DEBUG_KEY) === '1' ? 'ON' : 'OFF',
      'Session ID':    loadSession() || '—',
      'Username':      storedUsername() || '—',
      'Language':      currentLang(),
      'API base':      API_BASE,
    };
    console.table(table);
    return table;
  },

  clearSession() {
    clearSession();
    console.log('%c[AC] Session cleared', 'color:#f87171;font-weight:700');
  },
};
