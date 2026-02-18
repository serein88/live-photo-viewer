const state = {
  files: [],
  items: [],
  filtered: [],
  filter: 'all',
  selection: new Set(),
  viewer: null,
  liveMuted: true,
  livePlaying: false,
  livePathMode: 'auto',
  layout: 'auto',
  scanning: false,
  sortKey: 'mtime_desc',
  exifQueueRunning: false,
  userAdjusted: false,
  viewerUrlCache: new Map(),
  currentViewerIndex: -1,
  scanByBase: null,
};
const EXIF_SLICE_SIZE = 256 * 1024;
const MEDIAINFO_WASM_PATH = 'vendor/MediaInfoModule.wasm';
const MP4BOX_MODULE_PATH = './vendor/mp4box.all.esm.mjs';
const FFMPEG_CORE_PATH = 'vendor/ffmpeg-core.js';
const FFMPEG_WASM_PATH = 'vendor/ffmpeg-core.wasm';
const FFMPEG_WORKER_PATH = 'vendor/ffmpeg-core.worker.js';
const FFMPEG_CORE_MAIN_NAME = 'main';
const FFMPEG_ASSET_VERSION = 'core-st-20260218-1';
const ENABLE_VERBOSE_DEBUG_LOGS = typeof window !== 'undefined' && !!window.__LPV_VERBOSE_DEBUG__;
const MUTED_DEBUG_PREFIXES = Object.freeze([
  '[viewer]',
  '[viewer-nav]',
  '[live-debug]',
  '[grid]',
  '[picker-debug]',
  '[dir-pick]',
  '[meta]',
  '[live-detect]',
  '[track-probe]',
]);
const ORIGINAL_CONSOLE_DEBUG = typeof console !== 'undefined' && console.debug ? console.debug.bind(console) : null;
if (ORIGINAL_CONSOLE_DEBUG && !ENABLE_VERBOSE_DEBUG_LOGS) {
  console.debug = (...args) => {
    const head = typeof args?.[0] === 'string' ? args[0] : '';
    if (MUTED_DEBUG_PREFIXES.some((prefix) => head.startsWith(prefix))) return;
    ORIGINAL_CONSOLE_DEBUG(...args);
  };
}
const EXIFR_PARSE_OPTIONS_BASE = Object.freeze({
  tiff: true,
  ifd0: true,
  exif: true,
  gps: true,
  ifd1: false,
  interop: false,
  makerNote: false,
  userComment: false,
});
let renderTimer = null;
let mediaInfoInstancePromise = null;
let mediaInfoAnalyzeQueue = Promise.resolve();
let mediaInfoUnavailableLogged = false;
let mp4BoxModulePromise = null;
let ffmpegInstancePromise = null;
let ffmpegRunQueue = Promise.resolve();
let ffmpegUnavailableLogged = false;
const VIEWER_PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
const IMAGE_EXTS = new Set(['jpg','jpeg','png','webp','gif','bmp','tif','tiff','heic','heif','avif']);
const VIDEO_EXTS = new Set(['mp4','mov','m4v','3gp','webm','mkv','avi']);

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
  playbackPathSelect: document.getElementById('playbackPathSelect'),
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
let navActivityTick = 0;

function detectPlatform() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isWindows = /Win/i.test(platform);
  return { isAndroid, isIOS, isWindows };
}

const platformInfo = detectPlatform();
const browserHint = getBrowserHint();
const supportsDirectoryPicker = 'showDirectoryPicker' in window;
const supportsWebkitDir = 'webkitdirectory' in el.dirPicker;
const supportsFolder = supportsDirectoryPicker || supportsWebkitDir;
if (!supportsFolder && !platformInfo.isIOS) {
  el.folderBtn.disabled = true;
  el.folderBtn.title = 'This browser does not support folder selection. Please use multi-file selection.';
}
if (platformInfo.isAndroid) {
  // Android strategy: prefer native multi-file picker for better Live compatibility.
  el.folderBtn.title = '选择照片（多选）';
  el.folderBtn.setAttribute('aria-label', '选择照片（多选）');
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
let viewerNoticeTimer = null;
function showViewerNotice(text, options = {}) {
  const { duration = 2200, tone = 'info' } = options;
  const container = getViewerContainer?.() || null;
  if (!container) {
    setStatus(text);
    return;
  }
  let notice = container.querySelector('.viewer-notice');
  if (!notice) {
    notice = document.createElement('div');
    notice.className = 'viewer-notice';
    container.appendChild(notice);
  }
  notice.textContent = text;
  notice.dataset.tone = tone;
  notice.classList.add('show');
  if (viewerNoticeTimer) clearTimeout(viewerNoticeTimer);
  viewerNoticeTimer = setTimeout(() => {
    notice.classList.remove('show');
  }, duration);
}

function preShowScanOverlay(total = 0, label = 'Indexing') {
  let mask = document.getElementById('scanOverlay');
  if (!mask) {
    mask = document.createElement('div');
    mask.id = 'scanOverlay';
    mask.className = 'scan-overlay hidden';
    mask.innerHTML = '<div class="scan-card"><div class="scan-spinner" aria-hidden="true"></div><div id="scanText" class="scan-text">Scanning...</div><div class="scan-bar"><div id="scanBar" class="scan-bar-inner"></div></div></div>';
    document.body.appendChild(mask);
  }
  const txt = mask.querySelector('#scanText');
  const bar = mask.querySelector('#scanBar');
  const t = Math.max(1, Number(total) || 1);
  if (txt) txt.textContent = `${label} 0/${t} (0%)`;
  if (bar) bar.style.width = '0%';
  mask.classList.remove('hidden');
}

function preHideScanOverlay() {
  const mask = document.getElementById('scanOverlay');
  if (mask) mask.classList.add('hidden');
}

function setFilter(f) {
  state.filter = f;
  renderGrid();
}

function getLivePathMode() {
  const raw = el.playbackPathSelect?.value || state.livePathMode || 'auto';
  return raw === 'b_force' ? 'b_force' : 'auto';
}
state.livePathMode = getLivePathMode();

function isForcedBPathMode() {
  return getLivePathMode() === 'b_force';
}

function getFileExt(name) {
  if (!name) return '';
  const idx = name.lastIndexOf('.');
  if (idx < 0) return '';
  return name.slice(idx + 1).toLowerCase();
}

function isImageFile(file) {
  if (file?.type && file.type.startsWith('image/')) return true;
  const ext = getFileExt(file?.name || '');
  return IMAGE_EXTS.has(ext);
}

function isVideoFile(file) {
  if (file?.type && file.type.startsWith('video/')) return true;
  const ext = getFileExt(file?.name || '');
  return VIDEO_EXTS.has(ext);
}

function getBrowserHint() {
  const ua = navigator.userAgent || '';
  if (/EdgA\//i.test(ua)) return 'edge-android';
  if (/Chrome\//i.test(ua) && /Android/i.test(ua)) return 'chrome-android';
  if (/VIA/i.test(ua)) return 'via';
  if (/MQQBrowser/i.test(ua)) return 'qqbrowser';
  if (/UCBrowser/i.test(ua)) return 'uc';
  return 'unknown';
}

function revokeVideoObjectUrl(video) {
  const current = video?._objectUrl || '';
  if (current) {
    try { URL.revokeObjectURL(current); } catch {}
  }
  if (video) video._objectUrl = '';
}

function resetVideoElementSource(video) {
  if (!video) return;
  try { video.pause(); } catch {}
  revokeVideoObjectUrl(video);
  video.removeAttribute('src');
  try { video.load(); } catch {}
}

function setVideoBlobSource(video, blob) {
  if (!video || !blob) return '';
  resetVideoElementSource(video);
  const url = URL.createObjectURL(blob);
  video._objectUrl = url;
  video.src = url;
  return url;
}

function sleep(ms) {
  const delay = Number.isFinite(ms) ? Math.max(0, ms) : 0;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function applyVideoAudioState(video, muted) {
  if (!video) return;
  const isMuted = !!muted;
  video.defaultMuted = isMuted;
  video.muted = isMuted;
  video.volume = isMuted ? 0 : 1;
  if (isMuted) {
    video.setAttribute('muted', '');
  } else {
    video.removeAttribute('muted');
  }
}

function diagnosePickerSource(files, source) {
  const list = Array.isArray(files) ? files : [];
  const count = list.length;
  const sampleLimit = 400;
  const sampled = count > sampleLimit ? list.slice(0, sampleLimit) : list;
  const sampleCount = sampled.length;
  const browser = getBrowserHint();
  const relativeCount = sampled.reduce((acc, f) => acc + ((f?.webkitRelativePath || '').length > 0 ? 1 : 0), 0);
  const relativeSample = sampled.find(f => (f?.webkitRelativePath || '').length > 0)?.webkitRelativePath || '';
  const typeMissingCount = sampled.reduce((acc, f) => acc + (f?.type ? 0 : 1), 0);
  const imageCount = sampled.reduce((acc, f) => acc + (isImageFile(f) ? 1 : 0), 0);
  const videoCount = sampled.reduce((acc, f) => acc + (isVideoFile(f) ? 1 : 0), 0);

  let inferredPicker = 'unknown';
  let confidence = 'low';
  const reasons = [];

  if (source === 'dir' || relativeCount > 0) {
    inferredPicker = 'directory-picker';
    confidence = 'high';
    reasons.push('webkitRelativePath present or source=dir');
  } else if (platformInfo.isAndroid && source === 'file') {
    if (browser === 'via' || browser === 'qqbrowser' || browser === 'uc') {
      inferredPicker = 'vendor-custom-likely';
      confidence = 'medium';
      reasons.push(`browser=${browser}`);
    } else if (browser === 'chrome-android' || browser === 'edge-android') {
      inferredPicker = 'android-native-likely';
      confidence = 'medium';
      reasons.push(`browser=${browser}`);
    } else {
      inferredPicker = 'android-unknown';
      confidence = 'low';
      reasons.push('android + file picker, browser unknown');
    }
  }

  const result = {
    source,
    platform: platformInfo,
    browser,
    fileCount: count,
    sampleCount,
    imageCount,
    videoCount,
    missingTypeCount: typeMissingCount,
    relativeCount,
    relativeSample,
    inferredPicker,
    confidence,
    reasons
  };
  console.debug('[picker-debug] diagnose', result);
  return result;
}

async function handleSelectedFiles(files, source) {
  if (!files || !files.length) {
    preHideScanOverlay();
    return;
  }
  const incomingCount = Number(files.length) || 0;
  if (platformInfo.isAndroid && incomingCount > 0 && source !== 'mcp') {
    preShowScanOverlay(incomingCount, 'Indexing');
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
  const normalized = Array.isArray(files) ? files : Array.from(files || []);
  setTimeout(() => diagnosePickerSource(normalized, source), 0);
  if (normalized.length >= 1 && normalized.every(isBundleFile)) {
    setStatus('MCP bundle detected, loading...');
    let loadedAll = [];
    for (const f of normalized) {
      const loaded = await loadBundle(f);
      loadedAll = loadedAll.concat(loaded);
    }
    if (loadedAll.length) {
      state.files = loadedAll;
      setStatus(`Imported from MCP bundle: ${state.files.length} files`);
      startScan();
    } else {
      setStatus('Failed to load MCP bundle');
    }
    return;
  }
  state.files = normalized;
  if (source === 'dir') {
    setStatus(`Folder selected: ${state.files.length} files`);
  } else if (source === 'mcp') {
    setStatus(`Imported via MCP: ${state.files.length} files`);
  } else {
    setStatus(`Selected ${state.files.length} files, scanning...`);
  }
  if (platformInfo.isAndroid) {
    setTimeout(() => startScan(), 0);
  } else {
    startScan();
  }
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
if (el.playbackPathSelect) {
  el.playbackPathSelect.addEventListener('change', () => {
    const mode = getLivePathMode();
    state.livePathMode = mode;
    const label = mode === 'b_force' ? '临时强制B链路（ffmpeg）' : '自动链路（A优先）';
    setStatus(`播放链路已切换：${label}`);
    console.log('[live-path] mode', { mode });
    const current = state.viewer && state.filtered ? state.filtered[state.viewer.index] : null;
    if (current?.isLive && state.livePlaying) {
      openLiveVideoInline(current);
    }
  });
}

el.filePicker.addEventListener('change', () => {
  handleSelectedFiles(el.filePicker.files || [], 'file');
});
el.dirPicker.addEventListener('change', () => {
  handleSelectedFiles(el.dirPicker.files || [], 'dir');
});
el.mcpFiles.addEventListener('change', () => {
  handleSelectedFiles(el.mcpFiles.files || [], 'mcp');
});

function openFilePickerFallback() {
  console.debug('[dir-pick] fallback to file picker');
  el.filePicker.click();
}

function pickFilesWithInput(options = {}) {
  const {
    accept = '',
    multiple = true,
    mode = 'generic'
  } = options;
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = !!multiple;
    if (accept) input.accept = accept;
    input.style.position = 'fixed';
    input.style.left = '0';
    input.style.top = '0';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
    document.body.appendChild(input);
    if (platformInfo.isAndroid) {
      preShowScanOverlay(1, 'Waiting for selection');
    }
    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);
      console.debug('[dir-pick] dynamic file picker', { mode, count: files.length, accept: accept || '(none)' });
      input.remove();
      resolve(files);
    }, { once: true });
    input.click();
  });
}

async function pickDirectoryByPlatform() {
  const env = platformInfo;
  console.debug('[dir-pick] platform', env);
  if (env.isIOS) {
    setStatus('iOS 不支持文件夹选择，已切换为多文件选择');
    openFilePickerFallback();
    return null;
  }
  if (env.isAndroid) {
    // Strategy #3: force Android system-like multi-file picker by omitting accept filter.
    setStatus('Android: 使用系统文件多选模式导入');
    console.debug('[dir-pick] android strategy=multi-file-native');
    const files = await pickFilesWithInput({ accept: '', multiple: true, mode: 'android-native-multi' });
    return files;
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
      return [];
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
  if (Array.isArray(files) && files.length) {
    handleSelectedFiles(files, platformInfo.isAndroid ? 'file' : 'dir');
  } else if (files === null) {
    preHideScanOverlay();
    return;
  } else if (!platformInfo.isIOS) {
    setStatus('已取消文件夹选择');
    preHideScanOverlay();
  }
});


el.exportBtn.addEventListener('click', async () => {
  const selected = state.items.filter(i => state.selection.has(i.id) && i.isLive);
  if (!selected.length) return;
  setStatus(`Exporting ${selected.length} item(s)...`);
  for (const item of selected) {
    await exportItem(item);
  }
  setStatus('Export complete');
});

// MCP 调试入口：不在 UI 暴露，仅供自动化调试调用
window.__mcpImportDir = () => {
  if (el.mcpFiles) {
    el.mcpFiles.click();
    return;
  }
  if ('webkitdirectory' in el.dirPicker) {
    el.dirPicker.click();
    return;
  }
  setStatus('Current browser does not support MCP folder import');
};
window.__mcpUseHiddenDir = () => {
  const files = el.mcpFiles?.files?.length ? el.mcpFiles.files : el.dirPicker?.files;
  state.files = Array.from(files || []);
  setStatus(`Imported via MCP: ${state.files.length} files`);
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
    thumb.textContent = 'Loading...';

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
      groups.push({ type: 'group', label: `${day} (${counts.get(day) || 0})` });
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
  if (!ts) return '鏈煡鏃ユ湡';
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
        const meta = await parseImageMetadata(item.file, { needXmp: false, headBuffer: buf });
        const exif = meta.exif || {};
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

function normalizeExifFromExifr(data) {
  if (!data || typeof data !== 'object') return {};
  const exif = {};
  for (const [key, value] of Object.entries(data)) {
    if (value == null) continue;
    if (typeof key === 'string' && /^\d+$/.test(key)) continue;
    if (key === 'xmp' || key === 'XMPMeta') continue;
    exif[key] = value;
  }
  if (exif.latitude != null && exif.GPSLatitude == null) exif.GPSLatitude = exif.latitude;
  if (exif.longitude != null && exif.GPSLongitude == null) exif.GPSLongitude = exif.longitude;
  return exif;
}

function canUseExifr() {
  return !!(window.exifr && typeof window.exifr.parse === 'function');
}

async function parseImageMetadata(file, options = {}) {
  const needXmp = options.needXmp !== false;
  const headBuffer = options.headBuffer || null;
  let exif = {};
  let xmp = null;
  let source = 'legacy';

  if (canUseExifr()) {
    try {
      const exifrOptions = { ...EXIFR_PARSE_OPTIONS_BASE };
      exifrOptions.xmp = needXmp ? { parse: false } : false;
      const parsed = await window.exifr.parse(file, exifrOptions);
      if (parsed && typeof parsed === 'object') {
        if (needXmp && typeof parsed.xmp === 'string') xmp = parsed.xmp;
        exif = normalizeExifFromExifr(parsed);
        source = 'exifr';
      }
    } catch (err) {
      console.debug('[meta] exifr parse failed', { name: file?.name || '(unknown)', message: err?.message || String(err) });
    }
  }

  if (!headBuffer && Object.keys(exif).length > 0 && (!needXmp || xmp)) {
    return { exif, xmp, source };
  }

  if (Object.keys(exif).length === 0 || (needXmp && !xmp)) {
    try {
      const buf = headBuffer || await readExifBuffer(file);
      if (Object.keys(exif).length === 0) exif = extractExif(buf);
      if (needXmp && !xmp) xmp = extractXmp(buf);
      if (source !== 'exifr') source = 'legacy';
    } catch {
      // Keep best-effort metadata only.
    }
  }

  return { exif: exif || {}, xmp: xmp || null, source };
}

function parseExifTime(exif) {
  const raw = exif?.DateTimeOriginal || exif?.DateTime;
  if (!raw) return null;
  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null;
  }
  if (typeof raw !== 'string') return null;
  const m = raw.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) {
    const iso = Date.parse(raw);
    return Number.isFinite(iso) ? iso : null;
  }
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
      state.currentViewerIndex = Number.isFinite(state.viewer?.index) ? state.viewer.index : state.currentViewerIndex;
      closeLiveVideoInline();
      state.userAdjusted = false;
      hydrateViewerWindow(state.viewer.index, 6);
      bindNativeViewerNavOverride();
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
      releaseViewerUrls();
      const container = getViewerContainer();
      if (container) {
        container.classList.remove('nav-active', 'nav-idle', 'panel-open');
      }
      clearNavIdle();
    },
  });
}

function getViewerUrlLimit() {
  return platformInfo.isAndroid ? 24 : 64;
}

function releaseViewerUrls() {
  for (const url of state.viewerUrlCache.values()) {
    try { URL.revokeObjectURL(url); } catch {}
  }
  state.viewerUrlCache.clear();
  const nodes = el.viewerGallery ? el.viewerGallery.querySelectorAll('img[data-id]') : [];
  for (const node of nodes) {
    node.setAttribute('src', VIEWER_PLACEHOLDER_SRC);
  }
}

function hydrateViewerWindow(center, radius = 4) {
  const list = el.viewerGallery.children;
  const start = Math.max(0, center - radius);
  const end = Math.min(list.length - 1, center + radius);
  for (let i = start; i <= end; i++) {
    const img = list[i];
    if (!img) continue;
    const id = img.dataset.id;
    if (state.viewerUrlCache.has(id) && img.src && !img.src.startsWith('data:image/gif')) continue;
    const item = state.filtered.find((x) => x.id === id);
    if (!item) continue;
    if (img.src && img.src.startsWith('blob:')) {
      try { URL.revokeObjectURL(img.src); } catch {}
    }
    const url = URL.createObjectURL(item.file);
    img.src = url;
    state.viewerUrlCache.set(id, url);
  }
  const limit = getViewerUrlLimit();
  if (state.viewerUrlCache.size > limit) {
    const keep = new Set();
    for (let i = start; i <= end; i++) {
      const img = list[i];
      if (img?.dataset?.id) keep.add(img.dataset.id);
    }
    for (const [id, url] of state.viewerUrlCache) {
      if (keep.has(id)) continue;
      URL.revokeObjectURL(url);
      state.viewerUrlCache.delete(id);
      const node = el.viewerGallery.querySelector(`img[data-id="${id}"]`);
      if (node) node.setAttribute('src', VIEWER_PLACEHOLDER_SRC);
      if (state.viewerUrlCache.size <= limit) break;
    }
  }
}

function updateViewerGallery() {
  releaseViewerUrls();
  el.viewerGallery.innerHTML = '';
  for (const item of state.filtered) {
    const img = document.createElement('img');
    img.dataset.id = item.id;
    img.dataset.live = item.isLive ? '1' : '0';
    img.src = VIEWER_PLACEHOLDER_SRC;
    img.alt = item.name;
    el.viewerGallery.appendChild(img);
  }
  initViewer();
  state.viewer.update();
}

function openViewer(id) {
  const index = state.filtered.findIndex(i => i.id === id);
  if (index === -1) return;
  const currentItem = state.filtered[index];
  if (currentItem && !currentItem._scanDone && state.scanByBase) {
    analyzeFile(currentItem.file, state.scanByBase).then((analyzed) => {
      if (!analyzed || currentItem._scanDone) return;
      currentItem.isLive = !!analyzed.isLive;
      currentItem.liveType = analyzed.liveType || (currentItem.isLive ? 'Embedded Video' : 'Still');
      currentItem.videoBlob = analyzed.videoBlob || null;
      currentItem.exif = analyzed.exif || currentItem.exif || null;
      currentItem.exifTime = analyzed.exifTime ?? currentItem.exifTime ?? null;
      currentItem.exifChecked = analyzed.exifChecked || currentItem.exifChecked;
      currentItem._scanDone = true;
      const card = el.grid.querySelector(`.card[data-id="${currentItem.id}"]`);
      if (card && currentItem.isLive && !card.querySelector('.live-icon')) {
        const badge = document.createElement('div');
        badge.className = 'live-icon';
        badge.title = 'Live Photo';
        card.insertBefore(badge, card.firstChild);
      }
      updateStats();
      if (state.viewer && state.filtered[state.viewer.index]?.id === currentItem.id) {
        updateLiveButton();
        updateViewerPanel();
      }
    }).catch(() => {});
  }
  state.currentViewerIndex = index;
  if (!el.viewerGallery.children.length || el.viewerGallery.children.length !== state.filtered.length) {
    updateViewerGallery();
  }
  hydrateViewerWindow(index, 6);
  initViewer();
  if (state.viewer && typeof state.viewer.update === 'function') {
    state.viewer.update();
  }
  console.debug('[viewer] open', { id, index, total: state.filtered.length });
  state.viewer.view(index);
}

function viewAtIndex(targetIndex, reason = 'manual-nav') {
  if (!state.viewer || !state.filtered.length) return;
  const max = state.filtered.length - 1;
  const index = Math.max(0, Math.min(max, targetIndex));
  state.currentViewerIndex = index;
  const node = el.viewerGallery.children[index];
  if (node && !node.getAttribute('src')) {
    const item = state.filtered[index];
    if (item?.file) {
      const old = state.viewerUrlCache.get(item.id);
      if (old) {
        try { URL.revokeObjectURL(old); } catch {}
      }
      const url = URL.createObjectURL(item.file);
      node.setAttribute('src', url);
      state.viewerUrlCache.set(item.id, url);
      if (typeof state.viewer.update === 'function') state.viewer.update();
    }
  }
  hydrateViewerWindow(index, 6);
  state.viewer.view(index);
  console.debug('[viewer-nav] viewAtIndex', { reason, index, max });
}

function bindNativeViewerNavOverride() {
  const container = getViewerContainer();
  if (!container || container.dataset.navOverrideBound === '1') return;
  container.dataset.navOverrideBound = '1';
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn || !state.viewer) return;
    const clz = btn.className || '';
    const label = `${btn.getAttribute('title') || ''} ${btn.getAttribute('aria-label') || ''}`.toLowerCase();
    const isPrev = clz.includes('viewer-prev') || /previous|上一|上一个/.test(label);
    const isNext = clz.includes('viewer-next') || /next|下一|下一个/.test(label);
    if (!isPrev && !isNext) return;
    e.preventDefault();
    e.stopPropagation();
    const cur = Number.isFinite(state.currentViewerIndex) && state.currentViewerIndex >= 0
      ? state.currentViewerIndex
      : (Number.isFinite(state.viewer.index) ? state.viewer.index : 0);
    viewAtIndex(cur + (isNext ? 1 : -1), isNext ? 'native-next' : 'native-prev');
  }, true);
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
  parseImageMetadata(item.file, { needXmp: false }).then((meta) => {
    item.exif = meta.exif || {};
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
  const reset = () => {
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (now - navActivityTick < 220) return;
    navActivityTick = now;
    armNavIdle();
  };
  ['mousemove', 'mousedown', 'wheel', 'keydown', 'touchstart'].forEach((evt) => {
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
  left.title = 'Previous';
  const right = document.createElement('button');
  right.className = 'viewer-side-nav right';
  right.title = 'Next';
  left.addEventListener('click', () => {
    if (left.disabled) return;
    if (!state.viewer) return;
    const cur = Number.isFinite(state.currentViewerIndex) && state.currentViewerIndex >= 0
      ? state.currentViewerIndex
      : (Number.isFinite(state.viewer.index) ? state.viewer.index : 0);
    viewAtIndex(cur - 1, 'side-prev');
  });
  right.addEventListener('click', () => {
    if (right.disabled) return;
    if (!state.viewer) return;
    const cur = Number.isFinite(state.currentViewerIndex) && state.currentViewerIndex >= 0
      ? state.currentViewerIndex
      : (Number.isFinite(state.viewer.index) ? state.viewer.index : 0);
    viewAtIndex(cur + 1, 'side-next');
  });
  container.appendChild(left);
  container.appendChild(right);
}

function updateNavDisabled() {
  const container = getViewerContainer();
  if (!container || !state.viewer) return;
  const left = container.querySelector('.viewer-side-nav.left');
  const right = container.querySelector('.viewer-side-nav.right');
  const idx = Number.isFinite(state.currentViewerIndex) && state.currentViewerIndex >= 0
    ? state.currentViewerIndex
    : (state.viewer.index ?? 0);
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
      const currentItem = state.viewer ? state.filtered[state.viewer.index] : null;
      const nextMuted = !state.liveMuted;
      const sourceModeNow = currentItem?._lastLiveSourceMode || 'original';
      if (!nextMuted && isForcedBPathMode() && sourceModeNow === 'stripped') {
        const text = '当前为B链路（ffmpeg去音轨），仅支持静音播放；请切回“自动（A优先）”后再重试有声。';
        setStatus(text);
        showViewerNotice(text, { tone: 'warn', duration: 3000 });
        return;
      }
      if (!nextMuted && currentItem?._audioUnsupported) {
        // User explicitly retries audio on a previously degraded item.
        currentItem._audioUnsupported = false;
        currentItem._audioRetryCount = (currentItem._audioRetryCount || 0) + 1;
        currentItem._pendingAudioRetry = true;
        const retryText = `正在重试有声播放（第${currentItem._audioRetryCount}次）`;
        console.log('[live-retry] start', { name: currentItem.name, retry: currentItem._audioRetryCount });
        setStatus(retryText);
        showViewerNotice(retryText, { tone: 'warn', duration: 1800 });
      }
      state.liveMuted = nextMuted;
      muteBtn.dataset.muted = String(state.liveMuted);
      const layer = document.querySelector('.viewer-live-video');
      const video = layer?.querySelector('video');
      if (video) {
        applyVideoAudioState(video, state.liveMuted);
      }
      // On Android, when user explicitly unmutes, re-open using original blob first.
      if (!state.liveMuted && platformInfo?.isAndroid && state.viewer) {
        const item = state.filtered[state.viewer.index];
        if (item?.isLive && item.videoBlob && layer?.classList.contains('active')) {
          openLiveVideoInline(item);
        }
      }
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
    const audioBlocked = !!current._audioUnsupported || isForcedBPathMode();
    muteBtn.dataset.audioBlocked = audioBlocked ? 'true' : 'false';
    muteBtn.title = isForcedBPathMode()
      ? '当前为B链路（ffmpeg去音轨），仅支持静音播放'
      : (audioBlocked ? '当前文件音频不兼容，已自动切换静音播放' : '静音/取消静音');
  } else {
    btn.classList.remove('active');
    btn.classList.add('hidden');
    muteBtn.classList.add('hidden');
    muteBtn.dataset.audioBlocked = 'false';
    muteBtn.title = '静音/取消静音';
  }
  syncLiveButtonState();
  console.debug('[viewer] live buttons', { index: viewer.index, live: !!(current && current.isLive && current.videoBlob) });
}

async function openLiveVideoInline(item) {
  const layer = ensureLiveVideoLayer();
  if (!layer) return;
  const video = layer.querySelector('video');
  if (!video) return;
  const playbackToken = Number(video._playbackToken || 0) + 1;
  video._playbackToken = playbackToken;
  const isCurrentPlayback = () => Number(video._playbackToken || 0) === playbackToken;
  const previewImage = state.viewer?.image || null;
  const livePathMode = getLivePathMode();
  let blobToPlay = item.videoBlob;
  let sourceMode = 'original';
  let effectiveMuted = state.liveMuted;
  if (livePathMode === 'b_force' && item.videoBlob) {
    let forcedBBlob = item._audioStrippedBlobFfmpeg || null;
    if (!forcedBBlob) {
      if (!item._audioStrippedBlobFfmpegPromise) {
        item._audioStrippedBlobFfmpegPromise = stripMp4AudioTrackWithFfmpeg(item.videoBlob, item.name)
          .finally(() => { item._audioStrippedBlobFfmpegPromise = null; });
      }
      forcedBBlob = await item._audioStrippedBlobFfmpegPromise;
      if (!isCurrentPlayback()) return;
      if (forcedBBlob) item._audioStrippedBlobFfmpeg = forcedBBlob;
    }
    if (forcedBBlob) {
      item._audioStrippedBlob = forcedBBlob;
      item._audioUnsupported = true;
      blobToPlay = forcedBBlob;
      sourceMode = 'stripped';
      effectiveMuted = true;
      state.liveMuted = true;
      showViewerNotice('临时测试：已强制使用B链路（ffmpeg）', { duration: 1800 });
      setStatus('当前为B链路（ffmpeg去音轨），仅支持静音播放');
    } else {
      console.warn('[live-path] b_force unavailable; fallback auto', { name: item.name });
      showViewerNotice('B链路不可用，已回退自动链路', { tone: 'warn', duration: 2400 });
    }
  }
  if (!isCurrentPlayback()) return;
  if (sourceMode === 'original') {
    const preferSanitized = !!(state.liveMuted && item._audioUnsupported && item._audioStrippedBlob);
    if (preferSanitized) {
      blobToPlay = item._audioStrippedBlob;
      sourceMode = 'stripped';
      effectiveMuted = true;
    }
  }
  console.log('[live-path] open', {
    name: item?.name || '',
    mode: livePathMode,
    sourceMode,
    muted: effectiveMuted,
    audioUnsupported: !!item?._audioUnsupported
  });
  // Keep still image visible until canplay on mobile to reduce transient black flash.
  const deferHideUntilCanPlay = !!platformInfo?.isAndroid;
  let canHidePreview = !deferHideUntilCanPlay;
  video.playsInline = true;
  video.preload = 'auto';
  video.controls = false;
  setVideoBlobSource(video, blobToPlay);
  video.currentTime = 0;
  applyVideoAudioState(video, effectiveMuted);
  item._lastLiveSourceMode = sourceMode;
  item._lastLivePathMode = livePathMode;
  console.debug('[live-debug] open', {
    name: item.name,
    blobType: blobToPlay?.type || '(empty)',
    blobSize: blobToPlay?.size || 0,
    sourceMode,
    livePathMode,
    muted: effectiveMuted,
    audioUnsupported: !!item._audioUnsupported,
    isAndroid: !!platformInfo?.isAndroid,
    canPlayMp4: video.canPlayType('video/mp4'),
    canPlayQuickTime: video.canPlayType('video/quicktime')
  });
  let fallbackPromise = null;
  let fallbackAttempted = blobToPlay !== item.videoBlob;
  let usingStrippedSource = blobToPlay !== item.videoBlob;
  const fallbackToStripped = async (reason) => {
    if (!isCurrentPlayback()) return false;
    if (fallbackPromise) {
      console.debug('[live-debug] fallback join', { name: item.name, reason });
      return await fallbackPromise;
    }
    if (usingStrippedSource) {
      console.debug('[live-debug] fallback skipped', {
        name: item.name,
        reason,
        why: 'already-stripped'
      });
      return true;
    }
    if (fallbackAttempted) {
      console.debug('[live-debug] fallback skipped', {
        name: item.name,
        reason,
        why: 'already-attempted'
      });
      return false;
    }
    fallbackAttempted = true;
    if (fallbackPromise) return fallbackPromise;
    fallbackPromise = (async () => {
      if (!isCurrentPlayback()) return false;
      let stripped = item._audioStrippedBlob || null;
      if (!stripped) {
        stripped = await stripMp4AudioTrack(item.videoBlob, { itemName: item.name });
        if (stripped) {
          console.debug('[live-debug] strip audio retry', { name: item.name, reason, before: item.videoBlob.size, after: stripped.size });
          item._audioStrippedBlob = stripped;
        } else {
          console.debug('[live-debug] strip audio skipped', { name: item.name, reason });
        }
      } else {
        console.debug('[live-debug] use cached stripped', { name: item.name, reason, sourceMode });
      }
      if (!isCurrentPlayback() || !stripped) return false;
      const applyMutedUiState = () => {
        usingStrippedSource = true;
        item._audioUnsupported = true;
        state.liveMuted = true;
        const muteBtn = document.querySelector('.viewer-mute-btn');
        if (muteBtn) {
          muteBtn.dataset.muted = 'true';
          muteBtn.dataset.audioBlocked = 'true';
          muteBtn.title = '当前文件音频不兼容，已自动切换静音播放';
        }
        const degradedText = '检测到音频不兼容，已自动切换静音播放';
        setStatus(degradedText);
        showViewerNotice(degradedText, { tone: 'warn', duration: 2600 });
        if (item._pendingAudioRetry) {
          item._pendingAudioRetry = false;
          console.log('[live-retry] fallback-muted', { name: item.name, reason });
        }
      };
      const playSanitizedBlob = async (sanitizedBlob, sourceTag, forceTrackRefresh = false) => {
        if (!isCurrentPlayback() || !sanitizedBlob) return false;
        applyMutedUiState();
        item._lastLiveSourceMode = 'stripped';
        item._lastLivePathMode = livePathMode;
        if (forceTrackRefresh && item) {
          item._trackInfoStripped = null;
        }
        await detectTracksForPlayback(sanitizedBlob, item.name, 'stripped', item);
        if (!isCurrentPlayback()) return false;
        setVideoBlobSource(video, sanitizedBlob);
        video.currentTime = 0;
        applyVideoAudioState(video, true);
        canHidePreview = false;
        if (previewImage) previewImage.style.opacity = '';
        try {
          await video.play();
          if (!isCurrentPlayback()) return false;
          if (state.viewer) updateLiveButton();
          return true;
        } catch (retryErr) {
          console.debug('[live-debug] strip retry reject', {
            name: item.name,
            reason,
            sourceTag,
            message: retryErr?.message || String(retryErr)
          });
          return false;
        }
      };
      let played = await playSanitizedBlob(stripped, 'a-chain');
      if (played) return true;
      if (!isCurrentPlayback()) return false;
      console.warn('[ffmpeg-fallback] trigger after sanitized play failed', { name: item.name, reason });
      const ffmpegStripped = await stripMp4AudioTrackWithFfmpeg(item.videoBlob, item.name);
      if (!ffmpegStripped || !isCurrentPlayback()) return false;
      item._audioStrippedBlob = ffmpegStripped;
      played = await playSanitizedBlob(ffmpegStripped, 'ffmpeg', true);
      return played;
    })();
    return await fallbackPromise;
  };
  const initialTrackInfo = await detectTracksForPlayback(blobToPlay, item.name, sourceMode, item);
  if (!isCurrentPlayback()) return;
  const shouldForceAudible = livePathMode === 'auto' && sourceMode === 'original' && !state.liveMuted;
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
    if (shouldForceAudible) {
      applyVideoAudioState(video, false);
    }
    canHidePreview = true;
    if (item._pendingAudioRetry && !video.muted) {
      item._pendingAudioRetry = false;
      const okText = '有声播放已恢复';
      console.log('[live-retry] success', { name: item.name, muted: video.muted });
      setStatus(okText);
      showViewerNotice(okText, { tone: 'ok', duration: 1800 });
    }
    if (state.livePlaying && previewImage) {
      previewImage.style.opacity = '0';
    }
  };
  video.onwaiting = () => {
    console.debug('[live-debug] waiting', { name: item.name, t: video.currentTime });
  };
  video.onstalled = () => {
    console.debug('[live-debug] stalled', { name: item.name, t: video.currentTime });
  };
  video.onerror = async () => {
    if (!isCurrentPlayback()) return;
    const mediaError = video.error;
    console.debug('[live-debug] video error', {
      name: item.name,
      code: mediaError?.code || null,
      message: mediaError?.message || '(no-message)'
    });
    const message = mediaError?.message || '';
    const shouldFallbackToStripped = !usingStrippedSource && (
      mediaError?.code === 4
      || /AAC|DEMUXER_ERROR|supported source|not supported|decode/i.test(message)
      || (!!initialTrackInfo?.audio && !state.liveMuted)
    );
    if (shouldFallbackToStripped) {
      const ok = await fallbackToStripped('video-error');
      if (ok) return;
    }
    if (item._pendingAudioRetry) {
      item._pendingAudioRetry = false;
      const failText = '有声播放失败，当前文件仅支持静音播放';
      console.log('[live-retry] failed', { name: item.name, stage: 'video-error' });
      setStatus(failText);
      showViewerNotice(failText, { tone: 'warn', duration: 2800 });
    }
    if (!isCurrentPlayback()) return;
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
    if (shouldForceAudible) {
      applyVideoAudioState(video, false);
    }
    if (previewImage && canHidePreview) {
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
    if (!isCurrentPlayback()) return;
    console.debug('[live-debug] play reject', {
      name: item.name,
      message: err?.message || String(err),
      isAndroid: !!platformInfo?.isAndroid
    });
    fallbackToStripped('play-reject').then((ok) => {
      if (!isCurrentPlayback()) return;
      if (ok) return;
      if (item._pendingAudioRetry) {
        item._pendingAudioRetry = false;
        const failText = '有声播放失败，当前文件仅支持静音播放';
        console.log('[live-retry] failed', { name: item.name, stage: 'play-reject' });
        setStatus(failText);
        showViewerNotice(failText, { tone: 'warn', duration: 2800 });
      }
      console.debug('[live-debug] retry reject', {
        name: item.name,
        message: 'fallback failed after play reject'
      });
      closeLiveVideoInline();
    });
  });
}

function closeLiveVideoInline() {
  const layer = document.querySelector('.viewer-live-video');
  if (!layer) return;
  const video = layer.querySelector('video');
  layer.classList.remove('active');
  if (video) {
    video._playbackToken = Number(video._playbackToken || 0) + 1;
    video.pause();
    video.onended = null;
    video.onplay = null;
    video.onpause = null;
    video.oncanplay = null;
    video.onwaiting = null;
    video.onstalled = null;
    video.onerror = null;
    video.controls = false;
    resetVideoElementSource(video);
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
  btn.title = playing ? '鏆傚仠 Live' : '鎾斁 Live';
}

function buildDetailRows(item) {
  const exif = item.exif || {};
  return [
    ['Type', item.isLive ? 'Live Photo' : 'Still Image'],
    ['Vendor', item.isLive ? item.liveType : '-'],
    ['Capture Time', exif.DateTimeOriginal || exif.DateTime || '-'],
    ['Model', exif.Model || '-'],
    ['Make', exif.Make || '-'],
    ['Lens', exif.LensModel || '-'],
    ['Size', exif.ImageWidth && exif.ImageHeight ? `${exif.ImageWidth} x ${exif.ImageHeight}` : '-'],
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
  const item = { id, name: file.name, file, isLive: false, liveType: 'Still', videoBlob: null, thumbLoaded: false, exif: null, exifTime: null, exifChecked: false, objectUrl: null };
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
      item.liveType = item.liveType === 'Still' ? 'Embedded Video' : item.liveType;
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
  const latNum = Number(exif.GPSLatitude ?? exif.latitude);
  const lonNum = Number(exif.GPSLongitude ?? exif.longitude);
  if (Number.isFinite(latNum) && Number.isFinite(lonNum)) {
    return `${latNum.toFixed(6)}, ${lonNum.toFixed(6)}`;
  }
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
    ['File Name', item.name || '-'],
    ['Type', item.isLive ? 'Live Photo' : 'Still Image'],
    ['Vendor', item.isLive ? item.liveType : '-'],
    ['Capture Time', exif.DateTimeOriginal || exif.DateTime || '-'],
    ['Model', exif.Model || '-'],
    ['Make', exif.Make || '-'],
    ['Lens', exif.LensModel || '-'],
    ['Size', exif.ImageWidth && exif.ImageHeight ? `${exif.ImageWidth} x ${exif.ImageHeight}` : '-'],
    ['Location', gps || '-'],
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

function findMp4FtypOffset(buf) {
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length - 12; i++) {
    if (bytes[i + 4] === 0x66 && bytes[i + 5] === 0x74 && bytes[i + 6] === 0x79 && bytes[i + 7] === 0x70) {
      return i;
    }
  }
  return -1;
}

function findLastMp4FtypOffset(buf) {
  const bytes = new Uint8Array(buf);
  for (let i = bytes.length - 12; i >= 0; i--) {
    if (bytes[i + 4] === 0x66 && bytes[i + 5] === 0x74 && bytes[i + 6] === 0x79 && bytes[i + 7] === 0x70) {
      return i;
    }
  }
  return -1;
}

function readU32BE(bytes, offset) {
  return (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
}

function readU64BE(bytes, offset) {
  if (offset + 8 > bytes.length) return null;
  const hi = readU32BE(bytes, offset);
  const lo = readU32BE(bytes, offset + 4);
  if (hi > 0x1fffff) return null;
  return hi * 2 ** 32 + lo;
}

function readBoxType(bytes, offset) {
  return String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
}

function readBoxSize(bytes, offset) {
  let size = readU32BE(bytes, offset);
  if (size === 1) {
    const big = readU64BE(bytes, offset + 8);
    return big == null ? null : big;
  }
  if (size === 0) return bytes.length - offset;
  return size;
}

function readBoxSizeWithHeader(bytes, offset) {
  let size = readU32BE(bytes, offset);
  let header = 8;
  if (size === 1) {
    const big = readU64BE(bytes, offset + 8);
    if (big == null) return { size: null, header };
    size = big;
    header = 16;
  } else if (size === 0) {
    size = bytes.length - offset;
  }
  return { size, header };
}

function findBoxOffset(bytes, type, start = 0, end = null) {
  const max = end == null ? bytes.length - 8 : Math.min(end, bytes.length - 8);
  for (let i = Math.max(0, start); i <= max; i++) {
    if (bytes[i + 4] === type[0] && bytes[i + 5] === type[1] && bytes[i + 6] === type[2] && bytes[i + 7] === type[3]) {
      const size = readBoxSize(bytes, i);
      if (size != null && size >= 8 && i + size <= bytes.length) return i;
    }
  }
  return -1;
}

function validateMp4At(bytes, offset) {
  if (offset < 0 || offset + 12 > bytes.length) return { valid: false };
  if (bytes[offset + 4] !== 0x66 || bytes[offset + 5] !== 0x74 || bytes[offset + 6] !== 0x79 || bytes[offset + 7] !== 0x70) {
    return { valid: false };
  }
  let pos = offset;
  let sawFtyp = false;
  let sawMoov = false;
  let sawMdat = false;
  for (let i = 0; i < 64 && pos + 8 <= bytes.length; i++) {
    const size = readBoxSize(bytes, pos);
    if (size == null || size < 8) return { valid: false };
    if (pos + size > bytes.length) return { valid: false };
    const type = readBoxType(bytes, pos);
    if (type === 'ftyp') sawFtyp = true;
    if (type === 'moov') sawMoov = true;
    if (type === 'mdat') sawMdat = true;
    pos += size;
    if (sawFtyp && sawMoov) return { valid: true, sawMdat };
  }
  return { valid: sawFtyp && sawMoov, sawMdat };
}

const CONTAINER_BOXES = new Set([
  'moov', 'trak', 'mdia', 'minf', 'stbl', 'edts', 'udta', 'meta', 'ilst', 'dinf', 'mvex', 'moof', 'traf'
]);

function parseBoxes(bytes, start = 0, end = null) {
  const limit = end == null ? bytes.length : Math.min(end, bytes.length);
  const boxes = [];
  let pos = Math.max(0, start);
  while (pos + 8 <= limit) {
    const { size, header } = readBoxSizeWithHeader(bytes, pos);
    if (size == null || size < 8) break;
    const boxEnd = pos + size;
    if (boxEnd > limit) break;
    const type = readBoxType(bytes, pos);
    const box = { type, start: pos, size, header, end: boxEnd, children: null };
    if (CONTAINER_BOXES.has(type)) {
      let childStart = pos + header;
      if (type === 'meta') childStart += 4;
      if (childStart < boxEnd) {
        box.children = parseBoxes(bytes, childStart, boxEnd);
      }
    }
    boxes.push(box);
    pos = boxEnd;
  }
  return boxes;
}

function findChildBox(box, type) {
  if (!box?.children) return null;
  return box.children.find(child => child.type === type) || null;
}

function readHandlerType(bytes, hdlrBox) {
  if (!hdlrBox) return null;
  const base = hdlrBox.start + hdlrBox.header;
  if (base + 12 > hdlrBox.end) return null;
  return String.fromCharCode(bytes[base + 8], bytes[base + 9], bytes[base + 10], bytes[base + 11]);
}

function buildBox(type, payloadBytes) {
  const payload = payloadBytes || new Uint8Array(0);
  const size = 8 + payload.byteLength;
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  view.setUint32(0, size);
  buf[4] = type.charCodeAt(0);
  buf[5] = type.charCodeAt(1);
  buf[6] = type.charCodeAt(2);
  buf[7] = type.charCodeAt(3);
  buf.set(payload, 8);
  return buf;
}

function concatBytes(chunks) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function detectMp4Tracks(blob) {
  try {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const top = parseBoxes(bytes);
    const moov = top.find(box => box.type === 'moov');
    if (!moov || !moov.children) return { audio: false, video: false, tracks: 0 };
    let audio = false;
    let video = false;
    let tracks = 0;
    for (const child of moov.children) {
      if (child.type !== 'trak') continue;
      tracks += 1;
      const mdia = findChildBox(child, 'mdia');
      const hdlr = mdia ? findChildBox(mdia, 'hdlr') : null;
      const handler = readHandlerType(bytes, hdlr);
      if (handler === 'soun') audio = true;
      if (handler === 'vide') video = true;
    }
    return { audio, video, tracks };
  } catch {
    return { audio: false, video: false, tracks: 0 };
  }
}

function canUseMediaInfoJs() {
  return !!(window.MediaInfo && typeof window.MediaInfo.mediaInfoFactory === 'function');
}

function createTrackSummaryFromMediaInfo(result) {
  const tracks = Array.isArray(result?.media?.track) ? result.media.track : [];
  const audioTracks = tracks.filter((t) => t?.['@type'] === 'Audio');
  const videoTracks = tracks.filter((t) => t?.['@type'] === 'Video');
  const audioCodec = audioTracks.map((t) => t?.Format || t?.CodecID || t?.CodecID_Hint).find(Boolean) || '';
  const videoCodec = videoTracks.map((t) => t?.Format || t?.CodecID || t?.CodecID_Hint).find(Boolean) || '';
  return {
    audio: audioTracks.length > 0,
    video: videoTracks.length > 0,
    tracks: audioTracks.length + videoTracks.length,
    audioTracks: audioTracks.length,
    videoTracks: videoTracks.length,
    audioCodec,
    videoCodec,
    source: 'mediainfo.js',
  };
}

async function getMediaInfoInstance() {
  if (!canUseMediaInfoJs()) {
    if (!mediaInfoUnavailableLogged) {
      mediaInfoUnavailableLogged = true;
      console.warn('[track-probe] mediainfo unavailable; fallback to mp4 parser');
    }
    return null;
  }
  if (mediaInfoInstancePromise) return mediaInfoInstancePromise;
  mediaInfoInstancePromise = window.MediaInfo.mediaInfoFactory({
    format: 'object',
    locateFile: (path) => (path === 'MediaInfoModule.wasm' ? MEDIAINFO_WASM_PATH : path),
  }).catch((err) => {
    console.warn('[track-probe] mediainfo init failed', { message: err?.message || String(err) });
    mediaInfoInstancePromise = null;
    return null;
  });
  return mediaInfoInstancePromise;
}

async function detectTracksWithMediaInfo(blob) {
  const inst = await getMediaInfoInstance();
  if (!inst) return null;
  const run = async () => {
    const result = await inst.analyzeData(
      blob.size,
      async (size, offset) => new Uint8Array(await blob.slice(offset, offset + size).arrayBuffer())
    );
    return createTrackSummaryFromMediaInfo(result);
  };
  mediaInfoAnalyzeQueue = mediaInfoAnalyzeQueue.then(run, run);
  try {
    return await mediaInfoAnalyzeQueue;
  } catch (err) {
    console.warn('[track-probe] mediainfo analyze failed', { message: err?.message || String(err) });
    return null;
  }
}

async function detectTracksForPlayback(blob, itemName, sourceMode, item) {
  console.debug('[track-probe] start', {
    name: itemName,
    sourceMode,
    hasBlob: !!blob,
    blobType: blob?.type || '',
    blobSize: blob?.size || 0
  });
  if (!blob) {
    const emptyInfo = { audio: false, video: false, tracks: 0, audioTracks: 0, videoTracks: 0, audioCodec: '', videoCodec: '', source: 'none' };
    console.debug('[track-probe] done', { name: itemName, sourceMode, ...emptyInfo });
    return emptyInfo;
  }
  if (sourceMode === 'original' && item?._trackInfoOriginal) {
    console.debug('[track-probe] cache', { name: itemName, sourceMode, source: item._trackInfoOriginal.source || 'cache' });
    return item._trackInfoOriginal;
  }
  if (sourceMode === 'stripped' && item?._trackInfoStripped) {
    console.debug('[track-probe] cache', { name: itemName, sourceMode, source: item._trackInfoStripped.source || 'cache' });
    return item._trackInfoStripped;
  }
  let info = await detectTracksWithMediaInfo(blob);
  if (!info) {
    const fallback = await detectMp4Tracks(blob);
    info = { ...fallback, audioTracks: fallback.audio ? 1 : 0, videoTracks: fallback.video ? 1 : 0, audioCodec: '', videoCodec: '', source: 'mp4-parser' };
  }
  if (sourceMode === 'original' && item) item._trackInfoOriginal = info;
  if (sourceMode === 'stripped' && item) item._trackInfoStripped = info;
  console.debug('[track-probe] done', {
    name: itemName,
    sourceMode,
    source: info.source,
    audio: info.audio,
    video: info.video,
    tracks: info.tracks,
    audioTracks: info.audioTracks,
    videoTracks: info.videoTracks,
    audioCodec: info.audioCodec,
    videoCodec: info.videoCodec
  });
  return info;
}

async function loadMp4BoxModule() {
  if (mp4BoxModulePromise) return mp4BoxModulePromise;
  mp4BoxModulePromise = import(MP4BOX_MODULE_PATH).catch((err) => {
    console.warn('[mp4box] import failed', { message: err?.message || String(err) });
    mp4BoxModulePromise = null;
    return null;
  });
  return mp4BoxModulePromise;
}

function canUseFfmpegWasm() {
  return !!(window.FFmpeg && typeof window.FFmpeg.createFFmpeg === 'function' && typeof window.FFmpeg.fetchFile === 'function');
}

async function getFfmpegInstance() {
  if (!canUseFfmpegWasm()) {
    if (!ffmpegUnavailableLogged) {
      ffmpegUnavailableLogged = true;
      console.warn('[ffmpeg-fallback] runtime unavailable; skip ffmpeg.wasm fallback');
    }
    return null;
  }
  if (ffmpegInstancePromise) return ffmpegInstancePromise;
  ffmpegInstancePromise = (async () => {
    const { createFFmpeg } = window.FFmpeg;
    const coreUrlObj = new URL(FFMPEG_CORE_PATH, window.location.href);
    const wasmUrlObj = new URL(FFMPEG_WASM_PATH, window.location.href);
    const workerUrlObj = new URL(FFMPEG_WORKER_PATH, window.location.href);
    coreUrlObj.searchParams.set('v', FFMPEG_ASSET_VERSION);
    wasmUrlObj.searchParams.set('v', FFMPEG_ASSET_VERSION);
    workerUrlObj.searchParams.set('v', FFMPEG_ASSET_VERSION);
    const coreUrl = coreUrlObj.toString();
    const wasmUrl = wasmUrlObj.toString();
    const workerUrl = workerUrlObj.toString();
    const ffmpeg = createFFmpeg({
      log: false,
      corePath: coreUrl,
      wasmPath: wasmUrl,
      workerPath: workerUrl,
      mainName: FFMPEG_CORE_MAIN_NAME,
    });
    console.log('[ffmpeg-fallback] load start', {
      coreUrl,
      wasmUrl,
      workerUrl,
      hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined'
    });
    await ffmpeg.load();
    console.log('[ffmpeg-fallback] load success');
    return ffmpeg;
  })().catch((err) => {
    console.warn('[ffmpeg-fallback] load failed', { message: err?.message || String(err) });
    ffmpegInstancePromise = null;
    return null;
  });
  return ffmpegInstancePromise;
}

function resetFfmpegInstance(reason = '') {
  const current = ffmpegInstancePromise;
  ffmpegInstancePromise = null;
  if (reason) {
    console.warn('[ffmpeg-fallback] instance reset', { reason });
  }
  if (!current) return;
  current.then((ffmpeg) => {
    try { ffmpeg.exit(); } catch {}
  }).catch(() => {});
}

async function stripMp4AudioTrackWithFfmpeg(blob, itemName = '') {
  if (!blob || !blob.size) return null;
  const isBusyError = (err) => /can only run one command at a time/i.test(err?.message || String(err || ''));
  const isExitZeroError = (err) => /exit\(0\)/i.test(err?.message || String(err || ''));
  const readOutputBytes = (ffmpeg, outputName) => {
    try {
      const out = ffmpeg.FS('readFile', outputName);
      return out && out.length ? out : null;
    } catch {
      return null;
    }
  };
  const runWithBusyRetry = async (ffmpeg, args, phase) => {
    let lastErr = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        await ffmpeg.run(...args);
        return;
      } catch (err) {
        lastErr = err;
        if (isBusyError(err) && attempt < 5) {
          console.warn('[ffmpeg-fallback] run busy; retry', { name: itemName, phase, attempt });
          await sleep(120 * attempt);
          continue;
        }
        throw err;
      }
    }
    throw lastErr || new Error('ffmpeg run failed');
  };
  const runJob = async (allowRecovery = true) => {
    const ffmpeg = await getFfmpegInstance();
    if (!ffmpeg) return null;
    const fetchFile = window.FFmpeg.fetchFile;
    const input = `live-in-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
    const output = `live-out-${Date.now()}-${Math.random().toString(36).slice(2)}.mp4`;
    const cleanup = () => {
      try { ffmpeg.FS('unlink', input); } catch {}
      try { ffmpeg.FS('unlink', output); } catch {}
    };
    try {
      console.log('[ffmpeg-fallback] strip request', { name: itemName, size: blob.size, type: blob.type || '' });
      ffmpeg.FS('writeFile', input, await fetchFile(blob));
      try {
        await runWithBusyRetry(ffmpeg, ['-i', input, '-map', '0:v:0', '-c:v', 'copy', '-an', '-movflags', '+faststart', output], 'primary');
      } catch (errPrimary) {
        console.warn('[ffmpeg-fallback] strip primary failed', { name: itemName, message: errPrimary?.message || String(errPrimary) });
        if (isBusyError(errPrimary)) throw errPrimary;
        const primaryOut = readOutputBytes(ffmpeg, output);
        if (primaryOut) {
          const result = new Blob([primaryOut], { type: 'video/mp4' });
          console.log('[ffmpeg-fallback] strip success after primary soft-fail', { name: itemName, before: blob.size, after: result.size });
          cleanup();
          return result;
        }
        if (isExitZeroError(errPrimary)) {
          await sleep(80);
        }
        try { ffmpeg.FS('unlink', output); } catch {}
        await runWithBusyRetry(ffmpeg, ['-i', input, '-c', 'copy', '-an', '-movflags', '+faststart', output], 'fallback');
      }
      const out = readOutputBytes(ffmpeg, output);
      if (!out || !out.length) {
        console.warn('[ffmpeg-fallback] strip produced empty output', { name: itemName });
        cleanup();
        return null;
      }
      const result = new Blob([out], { type: 'video/mp4' });
      console.log('[ffmpeg-fallback] strip success', { name: itemName, before: blob.size, after: result.size });
      cleanup();
      return result;
    } catch (err) {
      if (allowRecovery && isBusyError(err)) {
        resetFfmpegInstance('busy-stuck');
        await sleep(180);
        return await runJob(false);
      }
      console.warn('[ffmpeg-fallback] strip failed', { name: itemName, message: err?.message || String(err) });
      cleanup();
      return null;
    }
  };
  ffmpegRunQueue = ffmpegRunQueue.then(runJob, runJob);
  return await ffmpegRunQueue;
}

async function stripMp4AudioTrackWithMp4Box(blob) {
  if (!blob || !blob.size) return null;
  const mod = await loadMp4BoxModule();
  if (!mod || typeof mod.createFile !== 'function') return null;
  const source = await blob.arrayBuffer();
  const mp4File = mod.createFile();
  return await new Promise((resolve) => {
    let settled = false;
    let videoTrackId = null;
    let initSegment = null;
    const mediaSegments = [];

    const finish = (out) => {
      if (settled) return;
      settled = true;
      try { mp4File.stop(); } catch {}
      resolve(out);
    };

    const finalizeOutput = () => {
      if (!initSegment || mediaSegments.length === 0) {
        finish(null);
        return;
      }
      const merged = [initSegment, ...mediaSegments];
      finish(new Blob(merged, { type: 'video/mp4' }));
    };

    mp4File.onError = (err) => {
      console.warn('[mp4box] remux failed', { message: String(err || '') });
      finish(null);
    };

    mp4File.onSegment = (id, user, buffer, sampleNumber, last) => {
      if (id !== videoTrackId || !buffer) return;
      mediaSegments.push(buffer.slice(0));
      if (last) finalizeOutput();
    };

    mp4File.onReady = (info) => {
      const tracks = Array.isArray(info?.tracks) ? info.tracks : [];
      const hasAudio = tracks.some((t) => !!t.audio);
      const videoTrack = tracks.find((t) => !!t.video);
      if (!hasAudio || !videoTrack) {
        finish(null);
        return;
      }
      videoTrackId = videoTrack.id;
      try {
        mp4File.setSegmentOptions(videoTrackId, null, { nbSamples: 500, rapAlignement: true });
        const initSegs = mp4File.initializeSegmentation();
        const init = Array.isArray(initSegs) ? initSegs.find((s) => s.id === videoTrackId) : null;
        initSegment = init?.buffer ? init.buffer.slice(0) : null;
        mp4File.start();
        mp4File.flush();
        setTimeout(() => {
          if (!settled) finalizeOutput();
        }, 50);
      } catch (err) {
        console.warn('[mp4box] segment setup failed', { message: err?.message || String(err) });
        finish(null);
      }
    };

    try {
      const input = source.slice(0);
      input.fileStart = 0;
      mp4File.appendBuffer(input);
      mp4File.flush();
      setTimeout(() => {
        if (!settled) {
          console.warn('[mp4box] remux timeout');
          finish(null);
        }
      }, 1500);
    } catch (err) {
      console.warn('[mp4box] append failed', { message: err?.message || String(err) });
      finish(null);
    }
  });
}

async function stripMp4AudioTrackLegacy(blob) {
  try {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const top = parseBoxes(bytes);
    const moov = top.find(box => box.type === 'moov');
    if (!moov || !moov.children) return null;

    const keptChildren = [];
    let droppedAudio = false;
    let hasVideo = false;
    for (const child of moov.children) {
      if (child.type !== 'trak') {
        keptChildren.push(bytes.slice(child.start, child.end));
        continue;
      }
      const mdia = findChildBox(child, 'mdia');
      const hdlr = mdia ? findChildBox(mdia, 'hdlr') : null;
      const handler = readHandlerType(bytes, hdlr);
      if (handler === 'soun') {
        droppedAudio = true;
        continue;
      }
      if (handler === 'vide') hasVideo = true;
      keptChildren.push(bytes.slice(child.start, child.end));
    }
    if (!droppedAudio || !hasVideo) return null;

    const newMoovPayload = concatBytes(keptChildren);
    const newMoov = buildBox('moov', newMoovPayload);
    const rebuilt = [];
    for (const box of top) {
      if (box.type === 'moov') {
        rebuilt.push(newMoov);
      } else {
        rebuilt.push(bytes.slice(box.start, box.end));
      }
    }
    return new Blob(rebuilt, { type: 'video/mp4' });
  } catch {
    return null;
  }
}

async function stripMp4AudioTrack(blob, options = {}) {
  const { itemName = '' } = options;
  console.log('[mp4box] strip request', { size: blob?.size || 0, type: blob?.type || '', itemName });
  const mp4boxResult = await stripMp4AudioTrackWithMp4Box(blob);
  if (mp4boxResult) {
    console.log('[mp4box] strip success', { before: blob?.size || 0, after: mp4boxResult.size });
    return mp4boxResult;
  }
  console.warn('[mp4box] strip fallback legacy');
  const legacyResult = await stripMp4AudioTrackLegacy(blob);
  if (legacyResult) {
    console.log('[mp4box] strip success legacy', { before: blob?.size || 0, after: legacyResult.size });
    return legacyResult;
  }
  console.warn('[mp4box] strip fallback ffmpeg');
  return await stripMp4AudioTrackWithFfmpeg(blob, itemName);
}

function trimMp4Buffer(buf) {
  if (!buf || buf.byteLength < 16) return buf;
  const bytes = new Uint8Array(buf);
  if (readBoxType(bytes, 0) !== 'ftyp') return buf;
  let pos = 0;
  let sawMoov = false;
  let sawMdat = false;
  for (let i = 0; i < 512 && pos + 8 <= bytes.length; i++) {
    const size = readBoxSize(bytes, pos);
    if (size == null || size < 8) break;
    if (pos + size > bytes.length) break;
    const type = readBoxType(bytes, pos);
    if (type === 'moov') sawMoov = true;
    if (type === 'mdat') sawMdat = true;
    pos += size;
    if (pos === bytes.length) break;
  }
  if (pos > 0 && pos <= bytes.length && (sawMoov || sawMdat) && pos >= 1024) {
    return buf.slice(0, pos);
  }
  return buf;
}

function findValidMp4Offset(buf) {
  const bytes = new Uint8Array(buf);
  const max = bytes.length - 12;
  for (let i = 0; i <= max; i++) {
    if (bytes[i + 4] !== 0x66 || bytes[i + 5] !== 0x74 || bytes[i + 6] !== 0x79 || bytes[i + 7] !== 0x70) continue;
    const result = validateMp4At(bytes, i);
    if (result.valid) return i;
  }
  return -1;
}

async function readBytesAt(file, offset, size) {
  if (offset < 0 || offset >= file.size) return null;
  const slice = file.slice(offset, Math.min(offset + size, file.size));
  return slice.arrayBuffer();
}

async function readTailBytes(file, size) {
  const start = Math.max(0, file.size - size);
  const slice = file.slice(start, file.size);
  return { buffer: await slice.arrayBuffer(), start };
}

function isFtypHeader(buf) {
  if (!buf || buf.byteLength < 12) return false;
  const bytes = new Uint8Array(buf);
  return bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
}

function readFtypBrand(buf) {
  if (!buf || buf.byteLength < 12) return '(unknown)';
  const bytes = new Uint8Array(buf);
  return String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
}

async function findFtypAround(file, center, windowSize = 512 * 1024) {
  const half = Math.floor(windowSize / 2);
  const start = Math.max(0, center - half);
  const buf = await readBytesAt(file, start, windowSize);
  if (!buf) return -1;
  const rel = findValidMp4Offset(buf);
  if (rel < 0) return -1;
  return start + rel;
}

async function readTailText(file, size) {
  const { buffer } = await readTailBytes(file, size);
  return new TextDecoder('latin1').decode(new Uint8Array(buffer));
}

async function parseMicroOffsetFromTail(file) {
  try {
    const text = await readTailText(file, 512 * 1024);
    const match = text.match(/MicroVideoOffset[^0-9]*(\\d+)/i);
    if (!match) return null;
    const num = Number(match[1]);
    return Number.isFinite(num) ? num : null;
  } catch {
    return null;
  }
}

async function extractEmbeddedVideoFromFile(file, preferredOffset = null) {
  const minBytes = 200 * 1024;
  if (Number.isFinite(preferredOffset) && preferredOffset > 0) {
    const candidates = [];
    const fromStart = preferredOffset;
    const fromEnd = file.size - preferredOffset;
    if (fromStart > 0 && fromStart < file.size - 12) candidates.push(fromStart);
    if (fromEnd > 0 && fromEnd < file.size - 12) candidates.push(fromEnd);
    for (const offset of candidates) {
      let chosen = -1;
      const windowSize = Math.min(file.size, 4 * 1024 * 1024);
      const start = Math.max(0, offset - Math.floor(windowSize / 2));
      const aroundBuf = await readBytesAt(file, start, windowSize);
      if (aroundBuf) {
        const rel = findValidMp4Offset(aroundBuf);
        if (rel >= 0) chosen = start + rel;
      }
      if (chosen < 0) {
        const head = await readBytesAt(file, offset, 16);
        if (isFtypHeader(head)) chosen = offset;
      }
      if (chosen < 0) continue;
      if (file.size - chosen < minBytes) continue;
      const tail = await file.slice(chosen).arrayBuffer();
      const trimmed = trimMp4Buffer(tail);
      if (platformInfo.isAndroid) {
        const brand = readFtypBrand(await readBytesAt(file, chosen, 16));
        console.debug('[live-debug] extract offset', { method: 'microOffset', offset: chosen, fileSize: file.size });
        console.debug('[live-debug] mp4 brand', { method: 'microOffset', brand });
        if (trimmed.byteLength !== tail.byteLength) {
          console.debug('[live-debug] mp4 trim', { method: 'microOffset', original: tail.byteLength, trimmed: trimmed.byteLength });
        }
      }
      return new Blob([trimmed], { type: 'video/mp4' });
    }
  }
  // Prefer ftyp in tail (common for embedded video at end of JPEG).
  const tailSize = Math.min(file.size, 16 * 1024 * 1024);
  const tailProbe = await readTailBytes(file, tailSize);
  const tailRel = findValidMp4Offset(tailProbe.buffer);
  if (tailRel >= 0) {
    const offset = tailProbe.start + tailRel;
    if (file.size - offset >= minBytes) {
      const head = await readBytesAt(file, offset, 16);
      if (isFtypHeader(head)) {
        const tail = await file.slice(offset).arrayBuffer();
        const trimmed = trimMp4Buffer(tail);
        if (platformInfo.isAndroid) {
          const brand = readFtypBrand(head);
          console.debug('[live-debug] extract offset', { method: 'tail-ftyp', offset, fileSize: file.size });
          console.debug('[live-debug] mp4 brand', { method: 'tail-ftyp', brand });
          if (trimmed.byteLength !== tail.byteLength) {
            console.debug('[live-debug] mp4 trim', { method: 'tail-ftyp', original: tail.byteLength, trimmed: trimmed.byteLength });
          }
        }
        return new Blob([trimmed], { type: 'video/mp4' });
      }
    }
  }
  const probeSizes = [1024 * 1024, 4 * 1024 * 1024];
  for (const size of probeSizes) {
    const probe = await readHeadBytes(file, Math.min(size, file.size));
    let offset = findValidMp4Offset(probe);
    if (offset < 0) continue;
    if (offset + 12 > probe.byteLength) {
      const bigger = await readHeadBytes(file, Math.min(file.size, Math.max(size * 2, offset + 32)));
      offset = findValidMp4Offset(bigger);
      if (offset < 0) continue;
    }
    if (file.size - offset < minBytes) continue;
    const tail = await file.slice(offset).arrayBuffer();
    if (isFtypHeader(tail)) {
      const trimmed = trimMp4Buffer(tail);
      return new Blob([trimmed], { type: 'video/mp4' });
    }
    const blob = extractEmbeddedVideo(tail, 0);
    if (blob) return blob;
  }
  return null;
}

async function readHeadBytes(file, size) {
  const slice = file.slice(0, Math.min(size, file.size));
  return slice.arrayBuffer();
}

function getScanConcurrency() {
  if (platformInfo.isAndroid) return 2;
  if (platformInfo.isIOS) return 2;
  return 6;
}

function shouldDeepScanForEmbeddedVideo(file, xmp, hasMotionTag, microOffset) {
  if (hasMotionTag || microOffset != null) return true;
  const lower = (file.name || '').toLowerCase();
  const nameHint = /(live|motion|mvimg|microvideo)/i.test(lower);
  if (nameHint && file.size <= 40 * 1024 * 1024) return true;
  if (xmp && /GCamera|MotionPhoto|MicroVideo|Xiaomi|vivo|OPPO|HONOR/i.test(xmp)) return true;
  return false;
}

function isLikelyLiveName(name) {
  return /(live|motion|mvimg|microvideo|livephoto|motionphoto)/i.test(name || '');
}

async function scanFiles(files) {
  const items = [];
  const byBase = new Map();
  for (const f of files) {
    const base = f.name.replace(/\.[^/.]+$/, '').toLowerCase();
    if (!byBase.has(base)) byBase.set(base, []);
    byBase.get(base).push(f);
  }

  const queue = files.filter(isImageFile);
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
      const likelyByName = isLikelyLiveName(file.name);
      // Keep Android fast path smaller; use larger head on desktop for better vendor/exif coverage.
      const headReadSize = platformInfo.isAndroid ? 160 * 1024 : 512 * 1024;
      const head = await readHeadBytes(file, headReadSize);
      const metadata = await parseImageMetadata(file, { needXmp: true, headBuffer: head });
      const xmp = metadata.xmp || '';
      const exif = metadata.exif || {};
      item.exifChecked = true;
      if (Object.keys(exif).length) {
        item.exif = exif;
        item.exifTime = parseExifTime(exif);
      }
      if (metadata.source === 'exifr' && likelyByName) {
        console.debug('[meta] exifr metadata', { name: file.name, hasXmp: !!xmp, exifKeys: Object.keys(exif).length });
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

      const makeText = String(exif?.Make || '').toLowerCase();
      const modelText = String(exif?.Model || '').toLowerCase();
      if (!vendorType && /honor/.test(`${makeText} ${modelText}`)) {
        vendorType = 'HONOR Live Photo';
        console.debug('[live-detect] honor exif', { name: file.name, make: exif?.Make || '', model: exif?.Model || '' });
      }

      const likelyLive = hasMotionTag || !!vendorType || likelyByName;
      if (microOffset == null && likelyLive) {
        microOffset = await parseMicroOffsetFromTail(file);
      }

      let videoBlob = null;
      const needsDeepScan = likelyLive || shouldDeepScanForEmbeddedVideo(file, xmp, hasMotionTag, microOffset);
      if (needsDeepScan || microOffset != null) {
        videoBlob = await extractEmbeddedVideoFromFile(file, microOffset);
      }
      // Full-file scan is expensive; avoid it on Android unless we have strong hints.
      if (!videoBlob && needsDeepScan && (!platformInfo.isAndroid || hasMotionTag || microOffset != null)) {
        const full = await file.arrayBuffer();
        videoBlob = extractEmbeddedVideo(full, microOffset);
        if (videoBlob && platformInfo.isAndroid) {
          console.debug('[live-debug] extract offset', { method: 'full-scan', offset: microOffset ?? null, fileSize: file.size });
        }
      }
      if (videoBlob) {
        item.isLive = true;
        item.liveType = vendorType || (hasMotionTag ? 'Google Motion Photo' : 'Embedded Video');
        item.videoBlob = videoBlob;
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
  let activeScanToken = 0;
  const thumbQueue = [];
  let thumbInFlight = 0;
  let gridScrollHandler = null;

  function getThumbConcurrency() {
    if (platformInfo.isWindows) return 3;
    if (platformInfo.isAndroid) return 2;
    return 4;
  }

  function getThumbMaxEdge() {
    if (platformInfo.isAndroid) return 320;
    if (platformInfo.isWindows) return 360;
    return 360;
  }

  function sortFilesForInitial(files) {
    const key = state.sortKey || (el.sortSelect ? el.sortSelect.value : 'mtime_desc');
    const list = files.slice();
    const cmpNum = (a, b, desc = true) => desc ? (b - a) : (a - b);
    if (key === 'name_asc' || key === 'name_desc') {
      const dir = key.endsWith('_asc') ? 1 : -1;
      list.sort((a, b) => dir * a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
      return list;
    }
    if (key === 'size_asc' || key === 'size_desc') {
      const desc = key.endsWith('_desc');
      list.sort((a, b) => cmpNum(a.size || 0, b.size || 0, desc));
      return list;
    }
    // shot_* is not available before EXIF parsing; fallback to mtime for initial ordering.
    if (key === 'mtime_asc' || key === 'shot_asc') {
      list.sort((a, b) => cmpNum(a.lastModified || 0, b.lastModified || 0, false));
      return list;
    }
    list.sort((a, b) => cmpNum(a.lastModified || 0, b.lastModified || 0, true));
    return list;
  }

  function syncCardLiveBadge(item) {
    const card = el.grid.querySelector(`.card[data-id="${item.id}"]`);
    if (!card) return;
    const exists = card.querySelector('.live-icon');
    if (item.isLive && !exists) {
      const badge = document.createElement('div');
      badge.className = 'live-icon';
      badge.title = 'Live Photo';
      card.insertBefore(badge, card.firstChild);
    } else if (!item.isLive && exists) {
      exists.remove();
    }
  }

  function queueThumbnail(item, card) {
    if (!item || !card) return;
    if (item._thumbQueued) return;
    item._thumbQueued = true;
    thumbQueue.push({ item, card });
    drainThumbnailQueue();
  }

  function drainThumbnailQueue() {
    const limit = getThumbConcurrency();
    while (thumbInFlight < limit && thumbQueue.length) {
      const task = thumbQueue.shift();
      const item = task.item;
      const card = task.card;
      if (!item || !card || !card.isConnected) {
        if (item) item._thumbQueued = false;
        continue;
      }
      thumbInFlight += 1;
      renderThumbnailTask(item, card).finally(() => {
        item._thumbQueued = false;
        thumbInFlight -= 1;
        drainThumbnailQueue();
      });
    }
  }

  function renderThumbnailTask(item, card) {
    return new Promise((resolve) => {
      try {
        const holder = card.querySelector('.thumb');
        if (!holder || holder.querySelector('img')) {
          resolve();
          return;
        }
        const img = document.createElement('img');
        img.loading = 'lazy';
        img.decoding = 'async';
        if (item.thumbUrl) {
          img.src = item.thumbUrl;
          holder.textContent = '';
          holder.appendChild(img);
          item.thumbLoaded = true;
          resolve();
          return;
        }

        const srcUrl = URL.createObjectURL(item.file);
        const source = new Image();
        source.decoding = 'async';
        source.onload = () => {
          const maxEdge = getThumbMaxEdge();
          const sw = source.naturalWidth || source.width || 1;
          const sh = source.naturalHeight || source.height || 1;
          const scale = Math.min(1, maxEdge / Math.max(sw, sh));
          const tw = Math.max(1, Math.round(sw * scale));
          const th = Math.max(1, Math.round(sh * scale));
          const canvas = document.createElement('canvas');
          canvas.width = tw;
          canvas.height = th;
          const ctx = canvas.getContext('2d', { alpha: false });
          if (ctx) {
            ctx.drawImage(source, 0, 0, tw, th);
            canvas.toBlob((blob) => {
              URL.revokeObjectURL(srcUrl);
              if (blob) {
                item.thumbUrl = URL.createObjectURL(blob);
              } else {
                item.thumbUrl = URL.createObjectURL(item.file);
              }
              img.src = item.thumbUrl;
              holder.textContent = '';
              holder.appendChild(img);
              item.thumbLoaded = true;
              resolve();
            }, 'image/jpeg', 0.78);
          } else {
            URL.revokeObjectURL(srcUrl);
            item.thumbUrl = URL.createObjectURL(item.file);
            img.src = item.thumbUrl;
            holder.textContent = '';
            holder.appendChild(img);
            item.thumbLoaded = true;
            resolve();
          }
        };
        source.onerror = () => {
          URL.revokeObjectURL(srcUrl);
          item.thumbUrl = URL.createObjectURL(item.file);
          img.src = item.thumbUrl;
          holder.textContent = '';
          holder.appendChild(img);
          item.thumbLoaded = true;
          resolve();
        };
        source.src = srcUrl;
      } catch {
        resolve();
      }
    });
  }

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

  function ensureGridLoadHint() {
    let hint = document.getElementById('gridLoadHint');
    if (hint) return hint;
    hint = document.createElement('div');
    hint.id = 'gridLoadHint';
    hint.className = 'grid-load-hint hidden';
    hint.textContent = 'Loading more...';
    document.body.appendChild(hint);
    return hint;
  }

  function setGridLoadHint(show, text = 'Loading more...') {
    const hint = ensureGridLoadHint();
    hint.textContent = text;
    hint.classList.toggle('hidden', !show);
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

  async function buildBaseMap(files) {
    const byBase = new Map();
    const chunk = platformInfo.isAndroid ? 40 : 800;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const base = f.name.replace(/\.[^/.]+$/, '').toLowerCase();
      if (!byBase.has(base)) byBase.set(base, []);
      byBase.get(base).push(f);
      if (i === 0 || i % chunk === 0) {
        updateScanOverlay(i, files.length, 'Indexing');
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    updateScanOverlay(files.length, Math.max(1, files.length), 'Indexing');
    return byBase;
  }

  function createPlaceholderItem(file, byBase) {
    const id = crypto.randomUUID();
    const item = {
      id,
      name: file.name,
      file,
      isLive: false,
      liveType: 'Still',
      videoBlob: null,
      thumbLoaded: false,
      exif: null,
      exifTime: null,
      exifChecked: false,
      objectUrl: null,
      _scanDone: false,
      _audioStrippedBlob: null
    };
    const base = file.name.replace(/\.[^/.]+$/, '').toLowerCase();
    const siblings = byBase.get(base) || [];
    const mov = siblings.find(f => f.name.toLowerCase().endsWith('.mov'));
    if (mov) {
      item.isLive = true;
      item.liveType = 'iOS Live Photo';
      item.videoBlob = mov.type ? mov : new Blob([mov], { type: 'video/quicktime' });
      item._scanDone = true;
    }
    return item;
  }

  function mergeAnalyzedItem(target, analyzed) {
    target.isLive = !!analyzed.isLive;
    target.liveType = analyzed.liveType || (target.isLive ? 'Embedded Video' : 'Still');
    target.videoBlob = analyzed.videoBlob || null;
    target.exif = analyzed.exif || target.exif || null;
    target.exifTime = analyzed.exifTime ?? target.exifTime ?? null;
    target.exifChecked = analyzed.exifChecked || target.exifChecked;
    target._scanDone = true;
  }

  async function progressiveAnalyzeItems(items, byBase, token, priorityIds = []) {
    const pending = items.filter(i => !i._scanDone);
    const prioritySet = new Set(priorityIds);
    const queue = [];
    if (prioritySet.size) {
      for (const item of pending) {
        if (prioritySet.has(item.id)) queue.push(item);
      }
      for (const item of pending) {
        if (!prioritySet.has(item.id)) queue.push(item);
      }
    } else {
      queue.push(...pending);
    }
    const total = items.length;
    const baseDone = total - queue.length;
    let done = baseDone;
    let discoveredLive = items.filter(i => i.isLive).length;
    const concurrency = platformInfo.isAndroid ? 3 : 3;
    const statusTick = platformInfo.isAndroid ? 6 : 24;
    const statTick = platformInfo.isAndroid ? 80 : 220;
    let cursor = 0;

    const updateProgress = (force = false) => {
      if (!force && done % statusTick !== 0) return;
      updateScanOverlay(done, total, 'Scanning');
      setStatus(`Scanning ${done}/${total}... Live ${discoveredLive}`);
      if (force || done % statTick === 0) updateStats();
    };

    updateProgress(true);

    async function worker() {
      while (cursor < queue.length) {
        if (token !== activeScanToken) return;
        const idx = cursor++;
        const item = queue[idx];
        const wasLive = item.isLive;
        const analyzed = await analyzeFile(item.file, byBase);
        if (token !== activeScanToken) return;
        mergeAnalyzedItem(item, analyzed);
        if (!wasLive && item.isLive) {
          syncCardLiveBadge(item);
        }
        done += 1;
        if (item.isLive) discoveredLive += 1;
        updateProgress();
        if (done % 8 === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }

    const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
    await Promise.all(workers);
    if (token !== activeScanToken) return;
    updateProgress(true);
  }

  async function startScanOverride() {
    if (!state.files.length) return;
    const token = ++activeScanToken;
    state.scanning = true;
    thumbQueue.length = 0;
    thumbInFlight = 0;
    showScanOverlay();
    updateScanOverlay(0, Math.max(1, state.files.length), 'Indexing');
    setStatus('Indexing files...');
    // Ensure overlay is painted before heavy indexing starts.
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

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

    const byBase = await buildBaseMap(state.files);
    state.scanByBase = byBase;
    const queue = sortFilesForInitial(state.files.filter(isImageFile));
    updateScanOverlay(0, Math.max(1, queue.length), 'Preparing');
    const placeholders = [];
    const chunk = platformInfo.isAndroid ? 80 : 900;
    for (let i = 0; i < queue.length; i++) {
      placeholders.push(createPlaceholderItem(queue[i], byBase));
      if (i === 0 || i % chunk === 0) {
        updateScanOverlay(i, queue.length, 'Preparing');
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    updateScanOverlay(queue.length, Math.max(1, queue.length), 'Preparing');
    state.items = placeholders;
    state.itemById = new Map(state.items.map(i => [i.id, i]));
    renderGrid();
    updateStats();
    hideScanOverlay();
    setStatus(`Indexed ${state.items.length} files, scanning in background...`);
    const priorityIds = state.filtered
      .slice(0, platformInfo.isAndroid ? 120 : 320)
      .map(item => item.id);
    await progressiveAnalyzeItems(state.items, byBase, token, priorityIds);
    if (token !== activeScanToken) return;
    if (state.filter !== 'all' || String(state.sortKey || '').startsWith('shot')) {
      renderGrid({ skipGallery: true });
    }
    updateStats();
    state.scanning = false;
    hideScanOverlay();
    setStatus('Scan complete');
  }

  function loadThumbnailOverride(item, card) {
    queueThumbnail(item, card);
  }

  function renderGridOverride(options = {}) {
    const { skipGallery = false } = options;
    if (renderTimer) {
      clearTimeout(renderTimer);
      renderTimer = null;
    }
    if (gridScrollHandler) {
      window.removeEventListener('scroll', gridScrollHandler);
      gridScrollHandler = null;
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
    if (!skipGallery) {
      const galleryLimit = platformInfo.isAndroid ? 400 : 1200;
      if (sorted.length <= galleryLimit) {
        updateViewerGallery();
      } else {
        releaseViewerUrls();
        el.viewerGallery.innerHTML = '';
        console.debug('[viewer] defer gallery build for large list', { total: sorted.length, galleryLimit });
      }
    }

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
    const chunkSize = platformInfo.isAndroid ? 60 : 160;
    const firstBurst = platformInfo.isAndroid ? 2 : 3;
    let sentinel = null;
    let appending = false;
    const renderAllPlaceholders = platformInfo.isAndroid && state.scanning;

    const appendChunk = (times = 1) => {
      for (let t = 0; t < times; t++) {
        if (index >= groups.length) break;
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
      }
    };

    const requestAppend = (times = 1) => {
      if (appending || index >= groups.length) return;
      appending = true;
      setGridLoadHint(true, '加载中，继续下滑会自动加载');
      requestAnimationFrame(() => {
        appendChunk(times);
        appending = false;
        if (index >= groups.length) {
          setGridLoadHint(false);
        } else {
          setGridLoadHint(false);
        }
      });
    };

    if (renderAllPlaceholders) {
      const renderAll = () => {
        if (index >= groups.length) {
          setGridLoadHint(false);
          return;
        }
        setGridLoadHint(true, 'Indexing placeholders...');
        appendChunk(2);
        requestAnimationFrame(renderAll);
      };
      requestAnimationFrame(renderAll);
      return;
    }

    const pagerObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        requestAppend(platformInfo.isAndroid ? 2 : 1);
        if (index >= groups.length) {
          if (sentinel) {
            pagerObserver.unobserve(sentinel);
            sentinel.remove();
            sentinel = null;
          }
        }
      }
    }, { rootMargin: '800px 0px' });

    appendChunk(firstBurst);
    if (index < groups.length) {
      sentinel = document.createElement('div');
      sentinel.className = 'grid-sentinel';
      sentinel.textContent = '继续下滑加载更多';
      el.grid.appendChild(sentinel);
      pagerObserver.observe(sentinel);
      setGridLoadHint(false);
      if (gridScrollHandler) {
        window.removeEventListener('scroll', gridScrollHandler);
        gridScrollHandler = null;
      }
      gridScrollHandler = () => {
        const root = document.scrollingElement || document.documentElement;
        if (!root) return;
        const remain = root.scrollHeight - root.scrollTop - root.clientHeight;
        if (remain < (platformInfo.isAndroid ? 1400 : 1000)) {
          requestAppend(platformInfo.isAndroid ? 2 : 1);
        }
      };
      window.addEventListener('scroll', gridScrollHandler, { passive: true });
    } else {
      // all visible items were rendered in first burst
      if (sentinel) {
        sentinel.remove();
        sentinel = null;
      }
      setGridLoadHint(false);
      if (gridScrollHandler) {
        window.removeEventListener('scroll', gridScrollHandler);
        gridScrollHandler = null;
      }
    }
  }

  startScan = startScanOverride;
  renderGrid = renderGridOverride;
  loadThumbnail = loadThumbnailOverride;
})();


