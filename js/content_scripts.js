// ============================================================
// IndexedDB 存取 FileSystemDirectoryHandle
// ============================================================
const DB_NAME = 'BilibiliScreenshotDB';
const DB_VERSION = 1;
const STORE_NAME = 'settings';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => { resolve(req.result); db.close(); };
    req.onerror = () => { reject(req.error); db.close(); };
  }));
}

function dbPut(key, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => { resolve(); db.close(); };
    req.onerror = () => { reject(req.error); db.close(); };
  }));
}

// ============================================================
// 目录选择 UI
// ============================================================
let folderPickerResolve = null;

function showFolderPickerButton() {
  // 移除已有按钮
  const old = document.getElementById('bcs-folder-picker-btn');
  if (old) old.remove();

  const btn = document.createElement('div');
  btn.id = 'bcs-folder-picker-btn';
  btn.textContent = '📁 点击选择截图保存目录';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '12px 20px',
    backgroundColor: '#00a1d6',
    color: 'white',
    borderRadius: '8px',
    cursor: 'pointer',
    zIndex: 1000000,
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
    fontFamily: 'sans-serif'
  });

  btn.addEventListener('click', async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ startIn: 'downloads' });
      await dbPut('saveDir', dirHandle);
      btn.textContent = '✅ 目录已选择';
      btn.style.backgroundColor = '#52c41a';
      setTimeout(() => btn.remove(), 2000);
      if (folderPickerResolve) {
        folderPickerResolve(dirHandle);
        folderPickerResolve = null;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        btn.textContent = '❌ 选择失败，重试';
        btn.style.backgroundColor = '#ff4d4f';
        setTimeout(() => btn.remove(), 3000);
      }
    }
  });

  document.body.appendChild(btn);
}

// ============================================================
// 保存到用户选择的目录
// ============================================================
async function saveToUserDir(blob, fileName) {
  let dirHandle = await dbGet('saveDir');

  // 有 handle 但权限可能过期
  if (dirHandle) {
    try {
      const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      }
    } catch (e) {
      console.warn('目录权限失效，需重新选择', e);
    }
  }

  // 没有 handle 或权限失效 → 等待用户点击选择目录
  return false;
}

// ============================================================
// 页面类型检测
// ============================================================
function isLiveRoom() {
  return window.location.hostname === 'live.bilibili.com';
}

// ============================================================
// 提取标识符（视频: BV号 / 直播间: roomId）
// ============================================================
function getBvid() {
  if (isLiveRoom()) {
    var m = window.location.pathname.match(/^\/(\d+)/);
    return m ? 'live' + m[1] : 'liveunknown';
  }
  var m = window.location.pathname.match(/\/video\/(BV[\w]+)/);
  return m ? m[1] : 'unknown';
}

// ============================================================
// 获取视频当前位置描述
// ============================================================
function formatVideoTime(seconds) {
  var s = Math.floor(seconds);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  return String(h).padStart(2, '0') + '_' + String(m).padStart(2, '0') + '_' + String(sec).padStart(2, '0');
}

// ============================================================
// 获取直播间持续时间
// 1. 从 <script> 标签 DOM 中解析 live_time（精确 Unix 时间戳）
// 2. 兜底从页面 DOM 扫描 HH:MM:SS
// ============================================================
function getLiveDuration() {
  // 方案一：从 <script> 标签文本中解析 live_time
  try {
    var scripts = document.querySelectorAll('script');
    var prefix = 'window.__NEPTUNE_IS_MY_WAIFU__';
    for (var si = 0; si < scripts.length; si++) {
      var content = scripts[si].textContent || '';
      var idx = content.indexOf(prefix);
      if (idx === -1) continue;

      var eqIdx = content.indexOf('=', idx + prefix.length);
      if (eqIdx === -1) continue;

      // 手动匹配花括号深度，精确提取 JSON
      var start = eqIdx + 1;
      var depth = 0;
      var inStr = false;
      for (var ci = start; ci < content.length; ci++) {
        var ch = content[ci];
        if (inStr) {
          if (ch === '\\') { ci++; continue; }
          if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === '{') depth++;
        if (ch === '}') {
          depth--;
          if (depth === 0) {
            var data = JSON.parse(content.substring(start, ci + 1));
            var liveTime = data.roomInitRes && data.roomInitRes.data && data.roomInitRes.data.live_time;
            if (liveTime && liveTime > 0) {
              var now = Math.floor(Date.now() / 1000);
              var secs = now - liveTime;
              if (secs >= 60 && secs <= 86400) return formatVideoTime(secs);
            }
            break;
          }
        }
      }
    }
  } catch (e) {
    console.warn('getLiveDuration 标签解析失败:', e);
  }

  // 方案二：兜底从 DOM 扫描 HH:MM:SS
  var selectors = [
    "[class*='live-time']",
    "[class*='live-timer']",
    "[class*='room-header'] [class*='time']",
    "[class*='header-info'] [class*='time']",
    "[class*='live-status']",
    "[class*='live-info'] [class*='time']",
    "[class*='timer']",
    "[class*='duration']"
  ];

  for (var i = 0; i < selectors.length; i++) {
    var els = document.querySelectorAll(selectors[i]);
    for (var j = 0; j < els.length; j++) {
      var text = els[j].textContent.trim();
      var m = text.match(/(\d+):(\d+):(\d+)/);
      if (m) {
        var secs = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
        if (secs >= 60 && secs <= 86400) return formatVideoTime(secs);
      }
    }
  }

  // 全页面兜底扫描
  var allEls = document.querySelectorAll('span, div, p, label');
  var best = null;
  for (var i = 0; i < allEls.length; i++) {
    var text = allEls[i].textContent.trim();
    var m = text.match(/(\d+):(\d+):(\d+)/);
    if (m) {
      var secs = parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
      if (secs >= 60 && secs <= 86400) {
        if (best === null || secs < best) best = secs;
      }
    }
  }
  if (best !== null) return formatVideoTime(best);

  return null;
}

// ============================================================
// 查找视频元素（支持视频页 + 直播间）
// ============================================================
function findVideoElement() {
  // 优先尝试各选择器（覆盖视频页 & 直播间）
  var selectors = [
    ".bpx-player-video-wrap video",     // 视频页
    ".video-player-mount video",         // 直播间新版
    ".live-player-mount video",          // 直播间新版备选
    "#live-player video",                // 直播间经典
    ".live-video-player video",          // 直播间备选
    "video[src*='blob']",                // blob 源通用
    "video"
  ];

  for (var i = 0; i < selectors.length; i++) {
    var v = document.querySelector(selectors[i]);
    if (v) {
      console.log('找到视频元素，选择器:', selectors[i]);
      return v;
    }
  }

  return null;
}

// ============================================================
// 核心：截图 + 保存
// ============================================================
async function captureVideoImage() {
  var v = findVideoElement();
  if (!v) {
    console.error('未找到视频元素');
    alert('未找到视频元素，请确保您在B站视频或直播间页面');
    return;
  }

  if (!v.videoWidth || !v.videoHeight) {
    console.error('视频尚未加载完成');
    alert('视频尚未加载完成，请稍后重试');
    return;
  }

  var myCanvas = new OffscreenCanvas(v.videoWidth, v.videoHeight);
  var ctx = myCanvas.getContext('2d');
  ctx.drawImage(v, 0, 0, v.videoWidth, v.videoHeight);
  const blob = await myCanvas.convertToBlob();

  // 写入系统剪贴板
  try {
    const clipboardItem = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([clipboardItem]);
    console.log('✅ 截图已复制到剪贴板');
  } catch (err) {
    console.error('剪贴板写入失败:', err);
  }

  var d = new Date();
  var timeStr = '' + d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') +
    String(d.getSeconds()).padStart(2, '0');

  var id = getBvid();
  var fileName;

  if (isLiveRoom()) {
    // 直播间：live+roomId_hh_mm_ss_时间戳.png
    var liveDuration = getLiveDuration();
    var durStr = liveDuration ? liveDuration + '_' : '';
    fileName = id + '_' + durStr + timeStr + '.png';
  } else {
    // 视频页：BV号_hh_mm_ss_时间戳.png
    var pos = formatVideoTime(v.currentTime + 1);
    fileName = id + '_' + pos + '_' + timeStr + '.png';
  }

  // 尝试保存到用户选择的目录
  const saved = await saveToUserDir(blob, fileName);
  if (saved) {
    console.log('✅ 文件已保存到指定目录:', fileName);
    return;
  }

  // 未选择目录或目录不可用 → <a> 标签下载到默认下载文件夹 + 显示选择目录按钮
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    console.log('✅ 文件已下载到默认文件夹:', fileName);
  } catch (err) {
    console.error('文件下载失败:', err);
  }

  // 首次使用：显示目录选择按钮
  const hasDir = await dbGet('saveDir');
  if (!hasDir) {
    showFolderPickerButton();
  }
}

// ============================================================
// 消息监听
// ============================================================
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request === 'captureImage' || request.action === 'captureImage') {
    captureVideoImage();
    sendResponse({ received: true });
    return true;
  }
});
