const STORAGE_KEY = 'ds_playlist';

let dragSrcIdx   = null;
let previewTimer = null;

// ── 資料存取 ──────────────────────────────────

function loadPlaylist() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function savePlaylist(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ── 工具函式 ──────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getYouTubeId(url) {
  const short = url.match(/youtu\.be\/([^?&/]+)/);
  if (short) return short[1];
  const watch = url.match(/[?&]v=([^?&]+)/);
  if (watch) return watch[1];
  const embed = url.match(/\/embed\/([^?&/]+)/);
  if (embed) return embed[1];
  return null;
}

function getItemSubtype(item) {
  if (item.type === 'image') return 'image';
  if (/youtube\.com|youtu\.be/.test(item.url)) return 'youtube';
  return 'mp4';
}

function getBadgeHtml(item) {
  const map = {
    youtube: ['bg-blue-50 text-blue-600 ring-1 ring-blue-200',       'YouTube'],
    mp4:     ['bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200', 'MP4'],
    image:   ['bg-amber-50 text-amber-600 ring-1 ring-amber-200',     '圖片'],
  };
  const [cls, label] = map[getItemSubtype(item)] ?? ['bg-slate-100 text-slate-500', '未知'];
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}">${label}</span>`;
}

// ── Toast 提示 ────────────────────────────────

function showToast(message, type = 'success') {
  const colors = { success: 'bg-emerald-500', error: 'bg-red-500', info: 'bg-indigo-500' };
  const el = document.createElement('div');
  el.className = `fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
                  text-white transition-all duration-300 ${colors[type] ?? colors.success}`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px)';
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

// ── 預覽側欄 ──────────────────────────────────

function setPreviewVisible(visible) {
  document.getElementById('preview-col').classList.toggle('preview-open', visible);
}

function updatePreview(url) {
  const content = document.getElementById('preview-content');
  const label   = document.getElementById('preview-label');

  if (!url) {
    setPreviewVisible(false);
    content.innerHTML = '';
    label.classList.add('hidden');
    return;
  }

  let html = '';
  if (/youtube\.com|youtu\.be/.test(url)) {
    const vid = getYouTubeId(url);
    if (!vid) { setPreviewVisible(false); content.innerHTML = ''; return; }
    html = `<img src="https://img.youtube.com/vi/${vid}/hqdefault.jpg"
                 class="w-full h-full object-cover" alt="YouTube 縮圖" />`;
  } else if (/\.(mp4|webm|ogv|mov)$/i.test(url) || url.startsWith('blob:')) {
    html = `<video src="${escapeHtml(url)}" class="w-full h-full object-contain" controls muted playsinline></video>`;
  } else if (/\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)$/i.test(url)) {
    html = `<img src="${escapeHtml(url)}" class="w-full h-full object-contain" alt="預覽" />`;
  } else {
    setPreviewVisible(false);
    content.innerHTML = '';
    return;
  }

  content.innerHTML = html;
  label.textContent = url.split('/').pop();
  label.classList.remove('hidden');
  setPreviewVisible(true);
}

function previewFile(file) {
  const content = document.getElementById('preview-content');
  const label   = document.getElementById('preview-label');
  const objUrl  = URL.createObjectURL(file);
  const isVideo = file.type.startsWith('video/');
  content.innerHTML = isVideo
    ? `<video src="${objUrl}" class="w-full h-full object-contain" controls muted playsinline></video>`
    : `<img src="${objUrl}" class="w-full h-full object-contain" alt="預覽" />`;
  label.textContent = file.name;
  label.classList.remove('hidden');
  setPreviewVisible(true);
}

// ── 播放秒數欄位同步 ──────────────────────────

function syncDurationField() {
  const isVideo = document.getElementById('f-type').value === 'video';
  document.getElementById('f-duration').disabled = isVideo;
  document.getElementById('duration-video-hint').classList.toggle('hidden', !isVideo);
}

// ── 渲染表格 ──────────────────────────────────

function renderTable() {
  const list    = loadPlaylist();
  const tbody   = document.getElementById('playlist-body');
  const countEl = document.getElementById('item-count');
  tbody.innerHTML = '';

  if (countEl) countEl.textContent = `${list.length} 個項目`;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-16 text-center">
          <div class="flex flex-col items-center gap-2">
            <svg class="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
            <p class="text-slate-400 text-sm font-medium">目前無廣告內容</p>
            <p class="text-slate-300 text-xs">請在左側表單新增播放項目</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  list.forEach((item, idx) => {
    const tr      = document.createElement('tr');
    tr.draggable  = true;
    tr.className  = 'border-b border-slate-50 hover:bg-slate-50/70 transition-colors';

    const duration = item.type === 'image'
      ? (item.duration ? `${item.duration / 1000} 秒` : '—')
      : '自動偵測';
    const isFirst  = idx === 0;
    const isLast   = idx === list.length - 1;

    tr.innerHTML = `
      <td class="drag-handle px-3 py-3.5 text-center text-slate-300 text-lg select-none" title="拖曳排序">⠿</td>
      <td class="px-4 py-3.5 text-slate-300 text-xs font-mono">${idx + 1}</td>
      <td class="px-4 py-3.5 font-medium text-slate-700">${escapeHtml(item.name)}</td>
      <td class="px-4 py-3.5">${getBadgeHtml(item)}</td>
      <td class="px-4 py-3.5">
        <a class="url-cell block text-indigo-400 hover:text-indigo-600 text-xs transition-colors"
           href="${escapeHtml(item.url)}" target="_blank" rel="noopener"
           draggable="false" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</a>
      </td>
      <td class="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">${duration}</td>
      <td class="px-4 py-3.5">
        <div class="flex items-center gap-1">
          <button class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600
                         disabled:opacity-25 disabled:cursor-default transition-colors"
                  data-action="up" data-idx="${idx}" ${isFirst ? 'disabled' : ''} title="上移">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
          <button class="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600
                         disabled:opacity-25 disabled:cursor-default transition-colors"
                  data-action="down" data-idx="${idx}" ${isLast ? 'disabled' : ''} title="下移">
            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
            </svg>
          </button>
          <button class="ml-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-500
                         text-xs font-medium transition-colors"
                  data-action="delete" data-idx="${idx}">刪除</button>
        </div>
      </td>`;

    // ── 拖曳事件 ──────────────────────────────
    tr.addEventListener('dragstart', e => {
      if (e.target.closest('button')) { e.preventDefault(); return; }
      dragSrcIdx = idx;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => tr.classList.add('dragging'), 0);
    });
    tr.addEventListener('dragend', () => {
      tr.classList.remove('dragging');
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
      dragSrcIdx = null;
    });
    tr.addEventListener('dragover', e => {
      if (dragSrcIdx === null || dragSrcIdx === idx) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('drag-over'));
      tr.classList.add('drag-over');
    });
    tr.addEventListener('dragleave', () => tr.classList.remove('drag-over'));
    tr.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrcIdx === null || dragSrcIdx === idx) return;
      const list = loadPlaylist();
      const [moved] = list.splice(dragSrcIdx, 1);
      list.splice(idx, 0, moved);
      savePlaylist(list);
      renderTable();
    });

    tbody.appendChild(tr);
  });
}

// ── 事件監聽 ──────────────────────────────────

// URL 輸入：自動偵測類型 + 延遲預覽
document.getElementById('f-url').addEventListener('input', e => {
  const url = e.target.value.trim();

  if (/youtube\.com|youtu\.be/.test(url) || /\.(mp4|webm|ogv|mov)$/i.test(url)) {
    document.getElementById('f-type').value = 'video';
    syncDurationField();
  } else if (/\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)$/i.test(url)) {
    document.getElementById('f-type').value = 'image';
    syncDurationField();
  }

  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => updatePreview(url), 500);
});

// 本機檔案選擇
document.getElementById('f-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById('f-url').value = `media/${file.name}`;

  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|ogv|mov)$/i.test(file.name);
  document.getElementById('f-type').value = isVideo ? 'video' : 'image';
  syncDurationField();

  const nameInput = document.getElementById('f-name');
  if (!nameInput.value) nameInput.value = file.name.replace(/\.[^.]+$/, '');

  const hint = document.getElementById('file-hint');
  hint.textContent = `⚠ 請將「${file.name}」複製到專案的 media/ 資料夾，否則前台無法載入。`;
  hint.classList.remove('hidden');

  previewFile(file);
  e.target.value = '';
});

// 表單送出
document.getElementById('add-form').addEventListener('submit', e => {
  e.preventDefault();

  const name    = document.getElementById('f-name').value.trim();
  const type    = document.getElementById('f-type').value;
  const url     = document.getElementById('f-url').value.trim();
  const seconds = parseFloat(document.getElementById('f-duration').value) || 5;
  const duration = type === 'image' ? Math.round(seconds * 1000) : null;

  const list = loadPlaylist();
  list.push({ name, type, url, duration });
  savePlaylist(list);
  renderTable();

  e.target.reset();
  document.getElementById('f-duration').value = '5';
  document.getElementById('file-hint').classList.add('hidden');
  setPreviewVisible(false);
  document.getElementById('preview-content').innerHTML = '';
  document.getElementById('preview-label').classList.add('hidden');
  syncDurationField();
  showToast(`「${name}」已新增至清單`);
});

// 排序 + 刪除
document.getElementById('playlist-body').addEventListener('click', e => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const idx    = parseInt(btn.dataset.idx, 10);
  const action = btn.dataset.action;
  const list   = loadPlaylist();

  if (action === 'delete') {
    const itemName = list[idx].name;
    if (!confirm(`確定要刪除「${itemName}」嗎？`)) return;
    list.splice(idx, 1);
    savePlaylist(list);
    renderTable();
    showToast(`「${itemName}」已刪除`, 'error');
    return;
  }

  if (action === 'up' && idx > 0) {
    [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
  } else if (action === 'down' && idx < list.length - 1) {
    [list[idx], list[idx + 1]] = [list[idx + 1], list[idx]];
  } else {
    return;
  }

  savePlaylist(list);
  renderTable();
});

// 類型切換同步
document.getElementById('f-type').addEventListener('change', syncDurationField);

// 登出
document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem('ds_auth');
  location.replace('login.html');
});

// ── 跑馬燈設定 ────────────────────────────────

const TICKER_KEY = 'ds_ticker';

function loadTickerSettings() {
  try { return JSON.parse(localStorage.getItem(TICKER_KEY)) || {}; }
  catch { return {}; }
}

function initTickerAdmin() {
  const cfg = loadTickerSettings();
  document.getElementById('ticker-enabled').checked      = !!cfg.enabled;
  document.getElementById('ticker-text-input').value     = cfg.text  || '';
  document.getElementById('ticker-speed').value          = cfg.speed || 30;
}

document.getElementById('ticker-save').addEventListener('click', () => {
  const cfg = {
    enabled: document.getElementById('ticker-enabled').checked,
    text:    document.getElementById('ticker-text-input').value.trim(),
    speed:   Math.max(5, parseInt(document.getElementById('ticker-speed').value) || 30),
  };
  localStorage.setItem(TICKER_KEY, JSON.stringify(cfg));
  showToast('跑馬燈設定已儲存，請重新整理看板頁面', 'info');
});

// ── 初始化 ────────────────────────────────────
syncDurationField();
initTickerAdmin();
renderTable();
