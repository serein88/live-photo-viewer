const state = {
  files: [],
  items: [],
  filtered: [],
  filter: 'all',
  selection: new Set(),
  viewer: null,
  liveMuted: true,
  livePlaying: false,
  layout: 'auto',
  scanning: false,
  sortKey: 'mtime_desc',
  exifQueueRunning: false,
  userAdjusted: false,
};
const EXIF_SLICE_SIZE = 256 * 1024;
let renderTimer = null;

const el = {
  filePicker: document.getElementById('filePicker'),
  dirPicker: document.getElementById('dirPicker'),
  mcpFiles: document.getElementById('mcpFiles'),
  folderBtn: document.getElementById('folderBtn'),
  exportBtn: document.getElementById('exportBtn'),
  grid: document.getElementById('grid'),
  stats: document.getElementById('stats'),
  status: document.getElementById('status'),
  filterAll: document.getElementById('filterAll'),
  filterLive: document.getElementById('filterLive'),
  filterStill: document.getElementById('filterStill'),
  clearSel: document.getElementById('clearSel'),
  sortSelect: document.getElementById('sortSelect'),
  viewerGallery: document.getElementById('viewerGallery'),
};

let gridBound = false;
function bindGridEvents() {
  if (gridBound) return;
  gridBound = true;
  el.grid.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    if (e.shiftKey) {
      toggleSelection(card.dataset.id);
      return;
    }
    openViewer(card.dataset.id);
  });
  el.grid.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.card');
    if (!card) return;
    e.preventDefault();
    toggleSelection(card.dataset.id);
  });
}

let navIdleTimer = null;
let navBound = false;

function detectPlatform() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isWindows = /Win/i.test(platform);
  return { isAndroid, isIOS, isWindows };
}

const platformInfo = detectPlatform();
const supportsDirectoryPicker = 'showDirectoryPicker' in window;
const supportsWebkitDir = 'webkitdirectory' in el.dirPicker;
const supportsFolder = supportsDirectoryPicker || supportsWebkitDir;
if (!supportsFolder && !platformInfo.isIOS) {
  el.folderBtn.disabled = true;
  el.folderBtn.title = '此浏览器不支持文件夹选择，请使用多选文件。';
}

function applyLayout(mode) {
  const m = mode === 'auto' ? (window.matchMedia('(max-width: 800px)').matches ? 'mobile' : 'desktop') : mode;
  document.body.classList.remove('mobile', 'desktop');
  document.body.classList.add(m);
  state.layout = mode;
}

window.addEventListener('resize', () => {
  if (state.viewer && state.viewer.viewed) {
    const panel = document.querySelector('.viewer-panel');
    const open = !!(panel && !panel.classList.contains('hidden'));
    syncPanelState(open);
  }
});
applyLayout('auto');

function updateStats() {
  const total = state.items.length;
  const live = state.items.filter(i => i.isLive).length;
  const selected = state.selection.size;
  el.stats.textContent = `总计 ${total} · Live ${live} · 已选 ${selected}`;
  el.exportBtn.disabled = selected === 0;
}

function setStatus(text) { el.status.textContent = text; }

function setFilter(f) {
  state.filter = f;
  renderGrid();
}

async function handleSelectedFiles(files, source) {
  if (!files || !files.length) return;
  if (files.length >= 1 && files.every(isBundleFile)) {
    setStatus('检测到 MCP bundle，加载中...');
    let loadedAll = [];
    for (const f of files) {
      const loaded = await loadBundle(f);
      loadedAll = loadedAll.concat(loaded);
    }
    if (loadedAll.length) {
      state.files = loadedAll;
      setStatus(`已通过 MCP bundle 导入，共 ${state.files.length} 个文件`);
      startScan();
    } else {
      setStatus('MCP bundle 加载失败');
    }
    return;
  }
  state.files = files;
  if (source === 'dir') {
    setStatus(`已选择文件夹，共 ${state.files.length} 个文件`);
  } else if (source === 'mcp') {
    setStatus(`已通过 MCP 导入文件夹，共 ${state.files.length} 个文件`);
  } else {
    setStatus(`已选择 ${state.files.length} 个文件，自动扫描中...`);
  }
  startScan();
}

function isBundleFile(file) {
  const name = file.name.toLowerCase();
  return /mcp-bundle.*\\.json$/.test(name) || name.endsWith('.mcpbundle.json') || name.endsWith('.mcpbundle');
}

async function loadBundle(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    const list = Array.isArray(data.files) ? data.files : [];
    const out = [];
    for (const item of list) {
      if (!item || !item.name || !item.data) continue;
      const bytes = Uint8Array.from(atob(item.data), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: item.type || 'application/octet-stream' });
      const f = new File([blob], item.name, { type: item.type || blob.type, lastModified: item.lastModified || Date.now() });
      out.push(f);
    }
    return out;
  } catch (err) {
    console.debug('[mcp] bundle load error', err);
    return [];
  }
}

async function startScan() {
  if (!state.files.length || state.scanning) return;
  state.scanning = true;
  setStatus('扫描中...');
  if (state.items.length) {
    state.items.forEach((item) => {
      if (item.objectUrl) {
        URL.revokeObjectURL(item.objectUrl);
        item.objectUrl = null;
      }
      if (item.thumbUrl) {
        URL.revokeObjectURL(item.thumbUrl);
        item.thumbUrl = null;
      }
    });
  }
  state.items = await scanFiles(state.files);
  renderGrid();
  updateStats();
  state.scanning = false;
  setStatus('扫描完成');
}

document.getElementById('filterAll').onclick = () => setFilter('all');
document.getElementById('filterLive').onclick = () => setFilter('live');
document.getElementById('filterStill').onclick = () => setFilter('still');
el.clearSel.onclick = () => { state.selection.clear(); renderGrid({ skipGallery: true }); updateStats(); };
el.sortSelect.addEventListener('change', () => {
  renderGrid();
});

el.filePicker.addEventListener('change', () => {
  handleSelectedFiles(Array.from(el.filePicker.files || []), 'file');
});
el.dirPicker.addEventListener('change', () => {
  handleSelectedFiles(Array.from(el.dirPicker.files || []), 'dir');
});
el.mcpFiles.addEventListener('change', () => {
  handleSelectedFiles(Array.from(el.mcpFiles.files || []), 'mcp');
});

function openFilePickerFallback() {
  console.debug('[dir-pick] fallback to file picker');
  el.filePicker.click();
}

async function pickDirectoryByPlatform() {
  const env = platformInfo;
  console.debug('[dir-pick] platform', env);
  if (env.isIOS) {
    setStatus('iOS 不支持目录选择，已切换为多文件选择');
    openFilePickerFallback();
    return [];
  }
  if (supportsDirectoryPicker) {
    try {
      const dir = await window.showDirectoryPicker();
      const files = await readDirectoryFiles(dir);
      console.debug('[dir-pick] showDirectoryPicker files', files.length);
      return files;
    } catch (err) {
      console.debug('[dir-pick] showDirectoryPicker cancel/error', err);
      if (err && err.name === 'AbortError') return [];
    }
  }
  if (supportsWebkitDir) {
    const files = await pickDirectoryWithInput();
    console.debug('[dir-pick] webkitdirectory files', files.length);
    return files;
  }
  console.debug('[dir-pick] no directory support');
  return [];
}

el.folderBtn.addEventListener('click', async () => {
  const files = await pickDirectoryByPlatform();
  if (files.length) {
    handleSelectedFiles(files, 'dir');
  } else if (!platformInfo.isIOS) {
    setStatus('已取消文件夹选择');
  }
});


el.exportBtn.addEventListener('click', async () => {
  const selected = state.items.filter(i => state.selection.has(i.id) && i.isLive);
  if (!selected.length) return;
  setStatus(`导出 ${selected.length} 个项目中...`);
  for (const item of selected) {
    await exportItem(item);
  }
  setStatus('导出完成（若浏览器阻止下载，请允许多文件下载）');
});

// MCP 调试入口：不在 UI 暴露，供自动化调用
window.__mcpImportDir = () => {
  if (el.mcpFiles) {
    el.mcpFiles.click();
    return;
  }
  if ('webkitdirectory' in el.dirPicker) {
    el.dirPicker.click();
    return;
  }
  setStatus('当前浏览器不支持 MCP 文件夹导入');
};
window.__mcpUseHiddenDir = () => {
  const files = el.mcpFiles?.files?.length ? el.mcpFiles.files : el.dirPicker?.files;
  state.files = Array.from(files || []);
  setStatus(`已通过 MCP 导入文件夹，共 ${state.files.length} 个文件`);
  if (state.files.length) {
    startScan();
  }
};

function renderGrid(options = {}) {
  const { skipGallery = false } = options;
  if (renderTimer) {
    clearTimeout(renderTimer);
    renderTimer = null;
  }
  el.grid.innerHTML = '';
  bindGridEvents();
  const list = state.items.filter(i => state.filter === 'all' || (state.filter === 'live' ? i.isLive : !i.isLive));
  const sorted = applySort(list);
  state.filtered = sorted;
  if (!skipGallery) updateViewerGallery();

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('data-id');
        const item = state.items.find(i => i.id === id);
        if (item) {
          const holder = entry.target.querySelector('.thumb');
          const hasImg = holder?.querySelector('img');
          if (!hasImg) loadThumbnail(item, entry.target);
        }
        observer.unobserve(entry.target);
      }
    }
  }, { rootMargin: '200px' });

  const groups = buildGroups(sorted);
  for (const entry of groups) {
    if (entry.type === 'group') {
      const header = document.createElement('div');
      header.className = 'group-header';
      header.textContent = entry.label;
      el.grid.appendChild(header);
      continue;
    }
    const item = entry.item;
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = item.id;
    if (state.selection.has(item.id)) card.classList.add('selected');

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.textContent = '加载中';

    let badge = null;
    if (item.isLive) {
      badge = document.createElement('div');
      badge.className = 'live-icon';
      badge.title = 'Live Photo';
    }

    const check = document.createElement('div');
    check.className = 'check';
    check.textContent = state.selection.has(item.id) ? '✓' : '';

    card.appendChild(thumb);
    if (badge) card.appendChild(badge);
    card.appendChild(check);

    el.grid.appendChild(card);
    observer.observe(card);
  }
}

function toggleSelection(id) {
  if (state.selection.has(id)) state.selection.delete(id); else state.selection.add(id);
  renderGrid({ skipGallery: true });
  updateStats();
}

function applySort(list) {
  const key = el.sortSelect ? el.sortSelect.value : state.sortKey;
  state.sortKey = key;
  const [type, order] = key.split('_');
  const dir = order === 'asc' ? 1 : -1;
  let sorted = list.slice();

  if (type === 'name') {
    sorted.sort((a, b) => dir * a.name.localeCompare(b.name, 'zh-Hans', { numeric: true, sensitivity: 'base' }));
  } else if (type === 'size') {
    sorted.sort((a, b) => dir * ((a.file?.size || 0) - (b.file?.size || 0)));
  } else if (type === 'mtime') {
    sorted.sort((a, b) => dir * ((a.file?.lastModified || 0) - (b.file?.lastModified || 0)));
  } else if (type === 'shot') {
    ensureExifTimes();
    sorted.sort((a, b) => dir * ((a.exifTime ?? a.file?.lastModified ?? 0) - (b.exifTime ?? b.file?.lastModified ?? 0)));
  }
  return sorted;
}

function buildGroups(sorted) {
  const key = state.sortKey || (el.sortSelect ? el.sortSelect.value : 'mtime_desc');
  const type = key.split('_')[0];
  if (type !== 'mtime' && type !== 'shot') {
    return sorted.map(item => ({ type: 'item', item }));
  }
  const groups = [];
  const counts = new Map();
  for (const item of sorted) {
    const day = getDayKey(item, type);
    counts.set(day, (counts.get(day) || 0) + 1);
  }
  let current = null;
  for (const item of sorted) {
    const day = getDayKey(item, type);
    if (day !== current) {
      current = day;
      groups.push({ type: 'group', label: `${day}（${counts.get(day) || 0}）` });
    }
    groups.push({ type: 'item', item });
  }
  return groups;
}

function getDayKey(item, type) {
  let ts = 0;
  if (type === 'shot') {
    ts = item.exifTime ?? item.file?.lastModified ?? 0;
  } else {
    ts = item.file?.lastModified ?? 0;
  }
  if (!ts) return '未知日期';
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ensureExifTimes() {
  if (state.exifQueueRunning) return;
  state.exifQueueRunning = true;
  const items = state.items.slice();
  if (!items.some(i => i.exifTime == null && !i.exifChecked)) {
    state.exifQueueRunning = false;
    return;
  }
  let idx = 0;
  const step = async () => {
    if (!state.sortKey.startsWith('shot')) {
      state.exifQueueRunning = false;
      return;
    }
    const item = items[idx++];
    if (!item) {
      state.exifQueueRunning = false;
      renderGrid();
      return;
    }
    let updated = false;
    if (item.exifTime == null && !item.exifChecked) {
      try {
        const buf = await readExifBuffer(item.file);
        const exif = extractExif(buf);
        item.exif = item.exif || exif;
        item.exifTime = parseExifTime(exif);
        updated = true;
      } catch {
        item.exifTime = null;
      }
      item.exifChecked = true;
    }
    if (updated && idx % 200 === 0) {
      scheduleRender('exif-progress');
      await new Promise(r => setTimeout(r, 0));
    }
    step();
  };
  step();
}

function scheduleRender(reason) {
  if (renderTimer) return;
  renderTimer = setTimeout(() => {
    renderTimer = null;
    renderGrid({ skipGallery: true });
  }, 300);
  console.debug('[grid] schedule render', { reason });
}

async function readExifBuffer(file) {
  const slice = file.slice(0, EXIF_SLICE_SIZE);
  return await slice.arrayBuffer();
}

function parseExifTime(exif) {
  const raw = exif?.DateTimeOriginal || exif?.DateTime;
  if (!raw) return null;
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const [_, y, mo, d, h, mi, s] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  return date.getTime();
}

async function loadThumbnail(item, card) {
  try {
    const img = document.createElement('img');
    img.loading = 'lazy';
    if (!item.objectUrl) item.objectUrl = URL.createObjectURL(item.file);
    img.src = item.objectUrl;
    const holder = card.querySelector('.thumb');
    if (!holder) return;
    holder.textContent = '';
    holder.appendChild(img);
    item.thumbLoaded = true;
  } catch {
    // leave placeholder
  }
}

function initViewer() {
  if (state.viewer) return;
  state.viewer = new Viewer(el.viewerGallery, {
    inline: false,
    navbar: false,
    title: false,
    toolbar: true,
    scalable: true,
    zoomable: true,
    movable: true,
    rotatable: false,
    transition: false,
    loop: false,
    zoomed() {
      state.userAdjusted = true;
      syncVideoToImage();
    },
    moved() {
      state.userAdjusted = true;
      syncVideoToImage();
    },
    viewed() {
      closeLiveVideoInline();
      state.userAdjusted = false;
      updateLiveButton();
      updateViewerTopbar();
      updateViewerPanel();
      updateNavDisabled();
      requestAnimationFrame(() => fitImageToCanvas());
      requestAnimationFrame(() => recenterImageForPanel());
      requestAnimationFrame(() => logViewerRects('viewed'));
      const current = state.filtered[state.viewer.index];
      if (current && current.isLive && current.videoBlob) {
        console.debug('[viewer] auto-play live', { index: state.viewer.index, name: current.name });
        openLiveVideoInline(current);
      } else {
        console.debug('[viewer] non-live viewed', { index: state.viewer.index, name: current?.name });
      }
    },
    hidden() {
      removeLiveButton();
      removeViewerTopbar();
      removeViewerPanel();
      closeLiveVideoInline();
      const container = getViewerContainer();
      if (container) {
        container.classList.remove('nav-active', 'nav-idle', 'panel-open');
      }
      clearNavIdle();
    },
  });
}

function updateViewerGallery() {
  el.viewerGallery.innerHTML = '';
  for (const item of state.filtered) {
    const img = document.createElement('img');
    img.dataset.id = item.id;
    img.dataset.live = item.isLive ? '1' : '0';
    if (!item.objectUrl) item.objectUrl = URL.createObjectURL(item.file);
    img.src = item.objectUrl;
    img.alt = item.name;
    el.viewerGallery.appendChild(img);
  }
  initViewer();
  state.viewer.update();
}

function openViewer(id) {
  const index = state.filtered.findIndex(i => i.id === id);
  if (index === -1) return;
  initViewer();
  console.debug('[viewer] open', { id, index, total: state.filtered.length });
  state.viewer.view(index);
}

function getViewerContainer() {
  return document.querySelector('.viewer-container');
}

function logViewerRects(reason) {
  const container = getViewerContainer();
  if (!container) return;
  const canvas = container.querySelector('.viewer-canvas');
  const panel = container.querySelector('.viewer-panel');
  const img = container.querySelector('.viewer-canvas > img');
  const video = container.querySelector('.viewer-live-video video');
  const c = canvas ? canvas.getBoundingClientRect() : null;
  const p = panel ? panel.getBoundingClientRect() : null;
  const i = img ? img.getBoundingClientRect() : null;
  const v = video ? video.getBoundingClientRect() : null;
  console.debug('[viewer] rects', {
    reason,
    canvas: c && { left: c.left, right: c.right, width: c.width },
    panel: p && { left: p.left, right: p.right, width: p.width },
    image: i && { left: i.left, right: i.right, width: i.width },
    video: v && { left: v.left, right: v.right, width: v.width }
  });
}

function removeLiveButton() {
  const btn = document.querySelector('.viewer-live-btn');
  if (btn) btn.remove();
}

function ensureViewerTopbar() {
  const container = getViewerContainer();
  if (!container) return null;
  let bar = container.querySelector('.viewer-topbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'viewer-topbar';
    bar.innerHTML = `
      <div class="topbar-left">
        <button class="topbar-btn back" title="返回" aria-label="返回"></button>
        <div class="topbar-title">预览</div>
      </div>
      <div class="topbar-right">
        <div class="topbar-live-slot"></div>
        <button class="topbar-btn info" title="信息" aria-label="信息"></button>
      </div>
    `;
    container.appendChild(bar);
    const backBtn = bar.querySelector('.topbar-btn.back');
    const infoBtn = bar.querySelector('.topbar-btn.info');
    backBtn.addEventListener('click', () => {
      if (state.viewer) state.viewer.hide();
    });
    infoBtn.addEventListener('click', () => {
      const panel = ensureViewerPanel();
      if (panel) {
        panel.classList.toggle('hidden');
        syncPanelState(!panel.classList.contains('hidden'));
      }
    });
  }
  return bar;
}

function updateViewerTopbar() {
  const viewer = state.viewer;
  if (!viewer) return;
  const bar = ensureViewerTopbar();
  if (!bar) return;
  const title = bar.querySelector('.topbar-title');
  const current = state.filtered[viewer.index];
  title.textContent = current ? current.name : '预览';
  const panel = document.querySelector('.viewer-panel');
  syncPanelState(!!(panel && !panel.classList.contains('hidden')));
  const container = getViewerContainer();
  bindViewerActivity(container);
  armNavIdle();
  console.debug('[viewer] topbar update', { index: viewer.index, title: title.textContent });
}

function removeViewerTopbar() {
  const bar = document.querySelector('.viewer-topbar');
  if (bar) bar.remove();
}

function ensureViewerPanel() {
  const container = getViewerContainer();
  if (!container) return null;
  let panel = container.querySelector('.viewer-panel');
  if (!panel) {
    panel = document.createElement('aside');
    panel.className = 'viewer-panel hidden';
    panel.innerHTML = `
      <div class="panel-header">
        <span>信息</span>
        <button class="topbar-btn close" title="关闭" aria-label="关闭"></button>
      </div>
      <div class="panel-body">
        <div class="panel-hint">添加说明</div>
        <div class="panel-grid"></div>
      </div>
    `;
    container.appendChild(panel);
    console.debug('[viewer] panel created');
    panel.querySelector('.topbar-btn.close').addEventListener('click', () => {
      panel.classList.add('hidden');
      syncPanelState(false);
    });
  }
  return panel;
}

function updateViewerPanel() {
  const viewer = state.viewer;
  if (!viewer) return;
  const panel = ensureViewerPanel();
  if (!panel) return;
  const item = state.filtered[viewer.index];
  if (!item) return;
  const grid = panel.querySelector('.panel-grid');
  if (!grid) return;
  if (item.exif) {
    const rows = buildDetailRows(item);
    grid.innerHTML = rows.map(([k, v]) => `<b>${k}</b><span>${v || '-'}</span>`).join('');
    return;
  }
  item.file.arrayBuffer().then((buf) => {
    item.exif = extractExif(buf);
    const rows = buildDetailRows(item);
    grid.innerHTML = rows.map(([k, v]) => `<b>${k}</b><span>${v || '-'}</span>`).join('');
  }).catch(() => {
    item.exif = {};
    const rows = buildDetailRows(item);
    grid.innerHTML = rows.map(([k, v]) => `<b>${k}</b><span>${v || '-'}</span>`).join('');
  });
}

function syncPanelState(open) {
  const container = getViewerContainer();
  const bar = document.querySelector('.viewer-topbar');
  if (bar) {
    bar.classList.toggle('with-panel', open);
  }
  if (container) {
    container.classList.toggle('panel-open', open);
  }
  updateSideNavPosition(open);
  armNavIdle();
  if (container) {
    const panel = container.querySelector('.viewer-panel');
    if (panel) {
      const rect = panel.getBoundingClientRect();
      console.debug('[viewer] panel state', { open, left: rect.left, right: rect.right, width: rect.width });
    }
  }
  if (state.viewer && state.viewer.viewed) {
    requestAnimationFrame(() => {
      if (container) {
        const canvas = container.querySelector('.viewer-canvas');
        const panel = container.querySelector('.viewer-panel');
        if (canvas && state.viewer) {
          const rect = canvas.getBoundingClientRect();
          const panelWidth = open && panel ? panel.getBoundingClientRect().width : 0;
          const availWidth = Math.max(0, rect.width - panelWidth);
          state.viewer.containerData = {
            width: availWidth,
            height: rect.height,
            left: rect.left,
            top: rect.top
          };
          state.viewer.viewerData = {
            width: availWidth,
            height: rect.height,
            left: rect.left,
            top: rect.top
          };
          state.viewer.canvasData = {
            width: availWidth,
            height: rect.height,
            left: rect.left,
            top: rect.top
          };
          console.debug('[viewer] canvas rect', {
            width: rect.width,
            height: rect.height,
            left: rect.left,
            top: rect.top,
            panelWidth,
            availWidth
          });
        }
      }
      state.viewer.render();
      if (!state.userAdjusted) {
        fitImageToCanvas();
      }
      recenterImageForPanel();
      logViewerRects('panel-toggle');
    });
  }
}

function fitImageToCanvas() {
  const viewer = state.viewer;
  if (!viewer || !viewer.imageData || !viewer.viewerData) return;
  if (state.userAdjusted) return;
  const vw = viewer.viewerData.width;
  const vh = viewer.viewerData.height;
  const nw = viewer.imageData.naturalWidth;
  const nh = viewer.imageData.naturalHeight;
  if (!vw || !vh || !nw || !nh) return;
  const scale = Math.min(vw / nw, vh / nh);
  const w = nw * scale;
  const h = nh * scale;
  viewer.imageData.width = w;
  viewer.imageData.height = h;
  viewer.imageData.x = (vw - w) / 2;
  viewer.imageData.y = (vh - h) / 2;
  viewer.imageData.left = viewer.imageData.x;
  viewer.imageData.top = viewer.imageData.y;
  viewer.imageData.scaleX = 1;
  viewer.imageData.scaleY = 1;
  viewer.renderImage();
  syncVideoToImage();
  console.debug('[viewer] fit image', { vw, vh, w: Math.round(w), h: Math.round(h) });
}

function syncVideoToImage() {
  const viewer = state.viewer;
  if (!viewer || !viewer.imageData) return;
  const layer = document.querySelector('.viewer-live-video');
  const video = layer?.querySelector('video');
  if (!layer || !video) return;
  const d = viewer.imageData;
  video.style.width = `${d.width}px`;
  video.style.height = `${d.height}px`;
  video.style.transform = `translate(${d.x}px, ${d.y}px)`;
  console.debug('[viewer] sync video', { w: Math.round(d.width), h: Math.round(d.height), x: Math.round(d.x), y: Math.round(d.y) });
}

function recenterImageForPanel() {
  const container = getViewerContainer();
  if (!container || !state.viewer) return;
  const panel = container.querySelector('.viewer-panel');
  const img = container.querySelector('.viewer-canvas img');
  if (!img) return;
  const c = container.getBoundingClientRect();
  const p = panel && !panel.classList.contains('hidden') ? panel.getBoundingClientRect() : null;
  const i = img.getBoundingClientRect();
  const availRight = p ? p.left : c.right;
  const availCenter = (c.left + availRight) / 2;
  const imgCenter = (i.left + i.right) / 2;
  const delta = imgCenter - availCenter;
  if (Math.abs(delta) > 1) {
    state.viewer.imageData.x -= delta;
    state.viewer.imageData.left -= delta;
    state.viewer.renderImage();
    syncVideoToImage();
  }
  console.debug('[viewer] recenter', { delta: Math.round(delta) });
}

function updateSideNavPosition(open) {
  const container = getViewerContainer();
  if (!container) return;
  const right = container.querySelector('.viewer-side-nav.right');
  const panel = container.querySelector('.viewer-panel');
  if (!right) return;
  let offset = 16;
  if (open && panel) {
    const rect = panel.getBoundingClientRect();
    offset = Math.round(rect.width + 16);
  }
  right.style.right = `${offset}px`;
  console.debug('[viewer] side-nav position', { open, right: right.style.right });
}

function bindViewerActivity(container) {
  if (!container || navBound) return;
  navBound = true;
  const reset = () => armNavIdle();
  ['mousemove', 'mousedown', 'wheel', 'keydown', 'touchstart', 'pointermove'].forEach((evt) => {
    container.addEventListener(evt, reset, { passive: true });
    window.addEventListener(evt, reset, { passive: true });
  });
  console.debug('[viewer] activity listeners bound');
}

function armNavIdle() {
  const container = getViewerContainer();
  if (!container) return;
  const navs = container.querySelectorAll('.viewer-side-nav');
  container.classList.add('nav-active');
  container.classList.remove('nav-idle');
  navs.forEach((n) => {
    n.style.setProperty('visibility', 'visible', 'important');
    n.style.setProperty('pointer-events', 'auto', 'important');
  });
  if (navIdleTimer) clearTimeout(navIdleTimer);
  navIdleTimer = setTimeout(() => {
    container.classList.add('nav-idle');
    container.classList.remove('nav-active');
    navs.forEach((n) => {
      n.style.setProperty('visibility', 'hidden', 'important');
      n.style.setProperty('pointer-events', 'none', 'important');
    });
    console.debug('[viewer] nav idle');
  }, 5000);
  console.debug('[viewer] nav active');
}

function clearNavIdle() {
  if (navIdleTimer) clearTimeout(navIdleTimer);
  navIdleTimer = null;
  navBound = false;
}

function ensureViewerSideNav() {
  const container = getViewerContainer();
  if (!container) return;
  const existing = container.querySelector('.viewer-side-nav.left');
  if (existing) return;
  const left = document.createElement('button');
  left.className = 'viewer-side-nav left';
  left.title = '上一张';
  const right = document.createElement('button');
  right.className = 'viewer-side-nav right';
  right.title = '下一张';
  left.addEventListener('click', () => {
    if (left.disabled) return;
    if (state.viewer) state.viewer.prev(true);
  });
  right.addEventListener('click', () => {
    if (right.disabled) return;
    if (state.viewer) state.viewer.next(true);
  });
  container.appendChild(left);
  container.appendChild(right);
}

function updateNavDisabled() {
  const container = getViewerContainer();
  if (!container || !state.viewer) return;
  const left = container.querySelector('.viewer-side-nav.left');
  const right = container.querySelector('.viewer-side-nav.right');
  const idx = state.viewer.index ?? 0;
  const max = (state.filtered?.length || 1) - 1;
  if (left) left.disabled = idx <= 0;
  if (right) right.disabled = idx >= max;
  console.debug('[viewer] nav disabled', { idx, max });
}

function ensureLiveVideoLayer() {
  const container = getViewerContainer();
  if (!container) return null;
  let layer = container.querySelector('.viewer-live-video');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'viewer-live-video';
    layer.innerHTML = `<video playsinline muted></video>`;
    container.querySelector('.viewer-canvas')?.appendChild(layer);
  }
  return layer;
}

function updateLiveButton() {
  const viewer = state.viewer;
  if (!viewer) return;
  const current = state.filtered[viewer.index];
  const container = getViewerContainer();
  if (!container) return;
  ensureViewerTopbar();
  ensureViewerSideNav();
  bindViewerActivity(container);
  const panel = container.querySelector('.viewer-panel');
  updateSideNavPosition(!!(panel && !panel.classList.contains('hidden')));
  armNavIdle();
  let btn = container.querySelector('.viewer-live-btn');
  if (!btn) {
    btn = document.createElement('button');
    btn.className = 'viewer-live-btn';
    btn.title = '播放 Live';
    btn.addEventListener('click', () => {
      const item = state.filtered[viewer.index];
      if (!item || !item.videoBlob) return;
      const { layer, video } = getLiveVideoRefs();
      if (layer && layer.classList.contains('active') && video && video.src) {
        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
        return;
      }
      openLiveVideoInline(item);
    });
    const slot = container.querySelector('.topbar-live-slot');
    if (slot) {
      btn.classList.add('in-topbar');
      slot.appendChild(btn);
    } else {
      container.appendChild(btn);
    }
  }
  let muteBtn = container.querySelector('.viewer-mute-btn');
  if (!muteBtn) {
    muteBtn = document.createElement('button');
    muteBtn.className = 'viewer-mute-btn';
    muteBtn.title = '静音/取消静音';
    muteBtn.dataset.muted = String(state.liveMuted);
    muteBtn.addEventListener('click', () => {
      state.liveMuted = !state.liveMuted;
      muteBtn.dataset.muted = String(state.liveMuted);
      const layer = document.querySelector('.viewer-live-video');
      const video = layer?.querySelector('video');
      if (video) video.muted = state.liveMuted;
    });
    const slot = container.querySelector('.topbar-live-slot');
    if (slot) slot.appendChild(muteBtn); else container.appendChild(muteBtn);
  } else {
    muteBtn.dataset.muted = String(state.liveMuted);
  }
  if (current && current.isLive && current.videoBlob) {
    btn.classList.add('active');
    btn.classList.remove('hidden');
    muteBtn.classList.remove('hidden');
  } else {
    btn.classList.remove('active');
    btn.classList.add('hidden');
    muteBtn.classList.add('hidden');
  }
  syncLiveButtonState();
  console.debug('[viewer] live buttons', { index: viewer.index, live: !!(current && current.isLive && current.videoBlob) });
}

function openLiveVideoInline(item) {
  const layer = ensureLiveVideoLayer();
  if (!layer) return;
  const video = layer.querySelector('video');
  if (!video) return;
  const previewImage = state.viewer?.image || null;
  const videoUrl = URL.createObjectURL(item.videoBlob);
  video.playsInline = true;
  video.preload = 'auto';
  video.controls = false;
  video.src = videoUrl;
  video.currentTime = 0;
  video.muted = state.liveMuted;
  console.debug('[live-debug] open', {
    name: item.name,
    blobType: item.videoBlob?.type || '(empty)',
    blobSize: item.videoBlob?.size || 0,
    muted: video.muted,
    isAndroid: !!platformInfo?.isAndroid,
    canPlayMp4: video.canPlayType('video/mp4'),
    canPlayQuickTime: video.canPlayType('video/quicktime')
  });
  video.onloadedmetadata = () => {
    console.debug('[live-debug] loadedmetadata', {
      name: item.name,
      width: video.videoWidth,
      height: video.videoHeight,
      duration: video.duration
    });
    if (!state.userAdjusted) {
      fitImageToCanvas();
    }
    syncVideoToImage();
  };
  video.oncanplay = () => {
    console.debug('[live-debug] canplay', { name: item.name });
  };
  video.onwaiting = () => {
    console.debug('[live-debug] waiting', { name: item.name, t: video.currentTime });
  };
  video.onstalled = () => {
    console.debug('[live-debug] stalled', { name: item.name, t: video.currentTime });
  };
  video.onerror = () => {
    const mediaError = video.error;
    console.debug('[live-debug] video error', {
      name: item.name,
      code: mediaError?.code || null,
      message: mediaError?.message || '(no-message)'
    });
    if (previewImage) {
      previewImage.style.opacity = '';
    }
    closeLiveVideoInline();
  };
  layer.classList.add('active');
  if (state.viewer && state.viewer.viewed) {
    state.viewer.view(state.viewer.index);
  }
  requestAnimationFrame(() => logViewerRects('live-start'));
  video.onended = () => {
    console.debug('[viewer] live ended', { name: item.name });
    closeLiveVideoInline();
  };
  video.onplay = () => {
    if (previewImage) {
      previewImage.style.opacity = '0';
    }
    state.livePlaying = true;
    syncLiveButtonState();
    console.debug('[live-debug] onplay', { name: item.name, t: video.currentTime });
  };
  video.onpause = () => {
    state.livePlaying = false;
    syncLiveButtonState();
    console.debug('[live-debug] onpause', { name: item.name, t: video.currentTime });
  };
  console.debug('[viewer] live play', { name: item.name });
  video.play().catch((err) => {
    console.debug('[live-debug] play reject', {
      name: item.name,
      message: err?.message || String(err),
      isAndroid: !!platformInfo?.isAndroid
    });
    if (platformInfo?.isAndroid) {
      video.muted = true;
      state.liveMuted = true;
      const muteBtn = document.querySelector('.viewer-mute-btn');
      if (muteBtn) muteBtn.dataset.muted = 'true';
      video.controls = true;
      video.play().catch((retryErr) => {
        console.debug('[live-debug] retry reject', {
          name: item.name,
          message: retryErr?.message || String(retryErr)
        });
      });
    }
  });
}

function closeLiveVideoInline() {
  const layer = document.querySelector('.viewer-live-video');
  if (!layer) return;
  const video = layer.querySelector('video');
  layer.classList.remove('active');
  if (video) {
    video.pause();
    video.onended = null;
    video.onplay = null;
    video.onpause = null;
    video.oncanplay = null;
    video.onwaiting = null;
    video.onstalled = null;
    video.onerror = null;
    video.controls = false;
    if (video.src) URL.revokeObjectURL(video.src);
    video.removeAttribute('src');
  }
  if (state.viewer && state.viewer.image) {
    state.viewer.image.style.opacity = '';
  }
  state.livePlaying = false;
  syncLiveButtonState();
}

function getLiveVideoRefs() {
  const layer = document.querySelector('.viewer-live-video');
  const video = layer?.querySelector('video');
  return { layer, video };
}

function syncLiveButtonState() {
  const container = getViewerContainer();
  if (!container) return;
  const btn = container.querySelector('.viewer-live-btn');
  if (!btn) return;
  const { layer, video } = getLiveVideoRefs();
  const playing = !!(layer && layer.classList.contains('active') && video && !video.paused && !video.ended);
  btn.dataset.state = playing ? 'pause' : 'play';
  btn.title = playing ? '暂停 Live' : '播放 Live';
}

function buildDetailRows(item) {
  const exif = item.exif || {};
  return [
    ['类型', item.isLive ? 'Live Photo' : '静态图片'],
    ['厂商', item.isLive ? item.liveType : '-'],
    ['拍摄时间', exif.DateTimeOriginal || exif.DateTime || '-'],
    ['机型', exif.Model || '-'],
    ['厂商名', exif.Make || '-'],
    ['镜头', exif.LensModel || '-'],
    ['尺寸', exif.ImageWidth && exif.ImageHeight ? `${exif.ImageWidth} × ${exif.ImageHeight}` : '-'],
  ];
}

function removeViewerPanel() {
  const panel = document.querySelector('.viewer-panel');
  if (panel) panel.remove();
}

async function readDirectoryFiles(dirHandle) {
  const files = [];
  async function walk(handle, path) {
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        file._path = path + name;
        files.push(file);
      } else if (entry.kind === 'directory') {
        await walk(entry, path + name + '/');
      }
    }
  }
  await walk(dirHandle, '');
  return files;
}

function pickDirectoryWithInput() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,video/*';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.setAttribute('mozdirectory', '');
    input.style.position = 'fixed';
    input.style.left = '0';
    input.style.top = '0';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      input.remove();
      resolve(files);
    }, { once: true });
    input.click();
  });
}

async function scanFiles(files) {
  const items = [];
  const byBase = new Map();
  for (const f of files) {
    const base = f.name.replace(/\.[^/.]+$/, '').toLowerCase();
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(f);
  }

  const queue = files.filter(f => f.type.startsWith('image/'));
  let idx = 0;
  for (const file of queue) {
    const item = await analyzeFile(file, byBase);
    items.push(item);
    idx++;
    if (idx % 50 === 0) await new Promise(r => setTimeout(r, 0));
  }
  return items;
}

async function analyzeFile(file, byBase) {
  const id = crypto.randomUUID();
  const item = { id, name: file.name, file, isLive: false, liveType: '静态', videoBlob: null, thumbLoaded: false, exif: null, exifTime: null, exifChecked: false, objectUrl: null };
  const base = file.name.replace(/\.[^/.]+$/, '').toLowerCase();
  const siblings = byBase.get(base) || [];

  // iOS Live Photo: image + .mov with same basename
  const mov = siblings.find(f => f.name.toLowerCase().endsWith('.mov'));
  if (mov) {
    item.isLive = true;
    item.liveType = 'iOS Live Photo';
    item.videoBlob = mov.type ? mov : new Blob([mov], { type: 'video/quicktime' });
    return item;
  }

  // Motion Photo / vendor XMP tags / embedded video
  try {
    const buf = await file.arrayBuffer();
    const xmp = extractXmp(buf);
    const exif = extractExif(buf);
    item.exifChecked = true;
    if (exif && Object.keys(exif).length) {
      item.exif = exif;
      item.exifTime = parseExifTime(exif);
    }
    if (xmp) {
      if (/MotionPhoto/i.test(xmp) || /MicroVideo/i.test(xmp)) {
        item.isLive = true;
        item.liveType = 'Google Motion Photo';
      }
      if (/Xiaomi|xiaomi/i.test(xmp)) { item.isLive = true; item.liveType = 'Xiaomi Live Photo'; }
      if (/vivo/i.test(xmp)) { item.isLive = true; item.liveType = 'vivo Live Photo'; }
      if (/OPPO|oppo/i.test(xmp)) { item.isLive = true; item.liveType = 'OPPO Live Photo'; }
      if (/HONOR|honor/i.test(xmp)) { item.isLive = true; item.liveType = 'HONOR Live Photo'; }
    }

    const videoBlob = extractEmbeddedVideo(buf);
    if (videoBlob) {
      item.isLive = true;
      item.liveType = item.liveType === '静态' ? '内嵌视频' : item.liveType;
      item.videoBlob = videoBlob;
    }
  } catch {
    // ignore
  }
  return item;
}

function extractXmp(buf) {
  const text = new TextDecoder().decode(buf);
  const start = text.indexOf('<x:xmpmeta');
  if (start === -1) return null;
  const end = text.indexOf('</x:xmpmeta>');
  if (end === -1) return null;
  return text.slice(start, end + 12);
}

function extractEmbeddedVideo(buf) {
  // look for mp4 ftyp box within jpeg
  const bytes = new Uint8Array(buf);
  let offset = -1;
  for (let i = 0; i < bytes.length - 12; i++) {
    if (bytes[i+4] === 0x66 && bytes[i+5] === 0x74 && bytes[i+6] === 0x79 && bytes[i+7] === 0x70) {
      offset = i;
      break;
    }
  }
  if (offset === -1) return null;
  const video = bytes.slice(offset);
  return new Blob([video], { type: 'video/mp4' });
}

async function exportItem(item) {
  if (!item.videoBlob) {
    // fallback: export still
    downloadBlob(item.file, item.name.replace(/\.[^/.]+$/, '') + '.jpg');
    return;
  }
  // Most compatible: download video blob directly
  downloadBlob(item.videoBlob, item.name.replace(/\.[^/.]+$/, '') + '.mp4');
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function extractExif(buf) {
  const view = new DataView(buf);
  if (view.getUint16(0, false) !== 0xFFD8) return {};
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xFF) break;
    const marker = view.getUint16(offset, false);
    const length = view.getUint16(offset + 2, false);
    if (length < 2) break;
    if (offset + 2 + length > view.byteLength) break;
    if (marker === 0xFFE1) {
      const exifHeader = offset + 4;
      if (exifHeader + 6 > view.byteLength) return {};
      if (view.getUint32(exifHeader, false) !== 0x45786966) return {};
      const tiff = exifHeader + 6;
      if (tiff + 8 > view.byteLength) return {};
      const little = view.getUint16(tiff, false) === 0x4949;
      const firstIFD = view.getUint32(tiff + 4, little);
      const base = tiff;
      const data = parseIFD(view, base + firstIFD, little, base);
      const exifIFD = data.ExifIFDPointer;
      const gpsIFD = data.GPSInfoIFDPointer;
      const exifData = exifIFD ? parseIFD(view, base + exifIFD, little, base) : {};
      const gpsData = gpsIFD ? parseIFD(view, base + gpsIFD, little, base) : {};
      return { ...data, ...exifData, ...gpsData };
    }
    if (!length) break;
    offset += 2 + length;
  }
  return {};
}

function parseIFD(view, offset, little, base) {
  if (offset + 2 > view.byteLength) return {};
  const entries = view.getUint16(offset, little);
  const out = {};
  for (let i = 0; i < entries; i++) {
    const entry = offset + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const count = view.getUint32(entry + 4, little);
    const valueOffset = entry + 8;
    const value = readTagValue(view, type, count, valueOffset, little, base);
    const name = TAGS[tag];
    if (name) out[name] = value;
  }
  return out;
}

function readTagValue(view, type, count, valueOffset, little, base) {
  const typeSizes = { 1:1, 2:1, 3:2, 4:4, 5:8, 7:1 };
  const size = (typeSizes[type] || 1) * count;
  let offset = size <= 4 ? valueOffset : base + view.getUint32(valueOffset, little);
  if (offset + size > view.byteLength) return null;
  if (type === 2) {
    const bytes = new Uint8Array(view.buffer, offset, count);
    return new TextDecoder().decode(bytes).replace(/\0/g, '').trim();
  }
  if (type === 3) return view.getUint16(offset, little);
  if (type === 4) return view.getUint32(offset, little);
  if (type === 5) {
    const num = view.getUint32(offset, little);
    const den = view.getUint32(offset + 4, little);
    return den ? (num / den).toFixed(2) : num;
  }
  return null;
}

const TAGS = {
  0x010F: 'Make',
  0x0110: 'Model',
  0x0132: 'DateTime',
  0x8769: 'ExifIFDPointer',
  0x8825: 'GPSInfoIFDPointer',
  0x9003: 'DateTimeOriginal',
  0xA434: 'LensModel',
  0xA002: 'ImageWidth',
  0xA003: 'ImageHeight'
};

// Performance + detection + detail panel overrides
Object.assign(TAGS, {
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude',
});

function formatGps(exif) {
  const lat = exif.GPSLatitude;
  const lon = exif.GPSLongitude;
  if (!Array.isArray(lat) || !Array.isArray(lon) || lat.length < 3 || lon.length < 3) return null;
  const toDeg = (arr, ref) => {
    const d = Number(arr[0]);
    const m = Number(arr[1]);
    const s = Number(arr[2]);
    if (![d, m, s].every(Number.isFinite)) return null;
    let out = d + m / 60 + s / 3600;
    if (ref === 'S' || ref === 'W') out = -out;
    return out;
  };
  const latDeg = toDeg(lat, exif.GPSLatitudeRef);
  const lonDeg = toDeg(lon, exif.GPSLongitudeRef);
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) return null;
  return `${latDeg.toFixed(6)}, ${lonDeg.toFixed(6)}`;
}

function buildDetailRows(item) {
  const exif = item.exif || {};
  const gps = formatGps(exif);
  return [
    ['文件名', item.name || '-'],
    ['类型', item.isLive ? 'Live Photo' : '静态图片'],
    ['厂商', item.isLive ? item.liveType : '-'],
    ['拍摄时间', exif.DateTimeOriginal || exif.DateTime || '-'],
    ['机型', exif.Model || '-'],
    ['厂商名', exif.Make || '-'],
    ['镜头', exif.LensModel || '-'],
    ['尺寸', exif.ImageWidth && exif.ImageHeight ? `${exif.ImageWidth} x ${exif.ImageHeight}` : '-'],
    ['定位', gps || '-'],
  ];
}

function parseXmpNumber(xmp, key) {
  const match = xmp.match(new RegExp(`${key}[^\\d]*(\\d+)`, 'i'));
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
}

function extractEmbeddedVideo(buf, xmpOffset = null) {
  const bytes = new Uint8Array(buf);
  const minBytes = 200 * 1024;
  const candidates = [];

  if (Number.isFinite(xmpOffset) && xmpOffset > 0) {
    const fromStart = xmpOffset;
    const fromEnd = bytes.length - xmpOffset;
    if (fromStart < bytes.length - 12) candidates.push(fromStart);
    if (fromEnd > 0 && fromEnd < bytes.length - 12) candidates.push(fromEnd);
  }

  if (!candidates.length) {
    for (let i = 0; i < bytes.length - 12; i++) {
      if (bytes[i + 4] === 0x66 && bytes[i + 5] === 0x74 && bytes[i + 6] === 0x79 && bytes[i + 7] === 0x70) {
        candidates.push(i);
        break;
      }
    }
  }

  for (const offset of candidates) {
    const video = bytes.slice(offset);
    if (video.length < minBytes) continue;
    if (video[4] === 0x66 && video[5] === 0x74 && video[6] === 0x79 && video[7] === 0x70) {
      return new Blob([video], { type: 'video/mp4' });
    }
  }
  return null;
}

async function readHeadBytes(file, size) {
  const slice = file.slice(0, Math.min(size, file.size));
  return slice.arrayBuffer();
}

async function scanFiles(files) {
  const items = [];
  const byBase = new Map();
  for (const f of files) {
    const base = f.name.replace(/\.[^/.]+$/, '').toLowerCase();
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(f);
  }

  const queue = files.filter(f => f.type.startsWith('image/'));
  const concurrency = 4;
  for (let start = 0; start < queue.length; start += concurrency) {
    const chunk = queue.slice(start, start + concurrency);
    const chunkItems = await Promise.all(chunk.map(file => analyzeFile(file, byBase)));
    items.push(...chunkItems);
    if (start % 20 === 0) {
      setStatus(`Scanning ${Math.min(start + chunk.length, queue.length)}/${queue.length}...`);
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return items;
}

function analyzeFile(file, byBase) {
  return (async () => {
    const id = crypto.randomUUID();
    const item = { id, name: file.name, file, isLive: false, liveType: 'Still', videoBlob: null, thumbLoaded: false, exif: null, exifTime: null, exifChecked: false, objectUrl: null };
    const base = file.name.replace(/\.[^/.]+$/, '').toLowerCase();
    const siblings = byBase.get(base) || [];

    const mov = siblings.find(f => f.name.toLowerCase().endsWith('.mov'));
    if (mov) {
      item.isLive = true;
      item.liveType = 'iOS Live Photo';
      item.videoBlob = mov.type ? mov : new Blob([mov], { type: 'video/quicktime' });
      return item;
    }

    try {
      const head = await readHeadBytes(file, 1024 * 1024);
      const xmp = extractXmp(head);
      const exif = extractExif(head);
      item.exifChecked = true;
      if (exif && Object.keys(exif).length) {
        item.exif = exif;
        item.exifTime = parseExifTime(exif);
      }

      let vendorType = null;
      let hasMotionTag = false;
      let microOffset = null;
      if (xmp) {
        hasMotionTag = /MotionPhoto/i.test(xmp) || /MicroVideo/i.test(xmp);
        microOffset = parseXmpNumber(xmp, 'MicroVideoOffset');
        if (/Xiaomi|xiaomi/i.test(xmp)) vendorType = 'Xiaomi Live Photo';
        if (/vivo/i.test(xmp)) vendorType = 'vivo Live Photo';
        if (/OPPO|oppo/i.test(xmp)) vendorType = 'OPPO Live Photo';
        if (/HONOR|honor/i.test(xmp)) vendorType = 'HONOR Live Photo';
      }

      if (hasMotionTag || microOffset != null || file.size < 12 * 1024 * 1024) {
        const full = await file.arrayBuffer();
        const videoBlob = extractEmbeddedVideo(full, microOffset);
        if (videoBlob) {
          item.isLive = true;
          item.liveType = vendorType || (hasMotionTag ? 'Google Motion Photo' : 'Embedded Video');
          item.videoBlob = videoBlob;
        }
      }
    } catch {
      // ignore
    }
    return item;
  })();
}

function readTagValue(view, type, count, valueOffset, little, base) {
  const typeSizes = { 1:1, 2:1, 3:2, 4:4, 5:8, 7:1 };
  const size = (typeSizes[type] || 1) * count;
  let offset = size <= 4 ? valueOffset : base + view.getUint32(valueOffset, little);
  if (offset + size > view.byteLength) return null;
  if (type === 2) {
    const bytes = new Uint8Array(view.buffer, offset, count);
    return new TextDecoder().decode(bytes).replace(/\0/g, '').trim();
  }
  if (type === 3) {
    if (count <= 1) return view.getUint16(offset, little);
    const out = [];
    for (let i = 0; i < count; i++) out.push(view.getUint16(offset + i * 2, little));
    return out;
  }
  if (type === 4) {
    if (count <= 1) return view.getUint32(offset, little);
    const out = [];
    for (let i = 0; i < count; i++) out.push(view.getUint32(offset + i * 4, little));
    return out;
  }
  if (type === 5) {
    const readRational = (off) => {
      const num = view.getUint32(off, little);
      const den = view.getUint32(off + 4, little);
      return den ? (num / den) : num;
    };
    if (count <= 1) return readRational(offset);
    const out = [];
    for (let i = 0; i < count; i++) out.push(readRational(offset + i * 8));
    return out;
  }
  return null;
}

// Scan overlay + incremental grid rendering overrides
(function () {
  if (!state.itemById) state.itemById = new Map();

  function ensureScanOverlay() {
    let mask = document.getElementById('scanOverlay');
    if (mask) return mask;
    mask = document.createElement('div');
    mask.id = 'scanOverlay';
    mask.className = 'scan-overlay hidden';
    mask.innerHTML = '<div class="scan-card"><div class="scan-spinner" aria-hidden="true"></div><div id="scanText" class="scan-text">Scanning...</div><div class="scan-bar"><div id="scanBar" class="scan-bar-inner"></div></div></div>';
    document.body.appendChild(mask);
    return mask;
  }

  function showScanOverlay() {
    const mask = ensureScanOverlay();
    mask.classList.remove('hidden');
  }

  function hideScanOverlay() {
    const mask = ensureScanOverlay();
    mask.classList.add('hidden');
  }

  function updateScanOverlay(done, total, label) {
    const mask = ensureScanOverlay();
    const txt = mask.querySelector('#scanText');
    const bar = mask.querySelector('#scanBar');
    const safeTotal = total > 0 ? total : 1;
    const pct = Math.max(0, Math.min(100, Math.round((done / safeTotal) * 100)));
    if (txt) txt.textContent = `${label || 'Scanning'} ${done}/${total} (${pct}%)`;
    if (bar) bar.style.width = `${pct}%`;
  }

  async function scanFilesWithProgress(files) {
    const items = [];
    const byBase = new Map();
    for (const f of files) {
      const base = f.name.replace(/\.[^/.]+$/, '').toLowerCase();
      if (!byBase.has(base)) byBase.set(base, []);
      byBase.get(base).push(f);
    }

    const queue = files.filter(f => f.type.startsWith('image/'));
    const total = queue.length;
    const concurrency = 6;
    let done = 0;

    updateScanOverlay(0, total, 'Scanning');
    for (let start = 0; start < queue.length; start += concurrency) {
      const chunk = queue.slice(start, start + concurrency);
      const chunkItems = await Promise.all(chunk.map(file => analyzeFile(file, byBase)));
      items.push(...chunkItems);
      done += chunk.length;
      updateScanOverlay(done, total, 'Scanning');
      if (done % 24 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    return items;
  }

  async function startScanOverride() {
    if (!state.files.length || state.scanning) return;
    state.scanning = true;
    showScanOverlay();
    setStatus('Scanning...');

    if (state.items.length) {
      state.items.forEach((item) => {
        if (item.objectUrl) {
          URL.revokeObjectURL(item.objectUrl);
          item.objectUrl = null;
        }
        if (item.thumbUrl) {
          URL.revokeObjectURL(item.thumbUrl);
          item.thumbUrl = null;
        }
      });
    }

    state.items = await scanFilesWithProgress(state.files);
    state.itemById = new Map(state.items.map(i => [i.id, i]));
    renderGrid();
    updateStats();
    state.scanning = false;
    hideScanOverlay();
    setStatus('Scan complete');
  }

  function loadThumbnailOverride(item, card) {
    try {
      const holder = card.querySelector('.thumb');
      if (!holder || holder.querySelector('img')) return;
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      if (!item.objectUrl) item.objectUrl = URL.createObjectURL(item.file);
      img.src = item.objectUrl;
      holder.textContent = '';
      holder.appendChild(img);
      item.thumbLoaded = true;
    } catch {
      // leave placeholder
    }
  }

  function renderGridOverride(options = {}) {
    const { skipGallery = false } = options;
    if (renderTimer) {
      clearTimeout(renderTimer);
      renderTimer = null;
    }

    el.grid.innerHTML = '';
    bindGridEvents();

    const list = state.items.filter(i => state.filter === 'all' || (state.filter === 'live' ? i.isLive : !i.isLive));
    const sorted = applySort(list);
    state.filtered = sorted;
    console.debug('[grid] render', {
      total: sorted.length,
      live: sorted.filter(i => i.isLive).length,
      filter: state.filter
    });
    if (!skipGallery) updateViewerGallery();

    const map = state.itemById && state.itemById.size ? state.itemById : new Map(state.items.map(i => [i.id, i]));
    state.itemById = map;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.getAttribute('data-id');
        const item = map.get(id);
        if (item) loadThumbnailOverride(item, entry.target);
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '200px' });

    const groups = buildGroups(sorted);
    let index = 0;
    const chunkSize = 180;

    const renderChunk = () => {
      const frag = document.createDocumentFragment();
      let count = 0;
      while (index < groups.length && count < chunkSize) {
        const entry = groups[index++];
        count++;
        if (entry.type === 'group') {
          const header = document.createElement('div');
          header.className = 'group-header';
          header.textContent = entry.label;
          frag.appendChild(header);
          continue;
        }

        const item = entry.item;
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.id = item.id;
        if (state.selection.has(item.id)) card.classList.add('selected');

        const thumb = document.createElement('div');
        thumb.className = 'thumb';
        thumb.textContent = 'Loading...';

        if (item.isLive) {
          const badge = document.createElement('div');
          badge.className = 'live-icon';
          badge.title = 'Live Photo';
          card.appendChild(badge);
        }

        const check = document.createElement('div');
        check.className = 'check';
        check.textContent = state.selection.has(item.id) ? '✓' : '';

        card.appendChild(thumb);
        card.appendChild(check);
        frag.appendChild(card);
        observer.observe(card);
      }

      el.grid.appendChild(frag);
      if (index < groups.length) {
        requestAnimationFrame(renderChunk);
      }
    };

    requestAnimationFrame(renderChunk);
  }

  startScan = startScanOverride;
  renderGrid = renderGridOverride;
  loadThumbnail = loadThumbnailOverride;
})();
