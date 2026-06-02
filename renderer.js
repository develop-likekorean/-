// ===== 빼꼼 인덱스 - 화면 로직 =====

const PALETTE = [
  '#FFE08A', '#F7B5C4', '#A8D8EA', '#B5E7A0', '#FFC9A3', '#D6C8F0', '#FFFFFF'
];

const SIZE_COL = { large: 54, medium: 44, small: 36, mini: 22 }; // 접혔을 때(탭 기둥) 너비
const MIN_W = 240, MAX_W = 1000;   // 패널 너비 한계
const MIN_H = 150;                 // 패널 높이 최소
// 새 메모 기본 크기(작게). 메모마다 따로 저장됨. (0 = 전체 높이)
const DEF_MEMO_W = 320, DEF_MEMO_H = 300;
const DEF_LINK_W = 600, DEF_LINK_H = 0;
const SETTINGS_W = 360;

let notes = [];
let settings = { mode: 'auto', pinned: false, autoLaunch: false, side: 'right', size: 'medium', opacity: 1 };
let lastWidth = 44;
let activeId = null;
let view = 'note'; // 'note' | 'settings'
let ignoreBlur = false;
let dragSrcId = null;
let customPicker = null;

const app = document.getElementById('app');
const tabsEl = document.getElementById('tabs');
const noteView = document.getElementById('note-view');
const settingsView = document.getElementById('settings-view');
const titleEl = document.getElementById('note-title');
const bodyEl = document.getElementById('note-body');
let boldBtn = null;
const urlEl = document.getElementById('note-url');
const webEl = document.getElementById('note-web');
const clearUrlBtn = document.getElementById('btn-clear-url');
const colorRow = document.getElementById('color-row');
const saveStatus = document.getElementById('save-status');
const btnPin = document.getElementById('btn-pin');
const btnCollapse = document.getElementById('btn-collapse');
const btnSettingsClose = document.getElementById('btn-settings-close');
const panelInner = document.getElementById('panel-inner');
const panelEl = document.getElementById('panel');
const resizeHandleV = document.getElementById('resize-handle-v');

// ---------- 초기화 ----------
async function init() {
  settings = await window.api.getSettings();
  notes = await window.api.getNotes();
  buildColorSwatches();
  applySideClass();
  applySizeClass();
  applyOpacity();
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
  app.classList.remove('size-large', 'size-medium', 'size-small', 'size-mini');
  app.classList.add('size-' + (settings.size || 'medium'));
}

function applyOpacity() {
  const o = settings.opacity == null ? 1 : settings.opacity;
  app.style.setProperty('--ui-opacity', o);
  const range = document.getElementById('opacity-range');
  const val = document.getElementById('opacity-val');
  if (range) range.value = Math.round(o * 100);
  if (val) val.textContent = Math.round(o * 100) + '%';
}

function expandedWidth() {
  if (view !== 'note') return SETTINGS_W;
  const n = currentNote();
  if (n && n.url && n.url.trim()) return n.width || DEF_LINK_W;
  return (n && n.width) || DEF_MEMO_W;
}

// 메모 카드 높이 적용 (0 = 전체 높이). 메모마다 따로 저장됨.
function applyPanelHeight() {
  let h = 0;
  if (view === 'note') {
    const n = currentNote();
    if (n && n.url && n.url.trim()) h = (n.height == null ? DEF_LINK_H : n.height);
    else h = (n && n.height != null) ? n.height : DEF_MEMO_H;
  }
  panelInner.style.height = (h && h > 0) ? h + 'px' : '';
}

// ---------- 레이아웃(창 위치/너비) ----------
function applyLayout() {
  const width = app.classList.contains('expanded') ? expandedWidth() : (SIZE_COL[settings.size] || 44);
  lastWidth = width;
  window.api.setLayout(settings.side, width);
}

// ---------- 탭 그리기 ----------
function renderTabs() {
  tabsEl.innerHTML = '';
  notes.forEach((note, i) => {
    const tab = document.createElement('button');
    tab.className = 'tab' + (note.id === activeId ? ' active' : '');
    tab.style.background = note.color;
    const full = note.title && note.title.trim() ? note.title : String(i + 1);
    const isActive = note.id === activeId;
    // 최소화 모드: 색만, 글자 없음. 그 외엔 8글자 이상이면 앞부분만(…), 활성 탭은 전체
    let label = '';
    if (settings.size !== 'mini') {
      label = (!isActive && full.length > 8) ? full.slice(0, 8) + '…' : full;
    }
    tab.textContent = label;
    tab.title = full;
    tab.addEventListener('click', () => onTabClick(note.id));

    // 드래그로 순서 변경
    tab.draggable = true;
    tab.addEventListener('dragstart', (e) => {
      dragSrcId = note.id;
      e.dataTransfer.effectAllowed = 'move';
      tab.classList.add('dragging');
      setIgnoreMouse(false); // 드래그 동안 입력 통과 끔
    });
    tab.addEventListener('dragend', () => {
      tab.classList.remove('dragging');
      dragSrcId = null;
      document.querySelectorAll('.tab.drag-over').forEach((t) => t.classList.remove('drag-over'));
    });
    tab.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (note.id !== dragSrcId) tab.classList.add('drag-over');
    });
    tab.addEventListener('dragleave', () => tab.classList.remove('drag-over'));
    tab.addEventListener('drop', (e) => {
      e.preventDefault();
      tab.classList.remove('drag-over');
      reorderNotes(dragSrcId, note.id);
    });

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

// 드래그한 탭(src)을 대상 탭(target) 자리로 옮기고 나머지를 밀어냄
function reorderNotes(srcId, targetId) {
  if (!srcId || srcId === targetId) return;
  const srcIdx = notes.findIndex((n) => n.id === srcId);
  const tgtIdx = notes.findIndex((n) => n.id === targetId);
  if (srcIdx < 0 || tgtIdx < 0) return;
  const [moved] = notes.splice(srcIdx, 1);
  notes.splice(tgtIdx, 0, moved);
  saveNow();
  renderTabs();
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

  // 색상 직접 선택 (무지개 동그라미 → 누르면 색상표 열림)
  const custom = document.createElement('label');
  custom.className = 'swatch custom';
  custom.title = '색상 직접 선택';
  customPicker = document.createElement('input');
  customPicker.type = 'color';
  customPicker.className = 'color-picker';
  customPicker.addEventListener('input', () => setColor(customPicker.value));
  custom.appendChild(customPicker);
  colorRow.appendChild(custom);

  // 굵게(B) 버튼 — 색상 줄 오른쪽 끝에
  boldBtn = document.createElement('button');
  boldBtn.id = 'btn-bold';
  boldBtn.textContent = 'B';
  boldBtn.title = '굵게 (Ctrl/⌘+B)';
  boldBtn.addEventListener('mousedown', (e) => { e.preventDefault(); applyBold(); });
  colorRow.appendChild(boldBtn);
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
  const b = note.body || '';
  bodyEl.innerHTML = /<[a-z][\s\S]*>/i.test(b) ? b : b.replace(/\n/g, '<br>'); // 옛 일반 텍스트도 줄바꿈 유지
  markSelectedSwatch(note.color);
  if (customPicker && /^#[0-9a-fA-F]{6}$/.test(note.color)) customPicker.value = note.color;
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
    if (boldBtn) boldBtn.classList.add('hidden');
    webEl.classList.remove('hidden');
    const u = normalizeUrl(note.url);
    if (webEl.getAttribute('src') !== u) webEl.setAttribute('src', u);
  } else {
    webEl.classList.add('hidden');
    webEl.removeAttribute('src');
    bodyEl.classList.remove('hidden');
    if (boldBtn) boldBtn.classList.remove('hidden');
  }
  applyPanelHeight();
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
  applyPanelHeight();
  setIgnoreMouse(false); // 펼치면 패널 전체가 입력을 받음
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
  setIgnoreMouse(true); // 접으면 빈 영역은 클릭 통과
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
  note.body = bodyEl.innerHTML;
  saveNow();
});

// 굵게: 버튼 + 단축키(Ctrl/⌘+B)
function applyBold() {
  bodyEl.focus();
  document.execCommand('bold');
  const note = currentNote();
  if (note) { note.body = bodyEl.innerHTML; saveNow(); }
}
bodyEl.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
    e.preventDefault();
    applyBold();
  }
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

document.getElementById('opacity-range').addEventListener('input', (e) => {
  settings.opacity = Math.max(0.3, Math.min(1, Number(e.target.value) / 100));
  applyOpacity();
  saveSettingsNow();
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
  applyOpacity();
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

// ---------- 패널 너비 마우스로 조절 ----------
const resizeHandle = document.getElementById('resize-handle');
let resizing = false, rzStartX = 0, rzStartW = 0, rzPending = null, rzRaf = null;

function liveResize(w) {
  rzPending = w;
  if (rzRaf) return;
  rzRaf = requestAnimationFrame(() => {
    rzRaf = null;
    lastWidth = rzPending;
    window.api.setLayout(settings.side, rzPending);
  });
}

resizeHandle.addEventListener('pointerdown', (e) => {
  if (!app.classList.contains('expanded')) return;
  resizing = true;
  rzStartX = e.screenX;
  rzStartW = lastWidth;
  resizeHandle.setPointerCapture(e.pointerId);
  e.preventDefault();
});
resizeHandle.addEventListener('pointermove', (e) => {
  if (!resizing) return;
  const delta = settings.side === 'left' ? (e.screenX - rzStartX) : (rzStartX - e.screenX);
  const w = Math.max(MIN_W, Math.min(MAX_W, Math.round(rzStartW + delta)));
  liveResize(w);
});
resizeHandle.addEventListener('pointerup', (e) => {
  if (!resizing) return;
  resizing = false;
  try { resizeHandle.releasePointerCapture(e.pointerId); } catch (err) {}
  const n = currentNote();
  if (view === 'note' && n) { n.width = lastWidth; saveNow(); } // 이 메모의 너비 저장
});

// ---------- 패널 높이 마우스로 조절 ----------
let vResizing = false, vStartY = 0, vStartH = 0;
resizeHandleV.addEventListener('pointerdown', (e) => {
  if (!app.classList.contains('expanded')) return;
  vResizing = true;
  vStartY = e.screenY;
  vStartH = panelInner.offsetHeight;
  resizeHandleV.setPointerCapture(e.pointerId);
  e.preventDefault();
});
resizeHandleV.addEventListener('pointermove', (e) => {
  if (!vResizing) return;
  const maxH = panelEl.clientHeight - 28;
  const h = Math.max(MIN_H, Math.min(maxH, Math.round(vStartH + (e.screenY - vStartY))));
  panelInner.style.height = h + 'px';
});
resizeHandleV.addEventListener('pointerup', (e) => {
  if (!vResizing) return;
  vResizing = false;
  try { resizeHandleV.releasePointerCapture(e.pointerId); } catch (err) {}
  const maxH = panelEl.clientHeight - 28;
  const h = panelInner.offsetHeight;
  const store = (h >= maxH - 2) ? 0 : h; // 거의 꽉 차면 '전체'로 저장
  const n = currentNote();
  if (view === 'note' && n) { n.height = store; saveNow(); } // 이 메모의 높이 저장
});

// ---------- 빈 영역 클릭 통과 (실제 탭/패널 위에서만 입력 받기) ----------
let curIgnore = null;
function setIgnoreMouse(ignore) {
  if (ignore === curIgnore) return;
  curIgnore = ignore;
  window.api.setIgnoreMouse(ignore);
}
// 마우스가 실제 스티커(탭)나 펼친 패널 위에 있을 때만 입력을 받음
const INTERACTIVE = '.tab, .tab-add, .tab-gear, #panel-inner';
document.addEventListener('mousemove', (e) => {
  if (dragSrcId || resizing || vResizing) { setIgnoreMouse(false); return; } // 드래그/리사이즈 중엔 통과 끔
  if (app.classList.contains('expanded')) { setIgnoreMouse(false); return; }
  const onContent = e.target && e.target.closest && e.target.closest(INTERACTIVE);
  setIgnoreMouse(!onContent);
});

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
