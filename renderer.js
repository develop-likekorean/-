// ===== 빼꼼 인덱스 - 화면 로직 =====

const PALETTE = [
  '#FFE08A', '#F7B5C4', '#A8D8EA', '#B5E7A0', '#FFC9A3', '#D6C8F0', '#FFFFFF'
];

const SIZE_COL = { large: 54, medium: 44, small: 36 }; // 접혔을 때(탭 기둥) 너비
const MEMO_W = 400;   // 메모 펼침 너비
const LINK_W = 600;   // 링크(웹페이지) 펼침 너비 — 더 넓게

let notes = [];
let settings = { mode: 'auto', pinned: false, autoLaunch: false, side: 'right', size: 'medium' };
let activeId = null;
let view = 'note'; // 'note' | 'settings'
let ignoreBlur = false;

const app = document.getElementById('app');
const tabsEl = document.getElementById('tabs');
const noteView = document.getElementById('note-view');
const settingsView = document.getElementById('settings-view');
const titleEl = document.getElementById('note-title');
const bodyEl = document.getElementById('note-body');
const urlEl = document.getElementById('note-url');
const webEl = document.getElementById('note-web');
const clearUrlBtn = document.getElementById('btn-clear-url');
const colorRow = document.getElementById('color-row');
const saveStatus = document.getElementById('save-status');
const btnPin = document.getElementById('btn-pin');
const btnCollapse = document.getElementById('btn-collapse');
const btnSettingsClose = document.getElementById('btn-settings-close');
const panelInner = document.getElementById('panel-inner');

// ---------- 초기화 ----------
async function init() {
  settings = await window.api.getSettings();
  notes = await window.api.getNotes();
  buildColorSwatches();
  applySideClass();
  applySizeClass();
  applySettingsUI();
  renderTabs();
  collapse();
}

function applySideClass() {
  app.classList.toggle('side-left', settings.side === 'left');
  app.classList.toggle('side-right', settings.side !== 'left');
  const arrow = settings.side === 'left' ? '‹' : '›';
  btnCollapse.textContent = arrow;
  btnSettingsClose.textContent = arrow;
}

function applySizeClass() {
  app.classList.remove('size-large', 'size-medium', 'size-small');
  app.classList.add('size-' + (settings.size || 'medium'));
}

// ---------- 레이아웃(창 위치/너비) ----------
function applyLayout() {
  let width = SIZE_COL[settings.size] || 44;
  if (app.classList.contains('expanded')) {
    if (view === 'note') {
      const n = currentNote();
      width = (n && n.url && n.url.trim()) ? LINK_W : MEMO_W;
    } else {
      width = MEMO_W;
    }
  }
  window.api.setLayout(settings.side, width);
}

// ---------- 탭 그리기 ----------
function renderTabs() {
  tabsEl.innerHTML = '';
  notes.forEach((note, i) => {
    const tab = document.createElement('button');
    tab.className = 'tab' + (note.id === activeId ? ' active' : '');
    tab.style.background = note.color;
    const label = note.title && note.title.trim() ? note.title : String(i + 1);
    tab.textContent = label;
    tab.title = label;
    tab.addEventListener('click', () => onTabClick(note.id));
    tabsEl.appendChild(tab);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'tab-add';
  addBtn.textContent = '+';
  addBtn.title = '새 메모 추가';
  addBtn.addEventListener('click', addNote);
  tabsEl.appendChild(addBtn);

  const spacer = document.createElement('div');
  spacer.className = 'spacer';
  tabsEl.appendChild(spacer);

  const gear = document.createElement('button');
  gear.className = 'tab-gear';
  gear.textContent = '⚙';
  gear.title = '설정';
  gear.addEventListener('click', openSettings);
  tabsEl.appendChild(gear);
}

// ---------- 색상 팔레트 ----------
function buildColorSwatches() {
  colorRow.innerHTML = '';
  PALETTE.forEach((color) => {
    const s = document.createElement('div');
    s.className = 'swatch';
    s.style.background = color;
    s.dataset.color = color;
    s.addEventListener('click', () => setColor(color));
    colorRow.appendChild(s);
  });
}
function markSelectedSwatch(color) {
  colorRow.querySelectorAll('.swatch').forEach((s) => {
    s.classList.toggle('selected', s.dataset.color === color);
  });
}

// ---------- 탭 클릭 ----------
function onTabClick(id) {
  if (app.classList.contains('expanded') && view === 'note' && activeId === id) {
    collapse();
    return;
  }
  activeId = id;
  view = 'note';
  showNoteView();
  loadIntoPanel(id);
  expand();
  renderTabs();
}

function loadIntoPanel(id) {
  const note = notes.find((n) => n.id === id);
  if (!note) return;
  titleEl.value = note.title || '';
  urlEl.value = note.url || '';
  bodyEl.value = note.body || '';
  markSelectedSwatch(note.color);
  panelInner.style.setProperty('--accent', note.color);
  renderContent(note);
}

function normalizeUrl(u) {
  u = u.trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

// 링크가 있으면 웹페이지, 없으면 메모 textarea
function renderContent(note) {
  const hasUrl = note.url && note.url.trim();
  clearUrlBtn.classList.toggle('hidden', !hasUrl);
  if (hasUrl) {
    bodyEl.classList.add('hidden');
    webEl.classList.remove('hidden');
    const u = normalizeUrl(note.url);
    if (webEl.getAttribute('src') !== u) webEl.setAttribute('src', u);
  } else {
    webEl.classList.add('hidden');
    webEl.removeAttribute('src');
    bodyEl.classList.remove('hidden');
  }
}

function showNoteView() {
  noteView.classList.remove('hidden');
  settingsView.classList.add('hidden');
}

// ---------- 펼치기 / 접기 ----------
function expand() {
  app.classList.remove('collapsed');
  app.classList.add('expanded');
  applyLayout();
}
function collapse() {
  saveNow();
  app.classList.remove('expanded');
  app.classList.add('collapsed');
  activeId = null;
  view = 'note';
  webEl.classList.add('hidden');
  webEl.removeAttribute('src'); // 웹페이지 정지
  applyLayout();
  renderTabs();
}

// ---------- 편집 ----------
function currentNote() {
  return notes.find((n) => n.id === activeId);
}

function setColor(color) {
  const note = currentNote();
  if (!note) return;
  note.color = color;
  markSelectedSwatch(color);
  panelInner.style.setProperty('--accent', color);
  renderTabs();
  saveNow();
}

titleEl.addEventListener('input', () => {
  const note = currentNote();
  if (!note) return;
  note.title = titleEl.value;
  renderTabs();
  saveNow();
});
bodyEl.addEventListener('input', () => {
  const note = currentNote();
  if (!note) return;
  note.body = bodyEl.value;
  saveNow();
});

// 링크: 입력 중엔 저장만, 다 입력하면(엔터/포커스 해제) 페이지 띄우고 너비 조정
urlEl.addEventListener('input', () => {
  const note = currentNote();
  if (!note) return;
  note.url = urlEl.value;
  clearUrlBtn.classList.toggle('hidden', !urlEl.value.trim());
  saveNow();
});
urlEl.addEventListener('change', applyUrl);
urlEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyUrl(); urlEl.blur(); } });

function applyUrl() {
  const note = currentNote();
  if (!note) return;
  renderContent(note);
  applyLayout(); // 메모↔링크 너비 전환
}

clearUrlBtn.addEventListener('click', () => {
  const note = currentNote();
  if (!note) return;
  note.url = '';
  urlEl.value = '';
  renderContent(note);
  applyLayout();
  saveNow();
  urlEl.focus();
});

// ---------- 추가 / 삭제 ----------
function addNote() {
  const id = 't' + Date.now();
  const color = PALETTE[notes.length % PALETTE.length];
  const note = { id, title: '', color, body: '', url: '' };
  notes.push(note);
  activeId = id;
  view = 'note';
  showNoteView();
  loadIntoPanel(id);
  expand();
  renderTabs();
  saveNow();
  setTimeout(() => titleEl.focus(), 120);
}

document.getElementById('btn-delete').addEventListener('click', () => {
  const note = currentNote();
  if (!note) return;
  guardBlur();
  const label = note.title && note.title.trim() ? note.title : '이 메모';
  if (!confirm(`"${label}" 를 삭제할까요?`)) return;
  notes = notes.filter((n) => n.id !== note.id);
  if (notes.length === 0) {
    notes.push({ id: 't' + Date.now(), title: '', color: '#FFE08A', body: '', url: '' });
  }
  saveNow();
  collapse();
});

btnCollapse.addEventListener('click', collapse);

// ---------- 핀 ----------
btnPin.addEventListener('click', () => {
  settings.pinned = !settings.pinned;
  applySettingsUI();
  saveSettingsNow();
});

// ---------- 설정 ----------
function openSettings() {
  view = 'settings';
  noteView.classList.add('hidden');
  settingsView.classList.remove('hidden');
  webEl.classList.add('hidden');
  applySettingsUI();
  expand();
}
btnSettingsClose.addEventListener('click', collapse);

document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    settings.mode = radio.value;
    if (settings.mode === 'always') settings.pinned = false;
    applySettingsUI();
    saveSettingsNow();
  });
});

document.querySelectorAll('input[name="side"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    settings.side = radio.value;
    applySideClass();
    applyLayout(); // 즉시 위치 이동
    saveSettingsNow();
  });
});

document.querySelectorAll('input[name="size"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    settings.size = radio.value;
    applySizeClass();
    applyLayout(); // 즉시 너비 반영
    saveSettingsNow();
  });
});

document.getElementById('chk-autolaunch').addEventListener('change', (e) => {
  settings.autoLaunch = e.target.checked;
  saveSettingsNow();
});

document.getElementById('btn-quit').addEventListener('click', () => {
  guardBlur();
  if (confirm('빼꼼 인덱스를 종료할까요?')) window.api.quit();
});

function applySettingsUI() {
  document.querySelectorAll('input[name="mode"]').forEach((r) => { r.checked = r.value === settings.mode; });
  document.querySelectorAll('input[name="side"]').forEach((r) => { r.checked = r.value === settings.side; });
  document.querySelectorAll('input[name="size"]').forEach((r) => { r.checked = r.value === settings.size; });
  document.getElementById('chk-autolaunch').checked = !!settings.autoLaunch;
  if (settings.mode === 'always') {
    btnPin.classList.add('hidden');
  } else {
    btnPin.classList.remove('hidden');
    btnPin.classList.toggle('pinned', !!settings.pinned);
    btnPin.title = settings.pinned ? '고정 해제' : '고정하기';
  }
}

// ---------- 바깥 클릭 시 자동 최소화 ----------
window.api.onWindowBlur(() => {
  if (ignoreBlur) return;
  if (!app.classList.contains('expanded')) return;
  if (settings.mode === 'auto' && !settings.pinned) collapse();
});
function guardBlur() {
  ignoreBlur = true;
  setTimeout(() => { ignoreBlur = false; }, 500);
}

// ---------- 저장 (즉시) ----------
async function saveNow() {
  saveStatus.textContent = '저장 중...';
  await window.api.saveNotes(notes);
  saveStatus.textContent = '저장됨';
}
async function saveSettingsNow() {
  await window.api.saveSettings(settings);
}

init();
