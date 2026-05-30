// ===== 빼꼼 인덱스 - 화면 로직 =====

const PALETTE = [
  '#FFE08A', // 노랑
  '#F7B5C4', // 핑크
  '#A8D8EA', // 하늘
  '#B5E7A0', // 연두
  '#FFC9A3', // 살구
  '#D6C8F0', // 라벤더
  '#FFFFFF'  // 흰색
];

let notes = [];
let settings = { mode: 'auto', pinned: false, autoLaunch: false };
let activeId = null;
let view = 'note'; // 'note' | 'settings'
let ignoreBlur = false; // 다이얼로그 등으로 인한 blur 무시용

const app = document.getElementById('app');
const tabsEl = document.getElementById('tabs');
const noteView = document.getElementById('note-view');
const settingsView = document.getElementById('settings-view');
const titleEl = document.getElementById('note-title');
const bodyEl = document.getElementById('note-body');
const colorRow = document.getElementById('color-row');
const saveStatus = document.getElementById('save-status');
const btnPin = document.getElementById('btn-pin');
const panelInner = document.getElementById('panel-inner');

// ---------- 초기화 ----------
async function init() {
  settings = await window.api.getSettings();
  notes = await window.api.getNotes();
  buildColorSwatches();
  applySettingsUI();
  renderTabs();
  collapse(); // 시작은 접힌 상태 (저장된 탭 개수 그대로 보임)
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

  // + 추가 버튼
  const addBtn = document.createElement('button');
  addBtn.className = 'tab-add';
  addBtn.textContent = '+';
  addBtn.title = '새 메모 추가';
  addBtn.addEventListener('click', addNote);
  tabsEl.appendChild(addBtn);

  // 아래 여백 + 설정 버튼
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
  bodyEl.value = note.body || '';
  markSelectedSwatch(note.color);
  panelInner.style.setProperty('--accent', note.color);
}

function showNoteView() {
  noteView.classList.remove('hidden');
  settingsView.classList.add('hidden');
}

// ---------- 펼치기 / 접기 ----------
function expand() {
  app.classList.remove('collapsed');
  app.classList.add('expanded');
  window.api.expand();
}
function collapse() {
  saveNow(); // 접기 전 반드시 저장
  app.classList.remove('expanded');
  app.classList.add('collapsed');
  activeId = null;
  view = 'note';
  window.api.collapse();
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

// ---------- 추가 / 삭제 ----------
function addNote() {
  const id = 't' + Date.now();
  const color = PALETTE[notes.length % PALETTE.length];
  const note = { id, title: '', color, body: '' };
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
    // 최소 1개는 유지
    notes.push({ id: 't' + Date.now(), title: '', color: '#FFE08A', body: '' });
  }
  saveNow();
  collapse();
});

document.getElementById('btn-collapse').addEventListener('click', collapse);

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
  applySettingsUI();
  expand();
}
document.getElementById('btn-settings-close').addEventListener('click', collapse);

document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    settings.mode = radio.value;
    if (settings.mode === 'always') settings.pinned = false;
    applySettingsUI();
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
  // 모드 라디오
  document.querySelectorAll('input[name="mode"]').forEach((r) => {
    r.checked = r.value === settings.mode;
  });
  // 자동 실행
  document.getElementById('chk-autolaunch').checked = !!settings.autoLaunch;
  // 핀 버튼: 항상 열림 모드에서는 의미 없으므로 숨김
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
  if (settings.mode === 'auto' && !settings.pinned) {
    collapse();
  }
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

// 시작
init();
