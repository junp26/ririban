'use strict';

/* ==========================================================================
   日日办
   数据键：rrb-chores-v1（与日日新的 rrx-focus-v1 完全独立）
   ========================================================================== */

(function () {
  const STORAGE_KEY = 'rrb-chores-v1';
  const VERSION = 1;
  const RING_RADIUS = 158;
  const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
  const MIN_RECORD_SECONDS = 30;
  const SPLASH_MIN_MS = 850;

  const DEFAULT_CATEGORIES = [
    { id: 'home', name: '家务', color: '#4d7d61' },
    { id: 'work', name: '作业', color: '#4a6d8c' },
    { id: 'body', name: '身体', color: '#b8863b' },
    { id: 'misc', name: '杂事', color: '#8a7b68' },
    { id: 'shop', name: '采买', color: '#a8614f' },
  ];

  const SWATCHES = ['#4d7d61', '#4a6d8c', '#b8863b', '#8a7b68', '#a8614f', '#6f7f9a', '#8a6f8f', '#5f8a80'];

  const IDLE_HEADLINE = '不想找动力，先按开工。';
  const RUNNING_HEADLINE = '就这一件，办完再说。';
  const PAUSED_HEADLINE = '停一下也行，别放太久。';
  const OVERTIME_HEADLINE = '多做的，也都算数。';

  /* ---------- State ---------- */

  let state;
  let currentView = 'today';
  let idleQuote = '';
  let durationDraft = 5;
  let finishCtx = null;
  let finishDraft = { title: '', categoryId: 'misc' };
  let categoryDraft = { color: SWATCHES[0], editingId: null };
  let periodDate = startOfDay(new Date());
  let weekAnchor = startOfDay(new Date());
  let heatmapMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let selectedCategoryId = null;
  let bootAt = Date.now();
  let storageAvailable = true;
  let audioCtx = null;
  let deferredPrompt = null;
  let lastTitle = '';
  let viewStamp = 0;

  const els = {};
  const $id = (id) => document.getElementById(id);
  const qsa = (selector) => Array.from(document.querySelectorAll(selector));

  boot();

  function boot() {
    cacheEls();
    if (!els.todayView || !els.statsView) return;

    state = loadState();
    rebuildRecentCelebrations();
    bindEvents();
    restoreActiveOnBoot();
    normalizeScheduleOnBoot();

    idleQuote = pickQuote('before');
    renderAll();
    syncSettingsUI();
    updateGreeting();
    updateTitle();
    updateInstallUI();
    registerServiceWorker();

    window.setInterval(tick, 250);
    window.setInterval(() => {
      if (!state.active) {
        updateGreeting();
        normalizeScheduleOnBoot();
        renderSchedule();
      }
    }, 60000);

    setupSplash();

    if (!storageAvailable) {
      window.setTimeout(() => toast('浏览器限制了本地保存，记录可能在关闭后丢失。'), 1200);
    }
  }

  function cacheEls() {
    [
      'todayView', 'statsView', 'settingsBtn',
      'greeting', 'todayHeadline', 'checkinCard', 'checkinHint', 'checkinBtn',
      'workCard', 'workMode', 'workModeLabel', 'durationControl', 'durationControlValue',
      'progressRing', 'clockDisplay', 'clockCaption',
      'idleActions', 'startBtn', 'scheduleBtn', 'runningActions', 'pauseBtn', 'pauseBtnLabel', 'endBtn',
      'workQuote', 'workQuoteText', 'workQuoteTag', 'workQuoteNext', 'idleNote',
      'scheduleStrip', 'scheduleTitle', 'scheduleMeta', 'scheduleStartBtn', 'cancelScheduleBtn',
      'todayDone', 'todayStarts', 'todayMinutes',
      'metricTotal', 'metricStarts', 'metricMinutes', 'metricStreak',
      'metricTotalHint', 'metricMinutesHint', 'metricStreakHint',
      'periodTitle', 'periodRange', 'periodPrevBtn', 'periodNextBtn', 'periodDateInput', 'periodTodayBtn',
      'distributionChart', 'distributionSummary', 'distributionBackBtn', 'distributionListTitle',
      'distributionRange', 'distributionTotal', 'categoryList',
      'distributionEmpty', 'distributionInsight',
      'weekSubtitle', 'weekPrevBtn', 'weekNextBtn', 'weekLabel', 'weekDateInput', 'weekTodayBtn', 'weekChart',
      'heatmapMonthLabel', 'heatmapPrevBtn', 'heatmapNextBtn', 'heatmapDateInput', 'monthGrid', 'heatmapFoot',
      'exportBtn', 'exportBtnSettings', 'clearDataBtn',
      'settingsDialog', 'overtimeToggle',
      'manageCategoriesBtn', 'categorySummary', 'soundToggle', 'celebrationToggle', 'celebrationCount',
      'celebrationPreviewBtn', 'notifyToggle', 'notificationHint', 'installAppBtn', 'installHint',
      'durationDialog', 'durationForm', 'customMinutes', 'customMinus', 'customPlus', 'durationError',
      'scheduleDialog', 'scheduleForm',
      'scheduleCustomMinutes', 'scheduleTime', 'scheduleError',
      'finishDialog', 'finishEyebrow', 'finishDuration', 'finishTaskTitle',
      'finishTitleInput', 'finishCategoryChips', 'finishNote', 'finishDoneBtn', 'finishPartialBtn', 'finishDiscardBtn',
      'categoryDialog', 'categoryManageList', 'categoryForm', 'categoryNameInput', 'categorySubmitBtn',
      'categoryColorSwatches', 'categoryCancelEdit', 'categoryFormLabel', 'categoryError',
      'celebrationDialog', 'celebrationSky', 'celebrationKicker', 'celebrationGroup', 'celebrationText',
      'celebrationCue', 'celebrationMedallion', 'celebrationDoneBtn', 'celebrationAnotherBtn', 'celebrationSkipBtn',
      'confirmDialog', 'confirmTitle', 'confirmMessage', 'confirmOk', 'confirmCancel',
      'checkinReveal', 'checkinRevealText', 'checkinRevealMeta', 'checkinRevealSparks', 'checkinRevealClose',
      'toastHost', 'splash',
    ].forEach((id) => {
      els[id] = $id(id);
    });

    els.navItems = qsa('.nav-item');
    els.durationPresetButtons = qsa('#durationPresetGrid button');
    els.scheduleDayButtons = qsa('#scheduleDayPicker button');
    els.scheduleDurationButtons = qsa('#scheduleDurationPicker button');
    els.defaultMinuteButtons = qsa('#defaultMinutesPicker button');
    els.checkinMarkUse = document.querySelector('#checkinReveal .checkin-reveal-mark use');
    els.medallionUse = document.querySelector('#celebrationMedallion use');
    els.pauseIconUse = document.querySelector('#pauseBtn use');
  }

  /* ---------- Storage ---------- */

  function freshState() {
    return {
      v: VERSION,
      records: [],
      categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
      checkins: {},
      schedule: null,
      celebrationHistory: [],
      settings: {
        defaultMinutes: 5,
        sound: true,
        celebrate: true,
        notify: false,
        autoOvertime: false,
        lastCategoryId: 'misc',
      },
      active: null,
      meta: { createdAt: Date.now() },
    };
  }

  function loadState() {
    let raw = null;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      storageAvailable = false;
      return freshState();
    }
    if (!raw) return freshState();
    try {
      return normalizeState(JSON.parse(raw));
    } catch (error) {
      return freshState();
    }
  }

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      storageAvailable = false;
    }
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== 'object') return freshState();
    const base = freshState();
    const next = { ...base, ...raw };
    next.records = Array.isArray(raw.records)
      ? raw.records
          .filter((r) => r && r.id && typeof r.seconds === 'number')
          .map((r) => ({
            id: String(r.id),
            title: String(r.title || '一件小事').slice(0, 40),
            categoryId: r.categoryId ? String(r.categoryId) : 'misc',
            seconds: Math.max(0, Math.round(r.seconds)),
            day: r.day || dateKey(new Date(r.endedAt || Date.now())),
            startedAt: Number(r.startedAt) || Number(r.endedAt) || Date.now(),
            endedAt: Number(r.endedAt) || Date.now(),
            completed: Boolean(r.completed),
            source: r.source === 'tick' ? 'tick' : 'timer',
          }))
      : [];
    next.categories = Array.isArray(raw.categories) && raw.categories.length
      ? raw.categories
          .filter((c) => c && c.id && c.name)
          .map((c) => ({ id: String(c.id), name: String(c.name).slice(0, 12), color: c.color || SWATCHES[0] }))
      : base.categories;
    next.checkins = raw.checkins && typeof raw.checkins === 'object' ? raw.checkins : {};
    next.celebrationHistory = Array.isArray(raw.celebrationHistory) ? raw.celebrationHistory.slice(-12) : [];
    next.settings = { ...base.settings, ...(raw.settings || {}) };
    next.settings.defaultMinutes = clamp(Number(next.settings.defaultMinutes) || 5, 1, 180);
    next.active = raw.active ? normalizeActive(raw.active) : null;
    next.schedule = raw.schedule && Number(raw.schedule.at) ? {
      at: Number(raw.schedule.at),
      minutes: clamp(Number(raw.schedule.minutes) || 5, 1, 180),
      label: String(raw.schedule.label || ''),
      missed: Boolean(raw.schedule.missed),
    } : null;
    // 旧版本存过今日清单的数据，这里直接丢掉，省得占空间
    delete next.tasks;
    return next;
  }

  function normalizeActive(raw) {
    const plannedSeconds = clamp(Number(raw.plannedSeconds) || 300, 60, 180 * 60);
    const spans = Array.isArray(raw.spans)
      ? raw.spans.filter((s) => s && Number.isFinite(s.start) && Number.isFinite(s.end)).slice(-40)
      : [];
    return {
      mode: 'work',
      status: raw.status === 'paused' ? 'paused' : 'running',
      plannedSeconds,
      spans: spans.map((s) => ({ start: Number(s.start), end: Math.max(Number(s.start), Number(s.end)) })),
      currentSpanStart: raw.status === 'running' ? Number(raw.currentSpanStart) || Date.now() : null,
      startedAt: Number(raw.startedAt) || Date.now(),
      source: raw.source === 'scheduled' ? 'scheduled' : 'now',
      overtime: Boolean(raw.overtime),
    };
  }

  /* ---------- Date helpers ---------- */

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function dateKey(value) {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function todayKey() {
    return dateKey(new Date());
  }

  function parseKey(key) {
    const [year, month, day] = String(key).split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function addDays(value, amount) {
    const date = new Date(value);
    date.setDate(date.getDate() + amount);
    return date;
  }

  function monthDayLabel(key) {
    const date = parseKey(key);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function weekdayCN(date) {
    return ['日', '一', '二', '三', '四', '五', '六'][new Date(date).getDay()];
  }

  function formatClock(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    return `${pad2(minutes)}:${pad2(seconds % 60)}`;
  }

  function formatCN(seconds) {
    const total = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    if (minutes <= 0) return `${rest} 秒`;
    if (rest === 0) return `${minutes} 分钟`;
    return `${minutes} 分 ${rest} 秒`;
  }

  function formatHHMM(timestamp) {
    const date = new Date(timestamp);
    return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  }

  function formatDurationShort(seconds) {
    const total = Math.max(0, Math.round(seconds));
    if (total < 60) return `${total} 秒`;
    return `${Math.round(total / 60)} 分钟`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  /* ---------- Categories ---------- */

  function categoryOf(id) {
    return state.categories.find((c) => c.id === id) || null;
  }

  function categoryName(id) {
    const cat = categoryOf(id);
    return cat ? cat.name : '未分类';
  }

  function categoryColor(id) {
    const cat = categoryOf(id);
    return cat ? cat.color : '#a6aa9e';
  }

  function addRecord({ title, categoryId, seconds, startedAt, endedAt, completed, source }) {
    const end = endedAt || Date.now();
    const record = {
      id: uid(),
      title: String(title || '一件小事').slice(0, 40),
      categoryId: categoryId || 'misc',
      seconds: Math.max(0, Math.round(seconds || 0)),
      day: dateKey(new Date(end)),
      startedAt: startedAt || end,
      endedAt: end,
      completed: Boolean(completed),
      source: source || 'timer',
    };
    state.records.push(record);
    state.settings.lastCategoryId = record.categoryId;
    save();
    return record;
  }

  function recordsOn(key) {
    return state.records
      .filter((r) => r.day === key)
      .sort((a, b) => a.endedAt - b.endedAt);
  }

  function completedRecords(key) {
    return recordsOn(key).filter((r) => r.completed);
  }

  function dayStreak() {
    const days = new Set(state.records.filter((r) => r.completed).map((r) => r.day));
    let cursor = startOfDay(new Date());
    if (!days.has(dateKey(cursor))) cursor = addDays(cursor, -1);
    let streak = 0;
    while (days.has(dateKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  function checkinStreak() {
    const keys = new Set(Object.keys(state.checkins));
    let cursor = startOfDay(new Date());
    if (!keys.has(dateKey(cursor))) cursor = addDays(cursor, -1);
    let streak = 0;
    while (keys.has(dateKey(cursor))) {
      streak += 1;
      cursor = addDays(cursor, -1);
    }
    return streak;
  }

  /* ---------- Quotes ---------- */

  function pickQuote(group) {
    const source = (window.RRB_QUOTES && window.RRB_QUOTES[group]) || [];
    if (!source.length) return '';
    const pool = source.filter((q) => q !== idleQuote);
    const list = pool.length ? pool : source;
    return list[Math.floor(Math.random() * list.length)];
  }

  function quoteGroupForActive() {
    if (!state.active) return 'before';
    if (state.active.status === 'paused') return 'paused';
    return 'during';
  }

  function renderQuote() {
    const active = state.active;
    const group = quoteGroupForActive();
    const tagMap = { before: '开工前', during: '开工中', paused: '卡住时' };
    if (!active) {
      if (!idleQuote) idleQuote = pickQuote('before');
      els.workQuoteText.textContent = idleQuote;
      els.workQuoteTag.textContent = tagMap.before;
      els.workQuote.hidden = false;
      return;
    }
    if (!active.quoteText || active.quoteGroup !== group) {
      active.quoteText = pickQuote(group);
      active.quoteGroup = group;
      save();
    }
    els.workQuoteText.textContent = active.quoteText;
    els.workQuoteTag.textContent = tagMap[group];
    els.workQuote.hidden = false;
  }

  /* ---------- Timer maths ---------- */

  function totalSpanSeconds(spans) {
    return (spans || []).reduce((total, span) => total + Math.max(0, span.end - span.start) / 1000, 0);
  }

  function getElapsedSeconds(active = state.active, at = Date.now()) {
    if (!active) return 0;
    let ms = 0;
    for (const span of active.spans || []) ms += Math.max(0, span.end - span.start);
    if (active.status === 'running' && active.currentSpanStart != null) {
      ms += Math.max(0, at - active.currentSpanStart);
    }
    return ms / 1000;
  }

  function closeCurrentSpan(active, at) {
    if (!active || active.currentSpanStart == null) return;
    const start = Number(active.currentSpanStart);
    const end = Math.max(start, at);
    if (end > start) active.spans.push({ start, end });
    active.currentSpanStart = null;
  }

  /* ---------- Timer actions ---------- */

  function startWork(minutes, source) {
    if (state.active) return;
    const planned = clamp(Math.round(Number(minutes) || 5), 1, 180) * 60;
    state.active = {
      mode: 'work',
      status: 'running',
      plannedSeconds: planned,
      spans: [],
      currentSpanStart: Date.now(),
      startedAt: Date.now(),
      source: source || 'now',
      overtime: false,
      quoteText: '',
      quoteGroup: '',
    };
    ensureAudio();
    save();
    renderAll();
    toast('开工。几分钟都算。');
  }

  function togglePause() {
    const active = state.active;
    if (!active) return;
    if (active.status === 'running') {
      closeCurrentSpan(active, Date.now());
      active.status = 'paused';
    } else {
      active.status = 'running';
      active.currentSpanStart = Date.now();
    }
    save();
    renderWork();
    updateTitle();
  }

  function requestEnd() {
    const active = state.active;
    if (!active) return;
    const seconds = Math.round(getElapsedSeconds(active));
    if (active.status === 'running') {
      closeCurrentSpan(active, Date.now());
      active.status = 'paused';
      save();
    }
    if (seconds < MIN_RECORD_SECONDS) {
      confirmAction({
        title: '不到半分钟',
        message: '这么短就不记账了，直接结束这一轮？',
        okLabel: '结束',
      }).then((ok) => {
        if (ok) {
          state.active = null;
          save();
          renderAll();
          toast('这次不记账。');
        } else {
          resumeAfterFinishCancel();
        }
      });
      return;
    }
    openFinishDialog(seconds);
  }

  function openFinishDialog(seconds) {
    const active = state.active;
    if (!active) return;
    finishCtx = {
      seconds,
      startedAt: active.startedAt,
      source: active.source,
    };
    finishDraft = {
      title: '随手办的一件小事',
      categoryId: state.settings.lastCategoryId || 'misc',
      categoryTouched: false,
    };

    els.finishDuration.textContent = formatClock(seconds);
    els.finishTaskTitle.textContent = '这一轮是随手办的';
    els.finishTitleInput.value = finishDraft.title;
    els.finishNote.textContent = '写一句就好，以后翻记录能想起来。';
    renderFinishCategories();
    els.finishEyebrow.textContent = seconds >= active.plannedSeconds ? '到点了' : '收工';
    openDialog(els.finishDialog);
  }

  function updateFinishNote() {
    if (!els.finishNote) return;
    els.finishNote.textContent = '写一句就好，以后翻记录能想起来。';
  }

  function renderFinishCategories() {
    els.finishCategoryChips.innerHTML = state.categories
      .map((cat) => `
        <button class="category-chip${cat.id === finishDraft.categoryId ? ' is-selected' : ''}" type="button" data-category="${esc(cat.id)}">
          <i class="category-dot" style="background:${esc(cat.color)}"></i>${esc(cat.name)}
        </button>`)
      .join('');
  }

  function commitFinish(completed) {
    if (!finishCtx) return;
    const ctx = finishCtx;
    finishCtx = null;
    const active = state.active;
    const inputTitle = els.finishTitleInput.value.trim();
    const title = inputTitle || '随手办的一件小事';
    const categoryId = finishDraft.categoryId || 'misc';

    state.active = null;
    addRecord({
      title,
      categoryId,
      seconds: ctx.seconds,
      startedAt: ctx.startedAt,
      endedAt: Date.now(),
      completed,
      source: 'timer',
    });
    save();
    if (els.finishDialog.open) els.finishDialog.close();
    renderAll();
    playChime();
    notify(completed ? '办完了一件' : '这一轮先这样', `${title} · ${formatDurationShort(ctx.seconds)}`);
    if (completed && state.settings.celebrate) {
      window.setTimeout(() => openCelebration({ seconds: ctx.seconds }), 260);
    } else if (completed) {
      toast('记下了。');
    } else {
      toast('记下了，还差一点也没关系。');
    }
  }

  function discardFinish() {
    if (!finishCtx) return;
    finishCtx = null;
    state.active = null;
    save();
    if (els.finishDialog.open) els.finishDialog.close();
    renderAll();
    toast('这次不记账。');
  }

  function resumeAfterFinishCancel() {
    finishCtx = null;
    const active = state.active;
    if (active && active.status === 'paused') {
      active.status = 'running';
      active.currentSpanStart = Date.now();
      save();
      renderWork();
      updateTitle();
    }
  }

  function completeActive({ auto }) {
    const active = state.active;
    if (!active) return;
    const seconds = Math.round(getElapsedSeconds(active));
    if (active.status === 'running') {
      closeCurrentSpan(active, Date.now());
    }
    state.active = null;
    if (seconds < MIN_RECORD_SECONDS) {
      save();
      renderAll();
      return;
    }
    addRecord({
      title: '随手办的一件小事',
      categoryId: state.settings.lastCategoryId || 'misc',
      seconds,
      startedAt: active.startedAt,
      endedAt: Date.now(),
      completed: true,
      source: 'timer',
    });
    save();
    renderAll();
    playChime();
    notify('这一轮办完了', `一件小事 · ${formatDurationShort(seconds)}`);
    if (state.settings.celebrate) {
      openCelebration({ seconds });
    } else {
      toast('办完了。');
    }
  }

  function restoreActiveOnBoot() {
    const active = state.active;
    if (!active || active.status !== 'running') return;
    const elapsed = getElapsedSeconds(active);
    if (active.overtime || elapsed < active.plannedSeconds) return;

    // 页面关着的时候到点了：按计划时长结算，不虚增分钟数
    const beforeCurrent = totalSpanSeconds(active.spans);
    const needed = Math.max(0, active.plannedSeconds - beforeCurrent);
    active.spans.push({ start: active.currentSpanStart, end: active.currentSpanStart + needed * 1000 });
    active.currentSpanStart = null;
    active.status = 'paused';
    completeActive({ auto: true });
  }

  /* ---------- Schedule ---------- */

  function normalizeScheduleOnBoot() {
    const schedule = state.schedule;
    if (!schedule) return;
    if (Date.now() - schedule.at > 12 * 3600 * 1000) {
      state.schedule = null;
      save();
      return;
    }
    if (schedule.at < bootAt - 3000 && !schedule.missed) {
      schedule.missed = true;
      save();
    }
  }

  function scheduleLabel(at) {
    const date = new Date(at);
    const today = todayKey();
    const key = dateKey(date);
    const prefix = key === today ? '今天' : key === dateKey(addDays(new Date(), 1)) ? '明天' : monthDayLabel(key);
    return `${prefix} ${formatHHMM(at)}`;
  }

  function checkSchedule() {
    const schedule = state.schedule;
    if (!schedule || schedule.missed) return;
    if (Date.now() < schedule.at) return;
    state.schedule = null;
    save();
    if (!state.active) {
      startWork(schedule.minutes, 'scheduled');
      toast('到点了，开工。');
      notify('预约到点了', '该办那件小事了');
    } else {
      renderAll();
      toast('预约到点了，但你还在办上一轮。');
    }
  }

  /* ---------- Check-in ---------- */

  function hasCheckedInToday() {
    return Boolean(state.checkins[todayKey()]);
  }

  function doCheckin() {
    const today = todayKey();
    if (state.checkins[today]) return;
    const text = pickQuote('daily');
    state.checkins[today] = { at: Date.now(), text };
    save();
    renderCheckin();
    showCheckinReveal(text);
  }

  function showCheckinReveal(text) {
    const streak = checkinStreak();
    els.checkinRevealText.textContent = text;
    els.checkinRevealMeta.textContent = streak > 1 ? `连续 ${streak} 天开张` : '今天开张了';
    els.checkinReveal.hidden = false;
    document.body.classList.add('is-checkin-reveal');
    els.checkinRevealSparks.innerHTML = '';
    for (let i = 0; i < 14; i += 1) {
      const spark = document.createElement('span');
      spark.className = 'spark';
      spark.style.left = `${12 + Math.random() * 76}%`;
      spark.style.top = `${32 + Math.random() * 36}%`;
      spark.style.animationDelay = `${Math.random() * 0.5}s`;
      spark.style.opacity = '0';
      spark.style.background = i % 3 === 0 ? '#2f5f49' : '#d2a04a';
      els.checkinRevealSparks.appendChild(spark);
    }
  }

  function hideCheckinReveal() {
    els.checkinReveal.hidden = true;
    document.body.classList.remove('is-checkin-reveal');
    els.checkinRevealSparks.innerHTML = '';
  }

  /* ---------- Celebration ---------- */

  function rebuildRecentCelebrations() {
    state.celebrationHistory = Array.isArray(state.celebrationHistory) ? state.celebrationHistory.slice(-8) : [];
  }

  function pickCelebration() {
    const list = (window.RRB_CELEBRATIONS || []).slice();
    if (!list.length) return null;
    const recent = state.celebrationHistory || [];
    const pool = list.filter((item) => !recent.includes(item.id));
    const source = pool.length ? pool : list;
    const item = source[Math.floor(Math.random() * source.length)];
    state.celebrationHistory = recent.concat(item.id).slice(-8);
    save();
    return item;
  }

  function openCelebration({ seconds, preview }) {
    const item = pickCelebration();
    if (!item) return;
    renderCelebration(item, { seconds, preview });
    openDialog(els.celebrationDialog);
    spawnCelebrationSparks();
  }

  function renderCelebration(item, { seconds, preview }) {
    const group = (window.RRB_CELEBRATION_GROUPS || {})[item.group] || {};
    els.celebrationKicker.textContent = preview
      ? '预览 · 随便抽一个'
      : `一件小事 · ${formatDurationShort(seconds || 0)}`;
    els.celebrationGroup.textContent = `${item.group} · ${group.label || '庆祝'}`;
    els.celebrationText.textContent = item.text;
    els.celebrationCue.textContent = group.cue || '做出来，或只在心里做。';
    if (els.medallionUse && group.icon) els.medallionUse.setAttribute('href', group.icon);
    if (els.celebrationMedallion) {
      els.celebrationMedallion.style.background = `linear-gradient(150deg, ${group.from || '#d8b273'}, ${group.to || '#b8863b'})`;
      els.celebrationMedallion.style.boxShadow = `0 18px 34px -20px ${group.tint || 'rgba(184,134,59,.9)'}`;
    }
  }

  function spawnCelebrationSparks() {
    if (!els.celebrationSky) return;
    els.celebrationSky.innerHTML = '';
    for (let i = 0; i < 18; i += 1) {
      const spark = document.createElement('span');
      spark.className = 'spark';
      spark.style.left = `${8 + Math.random() * 84}%`;
      spark.style.top = `${58 + Math.random() * 34}%`;
      spark.style.animationDelay = `${Math.random() * 0.9}s`;
      spark.style.background = i % 4 === 0 ? '#2f5f49' : '#d2a04a';
      els.celebrationSky.appendChild(spark);
    }
  }

  /* ---------- Rendering: today ---------- */

  function renderAll() {
    viewStamp += 1;
    renderToday();
    renderWork();
    renderCheckin();
    renderSchedule();
    if (currentView === 'stats') renderStats();
    syncSettingsUI();
    updateTitle();
  }

  function renderToday() {
    const today = todayKey();
    const done = completedRecords(today);

    els.todayDone.textContent = String(done.length);
    els.todayStarts.textContent = String(state.records.filter((r) => r.day === today && r.source === 'timer').length);
    els.todayMinutes.textContent = String(Math.round(state.records.filter((r) => r.day === today).reduce((sum, r) => sum + r.seconds, 0) / 60));

    updateGreeting();
    renderQuote();
  }

  function updateGreeting() {
    const hour = new Date().getHours();
    let salutation = '晚上好';
    if (hour >= 5 && hour < 11) salutation = '早上好';
    else if (hour >= 11 && hour < 14) salutation = '中午好';
    else if (hour >= 14 && hour < 18) salutation = '下午好';
    else if (hour >= 23 || hour < 5) salutation = '夜深了';

    const done = completedRecords(todayKey()).length;
    let tail = '今天还没开工';
    if (done > 0) tail = `今天办了 ${done} 件`;

    els.greeting.textContent = `${salutation} · ${tail}`;
  }

  function renderCheckin() {
    const show = !hasCheckedInToday() && !state.active;
    els.checkinCard.hidden = !show;
    if (hasCheckedInToday()) {
      const streak = checkinStreak();
      els.checkinHint.textContent = streak > 1 ? `连续 ${streak} 天开张，今天已经开过张了。` : '今天开过张了，去办一件吧。';
    } else {
      els.checkinHint.textContent = '先给自己一句话，再动手。';
    }
  }

  function renderWork() {
    const active = state.active;
    const isActive = Boolean(active);
    const isPaused = Boolean(active && active.status === 'paused');
    const isOvertime = Boolean(active && active.overtime);

    els.workCard.classList.toggle('is-running', Boolean(active && active.status === 'running'));
    els.workCard.classList.toggle('is-paused', isPaused);
    els.workCard.classList.toggle('is-overtime', isOvertime);
    els.clockDisplay.classList.toggle('is-overtime', isOvertime);

    els.durationControl.hidden = isActive;
    els.idleActions.hidden = isActive;
    els.runningActions.hidden = !isActive;
    els.idleNote.hidden = isActive;

    if (!active) {
      els.workModeLabel.textContent = '准备开工';
      els.clockCaption.textContent = '不想找动力，先按开工';
      els.todayHeadline.textContent = IDLE_HEADLINE;
      els.pauseBtnLabel.textContent = '暂停';
      if (els.pauseIconUse) els.pauseIconUse.setAttribute('href', '#i-pause');
      syncDurationControl();
      updateTimerDisplay();
      renderQuote();
      return;
    }

    if (isOvertime) {
      els.workModeLabel.textContent = isPaused ? '正计时暂停' : '正计时中';
      els.clockCaption.textContent = isPaused ? '加时暂停了，准备好再继续' : '计划到了，继续也算';
      els.todayHeadline.textContent = OVERTIME_HEADLINE;
      els.workMode.classList.add('is-gold');
    } else if (isPaused) {
      els.workModeLabel.textContent = '已暂停';
      els.clockCaption.textContent = '停一下没关系，别放太久';
      els.todayHeadline.textContent = PAUSED_HEADLINE;
      els.workMode.classList.remove('is-gold');
    } else {
      els.workModeLabel.textContent = active.source === 'scheduled' ? '预约开工中' : '开工中';
      els.clockCaption.textContent = '随手办一件，办完再说';
      els.todayHeadline.textContent = RUNNING_HEADLINE;
      els.workMode.classList.remove('is-gold');
    }

    els.pauseBtnLabel.textContent = isPaused ? '继续' : '暂停';
    if (els.pauseIconUse) els.pauseIconUse.setAttribute('href', isPaused ? '#i-play' : '#i-pause');
    updateTimerDisplay();
    renderQuote();
  }

  function syncDurationControl() {
    const minutes = state.settings.defaultMinutes;
    els.durationControlValue.textContent = String(minutes);
    els.durationControl.setAttribute('aria-label', `选择开工时长，当前 ${minutes} 分钟`);
  }

  function updateTimerDisplay() {
    const active = state.active;
    const planned = active ? active.plannedSeconds : state.settings.defaultMinutes * 60;
    const elapsed = active ? getElapsedSeconds(active) : 0;
    const isOvertime = Boolean(active && active.overtime);
    let clockText;
    let fraction;

    if (isOvertime) {
      const overtimeSeconds = Math.max(0, elapsed - planned);
      clockText = `+${formatClock(overtimeSeconds)}`;
      fraction = 1;
      els.clockDisplay.setAttribute('aria-label', `已加时 ${formatCN(overtimeSeconds)}`);
    } else {
      const remaining = active ? Math.max(0, planned - elapsed) : planned;
      fraction = planned > 0 ? clamp(remaining / planned, 0, 1) : 1;
      clockText = formatClock(remaining);
      els.clockDisplay.setAttribute('aria-label', active ? `剩余 ${formatCN(remaining)}` : `${Math.round(planned / 60)} 分钟`);
    }

    if (els.clockDisplay.textContent !== clockText) els.clockDisplay.textContent = clockText;
    els.progressRing.style.strokeDashoffset = (RING_CIRCUMFERENCE * (1 - fraction)).toFixed(2);
  }

  function renderSchedule() {
    const schedule = state.schedule;
    els.scheduleStrip.hidden = !schedule;
    if (!schedule) return;
    els.scheduleTitle.textContent = schedule.missed ? '约好的时间已经过了' : '已预约';
    els.scheduleMeta.textContent = `${schedule.label || scheduleLabel(schedule.at)} · ${schedule.minutes} 分钟`;
    els.scheduleStartBtn.hidden = !schedule.missed;
  }

  function updateTitle() {
    const active = state.active;
    let title;
    if (active) {
      const label = active.overtime ? '正计时' : active.status === 'paused' ? '已暂停' : '开工中';
      const base = active.overtime
        ? `+${formatClock(Math.max(0, getElapsedSeconds(active) - active.plannedSeconds))}`
        : formatClock(Math.max(0, active.plannedSeconds - getElapsedSeconds(active)));
      title = `${base} · ${label} | 日日办`;
    } else if (currentView === 'stats') {
      title = '办事统计 · 日日办';
    } else {
      title = '日日办';
    }
    if (title !== lastTitle) {
      document.title = title;
      lastTitle = title;
    }
  }

  function tick() {
    if (!state.active) {
      checkSchedule();
      return;
    }
    const active = state.active;
    if (active.status === 'running' && !active.overtime) {
      if (getElapsedSeconds(active) >= active.plannedSeconds) {
        if (state.settings.autoOvertime) {
          active.overtime = true;
          save();
          renderWork();
          toast('到点了，继续也算。');
        } else {
          completeActive({ auto: true });
          return;
        }
      }
    }
    updateTimerDisplay();
    updateTitle();
    if (active.source === 'scheduled') checkSchedule();
  }

  /* ---------- 统计 ---------- */

  function startOfWeek(value) {
    const date = startOfDay(value);
    const offset = (date.getDay() + 6) % 7;
    return addDays(date, -offset);
  }

  function renderStats() {
    renderMetrics();
    renderDaily();
    renderWeek();
    renderMonth();
  }

  function renderMetrics() {
    const records = state.records;
    const totalCompleted = records.filter((r) => r.completed).length;
    const starts = records.filter((r) => r.source === 'timer').length;
    const seconds = records.reduce((sum, r) => sum + r.seconds, 0);
    const days = new Set(records.map((r) => r.day)).size;
    const minutes = Math.round(seconds / 60);

    els.metricTotal.textContent = String(totalCompleted);
    els.metricStarts.textContent = String(starts);
    els.metricMinutes.textContent = String(minutes);
    els.metricStreak.textContent = String(dayStreak());

    els.metricTotalHint.textContent = days ? `分布在 ${days} 天里` : '从第一件小事开始';
    els.metricMinutesHint.textContent = starts
      ? `平均每次 ${Math.max(1, Math.round(seconds / 60 / starts))} 分钟`
      : '每一分钟都是真动手';
    const todayDone = completedRecords(todayKey()).length;
    els.metricStreakHint.textContent = todayDone ? `今天已办 ${todayDone} 件` : '今天还没开张';
  }

  function renderDaily() {
    const key = dateKey(periodDate);
    const today = todayKey();
    const isToday = key === today;
    const yesterday = dateKey(addDays(new Date(), -1));
    const date = parseKey(key);

    els.periodTitle.textContent = isToday ? '今天' : key === yesterday ? '昨天' : `${date.getMonth() + 1}月${date.getDate()}日`;
    els.periodRange.textContent = `${monthDayLabel(key)} · 周${weekdayCN(date)}`;
    els.periodDateInput.value = key;
    els.periodDateInput.max = today;
    els.periodNextBtn.disabled = isToday;
    els.periodTodayBtn.hidden = isToday;

    const records = recordsOn(key);
    const done = records.filter((r) => r.completed);
    const seconds = records.reduce((sum, r) => sum + r.seconds, 0);
    const minutes = Math.round(seconds / 60);

    const groups = new Map();
    records.forEach((record) => {
      const entry = groups.get(record.categoryId) || {
        id: record.categoryId,
        name: categoryName(record.categoryId),
        color: categoryColor(record.categoryId),
        count: 0,
        seconds: 0,
      };
      entry.count += 1;
      entry.seconds += record.seconds;
      groups.set(record.categoryId, entry);
    });
    const list = Array.from(groups.values()).sort((a, b) => b.count - a.count || b.seconds - a.seconds);

    drawDonut(list, records.length);
    els.distributionSummary.textContent = records.length
      ? `共 ${records.length} 次 · 办完 ${done.length} 件 · ${minutes} 分钟`
      : '共 0 次';

    els.distributionEmpty.hidden = records.length > 0;
    els.distributionInsight.textContent = records.length
      ? buildInsight({ list, records, done, minutes })
      : '';

    if (selectedCategoryId && !list.some((item) => item.id === selectedCategoryId)) {
      selectedCategoryId = null;
    }

    if (selectedCategoryId) {
      const group = list.find((item) => item.id === selectedCategoryId);
      const items = records.filter((record) => record.categoryId === selectedCategoryId);
      els.distributionBackBtn.hidden = false;
      els.distributionListTitle.textContent = group ? group.name : '未分类';
      els.distributionRange.textContent = `${monthDayLabel(key)} · ${items.length} 次`;
      els.distributionTotal.textContent = `${Math.round((group ? group.seconds : 0) / 60)} 分钟`;
      els.categoryList.innerHTML = items
        .map((record) => `
          <div class="record-row${record.completed ? '' : ' is-partial'}">
            <span class="record-time">${formatHHMM(record.endedAt)}</span>
            <span class="record-title">${esc(record.title)}</span>
            <span class="record-mins">${record.source === 'tick' ? '勾掉' : record.completed ? formatDurationShort(record.seconds) : '还差一点 · ' + formatDurationShort(record.seconds)}</span>
          </div>`)
        .join('');
      return;
    }

    els.distributionBackBtn.hidden = true;
    els.distributionListTitle.textContent = '全部分类';
    els.distributionRange.textContent = `${monthDayLabel(key)} · ${done.length} 件办完`;
    els.distributionTotal.textContent = `${minutes} 分钟`;
    els.categoryList.innerHTML = list
      .map((item) => `
        <button class="category-row" type="button" data-category="${esc(item.id)}">
          <span class="category-dot" style="background:${esc(item.color)}"></span>
          <span class="category-name">${esc(item.name)}</span>
          <span class="category-value">${item.count} 次</span>
          <span class="category-sub">${Math.round(item.seconds / 60)} 分</span>
        </button>`)
      .join('');
    if (!list.length) {
      els.categoryList.innerHTML = '';
    }
  }

  function buildInsight({ list, records, done, minutes }) {
    const top = list[0];
    const parts = [];
    if (records.length) {
      parts.push(`这一天动手 ${minutes} 分钟，办完 ${done.length} 件`);
    }
    if (top && records.length > 1) {
      const pct = Math.round((top.count / records.length) * 100);
      parts.push(`${top.name}占了 ${pct}%`);
    }
    const ticks = records.filter((r) => r.source === 'tick').length;
    if (ticks && ticks === records.length) {
      parts.push('都是直接勾掉的，干脆');
    } else if (records.some((r) => !r.completed)) {
      parts.push('有一轮还差一点，记下来也算数');
    }
    return parts.join('，') + '。';
  }

  function drawDonut(list, total) {
    const chart = els.distributionChart;
    if (!total) {
      chart.style.background = 'transparent';
      chart.innerHTML = '<div class="donut-center"><strong>0</strong><span>次</span></div>';
      return;
    }
    let cursor = 0;
    const stops = list.map((item) => {
      const start = cursor / total * 100;
      cursor += item.count;
      const end = cursor / total * 100;
      return `${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
    });
    chart.style.background = 'transparent';
    chart.innerHTML = `
      <div class="donut-ring" style="background:conic-gradient(${stops.join(',')})"></div>
      <div class="donut-center"><strong>${total}</strong><span>次</span></div>`;
  }

  function renderWeek() {
    const start = startOfWeek(weekAnchor);
    const thisWeek = startOfWeek(new Date());
    const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
    const counts = days.map((day) => completedRecords(dateKey(day)).length);
    const max = Math.max(1, ...counts);
    const total = counts.reduce((sum, value) => sum + value, 0);
    const end = days[6];

    els.weekSubtitle.textContent = total ? `这一周办完 ${total} 件。` : '这一周还没办什么。';
    els.weekDateInput.value = dateKey(start);
    els.weekDateInput.max = todayKey();
    els.weekNextBtn.disabled = start.getTime() >= thisWeek.getTime();
    els.weekTodayBtn.hidden = start.getTime() === thisWeek.getTime();
    if (els.weekLabel) {
      els.weekLabel.textContent = `${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;
      els.weekLabel.title = start.getTime() === thisWeek.getTime() ? '本周' : '回到本周';
    }

    const today = todayKey();
    els.weekChart.innerHTML = days
      .map((day, index) => {
        const key = dateKey(day);
        const count = counts[index];
        const height = count ? Math.max(4, Math.round((count / max) * 100)) : 2;
        const classes = ['week-col', 'is-clickable'];
        if (key === today) classes.push('is-today');
        if (!count) classes.push('is-zero');
        return `
          <button class="${classes.join(' ')}" type="button" data-day="${key}" aria-label="${monthDayLabel(key)}，办完 ${count} 件">
            <span class="week-count">${count || ''}</span>
            <span class="week-bar-wrap"><span class="week-bar" style="height:${height}%"></span></span>
            <span class="week-day">${['一', '二', '三', '四', '五', '六', '日'][index]}</span>
          </button>`;
      })
      .join('');
  }

  function renderMonth() {
    const year = heatmapMonth.getFullYear();
    const month = heatmapMonth.getMonth();
    const first = new Date(year, month, 1);
    const offset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const now = new Date();
    const currentMonth = now.getFullYear() === year && now.getMonth() === month;
    const today = todayKey();

    els.heatmapMonthLabel.textContent = `${year}年${month + 1}月`;
    els.heatmapMonthLabel.title = currentMonth ? '本月' : '回到本月';
    els.heatmapDateInput.value = dateKey(first);
    els.heatmapDateInput.max = todayKey();
    els.heatmapNextBtn.disabled = currentMonth || new Date(year, month, 1) > new Date(now.getFullYear(), now.getMonth(), 1);

    let monthCompleted = 0;
    let monthSeconds = 0;
    const cells = [];

    for (let i = 0; i < offset; i += 1) {
      cells.push('<span class="month-day is-empty" aria-hidden="true"></span>');
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const key = dateKey(new Date(year, month, day));
      const records = completedRecords(key);
      const count = records.length;
      const seconds = recordsOn(key).reduce((sum, r) => sum + r.seconds, 0);
      monthCompleted += count;
      monthSeconds += seconds;
      const isFuture = key > today;
      const level = levelFor(count);
      const classes = ['month-day', `level-${level}`];
      if (isFuture) classes.push('is-future');
      if (key === today) classes.push('is-today');
      cells.push(`
        <button class="${classes.join(' ')}" type="button" data-day="${key}"${isFuture ? ' disabled' : ''} title="${monthDayLabel(key)} · ${count ? `办完 ${count} 件` : '没记录'}">
          <span>${day}</span>${count ? `<span class="month-count">${count}</span>` : ''}
        </button>`);
    }

    els.monthGrid.innerHTML = cells.join('');
    els.heatmapFoot.textContent = monthCompleted
      ? `这个月办完 ${monthCompleted} 件，动手 ${Math.round(monthSeconds / 60)} 分钟。`
      : '这个月还没有记录。';
  }

  function levelFor(count) {
    if (!count) return 0;
    if (count === 1) return 1;
    if (count <= 3) return 2;
    if (count <= 5) return 3;
    return 4;
  }

  function jumpToDay(key) {
    periodDate = parseKey(key);
    selectedCategoryId = null;
    renderDaily();
    const panel = $id('distributionPanel');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- Dialogs ---------- */

  function openDialog(dialog) {
    if (!dialog) return;
    if (dialog.open) return;
    try {
      dialog.showModal();
    } catch (error) {
      dialog.setAttribute('open', '');
    }
  }

  function closeDialog(dialog) {
    if (dialog && dialog.open) dialog.close();
  }

  function openDurationDialog() {
    durationDraft = state.settings.defaultMinutes;
    els.customMinutes.value = String(durationDraft);
    syncDurationSelection(durationDraft);
    els.durationError.hidden = true;
    openDialog(els.durationDialog);
  }

  function syncDurationSelection(value) {
    els.durationPresetButtons.forEach((button) => {
      const selected = Number(button.dataset.minutes) === Number(value);
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function setDurationDraft(minutes) {
    durationDraft = clamp(Math.round(minutes), 1, 180);
    els.customMinutes.value = String(durationDraft);
    syncDurationSelection(durationDraft);
  }

  function showFormError(node, message) {
    node.textContent = message;
    node.hidden = false;
  }

  function setSelected(buttons, key, value) {
    buttons.forEach((button) => {
      const selected = String(button.dataset[key]) === String(value);
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }

  function pickDurationFromButtons(buttons, customInput) {
    const selected = buttons.find((b) => b.classList.contains('is-selected'));
    const preset = selected ? Number(selected.dataset.minutes) : NaN;
    const custom = Number(customInput.value);
    if (Number.isFinite(custom) && custom > 0) return clamp(Math.round(custom), 1, 180);
    return Number.isFinite(preset) ? preset : 5;
  }

  function openScheduleDialog() {
    const now = new Date();
    const at = new Date(now.getTime() + 30 * 60000);
    at.setSeconds(0, 0);
    at.setMinutes(Math.ceil(at.getMinutes() / 5) * 5);
    els.scheduleTime.value = `${pad2(at.getHours())}:${pad2(at.getMinutes())}`;
    setSelected(els.scheduleDayButtons, 'day', at.getDate() === now.getDate() ? 'today' : 'tomorrow');
    const minutes = state.settings.defaultMinutes;
    const presetExists = els.scheduleDurationButtons.some((b) => Number(b.dataset.minutes) === minutes);
    els.scheduleDurationButtons.forEach((b) => b.classList.toggle('is-selected', presetExists && Number(b.dataset.minutes) === minutes));
    els.scheduleCustomMinutes.value = String(minutes);
    els.scheduleError.hidden = true;
    openDialog(els.scheduleDialog);
  }

  function openCategoryDialog() {
    categoryDraft = { color: SWATCHES[0], editingId: null };
    els.categoryNameInput.value = '';
    els.categoryFormLabel.textContent = '添加分类';
    els.categorySubmitBtn.textContent = '添加';
    els.categoryCancelEdit.hidden = true;
    els.categoryError.hidden = true;
    renderCategoryColors();
    renderCategoryManage();
    openDialog(els.categoryDialog);
  }

  function renderCategoryManage() {
    els.categoryManageList.innerHTML = state.categories
      .map((cat) => `
        <div class="category-manage-row">
          <i class="category-dot" style="background:${esc(cat.color)}"></i>
          <span class="category-manage-name">${esc(cat.name)}</span>
          <button type="button" data-edit-category="${esc(cat.id)}">改名</button>
          <button type="button" class="is-danger" data-delete-category="${esc(cat.id)}">删除</button>
        </div>`)
      .join('');
  }

  function renderCategoryColors() {
    els.categoryColorSwatches.innerHTML = SWATCHES
      .map((color) => `<button class="color-swatch${color === categoryDraft.color ? ' is-selected' : ''}" type="button" style="background:${color}" data-color="${color}" aria-label="选择颜色 ${color}"></button>`)
      .join('');
  }

  function submitCategoryForm(event) {
    event.preventDefault();
    const name = els.categoryNameInput.value.trim();
    if (!name) {
      showFormError(els.categoryError, '给分类起个名字。');
      return;
    }
    const duplicate = state.categories.some((c) => c.name === name && c.id !== categoryDraft.editingId);
    if (duplicate) {
      showFormError(els.categoryError, '已经有同名分类了。');
      return;
    }
    if (categoryDraft.editingId) {
      const cat = categoryOf(categoryDraft.editingId);
      if (cat) {
        cat.name = name;
        cat.color = categoryDraft.color;
      }
    } else {
      state.categories.push({ id: 'c' + uid(), name, color: categoryDraft.color });
    }
    save();
    categoryDraft = { color: SWATCHES[0], editingId: null };
    els.categoryNameInput.value = '';
    els.categoryFormLabel.textContent = '添加分类';
    els.categorySubmitBtn.textContent = '添加';
    els.categoryCancelEdit.hidden = true;
    els.categoryError.hidden = true;
    renderCategoryColors();
    renderCategoryManage();
    renderAll();
  }

  function editCategory(id) {
    const cat = categoryOf(id);
    if (!cat) return;
    categoryDraft = { color: cat.color, editingId: id };
    els.categoryNameInput.value = cat.name;
    els.categoryFormLabel.textContent = '修改分类';
    els.categorySubmitBtn.textContent = '保存';
    els.categoryCancelEdit.hidden = false;
    els.categoryError.hidden = true;
    renderCategoryColors();
    els.categoryNameInput.focus();
  }

  function deleteCategory(id) {
    const cat = categoryOf(id);
    if (!cat) return;
    const fallback = state.categories.find((c) => c.id !== id) || { id: 'misc', name: '未分类' };
    state.categories = state.categories.filter((c) => c.id !== id);
    state.records.forEach((record) => {
      if (record.categoryId === id) record.categoryId = fallback.id;
    });
    save();
    renderCategoryManage();
    renderAll();
    toast('分类删了，里面的记录归到「' + fallback.name + '」。');
  }

  function syncSettingsUI() {
    const settings = state.settings;
    setSelected(els.defaultMinuteButtons, 'minutes', settings.defaultMinutes);
    syncToggle(els.overtimeToggle, settings.autoOvertime);
    syncToggle(els.soundToggle, settings.sound);
    syncToggle(els.celebrationToggle, settings.celebrate);
    syncToggle(els.notifyToggle, settings.notify);
    els.categorySummary.textContent = state.categories.map((c) => c.name).join('、');
    els.celebrationCount.textContent = `${(window.RRB_CELEBRATIONS || []).length} 种`;
    els.notificationHint.textContent = ('Notification' in window) && Notification.permission === 'denied'
      ? '浏览器已拒绝通知权限，可在站点设置里改。'
      : '允许后，预约到点或是完成时通知你。';
  }

  function syncToggle(input, value) {
    if (!input) return;
    input.checked = Boolean(value);
  }

  /* ---------- 庆祝 & 声音 ---------- */

  let confirmResolver = null;

  function confirmAction({ title, message, okLabel }) {
    els.confirmTitle.textContent = title || '确认';
    els.confirmMessage.textContent = message || '';
    els.confirmOk.textContent = okLabel || '确认';
    openDialog(els.confirmDialog);
    return new Promise((resolve) => {
      confirmResolver = resolve;
    });
  }

  function resolveConfirm(value) {
    if (els.confirmDialog.open) els.confirmDialog.close();
    if (confirmResolver) {
      const resolve = confirmResolver;
      confirmResolver = null;
      resolve(value);
    }
  }

  function ensureAudio() {
    if (audioCtx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      audioCtx = new Ctx();
    } catch (error) {
      audioCtx = null;
    }
  }

  function playChime() {
    if (!state.settings.sound) return;
    ensureAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const start = audioCtx.currentTime;
    [880, 1174.66].forEach((freq, index) => {
      const when = start + index * 0.13;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, when);
      gain.gain.linearRampToValueAtTime(0.075, when + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.55);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(when);
      osc.stop(when + 0.6);
    });
  }

  function notify(title, body) {
    if (!state.settings.notify) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      new Notification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
    } catch (error) {
      /* 通知失败不影响使用 */
    }
  }

  function toast(message) {
    if (!els.toastHost) return;
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = message;
    els.toastHost.appendChild(node);
    window.setTimeout(() => {
      node.classList.add('is-leaving');
      window.setTimeout(() => node.remove(), 240);
    }, 2300);
  }

  /* ---------- 事件 ---------- */

  function bindEvents() {
    // 导航
    document.addEventListener('click', (event) => {
      const viewBtn = event.target.closest('[data-view]');
      if (viewBtn) {
        switchView(viewBtn.dataset.view);
        return;
      }
      const closer = event.target.closest('[data-close]');
      if (closer) {
        const dialog = $id(closer.dataset.close);
        closeDialog(dialog);
        return;
      }
    });

    els.settingsBtn.addEventListener('click', () => openDialog(els.settingsDialog));

    // 打卡
    els.checkinBtn.addEventListener('click', doCheckin);
    els.checkinRevealClose.addEventListener('click', hideCheckinReveal);
    els.checkinReveal.addEventListener('click', (event) => {
      if (event.target === els.checkinReveal) hideCheckinReveal();
    });

    // 开工卡
    els.durationControl.addEventListener('click', openDurationDialog);
    els.durationPresetButtons.forEach((button) => {
      button.addEventListener('click', () => setDurationDraft(Number(button.dataset.minutes)));
    });
    els.customMinutes.addEventListener('input', () => {
      const value = Number(els.customMinutes.value);
      if (Number.isFinite(value) && value >= 1 && value <= 180) syncDurationSelection(value);
    });
    els.customMinus.addEventListener('click', () => setDurationDraft(Number(els.customMinutes.value) - 1));
    els.customPlus.addEventListener('click', () => setDurationDraft(Number(els.customMinutes.value) + 1));
    els.durationForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const value = Number(els.customMinutes.value);
      if (!Number.isFinite(value) || value < 1 || value > 180) {
        showFormError(els.durationError, '请输入 1–180 之间的分钟数。');
        return;
      }
      state.settings.defaultMinutes = clamp(Math.round(value), 1, 180);
      save();
      syncDurationControl();
      renderWork();
      closeDialog(els.durationDialog);
      toast(`以后默认 ${state.settings.defaultMinutes} 分钟。`);
    });

    els.startBtn.addEventListener('click', () => {
      startWork(state.settings.defaultMinutes, 'now');
    });
    els.pauseBtn.addEventListener('click', togglePause);
    els.endBtn.addEventListener('click', requestEnd);
    els.workQuoteNext.addEventListener('click', () => {
      if (state.active) {
        state.active.quoteText = pickQuote(quoteGroupForActive());
        state.active.quoteGroup = quoteGroupForActive();
        save();
      } else {
        idleQuote = pickQuote('before');
      }
      renderQuote();
    });
    els.scheduleBtn.addEventListener('click', openScheduleDialog);
    els.cancelScheduleBtn.addEventListener('click', () => {
      state.schedule = null;
      save();
      renderSchedule();
      toast('预约取消了。');
    });
    els.scheduleStartBtn.addEventListener('click', () => {
      const schedule = state.schedule;
      if (!schedule) return;
      state.schedule = null;
      save();
      startWork(schedule.minutes, 'now');
      renderSchedule();
    });

    // 预约
    els.scheduleDayButtons.forEach((button) => {
      button.addEventListener('click', () => setSelected(els.scheduleDayButtons, 'day', button.dataset.day));
    });
    els.scheduleDurationButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setSelected(els.scheduleDurationButtons, 'minutes', button.dataset.minutes);
        els.scheduleCustomMinutes.value = button.dataset.minutes;
      });
    });
    els.scheduleForm.addEventListener('submit', submitScheduleForm);
    // 完成卡
    els.finishDoneBtn.addEventListener('click', () => commitFinish(true));
    els.finishPartialBtn.addEventListener('click', () => commitFinish(false));
    els.finishDiscardBtn.addEventListener('click', discardFinish);
    els.finishCategoryChips.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-category]');
      if (!chip) return;
      finishDraft.categoryId = chip.dataset.category;
      renderFinishCategories();
      updateFinishNote();
    });
    els.finishDialog.addEventListener('close', () => {
      if (finishCtx) resumeAfterFinishCancel();
    });
    els.finishDialog.addEventListener('cancel', () => {
      window.setTimeout(() => {
        if (finishCtx) resumeAfterFinishCancel();
      }, 0);
    });

    // 庆祝
    els.celebrationDoneBtn.addEventListener('click', () => closeDialog(els.celebrationDialog));
    els.celebrationSkipBtn.addEventListener('click', () => closeDialog(els.celebrationDialog));
    els.celebrationAnotherBtn.addEventListener('click', () => {
      const item = pickCelebration();
      if (item) renderCelebration(item, { seconds: 0, preview: false });
      spawnCelebrationSparks();
    });

    // 确认
    els.confirmOk.addEventListener('click', () => resolveConfirm(true));
    els.confirmCancel.addEventListener('click', () => resolveConfirm(false));
    els.confirmDialog.addEventListener('close', () => {
      if (confirmResolver) {
        const resolve = confirmResolver;
        confirmResolver = null;
        resolve(false);
      }
    });

    // 设置
    els.defaultMinuteButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.settings.defaultMinutes = clamp(Number(button.dataset.minutes) || 5, 1, 180);
        save();
        syncSettingsUI();
        syncDurationControl();
        renderWork();
      });
    });
    els.overtimeToggle.addEventListener('change', () => {
      state.settings.autoOvertime = els.overtimeToggle.checked;
      save();
    });
    els.soundToggle.addEventListener('change', () => {
      state.settings.sound = els.soundToggle.checked;
      save();
      if (els.soundToggle.checked) playChime();
    });
    els.celebrationToggle.addEventListener('change', () => {
      state.settings.celebrate = els.celebrationToggle.checked;
      save();
    });
    els.celebrationPreviewBtn.addEventListener('click', () => {
      closeDialog(els.settingsDialog);
      window.setTimeout(() => openCelebration({ seconds: 0, preview: true }), 120);
    });
    els.manageCategoriesBtn.addEventListener('click', () => {
      closeDialog(els.settingsDialog);
      window.setTimeout(openCategoryDialog, 120);
    });
    els.notifyToggle.addEventListener('change', async () => {
      if (!('Notification' in window)) {
        els.notifyToggle.checked = false;
        toast('这个浏览器不支持桌面通知。');
        return;
      }
      if (els.notifyToggle.checked) {
        let permission = Notification.permission;
        if (permission === 'default') permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          els.notifyToggle.checked = false;
          state.settings.notify = false;
          save();
          toast('没拿到通知权限，页面内提醒仍然有效。');
          return;
        }
      }
      state.settings.notify = els.notifyToggle.checked;
      save();
      syncSettingsUI();
    });
    els.installAppBtn.addEventListener('click', async () => {
      if (!deferredPrompt) {
        toast('用浏览器菜单里的「添加到主屏幕」也可以。');
        return;
      }
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      updateInstallUI();
    });
    els.exportBtn.addEventListener('click', exportCSV);
    els.exportBtnSettings.addEventListener('click', exportCSV);
    els.clearDataBtn.addEventListener('click', async () => {
      const ok = await confirmAction({
        title: '清空办事记录？',
        message: '所有办完记录、动手时间和开张记录都会删掉。这个操作不能撤销。',
        okLabel: '清空',
      });
      if (!ok) return;
      state.records = [];
      state.checkins = {};
      state.celebrationHistory = [];
      state.active = null;
      save();
      renderAll();
      renderStats();
      toast('记录清空了。');
    });

    // 分类
    els.categoryForm.addEventListener('submit', submitCategoryForm);
    els.categoryColorSwatches.addEventListener('click', (event) => {
      const swatch = event.target.closest('[data-color]');
      if (!swatch) return;
      categoryDraft.color = swatch.dataset.color;
      renderCategoryColors();
    });
    els.categoryManageList.addEventListener('click', async (event) => {
      const edit = event.target.closest('[data-edit-category]');
      if (edit) {
        editCategory(edit.dataset.editCategory);
        return;
      }
      const del = event.target.closest('[data-delete-category]');
      if (!del) return;
      const cat = categoryOf(del.dataset.deleteCategory);
      if (!cat) return;
      const ok = await confirmAction({
        title: '删除这个分类？',
        message: `「${cat.name}」里的旧记录会归到「未分类」。`,
        okLabel: '删除',
      });
      if (ok) deleteCategory(cat.id);
    });
    els.categoryCancelEdit.addEventListener('click', () => {
      categoryDraft = { color: SWATCHES[0], editingId: null };
      els.categoryNameInput.value = '';
      els.categoryFormLabel.textContent = '添加分类';
      els.categorySubmitBtn.textContent = '添加';
      els.categoryCancelEdit.hidden = true;
      renderCategoryColors();
    });

    // 统计
    els.periodPrevBtn.addEventListener('click', () => {
      periodDate = addDays(periodDate, -1);
      selectedCategoryId = null;
      renderDaily();
    });
    els.periodNextBtn.addEventListener('click', () => {
      if (dateKey(periodDate) >= todayKey()) return;
      periodDate = addDays(periodDate, 1);
      selectedCategoryId = null;
      renderDaily();
    });
    els.periodTodayBtn.addEventListener('click', () => {
      periodDate = startOfDay(new Date());
      selectedCategoryId = null;
      renderDaily();
    });
    els.periodDateInput.addEventListener('change', () => {
      if (!els.periodDateInput.value) return;
      periodDate = parseKey(els.periodDateInput.value);
      selectedCategoryId = null;
      renderDaily();
    });
    els.distributionBackBtn.addEventListener('click', () => {
      selectedCategoryId = null;
      renderDaily();
    });
    els.categoryList.addEventListener('click', (event) => {
      const row = event.target.closest('[data-category]');
      if (!row) return;
      selectedCategoryId = row.dataset.category;
      renderDaily();
    });
    els.weekChart.addEventListener('click', (event) => {
      const col = event.target.closest('[data-day]');
      if (col) jumpToDay(col.dataset.day);
    });
    els.monthGrid.addEventListener('click', (event) => {
      const cell = event.target.closest('[data-day]');
      if (!cell || cell.disabled) return;
      jumpToDay(cell.dataset.day);
    });
    els.weekPrevBtn.addEventListener('click', () => {
      weekAnchor = addDays(weekAnchor, -7);
      renderWeek();
    });
    els.weekNextBtn.addEventListener('click', () => {
      const nextWeek = addDays(weekAnchor, 7);
      if (startOfWeek(nextWeek).getTime() > startOfWeek(new Date()).getTime()) return;
      weekAnchor = nextWeek;
      renderWeek();
    });
    els.weekTodayBtn.addEventListener('click', () => {
      weekAnchor = startOfDay(new Date());
      renderWeek();
    });
    els.weekLabel.addEventListener('click', () => {
      weekAnchor = startOfDay(new Date());
      renderWeek();
    });
    els.weekDateInput.addEventListener('change', () => {
      if (!els.weekDateInput.value) return;
      weekAnchor = parseKey(els.weekDateInput.value);
      renderWeek();
    });
    els.heatmapPrevBtn.addEventListener('click', () => {
      heatmapMonth = new Date(heatmapMonth.getFullYear(), heatmapMonth.getMonth() - 1, 1);
      renderMonth();
    });
    els.heatmapNextBtn.addEventListener('click', () => {
      const now = new Date();
      if (heatmapMonth.getFullYear() >= now.getFullYear() && heatmapMonth.getMonth() >= now.getMonth()) return;
      heatmapMonth = new Date(heatmapMonth.getFullYear(), heatmapMonth.getMonth() + 1, 1);
      renderMonth();
    });
    els.heatmapMonthLabel.addEventListener('click', () => {
      const now = new Date();
      heatmapMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      renderMonth();
    });
    els.heatmapDateInput.addEventListener('change', () => {
      if (!els.heatmapDateInput.value) return;
      const picked = parseKey(els.heatmapDateInput.value);
      heatmapMonth = new Date(picked.getFullYear(), picked.getMonth(), 1);
      renderMonth();
    });

    // 安装
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      deferredPrompt = event;
      updateInstallUI();
    });
    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      updateInstallUI();
      toast('装好了，从主屏幕打开就行。');
    });

    // 打卡揭晓可以用 Esc 收起
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && els.checkinReveal && !els.checkinReveal.hidden) hideCheckinReveal();
    });

    // 页面可见性：回到页面时校准
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        updateGreeting();
        renderSchedule();
      }
    });
  }

  function switchView(view) {
    if (view !== 'today' && view !== 'stats') return;
    if (currentView === view) return;
    currentView = view;
    els.todayView.classList.toggle('is-active', view === 'today');
    els.statsView.classList.toggle('is-active', view === 'stats');
    els.todayView.hidden = view !== 'today';
    els.statsView.hidden = view !== 'stats';
    els.navItems.forEach((item) => {
      const active = item.dataset.view === view;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    if (view === 'stats') {
      renderStats();
    } else {
      renderToday();
    }
    updateTitle();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function submitScheduleForm(event) {
    event.preventDefault();
    const day = els.scheduleDayButtons.find((b) => b.classList.contains('is-selected'))?.dataset.day || 'today';
    const time = els.scheduleTime.value;
    if (!time) {
      showFormError(els.scheduleError, '先选一个时间。');
      return;
    }
    const [hour, minute] = time.split(':').map(Number);
    const base = new Date();
    if (day === 'tomorrow') base.setDate(base.getDate() + 1);
    base.setHours(hour, minute, 0, 0);
    if (base.getTime() <= Date.now() + 30000) {
      showFormError(els.scheduleError, day === 'today' ? '这个时间已经过了，换个时间或选明天。' : '时间好像不太对。');
      return;
    }
    const minutes = pickDurationFromButtons(els.scheduleDurationButtons, els.scheduleCustomMinutes);
    state.schedule = {
      at: base.getTime(),
      minutes,
      label: scheduleLabel(base.getTime()),
      missed: false,
    };
    save();
    closeDialog(els.scheduleDialog);
    renderSchedule();
    toast(`约好了：${scheduleLabel(base.getTime())}，${minutes} 分钟。`);
  }

  function exportCSV() {
    const rows = [['日期', '开始时间', '结束时间', '事项', '分类', '分钟', '秒', '是否办完', '来源']];
    state.records
      .slice()
      .sort((a, b) => a.endedAt - b.endedAt)
      .forEach((record) => {
        rows.push([
          record.day,
          formatHHMM(record.startedAt),
          formatHHMM(record.endedAt),
          record.title,
          categoryName(record.categoryId),
          (record.seconds / 60).toFixed(2),
          String(record.seconds),
          record.completed ? '是' : '还差一点',
          record.source === 'tick' ? '直接勾掉' : '开工计时',
        ]);
      });
    if (rows.length === 1) {
      toast('还没有记录可以导出。');
      return;
    }
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `日日办-${todayKey()}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('导出好了。');
  }

  function updateInstallUI() {
    if (!els.installAppBtn) return;
    els.installAppBtn.hidden = !deferredPrompt;
    if (deferredPrompt) {
      els.installHint.textContent = '像 App 一样从主屏幕打开，离线也能记。';
    } else if (window.matchMedia('(display-mode: standalone)').matches) {
      els.installHint.textContent = '已经装好了，正以独立窗口运行。';
    }
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return;
    // 分享链接靠 sharecode 通行，注册时也带上，掉 cookie 也能装上
    const code = new URLSearchParams(location.search).get('sharecode');
    const swUrl = code ? 'sw.js?sharecode=' + encodeURIComponent(code) : 'sw.js';
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          // 每次打开都检查一遍有没有新版本，有就立刻换
          try { registration.update(); } catch (error) { /* 忽略 */ }
        })
        .catch(() => {});
    });
  }

  function setupSplash() {
    let seen = false;
    try {
      seen = Boolean(window.sessionStorage.getItem('rrb-splash-seen'));
      window.sessionStorage.setItem('rrb-splash-seen', '1');
    } catch (error) {
      seen = false;
    }
    if (seen) {
      els.splash.hidden = true;
      return;
    }
    const started = Date.now();
    const hide = () => {
      const wait = Math.max(0, SPLASH_MIN_MS - (Date.now() - started));
      window.setTimeout(() => {
        els.splash.classList.add('is-hidden');
        window.setTimeout(() => {
          els.splash.hidden = true;
        }, 460);
      }, wait);
    };
    if (document.readyState === 'complete') hide();
    else window.addEventListener('load', hide, { once: true });
    window.setTimeout(hide, 2600);
  }

})();
