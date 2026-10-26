/* СЛОВО 115 — логіка застосунку. Vanilla JS (ES2017), без залежностей і без збирання.
   Дані: window.SLOVO (topics.js), window.SLOVO_LANG (lang.js). Прогрес — localStorage. */
(function () {
  'use strict';

  const S = window.SLOVO || { topics: [], categories: [], byId: {} };
  const L = window.SLOVO_LANG || { sections: [], patterns: [] };
  const TOPICS = S.topics || [];
  const TOTAL = TOPICS.length || 115;
  const CATS = S.categories || [];
  const STATUS = ['Не знаю', 'Вчу', 'Знаю', 'Впевнено'];
  const SELF = ['Не вдалося', 'Частково', 'Добре', 'Впевнено'];
  const MOTIV = ['Ще одна тема стала зрозумілішою.', 'Ти впевненіше висловлюєш свої думки.', 'Знання перетворюються на навичку.'];
  const PREP_SEC = 30;
  const SPEAK_SEC = 180;

  /* ================= Утиліти ================= */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => (n < 10 ? '0' : '') + n;
  const dateStr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const today = () => dateStr(new Date());
  const parseDate = s => { const p = String(s).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); };
  const addDays = (s, n) => { const d = parseDate(s); d.setDate(d.getDate() + n); return dateStr(d); };
  const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function plural(n, f1, f2, f5) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return f5;
    if (b > 1 && b < 5) return f2;
    if (b === 1) return f1;
    return f5;
  }
  const fmtClock = sec => { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + pad(sec % 60); };
  function fmtDuration(sec) {
    const m = Math.round((sec || 0) / 60);
    if (m < 60) return m + ' хв';
    return Math.floor(m / 60) + ' год ' + (m % 60) + ' хв';
  }
  function fmtDate(v, opts) {
    try { return new Intl.DateTimeFormat('uk-UA', opts || { day: 'numeric', month: 'long' }).format(typeof v === 'string' ? parseDate(v) : new Date(v)); }
    catch (e) { return String(v); }
  }
  function rand(n) {
    if (window.crypto && crypto.getRandomValues) { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; }
    return Math.floor(Math.random() * n);
  }
  const normApos = s => String(s).replace(/[ʼ'`´]/g, '’');
  const wordsOf = text => (normApos(text).toLowerCase().match(/[a-zа-яєіїґ’\-]+/g) || []).filter(w => /[a-zа-яєіїґ]/.test(w));
  function splitSentences(text) {
    const raw = String(text).match(/[^.!?…]+[.!?…]+[»"”)]*\s*|[^.!?…]+$/g) || [String(text)];
    const out = [];
    raw.forEach(s => { s = s.trim(); if (!s) return; if (out.length && (out[out.length - 1].length + s.length) < 180) out[out.length - 1] += ' ' + s; else out.push(s); });
    return out;
  }
  const catName = id => (CATS.find(c => c.id === id) || {}).name || '';
  const catShort = id => (CATS.find(c => c.id === id) || {}).short || '';

  /* ================= Сховище ================= */
  const KEY = 'slovo115.v1';
  let storageOk = true;
  function blank() {
    return { v: 1, created: today(), t: {}, h: [], d: {}, time: 0, plan: null, tod: null, recent: [], set: { theme: 'system', load: 20, sound: true, rate: 1 } };
  }
  function normalize(d) {
    const b = blank();
    if (!d || typeof d !== 'object') return b;
    b.created = typeof d.created === 'string' ? d.created : b.created;
    const t = {};
    if (d.t && typeof d.t === 'object') Object.keys(d.t).forEach(k => {
      const id = +k, r = d.t[k];
      if (id >= 1 && id <= TOTAL && r && typeof r === 'object') {
        const c = {};
        if (r.s === 0 || r.s === 1 || r.s === 2 || r.s === 3) c.s = r.s;
        ['iv', 'n'].forEach(f => { if (typeof r[f] === 'number' && isFinite(r[f])) c[f] = r[f]; });
        ['due', 'first', 'last'].forEach(f => { if (typeof r[f] === 'string' && /^\d{4}-\d\d-\d\d$/.test(r[f])) c[f] = r[f]; });
        if (r.fav) c.fav = true;
        if (r.hard) c.hard = true;
        t[id] = c;
      }
    });
    b.t = t;
    b.h = Array.isArray(d.h) ? d.h.filter(x => x && S.byId[x.id] && typeof x.ts === 'number').slice(-400) : [];
    if (d.d && typeof d.d === 'object') Object.keys(d.d).forEach(k => { if (/^\d{4}-\d\d-\d\d$/.test(k)) b.d[k] = Math.max(0, +d.d[k] || 0); });
    b.time = Math.max(0, +d.time || 0);
    if (d.plan && [7, 14, 30].indexOf(+d.plan.days) !== -1 && /^\d{4}-\d\d-\d\d$/.test(d.plan.start)) b.plan = { days: +d.plan.days, start: d.plan.start };
    if (d.tod && S.byId[d.tod.id]) b.tod = { date: String(d.tod.date), id: +d.tod.id };
    b.recent = Array.isArray(d.recent) ? d.recent.filter(id => S.byId[id]).slice(-20) : [];
    const s = d.set || {};
    if (['system', 'light', 'dark'].indexOf(s.theme) !== -1) b.set.theme = s.theme;
    if ([10, 20, 30].indexOf(+s.load) !== -1) b.set.load = +s.load;
    if (typeof s.sound === 'boolean') b.set.sound = s.sound;
    if (typeof s.rate === 'number' && s.rate >= 0.7 && s.rate <= 1.3) b.set.rate = s.rate;
    return b;
  }
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? normalize(JSON.parse(raw)) : blank();
    } catch (e) { storageOk = false; return blank(); }
  }
  let DB = load();
  let saveTimer = null;
  function save(now) {
    clearTimeout(saveTimer);
    const run = () => {
      try { localStorage.setItem(KEY, JSON.stringify(DB)); storageOk = true; }
      catch (e) { if (storageOk) toast('Браузер не дозволяє зберігати прогрес. Перевірте, чи не ввімкнено приватний режим.'); storageOk = false; }
    };
    if (now) run(); else saveTimer = setTimeout(run, 120);
  }
  window.addEventListener('pagehide', () => save(true));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(true); });
  window.addEventListener('storage', e => { if (e.key === KEY && e.newValue) { DB = normalize(JSON.parse(e.newValue)); route(); } });

  /* ================= Модель навчання ================= */
  const rec = id => DB.t[id] || null;
  const ensure = id => DB.t[id] || (DB.t[id] = {});
  const statusOf = id => { const r = DB.t[id]; return r && typeof r.s === 'number' ? r.s : -1; };
  const isFav = id => !!(DB.t[id] && DB.t[id].fav);
  const isDue = id => { const r = DB.t[id]; return !!(r && typeof r.s === 'number' && r.due && r.due <= today()); };
  const isHard = id => { const r = DB.t[id]; return !!(r && typeof r.s === 'number' && (r.s <= 1 || r.hard)); };

  /* Інтервальне повторення: Не знаю — 1 день, Вчу — 2, Знаю — 4…30, Впевнено — 7…60. */
  function setStatus(id, s, opts) {
    const r = ensure(id), t = today(), prev = r.iv || 0;
    let iv;
    if (s === 0) iv = 1;
    else if (s === 1) iv = 2;
    else if (s === 2) iv = clamp(Math.round(Math.max(4, prev * 2)), 4, 30);
    else iv = clamp(Math.round(Math.max(7, prev * 2.5)), 7, 60);
    r.s = s; r.iv = iv; r.due = addDays(t, iv); r.last = t; r.n = (r.n || 0) + 1;
    if (!r.first) r.first = t;
    if (opts && typeof opts.hard === 'boolean') r.hard = opts.hard; else if (s >= 2) delete r.hard;
    if (s <= 1) r.hard = true;
    markActive();
    save();
  }
  function toggleFav(id) { const r = ensure(id); if (r.fav) delete r.fav; else r.fav = true; save(); return !!r.fav; }
  function markActive() { const t = today(); if (!(t in DB.d)) DB.d[t] = 0; }
  function addTime(sec) { if (!(sec > 0)) return; const t = today(); DB.d[t] = (DB.d[t] || 0) + sec; DB.time += sec; }
  function streak() {
    const t = today();
    let d = t, n = 0;
    if (!(d in DB.d)) d = addDays(t, -1);
    while (d in DB.d) { n++; d = addDays(d, -1); }
    return n;
  }
  function stats() {
    let processed = 0, learned = 0, sure = 0, due = 0, hard = 0, fav = 0, sum = 0;
    TOPICS.forEach(tp => {
      const s = statusOf(tp.id);
      if (s >= 0) { processed++; sum += s / 3; if (s >= 2) learned++; if (s === 3) sure++; if (isDue(tp.id)) due++; if (isHard(tp.id)) hard++; }
      if (isFav(tp.id)) fav++;
    });
    return { processed, learned, sure, due, hard, fav, percent: Math.round(sum / TOTAL * 100), streak: streak(), time: DB.time, todayTime: DB.d[today()] || 0, days: Object.keys(DB.d).length };
  }
  function planInfo() {
    const p = DB.plan;
    if (!p) return null;
    const t = today();
    const end = addDays(p.start, p.days - 1);
    const dayIndex = clamp(diffDays(p.start, t) + 1, 1, p.days);
    const daysLeft = Math.max(1, diffDays(t, end) + 1);
    const st = stats();
    const doneToday = TOPICS.filter(tp => { const r = DB.t[tp.id]; return r && r.first === t; }).length;
    const remaining = TOTAL - st.processed;
    const quotaToday = Math.ceil((remaining + doneToday) / daysLeft);
    return Object.assign({}, p, {
      end, dayIndex, daysLeft, doneToday, quotaToday,
      leftToday: Math.max(0, quotaToday - doneToday),
      expected: Math.min(TOTAL, Math.round(TOTAL * dayIndex / p.days)),
      share: Math.round(st.processed / TOTAL * 100),
      over: diffDays(end, t) > 0,
      complete: st.processed >= TOTAL
    });
  }
  /* Черга: спершу теми, які час повторити, потім нові — за порядком. */
  function queue() {
    const due = TOPICS.filter(tp => isDue(tp.id)).sort((a, b) => {
      const da = DB.t[a.id].due, dbb = DB.t[b.id].due;
      return da < dbb ? -1 : da > dbb ? 1 : statusOf(a.id) - statusOf(b.id);
    });
    const fresh = TOPICS.filter(tp => statusOf(tp.id) < 0);
    return due.concat(fresh);
  }
  function topicOfDay() {
    const t = today();
    if (DB.tod && DB.tod.date === t && S.byId[DB.tod.id]) return S.byId[DB.tod.id];
    const q = queue();
    let pick = q[0];
    if (!pick) {
      const sorted = TOPICS.slice().sort((a, b) => statusOf(a.id) - statusOf(b.id) || String((rec(a.id) || {}).last || '').localeCompare(String((rec(b.id) || {}).last || '')));
      pick = sorted[0];
    }
    DB.tod = { date: t, id: pick.id };
    save();
    return pick;
  }
  function nextTopic(exceptId) {
    const tod = topicOfDay();
    const r = rec(tod.id);
    if (tod.id !== exceptId && (!r || r.last !== today())) return tod;
    const q = queue().filter(tp => tp.id !== exceptId && tp.id !== tod.id);
    if (q[0]) return q[0];
    const any = TOPICS.filter(tp => tp.id !== exceptId);
    return any[rand(any.length)];
  }
  function randomTopic(pool) {
    const ids = pool.map(t => t.id);
    const avoid = DB.recent.slice(-Math.min(10, Math.floor(ids.length / 2)));
    let cand = ids.filter(id => avoid.indexOf(id) === -1);
    if (!cand.length) cand = ids;
    const id = cand[rand(cand.length)];
    DB.recent.push(id);
    DB.recent = DB.recent.slice(-20);
    save();
    return S.byId[id];
  }
  function addHistory(entry) {
    DB.h.push(Object.assign({ ts: Date.now() }, entry));
    if (DB.h.length > 400) DB.h = DB.h.slice(-400);
    markActive();
    save();
  }

  /* ================= Облік часу навчання ================= */
  const Activity = {
    timer: null, last: 0, input: 0, forced: false,
    start() { if (this.timer) return; this.last = Date.now(); this.input = Date.now(); this.timer = setInterval(() => this.step(), 5000); },
    stop() { if (!this.timer) return; this.step(); clearInterval(this.timer); this.timer = null; this.forced = false; },
    poke() { this.input = Date.now(); },
    step() {
      const now = Date.now(), dt = Math.min(30, (now - this.last) / 1000);
      this.last = now;
      if (document.visibilityState !== 'visible') return;
      if (!this.forced && now - this.input > 120000) return;
      addTime(dt);
      save();
    }
  };
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(ev => window.addEventListener(ev, () => Activity.poke(), { passive: true }));

  /* ================= Озвучування (Web Speech API) ================= */
  const TTS = {
    ok: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
    voice: null, speaking: false, token: 0,
    pick() {
      if (!this.ok) return null;
      const vs = window.speechSynthesis.getVoices() || [];
      this.voice = vs.find(v => /^uk([-_]|$)/i.test(v.lang)) || null;
      return this.voice;
    },
    speak(text, onend) {
      this.stop();
      if (!this.ok) return 'unsupported';
      if (!this.pick()) return 'novoice';
      const parts = splitSentences(text);
      const my = ++this.token;
      let i = 0;
      this.speaking = true;
      const next = () => {
        if (my !== this.token) return;
        if (i >= parts.length) { this.speaking = false; if (onend) onend(); return; }
        const u = new SpeechSynthesisUtterance(parts[i++]);
        u.lang = this.voice.lang || 'uk-UA';
        u.voice = this.voice;
        u.rate = DB.set.rate || 1;
        u.onend = next;
        u.onerror = next;
        window.speechSynthesis.speak(u);
      };
      next();
      return 'ok';
    },
    stop() {
      this.token++;
      this.speaking = false;
      if (this.ok) { try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
    }
  };
  if (TTS.ok) { TTS.pick(); try { window.speechSynthesis.addEventListener('voiceschanged', () => TTS.pick()); } catch (e) { window.speechSynthesis.onvoiceschanged = () => TTS.pick(); } }

  /* ================= Запис голосу (MediaRecorder) ================= */
  const Rec = {
    ok: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder),
    mr: null, chunks: [], stream: null, url: null, mime: '', type: '',
    /* Доступ до мікрофона запитуємо під час натискання кнопки, а запис вмикаємо на початку відповіді. */
    async prepare() {
      this.discard();
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    },
    begin() {
      if (!this.stream) return false;
      try {
        const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
        this.mime = types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
        this.mr = this.mime ? new MediaRecorder(this.stream, { mimeType: this.mime, audioBitsPerSecond: 64000 }) : new MediaRecorder(this.stream);
        this.chunks = [];
        this.mr.ondataavailable = e => { if (e.data && e.data.size) this.chunks.push(e.data); };
        this.mr.start(1000);
        return true;
      } catch (e) { this.release(); return false; }
    },
    get active() { return !!(this.mr && this.mr.state === 'recording'); },
    stop() {
      return new Promise(res => {
        if (!this.mr || this.mr.state === 'inactive') { res(this.url); return; }
        this.mr.onstop = () => {
          const blob = new Blob(this.chunks, { type: this.mime || (this.chunks[0] && this.chunks[0].type) || 'audio/webm' });
          this.type = blob.type;
          this.url = blob.size ? URL.createObjectURL(blob) : null;
          this.release();
          res(this.url);
        };
        try { this.mr.stop(); } catch (e) { this.release(); res(null); }
      });
    },
    release() { if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; } },
    discard() {
      if (this.mr && this.mr.state !== 'inactive') { try { this.mr.onstop = null; this.mr.stop(); } catch (e) { /* ignore */ } }
      this.release();
      this.mr = null;
      if (this.url) { URL.revokeObjectURL(this.url); this.url = null; }
      this.chunks = [];
    },
    ext() { const t = this.type || this.mime; return /mp4|aac|m4a/.test(t) ? 'm4a' : /ogg/.test(t) ? 'ogg' : 'webm'; }
  };

  /* ================= Звукові сигнали, вібрація, заборона згасання екрана ================= */
  const Cue = {
    ctx: null,
    unlock() {
      try {
        if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); }
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      } catch (e) { /* ignore */ }
    },
    beep(times) {
      times = times || 1;
      if (navigator.vibrate) { try { navigator.vibrate(times > 1 ? [70, 60, 70] : 60); } catch (e) { /* ignore */ } }
      if (!this.ctx || !DB.set.sound) return;
      const t0 = this.ctx.currentTime;
      for (let i = 0; i < times; i++) {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain(), st = t0 + i * 0.22;
        o.type = 'sine';
        o.frequency.value = i === times - 1 ? 880 : 660;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.16, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.16);
        o.connect(g); g.connect(this.ctx.destination);
        o.start(st); o.stop(st + 0.18);
      }
    }
  };
  const Wake = {
    lock: null, want: false,
    async on() { this.want = true; try { if ('wakeLock' in navigator && document.visibilityState === 'visible') this.lock = await navigator.wakeLock.request('screen'); } catch (e) { /* ignore */ } },
    off() { this.want = false; try { if (this.lock) this.lock.release(); } catch (e) { /* ignore */ } this.lock = null; }
  };
  document.addEventListener('visibilitychange', () => { if (Wake.want && document.visibilityState === 'visible') Wake.on(); });

  /* Таймер на основі годинника: точний навіть після блокування екрана. */
  function Countdown(total, onTick, onDone) {
    let start = 0, iv = null, done = false;
    const stop = () => { clearInterval(iv); iv = null; };
    const tick = () => {
      const left = total - (Date.now() - start) / 1000;
      if (left <= 0) { stop(); if (!done) { done = true; onTick(0); onDone(); } return; }
      onTick(left);
    };
    return {
      begin() { start = Date.now(); tick(); iv = setInterval(tick, 200); },
      elapsed() { return start ? Math.min(total, (Date.now() - start) / 1000) : 0; },
      finish() { if (done) return; stop(); done = true; onDone(); },
      cancel() { stop(); done = true; }
    };
  }

  /* ================= Піктограми ================= */
  const svg = (p, extra) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra || ''}>${p}</svg>`;
  const I = {
    home: svg('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/>'),
    list: svg('<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="3"/>'),
    mic: svg('<rect x="9" y="2.5" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5"/>'),
    timer: svg('<circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5"/>'),
    lang: svg('<path d="M3.5 19 8 6h1.2l4.5 13M5.2 15h6.8"/><path d="M15 9.5h6M18 7.5v2M16.4 9.5c.4 2.7 1.8 4.6 4.3 5.6M19.7 9.5c-.4 2.5-1.8 4.4-4 5.6"/>'),
    gear: svg('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
    back: svg('<path d="M15 18l-6-6 6-6"/>'),
    chev: svg('<path d="M9 18l6-6-6-6"/>', ' class="chev"'),
    star: svg('<path d="m12 3.2 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3.2z"/>'),
    starFill: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3.2 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3.2z"/></svg>',
    play: svg('<path d="M7.5 4.8v14.4L19 12 7.5 4.8z"/>'),
    stop: svg('<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>'),
    check: svg('<path d="M20 6 9 17l-5-5"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', ' class="s-ico"'),
    close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.4"/>'),
    book: svg('<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>'),
    copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
    download: svg('<path d="M12 3v12m0 0-4.5-4.5M12 15l4.5-4.5M4 17v3h16v-3"/>'),
    upload: svg('<path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M4 17v3h16v-3"/>'),
    trash: svg('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
    shuffle: svg('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
    history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
    calendar: svg('<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>'),
    flag: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
    edit: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>')
  };
  const CHECK_ANIM = '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  /* ================= Тост і модальні вікна ================= */
  let toastTimer = null;
  function toast(msg, ok) {
    const el = $('#toast');
    if (!el) return;
    el.innerHTML = (ok ? CHECK_ANIM : '') + '<span>' + esc(msg) + '</span>';
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  }
  function modal(html, onMount) {
    const root = $('#modal-root');
    const prevFocus = document.activeElement;
    root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const bd = root.firstChild;
    const onKey = e => { if (e.key === 'Escape') close(); };
    function close() { root.innerHTML = ''; document.removeEventListener('keydown', onKey); if (prevFocus && prevFocus.focus) { try { prevFocus.focus(); } catch (e) { /* ignore */ } } }
    document.addEventListener('keydown', onKey);
    bd.addEventListener('click', e => { if (e.target === bd) close(); });
    $$('[data-close]', bd).forEach(b => b.addEventListener('click', close));
    if (onMount) onMount(bd.firstChild, close);
    const f = bd.querySelector('[data-autofocus], button, [href], input, select, textarea');
    if (f) f.focus();
    return close;
  }
  function confirmBox(title, text, okLabel, danger) {
    return new Promise(res => {
      modal(`<h2>${esc(title)}</h2><p class="muted">${esc(text)}</p><div class="actions"><button class="btn btn-block ${danger ? 'btn-danger' : 'btn-primary'}" data-ok>${esc(okLabel)}</button><button class="btn btn-block" data-close data-autofocus>Скасувати</button></div>`, (m, close) => {
        $('[data-ok]', m).addEventListener('click', () => { close(); res(true); });
      });
    });
  }
  function voiceHelp(kind) {
    const txt = kind === 'unsupported'
      ? 'Цей браузер не підтримує озвучування тексту. Спробуйте Safari на iPhone або Chrome на Android чи комп’ютері.'
      : 'На цьому пристрої не знайдено українського голосу, тому озвучування недоступне. Його можна додати в налаштуваннях телефону: на iPhone — у розділі озвученого вмісту серед параметрів доступності, на Android — у налаштуваннях синтезу мовлення. Після цього перезапустіть застосунок.';
    modal(`<h2>Озвучування недоступне</h2><p class="muted">${esc(txt)}</p><p class="muted">Альтернатива: прочитайте монолог уголос самостійно, а потім запишіть свою відповідь у режимі тренування й порівняйте зі зразком.</p><div class="actions"><button class="btn btn-primary btn-block" data-close>Зрозуміло</button></div>`);
  }

  /* ================= Каркас: верхня панель, вкладки, маршрутизація ================= */
  const TABS = [
    ['', 'Головна', 'home'], ['topics', 'Теми', 'list'], ['practice', 'Тренування', 'mic'], ['exam', 'Іспит', 'timer'], ['lang', 'Мова', 'lang']
  ];
  function renderTabs(active) {
    $('#tabbar').innerHTML = '<div class="tabs">' + TABS.map(t => `<a class="tab" href="#/${t[0]}"${t[0] === active ? ' aria-current="page"' : ''}>${I[t[2]]}<span>${t[1]}</span></a>`).join('') + '</div>';
  }
  function appbar(title, opts) {
    opts = opts || {};
    const left = opts.back ? `<a class="icon-btn back" href="${opts.back}" data-back="${opts.back}" aria-label="Назад">${I.back}<span>${esc(opts.backLabel || 'Назад')}</span></a>` : '';
    $('#appbar').innerHTML = `<div class="ab-side">${left}</div><div class="ab-title">${esc(title || '')}</div><div class="ab-side right">${opts.right || ''}</div>`;
  }
  const navStack = [];
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-back]');
    if (!b) return;
    e.preventDefault();
    if (navStack.length > 1) history.back(); else location.hash = b.getAttribute('data-back');
  });
  const scrollMemo = {};
  const KEEP_SCROLL = ['', 'topics', 'history', 'lang'];
  let current = null;
  let lastHash = location.hash;
  function parseHash() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    return { name: parts[0] || '', arg: parts[1] || '', arg2: parts[2] || '' };
  }
  function route() {
    const r = parseHash();
    if (current && current.cleanup) { try { current.cleanup(); } catch (e) { /* ignore */ } }
    TTS.stop();
    Wake.off();
    document.body.classList.remove('immersive');
    $('#modal-root').innerHTML = '';
    const views = { '': Home, topics: Topics, topic: TopicView, practice: Practice, exam: Exam, lang: Lang, history: History, settings: Settings, plan: PlanView };
    const fn = views[r.name] || Home;
    if (['topic', 'practice', 'exam', 'lang'].indexOf(r.name) !== -1) Activity.start(); else Activity.stop();
    const view = $('#view');
    view.classList.remove('enter');
    void view.offsetWidth;
    view.classList.add('enter');
    current = { name: r.name, cleanup: null };
    const res = fn(view, r);
    if (typeof res === 'function') current.cleanup = res;
    const tab = r.name === 'topic' ? 'topics' : (TABS.some(t => t[0] === r.name) ? r.name : '');
    renderTabs(tab);
    const y = KEEP_SCROLL.indexOf(r.name) !== -1 ? (scrollMemo[location.hash] || 0) : 0;
    window.scrollTo(0, y);
  }
  window.addEventListener('hashchange', () => {
    const h = location.hash;
    if (navStack.length > 1 && navStack[navStack.length - 2] === h) navStack.pop(); else navStack.push(h);
    lastHash = h;
    route();
  });
  window.addEventListener('scroll', () => {
    scrollMemo[location.hash] = window.scrollY;
    const ab = $('#appbar');
    if (ab) ab.classList.toggle('scrolled', window.scrollY > 4);
  }, { passive: true });
  const go = path => { location.hash = '#/' + path; };

  /* ================= Спільні елементи ================= */
  function ring(pct, label, cls) {
    const r = 48, c = 2 * Math.PI * r, off = c * (1 - clamp(pct, 0, 100) / 100);
    return `<div class="ring ${cls || ''}" role="img" aria-label="${pct}% — ${esc(label)}"><svg viewBox="0 0 112 112"><circle class="track" cx="56" cy="56" r="${r}"/><circle class="val" cx="56" cy="56" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"${pct <= 0 ? ' style="opacity:0"' : ''}/></svg><div class="ring-label"><b>${pct}%</b><span>${esc(label)}</span></div></div>`;
  }
  const sec = (title, body, open) => `<details class="sec card"${open ? ' open' : ''}><summary>${esc(title)}${I.chev}</summary><div class="body">${body}</div></details>`;
  const modeCard = (href, icon, title, text) => `<a class="mode" href="${href}"><span class="ico">${I[icon]}</span><span class="txt"><b>${title}</b><span>${esc(text)}</span></span></a>`;
  function topicLi(t, extra) {
    const s = statusOf(t.id);
    return `<a class="li" href="#/topic/${t.id}"><span class="n">${t.id}</span><span class="t"><b>${esc(t.title)}</b><span>${esc(extra || catShort(t.cat))}${s >= 0 ? ' · ' + STATUS[s] : ''}${isDue(t.id) ? ' · час повторити' : ''}</span></span>${isFav(t.id) ? `<span class="star" aria-label="В обраному">${I.starFill}</span>` : ''}<span class="dot ${s >= 0 ? 's' + s : ''}" aria-hidden="true"></span>${I.chev}</a>`;
  }
  function histLi(h) {
    const t = S.byId[h.id];
    const mode = h.m === 'e' ? 'Іспит' : 'Тренування';
    const bits = [mode, fmtClock(h.sec || 0)];
    if (typeof h.self === 'number') bits.push(SELF[h.self]);
    if (typeof h.sc === 'number') bits.push('аналіз ' + h.sc + '%');
    return `<a class="li" href="#/topic/${t.id}"><span class="n">${t.id}</span><span class="t"><b>${esc(t.title)}</b><span>${esc(bits.join(' · '))} · ${esc(fmtDate(h.ts, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</span></span>${I.chev}</a>`;
  }
  function recentList(n) {
    const items = DB.h.slice(-n).reverse();
    if (!items.length) return `<div class="card flat"><p class="muted small" style="margin:0">Тут з’являться ваші спроби в режимах «Тренування» та «Іспит».</p></div>`;
    return `<div class="list">${items.map(histLi).join('')}</div>` + (DB.h.length > n ? `<a class="btn btn-ghost btn-block" href="#/history">Уся історія (${DB.h.length})</a>` : '');
  }
  function planCard(p) {
    if (!p) {
      return `<div class="card"><p class="muted small" style="margin:0 0 12px">Оберіть строк — застосунок розрахує щоденну кількість тем від сьогоднішньої дати.</p><div class="seg" role="group" aria-label="Строк плану">${[7, 14, 30].map(d => `<button data-plan="${d}" aria-pressed="false">${d} ${plural(d, 'день', 'дні', 'днів')}</button>`).join('')}</div><a class="btn btn-ghost btn-block" href="#/plan" style="margin-top:8px">Детальніше про плани</a></div>`;
    }
    const goal = DB.set.load * 60, todaySec = DB.d[today()] || 0;
    const todayTxt = p.complete ? 'Усі 115 тем опрацьовано. Тепер — повторення складних тем.'
      : p.over ? 'Строк плану минув. Можна продовжити в тому самому темпі або створити новий план.'
      : p.leftToday ? `Сьогодні за планом: ще <b>${p.leftToday}</b> ${plural(p.leftToday, 'нова тема', 'нові теми', 'нових тем')}.` : 'План на сьогодні виконано.';
    return `<a class="card" href="#/plan" style="display:block;color:inherit">
      <div class="row between"><b>План на ${p.days} ${plural(p.days, 'день', 'дні', 'днів')}</b><span class="small faint">день ${p.dayIndex} з ${p.days} · до ${esc(fmtDate(p.end))}</span></div>
      <div class="bar ${p.share >= 100 ? 'ok' : ''}" style="margin-top:12px"><i style="width:${p.share}%"></i></div>
      <p class="small muted" style="margin:10px 0 0">Опрацьовано ${p.share}% тем (за графіком — ${Math.round(p.expected / TOTAL * 100)}%). ${todayTxt}</p>
      <div class="row between small" style="margin-top:12px"><span class="muted">Сьогодні: ${Math.round(todaySec / 60)} з ${DB.set.load} хв</span><span class="faint">${todaySec >= goal ? 'ціль досягнуто' : ''}</span></div>
      <div class="bar ok" style="margin-top:6px"><i style="width:${clamp(Math.round(todaySec / goal * 100), 0, 100)}%"></i></div>
    </a>`;
  }
  function bindPlanButtons(root) {
    $$('[data-plan]', root).forEach(b => b.addEventListener('click', e => {
      e.preventDefault();
      DB.plan = { days: +b.getAttribute('data-plan'), start: today() };
      save();
      toast('План створено. Почнімо з першої теми.', true);
      route();
    }));
  }

  /* ================= Головна ================= */
  function Home(view) {
    appbar('', { right: `<a class="icon-btn" href="#/settings" aria-label="Налаштування">${I.gear}</a>` });
    const st = stats(), plan = planInfo(), next = nextTopic();
    const label = isDue(next.id) ? 'Повторення' : statusOf(next.id) < 0 ? 'Тема дня' : 'Наступна тема';
    view.innerHTML = `
      <section class="brand"><h1>СЛОВО <span>115</span></h1><p>«Твій голос. Твоя впевненість».</p></section>
      <section class="card" aria-labelledby="pg-h">
        <h2 id="pg-h" class="h-md" style="margin-bottom:14px">Твій прогрес</h2>
        <div class="progress-card">
          ${ring(st.percent, 'підготовки')}
          <div class="stats">
            <div class="stat"><b class="num">${st.processed}/${TOTAL}</b><span>опрацьовано тем</span></div>
            <div class="stat"><b class="num">${st.learned}</b><span>засвоєно</span></div>
            <div class="stat"><b class="num">${st.due}</b><span>на повторення</span></div>
            <div class="stat"><b class="num">${st.streak}</b><span>${plural(st.streak, 'день', 'дні', 'днів')} поспіль</span></div>
          </div>
        </div>
        <div class="stat-line"><span>Впевнено: <b>${st.sure}</b></span><span>Складні: <b>${st.hard}</b></span><span>Час навчання: <b>${fmtDuration(st.time)}</b></span>${plan ? `<span>План: <b>${plan.share}%</b></span>` : ''}</div>
      </section>
      <a class="btn btn-primary btn-block btn-xl" id="start" href="#/topic/${next.id}" style="margin-top:16px">ПОЧАТИ НАВЧАННЯ<small>${label}: № ${next.id}. ${esc(next.title)}</small></a>
      <nav class="modes" aria-label="Режими">
        ${modeCard('#/topics', 'book', 'ВИВЧИТИ', 'Монолог, план і тези до кожної теми')}
        ${modeCard('#/practice', 'mic', 'ТРЕНУВАННЯ', '30 с підготовки, 3 хв відповіді')}
        ${modeCard('#/exam', 'timer', 'ІСПИТ', 'Випадкова тема без підказок')}
      </nav>
      <h2 class="eyebrow">План підготовки</h2>
      ${planCard(plan)}
      <h2 class="eyebrow">Останні відповіді</h2>
      ${recentList(3)}
      <h2 class="eyebrow">Мовний тренажер</h2>
      <a class="card row" href="#/lang" style="color:inherit"><span class="mode" style="all:unset"><span class="ico" style="width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:var(--accent-soft);color:var(--accent)">${I.lang}</span></span><span class="grow"><b>Говори правильно</b><br><span class="small muted">Кальки, прийменники, наголоси, зв’язки між реченнями</span></span>${I.chev}</a>
      <p class="footer-note">Прогрес зберігається лише на цьому пристрої й нікуди не надсилається.${storageOk ? '' : ' Увага: браузер зараз не дозволяє зберігати дані.'}</p>`;
    bindPlanButtons(view);
  }

  /* ================= Каталог тем: пошук і фільтри ================= */
  const fState = { q: '', cat: 0, st: 'all' };
  const FILTERS = [['all', 'Усі'], ['new', 'Нові'], ['s0', 'Не знаю'], ['s1', 'Вчу'], ['s2', 'Знаю'], ['s3', 'Впевнено'], ['due', 'Повторити'], ['hard', 'Складні'], ['fav', 'Обране']];
  const norm = s => normApos(String(s).toLowerCase()).replace(/[«»"“”„.,:;!?()…—–\-]/g, ' ').replace(/\s+/g, ' ').trim();
  const stem = w => w.length >= 6 ? w.slice(0, -2) : w.length >= 4 ? w.slice(0, -1) : w;
  let INDEX = null;
  function buildIndex() {
    INDEX = TOPICS.map(t => {
      const c = t.c || {};
      return { id: t.id, title: norm(t.title), text: norm(t.text + ' ' + catName(t.cat)), body: norm([c.essence, c.quote, (c.theses || []).join(' '), (c.words || []).join(' '), (c.plan || []).join(' ')].join(' ')) };
    });
  }
  function searchTopics(q) {
    const raw = String(q || '').trim();
    if (!raw) return null;
    if (/^№?\s*\d{1,3}$/.test(raw)) { const id = +raw.replace(/\D/g, ''); return S.byId[id] ? [id] : []; }
    if (!INDEX) buildIndex();
    const stems = norm(raw).split(' ').filter(w => w.length > 1).map(stem);
    if (!stems.length) return null;
    const scored = [];
    INDEX.forEach(x => {
      let score = 0;
      for (const s of stems) {
        const v = x.title.indexOf(s) !== -1 ? 10 : x.text.indexOf(s) !== -1 ? 5 : x.body.indexOf(s) !== -1 ? 2 : 0;
        if (!v) return;
        score += v;
      }
      scored.push([x.id, score]);
    });
    return scored.sort((a, b) => b[1] - a[1] || a[0] - b[0]).map(x => x[0]);
  }
  function passFilter(t) {
    if (fState.cat && t.cat !== fState.cat) return false;
    const s = statusOf(t.id);
    switch (fState.st) {
      case 'new': return s < 0;
      case 's0': case 's1': case 's2': case 's3': return s === +fState.st[1];
      case 'due': return isDue(t.id);
      case 'hard': return isHard(t.id);
      case 'fav': return isFav(t.id);
      default: return true;
    }
  }
  function Topics(view) {
    appbar('Теми');
    view.innerHTML = `
      <div class="search"><label class="sr" for="q">Пошук тем</label>${I.search}<input id="q" type="search" enterkeyhint="search" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Слово, автор або номер теми" value="${esc(fState.q)}"><button class="icon-btn s-clear" id="qx" aria-label="Очистити пошук"${fState.q ? '' : ' hidden'}>${I.close}</button></div>
      <div style="margin-top:12px"><label class="sr" for="cat">Категорія</label><select id="cat" class="select"><option value="0">Усі категорії</option>${CATS.map(c => `<option value="${c.id}"${fState.cat === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div>
      <div class="chips" style="margin-top:12px" role="group" aria-label="Фільтр за статусом">${FILTERS.map(f => `<button class="chip ${/^s\d$/.test(f[0]) ? f[0] : ''}" data-f="${f[0]}" aria-pressed="${fState.st === f[0]}">${f[1]}</button>`).join('')}</div>
      <p class="small faint" id="count" style="margin:14px 4px 8px" aria-live="polite"></p>
      <div id="res"></div>`;
    const input = $('#q', view), clear = $('#qx', view);
    function draw() {
      const ids = searchTopics(fState.q);
      let list = ids ? ids.map(id => S.byId[id]) : TOPICS.slice();
      list = list.filter(passFilter);
      $('#count', view).textContent = list.length ? `${list.length} ${plural(list.length, 'тема', 'теми', 'тем')}` : '';
      $('#res', view).innerHTML = list.length ? `<div class="list">${list.map(t => topicLi(t)).join('')}</div>`
        : `<div class="empty">${I.search.replace(' class="s-ico"', '')}<p>Нічого не знайдено.</p><p class="small">Спробуйте інше слово або скиньте фільтри.</p><button class="btn btn-soft" id="reset-f">Скинути фільтри</button></div>`;
      const rf = $('#reset-f', view);
      if (rf) rf.addEventListener('click', () => { fState.q = ''; fState.cat = 0; fState.st = 'all'; route(); });
    }
    let deb = null;
    input.addEventListener('input', () => { fState.q = input.value; clear.hidden = !input.value; clearTimeout(deb); deb = setTimeout(draw, 120); });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') input.blur(); });
    clear.addEventListener('click', () => { input.value = ''; fState.q = ''; clear.hidden = true; draw(); input.focus(); });
    $('#cat', view).addEventListener('change', e => { fState.cat = +e.target.value; draw(); });
    $$('[data-f]', view).forEach(b => b.addEventListener('click', () => {
      fState.st = b.getAttribute('data-f');
      $$('[data-f]', view).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      draw();
    }));
    draw();
  }

  /* ================= Тема: режим «Вивчити» ================= */
  function TopicView(view, r) {
    const t = S.byId[+r.arg];
    if (!t) { location.replace('#/topics'); return; }
    const c = t.c;
    const favHtml = () => `<button class="icon-btn" id="fav" aria-pressed="${isFav(t.id)}" aria-label="${isFav(t.id) ? 'Прибрати з обраного' : 'Додати до обраного'}" style="color:var(--warning)">${isFav(t.id) ? I.starFill : I.star}</button>`;
    appbar('Тема № ' + t.id, { back: '#/topics', backLabel: 'Теми', right: favHtml() });
    const prevId = t.id > 1 ? t.id - 1 : TOTAL, nextId = t.id < TOTAL ? t.id + 1 : 1;
    const kindBadge = t.kind === 1 ? '<span class="badge">Цитата</span>' : t.kind === 2 ? '<span class="badge">Метафора</span>' : '';
    view.innerHTML = `
      <article>
        <header class="topic-head">
          <div class="meta"><span class="badge acc">№ ${t.id}</span><span>${esc(catName(t.cat))}</span>${kindBadge}<span id="st-badge"></span></div>
          <h1 class="h-xl">${esc(t.title)}</h1>
          <blockquote class="formulation" aria-label="Формулювання теми">${esc(t.text)}</blockquote>
          ${t.note ? `<div class="note">${I.info}<span>${esc(t.note)}</span></div>` : ''}
        </header>
        <div class="actions3">
          <button class="btn btn-soft" id="listen">${I.play}<span>Прослухати</span></button>
          <a class="btn btn-soft" href="#/practice/${t.id}">${I.mic}<span>Тренувати</span></a>
          <button class="btn btn-soft" id="fav2" aria-pressed="${isFav(t.id)}">${isFav(t.id) ? I.starFill : I.star}<span>${isFav(t.id) ? 'В обраному' : 'В обране'}</span></button>
        </div>
        ${!c ? '<div class="card warn" style="margin-top:16px">Навчальні матеріали до цієї теми не завантажилися. Оновіть сторінку.</div>' : `
        ${sec('Суть теми', `<p>${esc(c.essence)}</p>`, true)}
        ${c.quote ? sec(t.kind === 2 ? 'Зміст метафори' : 'Зміст цитати', `<p>${esc(c.quote)}</p>${t.kind === 1 ? '<p class="tiny faint" style="margin:0">Цитату подано у формулюванні переліку тем.</p>' : ''}`, true) : ''}
        ${sec('План відповіді', `<ol class="plan">${c.plan.map(p => `<li>${esc(p)}</li>`).join('')}</ol>`, true)}
        ${sec('Зразок монологу', `<div class="seg" role="group" aria-label="Версія відповіді"><button data-v="full" aria-pressed="true">2–3 хвилини</button><button data-v="short" aria-pressed="false">1 хвилина</button></div><div class="mono" id="mono" style="margin-top:14px"></div>`, true)}
        ${sec('П’ять ключових тез', `<ol class="bullets">${c.theses.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`)}
        ${sec('Корисні слова й конструкції', `<div class="tags">${c.words.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>`)}
        ${sec('Типові мовні помилки', c.errors.map(e => `<div class="err"><span class="bad">${esc(e[0])}</span><span class="arr" aria-hidden="true">→</span><span class="good">${esc(e[1])}</span></div>`).join(''))}
        ${sec('Можливі додаткові запитання', `<ol class="bullets">${c.questions.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`)}
        ${sec('Приклад із життя', `<p style="margin:0">${esc(c.example)}</p>`)}`}
        <section class="card" style="margin-top:20px" aria-labelledby="st-h">
          <h2 class="h-md" id="st-h">Як добре ви знаєте цю тему?</h2>
          <div class="status-pick" style="margin-top:12px" role="group" aria-label="Статус засвоєння">${STATUS.map((s, i) => `<button class="chip s${i}" data-s="${i}" aria-pressed="${statusOf(t.id) === i}">${s}</button>`).join('')}</div>
          <button class="btn btn-primary btn-block btn-lg" id="learned" style="margin-top:12px">${I.check}<span>Позначити як вивчену</span></button>
          <p class="tiny faint" id="due-note" style="margin:10px 2px 0"></p>
        </section>
        <div class="row" style="margin-top:12px">
          <a class="btn grow" href="#/topic/${prevId}" aria-label="Попередня тема">← № ${prevId}</a>
          <a class="btn btn-soft grow" href="#/topic/${nextId}" aria-label="Наступна тема">№ ${nextId} →</a>
        </div>
      </article>`;

    let ver = 'full';
    const monoEl = $('#mono', view);
    function drawMono() {
      if (!monoEl) return;
      const text = ver === 'full' ? c.mono.join(' ') : c.short;
      const w = wordsOf(text).length;
      const paras = ver === 'full' ? c.mono : [c.short];
      monoEl.innerHTML = `<p class="lead">${w} ${plural(w, 'слово', 'слова', 'слів')} · ≈ ${Math.max(1, Math.round(w / 120 * 2) / 2).toString().replace('.', ',')} хв у спокійному темпі</p>` + paras.map(p => `<p>${esc(p)}</p>`).join('');
    }
    drawMono();
    $$('[data-v]', view).forEach(b => b.addEventListener('click', () => {
      ver = b.getAttribute('data-v');
      $$('[data-v]', view).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if (TTS.speaking) stopListen();
      drawMono();
    }));

    const listen = $('#listen', view);
    function stopListen() { TTS.stop(); listen.innerHTML = I.play + '<span>Прослухати</span>'; }
    listen.addEventListener('click', () => {
      if (!c) return;
      if (TTS.speaking) { stopListen(); return; }
      const text = ver === 'full' ? c.mono.join(' ') : c.short;
      const res = TTS.speak(text, () => { listen.innerHTML = I.play + '<span>Прослухати</span>'; });
      if (res !== 'ok') { voiceHelp(res); return; }
      listen.innerHTML = I.stop + '<span>Зупинити</span>';
    });

    function drawStatus() {
      const s = statusOf(t.id), rr = rec(t.id);
      $$('[data-s]', view).forEach(b => b.setAttribute('aria-pressed', String(+b.getAttribute('data-s') === s)));
      $('#st-badge', view).innerHTML = s >= 0 ? `<span class="badge ${s >= 2 ? 'ok' : 'warn'}">${STATUS[s]}</span>` : '';
      $('#due-note', view).textContent = s >= 0 && rr.due ? `Наступне повторення — ${fmtDate(rr.due)}.` : 'Оцініть тему після вивчення — застосунок нагадає повторити її в потрібний час.';
      const lb = $('#learned', view);
      if (s >= 2) { lb.className = 'btn btn-ok btn-block btn-lg'; lb.innerHTML = I.check + '<span>Вивчено</span>'; }
      else { lb.className = 'btn btn-primary btn-block btn-lg'; lb.innerHTML = I.check + '<span>Позначити як вивчену</span>'; }
    }
    drawStatus();
    $$('[data-s]', view).forEach(b => b.addEventListener('click', () => {
      const s = +b.getAttribute('data-s');
      setStatus(t.id, s);
      drawStatus();
      toast(s >= 2 ? MOTIV[rand(MOTIV.length)] : s === 1 ? 'Тему додано до повторення на післязавтра.' : 'Повернемося до цієї теми завтра.', s >= 2);
    }));
    $('#learned', view).addEventListener('click', () => {
      const s = statusOf(t.id);
      setStatus(t.id, s === 3 ? 3 : 2);
      drawStatus();
      toast(MOTIV[rand(MOTIV.length)], true);
    });
    function favToggle() {
      const on = toggleFav(t.id);
      appbar('Тема № ' + t.id, { back: '#/topics', backLabel: 'Теми', right: favHtml() });
      $('#fav').addEventListener('click', favToggle);
      $('#fav2', view).innerHTML = (on ? I.starFill : I.star) + `<span>${on ? 'В обраному' : 'В обране'}</span>`;
      $('#fav2', view).setAttribute('aria-pressed', String(on));
      toast(on ? 'Додано до обраного.' : 'Прибрано з обраного.');
    }
    $('#fav').addEventListener('click', favToggle);
    $('#fav2', view).addEventListener('click', favToggle);
    return () => TTS.stop();
  }

  /* ================= Локальний аналіз тексту відповіді =================
     Прозорі правила: обсяг, охоплення пунктів плану (збіг ключових слів), структура, сполучні слова,
     різноманітність лексики (MATTR), повтори та слова-паразити, типові кальки зі списку, наявність висновку.
     Аналіз НЕ оцінює вимову, наголоси, інтонацію й глибину думки. */
  const Analysis = (() => {
    const LET = 'a-zа-яєіїґ’';
    const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const STOP = new Set(L.stop || []);
    const PATTERNS = (L.patterns || []).map(p => ({ re: new RegExp('(^|[^' + LET + '])(' + p[0] + ')(?![' + LET + '])', 'g'), fix: p[1], kind: p[2] }));
    const markerRe = list => list.map(ph => ({ ph, re: new RegExp('(^|[^' + LET + '])' + reEsc(ph), 'g') }));
    const M = {
      connectors: markerRe(L.connectors || []), intro: markerRe(L.intro || []), argument: markerRe(L.argument || []),
      example: markerRe(L.example || []), position: markerRe(L.position || []), conclusion: markerRe(L.conclusion || []),
      fillers: (L.fillers || []).map(ph => ({ ph, re: new RegExp('(^|[^' + LET + '])' + reEsc(ph) + '(?![' + LET + '])', 'g') }))
    };
    const stem5 = w => (w.length >= 6 ? w.slice(0, 5) : w.length >= 4 ? w.slice(0, -1) : w);
    const has = (text, list) => list.filter(m => { m.re.lastIndex = 0; return m.re.test(text); }).map(m => m.ph);
    const countAll = (text, list) => list.map(m => { m.re.lastIndex = 0; const n = (text.match(m.re) || []).length; return [m.ph, n]; }).filter(x => x[1] > 0);
    function mattr(words, win) {
      if (words.length < 2) return 0;
      if (words.length <= win) return new Set(words).size / words.length;
      let sum = 0, n = 0;
      for (let i = 0; i + win <= words.length; i++) { sum += new Set(words.slice(i, i + win)).size / win; n++; }
      return sum / n;
    }
    function contentStems(text) { return wordsOf(text).filter(w => w.length >= 5 && !STOP.has(w)).map(stem5); }
    function pointText(p) { return p.replace(/^[^:]{0,24}:\s*/, ''); }

    function run(text, topic) {
      const clean = normApos(String(text || '')).replace(/\s+/g, ' ').trim();
      const low = clean.toLowerCase();
      const words = wordsOf(clean);
      const W = words.length;
      const c = topic.c || { plan: [], words: [] };
      const crit = [], recs = [];
      const part = (from, to) => { const ws = low.split(' '); return ws.slice(Math.floor(ws.length * from), Math.ceil(ws.length * to)).join(' '); };

      /* 1. Обсяг */
      const mins = W / 120;
      let vol = W < 40 ? 10 : W < 250 ? Math.round(10 + (W - 40) / 210 * 85) : W <= 400 ? 100 : Math.max(80, 100 - Math.round((W - 400) / 10));
      crit.push({ k: 'volume', name: 'Обсяг', score: vol, why: `${W} ${plural(W, 'слово', 'слова', 'слів')} — це приблизно ${mins < 1 ? 'менше хвилини' : (Math.round(mins * 2) / 2).toString().replace('.', ',') + ' хв'} мовлення. Для 2–3 хвилин потрібно орієнтовно 250–350 слів.` });
      if (vol < 60) recs.push('Розширте відповідь: для 2–3 хвилин потрібно приблизно 250–350 слів. Додайте ще один аргумент або приклад.');

      /* 2. Повнота: охоплення опорних пунктів */
      const textStems = new Set(contentStems(clean));
      const points = (c.plan || []).map(p => {
        const ks = Array.from(new Set(contentStems(pointText(p))));
        const hit = ks.filter(k => textStems.has(k)).length;
        return { p: pointText(p), ok: ks.length ? hit / ks.length >= 0.34 || hit >= 2 : false };
      });
      const covered = points.filter(x => x.ok).length;
      let cov = points.length ? Math.round(covered / points.length * 100) : 0;
      if (W < 100) cov = Math.min(cov, 60);
      crit.push({ k: 'coverage', name: 'Повнота розкриття теми', score: cov, why: `Охоплено ${covered} з ${points.length} опорних пунктів (за збігом ключових слів). Перевірте зміст самостійно.`, points });
      const missed = points.filter(x => !x.ok).map(x => '«' + x.p + '»');
      if (missed.length) recs.push('Розкрийте пункти плану, яких майже не видно у відповіді: ' + missed.slice(0, 2).join('; ') + '.');

      /* 3. Структура */
      const head = part(0, 0.3), introF = has(head, M.intro).length > 0 || points.length && points[0].ok;
      const args = has(low, M.argument), ex = has(low, M.example), pos = has(low, M.position);
      let str = (introF ? 25 : 0) + (args.length >= 2 ? 35 : args.length === 1 ? 18 : 0) + (ex.length ? 20 : 0) + (pos.length ? 20 : 0);
      const lacks = [];
      if (!introF) lacks.push('чіткого вступу');
      if (args.length < 2) lacks.push('двох виразно позначених аргументів');
      if (!ex.length) lacks.push('прикладу');
      if (!pos.length) lacks.push('особистої позиції');
      crit.push({ k: 'structure', name: 'Структура', score: str, why: lacks.length ? 'Не вистачає: ' + lacks.join(', ') + '.' : 'Є вступ, аргументи, приклад і особиста позиція.' });
      if (!ex.length) recs.push('Додайте конкретний приклад: «Наприклад, …».');
      if (!pos.length) recs.push('Чітко висловіть власну позицію: «Я переконаний, що…» або «На мою думку, …».');
      if (args.length < 2) recs.push('Позначте аргументи: «Насамперед варто зазначити…», «Не менш важливим є…».');

      /* 4. Логічні переходи */
      const conn = has(low, M.connectors);
      const D = conn.length;
      const tr = [0, 25, 45, 60, 75, 85, 100][Math.min(6, D)];
      const shown = conn.map(x => x === 'не менш важлив' ? 'не менш важливо (-им)' : x);
      crit.push({ k: 'links', name: 'Логічні переходи', score: tr, why: D ? 'Використано: ' + shown.slice(0, 8).join(', ') + '.' : 'Сполучних слів між думками не знайдено.' });
      if (tr < 60) recs.push('Пов’яжіть думки сполучними словами: «крім того», «водночас», «наприклад», «отже».');

      /* 5. Словникове багатство */
      const m = mattr(words, 50);
      let rich = W < 20 ? 0 : Math.round(clamp((m - 0.55) / (0.82 - 0.55), 0, 1) * 100);
      if (W < 60) rich = Math.min(rich, 50);
      crit.push({ k: 'rich', name: 'Словникове багатство', score: rich, why: `Різноманітність лексики (MATTR): ${(m * 100).toFixed(0)}%. Різних слів: ${new Set(words).size} із ${W}.` });
      if (rich < 60 && c.words && c.words.length) recs.push('Урізноманітніть лексику, скористайтеся словами до теми: ' + c.words.slice(0, 3).map(w => '«' + w + '»').join(', ') + '.');

      /* 6. Повтори та слова-паразити */
      const titleStems = new Set(contentStems(topic.title));
      const freq = {};
      words.filter(w => w.length >= 5 && !STOP.has(w)).forEach(w => { const s = stem5(w); if (!titleStems.has(s)) freq[s] = (freq[s] || 0) + 1; });
      const lim = Math.max(4, Math.ceil(W / 45));
      const reps = Object.keys(freq).filter(s => freq[s] >= lim).sort((a, b) => freq[b] - freq[a]);
      const repWords = reps.map(s => { const w = words.find(x => stem5(x) === s); return [w, freq[s]]; });
      const doubles = (low.match(/(^|\s)([a-zа-яєіїґ’]{2,})\s+\2(?=[\s,.!?]|$)/g) || []).length;
      const fill = countAll(' ' + low + ' ', M.fillers);
      const fillN = fill.reduce((a, x) => a + x[1], 0);
      let rep = 100 - reps.length * 15 - doubles * 10 - Math.max(0, fillN - (W > 200 ? 1 : 0)) * 6;
      rep = clamp(rep, 0, 100);
      const repWhy = [];
      if (repWords.length) repWords.slice(0, 4).forEach(x => repWhy.push(`«${x[0]}» — ${x[1]} ${plural(x[1], 'раз', 'рази', 'разів')}`));
      if (doubles) repWhy.push(`подвоєння слів поспіль: ${doubles}`);
      if (fillN) repWhy.push('можливі слова-паразити: ' + fill.map(x => `${x[0]} (${x[1]})`).join(', '));
      crit.push({ k: 'repeat', name: 'Повтори та слова-паразити', score: rep, why: repWhy.length ? repWhy.join('; ') + '.' : 'Помітних повторів не знайдено.' });
      if (repWords.length) recs.push('Замініть повтори синонімами або займенниками: ' + repWords.slice(0, 2).map(x => '«' + x[0] + '»').join(', ') + '.');
      if (fillN >= 2) recs.push('Замість слів-паразитів робіть коротку паузу — вона звучить упевненіше.');

      /* 7. Мовні помилки (лише ті, що можна достовірно виявити за списком) */
      const issues = [];
      const plain = low.replace(/«[^»]*»/g, ' ');   /* цитовані у лапках приклади не вважаємо помилками */
      PATTERNS.forEach(p => {
        p.re.lastIndex = 0;
        let mm;
        while ((mm = p.re.exec(plain)) !== null) {
          issues.push({ bad: mm[2], fix: p.fix, kind: p.kind });
          if (p.re.lastIndex === mm.index) p.re.lastIndex++;
        }
      });
      const E = issues.filter(x => x.kind === 'e').length, St = issues.length - E;
      const err = clamp(100 - E * 20 - St * 6, 0, 100);
      crit.push({ k: 'errors', name: 'Мовні помилки', score: err, why: issues.length ? `Знайдено: ${E} ${plural(E, 'помилка', 'помилки', 'помилок')} і ${St} ${plural(St, 'стилістична порада', 'стилістичні поради', 'стилістичних порад')} (за списком типових кальок).` : 'Типових кальок зі списку застосунку не знайдено. Це не гарантує відсутності інших помилок.' });
      if (E) recs.unshift('Виправте: ' + issues.filter(x => x.kind === 'e').slice(0, 3).map(x => `«${x.bad}» → «${x.fix}»`).join('; ') + '.');

      /* 8. Висновок */
      const tail = part(0.7, 1);
      const cTail = has(tail, M.conclusion), cAny = has(low, M.conclusion);
      const con = cTail.length ? 100 : cAny.length ? 55 : 0;
      crit.push({ k: 'concl', name: 'Висновок', score: con, why: cTail.length ? 'Наприкінці є висновок («' + cTail[0] + '…»).' : cAny.length ? 'Слово-маркер висновку є, але не в кінці відповіді.' : 'Висновку не знайдено.' });
      if (con < 100) recs.push('Завершіть висновком: «Отже, можна зробити висновок, що…» — і поверніться до головної думки.');

      const Wt = { coverage: 20, structure: 15, links: 10, rich: 15, repeat: 10, errors: 15, concl: 10, volume: 5 };
      const overall = Math.round(crit.reduce((a, x) => a + x.score * Wt[x.k], 0) / 100);
      const order = ['coverage', 'structure', 'links', 'rich', 'repeat', 'errors', 'concl', 'volume'];
      crit.sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k));
      return { W, overall, crit, issues, recs: recs.slice(0, 5) };
    }
    return { run };
  })();
  S.analyze = Analysis.run;

  function claudePrompt(t, text, sec) {
    return 'Ти — досвідчений екзаменатор з української мови (усна частина іспиту, рівень C1). Оціни мій монолог.\n\n' +
      `Тема № ${t.id}: «${t.title}»\nФормулювання: ${t.text}\n` +
      (sec ? `Тривалість усної відповіді: ${fmtClock(sec)} (норма — 2–3 хвилини).\n` : '') +
      '\nОціни за критеріями (від 1 до 5 балів кожен, з коротким поясненням):\n' +
      '1. Повнота розкриття теми.\n2. Структура: вступ, два аргументи, конкретний приклад, особиста позиція, висновок.\n3. Логічні переходи між думками.\n4. Словникове багатство й точність слововживання.\n5. Граматичні, лексичні та стилістичні помилки (кальки, суржик, милозвучність).\n6. Переконливість висновку.\n\n' +
      'Потім:\n— наведи кожну помилку у форматі «було → треба» з коротким поясненням правила;\n— покажи, як покращити 2–3 найслабші речення;\n— дай три конкретні поради для наступної спроби.\n' +
      'Враховуй, що це текстова розшифровка усного мовлення: вимову й інтонацію не оцінюй.\n\nМій монолог:\n"""\n' + String(text).trim() + '\n"""';
  }
  async function copyText(text) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (e) { /* fallback */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.top = '-1000px'; ta.style.fontSize = '16px';
      document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length);
      const ok = document.execCommand('copy'); document.body.removeChild(ta); return ok;
    } catch (e) { return false; }
  }
  function showCopyFallback(text) {
    modal(`<h2>Скопіюйте вручну</h2><p class="muted small">Браузер не дозволив автоматичне копіювання. Виділіть текст нижче й скопіюйте його.</p><textarea class="answer" readonly style="min-height:240px">${esc(text)}</textarea><div class="actions"><button class="btn btn-primary btn-block" data-close>Готово</button></div>`, m => { const ta = $('textarea', m); ta.focus(); ta.select(); });
  }

  function analysisHtml(a) {
    const band = a.overall >= 80 ? ['ok', 'Сильна відповідь'] : a.overall >= 60 ? ['', 'Добра основа'] : ['warn', 'Потребує доопрацювання'];
    return `<section class="card" aria-labelledby="an-h">
      <div class="progress-card">${ring(a.overall, 'за правилами', band[0])}<div><h2 class="h-md" id="an-h">${band[1]}</h2><p class="small muted" style="margin:6px 0 0">Орієнтовний навчальний аналіз тексту. Не оцінює вимову, наголоси, інтонацію та глибину думки.</p></div></div>
      <div style="margin-top:14px">${a.crit.map(x => `<div class="crit"><span class="name">${esc(x.name)}</span><span class="score">${x.score}</span><div class="bar ${x.score >= 80 ? 'ok' : x.score < 50 ? 'warn' : ''}"><i style="width:${x.score}%"></i></div><span class="why">${esc(x.why)}</span></div>`).join('')}</div>
      ${a.issues.length ? `<h3 class="h-md" style="margin-top:16px">Що виправити</h3>${a.issues.slice(0, 12).map(x => `<div class="issue ${x.kind === 's' ? 'style' : ''}"><b>${esc(x.bad)}</b> → ${esc(x.fix)} <span class="kind ${x.kind}">${x.kind === 'e' ? 'помилка' : 'стиль'}</span></div>`).join('')}` : ''}
      ${a.recs.length ? `<h3 class="h-md" style="margin-top:16px">Рекомендації</h3><ul class="bullets">${a.recs.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
    </section>`;
  }

  /* Панель тексту відповіді: введення, локальний аналіз, копіювання для Claude. */
  function answerPanel(root, topic, getSec, onAnalysis) {
    root.innerHTML = `<section class="card">
        <h2 class="h-md">Текст відповіді</h2>
        <p class="small muted" style="margin:6px 0 10px">Надиктуйте відповідь мікрофоном на клавіатурі телефона, введіть її або вставте. Текст аналізується лише на цьому пристрої.</p>
        <label class="sr" for="ans">Текст відповіді</label>
        <textarea class="answer" id="ans" placeholder="Почніть зі вступу: «Ця тема спонукає замислитися над…»"></textarea>
        <p class="tiny faint" id="ans-count" style="margin:6px 2px 10px">0 слів</p>
        <div class="btn-row"><button class="btn btn-primary" id="an-go">Проаналізувати</button><button class="btn btn-soft" id="an-copy">${I.copy}<span>Скопіювати для перевірки в Claude</span></button></div>
      </section><div id="an-res" style="margin-top:12px"></div>`;
    const ta = $('#ans', root), cnt = $('#ans-count', root);
    ta.addEventListener('input', () => { const n = wordsOf(ta.value).length; cnt.textContent = `${n} ${plural(n, 'слово', 'слова', 'слів')} · ≈ ${fmtClock(n / 120 * 60)} мовлення`; });
    $('#an-go', root).addEventListener('click', () => {
      if (wordsOf(ta.value).length < 15) { toast('Додайте більше тексту — щонайменше кілька речень.'); ta.focus(); return; }
      const a = Analysis.run(ta.value, topic);
      $('#an-res', root).innerHTML = analysisHtml(a);
      if (onAnalysis) onAnalysis(a, ta.value);
      $('#an-res', root).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('#an-copy', root).addEventListener('click', async () => {
      if (wordsOf(ta.value).length < 5) { toast('Спершу введіть або надиктуйте текст відповіді.'); ta.focus(); return; }
      const text = claudePrompt(topic, ta.value, getSec ? getSec() : 0);
      if (await copyText(text)) toast('Скопійовано. Вставте текст у чат із Claude.', true); else showCopyFallback(text);
    });
    return { text: () => ta.value };
  }

  function timerHtml(cls, cap, total) {
    const r = 54, c = 2 * Math.PI * r;
    return `<div class="timer ${cls}" id="timer" role="timer" aria-live="off"><svg viewBox="0 0 120 120"><circle class="track" cx="60" cy="60" r="${r}"/><circle class="val" cx="60" cy="60" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="0"/></svg><div class="t-label"><b id="t-num">${fmtClock(total)}</b><span id="t-cap">${esc(cap)}</span></div></div>`;
  }
  function setTimer(left, total) {
    const v = $('#timer .val');
    if (!v) return;
    v.style.strokeDashoffset = (2 * Math.PI * 54 * (1 - left / total)).toFixed(2);
    const n = $('#t-num');
    const txt = fmtClock(left);
    if (n.textContent !== txt) n.textContent = txt;
  }
  const CHECKS = ['Чіткий вступ', 'Два аргументи', 'Конкретний приклад', 'Особиста позиція', 'Переконливий висновок', 'Відповідь тривала 2–3 хвилини без довгих пауз'];
  function selfHtml() {
    return `<section class="card" aria-labelledby="self-h">
      <h2 class="h-md" id="self-h">Самооцінка</h2>
      <p class="small muted" style="margin:6px 0 8px">Позначте, що вдалося у відповіді.</p>
      <div class="checks">${CHECKS.map((x, i) => `<label><input type="checkbox" data-ch="${i}"> <span>${esc(x)}</span></label>`).join('')}</div>
      <p class="small" style="margin:14px 0 8px"><b>Як ви оцінюєте спробу загалом?</b></p>
      <div class="status-pick" role="group" aria-label="Загальна самооцінка">${SELF.map((s, i) => `<button class="chip s${i}" data-self="${i}" aria-pressed="false">${s}</button>`).join('')}</div>
    </section>`;
  }
  function bindSelf(root, onChange) {
    let val = -1;
    $$('[data-self]', root).forEach(b => b.addEventListener('click', () => {
      val = +b.getAttribute('data-self');
      $$('[data-self]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      if (onChange) onChange(val);
    }));
    return { value: () => val, checks: () => $$('[data-ch]', root).filter(x => x.checked).length };
  }
  function recHtml(url) {
    if (!url) return '';
    return `<section class="card"><h2 class="h-md">Ваш запис</h2><audio controls preload="metadata" src="${url}" style="width:100%;margin-top:10px"></audio><div class="row between" style="margin-top:8px"><span class="tiny faint">Запис зберігається лише до виходу з цього екрана.</span><a class="btn btn-ghost" href="${url}" download="slovo115-vidpovid.${Rec.ext()}">${I.download}<span>Зберегти</span></a></div></section>`;
  }
  function sampleHtml(t, open) {
    const c = t.c;
    if (!c) return '';
    return sec('Порівняти зі зразком', `<p class="small muted">План відповіді</p><ol class="plan">${c.plan.map(p => `<li>${esc(p)}</li>`).join('')}</ol><hr class="sep"><div class="mono">${c.mono.map(p => `<p>${esc(p)}</p>`).join('')}</div>`, open);
  }
  function recToggleHtml(on) {
    if (!Rec.ok) return `<div class="note">${I.info}<span>Запис голосу в цьому браузері недоступний. Говоріть уголос за таймером, а потім надиктуйте або введіть основні думки текстом — застосунок проаналізує їх і порівняє зі зразком.</span></div>`;
    return `<label class="card row" style="cursor:pointer"><span class="grow"><b>Записувати голос</b><br><span class="small muted">Запис залишається на пристрої, щоб ви могли себе прослухати.</span></span><input type="checkbox" id="rec-on" ${on ? 'checked' : ''} style="width:24px;height:24px;accent-color:var(--accent)"></label>`;
  }
  async function prepareMic(on) {
    if (!on || !Rec.ok) return false;
    try { await Rec.prepare(); return true; }
    catch (e) { toast('Немає доступу до мікрофона — продовжимо без запису.'); return false; }
  }

  /* ================= Режим «Тренування» ================= */
  function Practice(view, r) {
    let topic = r.arg && S.byId[+r.arg] ? S.byId[+r.arg] : nextTopic();
    let cd = null, spoke = 0, recUrl = null, saved = false, lastAnalysis = null;
    let recordOn = Rec.ok && DB.set.rec !== false;
    let hardOnly = false;
    const back = r.arg ? { back: '#/topic/' + topic.id, backLabel: '№ ' + topic.id } : {};
    function cleanup() { if (cd) cd.cancel(); Rec.discard(); Wake.off(); Activity.forced = false; }

    function setup() {
      appbar('Тренування', back);
      const hardPool = TOPICS.filter(t => statusOf(t.id) < 2 || isHard(t.id));
      view.innerHTML = `<div class="stack">
        <section class="card">
          <div class="row between small faint"><span>№ ${topic.id} · ${esc(catShort(topic.cat))}</span><span>${statusOf(topic.id) >= 0 ? STATUS[statusOf(topic.id)] : 'Нова тема'}</span></div>
          <h1 class="h-lg" style="margin-top:8px">${esc(topic.title)}</h1>
          <p class="muted" style="margin:8px 0 14px">${esc(topic.text)}</p>
          <div class="btn-row"><button class="btn btn-soft" id="shuffle">${I.shuffle}<span>Випадкова тема</span></button><a class="btn" href="#/topics">Обрати зі списку</a></div>
          <label class="row small" style="margin-top:12px;min-height:40px"><input type="checkbox" id="hard" ${hardOnly ? 'checked' : ''} style="width:20px;height:20px;accent-color:var(--accent)"> <span>Випадкові теми лише зі складних і невивчених (${hardPool.length})</span></label>
        </section>
        <section class="card flat"><ol class="plan">
          <li>30 секунд на підготовку з п’ятьма опорними пунктами.</li>
          <li>3 хвилини відповіді вголос — як на іспиті.</li>
          <li>Текст відповіді — для локального аналізу й порівняння зі зразком.</li>
        </ol></section>
        ${recToggleHtml(recordOn)}
        <button class="btn btn-primary btn-lg btn-block" id="go">Почати підготовку · 30 с</button>
      </div>`;
      $('#shuffle', view).addEventListener('click', () => {
        const pool = hardOnly ? TOPICS.filter(t => statusOf(t.id) < 2 || isHard(t.id)) : TOPICS;
        topic = randomTopic(pool.length ? pool : TOPICS);
        setup();
      });
      $('#hard', view).addEventListener('change', e => { hardOnly = e.target.checked; });
      const rt = $('#rec-on', view);
      if (rt) rt.addEventListener('change', () => { recordOn = rt.checked; DB.set.rec = rt.checked; save(); });
      $('#go', view).addEventListener('click', async () => {
        Cue.unlock();
        await prepareMic(recordOn);
        prep();
      });
    }

    function prep() {
      appbar('Підготовка', {});
      const c = topic.c;
      view.innerHTML = `<div class="stage">
        <p class="small faint" style="margin:0">Тема № ${topic.id}</p>
        <h1 class="topic-q">${esc(topic.title)}</h1>
        <p class="topic-sub" style="margin:0">${esc(topic.text)}</p>
        ${timerHtml('prep', 'підготовка', PREP_SEC)}
        ${c ? `<section class="card flat"><p class="small faint" style="margin:0 0 6px">Опорні пункти</p><ol class="plan">${c.plan.map(p => `<li>${esc(p)}</li>`).join('')}</ol></section>` : ''}
        <div class="stage-actions"><button class="btn btn-primary btn-lg btn-block" id="speak">${I.mic}<span>Почати відповідь</span></button><button class="btn btn-ghost" id="cancel">Скасувати</button></div>
      </div>`;
      Wake.on();
      Activity.forced = true;
      cd = Countdown(PREP_SEC, left => setTimer(left, PREP_SEC), () => {
        Cue.beep(1);
        const cap = $('#t-cap');
        if (cap) cap.textContent = 'час говорити';
        toast('Час підготовки минув. Почніть відповідь.');
      });
      cd.begin();
      $('#speak', view).addEventListener('click', () => { cd.cancel(); speak(); });
      $('#cancel', view).addEventListener('click', () => { cd.cancel(); Rec.discard(); Wake.off(); Activity.forced = false; setup(); });
    }

    function speak() {
      appbar('Відповідь', {});
      const c = topic.c;
      const recording = Rec.begin();
      view.innerHTML = `<div class="stage">
        <div class="row between"><p class="small faint" style="margin:0">Тема № ${topic.id}</p>${recording ? '<span class="rec"><i></i>Запис</span>' : ''}</div>
        <h1 class="topic-q">${esc(topic.title)}</h1>
        ${timerHtml('', 'говоріть', SPEAK_SEC)}
        ${c ? `<details class="sec card flat"><summary>Опорні пункти${I.chev}</summary><div class="body"><ol class="plan">${c.plan.map(p => `<li>${esc(p)}</li>`).join('')}</ol></div></details>` : ''}
        <div class="stage-actions"><button class="btn btn-primary btn-lg btn-block" id="finish">${I.stop}<span>Завершити відповідь</span></button></div>
      </div>`;
      Cue.beep(1);
      Wake.on();
      Activity.forced = true;
      cd = Countdown(SPEAK_SEC, left => {
        setTimer(left, SPEAK_SEC);
        const tm = $('#timer');
        if (tm) tm.classList.toggle('late', left <= 30);
      }, () => { spoke = cd.elapsed(); Cue.beep(2); finish(); });
      cd.begin();
      $('#finish', view).addEventListener('click', () => { spoke = cd.elapsed(); cd.cancel(); finish(); });
    }

    async function finish() {
      Wake.off();
      Activity.forced = false;
      recUrl = await Rec.stop();
      review();
    }

    function review() {
      appbar('Аналіз відповіді', {});
      const short = spoke < 120;
      view.innerHTML = `<div class="stack">
        <section class="card ${short ? 'warn' : 'ok'}"><b>Відповідь тривала ${fmtClock(spoke)}.</b><p class="small" style="margin:4px 0 0">${short ? 'На іспиті варто говорити щонайменше 2 хвилини. Спробуйте додати ще один аргумент або приклад.' : 'Ви вклалися в норму 2–3 хвилини.'}</p></section>
        ${recHtml(recUrl)}
        <div id="panel"></div>
        ${selfHtml()}
        ${sampleHtml(topic, false)}
        <button class="btn btn-primary btn-lg btn-block" id="save">Зберегти результат</button>
        <div class="btn-row"><button class="btn" id="again">Ще раз цю тему</button><button class="btn" id="other">${I.shuffle}<span>Інша тема</span></button></div>
      </div>`;
      const panel = answerPanel($('#panel', view), topic, () => spoke, a => { lastAnalysis = a; });
      const self = bindSelf(view);
      $('#save', view).addEventListener('click', () => {
        const sv = self.value();
        if (sv < 0) { toast('Оберіть загальну самооцінку спроби.'); $('#self-h', view).scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
        const text = panel.text();
        const W = wordsOf(text).length;
        if (W >= 15 && !lastAnalysis) lastAnalysis = Analysis.run(text, topic);
        addHistory({ id: topic.id, m: 'p', sec: Math.round(spoke), self: sv, ch: self.checks(), w: W || undefined, sc: lastAnalysis ? lastAnalysis.overall : undefined });
        setStatus(topic.id, sv, { hard: sv <= 1 });
        saved = true;
        const btn = $('#save', view);
        btn.className = 'btn btn-ok btn-lg btn-block';
        btn.innerHTML = I.check + '<span>Збережено</span>';
        btn.disabled = true;
        toast(sv >= 2 ? MOTIV[rand(MOTIV.length)] : 'Результат збережено. Тема повториться найближчими днями.', true);
      });
      $('#again', view).addEventListener('click', () => { resetAttempt(); setup(); });
      $('#other', view).addEventListener('click', () => { resetAttempt(); topic = nextTopic(topic.id); setup(); });
    }
    function resetAttempt() { Rec.discard(); recUrl = null; spoke = 0; saved = false; lastAnalysis = null; }

    setup();
    return cleanup;
  }

  /* ================= Режим «Іспит» ================= */
  function Exam(view) {
    let pool = 'all', topic = null, cd = null, spoke = 0, recUrl = null;
    let recordOn = Rec.ok && DB.set.rec !== false;
    const hardList = () => TOPICS.filter(t => statusOf(t.id) < 2 || isHard(t.id));
    function cleanup() { if (cd) cd.cancel(); Rec.discard(); Wake.off(); Activity.forced = false; document.body.classList.remove('immersive'); }
    function exitBtn() { return `<button class="icon-btn" id="exit" aria-label="Вийти з іспиту" style="position:absolute;right:0;top:0;color:var(--text-3)">${I.close}</button>`; }
    function bindExit() {
      const b = $('#exit', view);
      if (b) b.addEventListener('click', async () => {
        if (await confirmBox('Вийти з іспиту?', 'Спробу не буде збережено.', 'Вийти', true)) { if (cd) cd.cancel(); cleanup(); setup(); }
      });
    }

    function setup() {
      document.body.classList.remove('immersive');
      appbar('Іспит');
      const hl = hardList();
      if (pool === 'hard' && !hl.length) pool = 'all';
      view.innerHTML = `<div class="stack">
        <section class="card">
          <h1 class="h-lg">Режим іспиту</h1>
          <p class="muted" style="margin:8px 0 0">Випадкова тема з усіх 115. 30 секунд на підготовку, 3 хвилини на монолог. Зразок відповіді відкриється лише після завершення спроби.</p>
        </section>
        <section class="card">
          <p class="small" style="margin:0 0 10px"><b>Які теми брати?</b></p>
          <div class="seg" role="group" aria-label="Набір тем"><button data-pool="all" aria-pressed="${pool === 'all'}">Усі теми (${TOTAL})</button><button data-pool="hard" aria-pressed="${pool === 'hard'}" ${hl.length ? '' : 'disabled'}>Складні й невивчені (${hl.length})</button></div>
        </section>
        ${recToggleHtml(recordOn)}
        <button class="btn btn-primary btn-lg btn-block" id="start">Почати іспит</button>
        <p class="tiny faint center">Під час іспиту екран не згасатиме, якщо браузер це підтримує.</p>
      </div>`;
      $$('[data-pool]', view).forEach(b => b.addEventListener('click', () => {
        pool = b.getAttribute('data-pool');
        $$('[data-pool]', view).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      }));
      const rt = $('#rec-on', view);
      if (rt) rt.addEventListener('change', () => { recordOn = rt.checked; DB.set.rec = rt.checked; save(); });
      $('#start', view).addEventListener('click', async () => {
        Cue.unlock();
        await prepareMic(recordOn);
        const list = pool === 'hard' ? hardList() : TOPICS;
        topic = randomTopic(list.length ? list : TOPICS);
        prep();
      });
    }

    function prep() {
      document.body.classList.add('immersive');
      view.innerHTML = `<div class="stage" style="position:relative">
        ${exitBtn()}
        <p class="small faint" style="margin:0">Іспит · тема № ${topic.id}</p>
        <h1 class="topic-q" style="padding-right:40px">${esc(topic.title)}</h1>
        <p class="topic-sub" style="margin:0">${esc(topic.text)}</p>
        ${timerHtml('prep', 'підготовка', PREP_SEC)}
        <div class="stage-actions"><button class="btn btn-primary btn-lg btn-block" id="now">Почати відповідь зараз</button></div>
      </div>`;
      bindExit();
      Wake.on();
      Activity.forced = true;
      cd = Countdown(PREP_SEC, left => setTimer(left, PREP_SEC), () => speak());
      cd.begin();
      $('#now', view).addEventListener('click', () => { cd.cancel(); speak(); });
    }

    function speak() {
      const recording = Rec.begin();
      view.innerHTML = `<div class="stage" style="position:relative">
        ${exitBtn()}
        <div class="row" style="padding-right:44px"><p class="small faint" style="margin:0">Тема № ${topic.id}</p>${recording ? '<span class="rec"><i></i>Запис</span>' : ''}</div>
        <h1 class="topic-q" style="padding-right:40px">${esc(topic.title)}</h1>
        ${timerHtml('', 'монолог', SPEAK_SEC)}
        <div class="stage-actions"><button class="btn btn-lg btn-block" id="early">Завершити достроково</button></div>
      </div>`;
      bindExit();
      Cue.beep(1);
      cd = Countdown(SPEAK_SEC, left => { setTimer(left, SPEAK_SEC); const tm = $('#timer'); if (tm) tm.classList.toggle('late', left <= 30); }, () => { spoke = cd.elapsed(); Cue.beep(2); done(); });
      cd.begin();
      $('#early', view).addEventListener('click', () => { spoke = cd.elapsed(); cd.cancel(); done(); });
    }

    async function done() {
      Wake.off();
      Activity.forced = false;
      recUrl = await Rec.stop();
      document.body.classList.remove('immersive');
      appbar('Самооцінка');
      view.innerHTML = `<div class="stack">
        <section class="card"><p class="small faint" style="margin:0">Тема № ${topic.id} · відповідь тривала ${fmtClock(spoke)}</p><h1 class="h-lg" style="margin-top:6px">${esc(topic.title)}</h1></section>
        ${recHtml(recUrl)}
        ${selfHtml()}
        <button class="btn btn-primary btn-lg btn-block" id="fin" disabled>Зберегти й відкрити зразок</button>
      </div>`;
      const self = bindSelf(view, () => { $('#fin', view).disabled = false; });
      $('#fin', view).addEventListener('click', () => {
        const sv = self.value();
        if (sv < 0) return;
        addHistory({ id: topic.id, m: 'e', sec: Math.round(spoke), self: sv, ch: self.checks() });
        setStatus(topic.id, sv, { hard: sv <= 1 });
        result(sv);
      });
    }

    function result(sv) {
      appbar('Результат');
      view.innerHTML = `<div class="stack">
        <section class="card center"><div class="done-mark">${CHECK_ANIM.replace('class="check"', '')}</div><h1 class="h-lg">Спробу збережено</h1><p class="muted" style="margin:6px 0 0">Самооцінка: ${esc(SELF[sv])} · ${fmtClock(spoke)}</p><p class="small faint" style="margin:6px 0 0">${esc(MOTIV[rand(MOTIV.length)])}</p></section>
        ${recHtml(recUrl)}
        ${sampleHtml(topic, true)}
        <details class="sec card"><summary>Проаналізувати текст відповіді${I.chev}</summary><div class="body" id="panel"></div></details>
        <button class="btn btn-primary btn-lg btn-block" id="more">${I.shuffle}<span>Ще одна тема</span></button>
        <div class="btn-row"><a class="btn" href="#/topic/${topic.id}">Вивчити тему</a><a class="btn" href="#/">Головна</a></div>
      </div>`;
      answerPanel($('#panel', view), topic, () => spoke);
      $('#more', view).addEventListener('click', () => { Rec.discard(); recUrl = null; spoke = 0; setup(); });
    }

    setup();
    return cleanup;
  }

  /* ================= «Говори правильно» ================= */
  let langQuiz = false;
  function langSection(s) {
    let body = s.intro ? `<p class="small muted">${esc(s.intro)}</p>` : '';
    const label = k => s.id === 'notwrong' ? '<span class="kind" style="color:var(--success)">норма</span>' : `<span class="kind ${k}">${k === 'e' ? 'помилка' : 'стиль'}</span>`;
    if (s.items) body += s.items.map(it => `<div class="pair${langQuiz && s.id !== 'notwrong' ? ' hidden' : ''}" ${langQuiz && s.id !== 'notwrong' ? 'tabindex="0" role="button" aria-label="Показати правильний варіант"' : ''}>
        <span class="q">${s.id === 'notwrong' ? esc(it[0]) : '<s>' + esc(it[0]) + '</s>'} ${label(it[2])}</span>
        <span class="a">${s.id === 'notwrong' ? '✓ ' : '→ '}${esc(it[1])}</span>${it[3] ? `<span class="c">${esc(it[3])}</span>` : ''}</div>`).join('');
    if (s.id === 'stress') body += `<div class="stress">${s.words.map(w => `<span>${esc(w)}</span>`).join('')}</div>`;
    if (s.rules) body += s.rules.map(r => `<div class="pair"><b>${esc(r[0])}</b><span class="c" style="color:var(--text);font-size:15.5px">${esc(r[1])}</span></div>`).join('');
    if (s.groups) body += s.groups.map(g => `<div class="pair"><b>${esc(g[0])}</b><span class="c" style="color:var(--text);font-size:15.5px">${esc(g[1])}</span></div>`).join('');
    if (s.id === 'fillers') body += `<div class="tags">${s.words.map(w => `<span class="tag"><s>${esc(w)}</s></span>`).join('')}</div><h3 class="h-md" style="margin-top:16px">Як їх позбутися</h3><ul class="bullets">${s.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
    if (s.steps) body += `<h3 class="h-md" style="margin-top:6px">Формула</h3><ol class="plan">${s.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol><h3 class="h-md" style="margin-top:14px">Готові звороти</h3><div class="tags" style="margin-top:8px">${s.templates.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div><h3 class="h-md" style="margin-top:14px">Чого уникати</h3><ul class="bullets">${s.avoid.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
    return `<section class="card" id="ls-${s.id}" style="margin-top:12px;scroll-margin-top:70px"><h2 class="h-lg">${esc(s.title)}</h2><div style="margin-top:8px">${body}</div></section>`;
  }
  function Lang(view) {
    appbar('Говори правильно');
    const draw = () => {
      view.innerHTML = `
        <section class="brand" style="padding-bottom:6px"><h1 class="h-xl">Говори правильно</h1><p>Короткий довідник для грамотного й упевненого мовлення.</p></section>
        <label class="card row" style="cursor:pointer"><span class="grow"><b>Перевір себе</b><br><span class="small muted">Правильні варіанти приховано — торкніться, щоб відкрити.</span></span><input type="checkbox" id="quiz" ${langQuiz ? 'checked' : ''} style="width:24px;height:24px;accent-color:var(--accent)"></label>
        <nav class="chips" style="margin-top:12px" aria-label="Розділи">${L.sections.map(s => `<button class="chip" data-jump="${s.id}">${esc(s.title)}</button>`).join('')}</nav>
        ${L.sections.map(langSection).join('')}
        <p class="footer-note">Позначка «помилка» — ненормативний вислів. «Стиль» — вислів не є грубою помилкою, але в публічному мовленні краще обрати інший варіант.</p>`;
      $('#quiz', view).addEventListener('change', e => { langQuiz = e.target.checked; draw(); });
      $$('[data-jump]', view).forEach(b => b.addEventListener('click', () => { const el = $('#ls-' + b.getAttribute('data-jump'), view); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
      $$('.pair.hidden', view).forEach(p => {
        const open = () => { p.classList.remove('hidden'); p.removeAttribute('role'); p.removeAttribute('tabindex'); };
        p.addEventListener('click', open);
        p.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
      });
    };
    draw();
  }

  /* ================= Історія ================= */
  function History(view) {
    appbar('Історія', { back: '#/', backLabel: 'Головна' });
    let mode = 'all';
    const draw = () => {
      const list = DB.h.filter(h => mode === 'all' || h.m === mode).slice().reverse();
      const total = list.reduce((a, h) => a + (h.sec || 0), 0);
      const withSelf = list.filter(h => typeof h.self === 'number');
      const good = withSelf.filter(h => h.self >= 2).length;
      view.innerHTML = `
        <div class="seg" role="group" aria-label="Режим"><button data-m="all" aria-pressed="${mode === 'all'}">Усі</button><button data-m="p" aria-pressed="${mode === 'p'}">Тренування</button><button data-m="e" aria-pressed="${mode === 'e'}">Іспит</button></div>
        <section class="card" style="margin-top:12px"><div class="stats" style="grid-template-columns:repeat(3,1fr)">
          <div class="stat"><b>${list.length}</b><span>${plural(list.length, 'спроба', 'спроби', 'спроб')}</span></div>
          <div class="stat"><b>${fmtDuration(total)}</b><span>говоріння</span></div>
          <div class="stat"><b>${withSelf.length ? Math.round(good / withSelf.length * 100) : 0}%</b><span>оцінено «Добре» чи «Впевнено»</span></div>
        </div></section>
        <div style="margin-top:12px">${list.length ? `<div class="list">${list.map(histLi).join('')}</div>` : `<div class="empty">${I.history}<p>Поки що немає жодної спроби.</p><a class="btn btn-primary" href="#/practice">Почати тренування</a></div>`}</div>`;
      $$('[data-m]', view).forEach(b => b.addEventListener('click', () => { mode = b.getAttribute('data-m'); draw(); }));
    };
    draw();
  }

  /* ================= План підготовки ================= */
  const MIN_PER_TOPIC = 8;
  function PlanView(view) {
    appbar('План підготовки', { back: '#/', backLabel: 'Головна' });
    const draw = () => {
      const p = planInfo(), st = stats();
      const remaining = TOTAL - st.processed;
      const choose = `<div class="seg" role="group" aria-label="Строк плану">${[7, 14, 30].map(d => `<button data-days="${d}" aria-pressed="${!!(p && p.days === d)}">${d} ${plural(d, 'день', 'дні', 'днів')}</button>`).join('')}</div>`;
      const est = [7, 14, 30].map(d => { const k = Math.ceil(remaining / d); return `<li><b>${d} ${plural(d, 'день', 'дні', 'днів')}</b> — ${k} ${plural(k, 'тема', 'теми', 'тем')} на день, ≈ ${k * MIN_PER_TOPIC} хв</li>`; }).join('');
      let todayList = '';
      if (p && !p.complete) {
        const due = TOPICS.filter(t => isDue(t.id));
        const fresh = TOPICS.filter(t => statusOf(t.id) < 0).slice(0, p.leftToday);
        const items = due.slice(0, 6).map(t => topicLi(t, 'Повторення')).concat(fresh.map(t => topicLi(t, 'Нова тема')));
        todayList = items.length ? `<h2 class="eyebrow">На сьогодні</h2><div class="list">${items.join('')}</div>` : `<div class="card ok" style="margin-top:12px">На сьогодні все зроблено. Можна потренуватися в режимі іспиту.</div>`;
      }
      const behind = p && !p.complete && st.processed < p.expected - 2;
      const needMin = p ? p.quotaToday * MIN_PER_TOPIC : 0;
      view.innerHTML = `
        ${p ? planCard(p) : ''}
        ${p && behind ? `<div class="note" style="background:var(--accent-soft)">${I.info}<span>Ви трохи відстаєте від графіка — нічого страшного. Щоденну кількість тем уже перераховано на решту днів.</span></div>` : ''}
        ${p && needMin > DB.set.load ? `<div class="note">${I.info}<span>Сьогоднішня норма потребує приблизно ${needMin} хв — більше за обране навантаження (${DB.set.load} хв). Можна обрати довший план: без поспіху знання стійкіші.</span></div>` : ''}
        ${todayList}
        <h2 class="eyebrow">${p ? 'Змінити строк' : 'Оберіть строк'}</h2>
        <section class="card">${choose}<ul class="bullets small muted" style="margin-top:12px">${est}</ul><p class="tiny faint" style="margin:8px 0 0">Розрахунок — від сьогоднішньої дати (${esc(fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' }))}) для ${remaining} неопрацьованих тем. Орієнтовно ${MIN_PER_TOPIC} хв на тему: прочитати, проговорити, оцінити.</p></section>
        <h2 class="eyebrow">Щоденне навантаження</h2>
        <section class="card"><div class="seg" role="group" aria-label="Навантаження">${[10, 20, 30].map(m => `<button data-load="${m}" aria-pressed="${DB.set.load === m}">${m} хв</button>`).join('')}</div><p class="small muted" style="margin:10px 0 0">Маленькі щоденні кроки працюють краще за рідкісні марафони. Пропущений день не скидає план — кількість тем просто перерахується.</p></section>
        ${p ? '<button class="btn btn-danger btn-block" id="drop" style="margin-top:16px">Скасувати план</button>' : ''}`;
      $$('[data-days]', view).forEach(b => b.addEventListener('click', async () => {
        const d = +b.getAttribute('data-days');
        if (p && !(await confirmBox('Створити новий план?', `План на ${d} ${plural(d, 'день', 'дні', 'днів')} почнеться сьогодні. Прогрес тем збережеться.`, 'Створити'))) return;
        DB.plan = { days: d, start: today() };
        save();
        toast('План оновлено.', true);
        draw();
      }));
      $$('[data-load]', view).forEach(b => b.addEventListener('click', () => { DB.set.load = +b.getAttribute('data-load'); save(); draw(); }));
      const drop = $('#drop', view);
      if (drop) drop.addEventListener('click', async () => { if (await confirmBox('Скасувати план?', 'Прогрес тем і історія збережуться.', 'Скасувати план', true)) { DB.plan = null; save(); draw(); } });
    };
    draw();
  }

  /* ================= Налаштування ================= */
  const VERSION = '1.0.1';
  let swState = 'немає';
  function applyTheme() {
    const t = DB.set.theme, root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
    const dark = t === 'dark' || (t === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const metas = $$('meta[name="theme-color"]');
    metas.forEach((m, i) => { if (i === 0) { m.removeAttribute('media'); m.setAttribute('content', dark ? '#121417' : '#f5f6f8'); } else m.remove(); });
  }
  function exportData() {
    const json = JSON.stringify({ app: 'slovo115', version: VERSION, exported: new Date().toISOString(), data: DB }, null, 2);
    try {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `slovo115-progres-${today()}.json`;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
      toast('Файл прогресу збережено.', true);
    } catch (e) { showCopyFallback(json); }
  }
  function importData(file) {
    const fr = new FileReader();
    fr.onload = async () => {
      let obj;
      try { obj = JSON.parse(String(fr.result)); } catch (e) { toast('Файл не схожий на експорт СЛОВО 115.'); return; }
      const data = obj && obj.app === 'slovo115' ? obj.data : obj;
      if (!data || typeof data !== 'object' || !('t' in data)) { toast('У файлі немає даних прогресу.'); return; }
      const n = normalize(data);
      const cnt = Object.keys(n.t).filter(k => typeof n.t[k].s === 'number').length;
      if (!(await confirmBox('Імпортувати прогрес?', `У файлі: ${cnt} ${plural(cnt, 'опрацьована тема', 'опрацьовані теми', 'опрацьованих тем')}, ${n.h.length} ${plural(n.h.length, 'спроба', 'спроби', 'спроб')}. Поточний прогрес буде замінено.`, 'Імпортувати'))) return;
      DB = n;
      save(true);
      applyTheme();
      toast('Прогрес імпортовано.', true);
      route();
    };
    fr.onerror = () => toast('Не вдалося прочитати файл.');
    fr.readAsText(file);
  }
  function Settings(view) {
    appbar('Налаштування', { back: '#/', backLabel: 'Головна' });
    const integ = S.checkIntegrity ? S.checkIntegrity() : { ok: false, errors: ['Перевірка недоступна'], warnings: [] };
    const withContent = TOPICS.filter(t => t.c).length;
    const ids = new Set(TOPICS.map(t => t.id)).size;
    const voice = TTS.ok ? (TTS.pick() ? `знайдено: ${esc(TTS.voice.name)}` : 'не знайдено') : 'не підтримується браузером';
    const standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    view.innerHTML = `
      <h2 class="eyebrow" style="margin-top:8px">Оформлення</h2>
      <section class="card"><div class="seg" role="group" aria-label="Тема оформлення">${[['system', 'Системна'], ['light', 'Світла'], ['dark', 'Темна']].map(x => `<button data-theme="${x[0]}" aria-pressed="${DB.set.theme === x[0]}">${x[1]}</button>`).join('')}</div></section>
      <h2 class="eyebrow">Навчання</h2>
      <section class="card stack">
        <div><p class="small" style="margin:0 0 8px"><b>Щоденне навантаження</b></p><div class="seg" role="group" aria-label="Навантаження">${[10, 20, 30].map(m => `<button data-load="${m}" aria-pressed="${DB.set.load === m}">${m} хв</button>`).join('')}</div></div>
        <a class="btn btn-block" href="#/plan">${I.calendar}<span>План підготовки${DB.plan ? ' · ' + DB.plan.days + ' ' + plural(DB.plan.days, 'день', 'дні', 'днів') : ''}</span></a>
        <label class="row" style="min-height:44px;cursor:pointer"><span class="grow">Звукові сигнали таймера</span><input type="checkbox" id="snd" ${DB.set.sound ? 'checked' : ''} style="width:24px;height:24px;accent-color:var(--accent)"></label>
      </section>
      <h2 class="eyebrow">Озвучування</h2>
      <section class="card stack">
        <p class="small muted" style="margin:0">Український голос: ${voice}.</p>
        <div><p class="small" style="margin:0 0 8px"><b>Швидкість</b></p><div class="seg" role="group" aria-label="Швидкість озвучування">${[[0.85, 'Повільно'], [1, 'Звичайно'], [1.15, 'Швидше']].map(x => `<button data-rate="${x[0]}" aria-pressed="${Math.abs(DB.set.rate - x[0]) < 0.01}">${x[1]}</button>`).join('')}</div></div>
        <button class="btn btn-soft btn-block" id="tts-test">${I.play}<span>Перевірити голос</span></button>
      </section>
      <h2 class="eyebrow">Дані</h2>
      <section class="card stack">
        <p class="small muted" style="margin:0">Прогрес зберігається лише в цьому браузері. Щоб перенести його на інший пристрій, експортуйте файл і імпортуйте його там.</p>
        <div class="btn-row"><button class="btn" id="exp">${I.download}<span>Експорт JSON</span></button><label class="btn" for="imp" style="cursor:pointer">${I.upload}<span>Імпорт JSON</span></label></div>
        <input type="file" id="imp" accept="application/json,.json" class="sr">
        <button class="btn btn-danger btn-block" id="reset">${I.trash}<span>Скинути прогрес</span></button>
      </section>
      <h2 class="eyebrow">Перевірка даних</h2>
      <section class="card ${integ.ok ? 'ok' : 'warn'}">
        <p style="margin:0"><b>${integ.ok ? 'Усі перевірки пройдено' : 'Виявлено проблеми'}</b></p>
        <ul class="bullets small" style="margin-top:8px"><li>Тем у базі: ${TOPICS.length} (потрібно 115)</li><li>Унікальних ID: ${ids}</li><li>Повних навчальних комплектів: ${withContent} з ${TOPICS.length}</li><li>Категорій: ${CATS.length}</li></ul>
        ${integ.errors.length ? `<details style="margin-top:8px"><summary class="small">Деталі (${integ.errors.length})</summary><ul class="bullets tiny">${integ.errors.slice(0, 40).map(e => `<li>${esc(e)}</li>`).join('')}</ul></details>` : ''}
      </section>
      <h2 class="eyebrow">Про застосунок</h2>
      <section class="card stack small">
        <p style="margin:0"><b>СЛОВО 115</b> · версія ${VERSION}</p>
        <p class="muted" style="margin:0">Аналіз відповідей виконується на пристрої за прозорими правилами: обсяг, ключові слова плану, сполучні слова, повтори, різноманітність лексики та типові кальки. Застосунок не оцінює вимову, наголоси й інтонацію та не замінює екзаменатора.</p>
        <p class="muted" style="margin:0">Записи голосу й тексти відповідей нікуди не надсилаються. Кнопка «Скопіювати для перевірки в Claude» лише копіює текст у буфер обміну.</p>
        <p class="muted" style="margin:0">Формулювання тем і цитат подано так, як у переліку тем. Сумнівне авторство окремих висловів позначено в самих темах.</p>
        <p class="muted" style="margin:0">Офлайн-режим: ${esc(swState)}. ${standalone ? 'Застосунок запущено з головного екрана.' : 'На iPhone: Safari → «Поділитися» → «На початковий екран».'}</p>
      </section>`;
    $$('[data-theme]', view).forEach(b => b.addEventListener('click', () => { DB.set.theme = b.getAttribute('data-theme'); save(); applyTheme(); $$('[data-theme]', view).forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
    $$('[data-load]', view).forEach(b => b.addEventListener('click', () => { DB.set.load = +b.getAttribute('data-load'); save(); $$('[data-load]', view).forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
    $$('[data-rate]', view).forEach(b => b.addEventListener('click', () => { DB.set.rate = +b.getAttribute('data-rate'); save(); $$('[data-rate]', view).forEach(x => x.setAttribute('aria-pressed', String(x === b))); }));
    $('#snd', view).addEventListener('change', e => { DB.set.sound = e.target.checked; save(); if (e.target.checked) { Cue.unlock(); Cue.beep(1); } });
    $('#tts-test', view).addEventListener('click', () => { const r = TTS.speak('Твій голос. Твоя впевненість. Це приклад українського озвучування.'); if (r !== 'ok') voiceHelp(r); });
    $('#exp', view).addEventListener('click', exportData);
    $('#imp', view).addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) importData(f); e.target.value = ''; });
    $('#reset', view).addEventListener('click', async () => {
      if (!(await confirmBox('Скинути весь прогрес?', 'Буде видалено статуси тем, обране, історію, план і час навчання. Цю дію не можна скасувати. Радимо спершу зробити експорт.', 'Скинути', true))) return;
      const keep = DB.set;
      DB = blank();
      DB.set = keep;
      save(true);
      toast('Прогрес скинуто. Почнімо спочатку.');
      go('');
    });
  }

  /* ================= Офлайн-режим (Service Worker) ================= */
  let reloadOnUpdate = false;
  function offerUpdate(worker) {
    modal('<h2>Доступна нова версія</h2><p class="muted">Оновлення вже завантажено. Ваш прогрес збережеться.</p><div class="actions"><button class="btn btn-primary btn-block" data-ok>Оновити зараз</button><button class="btn btn-block" data-close>Пізніше</button></div>', (m, close) => {
      $('[data-ok]', m).addEventListener('click', () => { close(); reloadOnUpdate = true; worker.postMessage({ type: 'SKIP_WAITING' }); });
    });
  }
  function registerSW() {
    if (!('serviceWorker' in navigator) || location.protocol === 'file:') { swState = 'недоступний у цьому середовищі'; return; }
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloadOnUpdate) { reloadOnUpdate = false; location.reload(); } });
    const reg = () => navigator.serviceWorker.register('./service-worker.js').then(r => {
      swState = navigator.serviceWorker.controller ? 'увімкнено' : 'готується (після першого завантаження)';
      if (r.waiting && navigator.serviceWorker.controller) offerUpdate(r.waiting);
      r.addEventListener('updatefound', () => {
        const w = r.installing;
        if (w) w.addEventListener('statechange', () => {
          if (w.state === 'installed') { if (navigator.serviceWorker.controller) offerUpdate(w); else swState = 'увімкнено'; }
        });
      });
    }).catch(() => { swState = 'не вдалося ввімкнути'; });
    if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg);
  }

  /* ================= Запуск ================= */
  function init() {
    applyTheme();
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      try { mq.addEventListener('change', applyTheme); } catch (e) { try { mq.addListener(applyTheme); } catch (e2) { /* ignore */ } }
    }
    if (!S.integrity || !S.integrity.ok) { try { console.warn('СЛОВО 115: перевірка цілісності даних', S.integrity); } catch (e) { /* ignore */ } }
    navStack.push(location.hash);
    route();
    registerSW();
    window.SLOVO_APP = { version: VERSION, db: () => DB, stats, planInfo, analyze: Analysis.run, setStatus, today, queue, topicOfDay };
  }
  init();
})();
